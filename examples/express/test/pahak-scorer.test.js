const assert = require('node:assert/strict');
const test = require('node:test');
const { createNormalSamples } = require('../src/normal-samples');
const { PahakScorer } = require('../src/pahak-scorer');

test('native Isolation Forest scores an unusual request higher than normal traffic', (context) => {
    const scorer = new PahakScorer(createNormalSamples(), {
        treeCount: 100,
        sampleSize: 128,
        seed: 42n
    });
    context.after(() => scorer.close());

    const ordinaryScore = scorer.score([0, 0, 0.1, 0, 0, 0.1, 0, 0, 0]);
    const unusualScore = scorer.score([1, 1, 1, 1, 0, 0.8, 0, 1, 1]);

    assert.ok(unusualScore > ordinaryScore, `${unusualScore} should exceed ${ordinaryScore}`);
});
