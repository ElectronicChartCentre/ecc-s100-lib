# S-100 Viewer Workspace

This workspace contains the current S-100 Interoperability Project package
baseline for an engine-neutral S-100 viewer API.

Release-target packages for the current phase:

- `@ecc/s100-viewer`: viewer, scene, layer, product, time, picking,
  coordinate, and adapter contracts. This includes ENC builders for S-101 and
  S-57, S-102, S-111, simulated water-level, vessel, and map-overlay layer
  builders.
- `@ecc/s100-viewer-adapter-nasa-ammos`: NASA-AMMOS/Three.js adapter.
- `@ecc/s100-viewer-adapter-cesium`: Cesium adapter and initial globe-native
  integration target.

Experimental workspace packages:

- `@ecc/s100-viewer-adapter-three`: plain Three.js reference adapter used by the
  engine-switcher demo and maintainability work. It is intentionally not listed
  in `tools/release-targets.mjs` yet.

S-100 Explorer owns any application-specific migration bridge in the webapp.
The public package contract is the main `@ecc/s100-viewer` entry point plus
adapter packages.

The CogsEngine adapter remains in this workspace for now, but maintainability
package planning treats it as a separate local interoperability repo. It is not
part of the future default release package set.

## Quick Start Shape

Application code should normally use the core package and one renderer adapter:

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-nasa-ammos
```

Cesium applications use the Cesium adapter package plus the Cesium runtime:

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-cesium cesium
```

Reference-adapter experiments can use the plain Three.js package:

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-three three
```

```ts
import {
  createS100Viewer,
  LayerBuilder,
  SceneBuilder,
  type S102LayerSpec,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

const container = document.getElementById("viewer");
if (container === null) {
  throw new Error("Missing #viewer container.");
}

const viewer = await createS100Viewer({
  container,
  adapter: createNasaAmmosAdapter(),
});

const scene = await viewer.createScene({
  georeference: SceneBuilder.projectedLocal({
    crs: "EPSG:32619",
    origin: { x: 331100, y: 5186420, z: 0 },
  }),
});

const s102: S102LayerSpec = LayerBuilder.createS102({
  url: "https://example.test/s102/tileset.json",
  crs: "EPSG:32619",
});

await scene.layers.add(s102);
```

For product-specific application code, prefer feature entrypoints. The root
package remains convenient for viewer and scene basics, while product subpaths
keep imports narrower and easier for bundlers to analyze:

```ts
import { createS100Viewer, SceneBuilder } from "@ecc/s100-viewer";
import { S111SurfaceCurrentSession } from "@ecc/s100-viewer/products/s111";
import { RouteFeatureSession } from "@ecc/s100-viewer/products/route";
```

`LayerBuilder` fills obvious S-100 boilerplate such as layer ids, product types,
source kinds, roles, default styles, and the product-specification version
policy. By default, product layers use `latest-confirmed-supported`; pass
`productSpecificationVersion` only when a service exposes a concrete IHO product
specification identifier or edition that the app wants to track explicitly.

For applications that want a more batteries-included surface, the core package
also exports product sessions such as `S102TerrainSession`,
`S111SurfaceCurrentSession`, `EncWmsSession`, and `VesselFeatureSession`.
These sessions translate app-friendly inputs into canonical layer specs,
including templated WMS map sources and provider defaults through
`PrimarServices`. PRIMAR helpers also provide reusable service adapters such as
ENC availability resolution, so apps can inject their request functions without
duplicating provider response parsing. Sessions still use the same
`scene.layers` kernel underneath.

The core package exports `S100SupportedProductVersions`, and each adapter reports
its engine-specific matrix through `adapter.capabilities.supportedProductVersions`.
Third-party engines integrate by implementing `S100EngineAdapter`; applications
should not need NASA-AMMOS-specific code to use a different adapter.

## Common Commands

```sh
npm run check
npm run test
npm run build
```

Release-target-only checks, excluding the Cogs adapter:

```sh
npm run check:release-target
npm run test:release-target
npm run build:release-target
npm run pack:release-target:dry-run
```

## Documentation

- [Start here](./docs/start-here.md)
- [S-100 primer for library users](./docs/concepts/s100-primer.md)
- [Getting started app and story](./examples/getting-started)
- [Reference app](./examples/reference-app)
- [Step-by-step engine switcher learning guide](./docs/learn/engine-switcher-practical-guide.md)
- [API entrypoints](./docs/api/entrypoints.md)
- Workflow guides:
  [Live AIS vessel feed](./docs/workflows/live-vessel-feed.md),
  [parametric vessel](./docs/workflows/parametric-vessel.md),
  [RTZ route](./docs/workflows/rtz-route.md)
- [Package readiness](./docs/package-readiness.md)
- [Developer ergonomics review](./docs/developer-ergonomics-review.md)
- [Maintainability refactor](./docs/architecture/maintainability-refactor.md)
- [S-104 water level architecture](./docs/architecture/s104-water-level.md)
- [Cogs adapter extraction plan](./docs/cogs-adapter-extraction-plan.md)
- [API docs](./docs/api/README.md)
- [Examples](./examples/README.md)
