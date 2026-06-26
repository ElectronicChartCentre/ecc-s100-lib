# Cesium Adapter

Package: `@ecc/s100-viewer-adapter-cesium`

```ts
import { createCesiumAdapter } from "@ecc/s100-viewer-adapter-cesium";

const adapter = createCesiumAdapter({
  cesiumModule: () => import("cesium"),
});
```

The adapter reports both `projected-local` and `ellipsoid-ecef` scene support.
Current implemented layer support covers S-102 3D Tiles, ENC WMS/WMTS imagery
for S-101 and S-57, map overlays, simulated water-level JSON sea-level binding,
S-111 JSON arrow entities, and vessel model entities.

For Vite applications, import Cesium widget CSS and configure Cesium static
assets through the app bundler. The S-100 Explorer currently uses
`vite-plugin-cesium` for this.

Known limitation: projected-local S-102 tile rendering depends on the tile
service returning Cesium-compatible 3D Tiles. Full curved-earth ocean masking
and replacement workflows remain part of the later globe/ECEF phase.
