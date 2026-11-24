const path = require('node:path');
const koffi = require('koffi');

const FEATURE_COUNT = 9;
const PahakModel = koffi.opaque('PahakModel');
const PahakConfig = koffi.struct('PahakConfig', {
    tree_count: 'size_t',
    sample_size: 'size_t',
    max_depth: 'size_t',
    seed: 'uint64_t'
});

function defaultLibraryPath() {
    const libraryName = process.platform === 'win32'
        ? 'pahak.dll'
        : process.platform === 'darwin'
            ? 'libpahak.dylib'
            : 'libpahak.so';
    return path.resolve(__dirname, '../../../build', libraryName);
}

function flattenSamples(samples) {
    if (!Array.isArray(samples) || samples.length < 2) {
        throw new TypeError('At least two normal training samples are required');
    }

    const values = new Float64Array(samples.length * FEATURE_COUNT);
    samples.forEach((row, rowIndex) => {
        if (!Array.isArray(row) || row.length !== FEATURE_COUNT) {
            throw new TypeError(`Training sample ${rowIndex} must have ${FEATURE_COUNT} features`);
        }
        row.forEach((value, featureIndex) => {
            if (!Number.isFinite(value)) {
                throw new TypeError(`Training sample ${rowIndex} contains a non-finite value`);
            }
            values[rowIndex * FEATURE_COUNT + featureIndex] = value;
        });
    });
    return values;
}

class PahakScorer {
    constructor(normalSamples, options = {}) {
        const libraryPath = process.env.PAHAK_LIBRARY_PATH || defaultLibraryPath();
        const library = koffi.load(libraryPath);

        const train = library.func(
            'pahak_model_train',
            'int',
            [
                'const double *',
                'size_t',
                'size_t',
                koffi.pointer(PahakConfig),
                koffi.out(koffi.pointer(PahakModel, 2))
            ]
        );
        this._score = library.func(
            'pahak_model_score',
            'int',
            ['PahakModel *', 'const double *', 'size_t', '_Out_ double *']
        );
        this._free = library.func('pahak_model_free', 'void', ['PahakModel *']);
        this._model = null;
        this._featureCount = FEATURE_COUNT;

        const flattenedSamples = flattenSamples(normalSamples);
        const config = {
            tree_count: options.treeCount || 100,
            sample_size: options.sampleSize || 128,
            max_depth: options.maxDepth || 0,
            seed: options.seed === undefined ? 42n : BigInt(options.seed)
        };
        const outModel = [null];
        const status = train(
            flattenedSamples,
            normalSamples.length,
            FEATURE_COUNT,
            config,
            outModel
        );
        if (status !== 0 || outModel[0] === null) {
            throw new Error(`Pahak model training failed (status ${status})`);
        }
        this._model = outModel[0];
    }

    score(features) {
        if (this._model === null) {
            throw new Error('Pahak scorer has been closed');
        }
        if (!Array.isArray(features) || features.length !== this._featureCount ||
            features.some((value) => !Number.isFinite(value))) {
            throw new TypeError(`Expected ${this._featureCount} finite numeric features`);
        }

        const outScore = [0];
        const status = this._score(
            this._model,
            Float64Array.from(features),
            this._featureCount,
            outScore
        );
        if (status !== 0) {
            throw new Error(`Pahak scoring failed (status ${status})`);
        }
        return outScore[0];
    }

    close() {
        if (this._model !== null) {
            this._free(this._model);
            this._model = null;
        }
    }
}

module.exports = { FEATURE_COUNT, PahakScorer, defaultLibraryPath };
