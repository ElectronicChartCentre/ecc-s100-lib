import { describe, expect, it } from "vitest";
import { Coordinates, LayerBuilder } from "../../src/index.js";
import { projectedPosition, withInMemoryScene } from "./helpers.js";

describe("adapter contract: vessel coordinates", () => {
  it("returns CRS-aware vessel coordinates from the canonical vessel controller", async () => {
    await withInMemoryScene(async (scene) => {
      const vessel = await scene.layers.add(
        LayerBuilder.createVessel({
          id: "contract-vessel",
          url: "https://example.test/assets/vessel.glb",
          pose: {
            position: projectedPosition(500000, 7000000, 0),
            headingDegrees: 12,
          },
          dimensions: {
            draught: 8,
            bow: 40,
            stern: 30,
            port: 10,
            starboard: 12,
          },
          style: {
            showSeaLevelIndicator: true,
            transformControls: "translate",
          },
        }),
      );
      const vesselPositions: unknown[] = [];
      const vesselHeadings: number[] = [];
      vessel.controllers.vessel.onPositionChanged((position) => {
        vesselPositions.push(position);
      });
      vessel.controllers.vessel.onHeadingChanged((heading) => {
        vesselHeadings.push(heading);
      });

      await vessel.controllers.vessel.setPosition(projectedPosition(500010, 7000020, -3));
      await vessel.controllers.vessel.setHeading(725);
      await vessel.controllers.vessel.setSeaLevelIndicatorMode("off");
      await vessel.controllers.vessel.setOceanSurfaceVisible(true);
      await vessel.controllers.vessel.setTransformMode("rotate");

      const position = vessel.controllers.vessel.getPosition();
      expect(Coordinates.isProjected(position)).toBe(true);
      expect(position).toEqual(projectedPosition(500010, 7000020, -3));
      expect(vessel.controllers.vessel.getPose()).toMatchObject({
        position: projectedPosition(500010, 7000020, -3),
        headingDegrees: 5,
      });
      expect(vessel.controllers.vessel.getHeading()).toBe(5);
      expect(vesselPositions).toEqual([projectedPosition(500010, 7000020, -3)]);
      expect(vesselHeadings).toEqual([5]);
      expect(vessel.spec.pose.position).toEqual(projectedPosition(500010, 7000020, -3));
      expect(vessel.spec.style).toMatchObject({
        showSeaLevelIndicator: false,
        showOceanSurface: true,
        oceanSurface: true,
        transformControls: "rotate",
      });

      await vessel.controllers.vessel.setPose({
        position: projectedPosition(500020, 7000030, -4),
        headingDegrees: 185,
      });
      expect(vessel.controllers.vessel.getPosition()).toEqual(
        projectedPosition(500020, 7000030, -4),
      );
      expect(vessel.controllers.vessel.getHeading()).toBe(185);
    });
  });
});
