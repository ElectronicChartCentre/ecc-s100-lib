# @ecc/s100-viewer

Engine-neutral S-100 Interoperability Project viewer API.

This package owns viewer, scene, layer, product, event, time, picking,
coordinate, and adapter contracts. Rendering belongs in adapter packages.

## Install

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-nasa-ammos
```

Use it with at least one adapter package.

## Recommended App Shape

Most application screens should use the root package for viewer and scene setup,
then use product-focused public entrypoints for feature sessions:

```ts
import {
  createS100Viewer,
  SceneBuilder,
} from "@ecc/s100-viewer";
import { S102TerrainSession } from "@ecc/s100-viewer/products/s102";
import {
  S111SurfaceCurrentSession,
  createPrimarS111Service,
} from "@ecc/s100-viewer/products/s111";
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
    origin: {
      x: 331100,
      y: 5186420,
      z: 0,
    },
  }),
});

const terrain = S102TerrainSession.create({
  scene,
  crs: "EPSG:32619",
  source: {
    urlForDatasetIds(datasetIds, context) {
      const ids = datasetIds.join(",");
      return `https://example.test/s102/${ids}/tileset.json?crs=${context.crs}`;
    },
  },
});

await terrain.setDatasetIds(["NO_SAMPLE_S102"]);

const licenseeKey = "replace-with-app-service-licensee-key";
const currents = await S111SurfaceCurrentSession.load({
  scene,
  datasets: [{
    id: "NO_SAMPLE_S111",
    bounds: {
      projected: {
        west: 330000,
        south: 5185000,
        east: 332000,
        north: 5188000,
      },
    },
  }],
  crs: "EPSG:32619",
  service: createPrimarS111Service({
    endpoint: "https://example.test/s111",
    licenseeKey,
  }),
});
```

Feature sessions own common application mechanics such as layer replacement,
cleanup, status, provider defaults, time setup, visibility, and interaction
constraints. They still use the canonical `scene.layers` kernel underneath.
Production applications commonly route service calls through a backend proxy so
provider credentials do not have to live in browser-delivered code.

## Lower-Level Layer Shape

Use `LayerBuilder` directly when a feature session does not fit your workflow,
when writing a new feature session, or when you need exact layer-spec control:

```ts
import { LayerBuilder } from "@ecc/s100-viewer";

const terrain = await scene.layers.add(LayerBuilder.createS102({
  id: "bathymetry",
  url: "https://example.test/s102/tileset.json",
}));

await terrain.controllers.terrain.setSafetyDepthMeters(8);
await terrain.controllers.terrain.setTileBoundsVisible(true);

const currents = await scene.layers.add(LayerBuilder.createStaticS111({
  id: "currents",
  data: surfaceCurrentData,
}));

await currents.controllers.surfaceCurrent.setCustomScale(2.5);
currents.controllers.surfaceCurrent.setCurrentTime(Date.now());
```

Canonical layers expose product-specific controller handles through
`layer.controllers`, so applications can use the same clean layer API for both
setup and later interaction.

## Public Product Entrypoints

Use public subpaths for product-specific application code:

```ts
import { EncWmsSession } from "@ecc/s100-viewer/products/enc";
import { RouteFeatureSession } from "@ecc/s100-viewer/products/route";
import { S102TerrainSession } from "@ecc/s100-viewer/products/s102";
import { S111SurfaceCurrentSession } from "@ecc/s100-viewer/products/s111";
import { VesselFeatureSession } from "@ecc/s100-viewer/products/vessel";
```

The broad `@ecc/s100-viewer/products` entrypoint is useful for modules that
intentionally compose multiple product families. Application code should not
import `@ecc/s100-viewer/internal/*`.

Viewer-level camera controls are optional. When omitted, the viewer applies
`CameraControlPresets.S100_DEFAULT` to every scene so applications do not need
per-scene or per-engine camera-control boilerplate. Scene cameras still own the
current pose/look-at state.

```ts
import { CameraControlPresets } from "@ecc/s100-viewer";

viewer.setCameraControls({
  ...CameraControlPresets.S100_DEFAULT,
  pointer: [
    { kind: "drag", action: "orbit", button: "left" },
    { kind: "drag", action: "pan", button: "middle" },
    { kind: "drag", action: "zoom", button: "right" },
  ],
});
```

Product builders default `productSpecificationVersion` to
`latest-confirmed-supported`. Exact product specification identifiers or
editions can be supplied explicitly when future adapters need
edition-specific rendering behavior.

The library-level product/version matrix is exported as
`S100SupportedProductVersions`. Adapters publish their own renderable subset on
`adapter.capabilities.supportedProductVersions`.

## Core Concepts

- `S100Viewer`: owns one adapter-backed viewer host.
- `S100Scene`: owns layers, camera, time, picking, environment, and events.
- `LayerCollection`: adds and removes product layer specs.
- `S100EngineAdapter`: renderer-specific implementation boundary.
- `SceneGeoreference`: projected-local now, ellipsoid/ECEF later.
- `SceneBuilder`: convenience helpers for common scene setup.
- `LayerBuilder`: convenience helpers for common S-100 product layers.
- Product sessions: higher-level app-facing workflows for product families.

## Native Engine Handles

`viewer.getEngineHandles()` and `scene.getEngineHandles()` return borrowed
adapter-native references for advanced integrations. The stable top-level shape
is `EngineHandleBundle`:

```ts
type EngineHandleBundle = {
  adapterId: string;
  engineName?: string;
  engineVersion?: string;
  engineInstance?: unknown;
  instances?: Record<string, unknown>;
  staticObjects?: Record<string, unknown>;
  resources?: Record<string, unknown>;
};
```

Native handles are optional, adapter-specific, and invalid after
`scene.destroy()` or `viewer.destroy()`. Portable S-100 product workflows should
continue to use the scene, layer, camera, time, picking, and environment APIs.
Use `layer.getNativeHandle()` for layer-specific native objects.

## Status

This package is the future public API. It is still `0.x` alpha and the exact
helper surface may change during package-readiness work.
