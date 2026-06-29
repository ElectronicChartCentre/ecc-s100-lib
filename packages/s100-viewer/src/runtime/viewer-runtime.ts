import type { S100EngineAdapter, LoggerLike } from "../adapters/types.js";
import type { CameraControlConfig, EngineCameraPose } from "../camera/types.js";
import type { Coordinate } from "../coordinates/types.js";
import type { S100Unsubscribe } from "../events/S100EventBus.js";
import type { BaseLayerSpec, S100Layer } from "../layers/types.js";
import type { Corners2D, QuatTuple, RGBA, Vec3Tuple } from "../math.js";
import type { PickRequest, PickResult } from "../picking/types.js";
import type { S100ProductLayerSpec } from "../products/layer-builder.js";
import type { EnvironmentState, SceneOptions, S100Scene } from "../scene/types.js";
import { createS100Viewer } from "../viewer/createS100Viewer.js";
import type { CreateS100ViewerOptions, S100Viewer } from "../viewer/types.js";
import {
  CustomModelFeature,
  EventEmitter,
  MapFeature,
  S111Feature,
  TerrainFeature,
  VesselFeature,
} from "./product-runtime.js";

export type CameraPose = {
  position: Vec3Tuple;
  rotation: QuatTuple;
  focalDistance?: number;
};

export type CameraUpdate = CameraPose;

export type ViewerEnvironmentConfig = {
  environmentMapURL?: string;
  showEnvironmentBackground?: boolean;
  backgroundIntensity?: number;
  environmentIntensity?: number;
  ambientLightIntensity?: number;
  directionalLightIntensity?: number;
};

export type ViewerConfig = ViewerEnvironmentConfig & {
  adapter?: S100EngineAdapter;
  cameraControls?: CameraControlConfig;
  sceneOptions?: SceneOptions;
  logger?: LoggerLike;
  metadata?: Record<string, unknown>;
};

export type ViewerFacade = {
  readonly viewer: S100Viewer;
  createScene: S100Viewer["createScene"];
  destroy: S100Viewer["destroy"];
};

export type PrismVec2Tuple = [number, number];

export type PickInfo = {
  isValid: boolean;
  xyz: Vec3Tuple;
  hasDepth?: boolean;
  seaLevel?: number;
  source?: "geometry" | "sea-level-plane" | "none";
  entity?: unknown;
  view?: unknown;
  selected?: unknown;
};

export type ViewerLayer<TSpec extends BaseLayerSpec = S100ProductLayerSpec> = S100Layer<TSpec>;

export const createViewerFacade = async (
  options: CreateS100ViewerOptions,
): Promise<ViewerFacade> => {
  const viewer = await createS100Viewer(options);

  return {
    viewer,
    createScene: viewer.createScene.bind(viewer),
    destroy: viewer.destroy.bind(viewer),
  };
};

export class Viewer {
  readonly runtime = {};

  private constructor(
    private readonly coreViewer: S100Viewer,
    private readonly config: ViewerConfig,
  ) {}

  static async create(
    parent: unknown | null,
    config: ViewerConfig = {},
  ): Promise<Viewer> {
    if (config.adapter === undefined) {
      throw new Error("Viewer.create requires an explicit S-100 engine adapter.");
    }

    const options: CreateS100ViewerOptions = {
      adapter: config.adapter,
      container: parent,
    };
    if (config.cameraControls !== undefined) {
      options.cameraControls = config.cameraControls;
    }
    if (config.logger !== undefined) {
      options.logger = config.logger;
    }
    if (config.metadata !== undefined) {
      options.metadata = config.metadata;
    }

    const coreViewer = await createS100Viewer(options);
    return new Viewer(coreViewer, config);
  }

  initialized(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async createScene(): Promise<ViewerScene> {
    const coreScene = await this.coreViewer.createScene(this.config.sceneOptions);
    return new ViewerScene(coreScene, this.config);
  }

  async destroy(): Promise<void> {
    await this.coreViewer.destroy();
  }
}

export class ViewerScene {
  readonly runtime = {};
  readonly layers: ViewerLayerCollection;
  readonly cameraChanged = new EventEmitter<CameraUpdate>();
  readonly Terrain: TerrainFeature;
  readonly S111: S111Feature;
  readonly Map: MapFeature;
  readonly HoverPrism: HoverPrismFeature;
  readonly Prism: HoverPrismFeature;
  readonly CustomModels: CustomModelFeature;
  readonly Models: CustomModelFeature;
  readonly VesselFeature: VesselFeature;
  readonly PickingRay: PickingRayFeature;
  readonly Picking: PickingFeature;
  readonly CameraConstraint: PlaceholderFeature;
  readonly Lighting: LightingFeature;
  readonly Debug: DebugFeature;
  readonly cameraNavigation: CameraNavigation;
  private readonly cameraChangedUnsubscribe: S100Unsubscribe;

