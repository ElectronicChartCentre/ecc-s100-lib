import { S100ProductType } from "./types.js";
import type { BaseLayerSpec, LayerPatch, S100Layer } from "./types.js";
import type { Coordinate } from "../coordinates/types.js";
import type { S100Unsubscribe } from "../events/S100EventBus.js";
import type { Vec3Tuple } from "../math.js";
import type { EncLayerSpec } from "../products/enc.js";
import type {
  S102BathymetryLayerSpec,
  S111SurfaceCurrentData,
  S111SurfaceCurrentLayerSpec,
} from "../products/iho-s100.js";
import type {
  MapOverlayLayerSpec,
  VesselDimensions,
  VesselLayerSpec,
  VesselTransformControlMode,
} from "../products/viewer-features.js";

export type LayerControllerContext = {
  setSceneTime?(time: Date): void;
  getSceneTime?(): Date;
};

export type TerrainDisplayController = {
  unsafeDepth: number;
  seaLevel: number;
  seaContour: boolean;
  showContour: boolean;
  contourInterval: number;
};

export type TerrainSettingsController = {
  renderBBoxes: boolean;
  detailFactor: number;
  neverDiscardRootNodes: boolean;
  waitForSiblings: boolean;
};

export type TerrainContourOptions = {
  visible?: boolean;
  seaContour?: boolean;
  intervalMeters?: number;
};

export type TerrainDisplayPatch = {
  unsafeDepth?: number;
  seaLevel?: number;
  contours?: TerrainContourOptions;
};

export type TerrainLayerController = {
  readonly kind: "s102-terrain";
  readonly terrain: TerrainDisplayController;
  readonly settings: TerrainSettingsController;
  setUnsafeDepth(value: number): Promise<void>;
  setSeaLevel(value: number): Promise<void>;
  setContours(options: TerrainContourOptions): Promise<void>;
  updateDisplayStyle(patch: TerrainDisplayPatch): Promise<void>;
  setDetailFactor(value: number): Promise<void>;
};

export type SurfaceCurrentTimeController = {
  readonly startTime: number;
  readonly endTime: number;
  currentTime: number;
};

export type SurfaceCurrentLayerController = {
  readonly kind: "s111-surface-current";
  disableAutoScaling: boolean;
  scalingMode: "auto" | "custom";
  customScale: number;
  readonly time: SurfaceCurrentTimeController;
  setCustomScale(scale: number): Promise<void>;
  setAutoScaling(enabled: boolean): Promise<void>;
  setCurrentTime(time: number | Date): void;
};

export type MapLayerController = {
  readonly kind: "projected-map";
  alpha: number;
  discardMode: number;
  setAlpha(value: number): Promise<void>;
  setVisibility(visible: boolean): Promise<void>;
  setDiscardMode(discardMode: number): Promise<void>;
};

export type VesselSeaLevelIndicatorMode = "off" | "circle";

export type VesselSeaLevelIndicatorController = {
  mode: VesselSeaLevelIndicatorMode;
  oceanSurfaceVisible: boolean;
  setMode(mode: VesselSeaLevelIndicatorMode): Promise<void>;
  setOceanSurfaceVisible(visible: boolean): Promise<void>;
};

export type VesselTransformController = {
  mode: VesselTransformControlMode;
  setMode(mode: VesselTransformControlMode): Promise<void>;
};

export type VesselPosePatch = {
  position?: Vec3Tuple;
  headingDegrees?: number;
};

export type VesselLayerController = {
  readonly kind: "vessel";
  readonly dimensions: VesselDimensions;
  readonly seaLevelIndicator: VesselSeaLevelIndicatorController;
  readonly transformControls: VesselTransformController;
  getPosition(): Vec3Tuple;
  setPose(pose: VesselPosePatch): Promise<void>;
  setPosition(position: Vec3Tuple): Promise<void>;
  getHeading(): number;
  setHeading(heading: number): Promise<void>;
  setDimensions(dimensions: VesselDimensions): Promise<void>;
  setVisibility(visible: boolean): Promise<void>;
  setSeaLevelIndicatorMode(mode: VesselSeaLevelIndicatorMode): Promise<void>;
  setOceanSurfaceVisible(visible: boolean): Promise<void>;
  getTransformMode(): VesselTransformControlMode;
  setTransformMode(mode: VesselTransformControlMode): Promise<void>;
  onPositionChanged(listener: (position: Vec3Tuple) => void): S100Unsubscribe;
  onHeadingChanged(listener: (heading: number) => void): S100Unsubscribe;
  destroy(): void;
};

export type BaseLayerControllers = {
  terrain?: TerrainLayerController;
  surfaceCurrent?: SurfaceCurrentLayerController;
  map?: MapLayerController;
  vessel?: VesselLayerController;
};

