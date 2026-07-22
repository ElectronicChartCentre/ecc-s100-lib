import { describe, expect, it } from "vitest";
import { LayerBuilder } from "../../src/index.js";
import { sampleS111Data, withInMemoryScene } from "./helpers.js";

describe("adapter contract: S-111 style and time", () => {
  it("uses the canonical surface-current controller for time and scale", async () => {
    await withInMemoryScene(async (scene) => {
      const timeEvents: number[] = [];
      scene.time.onChanged((time) => timeEvents.push(time.getTime()));

      const currents = await scene.layers.add(
        LayerBuilder.createStaticS111({
          id: "contract-s111",
          data: sampleS111Data(),
          style: {
            renderer: "arrows",
            scale: "auto",
            vectorSpacingMeters: 100,
          },
        }),
      );

      expect(currents.controllers.surfaceCurrent.time.startTime).toBe(
        Date.parse("2026-05-29T12:00:00Z"),
      );
      expect(currents.controllers.surfaceCurrent.time.endTime).toBe(
        Date.parse("2026-05-29T14:00:00Z"),
      );
      expect(currents.controllers.surfaceCurrent.scalingMode).toBe("auto");

      await currents.controllers.surfaceCurrent.setCustomScale(2.5);
      expect(currents.controllers.surfaceCurrent.disableAutoScaling).toBe(true);
      expect(currents.controllers.surfaceCurrent.customScale).toBe(2.5);
      expect(currents.spec.style).toMatchObject({
        scale: 2.5,
      });

      currents.controllers.surfaceCurrent.setCurrentTime(
        Date.parse("2026-05-29T13:00:00Z"),
      );
      expect(scene.time.getCurrent().getTime()).toBe(Date.parse("2026-05-29T13:00:00Z"));
      expect(timeEvents.at(-1)).toBe(Date.parse("2026-05-29T13:00:00Z"));

      await currents.controllers.surfaceCurrent.setAutoScaling(true);
      expect(currents.controllers.surfaceCurrent.disableAutoScaling).toBe(false);
      expect(currents.controllers.surfaceCurrent.scalingMode).toBe("auto");
      expect(currents.spec.style).toMatchObject({
        scale: "auto",
      });
    });
  });
});
