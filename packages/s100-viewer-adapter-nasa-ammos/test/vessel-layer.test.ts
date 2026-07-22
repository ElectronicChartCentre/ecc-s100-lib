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
import { SeaCurrentsOverlay } from "../src/runtime/compat/sea-currents.js";
import {
  routePrimitiveKinds,
  sampleRtz,
  type RouteNativeHandle,
} from "./fixtures/routeFixtures.js";

describe("@ecc/s100-viewer-adapter-nasa-ammos vessel layer", () => {
  it("maps parametric vessel specs to procedural NASA-AMMOS model objects", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const scene = await viewer.createScene();

    const vessel = await scene.layers.add<VesselLayerSpec>(
      LayerBuilder.createParametricVessel({
        id: "parametric-vessel",
        title: "Parametric vessel",
        pose: {
          position: {
            kind: "projected",
            x: 100,
            y: 200,
            z: 0,
            crs: "EPSG:32633",
          },
          headingDegrees: 35,
        },
        parametric: {
          dimensions: {
            draught: 6,
            bow: 102,
            stern: 18,
            port: 12,
            starboard: 12,
            hullHeightMeters: 10,
          },
        },
      }),
    );

    const native = vessel.getNativeHandle<{
      kind: string;
      view: {
        specification: {
          model: {
            path: string;
            object?: () => Object3D;
            boundingBox?: unknown;
          };
        };
      };
    }>();
    const model = native?.view.specification.model;
    const object = model?.object?.();
    const bow = object?.children.find(
      (child) =>
        child.userData.s100ParametricVesselPart?.role === "hull-bow",
    );
    const deck = object?.children.find(
      (child) =>
        child.userData.s100ParametricVesselPart?.role === "main-deck",
    );

    expect(native?.kind).toBe("vessel");
    expect(model?.path).toBe("parametric-vessel:parametric-vessel");
    expect(model?.boundingBox).toBeUndefined();
    expect(typeof model?.object).toBe("function");
    expect(object?.children.map((child) => child.name)).toContain(
      "s100-parametric-vessel-part:hull-bow",
    );
    expect(object?.children.map((child) => child.name)).toContain(
      "s100-parametric-vessel-part:main-deck",
    );
    expect(bow?.userData.s100ParametricVesselPart).toMatchObject({
      geometry: "wedge",
      role: "hull-bow",
    });
    expect(deck?.userData.s100ParametricVesselPart).toMatchObject({
      geometry: "deck-outline",
      role: "main-deck",
    });

    await scene.layers.clear();
    await viewer.destroy();
  });
});
