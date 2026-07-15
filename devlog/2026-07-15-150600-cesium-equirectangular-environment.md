# 2026-07-15 Cesium Equirectangular Environment

## Context
- Investigated `env-skybox-conversion` behavior where Cesium projected-local UTM scenes showed tilted skybox horizons and hard seams between generated cubemap faces.
- Kept the public environment API unchanged: `EnvironmentState.skyboxUrl` remains the engine-neutral equirectangular background input, while `skyboxFaces` remains explicit cubemap input.

## Changes
- `packages/s100-viewer-adapter-cesium/src/index.ts`
  - Replaced dynamic equirectangular-to-cubemap slicing for `skyboxUrl` with Cesium `EquirectangularPanorama`.
  - Kept explicit `skyboxFaces` and `skyboxUrlTemplate` on the `SkyBox` path.
  - Removed blob URL slicing lifecycle state and transparent placeholder cubemap fallback.
  - Added cleanup for the active environment panorama primitive.
- `packages/s100-viewer-adapter-cesium/test/package.test.ts`
  - Updated the equirectangular background test to assert `EquirectangularPanorama` creation and projected-local ENU transform use.
- `packages/s100-viewer-adapter-cesium/package.json`
  - Raised the Cesium peer dependency to `>=1.143.0`.
- `package-lock.json`
  - Reflected the Cesium peer dependency range.

## Validation
- `npm run check -w @ecc/s100-viewer-adapter-cesium`
- `npm run test -w @ecc/s100-viewer-adapter-cesium`
  - 1 test file passed, 24 tests passed.

## Notes
- Existing `package-lock.json` `three` metadata changes and untracked `scratch/` files were present in the worktree and were not part of this fix.
- If visual azimuth still differs from NASA-AMMOS after removing cubemap seams, the next API-level step should be a shared environment rotation field on `EnvironmentState` that both adapters honor.