export type LayerControllers<TSpec extends BaseLayerSpec = BaseLayerSpec> =
  Omit<BaseLayerControllers, "terrain" | "surfaceCurrent" | "map" | "vessel"> &
    (TSpec extends S102BathymetryLayerSpec
      ? { terrain: TerrainLayerController }
      : { terrain?: TerrainLayerController }) &
    (TSpec extends S111SurfaceCurrentLayerSpec
      ? { surfaceCurrent: SurfaceCurrentLayerController }
      : { surfaceCurrent?: SurfaceCurrentLayerController }) &
    (TSpec extends EncLayerSpec | MapOverlayLayerSpec
      ? { map: MapLayerController }
      : { map?: MapLayerController }) &
    (TSpec extends VesselLayerSpec
      ? { vessel: VesselLayerController }
      : { vessel?: VesselLayerController });

export const createLayerControllers = <TSpec extends BaseLayerSpec>(
  layer: S100Layer<TSpec>,
  context: LayerControllerContext = {},
): LayerControllers<TSpec> => {
  const controllers: BaseLayerControllers = {};

  if (isS102LayerSpec(layer.spec)) {
    controllers.terrain = new CoreTerrainLayerController(
      layer as unknown as S100Layer<S102BathymetryLayerSpec>,
    );
  }

  if (isS111LayerSpec(layer.spec)) {
    controllers.surfaceCurrent = new CoreSurfaceCurrentLayerController(
      layer as unknown as S100Layer<S111SurfaceCurrentLayerSpec>,
      context,
    );
  }

  if (isMapLayerSpec(layer.spec)) {
    controllers.map = new CoreMapLayerController(
      layer as unknown as S100Layer<EncLayerSpec | MapOverlayLayerSpec>,
    );
  }

  if (isVesselLayerSpec(layer.spec)) {
    controllers.vessel = new CoreVesselLayerController(
      layer as unknown as S100Layer<VesselLayerSpec>,
    );
  }

  return controllers as LayerControllers<TSpec>;
};

class CoreTerrainLayerController implements TerrainLayerController {
  readonly kind = "s102-terrain" as const;
  readonly terrain: TerrainDisplayController;
  readonly settings: TerrainSettingsController;
  private readonly terrainState: TerrainDisplayController;
  private readonly settingsState: TerrainSettingsController;

  constructor(private readonly layer: S100Layer<S102BathymetryLayerSpec>) {
    const spec = layer.spec;
    const contours = spec.style?.contours;
    this.terrainState = {
      unsafeDepth: finiteNumber(spec.style?.unsafeDepth, 0),
      seaLevel: finiteNumber(spec.style?.seaLevel, 0),
      seaContour: contours?.visible ?? false,
      showContour: contours?.visible ?? false,
      contourInterval: finiteNumber(contours?.intervalMeters, 5),
    };
    this.settingsState = {
      renderBBoxes: false,
      detailFactor: getNumberFromExtensions(spec.extensions, "detailFactor", 1),
      neverDiscardRootNodes: false,
      waitForSiblings: false,
    };

    const controller = this;
    this.terrain = {
      get unsafeDepth() {
        controller.syncFromLayerSpec();
        return controller.terrainState.unsafeDepth;
      },
      set unsafeDepth(value: number) {
        void controller.setUnsafeDepth(value);
      },
      get seaLevel() {
        controller.syncFromLayerSpec();
        return controller.terrainState.seaLevel;
      },
      set seaLevel(value: number) {
        void controller.setSeaLevel(value);
      },
      get seaContour() {
        controller.syncFromLayerSpec();
        return controller.terrainState.seaContour;
      },
      set seaContour(value: boolean) {
        void controller.setContours({ seaContour: value });
      },
      get showContour() {
        controller.syncFromLayerSpec();
        return controller.terrainState.showContour;
      },
      set showContour(value: boolean) {
        void controller.setContours({ visible: value });
      },
      get contourInterval() {
        controller.syncFromLayerSpec();
        return controller.terrainState.contourInterval;
      },
      set contourInterval(value: number) {
        void controller.setContours({ intervalMeters: value });
      },
    };

    this.settings = {
      get renderBBoxes() {
        return controller.settingsState.renderBBoxes;
      },
      set renderBBoxes(value: boolean) {
        controller.settingsState.renderBBoxes = value;
      },
      get detailFactor() {
        controller.syncFromLayerSpec();
        return controller.settingsState.detailFactor;
      },
      set detailFactor(value: number) {
        void controller.setDetailFactor(value);
      },
      get neverDiscardRootNodes() {
        return controller.settingsState.neverDiscardRootNodes;
      },
      set neverDiscardRootNodes(value: boolean) {
        controller.settingsState.neverDiscardRootNodes = value;
      },
      get waitForSiblings() {
        return controller.settingsState.waitForSiblings;
      },
      set waitForSiblings(value: boolean) {
        controller.settingsState.waitForSiblings = value;
      },
    };
  }

