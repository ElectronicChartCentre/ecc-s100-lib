import type { Vec3Tuple } from "../math.js";
import type { VesselDimensions } from "./viewer-features.js";

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

export function buildParametricVesselLayout(
  input: ParametricVesselSpec,
): ParametricVesselLayout {
  const spec = normalizeParametricVesselSpec(input);
  const dimensions = vesselDimensionsFromParametricVessel(spec);
  const physical = normalizePhysicalDimensions(spec.dimensions);
  const reference = normalizeReferencePoint(spec.dimensions);
  const assembly = normalizeAssemblyOptions(spec.assembly);
  const sections = normalizeSectionLengths(physical, spec.layout);
  const parts = applyPartOverrides(
    defaultLayoutParts(spec, physical, reference, assembly, sections),
    spec.layout?.parts,
    spec.assets,
  );

  return {
    kind: "parametric-vessel-layout",
    coordinateSystem: {
      x: "starboard-positive",
      y: "bow-positive",
      z: "up-positive",
      units: "meters",
    },
    spec,
    assembly,
    dimensions,
    physicalDimensions: physical,
    referencePoint: reference,
    parts,
    boundsMeters: boundsForParts(parts),
  };
}

export function normalizeParametricVesselSpec(
  input: ParametricVesselSpec,
): ParametricVesselSpec {
  const dimensions = normalizeVesselDimensions(input.dimensions);
  const physical = normalizePhysicalDimensions(input.dimensions);
  const assembly = normalizeAssemblyOptions(input.assembly);

  return {
    ...input,
    kind: "parametric",
    dimensions: {
      ...dimensions,
      hullHeightMeters: physical.hullHeightMeters,
      deckThicknessMeters: physical.deckThicknessMeters,
      bridgeHeightMeters: physical.bridgeHeightMeters,
      mastHeightMeters: physical.mastHeightMeters,
    },
    assembly,
  };
}

export function vesselDimensionsFromParametricVessel(
  input: ParametricVesselSpec,
): VesselDimensions {
  return normalizeVesselDimensions(input.dimensions);
}

function normalizeAssemblyOptions(
  input: ParametricVesselAssemblyOptions | undefined,
): NormalizedParametricVesselAssembly {
  const style = input?.style ?? "straight-edge";
  const hullCrossSection = input?.hullCrossSection ??
    (style === "rounded-corner" ? "rounded-rectangle" : "rectangular");
  const normalized: NormalizedParametricVesselAssembly = {
    style,
    hullCrossSection,
  };
  if (input?.cornerRadiusMeters !== undefined) {
    normalized.cornerRadiusMeters = requirePositive(
      input.cornerRadiusMeters,
      "assembly.cornerRadiusMeters",
    );
  }
  if (input?.metadata !== undefined) {
    normalized.metadata = { ...input.metadata };
  }
  return normalized;
}

