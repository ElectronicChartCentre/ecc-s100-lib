import {
  createS100Viewer,
  S100ProductType,
  type BaseLayerSpec,
  type CameraControlConfig,
  type CameraPose as CoreCameraPose,
  type Coordinate,
  type CreateS100ViewerOptions,
  type EngineScene,
  type EngineViewerHost,
  type PickRequest,
  type PickResult,
  type S100EngineAdapter,
  type S100Layer,
  type S100Scene,
  type S100Unsubscribe,
  type S100Viewer,
  type SceneOptions,
  type MapOverlayLayerSpec,
  type S101EncLayerSpec,
  type S102BathymetryLayerSpec,
  type S111SurfaceCurrentLayerSpec,
  type VesselLayerSpec,
  type EnvironmentState,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter, type NasaAmmosAdapterOptions } from "@ecc/s100-viewer-adapter-nasa-ammos";

export type {
  MapOverlayLayerSpec,
  S101EncLayerSpec,
  S102BathymetryLayerSpec,
  S111SurfaceCurrentLayerSpec,
  VesselLayerSpec,
} from "@ecc/s100-viewer";

export type Subscription = {
  unsubscribe(): void;
};

export class EventEmitter<TPayload> {
  private readonly listeners = new Set<(payload: TPayload) => void>();

  get size(): number {
    return this.listeners.size;
  }

