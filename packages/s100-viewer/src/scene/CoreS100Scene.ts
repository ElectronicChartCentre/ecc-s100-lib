import type {
  AdapterCapabilities,
  EngineHandleBundle,
  EnginePrismCorners2D,
  EngineRgba,
  EngineScene,
} from "../adapters/types.js";
import { CoreCameraController } from "../camera/CoreCameraController.js";
import type { Coordinate, ProjectedCoordinate, SceneGeoreference } from "../coordinates/types.js";
import { S100Error } from "../errors/S100Error.js";
import { EventBus, type S100Unsubscribe } from "../events/S100EventBus.js";
import { CoreLayerCollection } from "../layers/CoreLayerCollection.js";
import { CoreDepthRayController } from "../picking/CoreDepthRayController.js";
import { CorePickingController } from "../picking/CorePickingController.js";
import { CoreTimeController } from "../time/CoreTimeController.js";
import { CoreEnvironmentController } from "./CoreEnvironmentController.js";
import { CoreWaterLevelFieldController } from "./CoreWaterLevelFieldController.js";
import type {
  EnvironmentController,
  S100Scene,
  S100SceneEvents,
  WaterLevelFieldSource,
} from "./types.js";

let nextSceneId = 1;

export type CoreS100SceneOptions = {
  id?: string | undefined;
  georeference: SceneGeoreference;
  adapterId: string;
  adapterDisplayName: string;
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
  readonly waterLevel: CoreWaterLevelFieldController;
  private seaLevel = 0;
  private fallbackSeaLevel = 0;
  private activeSeaLevelSource: WaterLevelFieldSource = "static";
  private seaLevelSource: Exclude<WaterLevelFieldSource, "s104"> = "static";
  private destroyed = false;
  private readonly subscriptions: S100Unsubscribe[] = [];

  constructor(private readonly options: CoreS100SceneOptions) {
    this.id = options.id ?? `scene-${nextSceneId++}`;
    this.camera = new CoreCameraController(options.engineScene, this.events);
    this.time = new CoreTimeController(options.engineScene, this.events, (seaLevel) => {
      this.setSeaLevelFromEngine(seaLevel);
    });
    this.layers = new CoreLayerCollection(options.engineScene, this.events, {
      getSceneTime: () => this.time.getCurrent(),
      setSceneTime: (time) => this.time.setCurrent(time),
    });
    this.picking = new CorePickingController(options.engineScene, this.events);
    this.depthRay = new CoreDepthRayController(this.picking, this.events);
    this.environment = new CoreEnvironmentController(options.engineScene, this.events);
    this.waterLevel = new CoreWaterLevelFieldController(this.events, {
      getSeaLevel: () => this.seaLevel,
      getSeaLevelSource: () => this.seaLevelSource,
      getSceneTime: () => this.time.getCurrent(),
      onSamplerChanged: () => {
        this.refreshRepresentativeSeaLevel({ notifyWaterLevel: false });
        this.syncWaterLevelFieldToEngine();
      },
    });
    this.subscriptions.push(
      this.events.on("camera.changed", () => {
        this.refreshRepresentativeSeaLevel();
      }),
      this.events.on("time.changed", () => {
        this.refreshRepresentativeSeaLevel();
        this.syncWaterLevelFieldToEngine();
      }),
    );
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

  getEngineHandles(): EngineHandleBundle {
    if (this.destroyed) {
      throw new S100Error("scene-destroyed", "Cannot access engine handles after scene destruction.");
    }

    return this.options.engineScene.getEngineHandles?.() ?? {
      adapterId: this.options.adapterId,
      engineName: this.options.adapterDisplayName,
    };
  }

  setSeaLevel(value: number): void {
    const previousSource = this.seaLevelSource;
    this.fallbackSeaLevel = finiteSeaLevel(value);
    this.seaLevelSource = "static";
    this.refreshRepresentativeSeaLevel({
      forceWaterLevelNotification: previousSource !== this.seaLevelSource,
    });
  }

  private setSeaLevelFromEngine(value: number): void {
    const previousSource = this.seaLevelSource;
    this.fallbackSeaLevel = finiteSeaLevel(value);
    this.seaLevelSource = "simulated-water-level";
    this.refreshRepresentativeSeaLevel({
      forceWaterLevelNotification: previousSource !== this.seaLevelSource,
      applyToEngine: this.waterLevel.getSampler() !== null,
    });
  }

  private refreshRepresentativeSeaLevel(
    options: {
      notifyWaterLevel?: boolean;
      forceWaterLevelNotification?: boolean;
      applyToEngine?: boolean;
    } = {},
  ): void {
    const representative = this.representativeWaterLevel();
    this.setActiveSeaLevel(
      representative?.heightMeters ?? this.fallbackSeaLevel,
      representative !== null ? "s104" : this.seaLevelSource,
      options,
    );
  }

  private representativeWaterLevel(): { heightMeters: number } | null {
    if (this.waterLevel.getSampler() === null) {
      return null;
    }

    const sample = this.waterLevel.sample({
      coordinate: representativeCoordinate(this.options.georeference, this.camera.getPose().position),
      time: this.time.getCurrent(),
    });
    if (sample.status !== "value" || !Number.isFinite(sample.heightMeters)) {
      return null;
    }
    return { heightMeters: sample.heightMeters };
  }

  private setActiveSeaLevel(
    value: number,
    source: WaterLevelFieldSource,
    options: {
      notifyWaterLevel?: boolean;
      forceWaterLevelNotification?: boolean;
      applyToEngine?: boolean;
    } = {},
  ): void {
    const normalized = finiteSeaLevel(value);
    const previousSeaLevel = this.seaLevel;
    const previousSource = this.activeSeaLevelSource;
    const sourceChanged = previousSource !== source;
    if (
      Object.is(previousSeaLevel, normalized) &&
      !sourceChanged &&
      options.forceWaterLevelNotification !== true
    ) {
      return;
    }

    this.seaLevel = normalized;
    this.activeSeaLevelSource = source;
    if (options.applyToEngine !== false) {
      this.options.engineScene.setSeaLevel(normalized, source);
    }
    this.syncWaterLevelFieldToEngine();
    if (!Object.is(previousSeaLevel, normalized)) {
      this.events.emit("seaLevel.changed", normalized);
    }
    if (options.notifyWaterLevel !== false || options.forceWaterLevelNotification === true) {
      this.waterLevel.notifyChanged();
    }
  }

  getSeaLevel(): number {
    return this.seaLevel;
  }

  private syncWaterLevelFieldToEngine(): void {
    this.options.engineScene.setWaterLevelField?.(this.waterLevel.getState());
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
    for (const unsubscribe of this.subscriptions.splice(0)) {
      unsubscribe();
    }
    this.time.destroy();
    this.camera.destroy();
    await this.options.engineScene.dispose();
    this.events.clear();
    this.destroyed = true;
  }
}

const representativeCoordinate = (
  georeference: SceneGeoreference,
  cameraPosition: { x: number; y: number; z: number },
): Coordinate => {
  if (georeference.mode === "projected-local") {
    const origin = georeference.origin;
    if (origin.kind === "projected") {
      const coordinate: ProjectedCoordinate = {
        kind: "projected",
        crs: georeference.crs,
        x: origin.x + cameraPosition.x,
        y: origin.y + cameraPosition.y,
        z: (origin.z ?? 0) + cameraPosition.z,
      };
      return coordinate;
    }
    return origin;
  }

  return georeference.origin ?? {
    kind: "geodetic",
    lon: 0,
    lat: 0,
    height: 0,
    datum: "WGS84",
  };
};

const finiteSeaLevel = (value: number): number =>
  Number.isFinite(value) ? value : 0;