function defaultLayoutParts(
  spec: ParametricVesselSpec,
  physical: ParametricVesselLayout["physicalDimensions"],
  reference: Required<ParametricVesselReferencePoint>,
  assembly: NormalizedParametricVesselAssembly,
  sections: { bowLengthMeters: number; sternLengthMeters: number },
): ParametricVesselLayoutPart[] {
  const hullZ = localZFromKeel(physical.hullHeightMeters / 2, reference);
  const deckCenterZ = localZFromKeel(
    physical.hullHeightMeters + physical.deckThicknessMeters / 2,
    reference,
  );
  const superstructureBaseZFromKeel = physical.hullHeightMeters;
  const hullSize = {
    beamMeters: physical.beamMeters,
    heightMeters: physical.hullHeightMeters,
  };
  const sternEnd = sections.sternLengthMeters;
  const bowStart = physical.lengthMeters - sections.bowLengthMeters;
  const deckInset = normalizeOptionalNonNegative(
    spec.layout?.deckInsetMeters,
    physical.beamMeters * 0.04,
    "layout.deckInsetMeters",
  );
  const hullBox = {
    minFromSternMeters: 0,
    maxFromSternMeters: bowStart,
    minLateralFromCenterMeters: -physical.beamMeters / 2,
    maxLateralFromCenterMeters: physical.beamMeters / 2,
  };
  const hullBoxLength = hullBox.maxFromSternMeters - hullBox.minFromSternMeters;
  const deckOutline = insetHullTopOutline(
    physical.lengthMeters,
    physical.beamMeters,
    bowStart,
    deckInset,
    reference,
  );
  const mastHeight = normalizeOptionalPositive(
    spec.layout?.mast?.heightMeters,
    physical.mastHeightMeters,
    "layout.mast.heightMeters",
  );
  const mastRadius = normalizeOptionalPositive(
    spec.layout?.mast?.radiusMeters,
    Math.max(physical.beamMeters * 0.0175, 0.25),
    "layout.mast.radiusMeters",
  );
  const mastDiameter = mastRadius * 2;
  const transponderBeam = normalizeOptionalPositive(
    spec.layout?.transponder?.beamMeters,
    Math.max(mastDiameter * 2.4, 0.7),
    "layout.transponder.beamMeters",
  );
  const transponderLength = normalizeOptionalPositive(
    spec.layout?.transponder?.lengthMeters,
    transponderBeam,
    "layout.transponder.lengthMeters",
  );
  const transponderHeight = normalizeOptionalPositive(
    spec.layout?.transponder?.heightMeters,
    Math.max(mastDiameter * 0.28, 0.15),
    "layout.transponder.heightMeters",
  );
  const requestedAntennaCenterFromStern = normalizeCenterFromStern(
    spec.layout?.transponder?.centerFromSternMeters,
    reference.longitudinalFromSternMeters,
    physical.lengthMeters,
    "layout.transponder.centerFromSternMeters",
  );
  const requestedAntennaLateralFromCenter = normalizeLateralFromCenter(
    spec.layout?.transponder?.lateralFromCenterMeters,
    reference.lateralFromCenterMeters,
    physical.beamMeters,
    "layout.transponder.lateralFromCenterMeters",
  );
  const antennaFootprint = {
    beamMeters: Math.max(mastDiameter, transponderBeam),
    lengthMeters: Math.max(mastDiameter, transponderLength),
  };
  const antennaCenterFromStern = clampCenterInsideRange(
    requestedAntennaCenterFromStern,
    hullBox.minFromSternMeters,
    hullBox.maxFromSternMeters,
    antennaFootprint.lengthMeters,
  );
  const antennaLateralFromCenter = clampCenterInsideRange(
    requestedAntennaLateralFromCenter,
    hullBox.minLateralFromCenterMeters,
    hullBox.maxLateralFromCenterMeters,
    antennaFootprint.beamMeters,
  );
  const bridgeLength = resolveProportionalSize(
    spec.layout?.bridge?.lengthMeters,
    spec.layout?.bridge?.lengthRatio,
    hullBoxLength,
    0.15,
    antennaFootprint.lengthMeters,
    "layout.bridge.length",
  );
  const bridgeBeam = resolveProportionalSize(
    spec.layout?.bridge?.beamMeters,
    spec.layout?.bridge?.beamRatio,
    physical.beamMeters,
    0.6,
    antennaFootprint.beamMeters,
    "layout.bridge.beam",
  );
  const bridgeHeight = normalizeOptionalPositive(
    spec.layout?.bridge?.heightMeters,
    physical.bridgeHeightMeters,
    "layout.bridge.heightMeters",
  );
  const requestedBridgeCenterFromStern = normalizeCenterFromStern(
    spec.layout?.bridge?.centerFromSternMeters,
    antennaCenterFromStern,
    physical.lengthMeters,
    "layout.bridge.centerFromSternMeters",
  );
  const requestedBridgeLateralFromCenter = normalizeLateralFromCenter(
    spec.layout?.bridge?.lateralFromCenterMeters,
    antennaLateralFromCenter,
    physical.beamMeters,
    "layout.bridge.lateralFromCenterMeters",
  );
  const bridgeCenterFromStern = clampContainerCenter(
    requestedBridgeCenterFromStern,
    antennaCenterFromStern,
    hullBox.minFromSternMeters,
    hullBox.maxFromSternMeters,
    bridgeLength,
    antennaFootprint.lengthMeters,
  );
  const bridgeLateralFromCenter = clampContainerCenter(
    requestedBridgeLateralFromCenter,
    antennaLateralFromCenter,
    hullBox.minLateralFromCenterMeters,
    hullBox.maxLateralFromCenterMeters,
    bridgeBeam,
    antennaFootprint.beamMeters,
  );
  const transponderDistanceBelowMastTop = normalizeOptionalNonNegative(
    spec.layout?.transponder?.distanceBelowMastTopMeters,
    0,
    "layout.transponder.distanceBelowMastTopMeters",
  );
  if (transponderDistanceBelowMastTop > mastHeight) {
    throw new RangeError("layout.transponder.distanceBelowMastTopMeters must be within mast height.");
  }
  const mastTopZFromKeel = superstructureBaseZFromKeel + mastHeight;
  const transponderTopZFromKeel = mastTopZFromKeel - transponderDistanceBelowMastTop;
  const transponderCenterZFromKeel = Math.max(
    superstructureBaseZFromKeel + transponderHeight / 2,
    transponderTopZFromKeel - transponderHeight / 2,
  );

  const parts: ParametricVesselLayoutPart[] = [
    createLayoutPart({
      id: "hull-stern",
      role: "hull-stern",
      centerMeters: centerFromSternRange(0, sternEnd, reference, hullZ),
      sizeMeters: {
        ...hullSize,
        lengthMeters: sternEnd,
      },
      geometry: hullGeometry("box", assembly),
      tags: ["hull", "aft"],
    }),
    createLayoutPart({
      id: "hull-midship",
      role: "hull-midship",
      centerMeters: centerFromSternRange(sternEnd, bowStart, reference, hullZ),
      sizeMeters: {
        ...hullSize,
        lengthMeters: Math.max(bowStart - sternEnd, physical.lengthMeters * 0.1),
      },
      geometry: hullGeometry("box", assembly),
      tags: ["hull", "stretch-length"],
    }),
    createLayoutPart({
      id: "hull-bow",
      role: "hull-bow",
      centerMeters: centerFromSternRange(bowStart, physical.lengthMeters, reference, hullZ),
      sizeMeters: {
        ...hullSize,
        lengthMeters: physical.lengthMeters - bowStart,
      },
      geometry: hullGeometry("wedge", assembly, { taperEnd: "bow" }),
      tags: ["hull", "fore"],
    }),
  ];

  if (deckOutline !== undefined) {
    parts.push(createLayoutPart({
      id: "main-deck",
      role: "main-deck",
      centerMeters: {
        xMeters: deckOutline.centerMeters.xMeters,
        yMeters: deckOutline.centerMeters.yMeters,
        zMeters: deckCenterZ,
      },
      sizeMeters: {
        beamMeters: deckOutline.sizeMeters.beamMeters,
        lengthMeters: deckOutline.sizeMeters.lengthMeters,
        heightMeters: physical.deckThicknessMeters,
      },
      geometry: deckOutlineGeometry(deckOutline.outlineMeters),
      tags: ["deck", "stretch-length"],
    }));
  }

  parts.push(
    createLayoutPart({
      id: "bridge",
      role: "bridge",
      centerMeters: {
        xMeters: bridgeLateralFromCenter - reference.lateralFromCenterMeters,
        yMeters: bridgeCenterFromStern - reference.longitudinalFromSternMeters,
        zMeters: localZFromKeel(
          superstructureBaseZFromKeel + bridgeHeight / 2,
          reference,
        ),
      },
      sizeMeters: {
        beamMeters: bridgeBeam,
        lengthMeters: bridgeLength,
        heightMeters: bridgeHeight,
      },
      geometry: componentGeometry("box", { edgeTreatment: "sharp" }),
      tags: ["superstructure"],
    }),
    createLayoutPart({
      id: "mast",
      role: "mast",
      centerMeters: {
        xMeters: antennaLateralFromCenter - reference.lateralFromCenterMeters,
        yMeters: antennaCenterFromStern - reference.longitudinalFromSternMeters,
        zMeters: localZFromKeel(
          superstructureBaseZFromKeel + mastHeight / 2,
          reference,
        ),
      },
      sizeMeters: {
        beamMeters: mastDiameter,
        lengthMeters: mastDiameter,
        heightMeters: mastHeight,
      },
      geometry: componentGeometry("cylinder", { axis: "z" }),
      tags: ["mast"],
    }),
    createLayoutPart({
      id: "transponder",
      role: "transponder",
      centerMeters: localPointFromVesselPoint(
        {
          longitudinalFromSternMeters: antennaCenterFromStern,
          lateralFromCenterMeters: antennaLateralFromCenter,
          verticalFromKeelMeters: transponderCenterZFromKeel,
        },
        reference,
      ),
      sizeMeters: {
        beamMeters: transponderBeam,
        lengthMeters: transponderLength,
        heightMeters: transponderHeight,
      },
      geometry: componentGeometry("disc", { axis: "z" }),
      tags: ["transponder", "reference-marker"],
    }),
  );

  return parts;
}

