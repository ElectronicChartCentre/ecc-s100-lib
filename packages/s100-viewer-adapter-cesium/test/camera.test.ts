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

describe("@ecc/s100-viewer-adapter-cesium camera", () => {
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

    const nativeCamera = scene.getEngineHandles().instances?.camera as {
      position?: unknown;
      positionWC?: unknown;
    };
    nativeCamera.position = { x: 9_999_999, y: 9_999_999, z: 9_999_999 };
    nativeCamera.positionWC = { frame: "enu", x: 100, y: 100, z: 250 };
    expect(scene.camera.getPose().position).toEqual({ x: 331200, y: 5186520, z: 250 });

    dispatchScreenSpace(cesium, "MIDDLE_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 112, y: 108 },
    });
    dispatchScreenSpace(cesium, "MIDDLE_UP", {
      position: { x: 112, y: 108 },
    });

    expect(cesium.operations.cameraViews).toHaveLength(2);
    expect(scene.camera.getPose().position).toEqual({ x: 331152, y: 5186552, z: 250 });

    dispatchScreenSpace(cesium, "LEFT_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 130, y: 116 },
    });

    expect(cesium.operations.cameraViews).toHaveLength(3);
    expect(scene.camera.getPose().position).toEqual({ x: 331152, y: 5186552, z: 250 });
    expect(scene.camera.getPose().rotation.w).toBeLessThan(1);
    await viewer.destroy();
  });
});
