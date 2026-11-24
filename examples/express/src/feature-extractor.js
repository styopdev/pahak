const BEHAVIOR_WINDOW = 20;
const MAX_EVENTS_PER_ACTOR = 128;
const MAX_ACTORS = 4096;

function routeKeyFor(request) {
    const rawPath = `${request.baseUrl || ''}${request.path || '/'}`;
    const segments = rawPath.split('/').filter(Boolean).map((segment) => {
        if (/^\d+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)) {
            return ':id';
        }
        return segment.toLowerCase();
    });
    return `/${segments.join('/')}`;
}

function createFeatureExtractor() {
    const historyByActor = new Map();

    function historyFor(actor) {
        let history = historyByActor.get(actor);
        if (history === undefined) {
            if (historyByActor.size >= MAX_ACTORS) {
                historyByActor.delete(historyByActor.keys().next().value);
            }
            history = [];
        } else {
            historyByActor.delete(actor);
        }
        historyByActor.set(actor, history);
        return history;
    }

    function extract(request) {
        const actor = String(request.user?.id || request.ip || 'unknown');
        const history = historyFor(actor);
        const recent = history.slice(-BEHAVIOR_WINDOW);

        const method = String(request.method || 'GET').toUpperCase();
        const route = routeKeyFor(request);
        const isDelete = method === 'DELETE';
        const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        const previousDeleteCount = recent.reduce(
            (count, event) => count + (event.method === 'DELETE' ? 1 : 0),
            0
        );
        const previousRoutes = new Set(recent.map((event) => event.route));
        const previousMethods = new Set(recent.map((event) => event.method));
        let consecutiveDeleteCount = 0;
        for (let index = recent.length - 1; index >= 0; --index) {
            if (recent[index].method !== 'DELETE') {
                break;
            }
            ++consecutiveDeleteCount;
        }
        const sameRouteDeleteCount = recent.reduce(
            (count, event) => count + (
                event.method === 'DELETE' && event.route === route ? 1 : 0
            ),
            0
        );

        return {
            actor,
            route,
            method,
            features: [
                Number(isDelete),
                Number(isWrite),
                recent.length / BEHAVIOR_WINDOW,
                recent.length === 0 ? 0 : previousDeleteCount / recent.length,
                Number(!previousRoutes.has(route)),
                Math.min(previousRoutes.size / 5, 1),
                Number(!previousMethods.has(method)),
                Math.min(consecutiveDeleteCount / 5, 1),
                Math.min(sameRouteDeleteCount / 5, 1)
            ]
        };
    }

    function record(context) {
        const history = historyFor(context.actor);
        history.push({
            method: context.method,
            route: context.route
        });
        if (history.length > MAX_EVENTS_PER_ACTOR) {
            history.splice(0, history.length - MAX_EVENTS_PER_ACTOR);
        }
    }

    return { extract, record };
}

module.exports = { createFeatureExtractor };
