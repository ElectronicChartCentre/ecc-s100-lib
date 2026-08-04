# Developer Ergonomics Review

Status: historical review retained for context. The maintainability branch has
implemented the canonical root API, adapter capability reporting, product
builders, selected Explorer migration work, live AIS orchestration, S-104
sampling, and the Three.js reference adapter since this review was written. Use
`docs/start-here.md`,
`docs/architecture/maintainability-refactor.md`, and
`NEW_FEATURES_AFTER_INTEROPERABILITY_REFACTOR.md` as the current-state entry
points.

Maintainability branch goal: make the package convenient to use before deciding
on public npm publication.

## Current Strengths

- The core API has a small entry point: `createS100Viewer({ adapter, container })`.
- Product layer specs are explicit TypeScript objects and use service-ready
  sources instead of engine-specific data structures.
- Adapters report capabilities, which gives applications a place to check
  support before adding layers or enabling tools.
- `SceneBuilder.projectedLocal(...)` removes common projected/local scene
  georeference boilerplate.
- `LayerBuilder` and product feature sessions remove common product-layer
  boilerplate for ENC standards, S-102, S-104, S-111, simulated water-level
  layers, vessels, live AIS fleets, RTZ routes, and map overlays.
- Product specs and builders now export from `@ecc/s100-viewer`, so normal
  application code does not need a second product package.
- Product builders default `productSpecificationVersion` to
  `latest-confirmed-supported`, with explicit edition identifiers available for
  future product-version-specific rendering.
- `defineS100LayerSpec(...)` remains available as a low-level type helper.
- S-100 Explorer now consumes the canonical viewer API through app-owned viewer
  handlers and a NASA-AMMOS-only engine boundary. The old runtime bridge shape
  is historical migration context, not the current integration model.

## Current Friction

1. Scene setup is improved by `SceneBuilder.projectedLocal(...)`, but there are
   not yet helpers for every scene pattern.

   Recommended improvement: add follow-on helpers such as
   `SceneBuilder.utm({ epsg, origin })` and final-phase ECEF helpers.

2. Product layer specs now have `LayerBuilder` helpers in the core package, but
   the builder surface
   should be refined with feedback from real Explorer migration code.

   Recommended improvement: add any missing source variants and application
   presets discovered during S-100 Explorer migration, including exact product
   specification version defaults once they are validated.

3. Lifecycle is simple but not yet documented as a canonical pattern.

   Recommended improvement: document the standard `try/finally` cleanup path and
   the expected behavior of `viewer.destroy()` and `scene.destroy()`.

4. Error messages are only partially normalized.

   Recommended improvement: make service URL, CRS mismatch, unsupported product,
   unsupported source, and time-range errors return actionable `S100Error`
   codes and messages.

5. Adapter internals are much better split than in the original review, but
   renderer-specific implementation files still need regular parity and bundle
   checks as NASA-AMMOS, Three.js, and Cesium evolve.

   Recommended improvement: keep adapter internals behind package-private
   modules, keep lazy layer loading intact, and use the engine switcher demo as
   a parity check for S-102, S-104, S-111, vessel, route, and AIS workflows.

6. S-100 Explorer still has meaningful app orchestration code around service
   configuration, sidebar state, and scenario persistence.

   Recommended improvement: keep pushing reusable product semantics into
   `@ecc/s100-viewer` while keeping Explorer-specific persistence and UI state
   in the app.

## Low-Boilerplate Target

A minimal scene should stay close to this shape:

```ts
const viewer = await createS100Viewer({
  container,
  adapter: createNasaAmmosAdapter(),
});

const scene = await viewer.createScene({
  georeference: SceneBuilder.projectedLocal({
    crs: "EPSG:32619",
    origin: { x: 331100, y: 5186420, z: 0 },
  }),
});

await scene.layers.add(LayerBuilder.createS102({
  url: "/tileset.json",
  crs: "EPSG:32619",
}));
```

This low-boilerplate path now exists for common projected/local scenes and
common product layers.

## Prioritized Cleanup List

1. Refine `SceneBuilder` and `LayerBuilder` against real S-100 Explorer
   migration code.
2. Keep adapter parity checks current for NASA-AMMOS, Three.js reference, and
   Cesium.
3. Keep S-100 Explorer handlers on direct core/product specs and avoid
   reintroducing app-local product templates.
4. Add standardized `S100Error` coverage for data source, CRS, capability, and
   time errors.
5. Add real generated API docs once a docs generator is selected.
6. Add snippet/contract tests for the canonical docs and product entrypoints.