  private syncFromLayerSpec(): void {
    const spec = this.layer.spec;
    const contours = spec.style?.contours;
    this.terrainState.unsafeDepth = finiteNumber(
      spec.style?.unsafeDepth,
      this.terrainState.unsafeDepth,
    );
    this.terrainState.seaLevel = finiteNumber(spec.style?.seaLevel, this.terrainState.seaLevel);
    if (contours?.visible !== undefined) {
      this.terrainState.showContour = contours.visible;
      this.terrainState.seaContour = contours.visible;
    }
    this.terrainState.contourInterval = finiteNumber(
      contours?.intervalMeters,
      this.terrainState.contourInterval,
    );
    this.settingsState.detailFactor = getNumberFromExtensions(
      spec.extensions,
      "detailFactor",
      this.settingsState.detailFactor,
    );
  }

  setUnsafeDepth(value: number): Promise<void> {
    return this.updateDisplayStyle({ unsafeDepth: value });
  }

  setSeaLevel(value: number): Promise<void> {
    return this.updateDisplayStyle({ seaLevel: value });
  }

  setContours(options: TerrainContourOptions): Promise<void> {
    return this.updateDisplayStyle({ contours: options });
  }

  async updateDisplayStyle(patch: TerrainDisplayPatch): Promise<void> {
    this.syncFromLayerSpec();
    if (patch.unsafeDepth !== undefined) {
      this.terrainState.unsafeDepth = finiteNumber(patch.unsafeDepth, this.terrainState.unsafeDepth);
    }
    if (patch.seaLevel !== undefined) {
      this.terrainState.seaLevel = finiteNumber(patch.seaLevel, this.terrainState.seaLevel);
    }
    if (patch.contours?.visible !== undefined) {
      this.terrainState.showContour = patch.contours.visible;
    }
    if (patch.contours?.seaContour !== undefined) {
      this.terrainState.seaContour = patch.contours.seaContour;
    }
    if (patch.contours?.intervalMeters !== undefined) {
      this.terrainState.contourInterval = finiteNumber(
        patch.contours.intervalMeters,
        this.terrainState.contourInterval,
      );
    }

    const style = this.layer.spec.style ?? {};
    await this.layer.update({
      style: {
        ...style,
        unsafeDepth: this.terrainState.unsafeDepth,
        seaLevel: this.terrainState.seaLevel,
        contours: {
          ...style.contours,
          visible: this.terrainState.showContour || this.terrainState.seaContour,
          intervalMeters: this.terrainState.contourInterval,
        },
      },
    });
  }

  async setDetailFactor(value: number): Promise<void> {
    this.syncFromLayerSpec();
    this.settingsState.detailFactor = finiteNumber(value, this.settingsState.detailFactor);
    await this.layer.update({
      extensions: withNamespacedExtensionValue(
        this.layer.spec.extensions,
        "detailFactor",
        this.settingsState.detailFactor,
        ["nasaAmmos", "cogs", "cesium"],
      ),
    });
  }
}

class CoreSurfaceCurrentLayerController implements SurfaceCurrentLayerController {
  readonly kind = "s111-surface-current" as const;
  readonly time: SurfaceCurrentTimeController;
  private currentTimeMs: number;
  private disableAutoScalingState = false;
  private scalingModeState: "auto" | "custom" = "custom";
  private customScaleState = 1;

  constructor(
    private readonly layer: S100Layer<S111SurfaceCurrentLayerSpec>,
    private readonly context: LayerControllerContext,
  ) {
    const dataset = surfaceCurrentDataFromSpec(layer.spec);
    const startTime = parseTime(dataset?.dateTimeOfFirstRecord) ?? 0;
    const intervalSeconds = normalizePositiveInteger(dataset?.timeRecordInterval, 1);
    const recordCount = getSurfaceCurrentRecordCount(dataset);
    const endTime =
      parseTime(dataset?.dateTimeOfLastRecord) ??
      startTime + intervalSeconds * 1000 * Math.max(0, recordCount - 1);
    const scale = layer.spec.style?.scale ?? layer.spec.style?.speedScale;

    if (typeof scale === "number" && Number.isFinite(scale) && scale > 0) {
      this.customScaleState = scale;
      this.disableAutoScalingState = true;
      this.scalingModeState = "custom";
    } else if (scale === "auto") {
      this.disableAutoScalingState = false;
      this.scalingModeState = "auto";
    }

    this.currentTimeMs = startTime;
    const controller = this;
    this.time = {
      get startTime() {
        return startTime;
      },
      get endTime() {
        return endTime;
      },
      get currentTime() {
        const sceneTime = controller.context.getSceneTime?.();
        if (sceneTime !== undefined) {
          controller.currentTimeMs = sceneTime.getTime();
        }
        return controller.currentTimeMs;
      },
      set currentTime(value: number) {
        controller.setCurrentTime(value);
      },
    };
  }

  get disableAutoScaling(): boolean {
    this.syncScaleFromLayerSpec();
    return this.disableAutoScalingState;
  }

  set disableAutoScaling(value: boolean) {
    void this.setAutoScaling(!value);
  }

  get scalingMode(): "auto" | "custom" {
    this.syncScaleFromLayerSpec();
    return this.scalingModeState;
  }