function hullGeometry(
  kind: ParametricVesselPartGeometryKind,
  assembly: NormalizedParametricVesselAssembly,
  options?: Pick<ParametricVesselPartGeometry, "corner" | "taperEnd">,
): ParametricVesselPartGeometry {
  const geometry: ParametricVesselPartGeometry = {
    kind,
    edgeTreatment: hullEdgeTreatment(assembly),
  };
  if (options?.corner !== undefined) {
    geometry.corner = options.corner;
  }
  if (options?.taperEnd !== undefined) {
    geometry.taperEnd = options.taperEnd;
  }
  if (assembly.cornerRadiusMeters !== undefined) {
    geometry.parameters = {
      cornerRadiusMeters: assembly.cornerRadiusMeters,
    };
  }
  return geometry;
}

function componentGeometry(
  kind: ParametricVesselPartGeometryKind,
  options?: Pick<ParametricVesselPartGeometry, "axis" | "edgeTreatment">,
): ParametricVesselPartGeometry {
  const geometry: ParametricVesselPartGeometry = { kind };
  if (options?.axis !== undefined) {
    geometry.axis = options.axis;
  }
  if (options?.edgeTreatment !== undefined) {
    geometry.edgeTreatment = options.edgeTreatment;
  }
  return geometry;
}

