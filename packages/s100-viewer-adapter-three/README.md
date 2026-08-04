# @ecc/s100-viewer-adapter-three

Reference Three.js adapter for `@ecc/s100-viewer`.

This package is intended as an ECC-owned reference implementation built on
plain Three.js and the public S-100 viewer adapter contract. It is not intended
to replace the NASA-AMMOS adapter as the primary projected-local renderer.
Instead, it gives maintainers a compact adapter that demonstrates how a
browser-oriented Three.js engine can implement the canonical viewer, scene,
layer, camera, picking, and environment surfaces.

Projected-local scenes use the same z-up engine frame as the NASA-AMMOS
adapter: `x` and `y` are horizontal projected metres and `z` is vertical metres.

## Status

This adapter is an active reference implementation for projected-local scenes.
It is intentionally smaller than NASA-AMMOS, but it now implements the main
canonical product surfaces used by the demos:

- S-101/S-57 and map-overlay raster planes
- S-102 3D Tiles through `3d-tiles-renderer`, including shared terrain styling
  and S-104 water-level terrain shading
- S-111 static/rest JSON arrow rendering
- vessel model or procedural fallback rendering with vessel-local ocean surface
  and native transform controls
- route-plan centerline, XTD boundary, corridor, waypoint, and hybrid-volume
  rendering
- simulated-water-level and S-104 time updates
- skybox/environment setup, picking, and camera controls

The package is part of the workspace for reference-adapter development and the
engine-switcher demo, but it is not currently included in the release-target
package list. Remaining parity gaps are tracked as normal adapter work, with
fleet terrain-shadow shading and some NASA-AMMOS-specific debug/depth-ray
visualization still treated as advanced follow-up rather than required API
surface.

## Usage

```ts
import { createS100Viewer } from "@ecc/s100-viewer";
import { createThreeAdapter } from "@ecc/s100-viewer-adapter-three";

const viewer = await createS100Viewer({
  container: document.getElementById("viewer"),
  adapter: createThreeAdapter(),
});
```

The package root stays intentionally small. The viewer host, scene runtime, and
heavy layer helpers are loaded lazily after the app creates a viewer, creates a
scene, and adds matching layer products.
