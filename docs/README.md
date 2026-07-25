# S-100 Interoperability Package Docs

This folder contains package-readiness, architecture, API, and maintainability
docs for the current `ecc-s100-lib` package shape.

- [Start here](./start-here.md)
- [S-100 primer for library users](./concepts/s100-primer.md)
- [Learning guides](./learn/README.md)
- [Step-by-step engine switcher learning guide](./learn/engine-switcher-practical-guide.md)
- [Package readiness](./package-readiness.md)
- [Developer ergonomics review](./developer-ergonomics-review.md)
- API docs:
  [entrypoints](./api/entrypoints.md),
  [core](./api/core.md),
  [products](./api/products.md),
  [canonical app integration](./api/canonical-app-integration.md),
  [NASA-AMMOS adapter](./api/nasa-ammos-adapter.md),
  [Cesium adapter](./api/cesium-adapter.md),
  [Three.js reference adapter](./api/three-adapter.md)
- Workflow guides:
  [Live AIS vessel feed](./workflows/live-vessel-feed.md),
  [parametric vessel](./workflows/parametric-vessel.md),
  [RTZ route](./workflows/rtz-route.md)
- Architecture notes:
  [package boundaries](./architecture/package-boundaries.md),
  [scene and layer lifecycle](./architecture/scene-layer-lifecycle.md),
  [coordinates and depth](./architecture/coordinates-and-depth.md),
  [S-104 water level](./architecture/s104-water-level.md),
  [maintainability refactor](./architecture/maintainability-refactor.md),
  [adapter authoring](./architecture/adapter-authoring-guide.md)
- [Cogs adapter extraction plan](./cogs-adapter-extraction-plan.md)
- [Examples](../examples/README.md), including the runnable getting-started app
  and reference app
