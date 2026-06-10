import type {
  AdapterCapabilities,
  LoggerLike,
  S100EngineAdapter,
} from "../adapters/types.js";
import type { CameraControlConfig } from "../camera/types.js";
import type { SceneOptions, S100Scene } from "../scene/types.js";

export type CreateS100ViewerOptions = {
  adapter: S100EngineAdapter;
  container?: unknown;
  logger?: LoggerLike;
  cameraControls?: CameraControlConfig;
  metadata?: Record<string, unknown>;
};

export interface S100Viewer {
  readonly adapterId: string;
  readonly adapterDisplayName: string;
  readonly capabilities: AdapterCapabilities;
  getCapabilities(): AdapterCapabilities;
  getCameraControls(): CameraControlConfig;
  setCameraControls(config: CameraControlConfig): void;
  createScene(options?: SceneOptions): Promise<S100Scene>;
  destroy(): Promise<void>;
}