  constructor(
    readonly coreScene: S100Scene,
    readonly config: ViewerConfig = {},
  ) {
    this.layers = new ViewerLayerCollection(this.coreScene);
    this.Terrain = new TerrainFeature(this.coreScene);
    this.S111 = new S111Feature(this.coreScene);
    this.Map = new MapFeature(this.coreScene);
    this.HoverPrism = new HoverPrismFeature(this.coreScene);
    this.Prism = this.HoverPrism;
    this.CustomModels = new CustomModelFeature(this.coreScene);
    this.Models = this.CustomModels;
    this.VesselFeature = new VesselFeature(this.coreScene);
    this.PickingRay = new PickingRayFeature(this.coreScene);
    this.Picking = new PickingFeature(this.coreScene);
    this.CameraConstraint = new PlaceholderFeature("CameraConstraint");
    this.Lighting = new LightingFeature(this.coreScene, this.config);
    this.Debug = new DebugFeature();
    this.cameraNavigation = new CameraNavigation(this.coreScene);
    this.cameraChangedUnsubscribe = this.coreScene.camera.onChanged((pose) => {
      this.cameraChanged.emit(engineCameraPoseToCameraUpdate(pose));
    });
  }

  initialized(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async destroy(): Promise<void> {
    this.cameraChangedUnsubscribe();
    this.cameraChanged.clear();
    this.Picking.destroy();
    this.cameraNavigation.destroy();
    await this.coreScene.destroy();
  }

  get seaLevel(): number {
    return this.coreScene.getSeaLevel();
  }

  set seaLevel(value: number) {
    this.coreScene.setSeaLevel(value);
  }
}

export class ViewerLayerCollection {
  constructor(private readonly scene: S100Scene) {}

  get size(): number {
    return this.scene.layers.size;
  }

  add<TSpec extends S100ProductLayerSpec>(spec: TSpec): Promise<ViewerLayer<TSpec>> {
    return this.scene.layers.add(spec);
  }

  get<TSpec extends S100ProductLayerSpec = S100ProductLayerSpec>(
    id: string,
  ): ViewerLayer<TSpec> | undefined {
    return this.scene.layers.get<TSpec>(id);
  }

  has(id: string): boolean {
    return this.scene.layers.has(id);
  }

  remove(idOrLayer: string | ViewerLayer): Promise<boolean> {
    return this.scene.layers.remove(idOrLayer);
  }

  clear(): Promise<void> {
    return this.scene.layers.clear();
  }

  all(): readonly ViewerLayer[] {
    return this.scene.layers.all() as readonly ViewerLayer[];
  }

  [Symbol.iterator](): IterableIterator<ViewerLayer> {
    return this.scene.layers[Symbol.iterator]() as IterableIterator<ViewerLayer>;
  }
}

export class CameraNavigation {
  navigationEnabled = true;

  constructor(private readonly scene: S100Scene) {}

  lookAt(
    target: Vec3Tuple,
    distance: number,
    horizontalAngle: number,
    verticalAngle: number,
  ): void {
    this.scene.camera.lookAt({
      target: tupleToViewerEngineLocalCoordinate(target),
      rangeMeters: distance,
      headingDegrees: horizontalAngle,
      pitchDegrees: verticalAngle,
    });
  }

  getCameraPose(): CameraPose {
    const pose = this.scene.camera.getPose();
    const cameraPose: CameraPose = {
      position: [pose.position.x, pose.position.y, pose.position.z],
      rotation: [pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w],
    };
    if (pose.focalDistance !== undefined) {
      cameraPose.focalDistance = pose.focalDistance;
    }
    return cameraPose;
  }

  setCameraPose(pose: CameraPose): void {
    const cameraPose = {
      position: tupleToVec3(pose.position),
      rotation: {
        x: pose.rotation[0],
        y: pose.rotation[1],
        z: pose.rotation[2],
        w: pose.rotation[3],
      },
    };
    this.scene.camera.setPose(
      pose.focalDistance === undefined
        ? cameraPose
        : { ...cameraPose, focalDistance: pose.focalDistance },
    );
  }

