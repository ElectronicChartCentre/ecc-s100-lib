import {
  cloneCameraControlConfig,
  type CameraControlConfig,
  type CameraLookAt,
  type EngineCameraPose,
} from "../camera/types.js";
import type {
  AdapterCapabilities,
  EngineCameraChangeListener,
  EngineHandleBundle,
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
import type { EnvironmentState, SceneOptions, WaterLevelFieldSource } from "../scene/types.js";

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
  onCameraChangeListener?: (listener: EngineCameraChangeListener | null) => void;
  getSeaLevel?: () => number;
  getSeaLevelSource?: () => WaterLevelFieldSource;
  failAddLayerIds?: readonly string[];
};

const defaultCameraPose = (): EngineCameraPose => ({
  position: { x: 0, y: 0, z: 1000 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  focalDistance: 1000,
});

export const createInMemoryAdapter = (options: InMemoryAdapterOptions = {}): S100EngineAdapter => {
  const adapterId = options.id ?? "in-memory";
  const displayName = options.displayName ?? "In-memory test adapter";
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
    waterLevelField: "sampled",
    waterLevelTerrainShading: "none",
    globe: {
      ellipsoidEcef: true,
      globeNative3dTiles: false,
      oceanMasking: false,
    },
    ...options.capabilities,
  };

  return {
    id: adapterId,
    displayName,
    capabilities,
    getCapabilities: () => capabilities,
    async createViewerHost(hostOptions: ViewerHostOptions): Promise<EngineViewerHost> {
      let destroyed = false;
      return {
        getEngineHandles(): EngineHandleBundle {
          return {
            adapterId,
            engineName: displayName,
            engineInstance: {
              kind: "in-memory-viewer-host",
              destroyed,
            },
            instances: {
              hostOptions,
            },
            resources: {
              docs: "memory://s100-viewer/in-memory-adapter",
            },
          };
        },
        async createScene(sceneOptions: SceneOptions): Promise<EngineScene> {
          return new InMemoryEngineScene(
            adapterId,
            displayName,
            sceneOptions,
            options.pickResult ?? null,
            options.onLivePickingMode,
            options.onHoverPrism,
            options.onClearHoverPrism,
            options.onLayerPatchListener,
            options.onCameraChangeListener,
            options.getSeaLevel,
            options.getSeaLevelSource,
            options.failAddLayerIds,
          );
        },
        destroy(): void {
          destroyed = true;
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
  private seaLevelSource: WaterLevelFieldSource = "static";
  private cameraControls: CameraControlConfig | undefined;
  private environment: EnvironmentState = {};
  private readonly layers = new Map<EngineLayerHandle, BaseLayerSpec>();

  constructor(
    private readonly adapterId: string,
    private readonly displayName: string,
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
    private readonly onCameraChangeListener:
      | ((listener: EngineCameraChangeListener | null) => void)
      | undefined,
    private readonly getSeaLevelOverride: (() => number) | undefined,
    private readonly getSeaLevelSourceOverride: (() => WaterLevelFieldSource) | undefined,
    private readonly failAddLayerIds: readonly string[] | undefined,
  ) {}

  getEngineHandles(): EngineHandleBundle {
    return {
      adapterId: this.adapterId,
      engineName: this.displayName,
      engineInstance: this,
      instances: {
        scene: this,
        sceneOptions: this.sceneOptions,
        layers: this.layers,
      },
      resources: {
        docs: "memory://s100-viewer/in-memory-scene",
      },
    };
  }

  setCamera(pose: EngineCameraPose): void {
    this.camera = { ...pose };
  }

  getCamera(): EngineCameraPose {
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

  setCameraChangeListener(listener: EngineCameraChangeListener | null): void {
    this.onCameraChangeListener?.(listener);
  }

  setTime(time: Date): void {
    this.time = new Date(time);
  }

  setSeaLevel(value: number, source: WaterLevelFieldSource = "static"): void {
    this.seaLevel = value;
    this.seaLevelSource = source;
  }

  getSeaLevel(): number {
    return this.getSeaLevelOverride?.() ?? this.seaLevel;
  }

  getSeaLevelSource(): WaterLevelFieldSource {
    return this.getSeaLevelSourceOverride?.() ?? this.seaLevelSource;
  }

  setEnvironment(state: EnvironmentState): void {
    this.environment = { ...this.environment, ...state };
  }

  setLayerPatchListener(listener: EngineLayerPatchListener | null): void {
    this.onLayerPatchListener?.(listener);
  }

  async addLayer(spec: BaseLayerSpec): Promise<EngineLayerHandle> {
    if (this.failAddLayerIds?.includes(spec.id)) {
      throw new Error(`In-memory adapter configured to fail layer '${spec.id}'.`);
    }
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
