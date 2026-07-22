import type { Vec3Tuple } from "../../math.js";
import type { VesselDimensions } from "../viewer-features.js";

export type ParametricVesselTemplate =
  | "generic-cargo"
  | "generic-tanker"
  | "generic-service"
  | string;

export type ParametricVesselAssemblyStyle =
  | "straight-edge"
  | "rounded-corner"
  | string;

export type ParametricVesselHullCrossSection =
  | "rectangular"
  | "rounded-rectangle"
  | string;

export type ParametricVesselEdgeTreatment =
  | "sharp"
  | "rounded"
  | string;

export type ParametricVesselPartGeometryKind =
  | "box"
  | "wedge"
  | "wedge-deck"
  | "deck-outline"
  | "cylinder"
  | "disc"
  | "half-cylinder"
  | "quarter-cylinder"
  | "half-dome"
  | "quarter-dome"
  | "tangent-plane"
  | string;

export type ParametricVesselPartGeometry = {
  kind: ParametricVesselPartGeometryKind;
  edgeTreatment?: ParametricVesselEdgeTreatment;
  axis?: "x" | "y" | "z";
  taperEnd?: "bow" | "stern" | "port" | "starboard" | "top" | "bottom";
  corner?: "port-bow" | "starboard-bow" | "port-stern" | "starboard-stern" | string;
  parameters?: Record<string, boolean | number | string>;
  metadata?: Record<string, unknown>;
};

export type ParametricVesselAssemblyOptions = {
  /**
   * "straight-edge" is the first concrete renderer contract. "rounded-corner"
   * is reserved for later hull assemblies with pipe/dome/tangent-plane parts.
   */
  style?: ParametricVesselAssemblyStyle;
  hullCrossSection?: ParametricVesselHullCrossSection;
  cornerRadiusMeters?: number;
  metadata?: Record<string, unknown>;
};

export type NormalizedParametricVesselAssembly = {
  style: ParametricVesselAssemblyStyle;
  hullCrossSection: ParametricVesselHullCrossSection;
  cornerRadiusMeters?: number;
  metadata?: Record<string, unknown>;
};

export type ParametricVesselPartRole =
  | "hull-bow"
  | "hull-midship"
  | "hull-stern"
  | "main-deck"
  | "bow-deck"
  | "bridge"
  | "mast"
  | "transponder"
  | string;

export type ParametricVesselDimensions = {
  /** Design draught below the waterline, in meters. */
  draught: number;
  /** Distance from the AIS/GNSS antenna reference point to the bow, in meters. */
  bow: number;
  /** Distance from the AIS/GNSS antenna reference point to the stern, in meters. */
  stern: number;
  /** Distance from the AIS/GNSS antenna reference point to port, in meters. */
  port: number;
  /** Distance from the AIS/GNSS antenna reference point to starboard, in meters. */
  starboard: number;
  /** Total hull vertical size from keel to hull top, in meters. */
  hullHeightMeters?: number;
  deckThicknessMeters?: number;
  bridgeHeightMeters?: number;
  mastHeightMeters?: number;
};

export type ParametricVesselPhysicalDimensions = {
  /** Derived overall vessel length from stern to bow, in meters. */
  lengthMeters: number;
  /** Derived overall vessel beam from port to starboard, in meters. */
  beamMeters: number;
  /** Design draught below the waterline, in meters. */
  draughtMeters: number;
  freeboardMeters: number;
  hullHeightMeters: number;
  deckThicknessMeters: number;
  bridgeHeightMeters: number;
  mastHeightMeters: number;
};

export type ParametricVesselReferencePoint = {
  /**
   * Reference point measured forward from the stern, in meters.
   * Derived from the AIS-style `dimensions.stern` distance.
   */
  longitudinalFromSternMeters: number;
  /** Positive values move the reference point toward starboard. */
  lateralFromCenterMeters: number;
  /**
   * Reference point height above keel, in meters.
   * Defaults to draught, placing z=0 at the waterline/reference plane.
   */
  verticalFromKeelMeters: number;
};

export type ParametricVesselColorScheme = {
  hull?: string;
  deck?: string;
  superstructure?: string;
  mast?: string;
  transponder?: string;
};

