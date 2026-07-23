# Maintainability Refactor

Status: `ecc-lib-maintainability` branch, after phases 0 through 9.

This note explains the structural refactor performed on `ecc-s100-lib` to make
the library easier to maintain while preserving the current public package shape
used by S-100 Explorer and the example apps.

The refactor did not try to redesign the external API. The goal was to make the
inside of the library match the API direction already chosen: an engine-neutral
core package, renderer adapters, product sessions, typed controllers, and
examples that consume the same public package surfaces as applications.

The most recent completed work is Phase 9: bundle-aware public entrypoints and
lazy adapter loading. That phase does not change the app mental model. It makes
the package easier for maintainers and bundlers to reason about by separating
root viewer setup, product-focused imports, adapter factory imports, scene
runtime imports, and heavy layer-family imports.

## Why This Refactor Was Needed

The repository had grown quickly while the viewer API, NASA-AMMOS renderer,
Cesium renderer, S-111 workflow, parametric vessel model, and RTZ route support
were being developed together. That left several maintainability problems:

- Public adapter entry points were also implementation files.
- NASA-AMMOS runtime code lived under a `runtime/compat` path even after it had
  become maintained runtime code.
- Cesium adapter behavior was concentrated in one large source file.
- Engine-neutral product semantics were duplicated or implied inside adapters.
- Core package product features such as layer controllers, parametric vessel,
  RTZ parsing, route layout, and route sessions had become broad files.
- Examples had useful shared behavior, but some example-to-example imports made
  it less clear which code was package API and which code was demo scaffolding.

The current branch establishes clearer boundaries before the next round of
feature work.

## Current Package Model

The maintained package set is still:

- `@ecc/s100-viewer`
- `@ecc/s100-viewer-adapter-nasa-ammos`
- `@ecc/s100-viewer-adapter-cesium`

Applications and examples import the core package plus one or more adapters.
Adapters import the core package contracts, but the core package does not import
adapters.

```mermaid
flowchart LR
  App["S-100 Explorer app"] --> Core["@ecc/s100-viewer"]
  App --> Nasa["@ecc/s100-viewer-adapter-nasa-ammos"]
  App --> Cesium["@ecc/s100-viewer-adapter-cesium"]

  Examples["Examples and demos"] --> Core
  Examples --> Nasa
  Examples --> Cesium

  Nasa --> Core
  Cesium --> Core

  Core -. "must not import" .-> Nasa
  Core -. "must not import" .-> Cesium
```

The core package owns canonical viewer contracts, scene contracts, layer specs,
controllers, coordinates, depth semantics, product builders, product sessions,
and engine-neutral product behavior.

Adapter packages own native engine integration: renderer setup, layer
translation, native objects, picking, camera controls, lifecycle, materials,
shaders, image compatibility, and engine-specific cleanup.

## Maintained Import Model

The root package remains the broad convenience API:

```ts
import { createS100Viewer, LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
```

Product-specific code should prefer the public feature entrypoints introduced
in Phase 9:

```ts
import { S111Workflow } from "@ecc/s100-viewer/products/s111";
import { RouteFeatureSession } from "@ecc/s100-viewer/products/route";
import { VesselFeatureSession } from "@ecc/s100-viewer/products/vessel";
```

Those subpaths are intentionally still part of the core package. They are not
separate packages and they do not create a second app model. They give
application code, examples, tests, and bundlers a narrower place to start when a
screen only needs one product family.

```mermaid
flowchart TD
  Root["@ecc/s100-viewer"] --> Kernel["viewer, scene, layers, coordinates, controllers"]
  Root --> BroadProducts["broad product convenience exports"]

  Enc["@ecc/s100-viewer/products/enc"] --> EncModules["ENC and WMS sessions"]
  S102["@ecc/s100-viewer/products/s102"] --> S102Modules["S-102 builders and terrain session"]
  S111["@ecc/s100-viewer/products/s111"] --> S111Modules["S-111 service, session, workflow"]
  Route["@ecc/s100-viewer/products/route"] --> RouteModules["RTZ parser, route layout, route session"]
  Vessel["@ecc/s100-viewer/products/vessel"] --> VesselModules["vessel session and parametric vessel"]

  Enc -. "must not import" .-> Nasa["@ecc/s100-viewer-adapter-nasa-ammos"]
  S111 -. "must not import" .-> Cesium["@ecc/s100-viewer-adapter-cesium"]
```

The public subpaths are guarded in two places:

- `packages/s100-viewer/test/public-entrypoints.test.ts` checks the export map
  and prevents entrypoints from importing adapters or internal modules.
- `tools/check-bundle-shape.mjs` checks selected static import graphs so major
  product families do not accidentally pull in unrelated product workflows.

