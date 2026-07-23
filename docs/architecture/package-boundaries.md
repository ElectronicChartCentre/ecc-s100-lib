# Package Boundaries

This document defines where code belongs inside `ecc-s100-lib`. It is a
maintainer-facing guide for structural refactors and new feature work.

## Release Target Packages

The maintained public package set is:

- `@ecc/s100-viewer`
- `@ecc/s100-viewer-adapter-nasa-ammos`
- `@ecc/s100-viewer-adapter-cesium`

The root workspace may include demos, local experiments, and historical
planning artifacts, but those are not release targets unless they are added to
`tools/release-targets.mjs`.

## Core Package Responsibilities

`packages/s100-viewer` owns engine-neutral API and product semantics:

- viewer and scene interfaces
- layer specs
- controller interfaces
- controller implementations that operate through `EngineScene`
- product builders
- product sessions and workflows
- coordinate and depth types
- engine-neutral product normalization
- in-memory adapter for tests and contracts

The core package must not import engine adapters, app code, examples, or
adapter-native objects.

## Public Feature Entrypoints

The root `@ecc/s100-viewer` export remains the canonical convenience API for
viewer and scene setup. Product-specific application code may use public
feature entrypoints:

```text
@ecc/s100-viewer/products
@ecc/s100-viewer/products/enc
@ecc/s100-viewer/products/s102
@ecc/s100-viewer/products/s111
@ecc/s100-viewer/products/route
@ecc/s100-viewer/products/vessel
@ecc/s100-viewer/products/simulated-water-level
@ecc/s100-viewer/features
```

These entrypoints are barrels over core package modules. They must not import
adapters or `src/internal` modules.

## Adapter Package Responsibilities

Adapter packages own engine-specific rendering and lifecycle integration.

An adapter may import `@ecc/s100-viewer`, but the core package must never import
an adapter.

Adapter code may contain:

- `S100EngineAdapter` factory implementations
- `EngineViewerHost` implementations
- `EngineScene` implementations
- native engine object creation
- engine-specific camera handling
- engine-specific picking
- engine-specific material, shader, primitive, and entity code
- engine-specific cleanup and native-handle mapping

Adapter code should not define product semantics that can be shared in the core
package, such as positive depth normalization, S-111 speed-band selection, route
style defaults, or ENC opacity rules.

## Examples

Examples are consumers of the public packages. They may import packages, but no
package may import an example.

Examples may contain:

- demo `.env.example` files
- local sample data
- static demo vessels or skyboxes
- private service configuration templates
- UI code for explaining package usage

Examples must not become hidden runtime dependencies for packages.

## App Code

S-100 Explorer app code is outside the package boundary. Package source must not
import from the app.

If app code needs a reusable feature, decide whether it is:

- app-specific orchestration, which stays in the app
- engine-neutral S-100 product behavior, which belongs in `@ecc/s100-viewer`
- engine-specific rendering, which belongs in the relevant adapter

## Internal Modules

Internal helpers should live under clearly named folders, such as:

```text
packages/s100-viewer/src/internal
packages/s100-viewer-adapter-nasa-ammos/src/shared
packages/s100-viewer-adapter-cesium/src/shared
```

Internal modules are not public API. Do not export them from package roots
unless a deliberate public subpath is designed.

## Runtime Boundaries

NASA-AMMOS maintained runtime code lives under named feature folders such as
`runtime/scene`, `runtime/map`, `runtime/s111`, and `runtime/terrain`.
Production adapter code must not import from `runtime/compat`.

The intended end state is:

- runtime feature folders continue to split large renderer modules by concern
- any future compatibility facade is isolated and small
- production adapter code depends on canonical runtime classes such as
  `NasaSceneRuntime`

## Guardrails

Run:

```sh
npm run maintainability:check
```

This checks:

- file-size thresholds
- package import boundaries
- accidental runtime compatibility imports
- canonical root API boundary assumptions
- bundle-shape assumptions for feature entrypoints and adapter eager paths
