import { describe, expect, it } from "vitest";
import { Scene, type Object3D } from "three";
import {
  buildRoutePlanLayout,
  Coordinates,
  createS104WaterLevelSampler,
  createS100Viewer,
  decodeS104Dataset,
  LayerBuilder,
  parseRtzRoute,
  RouteStyles,
  S100DataCodingFormat,
  S100ProductType,
  S100SupportedProductVersions,
  SceneBuilder,
} from "@ecc/s100-viewer";
import type {
  S101EncLayerSpec,
  S57EncLayerSpec,
  S102BathymetryLayerSpec,
  S111SurfaceCurrentLayerSpec,
  RoutePlanLayerSpec,
  SimulatedWaterLevelLayerSpec,
  S104WaterLevelData,
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

  it("propagates S-104 water-level grids to S-102 terrain shader uniforms", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32631",
        origin: { x: 0, y: 0, z: 0 },
      }),
    });
    scene.time.setCurrent(new Date("2026-07-26T00:00:00Z"));

    const terrain = await scene.layers.add<S102BathymetryLayerSpec>({
      id: "s102-s104-grid",
      product: S100ProductType.S102,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
        crs: "EPSG:32631",
        metadata: {
          values: {
            heightSign: -1,
          },
        },
      },
    });

    scene.waterLevel.setSampler(
      createS104WaterLevelSampler({ datasets: decodedS104Fixture() }),
    );

    const native = terrain.getNativeHandle<{
      kind: string;
      waterLevelGridKey?: string | null;
      view: {
        materialController: {
          uniforms: {
            waterLevelGridEnabled: { value: number };
            waterLevelGridWidth: { value: number };
            waterLevelGridHeight: { value: number };
            waterLevelGridTexture: {
              value: {
                image: {
                  width: number;
                  height: number;
                  data: Float32Array;
                };
              };
            };
          };
        };
      };
    }>();

    expect(native?.kind).toBe("terrain");
    expect(native?.waterLevelGridKey).toContain("fixture:0:");
    expect(native?.view.materialController.uniforms.waterLevelGridEnabled.value).toBe(1);
    expect(native?.view.materialController.uniforms.waterLevelGridWidth.value).toBe(2);
    expect(native?.view.materialController.uniforms.waterLevelGridHeight.value).toBe(2);
    expect(
      native?.view.materialController.uniforms.waterLevelGridTexture.value.image.data[0],
    ).toBeCloseTo(0.1);

    scene.time.setCurrent(new Date("2026-07-26T00:10:00Z"));

    expect(native?.waterLevelGridKey).toContain("fixture:1:");
    expect(
      native?.view.materialController.uniforms.waterLevelGridTexture.value.image.data[0],
    ).toBeCloseTo(1.1);

    await scene.layers.clear();
    await viewer.destroy();
  });

  it("exposes transformed vessel positions in scene projected coordinates", async () => {
    const viewer = await createS100Viewer({
      adapter: createNasaAmmosAdapter(),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32633",
        origin: { x: 500000, y: 7000000, z: 0 },
      }),
    });
    const vessel = await scene.layers.add<VesselLayerSpec>({
      id: "local-origin-vessel",
      product: "vessel",
      source: {
        kind: "model",
        url: "/assets/vessel.glb",
        format: "glb",
      },
      pose: {
        position: Coordinates.projected({
          crs: "EPSG:32633",
          x: 500010,
          y: 7000020,
          z: -3,
        }),
        headingDegrees: 35,
      },
      style: {
        transformGizmo: {
          enabled: true,
          mode: "translate",
        },
      },
      dimensions: {
        draught: 8,
        bow: 40,
        stern: 30,
        port: 10,
        starboard: 12,
      },
    });

    const emittedPositions: unknown[] = [];
    vessel.controllers.vessel.onPositionChanged((position) => {
      emittedPositions.push(position);
    });

    const native = vessel.getNativeHandle<{
      view: {
        positionChanged: {
          emit(position: [number, number, number]): void;
        };
      };
      getPosition(): [number, number, number];
    }>();
    expect(native?.getPosition()).toEqual([500010, 7000020, -3]);

    native?.view.positionChanged.emit([15, 25, -4]);

    expect(emittedPositions).toEqual([
      Coordinates.projected({
        crs: "EPSG:32633",
        x: 500015,
        y: 7000025,
        z: -4,
      }),
    ]);

    await scene.layers.clear();
    await viewer.destroy();
  });
});

const decodedS104Fixture = () => {
  const result = decodeS104Dataset({
    datasetId: "fixture",
    metadata: {
      product: "S-104",
      productSpecificationVersion: "generated-test-fixture",
      numberOfInstances: 1,
      dataCodingFormat: { value: S100DataCodingFormat.RegularGrid },
      interpolationType: "nearestneighbor",
      instanceAttributes: [s104Grid()],
    },
    data: s104Dataset(),
  });
  if (result.status === "error") {
    throw new Error(result.message);
  }
  return result.dataset;
};

const s104Grid = () => ({
  datasetId: "fixture",
  numberOfTimes: 2,
  timeRecordInterval: 600,
  dateTimeOfFirstRecord: "20260726T000000Z",
  dateTimeOfLastRecord: "20260726T001000Z",
  numPointsLongitudinal: 2,
  numPointsLatitudinal: 2,
  origin: { x: 0, y: 0, crs: "EPSG:32631" },
  offsetVectors: {
    longitudinal: [10, 0] as const,
    latitudinal: [0, 10] as const,
  },
  dataOffsetCode: "lower-left" as const,
  verticalDatum: "MSL",
});

const s104Dataset = (): S104WaterLevelData => ({
  id: "fixture",
  product: "S-104",
  productSpecificationVersion: "generated-test-fixture",
  dateTimeOfFirstRecord: "20260726T000000Z",
  dateTimeOfLastRecord: "20260726T001000Z",
  timeRecordInterval: 600,
  numberOfTimes: 2,
  grid: s104Grid(),
  values: [
    {
      timePoint: "20260726T000000Z",
      waterLevelHeight: [0.1, 0.2, 0.3, 0.4],
    },
    {
      timePoint: "20260726T001000Z",
      waterLevelHeight: [1.1, 1.2, 1.3, 1.4],
    },
  ],
});
