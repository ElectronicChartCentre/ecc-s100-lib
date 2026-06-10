# @ecc/s100-viewer-compat

Deprecated temporary compatibility package for legacy `s100-viewer` shaped APIs.

The facade should shrink as S-100 Explorer moves to the engine-neutral
`@ecc/s100-viewer` API.

New integrations should use `@ecc/s100-viewer` and an adapter package directly.

## Current Surface

The package provides a deprecated bridge for early migration work:

- `Viewer.create(parent, config)`
- `viewer.createScene()`
- `scene.Terrain.add(...)`
- `scene.Map.add(...)`
- `scene.S111.add(...)`
- `scene.VesselFeature.add(...)`
- `scene.CustomModels.add(...)`
- `scene.cameraNavigation`
- `scene.PickingRay`
- `scene.Picking`

The facade maps legacy calls into `@ecc/s100-viewer` layer specs and uses an
adapter supplied through `config.adapter`. If no adapter is supplied it creates
the NASA-AMMOS adapter.

This package is not the future public API. New application code should prefer
`@ecc/s100-viewer` and product layer specs directly.

## Removal Criteria

This package can be removed after S-100 Explorer handlers no longer import
legacy-shaped types such as `ViewerScene`, `TerrainView`, `MapSpecification`,
`VesselView`, `CameraPose`, and `PickedInfo`.