  getCameraPos(): Vec3Tuple {
    return this.getCameraPose().position;
  }

  destroy(): void {
    return undefined;
  }
}

export class PickingRayFeature {
  private currentEnabled = false;
  private currentLineThickness = 1;
  readonly changed = new EventEmitter<void>();
  readonly ray = {
    belowSeaLevelColor: [0, 0, 1] as [number, number, number],
    aboveSeaLevelColor: [1, 1, 0.3] as [number, number, number],
    seaLevelMarkerVisible: false,
    seaLevelMarkerSize: 60,
    seaLevelMarkerOpacity: 0.6,
    seaLevelMarkerColor: [1, 1, 0.3] as [number, number, number],
  };

  constructor(private readonly scene: S100Scene) {}

  get enabled(): boolean {
    return this.currentEnabled;
  }

  set enabled(enabled: boolean) {
    const nextEnabled = Boolean(enabled);
    if (nextEnabled === this.currentEnabled) {
      return;
    }
    this.currentEnabled = nextEnabled;
    this.syncLiveMode();
    this.changed.emit();
  }

  get lineThickness(): number {
    return this.currentLineThickness;
  }

  set lineThickness(value: number) {
    this.currentLineThickness = Number.isFinite(value) && value > 0 ? value : 1;
    if (this.currentEnabled) {
      this.syncLiveMode();
    }
    this.changed.emit();
  }

  private syncLiveMode(): void {
    this.scene.picking.setLiveMode({
      enabled: this.currentEnabled,
      includeVisual: this.currentEnabled,
      fallback: this.currentEnabled ? "sea-level-plane" : "none",
      visual: {
        lineThickness: this.currentLineThickness,
        belowSeaLevelColor: [...this.ray.belowSeaLevelColor],
        aboveSeaLevelColor: [...this.ray.aboveSeaLevelColor],
        seaLevelMarkerVisible: this.ray.seaLevelMarkerVisible,
        seaLevelMarkerSize: this.ray.seaLevelMarkerSize,
        seaLevelMarkerOpacity: this.ray.seaLevelMarkerOpacity,
        seaLevelMarkerColor: [...this.ray.seaLevelMarkerColor],
      },
    });
  }
}

export class PickingFeature {
  readonly Mousemove = new EventEmitter<PickInfo>();
  readonly MouseSelect = new EventEmitter<PickInfo>();
  readonly SelectionChanged = new EventEmitter<PickInfo>();
  private readonly unsubscribePickChanged: () => void;

  constructor(private readonly scene: S100Scene) {
    this.unsubscribePickChanged = this.scene.events.on("pick.changed", (result) => {
      this.Mousemove.emit(pickResultToPickInfo(result, this.scene.getSeaLevel()));
    });
  }

  async pick(request: PickRequest): Promise<PickInfo> {
    const result = await this.scene.picking.pick(request);
    return pickResultToPickInfo(result, this.scene.getSeaLevel());
  }

  destroy(): void {
    this.unsubscribePickChanged();
    this.Mousemove.clear();
    this.MouseSelect.clear();
    this.SelectionChanged.clear();
  }
}

export class PlaceholderFeature {
  constructor(readonly name: string) {}
}

export class HoverPrismFeature {
  private visible = false;
  private corners: Corners2D | null = null;
  private zPos = 0;
  private height = 0;
  private rgba: RGBA | undefined;

  constructor(private readonly scene: S100Scene) {}

  show(corners: Corners2D, zPos = 0, height = 0, rgba?: RGBA): void {
    this.visible = true;
    this.corners = cloneCorners(corners);
    this.zPos = zPos;
    this.height = height;
    this.rgba = rgba === undefined ? undefined : { ...rgba };
    this.scene.showHoverPrism(corners, zPos, height, rgba);
  }

  showPrism(corners: Corners2D, zPos = 0, height = 0, rgba?: RGBA): void {
    this.show(corners, zPos, height, rgba);
  }

  clear(): void {
    this.visible = false;
    this.corners = null;
    this.rgba = undefined;
    this.scene.clearHoverPrism();
  }

