# Pahak + Express example

This starter shows an Express adapter calling Pahak's native C Isolation Forest
through [Koffi](https://koffi.dev/). Use `pahak()` as route middleware on only
the Express endpoints you want scored:

```js
const pahak = createPahak({ scorer, threshold: 0.605, mode: 'block' });

app.get('/api/public', publicHandler);
app.get('/api/items', pahak(), listItems);
app.delete('/api/items/:id', pahak(), deleteItem);
```

Each `pahak()` call returns standard Express middleware. Middleware created
from the same `createPahak()` instance shares actor history, so a protected
route can use activity from other protected routes.

## Prerequisites

- Node.js 18 or later
- CMake and a C17 compiler

From the repository root, build Pahak as a shared library, then install and run
the example:

```sh
cmake -S . -B build -DBUILD_SHARED_LIBS=ON
cmake --build build
cd examples/express
npm install
npm test
npm start
```

In Windows PowerShell, use `npm.cmd` instead of `npm` for those commands.

By default, the example loads `build/pahak.dll` on Windows,
`build/libpahak.dylib` on macOS, or `build/libpahak.so` on Linux. Set
`PAHAK_LIBRARY_PATH` to override the library location. Set
`PAHAK_BLOCK_THRESHOLD` to a number from 0 to 1 (default `0.605`). The example
server defaults to `PAHAK_MODE=block`; use `PAHAK_MODE=monitor` to observe scores
without AI-based rejection. The Isolation Forest considers the actor's last 20
protected requests, including delete streak, delete ratio, and route/method
novelty. It does not use a time window or a fixed delete-count rule. Calibrate
the threshold on representative traffic before using it beyond this demo.

Try `GET /health`, `GET /api/items`, and `DELETE /api/items/1`. The health
route bypasses scoring; selected API routes are scored and may receive HTTP
403 in block mode. The middleware uses the authenticated `request.user.id`
when present, otherwise the Express client IP.

## Important limitations

The bundled baseline is synthetic and for demonstration only. Replace
`createNormalSamples()` in `src/normal-samples.js` with representative,
trusted feature vectors before evaluating the threshold. This example does not
provide authentication, production-grade identity resolution, model
persistence, automatic retraining, or a calibrated blocking policy. Scores
are synchronous native calls, so consider moving scoring off the request
thread if the model or traffic grows.

For a React UI to compare protected and unprotected CRUD endpoints, see
[`../react/README.md`](../react/README.md).