function deckOutlineGeometry(
  outlineMeters: readonly ParametricVesselPlanPoint[],
): ParametricVesselPartGeometry {
  return {
    kind: "deck-outline",
    edgeTreatment: "sharp",
    metadata: {
      outlineMeters: outlineMeters.map((point) => ({ ...point })),
    },
  };
}

function hullEdgeTreatment(
  assembly: NormalizedParametricVesselAssembly,
): ParametricVesselEdgeTreatment {
  return assembly.style === "rounded-corner" ||
    assembly.hullCrossSection === "rounded-rectangle"
    ? "rounded"
    : "sharp";
}

function insetHullTopOutline(
  lengthMeters: number,
  beamMeters: number,
  bowStartFromSternMeters: number,
  deckInsetMeters: number,
  reference: Required<ParametricVesselReferencePoint>,
): {
  centerMeters: ParametricVesselPlanPoint;
  sizeMeters: Pick<ParametricVesselPartSize, "beamMeters" | "lengthMeters">;
  outlineMeters: readonly ParametricVesselPlanPoint[];
} | undefined {
  const halfBeam = beamMeters / 2;
  const hullOutline: readonly ParametricVesselPlanPoint[] = [
    { xMeters: -halfBeam, yMeters: 0 },
    { xMeters: halfBeam, yMeters: 0 },
    { xMeters: halfBeam, yMeters: bowStartFromSternMeters },
    { xMeters: 0, yMeters: lengthMeters },
    { xMeters: -halfBeam, yMeters: bowStartFromSternMeters },
  ];
  const insetOutline = insetConvexPolygon(hullOutline, deckInsetMeters);
  if (insetOutline.length < 3) {
    return undefined;
  }
  const localOutline = insetOutline.map((point) => ({
    xMeters: point.xMeters - reference.lateralFromCenterMeters,
    yMeters: point.yMeters - reference.longitudinalFromSternMeters,
  }));
  const bounds = boundsForPlanPoints(localOutline);
  const beam = bounds.max.xMeters - bounds.min.xMeters;
  const length = bounds.max.yMeters - bounds.min.yMeters;
  if (beam <= 0 || length <= 0) {
    return undefined;
  }
  const center = {
    xMeters: (bounds.min.xMeters + bounds.max.xMeters) / 2,
    yMeters: (bounds.min.yMeters + bounds.max.yMeters) / 2,
  };
  return {
    centerMeters: center,
    sizeMeters: {
      beamMeters: beam,
      lengthMeters: length,
    },
    outlineMeters: localOutline.map((point) => ({
      xMeters: point.xMeters - center.xMeters,
      yMeters: point.yMeters - center.yMeters,
    })),
  };
}

function insetConvexPolygon(
  points: readonly ParametricVesselPlanPoint[],
  insetMeters: number,
): readonly ParametricVesselPlanPoint[] {
  if (points.length < 3) {
    return [];
  }
  if (insetMeters <= 0) {
    return points.map((point) => ({ ...point }));
  }
  const orientation = signedPlanArea(points) >= 0 ? 1 : -1;
  const offsetLines = points.map((point, index) => {
    const next = points[(index + 1) % points.length] as ParametricVesselPlanPoint;
    const dx = next.xMeters - point.xMeters;
    const dy = next.yMeters - point.yMeters;
    const length = Math.hypot(dx, dy);
    if (length <= 0) {
      return undefined;
    }
    const inwardNormal = {
      xMeters: (-orientation * dy) / length,
      yMeters: (orientation * dx) / length,
    };
    return {
      point: {
        xMeters: point.xMeters + inwardNormal.xMeters * insetMeters,
        yMeters: point.yMeters + inwardNormal.yMeters * insetMeters,
      },
      direction: {
        xMeters: dx,
        yMeters: dy,
      },
    };
  });
  if (offsetLines.some((line) => line === undefined)) {
    return [];
  }
  const inset = points.map((_, index) => {
    const previous = offsetLines[
      (index - 1 + offsetLines.length) % offsetLines.length
    ];
    const current = offsetLines[index];
    if (!previous || !current) {
      return undefined;
    }
    return intersectPlanLines(previous, current);
  });
  if (inset.some((point) => point === undefined)) {
    return [];
  }
  const completeInset = inset as ParametricVesselPlanPoint[];
  if (
    Math.abs(signedPlanArea(completeInset)) < 1e-6 ||
    signedPlanArea(completeInset) * orientation <= 0
  ) {
    return [];
  }
  return completeInset;
}

