# S-100 Reference App

This is the canonical runnable example for integrating `ecc-s100-lib` feature
sessions in a browser application.

It intentionally keeps application concerns outside the library:

- viewer and scene lifecycle;
- service credentials and endpoints;
- app-owned availability request functions;
- UI controls;
- event logging;
- session disposal.

The reusable product orchestration stays in the library sessions:

- `S102TerrainSession`
- `S111SurfaceCurrentSession`
- `EncWmsSession`
- `VesselFeatureSession`

## Run

```sh
cp examples/reference-app/.env.example examples/reference-app/.env.local
npm run demo:reference
```

Without service configuration, the app still creates the viewer and reports the
missing session inputs. Once `.env.local` contains dataset IDs, endpoints, and
keys, the Load button creates the S-102, S-111, ENC, and vessel sessions.

`.env.example` is the tracked template. `.env.local` is ignored by git and is
where local service endpoints, credentials, and scenario-specific dataset IDs
belong.

## Validate

```sh
npm run check:demo:reference
npm run build:demo:reference
```

## Relationship To Getting Started

The lightweight app in `examples/getting-started` is the succinct API
ergonomics benchmark. This app is the fuller integration benchmark: same session
API, plus realistic lifecycle, configuration, controls, logging, shared demo
assets, vessel setup, and teardown.
