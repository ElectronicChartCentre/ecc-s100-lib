# Product Specs

Package: `@ecc/s100-viewer`

The core viewer package defines service-ready S-100 product specs. The current
package targets already-derived services:

- OGC 3D Tiles for S-102 bathymetry
- WMS/WMTS/MVT for ENC layers, including S-101 and S-57, plus map overlays
- REST or static JSON for simulated water-level layers and S-111
- GLB/GLTF model sources for vessels

Real S-104 water-level support is planned as a product data/sampler API, not as
an alias for the existing `simulated-water-level` helper. See
[S-104 water level architecture](../architecture/s104-water-level.md) for the
current implementation decision record.

## Layer Builder

```ts
import { LayerBuilder, type S102LayerSpec } from "@ecc/s100-viewer";
```

Use `LayerBuilder` for common product layers. It fills layer ids, product types,
source kinds, roles, default styles, and product-specification version policy.

```ts
const s102: S102LayerSpec = LayerBuilder.createS102({
  url: "https://example.test/s102/tileset.json",
  crs: "EPSG:32619",
});

await scene.layers.add(s102);
```

S-102 depth-facing API fields follow nautical chart convention: increasing
depth is positive downward from the active water surface or sea level. For
example, use `style.safetyDepthMeters: 8` or
`layer.controllers.terrain.setSafetyDepthMeters(8)` for an 8 metre safety-depth
threshold. Rendering adapters still keep their native world coordinates, such
as z-up elevation, and convert at the adapter boundary.

When a derived 3D Tiles service stores the terrain vertical coordinate itself as
positive bathymetric depth, include `sourceMetadata.values.heightSign: -1`.
Adapters use that source metadata to convert the sampled vertical value into
z-up elevation before applying safety-depth styling.

ENC helpers are split by standard:

```ts
LayerBuilder.createS101Wms({ url, layers: ["s100dataSets.101"] });
LayerBuilder.createS101Wmts({ url, layer: "s101", tileMatrixSet: "utm" });
LayerBuilder.createS57Wms({ url, layers: ["enc_cells"] });
LayerBuilder.createS57Wmts({ url, layer: "s57", tileMatrixSet: "utm" });
```

For application-style WMS URL templates, use the package-owned projected-map
helpers instead of carrying adapter-native map specifications in application
code:

```ts
import {
  ProjectedMapDiscardMode,
  ProjectedMapLayerType,
  mapSpecificationToLayerSpec,
} from "@ecc/s100-viewer";

const encLayer = mapSpecificationToLayerSpec({
  id: "s57WMS",
  type: ProjectedMapLayerType.Base,
  encStandard: "S-57",
  dataset: {
    mapSubset: { min: [0, 0], max: [1000, 1000] },
    extents: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    minLevel: 0,
    maxLevel: 10,
  },
  corners,
  urlTemplate: "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&SRS=EPSG:32633",
}, ProjectedMapDiscardMode.Transparent);
```

That produces a normal `EncLayerSpec` with `source.kind: "wms-template"`.
Adapters translate that source shape internally.

## Product Specification Versions

S-100 product type and product specification version are separate concepts. For
example, a layer may be product `S-111` while the service metadata says the
dataset follows `INT.IHO.S-111.1.0`.

The current library does not claim support for every IHO product specification
edition. Builders default to the latest version the implementation has
confirmed support for:

```ts
S100SupportedProductVersions;
S100ProductSpecificationVersions.LATEST_CONFIRMED_SUPPORTED;
LayerBuilder.ProductSpecificationVersions.S111.LATEST_CONFIRMED_SUPPORTED;
```

That default is emitted as:

```ts
productSpecificationVersion: "latest-confirmed-supported"
```

When a service exposes a concrete product specification identifier or edition,
pass it explicitly:

```ts
LayerBuilder.createS111({
  url: "https://example.test/s111/currents.json",
  productSpecificationVersion: "INT.IHO.S-111.1.0",
});
```

