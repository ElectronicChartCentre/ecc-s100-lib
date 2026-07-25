# API Entrypoints

`@ecc/s100-viewer` exposes a broad root import plus product-focused public
subpaths. The root remains the canonical viewer and scene API. Product subpaths
are preferred in application feature code because they keep imports narrower and
make bundle shape easier to reason about.

## Root Package

Use the root package for viewer, scene, layer, coordinate, camera, time, picking,
environment, event, math, and adapter contracts.

```ts
import {
  CameraControlPresets,
  Coordinates,
  LayerBuilder,
  SceneBuilder,
  createS100Viewer,
  type S100EngineAdapter,
  type S100Scene,
  type S100Viewer,
} from "@ecc/s100-viewer";
```

Use this entrypoint when:

- creating a viewer or scene
- implementing an adapter
- adding low-level product layer specs with `LayerBuilder`
- writing app code that needs several product families in one module

## Product Convenience Entrypoint

Use `@ecc/s100-viewer/products` when a module intentionally composes multiple
product families.

```ts
import {
  PrimarServices,
  S102TerrainSession,
  S111SurfaceCurrentSession,
  VesselFeatureSession,
} from "@ecc/s100-viewer/products";
```

This is useful for orchestration modules such as the reference app feature
session setup.

## ENC Entrypoint

```ts
import {
  EncWmsSession,
  EncLayerBuilder,
  ProjectedMap,
  resolveEncWmsAvailability,
} from "@ecc/s100-viewer/products/enc";
```

Use for S-101 and S-57 ENC WMS/WMTS/template workflows, projected map helpers,
ENC availability resolution, and map specification conversion.

## S-102 Entrypoint

```ts
import {
  S102TerrainSession,
  createS102,
  depthFromElevation,
  type S102LayerSpec,
} from "@ecc/s100-viewer/products/s102";
```

Use for S-102 3D Tiles bathymetry, safety-depth styling, terrain replacement,
and depth/elevation conversion helpers.

## S-111 Entrypoint

```ts
import {
  S111SurfaceCurrentSession,
  S111Workflow,
  createPrimarS111Service,
  createStaticS111,
} from "@ecc/s100-viewer/products/s111";
```

Use for S-111 service access, metadata assessment, static/current layers,
timeline configuration, and app-level current sessions.

## Route Entrypoint

```ts
import {
  RouteFeatureSession,
  RouteStyles,
  parseRtzRoute,
} from "@ecc/s100-viewer/products/route";
```

Use for RTZ parsing, route-plan specs, geodesy helpers, route layout, S-421-like
portrayal, and route feature sessions.

## Vessel Entrypoint

```ts
import {
  VesselFeatureSession,
  createLiveVesselFeedLayer,
  mapLiveAisVesselToParametricVessel,
  normalizeParametricVesselSpec,
} from "@ecc/s100-viewer/products/vessel";
```

Use for model vessels, parametric vessels, live AIS vessel feeds, vessel
dimensions, pose handling, and vessel controllers.

## Simulated Water Level Entrypoint

```ts
import {
  createSimulatedWaterLevel,
  createStaticSimulatedWaterLevel,
} from "@ecc/s100-viewer/products/simulated-water-level";
```

Use for non-IHO simulated water-level data that drives scene sea level over
time.

## Features Entrypoint

```ts
import { FeatureLifecycleScope } from "@ecc/s100-viewer/features";
```

Use for shared feature-session lifecycle helpers when implementing new
high-level product sessions.

## Adapter Packages

Adapter packages stay at their package roots:

```ts
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";
import { createCesiumAdapter } from "@ecc/s100-viewer-adapter-cesium";
import { createThreeAdapter } from "@ecc/s100-viewer-adapter-three";
```

Keep these imports inside an engine-selection module such as the engine
switcher `engineRegistry.ts`. Product feature code should receive an `S100Scene`
or feature-session handle and should not import adapter packages.

## Public Versus Internal Imports

Public imports:

```ts
import { S102TerrainSession } from "@ecc/s100-viewer/products/s102";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";
```

Private imports to avoid in application code:

```ts
import { something } from "@ecc/s100-viewer/internal/products/foo";
import { something } from "@ecc/s100-viewer-adapter-nasa-ammos/src/foo";
```

The maintainability checks enforce this boundary for packages and examples.
