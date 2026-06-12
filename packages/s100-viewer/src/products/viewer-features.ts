import type { Coordinate } from "../coordinates/types.js";
import type { BaseLayerSpec } from "../layers/types.js";
import type { ModelSource, MvtSource, StaticJsonSource, WmsSource, WmtsSource } from "./sources.js";
import type { ColorValue, OpacityVisibilityStyle, ProductFilter } from "./style.js";

export type VesselPose = {
  position: Coordinate;
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
};

export type VesselTransformControlMode = "none" | "translate" | "rotate" | "translate-rotate";

export type VesselTransformGizmoStyle =
  | boolean
  | {
      enabled?: boolean;
      mode?: VesselTransformControlMode;
      sizeMeters?: number;
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

export interface VesselLayerSpec extends BaseLayerSpec<"vessel"> {
  source: ModelSource;
  pose: VesselPose;
  style?: VesselStyle;
}

export interface MapOverlayLayerSpec extends BaseLayerSpec<"map-overlay"> {
  source: WmsSource | WmtsSource | MvtSource | StaticJsonSource;
  role?: "basemap" | "overlay" | "mask" | "annotation";
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