function intersectPlanLines(
  first: { point: ParametricVesselPlanPoint; direction: ParametricVesselPlanPoint },
  second: { point: ParametricVesselPlanPoint; direction: ParametricVesselPlanPoint },
): ParametricVesselPlanPoint | undefined {
  const denominator =
    first.direction.xMeters * second.direction.yMeters -
    first.direction.yMeters * second.direction.xMeters;
  if (Math.abs(denominator) < 1e-9) {
    return undefined;
  }
  const dx = second.point.xMeters - first.point.xMeters;
  const dy = second.point.yMeters - first.point.yMeters;
  const t =
    (dx * second.direction.yMeters - dy * second.direction.xMeters) /
    denominator;
  return {
    xMeters: first.point.xMeters + first.direction.xMeters * t,
    yMeters: first.point.yMeters + first.direction.yMeters * t,
  };
}

function signedPlanArea(points: readonly ParametricVesselPlanPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length] as ParametricVesselPlanPoint;
    return area + point.xMeters * next.yMeters - next.xMeters * point.yMeters;
  }, 0) / 2;
}

function boundsForPlanPoints(points: readonly ParametricVesselPlanPoint[]): {
  min: ParametricVesselPlanPoint;
  max: ParametricVesselPlanPoint;
} {
  const first = points[0] as ParametricVesselPlanPoint;
  return points.reduce(
    (bounds, point) => ({
      min: {
        xMeters: Math.min(bounds.min.xMeters, point.xMeters),
        yMeters: Math.min(bounds.min.yMeters, point.yMeters),
      },
      max: {
        xMeters: Math.max(bounds.max.xMeters, point.xMeters),
        yMeters: Math.max(bounds.max.yMeters, point.yMeters),
      },
    }),
    {
      min: { ...first },
      max: { ...first },
    },
  );
}

function normalizeVesselDimensions(input: ParametricVesselDimensions): VesselDimensions {
  const draught = requirePositive(input.draught, "dimensions.draught");
  const bow = requireNonNegative(input.bow, "dimensions.bow");
  const stern = requireNonNegative(input.stern, "dimensions.stern");
  const port = requireNonNegative(input.port, "dimensions.port");
  const starboard = requireNonNegative(input.starboard, "dimensions.starboard");
  if (bow + stern <= 0) {
    throw new RangeError("dimensions.bow + dimensions.stern must be greater than zero.");
  }
  if (port + starboard <= 0) {
    throw new RangeError("dimensions.port + dimensions.starboard must be greater than zero.");
  }
  return { draught, bow, stern, port, starboard };
}

function normalizePhysicalDimensions(
  input: ParametricVesselDimensions,
): ParametricVesselPhysicalDimensions {
  const dimensions = normalizeVesselDimensions(input);
  const lengthMeters = dimensions.bow + dimensions.stern;
  const beamMeters = dimensions.port + dimensions.starboard;
  const draughtMeters = dimensions.draught;
  const hullHeightMeters = normalizeOptionalPositive(
    input.hullHeightMeters,
    draughtMeters + Math.max(draughtMeters * 0.35, 1.5),
    "dimensions.hullHeightMeters",
  );
  if (hullHeightMeters < draughtMeters) {
    throw new RangeError("dimensions.hullHeightMeters must be greater than or equal to dimensions.draught.");
  }
  const freeboardMeters = hullHeightMeters - draughtMeters;
  const deckThicknessMeters = normalizeOptionalPositive(
    input.deckThicknessMeters,
    Math.max(hullHeightMeters * 0.035, 0.25),
    "dimensions.deckThicknessMeters",
  );
  const bridgeHeightMeters = normalizeOptionalPositive(
    input.bridgeHeightMeters,
    Math.max(beamMeters * 0.35, 4),
    "dimensions.bridgeHeightMeters",
  );
  const mastHeightMeters = normalizeOptionalPositive(
    input.mastHeightMeters,
    Math.max(bridgeHeightMeters * 1.4, 6),
    "dimensions.mastHeightMeters",
  );

  return {
    lengthMeters,
    beamMeters,
    draughtMeters,
    freeboardMeters,
    hullHeightMeters,
    deckThicknessMeters,
    bridgeHeightMeters,
    mastHeightMeters,
  };
}