  getState(): {
    visible: boolean;
    corners: Corners2D | null;
    zPos: number;
    height: number;
    rgba?: RGBA;
  } {
    const state = {
      visible: this.visible,
      corners: this.corners === null ? null : cloneCorners(this.corners),
      zPos: this.zPos,
      height: this.height,
    };
    return this.rgba === undefined ? state : { ...state, rgba: { ...this.rgba } };
  }
}

export class LightingFeature {
  environment = "default";
  skyDomeEnabled = false;

  constructor(
    private readonly scene: S100Scene,
    private readonly config: ViewerEnvironmentConfig = {},
  ) {}

  setEnvironment(environment: string): void {
    this.environment = environment;
    const state = this.scene.environment.getState();
    this.scene.environment.setState(this.withConfiguredEnvironment({
      ...state,
      preset: environment,
      ...(this.skyDomeEnabled ? { background: "skybox" as const } : {}),
    }));
  }

  enableSkyDome(): void {
    this.skyDomeEnabled = true;
    this.scene.environment.setState(this.withConfiguredEnvironment({
      ...this.scene.environment.getState(),
      background: "skybox",
    }));
  }

  private withConfiguredEnvironment(state: EnvironmentState): EnvironmentState {
    const environmentMapUrl = this.config.environmentMapURL;
    const showEnvironmentBackground = this.config.showEnvironmentBackground !== false;
    const lighting = {
      ...state.lighting,
      ...(this.config.ambientLightIntensity !== undefined
        ? { ambientIntensity: this.config.ambientLightIntensity }
        : {}),
      ...(this.config.directionalLightIntensity !== undefined
        ? { directionalIntensity: this.config.directionalLightIntensity }
        : {}),
      ...(this.config.environmentIntensity !== undefined
        ? { environmentIntensity: this.config.environmentIntensity }
        : {}),
      ...(environmentMapUrl !== undefined ? { environmentMapUrl } : {}),
    };
    return {
      ...state,
      ...(environmentMapUrl !== undefined && showEnvironmentBackground
        ? { skyboxUrl: environmentMapUrl }
        : {}),
      ...(this.config.backgroundIntensity !== undefined
        ? { backgroundIntensity: this.config.backgroundIntensity }
        : {}),
      lighting,
    };
  }
}

export class DebugFeature {
  wireframe = false;
  freeze = false;
  showGUI = false;
  developerVessels = false;
}

export function tupleToViewerEngineLocalCoordinate(value: Vec3Tuple): Coordinate {
  return {
    kind: "engine-local",
    x: value[0],
    y: value[1],
    z: value[2],
    frameId: "s100-viewer-runtime",
  };
}

export function pickSourceFromCore(
  source: PickResult["source"],
): NonNullable<PickInfo["source"]> {
  if (source === "terrain" || source === "geometry") {
    return "geometry";
  }
  if (source === "sea-level-plane") {
    return "sea-level-plane";
  }
  return "none";
}

export function pickResultToPickInfo(
  result: PickResult | null,
  seaLevel: number,
): PickInfo {
  if (!result?.world) {
    return {
      isValid: false,
      xyz: [0, 0, seaLevel],
      seaLevel,
      source: "none",
    };
  }

  const xyz = coordinateToViewerTuple(result.world);
  return {
    isValid: true,
    xyz,
    hasDepth: result.depthMeters !== undefined,
    seaLevel,
    source: pickSourceFromCore(result.source),
    entity: result.native,
  };
}

export function coordinateToViewerTuple(coordinate: Coordinate): Vec3Tuple {
  if (coordinate.kind === "geodetic") {
    return [coordinate.lon, coordinate.lat, coordinate.height ?? 0];
  }
  return [coordinate.x, coordinate.y, coordinate.z ?? 0];
}

function tupleToVec3(value: Vec3Tuple): { x: number; y: number; z: number } {
  return {
    x: value[0],
    y: value[1],
    z: value[2],
  };
}

function engineCameraPoseToCameraUpdate(pose: EngineCameraPose): CameraUpdate {
  return {
    position: [pose.position.x, pose.position.y, pose.position.z],
    rotation: [pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w],
    ...(pose.focalDistance !== undefined
      ? { focalDistance: pose.focalDistance }
      : {}),
  };
}

function cloneCorners(corners: Corners2D): Corners2D {
  return {
    topLeft: [...corners.topLeft],
    topRight: [...corners.topRight],
    bottomLeft: [...corners.bottomLeft],
    bottomRight: [...corners.bottomRight],
  };
}
