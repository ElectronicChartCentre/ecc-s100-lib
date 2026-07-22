import { describe, expect, it, vi } from "vitest";
import {
  assertServiceReadyLayerSpec,
  isServiceReadySource,
  LayerBuilder,
  RoutePlanProductType,
  RouteStyles,
  type RoutePlan,
  type RoutePlanLayerSpec,
} from "../../src/index.js";
import type { S100Unsubscribe } from "../../src/events/S100EventBus.js";
import { createLayerControllers } from "../../src/layers/controllers.js";
import type { S100Layer } from "../../src/layers/types.js";

describe("route plan builders", () => {
  it("creates route-plan layers with S-421 default portrayal", () => {
    const routePlan = sampleRoutePlan();
    const spec = LayerBuilder.createRoutePlan({
      routePlan,
      style: {
        opacity: 0.5,
        showCorridor: false,
      },
    });

    expect(spec).toMatchObject({
      id: "rtz-route",
      product: RoutePlanProductType.RoutePlan,
      source: {
        kind: "route-plan",
        routePlan,
        layout: {
          routeId: "rtz-route",
          sourceFormat: "rtz",
        },
      },
      style: {
        ...RouteStyles.s421Defaults(),
        opacity: 0.5,
        showCorridor: false,
      },
    });
    expect(isServiceReadySource(spec.source)).toBe(true);
    expect(() => assertServiceReadyLayerSpec(spec)).not.toThrow();
  });

  it("provides explicit hybrid and debug 3D style presets", () => {
    expect(RouteStyles.s421Hybrid3d()).toMatchObject({
      portrayal: "s421",
      visualization: "hybrid-3d",
      showRouteVolume: true,
      showRouteSides: true,
      showTurnDebugGeometry: false,
    });
    expect(RouteStyles.routeDebug3d({ showRouteVolume: false })).toMatchObject({
      portrayal: "s421",
      visualization: "debug-3d",
      showRouteVolume: false,
      showRouteSides: true,
      showTurnDebugGeometry: true,
    });
  });

  it("adds a route controller for route-plan layers", async () => {
    const routePlan = sampleRoutePlan();
    const layer = createRouteLayer(LayerBuilder.createRoutePlan({ routePlan }));

    expect(layer.controllers.route.getRoutePlan()).toBe(routePlan);
    expect(layer.controllers.route.getDiagnostics()).toEqual([]);

    await layer.controllers.route.setHybrid3d(true);
    await layer.controllers.route.setDebugGeometryVisible(true);

    expect(layer.update).toHaveBeenCalledWith({
      style: expect.objectContaining({
        visualization: "hybrid-3d",
        showRouteVolume: true,
        showRouteSides: true,
      }),
    });
    expect(layer.update).toHaveBeenCalledWith({
      style: expect.objectContaining({
        showTurnDebugGeometry: true,
      }),
    });
  });
});

const sampleRoutePlan = (): RoutePlan => ({
  id: "rtz-route",
  sourceFormat: "rtz",
  sourceVersion: "1.2",
  routeInfo: {
    name: "RTZ route",
    routeName: "RTZ route",
    values: {
      routeName: "RTZ route",
    },
  },
  waypoints: [
    {
      id: "1",
      revision: "1",
      position: { lon: 5, lat: 60 },
      extensions: [],
    },
    {
      id: "2",
      revision: "1",
      position: { lon: 5.1, lat: 60.1 },
      extensions: [],
    },
  ],
  legs: [
    {
      id: "1:2",
      fromWaypointId: "1",
      toWaypointId: "2",
      geometryType: "loxodrome",
      extensions: [],
    },
  ],
  schedules: [],
  extensions: [],
  diagnostics: [],
});

const createRouteLayer = (
  spec: RoutePlanLayerSpec,
): S100Layer<RoutePlanLayerSpec> => {
  const layer = {
    id: spec.id,
    product: spec.product,
    spec,
    controllers: {} as S100Layer<RoutePlanLayerSpec>["controllers"],
    nativeHandle: null,
    visible: true,
    opacity: 1,
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    getNativeHandle: () => null,
    onChanged: vi.fn((): S100Unsubscribe => () => {}),
  } satisfies S100Layer<RoutePlanLayerSpec>;
  return {
    ...layer,
    controllers: createLayerControllers(layer),
  };
};