export type ParametricVesselPartSize = {
  beamMeters: number;
  lengthMeters: number;
  heightMeters: number;
};

export type ParametricVesselPlanPoint = {
  /** Positive x points starboard; negative x points port. */
  xMeters: number;
  /** Positive y points toward the bow; negative y points toward the stern. */
  yMeters: number;
};

export type ParametricVesselLocalPoint = {
  /** Positive x points starboard; negative x points port. */
  xMeters: number;
  /** Positive y points toward the bow; negative y points toward the stern. */
  yMeters: number;
  /** Positive z points upward from the vessel reference point. */
  zMeters: number;
};

export type ParametricVesselPartAsset = {
  url: string;
  format?: "glb" | "gltf";
  naturalSizeMeters?: Partial<ParametricVesselPartSize>;
  metadata?: Record<string, unknown>;
};

export type ParametricVesselPartOverride = {
  id: string;
  role?: ParametricVesselPartRole;
  enabled?: boolean;
  assetId?: string;
  asset?: ParametricVesselPartAsset;
  geometry?: ParametricVesselPartGeometry;
  centerMeters?: Partial<ParametricVesselLocalPoint>;
  sizeMeters?: Partial<ParametricVesselPartSize>;
  naturalSizeMeters?: Partial<ParametricVesselPartSize>;
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type ParametricVesselLayoutOptions = {
  bowLengthMeters?: number;
  /**
   * Inset for generated deck surfaces from the hull top outline, in meters.
   * Bow-side inset edges stay parallel to the hull bow sides.
   */
  deckInsetMeters?: number;
  bridge?: {
    centerFromSternMeters?: number;
    lateralFromCenterMeters?: number;
    /** Ratio of the rectangular hull-box length, from 0 to 1. */
    lengthRatio?: number;
    /** Ratio of total vessel beam, from 0 to 1. */
    beamRatio?: number;
    lengthMeters?: number;
    beamMeters?: number;
    heightMeters?: number;
  };
  mast?: {
    heightMeters?: number;
    radiusMeters?: number;
  };
  transponder?: {
    centerFromSternMeters?: number;
    lateralFromCenterMeters?: number;
    /** Distance from the mast top to the top of the visual transponder marker. */
    distanceBelowMastTopMeters?: number;
    beamMeters?: number;
    lengthMeters?: number;
    heightMeters?: number;
  };
  parts?: readonly ParametricVesselPartOverride[];
};

export type ParametricVesselSpec = {
  kind?: "parametric";
  template?: ParametricVesselTemplate;
  dimensions: ParametricVesselDimensions;
  assembly?: ParametricVesselAssemblyOptions;
  colors?: ParametricVesselColorScheme;
  assets?: Record<string, ParametricVesselPartAsset>;
  layout?: ParametricVesselLayoutOptions;
  metadata?: Record<string, unknown>;
};

export type ParametricVesselLayoutPart = {
  id: string;
  role: ParametricVesselPartRole;
  centerMeters: ParametricVesselLocalPoint;
  sizeMeters: ParametricVesselPartSize;
  naturalSizeMeters: ParametricVesselPartSize;
  scale: Vec3Tuple;
  boundsMeters: {
    min: ParametricVesselLocalPoint;
    max: ParametricVesselLocalPoint;
  };
  geometry?: ParametricVesselPartGeometry;
  assetId?: string;
  asset?: ParametricVesselPartAsset;
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type ParametricVesselLayout = {
  kind: "parametric-vessel-layout";
  coordinateSystem: {
    x: "starboard-positive";
    y: "bow-positive";
    z: "up-positive";
    units: "meters";
  };
  spec: ParametricVesselSpec;
  assembly: NormalizedParametricVesselAssembly;
  dimensions: VesselDimensions;
  physicalDimensions: ParametricVesselPhysicalDimensions;
  referencePoint: ParametricVesselReferencePoint;
  parts: readonly ParametricVesselLayoutPart[];
  boundsMeters: {
    min: ParametricVesselLocalPoint;
    max: ParametricVesselLocalPoint;
  };
};
