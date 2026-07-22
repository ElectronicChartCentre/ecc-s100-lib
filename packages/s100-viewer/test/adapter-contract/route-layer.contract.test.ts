import { describe, expect, it } from "vitest";
import { LayerBuilder, RouteStyles } from "../../src/index.js";
import {
  sampleRouteDiagnostic,
  sampleRouteLayout,
  sampleRoutePlan,
  withInMemoryScene,
} from "./helpers.js";

describe("adapter contract: route layer", () => {
  it("exposes route plan, diagnostics, and style updates through the route controller", async () => {
    await withInMemoryScene(async (scene) => {
      const routePlan = sampleRoutePlan([sampleRouteDiagnostic("route-plan-warning")]);
      const layout = sampleRouteLayout(routePlan, [sampleRouteDiagnostic("layout-info", "info")]);
      const route = await scene.layers.add(
        LayerBuilder.createRoutePlan({
          id: "contract-route-layer",
          routePlan,
          layout,
          style: RouteStyles.s421Defaults(),
        }),
      );

      expect(route.controllers.route.getRoutePlan()).toBe(routePlan);
      expect(route.controllers.route.getDiagnostics().map((diagnostic) => diagnostic.code))
        .toEqual(["route-plan-warning", "layout-info"]);

      await route.controllers.route.setStyle({
        opacity: 0.5,
        showCorridor: false,
      });
      expect(route.spec.style).toMatchObject({
        opacity: 0.5,
        showCorridor: false,
      });

      await route.controllers.route.setHybrid3d(true);
      expect(route.spec.style).toMatchObject({
        visualization: "hybrid-3d",
        showRouteVolume: true,
        showRouteSides: true,
      });

      await route.controllers.route.setDebugGeometryVisible(true);
      expect(route.spec.style).toMatchObject({
        showTurnDebugGeometry: true,
      });

      await route.controllers.route.setHybrid3d(false);
      expect(route.spec.style).toMatchObject({
        visualization: "standard",
        showRouteVolume: false,
        showRouteSides: false,
      });
    });
  });
});
