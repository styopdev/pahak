const express = require('express');
const { createPahak } = require('./pahak');

function createItemStore() {
    const items = new Map();
    for (let id = 1; id <= 10; ++id) {
        items.set(String(id), { id: String(id), name: `Sample item ${id}` });
    }

    return { items, nextId: 11 };
}

function registerItemRoutes(app, basePath, store, protect) {
    function register(method, suffix, handler) {
        const middleware = protect ? [protect()] : [];
        app[method](`${basePath}${suffix}`, ...middleware, handler);
    }

    register('get', '', (request, response) => {
        response.json(Array.from(store.items.values()));
    });

    register('get', '/:id', (request, response) => {
        const item = store.items.get(request.params.id);
        if (!item) {
            return response.status(404).json({ error: 'Item not found' });
        }
        return response.json(item);
    });

    register('post', '', (request, response) => {
        const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
        if (name.length === 0 || name.length > 100) {
            return response.status(400).json({ error: 'Item name must be 1-100 characters' });
        }

        const id = String(store.nextId++);
        const item = { id, name };
        store.items.set(id, item);
        return response.status(201).location(`${basePath}/${id}`).json(item);
    });

    register('put', '/:id', (request, response) => {
        if (!store.items.has(request.params.id)) {
            return response.status(404).json({ error: 'Item not found' });
        }

        const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
        if (name.length === 0 || name.length > 100) {
            return response.status(400).json({ error: 'Item name must be 1-100 characters' });
        }

        const item = { id: request.params.id, name };
        store.items.set(item.id, item);
        return response.json(item);
    });

    register('delete', '/:id', (request, response) => {
        if (!store.items.has(request.params.id)) {
            return response.status(404).json({ error: 'Item not found' });
        }
        store.items.delete(request.params.id);
        return response.status(204).end();
    });
}

function createApp({ scorer, threshold = 0.605, mode = 'monitor' } = {}) {
    const app = express();
    app.use(express.json({ limit: '16kb' }));

    const pahak = createPahak({ scorer, threshold, mode });

    app.get('/health', (request, response) => {
        response.json({ status: 'ok' });
    });

    app.get('/api/public/status', (request, response) => {
        response.json({ status: 'unprotected' });
    });

    registerItemRoutes(app, '/api/items', createItemStore(), pahak);
    registerItemRoutes(app, '/api/unprotected/items', createItemStore(), null);

    return app;
}

module.exports = { createApp };
