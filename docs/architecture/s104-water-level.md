# S-104 Water Level Architecture

Status: current implementation note on `ecc-lib-maintainability`

Updated: 2026-07-27

## Decision

S-104 support is implemented as product data, workflow orchestration, and a
scene-level water-level sampler first. Adapters consume the prepared field; they
do not parse S-104 datasets themselves.

The central library capability answers:

```text
scene coordinate + scene time
  -> S-104 waterLevelHeight/trend/uncertainty
  -> provenance for dataset, source time, grid index, datum, and sampling mode
```

The scene can then use that answer for:

- point-specific vessel vertical behavior;
- representative global sea-level fallback where an adapter needs a scalar;
- adapter-owned per-position terrain shading where an adapter supports a
  sampled water-level field.

## Product Boundary

`S-104` and `simulated-water-level` are separate concepts:

- `S-104` is an IHO S-100 product for water level information for surface
  navigation.
- `simulated-water-level` is a non-IHO helper product that drives a global
  scene sea-level scalar from REST or static JSON.
- Generated S-104-shaped fixtures are development fixtures. They are useful for
  building the API, sampler, workflow, and demos, but they are not conformance
  evidence and must not be presented as operational S-104 data.

The `simulated-water-level` API remains valid for demos and scenarios that only
need a global scalar water-level signal. It must not be renamed or reused as the
real S-104 implementation.

## Implemented Product Rules

The current implementation targets the S-104 Edition 2.0.0 rules established in
the planning research:

- regular grid support first;
- nearest-neighbor spatial lookup;
- nearest-record temporal lookup;
- no time or space extrapolation;
- fill/no-data values are honored;
- shoreline or same-waterbody logic is not inferred by default;
- any shoreline-aware behavior must be an explicit future extension backed by
  product masks or preprocessed waterbody topology.

When no S-104 value exists at a point, rendering integrations treat the point as
having zero extra water-level effect above the baseline. Sampler callers still
receive an explicit non-value status such as `outside-coverage`,
`outside-time-range`, or `missing-value`.

## Public API

Product-specific application code should import S-104 from the product
entrypoint:

```ts
import {
  S104Workflow,
  createFixtureS104Service,
  createS104WaterLevelSampler,
  sampleS104WaterLevel,
  type S104WaterLevelSampler,
} from "@ecc/s100-viewer/products/s104";
```

The app and demos should not parse S-104 grids directly. They should configure
dataset ids, service endpoints, projection options, and workflow limits, then
consume the sampler and statuses returned by the library.

Typical workflow:

```ts
const result = await S104Workflow.prepare({
  datasets,
  crs: "EPSG:32631",
  service: createFixtureS104Service({
    endpoint: "http://127.0.0.1:8794",
  }),
  limits: {
    maxDataPoints: 500000,
    metadataFetchConcurrency: 1,
    dataFetchConcurrency: 1,
  },
});

scene.waterLevel.setSampler(result.sampler);
```

Successful workflow results include:

- prepared decoded datasets;
- per-dataset statuses;
- merged timeline metadata;
- observed grid spacing;
- a ready `S104WaterLevelSampler`.

Sampler values include:

- water-level height in metres;
- trend;
- uncertainty when present;
- requested and source time;
- requested coordinate and sampled coordinate;
- projected grid index and linear index;
- dataset id;
- vertical datum when present;
- product specification version when present;
- sampling mode.

## Generated Fixture Strategy

Real S-104 HDF5 sample files were not available during the initial
implementation, so the branch added generated, S-104-shaped JSON fixtures:

- deterministic regular grids;
- time-varying scalar water levels;
- spatial phase delay so different coordinates can have different water levels
  at the same time;
- optional radial ripple terms for a two-dimensional moving field;
- optional fill/no-data regions for sampler tests;
- localhost service responses shaped like the future real endpoint.

The generator is repo-owned and deterministic. Generated JSON and other large
fixture outputs are stored in the static files repository by default, not in
`ecc-s100-lib`. This keeps the library source repository focused on code,
types, tests, and fixture generation logic while still making demo payloads
available through the same static asset workflow used by the existing demos.

