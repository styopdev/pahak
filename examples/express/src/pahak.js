const { createFeatureExtractor } = require('./feature-extractor');
const { createPahakMiddleware } = require('./pahak-middleware');

function createPahak({ scorer, threshold = 0.605, mode = 'monitor' } = {}) {
    const featureExtractor = createFeatureExtractor();

    return function pahak(options = {}) {
        return createPahakMiddleware({
            scorer,
            threshold: options.threshold ?? threshold,
            mode: options.mode ?? mode,
            featureExtractor
        });
    };
}

module.exports = { createPahak };
