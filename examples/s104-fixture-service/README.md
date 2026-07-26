# S-104 Fixture Service

Thin localhost service for generated S-104-shaped fixture payloads. It is meant
for demo and manual workflow testing until a real S-104 service endpoint exists.

The service has no viewer-engine dependency. It reads generated payloads from
the static files repository by default:

```text
/Users/janerivi/prodev/@AgentLand/NASA_AMMOS_S100_ENGINE/s100-explorer/local/worktrees/S100ViewerStatic-static-assets/static/testdata/s104-fixtures/service
```

Generate or refresh the payloads first:

```sh
npm run fixtures:s104:generate
npm run fixtures:s104:validate
```

Start the service:

```sh
npm run demo:s104-fixture-service
```

Default endpoint:

```text
http://127.0.0.1:8794
```

Supported routes:

- `GET /health`
- `GET /s104/catalog.json`
- `GET /s104/{datasetId}/metadata.json?crs=EPSG:32631`
- `GET /s104/{datasetId}/data.json?crs=EPSG:32631`

Configuration:

```sh
S104_FIXTURE_SERVICE_HOST=127.0.0.1
S104_FIXTURE_SERVICE_PORT=8794
S104_FIXTURE_ROOT=/path/to/static/testdata/s104-fixtures/service
S104_FIXTURE_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

If `S104_FIXTURE_ROOT` is omitted, the service uses the same static-files
worktree default as the generator. If that worktree is not present, it falls
back to `local/generated/s104-fixtures/service` under `ecc-s100-lib`.
