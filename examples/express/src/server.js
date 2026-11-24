const { createApp } = require('./app');
const { createNormalSamples } = require('./normal-samples');
const { PahakScorer } = require('./pahak-scorer');

const threshold = Number(process.env.PAHAK_BLOCK_THRESHOLD || 0.605);
const mode = process.env.PAHAK_MODE || 'block';
const scorer = new PahakScorer(createNormalSamples());
const app = createApp({ scorer, threshold, mode });
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
    console.log(`Pahak Express example listening on http://localhost:${port}`);
});

function shutdown() {
    server.close(() => {
        scorer.close();
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
