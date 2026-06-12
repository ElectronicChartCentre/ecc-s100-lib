# @ecc/s100-viewer-adapter-cesium

Cesium adapter for `@ecc/s100-viewer`.

This package is the first Cesium integration target for the S-100
Interoperability Project. It is intended to prove that the core S-100 viewer API
can run against a globe-native engine without coupling application code to
NASA-AMMOS or CogsEngine.

## Install

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-cesium cesium
```

## Usage

```ts
import { createS100Viewer, LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
import { createCesiumAdapter } from "@ecc/s100-viewer-adapter-cesium";

const viewer = await createS100Viewer({
  container: document.getElementById("viewer"),
  adapter: createCesiumAdapter({
    cesiumModule: () => import("cesium"),
  }),
});

const scene = await viewer.createScene({
  georeference: SceneBuilder.projectedLocal({
    crs: "EPSG:32619",
    origin: { x: 331100, y: 5186420 },
  }),
});

await scene.layers.add(
  LayerBuilder.createS102({
    url: "https://example.test/s102/tileset.json",
    crs: "EPSG:4978",
    sourceFrame: "ecef",
  }),
);
```

Applications using Vite should import Cesium widget CSS and make Cesium static
assets available according to their bundler setup.

## Current Scope

Supported in this initial adapter:

- S-102 3D Tiles via Cesium `Cesium3DTileset`.
- S-101/map-overlay WMS/WMTS imagery, including a single-tile projected WMS
  fallback for legacy UTM overlays.
- S-104 water-level JSON sources bound to scene sea level.
- S-111 arrow entities for PRIMAR-style `positions` plus time-record
  `speed`/`direction` JSON.
- Vessel/model layers via Cesium entities.
- Camera, picking, live-picking callbacks, and hover-prism entities.

## Native Handles

`viewer.getEngineHandles()` exposes:

- `engineInstance`: the Cesium `Viewer`.
- `instances.viewer`, `scene`, `camera`, and `canvas`.
- `staticObjects.Cesium`, `Color`, `Cartesian2`, `Cartesian3`, and `Matrix4`.
- `resources.cesiumDocs`.

`scene.getEngineHandles()` exposes the same Cesium viewer-level objects plus
`instances.clock` and `instances.sceneOptions`.

These handles are borrowed and invalid after `scene.destroy()` or
`viewer.destroy()`.

Known limitations:

- Full projected-local 3D Tiles transformation is still dependent on the tile
  service returning Cesium-compatible ECEF/geodetic tiles.
- Ocean masking and curved-earth S-102/S-101 replacement workflows belong to
  the later globe/ECEF phase.
