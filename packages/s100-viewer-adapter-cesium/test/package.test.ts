import { describe, expect, it } from "vitest";
import { CameraControlPresets, createS100Viewer, LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
import {
  cesiumAdapterCapabilities,
  createCesiumAdapter,
} from "../src/index.js";

describe("@ecc/s100-viewer-adapter-cesium", () => {
  it("reports globe-native S-100 capabilities", () => {
    expect(cesiumAdapterCapabilities.sceneGeoreferences).toContain("ellipsoid-ecef");
    expect(cesiumAdapterCapabilities.layerProducts).toContain("S-102");
    expect(cesiumAdapterCapabilities.supportedProductVersions?.length).toBeGreaterThan(0);
    expect(cesiumAdapterCapabilities.visualFeatures).toMatchObject({
      depthRay: true,
      hoverPrism: true,
      vesselOceanSurface: expect.objectContaining({ supported: true }),
      vesselShadow: expect.objectContaining({ supported: true }),
      dynamicLighting: expect.objectContaining({ supported: true }),
    });
  });

  it("renders at full device-pixel resolution by default", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });

    expect(viewer.getEngineHandles()).toMatchObject({
      adapterId: "cesium",
      engineName: "Cesium",
      engineInstance: expect.any(Object),
      instances: {
        viewer: expect.any(Object),
        scene: expect.any(Object),
        camera: expect.any(Object),
      },
      staticObjects: {
        Cesium: cesium,
      },
      resources: {
        cesiumDocs: "https://cesium.com/learn/cesiumjs/ref-doc/",
      },
    });
    expect(cesium.operations.viewerOptions[0]).toMatchObject({
      useBrowserRecommendedResolution: false,
    });
    await viewer.destroy();

    const overrideCesium = createMockCesium();
    const overrideViewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({
        cesiumModule: overrideCesium,
        viewerOptions: { useBrowserRecommendedResolution: true },
      }),
    });

    expect(overrideCesium.operations.viewerOptions[0]).toMatchObject({
      useBrowserRecommendedResolution: true,
    });
    await overrideViewer.destroy();
  });

  it("keeps Cesium dynamic lighting off until the scene opts in", async () => {
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
    expect(scene.getEngineHandles()).toMatchObject({
      adapterId: "cesium",
      engineName: "Cesium",
      instances: {
        viewer: expect.any(Object),
        scene: expect.any(Object),
        camera: expect.any(Object),
        sceneOptions: expect.any(Object),
      },
      staticObjects: {
        Cesium: cesium,
      },
    });

    expect(cesium.operations.sceneLights).toHaveLength(1);
    expect(cesium.operations.globe.enableLighting).toBe(false);
    expect((cesium.operations.sceneLights[0] as { direction?: { x?: number; y?: number; z?: number } }).direction)
      .toMatchObject({ x: 0, y: expect.any(Number), z: expect.any(Number) });
    expect((cesium.operations.sceneLights[0] as { direction?: { y?: number } }).direction?.y).toBeGreaterThan(0);

    scene.time.setCurrent(new Date("2026-05-19T12:00:00Z"));
    expect(cesium.operations.sceneLights).toHaveLength(1);

    scene.environment.setState({
      background: "skybox",
      skyboxFaces: {
        positiveX: "/sky/px.png",
        negativeX: "/sky/nx.png",
        positiveY: "/sky/py.png",
        negativeY: "/sky/ny.png",
        positiveZ: "/sky/pz.png",
        negativeZ: "/sky/nz.png",
      },
      lighting: {
        environmentMapUrl: "/sky/specular.ktx2",
        environmentIntensity: 0.4,
        dynamic: { enabled: true },
      },
    });
    expect(cesium.operations.sceneLights).toHaveLength(2);
    expect(cesium.operations.globe.enableLighting).toBe(true);
    expect(cesium.operations.skyBoxes).toEqual([
      {
        sources: {
          positiveX: "/sky/px.png",
          negativeX: "/sky/nx.png",
          positiveY: "/sky/py.png",
          negativeY: "/sky/ny.png",
          positiveZ: "/sky/pz.png",
          negativeZ: "/sky/nz.png",
        },
      },
    ]);
    expect(cesium.operations.scene.specularEnvironmentMaps).toBe("/sky/specular.ktx2");

    scene.environment.setState({
      background: "skybox",
      skyboxUrl: "/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr",
      lighting: {
        environmentMapUrl: "/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr",
      },
    });
    expect(cesium.operations.scene.__s100EnvironmentMapUrl)
      .toBe("/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr");
    expect(cesium.operations.scene.specularEnvironmentMaps).toBeUndefined();
    expect((cesium.operations.scene.skyBox as { show?: boolean }).show).toBe(false);
    expect(cesium.operations.skyAtmosphere.show).toBe(true);
    expect(cesium.operations.sceneLights).toHaveLength(3);

    scene.time.setCurrent(new Date("2026-05-19T13:00:00Z"));
    expect(cesium.operations.sceneLights).toHaveLength(4);

    scene.environment.setState({
      lighting: {
        dynamic: { enabled: false },
      },
    });
    scene.time.setCurrent(new Date("2026-05-19T14:00:00Z"));
    expect(cesium.operations.sceneLights).toHaveLength(5);
    expect(cesium.operations.globe.enableLighting).toBe(false);

    await viewer.destroy();
  });

  it("applies S-100 camera controls by default and allows viewer-level overrides", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });

    await viewer.createScene({
      georeference: {
        mode: "ellipsoid-ecef",
        ellipsoid: "WGS84",
        units: "meters",
      },
    });

    expect(cesium.operations.screenSpaceCameraController).toMatchObject({
      enableInputs: true,
      enableRotate: true,
      enableTranslate: true,
      enableZoom: true,
      rotateEventTypes: ["LEFT_DRAG"],
      translateEventTypes: [
        "MIDDLE_DRAG",
        { eventType: "LEFT_DRAG", modifier: "SHIFT" },
      ],
      zoomEventTypes: ["RIGHT_DRAG", "WHEEL", "PINCH"],
    });

    dispatchScreenSpace(cesium, "MIDDLE_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 112, y: 108 },
    });
    expect(cesium.operations.cameraMoves).toEqual([
      { direction: "right", amount: -48 },
      { direction: "up", amount: 32 },
    ]);
    expect(cesium.operations.requestRenderCount).toBe(1);

    viewer.setCameraControls(CameraControlPresets.DISABLED);
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 130, y: 130 },
    });
    expect(cesium.operations.cameraMoves).toHaveLength(2);

    expect(cesium.operations.screenSpaceCameraController).toMatchObject({
      enableInputs: false,
      enableRotate: false,
      enableTranslate: false,
      enableZoom: false,
      rotateEventTypes: [],
      translateEventTypes: [],
      zoomEventTypes: [],
    });

    await viewer.destroy();
  });

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

  it("uses projected-local camera coordinates in a Cesium world transform", async () => {
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

    scene.camera.lookAt({
      target: {
        kind: "projected",
        crs: "EPSG:32619",
        x: 331100,
        y: 5186420,
        z: 0,
      },
      rangeMeters: 1000,
      headingDegrees: 0,
      pitchDegrees: 45,
    });

    expect(cesium.operations.globe.show).toBe(false);
    expect(cesium.operations.skyBox.show).toBe(false);
    expect(cesium.operations.fog).toMatchObject({
      enabled: false,
      renderable: false,
      density: 0,
      screenSpaceErrorFactor: 0,
    });
    expect(cesium.operations.cameraFrustum.far).toBe(50_000_000);
    expect(cesium.operations.sceneMode).toBe("SCENE3D");
    expect(cesium.operations.cameraLookAts[0]?.target).toMatchObject({
      frame: "enu",
      x: 0,
      y: 0,
      z: 0,
    });
    expect(cesium.operations.cameraLookAts[0]?.range).toMatchObject({ range: 1000 });

    scene.camera.setPose({
      position: { x: 331200, y: 5186520, z: 250 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      focalDistance: 750,
    });

    expect(cesium.operations.cameraViews[0]?.destination).toMatchObject({
      frame: "enu",
      x: 100,
      y: 100,
      z: 250,
    });
    expect(cesium.operations.cameraViews[0]?.orientation).toMatchObject({
      direction: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
    });
    expect(scene.camera.getPose().position).toEqual({ x: 331200, y: 5186520, z: 250 });
    expect(scene.camera.getPose().rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });

    dispatchScreenSpace(cesium, "MIDDLE_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 112, y: 108 },
    });
    dispatchScreenSpace(cesium, "MIDDLE_UP", {
      position: { x: 112, y: 108 },
    });

    expect(cesium.operations.cameraViews).toHaveLength(1);
    expect(scene.camera.getPose().position).toEqual({ x: 331152, y: 5186552, z: 250 });

    dispatchScreenSpace(cesium, "LEFT_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 130, y: 116 },
    });

    expect(cesium.operations.cameraViews).toHaveLength(2);
    expect(scene.camera.getPose().position).toEqual({ x: 331152, y: 5186552, z: 250 });
    expect(scene.camera.getPose().rotation.w).toBeLessThan(1);
    await viewer.destroy();
  });

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

  it("can opt projected-local scenes into Cesium Columbus View", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });

    await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
      metadata: {
        cesiumSceneMode: "columbus-view",
      },
    });

    expect(cesium.operations.sceneMode).toBe("COLUMBUS_VIEW");
    expect(cesium.operations.sceneModeMorphDuration).toBe(0);
    await viewer.destroy();
  });

  it("converts true-north vessel headings to Cesium heading-pitch-roll", async () => {
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

    const vessel = await scene.layers.add(
      LayerBuilder.createVessel({
        url: "/assets/vessel.glb",
        pose: {
          position: {
            kind: "projected",
            crs: "EPSG:32619",
            x: 331100,
            y: 5186420,
            z: 0,
          },
          headingDegrees: 0,
        },
        dimensions: { draught: 12, bow: 195.2, stern: 30, port: 20.8, starboard: 11.2 },
        referencePoint: "transponder",
        extensions: {
          nasaAmmos: {
            model: {
              boundingBox: {
                min: [-20.8, -30, -40.2],
                max: [11.2, 195.2, 6.4],
              },
            },
          },
        },
      }),
    );

    expect(cesium.operations.headingPitchRolls[0]).toMatchObject({ heading: 90, pitch: 0, roll: 0 });
    const vesselPosition = (cesium.operations.entitiesAdded[0] as {
      position?: { frame?: unknown; x?: number; y?: number; z?: number };
    }).position;
    expect(vesselPosition).toMatchObject({
      frame: "enu",
      x: 0,
      y: 0,
    });
    expect(vesselPosition?.z).toBeCloseTo(28.2);

    await vessel.update({
      pose: {
        position: {
          kind: "projected",
          crs: "EPSG:32619",
          x: 331100,
          y: 5186420,
          z: 0,
        },
        headingDegrees: 90,
      },
    });

    expect(cesium.operations.headingPitchRolls[1]).toMatchObject({ heading: 180, pitch: 0, roll: 0 });
    await viewer.destroy();
  });

  it("creates and patches Cesium vessel visual feature drawables", async () => {
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

    const vessel = await scene.layers.add(
      LayerBuilder.createVessel({
        url: "/assets/vessel.glb",
        pose: {
          position: {
            kind: "projected",
            crs: "EPSG:32619",
            x: 331100,
            y: 5186420,
            z: 0,
          },
          headingDegrees: 45,
        },
        style: {
          oceanSurface: { enabled: true, radiusMeters: 80, opacity: 0.5, reflectivity: 0.4, roughness: 0.096 },
          shadow: { enabled: true, opacity: 0.25 },
          transformGizmo: {
            enabled: true,
            sizeMeters: 25,
            verticalPositionLimits: { minMeters: -30, maxMeters: 8 },
          },
        },
        dimensions: { draught: 12, bow: 195.2, stern: 30, port: 20.8, starboard: 11.2 },
        referencePoint: "transponder",
      }),
    );

    expect(cesium.operations.entitiesAdded).toHaveLength(1);
    const oceanSurfacePrimitive = cesium.operations.primitivesAdded.find((primitive) =>
      (primitive as {
        options?: {
          appearance?: {
            options?: {
              material?: { options?: { fabric?: { type?: string } } };
            };
          };
        };
      }).options?.appearance?.options?.material?.options?.fabric?.type === "S100VesselOceanSurface",
    ) as {
      options?: {
        modelMatrix?: unknown;
        geometryInstances?: {
          geometry?: { attributes?: { position?: { values?: Float64Array } } };
        };
        appearance?: {
          options?: {
            material?: {
              options?: {
                fabric?: {
                  uniforms?: Record<string, unknown>;
                  source?: string;
                };
              };
            };
          };
        };
      };
    };
    expect(oceanSurfacePrimitive).toBeDefined();
    expect(oceanSurfacePrimitive.options?.modelMatrix).toMatchObject({ kind: "multiply" });
    const oceanSurfacePositions =
      oceanSurfacePrimitive.options?.geometryInstances?.geometry?.attributes?.position?.values ?? new Float64Array();
    expect(Array.from(oceanSurfacePositions.slice(0, 6))).toEqual([0, 0, 0, 80, 0, 0]);
    expect(Math.hypot(oceanSurfacePositions[3] ?? 0, oceanSurfacePositions[4] ?? 0)).toBeCloseTo(80);
    expect(oceanSurfacePrimitive.options?.appearance?.options?.material?.options?.fabric?.source)
      .toContain("s100WaterWaveHeight");
    expect(oceanSurfacePrimitive.options?.appearance?.options?.material?.options?.fabric?.source)
      .toContain("czm_frameNumber");
    expect(oceanSurfacePrimitive.options?.appearance?.options?.material?.options?.fabric?.uniforms)
      .toMatchObject({
        u_s100WaterOpacity: 0.5,
        u_s100WaterRadiusMeters: 80,
        u_s100WaterReflectivity: 0.4,
        u_s100WaterRoughness: 0.096,
      });
    const oceanSurfaceOutline = cesium.operations.primitivesAdded.find((primitive) =>
      Array.isArray((primitive as { polylines?: unknown[] }).polylines) &&
      Boolean((primitive as { modelMatrix?: unknown }).modelMatrix),
    ) as { polylines?: Array<{ positions?: Array<{ x?: number; y?: number; z?: number }> }>; modelMatrix?: unknown };
    expect(oceanSurfaceOutline?.modelMatrix).toMatchObject({ kind: "multiply" });
    expect(oceanSurfaceOutline?.polylines?.[0]?.positions?.[0]).toMatchObject({ x: 80, y: 0, z: 0 });
    expect(cesium.operations.primitivesAdded.some((primitive) =>
      Boolean((primitive as { options?: { geometryInstances?: { options?: { attributes?: { color?: unknown } } } } })
        .options?.geometryInstances?.options?.attributes?.color),
    )).toBe(true);
    expect(cesium.operations.primitivesAdded.some((primitive) =>
      Array.isArray((primitive as { polylines?: unknown[] }).polylines),
    )).toBe(true);
    const sceneLayerUpdates: unknown[] = [];
    const layerChanges: unknown[] = [];
    scene.events.on("layer.updated", (layer) => {
      sceneLayerUpdates.push(layer.spec);
    });
    vessel.onChanged((layer) => {
      layerChanges.push(layer.spec);
    });
    const nativeVessel = vessel.getNativeHandle<{
      view?: {
        getPosition?: () => [number, number, number];
        getHeading?: () => number;
        positionChanged?: { subscribe?: (listener: (position: [number, number, number]) => void) => { unsubscribe(): void } };
      };
    }>();
    const positions: Array<[number, number, number]> = [];
    nativeVessel?.view?.positionChanged?.subscribe?.((position) => {
      positions.push(position);
    });
    const xGizmo = cesium.operations.primitivesAdded.find((primitive) =>
      (primitive as { __s100VesselGizmo?: { axis?: string } }).__s100VesselGizmo?.axis === "x",
    );
    expect(xGizmo).toBeDefined();
    cesium.operations.pickResult = { primitive: xGizmo };
    dispatchScreenSpace(cesium, "LEFT_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 145, y: 100 },
    });
    dispatchScreenSpace(cesium, "LEFT_UP", {});
    expect(nativeVessel?.view?.getPosition?.()[0]).toBeCloseTo(331125);
    expect(positions.at(-1)?.[0]).toBeCloseTo(331125);
    expect(((vessel.spec as { pose: { position: { x: number } } }).pose.position.x)).toBeCloseTo(331125);
    expect(((sceneLayerUpdates.at(-1) as { pose: { position: { x: number } } }).pose.position.x)).toBeCloseTo(331125);
    expect(((layerChanges.at(-1) as { pose: { position: { x: number } } }).pose.position.x)).toBeCloseTo(331125);
    expect(cesium.operations.cameraViews).toHaveLength(0);

    const zGizmo = cesium.operations.primitivesAdded.find((primitive) =>
      (primitive as { __s100VesselGizmo?: { axis?: string } }).__s100VesselGizmo?.axis === "z",
    );
    expect(zGizmo).toBeDefined();
    cesium.operations.pickResult = { primitive: zGizmo };
    dispatchScreenSpace(cesium, "LEFT_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 100, y: 10 },
    });
    dispatchScreenSpace(cesium, "LEFT_UP", {});
    expect(nativeVessel?.view?.getPosition?.()[2]).toBeCloseTo(8);
    expect(((vessel.spec as { pose: { position: { z: number } } }).pose.position.z)).toBeCloseTo(8);

    await vessel.update({
      style: {
        oceanSurface: false,
        shadow: false,
        transformGizmo: false,
      },
    });

    expect(cesium.operations.primitivesAdded).toHaveLength(0);
    await viewer.destroy();
  });

  it("renders projected compatibility WMS maps as scene rectangles", async () => {
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
    const extent = {
      crs: "EPSG:32619",
      minX: 331100,
      minY: 5186420,
      maxX: 332100,
      maxY: 5187420,
    };

    await scene.layers.add(
      LayerBuilder.createS101Wms({
        id: "basemap",
        url: "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&SRS=EPSG:32619",
        layers: ["cells"],
        crs: "EPSG:32619",
        visible: true,
        opacity: 0.42,
        spatialExtent: extent,
        extensions: {
          nasaAmmos: {
            mapSpecification: {
              urlTemplate:
                "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&SRS=EPSG:32619",
              dataset: {
                extents: extent,
              },
            },
          },
        },
      }),
    );

    expect(cesium.operations.imageryAdded).toHaveLength(0);
    const primitive = cesium.operations.primitivesAdded.find((value) =>
      Boolean((value as { options?: { appearance?: { options?: { material?: { uniforms?: { image?: string } } } } } }).options?.appearance?.options?.material?.uniforms?.image),
    ) as {
      options?: {
        geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } };
        appearance?: { options?: { material?: { uniforms?: { image?: string; color?: { a?: number } } } } };
      };
    };
    expect(Array.from(primitive?.options?.geometryInstances?.geometry?.attributes?.position?.values ?? [])).toEqual([
      0, 0, 0.5,
      1000, 0, 0.5,
      1000, 1000, 0.5,
      0, 1000, 0.5,
    ]);
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("WIDTH=2048");
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("HEIGHT=2048");
    await viewer.destroy();
  });

  it("renders generic projected S-101 WMS specs as local scene rectangles", async () => {
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
      LayerBuilder.createS101Wms({
        id: "generic-s101",
        url: "https://example.test/wms",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        visible: true,
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 331100,
          minY: 5186420,
          maxX: 332100,
          maxY: 5187420,
        },
      }),
    );

    expect(cesium.operations.imageryAdded).toHaveLength(0);
    const primitive = cesium.operations.primitivesAdded.find((value) =>
      Boolean((value as { options?: { appearance?: { options?: { material?: { uniforms?: { image?: string } } } } } }).options?.appearance?.options?.material?.uniforms?.image),
    ) as {
      options?: {
        geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } };
        appearance?: { options?: { material?: { uniforms?: { image?: string } } } };
      };
    };
    expect(Array.from(primitive?.options?.geometryInstances?.geometry?.attributes?.position?.values ?? [])).toEqual([
      0, 0, 0.5,
      1000, 0, 0.5,
      1000, 1000, 0.5,
      0, 1000, 0.5,
    ]);
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("LAYERS=s100dataSets.101");
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("BBOX=331100,5186420,332100,5187420");
    await viewer.destroy();
  });

  it("keeps projected WMS primitives hidden until the tile image loads", async () => {
    const previousImage = (globalThis as Record<string, unknown>).Image;
    const images: MockDeferredImage[] = [];
    class MockDeferredImage {
      crossOrigin: string | null = null;
      src = "";
      complete = false;
      naturalWidth = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private readonly listeners: Record<"load" | "error", Array<() => void>> = {
        load: [],
        error: [],
      };

      constructor() {
        images.push(this);
      }

      addEventListener(type: "load" | "error", listener: () => void) {
        this.listeners[type].push(listener);
      }

      removeEventListener(type: "load" | "error", listener: () => void) {
        this.listeners[type] = this.listeners[type].filter((registered) => registered !== listener);
      }

      emitLoad() {
        this.complete = true;
        this.naturalWidth = 512;
        this.onload?.();
        for (const listener of [...this.listeners.load]) {
          listener();
        }
      }
    }
    (globalThis as Record<string, unknown>).Image = MockDeferredImage;

    try {
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
        LayerBuilder.createS101Wms({
          id: "deferred-s101",
          url: "https://example.test/wms",
          layers: ["s100dataSets.101"],
          crs: "EPSG:32619",
          visible: true,
          spatialExtent: {
            crs: "EPSG:32619",
            minX: 331100,
            minY: 5186420,
            maxX: 332100,
            maxY: 5187420,
          },
        }),
      );

      const primitive = cesium.operations.primitivesAdded[0] as {
        show?: boolean;
        options?: { appearance?: { options?: { material?: { uniforms?: { image?: unknown } } } } };
      };
      expect(images).toHaveLength(1);
      expect(primitive.show).toBe(false);
      expect(primitive.options?.appearance?.options?.material?.uniforms?.image).toBe(images[0]);
      expect(images[0]?.crossOrigin).toBe("anonymous");

      images[0]?.emitLoad();

      expect(primitive.show).toBe(true);
      expect(cesium.operations.requestRenderCount).toBe(1);
      await viewer.destroy();
    } finally {
      if (previousImage === undefined) {
        Reflect.deleteProperty(globalThis, "Image");
      } else {
        (globalThis as Record<string, unknown>).Image = previousImage;
      }
    }
  });

  it("cuts the projected S-101 opaque basemap around the transparent S-102 reveal area", async () => {
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
      LayerBuilder.createS101Wms({
        id: "s101WMS",
        role: "overlay",
        url: "https://example.test/transparent?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&IGNORE=DepthArea,DepthContour&HIDE=90010,90020",
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
    await scene.layers.add(
      LayerBuilder.createS101Wms({
        id: "s101WMSOpaque",
        role: "basemap",
        url: "https://example.test/opaque?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&HIDE=90010,90020",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 330100,
          minY: 5185420,
          maxX: 333100,
          maxY: 5188420,
        },
      }),
    );

    const opaquePrimitives = cesium.operations.primitivesAdded.filter((value) =>
      String((value as {
        options?: { appearance?: { options?: { material?: { uniforms?: { image?: string } } } } };
      }).options?.appearance?.options?.material?.uniforms?.image ?? "").includes("/opaque"),
    ) as Array<{
      options?: {
        geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } };
        appearance?: { options?: { material?: { uniforms?: { image?: string } } } };
      };
    }>;
    expect(opaquePrimitives).toHaveLength(4);
    expect(Array.from(opaquePrimitives[0]?.options?.geometryInstances?.geometry?.attributes?.position?.values ?? [])).toEqual([
      -1000, -1000, 0.5,
      0, -1000, 0.5,
      0, 2000, 0.5,
      -1000, 2000, 0.5,
    ]);
    expect(opaquePrimitives.map((primitive) =>
      primitive.options?.appearance?.options?.material?.uniforms?.image,
    )).toEqual([
      expect.stringContaining("BBOX=330100,5185420,331100,5188420"),
      expect.stringContaining("BBOX=332100,5185420,333100,5188420"),
      expect.stringContaining("BBOX=331100,5185420,332100,5186420"),
      expect.stringContaining("BBOX=331100,5187420,332100,5188420"),
    ]);
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

  it("applies projected WMS visibility and opacity patches when rebuilding map entities", async () => {
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
      LayerBuilder.createS101Wms({
        id: "patchable-s101",
        url: "https://example.test/wms",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        visible: false,
        opacity: 1,
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 331100,
          minY: 5186420,
          maxX: 332100,
          maxY: 5187420,
        },
      }),
    );

    expect(cesium.operations.entitiesAdded).toHaveLength(0);
    expect(cesium.operations.primitivesAdded).toHaveLength(1);
    expect((cesium.operations.primitivesAdded[0] as { show?: boolean }).show).toBe(false);

    await layer.update({ visible: true, opacity: 0.35 });

    expect(cesium.operations.primitivesAdded).toHaveLength(1);
    const rebuiltPrimitive = cesium.operations.primitivesAdded[0] as {
      show?: boolean;
      options?: { appearance?: { options?: { material?: { uniforms?: { color?: { a?: number } } } } } };
    };
    expect(rebuiltPrimitive.show).toBe(true);
    expect(rebuiltPrimitive.options?.appearance?.options?.material?.uniforms?.color?.a).toBe(0.35);
    await viewer.destroy();
  });

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
        style: {
          unsafeDepth: -7,
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
    expect(primitive.customShader?.options?.uniforms?.u_s102UnsafeDepth?.value).toBe(-7);
    expect(primitive.customShader?.options?.uniforms?.u_s102SeaLevel?.value).toBe(0);
    expect(primitive.customShader?.options?.uniforms?.u_s102HeightAxis?.value).toBe(1);
    expect(primitive.customShader?.options?.uniforms?.u_s102HeightSign?.value).toBe(1);
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
        unsafeDepth: -12,
        contours: {
          visible: true,
          intervalMeters: 2.5,
        },
      },
    });

    expect(firstShader?.destroyed).toBe(true);
    expect(primitive.customShader?.options?.uniforms?.u_s102SeaLevel?.value).toBe(2.4);
    expect(primitive.customShader?.options?.uniforms?.u_s102UnsafeDepth?.value).toBe(-12);
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
      "height - u_s102SeaLevel > u_s102UnsafeDepth",
    );
    expect(primitive.customShader?.options?.fragmentShaderText).not.toContain("unsafeFeather");
    await viewer.destroy();
  });
});

