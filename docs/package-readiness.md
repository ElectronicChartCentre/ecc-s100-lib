# Package Readiness

## Current Release-Target Package Set

The current npm-readiness target is:

- `@ecc/s100-viewer`
- `@ecc/s100-viewer-adapter-nasa-ammos`
- `@ecc/s100-viewer-adapter-cesium`
- `@ecc/s100-viewer-products`, deprecated migration facade for older product
  imports
- `@ecc/s100-viewer-compat`, deprecated and only kept while S-100 Explorer still
  depends on legacy-shaped handlers

The Cogs adapter is intentionally excluded from this set. It should move toward
a separate local interoperability repo with `@ecc/s100-viewer` as a peer
dependency. Public repo and public npm status are undecided.

## Readiness Checks

Run all local package checks:

```sh
npm run check
npm run test
npm run build
```

Run only the package-readiness target:

```sh
npm run check:release-target
npm run test:release-target
npm run build:release-target
npm run pack:release-target:dry-run
```

## Publication Prerequisites

- Confirm `@ecc` npm scope ownership.
- Confirm MIT license approval for public packages.
- Decide whether `@ecc/s100-viewer-compat` is published temporarily or kept
  internal to S-100 Explorer migration.
- Add generated API docs if a generator such as TypeDoc is adopted.
- Add CI jobs for clean install, typecheck, tests, build, and package dry run.
- Add changelog and release notes before any npm publication.

## Package Boundary

Normal application code should depend on:

```text
@ecc/s100-viewer
@ecc/s100-viewer-adapter-nasa-ammos
@ecc/s100-viewer-adapter-cesium
```

Temporary migration code may also depend on:

```text
@ecc/s100-viewer-products
@ecc/s100-viewer-compat
```

Application code should not depend on NASA-AMMOS internals, Cogs classes, Three.js
objects, or adapter-native handles unless it is explicitly using a documented
escape hatch.

## Ergonomic Helpers

Prefer builder helpers for common setup:

```ts
import { LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
```

- `SceneBuilder.projectedLocal(...)` builds projected/local georeferences.
- `LayerBuilder.createS102(...)` builds S-102 3D Tiles layers.
- `LayerBuilder.createS101Wms(...)` and `createS101Wmts(...)` build S-101
  overlay layers.
- `LayerBuilder.createS104(...)` and `createStaticS104(...)` build water-level
  layers.
- `LayerBuilder.createS111(...)` and `createStaticS111(...)` build current
  layers.
- `LayerBuilder.createVessel(...)` builds vessel model layers.
- `LayerBuilder.createMapOverlayWms(...)` builds generic map-overlay layers.

S-101, S-102, S-104, and S-111 builders also set
`productSpecificationVersion` to `latest-confirmed-supported`. Exact product
specification identifiers or editions should be passed explicitly only when the
service metadata exposes them and the implementation has validated the edition.

The core package lists library-level support in `S100SupportedProductVersions`.
Each adapter must list renderable product versions on
`adapter.capabilities.supportedProductVersions`; third-party adapters should use
the same contract.
