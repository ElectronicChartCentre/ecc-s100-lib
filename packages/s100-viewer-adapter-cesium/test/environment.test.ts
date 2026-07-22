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

describe("@ecc/s100-viewer-adapter-cesium environment", () => {
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
    expect(cesium.operations.scene.skyBox).toBeUndefined();
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

  it("renders equirectangular background maps with Cesium panoramas", async () => {
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

    scene.environment.setState({
      background: "skybox",
      skyboxUrl: "/textures/skybox_equirectangular.png",
    });

    expect(cesium.operations.equirectangularPanoramas).toHaveLength(1);
    expect(cesium.operations.equirectangularPanoramas[0]).toMatchObject({
      image: "/textures/skybox_equirectangular.png",
      transform: {
        kind: "enu",
        origin: { lon: expect.any(Number), lat: expect.any(Number), height: 0 },
      },
      radius: 100_000,
      repeatHorizontal: 1,
      repeatVertical: 1,
    });
    expect(cesium.operations.primitivesAdded).toContain(cesium.operations.equirectangularPanoramaInstances[0]);
    expect(cesium.operations.skyBoxes).toHaveLength(0);
    expect(cesium.operations.scene.skyBox).toBeUndefined();
    expect(cesium.operations.skyBox.destroyed).toBe(true);
    expect(cesium.operations.skyAtmosphere.show).toBe(false);

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
});