  set scalingMode(value: "auto" | "custom") {
    void this.setAutoScaling(value === "auto");
  }

  get customScale(): number {
    this.syncScaleFromLayerSpec();
    return this.customScaleState;
  }

  set customScale(value: number) {
    void this.setCustomScale(value);
  }

  async setCustomScale(scale: number): Promise<void> {
    this.syncScaleFromLayerSpec();
    const finiteScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.customScaleState = finiteScale;
    this.disableAutoScalingState = true;
    this.scalingModeState = "custom";
    await this.layer.update({
      style: {
        renderer: this.layer.spec.style?.renderer ?? "arrows",
        ...this.layer.spec.style,
        scale: finiteScale,
      },
    });
  }

  async setAutoScaling(enabled: boolean): Promise<void> {
    this.syncScaleFromLayerSpec();
    this.disableAutoScalingState = !enabled;
    this.scalingModeState = enabled ? "auto" : "custom";
    await this.layer.update({
      style: {
        renderer: this.layer.spec.style?.renderer ?? "arrows",
        ...this.layer.spec.style,
        scale: enabled ? "auto" : this.customScaleState,
      },
    });
  }

  setCurrentTime(time: number | Date): void {
    const value = time instanceof Date ? time.getTime() : time;
    this.currentTimeMs = Number.isFinite(value) ? value : this.time.startTime;
    this.context.setSceneTime?.(new Date(this.currentTimeMs));
  }

  private syncScaleFromLayerSpec(): void {
    const scale = this.layer.spec.style?.scale ?? this.layer.spec.style?.speedScale;
    if (typeof scale === "number" && Number.isFinite(scale) && scale > 0) {
      this.customScaleState = scale;
      this.disableAutoScalingState = true;
      this.scalingModeState = "custom";
      return;
    }
    if (scale === "auto") {
      this.disableAutoScalingState = false;
      this.scalingModeState = "auto";
    }
  }
}

class CoreMapLayerController implements MapLayerController {
  readonly kind = "projected-map" as const;
  private alphaState: number;
  private discardModeState: number;

  constructor(private readonly layer: S100Layer<EncLayerSpec | MapOverlayLayerSpec>) {
    this.alphaState = clamp01(layer.spec.opacity ?? 1);
    this.discardModeState = getNumberFromExtensions(layer.spec.extensions, "discardMode", 1);
  }

  get alpha(): number {
    this.syncFromLayerSpec();
    return this.alphaState;
  }

  set alpha(value: number) {
    void this.setAlpha(value);
  }

  get discardMode(): number {
    this.syncFromLayerSpec();
    return this.discardModeState;
  }

  set discardMode(value: number) {
    void this.setDiscardMode(value);
  }

  async setAlpha(value: number): Promise<void> {
    this.syncFromLayerSpec();
    this.alphaState = clamp01(value);
    await this.layer.update({ opacity: this.alphaState });
  }

  setVisibility(visible: boolean): Promise<void> {
    this.layer.visible = visible;
    return this.layer.update({ visible });
  }

  async setDiscardMode(discardMode: number): Promise<void> {
    this.syncFromLayerSpec();
    this.discardModeState = finiteNumber(discardMode, this.discardModeState);
    await this.layer.update({
      extensions: withNamespacedExtensionValue(
        this.layer.spec.extensions,
        "discardMode",
        this.discardModeState,
        ["cogs"],
      ),
    });
  }

  private syncFromLayerSpec(): void {
    this.alphaState = clamp01(this.layer.spec.opacity ?? this.layer.opacity);
    this.discardModeState = getNumberFromExtensions(
      this.layer.spec.extensions,
      "discardMode",
      this.discardModeState,
    );
  }
}

type NativeSubscription = {
  unsubscribe(): void;
};

type PromiseCallbacks = {
  resolve(): void;
  reject(error: unknown): void;
};

type NativeVesselViewLike = {
  getPosition?: () => Vec3Tuple;
  getHeading?: () => number;
  positionChanged?: {
    subscribe(listener: (position: Vec3Tuple) => void): NativeSubscription;
  };
  headingChanged?: {
    subscribe(listener: (heading: number) => void): NativeSubscription;
  };
  transformControls?: {
    mode?: VesselTransformControlMode;
    setMode?: (mode: VesselTransformControlMode) => void;
  };
  seaLevelIndicator?: {
    mode?: unknown;
    seaSurfaceVisible?: boolean;
    setSeaSurfaceVisible?: (visible: boolean) => void;
  };
};

