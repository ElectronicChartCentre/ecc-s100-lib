import type { Coordinate } from "../coordinates/types.js";
import type { BaseLayerSpec } from "../layers/types.js";
import type { BoundingBoxTuple, QuatTuple } from "../math.js";
import type { ProjectedMapSpecification } from "./projected-map-template.js";
import type {
  ModelSource,
  MvtSource,
  StaticJsonSource,
  WmsSource,
  WmsTemplateSource,
  WmtsSource,
} from "./sources.js";
import type { ColorValue, OpacityVisibilityStyle, ProductFilter } from "./style.js";

export type VesselPose = {
  position: Coordinate;
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
};

export type VesselReferencePoint = "transponder" | "model-origin" | "custom";

export type VesselModelOptions = {
  orientation?: QuatTuple;
  boundingBox?: BoundingBoxTuple;
};

export type VesselDimensions = {
  /** Vertical draught below the vessel reference point, in meters. */
  draught: number;
  /** Forward distance from the vessel reference point to the bow, in meters. */
  bow: number;
  /** Aft distance from the vessel reference point to the stern, in meters. */
  stern: number;
  /** Port distance from the vessel reference point, in meters. */
  port: number;
  /** Starboard distance from the vessel reference point, in meters. */
  starboard: number;
};

export type VesselTransformControlMode = "none" | "translate" | "rotate" | "translate-rotate";

export type VesselVerticalPositionLimits = {
  /** Minimum permitted vessel pose z, in meters. */
  minMeters?: number;
  /** Maximum permitted vessel pose z, in meters. */
  maxMeters?: number;
  /**
   * `scene` clamps directly against the vessel pose z value. `sea-level`
   * offsets min/max by the current scene sea level before clamping.
   */
  reference?: "scene" | "sea-level";
};

export type VesselTransformGizmoStyle =
  | boolean
  | {
      enabled?: boolean;
      mode?: VesselTransformControlMode;
      sizeMeters?: number;
      verticalPositionLimits?: VesselVerticalPositionLimits;
    };

export type VesselOceanSurfaceStyle =
  | boolean
  | {
      enabled?: boolean;
      radiusMeters?: number;
      color?: ColorValue;
      opacity?: number;
      roughness?: number;
      reflectivity?: number;
    };

export type VesselShadowStyle =
  | boolean
  | {
      enabled?: boolean;
      opacity?: number;
      softness?: number;
      color?: ColorValue;
    };

export type VesselStyle = OpacityVisibilityStyle & {
  draughtMeters?: number;
  showSeaLevelIndicator?: boolean;
  transformControls?: VesselTransformControlMode;
  transformGizmo?: VesselTransformGizmoStyle;
  showOceanSurface?: boolean;
  oceanSurface?: VesselOceanSurfaceStyle;
  shadow?: VesselShadowStyle;
};

export type MapOverlayStyle = OpacityVisibilityStyle & {
  blendMode?: "normal" | "multiply" | "screen" | "overlay";
  filters?: readonly ProductFilter[];
};

export type VesselRenderingOptions = {
  seaLevelIndicator?: boolean;
  oceanSurfaceVisible?: boolean;
  shadowVisible?: boolean;
};

export type MapOverlayRenderingOptions = {
  discardMode?: number;
};

export interface VesselLayerSpec extends BaseLayerSpec<"vessel"> {
  source: ModelSource;
  pose: VesselPose;
  dimensions?: VesselDimensions;
  referencePoint?: VesselReferencePoint;
  model?: VesselModelOptions;
  rendering?: VesselRenderingOptions;
  style?: VesselStyle;
}

export interface MapOverlayLayerSpec extends BaseLayerSpec<"map-overlay"> {
  source: WmsSource | WmsTemplateSource | WmtsSource | MvtSource | StaticJsonSource;
  role?: "basemap" | "overlay" | "mask" | "annotation";
  projectedMap?: ProjectedMapSpecification;
  mapRendering?: MapOverlayRenderingOptions;
  style?: MapOverlayStyle;
}

export type ViewerFeatureLayerSpec = VesselLayerSpec | MapOverlayLayerSpec;

export const VesselStyles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    draughtMeters: 0,
    showSeaLevelIndicator: true,
    transformControls: "translate-rotate",
    transformGizmo: true,
    showOceanSurface: false,
    oceanSurface: false,
    shadow: true,
  } satisfies VesselStyle,
};

export const MapOverlayStyles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    blendMode: "normal",
  } satisfies MapOverlayStyle,
};
