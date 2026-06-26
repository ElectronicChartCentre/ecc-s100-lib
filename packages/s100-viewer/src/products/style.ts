import type { SpatialExtent } from "../coordinates/types.js";
import type { TimeInterval } from "../time/types.js";

export type ColorValue =
  | string
  | {
      r: number;
      g: number;
      b: number;
      a?: number;
    };

export type ColorStop = {
  value: number;
  color: ColorValue;
  label?: string;
};

export type ColorRampRef =
  | "s100-default"
  | "s102-depth-default"
  | "s111-default"
  | "viridis"
  | "turbo"
  | "grayscale"
  | (string & {});

export type OpacityVisibilityStyle = {
  visible?: boolean;
  opacity?: number;
};

export type ProductFilter = {
  property: string;
  operator: "eq" | "neq" | "in" | "not-in" | "lt" | "lte" | "gt" | "gte" | "contains";
  value: unknown;
};

export type ContourStyle = {
  visible: boolean;
  intervalMeters?: number;
  majorIntervalMeters?: number;
  color?: ColorValue;
  widthPixels?: number;
};

export type DepthColorStyle = ColorRampRef | readonly ColorStop[];

export type EncCommonStyle = OpacityVisibilityStyle & {
  displayCategories?: readonly string[];
  ignoredCategories?: readonly string[];
  filters?: readonly ProductFilter[];
  cutout?: {
    enabled: boolean;
    extent?: SpatialExtent;
    featherMeters?: number;
  };
};

export type S101EncStyle = EncCommonStyle & {
  portrayalCatalogue?: string;
  viewingGroupLayers?: readonly string[];
  alertHighlighting?: boolean;
  featureInspector?: boolean;
};

export type S57EncStyle = EncCommonStyle & {
  s57StyleName?: string;
  legacyDisplayMode?: "standard" | "custom";
};

export type S102BathymetryStyle = OpacityVisibilityStyle & {
  unsafeDepth?: number;
  seaLevel?: number;
  contours?: ContourStyle;
  depthColors?: DepthColorStyle;
  shading?: "flat" | "lit" | "hypsometric";
  verticalExaggeration?: number;
};

export type SimulatedWaterLevelStyle = OpacityVisibilityStyle & {
  datum?: string;
  colorRamp?: ColorRampRef | readonly ColorStop[];
  minMeters?: number;
  maxMeters?: number;
  showSurface?: boolean;
};

export type S111SurfaceCurrentStyle = OpacityVisibilityStyle & {
  renderer: "arrows" | "particles" | "streamlines";
  glyph?: "arrow" | "chevron" | "barb";
  minSpeed?: number;
  maxSpeed?: number;
  scale?: number | "auto";
  speedScale?: number | "auto";
  colorRamp?: ColorRampRef | readonly ColorStop[];
  vectorSpacingMeters?: number;
  legend?: {
    visible: boolean;
    units?: "m/s" | "knots";
  };
};

export type ProductTimeOptions = {
  availability?: readonly TimeInterval[];
  interpolation?: "nearest" | "linear" | "step";
  field?: string;
};
