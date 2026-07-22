# Scene And Layer Lifecycle

This document describes the lifecycle model maintainers should preserve while
splitting adapters and product helpers.

## Viewer Lifecycle

The public entry point is:

```ts
const viewer = await createS100Viewer({ adapter, container });
```

The viewer owns one engine host. The engine host is responsible for native
viewer resources, such as a Three.js renderer or a Cesium viewer instance.

Destroying a viewer must:

- destroy all created scenes
- stop time and camera controllers
- remove render-loop callbacks
- remove DOM event listeners
- release native engine resources
- prevent late async work from mutating destroyed objects

## Scene Lifecycle

A scene owns:

- georeference
- environment controller
- time controller
- camera controller
- layer collection
- picking controller
- native engine scene resources

Scene destruction must be idempotent. Calling `destroy()` more than once should
not throw.

## Layer Lifecycle

A layer moves through these states:

1. Spec is created by app or product helper.
2. Core layer is added to the scene.
3. Core scene asks adapter scene to add the native layer.
4. Adapter returns native handles.
5. Core layer exposes controllers.
6. App or product session patches controller state.
7. Adapter patches native layer.
8. Layer is removed or scene is destroyed.
9. Adapter releases native resources and subscriptions.

Every adapter layer should have one owner for cleanup. Prefer a dedicated
disposable stack or equivalent local helper over scattered cleanup arrays.

## Async Work

Async work must be cancellable or guarded by a current-run token.

Examples:

- WMS image loading
- 3D Tiles setup
- S-111 service loading
- route file loading
- model loading
- delayed opacity or removal timers

If a layer is removed or a scene is destroyed while async work is pending, the
late result must not mutate the destroyed scene.

## Native Handles

Native handles are borrowed handles, not stable public objects. They are valid
only while the layer, scene, and viewer are alive.

Adapters should expose native handles for debugging and advanced integrations,
but ordinary product behavior should go through typed controllers.

## Engine Switching

Engine switching is effectively a full teardown followed by a new viewer and
scene. The old engine must not keep:

- DOM listeners
- render-loop callbacks
- timers
- in-flight network callbacks that mutate native objects
- references to destroyed native primitives

## Tests To Preserve

Lifecycle tests should cover:

- add, patch, remove layer
- hide and show layer
- scene destroy with live layers
- viewer destroy with live scene
- destroy while async work is pending
- engine switch after S-102, S-111, vessel, and route layers have been added

