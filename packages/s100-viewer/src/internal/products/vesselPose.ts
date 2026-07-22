import type { Coordinate } from "../../coordinates/types.js";
import { Coordinates } from "../../coordinates/types.js";
import type {
  VesselDimensions,
  VesselStyle,
  VesselVerticalPositionLimits,
} from "../../products/viewer-features.js";
import { clampNumber, finiteNumber, finiteOptionalNumber } from "../adapter-utils/numeric.js";

export type Vec3Fields = {
  x: number;
  y: number;
  z: number;
};

export const normalizeVesselDimensions = (
  dimensions: Partial<VesselDimensions>,
  fallback: VesselDimensions,
): VesselDimensions => ({
  draught: Math.max(0, finiteNumber(dimensions.draught, fallback.draught)),
  bow: finiteNumber(dimensions.bow, fallback.bow),
  stern: finiteNumber(dimensions.stern, fallback.stern),
  port: finiteNumber(dimensions.port, fallback.port),
  starboard: finiteNumber(dimensions.starboard, fallback.starboard),
});

export const resolveVesselDimensions = (
  spec: {
    dimensions?: Partial<VesselDimensions>;
    style?: Partial<VesselStyle>;
    extensionDimensions?: Partial<VesselDimensions>;
  },
  fallback: VesselDimensions,
): VesselDimensions => {
  const draught =
    spec.dimensions?.draught ??
    spec.extensionDimensions?.draught ??
    spec.style?.draughtMeters;
  return normalizeVesselDimensions(
    {
      ...spec.extensionDimensions,
      ...spec.dimensions,
      ...(draught !== undefined ? { draught } : {}),
    },
    fallback,
  );
};

export const resolveSeaLevelOffsetMeters = (
  reference: VesselVerticalPositionLimits["reference"] | undefined,
  seaLevelMeters: number,
): number => reference === "sea-level" ? finiteNumber(seaLevelMeters, 0) : 0;

export const renderedEngineZFromVesselPose = (
  poseZMeters: number,
  seaLevelMeters: number,
): number => finiteNumber(poseZMeters, 0) + finiteNumber(seaLevelMeters, 0);

export const vesselPoseZFromRenderedEngineZ = (
  renderedZMeters: number,
  seaLevelMeters: number,
): number => finiteNumber(renderedZMeters, 0) - finiteNumber(seaLevelMeters, 0);

export const normalizeVesselVerticalPositionLimits = (
  limits: VesselVerticalPositionLimits | undefined,
): VesselVerticalPositionLimits | null => {
  const minMeters = finiteOptionalNumber(limits?.minMeters);
  const maxMeters = finiteOptionalNumber(limits?.maxMeters);
  if (minMeters === undefined && maxMeters === undefined) {
    return null;
  }
  return {
    ...(minMeters !== undefined ? { minMeters } : {}),
    ...(maxMeters !== undefined ? { maxMeters } : {}),
    reference: limits?.reference === "sea-level" ? "sea-level" : "scene",
  };
};

export const constrainVesselPoseCoordinate = (
  coordinate: Coordinate,
  limits: VesselVerticalPositionLimits | null | undefined,
  seaLevelMeters: number,
): Coordinate => {
  if (!limits) {
    return coordinate;
  }
  const current = Coordinates.getVerticalMeters(coordinate);
  const next = constrainVesselPoseZ(current, limits, seaLevelMeters);
  return Object.is(current, next)
    ? coordinate
    : Coordinates.withVerticalMeters(coordinate, next);
};

export const constrainVesselPoseZ = (
  value: number,
  limits: VesselVerticalPositionLimits,
  seaLevelMeters: number,
): number => {
  const offset = resolveSeaLevelOffsetMeters(limits.reference, seaLevelMeters);
  const lower = limits.minMeters !== undefined ? limits.minMeters + offset : -Infinity;
  const upper = limits.maxMeters !== undefined ? limits.maxMeters + offset : Infinity;
  return clampNumber(value, Math.min(lower, upper), Math.max(lower, upper));
};
