import type {
  CameraControlConfig,
  CameraLookAt,
  EngineCameraChangeListener,
  EngineCameraPose,
  EngineHandleBundle,
  EngineLayerHandle,
  EngineLayerPatchListener,
  EnginePrismCorners2D,
  EngineRgba,
  EngineScene,
  EnvironmentState,
  LayerPatch,
  LivePickingOptions,
  PickRequest,
  PickResult,
  BaseLayerSpec,
  SceneOptions,
  WaterLevelFieldSource,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import type { ThreeAdapterOptions } from "../options.js";
import { ThreeCameraController } from "../camera/ThreeCameraController.js";
import {
  getProjectedLocalReference,
  projectedMetersToWorld,
} from "../coordinates/projectedLocal.js";
import { ThreeEnvironmentController } from "../environment/environment.js";
import { LayerRegistry } from "../layers/LayerRegistry.js";
import { ThreePicking } from "../picking/ThreePicking.js";
import { disposeThreeObject } from "../shared/dispose.js";

export class ThreeEngineScene implements EngineScene {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly reference;
  private readonly cameraController: ThreeCameraController;
  private readonly environment: ThreeEnvironmentController;
  private readonly layers: LayerRegistry;
  private readonly picking: ThreePicking;
  private readonly livePickingHandler = (event: PointerEvent) => {
    if (!this.livePickingOptions.enabled) {
      return;
    }
    const request: PickRequest = {
      screenX: event.clientX,
      screenY: event.clientY,
    };
    if (this.livePickingOptions.fallback !== undefined) {
      request.fallback = this.livePickingOptions.fallback;
    }
    this.livePickingEmit?.(
      this.picking.pick(request),
    );
  };
  private currentTime = new Date(0);
  private seaLevel = 0;
  private seaLevelSource: WaterLevelFieldSource = "static";
  private cameraChangeListener: EngineCameraChangeListener | null = null;
  private livePickingOptions: LivePickingOptions = { enabled: false };
  private livePickingEmit: ((result: PickResult | null) => void) | null = null;
  private hoverPrism: THREE.Object3D | null = null;
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    options: SceneOptions,
    private readonly adapterOptions: ThreeAdapterOptions,
  ) {
    this.reference = getProjectedLocalReference(options);
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.camera = new THREE.PerspectiveCamera(45, size.x / Math.max(1, size.y), 0.1, 10_000_000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(700, -900, 550);
    this.camera.lookAt(0, 0, 0);
    this.cameraController = new ThreeCameraController(
      this.camera,
      this.renderer.domElement,
      this.reference,
      () => this.seaLevel,
      (pose) => this.cameraChangeListener?.(pose),
    );
    this.environment = new ThreeEnvironmentController(
      this.scene,
      this.renderer,
      adapterOptions.backgroundColor ?? 0x17202a,
    );
    this.layers = new LayerRegistry(
      this.scene,
      this.camera,
      this.renderer,
      this.reference,
      adapterOptions.fetchHandler,
      () => this.seaLevel,
      (value, source) => this.setSeaLevel(value, source),
      (suppressed) => this.cameraController.setInteractionSuppressed(suppressed),
    );
    this.picking = new ThreePicking(
      this.camera,
      this.renderer.domElement,
      this.layers,
      this.reference,
      () => this.seaLevel,
    );
  }

  getEngineHandles(): EngineHandleBundle {
    return {
      adapterId: "three",
      engineName: "Three.js Reference",
      engineVersion: `three r${THREE.REVISION}`,
      engineInstance: this.scene,
      instances: {
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        canvas: this.renderer.domElement,
      },
      staticObjects: {
        THREE,
      },
      resources: {
        threeDocs: "https://threejs.org/docs/",
        tilesRendererDocs: "https://github.com/NASA-AMMOS/3DTilesRendererJS",
      },
    };
  }

  setCamera(pose: EngineCameraPose): void {
    this.cameraController.setPose(pose);
  }

  getCamera(): EngineCameraPose {
    return this.cameraController.getPose();
  }

  lookAt(view: CameraLookAt): void {
    this.cameraController.lookAt(view);
  }

  setCameraChangeListener(listener: EngineCameraChangeListener | null): void {
    this.cameraChangeListener = listener;
  }

  setCameraControls(config: CameraControlConfig): void {
    this.cameraController.setControls(config);
  }

  setTime(time: Date): void {
    this.currentTime = new Date(time);
    this.layers.update(this.currentTime);
  }

  setSeaLevel(value: number, source: WaterLevelFieldSource = "static"): void {
    this.seaLevel = Number.isFinite(value) ? value : 0;
    this.seaLevelSource = source;
  }

  getSeaLevel(): number {
    return this.seaLevel;
  }

  getSeaLevelSource(): WaterLevelFieldSource {
    return this.seaLevelSource;
  }

  setEnvironment(state: EnvironmentState): void {
    this.environment.setEnvironment(state);
  }

  setLayerPatchListener(listener: EngineLayerPatchListener | null): void {
    void listener;
  }

  async addLayer(spec: BaseLayerSpec): Promise<EngineLayerHandle> {
    return this.layers.addLayer(spec);
  }

  async updateLayer(handle: EngineLayerHandle, patch: LayerPatch): Promise<void> {
    await this.layers.updateLayer(handle, patch);
  }

  async removeLayer(handle: EngineLayerHandle): Promise<void> {
    await this.layers.removeLayer(handle);
  }

  async pick(request: PickRequest): Promise<PickResult | null> {
    return this.picking.pick(request);
  }

  setLivePickingMode(
    options: LivePickingOptions,
    emitPick: (result: PickResult | null) => void,
  ): void {
    const wasEnabled = this.livePickingOptions.enabled;
    this.livePickingOptions = options;
    this.livePickingEmit = options.enabled ? emitPick : null;
    this.picking.setLiveMode(options);
    if (!wasEnabled && options.enabled) {
      this.renderer.domElement.addEventListener("pointermove", this.livePickingHandler);
    }
    if (wasEnabled && !options.enabled) {
      this.renderer.domElement.removeEventListener("pointermove", this.livePickingHandler);
    }
  }

  showHoverPrism(
    corners: EnginePrismCorners2D,
    zPos = 0,
    height = 20,
    rgba: EngineRgba = { r: 0.2, g: 0.7, b: 1, a: 0.3 },
  ): void {
    this.clearHoverPrism();
    const shape = new THREE.Shape([
      new THREE.Vector2(corners.topLeft[0], corners.topLeft[1]),
      new THREE.Vector2(corners.topRight[0], corners.topRight[1]),
      new THREE.Vector2(corners.bottomRight[0], corners.bottomRight[1]),
      new THREE.Vector2(corners.bottomLeft[0], corners.bottomLeft[1]),
    ]);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(rgba.r, rgba.g, rgba.b),
      transparent: true,
      opacity: rgba.a,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(projectedMetersToWorld(0, 0, zPos, this.reference));
    this.hoverPrism = mesh;
    this.scene.add(mesh);
  }

  clearHoverPrism(): void {
    if (!this.hoverPrism) {
      return;
    }
    this.scene.remove(this.hoverPrism);
    disposeThreeObject(this.hoverPrism);
    this.hoverPrism = null;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    if (this.disposed) {
      return;
    }
    this.cameraController.update();
    this.layers.update(this.currentTime);
    this.renderer.render(this.scene, this.camera);
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer.domElement.removeEventListener("pointermove", this.livePickingHandler);
    this.clearHoverPrism();
    this.cameraController.destroy();
    this.picking.destroy();
    this.environment.dispose();
    await this.layers.destroy();
  }
}
