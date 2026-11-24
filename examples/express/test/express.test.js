const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createNormalSamples } = require('../src/normal-samples');
const { PahakScorer } = require('../src/pahak-scorer');

test('health endpoint is available without request scoring', async () => {
    const app = createApp({ scorer: { score: () => { throw new Error('must not score health'); } } });
    const response = await request(app).get('/health').expect(200);
    assert.deepEqual(response.body, { status: 'ok' });
});

test('only routes with pahak() are scored', async () => {
    let scoreCalls = 0;
    const app = createApp({ scorer: { score: () => { scoreCalls += 1; return 0.2; } } });

    await request(app).get('/api/public/status').expect(200);
    assert.equal(scoreCalls, 0);

    await request(app).get('/api/items').expect(200);
    assert.equal(scoreCalls, 1);
});

test('both API variants provide ten seeded rows and CRUD behavior', async () => {
    let scoreCalls = 0;
    const app = createApp({
        scorer: {
            score: () => {
                scoreCalls += 1;
                return 0.2;
            }
        }
    });

    for (const prefix of ['/api/items', '/api/unprotected/items']) {
        const list = await request(app).get(prefix).expect(200);
        assert.equal(list.body.length, 10);

        const created = await request(app)
            .post(prefix)
            .send({ name: 'new test row' })
            .expect(201);
        const itemPath = `${prefix}/${created.body.id}`;

        await request(app).get(itemPath).expect(200);
        const updated = await request(app)
            .put(itemPath)
            .send({ name: 'edited test row' })
            .expect(200);
        assert.equal(updated.body.name, 'edited test row');
        await request(app).delete(itemPath).expect(204);
    }

    assert.equal(scoreCalls, 5);
});

test('protected CRUD endpoints use the Pahak middleware', async () => {
    let scoreCalls = 0;
    const app = createApp({
        scorer: {
            score: () => {
                scoreCalls += 1;
                return 0.2;
            }
        }
    });

    await request(app).get('/api/items').expect(200).expect((response) => {
        assert.equal(response.body.length, 10);
    });
    const created = await request(app)
        .post('/api/items')
        .send({ name: 'created item' })
        .expect(201);
    assert.equal(created.body.id, '11');

    await request(app).get('/api/items/11').expect(200);
    await request(app).put('/api/items/11').send({ name: 'updated item' }).expect(200);
    await request(app).delete('/api/items/11').expect(204);
    assert.equal(scoreCalls, 5);
});

test('unprotected CRUD endpoints bypass Pahak', async () => {
    let scoreCalls = 0;
    const app = createApp({
        scorer: { score: () => { scoreCalls += 1; return 0.2; } }
    });

    const list = await request(app).get('/api/unprotected/items').expect(200);
    assert.equal(list.body.length, 10);
    await request(app).get('/api/unprotected/items/1').expect(200);
    const created = await request(app)
        .post('/api/unprotected/items')
        .send({ name: 'unprotected item' })
        .expect(201);
    await request(app)
        .put(`/api/unprotected/items/${created.body.id}`)
        .send({ name: 'updated unprotected item' })
        .expect(200);
    await request(app).delete(`/api/unprotected/items/${created.body.id}`).expect(204);

    for (let id = 1; id <= 4; ++id) {
        await request(app).delete(`/api/unprotected/items/${id}`).expect(204);
    }
    assert.equal(scoreCalls, 0);
});

test('selected Express routes reach the native C scorer', async () => {
    const scorer = new PahakScorer(createNormalSamples());
    try {
        const app = createApp({ scorer });
        const response = await request(app)
            .get('/api/items')
            .expect(200);
        assert.match(response.headers['x-pahak-risk'], /^\d\.\d{3}$/);
    } finally {
        scorer.close();
    }
});

test('middleware blocks requests at the configured anomaly threshold', async () => {
    const scorer = { score: () => 0.95 };
    const app = createApp({ scorer, threshold: 0.8, mode: 'block' });

    const response = await request(app)
        .get('/api/items')
        .expect('X-Pahak-Risk', '0.950')
        .expect(403);

    assert.deepEqual(response.body, {
        error: 'Request blocked by Pahak as anomalous',
        riskScore: 0.95
    });
});

test('native model allows a normal delete and blocks a repeated delete pattern', async (context) => {
    const threshold = 0.605;
    const scorer = new PahakScorer(createNormalSamples());
    context.after(() => scorer.close());
    const app = createApp({ scorer, threshold, mode: 'block' });

    await request(app).get('/api/items').expect(200);
    await request(app).delete('/api/items/1').expect(204);

    const response = await request(app)
        .delete('/api/items/2')
        .expect(403);

    assert.ok(response.body.riskScore >= threshold);
    assert.equal(response.body.error, 'Request blocked by Pahak as anomalous');
});

test('middleware forwards requests below the configured threshold', async () => {
    const scorer = { score: () => 0.2 };
    const app = createApp({ scorer, threshold: 0.8, mode: 'block' });

    const response = await request(app)
        .get('/api/items')
        .expect('X-Pahak-Risk', '0.200')
        .expect(200);

    assert.equal(response.body.length, 10);
});

test('monitor mode reports risk without blocking', async () => {
    const app = createApp({
        scorer: { score: () => 0.95 },
        threshold: 0.8,
        mode: 'monitor'
    });

    await request(app)
        .get('/api/items')
        .expect('X-Pahak-Risk', '0.950')
        .expect(200);
});

test('route middleware instances share actor history', async () => {
    const featureVectors = [];
    const app = createApp({
        scorer: {
            score: (features) => {
                featureVectors.push(features);
                return 0.2;
            }
        }
    });

    await request(app).get('/api/items').expect(200);
    await request(app).delete('/api/items/2').expect(204);
    await request(app).delete('/api/items/1').expect(204);

    assert.equal(featureVectors.length, 3);
    assert.equal(featureVectors[2][2], 0.1);
    assert.equal(featureVectors[2][3], 0.5);
});
