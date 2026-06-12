# @ecc/s100-viewer-adapter-nasa-ammos

Adapter package for connecting `@ecc/s100-viewer` to the NASA-AMMOS/Three.js
runtime.

## Install

```sh
npm install @ecc/s100-viewer @ecc/s100-viewer-adapter-nasa-ammos three
```

## Example

```ts
import { createS100Viewer } from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

const viewer = await createS100Viewer({
  container: document.getElementById("viewer"),
  adapter: createNasaAmmosAdapter({
    environmentMapURL:
      "/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr",
    showEnvironmentBackground: true,
    backgroundRotationX: Math.PI / 2,
    environmentRotationX: Math.PI / 2,
  }),
});
```

## Current Capability Scope

- Projected/local scenes.
- S-102 OGC 3D Tiles terrain.
- S-101 WMS/WMTS/MVT overlays where supported by the runtime.
- S-104 water level data.
- S-111 surface current arrows.
- Vessel/model layers and transform tools.
- Camera pose/look-at.
- Picking and live picking visuals.

The adapter reports renderable S-100 product specification versions through
`nasaAmmosAdapterCapabilities.supportedProductVersions`. At this stage these
use the shared `latest-confirmed-supported` policy from `@ecc/s100-viewer`.

## Native Handles

`viewer.getEngineHandles()` exposes:

- `engineInstance`: the adapter-owned `S100NasaViewer`.
- `instances.viewer`: the `S100NasaViewer`.
- `instances.canvas`: the viewer canvas when a DOM container is available.
- `staticObjects.THREE`: the Three.js module namespace.
- `resources.threeDocs` and `resources.tilesRendererDocs`.

`scene.getEngineHandles()` exposes:

- `engineInstance`: the compatibility `ViewerScene`.
- `instances.viewerScene`, `cameraNavigation`, `picking`, `pickingRay`, and
  `hoverPrism`.
- `instances.renderer`, `scene`, `camera`, and `canvas` when the render context
  is available.
- `staticObjects.THREE`.

These handles are borrowed and invalid after `scene.destroy()` or
`viewer.destroy()`.

## Current Limitations

- WGS84 ellipsoid/ECEF mode is planned for the final major phase.
- Adapter internals still reuse a local NASA-AMMOS compatibility surface.
- `three` is a peer dependency.
