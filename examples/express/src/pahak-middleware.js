const { createFeatureExtractor } = require('./feature-extractor');

function createPahakMiddleware({
    scorer,
    threshold = 0.605,
    mode = 'monitor',
    featureExtractor = createFeatureExtractor()
}) {
    if (!scorer || typeof scorer.score !== 'function') {
        throw new TypeError('A Pahak scorer is required');
    }
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        throw new RangeError('Pahak threshold must be between 0 and 1');
    }
    if (mode !== 'monitor' && mode !== 'block') {
        throw new TypeError('Pahak mode must be "monitor" or "block"');
    }

    return function pahakMiddleware(request, response, next) {
        const context = featureExtractor.extract(request);
        const score = scorer.score(context.features);
        if (!Number.isFinite(score) || score < 0 || score > 1) {
            return next(new Error('Pahak scorer returned an invalid risk score'));
        }
        featureExtractor.record(context);

        response.set('X-Pahak-Risk', score.toFixed(3));
        if (mode === 'block' && score >= threshold) {
            return response.status(403).json({
                error: 'Request blocked by Pahak as anomalous',
                riskScore: Number(score.toFixed(3))
            });
        }
        return next();
    };
}

module.exports = { createPahakMiddleware };
