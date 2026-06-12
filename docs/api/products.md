# Product Specs

Package: `@ecc/s100-viewer`

The core viewer package defines service-ready S-100 product specs. The current
package targets already-derived services:

- OGC 3D Tiles for S-102 bathymetry
- WMS/WMTS/MVT for S-101 and map overlays
- REST or static JSON for S-104 and S-111
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
LayerBuilder.S104Styles.DEFAULT;
LayerBuilder.S111Styles.DEFAULT;
LayerBuilder.VesselStyles.DEFAULT;
LayerBuilder.MapOverlayStyles.DEFAULT;
```

`defineS100LayerSpec(...)` remains available as a low-level helper when an
application wants to spell out a complete spec object.

## Core Product Specs

- `S101EncLayerSpec`
- `S102BathymetryLayerSpec`
- `S104WaterLevelLayerSpec`
- `S111SurfaceCurrentLayerSpec`
- `VesselLayerSpec`
- `MapOverlayLayerSpec`

Short aliases are also exported:

- `S101LayerSpec`
- `S102LayerSpec`
- `S104LayerSpec`
- `S111LayerSpec`

## Source Kinds

- `3d-tiles`
- `wms`
- `wmts`
- `mvt`
- `rest-json`
- `static-json`
- `model`
