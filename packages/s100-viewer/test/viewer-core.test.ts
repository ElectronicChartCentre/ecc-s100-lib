import { afterEach, describe, expect, it, vi } from "vitest";
import * as publicApi from "../src/index.js";
import {
  createInMemoryAdapter,
  createS100Viewer,
  createBoundingBox,
  createPrismGeometry,
  createQuatIdentity,
  Coordinates,
  CameraControlPresets,
  LayerBuilder,
  ProjectedMapDiscardMode,
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

  it("exposes typed controllers from canonical product layers", async () => {
    const projectedPosition = (x: number, y: number, z: number) =>
      Coordinates.projected({
        crs: "EPSG:32633",
        x,
        y,
        z,
      });
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene();
    const timeEvents: number[] = [];
    scene.time.onChanged((time) => timeEvents.push(time.getTime()));

    const terrain = await scene.layers.add(
      LayerBuilder.createS102({
        id: "controlled-s102",
        url: "https://example.test/s102/tileset.json",
        rendering: {
          detailFactor: 250,
        },
        style: {
          safetyDepthMeters: 1,
          contours: {
            visible: false,
            intervalMeters: 5,
          },
        },
      }),
    );

    await terrain.controllers.terrain.setSafetyDepthMeters(8);
    await terrain.controllers.terrain.setContours({
      visible: true,
      intervalMeters: 3,
    });
    await terrain.controllers.terrain.setTileBoundsVisible(true);
    await terrain.controllers.terrain.setDetailFactor(700);

    expect(terrain.controllers.terrain.terrain.safetyDepthMeters).toBe(8);
    expect(terrain.controllers.terrain.terrain.showContour).toBe(true);
    expect(terrain.controllers.terrain.terrain.contourInterval).toBe(3);
    expect(terrain.controllers.terrain.settings.renderBBoxes).toBe(true);
    expect(terrain.spec.style).toMatchObject({
      safetyDepthMeters: 8,
      contours: {
        visible: true,
        intervalMeters: 3,
      },
    });
    expect(terrain.spec.rendering).toMatchObject({
      detailFactor: 700,
    });
    expect(terrain.spec.debug).toMatchObject({
      showTileBounds: true,
    });

    await terrain.update({
      style: {
        ...terrain.spec.style,
        safetyDepthMeters: 4,
        contours: {
          visible: false,
          intervalMeters: 9,
        },
      },
    });
    expect(terrain.controllers.terrain.terrain.safetyDepthMeters).toBe(4);
    expect(terrain.controllers.terrain.terrain.showContour).toBe(false);
    expect(terrain.controllers.terrain.terrain.contourInterval).toBe(9);

    await terrain.controllers.terrain.updateDisplayStyle({
      unsafeDepth: -6,
    });
    expect(terrain.controllers.terrain.terrain.safetyDepthMeters).toBe(6);
    expect(terrain.spec.style?.safetyDepthMeters).toBe(6);
    expect(terrain.spec.style?.unsafeDepth).toBeUndefined();

    const currents = await scene.layers.add(
      LayerBuilder.createStaticS111({
        id: "controlled-s111",
        data: {
          dateTimeOfFirstRecord: "20260529T120000Z",
          timeRecordInterval: 3600,
          numberOfTimes: 3,
        },
        style: {
          renderer: "arrows",
          scale: "auto",
        },
      }),
    );

    expect(currents.controllers.surfaceCurrent.time.startTime)
      .toBe(Date.parse("2026-05-29T12:00:00Z"));
    expect(currents.controllers.surfaceCurrent.time.endTime)
      .toBe(Date.parse("2026-05-29T14:00:00Z"));

    await currents.controllers.surfaceCurrent.setCustomScale(2.5);
    expect(currents.controllers.surfaceCurrent.disableAutoScaling).toBe(true);
    expect(currents.controllers.surfaceCurrent.customScale).toBe(2.5);
    expect(currents.spec.style).toMatchObject({
      scale: 2.5,
    });

    currents.controllers.surfaceCurrent.setCurrentTime(Date.parse("2026-05-29T13:00:00Z"));
    expect(scene.time.getCurrent().getTime()).toBe(Date.parse("2026-05-29T13:00:00Z"));
    expect(timeEvents.at(-1)).toBe(Date.parse("2026-05-29T13:00:00Z"));

    await currents.controllers.surfaceCurrent.setAutoScaling(true);
    expect(currents.controllers.surfaceCurrent.disableAutoScaling).toBe(false);
    expect(currents.controllers.surfaceCurrent.scalingMode).toBe("auto");
    expect(currents.spec.style).toMatchObject({
      scale: "auto",
    });

    await currents.update({
      style: {
        ...currents.spec.style,
        renderer: "arrows",
        scale: 4,
      },
    });
    expect(currents.controllers.surfaceCurrent.scalingMode).toBe("custom");
    expect(currents.controllers.surfaceCurrent.customScale).toBe(4);

    scene.time.setCurrent(new Date("2026-05-29T14:00:00Z"));
    expect(currents.controllers.surfaceCurrent.time.currentTime)
      .toBe(Date.parse("2026-05-29T14:00:00Z"));

    const map = await scene.layers.add(
      LayerBuilder.createS57WmsTemplate({
        id: "controlled-s57",
        urlTemplate: "https://example.test/s57/{z}/{x}/{y}.png",
        visible: true,
        opacity: 1,
        extents: {
          minX: 0,
          minY: 0,
          maxX: 10,
          maxY: 10,
        },
        discardMode: ProjectedMapDiscardMode.None,
      }),
    );

    await map.controllers.map.setAlpha(0.4);
    await map.controllers.map.setVisibility(false);
    await map.controllers.map.setDiscardMode(ProjectedMapDiscardMode.MaskLayerAlphaOne);

    expect(map.controllers.map.alpha).toBe(0.4);
    expect(map.controllers.map.discardMode).toBe(ProjectedMapDiscardMode.MaskLayerAlphaOne);
    expect(map.opacity).toBe(0.4);
    expect(map.visible).toBe(false);
    expect(map.spec.mapRendering).toMatchObject({
      discardMode: ProjectedMapDiscardMode.MaskLayerAlphaOne,
    });

    await map.update({
      opacity: 0.8,
      mapRendering: {},
      extensions: {
        ...map.spec.extensions,
        cogs: {
          ...((map.spec.extensions?.cogs as Record<string, unknown> | undefined) ?? {}),
          discardMode: ProjectedMapDiscardMode.None,
        },
      },
    });
    expect(map.controllers.map.alpha).toBe(0.8);
    expect(map.controllers.map.discardMode).toBe(ProjectedMapDiscardMode.None);

    const vessel = await scene.layers.add(
      LayerBuilder.createVessel({
        id: "controlled-vessel",
        url: "https://example.test/assets/vessel.glb",
        pose: {
          position: {
            kind: "projected",
            crs: "EPSG:32633",
            x: 500000,
            y: 7000000,
            z: 0,
          },
          headingDegrees: 12,
        },
        dimensions: {
          draught: 8,
          bow: 40,
          stern: 30,
          port: 10,
          starboard: 12,
        },
        model: {
          orientation: [0, 0, 0, 1],
          boundingBox: {
            min: [-10, -30, -8],
            max: [12, 40, 4],
          },
        },
        style: {
          showSeaLevelIndicator: true,
          transformControls: "translate",
        },
      }),
    );
    const vesselPositions: unknown[] = [];
    const vesselHeadings: number[] = [];
    vessel.controllers.vessel.onPositionChanged((position) => {
      vesselPositions.push(position);
    });
    vessel.controllers.vessel.onHeadingChanged((heading) => {
      vesselHeadings.push(heading);
    });

    await vessel.controllers.vessel.setPosition(projectedPosition(500010, 7000020, -3));
    await vessel.controllers.vessel.setHeading(725);
    await vessel.controllers.vessel.setDimensions({
      draught: 9,
      bow: 42,
      stern: 31,
      port: 11,
      starboard: 13,
    });
    await vessel.controllers.vessel.setVisibility(false);
    await vessel.controllers.vessel.setSeaLevelIndicatorMode("off");
    await vessel.controllers.vessel.setOceanSurfaceVisible(true);
    await vessel.controllers.vessel.setTransformMode("rotate");

    expect(vessel.controllers.vessel.getPosition()).toEqual(
      projectedPosition(500010, 7000020, -3),
    );
    expect(vessel.controllers.vessel.getPose()).toMatchObject({
      position: projectedPosition(500010, 7000020, -3),
      headingDegrees: 5,
    });
    expect(vessel.controllers.vessel.getHeading()).toBe(5);
    expect(vesselPositions).toEqual([projectedPosition(500010, 7000020, -3)]);
    expect(vesselHeadings).toEqual([5]);
    expect(vessel.visible).toBe(false);
    expect(vessel.spec.pose.position).toMatchObject({
      kind: "projected",
      crs: "EPSG:32633",
      x: 500010,
      y: 7000020,
      z: -3,
    });
    expect(vessel.spec.pose.headingDegrees).toBe(5);
    expect(vessel.spec.dimensions).toEqual({
      draught: 9,
      bow: 42,
      stern: 31,
      port: 11,
      starboard: 13,
    });
    expect(vessel.spec.style).toMatchObject({
      showSeaLevelIndicator: false,
      showOceanSurface: true,
      oceanSurface: true,
      transformControls: "rotate",
    });
    expect(vessel.spec.model).toMatchObject({
      orientation: [0, 0, 0, 1],
      boundingBox: {
        min: [-10, -30, -8],
        max: [12, 40, 4],
      },
    });
    expect(vessel.spec.rendering).toMatchObject({
      seaLevelIndicator: false,
      oceanSurfaceVisible: true,
    });

    await vessel.controllers.vessel.setPose({
      position: projectedPosition(500020, 7000030, -4),
      headingDegrees: 185,
    });
    expect(vessel.controllers.vessel.getPosition()).toEqual(
      projectedPosition(500020, 7000030, -4),
    );
    expect(vessel.controllers.vessel.getHeading()).toBe(185);

    const pendingHeading = vessel.controllers.vessel.setHeading(270);
    const pendingPosition = vessel.controllers.vessel.setPosition(
      projectedPosition(500030, 7000040, -5),
    );
    await Promise.all([pendingHeading, pendingPosition]);
    expect(vessel.controllers.vessel.getPosition()).toEqual(
      projectedPosition(500030, 7000040, -5),
    );
    expect(vessel.controllers.vessel.getHeading()).toBe(270);

    let rapidPoseUpdates = 0;
    const unsubscribeRapidPoseUpdates = vessel.onChanged(() => {
      rapidPoseUpdates += 1;
    });
    const rapidUpdates = [
      vessel.controllers.vessel.setPosition(projectedPosition(500040, 7000050, -6)),
      vessel.controllers.vessel.setPosition(projectedPosition(500050, 7000060, -7)),
      vessel.controllers.vessel.setPose({
        position: projectedPosition(500060, 7000070, -8),
        headingDegrees: 315,
      }),
    ];
    await Promise.all(rapidUpdates);
    unsubscribeRapidPoseUpdates();
    expect(rapidPoseUpdates).toBe(1);
    expect(vessel.controllers.vessel.getPosition()).toEqual(
      projectedPosition(500060, 7000070, -8),
    );
    expect(vessel.controllers.vessel.getHeading()).toBe(315);

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
    expect(pick?.depthMeters).toBe(12);

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
