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

describe("@ecc/s100-viewer-adapter-nasa-ammos layer mapping", () => {
  it("maps S-102 and simulated water-level specs to NASA-AMMOS native handles", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const scene = await viewer.createScene();

    const terrain = await scene.layers.add<S102BathymetryLayerSpec>({
      id: "s102",
      product: S100ProductType.S102,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
        crs: "EPSG:32633",
        metadata: {
          values: {
            heightSign: -1,
          },
        },
      },
      extensions: {
        nasaAmmos: {
          additionalURLParameters: "crs=EPSG:32633",
        },
      },
      style: {
        safetyDepthMeters: 7,
        contours: { visible: true, intervalMeters: 5 },
      },
    });

    const waterLevel = await scene.layers.add<SimulatedWaterLevelLayerSpec>({
      id: "simulated-water-level",
      product: "simulated-water-level",
      source: {
        kind: "static-json",
        data: {
          records: [
            { time: "2026-05-29T12:00:00Z", waterLevelMeters: 2.25 },
          ],
        },
      },
    });

    scene.time.setCurrent(new Date("2026-05-29T12:00:00Z"));

    const terrainNative = terrain.getNativeHandle<{
      kind: string;
      view: { dataset: { additionalURLParameters: string }; terrain: { heightSign: number } };
    }>();
    expect(terrainNative?.kind).toBe("terrain");
    expect(terrainNative?.view.dataset.additionalURLParameters).toBe("crs=EPSG:32633");
    expect(terrainNative?.view.terrain.heightSign).toBe(-1);
    expect(waterLevel.getNativeHandle<{ kind: string }>()?.kind).toBe("simulated-water-level");
    expect(scene.getSeaLevel()).toBe(2.25);

    await scene.layers.clear();
    await viewer.destroy();
  });

  it("maps ENC, S-111, and vessel specs to native NASA-AMMOS handles", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const scene = await viewer.createScene();

    const chart = await scene.layers.add<S101EncLayerSpec>({
      id: "s101",
      product: S100ProductType.S101,
      category: "enc",
      standard: S100ProductType.S101,
      role: "overlay",
      source: {
        kind: "wms",
        url: "https://example.test/wms",
        layers: ["s101"],
        crs: "EPSG:32633",
      },
      spatialExtent: {
        crs: "EPSG:32633",
        minX: 0,
        minY: 0,
        maxX: 1000,
        maxY: 1000,
      },
      style: {
        alphaMode: "binary",
        alphaCutoff: 0.02,
      },
    });

    const s57Chart = await scene.layers.add<S57EncLayerSpec>({
      id: "s57",
      product: "S-57",
      category: "enc",
      standard: "S-57",
      role: "basemap",
      source: {
        kind: "wms",
        url: "https://example.test/s57/wms",
        layers: ["s57"],
        crs: "EPSG:32633",
      },
      spatialExtent: {
        crs: "EPSG:32633",
        minX: 0,
        minY: 0,
        maxX: 1000,
        maxY: 1000,
      },
    });

    const currents = await scene.layers.add<S111SurfaceCurrentLayerSpec>({
      id: "s111",
      product: S100ProductType.S111,
      source: {
        kind: "static-json",
        data: {
          dateTimeOfFirstRecord: "2026-05-29T12:00:00Z",
          dateTimeOfLastRecord: "2026-05-29T13:00:00Z",
          timeRecordInterval: 3600,
          numberOfTimes: 2,
        },
      },
      style: {
        renderer: "arrows",
        scale: 2,
      },
    });

    const vesselBoundingBox = {
      min: [-15, -90, -40.2],
      max: [15, 100, 6.4],
    };
    const vesselOrientation = [0, 0, 0, 1];
    const vessel = await scene.layers.add<VesselLayerSpec>({
      id: "vessel",
      product: "vessel",
      source: {
        kind: "model",
        url: "/assets/vessel.glb",
        format: "glb",
      },
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
      style: {
        draughtMeters: 8,
        showSeaLevelIndicator: true,
        transformGizmo: {
          enabled: true,
          mode: "translate",
          verticalPositionLimits: {
            minMeters: -30,
            maxMeters: 8,
            reference: "sea-level",
          },
        },
      },
      dimensions: {
        draught: 8,
        bow: 40,
        stern: 30,
        port: 10,
        starboard: 12,
      },
      referencePoint: "transponder",
      extensions: {
        nasaAmmos: {
          seaSurfaceVisible: true,
          model: {
            boundingBox: vesselBoundingBox,
            orientation: vesselOrientation,
          },
        },
      },
    });

    const chartNative = chart.getNativeHandle<{
      kind: string;
      view: {
        specification: {
          alphaMode?: string;
          alphaCutoff?: number;
        };
      };
    }>();
    expect(chartNative?.kind).toBe("map");
    expect(chartNative?.view.specification).toMatchObject({
      alphaMode: "binary",
      alphaCutoff: 0.02,
    });
    expect(s57Chart.getNativeHandle<{ kind: string }>()?.kind).toBe("map");
    expect(currents.getNativeHandle<{ kind: string }>()?.kind).toBe("s111");
    const vesselNative = vessel.getNativeHandle<{
      kind: string;
      view: {
        specification: {
          dimensions?: unknown;
          verticalPositionLimits?: unknown;
          model: {
            boundingBox?: unknown;
            orientation?: unknown;
          };
        };
        seaLevelIndicator: {
          seaSurfaceVisible: boolean;
        };
      };
    }>();
    expect(vesselNative?.kind).toBe("vessel");
    expect(vesselNative?.view.specification.dimensions).toEqual({
      draught: 8,
      bow: 40,
      stern: 30,
      port: 10,
      starboard: 12,
    });
    expect(vesselNative?.view.specification.verticalPositionLimits).toEqual({
      minMeters: -30,
      maxMeters: 8,
      reference: "sea-level",
    });
    expect(vesselNative?.view.specification.model.boundingBox).toEqual(vesselBoundingBox);
    expect(vesselNative?.view.specification.model.orientation).toEqual(vesselOrientation);
    expect(vesselNative?.view.seaLevelIndicator.seaSurfaceVisible).toBe(true);

    await vessel.update({
      dimensions: {
        draught: 9,
        bow: 42,
        stern: 31,
        port: 11,
        starboard: 13,
      },
      extensions: {
        nasaAmmos: {
          seaSurfaceVisible: false,
        },
      },
    });
    expect(vesselNative?.view.specification.dimensions).toEqual({
      draught: 9,
      bow: 42,
      stern: 31,
      port: 11,
      starboard: 13,
    });
    expect(vesselNative?.view.seaLevelIndicator.seaSurfaceVisible).toBe(false);

    await scene.layers.clear();
    await viewer.destroy();
  });
});
