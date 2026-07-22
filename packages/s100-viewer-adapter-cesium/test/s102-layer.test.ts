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

describe("@ecc/s100-viewer-adapter-cesium s102 layer", () => {
  it("creates Cesium 3D Tiles and WMS layers", async () => {
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
      LayerBuilder.createS102({
        url: "https://example.test/s102/tileset.json",
        crs: "EPSG:4978",
        sourceFrame: "ecef",
      }),
    );
    await scene.layers.add(
      LayerBuilder.createS102({
        id: "s102-legacy",
        url: "https://example.test/s102",
        crs: "EPSG:32619",
        extensions: {
          cesium: {
            failedTileRetryInitialDelayMs: 0,
            failedTileRetryJitterRatio: 0,
          },
        },
      }),
    );
    await scene.layers.add(
      LayerBuilder.createS101Wms({
        url: "https://example.test/wms",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 331100,
          minY: 5186420,
          maxX: 332100,
          maxY: 5187420,
        },
      }),
    );

    expect(cesium.operations.primitivesAdded).toHaveLength(3);
    expect((cesium.operations.primitivesAdded[0] as { url?: string }).url).toBe(
      "https://example.test/s102/tileset.json",
    );
    expect((cesium.operations.primitivesAdded[0] as { options?: { modelMatrix?: unknown } }).options?.modelMatrix)
      .toBeUndefined();
    expect((cesium.operations.primitivesAdded[1] as { url?: string }).url).toBe(
      "https://example.test/s102/tileset.json?crs=EPSG%3A32619",
    );
    expect((cesium.operations.primitivesAdded[1] as { options?: { modelMatrix?: unknown } }).options?.modelMatrix)
      .toMatchObject({ kind: "multiply" });
    expect((cesium.operations.primitivesAdded[1] as { root?: { refine?: unknown; children?: Array<{ refine?: unknown }> } }).root)
      .toMatchObject({
        refine: 1,
        children: [expect.objectContaining({ refine: 1 })],
      });
    expect(
      (cesium.operations.primitivesAdded[1] as {
        options?: {
          cullWithChildrenBounds?: unknown;
          cullRequestsWhileMoving?: unknown;
          cullRequestsWhileMovingMultiplier?: unknown;
          dynamicScreenSpaceError?: unknown;
          foveatedScreenSpaceError?: unknown;
          progressiveResolutionHeightFraction?: unknown;
          skipLevelOfDetail?: unknown;
          baseScreenSpaceError?: unknown;
          skipScreenSpaceErrorFactor?: unknown;
          skipLevels?: unknown;
          loadSiblings?: unknown;
          immediatelyLoadDesiredLevelOfDetail?: unknown;
          preferLeaves?: unknown;
          preloadFlightDestinations?: unknown;
          cacheBytes?: unknown;
          maximumCacheOverflowBytes?: unknown;
          maximumScreenSpaceError?: unknown;
          maximumMemoryUsage?: unknown;
        };
      }).options,
    ).toMatchObject({
      cullWithChildrenBounds: false,
      cullRequestsWhileMoving: false,
      cullRequestsWhileMovingMultiplier: 0,
      dynamicScreenSpaceError: false,
      foveatedScreenSpaceError: false,
      progressiveResolutionHeightFraction: 0,
      skipLevelOfDetail: false,
      baseScreenSpaceError: 1024,
      skipScreenSpaceErrorFactor: 16,
      skipLevels: 1,
      loadSiblings: true,
      immediatelyLoadDesiredLevelOfDetail: true,
      preferLeaves: true,
      preloadFlightDestinations: false,
      cacheBytes: 768 * 1024 * 1024,
      maximumCacheOverflowBytes: 768 * 1024 * 1024,
      maximumScreenSpaceError: 0.25,
      maximumMemoryUsage: 768,
    });
    expect((cesium.operations.primitivesAdded[1] as { customShader?: { options?: unknown } }).customShader?.options)
      .toMatchObject({
        varyings: {
          v_s102Height: "float",
        },
        uniforms: {
          u_s102ShowContours: { value: true },
          u_s102HeightAxis: { value: 1 },
          u_s102HeightSign: { value: 1 },
          u_s102UseProjectedLocalWorldHeight: { value: true },
          u_s102WorldToProjectedLocal: { type: "mat4" },
        },
      });
    expect(
      ((cesium.operations.primitivesAdded[1] as {
        customShader?: { options?: { vertexShaderText?: string } };
      }).customShader?.options?.vertexShaderText ?? ""),
    ).toContain("u_s102WorldToProjectedLocal * czm_model");
    const projectedTileset = cesium.operations.primitivesAdded[1] as {
      root?: { children?: Array<{ refine?: unknown; parent?: unknown; children?: unknown[] }> };
      _selectedTiles?: unknown[];
      _selectedTilesToStyle?: unknown[];
      getTraversal?: (...args: unknown[]) => { selectTiles?: (tileset: unknown, frameState: unknown) => unknown };
    };
    const lateChild = { refine: 0, parent: projectedTileset.root, children: [] };
    projectedTileset.root?.children?.push(lateChild);
    projectedTileset._selectedTiles = [projectedTileset.root, lateChild];
    projectedTileset._selectedTilesToStyle = [projectedTileset.root, lateChild];
    projectedTileset.getTraversal?.({})?.selectTiles?.(projectedTileset, {});
    expect(lateChild.refine).toBe(1);
    expect(projectedTileset._selectedTiles).toEqual([lateChild]);
    expect(projectedTileset._selectedTilesToStyle).toEqual([lateChild]);
    const failedChild = {
      refine: 0,
      parent: projectedTileset.root,
      children: [],
      _contentState: 5,
      unloadContent() {
        this._contentState = 0;
      },
    };
    projectedTileset.root?.children?.push(failedChild);
    projectedTileset.getTraversal?.({})?.selectTiles?.(projectedTileset, {});
    expect(failedChild._contentState).toBe(0);
    const overlappingCoarseTile = {
      refine: 1,
      children: [],
      geometricError: 64,
      boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 100 },
    };
    const overlappingFineTileA = {
      refine: 1,
      children: [],
      geometricError: 16,
      boundingSphere: { center: { x: -35, y: 0, z: 0 }, radius: 45 },
    };
    const overlappingFineTileB = {
      refine: 1,
      children: [],
      geometricError: 16,
      boundingSphere: { center: { x: 35, y: 0, z: 0 }, radius: 45 },
    };
    projectedTileset._selectedTiles = [overlappingCoarseTile, overlappingFineTileA, overlappingFineTileB];
    projectedTileset._selectedTilesToStyle = [overlappingCoarseTile, overlappingFineTileA, overlappingFineTileB];
    projectedTileset.getTraversal?.({})?.selectTiles?.(projectedTileset, {});
    expect(projectedTileset._selectedTiles).toEqual([overlappingFineTileA, overlappingFineTileB]);
    expect(projectedTileset._selectedTilesToStyle).toEqual([overlappingFineTileA, overlappingFineTileB]);
    const sparseCoarseTile = {
      refine: 1,
      children: [],
      geometricError: 64,
      boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 120 },
    };
    const sparseFineTile = {
      refine: 1,
      children: [],
      geometricError: 16,
      boundingSphere: { center: { x: -30, y: 0, z: 0 }, radius: 25 },
    };
    projectedTileset._selectedTiles = [sparseCoarseTile, sparseFineTile];
    projectedTileset._selectedTilesToStyle = [sparseCoarseTile, sparseFineTile];
    projectedTileset.getTraversal?.({})?.selectTiles?.(projectedTileset, {});
    expect(projectedTileset._selectedTiles).toEqual([sparseCoarseTile, sparseFineTile]);
    expect(projectedTileset._selectedTilesToStyle).toEqual([sparseCoarseTile, sparseFineTile]);
    const thinCoarseTile = {
      refine: 1,
      children: [],
      geometricError: 64,
      boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 120 },
    };
    const thinFineTileA = {
      refine: 1,
      children: [],
      geometricError: 16,
      boundingSphere: { center: { x: -30, y: 0, z: 0 }, radius: 25 },
    };
    const thinFineTileB = {
      refine: 1,
      children: [],
      geometricError: 16,
      boundingSphere: { center: { x: 30, y: 0, z: 0 }, radius: 25 },
    };
    projectedTileset._selectedTiles = [thinCoarseTile, thinFineTileA, thinFineTileB];
    projectedTileset._selectedTilesToStyle = [thinCoarseTile, thinFineTileA, thinFineTileB];
    projectedTileset.getTraversal?.({})?.selectTiles?.(projectedTileset, {});
    expect(projectedTileset._selectedTiles).toEqual([thinFineTileA, thinFineTileB]);
    expect(projectedTileset._selectedTilesToStyle).toEqual([thinFineTileA, thinFineTileB]);
    expect(
      ((cesium.operations.primitivesAdded[1] as {
        customShader?: { options?: { fragmentShaderText?: string } };
      }).customShader?.options?.fragmentShaderText ?? ""),
    ).not.toContain("positionWC");
    expect(cesium.operations.imageryAdded).toHaveLength(0);
    expect(cesium.operations.entitiesAdded.some((value) =>
      Boolean((value as { polygon?: unknown }).polygon),
    )).toBe(false);
    expect((cesium.operations.primitivesAdded[2] as { options?: { geometryInstances?: unknown } }).options?.geometryInstances)
      .toBeDefined();
    await viewer.destroy();
    expect(cesium.operations.viewerDestroyed).toBe(true);
    expect(cesium.operations.primitiveDestroyCount).toBe(3);
  });

  it("updates S-102 custom shader uniforms when terrain style changes", async () => {
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
      LayerBuilder.createS102({
        id: "s102-styled",
        url: "https://example.test/s102",
        crs: "EPSG:32619",
        sourceMetadata: {
          values: {
            heightSign: -1,
          },
        },
        style: {
          safetyDepthMeters: 7,
          contours: {
            visible: false,
            intervalMeters: 5,
          },
        },
      }),
    );
    const primitive = cesium.operations.primitivesAdded[0] as {
      customShader?: {
        options?: {
          uniforms?: Record<string, { value?: unknown }>;
          vertexShaderText?: string;
          fragmentShaderText?: string;
        };
        destroyed?: boolean;
      };
    };
    expect(primitive.customShader?.options?.uniforms?.u_s102SafetyDepthMeters?.value).toBe(7);
    expect(primitive.customShader?.options?.uniforms?.u_s102SeaLevel?.value).toBe(0);
    expect(primitive.customShader?.options?.uniforms?.u_s102HeightAxis?.value).toBe(1);
    expect(primitive.customShader?.options?.uniforms?.u_s102HeightSign?.value).toBe(-1);
    expect(primitive.customShader?.options?.uniforms?.u_s102UseProjectedLocalWorldHeight?.value).toBe(true);
    expect(primitive.customShader?.options?.uniforms?.u_s102FallbackLightingEnabled?.value).toBe(true);
    expect(primitive.customShader?.options?.uniforms?.u_s102FallbackAmbientIntensity?.value).toBeGreaterThan(0);
    expect(primitive.customShader?.options?.uniforms?.u_s102FallbackDirectionalIntensity?.value).toBeGreaterThan(0);
    expect(primitive.customShader?.options?.uniforms?.u_s102FallbackLightDirectionWC?.value).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    });
    expect(
      (primitive.customShader?.options?.uniforms?.u_s102FallbackLightDirectionWC?.value as { y?: number }).y,
    ).toBeGreaterThan(0);
    const firstShader = primitive.customShader;

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
    expect(primitive.customShader?.options?.uniforms?.u_s102SeaLevel?.value).toBe(1.2);
    scene.time.setCurrent(new Date("2026-01-01T01:00:00Z"));
    expect(primitive.customShader?.options?.uniforms?.u_s102SeaLevel?.value).toBe(2.4);
    expect(cesium.operations.shaderUniformUpdates).toEqual([
      { name: "u_s102SeaLevel", value: 1.2 },
      { name: "u_s102SeaLevel", value: 2.4 },
    ]);

    await layer.update({
      style: {
        safetyDepthMeters: 12,
        contours: {
          visible: true,
          intervalMeters: 2.5,
        },
      },
    });

    expect(firstShader?.destroyed).toBe(true);
    expect(primitive.customShader?.options?.uniforms?.u_s102SeaLevel?.value).toBe(2.4);
    expect(primitive.customShader?.options?.uniforms?.u_s102SafetyDepthMeters?.value).toBe(12);
    expect(primitive.customShader?.options?.uniforms?.u_s102ShowContours?.value).toBe(true);
    expect(primitive.customShader?.options?.uniforms?.u_s102ContourInterval?.value).toBe(2.5);
    expect(primitive.customShader?.options?.fragmentShaderText).toContain(
      "vec3(0.827, 0.918, 0.984)",
    );
    expect(primitive.customShader?.options?.fragmentShaderText).toContain(
      "vec3(0.447, 0.667, 0.608)",
    );
    expect(primitive.customShader?.options?.fragmentShaderText).toContain(
      "fwidth(contourCoord)",
    );
    expect(primitive.customShader?.options?.vertexShaderText).toContain(
      "v_s102Height = s102HeightFromModelPosition",
    );
    expect(primitive.customShader?.options?.fragmentShaderText).toContain("positionEC");
    expect(primitive.customShader?.options?.fragmentShaderText).toContain("s100ApplyTerrainFallbackLighting");
    expect(primitive.customShader?.options?.fragmentShaderText).not.toContain("positionWC");
    expect(primitive.customShader?.options?.fragmentShaderText).toContain(
      "depthBelowWater >= 0.0 && depthBelowWater <= u_s102SafetyDepthMeters",
    );
    expect(primitive.customShader?.options?.fragmentShaderText).not.toContain("unsafeFeather");
    await viewer.destroy();
  });
});
