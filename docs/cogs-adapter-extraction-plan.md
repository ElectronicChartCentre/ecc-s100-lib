# Cogs Adapter Extraction Plan

The Cogs adapter is complete enough for the Phase 7 interoperability baseline,
but Phase 8 package planning excludes it from the future default release package
set.

## Decision

Move `@ecc/s100-viewer-adapter-cogs` toward a separate local interoperability
repository.

Public repository and public npm package status are left undecided.

## Local Repo Boundary

The local Cogs adapter repo should contain:

- `@ecc/s100-viewer-adapter-cogs`
- adapter tests and Cogs parity fixtures
- its own package lock and CI
- peer dependency on `@ecc/s100-viewer`
- optional peer dependency on `@kognifai/cogsengine`

It should not contain:

- release-target docs for the default package set
- NASA-AMMOS adapter internals
- S-100 Explorer application code
- core API definitions duplicated from `@ecc/s100-viewer`

## Compatibility Contract

The adapter should keep testing the same public API concepts:

- projected-local scene creation
- S-102 terrain
- S-101/map overlays
- S-111 currents
- S-104 sea-level updates
- vessel pose and controls where supported
- camera and picking normalization

Any feature that only works through a Cogs-specific native handle should stay
documented as adapter-native, not added to the core API by default.