Future product-version-specific parsing, validation, styling, and adapter
capability checks should branch on `productSpecificationVersion`.

The library-level supported matrix is exported as `S100SupportedProductVersions`.
Adapters report their engine-specific subset through
`adapter.capabilities.supportedProductVersions`.

Default styles are available as static values:

```ts
LayerBuilder.S102Styles.DEFAULT;
LayerBuilder.S101Styles.DEFAULT;
LayerBuilder.S57Styles.DEFAULT;
LayerBuilder.SimulatedWaterLevelStyles.DEFAULT;
LayerBuilder.S111Styles.DEFAULT;
LayerBuilder.VesselStyles.DEFAULT;
LayerBuilder.MapOverlayStyles.DEFAULT;
```

`defineS100LayerSpec(...)` remains available as a low-level helper when an
application wants to spell out a complete spec object.

## Feature Entrypoints

The root package is still the canonical convenience import for viewer, scene,
math, and common layer APIs. Product-specific application code can use public
feature entrypoints to keep imports narrower:

```ts
import { SceneBuilder, createS100Viewer } from "@ecc/s100-viewer";
import { EncWmsSession } from "@ecc/s100-viewer/products/enc";
import { S102TerrainSession } from "@ecc/s100-viewer/products/s102";
import { S111SurfaceCurrentSession } from "@ecc/s100-viewer/products/s111";
import { RouteFeatureSession } from "@ecc/s100-viewer/products/route";
import { VesselFeatureSession } from "@ecc/s100-viewer/products/vessel";
```

Public product entrypoints:

- `@ecc/s100-viewer/products`
- `@ecc/s100-viewer/products/enc`
- `@ecc/s100-viewer/products/s102`
- `@ecc/s100-viewer/products/s111`
- `@ecc/s100-viewer/products/route`
- `@ecc/s100-viewer/products/vessel`
- `@ecc/s100-viewer/products/simulated-water-level`

The planned real S-104 entrypoint is `@ecc/s100-viewer/products/s104`. It should
be added only when the sampler/workflow implementation starts; until then,
`simulated-water-level` remains a non-IHO operational helper product.

## Feature Sessions

Feature sessions are the recommended high-level API for app integrations that
want less orchestration code than raw `LayerBuilder` calls. They keep the
primitive scene/layer/controller APIs available, but own common mechanics such
as lifecycle cleanup, layer replacement, visibility, status, timeline, and
interaction constraints.

For a runnable copy-pasteable app-neutral workflow that wires the feature
sessions together, see
[`examples/getting-started`](../../examples/getting-started).

```ts
import { PrimarServices } from "@ecc/s100-viewer/products";
import {
  EncWmsSession,
  resolveEncWmsAvailability,
} from "@ecc/s100-viewer/products/enc";
import { S102TerrainSession } from "@ecc/s100-viewer/products/s102";
import { S111SurfaceCurrentSession } from "@ecc/s100-viewer/products/s111";
import { VesselFeatureSession } from "@ecc/s100-viewer/products/vessel";
```

S-102 terrain:

```ts
const terrain = S102TerrainSession.create({
  scene,
  crs: "EPSG:32633",
  source: PrimarServices.s102Tiles({
    endpoint: "https://example.test/s102",
    apiKey,
  }),
  rendering: {
    detailFactor: 500,
  },
  style: {
    safetyDepthMeters: 8,
    contours: {
      visible: true,
      intervalMeters: 5,
    },
  },
  replacement: {
    oldLayerRemovalDelayMs: 500,
  },
});

await terrain.setDatasetIds(["NO5F001"]);
await terrain.updateDisplayStyle({ safetyDepthMeters: 10 });
await terrain.dispose();
```

S-111 surface currents:

