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
