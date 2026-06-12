# NASA-AMMOS Adapter

Package: `@ecc/s100-viewer-adapter-nasa-ammos`

## Entry Point

```ts
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";
```

## Usage

```ts
const viewer = await createS100Viewer({
  container,
  adapter: createNasaAmmosAdapter(),
});
```

The adapter currently supports projected-local scenes, S-101, S-102, S-104,
S-111, vessel/model layers, map overlays, camera pose/look-at, time-dynamic
layers, picking, and native handles.

It reports supported product-specification versions through:

```ts
nasaAmmosAdapterCapabilities.supportedProductVersions;
```

At the current package-readiness stage, the reported S-101, S-102, S-104, and
S-111 versions are `latest-confirmed-supported`.

## Native Handles

`viewer.getEngineHandles()` returns the adapter-owned `S100NasaViewer` as
`engineInstance`, plus `instances.viewer`, optional `instances.canvas`,
`staticObjects.THREE`, and links for Three.js and NASA-AMMOS 3D Tiles renderer
docs.

`scene.getEngineHandles()` returns the compatibility `ViewerScene` as
`engineInstance`, with `instances.viewerScene`, `cameraNavigation`, `picking`,
`pickingRay`, `hoverPrism`, and render-context entries (`renderer`, `scene`,
`camera`, `canvas`) when available.

All native handles are borrowed references and become invalid after the owning
scene or viewer is destroyed.

## Current Limitations

- Globe/ECEF mode is planned for the final major phase.
- Adapter internals still reuse a local NASA-AMMOS compatibility surface.
- Three.js is a peer dependency.