class CoreVesselLayerController implements VesselLayerController {
  readonly kind = "vessel" as const;
  readonly dimensions: VesselDimensions;
  readonly seaLevelIndicator: VesselSeaLevelIndicatorController;
  readonly transformControls: VesselTransformController;
  private positionState: Vec3Tuple;
  private headingState: number;
  private seaLevelIndicatorModeState: VesselSeaLevelIndicatorMode;
  private oceanSurfaceVisibleState: boolean;
  private transformModeState: VesselTransformControlMode;
  private readonly positionListeners = new Set<(position: Vec3Tuple) => void>();
  private readonly headingListeners = new Set<(heading: number) => void>();
  private readonly subscriptions: S100Unsubscribe[] = [];
  private nativePositionSubscription: NativeSubscription | null = null;
  private nativeHeadingSubscription: NativeSubscription | null = null;
  private nativeHeadingPoll: ReturnType<typeof setInterval> | null = null;
  private pendingPosePatch: VesselPosePatch | null = null;
  private pendingPoseWaiters: PromiseCallbacks[] = [];
  private poseUpdateInFlight = false;
  private poseUpdateScheduled = false;

  constructor(private readonly layer: S100Layer<VesselLayerSpec>) {
    this.dimensions = vesselDimensionsFromSpec(layer.spec);
    this.positionState = coordinateToVec3Tuple(layer.spec.pose.position);
    this.headingState = normalizeDegrees(layer.spec.pose.headingDegrees ?? 0);
    this.seaLevelIndicatorModeState = layer.spec.style?.showSeaLevelIndicator === false
      ? "off"
      : "circle";
    this.oceanSurfaceVisibleState = vesselOceanSurfaceVisible(layer.spec);
    this.transformModeState = normalizeVesselTransformMode(layer.spec.style?.transformControls);

    const controller = this;
    this.seaLevelIndicator = {
      get mode() {
        controller.syncFromLayerSpec(false);
        return controller.seaLevelIndicatorModeState;
      },
      set mode(mode: VesselSeaLevelIndicatorMode) {
        void controller.setSeaLevelIndicatorMode(mode);
      },
      get oceanSurfaceVisible() {
        controller.syncFromLayerSpec(false);
        return controller.oceanSurfaceVisibleState;
      },
      set oceanSurfaceVisible(visible: boolean) {
        void controller.setOceanSurfaceVisible(visible);
      },
      setMode(mode: VesselSeaLevelIndicatorMode) {
        return controller.setSeaLevelIndicatorMode(mode);
      },
      setOceanSurfaceVisible(visible: boolean) {
        return controller.setOceanSurfaceVisible(visible);
      },
    };

    this.transformControls = {
      get mode() {
        return controller.getTransformMode();
      },
      set mode(mode: VesselTransformControlMode) {
        void controller.setTransformMode(mode);
      },
      setMode(mode: VesselTransformControlMode) {
        return controller.setTransformMode(mode);
      },
    };

    this.attachNativeBridge();
    this.subscriptions.push(
      this.layer.onChanged(() => {
        this.syncFromLayerSpec(true);
      }),
    );
  }

  getPosition(): Vec3Tuple {
    this.syncFromLayerSpec(false);
    return [...this.positionState];
  }

  setPose(pose: VesselPosePatch): Promise<void> {
    const normalizedPose = this.normalizePendingPosePatch(pose);
    if (!normalizedPose) {
      return Promise.resolve();
    }

    this.pendingPosePatch = mergeVesselPosePatches(this.pendingPosePatch, normalizedPose);
    const promise = new Promise<void>((resolve, reject) => {
      this.pendingPoseWaiters.push({ resolve, reject });
    });
    this.schedulePoseUpdate();
    return promise;
  }

  async setPosition(position: Vec3Tuple): Promise<void> {
    await this.setPose({ position });
  }

  getHeading(): number {
    this.syncFromLayerSpec(false);
    return this.headingState;
  }

  async setHeading(heading: number): Promise<void> {
    await this.setPose({ headingDegrees: heading });
  }

  async setDimensions(dimensions: VesselDimensions): Promise<void> {
    const nextDimensions = normalizeVesselDimensions(dimensions, this.dimensions);
    Object.assign(this.dimensions, nextDimensions);
    await this.layer.update({
      dimensions: { ...this.dimensions },
      style: {
        ...this.layer.spec.style,
        draughtMeters: this.dimensions.draught,
      },
      extensions: withNamespacedExtensionObject(
        this.layer.spec.extensions,
        "dimensions",
        { ...this.dimensions },
        ["nasaAmmos", "cogs", "cesium"],
      ),
    });
  }

  setVisibility(visible: boolean): Promise<void> {
    this.layer.visible = visible;
    return this.layer.update({ visible });
  }

  async setSeaLevelIndicatorMode(mode: VesselSeaLevelIndicatorMode): Promise<void> {
    this.seaLevelIndicatorModeState = mode;
    await this.layer.update({
      style: {
        ...this.layer.spec.style,
        showSeaLevelIndicator: mode === "circle",
      },
    });
  }

  async setOceanSurfaceVisible(visible: boolean): Promise<void> {
    this.oceanSurfaceVisibleState = visible;
    await this.layer.update({
      style: {
        ...this.layer.spec.style,
        showOceanSurface: visible,
        oceanSurface: visible,
      },
      extensions: withNamespacedExtensionValue(
        this.layer.spec.extensions,
        "seaSurfaceVisible",
        visible,
        ["nasaAmmos", "cogs", "cesium"],
      ),
    });
  }

