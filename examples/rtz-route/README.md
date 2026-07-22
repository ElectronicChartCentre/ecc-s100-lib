# RTZ Route Demo

Focused runnable example for RTZ route rendering through `@ecc/s100-viewer`.

```sh
npm run demo:rtz-route
npm run build:demo:rtz-route
```

Copy `.env.example` to `.env.local` to enable S-102 bathymetry beneath the
route volume. The route demo defaults to `EPSG:32632` and a Bergen-centered
origin for the bundled sample route; use `VITE_RTZ_ROUTE_CRS` and the origin
variables when testing RTZ files over a different S-102 dataset. The demo also
recognizes the `VITE_DEMO_*` and `VITE_REFERENCE_*` S-102/scene variables used
by the other examples when copied into this demo's `.env.local`.

The built-in sample route is generated around the configured projected origin
so it can sit over the configured S-102 dataset. The checked-in RTZ fixture is
kept as a static fallback/reference route.

Minimal route loading shape:

```ts
const routes = RouteFeatureSession.create({ scene });

await routes.addRtz({
  id: "pilot-route",
  source: { kind: "url", url: "/routes/pilot-route.rtz" },
});
```

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

The demo keeps RTZ parsing, waypoint defaults, unit conversion, XTD layout,
corridor geometry, route volume layout, adapter object creation, and cleanup in
the library. The app supplies route source and presentation intent.