Commands:

```sh
npm run fixtures:s104:generate
npm run fixtures:s104:validate
npm run demo:s104-fixture-service
```

Default local service endpoint:

```text
http://127.0.0.1:8794/s104/catalog.json
```

## Fixture Scene

The first generated S-104 fixture is anchored in the Stavanger demo area. It
exercises S-102 terrain, S-101/S-57 overlays, live AIS vessels, and local
service configuration in the engine switcher and S-100 Explorer.

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

The generated grid is coarse enough for fast unit tests and manual browser
testing, but large enough to show spatial differences clearly.

## Scene Integration

The existing scene API still exposes a global scalar:

```ts
scene.setSeaLevel(value);
scene.getSeaLevel();
```

That API remains the static/simulated fallback. Real S-104 can vary
horizontally, so the core scene exposes a water-level field controller:

```ts
scene.waterLevel.setSampler(workflowResult.sampler);
const sample = scene.waterLevel.sample({ coordinate, time });
```

The global sea-level scalar remains as fallback for:

- static sea level;
- existing simulated water-level behavior;
- adapters or tools that cannot consume point-specific S-104 samples.

The sample result includes `source`, allowing app code to distinguish `static`,
`simulated-water-level`, and `s104` values. The S-104 source preserves sampler
provenance, including dataset id, source time, grid index, datum, and sampling
mode.

## Adapter Integration

Adapters must not own S-104 product parsing. They consume scene-level
water-level state supplied by the core scene.

Current capability matrix:

| Adapter | `waterLevelField` | `waterLevelTerrainShading` | Notes |
| --- | --- | --- | --- |
| NASA-AMMOS | `sampled` | `per-position` | Uses prepared field data for S-102 safety-depth terrain shading. |
| Three.js reference | `sampled` | `per-position` | Mirrors the NASA-AMMOS projected-local sampled terrain behavior where possible. |
| Cesium | `sampled` | `global` | Uses representative/scalar behavior for now; globe/ECEF water-field work remains later. |

The core scene still computes a representative sampled sea level for features
that need a scalar. NASA-AMMOS and Three additionally receive projected S-104
field grids so S-102 red safety shading can vary horizontally across terrain.

Vessel feature sessions use `scene.waterLevel.sample({ coordinate })` at the
vessel position for sea-level-relative vertical limits. This keeps draught and
vertical placement aligned with spatially varying water level where a sampler
is available.

## Implemented Sequence

The completed implementation sequence was:

1. Shared gridded time-series helpers.
2. Generated S-104 fixture generator.
3. Localhost fixture service served from the static files repository output.
4. `@ecc/s100-viewer/products/s104` entrypoint, public types, service helpers,
   metadata assessment, and initial workflow preparation.
5. Strict metadata assessment and regular-grid dataset decoder.
6. Point-specific water-level sampler.
7. Workflow orchestration with partial success, merged timeline, observed grid
   spacing, and sampler construction.
8. Scene water-level field controller.
9. Engine switcher and S-100 Explorer integration.
10. Adapter water-level field forwarding.
11. Per-position S-102 terrain shading in NASA-AMMOS and Three.

## Remaining Work

- Add real HDF5 ingestion or backend service conversion once real S-104 sample
  files and production endpoint decisions are available.
- Add conformance-oriented tests against real S-104 datasets.
- Decide whether shoreline-aware or waterbody-aware sampling is needed, and
  implement it only with explicit product masks or topology inputs.
- Extend Cesium beyond global/representative water-level terrain behavior during
  the dedicated globe/ECEF phase.
- Add operational documentation for a future production S-104 service contract.

## Guardrails

- Keep heavy fixture generation and future HDF5 dependencies out of browser
  runtime bundles.
- Keep generated fixtures separate from product conformance claims.
- Keep S-104 implementation in `@ecc/s100-viewer`; adapters must not duplicate
  S-104 grid parsing.
- Keep app-local code free of S-104 grid math.
- Keep `simulated-water-level` wording wherever the feature is not real S-104.
