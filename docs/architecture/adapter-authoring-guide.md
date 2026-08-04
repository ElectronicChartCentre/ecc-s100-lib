# Adapter Authoring Guide

This guide defines the expected structure for maintained engine adapters.

## Public Adapter Surface

An adapter package root should primarily export:

- adapter factory
- adapter capabilities
- public adapter option types
- intentionally public engine-native handle types, if any

Example:

```ts
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";
import { createCesiumAdapter } from "@ecc/s100-viewer-adapter-cesium";
```

The package root should not export internal renderer classes, compatibility
facades, or deep native helper modules.

## Required Interfaces

Each adapter implements:

- `S100EngineAdapter`
- `EngineViewerHost`
- `EngineScene`

The adapter factory creates an engine host. The host creates scenes. The scene
owns native layer lifecycle and native scene interaction.

## Recommended Source Layout

Use this shape unless there is a strong reason not to:

```text
src/
  index.ts
  adapter/
    capabilities.ts
    createAdapter.ts
    EngineViewerHost.ts
    EngineScene.ts
    layerNativeTypes.ts
  camera/
  coordinates/
  environment/
  layers/
  picking/
  shared/
```

Large engine-specific namespaces may add one more folder, for example
`src/cesium` or `src/runtime`.

## Layer Renderer Responsibilities

A layer renderer should:

- validate source kind
- create native engine resources
- return native handles
- patch existing native resources
- clean up native resources
- avoid holding app-specific state

Layer renderers should not define product semantics that are shared between
engines. Put those in core internal product helpers.

## Capabilities

Capabilities should be accurate and specific. If an adapter cannot render a
product or visual feature, do not claim it.

Capability changes should have tests because app code uses capabilities to
decide which controls and scenarios are safe to expose.

## Picking

Picking should return canonical `PickResult` data where possible.

Engine-specific native pick information can be attached through documented
native handles or metadata, but app code should not need native objects for
common workflows.

## Environment

Environment setup includes:

- skybox
- HDR/equirectangular environment
- static lights
- dynamic scene-time lighting
- engine-specific fallbacks

Keep image loading and native material setup inside the adapter. Keep
engine-neutral environment state in the core API.

## Testing Expectations

Each adapter should have feature-level tests for:

- factory and capabilities
- viewer host lifecycle
- scene lifecycle
- camera controls
- environment
- S-102 terrain
- ENC/map overlays
- S-111 currents
- S-104 water-level sampling and terrain-shading behavior where supported
- vessel rendering, including model, parametric, and live-vessel feed layers
- route rendering where supported
- picking
- async teardown

Avoid adding large mixed-responsibility package tests when a focused feature
test would locate failures more clearly.
