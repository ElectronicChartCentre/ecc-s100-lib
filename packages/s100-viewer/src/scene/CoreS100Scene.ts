import type {
  AdapterCapabilities,
  EnginePrismCorners2D,
  EngineRgba,
  EngineScene,
} from "../adapters/types.js";
import { CoreCameraController } from "../camera/CoreCameraController.js";
import type { SceneGeoreference } from "../coordinates/types.js";
import { EventBus } from "../events/S100EventBus.js";
import { CoreLayerCollection } from "../layers/CoreLayerCollection.js";
import { CoreDepthRayController } from "../picking/CoreDepthRayController.js";
import { CorePickingController } from "../picking/CorePickingController.js";
import { CoreTimeController } from "../time/CoreTimeController.js";
import { CoreEnvironmentController } from "./CoreEnvironmentController.js";
import type { EnvironmentController, S100Scene, S100SceneEvents } from "./types.js";

let nextSceneId = 1;

export type CoreS100SceneOptions = {
  id?: string | undefined;
  georeference: SceneGeoreference;
  adapterCapabilities: AdapterCapabilities;
  engineScene: EngineScene;
};

export class CoreS100Scene implements S100Scene {
  readonly id: string;
  readonly events = new EventBus<S100SceneEvents>();
  readonly layers: CoreLayerCollection;
  readonly camera: CoreCameraController;
  readonly time: CoreTimeController;
  readonly picking: CorePickingController;
  readonly depthRay: CoreDepthRayController;
  readonly environment: EnvironmentController;
  private seaLevel = 0;
  private destroyed = false;

  constructor(private readonly options: CoreS100SceneOptions) {
    this.id = options.id ?? `scene-${nextSceneId++}`;
    this.layers = new CoreLayerCollection(options.engineScene, this.events);
    this.camera = new CoreCameraController(options.engineScene, this.events);
    this.time = new CoreTimeController(options.engineScene, this.events, (seaLevel) => {
      this.setSeaLevelFromEngine(seaLevel);
    });
    this.picking = new CorePickingController(options.engineScene, this.events);
    this.depthRay = new CoreDepthRayController(this.picking, this.events);
    this.environment = new CoreEnvironmentController(options.engineScene, this.events);
  }

  get adapterCapabilities(): AdapterCapabilities {
    return this.options.adapterCapabilities;
  }

  get georeference(): SceneGeoreference {
    return this.options.georeference;
  }

  get crs(): string | null {
    return this.options.georeference.mode === "projected-local" ? this.options.georeference.crs : null;
  }

  getCapabilities(): AdapterCapabilities {
    return this.options.adapterCapabilities;
  }

  setSeaLevel(value: number): void {
    this.seaLevel = value;
    this.options.engineScene.setSeaLevel(value);
    this.events.emit("seaLevel.changed", value);
  }

  private setSeaLevelFromEngine(value: number): void {
    if (Object.is(this.seaLevel, value)) {
      return;
    }

    this.seaLevel = value;
    this.events.emit("seaLevel.changed", value);
  }

  getSeaLevel(): number {
    return this.seaLevel;
  }

  showHoverPrism(
    corners: EnginePrismCorners2D,
    zPos?: number,
    height?: number,
    rgba?: EngineRgba,
  ): void {
    this.options.engineScene.showHoverPrism?.(corners, zPos, height, rgba);
  }

  clearHoverPrism(): void {
    this.options.engineScene.clearHoverPrism?.();
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    await this.layers.clear();
    await this.options.engineScene.dispose();
    this.events.clear();
    this.destroyed = true;
  }
}
