# S-104 Water Level Architecture Decision

Status: Phase 0 decision record on `ecc-lib-maintainability`

Date: 2026-07-25

## Decision

S-104 support will be implemented as product data and a water-level sampler
first, not as a renderer-specific layer first.

The central library capability will answer:

```text
scene coordinate + scene time
  -> S-104 waterLevelHeight/trend/uncertainty
  -> provenance for dataset, source time, grid index, datum, and sampling mode
```

Adapters may later use that field for terrain, ocean, and vessel rendering, but
the first correctness target is the engine-neutral sampler.

## Product Boundary

`S-104` and `simulated-water-level` are separate concepts:

- `S-104` is an IHO S-100 product for water level information for surface
  navigation.
- `simulated-water-level` is a non-IHO helper product that drives a global
  scene sea-level scalar from REST or static JSON.
- Generated S-104-shaped fixtures are development fixtures. They are useful for
  building the API, sampler, workflow, and demos, but they are not conformance
  evidence and must not be presented as operational S-104 data.

The current `simulated-water-level` API remains valid for demos and scenarios
that only need a global scalar water-level signal. It must not be renamed or
reused as the real S-104 implementation.

## Initial Product Rules

The initial implementation targets S-104 Edition 2.0.0 semantics established in
the planning research:

- regular grid only;
- nearest-neighbor spatial lookup;
- nearest-record temporal lookup;
- no time or space extrapolation;
- fill/no-data values must be honored;
- shoreline or same-waterbody logic is not the default;
- any shoreline-aware behavior must be an explicit extension backed by product
  masks or preprocessed waterbody topology.

## Public API Direction

The planned public import surface is:

```ts
import {
  S104Workflow,
  createFixtureS104Service,
  type S104WaterLevelSampler,
} from "@ecc/s100-viewer/products/s104";
```

The root package may eventually re-export common S-104 types, but
product-specific workflows should remain available from the product entrypoint
to preserve the bundle-aware import model established by the maintainability
work.

The app and demos should not parse S-104 grids directly. They should configure
dataset ids, service endpoints, and workflow options, then consume sampler
results returned by the library.

## Generated Fixture Strategy

Real S-104 HDF5 sample files are not currently available. Phase 1+ work should
therefore start with generated, S-104-shaped JSON fixtures:

- deterministic regular grids;
- time-varying scalar water levels;
- spatial phase delay so different coordinates can have different water levels
  at the same time;
- optional radial ripple terms for a two-dimensional moving field;
- optional fill/no-data regions for sampler tests;
- localhost service responses shaped like the future real endpoint.

The generator should be repo-owned and deterministic. Generated JSON and other
large fixture outputs should be stored in the static files repository, not in
`ecc-s100-lib`. This keeps the library source repository focused on code,
types, tests, and fixture generation logic while still making demo payloads
available through the same static asset workflow used by the existing demos.

## First Fixture Scene

Use the existing Stavanger demo area as the first generated S-104 fixture
anchor. It already exercises S-102 terrain, S-101 overlays, live AIS vessels,
and local service configuration in the engine switcher demo.

Initial fixture scene settings:

```ts
const initialS104FixtureScene = {
  crs: "EPSG:32631",
  center: {
    x: 654_390.818,
    y: 6_542_760.725,
    z: 0,
  },
  mapWidthMeters: 9_000,
  projectedBounds: {
    minX: 649_890.818,
    minY: 6_538_260.725,
    maxX: 658_890.818,
    maxY: 6_547_260.725,
  },
  approximateLonLatBounds: {
    west: 5.625,
    south: 58.968708,
    east: 5.749944,
    north: 59.024184,
  },
  relatedS102DatasetIds: [
    "102NO006J0811_10_U",
    "102NO006T0711_40_U",
    "102NO006T0711_30_U",
    "102NO006J0811_20_U",
  ],
};
```

The first generated grid should be coarse enough for fast unit tests and manual
browser testing, but large enough to show spatial differences clearly. A good
starting point is a 9 km by 9 km grid with 150 m spacing, producing 61 by 61
points per time record.

## Scene Integration Direction

The existing scene API exposes a global scalar:

```ts
scene.setSeaLevel(value);
scene.getSeaLevel();
```

Real S-104 can vary horizontally, so later phases should add a scene-level
water-level field controller instead of forcing S-104 into the global scalar.

Preferred direction:

```ts
scene.waterLevel.sample({ coordinate, time });
```

The global sea-level scalar should remain as a compatibility fallback for:

- static sea level;
- existing simulated water-level behavior;
- adapters or tools that cannot yet consume point-specific S-104 samples.

## Adapter Integration Direction

Adapters should not own S-104 product parsing. They should consume scene-level
water-level samples or representative values exposed by the core package.

First-pass rendering behavior may use a representative sampled value near the
vessel or camera for ocean-surface height. Per-position S-104 terrain/ocean
shading should be a later shader/texture phase after the sampler is stable.

## Implementation Handoff

The next implementation phases should proceed in this order:

1. Shared gridded time-series helpers.
2. Generated S-104 fixture generator.
3. Localhost fixture service served from the static files repository output.
4. `@ecc/s100-viewer/products/s104` entrypoint, public types, service helpers,
   metadata assessment, and workflow preparation.
5. Metadata assessment, decoder, sampler, and workflow.
6. Scene water-level field controller.
7. Demo and S-100 Explorer integration.
8. Real HDF5 and production service path when sample files and backend planning
   are available.

## Guardrails

- Keep heavy fixture generation and future HDF5 dependencies out of browser
  runtime bundles.
- Keep generated fixtures separate from product conformance claims.
- Keep S-104 implementation in `@ecc/s100-viewer`; adapters must not duplicate
  S-104 grid parsing.
- Keep app-local code free of S-104 grid math.
- Keep `simulated-water-level` wording wherever the feature is not real S-104.
