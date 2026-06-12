import { describe, expect, it } from "vitest";
import {
  createInMemoryAdapter,
  createS100Viewer,
  createBoundingBox,
  createPrismGeometry,
  createQuatIdentity,
  CameraControlPresets,
  SceneBuilder,
  S100Error,
  S100ProductSpecificationVersions,
  S100ProductType,
  type BaseLayerSpec,
  type EngineCameraChangeListener,
  type EngineLayerHandle,
  type EngineLayerPatchListener,
} from "../src/index.js";

describe("createS100Viewer", () => {
  it("provides engine-neutral tuple and prism geometry helpers", () => {
    expect(createQuatIdentity()).toEqual([0, 0, 0, 1]);
    expect(createBoundingBox([-1, -2, -3], [1, 2, 3])).toEqual({
      min: [-1, -2, -3],
      max: [1, 2, 3],
    });

    const prism = createPrismGeometry(
      {
        topLeft: [0, 1],
        topRight: [1, 1],
        bottomLeft: [0, 0],
        bottomRight: [1, 0],
      },
      -1,
      2,
    );

    expect(prism.vertices).toHaveLength(36);
    expect(prism.normals).toHaveLength(36);
    expect(prism.texCoords).toHaveLength(36);
    expect(prism.indices).toHaveLength(36);
  });

  it("builds projected-local scene georeferences without coordinate boilerplate", () => {
    expect(
      SceneBuilder.projectedLocal({
        crs: "EPSG:32633",
        origin: {
          x: 500000,
          y: 7000000,
          z: 0,
        },
      }),
    ).toEqual({
      mode: "projected-local",
      crs: "EPSG:32633",
      origin: {
        kind: "projected",
        crs: "EPSG:32633",
        x: 500000,
        y: 7000000,
        z: 0,
      },
      upAxis: "z",
      units: "meters",
    });
  });

  it("creates a scene, manages layer lifecycle, and emits layer events", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene({ id: "core-test-scene" });
    const events: string[] = [];
    const updatedOpacities: number[] = [];

    scene.events.on("layer.added", (layer) => events.push(`added:${layer.id}`));
    scene.events.on("layer.updated", (layer) => {
      events.push(`updated:${layer.id}`);
      updatedOpacities.push(layer.opacity);
    });
    scene.events.on("layer.removed", (layer) => events.push(`removed:${layer.id}`));

    const layer = await scene.layers.add<BaseLayerSpec<typeof S100ProductType.S102>>({
      id: "bathymetry",
      product: S100ProductType.S102,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
      },
      opacity: 0.75,
    });

    await layer.update({ opacity: 0.5, visible: false });
    const removed = await scene.layers.remove("bathymetry");

    expect(removed).toBe(true);
    expect(layer.opacity).toBe(0.5);
    expect(layer.visible).toBe(false);
    expect(scene.layers.size).toBe(0);
    expect(updatedOpacities).toEqual([0.5]);
    expect(events).toEqual(["added:bathymetry", "updated:bathymetry", "removed:bathymetry"]);

    await viewer.destroy();
  });

  it("applies adapter-originated layer patches through normal layer events", async () => {
    let emitAdapterPatch: EngineLayerPatchListener | null = null;
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        onLayerPatchListener: (listener) => {
          emitAdapterPatch = listener;
        },
      }),
    });
    const scene = await viewer.createScene({ id: "adapter-patch-test-scene" });
    const layerEvents: string[] = [];
    const changedEvents: string[] = [];

    scene.events.on("layer.updated", (layer) => {
      layerEvents.push(`${layer.id}:${layer.opacity}:${String(layer.visible)}`);
    });

    const layer = await scene.layers.add<BaseLayerSpec<typeof S100ProductType.S102>>({
      id: "adapter-updated-bathymetry",
      product: S100ProductType.S102,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
      },
      opacity: 1,
    });

    layer.onChanged((updatedLayer) => {
      changedEvents.push(`${updatedLayer.id}:${updatedLayer.opacity}:${String(updatedLayer.visible)}`);
    });

    const handle = (layer as unknown as { engineLayerHandle: EngineLayerHandle }).engineLayerHandle;
    expect(typeof emitAdapterPatch).toBe("function");
    const adapterPatchListener = emitAdapterPatch as unknown as EngineLayerPatchListener;
    adapterPatchListener({
      handle,
      patch: {
        opacity: 0.35,
        visible: false,
      },
      source: "test-adapter",
    });

    expect(layer.opacity).toBe(0.35);
    expect(layer.visible).toBe(false);
    expect(layer.spec.opacity).toBe(0.35);
    expect(layer.spec.visible).toBe(false);
    expect(changedEvents).toEqual(["adapter-updated-bathymetry:0.35:false"]);
    expect(layerEvents).toEqual(["adapter-updated-bathymetry:0.35:false"]);

    await viewer.destroy();
  });

  it("rejects unsupported scene georeference modes during capability negotiation", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        capabilities: {
          sceneGeoreferences: ["projected-local"],
        },
      }),
    });

    await expect(
      viewer.createScene({
        georeference: {
          mode: "ellipsoid-ecef",
          ellipsoid: "WGS84",
          units: "meters",
        },
      }),
    ).rejects.toBeInstanceOf(S100Error);

    await viewer.destroy();
  });

  it("validates adapter product specification version support metadata", async () => {
    await expect(
      createS100Viewer({
        adapter: createInMemoryAdapter({
          capabilities: {
            supportedProductVersions: [
              {
                product: S100ProductType.S102,
                versions: [S100ProductSpecificationVersions.S102.LATEST_CONFIRMED_SUPPORTED],
                defaultVersion: "INT.IHO.S-102.999.0",
              },
            ],
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "adapter-capability",
    });
  });

  it("updates time, camera, sea level, environment, and picking state", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        pickResult: {
          screen: { x: 0, y: 0 },
          source: "terrain",
          depthMeters: -12,
        },
      }),
    });
    const scene = await viewer.createScene({ id: "state-test-scene" });
    const times: string[] = [];
    const seaLevels: number[] = [];

    scene.time.onChanged((time) => times.push(time.toISOString()));
    scene.events.on("seaLevel.changed", (value) => seaLevels.push(value));

    scene.time.setCurrent(new Date("2026-05-29T12:00:00Z"));
    scene.camera.setPose({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    });
    scene.setSeaLevel(1.2);
    scene.environment.setState({ preset: "day" });
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
    });
    expect(scene.environment.getState().skyboxUrl).toBeUndefined();
    scene.environment.setState({
      skyboxUrl: "/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr",
    });
    const pick = await scene.picking.pick({ screenX: 20, screenY: 40 });

    expect(times).toEqual(["2026-05-29T12:00:00.000Z"]);
    expect(scene.camera.getPose().position).toEqual({ x: 1, y: 2, z: 3 });
    expect(scene.getSeaLevel()).toBe(1.2);
    expect(seaLevels).toEqual([1.2]);
    expect(scene.environment.getState().preset).toBe("day");
    expect(scene.environment.getState().skyboxFaces).toBeUndefined();
    expect(scene.environment.getState().skyboxUrl)
      .toBe("/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr");
    expect(pick?.screen).toEqual({ x: 20, y: 40 });
    expect(pick?.depthMeters).toBe(-12);

    await viewer.destroy();
  });

  it("forwards native adapter camera changes through the scene camera event", async () => {
    let emitNativeCameraChange: EngineCameraChangeListener | null = null;
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        onCameraChangeListener: (listener) => {
          emitNativeCameraChange = listener;
        },
      }),
    });
    const scene = await viewer.createScene({ id: "native-camera-event-scene" });
    const cameraEvents: Array<string> = [];

    scene.camera.onChanged((pose) => {
      cameraEvents.push(
        `${pose.position.x},${pose.position.y},${pose.position.z}:${pose.rotation.z}:${pose.focalDistance}`,
      );
    });

    expect(typeof emitNativeCameraChange).toBe("function");
    const emitCameraChange = emitNativeCameraChange as unknown as EngineCameraChangeListener;
    emitCameraChange({
      position: { x: 4, y: 5, z: 6 },
      rotation: { x: 0, y: 0, z: 0.5, w: 0.5 },
      focalDistance: 25,
    });

    expect(cameraEvents).toEqual(["4,5,6:0.5:25"]);

    await viewer.destroy();
    expect(emitNativeCameraChange).toBeNull();
  });

  it("applies optional viewer-level camera controls to engine scenes", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter(),
    });
    expect(viewer.getCameraControls()).toMatchObject({
      preset: "s100-default",
      enabled: true,
    });

    const scene = await viewer.createScene({ id: "camera-controls-default-scene" });
    const defaultLayer = await scene.layers.add<BaseLayerSpec<typeof S100ProductType.S102>>({
      id: "default-controls-layer",
      product: S100ProductType.S102,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
      },
    });
    expect(defaultLayer.getNativeHandle<{ cameraControls?: { preset?: string; pointer?: unknown[] } }>())
      .toMatchObject({
        cameraControls: {
          preset: "s100-default",
          pointer: expect.arrayContaining([
            expect.objectContaining({ action: "orbit", button: "left" }),
            expect.objectContaining({ action: "pan", button: "middle" }),
            expect.objectContaining({ action: "zoom", button: "right" }),
          ]),
        },
      });

    viewer.setCameraControls(CameraControlPresets.DISABLED);
    const customScene = await viewer.createScene({ id: "camera-controls-disabled-scene" });
    const disabledLayer = await customScene.layers.add<BaseLayerSpec<typeof S100ProductType.S102>>({
      id: "disabled-controls-layer",
      product: S100ProductType.S102,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
      },
    });
    expect(disabledLayer.getNativeHandle<{ cameraControls?: { preset?: string; enabled?: boolean } }>())
      .toMatchObject({
        cameraControls: {
          preset: "disabled",
          enabled: false,
        },
      });

    await viewer.destroy();
  });

  it("forwards live picking mode changes to the engine scene", async () => {
    const liveModes: unknown[] = [];
    const pickEvents: unknown[] = [];
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        onLivePickingMode: (options, emitPick) => {
          liveModes.push(options);
          emitPick({
            screen: { x: 10, y: 20 },
            source: "terrain",
            world: {
              kind: "engine-local",
              x: 1,
              y: 2,
              z: -3,
              frameId: "test",
            },
            depthMeters: -3,
          });
        },
      }),
    });
    const scene = await viewer.createScene({ id: "live-picking-test-scene" });
    scene.events.on("pick.changed", (pick) => pickEvents.push(pick));

    scene.picking.setLiveMode({
      enabled: true,
      includeVisual: true,
      fallback: "sea-level-plane",
      visual: {
        lineThickness: 2,
      },
    });

    expect(liveModes).toEqual([
      {
        enabled: true,
        includeVisual: true,
        fallback: "sea-level-plane",
        visual: {
          lineThickness: 2,
        },
      },
    ]);
    expect(pickEvents).toHaveLength(1);
    expect(pickEvents[0]).toMatchObject({
      screen: { x: 10, y: 20 },
      source: "terrain",
      depthMeters: -3,
    });

    await viewer.destroy();
  });

  it("exposes adapter capabilities through viewer and scene methods", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        capabilities: {
          visualFeatures: {
            depthRay: true,
            dynamicLighting: false,
          },
        },
      }),
    });
    const scene = await viewer.createScene();

    expect(viewer.getCapabilities()).toBe(viewer.capabilities);
    expect(scene.getCapabilities()).toBe(scene.adapterCapabilities);
    expect(scene.getCapabilities().visualFeatures).toMatchObject({
      depthRay: true,
      dynamicLighting: false,
    });

    await viewer.destroy();
  });

  it("exposes borrowed engine handles at viewer and scene levels", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter(),
    });

    const viewerHandles = viewer.getEngineHandles();
    expect(viewerHandles).toMatchObject({
      adapterId: "in-memory",
      engineName: "In-memory test adapter",
      engineInstance: {
        kind: "in-memory-viewer-host",
        destroyed: false,
      },
    });
    expect(viewerHandles.staticObjects).toBeUndefined();

    const scene = await viewer.createScene({ id: "engine-handles-test-scene" });
    const sceneHandles = scene.getEngineHandles();

    expect(sceneHandles).toMatchObject({
      adapterId: "in-memory",
      engineName: "In-memory test adapter",
      instances: {
        sceneOptions: {
          id: "engine-handles-test-scene",
        },
      },
    });
    expect(sceneHandles.engineInstance).not.toBe(viewerHandles.engineInstance);
    expect(sceneHandles.resources).toMatchObject({
      docs: "memory://s100-viewer/in-memory-scene",
    });

    await scene.destroy();
    expect(() => scene.getEngineHandles()).toThrow(S100Error);

    await viewer.destroy();
    expect(() => viewer.getEngineHandles()).toThrow(S100Error);
  });

  it("falls back to adapter identity when viewer hosts omit handle bundles", async () => {
    const baseAdapter = createInMemoryAdapter({
      id: "hookless",
      displayName: "Hookless adapter",
    });
    const adapter = {
      ...baseAdapter,
      async createViewerHost(options: Parameters<typeof baseAdapter.createViewerHost>[0]) {
        const host = await baseAdapter.createViewerHost(options);
        return {
          createScene: host.createScene.bind(host),
          destroy: host.destroy.bind(host),
        };
      },
    };
    const viewer = await createS100Viewer({ adapter });

    expect(viewer.getEngineHandles()).toEqual({
      adapterId: "hookless",
      engineName: "Hookless adapter",
    });

    await viewer.destroy();
  });

  it("provides a depth ray controller over visual live picking", async () => {
    const liveModes: unknown[] = [];
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        onLivePickingMode: (options) => {
          liveModes.push(options);
        },
      }),
    });
    const scene = await viewer.createScene();

    scene.depthRay.setState({
      enabled: true,
      lineThickness: 6,
      seaLevelMarkerVisible: false,
    });

    expect(scene.depthRay.getState()).toMatchObject({
      enabled: true,
      lineThickness: 6,
      seaLevelMarkerVisible: false,
    });
    expect(liveModes).toEqual([
      expect.objectContaining({
        enabled: true,
        includeVisual: true,
        fallback: "sea-level-plane",
        visual: expect.objectContaining({
          lineThickness: 6,
          seaLevelMarkerVisible: false,
        }),
      }),
    ]);

    scene.depthRay.setEnabled(false);
    expect(liveModes.at(-1)).toMatchObject({
      enabled: false,
      includeVisual: false,
    });

    await viewer.destroy();
  });
});
