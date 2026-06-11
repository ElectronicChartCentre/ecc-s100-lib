# Developer Ergonomics Review

Phase 8 goal: make the package convenient to use before deciding on public npm
publication.

## Current Strengths

- The core API has a small entry point: `createS100Viewer({ adapter, container })`.
- Product layer specs are explicit TypeScript objects and use service-ready
  sources instead of engine-specific data structures.
- Adapters report capabilities, which gives applications a place to check
  support before adding layers or enabling tools.
- `SceneBuilder.projectedLocal(...)` removes common projected/local scene
  georeference boilerplate.
- `LayerBuilder` removes common product-layer boilerplate for S-101, S-102,
  S-104, S-111, vessels, and map overlays.
- Product specs and builders now export from `@ecc/s100-viewer`, so normal
  application code does not need a second product package.
- Product builders default `productSpecificationVersion` to
  `latest-confirmed-supported`, with explicit edition identifiers available for
  future product-version-specific rendering.
- `defineS100LayerSpec(...)` remains available as a low-level type helper.
- The compatibility facade keeps S-100 Explorer migration incremental.

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

5. The NASA-AMMOS adapter still uses a vendored compatibility surface
   internally.

   Recommended improvement: migrate adapter internals from the compatibility
   surface to direct NASA-AMMOS primitives before public release.

6. The temporary `@ecc/s100-viewer/compat` subpath is still widely used by
   S-100 Explorer.

   Recommended improvement: keep it local while needed, then remove it after
   Explorer handlers use the core API directly.

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
2. Replace NASA-AMMOS adapter internals that still use the compatibility
   surface.
3. Migrate S-100 Explorer handlers from `@ecc/s100-viewer/compat` to direct core
   and product specs.
4. Add standardized `S100Error` coverage for data source, CRS, capability, and
   time errors.
5. Add real generated API docs once a docs generator is selected.
6. Remove the temporary compat subpath once Explorer handlers use direct core
   and product specs.
