const assert = require('node:assert/strict');
const test = require('node:test');
const { createFeatureExtractor } = require('../src/feature-extractor');

test('request features include an actor history, not only the current action', () => {
    const extractor = createFeatureExtractor();
    const actor = 'user-1';
    const firstRead = extractor.extract({
        method: 'GET',
        path: '/api/items',
        ip: actor
    });
    extractor.record(firstRead);

    const secondRead = extractor.extract({
        method: 'GET',
        path: '/api/items/1',
        ip: actor
    });
    extractor.record(secondRead);

    const firstDelete = extractor.extract({
        method: 'DELETE',
        path: '/api/items/2',
        ip: actor
    });
    extractor.record(firstDelete);

    const repeatedDelete = extractor.extract({
        method: 'DELETE',
        path: '/api/items/3',
        ip: actor
    });

    assert.equal(firstDelete.features[0], 1);
    assert.equal(firstDelete.features[1], 1);
    assert.equal(firstDelete.features[4], 0);
    assert.equal(firstDelete.features[6], 1);
    assert.equal(repeatedDelete.features[2], 0.15);
    assert.equal(repeatedDelete.features[3], 1 / 3);
    assert.equal(repeatedDelete.features[6], 0);
    assert.equal(repeatedDelete.features[7], 0.2);
    assert.equal(repeatedDelete.features[8], 0.2);
});

test('delete sequence features grow with consecutive and repeated-route deletes', () => {
    const extractor = createFeatureExtractor();
    const request = { method: 'DELETE', path: '/api/items/1', ip: 'user-2' };
    for (let index = 0; index < 3; ++index) {
        const context = extractor.extract(request);
        extractor.record(context);
    }

    const repeated = extractor.extract(request);
    assert.equal(repeated.features[7], 0.6);
    assert.equal(repeated.features[8], 0.6);
});