## Lazy Adapter Loading Model

Phase 9 also changed adapter loading from eager implementation imports to
progressive runtime loading.

```mermaid
sequenceDiagram
  participant App as App or example
  participant Factory as Adapter factory import
  participant Host as Viewer host module
  participant Scene as Engine scene module
  participant Layer as Heavy layer helper

  App->>Factory: import adapter package root
  App->>Factory: createS100Viewer({ adapter })
  Factory->>Host: dynamic import on createViewerHost()
  App->>Host: viewer.createScene(sceneOptions)
  Host->>Scene: dynamic import on createScene()
  App->>Scene: scene.layers.add(productLayer)
  Scene->>Layer: cached dynamic import for matching layer family
```

This creates two different benefits:

- importing an adapter package root no longer eagerly loads its full renderer
  scene implementation
- using one layer family does not require the NASA-AMMOS adapter shell to
  statically import every other heavy layer helper

The current implementation is asymmetric by design. NASA-AMMOS now has cached
dynamic layer helper imports for ENC/map, route, S-102, S-111, and vessel layer
families. Cesium now defers `CesiumEngineScene` until a Cesium scene is created,
but its internal layer families still live inside that scene file and remain a
future split.

## What Changed

### Phase Timeline

The maintainability work was intentionally sequenced so each phase left the
repo in a runnable state:

| Phase | Result |
| --- | --- |
| 0 | Captured repo status, branch coordination, and validation baseline. |
| 1 | Added release-target and maintainability guardrails before large moves. |
| 2 | Made public adapter roots smaller and clearer. |
| 3 | Moved NASA-AMMOS production runtime code away from legacy compat naming. |
| 4 | Split NASA-AMMOS runtime and renderer code by feature folder. |
| 5 | Split Cesium public shell from Cesium implementation helpers. |
| 6 | Extracted shared engine-neutral product semantics into core internals. |
| 7 | Split RTZ route, route session, and route layout code into focused modules. |
| 8 | Split parametric vessel and controller hotspots, then verified apps/demos. |
| 9 | Added public feature entrypoints, lazy adapter loading, and bundle-shape checks. |

### Guardrails Were Added First

The branch added local maintainability checks before moving major code:

- `npm run maintainability:check`
- `npm run file-size:check`
- `npm run boundaries:check`
- release-target helper scripts under `tools/`
- file-size allowlist metadata under `tools/file-size-allowlist.json`
- architecture notes under `docs/architecture`

The boundary check now protects the intended dependency direction:

- package source cannot import examples
- package source cannot import app code
- examples cannot import package `src` internals
- examples cannot import private package subpaths
- runnable examples cannot import each other, except shared helpers under
  `examples/shared`

The bundle-shape check added in Phase 9 is deliberately static and conservative.
It follows local static import edges, ignores type-only and dynamic imports, and
fails when selected entrypoints or adapter roots accidentally regain eager
dependency edges. It is not a byte-size budget, but it prevents the most likely
maintainability regression: a clean public import silently pulling a large
unrelated product or renderer implementation back into the graph.

### NASA-AMMOS Adapter Was Split

The NASA-AMMOS package root is now a small public barrel:

```text
packages/s100-viewer-adapter-nasa-ammos/src/index.ts
```

It exports only the adapter factory, capabilities, public options, and public
picking type. The implementation now lives behind feature-oriented folders:

```text
packages/s100-viewer-adapter-nasa-ammos/src/
  adapter/
  camera/
  coordinates/
  environment/
  layers/
  picking/
  runtime/
  shared/
```

The maintained runtime path was also renamed away from `runtime/compat`. The
runtime now makes the intended concepts visible:

```text
runtime/
  core/
  map/
  s111/
  scene/
  terrain/
```

The canonical adapter shell now depends on `NasaSceneRuntime`, not a
compatibility-named `ViewerScene` facade.

After Phase 9, the adapter root, viewer-host creation, scene creation, and
heavy layer helper loading are separated:

```text
src/index.ts
src/adapter/createNasaAmmosAdapter.ts
src/adapter/NasaAmmosViewerHost.ts
src/adapter/NasaAmmosEngineScene.ts
src/adapter/layerModules.ts
src/layers/
```

`layerModules.ts` owns cached dynamic imports for optional layer-family helpers.
That keeps the adapter shell readable and makes eager dependency edges
searchable.

### Cesium Adapter Was Split Into A Public Shell And Feature Helpers

The Cesium package root is also a small public barrel:

```text
packages/s100-viewer-adapter-cesium/src/index.ts
```

The package now separates public adapter creation from implementation folders:

```text
packages/s100-viewer-adapter-cesium/src/
  adapter/
  camera/
  cesium/
  environment/
  layers/
```

