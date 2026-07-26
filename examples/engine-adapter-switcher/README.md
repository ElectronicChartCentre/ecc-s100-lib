# S-100 Engine Adapter Switcher

Private workspace demo for exercising the public `@ecc/s100-viewer` package
against NASA-AMMOS, Cesium, and the experimental plain Three.js reference
adapter.

For a zero-knowledge, step-by-step learning path through S-100 concepts, the
public API, this demo's source structure, and first adapter-authoring steps,
start with the
[engine switcher practical guide](../../docs/learn/engine-switcher-practical-guide.md).

## Local Configuration

Copy `.env.example` to `.env.local` and fill in the local PRIMAR credentials
and dataset ids. The service variables intentionally match S-100 Explorer names
where the demo uses the same endpoint:

```sh
cp examples/engine-adapter-switcher/.env.example examples/engine-adapter-switcher/.env.local
npm run demo:engine-switcher
```

Required for service-backed recipes:

- `VITE_S111_PRIMAR_API_KEY`: Explorer-compatible key name used by the S-102
  3D Tiles endpoint.
- `VITE_DEMO_LICENSEE_KEY`: licensee key used by S-101 WMS and S-111 service
  requests. The Minimal Scene also uses S-101 WMS as its basemap.
- `VITE_PRIMAR_WMS_URL_BASE`: ENC WMS endpoint used by the Minimal Scene and
  S-101 ENC recipe.
- `VITE_DEMO_S101_WMS_STYLE_ID` and `VITE_DEMO_S101_WMS_BASEMAP_STYLE_ID`:
  optional S-101 portrayal style names. The PRIMAR S-101 layer currently uses
  `transparentLand` for overlay-style use and `default` for basemaps.
- `VITE_DEMO_S102_DATASET_IDS`: comma-separated S-102 dataset ids.
- `VITE_DEMO_S111_DATASET_IDS`: comma-separated S-111 dataset ids.

Optional for the `Live AIS Norway` recipe:

- `VITE_AIS_PROXY_URL`: frontend-safe URL for the local or deployed ECC AIS
  proxy, for example `http://localhost:8787`.
- `VITE_AIS_REFRESH_INTERVAL_MS`: polling interval. Values below 30000 are
  clamped to 30000.
- `VITE_AIS_MAX_VESSELS`: maximum number of vessels requested from the proxy.
- `VITE_AIS_MAX_AGE_SECONDS`: optional freshness filter for AIS messages.
- `VITE_DEMO_LIVE_AIS_S102_DATASET_IDS`: optional override for the Stavanger
  S-102 terrain datasets. By default the recipe uses
  `102NO006J0811_10_U`, `102NO006T0711_40_U`, `102NO006T0711_30_U`, and
  `102NO006J0811_20_U`.
- `VITE_DEMO_LIVE_AIS_S101_ENABLED`: optional S-101 WMS basemap for the live
  AIS scene. It defaults to `false` so the demo remains terrain-first and a
  bad WMS style cannot mask the S-102 terrain as an opaque black plane.

Optional for future S-104 water-level scenes:

- `VITE_S104_FIXTURE_SERVICE_URL`: local generated S-104 fixture service URL,
  for example `http://localhost:8794`.

For local live AIS testing, start the proxy from the super-repo root:

```sh
cd services/ecc-ais-proxy-instance
npm run dev
```

The proxy reads backend-only BarentsWatch credentials from `.env.local` in its
repo or a parent directory. Do not expose `BW_CLIENT_ID` or
`BW_AIS_CLIENT_SECRET` through this Vite demo's `.env.local`.

The demo keeps static local assets under `public/demo-assets`:

- `vessel/panama-tanker-origin-at-transponder.glb`: higher-detail tanker model
  copied from the S100 Explorer vessel assets.
- `environment/demo-environment.json`: skybox and lighting state applied to
  each scene.
- `environment/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr`: the same
  HDRI used by the S100 Explorer NASA-AMMOS view.
- `environment/skybox/*.png`: small cubemap faces used by Cesium, whose skybox
  loader expects browser-decodable image faces rather than HDR input.

During local Vite development, remote S-102 3D Tiles requests are routed through
`/demo-proxy/s102-tiles` to avoid browser-origin restrictions. A hosted/static
copy of this demo still needs S-102 endpoints that allow the deployed origin, or
an equivalent application proxy.

The `Three.js Reference` engine option uses
`@ecc/s100-viewer-adapter-three`. That adapter is intentionally smaller than the
NASA-AMMOS renderer and exists to demonstrate adapter-authoring against the
canonical public API. It should be useful for maintainers, but it is not yet a
release-target adapter.

## Commands

```sh
npm run build:adapter-three
npm run check:adapter-three
npm run test:adapter-three
npm run check:demo:engine-switcher
npm run build:demo:engine-switcher
npm run demo:engine-switcher
```