  getTransformMode(): VesselTransformControlMode {
    this.syncFromLayerSpec(false);
    return this.transformModeState;
  }

  async setTransformMode(mode: VesselTransformControlMode): Promise<void> {
    this.transformModeState = mode;
    const nativeView = getNativeVesselView(this.layer.getNativeHandle());
    const nativeMode = nativeVesselTransformMode(mode);
    if (nativeMode && typeof nativeView?.transformControls?.setMode === "function") {
      nativeView.transformControls.setMode(nativeMode);
    } else if (nativeView?.transformControls) {
      nativeView.transformControls.mode = nativeMode ?? mode;
    }
    await this.layer.update({
      style: {
        ...this.layer.spec.style,
        transformControls: mode,
      },
    });
  }

  onPositionChanged(listener: (position: Vec3Tuple) => void): S100Unsubscribe {
    this.positionListeners.add(listener);
    this.attachNativeBridge();
    return () => {
      this.positionListeners.delete(listener);
    };
  }

  onHeadingChanged(listener: (heading: number) => void): S100Unsubscribe {
    this.headingListeners.add(listener);
    this.attachNativeBridge();
    return () => {
      this.headingListeners.delete(listener);
    };
  }

  destroy(): void {
    for (const unsubscribe of this.subscriptions.splice(0)) {
      unsubscribe();
    }
    this.nativePositionSubscription?.unsubscribe();
    this.nativePositionSubscription = null;
    this.nativeHeadingSubscription?.unsubscribe();
    this.nativeHeadingSubscription = null;
    if (this.nativeHeadingPoll) {
      clearInterval(this.nativeHeadingPoll);
      this.nativeHeadingPoll = null;
    }
    this.positionListeners.clear();
    this.headingListeners.clear();
  }

  private attachNativeBridge(): void {
    const nativeView = getNativeVesselView(this.layer.getNativeHandle());
    if (!nativeView) {
      return;
    }
    if (!this.nativePositionSubscription && nativeView.positionChanged?.subscribe) {
      this.nativePositionSubscription = nativeView.positionChanged.subscribe((position) => {
        const nextPosition = normalizeVec3Tuple(position, this.positionState);
        if (vec3TupleEquals(nextPosition, this.positionState)) {
          return;
        }
        this.positionState = nextPosition;
        this.emitPosition(nextPosition);
      });
    }
    if (!this.nativeHeadingSubscription && nativeView.headingChanged?.subscribe) {
      this.nativeHeadingSubscription = nativeView.headingChanged.subscribe((heading) => {
        const nextHeading = normalizeDegrees(heading);
        if (Object.is(nextHeading, this.headingState)) {
          return;
        }
        this.headingState = nextHeading;
        this.emitHeading(nextHeading);
      });
    }
    if (
      !this.nativeHeadingSubscription &&
      !this.nativeHeadingPoll &&
      typeof nativeView.getHeading === "function"
    ) {
      this.nativeHeadingPoll = setInterval(() => {
        const nextHeading = normalizeDegrees(nativeView.getHeading?.() ?? this.headingState);
        if (Object.is(nextHeading, this.headingState)) {
          return;
        }
        this.headingState = nextHeading;
        this.emitHeading(nextHeading);
      }, 60);
    }
  }

  private syncFromLayerSpec(emitChanges: boolean): void {
    const spec = this.layer.spec;
    const nextPosition = coordinateToVec3Tuple(spec.pose.position);
    const nextHeading = normalizeDegrees(spec.pose.headingDegrees ?? this.headingState);
    const positionChanged = !vec3TupleEquals(nextPosition, this.positionState);
    const headingChanged = !Object.is(nextHeading, this.headingState);
    this.positionState = nextPosition;
    this.headingState = nextHeading;
    Object.assign(this.dimensions, vesselDimensionsFromSpec(spec));
    this.seaLevelIndicatorModeState = spec.style?.showSeaLevelIndicator === false
      ? "off"
      : "circle";
    this.oceanSurfaceVisibleState = vesselOceanSurfaceVisible(spec);
    this.transformModeState = normalizeVesselTransformMode(spec.style?.transformControls);

    if (emitChanges && positionChanged) {
      this.emitPosition(nextPosition);
    }
    if (emitChanges && headingChanged) {
      this.emitHeading(nextHeading);
    }
  }

  private emitPosition(position: Vec3Tuple): void {
    const value: Vec3Tuple = [...position];
    for (const listener of [...this.positionListeners]) {
      listener(value);
    }
  }

  private emitHeading(heading: number): void {
    for (const listener of [...this.headingListeners]) {
      listener(heading);
    }
  }

  private normalizePendingPosePatch(pose: VesselPosePatch): VesselPosePatch | null {
    const patch: VesselPosePatch = {};
    if (pose.position) {
      patch.position = normalizeVec3Tuple(
        pose.position,
        this.pendingPosePatch?.position ?? this.positionState,
      );
    }
    if (pose.headingDegrees !== undefined) {
      patch.headingDegrees = normalizeDegrees(pose.headingDegrees);
    }
    return patch.position || patch.headingDegrees !== undefined ? patch : null;
  }

