import { finiteNumber } from "../adapter-utils/numeric.js";

export type DepthMeters = number;
export type ElevationMeters = number;
export type WaterLevelMeters = number;

export type SafetyDepthStyleInput = {
  safetyDepthMeters?: number;
  /**
   * Legacy API field. Negative values were previously used as z-up terrain
   * elevation thresholds; positive values are treated as nautical depths.
   */
  unsafeDepth?: number;
};

export const defaultS102SafetyDepthMeters = 10;

export const normalizeDepthMeters = (
  depthMeters: number | undefined,
  fallback: DepthMeters = 0,
): DepthMeters => {
  if (typeof depthMeters === "number" && Number.isFinite(depthMeters)) {
    return Math.max(0, depthMeters);
  }
  return Math.max(0, fallback);
};

export const legacyUnsafeDepthToSafetyDepthMeters = (
  unsafeDepth: number | undefined,
): DepthMeters | undefined => {
  if (typeof unsafeDepth !== "number" || !Number.isFinite(unsafeDepth)) {
    return undefined;
  }
  return Math.abs(unsafeDepth);
};

export const resolveSafetyDepthMeters = (
  style: SafetyDepthStyleInput | null | undefined,
  fallback: DepthMeters = defaultS102SafetyDepthMeters,
): DepthMeters => {
  if (typeof style?.safetyDepthMeters === "number" && Number.isFinite(style.safetyDepthMeters)) {
    return normalizeDepthMeters(style.safetyDepthMeters, fallback);
  }

  const legacySafetyDepth = legacyUnsafeDepthToSafetyDepthMeters(style?.unsafeDepth);
  return normalizeDepthMeters(legacySafetyDepth, fallback);
};

export const getS102SafetyDepthMeters = resolveSafetyDepthMeters;

export const depthFromElevation = (
  elevationMeters: ElevationMeters,
  seaLevelMeters: WaterLevelMeters = 0,
): DepthMeters => finiteNumber(seaLevelMeters, 0) - finiteNumber(elevationMeters, 0);

export const elevationFromDepth = (
  depthMeters: DepthMeters,
  seaLevelMeters: WaterLevelMeters = 0,
): ElevationMeters => finiteNumber(seaLevelMeters, 0) - normalizeDepthMeters(depthMeters);

export const safetyDepthToZUpThresholdMeters = (
  safetyDepthMeters: number,
  seaLevelMeters: WaterLevelMeters = 0,
): ElevationMeters => elevationFromDepth(safetyDepthMeters, seaLevelMeters);

