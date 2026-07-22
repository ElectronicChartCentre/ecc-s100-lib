import type { Coordinate } from "../../coordinates/types.js";
import type { S100Unsubscribe } from "../../events/S100EventBus.js";
import type { EncLayerSpec } from "../../products/enc.js";
import type {
  S102BathymetryLayerSpec,
  S111SurfaceCurrentLayerSpec,
} from "../../products/iho-s100.js";
import type { RouteDiagnostic, RouteFeatureStyle, RoutePlan, RoutePlanLayerSpec } from "../../products/route-plan.js";
import type {
  MapOverlayLayerSpec,
  VesselDimensions,
  VesselLayerSpec,
  VesselPose,
  VesselTransformControlMode,
} from "../../products/viewer-features.js";
import type { BaseLayerSpec } from "../types.js";

export type LayerControllerContext = {
  setSceneTime?(time: Date): void;
  getSceneTime?(): Date;
};

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export type TerrainDisplayController = {
  readonly safetyDepthMeters: number;
  readonly seaLevel: number;
  readonly seaContour: boolean;
  readonly showContour: boolean;
  readonly contourInterval: number;
};

export type TerrainSettingsController = {
  readonly renderBBoxes: boolean;
  readonly detailFactor: number;
  readonly neverDiscardRootNodes: boolean;
  readonly waitForSiblings: boolean;
};

export type TerrainContourOptions = {
  visible?: boolean;
  seaContour?: boolean;
  intervalMeters?: number;
};

export type TerrainDisplayPatch = {
  safetyDepthMeters?: number;
  /** Legacy z-up elevation threshold. Use safetyDepthMeters for positive nautical depth. */
  unsafeDepth?: number;
  seaLevel?: number;
  contours?: TerrainContourOptions;
};

export type TerrainDebugPatch = {
  showTileBounds?: boolean;
};

export type TerrainLayerController = {
  readonly kind: "s102-terrain";
  readonly terrain: TerrainDisplayController;
  readonly settings: TerrainSettingsController;
  setSafetyDepthMeters(value: number): Promise<void>;
  setSeaLevel(value: number): Promise<void>;
  setContours(options: TerrainContourOptions): Promise<void>;
  updateDisplayStyle(patch: TerrainDisplayPatch): Promise<void>;
  setDetailFactor(value: number): Promise<void>;
  setTileBoundsVisible(visible: boolean): Promise<void>;
  updateDebugOptions(patch: TerrainDebugPatch): Promise<void>;
};

export type SurfaceCurrentTimeController = {
  readonly startTime: number;
  readonly endTime: number;
  currentTime: number;
};

export type SurfaceCurrentLayerController = {
  readonly kind: "s111-surface-current";
  readonly disableAutoScaling: boolean;
  readonly scalingMode: "auto" | "custom";
  readonly customScale: number;
  readonly time: SurfaceCurrentTimeController;
  setCustomScale(scale: number): Promise<void>;
  setAutoScaling(enabled: boolean): Promise<void>;
  setCurrentTime(time: number | Date): void;
};

export type MapLayerController = {
  readonly kind: "projected-map";
  readonly alpha: number;
  readonly discardMode: number;
  setAlpha(value: number): Promise<void>;
  setVisibility(visible: boolean): Promise<void>;
  setDiscardMode(discardMode: number): Promise<void>;
};

export type VesselSeaLevelIndicatorMode = "off" | "circle";

export type VesselSeaLevelIndicatorController = {
  readonly mode: VesselSeaLevelIndicatorMode;
  readonly oceanSurfaceVisible: boolean;
  setMode(mode: VesselSeaLevelIndicatorMode): Promise<void>;
  setOceanSurfaceVisible(visible: boolean): Promise<void>;
};

export type VesselTransformController = {
  readonly mode: VesselTransformControlMode;
  setMode(mode: VesselTransformControlMode): Promise<void>;
};

export type VesselPosePatch = {
  position?: Coordinate;
  headingDegrees?: number;
};

export type VesselLayerController = {
  readonly kind: "vessel";
  readonly dimensions: VesselDimensions;
  readonly seaLevelIndicator: VesselSeaLevelIndicatorController;
  readonly transformControls: VesselTransformController;
  getPosition(): Coordinate;
  getPose(): VesselPose;
  setPose(pose: VesselPosePatch): Promise<void>;
  setPosition(position: Coordinate): Promise<void>;
  getHeading(): number;
  setHeading(heading: number): Promise<void>;
  setDimensions(dimensions: VesselDimensions): Promise<void>;
  setVisibility(visible: boolean): Promise<void>;
  setSeaLevelIndicatorMode(mode: VesselSeaLevelIndicatorMode): Promise<void>;
  setOceanSurfaceVisible(visible: boolean): Promise<void>;
  getTransformMode(): VesselTransformControlMode;
  setTransformMode(mode: VesselTransformControlMode): Promise<void>;
  onPositionChanged(listener: (position: Coordinate) => void): S100Unsubscribe;
  onHeadingChanged(listener: (heading: number) => void): S100Unsubscribe;
  destroy(): void;
};

export type RouteLayerController = {
  readonly kind: "route";
  getRoutePlan(): RoutePlan;
  getDiagnostics(): readonly RouteDiagnostic[];
  setStyle(style: Partial<RouteFeatureStyle>): Promise<void>;
  setHybrid3d(enabled: boolean): Promise<void>;
  setDebugGeometryVisible(visible: boolean): Promise<void>;
};

export type BaseLayerControllers = {
  terrain?: TerrainLayerController;
  surfaceCurrent?: SurfaceCurrentLayerController;
  map?: MapLayerController;
  vessel?: VesselLayerController;
  route?: RouteLayerController;
};

export type LayerControllers<TSpec extends BaseLayerSpec = BaseLayerSpec> =
  Omit<BaseLayerControllers, "terrain" | "surfaceCurrent" | "map" | "vessel" | "route"> &
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
      : { vessel?: VesselLayerController }) &
    (TSpec extends RoutePlanLayerSpec
      ? { route: RouteLayerController }
      : { route?: RouteLayerController });