  private schedulePoseUpdate(): void {
    if (this.poseUpdateScheduled || this.poseUpdateInFlight) {
      return;
    }
    this.poseUpdateScheduled = true;
    scheduleFrame(() => {
      this.poseUpdateScheduled = false;
      void this.flushPendingPoseUpdate();
    });
  }

  private async flushPendingPoseUpdate(): Promise<void> {
    if (this.poseUpdateInFlight || !this.pendingPosePatch) {
      return;
    }
    const pose = this.pendingPosePatch;
    const waiters = this.pendingPoseWaiters.splice(0);
    this.pendingPosePatch = null;
    this.poseUpdateInFlight = true;

    try {
      await this.applyPosePatch(pose);
      for (const waiter of waiters) {
        waiter.resolve();
      }
    } catch (error) {
      for (const waiter of waiters) {
        waiter.reject(error);
      }
    } finally {
      this.poseUpdateInFlight = false;
      if (this.pendingPosePatch) {
        this.schedulePoseUpdate();
      }
    }
  }

  private async applyPosePatch(pose: VesselPosePatch): Promise<void> {
    const nextPosition = pose.position
      ? normalizeVec3Tuple(pose.position, this.positionState)
      : this.positionState;
    const nextHeading = pose.headingDegrees !== undefined
      ? normalizeDegrees(pose.headingDegrees)
      : this.headingState;
    const positionChanged = !vec3TupleEquals(nextPosition, this.positionState);
    const headingChanged = !Object.is(nextHeading, this.headingState);
    const currentPose = this.layer.spec.pose;

    this.positionState = [...nextPosition];
    this.headingState = nextHeading;

    await this.layer.update({
      pose: {
        ...currentPose,
        position: coordinateFromVec3Tuple(nextPosition, currentPose.position),
        headingDegrees: nextHeading,
      },
    });

    if (positionChanged) {
      this.emitPosition(nextPosition);
    }
    if (headingChanged) {
      this.emitHeading(nextHeading);
    }
  }
}

const isS102LayerSpec = (spec: BaseLayerSpec): spec is S102BathymetryLayerSpec =>
  spec.product === S100ProductType.S102;

const isS111LayerSpec = (spec: BaseLayerSpec): spec is S111SurfaceCurrentLayerSpec =>
  spec.product === S100ProductType.S111;

const isMapLayerSpec = (spec: BaseLayerSpec): spec is EncLayerSpec | MapOverlayLayerSpec =>
  spec.product === S100ProductType.S101 || spec.product === "S-57" || spec.product === "map-overlay";

const isVesselLayerSpec = (spec: BaseLayerSpec): spec is VesselLayerSpec =>
  spec.product === "vessel";

