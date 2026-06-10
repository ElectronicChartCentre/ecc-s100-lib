# @ecc/s100-viewer

Engine-neutral S-100 Interoperability Project viewer API.

This package owns viewer, scene, layer, product, event, time, picking,
coordinate, and adapter contracts. Rendering belongs in adapter packages.

## Install

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-nasa-ammos
```

Use it with at least one adapter package.

## Minimal Shape

```ts
import {
  createS100Viewer,
  LayerBuilder,
  SceneBuilder,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

const viewer = await createS100Viewer({
  container: document.getElementById("viewer"),
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

await scene.layers.add(LayerBuilder.createS102({
  url: "https://example.test/s102/tileset.json",
  crs: "EPSG:32619",
}));
```

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
- `S100EngineAdapter`: contract third-party engines implement to work with this
  API.

## Status

This package is the future public API. It is still `0.x` alpha and the exact
helper surface may change during package-readiness work.
