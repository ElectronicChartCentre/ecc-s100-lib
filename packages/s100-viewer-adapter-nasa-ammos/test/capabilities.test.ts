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

describe("@ecc/s100-viewer-adapter-nasa-ammos capabilities", () => {
  it("declares projected-local NASA-AMMOS MVP capabilities", () => {
    const adapter = createNasaAmmosAdapter();

    expect(adapter.id).toBe("nasa-ammos");
    expect(nasaAmmosAdapterCapabilities.sceneGeoreferences).toContain("projected-local");
    expect(nasaAmmosAdapterCapabilities.layerProducts).toContain("S-102");
    expect(nasaAmmosAdapterCapabilities.layerProducts).toContain("route-plan");
    expect(nasaAmmosAdapterCapabilities.dataSources).toContain("parametric-vessel");
    expect(nasaAmmosAdapterCapabilities.dataSources).toContain("route-plan");
    expect(nasaAmmosAdapterCapabilities.waterLevelField).toBe("sampled");
    expect(nasaAmmosAdapterCapabilities.waterLevelTerrainShading).toBe("per-position");
    expect(nasaAmmosAdapterCapabilities.supportedProductVersions).toEqual(
      S100SupportedProductVersions,
    );
  });

  it("creates a NASA-AMMOS-backed projected-local scene without a DOM container", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const viewerHandles = viewer.getEngineHandles();

    expect(viewerHandles).toMatchObject({
      adapterId: "nasa-ammos",
      engineName: "NASA-AMMOS / Three.js",
      instances: {
        viewer: expect.any(Object),
      },
      resources: {
        threeDocs: "https://threejs.org/docs/",
      },
    });

    const scene = await viewer.createScene({
      georeference: {
        mode: "projected-local",
        crs: "EPSG:32633",
        origin: {
          kind: "projected",
          x: 500000,
          y: 7000000,
          z: 0,
          crs: "EPSG:32633",
        },
        upAxis: "z",
        units: "meters",
      },
    });

    scene.setSeaLevel(1.5);
    scene.camera.setPose({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      focalDistance: 10,
    });

    expect(scene.getSeaLevel()).toBe(1.5);
    expect(scene.camera.getPose().position).toEqual({ x: 1, y: 2, z: 3 });
    expect(scene.getEngineHandles()).toMatchObject({
      adapterId: "nasa-ammos",
      instances: {
        viewerScene: expect.any(Object),
        cameraNavigation: expect.any(Object),
      },
      staticObjects: {
        THREE: expect.any(Object),
      },
    });

    await viewer.destroy();
  });
});
