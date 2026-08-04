# Three.js Reference Adapter

Package: `@ecc/s100-viewer-adapter-three`

```ts
import { createThreeAdapter } from "@ecc/s100-viewer-adapter-three";

const adapter = createThreeAdapter();
```

The adapter is an ECC-owned reference implementation built on plain Three.js and
the public `S100EngineAdapter` contract. It is useful for understanding how a
browser renderer can implement the viewer, scene, layer, camera, picking, and
environment surfaces without the larger NASA-AMMOS runtime.

The adapter currently targets `projected-local` scenes. Its engine frame matches
the NASA-AMMOS projected-local convention: `x` and `y` are projected horizontal
metres, and `z` is vertical metres.

Current implemented layer support covers:

- S-101/S-57 and map-overlay raster planes
- S-102 3D Tiles through `3d-tiles-renderer`
- S-111 static/rest JSON arrow rendering
- vessel model and parametric-vessel rendering
- vessel ocean surface visualization
- vessel transform gizmo support for translate and rotate modes
- route-plan centerline, XTD boundary, corridor, waypoint, and hybrid-volume
  rendering
- simulated-water-level time updates
- S-104 sampled water-level fields
- per-position S-102 terrain water-level shading

Known limitations:

- The adapter is not currently part of the release-target package list.
- Depth-ray visualization and fleet terrain shadows are not yet at NASA-AMMOS
  feature parity.
- Production apps should keep adapter imports isolated behind an engine
  registry, as shown in the engine switcher example.

Use the engine switcher to compare adapter behavior:

```sh
npm run demo:engine-switcher
```

Then open the Vite URL printed by the command and choose the `Three.js
Reference` engine.
