import type { VesselDimensions } from "../viewer-features.js";
import { clamp, requireNonNegative, requirePositive } from "./validation.js";
import type {
  NormalizedParametricVesselAssembly,
  ParametricVesselAssemblyOptions,
  ParametricVesselLayout,
  ParametricVesselLayoutOptions,
  ParametricVesselLocalPoint,
  ParametricVesselPhysicalDimensions,
  ParametricVesselReferencePoint,
  ParametricVesselDimensions,
} from "./types.js";

export function normalizeAssemblyOptions(
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

export function normalizeVesselDimensions(input: ParametricVesselDimensions): VesselDimensions {
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

export function normalizePhysicalDimensions(
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

export function normalizeReferencePoint(
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

export function normalizeSectionLengths(
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

export function centerFromSternRange(
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

export function localPointFromVesselPoint(
  point: Required<ParametricVesselReferencePoint>,
  reference: Required<ParametricVesselReferencePoint>,
): ParametricVesselLocalPoint {
  return {
    xMeters: point.lateralFromCenterMeters - reference.lateralFromCenterMeters,
    yMeters: point.longitudinalFromSternMeters - reference.longitudinalFromSternMeters,
    zMeters: localZFromKeel(point.verticalFromKeelMeters, reference),
  };
}

export function localZFromKeel(
  verticalFromKeelMeters: number,
  reference: Required<ParametricVesselReferencePoint>,
): number {
  return verticalFromKeelMeters - reference.verticalFromKeelMeters;
}

export function normalizeOptionalPositive(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  return requirePositive(value, label);
}

export function normalizeOptionalNonNegative(
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

export function normalizeCenterFromStern(
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

export function normalizeLateralFromCenter(
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

export function resolveProportionalSize(
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

export function clampCenterInsideRange(
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

export function clampContainerCenter(
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