This makes the public API surface easier to inspect and gives maintainers a
place to continue moving Cesium renderer internals out of
`adapter/CesiumEngineScene.ts` as follow-up work.

After Phase 9, the Cesium adapter root defers the viewer-host module until
`createViewerHost()` is called, and the viewer host defers `CesiumEngineScene`
until `createScene()` is called. The large scene file is still a known
maintainability hotspot; it is now at least behind a lazy boundary rather than
loaded by importing the package root.

### Shared Product Semantics Were Extracted

Engine-neutral rendering rules were moved into core internal modules so adapters
do not need to each reinterpret the same product semantics.

```text
packages/s100-viewer/src/internal/
  adapter-utils/
    AbortableTask.ts
    DisposableStack.ts
    layerPatch.ts
    numeric.ts
    opacity.ts
    urlTemplate.ts
  products/
    depthStyle.ts
    encTransparency.ts
    routeStyle.ts
    s111Style.ts
    s111Time.ts
    vesselPose.ts
```

These modules are internal first-party helpers. They are not package-root API.
Their purpose is to keep adapters consistent on issues such as positive nautical
depth semantics, ENC transparency, S-111 time/style normalization, route style,
and CRS-aware vessel pose calculations.

### Core Product Hotspots Were Split

The core package now uses focused modules for areas that had become difficult
to navigate.

Layer controllers:

```text
packages/s100-viewer/src/layers/controllers/
  baseController.ts
  createLayerControllers.ts
  index.ts
  mapController.ts
  routeController.ts
  surfaceCurrentController.ts
  terrainController.ts
  types.ts
  vesselController.ts
```

Parametric vessel:

```text
packages/s100-viewer/src/products/parametric-vessel/
  bounds.ts
  defaults.ts
  geometry.ts
  index.ts
  layout.ts
  normalize.ts
  overrides.ts
  types.ts
  validation.ts
```

RTZ and route features:

```text
packages/s100-viewer/src/products/rtz-parser/
packages/s100-viewer/src/products/route-layout/
packages/s100-viewer/src/products/route-session/
```

Existing public import paths are preserved through barrels such as:

```text
packages/s100-viewer/src/products/rtz-parser.ts
packages/s100-viewer/src/products/route-layout.ts
packages/s100-viewer/src/products/route-session.ts
packages/s100-viewer/src/products/parametric-vessel.ts
packages/s100-viewer/src/layers/controllers.ts
```

### Example Boundaries Were Tightened

Shared example-only orchestration now lives in:

```text
examples/shared/featureSessions.ts
```

Runnable examples may import from `examples/shared`, but they should not import
each other's application entrypoints. Examples remain consumers of public
packages, not hidden package dependencies.

## Current Runtime Flow

The canonical runtime flow is now:

```mermaid
sequenceDiagram
  participant App as App or example
  participant Core as @ecc/s100-viewer
  participant Adapter as Engine adapter
  participant Scene as EngineScene
  participant Runtime as Native runtime

  App->>Core: createS100Viewer({ adapter })
  Core->>Adapter: create viewer host
  App->>Core: viewer.createScene(sceneSpec)
  Core->>Adapter: create EngineScene
  Adapter->>Scene: bind georeference and capabilities
  App->>Core: scene.layers.add(layerSpec)
  Core->>Scene: create or patch native layer
  Scene->>Runtime: create renderer-native objects
  Runtime-->>Scene: native layer handle
  Scene-->>Core: LayerController
  Core-->>App: canonical layer with controllers
```

The important architectural point is that the app works through
`@ecc/s100-viewer` concepts: viewer, scene, layer specs, product sessions, and
controllers. Adapter-specific renderer objects stay behind adapter package
boundaries.

## Current State

Completed on the maintainability branch:

- Release-target package list is centralized.
- Package and example boundaries are checked locally.
- NASA-AMMOS root export is a small public barrel.
- NASA-AMMOS production runtime code is no longer imported from
  `runtime/compat`.
- Cesium root export is a small public barrel.
- Cesium has extracted adapter, camera, Cesium object, lifecycle, environment,
  and projected-WMS helper modules.
- Shared engine-neutral product semantics live in core internal modules.
- Core layer controllers, parametric vessel, RTZ parser, route layout, and
  route session modules have been split.
- Examples use package-level public imports and shared example-only helpers.
- Core product APIs now have public feature entrypoints such as
  `@ecc/s100-viewer/products/s111`, `@ecc/s100-viewer/products/route`, and
  `@ecc/s100-viewer/products/vessel`.