const surfaceCurrentDataFromSpec = (
  spec: S111SurfaceCurrentLayerSpec,
): S111SurfaceCurrentData | undefined => {
  if (spec.source.kind === "static-json" && isRecord(spec.source.data)) {
    return spec.source.data as S111SurfaceCurrentData;
  }
  if (spec.source.kind === "rest-json" && isRecord(spec.source.sample)) {
    return spec.source.sample as S111SurfaceCurrentData;
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

const getSurfaceCurrentRecordCount = (dataset: S111SurfaceCurrentData | undefined): number => {
  if (typeof dataset?.numberOfTimes === "number" && dataset.numberOfTimes > 0) {
    return Math.floor(dataset.numberOfTimes);
  }
  if (Array.isArray(dataset?.data)) {
    return dataset.data.length;
  }
  const candidateArrays = ["positions", "records", "samples", "values"];
  for (const key of candidateArrays) {
    const value = dataset?.[key];
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

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));

const normalizeDegrees = (value: number): number => {
  const finite = Number.isFinite(value) ? value : 0;
  return ((finite % 360) + 360) % 360;
};

const normalizeVec3Tuple = (value: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple => [
  finiteNumber(value[0], fallback[0]),
  finiteNumber(value[1], fallback[1]),
  finiteNumber(value[2], fallback[2]),
];

const vec3TupleEquals = (a: Vec3Tuple, b: Vec3Tuple): boolean =>
  Object.is(a[0], b[0]) && Object.is(a[1], b[1]) && Object.is(a[2], b[2]);

const coordinateToVec3Tuple = (coordinate: Coordinate): Vec3Tuple => {
  if (coordinate.kind === "geodetic") {
    return [coordinate.lon, coordinate.lat, coordinate.height ?? 0];
  }
  return [coordinate.x, coordinate.y, coordinate.z ?? 0];
};

const coordinateFromVec3Tuple = (position: Vec3Tuple, previous: Coordinate): Coordinate => {
  if (previous.kind === "projected") {
    return {
      kind: "projected",
      crs: previous.crs,
      x: position[0],
      y: position[1],
      z: position[2],
    };
  }
  if (previous.kind === "geodetic") {
    return {
      kind: "geodetic",
      lon: position[0],
      lat: position[1],
      height: position[2],
      ...(previous.datum !== undefined ? { datum: previous.datum } : {}),
    };
  }
  if (previous.kind === "ecef") {
    return {
      kind: "ecef",
      x: position[0],
      y: position[1],
      z: position[2],
      ...(previous.datum !== undefined ? { datum: previous.datum } : {}),
    };
  }
  return {
    kind: "engine-local",
    x: position[0],
    y: position[1],
    z: position[2],
    frameId: previous.frameId,
  };
};

const vesselDimensionsFromSpec = (spec: VesselLayerSpec): VesselDimensions =>
  normalizeVesselDimensions(spec.dimensions ?? {}, {
    draught: spec.style?.draughtMeters ?? 0,
    bow: 0,
    stern: 0,
    port: 0,
    starboard: 0,
  });

const normalizeVesselDimensions = (
  dimensions: Partial<VesselDimensions>,
  fallback: VesselDimensions,
): VesselDimensions => ({
  draught: finiteNumber(dimensions.draught, fallback.draught),
  bow: finiteNumber(dimensions.bow, fallback.bow),
  stern: finiteNumber(dimensions.stern, fallback.stern),
  port: finiteNumber(dimensions.port, fallback.port),
  starboard: finiteNumber(dimensions.starboard, fallback.starboard),
});

const vesselOceanSurfaceVisible = (spec: VesselLayerSpec): boolean => {
  if (typeof spec.style?.oceanSurface === "boolean") {
    return spec.style.oceanSurface;
  }
  if (isRecord(spec.style?.oceanSurface)) {
    return spec.style.oceanSurface.enabled === true;
  }
  if (typeof spec.style?.showOceanSurface === "boolean") {
    return spec.style.showOceanSurface;
  }
  return getBooleanFromExtensions(spec.extensions, "seaSurfaceVisible", false);
};

const normalizeVesselTransformMode = (
  mode: VesselTransformControlMode | undefined,
): VesselTransformControlMode => mode ?? "translate-rotate";

const nativeVesselTransformMode = (
  mode: VesselTransformControlMode,
): "translate" | "rotate" | null =>
  mode === "translate" || mode === "rotate" ? mode : null;

const mergeVesselPosePatches = (
  current: VesselPosePatch | null,
  next: VesselPosePatch,
): VesselPosePatch => ({
  ...(current ?? {}),
  ...(next.position ? { position: next.position } : {}),
  ...(next.headingDegrees !== undefined ? { headingDegrees: next.headingDegrees } : {}),
});

const scheduleFrame = (callback: () => void): void => {
  const scheduler = globalThis as unknown as {
    requestAnimationFrame?: (callback: () => void) => unknown;
  };
  if (typeof scheduler.requestAnimationFrame === "function") {
    scheduler.requestAnimationFrame(callback);
    return;
  }
  setTimeout(callback, 0);
};

const getNativeVesselView = (nativeHandle: unknown): NativeVesselViewLike | null => {
  if (!isRecord(nativeHandle)) {
    return null;
  }
  if (isNativeVesselViewLike(nativeHandle)) {
    return nativeHandle;
  }
  const view = nativeHandle.view;
  return isNativeVesselViewLike(view) ? view : null;
};

const isNativeVesselViewLike = (value: unknown): value is NativeVesselViewLike =>
  isRecord(value) &&
  (typeof value.getPosition === "function" ||
    typeof value.getHeading === "function" ||
    isRecord(value.positionChanged) ||
    isRecord(value.headingChanged) ||
    isRecord(value.transformControls) ||
    isRecord(value.seaLevelIndicator));

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

const getBooleanFromExtensions = (
  extensions: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean => {
  for (const namespace of ["nasaAmmos", "cogs", "cesium"]) {
    const value = recordFromUnknown(extensions?.[namespace])[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return fallback;
};

const withNamespacedExtensionValue = (
  extensions: Record<string, unknown> | undefined,
  key: string,
  value: number | boolean,
  namespaces: readonly string[],
): Record<string, unknown> => {
  const next: Record<string, unknown> = {
    ...extensions,
  };

  for (const namespace of namespaces) {
    next[namespace] = {
      ...recordFromUnknown(extensions?.[namespace]),
      [key]: value,
    };
  }

  return next;
};

const withNamespacedExtensionObject = (
  extensions: Record<string, unknown> | undefined,
  key: string,
  value: Record<string, unknown>,
  namespaces: readonly string[],
): Record<string, unknown> => {
  const next: Record<string, unknown> = {
    ...extensions,
  };

  for (const namespace of namespaces) {
    next[namespace] = {
      ...recordFromUnknown(extensions?.[namespace]),
      [key]: {
        ...recordFromUnknown(recordFromUnknown(extensions?.[namespace])[key]),
        ...value,
      },
    };
  }

  return next;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};
