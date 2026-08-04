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

The full developer workflow for version bumps, real `.tgz` creation, GitHub
Release upload, and consumer URL updates is documented in
[`docs/development/build-and-publish-tarballs.md`](./development/build-and-publish-tarballs.md).

## Consumer Dependency References

During the current public alpha integration, S-100 Explorer should consume
immutable GitHub release tarballs for the maintained package set:

```json
{
  "@ecc/s100-viewer": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.13/ecc-s100-viewer-0.1.0-alpha.13.tgz",
  "@ecc/s100-viewer-adapter-nasa-ammos": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.13/ecc-s100-viewer-adapter-nasa-ammos-0.1.0-alpha.13.tgz",
  "@ecc/s100-viewer-adapter-cesium": "https://github.com/ElectronicChartCentre/ecc-s100-lib/releases/download/ecc-s100-lib-v0.1.0-alpha.13/ecc-s100-viewer-adapter-cesium-0.1.0-alpha.13.tgz"
}
```

Those references are intentionally release-pinned so a fresh checkout resolves
the same API surface that the webapp was validated against. Local `file:`
dependencies can still be used as a development shortcut inside the
superproject, but they should not be committed as the normal Explorer
dependency mode while the app is validating release tarballs.

The source repo already exists at
`https://github.com/ElectronicChartCentre/ecc-s100-lib`, and each package
manifest should point at that repo with its own `repository.directory` value.
That is source metadata, though; it is not enough by itself to make the package
installable from a dependency entry. A plain dependency such as
`github:ElectronicChartCentre/ecc-s100-lib` makes npm install the repository
root, not an individual workspace package under `packages/*`.

The previous alpha.1 release used this same tarball pattern:

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
  "@ecc/s100-viewer": "0.1.0-alpha.13",
  "@ecc/s100-viewer-adapter-nasa-ammos": "0.1.0-alpha.13",
  "@ecc/s100-viewer-adapter-cesium": "0.1.0-alpha.13"
}
```

## Publication Prerequisites

- Confirm `@ecc` npm scope ownership.
- Confirm MIT license approval for public packages.
- Add generated API docs if a generator such as TypeDoc is adopted.
- Add CI jobs for clean install, typecheck, tests, build, and package dry run.
- Add changelog and release notes before any npm publication.

## Package Boundary

Normal application code should depend on the core package plus only the adapter
packages it actually instantiates:

```text
@ecc/s100-viewer
@ecc/s100-viewer-adapter-nasa-ammos
@ecc/s100-viewer-adapter-cesium
```

S-100 Explorer currently imports only the NASA-AMMOS adapter. The Cesium adapter
is still a maintained release-target package and is exercised by the library's
engine switcher demo. The Three.js reference adapter is useful for workspace
parity and adapter-authoring checks, but it is not part of the current
release-target list yet.

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
- `LayerBuilder.createS57Wms(...)` and `createS57Wmts(...)` build S-57 ENC
  layers with the shared ENC source shape.
- `LayerBuilder.createEncWmsPair(...)` builds paired transparent/opaque ENC WMS
  layers for projected-local scenes.
- `LayerBuilder.createSimulatedWaterLevel(...)` and
  `createStaticSimulatedWaterLevel(...)` build non-IHO simulated water-level
  layers.
- `@ecc/s100-viewer/products/s104` exposes `S104Workflow`,
  `createS104WaterLevelSampler(...)`, and fixture-service helpers for real
  S-104-shaped water-level data.
- `@ecc/s100-viewer/products/s111` exposes `S111Workflow` and S-111 service
  helpers.
- `@ecc/s100-viewer/products/vessel` exposes vessel sessions, parametric vessel
  helpers, live AIS feed helpers, and AIS position mappers.
- `@ecc/s100-viewer/products/route` exposes RTZ parsing, route layout, and route
  feature-session helpers.
- `LayerBuilder.createS111(...)` and `createStaticS111(...)` still build lower
  level current layers.
- `LayerBuilder.createVessel(...)` builds single vessel model or parametric
  vessel layers.
- `LayerBuilder.createMapOverlayWms(...)` builds generic map-overlay layers.
- `mapSpecificationToLayerSpec(...)` converts app-style projected WMS map
  specifications into canonical ENC/map-overlay specs using `wms-template`
  sources, so apps do not have to construct adapter-native map extensions.

S-101, S-102, and S-111 builders also set `productSpecificationVersion` to
`latest-confirmed-supported`. Exact product specification identifiers or
editions should be passed explicitly only when the service metadata exposes them
and the implementation has validated the edition. Simulated water-level layers
and S-57 ENC layers do not claim an IHO S-100 product specification version.

Real S-104 water-level support is intentionally separate from
`simulated-water-level`. The current S-104 implementation is documented in
[`docs/architecture/s104-water-level.md`](./architecture/s104-water-level.md);
simulated water-level layers must continue to be described as non-IHO helper
data.

The core package lists library-level support in `S100SupportedProductVersions`.
Each adapter must list renderable product versions on
`adapter.capabilities.supportedProductVersions`; third-party adapters should use
the same contract.