- Adapter package roots now avoid eager static imports of their viewer-host and
  large scene implementation modules. NASA-AMMOS layer helpers for S-102,
  S-111, ENC/map, vessel, and route rendering are loaded through cached dynamic
  imports when those layer families are used.
- `npm run bundle-shape:check` verifies important static import-graph
  assumptions for feature entrypoints and adapter eager paths.
- Local validation has covered release-target checks, demo checks, demo builds,
  and manual localhost startup for S-100 Explorer plus the main demos.

Validation commands used for the Phase 9 state:

```sh
npm run check:release-target
npm run test:release-target
npm run build:release-target
npm run maintainability:check
npm run pack:release-target:dry-run
npm run check:demo:engine-switcher
npm run check:demo:parametric-vessel
npm run check:demo:rtz-route
npm run check:demo:getting-started
npm run check:demo:reference
npm run build:demo:engine-switcher
npm run build:demo:parametric-vessel
npm run build:demo:rtz-route
npm run build:demo:getting-started
npm run build:demo:reference
```

Manual localhost verification used the S-100 Explorer app and the five demo
apps on ports `5173` through `5178`.

Known remaining maintainability debt:

- `packages/s100-viewer-adapter-nasa-ammos/src/runtime/scene/NasaSceneRuntime.ts`
  is still a large renderer-runtime file.
- `packages/s100-viewer-adapter-nasa-ammos/src/runtime/map/FlatMapOverlay.ts`
  still contains substantial map tile behavior.
- `packages/s100-viewer-adapter-nasa-ammos/src/runtime/s111/SeaCurrentsOverlay.ts`
  still contains substantial S-111 renderer behavior.
- `packages/s100-viewer-adapter-cesium/src/adapter/CesiumEngineScene.ts`
  is still the largest remaining adapter file. It is loaded lazily from the
  viewer host, but its internal layer families still need a deeper follow-up
  split.
- Some file-size allowlist entries can be reconciled after the split barrels
  and core product modules have stabilized.

## Future Phases Not Yet Implemented

### Phase 10: Package Release And Webapp Coordination

This phase should be done when the maintainability branch is ready to validate
against packaged artifacts rather than workspace source.

Recommended work:

- Bump package versions at a meaningful validation point.
- Run release-target checks:
  - `npm run check:release-target`
  - `npm run test:release-target`
  - `npm run build:release-target`
  - `npm run pack:release-target:dry-run`
- Produce release tarballs if the branch should be tested through URL imports.
- Update S-100 Explorer dependencies to the selected tarball URLs or local
  package references for the validation mode.
- Validate S-100 Explorer scenario behavior, including ENC, S-102,
  safety-depth styling, S-111 loading and playback, vessel controls, draught,
  heading, and any route features consumed by the app.
- Update the super-repo submodule pointer after each successful lib batch.

### Phase 11: CI And Release Hygiene

This phase should make the new guardrails durable in GitHub checks.

Recommended work:

- Add CI for the standalone lib repository.
- Run clean install, maintainability checks, release-target type checks,
  release-target tests, release-target builds, package dry-run, and key demo
  builds.
- Fail CI if `.env.local`, generated `dist`, tarballs, local planning files,
  demo-only secrets, or stale Cogs artifacts are accidentally packaged.
- Keep package readiness docs aligned with the scripts that CI runs.

### Follow-Up Renderer Splits

These can be done independently after the branch remains stable:

- Split `NasaSceneRuntime.ts` by camera navigation, terrain queues, custom
  models, picking hooks, vessel interaction, and render-loop coordination.
- Split `FlatMapOverlay.ts` by tile grid, tile loading, alpha handling,
  priority, and disposal.
- Split `SeaCurrentsOverlay.ts` by dataset loading, arrow geometry, materials,
  color bands, and time updates.
- Split `CesiumEngineScene.ts` by layer family: map imagery, S-102 tilesets,
  S-111 primitives, vessel entities, picking, and scene lifecycle.
- Split `s111-workflow.ts` only after S-111 orchestration settles further.

## Maintainer Rules Going Forward

- Keep package roots as public barrels.
- Keep app behavior out of package source.
- Keep examples as consumers, not dependencies.
- Put engine-neutral S-100 semantics in `@ecc/s100-viewer`.
- Put renderer-native behavior in the relevant adapter.
- Add or update boundary tests when a new package, example, or public subpath is
  introduced.
- Treat file-size allowlist entries as temporary explanations, not permanent
  permission to grow monoliths.

## Related Documents

- [Package boundaries](./package-boundaries.md)
- [Scene and layer lifecycle](./scene-layer-lifecycle.md)
- [Coordinates and depth](./coordinates-and-depth.md)
- [Adapter authoring guide](./adapter-authoring-guide.md)
- [Package readiness](../package-readiness.md)
