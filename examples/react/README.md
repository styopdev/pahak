# Pahak React CRUD playground

A small React UI for testing the Express example with Pahak enabled and
disabled. It starts with ten items and supports create, list, edit, and delete.
The two modes use separate in-memory stores so you can switch between them
without changing the other mode's data.

## Run it

From the repository root, build the shared C library and install the API
dependencies:

```powershell
cmake -S . -B build -DBUILD_SHARED_LIBS=ON
cmake --build build
cd examples\express
npm.cmd install
```

Start the Express API in one terminal:

```powershell
cd examples\express
$env:PAHAK_MODE = 'block'
$env:PAHAK_BLOCK_THRESHOLD = '0.605'
npm.cmd start
```

In another terminal, start the React dev server:

```powershell
cd examples\react
npm.cmd install
npm.cmd run dev
```

Open the localhost URL printed by Vite. It proxies `/api` requests to the
Express API on port 3000.

Choose **Pahak enabled** and delete a row normally; the baseline behavior should
pass. Repeated consecutive deletes should produce an anomaly score over the
configured threshold and return HTTP 403, even if they are spread out over
time. Choose **Pahak disabled** to try deleting without the Pahak middleware.
Protected and unprotected data are independent, with ten starter rows each.

The model uses the actor's last 20 protected requests, including delete streak,
delete ratio, and route/method novelty. The bundled training baseline is
synthetic and for demonstration only; calibrate it on representative traffic
before relying on blocking decisions.
