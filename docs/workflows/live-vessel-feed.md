# Live AIS Vessel Feed Workflow

Use this workflow when an application receives AIS-like vessel reports and wants
the library to manage vessel creation, updates, selection style, stale removal,
and cleanup.

The current runnable example is the `Live AIS Norway` recipe in
[`examples/engine-adapter-switcher`](../../examples/engine-adapter-switcher).

## Import Path

```ts
import {
  createLiveVesselFeedLayer,
  type LiveAisVessel,
} from "@ecc/s100-viewer/products/vessel";
```

## Data Model

`LiveAisVessel` is an app-facing normalized AIS shape:

```ts
const vessel: LiveAisVessel = {
  source: "barentswatch-live-ais",
  mmsi: 257000000,
  name: "Example Vessel",
  position: {
    kind: "geodetic",
    crs: "EPSG:4326",
    longitude: 5.72,
    latitude: 58.99,
  },
  headingDegrees: 35,
  speedOverGroundKnots: 8.5,
  dimensionsMeters: {
    bow: 80,
    stern: 20,
    port: 10,
    starboard: 10,
  },
  messageTime: new Date().toISOString(),
};
```

The library maps each vessel to a `VesselFeatureSession`. When no model URL is
provided, the vessel feed uses parametric vessel geometry derived from AIS
dimensions and ship type.

## Minimal Session

```ts
const feed = await createLiveVesselFeedLayer({
  scene,
  id: "live-ais",
  stalePolicy: {
    maxAgeSeconds: 300,
    removeMissing: true,
  },
  positionMapper: (vessel) => projectLiveAisVesselToScene(vessel),
});

await feed.updateVessels(vessels);
await feed.selectVessel(257000000);
await feed.dispose();
```

Use `positionMapper` when the scene is projected-local. It should convert the
incoming geodetic vessel position into the scene CRS.

## Proxy Boundary

Do not put provider secrets in a Vite/frontend `.env.local`. The engine switcher
uses `VITE_AIS_PROXY_URL` for a frontend-safe proxy URL. Backend-only credentials
belong in the AIS proxy service.

Relevant demo files:

- `examples/engine-adapter-switcher/src/liveAisDemo.ts`
- `examples/engine-adapter-switcher/src/sceneRecipes.ts`
- `examples/engine-adapter-switcher/.env.example`

## Runtime Controls

The returned controller supports:

```ts
await feed.updateVessels(vessels);
await feed.removeVessels([257000000]);
await feed.clear();
await feed.setStalePolicy({ maxAgeSeconds: 120 });
await feed.selectVessel(257000000);

const selected = feed.getVessel(257000000);
const count = feed.getVesselCount();
await feed.dispose();
```

## Failure Modes

- Missing proxy URL: the app can still load the scene and report that live AIS
  is not configured.
- Stale messages: vessels older than `maxAgeSeconds` are ignored or removed.
- Unsupported CRS: provide a `positionMapper` that supports the scene CRS.
- Provider outage: keep polling and status reporting in app code; keep vessel
  rendering state in the feed controller.

## Validation

```sh
npm run check:demo:engine-switcher
npm run build:demo:engine-switcher
```

