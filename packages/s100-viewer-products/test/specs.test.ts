import { describe, expect, it } from "vitest";
import { LayerBuilder, S100ProductSpecificationVersions, S100ProductType } from "../src/index.js";

describe("@ecc/s100-viewer-products compatibility facade", () => {
  it("re-exports product builders from @ecc/s100-viewer", () => {
    const spec = LayerBuilder.createS102({
      url: "https://example.test/s102/tileset.json",
      crs: "EPSG:32633",
    });

    expect(spec.product).toBe(S100ProductType.S102);
    expect(spec.productSpecificationVersion).toBe(
      S100ProductSpecificationVersions.S102.LATEST_CONFIRMED_SUPPORTED,
    );
    expect(spec.source.kind).toBe("3d-tiles");
    expect(spec.style).toEqual(LayerBuilder.S102Styles.DEFAULT);
  });
});
