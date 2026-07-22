import { describe, expect, it } from "vitest";
import { Scene, type Object3D } from "three";
import {
  buildRoutePlanLayout,
  createS100Viewer,
  LayerBuilder,
  parseRtzRoute,
  RouteStyles,
  S100ProductType,
  S100SupportedProductVersions,
} from "@ecc/s100-viewer";
import type {
  S101EncLayerSpec,
  S57EncLayerSpec,
  S102BathymetryLayerSpec,
  S111SurfaceCurrentLayerSpec,
  RoutePlanLayerSpec,
  SimulatedWaterLevelLayerSpec,
  VesselLayerSpec,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter, nasaAmmosAdapterCapabilities } from "../src/index.js";
import { SeaCurrentsOverlay } from "../src/runtime/s111/SeaCurrentsOverlay.js";
import {
  routePrimitiveKinds,
  sampleRtz,
  type RouteNativeHandle,
} from "./fixtures/routeFixtures.js";

describe("@ecc/s100-viewer-adapter-nasa-ammos route layer", () => {
  it("maps standard route-plan specs to NASA-AMMOS route objects", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const scene = await viewer.createScene();
    const routePlan = parseRtzRoute(sampleRtz, { id: "pilot-route" });
    const layout = buildRoutePlanLayout(routePlan);

    const route = await scene.layers.add<RoutePlanLayerSpec>(
      LayerBuilder.createRoutePlan({
        id: "pilot-route",
        routePlan,
        layout,
        opacity: 0.8,
        style: RouteStyles.s421Defaults(),
      }),
    );

    const native = route.getNativeHandle<RouteNativeHandle>();
    expect(native?.kind).toBe("route-plan");
    expect(native?.view.attached).toBe(false);
    expect(routePrimitiveKinds(native?.view.root)).toEqual(expect.arrayContaining([
      "centerline",
      "corridor",
      "waypoint",
      "xtd-boundary",
    ]));
    expect(routePrimitiveKinds(native?.view.root)).not.toContain("route-volume");
    expect(routePrimitiveKinds(native?.view.root)).not.toContain("debug");

    await route.update({ visible: false, opacity: 0.25 });
    expect(native?.view.root.visible).toBe(false);

    await scene.layers.clear();
    expect(native?.view.root.children).toHaveLength(0);
    await viewer.destroy();
  });

  it("renders hybrid 3D route volume and rebuilds debug geometry on style changes", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const scene = await viewer.createScene();
    const routePlan = parseRtzRoute(sampleRtz, { id: "hybrid-route" });
    const layout = buildRoutePlanLayout(routePlan, {
      includeRouteVolume: true,
      includeTurnDebugGeometry: true,
      turnDebugSegments: 8,
    });

    const route = await scene.layers.add<RoutePlanLayerSpec>(
      LayerBuilder.createRoutePlan({
        id: "hybrid-route",
        routePlan,
        layout,
        style: RouteStyles.s421Hybrid3d(),
      }),
    );
    const native = route.getNativeHandle<RouteNativeHandle>();
    const originalChildren = new Set(native?.view.root.children ?? []);

    expect(routePrimitiveKinds(native?.view.root)).toContain("route-volume");
    expect(routePrimitiveKinds(native?.view.root)).not.toContain("debug");

    await route.controllers.route.setDebugGeometryVisible(true);
    expect(routePrimitiveKinds(native?.view.root)).toContain("debug");
    expect([...(native?.view.root.children ?? [])].some((child) => originalChildren.has(child))).toBe(false);

    await route.controllers.route.setHybrid3d(false);
    expect(routePrimitiveKinds(native?.view.root)).not.toContain("route-volume");

    await scene.layers.clear();
    await viewer.destroy();
  });
});