function normalizeReferencePoint(
  input: ParametricVesselDimensions,
): ParametricVesselReferencePoint {
  const dimensions = normalizeVesselDimensions(input);
  const physical = normalizePhysicalDimensions(input);
  return {
    longitudinalFromSternMeters: dimensions.stern,
    lateralFromCenterMeters: (dimensions.port - dimensions.starboard) / 2,
    verticalFromKeelMeters: physical.draughtMeters,
  };
}

function normalizeSectionLengths(
  physical: ParametricVesselLayout["physicalDimensions"],
  layout: ParametricVesselLayoutOptions | undefined,
): { bowLengthMeters: number; sternLengthMeters: number } {
  let bowLengthMeters = normalizeOptionalPositive(
    layout?.bowLengthMeters,
    physical.lengthMeters * 0.18,
    "layout.bowLengthMeters",
  );
  const sternLengthMeters = physical.lengthMeters * 0.14;
  const maxBowLength = Math.max(
    physical.lengthMeters * 0.01,
    physical.lengthMeters * 0.75 - sternLengthMeters,
  );
  bowLengthMeters = Math.min(bowLengthMeters, maxBowLength);
  return { bowLengthMeters, sternLengthMeters };
}

function centerFromSternRange(
  startMeters: number,
  endMeters: number,
  reference: Required<ParametricVesselReferencePoint>,
  zMeters: number,
): ParametricVesselLocalPoint {
  return {
    xMeters: -reference.lateralFromCenterMeters,
    yMeters: (startMeters + endMeters) / 2 - reference.longitudinalFromSternMeters,
    zMeters,
  };
}

function localPointFromVesselPoint(
  point: Required<ParametricVesselReferencePoint>,
  reference: Required<ParametricVesselReferencePoint>,
): ParametricVesselLocalPoint {
  return {
    xMeters: point.lateralFromCenterMeters - reference.lateralFromCenterMeters,
    yMeters: point.longitudinalFromSternMeters - reference.longitudinalFromSternMeters,
    zMeters: localZFromKeel(point.verticalFromKeelMeters, reference),
  };
}

function localZFromKeel(
  verticalFromKeelMeters: number,
  reference: Required<ParametricVesselReferencePoint>,
): number {
  return verticalFromKeelMeters - reference.verticalFromKeelMeters;
}

function createLayoutPart(options: {
  id: string;
  role: ParametricVesselPartRole;
  centerMeters: ParametricVesselLocalPoint;
  sizeMeters: ParametricVesselPartSize;
  naturalSizeMeters?: Partial<ParametricVesselPartSize>;
  assetId?: string;
  asset?: ParametricVesselPartAsset;
  geometry?: ParametricVesselPartGeometry;
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
}): ParametricVesselLayoutPart {
  const natural = completePartSize(options.naturalSizeMeters, options.sizeMeters);
  const assetNatural = completePartSize(options.asset?.naturalSizeMeters, natural);
  const naturalSizeMeters = completePartSize(options.naturalSizeMeters, assetNatural);
  const part: ParametricVesselLayoutPart = {
    id: options.id,
    role: options.role,
    centerMeters: { ...options.centerMeters },
    sizeMeters: { ...options.sizeMeters },
    naturalSizeMeters,
    scale: [
      safeScale(options.sizeMeters.beamMeters, naturalSizeMeters.beamMeters),
      safeScale(options.sizeMeters.lengthMeters, naturalSizeMeters.lengthMeters),
      safeScale(options.sizeMeters.heightMeters, naturalSizeMeters.heightMeters),
    ],
    boundsMeters: boundsForPart(options.centerMeters, options.sizeMeters),
  };
  if (options.assetId !== undefined) {
    part.assetId = options.assetId;
  }
  if (options.asset !== undefined) {
    part.asset = options.asset;
  }
  if (options.geometry !== undefined) {
    part.geometry = clonePartGeometry(options.geometry);
  }
  if (options.tags !== undefined) {
    part.tags = [...options.tags];
  }
  if (options.metadata !== undefined) {
    part.metadata = { ...options.metadata };
  }
  return part;
}

