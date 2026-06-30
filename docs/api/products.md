# Product Specs

Package: `@ecc/s100-viewer`

The core viewer package defines service-ready S-100 product specs. The current
package targets already-derived services:

- OGC 3D Tiles for S-102 bathymetry
- WMS/WMTS/MVT for ENC layers, including S-101 and S-57, plus map overlays
- REST or static JSON for simulated water-level layers and S-111
- GLB/GLTF model sources for vessels

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
