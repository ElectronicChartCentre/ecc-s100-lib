# S-104 Fixture Generation

This tool generates deterministic S-104-shaped JSON fixtures for client-side
water-level workflow development. The generated data is not an IHO conformance
sample and should be labelled as generated fixture data in demos and docs.

By default, generated payloads are written to the static files repository
worktree:

```text
/Users/janerivi/prodev/@AgentLand/NASA_AMMOS_S100_ENGINE/s100-explorer/local/worktrees/S100ViewerStatic-static-assets/static/testdata/s104-fixtures/service
```

The library repository owns the generator and validation logic. The static files
repository owns generated JSON payloads and any future larger binary or derived
fixture assets.

Use an explicit output directory when the static files worktree is checked out
somewhere else:

```sh
S104_FIXTURE_OUTPUT_DIR=/path/to/static/testdata/s104-fixtures/service npm run fixtures:s104:generate
S104_FIXTURE_OUTPUT_DIR=/path/to/static/testdata/s104-fixtures/service npm run fixtures:s104:validate
```

Generated service paths:

- `/s104/catalog.json`
- `/s104/stavanger-spatial-phase-tide/metadata.json`
- `/s104/stavanger-spatial-phase-tide/data.json`

The first fixture is anchored to the Stavanger demo scene. It uses a regular
projected grid, nearest-neighbour semantics, time-varying scalar water levels,
spatial phase delay, and a small no-data region so sampler and UI behaviour can
be tested before a real S-104 service endpoint exists.
