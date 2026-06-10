# @ecc/s100-viewer-products

Deprecated migration facade for product helpers now exported by
`@ecc/s100-viewer`.

Product layer specifications, service-ready source definitions, style helpers,
and `LayerBuilder` belong to `@ecc/s100-viewer` because they are fundamental to
normal S-100 viewer applications.

## Install

```sh
npm install @ecc/s100-viewer
```

## Example

```ts
import { LayerBuilder, type S102LayerSpec } from "@ecc/s100-viewer";

const s102: S102LayerSpec = LayerBuilder.createS102({
  url: "https://example.test/s102/tileset.json",
  crs: "EPSG:32619",
});

await scene.layers.add(s102);
```

Existing imports from `@ecc/s100-viewer-products` still work during migration,
but new application code should import from `@ecc/s100-viewer`.

`LayerBuilder` fills obvious product boilerplate: layer id, product type, source
kind, common role defaults, and default styles. Override only the details that
are meaningful for the application.

## Default Styles

```ts
LayerBuilder.S102Styles.DEFAULT;
LayerBuilder.S101Styles.DEFAULT;
LayerBuilder.S104Styles.DEFAULT;
LayerBuilder.S111Styles.DEFAULT;
LayerBuilder.VesselStyles.DEFAULT;
LayerBuilder.MapOverlayStyles.DEFAULT;
```

Low-level `defineS100LayerSpec(...)` remains available when an application needs
to spell out the full spec object.

## Supported Service-Ready Sources

- `3d-tiles`
- `wms`
- `wmts`
- `mvt`
- `rest-json`
- `static-json`
- `model`

Raw S-100 exchange-set parsing is intentionally outside the first package
readiness milestone.
