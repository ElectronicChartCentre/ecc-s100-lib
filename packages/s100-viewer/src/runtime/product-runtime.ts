import type { BaseLayerSpec, S100Layer } from "../layers/types.js";
import type { Coordinate } from "../coordinates/types.js";
import type { S100Scene } from "../scene/types.js";
import type { QuatTuple, Vec3Tuple } from "../math.js";
import type { EncLayerSpec } from "../products/enc.js";
import type { MapOverlayLayerSpec } from "../products/viewer-features.js";
import type {
  S102BathymetryLayerSpec,
  S111SurfaceCurrentData,
  S111SurfaceCurrentLayerSpec,
} from "../products/iho-s100.js";
import { LayerBuilder } from "../products/layer-builder.js";
import type { VesselDimensions, VesselLayerSpec } from "../products/viewer-features.js";

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

export enum SeaLevelIndicatorMode {
  Off = 0,
  Circle = 1,
}

export type TerrainDataset = {
  id?: string;
  baseURL: string;
  additionalURLParameters?: string;
  accessToken?: string;
  detailFactor?: number;
};

export type TerrainInput = TerrainDataset | S102BathymetryLayerSpec;

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
  encStandard?: "S-101" | "S-57";
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
      crs?: string;
    };
    minLevel: number;
    maxLevel: number;
  };
  quality?: unknown;
  urlTemplate: string;
};

export type MapInput = MapSpecification | EncLayerSpec | MapOverlayLayerSpec;

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

export type TransformControlsMode = "translate" | "rotate" | "scale";

export type CustomModelSpecification = ModelAssetSpecification & {
  position?: Vec3Tuple;
  rotation?: QuatTuple;
  scale?: CustomModelScale;
  visible?: boolean;
  transformControls?: boolean | { enabled?: boolean; mode?: TransformControlsMode };
};

export type TransformControlsFacade = {
  mode: TransformControlsMode;
  setMode(mode: TransformControlsMode): void;
};

export type SurfaceCurrentDataset = S111SurfaceCurrentData;

export type S111Input = SurfaceCurrentDataset | S111SurfaceCurrentLayerSpec;

type NativeVesselViewLike = {
  positionChanged?: { subscribe(listener: (position: Vec3Tuple) => void): Subscription };
  headingChanged?: { subscribe(listener: (heading: number) => void): Subscription };
};

let idCounter = 0;

const nextId = (): number => {
  idCounter += 1;
  return idCounter;
};

export class ProductLayerView<TSpec extends BaseLayerSpec> {
  visible: boolean;
  protected spec: TSpec;
  private destroyed = false;
  private layer: S100Layer<TSpec> | null = null;
  private readonly ready: Promise<S100Layer<TSpec>>;
  private pending: Promise<unknown>;

