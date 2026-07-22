import { describe, expect, it } from "vitest";
import { CameraControlPresets, createS100Viewer, LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
import {
  cesiumAdapterCapabilities,
  createCesiumAdapter,
} from "../src/index.js";
import {
  createMockCesium,
  createMockContainer,
  dispatchScreenSpace,
} from "./fixtures/mockCesium.js";

describe("@ecc/s100-viewer-adapter-cesium picking", () => {
  it("returns projected-local pick coordinates instead of raw Cesium world coordinates", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });

    cesium.operations.pickResult = { primitive: {} };
    cesium.operations.pickPositionResult = {
      frame: "enu",
      x: 25,
      y: 40,
      z: -12,
    };

    const result = await scene.picking.pick({
      screenX: 40,
      screenY: 60,
      includeNative: true,
    });

    expect(result?.source).toBe("geometry");
    expect(result?.world).toEqual({
      kind: "projected",
      crs: "EPSG:32619",
      x: 331125,
      y: 5186460,
      z: -12,
    });
    expect(result?.geodetic).toMatchObject({
      kind: "geodetic",
      datum: "WGS84",
      height: -12,
    });
    expect((result?.geodetic as { lon?: number } | undefined)?.lon).toBeGreaterThan(-80);
    expect((result?.geodetic as { lon?: number } | undefined)?.lon).toBeLessThan(-60);
    expect((result?.geodetic as { lat?: number } | undefined)?.lat).toBeGreaterThan(40);
    expect((result?.geodetic as { lat?: number } | undefined)?.lat).toBeLessThan(55);
    expect(result?.native).toMatchObject({
      world: { frame: "enu", x: 25, y: 40, z: -12 },
    });

    await viewer.destroy();
  });

  it("renders hover prisms in the projected-local scene frame", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });

    scene.showHoverPrism({
      topLeft: [331100, 5187420],
      topRight: [332100, 5187420],
      bottomLeft: [331100, 5186420],
      bottomRight: [332100, 5186420],
    }, -100, 101, { r: 0.3, g: 0.75, b: 1, a: 0.24 });

    const prismFill = cesium.operations.primitivesAdded.find((value) =>
      Boolean((value as { options?: { appearance?: { options?: { flat?: boolean } } } }).options?.appearance?.options?.flat),
    ) as {
      options?: {
        geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } };
      };
    };
    expect(Array.from(prismFill?.options?.geometryInstances?.geometry?.attributes?.position?.values ?? [])).toEqual([
      0, 1000, 1,
      1000, 1000, 1,
      1000, 0, 1,
      0, 0, 1,
    ]);
    const prismOutline = cesium.operations.primitivesAdded.find((value) =>
      Boolean((value as { polylines?: unknown[] }).polylines),
    ) as { polylines?: Array<{ positions?: unknown[]; depthFailMaterial?: unknown }> };
    expect(prismOutline?.polylines).toHaveLength(12);
    expect(prismOutline?.polylines?.[0]?.positions).toEqual([
      expect.objectContaining({ frame: "enu", x: 0, y: 1000, z: 1 }),
      expect.objectContaining({ frame: "enu", x: 1000, y: 1000, z: 1 }),
    ]);
    expect(prismOutline?.polylines?.[0]).toHaveProperty("depthFailMaterial");

    scene.clearHoverPrism();

    expect(cesium.operations.primitivesAdded).toHaveLength(0);
    await viewer.destroy();
  });
});
