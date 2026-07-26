import { afterEach, describe, expect, it, vi } from "vitest";
import * as publicApi from "../src/index.js";
import {
  createInMemoryAdapter,
  createS100Viewer,
  createBoundingBox,
  createPrismGeometry,
  createQuatIdentity,
  CameraControlPresets,
  LayerBuilder,
  SceneBuilder,
  S100Error,
  S100ProductSpecificationVersions,
  S100ProductType,
  type BaseLayerSpec,
  type EngineCameraChangeListener,
  type S104WaterLevelSampler,
} from "../src/index.js";

describe("createS100Viewer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the root package surface canonical-only", () => {
    expect(publicApi).toHaveProperty("createS100Viewer");
    expect(publicApi).not.toHaveProperty("Viewer");
    expect(publicApi).not.toHaveProperty("ViewerScene");
    expect(publicApi).not.toHaveProperty("PickInfo");
    expect(publicApi).not.toHaveProperty("CameraUpdate");
    expect(publicApi).not.toHaveProperty("MapDiscardMode");
    expect(publicApi).not.toHaveProperty("MapLayerType");
  });

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

  it("adds LayerBuilder specs through the canonical S100Scene layer API", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene();

    const layer = await scene.layers.add(
      LayerBuilder.createS102({
        id: "viewer-scene-bathymetry",
        url: "https://example.test/s102/tileset.json",
        crs: "EPSG:32633",
      }),
    );

    expect(layer.id).toBe("viewer-scene-bathymetry");
    expect(layer.product).toBe(S100ProductType.S102);
    expect(scene.layers.has("viewer-scene-bathymetry")).toBe(true);
    expect(scene.layers.size).toBe(1);

    await scene.layers.remove(layer);
    expect(scene.layers.size).toBe(0);

    await viewer.destroy();
  });

  it("adds related layer specs as a group and rolls back partial failures", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        failAddLayerIds: ["bad-map"],
      }),
    });
    const scene = await viewer.createScene();

    const added = await scene.layers.addMany([
      LayerBuilder.createS101WmsTemplate({
        id: "map-a",
        urlTemplate: "https://example.test/s101/{z}/{x}/{y}.png",
        extents: {
          minX: 0,
          minY: 0,
          maxX: 10,
          maxY: 10,
        },
      }),
      LayerBuilder.createS101WmsTemplate({
        id: "map-b",
        urlTemplate: "https://example.test/s101-b/{z}/{x}/{y}.png",
        extents: {
          minX: 0,
          minY: 0,
          maxX: 10,
          maxY: 10,
        },
      }),
    ]);

    expect(added.map((layer) => layer.id)).toEqual(["map-a", "map-b"]);
    expect(scene.layers.size).toBe(2);

    await expect(
      scene.layers.addMany([
        LayerBuilder.createS101WmsTemplate({
          id: "rollback-map",
          urlTemplate: "https://example.test/rollback/{z}/{x}/{y}.png",
          extents: {
            minX: 0,
            minY: 0,
            maxX: 10,
            maxY: 10,
          },
        }),
        LayerBuilder.createS101WmsTemplate({
          id: "bad-map",
          urlTemplate: "https://example.test/bad/{z}/{x}/{y}.png",
          extents: {
            minX: 0,
            minY: 0,
            maxX: 10,
            maxY: 10,
          },
        }),
      ]),
    ).rejects.toThrow("configured to fail");

    expect(scene.layers.has("rollback-map")).toBe(false);
    expect(scene.layers.size).toBe(2);

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

  it("plays scene time through availability with timestep rate and looping", async () => {
    vi.useFakeTimers();
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene();
    const timeEvents: number[] = [];
    const playbackEvents: boolean[] = [];
    const start = new Date("2026-05-29T12:00:00Z");
    const middle = new Date("2026-05-29T13:00:00Z");
    const end = new Date("2026-05-29T14:00:00Z");

    scene.time.onChanged((time) => timeEvents.push(time.getTime()));
    scene.events.on("time.playback.changed", (state) => playbackEvents.push(state.playing));

    scene.time.setAvailability({ start, end });
    scene.time.setCurrent(start);
    scene.time.play({
      rate: 10,
      loop: true,
      stepMs: 60 * 60 * 1000,
    });

    expect(scene.time.getPlaybackState()).toMatchObject({
      playing: true,
      rate: 10,
      loop: true,
      stepMs: 60 * 60 * 1000,
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(scene.time.getCurrent().getTime()).toBe(middle.getTime());

    await vi.advanceTimersByTimeAsync(100);
    expect(scene.time.getCurrent().getTime()).toBe(end.getTime());

    await vi.advanceTimersByTimeAsync(100);
    expect(scene.time.getCurrent().getTime()).toBe(start.getTime());

    scene.time.pause();
    await vi.advanceTimersByTimeAsync(500);
    expect(scene.time.getCurrent().getTime()).toBe(start.getTime());
    expect(timeEvents).toEqual([
      start.getTime(),
      middle.getTime(),
      end.getTime(),
      start.getTime(),
    ]);
    expect(playbackEvents).toEqual([true, false]);

    await viewer.destroy();
  });

  it("updates time, camera, sea level, environment, and picking state", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        pickResult: {
          screen: { x: 0, y: 0 },
          source: "terrain",
          depthMeters: 12,
        },
      }),
    });
    const scene = await viewer.createScene({ id: "state-test-scene" });
    const times: string[] = [];
    const seaLevels: number[] = [];
    const waterLevelStates: string[] = [];

    scene.time.onChanged((time) => times.push(time.toISOString()));
    scene.events.on("seaLevel.changed", (value) => seaLevels.push(value));
    scene.waterLevel.onChanged((state) => {
      waterLevelStates.push(`${state.source}:${state.seaLevelMeters}`);
    });

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
    const waterLevelSample = scene.waterLevel.sample({
      coordinate: {
        kind: "projected",
        crs: scene.crs ?? "EPSG:3857",
        x: 1,
        y: 2,
      },
    });

    expect(times).toEqual(["2026-05-29T12:00:00.000Z"]);
    expect(scene.camera.getPose().position).toEqual({ x: 1, y: 2, z: 3 });
    expect(scene.getSeaLevel()).toBe(1.2);
    expect(seaLevels).toEqual([1.2]);
    expect(waterLevelStates).toEqual(["static:1.2"]);
    expect(scene.waterLevel.getState()).toMatchObject({
      sampler: null,
      source: "static",
      seaLevelMeters: 1.2,
    });
    expect(waterLevelSample).toMatchObject({
      status: "value",
      source: "static",
      heightMeters: 1.2,
      samplingMode: "scene-global-sea-level",
      requestedTime: new Date("2026-05-29T12:00:00Z"),
    });
    expect(scene.environment.getState().preset).toBe("day");
    expect(scene.environment.getState().skyboxFaces).toBeUndefined();
    expect(scene.environment.getState().skyboxUrl)
      .toBe("/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr");
    expect(pick?.screen).toEqual({ x: 20, y: 40 });
    expect(pick?.depthMeters).toBe(12);

    await viewer.destroy();
  });

  it("exposes an S-104 sampler through the scene water-level field", async () => {
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene({ id: "s104-water-level-field-scene" });
    const coordinate = {
      kind: "projected" as const,
      crs: scene.crs ?? "EPSG:3857",
      x: 100,
      y: 200,
    };
    const sampleFromSampler = vi.fn((options: Parameters<S104WaterLevelSampler["sample"]>[0]) => {
      const requestedTime = new Date(options.time);
      return {
        status: "value" as const,
        heightMeters: 2.4,
        trend: "steady" as const,
        coordinate,
        requestedCoordinate: options.coordinate,
        projectedCoordinate: coordinate,
        sourceTime: requestedTime,
        requestedTime,
        timeIndex: 0,
        gridIndex: { i: 0, j: 0 },
        linearIndex: 0,
        datasetId: "s104-stavanger",
        verticalDatum: "MSL",
        samplingMode: "s104-nearest-neighbor" as const,
      };
    });
    const sampler: S104WaterLevelSampler = {
      sample: sampleFromSampler,
    };
    const sources: string[] = [];

    scene.waterLevel.onChanged((state) => {
      sources.push(state.source);
    });
    scene.time.setCurrent(new Date("2026-07-26T00:00:00Z"));
    scene.waterLevel.setSampler(sampler);

    const sample = scene.waterLevel.sample({ coordinate });

    expect(sources).toEqual(["s104"]);
    expect(scene.waterLevel.getSampler()).toBe(sampler);
    expect(scene.waterLevel.getState()).toMatchObject({
      sampler,
      source: "s104",
      seaLevelMeters: 0,
    });
    expect(sampleFromSampler).toHaveBeenCalledWith({
      coordinate,
      time: new Date("2026-07-26T00:00:00Z"),
    });
    expect(sample).toMatchObject({
      status: "value",
      source: "s104",
      heightMeters: 2.4,
      datasetId: "s104-stavanger",
      verticalDatum: "MSL",
    });

    scene.setSeaLevel(1.1);
    scene.waterLevel.setSampler(null);
    expect(scene.waterLevel.sample({ coordinate })).toMatchObject({
      status: "value",
      source: "static",
      heightMeters: 1.1,
      samplingMode: "scene-global-sea-level",
    });

    await viewer.destroy();
  });

  it("reports simulated water level as the source for engine-origin sea-level changes", async () => {
    let engineSeaLevel = 3.2;
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        getSeaLevel: () => engineSeaLevel,
      }),
    });
    const scene = await viewer.createScene({ id: "simulated-water-level-field-scene" });
    const coordinate = {
      kind: "projected" as const,
      crs: scene.crs ?? "EPSG:3857",
      x: 0,
      y: 0,
    };

    scene.time.setCurrent(new Date("2026-07-26T00:00:00Z"));
    expect(scene.getSeaLevel()).toBe(3.2);
    expect(scene.waterLevel.getState()).toMatchObject({
      sampler: null,
      source: "simulated-water-level",
      seaLevelMeters: 3.2,
    });
    expect(scene.waterLevel.sample({ coordinate })).toMatchObject({
      status: "value",
      source: "simulated-water-level",
      heightMeters: 3.2,
      samplingMode: "scene-global-sea-level",
    });

    engineSeaLevel = 3.4;
    scene.time.setCurrent(new Date("2026-07-26T00:10:00Z"));
    expect(scene.waterLevel.sample({ coordinate })).toMatchObject({
      source: "simulated-water-level",
      heightMeters: 3.4,
    });

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
            depthMeters: 3,
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
      depthMeters: 3,
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
