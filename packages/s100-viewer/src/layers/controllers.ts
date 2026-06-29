import { S100ProductType } from "./types.js";
import type { BaseLayerSpec, LayerPatch, S100Layer } from "./types.js";
import type { EncLayerSpec } from "../products/enc.js";
import type {
  S102BathymetryLayerSpec,
  S111SurfaceCurrentData,
  S111SurfaceCurrentLayerSpec,
} from "../products/iho-s100.js";
import type { MapOverlayLayerSpec } from "../products/viewer-features.js";

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

export type BaseLayerControllers = {
  terrain?: TerrainLayerController;
  surfaceCurrent?: SurfaceCurrentLayerController;
  map?: MapLayerController;
};

export type LayerControllers<TSpec extends BaseLayerSpec = BaseLayerSpec> =
  Omit<BaseLayerControllers, "terrain" | "surfaceCurrent" | "map"> &
    (TSpec extends S102BathymetryLayerSpec
      ? { terrain: TerrainLayerController }
      : { terrain?: TerrainLayerController }) &
    (TSpec extends S111SurfaceCurrentLayerSpec
      ? { surfaceCurrent: SurfaceCurrentLayerController }
      : { surfaceCurrent?: SurfaceCurrentLayerController }) &
    (TSpec extends EncLayerSpec | MapOverlayLayerSpec
      ? { map: MapLayerController }
      : { map?: MapLayerController });

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
        ["nasaAmmos", "cogs"],
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

const isS102LayerSpec = (spec: BaseLayerSpec): spec is S102BathymetryLayerSpec =>
  spec.product === S100ProductType.S102;

const isS111LayerSpec = (spec: BaseLayerSpec): spec is S111SurfaceCurrentLayerSpec =>
  spec.product === S100ProductType.S111;

const isMapLayerSpec = (spec: BaseLayerSpec): spec is EncLayerSpec | MapOverlayLayerSpec =>
  spec.product === S100ProductType.S101 || spec.product === "S-57" || spec.product === "map-overlay";

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

const withNamespacedExtensionValue = (
  extensions: Record<string, unknown> | undefined,
  key: string,
  value: number,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};