function createMockContainer(): HTMLElement {
  return {
    appendChild() {
      return undefined;
    },
  } as unknown as HTMLElement;
}

function dispatchDocumentMouse(
  cesium: ReturnType<typeof createMockCesium>,
  type: string,
  event: Partial<MouseEvent>,
): void {
  const listeners = cesium.operations.documentListeners[type] ?? [];
  for (const listener of listeners) {
    listener({
      target: cesium.operations.canvas,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      preventDefault() {
        return undefined;
      },
      ...event,
    } as MouseEvent);
  }
}

function dispatchScreenSpace(
  cesium: ReturnType<typeof createMockCesium>,
  type: string,
  movement: unknown,
  modifier?: unknown,
): void {
  for (const handler of cesium.operations.screenSpaceHandlers) {
    if (handler.destroyed) {
      continue;
    }
    for (const action of handler.actions) {
      if (action.type === type && action.modifier === modifier) {
        action.callback(movement);
      }
    }
  }
}

function createMockCesium() {
  const operations = {
    canvasListeners: {} as Record<string, Array<(event: Event) => void>>,
    documentListeners: {} as Record<string, Array<(event: Event) => void>>,
    canvas: {} as Record<string, unknown>,
    screenSpaceHandlers: [] as Array<{
      destroyed: boolean;
      actions: Array<{ type: unknown; modifier: unknown; callback: (movement: unknown) => void }>;
    }>,
    primitivesAdded: [] as unknown[],
    imageryAdded: [] as unknown[],
    entitiesAdded: [] as unknown[],
    cameraMoves: [] as Array<{ direction: string; amount: number }>,
    cameraViews: [] as Array<{ destination?: unknown; orientation?: unknown }>,
    cameraLookAts: [] as Array<{ target?: unknown; range?: unknown }>,
    headingPitchRolls: [] as Array<{ heading: number; pitch: number; roll: number }>,
    primitiveDestroyCount: 0,
    shaderUniformUpdates: [] as Array<{ name: string; value: unknown }>,
    tilesetEventRemoveCount: 0,
    globe: {} as { show?: boolean; enableLighting?: boolean },
    fog: {
      enabled: true,
      renderable: true,
      density: 0.0006,
      screenSpaceErrorFactor: 2,
    } as Record<string, unknown>,
    cameraFrustum: {
      near: 1,
      far: 1000,
    } as Record<string, unknown>,
    screenSpaceCameraController: {} as Record<string, unknown>,
    skyAtmosphere: {} as { show?: boolean },
    skyBox: {} as { show?: boolean },
    skyBoxes: [] as Array<{ sources?: unknown }>,
    sun: {} as { show?: boolean },
    moon: {} as { show?: boolean },
    requestRenderCount: 0,
    scene: {} as Record<string, unknown>,
    sceneLights: [] as unknown[],
    sceneMode: "SCENE3D" as unknown,
    sceneModeMorphDuration: undefined as number | undefined,
    pickResult: undefined as unknown,
    pickPositionResult: undefined as unknown,
    viewerDestroyed: false,
    viewerOptions: [] as unknown[],
  };

  const mockDocument = {
    addEventListener(type: string, listener: (event: Event) => void) {
      operations.documentListeners[type] = [
        ...(operations.documentListeners[type] ?? []),
        listener,
      ];
      return undefined;
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      operations.documentListeners[type] = (operations.documentListeners[type] ?? [])
        .filter((registered) => registered !== listener);
      return undefined;
    },
  };
  operations.canvas = {
    ownerDocument: mockDocument,
    contains(target: unknown) {
      return target === operations.canvas;
    },
    addEventListener(type: string, listener: (event: Event) => void) {
      operations.canvasListeners[type] = [
        ...(operations.canvasListeners[type] ?? []),
        listener,
      ];
      return undefined;
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      operations.canvasListeners[type] = (operations.canvasListeners[type] ?? [])
        .filter((registered) => registered !== listener);
      return undefined;
    },
  };

  class Viewer {
    scene = {
      canvas: operations.canvas,
      primitives: {
        add(value: unknown) {
          operations.primitivesAdded.push(value);
          return value;
        },
        remove(value: unknown) {
          const removed = operations.primitivesAdded.includes(value);
          operations.primitivesAdded = operations.primitivesAdded.filter((item) => item !== value);
          if (removed && value && typeof value === "object" && typeof (value as { destroy?: unknown }).destroy === "function") {
            (value as { destroy: () => void }).destroy();
          }
          return removed;
        },
      },
      pick() {
        return operations.pickResult;
      },
      pickPosition() {
        return operations.pickPositionResult;
      },
      mode: "SCENE3D",
      morphToColumbusView(duration: number) {
        this.mode = "COLUMBUS_VIEW";
        operations.sceneMode = this.mode;
        operations.sceneModeMorphDuration = duration;
        return undefined;
      },
      requestRender() {
        operations.requestRenderCount += 1;
        return undefined;
      },
      globe: operations.globe,
      fog: operations.fog,
      screenSpaceCameraController: operations.screenSpaceCameraController,
      skyAtmosphere: operations.skyAtmosphere,
      skyBox: operations.skyBox,
      sun: operations.sun,
      moon: operations.moon,
      get light() {
        return operations.sceneLights.at(-1);
      },
      set light(value: unknown) {
        operations.sceneLights.push(value);
      },
    };
    camera = {
      position: { x: 0, y: 0, z: 0 },
      positionCartographic: { height: 1000 },
      rightWC: { x: 1, y: 0, z: 0 },
      upWC: { x: 0, y: 1, z: 0 },
      directionWC: { x: 0, y: 0, z: -1 },
      frustum: operations.cameraFrustum,
      moveRight(amount: number) {
        operations.cameraMoves.push({ direction: "right", amount });
        this.position.x += amount;
        return undefined;
      },
      moveUp(amount: number) {
        operations.cameraMoves.push({ direction: "up", amount });
        this.position.y += amount;
        return undefined;
      },
      setView(value: { destination?: unknown; orientation?: unknown }) {
        operations.cameraViews.push(value);
        if (value.destination && typeof value.destination === "object") {
          this.position = value.destination as { x: number; y: number; z: number };
        }
        const orientation = value.orientation as
          | { direction?: { x: number; y: number; z: number }; up?: { x: number; y: number; z: number } }
          | undefined;
        if (orientation?.direction) {
          this.directionWC = orientation.direction;
        }
        if (orientation?.up) {
          this.upWC = orientation.up;
        }
        return undefined;
      },
      lookAt(target: unknown, range: unknown) {
        operations.cameraLookAts.push({ target, range });
        return undefined;
      },
      pickEllipsoid() {
        return undefined;
      },
    };
    imageryLayers = {
      addImageryProvider(value: unknown) {
        const layer = { provider: value, alpha: 1, show: true };
        operations.imageryAdded.push(layer);
        return layer;
      },
      remove(value: unknown) {
        operations.imageryAdded = operations.imageryAdded.filter((item) => item !== value);
        return true;
      },
    };
    entities = {
      add(value: unknown) {
        operations.entitiesAdded.push(value);
        return value;
      },
      remove(value: unknown) {
        operations.entitiesAdded = operations.entitiesAdded.filter((item) => item !== value);
        return true;
      },
    };
    clock = {};

    constructor(_parent: unknown, options: unknown) {
      operations.viewerOptions.push(options);
      operations.scene = this.scene;
    }

    destroy() {
      operations.viewerDestroyed = true;
    }
  }

  class Color {
    constructor(
      readonly r: number,
      readonly g: number,
      readonly b: number,
      readonly a: number,
    ) {}
  }

  class SingleTileImageryProvider {
    constructor(readonly options: unknown) {}
  }

  class WebMapServiceImageryProvider {
    constructor(readonly options: unknown) {}
  }

  class WebMapTileServiceImageryProvider {
    constructor(readonly options: unknown) {}
  }

  class ImageMaterialProperty {
    constructor(readonly options: unknown) {}
  }

  class Material {
    static ImageType = "Image";
    static ColorType = "Color";

    constructor(readonly options?: unknown) {}

    static fromType(type: string, uniforms?: Record<string, unknown>) {
      return {
        type,
        uniforms,
        destroyed: false,
        destroy() {
          if (this.destroyed) {
            const error = new Error("This object was destroyed, i.e., destroy() was called.");
            error.name = "DeveloperError";
            throw error;
          }
          this.destroyed = true;
          return undefined;
        },
      };
    }
  }

  class MaterialAppearance {
    static MaterialSupport = {
      TEXTURED: { vertexFormat: "TEXTURED" },
    };

    constructor(readonly options: unknown) {}
  }

  class PerInstanceColorAppearance {
    constructor(readonly options: unknown) {}
  }

  class ColorGeometryInstanceAttribute {
    static fromColor(color: unknown) {
      return { color };
    }
  }

  class GeometryAttribute {
    constructor(readonly options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class GeometryAttributes {
    constructor(options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class Geometry {
    constructor(readonly options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class GeometryInstance {
    constructor(readonly options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class Primitive {
    destroyed = false;
    show: boolean;

    constructor(readonly options: Record<string, unknown>) {
      this.show = typeof options.show === "boolean" ? options.show : true;
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      if (this.destroyed) {
        const error = new Error("This object was destroyed, i.e., destroy() was called.");
        error.name = "DeveloperError";
        throw error;
      }
      this.destroyed = true;
      operations.primitiveDestroyCount += 1;
      return undefined;
    }
  }

  class PolylineCollection {
    destroyed = false;
    show: boolean;
    modelMatrix?: unknown;
    polylines: unknown[] = [];

    constructor(options: { show?: boolean; modelMatrix?: unknown } = {}) {
      this.show = options.show ?? true;
      this.modelMatrix = options.modelMatrix;
    }

    add(options: unknown) {
      this.polylines.push(options);
      return options;
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      if (this.destroyed) {
        const error = new Error("This object was destroyed, i.e., destroy() was called.");
        error.name = "DeveloperError";
        throw error;
      }
      this.destroyed = true;
      for (const polyline of this.polylines) {
        const typedPolyline = polyline as {
          material?: { destroy?: () => void };
          depthFailMaterial?: { destroy?: () => void };
        };
        typedPolyline.material?.destroy?.();
        typedPolyline.depthFailMaterial?.destroy?.();
      }
      operations.primitiveDestroyCount += 1;
      return undefined;
    }
  }

  class BoundingSphere {
    static fromPoints(positions: readonly unknown[]) {
      return { kind: "points", positions };
    }

    static fromVertices(vertices: Float64Array) {
      return { kind: "vertices", vertices };
    }
  }

  class PolygonHierarchy {
    constructor(readonly positions: unknown[]) {}
  }

  class ScreenSpaceEventHandler {
    destroyed = false;
    actions: Array<{ type: unknown; modifier: unknown; callback: (movement: unknown) => void }> = [];

    constructor(readonly canvas: unknown) {
      operations.screenSpaceHandlers.push(this);
    }

    setInputAction(callback: (movement: unknown) => void, type: unknown, modifier?: unknown) {
      this.actions.push({ type, modifier, callback });
    }

    destroy() {
      this.destroyed = true;
      this.actions = [];
      return undefined;
    }
  }

  class SkyBox {
    show = true;
    destroyed = false;

    constructor(readonly options: { sources?: unknown }) {
      operations.skyBoxes.push(options);
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      this.destroyed = true;
      return undefined;
    }
  }

  class CustomShader {
    destroyed = false;

    constructor(readonly options: unknown) {}

    setUniform(name: string, value: unknown) {
      const uniforms = (this.options as { uniforms?: Record<string, { value?: unknown }> }).uniforms;
      if (!uniforms?.[name]) {
        throw new Error(`Missing uniform ${name}`);
      }
      uniforms[name].value = value;
      operations.shaderUniformUpdates.push({ name, value });
      return undefined;
    }

    destroy() {
      this.destroyed = true;
      return undefined;
    }
  }

  class HeadingPitchRange {
    constructor(
      readonly heading: number,
      readonly pitch: number,
      readonly range: number,
    ) {}
  }

  class HeadingPitchRoll {
    constructor(
      readonly heading: number,
      readonly pitch: number,
      readonly roll: number,
    ) {}

    static fromDegrees(heading: number, pitch: number, roll: number) {
      return new HeadingPitchRoll(heading, pitch, roll);
    }
  }

  class Matrix4 {
    static IDENTITY = { kind: "identity" };

    static clone(value: unknown) {
      return value;
    }

    static fromTranslation(translation: { x?: number; y?: number; z?: number }) {
      return { kind: "translation", translation };
    }

    static multiply(left: unknown, right: unknown) {
      return { kind: "multiply", left, right };
    }

    static inverseTransformation(matrix: unknown): unknown {
      const value = matrix as {
        kind?: string;
        left?: unknown;
        right?: unknown;
        origin?: unknown;
        translation?: { x?: number; y?: number; z?: number };
      };
      if (value.kind === "multiply") {
        return {
          kind: "multiply",
          left: Matrix4.inverseTransformation(value.right),
          right: Matrix4.inverseTransformation(value.left),
        };
      }
      if (value.kind === "translation") {
        return {
          kind: "translation",
          translation: {
            x: -(value.translation?.x ?? 0),
            y: -(value.translation?.y ?? 0),
            z: -(value.translation?.z ?? 0),
          },
        };
      }
      if (value.kind === "enu") {
        return { kind: "enu-inverse", origin: value.origin };
      }
      return { kind: "inverse", matrix };
    }

    static multiplyByPoint(
      matrix: unknown,
      point: { x?: number; y?: number; z?: number },
    ): { x?: number; y?: number; z?: number; frame?: string; origin?: unknown } {
      const value = matrix as {
        kind?: string;
        left?: unknown;
        right?: unknown;
        origin?: unknown;
        translation?: { x?: number; y?: number; z?: number };
      };
      if (value.kind === "multiply") {
        return Matrix4.multiplyByPoint(value.left, Matrix4.multiplyByPoint(value.right, point));
      }
      if (value.kind === "identity") {
        return point;
      }
      if (value.kind === "translation") {
        return {
          x: (point.x ?? 0) + (value.translation?.x ?? 0),
          y: (point.y ?? 0) + (value.translation?.y ?? 0),
          z: (point.z ?? 0) + (value.translation?.z ?? 0),
        };
      }
      if (value.kind === "enu") {
        return {
          frame: "enu",
          origin: value.origin,
          x: point.x ?? 0,
          y: point.y ?? 0,
          z: point.z ?? 0,
        };
      }
      if (value.kind === "enu-inverse") {
        return {
          x: point.x ?? 0,
          y: point.y ?? 0,
          z: point.z ?? 0,
        };
      }
      return point;
    }

    static multiplyByPointAsVector(
      matrix: unknown,
      point: { x?: number; y?: number; z?: number },
    ): { x?: number; y?: number; z?: number; frame?: string; origin?: unknown } {
      const value = matrix as {
        kind?: string;
        left?: unknown;
        right?: unknown;
      };
      if (value.kind === "multiply") {
        return Matrix4.multiplyByPointAsVector(value.left, Matrix4.multiplyByPointAsVector(value.right, point));
      }
      if (value.kind === "identity") {
        return point;
      }
      if (value.kind === "translation") {
        return {
          x: point.x ?? 0,
          y: point.y ?? 0,
          z: point.z ?? 0,
        };
      }
      return Matrix4.multiplyByPoint(matrix, point);
    }
  }

  function createTilesetEvent() {
    const listeners: Array<(tile?: unknown) => void> = [];
    return {
      listeners,
      addEventListener(listener: (tile?: unknown) => void) {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
          operations.tilesetEventRemoveCount += 1;
        };
      },
      raise(tile?: unknown) {
        for (const listener of [...listeners]) {
          listener(tile);
        }
      },
    };
  }

  return {
    operations,
    Viewer,
    Color,
    CustomShader,
    Material,
    MaterialAppearance,
    PerInstanceColorAppearance,
    ColorGeometryInstanceAttribute,
    Geometry,
    GeometryAttribute,
    GeometryAttributes,
    GeometryInstance,
    Primitive,
    PolylineCollection,
    BoundingSphere,
    ComponentDatatype: {
      DOUBLE: "DOUBLE",
      FLOAT: "FLOAT",
    },
    PrimitiveType: {
      TRIANGLES: "TRIANGLES",
      LINES: "LINES",
    },
    VaryingType: {
      FLOAT: "float",
    },
    UniformType: {
      FLOAT: "float",
      BOOL: "bool",
      MAT4: "mat4",
      VEC3: "vec3",
    },
    CustomShaderMode: {
      MODIFY_MATERIAL: "MODIFY_MATERIAL",
    },
    CustomShaderTranslucencyMode: {
      OPAQUE: 1,
      TRANSLUCENT: 2,
    },
    LightingModel: {
      PBR: 1,
    },
    ScreenSpaceEventHandler,
    SkyBox,
    CameraEventType: {
      LEFT_DRAG: "LEFT_DRAG",
      MIDDLE_DRAG: "MIDDLE_DRAG",
      RIGHT_DRAG: "RIGHT_DRAG",
      WHEEL: "WHEEL",
      PINCH: "PINCH",
    },
    ScreenSpaceEventType: {
      LEFT_DOWN: "LEFT_DOWN",
      MIDDLE_DOWN: "MIDDLE_DOWN",
      RIGHT_DOWN: "RIGHT_DOWN",
      LEFT_UP: "LEFT_UP",
      MIDDLE_UP: "MIDDLE_UP",
      RIGHT_UP: "RIGHT_UP",
      MOUSE_MOVE: "MOUSE_MOVE",
      LEFT_DRAG: "SCREEN_LEFT_DRAG",
      MIDDLE_DRAG: "SCREEN_MIDDLE_DRAG",
      RIGHT_DRAG: "SCREEN_RIGHT_DRAG",
      WHEEL: "SCREEN_WHEEL",
      PINCH: "SCREEN_PINCH",
    },
    SceneMode: {
      SCENE3D: "SCENE3D",
      COLUMBUS_VIEW: "COLUMBUS_VIEW",
    },
    Cesium3DTileRefine: {
      ADD: 0,
      REPLACE: 1,
    },
    ArcType: {
      NONE: "NONE",
    },
    KeyboardEventModifier: {
      SHIFT: "SHIFT",
      CTRL: "CTRL",
      ALT: "ALT",
    },
    ImageMaterialProperty,
    PolygonHierarchy,
    HeadingPitchRange,
    HeadingPitchRoll,
    Matrix4,
    Transforms: {
      eastNorthUpToFixedFrame(origin: unknown) {
        return { kind: "enu", origin };
      },
      headingPitchRollQuaternion(_position: unknown, hpr: unknown) {
        const headingPitchRoll = hpr as { heading: number; pitch: number; roll: number };
        operations.headingPitchRolls.push(headingPitchRoll);
        return { kind: "orientation", hpr };
      },
    },
    SingleTileImageryProvider,
    WebMapServiceImageryProvider,
    WebMapTileServiceImageryProvider,
    Cesium3DTileset: {
      fromUrl(url: string, options: unknown) {
        const leaf = { refine: 0, children: [] as unknown[] };
        const root = { refine: 0, children: [leaf] };
        (leaf as { parent?: unknown }).parent = root;
        return Promise.resolve({
          url,
          options,
          root,
          getTraversal() {
            return {
              selectTiles() {
                return true;
              },
            };
          },
          tileLoad: createTilesetEvent(),
          tileVisible: createTilesetEvent(),
          initialTilesLoaded: createTilesetEvent(),
          allTilesLoaded: createTilesetEvent(),
          show: true,
          destroyed: false,
          isDestroyed() {
            return this.destroyed;
          },
          destroy() {
            if (this.destroyed) {
              const error = new Error("This object was destroyed, i.e., destroy() was called.");
              error.name = "DeveloperError";
              throw error;
            }
            this.destroyed = true;
            operations.primitiveDestroyCount += 1;
            return undefined;
          },
        });
      },
    },
    Cartesian2: class Cartesian2 {
      constructor(readonly x: number, readonly y: number) {}
    },
    Cartesian3: {
      fromDegrees(lon: number, lat: number, height = 0) {
        return { lon, lat, height };
      },
      fromElements(x: number, y: number, z: number) {
        return { x, y, z };
      },
    },
    Rectangle: {
      fromDegrees(west: number, south: number, east: number, north: number) {
        return { west, south, east, north };
      },
    },
    Math: {
      toRadians(value: number) {
        return (value * Math.PI) / 180;
      },
    },
    JulianDate: {
      fromDate(date: Date) {
        return date;
      },
    },
  };
}
