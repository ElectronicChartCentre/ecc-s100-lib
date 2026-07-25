# RTZ Route Demo

Focused runnable example for RTZ route rendering through `@ecc/s100-viewer`.

For the application-facing API guide, see
[`docs/workflows/rtz-route.md`](../../docs/workflows/rtz-route.md).

```sh
npm run demo:rtz-route
npm run build:demo:rtz-route
```

Copy `.env.example` to `.env.local` to enable S-102 bathymetry beneath the
route. The route demo defaults to `EPSG:32632` and a Bergen-centered origin for
the bundled sample route; use `VITE_RTZ_ROUTE_CRS` and the origin variables
when testing RTZ files over a different S-102 dataset. The demo also recognizes
the `VITE_DEMO_*` and `VITE_REFERENCE_*` S-102/scene variables used by the other
examples when copied into this demo's `.env.local`.

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

Hybrid 3D route portrayal is opt-in through route style. The 3D route geometry
uses COGS-inspired safety-depth side walls and caps that depth-test against the
loaded S-102 terrain; it does not sample or drape itself onto the S-102 mesh.
The demo opens with side walls enabled and the full below-depth volume disabled
so the route remains readable over bathymetry. Enable the full depth volume
toggle when inspecting the complete safety-depth extrusion.

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

The demo keeps RTZ parsing, waypoint defaults, unit conversion, turn-radius
sampling, XTD layout, split port/starboard corridor geometry, route side-wall
layout, adapter object creation, and cleanup in the library. The app supplies
route source and presentation intent.
