# Core API

Package: `@ecc/s100-viewer`

## Entry Point

```ts
import { createS100Viewer, LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
```

`createS100Viewer(...)` accepts an engine adapter and optional container,
logger, and metadata. It returns an `S100Viewer`.

Product layer specs and `LayerBuilder` are also exported from this same package
because S-100 products are fundamental to normal viewer usage.

## Viewer

An `S100Viewer` exposes:

- `adapterId`
- `adapterDisplayName`
- `capabilities`
- `getEngineHandles()`
- `createScene(options?)`
- `destroy()`

## Scene

An `S100Scene` exposes:

- `layers`
- `camera`
- `time`
- `picking`
- `environment`
- `waterLevel`
- `events`
- `getEngineHandles()`
- `setSeaLevel(value)`
- `getSeaLevel()`
- `showHoverPrism(...)`
- `clearHoverPrism()`
- `destroy()`

`setSeaLevel(value)` and `getSeaLevel()` remain the global static/simulated
fallback. Use `scene.waterLevel` for coordinate/time-aware water-level queries:

```ts
const sample = scene.waterLevel.sample({
  coordinate: {
    kind: "projected",
    crs: "EPSG:32631",
    x: 654390,
    y: 6542760,
  },
});

if (sample.status === "value") {
  console.log(sample.heightMeters, sample.source);
}
```

When an S-104 workflow is prepared, attach its sampler with
`scene.waterLevel.setSampler(result.sampler)`. Without an S-104 sampler the
controller returns the current global sea level with source `static` or
`simulated-water-level`.

Adapters that consume the field advertise that through capabilities:

- `waterLevelField: "sampled"` means the adapter can accept a representative
  water-level value derived from the scene sampler.
- `waterLevelTerrainShading: "global"` means S-102 terrain shading still uses a
  uniform sea-level value, not a per-position S-104 texture or shader lookup.

NASA-AMMOS, Three.js, and Cesium currently use the same first-pass behavior:
when an S-104 sampler is attached, the core scene samples near the active camera
and forwards that representative value to the adapter. Product/session helpers
that need a point-specific answer, such as vessel draught constraints, should
call `scene.waterLevel.sample({ coordinate })` directly.

## Layers

`scene.layers.add(spec)` accepts a product or operational layer spec and returns
an `S100Layer`. Layers can be updated, removed, hidden, or inspected for their
adapter-native handle.

The core library publishes product/version support through
`S100SupportedProductVersions`. Each adapter publishes the product versions it
can render through `viewer.capabilities.supportedProductVersions`.

## Native Engine Handles

`viewer.getEngineHandles()` and `scene.getEngineHandles()` return
`EngineHandleBundle` objects for integrations that need engine-native escape
hatches:

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

The returned values are borrowed references. Applications must not destroy or
replace them and must treat them as invalid after `scene.destroy()` or
`viewer.destroy()`. Normal product workflows should not require native handles.
Layer-specific engine objects remain available through
`layer.getNativeHandle<T>()`.

## Picking

Use `scene.picking.pick({ screenX, screenY })` for one-shot picking and
`scene.picking.setLiveMode(...)` for live picking. Results are normalized into
screen, world, depth, source, and optional native metadata.

## Georeference

The current release-target mode is `projected-local`. `ellipsoid-ecef` remains
planned for the final major phase.

For common projected/local scenes, prefer the builder helper:

```ts
const georeference = SceneBuilder.projectedLocal({
  crs: "EPSG:32619",
  origin: { x: 331100, y: 5186420, z: 0 },
});
```

## Adapter Authoring

Third-party engines integrate by implementing `S100EngineAdapter`:

```ts
import {
  S100SupportedProductVersions,
  type S100EngineAdapter,
} from "@ecc/s100-viewer";

export const createMyEngineAdapter = (): S100EngineAdapter => ({
  id: "my-engine",
  displayName: "My Engine",
  capabilities: {
    sceneGeoreferences: ["projected-local"],
    layerProducts: ["S-101", "S-57", "S-102", "S-111"],
    supportedProductVersions: S100SupportedProductVersions.filter((support) =>
      ["S-101", "S-102", "S-111"].includes(support.product),
    ),
    dataSources: ["3d-tiles", "wms", "rest-json"],
    cameraControls: ["pose", "look-at"],
    picking: true,
    timeDynamicLayers: true,
    nativeHandles: true,
  },
  async createViewerHost(options) {
    return myEngineViewerHost(options);
  },
});
```

`S-57` can appear in `layerProducts` because adapters may render legacy ENC
layers, but it is not part of `S100SupportedProductVersions` because it is not an
IHO S-100 product specification.

Applications should only depend on the adapter contract. Engine-specific objects
belong behind `EngineLayerHandle.native` or another documented escape hatch.

When implementing native handle bundles, use predictable key names:

- `engineInstance`: the primary engine viewer or scene object.
- `instances`: adapter-created runtime objects such as `viewer`, `scene`,
  `camera`, `renderer`, `canvas`, or `pickingHandler`.
- `staticObjects`: imported engine namespaces, constructors, enums, or constants
  such as `THREE`, `Cesium`, `Color`, or `Cartesian3`.
- `resources`: stable links to upstream engine documentation or adapter notes.
