# Start Here

Use this page to choose the right first document for your role. `ecc-s100-lib`
has three useful learning paths: application integration, adapter authoring, and
maintainability work.

## If You Are Building An App

Start with the feature-session path. Feature sessions are the preferred
high-level API for application screens because they own common orchestration
such as layer replacement, cleanup, status, time, provider defaults, and
interaction constraints while still exposing canonical scene/layer handles.

1. Run the smallest app: [`examples/getting-started`](../examples/getting-started).
2. Learn the standards vocabulary:
   [`docs/concepts/s100-primer.md`](./concepts/s100-primer.md).
3. Read the full app pattern: [`examples/reference-app`](../examples/reference-app).
4. Read product APIs by entrypoint: [`docs/api/entrypoints.md`](./api/entrypoints.md).
5. Use focused workflow docs when a screen needs a specific product family:
   [`live-vessel-feed`](./workflows/live-vessel-feed.md),
   [`parametric-vessel`](./workflows/parametric-vessel.md), and
   [`rtz-route`](./workflows/rtz-route.md).
6. Read [`S-104 water level`](./architecture/s104-water-level.md) when a screen
   needs coordinate/time-aware water-level sampling or S-102 safety-depth
   shading driven by S-104 data.

Use the lower-level `LayerBuilder` and `scene.layers` APIs when a feature
session does not fit the app workflow or when you are implementing a new session.

## If You Are Comparing Engines

Use the engine switcher path when the question is about adapter capability,
renderer differences, or portable API boundaries.

1. Read the practical guide:
   [`docs/learn/engine-switcher-practical-guide.md`](./learn/engine-switcher-practical-guide.md).
2. Run the switcher:

```sh
cp examples/engine-adapter-switcher/.env.example examples/engine-adapter-switcher/.env.local
npm run demo:engine-switcher
```

The switcher currently exercises NASA-AMMOS, Cesium, and the plain Three.js
reference adapter.

## If You Are Writing An Adapter

Start with the adapter contract and the reference adapter.

1. Read [`docs/architecture/adapter-authoring-guide.md`](./architecture/adapter-authoring-guide.md).
2. Read [`packages/s100-viewer-adapter-three/README.md`](../packages/s100-viewer-adapter-three).
3. Read the `S100EngineAdapter`, `EngineViewerHost`, and `EngineScene` contracts
   from [`docs/api/core.md`](./api/core.md).
4. Add the adapter to the engine switcher and start with the Minimal Scene.

## If You Are Maintaining The Library

Start with the maintainability and boundary docs.

1. Read [`docs/architecture/maintainability-refactor.md`](./architecture/maintainability-refactor.md).
2. Read [`docs/architecture/package-boundaries.md`](./architecture/package-boundaries.md).
3. Run the checks:

```sh
npm run maintainability:check
npm run check:release-target
npm run test:release-target
npm run build:release-target
```

## Decision Table

| Goal | First document | First command |
| --- | --- | --- |
| Build the smallest app | [`examples/getting-started`](../examples/getting-started) | `npm run demo:getting-started` |
| Learn S-100 vocabulary | [`S-100 primer`](./concepts/s100-primer.md) | `npm run demo:engine-switcher` |
| Build a production-shaped app | [`examples/reference-app`](../examples/reference-app) | `npm run demo:reference` |
| Compare engines | [`engine-switcher-practical-guide`](./learn/engine-switcher-practical-guide.md) | `npm run demo:engine-switcher` |
| Render RTZ routes | [`rtz-route workflow`](./workflows/rtz-route.md) | `npm run demo:rtz-route` |
| Render live AIS vessels | [`live-vessel-feed workflow`](./workflows/live-vessel-feed.md) | `npm run demo:engine-switcher` |
| Inspect S-104 water level | [`S-104 water level`](./architecture/s104-water-level.md) | `npm run demo:engine-switcher` |
| Tune procedural vessel geometry | [`parametric-vessel workflow`](./workflows/parametric-vessel.md) | `npm run demo:parametric-vessel` |
| Write an engine adapter | [`adapter-authoring-guide`](./architecture/adapter-authoring-guide.md) | `npm run demo:engine-switcher` |