  subscribe(listener: (payload: TPayload) => void): Subscription {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  on(listener: (payload: TPayload) => void): Subscription {
    return this.subscribe(listener);
  }

  emit(payload: TPayload): void {
    for (const listener of [...this.listeners]) {
      listener(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number];

export type CameraPose = {
  position: Vec3Tuple;
  rotation: QuatTuple;
  focalDistance?: number;
};

export type CameraUpdate = CameraPose;

export enum MapLayerType {
  Base = 0,
  MaskLayer = 1,
  BaseTransparent = 2,
}

export enum MapDiscardMode {
  BaseMapAlpha = 0,
  None = 1,
  Transparent = 1,
  MaskLayerAlphaZero = 2,
  MaskLayerAlphaOne = 3,
}

export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Off = 5,
}

export type LogSettings = {
  logLevel?: LogLevel;
  cogsLogging?: boolean;
  webTexLoader?: boolean;
  resources?: boolean;
  extensionLoading?: boolean;
  capabilities?: boolean;
  GLES30?: boolean;
  shaderInfo?: boolean;
  shaderSource?: boolean;
  OGC3DTiles?: boolean;
};

export class ConsoleLogger {
  debug(...args: unknown[]): void {
    console.debug(...args);
  }

  info(...args: unknown[]): void {
    console.info(...args);
  }

  warn(...args: unknown[]): void {
    console.warn(...args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }
}

export enum DataFormat {
  Grid = 2,
  Grid_UngeoRectified = 3,
}

export enum SeaLevelIndicatorMode {
  Off = 0,
  Circle = 1,
}

export type PrismVec2Tuple = [number, number];

export type Corners2D = {
  topLeft: PrismVec2Tuple;
  topRight: PrismVec2Tuple;
  bottomLeft: PrismVec2Tuple;
  bottomRight: PrismVec2Tuple;
};

export type RGBA = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type TerrainDataset = {
  id?: string;
  baseURL: string;
  additionalURLParameters?: string;
  accessToken?: string;
  detailFactor?: number;
};

export type TerrainSettings = {
  rootPosition?: Vec3Tuple;
  renderBBoxes: boolean;
  detailFactor: number;
  neverDiscardRootNodes: boolean;
  waitForSiblings: boolean;
};

export type TerrainDisplayProperties = {
  unsafeDepth: number;
  seaContour: boolean;
  seaLevel: number;
  showContour: boolean;
  contourInterval: number;
};

export type MapSpecification = {
  id: string;
  type: MapLayerType;
  corners: {
    upperLeft: [number, number];
    upperRight: [number, number];
    lowerLeft: [number, number];
    lowerRight: [number, number];
  };
  dataset: {
    mapSubset: {
      min: [number, number];
      max: [number, number];
    };
    extents: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
    minLevel: number;
    maxLevel: number;
  };
  quality?: unknown;
  urlTemplate: string;
};

export type VesselDimensions = {
  draught: number;
  bow: number;
  stern: number;
  port: number;
  starboard: number;
};

export type ModelAssetSpecification = {
  path: string;
  name: string;
  orientation?: unknown;
  boundingBox?: unknown;
};

export type VesselSpecification = {
  model: ModelAssetSpecification;
  dimensions: VesselDimensions;
};

export type CustomModelScale = number | Vec3Tuple;

export type CustomModelSpecification = ModelAssetSpecification & {
  position?: Vec3Tuple;
  rotation?: QuatTuple;
  scale?: CustomModelScale;
  visible?: boolean;
  transformControls?: boolean | { enabled?: boolean; mode?: TransformControlsMode };
};

export type TransformControlsMode = "translate" | "rotate" | "scale";

export type TransformControlsFacade = {
  mode: TransformControlsMode;
  setMode(mode: TransformControlsMode): void;
};

export type SurfaceCurrentDataset = {
  id?: string;
  timeRecordInterval?: number;
  dateTimeOfFirstRecord?: string;
  dateTimeOfLastRecord?: string;
  numberOfTimes?: number;
  [key: string]: unknown;
};

export type PickedInfo = {
  isValid: boolean;
  xyz: Vec3Tuple;
  hasDepth?: boolean;
  seaLevel?: number;
  source?: "geometry" | "sea-level-plane" | "none";
  entity?: unknown;
  view?: unknown;
  selected?: unknown;
};

export type ViewerConfig = NasaAmmosAdapterOptions & {
  adapter?: S100EngineAdapter;
  cameraControls?: CameraControlConfig;
  logSettings?: LogSettings;
  sceneOptions?: SceneOptions;
};

export type LegacyS100ViewerFacade = {
  readonly viewer: S100Viewer;
  createScene: S100Viewer["createScene"];
  destroy: S100Viewer["destroy"];
};

export const createLegacyS100ViewerFacade = async (
  options: CreateS100ViewerOptions,
): Promise<LegacyS100ViewerFacade> => {
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

  static async create(parent: HTMLElement | null, config: ViewerConfig = {}): Promise<Viewer> {
    const adapter = config.adapter ?? createNasaAmmosAdapter(config);
    const options: CreateS100ViewerOptions = {
      adapter,
      container: parent,
    };
    if (config.cameraControls !== undefined) {
      options.cameraControls = config.cameraControls;
    }
    if (config.logger !== undefined) {
      options.logger = config.logger;
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

  constructor(readonly coreScene: S100Scene, readonly config: ViewerConfig = {}) {
    this.Terrain = new TerrainFeature(this);
    this.S111 = new S111Feature(this);
    this.Map = new MapFeature(this);
    this.HoverPrism = new HoverPrismFeature(this.coreScene);
    this.Prism = this.HoverPrism;
    this.CustomModels = new CustomModelFeature(this);
    this.Models = this.CustomModels;
    this.VesselFeature = new VesselFeature(this);
    this.PickingRay = new PickingRayFeature(this.coreScene);
    this.Picking = new PickingFeature(this.coreScene);
    this.CameraConstraint = new PlaceholderFeature("CameraConstraint");
    this.Lighting = new LightingFeature(this.coreScene, this.config);
    this.Debug = new DebugFeature();
    this.cameraNavigation = new CameraNavigation(this.coreScene);
    this.cameraChangedUnsubscribe = this.coreScene.camera.onChanged((pose) => {
      this.cameraChanged.emit(coreCameraPoseToCameraUpdate(pose));
    });
  }

  initialized(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async destroy(): Promise<void> {
    this.cameraChangedUnsubscribe();
    this.cameraChanged.clear();
    this.Picking.destroy();
    await this.coreScene.destroy();
  }

  get seaLevel(): number {
    return this.coreScene.getSeaLevel();
  }

  set seaLevel(value: number) {
    this.coreScene.setSeaLevel(value);
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
      target: tupleToEngineLocalCoordinate(target),
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

class LegacyLayerView<TSpec extends BaseLayerSpec> {
  visible: boolean;
  protected spec: TSpec;
  private destroyed = false;
  private layer: S100Layer<TSpec> | null = null;
  private readonly ready: Promise<S100Layer<TSpec>>;
  private pending: Promise<unknown>;

  constructor(
    private readonly scene: ViewerScene,
    spec: TSpec,
    private readonly onDestroy: () => void,
  ) {
    this.spec = { ...spec };
    this.visible = spec.visible ?? true;
    this.ready = scene.coreScene.layers.add(this.spec).then((layer) => {
      this.layer = layer;
      return layer;
    });
    this.pending = this.ready;
  }

  initialized(): Promise<boolean> {
    return this.pending.then(
      () => true,
      () => false,
    );
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
    void this.patch({ visible } as Partial<TSpec>);
  }

  getNativeHandle<TNative = unknown>(): TNative | null {
    return this.layer?.getNativeHandle<TNative>() ?? null;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    try {
      const layer = await this.ready;
      await this.scene.coreScene.layers.remove(layer);
    } finally {
      this.onDestroy();
    }
  }

  protected async patch(patch: Partial<TSpec>): Promise<void> {
    this.spec = {
      ...this.spec,
      ...patch,
    };
    this.pending = this.pending.then(async () => {
      const layer = await this.ready;
      await layer.update(patch);
    });
    await this.pending;
  }
}

export class TerrainFeature {
  private readonly views = new Set<TerrainView>();

  constructor(private readonly scene: ViewerScene) {}

  add(dataset: TerrainDataset): TerrainView {
    const view = new TerrainView(dataset, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: TerrainView): void {
    view.destroy();
  }

  get size(): number {
    return this.views.size;
  }
}

export class TerrainView extends LegacyLayerView<S102BathymetryLayerSpec> {
  readonly terrain: TerrainDisplayProperties;
  readonly settings: TerrainSettings;

  constructor(
    readonly dataset: TerrainDataset,
    scene: ViewerScene,
    onDestroy: () => void,
  ) {
    const terrainState = {
      unsafeDepth: 0,
      seaContour: false,
      seaLevel: scene.seaLevel,
      showContour: false,
      contourInterval: 5,
    };
    const source: S102BathymetryLayerSpec["source"] = {
      kind: "3d-tiles",
      url: dataset.baseURL,
    };
    const query = parseAdditionalUrlParameters(dataset.additionalURLParameters);
    if (query !== undefined) {
      source.query = query;
      const crs = getCrsFromQuery(query);
      if (crs !== undefined) {
        source.crs = crs;
      }
    }
    if (dataset.accessToken !== undefined) {
      source.headers = { Authorization: `Bearer ${dataset.accessToken}` };
    }
    const nasaAmmosExtension: Record<string, unknown> = {
      detailFactor: dataset.detailFactor ?? 1,
    };
    if (dataset.additionalURLParameters !== undefined) {
      nasaAmmosExtension.additionalURLParameters = dataset.additionalURLParameters;
    }
    const spec: S102BathymetryLayerSpec = {
      id: dataset.id ?? `terrain-${nextId()}`,
      product: S100ProductType.S102,
      source,
      style: {
        unsafeDepth: terrainState.unsafeDepth,
        seaLevel: terrainState.seaLevel,
        contours: {
          visible: terrainState.showContour,
          intervalMeters: terrainState.contourInterval,
        },
      },
      extensions: {
        nasaAmmos: nasaAmmosExtension,
      },
    };
    super(scene, spec, onDestroy);
    this.terrain = createTerrainDisplayProperties(terrainState, () => {
      void this.patch({
        style: {
          unsafeDepth: terrainState.unsafeDepth,
          seaLevel: terrainState.seaLevel,
          contours: {
            visible: terrainState.showContour || terrainState.seaContour,
            intervalMeters: terrainState.contourInterval,
          },
        },
      });
    });
    this.settings = {
      renderBBoxes: false,
      detailFactor: dataset.detailFactor ?? 1,
      neverDiscardRootNodes: false,
      waitForSiblings: false,
    };
  }
}

export class S111Feature {
  private readonly views = new Set<S111View>();

  constructor(private readonly scene: ViewerScene) {}

  add(dataset: SurfaceCurrentDataset): S111View {
    const view = new S111View(dataset, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: S111View): void {
    view.destroy();
  }
}

export class S111View extends LegacyLayerView<S111SurfaceCurrentLayerSpec> {
  disableAutoScaling = false;
  scalingMode = "custom";
  customScale = 1;
  readonly time: {
    startTime: number;
    endTime: number;
    currentTime: number;
  };
  private currentTimeMs: number;

  constructor(
    readonly dataset: SurfaceCurrentDataset,
    scene: ViewerScene,
    onDestroy: () => void,
  ) {
    const startTime = parseTime(dataset.dateTimeOfFirstRecord) ?? 0;
    const intervalSeconds = normalizePositiveInteger(dataset.timeRecordInterval, 1);
    const recordCount = getSurfaceCurrentRecordCount(dataset);
    const endTime =
      parseTime(dataset.dateTimeOfLastRecord) ??
      startTime + intervalSeconds * 1000 * Math.max(0, recordCount - 1);
    const initialScale = 1;
    const source: S111SurfaceCurrentLayerSpec["source"] = {
      kind: "static-json",
      data: dataset,
    };
    const crs = getDatasetCrs(dataset);
    if (crs !== undefined) {
      source.crs = crs;
    }

    const spec: S111SurfaceCurrentLayerSpec = {
      id: dataset.id ?? `s111-${nextId()}`,
      product: S100ProductType.S111,
      source,
      time: {
        interpolation: "nearest",
      },
      style: {
        renderer: "arrows",
        scale: initialScale,
      },
    };
    super(scene, spec, onDestroy);
    this.currentTimeMs = startTime;
    const view = this;
    this.time = {
      startTime,
      endTime,
      get currentTime() {
        return view.currentTimeMs;
      },
      set currentTime(value: number) {
        view.currentTimeMs = Number.isFinite(value) ? value : startTime;
        scene.coreScene.time.setCurrent(new Date(view.currentTimeMs));
      },
    };
  }

  setCustomScale(scale: number): void {
    const finiteScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.customScale = finiteScale;
    this.disableAutoScaling = true;
    void this.patch({
      style: {
        renderer: this.spec.style?.renderer ?? "arrows",
        ...this.spec.style,
        scale: finiteScale,
      },
    });
  }
}

export class MapFeature {
  private currentDiscardMode = MapDiscardMode.Transparent;
  private readonly views = new Set<MapView>();

  constructor(private readonly scene: ViewerScene) {}

  get discardMode(): MapDiscardMode {
    return this.currentDiscardMode;
  }

  set discardMode(discardMode: MapDiscardMode) {
    this.currentDiscardMode = discardMode;
    for (const view of this.views) {
      view.setDiscardMode(discardMode);
    }
  }

  add(specification: MapSpecification): MapView {
    const view = new MapView(
      specification,
      this.currentDiscardMode,
      this.scene,
      () => {
        this.views.delete(view);
      },
    );
    this.views.add(view);
    return view;
  }

  remove(view: MapView): void {
    view.destroy();
  }
}

export class MapView extends LegacyLayerView<S101EncLayerSpec | MapOverlayLayerSpec> {
  private currentAlpha = 1;
  private currentDiscardMode: MapDiscardMode;

  constructor(
    readonly specification: MapSpecification,
    discardMode: MapDiscardMode,
    scene: ViewerScene,
    onDestroy: () => void,
  ) {
    super(scene, mapSpecificationToLayerSpec(specification, discardMode), onDestroy);
    this.currentDiscardMode = discardMode;
  }

  get alpha(): number {
    return this.currentAlpha;
  }

  set alpha(value: number) {
    this.currentAlpha = clamp01(value);
    void this.patch({ opacity: this.currentAlpha });
  }

  setDiscardMode(discardMode: MapDiscardMode): void {
    this.currentDiscardMode = discardMode;
    void this.patch({
      extensions: createMapLayerExtensions(
        this.spec.extensions,
        this.specification,
        this.currentDiscardMode,
      ),
    });
  }
}

export class CustomModelFeature {
  private readonly views = new Set<CustomModelView>();

  constructor(private readonly scene: ViewerScene) {}

  add(specification: CustomModelSpecification): CustomModelView {
    const view = new CustomModelView(specification, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: CustomModelView): void {
    view.destroy();
  }
}

export class CustomModelView extends LegacyLayerView<VesselLayerSpec> {
  readonly loadChanged = new EventEmitter<{ status: "loaded" | "error"; error?: unknown }>();
  readonly positionChanged = new EventEmitter<Vec3Tuple>();
  readonly headingChanged = new EventEmitter<number>();
  readonly loaded: Promise<boolean>;
  private position: Vec3Tuple;
  private heading = 0;

  constructor(
    readonly specification: CustomModelSpecification,
    scene: ViewerScene,
    onDestroy: () => void,
  ) {
    const position = specification.position ?? [0, 0, 0];
    const spec: VesselLayerSpec = {
      id: specification.name ?? `model-${nextId()}`,
      product: "vessel",
      source: {
        kind: "model",
        url: specification.path,
        format: "glb",
      },
      pose: {
        position: tupleToEngineLocalCoordinate(position),
        headingDegrees: 0,
      },
      extensions: {
        nasaAmmos: {
          dimensions: {
            draught: 1,
            bow: 1,
            stern: 1,
            port: 1,
            starboard: 1,
          },
        },
      },
    };
    if (specification.visible !== undefined) {
      spec.visible = specification.visible;
    }
    super(
      scene,
      spec,
      onDestroy,
    );
    this.position = [...position];
    this.loaded = this.initialized();
    void this.loaded.then((loaded) => {
      this.loadChanged.emit({ status: loaded ? "loaded" : "error" });
    });
  }

  getPosition(): Vec3Tuple {
    return [...this.position];
  }

  setPosition(position: Vec3Tuple): void {
    this.position = normalizeVec3Tuple(position, this.position);
    void this.patch({
      pose: {
        ...this.spec.pose,
        position: tupleToEngineLocalCoordinate(this.position),
      },
    });
    this.positionChanged.emit(this.getPosition());
  }

  getHeading(): number {
    return this.heading;
  }

  setHeading(heading: number): void {
    this.heading = normalizeDegrees(heading);
    void this.patch({
      pose: {
        ...this.spec.pose,
        headingDegrees: this.heading,
      },
    });
    this.headingChanged.emit(this.heading);
  }

  setScale(_scale: CustomModelScale): void {
    return undefined;
  }

  setTransformMode(_mode: TransformControlsMode): void {
    return undefined;
  }

  getTransformMode(): TransformControlsMode {
    return "translate";
  }
}

export class VesselFeature {
  private readonly views = new Set<VesselView>();

  constructor(private readonly scene: ViewerScene) {}

  add(specification: VesselSpecification): VesselView {
    const view = new VesselView(specification, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: VesselView): void {
    view.destroy();
  }
}

export class VesselView extends LegacyLayerView<VesselLayerSpec> {
  readonly positionChanged = new EventEmitter<Vec3Tuple>();
  readonly model: VesselDimensions;
  readonly seaLevelIndicator: {
    mode: SeaLevelIndicatorMode;
    seaSurfaceVisible: boolean;
    setSeaSurfaceVisible(visible: boolean): void;
  };
  readonly transformControls: TransformControlsFacade;
  private position: Vec3Tuple = [0, 0, 0];
  private heading = 0;
  private seaLevelIndicatorMode = SeaLevelIndicatorMode.Off;
  private seaSurfaceVisible = false;
  private nativePositionSubscription: Subscription | null = null;
  private nativeHeadingSubscription: Subscription | null = null;

  constructor(
    readonly specification: VesselSpecification,
    scene: ViewerScene,
    onDestroy: () => void,
  ) {
    const spec = vesselSpecificationToLayerSpec(specification, [0, 0, 0], 0);
    super(scene, spec, onDestroy);
    this.model = { ...specification.dimensions };
    const view = this;
    this.seaLevelIndicator = {
      get mode() {
        return view.seaLevelIndicatorMode;
      },
      set mode(mode: SeaLevelIndicatorMode) {
        view.seaLevelIndicatorMode = mode;
        view.updateSeaLevelIndicatorStyle();
      },
      get seaSurfaceVisible() {
        return view.seaSurfaceVisible;
      },
      set seaSurfaceVisible(visible: boolean) {
        view.seaSurfaceVisible = visible;
        view.updateSeaLevelIndicatorStyle();
      },
      setSeaSurfaceVisible(visible: boolean) {
        view.seaSurfaceVisible = visible;
        view.updateSeaLevelIndicatorStyle();
      },
    };
    this.transformControls = {
      mode: "translate",
      setMode(mode: TransformControlsMode) {
        view.transformControls.mode = mode;
      },
    };
    void this.initialized().then((initialized) => {
      if (initialized) {
        this.attachNativePositionBridge();
      }
    });
  }

  getPosition(): Vec3Tuple {
    return [...this.position];
  }

  setPosition(position: Vec3Tuple): void {
    this.position = normalizeVec3Tuple(position, this.position);
    this.updatePose();
    this.positionChanged.emit(this.getPosition());
  }

  getHeading(): number {
    return this.heading;
  }

  setHeading(heading: number): void {
    this.heading = normalizeDegrees(heading);
    this.updatePose();
  }

  setDimensions(dimensions: VesselDimensions): void {
    Object.assign(this.model, dimensions);
    void this.patch({
      extensions: {
        ...this.spec.extensions,
        nasaAmmos: {
          ...this.getNasaAmmosExtensions(),
          dimensions: this.model,
        },
      },
    });
  }

  setWidth(width: number): void {
    const halfWidth = width / 2;
    this.model.port = halfWidth;
    this.model.starboard = halfWidth;
    this.setDimensions(this.model);
  }

  setLength(length: number): void {
    this.model.bow = length / 2;
    this.model.stern = length / 2;
    this.setDimensions(this.model);
  }

  private updatePose(): void {
    void this.patch({
      pose: {
        ...this.spec.pose,
        position: tupleToEngineLocalCoordinate(this.position),
        headingDegrees: this.heading,
      },
    });
  }

  private updateSeaLevelIndicatorStyle(): void {
    void this.patch({
      style: {
        ...this.spec.style,
        showSeaLevelIndicator: this.seaLevelIndicatorMode === SeaLevelIndicatorMode.Circle,
      },
      extensions: {
        ...this.spec.extensions,
        nasaAmmos: {
          ...this.getNasaAmmosExtensions(),
          seaSurfaceVisible: this.seaSurfaceVisible,
        },
      },
    });
  }

  override async destroy(): Promise<void> {
    this.nativePositionSubscription?.unsubscribe();
    this.nativePositionSubscription = null;
    this.nativeHeadingSubscription?.unsubscribe();
    this.nativeHeadingSubscription = null;
    await super.destroy();
  }

  private attachNativePositionBridge(): void {
    if (this.nativePositionSubscription) {
      return;
    }

    const nativeView = getNativeVesselView(this.getNativeHandle());
    if (!nativeView?.positionChanged?.subscribe) {
      return;
    }

    this.nativePositionSubscription = nativeView.positionChanged.subscribe((position) => {
      this.position = normalizeVec3Tuple(position, this.position);
      this.positionChanged.emit(this.getPosition());
    });
    if (nativeView.headingChanged?.subscribe) {
      this.nativeHeadingSubscription = nativeView.headingChanged.subscribe((heading) => {
        this.heading = normalizeDegrees(heading);
      });
    }
  }

  private getNasaAmmosExtensions(): Record<string, unknown> {
    const extension = this.spec.extensions?.nasaAmmos;
    return extension && typeof extension === "object"
      ? { ...(extension as Record<string, unknown>) }
      : {};
  }
}

class PickingRayFeature {
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

class PickingFeature {
  readonly Mousemove = new EventEmitter<PickedInfo>();
  readonly MouseSelect = new EventEmitter<PickedInfo>();
  readonly SelectionChanged = new EventEmitter<PickedInfo>();
  private readonly unsubscribePickChanged: () => void;

  constructor(private readonly scene: S100Scene) {
    this.unsubscribePickChanged = this.scene.events.on("pick.changed", (result) => {
      this.Mousemove.emit(pickResultToLegacy(result, this.scene.getSeaLevel()));
    });
  }

  async pick(request: PickRequest): Promise<PickedInfo> {
    const result = await this.scene.picking.pick(request);
    return pickResultToLegacy(result, this.scene.getSeaLevel());
  }

  destroy(): void {
    this.unsubscribePickChanged();
    this.Mousemove.clear();
    this.MouseSelect.clear();
    this.SelectionChanged.clear();
  }
}

class PlaceholderFeature {
  constructor(readonly name: string) {}
}

class HoverPrismFeature {
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

class LightingFeature {
  environment = "default";
  skyDomeEnabled = false;

  constructor(
    private readonly scene: S100Scene,
    private readonly config: ViewerConfig = {},
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

class DebugFeature {
  wireframe = false;
  freeze = false;
  showGUI = false;
  developerVessels = false;
}

type NativeVesselViewLike = {
  getPosition?: () => Vec3Tuple;
  getHeading?: () => number;
  positionChanged?: {
    subscribe(listener: (position: Vec3Tuple) => void): Subscription;
  };
  headingChanged?: {
    subscribe(listener: (heading: number) => void): Subscription;
  };
};

function getNativeVesselView(nativeHandle: unknown): NativeVesselViewLike | null {
  if (!nativeHandle || typeof nativeHandle !== "object") {
    return null;
  }

  const view = (nativeHandle as { view?: unknown }).view;
  if (!view || typeof view !== "object") {
    return null;
  }

  return view as NativeVesselViewLike;
}

let idCounter = 0;

function nextId(): number {
  idCounter += 1;
  return idCounter;
}

function parseAdditionalUrlParameters(parameters: string | undefined): Record<string, string> | undefined {
  if (!parameters) {
    return undefined;
  }
  const parsed = new URLSearchParams(parameters.startsWith("?") ? parameters.slice(1) : parameters);
  const query: Record<string, string> = {};
  for (const [key, value] of parsed) {
    query[key] = value;
  }
  return Object.keys(query).length ? query : undefined;
}

function getCrsFromQuery(query: Record<string, string> | undefined): string | undefined {
  if (!query) {
    return undefined;
  }
  return query.crs ?? query.CRS ?? query.srs ?? query.SRS;
}

function getCrsFromUrlTemplate(urlTemplate: string): string | undefined {
  const queryString = urlTemplate.split("?")[1];
  if (!queryString) {
    return undefined;
  }

  const normalizedTemplate = queryString
    .replaceAll("{xmin}", "0")
    .replaceAll("{ymin}", "0")
    .replaceAll("{xmax}", "1")
    .replaceAll("{ymax}", "1");
  return getCrsFromQuery(Object.fromEntries(new URLSearchParams(normalizedTemplate)));
}

function getDatasetCrs(dataset: SurfaceCurrentDataset): string | undefined {
  for (const key of ["crs", "epsgCrs", "srs", "SRS", "CRS"]) {
    const value = dataset[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function createTerrainDisplayProperties(
  state: TerrainDisplayProperties,
  onChange: () => void,
): TerrainDisplayProperties {
  return {
    get unsafeDepth() {
      return state.unsafeDepth;
    },
    set unsafeDepth(value: number) {
      state.unsafeDepth = value;
      onChange();
    },
    get seaContour() {
      return state.seaContour;
    },
    set seaContour(value: boolean) {
      state.seaContour = value;
      onChange();
    },
    get seaLevel() {
      return state.seaLevel;
    },
    set seaLevel(value: number) {
      state.seaLevel = value;
      onChange();
    },
    get showContour() {
      return state.showContour;
    },
    set showContour(value: boolean) {
      state.showContour = value;
      onChange();
    },
    get contourInterval() {
      return state.contourInterval;
    },
    set contourInterval(value: number) {
      state.contourInterval = value;
      onChange();
    },
  };
}

function mapSpecificationToLayerSpec(
  specification: MapSpecification,
  discardMode: MapDiscardMode,
): S101EncLayerSpec | MapOverlayLayerSpec {
  const crs = getCrsFromUrlTemplate(specification.urlTemplate);
  const base = {
    id: specification.id,
    source: {
      kind: "wms" as const,
      url: specification.urlTemplate,
      layers: [specification.id],
      ...(crs !== undefined ? { crs } : {}),
    },
    visible: false,
    opacity: 1,
    spatialExtent: {
      ...(crs !== undefined ? { crs } : {}),
      minX: specification.dataset.extents.minX,
      minY: specification.dataset.extents.minY,
      maxX: specification.dataset.extents.maxX,
      maxY: specification.dataset.extents.maxY,
    },
    extensions: createMapLayerExtensions(undefined, specification, discardMode),
  };

  if (specification.type === MapLayerType.MaskLayer) {
    return {
      ...base,
      product: "map-overlay",
      role: "mask",
    };
  }

  return {
    ...base,
    product: S100ProductType.S101,
    role: specification.type === MapLayerType.Base ? "basemap" : "overlay",
  };
}

function createMapLayerExtensions(
  existing: Record<string, unknown> | undefined,
  specification: MapSpecification,
  discardMode: MapDiscardMode,
): Record<string, unknown> {
  const nasaAmmos = existing?.nasaAmmos && typeof existing.nasaAmmos === "object"
    ? { ...(existing.nasaAmmos as Record<string, unknown>) }
    : {};
  const cogs = existing?.cogs && typeof existing.cogs === "object"
    ? { ...(existing.cogs as Record<string, unknown>) }
    : {};

  return {
    ...existing,
    nasaAmmos: {
      ...nasaAmmos,
      mapSpecification: specification,
    },
    cogs: {
      ...cogs,
      mapSpecification: specification,
      discardMode,
    },
  };
}

function vesselSpecificationToLayerSpec(
  specification: VesselSpecification,
  position: Vec3Tuple,
  headingDegrees: number,
): VesselLayerSpec {
  return {
    id: specification.model.name ?? `vessel-${nextId()}`,
    product: "vessel",
    source: {
      kind: "model",
      url: specification.model.path,
      format: "glb",
    },
    pose: {
      position: tupleToEngineLocalCoordinate(position),
      headingDegrees,
    },
    style: {
      draughtMeters: specification.dimensions.draught,
      showSeaLevelIndicator: false,
    },
    extensions: {
      nasaAmmos: {
        dimensions: specification.dimensions,
        model: {
          boundingBox: specification.model.boundingBox,
          orientation: specification.model.orientation,
        },
      },
    },
  };
}

function tupleToVec3(value: Vec3Tuple): { x: number; y: number; z: number } {
  return {
    x: value[0],
    y: value[1],
    z: value[2],
  };
}

function coreCameraPoseToCameraUpdate(pose: CoreCameraPose): CameraUpdate {
  return {
    position: [pose.position.x, pose.position.y, pose.position.z],
    rotation: [pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w],
    ...(pose.focalDistance !== undefined
      ? { focalDistance: pose.focalDistance }
      : {}),
  };
}

function tupleToEngineLocalCoordinate(value: Vec3Tuple): Coordinate {
  return {
    kind: "engine-local",
    x: value[0],
    y: value[1],
    z: value[2],
    frameId: "legacy-s100-viewer",
  };
}

function normalizeVec3Tuple(value: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple {
  return [
    normalizeNumber(value[0], fallback[0]),
    normalizeNumber(value[1], fallback[1]),
    normalizeNumber(value[2], fallback[2]),
  ];
}

function normalizeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return ((value % 360) + 360) % 360;
}

function parseTime(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!compact) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = compact;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function getSurfaceCurrentRecordCount(dataset: SurfaceCurrentDataset): number {
  const explicitCount = normalizePositiveInteger(dataset.numberOfTimes, 0);
  if (explicitCount > 0) {
    return explicitCount;
  }

  const data = dataset.data;
  if (Array.isArray(data)) {
    return data.length;
  }

  return 1;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function cloneCorners(corners: Corners2D): Corners2D {
  return {
    topLeft: [...corners.topLeft],
    topRight: [...corners.topRight],
    bottomLeft: [...corners.bottomLeft],
    bottomRight: [...corners.bottomRight],
  };
}

function pickResultToLegacy(result: PickResult | null, seaLevel: number): PickedInfo {
  if (!result?.world) {
    return {
      isValid: false,
      xyz: [0, 0, seaLevel],
      seaLevel,
      source: "none",
    };
  }

  const xyz = coordinateToTuple(result.world);
  return {
    isValid: true,
    xyz,
    hasDepth: result.depthMeters !== undefined,
    seaLevel,
    source: toLegacyPickSource(result.source),
    entity: result.native,
  };
}

function toLegacyPickSource(source: PickResult["source"]): NonNullable<PickedInfo["source"]> {
  if (source === "terrain" || source === "geometry") {
    return "geometry";
  }
  if (source === "sea-level-plane") {
    return "sea-level-plane";
  }
  return "none";
}

function coordinateToTuple(coordinate: Coordinate): Vec3Tuple {
  if (coordinate.kind === "geodetic") {
    return [coordinate.lon, coordinate.lat, coordinate.height ?? 0];
  }
  return [coordinate.x, coordinate.y, coordinate.z ?? 0];
}

export type CompatEngineScene = EngineScene;
export type CompatEngineViewerHost = EngineViewerHost;
