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
- `events`
- `getEngineHandles()`
- `setSeaLevel(value)`
- `getSeaLevel()`
- `showHoverPrism(...)`
- `clearHoverPrism()`
- `destroy()`

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
    layerProducts: ["S-101", "S-102", "S-111"],
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

Applications should only depend on the adapter contract. Engine-specific objects
belong behind `EngineLayerHandle.native` or another documented escape hatch.

When implementing native handle bundles, use predictable key names:

- `engineInstance`: the primary engine viewer or scene object.
- `instances`: adapter-created runtime objects such as `viewer`, `scene`,
  `camera`, `renderer`, `canvas`, or `pickingHandler`.
- `staticObjects`: imported engine namespaces, constructors, enums, or constants
  such as `THREE`, `Cesium`, `Color`, or `Cartesian3`.
- `resources`: stable links to upstream engine documentation or adapter notes.
