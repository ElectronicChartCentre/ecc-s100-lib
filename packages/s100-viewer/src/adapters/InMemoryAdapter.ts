import {
  cloneCameraControlConfig,
  type CameraControlConfig,
  type CameraLookAt,
  type CameraPose,
} from "../camera/types.js";
import type {
  AdapterCapabilities,
  EngineLayerHandle,
  EngineLayerPatchListener,
  EnginePrismCorners2D,
  EngineRgba,
  EngineScene,
  EngineViewerHost,
  S100EngineAdapter,
  ViewerHostOptions,
} from "./types.js";
import type { BaseLayerSpec, LayerPatch } from "../layers/types.js";
import type { LivePickingOptions, PickRequest, PickResult } from "../picking/types.js";
import { S100SupportedProductVersions } from "../products/index.js";
import type { EnvironmentState, SceneOptions } from "../scene/types.js";

export type InMemoryAdapterOptions = {
  id?: string;
  displayName?: string;
  capabilities?: Partial<AdapterCapabilities>;
  pickResult?: PickResult | null;
  onLivePickingMode?: (
    options: LivePickingOptions,
    emitPick: (result: PickResult | null) => void,
  ) => void;
  onHoverPrism?: (
    corners: EnginePrismCorners2D,
    zPos?: number,
    height?: number,
    rgba?: EngineRgba,
  ) => void;
  onClearHoverPrism?: () => void;
  onLayerPatchListener?: (listener: EngineLayerPatchListener | null) => void;
};

const defaultCameraPose = (): CameraPose => ({
  position: { x: 0, y: 0, z: 1000 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  focalDistance: 1000,
});

export const createInMemoryAdapter = (options: InMemoryAdapterOptions = {}): S100EngineAdapter => {
  const capabilities: AdapterCapabilities = {
    sceneGeoreferences: ["projected-local", "ellipsoid-ecef"],
    layerProducts: ["*"],
    supportedProductVersions: S100SupportedProductVersions,
    dataSources: ["*"],
    cameraControls: ["pose", "look-at"],
    picking: true,
    timeDynamicLayers: true,
    nativeHandles: true,
    precisionStrategy: "engine-native",
    globe: {
      ellipsoidEcef: true,
      globeNative3dTiles: false,
      oceanMasking: false,
    },
    ...options.capabilities,
  };

  return {
    id: options.id ?? "in-memory",
    displayName: options.displayName ?? "In-memory test adapter",
    capabilities,
    getCapabilities: () => capabilities,
    async createViewerHost(_hostOptions: ViewerHostOptions): Promise<EngineViewerHost> {
      return {
        async createScene(sceneOptions: SceneOptions): Promise<EngineScene> {
          return new InMemoryEngineScene(
            sceneOptions,
            options.pickResult ?? null,
            options.onLivePickingMode,
            options.onHoverPrism,
            options.onClearHoverPrism,
            options.onLayerPatchListener,
          );
        },
        destroy(): void {
          return undefined;
        },
      };
    },
  };
};

class InMemoryEngineScene implements EngineScene {
  private camera = defaultCameraPose();
  private time = new Date(0);
  private seaLevel = 0;
  private cameraControls: CameraControlConfig | undefined;
  private environment: EnvironmentState = {};
  private readonly layers = new Map<EngineLayerHandle, BaseLayerSpec>();

  constructor(
    readonly sceneOptions: SceneOptions,
    private readonly pickResult: PickResult | null,
    private readonly onLivePickingMode:
      | ((
          options: LivePickingOptions,
          emitPick: (result: PickResult | null) => void,
        ) => void)
      | undefined,
    private readonly onHoverPrism:
      | ((
          corners: EnginePrismCorners2D,
          zPos?: number,
          height?: number,
          rgba?: EngineRgba,
        ) => void)
      | undefined,
    private readonly onClearHoverPrism: (() => void) | undefined,
    private readonly onLayerPatchListener:
      | ((listener: EngineLayerPatchListener | null) => void)
      | undefined,
  ) {}

  setCamera(pose: CameraPose): void {
    this.camera = { ...pose };
  }

  getCamera(): CameraPose {
    return { ...this.camera };
  }

  lookAt(_view: CameraLookAt): void {
    this.camera = {
      ...this.camera,
      focalDistance: _view.rangeMeters,
    };
  }

  setCameraControls(config: CameraControlConfig): void {
    this.cameraControls = cloneCameraControlConfig(config);
  }

  setTime(time: Date): void {
    this.time = new Date(time);
  }

  setSeaLevel(value: number): void {
    this.seaLevel = value;
  }

  setEnvironment(state: EnvironmentState): void {
    this.environment = { ...this.environment, ...state };
  }

  setLayerPatchListener(listener: EngineLayerPatchListener | null): void {
    this.onLayerPatchListener?.(listener);
  }

  async addLayer(spec: BaseLayerSpec): Promise<EngineLayerHandle> {
    const handle: EngineLayerHandle = {
      id: spec.id,
      native: {
        spec,
        sceneOptions: this.sceneOptions,
        cameraControls: this.cameraControls,
      },
    };
    this.layers.set(handle, spec);
    return handle;
  }

  async updateLayer(handle: EngineLayerHandle, patch: LayerPatch): Promise<void> {
    const existing = this.layers.get(handle);
    if (!existing) {
      return;
    }
    this.layers.set(handle, { ...existing, ...patch });
  }

  async removeLayer(handle: EngineLayerHandle): Promise<void> {
    this.layers.delete(handle);
  }

  async pick(request: PickRequest): Promise<PickResult | null> {
    if (!this.pickResult) {
      return null;
    }

    return {
      ...this.pickResult,
      screen: {
        x: request.screenX,
        y: request.screenY,
      },
    };
  }

  setLivePickingMode(
    options: LivePickingOptions,
    emitPick: (result: PickResult | null) => void,
  ): void {
    this.onLivePickingMode?.(options, emitPick);
  }

  showHoverPrism(
    corners: EnginePrismCorners2D,
    zPos?: number,
    height?: number,
    rgba?: EngineRgba,
  ): void {
    this.onHoverPrism?.(corners, zPos, height, rgba);
  }

  clearHoverPrism(): void {
    this.onClearHoverPrism?.();
  }

  dispose(): void {
    this.layers.clear();
  }
}