function applyPartOverrides(
  defaults: readonly ParametricVesselLayoutPart[],
  overrides: readonly ParametricVesselPartOverride[] | undefined,
  assets: Record<string, ParametricVesselPartAsset> | undefined,
): readonly ParametricVesselLayoutPart[] {
  if (!overrides?.length) {
    return defaults.map((part) => attachAsset(part, assets));
  }

  const parts = new Map(defaults.map((part) => [part.id, attachAsset(part, assets)]));
  for (const override of overrides) {
    const existing = parts.get(override.id);
    if (override.enabled === false) {
      parts.delete(override.id);
      continue;
    }
    if (existing) {
      parts.set(override.id, applyPartOverride(existing, override, assets));
      continue;
    }
    parts.set(
      override.id,
      applyPartOverride(
        createLayoutPart({
          id: override.id,
          role: override.role ?? override.id,
          centerMeters: { xMeters: 0, yMeters: 0, zMeters: 0 },
          sizeMeters: { beamMeters: 1, lengthMeters: 1, heightMeters: 1 },
        }),
        override,
        assets,
      ),
    );
  }
  return [...parts.values()];
}

function applyPartOverride(
  part: ParametricVesselLayoutPart,
  override: ParametricVesselPartOverride,
  assets: Record<string, ParametricVesselPartAsset> | undefined,
): ParametricVesselLayoutPart {
  const assetId = override.assetId ?? part.assetId;
  const asset = override.asset ?? (assetId !== undefined ? assets?.[assetId] : part.asset);
  const geometry = mergePartGeometry(part.geometry, override.geometry);
  const tags = override.tags ?? part.tags;
  const metadata = {
    ...part.metadata,
    ...override.metadata,
  };
  return createLayoutPart({
    id: part.id,
    role: override.role ?? part.role,
    centerMeters: {
      ...part.centerMeters,
      ...override.centerMeters,
    },
    sizeMeters: {
      ...part.sizeMeters,
      ...override.sizeMeters,
    },
    naturalSizeMeters: {
      ...part.naturalSizeMeters,
      ...asset?.naturalSizeMeters,
      ...override.naturalSizeMeters,
    },
    ...(assetId !== undefined ? { assetId } : {}),
    ...(asset !== undefined ? { asset } : {}),
    ...(geometry !== undefined ? { geometry } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  });
}

function clonePartGeometry(
  input: ParametricVesselPartGeometry,
): ParametricVesselPartGeometry {
  const geometry: ParametricVesselPartGeometry = { kind: input.kind };
  if (input.edgeTreatment !== undefined) {
    geometry.edgeTreatment = input.edgeTreatment;
  }
  if (input.axis !== undefined) {
    geometry.axis = input.axis;
  }
  if (input.taperEnd !== undefined) {
    geometry.taperEnd = input.taperEnd;
  }
  if (input.corner !== undefined) {
    geometry.corner = input.corner;
  }
  if (input.parameters !== undefined) {
    geometry.parameters = { ...input.parameters };
  }
  if (input.metadata !== undefined) {
    geometry.metadata = { ...input.metadata };
  }
  return geometry;
}

function mergePartGeometry(
  base: ParametricVesselPartGeometry | undefined,
  override: ParametricVesselPartGeometry | undefined,
): ParametricVesselPartGeometry | undefined {
  if (base === undefined) {
    return override === undefined ? undefined : clonePartGeometry(override);
  }
  if (override === undefined) {
    return clonePartGeometry(base);
  }
  const geometry: ParametricVesselPartGeometry = {
    ...clonePartGeometry(base),
    ...clonePartGeometry(override),
  };
  const parameters = {
    ...base.parameters,
    ...override.parameters,
  };
  if (Object.keys(parameters).length > 0) {
    geometry.parameters = parameters;
  }
  const metadata = {
    ...base.metadata,
    ...override.metadata,
  };
  if (Object.keys(metadata).length > 0) {
    geometry.metadata = metadata;
  }
  return geometry;
}

function attachAsset(
  part: ParametricVesselLayoutPart,
  assets: Record<string, ParametricVesselPartAsset> | undefined,
): ParametricVesselLayoutPart {
  const assetId = part.assetId ?? part.id;
  const asset = assets?.[assetId];
  if (!asset) {
    return part;
  }
  return applyPartOverride(part, { id: part.id, assetId }, assets);
}

function boundsForPart(
  center: ParametricVesselLocalPoint,
  size: ParametricVesselPartSize,
): ParametricVesselLayoutPart["boundsMeters"] {
  const halfBeam = size.beamMeters / 2;
  const halfLength = size.lengthMeters / 2;
  const halfHeight = size.heightMeters / 2;
  return {
    min: {
      xMeters: center.xMeters - halfBeam,
      yMeters: center.yMeters - halfLength,
      zMeters: center.zMeters - halfHeight,
    },
    max: {
      xMeters: center.xMeters + halfBeam,
      yMeters: center.yMeters + halfLength,
      zMeters: center.zMeters + halfHeight,
    },
  };
}

function boundsForParts(
  parts: readonly ParametricVesselLayoutPart[],
): ParametricVesselLayout["boundsMeters"] {
  if (parts.length === 0) {
    return {
      min: { xMeters: 0, yMeters: 0, zMeters: 0 },
      max: { xMeters: 0, yMeters: 0, zMeters: 0 },
    };
  }
  const first = parts[0] as ParametricVesselLayoutPart;
  return parts.reduce(
    (bounds, part) => ({
      min: {
        xMeters: Math.min(bounds.min.xMeters, part.boundsMeters.min.xMeters),
        yMeters: Math.min(bounds.min.yMeters, part.boundsMeters.min.yMeters),
        zMeters: Math.min(bounds.min.zMeters, part.boundsMeters.min.zMeters),
      },
      max: {
        xMeters: Math.max(bounds.max.xMeters, part.boundsMeters.max.xMeters),
        yMeters: Math.max(bounds.max.yMeters, part.boundsMeters.max.yMeters),
        zMeters: Math.max(bounds.max.zMeters, part.boundsMeters.max.zMeters),
      },
    }),
    {
      min: { ...first.boundsMeters.min },
      max: { ...first.boundsMeters.max },
    },
  );
}

function completePartSize(
  partial: Partial<ParametricVesselPartSize> | undefined,
  fallback: ParametricVesselPartSize,
): ParametricVesselPartSize {
  return {
    beamMeters: normalizeOptionalPositive(partial?.beamMeters, fallback.beamMeters, "part.beamMeters"),
    lengthMeters: normalizeOptionalPositive(partial?.lengthMeters, fallback.lengthMeters, "part.lengthMeters"),
    heightMeters: normalizeOptionalPositive(partial?.heightMeters, fallback.heightMeters, "part.heightMeters"),
  };
}

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
  return value;
}

function requireNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function normalizeOptionalPositive(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  return requirePositive(value, label);
}

function normalizeOptionalNonNegative(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function normalizeCenterFromStern(
  value: number | undefined,
  fallback: number,
  lengthMeters: number,
  label: string,
): number {
  const center = normalizeOptionalNonNegative(value, fallback, label);
  if (center > lengthMeters) {
    throw new RangeError(`${label} must be within vessel length.`);
  }
  return center;
}

function normalizeLateralFromCenter(
  value: number | undefined,
  fallback: number,
  beamMeters: number,
  label: string,
): number {
  const lateral = value ?? fallback;
  if (!Number.isFinite(lateral)) {
    throw new RangeError(`${label} must be finite.`);
  }
  if (Math.abs(lateral) > beamMeters / 2) {
    throw new RangeError(`${label} must be within vessel beam.`);
  }
  return lateral;
}

function resolveProportionalSize(
  sizeMeters: number | undefined,
  ratio: number | undefined,
  baseMeters: number,
  fallbackRatio: number,
  containedSizeMeters: number,
  label: string,
): number {
  if (baseMeters <= 0) {
    return containedSizeMeters;
  }
  const requested = sizeMeters !== undefined
    ? requirePositive(sizeMeters, `${label}Meters`)
    : requireRatio(ratio, fallbackRatio, `${label}Ratio`) * baseMeters;
  const maxContainedSize = Math.min(containedSizeMeters, baseMeters);
  return clamp(
    Math.max(requested, maxContainedSize),
    maxContainedSize,
    baseMeters,
  );
}

function requireRatio(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  const ratio = value ?? fallback;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    throw new RangeError(`${label} must be a finite number greater than 0 and no more than 1.`);
  }
  return ratio;
}

function clampCenterInsideRange(
  center: number,
  min: number,
  max: number,
  sizeMeters: number,
): number {
  const halfSize = sizeMeters / 2;
  const centerMin = min + halfSize;
  const centerMax = max - halfSize;
  if (centerMin > centerMax) {
    return (min + max) / 2;
  }
  return clamp(center, centerMin, centerMax);
}

function clampContainerCenter(
  requestedCenter: number,
  containedCenter: number,
  min: number,
  max: number,
  containerSizeMeters: number,
  containedSizeMeters: number,
): number {
  const halfContainer = containerSizeMeters / 2;
  const halfContained = containedSizeMeters / 2;
  const centerMin = Math.max(
    min + halfContainer,
    containedCenter + halfContained - containerSizeMeters,
  );
  const centerMax = Math.min(
    max - halfContainer,
    containedCenter - halfContained + containerSizeMeters,
  );
  if (centerMin > centerMax) {
    return clampCenterInsideRange(containedCenter, min, max, containerSizeMeters);
  }
  return clamp(requestedCenter, centerMin, centerMax);
}

function safeScale(size: number, naturalSize: number): number {
  return naturalSize > 0 ? size / naturalSize : 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
