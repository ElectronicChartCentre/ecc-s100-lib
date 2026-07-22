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

describe("@ecc/s100-viewer-adapter-cesium s111 layer", () => {
  it("binds simulated water level and creates S-111 arrow entities", async () => {
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

    await scene.layers.add(
      LayerBuilder.createStaticSimulatedWaterLevel({
        data: {
          records: [
            { time: "2026-01-01T00:00:00Z", waterLevelMeters: 1.2 },
            { time: "2026-01-01T01:00:00Z", waterLevelMeters: 2.4 },
          ],
        },
      }),
    );
    scene.time.setCurrent(new Date("2026-01-01T01:00:00Z"));
    expect(scene.getSeaLevel()).toBe(2.4);

    await scene.layers.add(
      LayerBuilder.createStaticS111({
        crs: "EPSG:32619",
        data: {
          dateTimeOfFirstRecord: "20260101T000000Z",
          timeRecordInterval: 3600,
          positions: [
            [331100, 5186420],
            [331200, 5186520],
          ],
          data: [{ speed: [0.5, 1], direction: [90, 180] }],
        },
      }),
    );

    const currentFills = cesium.operations.primitivesAdded.filter((value) =>
      Boolean((value as { options?: { geometryInstances?: { options?: { attributes?: { color?: unknown } } } } }).options?.geometryInstances?.options?.attributes?.color),
    ) as Array<{
      options?: {
        geometryInstances?: {
          geometry?: { attributes?: { position?: { values?: Float64Array } }; indices?: Uint16Array };
          options?: { attributes?: { color?: { color?: { r?: number; g?: number; b?: number; a?: number } } } };
        };
      };
    }>;
    expect(currentFills).toHaveLength(3);
    const currentOutline = currentFills.find((primitive) =>
      primitive.options?.geometryInstances?.options?.attributes?.color?.color?.r === 0 &&
      primitive.options?.geometryInstances?.options?.attributes?.color?.color?.g === 0 &&
      primitive.options?.geometryInstances?.options?.attributes?.color?.color?.b === 0,
    );
    const coloredFills = currentFills.filter((primitive) => primitive !== currentOutline);
    expect(Array.from(coloredFills[0]?.options?.geometryInstances?.geometry?.indices ?? [])).toEqual([
      0, 1, 6, 2, 3, 4, 2, 4, 5,
    ]);
    expect(coloredFills[0]?.options?.geometryInstances?.geometry?.attributes?.position?.values?.[2]).toBe(3.42);
    expect(currentOutline?.options?.geometryInstances?.geometry?.attributes?.position?.values?.[2]).toBe(3.4);
    const coloredPositionValues = coloredFills[0]?.options?.geometryInstances?.geometry?.attributes?.position?.values;
    const outlinePositionValues = currentOutline?.options?.geometryInstances?.geometry?.attributes?.position?.values;
    expect(outlinePositionValues?.[3]).toBeLessThan(coloredPositionValues?.[3] ?? 0);
    expect((outlinePositionValues?.[4] ?? 0) - (coloredPositionValues?.[4] ?? 0)).toBeGreaterThan(0.45);
    expect(currentOutline?.options?.geometryInstances?.options?.attributes?.color?.color).toEqual(
      expect.objectContaining({ r: 0, g: 0, b: 0, a: 1 }),
    );
    expect(coloredFills[0]?.options?.geometryInstances?.options?.attributes?.color?.color).toEqual(
      expect.objectContaining({ r: 0x76 / 255, g: 0x52 / 255, b: 0xe2 / 255, a: 1 }),
    );
    expect(coloredFills[1]?.options?.geometryInstances?.options?.attributes?.color?.color).toEqual(
      expect.objectContaining({ r: 0x48 / 255, g: 0x98 / 255, b: 0xd3 / 255, a: 1 }),
    );
    expect(cesium.operations.primitivesAdded.some((value) =>
      Boolean((value as { polylines?: unknown[] }).polylines),
    )).toBe(false);
    await viewer.destroy();
  });

  it("applies S-111 visibility patches when rebuilding current arrows", async () => {
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

    const layer = await scene.layers.add(
      LayerBuilder.createStaticS111({
        crs: "EPSG:32619",
        visible: false,
        data: {
          positions: [[331100, 5186420]],
          data: [{ speed: [0.5], direction: [90] }],
        },
      }),
    );

    expect(cesium.operations.primitivesAdded).toHaveLength(2);
    expect(cesium.operations.primitivesAdded.every((value) => (value as { show?: boolean }).show === false)).toBe(true);

    await layer.update({ visible: true });

    expect(cesium.operations.primitivesAdded).toHaveLength(2);
    expect(cesium.operations.primitivesAdded.every((value) => (value as { show?: boolean }).show === true)).toBe(true);
    await viewer.destroy();
  });

  it("uses explicit S-111 scale consistently across datasets with different spacing", async () => {
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

    await scene.layers.add(
      LayerBuilder.createStaticS111({
        id: "coarse-current",
        crs: "EPSG:32619",
        style: { scale: 250 },
        data: {
          positions: [
            [331100, 5186420],
            [331500, 5186420],
          ],
          data: [{ speed: [1, 1], direction: [90, 90] }],
        },
      }),
    );
    await scene.layers.add(
      LayerBuilder.createStaticS111({
        id: "dense-current",
        crs: "EPSG:32619",
        style: { scale: 250 },
        data: {
          positions: [
            [332000, 5186420],
            [332050, 5186420],
          ],
          data: [{ speed: [1, 1], direction: [90, 90] }],
        },
      }),
    );

    const coloredFills = cesium.operations.primitivesAdded.filter((value) => {
      const color = (value as {
        options?: { geometryInstances?: { options?: { attributes?: { color?: { color?: { r?: number; g?: number; b?: number } } } } } };
      }).options?.geometryInstances?.options?.attributes?.color?.color;
      return color && !(color.r === 0 && color.g === 0 && color.b === 0);
    }) as Array<{
      options?: {
        geometryInstances?: {
          geometry?: { attributes?: { position?: { values?: Float64Array } } };
        };
      };
    }>;
    const arrowSpans = coloredFills.slice(-2).map((primitive) => {
      const values = primitive.options?.geometryInstances?.geometry?.attributes?.position?.values ?? new Float64Array();
      const xs: number[] = [];
      for (let index = 0; index < Math.min(values.length, 7 * 3); index += 3) {
        xs.push(values[index] ?? 0);
      }
      return Math.max(...xs) - Math.min(...xs);
    });

    expect(arrowSpans).toHaveLength(2);
    expect(arrowSpans[0]).toBeCloseTo(61.25);
    expect(arrowSpans[1]).toBeCloseTo(61.25);
    await viewer.destroy();
  });

  it("extracts S-111 arrows from uppercase asset-style current payloads", async () => {
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
    scene.time.setCurrent(new Date("2026-01-01T00:00:00Z"));

    await scene.layers.add(
      LayerBuilder.createStaticS111({
        crs: "EPSG:32619",
        data: {
          FirstRecordTimestamp: Date.parse("2026-01-01T00:00:00Z"),
          Positions: [
            [331100, 5186420],
            [331200, 5186520],
          ],
          Data: [
            {
              Timestamp: Date.parse("2026-01-01T00:00:00Z"),
              Speed: [0.5, 1],
              Direction: [90, 180],
            },
          ],
        },
      }),
    );

    const currentGlyphPrimitives = cesium.operations.primitivesAdded.filter((value) =>
      Boolean((value as { options?: { geometryInstances?: unknown } }).options?.geometryInstances),
    );
    expect(currentGlyphPrimitives).toHaveLength(3);
    await viewer.destroy();
  });

  it("falls back to a finite S-111 arrow scale when callers pass invalid scale values", async () => {
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

    await scene.layers.add(
      LayerBuilder.createStaticS111({
        crs: "EPSG:32619",
        style: {
          scale: Number.NaN,
        },
        data: {
          positions: [[331100, 5186420]],
          data: [{ speed: [0.5], direction: [90] }],
        },
      }),
    );

    const positions = cesium.operations.primitivesAdded.flatMap((primitive) => {
      const values = (primitive as {
        options?: { geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } } };
        polylines?: Array<{ positions?: Array<{ x?: number; y?: number; z?: number }> }>;
      }).options?.geometryInstances?.geometry?.attributes?.position?.values;
      if (values) {
        const out: Array<{ x: number; y: number; z: number }> = [];
        for (let index = 0; index < values.length; index += 3) {
          out.push({ x: values[index] ?? 0, y: values[index + 1] ?? 0, z: values[index + 2] ?? 0 });
        }
        return out;
      }
      return (primitive as { polylines?: Array<{ positions?: Array<{ x?: number; y?: number; z?: number }> }> })
        .polylines?.flatMap((polyline) => polyline.positions ?? []) ?? [];
    });
    expect(positions.every((position) =>
      Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z),
    )).toBe(true);
    await viewer.destroy();
  });
});
