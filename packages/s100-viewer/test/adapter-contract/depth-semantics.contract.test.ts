import { describe, expect, it } from "vitest";
import { LayerBuilder } from "../../src/index.js";
import { withInMemoryScene } from "./helpers.js";

describe("adapter contract: depth semantics", () => {
  it("keeps S-102 safety depth positive in nautical metres", async () => {
    await withInMemoryScene(async (scene) => {
      const terrain = await scene.layers.add(
        LayerBuilder.createS102({
          id: "contract-s102-depth",
          url: "https://example.test/s102/tileset.json",
          crs: "EPSG:32633",
          style: {
            safetyDepthMeters: 2,
            contours: {
              visible: false,
              intervalMeters: 5,
            },
          },
        }),
      );

      await terrain.controllers.terrain.setSafetyDepthMeters(8);
      await terrain.controllers.terrain.setContours({
        visible: true,
        intervalMeters: 3,
      });
      await terrain.controllers.terrain.setDetailFactor(700);
      await terrain.controllers.terrain.setTileBoundsVisible(true);

      expect(terrain.controllers.terrain.terrain.safetyDepthMeters).toBe(8);
      expect(terrain.controllers.terrain.terrain.showContour).toBe(true);
      expect(terrain.controllers.terrain.terrain.contourInterval).toBe(3);
      expect(terrain.controllers.terrain.settings.detailFactor).toBe(700);
      expect(terrain.controllers.terrain.settings.renderBBoxes).toBe(true);
      expect(terrain.spec.style).toMatchObject({
        safetyDepthMeters: 8,
        contours: {
          visible: true,
          intervalMeters: 3,
        },
      });
      expect(terrain.spec.rendering).toMatchObject({
        detailFactor: 700,
      });
      expect(terrain.spec.debug).toMatchObject({
        showTileBounds: true,
      });
      expect(terrain.spec.style?.unsafeDepth).toBeUndefined();
    });
  });

  it("normalizes the legacy unsafeDepth patch into canonical safetyDepthMeters", async () => {
    await withInMemoryScene(async (scene) => {
      const terrain = await scene.layers.add(
        LayerBuilder.createS102({
          id: "contract-s102-legacy-depth",
          url: "https://example.test/s102/tileset.json",
          style: {
            unsafeDepth: -6,
          },
        }),
      );

      expect(terrain.controllers.terrain.terrain.safetyDepthMeters).toBe(6);
      expect(terrain.spec.style?.unsafeDepth).toBeUndefined();

      await terrain.controllers.terrain.updateDisplayStyle({
        unsafeDepth: -4,
      });

      expect(terrain.controllers.terrain.terrain.safetyDepthMeters).toBe(4);
      expect(terrain.spec.style?.safetyDepthMeters).toBe(4);
      expect(terrain.spec.style?.unsafeDepth).toBeUndefined();
    });
  });
});
