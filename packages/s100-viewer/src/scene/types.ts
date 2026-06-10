import type {
  AdapterCapabilities,
  EnginePrismCorners2D,
  EngineRgba,
} from "../adapters/types.js";
import type { CameraController, CameraPose, Vec3 } from "../camera/types.js";
import type { SceneGeoreference } from "../coordinates/types.js";
import type { S100Error } from "../errors/S100Error.js";
import type { S100EventBus, S100Unsubscribe } from "../events/S100EventBus.js";
import type { LayerCollection, S100Layer } from "../layers/types.js";
import type { DepthRayController, PickResult, PickingController } from "../picking/types.js";
import type { TimeController } from "../time/types.js";

export type SceneOptions = {
  id?: string;
  georeference?: SceneGeoreference;
  metadata?: Record<string, unknown>;
};

export type EnvironmentState = {
  preset?: string;
  background?: "skybox" | "transparent" | "solid";
  skyboxUrl?: string;
  skyboxFaces?: {
    positiveX: string;
    negativeX: string;
    positiveY: string;
    negativeY: string;
    positiveZ: string;
    negativeZ: string;
  };
  backgroundIntensity?: number;
  lighting?: {
    sunDirection?: Vec3;
    ambientIntensity?: number;
    directionalIntensity?: number;
    environmentIntensity?: number;
    environmentMapUrl?: string;
    dynamic?: {
      enabled: boolean;
      source?: "scene-time";
    };
  };
  metadata?: Record<string, unknown>;
};

export interface EnvironmentController {
  getState(): EnvironmentState;
  setState(state: EnvironmentState): void;
  onChanged(listener: (state: EnvironmentState) => void): S100Unsubscribe;
}

export type S100SceneEvents = {
  "camera.changed": CameraPose;
  "time.changed": Date;
  "time.playback.changed": { playing: boolean; rate: number; loop: boolean };
  "environment.changed": EnvironmentState;
  "seaLevel.changed": number;
  "layer.added": S100Layer;
  "layer.removed": { id: string };
  "layer.updated": S100Layer;
  "pick.changed": PickResult | null;
  error: S100Error;
};

export interface S100Scene {
  readonly id: string;
  readonly adapterCapabilities: AdapterCapabilities;
  readonly georeference: SceneGeoreference;
  readonly layers: LayerCollection;
  readonly camera: CameraController;
  readonly time: TimeController;
  readonly picking: PickingController;
  readonly depthRay: DepthRayController;
  readonly environment: EnvironmentController;
  readonly events: S100EventBus<S100SceneEvents>;
  readonly crs: string | null;
  getCapabilities(): AdapterCapabilities;
  setSeaLevel(value: number): void;
  getSeaLevel(): number;
  showHoverPrism(
    corners: EnginePrismCorners2D,
    zPos?: number,
    height?: number,
    rgba?: EngineRgba,
  ): void;
  clearHoverPrism(): void;
  destroy(): Promise<void>;
}