  constructor(
    private readonly scene: S100Scene,
    spec: TSpec,
    private readonly onDestroy: () => void,
  ) {
    this.spec = { ...spec };
    this.visible = spec.visible ?? true;
    this.ready = scene.layers.add(this.spec).then((layer) => {
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
      await this.scene.layers.remove(layer);
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

  constructor(private readonly scene: S100Scene) {}

  add(input: TerrainInput): TerrainView {
    const view = new TerrainView(input, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: TerrainView): void {
    void view.destroy();
  }

  get size(): number {
    return this.views.size;
  }
}

export class TerrainView extends ProductLayerView<S102BathymetryLayerSpec> {
  readonly dataset: TerrainDataset | undefined;
  readonly terrain: TerrainDisplayProperties;
  readonly settings: TerrainSettings;

  constructor(
    input: TerrainInput,
    scene: S100Scene,
    onDestroy: () => void,
  ) {
    const dataset = isS102LayerSpec(input) ? undefined : input;
    const spec = isS102LayerSpec(input)
      ? input
      : terrainDatasetToLayerSpec(input, scene.getSeaLevel());
    const terrainState = terrainStateFromSpec(spec, scene.getSeaLevel());
    super(scene, spec, onDestroy);
    this.dataset = dataset;
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
      detailFactor: terrainDetailFactor(spec, dataset),
      neverDiscardRootNodes: false,
      waitForSiblings: false,
    };
  }
}

const isS102LayerSpec = (input: TerrainInput): input is S102BathymetryLayerSpec =>
  "product" in input && input.product === "S-102";

const terrainDatasetToLayerSpec = (
  dataset: TerrainDataset,
  seaLevel: number,
): S102BathymetryLayerSpec => {
  const query = parseAdditionalUrlParameters(dataset.additionalURLParameters);
  const crs = query === undefined ? undefined : getCrsFromQuery(query);
  const nasaAmmosExtension: Record<string, unknown> = {
    detailFactor: dataset.detailFactor ?? 1,
  };
  if (dataset.additionalURLParameters !== undefined) {
    nasaAmmosExtension.additionalURLParameters = dataset.additionalURLParameters;
  }
  return LayerBuilder.createS102({
    id: dataset.id ?? `terrain-${nextId()}`,
    url: dataset.baseURL,
    ...(query !== undefined ? { query } : {}),
    ...(crs !== undefined ? { crs } : {}),
    ...(dataset.accessToken !== undefined
      ? { headers: { Authorization: `Bearer ${dataset.accessToken}` } }
      : {}),
    style: {
      unsafeDepth: 0,
      seaLevel,
      contours: {
        visible: false,
        intervalMeters: 5,
      },
    },
    extensions: {
      nasaAmmos: nasaAmmosExtension,
    },
  });
};

const terrainStateFromSpec = (
  spec: S102BathymetryLayerSpec,
  seaLevel: number,
): {
  unsafeDepth: number;
  seaContour: boolean;
  seaLevel: number;
  showContour: boolean;
  contourInterval: number;
} => ({
  unsafeDepth: finiteNumber(spec.style?.unsafeDepth, 0),
  seaContour: false,
  seaLevel: finiteNumber(spec.style?.seaLevel, seaLevel),
  showContour: spec.style?.contours?.visible ?? false,
  contourInterval: finiteNumber(spec.style?.contours?.intervalMeters, 5),
});

const terrainDetailFactor = (
  spec: S102BathymetryLayerSpec,
  dataset: TerrainDataset | undefined,
): number => dataset?.detailFactor ?? getNumberFromExtensions(spec.extensions, "detailFactor", 1);

export class S111Feature {
  private readonly views = new Set<S111View>();

  constructor(private readonly scene: S100Scene) {}

  add(input: S111Input): S111View {
    const view = new S111View(input, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: S111View): void {
    void view.destroy();
  }
}

const isS111LayerSpec = (input: S111Input): input is S111SurfaceCurrentLayerSpec =>
  "product" in input && input.product === "S-111";

const surfaceCurrentDatasetFromSpec = (
  spec: S111SurfaceCurrentLayerSpec,
): SurfaceCurrentDataset => {
  if (spec.source.kind === "static-json" && isRecord(spec.source.data)) {
    return spec.source.data as SurfaceCurrentDataset;
  }
  throw new Error(
    "S111Feature.add requires a static-json S-111 layer spec. Use scene.layers.add for rest-json S-111 specs.",
  );
};

const surfaceCurrentDatasetToLayerSpec = (
  dataset: SurfaceCurrentDataset,
): S111SurfaceCurrentLayerSpec => {
  const crs = getDatasetCrs(dataset);
  return LayerBuilder.createStaticS111({
    id: dataset.id ?? `s111-${nextId()}`,
    data: dataset,
    ...(crs !== undefined ? { crs } : {}),
    time: {
      interpolation: "nearest",
    },
    style: {
      renderer: "arrows",
      scale: 1,
    },
  });
};

export class S111View extends ProductLayerView<S111SurfaceCurrentLayerSpec> {
  disableAutoScaling = false;
  scalingMode = "custom";
  customScale = 1;
  readonly time: {
    startTime: number;
    endTime: number;
    currentTime: number;
  };
  private currentTimeMs: number;
  readonly dataset: SurfaceCurrentDataset;

  constructor(
    input: S111Input,
    scene: S100Scene,
    onDestroy: () => void,
  ) {
    const dataset = isS111LayerSpec(input) ? surfaceCurrentDatasetFromSpec(input) : input;
    const spec = isS111LayerSpec(input) ? input : surfaceCurrentDatasetToLayerSpec(dataset);
    const startTime = parseTime(dataset.dateTimeOfFirstRecord) ?? 0;
    const intervalSeconds = normalizePositiveInteger(dataset.timeRecordInterval, 1);
    const recordCount = getSurfaceCurrentRecordCount(dataset);
    const endTime =
      parseTime(dataset.dateTimeOfLastRecord) ??
      startTime + intervalSeconds * 1000 * Math.max(0, recordCount - 1);
    super(scene, spec, onDestroy);
    this.dataset = dataset;
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
        scene.time.setCurrent(new Date(view.currentTimeMs));
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

  constructor(private readonly scene: S100Scene) {}

  get discardMode(): MapDiscardMode {
    return this.currentDiscardMode;
  }

  set discardMode(discardMode: MapDiscardMode) {
    this.currentDiscardMode = discardMode;
    for (const view of this.views) {
      view.setDiscardMode(discardMode);
    }
  }

  add(specification: MapInput): MapView {
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
    void view.destroy();
  }
}

export class MapView extends ProductLayerView<EncLayerSpec | MapOverlayLayerSpec> {
  readonly specification: MapSpecification | undefined;
  private currentAlpha = 1;
  private currentDiscardMode: MapDiscardMode;

  constructor(
    input: MapInput,
    discardMode: MapDiscardMode,
    scene: S100Scene,
    onDestroy: () => void,
  ) {
    let specification: MapSpecification | undefined;
    let spec: EncLayerSpec | MapOverlayLayerSpec;
    let effectiveDiscardMode = discardMode;
    if (isMapSpecification(input)) {
      specification = input;
      spec = mapSpecificationToLayerSpec(input, effectiveDiscardMode);
    } else {
      effectiveDiscardMode = getMapLayerDiscardMode(input, discardMode);
      spec = withMapLayerDiscardMode(input, effectiveDiscardMode);
    }
    super(scene, spec, onDestroy);
    this.specification = specification;
    this.currentDiscardMode = effectiveDiscardMode;
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
    const extensions = this.specification === undefined
      ? withMapDiscardModeExtension(this.spec.extensions, this.currentDiscardMode)
      : createMapLayerExtensions(
          this.spec.extensions,
          this.specification,
          this.currentDiscardMode,
        );
    void this.patch({
      extensions,
    });
  }
}

export class CustomModelFeature {
  private readonly views = new Set<CustomModelView>();

  constructor(private readonly scene: S100Scene) {}

  add(specification: CustomModelSpecification): CustomModelView {
    const view = new CustomModelView(specification, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: CustomModelView): void {
    void view.destroy();
  }
}

export class CustomModelView extends ProductLayerView<VesselLayerSpec> {
  readonly loadChanged = new EventEmitter<{ status: "loaded" | "error"; error?: unknown }>();
  readonly positionChanged = new EventEmitter<Vec3Tuple>();
  readonly headingChanged = new EventEmitter<number>();
  readonly loaded: Promise<boolean>;
  private position: Vec3Tuple;
  private heading = 0;

  constructor(
    readonly specification: CustomModelSpecification,
    scene: S100Scene,
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
      dimensions: {
        draught: 1,
        bow: 1,
        stern: 1,
        port: 1,
        starboard: 1,
      },
      referencePoint: "model-origin",
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
    super(scene, spec, onDestroy);
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

  constructor(private readonly scene: S100Scene) {}

  add(specification: VesselSpecification): VesselView {
    const view = new VesselView(specification, this.scene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: VesselView): void {
    void view.destroy();
  }
}

export class VesselView extends ProductLayerView<VesselLayerSpec> {
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
    scene: S100Scene,
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
      dimensions: { ...this.model },
      style: {
        ...this.spec.style,
        draughtMeters: this.model.draught,
      },
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

export const parseAdditionalUrlParameters = (
  parameters: string | undefined,
): Record<string, string> | undefined => {
  if (!parameters) {
    return undefined;
  }
  const parsed = new URLSearchParams(parameters.startsWith("?") ? parameters.slice(1) : parameters);
  const query: Record<string, string> = {};
  for (const [key, value] of parsed) {
    query[key] = value;
  }
  return Object.keys(query).length ? query : undefined;
};

export const getCrsFromQuery = (query: Record<string, string> | undefined): string | undefined => {
  if (!query) {
    return undefined;
  }
  return query.crs ?? query.CRS ?? query.srs ?? query.SRS;
};

export const getCrsFromUrlTemplate = (urlTemplate: string): string | undefined => {
  const queryString = urlTemplate.split("?")[1];
  if (!queryString) {
    return undefined;
  }

  const normalizedTemplate = queryString
    .split("{xmin}").join("0")
    .split("{ymin}").join("0")
    .split("{xmax}").join("1")
    .split("{ymax}").join("1");
  return getCrsFromQuery(Object.fromEntries(new URLSearchParams(normalizedTemplate)));
};

const isMapSpecification = (input: MapInput): input is MapSpecification =>
  !("product" in input);

const withMapLayerDiscardMode = <TSpec extends EncLayerSpec | MapOverlayLayerSpec>(
  spec: TSpec,
  discardMode: MapDiscardMode,
): TSpec => ({
  ...spec,
  extensions: withMapDiscardModeExtension(spec.extensions, discardMode),
});

const withMapDiscardModeExtension = (
  extensions: Record<string, unknown> | undefined,
  discardMode: MapDiscardMode,
): Record<string, unknown> => ({
  ...extensions,
  cogs: {
    ...recordFromUnknown(extensions?.cogs),
    discardMode,
  },
});

const getMapLayerDiscardMode = (
  spec: EncLayerSpec | MapOverlayLayerSpec,
  fallback: MapDiscardMode,
): MapDiscardMode => {
  const discardMode = getNumberFromExtensions(spec.extensions, "discardMode", fallback);
  return isMapDiscardMode(discardMode) ? discardMode : fallback;
};

const isMapDiscardMode = (value: number): value is MapDiscardMode =>
  value === MapDiscardMode.BaseMapAlpha ||
  value === MapDiscardMode.None ||
  value === MapDiscardMode.MaskLayerAlphaZero ||
  value === MapDiscardMode.MaskLayerAlphaOne;

export const mapSpecificationToLayerSpec = (
  specification: MapSpecification,
  discardMode: MapDiscardMode,
): EncLayerSpec | MapOverlayLayerSpec => {
  const crs = getCrsFromUrlTemplate(specification.urlTemplate) ?? specification.dataset.extents.crs;
  const quality = typeof specification.quality === "number" ? specification.quality : undefined;
  const baseOptions = {
    id: specification.id,
    urlTemplate: specification.urlTemplate,
    layers: [specification.id],
    ...(crs !== undefined ? { crs } : {}),
    visible: false,
    opacity: 1,
    corners: specification.corners,
    extents: {
      ...specification.dataset.extents,
      ...(crs !== undefined ? { crs } : {}),
    },
    mapSubset: specification.dataset.mapSubset,
    minLevel: specification.dataset.minLevel,
    maxLevel: specification.dataset.maxLevel,
    ...(quality !== undefined ? { quality } : {}),
    mapLayerType: specification.type,
    discardMode,
  };

  if (specification.type === MapLayerType.MaskLayer) {
    return LayerBuilder.createMapOverlayWmsTemplate({
      ...baseOptions,
      role: "mask",
    });
  }

  const role = specification.type === MapLayerType.Base ? "basemap" : "overlay";

  if (specification.encStandard === "S-57") {
    return LayerBuilder.createS57WmsTemplate({
      ...baseOptions,
      role,
    });
  }

  return LayerBuilder.createS101WmsTemplate({
    ...baseOptions,
    role,
  });
};

export const createMapLayerExtensions = (
  existing: Record<string, unknown> | undefined,
  specification: MapSpecification,
  discardMode: MapDiscardMode,
): Record<string, unknown> => {
  const nasaAmmos = existing?.nasaAmmos && typeof existing.nasaAmmos === "object"
    ? { ...(existing.nasaAmmos as Record<string, unknown>) }
    : {};
  const cogs = existing?.cogs && typeof existing.cogs === "object"
    ? { ...(existing.cogs as Record<string, unknown>) }
    : {};
  const minLevel = specification.dataset.minLevel;
  const maxLevel = specification.dataset.maxLevel;
  const quality = typeof specification.quality === "number" ? specification.quality : undefined;

  return {
    ...existing,
    nasaAmmos: {
      ...nasaAmmos,
      minLevel,
      maxLevel,
      ...(quality !== undefined ? { quality } : {}),
    },
    cogs: {
      ...cogs,
      minLevel,
      maxLevel,
      ...(quality !== undefined ? { quality } : {}),
      discardMode,
    },
  };
};

export const vesselSpecificationToLayerSpec = (
  specification: VesselSpecification,
  position: Vec3Tuple,
  headingDegrees: number,
): VesselLayerSpec => ({
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
  dimensions: { ...specification.dimensions },
  referencePoint: "transponder",
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
});

export const tupleToEngineLocalCoordinate = (value: Vec3Tuple): Coordinate => ({
  kind: "engine-local",
  x: value[0],
  y: value[1],
  z: value[2],
  frameId: "s100-product-runtime",
});

export const normalizeVec3Tuple = (value: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple => [
  normalizeNumber(value[0], fallback[0]),
  normalizeNumber(value[1], fallback[1]),
  normalizeNumber(value[2], fallback[2]),
];

export const normalizeDegrees = (value: number): number => {
  const finite = normalizeNumber(value, 0);
  return ((finite % 360) + 360) % 360;
};

export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
};

const createTerrainDisplayProperties = (
  state: TerrainDisplayProperties,
  onChange: () => void,
): TerrainDisplayProperties => ({
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
});

const getDatasetCrs = (dataset: SurfaceCurrentDataset): string | undefined => {
  for (const key of ["crs", "epsgCrs", "srs", "SRS", "CRS"]) {
    const value = dataset[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
};

const parseTime = (value: string | undefined): number | null => {
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
};

const getSurfaceCurrentRecordCount = (dataset: SurfaceCurrentDataset): number => {
  if (typeof dataset.numberOfTimes === "number" && dataset.numberOfTimes > 0) {
    return Math.floor(dataset.numberOfTimes);
  }
  if (Array.isArray(dataset.data)) {
    return dataset.data.length;
  }
  const candidateArrays = ["positions", "records", "samples", "values"];
  for (const key of candidateArrays) {
    const value = dataset[key];
    if (Array.isArray(value) && value.length > 0) {
      return value.length;
    }
  }
  return 1;
};

const normalizePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

const finiteNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeNumber = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const getNumberFromExtensions = (
  extensions: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number => {
  for (const namespace of ["nasaAmmos", "cogs", "cesium"]) {
    const value = recordFromUnknown(extensions?.[namespace])[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? { ...value } : {};

const getNativeVesselView = (nativeHandle: unknown): NativeVesselViewLike | null => {
  if (!nativeHandle || typeof nativeHandle !== "object") {
    return null;
  }
  const candidate = nativeHandle as { view?: unknown };
  return candidate.view && typeof candidate.view === "object"
    ? (candidate.view as NativeVesselViewLike)
    : null;
};
