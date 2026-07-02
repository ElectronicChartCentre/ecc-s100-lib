# Canonical App Integration

Package: `@ecc/s100-viewer`

This package exposes the canonical app-facing API for S-100 viewer
integrations. Applications should treat the package root as the product-first
surface and keep engine-specific adapter packages behind a small app-owned
engine selection boundary.

## Import Model

Normal app code should import viewer, scene, layer, product, and controller
types from `@ecc/s100-viewer`:

```ts
import {
  LayerBuilder,
  ProjectedMap,
  SceneBuilder,
  createS100Viewer,
  type S100Scene,
  type S100Viewer,
} from "@ecc/s100-viewer";
```

Adapter packages should be imported only where the app creates an engine
adapter:

```ts
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";
import { createCesiumAdapter } from "@ecc/s100-viewer-adapter-cesium";
```

Feature handlers should receive an `S100Scene` or canonical layer/controller
handle. They should not import adapter packages, adapter runtime internals, or
native engine objects unless they are explicitly implementing an engine
selection boundary.

## Scene Setup

Use `createS100Viewer` and `SceneBuilder` for viewer and scene construction:

```ts
const viewer = await createS100Viewer({
  container,
  adapter: createNasaAmmosAdapter(adapterOptions),
});

const scene = await viewer.createScene({
  georeference: SceneBuilder.projectedLocal({
    crs: "EPSG:32619",
    origin: { x: 331100, y: 5186420, z: 0 },
  }),
});
```

The app should hold the returned `S100Viewer` and `S100Scene` objects directly.
There is no separate facade scene type in the canonical API.

## Product Helpers

Prefer `LayerBuilder` and related product helpers over app-local layer spec
templates. The helpers encode the product category, standard, source shape,
default styles, and product-version policy in the package.

```ts
const encPair = LayerBuilder.createEncWmsPair({
  idPrefix: "selected-enc",
  standard: "S-57",
  url,
  layers: ["ENC"],
  geometry: ProjectedMap.fromCenterExtent({
    center: { x: 331100, y: 5186420 },
    width: 2000,
    height: 2000,
  }),
});

const [transparentEnc, opaqueEnc] = await scene.layers.addMany([
  encPair.transparent,
  encPair.opaque,
]);
```

For static current datasets, use `LayerBuilder.prepareStaticS111(...)` before
adding the layer when the app has raw static data and wants the package to
normalize the source shape and defaults:

```ts
const prepared = LayerBuilder.prepareStaticS111({
  id: "surface-currents",
  data,
});

const currents = await scene.layers.add(prepared.layer);
```

## Controllers

Layer-specific runtime controls are exposed through `layer.controllers`.
Applications should prefer these handles over native objects:

```ts
await terrain.controllers.terrain.setUnsafeDepth(-8);
await terrain.controllers.terrain.setTileBoundsVisible(true);

await vessel.controllers.vessel.setDimensions({
  bow: 90,
  stern: 15,
  port: 15,
  starboard: 15,
  draught: 8,
});

surfaceCurrents.controllers.surfaceCurrent.setCurrentTime(Date.now());
```

Controller snapshots are readonly. Mutations should go through controller
methods so adapters can preserve lifecycle ordering and async error reporting.

## Native Escape Hatches

`viewer.getEngineHandles()`, `scene.getEngineHandles()`, and
`layer.getNativeHandle()` are borrowed escape hatches for advanced integration.
They are not part of normal product workflows and become invalid after the
owning viewer, scene, or layer is destroyed.

If an application repeatedly needs a native handle to perform product behavior,
that is a signal to add a canonical scene, layer, or controller method.

## Boundary Rules

Consumer apps should enforce these rules in code review and automation:

- `@ecc/s100-viewer` is the only package root for viewer, scene, layer, product,
  and controller types.
- Adapter package imports are limited to engine creation modules.
- Feature handlers do not use adapter extension namespaces such as
  `nasaAmmos`, `cesium`, or `cogs`.
- New code does not introduce facade scene types, `coreScene` escape hatches, or
  adapter runtime imports.
- App-local helper code may adapt app state into package helper inputs, but it
  should not duplicate package-owned product spec templates.
