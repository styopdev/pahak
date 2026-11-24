const { createFeatureExtractor } = require('./feature-extractor');

function createNormalSamples() {
    const extractor = createFeatureExtractor();
    const normalSequence = [
        ['GET', '/api/items'],
        ['DELETE', '/api/items/1'],
        ['GET', '/api/items/1'],
        ['GET', '/api/items/2'],
        ['POST', '/api/items'],
        ['GET', '/api/items'],
        ['GET', '/api/items/2'],
        ['GET', '/api/items/1'],
        ['POST', '/api/items'],
        ['GET', '/api/items/2'],
        ['PATCH', '/api/items/1'],
        ['GET', '/api/items'],
        ['GET', '/api/items/1']
    ];
    const samples = [];

    for (let actor = 0; actor < 32; ++actor) {
        for (const [method, requestPath] of normalSequence) {
            const context = extractor.extract({
                method,
                path: requestPath,
                ip: `baseline-${actor}`
            });
            samples.push(context.features);
            extractor.record(context);
        }
    }

    return samples;
}

module.exports = { createNormalSamples };
