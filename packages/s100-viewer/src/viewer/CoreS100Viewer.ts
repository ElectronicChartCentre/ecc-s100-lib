import type { AdapterCapabilities, EngineViewerHost, S100EngineAdapter } from "../adapters/types.js";
import {
  cloneCameraControlConfig,
  normalizeCameraControlConfig,
  type CameraControlConfig,
} from "../camera/types.js";
import { S100Error } from "../errors/S100Error.js";
import { CoreS100Scene } from "../scene/CoreS100Scene.js";
import type { SceneOptions, S100Scene } from "../scene/types.js";
import {
  assertSceneGeoreferenceSupported,
  normalizeSceneOptions,
  validateAdapterCapabilities,
} from "../validation.js";
import type { S100Viewer } from "./types.js";

export class CoreS100Viewer implements S100Viewer {
  private readonly scenes = new Set<S100Scene>();
  private readonly engineScenes = new Map<S100Scene, { setCameraControls?: (config: CameraControlConfig) => void }>();
  private readonly adapterCapabilities: AdapterCapabilities;
  private cameraControls: CameraControlConfig;
  private destroyed = false;

  constructor(
    private readonly adapter: S100EngineAdapter,
    private readonly host: EngineViewerHost,
    cameraControls?: CameraControlConfig,
  ) {
    this.adapterCapabilities = adapter.getCapabilities?.() ?? adapter.capabilities;
    validateAdapterCapabilities(this.adapterCapabilities);
    this.cameraControls = normalizeCameraControlConfig(cameraControls);
  }

  get adapterId(): string {
    return this.adapter.id;
  }

  get adapterDisplayName(): string {
    return this.adapter.displayName;
  }

  get capabilities() {
    return this.adapterCapabilities;
  }

  getCapabilities(): AdapterCapabilities {
    return this.adapterCapabilities;
  }

  getCameraControls(): CameraControlConfig {
    return cloneCameraControlConfig(this.cameraControls);
  }

  setCameraControls(config: CameraControlConfig): void {
    this.cameraControls = normalizeCameraControlConfig(config);
    for (const engineScene of this.engineScenes.values()) {
      engineScene.setCameraControls?.(cloneCameraControlConfig(this.cameraControls));
    }
  }

  async createScene(options: SceneOptions = {}): Promise<S100Scene> {
    if (this.destroyed) {
      throw new S100Error("viewer-destroyed", "Cannot create a scene after viewer destruction.");
    }

    const normalizedOptions = normalizeSceneOptions(options);
    assertSceneGeoreferenceSupported(this.adapterCapabilities, normalizedOptions);

    const engineScene = await this.host.createScene(normalizedOptions);
    engineScene.setCameraControls?.(cloneCameraControlConfig(this.cameraControls));
    const scene = new CoreS100Scene({
      id: normalizedOptions.id,
      georeference: normalizedOptions.georeference,
      adapterCapabilities: this.adapterCapabilities,
      engineScene,
    });

    this.scenes.add(scene);
    this.engineScenes.set(scene, engineScene);
    return scene;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    for (const scene of [...this.scenes]) {
      await scene.destroy();
      this.scenes.delete(scene);
      this.engineScenes.delete(scene);
    }

    if (this.adapter.destroyViewerHost) {
      await this.adapter.destroyViewerHost(this.host);
    } else {
      await this.host.destroy();
    }

    this.destroyed = true;
  }
}
