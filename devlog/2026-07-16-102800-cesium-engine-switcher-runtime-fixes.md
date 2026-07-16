# 2026-07-16 Cesium Engine Switcher Runtime Fixes

## Context
- Reproduced the engine-switcher Cesium crash when applying the shared Kloofendal equirectangular environment and the projected-local S-101 ENC transparency issue.
- The crash path came from the example importing stale ignored `dist/` output, where `skyboxUrl` was still mapped to six Cesium cubemap faces.
- The transparency path rebuilt projected WMS primitives for every opacity change, which could leave the ENC primitive hidden after the replacement image/material lifecycle.

## Changes
- `examples/engine-adapter-switcher/vite.config.ts`
  - Added Vite aliases for local `@ecc/s100-viewer`, NASA-AMMOS adapter, and Cesium adapter source entrypoints so the demo runs current workspace source instead of stale ignored package `dist/`.
- `packages/s100-viewer-adapter-cesium/src/index.ts`
  - Disabled Cesium's default `skyBox` at viewer creation and clear active `scene.skyBox` instances when using equirectangular panorama backgrounds.
  - Updated projected WMS opacity/visibility patches in place instead of rebuilding image-backed primitives for display-only changes.
  - Marked projected WMS primitives with their material/image readiness state so async image loading cannot override later visibility changes.
- `packages/s100-viewer-adapter-cesium/test/package.test.ts`
  - Covered Cesium panorama mode clearing default skybox state.
  - Added projected WMS regression coverage for opacity changes down and back to full opacity without recreating or destroying the primitive.

## Validation
- `npm run check -w @ecc/s100-viewer-adapter-cesium`
- `npm run test -w @ecc/s100-viewer-adapter-cesium`
  - 1 test file passed, 24 tests passed.
- `npm run check:demo:engine-switcher`
- `npm run build:demo:engine-switcher`
- Browser smoke on `http://localhost:5174/`
  - Switched to Cesium with no `Width must equal height` render crash.
  - Moved `ENC transparency` to `50%` and back to `0%`; layer updates were logged and no Cesium render errors were reported.

## Notes
- The browser still reports the pre-existing `THREE.WARNING: Multiple instances of Three.js being imported.` warning during the demo smoke.
- `dist/` remains ignored; source aliases keep local demo runs aligned with current TypeScript source.
