# RTZ Route Workflow

Use this workflow when an application needs to load, parse, and portray RTZ
routes with engine-neutral S-100 viewer APIs.

The runnable example is [`examples/rtz-route`](../../examples/rtz-route).

## Import Path

```ts
import {
  RouteFeatureSession,
  RouteStyles,
  parseRtzRoute,
} from "@ecc/s100-viewer/products/route";
```

## Minimal Route

```ts
const routes = RouteFeatureSession.create({ scene });

await routes.addRtz({
  id: "pilot-route",
  source: {
    kind: "url",
    url: "/routes/pilot-route.rtz",
  },
});
```

Use a file source for uploaded routes:

```ts
await routes.addRtz({
  id: "uploaded-route",
  source: {
    kind: "file",
    file,
  },
});
```

## Hybrid 3D Portrayal

Hybrid 3D route portrayal is opt-in through route style:

```ts
await routes.addRtz({
  id: "pilot-route-3d",
  source: { kind: "file", file },
  style: RouteStyles.s421Hybrid3d({
    showRouteVolume: true,
    showRouteSides: true,
    showTurnDebugGeometry: false,
  }),
});
```

The library owns RTZ parsing, waypoint defaults, unit conversion, turn-radius
sampling, XTD layout, corridor geometry, side-wall layout, adapter layer specs,
and cleanup. The app supplies route source and presentation intent.

## Diagnostics

Use parser or route-session diagnostics when accepting user-provided RTZ files.
Treat malformed XML, missing waypoints, unsupported units, and impossible route
geometry as user-facing validation problems rather than renderer failures.

## Failure Modes

- Route appears away from bathymetry: verify scene CRS and route projection.
- Hybrid volume hides details: start with side walls only, then enable full
  route volume for inspection.
- Uploaded RTZ fails: show parser diagnostics and keep the existing route.

## Validation

```sh
npm run check:demo:rtz-route
npm run build:demo:rtz-route
```
