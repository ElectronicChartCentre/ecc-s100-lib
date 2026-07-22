import { describe, expect, it } from "vitest";
import {
  EncStandard,
  LayerBuilder,
  ProjectedMapDiscardMode,
  ProjectedMapLayerType,
} from "../../src/index.js";
import { projectedExtent, withInMemoryScene } from "./helpers.js";

describe("adapter contract: ENC transparency", () => {
  it("keeps transparent S-101 layers explicit in the canonical layer spec", async () => {
    await withInMemoryScene(async (scene) => {
      const enc = await scene.layers.add(
        LayerBuilder.createS101WmsTemplate({
          id: "contract-transparent-s101",
          urlTemplate: "https://example.test/s101/{z}/{x}/{y}.png",
          role: "overlay",
          extents: projectedExtent(),
          opacity: 0.72,
          discardMode: ProjectedMapDiscardMode.MaskLayerAlphaOne,
          style: {
            alphaMode: "binary",
            alphaCutoff: 0.01,
            cutout: {
              enabled: true,
            },
          },
        }),
      );

      expect(enc.spec.role).toBe("overlay");
      expect(enc.spec.source.kind).toBe("wms-template");
      expect(enc.spec.projectedMap?.type).toBe(ProjectedMapLayerType.BaseTransparent);
      expect(enc.spec.style).toMatchObject({
        alphaMode: "binary",
        alphaCutoff: 0.01,
        cutout: {
          enabled: true,
        },
      });
      expect(enc.controllers.map.discardMode).toBe(ProjectedMapDiscardMode.MaskLayerAlphaOne);

      await enc.controllers.map.setAlpha(0.45);
      expect(enc.controllers.map.alpha).toBe(0.45);
      expect(enc.opacity).toBe(0.45);
    });
  });

  it("builds explicit opaque and transparent ENC WMS pairs", () => {
    const pair = LayerBuilder.createEncWmsPair({
      standard: EncStandard.S101,
      center: {
        x: 500000,
        y: 7000000,
      },
      widthMeters: 2000,
      crs: "EPSG:32633",
      transparent: {
        id: "contract-s101-transparent",
        urlTemplate: "https://example.test/s101/transparent/{z}/{x}/{y}.png",
        opacity: 0.72,
      },
      opaque: {
        id: "contract-s101-opaque",
        urlTemplate: "https://example.test/s101/opaque/{z}/{x}/{y}.png",
        opacity: 1,
      },
    });

    expect(pair.transparent.role).toBe("overlay");
    expect(pair.transparent.projectedMap?.type).toBe(
      ProjectedMapLayerType.BaseTransparent,
    );
    expect(pair.opaque?.role).toBe("basemap");
    expect(pair.opaque?.projectedMap?.type).toBe(ProjectedMapLayerType.Base);
  });
});
