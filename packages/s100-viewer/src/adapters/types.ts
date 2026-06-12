import type { CameraControlConfig, CameraLookAt, CameraPose } from "../camera/types.js";
import type { SceneGeoreferenceMode } from "../coordinates/types.js";
import type { BaseLayerSpec, LayerPatch } from "../layers/types.js";
import type { LivePickingOptions, PickRequest, PickResult } from "../picking/types.js";
import type { S100ProductVersionSupport } from "../products/index.js";
import type { EnvironmentState, SceneOptions } from "../scene/types.js";

export type LoggerLike = {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

export type AdapterPrecisionStrategy =
  | "engine-native"
  | "origin-rebased"
  | "high-low-split"
  | "not-supported";

export type AdapterVisualFeatureCapability =
  | boolean
  | {
      supported: boolean;
      modes?: readonly string[];
      notes?: string;
    };

export type AdapterVisualCapabilities = {
  depthRay?: AdapterVisualFeatureCapability;
  hoverPrism?: AdapterVisualFeatureCapability;
  vesselTransformGizmo?: AdapterVisualFeatureCapability;
  vesselOceanSurface?: AdapterVisualFeatureCapability;
  vesselShadow?: AdapterVisualFeatureCapability;
  staticLighting?: AdapterVisualFeatureCapability;
  dynamicLighting?: AdapterVisualFeatureCapability;
};

export type AdapterCapabilities = {
  sceneGeoreferences: readonly SceneGeoreferenceMode[];
  layerProducts: readonly string[];
  supportedProductVersions?: readonly S100ProductVersionSupport[];
  dataSources: readonly string[];
  cameraControls: readonly ("pose" | "look-at")[];
  picking: boolean;
  timeDynamicLayers: boolean;
  nativeHandles: boolean;
  precisionStrategy?: AdapterPrecisionStrategy;
  globe?: {
    ellipsoidEcef: boolean;
    globeNative3dTiles?: boolean;
    oceanMasking?: boolean;
  };
  visualFeatures?: AdapterVisualCapabilities;
  extensions?: Record<string, unknown>;
};

export type EngineHandleBundle = {
  adapterId: string;
  engineName?: string;
  engineVersion?: string;
  engineInstance?: unknown;
  instances?: Record<string, unknown>;
  staticObjects?: Record<string, unknown>;
  resources?: Record<string, unknown>;
};

export type ViewerHostOptions = {
  container?: unknown;
  logger?: LoggerLike;
  metadata?: Record<string, unknown>;
};

export type EngineLayerHandle = {
  id?: string;
  native?: unknown;
  dispose?: () => void | Promise<void>;
};

export type EngineLayerPatchEvent<TSpec extends BaseLayerSpec = BaseLayerSpec> = {
  handle: EngineLayerHandle;
  patch: LayerPatch<TSpec>;
  source?: string;
};

export type EngineLayerPatchListener = (event: EngineLayerPatchEvent) => void;
export type EngineCameraChangeListener = (pose: CameraPose) => void;

export type EnginePrismVec2Tuple = [number, number];

export type EnginePrismCorners2D = {
  topLeft: EnginePrismVec2Tuple;
  topRight: EnginePrismVec2Tuple;
  bottomLeft: EnginePrismVec2Tuple;
  bottomRight: EnginePrismVec2Tuple;
};

export type EngineRgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export interface EngineScene {
  getEngineHandles?(): EngineHandleBundle;
  setCamera(pose: CameraPose): void;
  getCamera(): CameraPose;
  lookAt?(view: CameraLookAt): void;
  setCameraChangeListener?(listener: EngineCameraChangeListener | null): void;
  setCameraControls?(config: CameraControlConfig): void;
  setTime(time: Date): void;
  setSeaLevel(value: number): void;
  getSeaLevel?(): number;
  setEnvironment?(state: EnvironmentState): void;
  setLayerPatchListener?(listener: EngineLayerPatchListener | null): void;
  addLayer(spec: BaseLayerSpec): Promise<EngineLayerHandle>;
  updateLayer(handle: EngineLayerHandle, patch: LayerPatch): Promise<void>;
  removeLayer(handle: EngineLayerHandle): Promise<void>;
  pick(request: PickRequest): Promise<PickResult | null>;
  setLivePickingMode?(
    options: LivePickingOptions,
    emitPick: (result: PickResult | null) => void,
  ): void;
  showHoverPrism?(
    corners: EnginePrismCorners2D,
    zPos?: number,
    height?: number,
    rgba?: EngineRgba,
  ): void;
  clearHoverPrism?(): void;
  dispose(): void | Promise<void>;
}

export interface EngineViewerHost {
  getEngineHandles?(): EngineHandleBundle;
  createScene(options: SceneOptions): Promise<EngineScene>;
  destroy(): void | Promise<void>;
}

export interface S100EngineAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: AdapterCapabilities;
  getCapabilities?(): AdapterCapabilities;
  createViewerHost(options: ViewerHostOptions): Promise<EngineViewerHost>;
  destroyViewerHost?(host: EngineViewerHost): void | Promise<void>;
}
