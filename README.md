# Pahak - պահակ

<img width="280" alt="image" src="https://github.com/user-attachments/assets/1e100781-2668-4cd4-b1d8-3a7e578339d3" />

Pahak is an experimental, framework-neutral C library for detecting unusual
request behavior. It uses a machine-learning algorithm called an **Isolation
Forest** to score how anomalous a request looks compared with a baseline of
normal activity. It is AI-based anomaly detection—not an LLM, and not a
collection of fixed rules such as “block after three deletes.”

## How the AI works

<img width="813" height="790" alt="1" src="https://github.com/user-attachments/assets/b59f04fc-d42b-4ec7-a623-acbbad637238" />


Pahak's C core trains on numeric examples of normal behavior. When given a new
feature vector, the model returns a score from `0` to `1`; higher scores mean
the behavior appears more unusual relative to that baseline. The application
or framework adapter decides what to do with the score, for example, logging
it, asking for additional verification, or blocking the request above a
calibrated threshold.

The Express example demonstrates the full flow:

1. The adapter groups protected requests by authenticated user ID when
   available, otherwise by client IP.
2. It summarizes up to 20 recent requests into behavioral features, such as
   delete streaks, delete ratios, and route or method novelty. It records
   methods and normalized routes, not request bodies.
3. The native Isolation Forest scores those features against its baseline.
4. In block mode, the adapter rejects requests whose score reaches the
   configured threshold.

This makes Pahak sensitive to patterns and context, rather than elapsed time
or a single fixed request count. The C library itself handles model training
and scoring; feature extraction and enforcement belong to the adapter.

## Build and test

```sh
cmake -S . -B build
cmake --build build
ctest --test-dir build --output-on-failure
```

For a shared library suitable for FFI bindings, configure with
`-DBUILD_SHARED_LIBS=ON`.

## Try the Express example

See [examples/express/README.md](./examples/express/README.md) for setup and
instructions for running the Express API. The example defaults to block mode;
set `PAHAK_MODE=monitor` to observe scores without rejecting requests. The
[React playground](./examples/react/README.md) lets you compare protected and
unprotected CRUD requests.

## Scope and limitations

The Express baseline is synthetic and for demos only. For production, use
trusted traffic, a reliable identity source, and a calibrated threshold to
limit false positives. Pahak scores supplied features; it does not parse HTTP,
inspect request bodies, persist models, or automatically retrain.

For C integrations, include `pahak.h`, train with `pahak_model_train()`, score
feature vectors with `pahak_model_score()`, then apply a policy appropriate to
your application.