```ts
const currents = await S111SurfaceCurrentSession.load({
  scene,
  datasets: [{
    id: "NO_S111_SAMPLE",
    bounds: {
      latLon: bounds,
    },
  }],
  crs: "EPSG:32633",
  service: PrimarServices.s111({
    endpoint: "https://example.test/s111",
    licenseeKey,
  }),
  projection: {
    projectBounds,
  },
  limits: {
    maxDataPoints: 100000,
  },
  style: {
    renderer: "arrows",
    scale: "auto",
  },
});

currents.setCurrentTime(Date.now());
await currents.setVisibleDatasetIds(["NO_S111_SAMPLE"]);
await currents.dispose();
```

ENC WMS:

```ts
const availability = await resolveEncWmsAvailability({
  bounds: sceneBounds,
  licenseeKey,
  service: PrimarServices.encAvailability({
    getLicensedProductsWithinBounds,
    getValidProductTypes,
    getS57WithinBounds,
  }),
});

const enc = await EncWmsSession.create({
  scene,
  standards: {
    "S-101": PrimarServices.s101EncWms({
      licenseeKey,
      center,
      widthMeters: 10000,
      wmsBaseUrl,
      pixelRatio: window.devicePixelRatio,
    }),
    "S-57": PrimarServices.s57EncWms({
      licenseeKey,
      center,
      widthMeters: 10000,
      wmsBaseUrl,
      wmsTemplatePath,
      customStyleId,
      opaqueStyleId,
      includeOpaqueLayer: true,
    }),
  },
  availability,
  preference: ["S-101", "S-57"],
  visible: true,
  opacity: 0.7,
});

await enc.setPreferredStandard("S-57");
await enc.setOpacity(0.75);
await enc.setOpacityAnimated(0.95, {
  from: "current",
  durationMs: 250,
  easing: "ease-out",
});
await enc.setVisible(false);
await enc.dispose();
```

`setOpacity(...)` applies directly and is the default choice for application
state updates. `setOpacityAnimated(...)` is opt-in for consumers that want a
session-owned transition with cancellation on direct opacity updates, active
standard changes, or disposal.

Vessel feature:

```ts
const vessel = await VesselFeatureSession.add({
  scene,
  url: "/models/demo-vessel.glb",
  pose: {
    position,
    headingDegrees: 90,
  },
  dimensions: {
    draught: 5,
    bow: 50,
    stern: 50,
    port: 10,
    starboard: 10,
  },
  constraints: {
    vertical: {
      minMeters: -75,
      maxMeters: "draught",
      reference: "sea-level",
    },
  },
  onPoseChanged: (pose) => {
    savePose(pose);
  },
});

await vessel.setTransformMode("translate");
await vessel.dispose();
```

Sessions are app-neutral. They do not know about Vue, Pinia, Explorer scenario
models, or PRIMAR authentication flows. Apps still own state persistence, UI
text, service credentials, and request functions; provider helpers can own
provider-specific defaults and response interpretation.

## Core Product Specs

- `EncLayerSpec`
- `S101EncLayerSpec`
- `S57EncLayerSpec`
- `S102BathymetryLayerSpec`
- `S111SurfaceCurrentLayerSpec`
- `SimulatedWaterLevelLayerSpec`
- `VesselLayerSpec`
- `MapOverlayLayerSpec`

`EncLayerSpec` captures common Electronic Nautical Chart behavior across
standards. `S101EncLayerSpec` is the IHO S-100 ENC product and carries
`productSpecificationVersion`; `S57EncLayerSpec` is the legacy ENC standard and
keeps S-57-specific display options separate from future S-101 portrayal
controls. Common source handling stays under `category: "enc"` and
`standard: "S-101" | "S-57"`.

`VesselLayerSpec` carries vessel geometry semantics directly through
`dimensions` (`bow`, `stern`, `port`, `starboard`, `draught`) and
`referencePoint`. The distances are expressed relative to the vessel reference
point, typically the transponder/mast reference used by operational workflows.

Short aliases are also exported:

- `S101LayerSpec`
- `S102LayerSpec`
- `S111LayerSpec`

## Source Kinds

- `3d-tiles`
- `wms`
- `wms-template`
- `wmts`
- `mvt`
- `rest-json`
- `static-json`
- `model`
