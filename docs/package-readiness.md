# Package Readiness

## Current Release-Target Package Set

The current npm-readiness target is:

- `@ecc/s100-viewer`
- `@ecc/s100-viewer-adapter-nasa-ammos`
- `@ecc/s100-viewer-adapter-cesium`

The Cogs adapter is intentionally excluded from this set. It should move toward
a separate local interoperability repo with `@ecc/s100-viewer` as a peer
dependency. Public repo and public npm status are undecided.

S-100 Explorer owns any application-specific migration bridge in the webapp.
The release-target package surface is the main `@ecc/s100-viewer` entry point
plus adapter packages.

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

## Consumer Dependency References

During the current private alpha integration, S-100 Explorer should use local
`file:` dependencies that point at the parent repo's pinned `libs/ecc-s100-lib`
submodule:

```json
{
  "@ecc/s100-viewer": "file:../../../libs/ecc-s100-lib/packages/s100-viewer",
  "@ecc/s100-viewer-adapter-nasa-ammos": "file:../../../libs/ecc-s100-lib/packages/s100-viewer-adapter-nasa-ammos",
  "@ecc/s100-viewer-adapter-cesium": "file:../../../libs/ecc-s100-lib/packages/s100-viewer-adapter-cesium"
}
```

Those references are intentionally local for now. They are not the intended
long-term consumption shape once the packages are public.

The source repo already exists at
`https://github.com/ElectronicChartCentre/ecc-s100-lib`, and each package
manifest should point at that repo with its own `repository.directory` value.
That is source metadata, though; it is not enough by itself to make the package
installable from a dependency entry. A plain dependency such as
`github:ElectronicChartCentre/ecc-s100-lib` makes npm install the repository
root, not an individual workspace package under `packages/*`.

If the packages need to be consumed outside this parent checkout before public
npm publication, use package tarballs attached to immutable GitHub releases:

```json
{
  "@ecc/s100-viewer": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.1/ecc-s100-viewer-0.1.0-alpha.1.tgz",
  "@ecc/s100-viewer-adapter-nasa-ammos": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.1/ecc-s100-viewer-adapter-nasa-ammos-0.1.0-alpha.1.tgz",
  "@ecc/s100-viewer-adapter-cesium": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.1/ecc-s100-viewer-adapter-cesium-0.1.0-alpha.1.tgz"
}
```

After public npm publication, S-100 Explorer should consume registry versions:

```json
{
  "@ecc/s100-viewer": "0.1.0-alpha.1",
  "@ecc/s100-viewer-adapter-nasa-ammos": "0.1.0-alpha.1",
  "@ecc/s100-viewer-adapter-cesium": "0.1.0-alpha.1"
}
```

## Publication Prerequisites

- Confirm `@ecc` npm scope ownership.
- Confirm MIT license approval for public packages.
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
