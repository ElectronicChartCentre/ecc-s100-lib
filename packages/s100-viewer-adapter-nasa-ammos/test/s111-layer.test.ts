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

describe("@ecc/s100-viewer-adapter-nasa-ammos s111 layer", () => {
  it("rebases S-111 overlays and applies auto scaling in projected-local scenes", () => {
    const threeScene = new Scene();
    const overlay = new SeaCurrentsOverlay(
      {
        id: "s111-auto",
        dateTimeOfFirstRecord: "2026-05-29T12:00:00Z",
        timeRecordInterval: 3600,
        positions: [
          [500000, 7000000],
          [500100, 7000000],
        ],
        data: [{ speed: [1, 1], direction: [90, 90] }],
      },
      threeScene,
      {
        autoScaling: true,
        originOffset: [-500000, -7000000, 0],
      },
    );

    const fillGeometry = (overlay as unknown as {
      fillGeometry: { getAttribute(name: string): { array: ArrayLike<number> } };
    }).fillGeometry;

    expect(overlay.group.position).toMatchObject({ x: 50, y: 0, z: 0 });
    expect(fillGeometry.getAttribute("instancePosition").array[2]).toBeCloseTo(100);

    overlay.dispose();
  });
});
