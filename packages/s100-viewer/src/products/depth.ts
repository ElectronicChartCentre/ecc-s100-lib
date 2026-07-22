export type {
  DepthMeters,
  ElevationMeters,
  SafetyDepthStyleInput as S102SafetyDepthStyleLike,
  WaterLevelMeters,
} from "../internal/products/depthStyle.js";

export {
  defaultS102SafetyDepthMeters,
  depthFromElevation,
  elevationFromDepth,
  getS102SafetyDepthMeters,
  legacyUnsafeDepthToSafetyDepthMeters,
  normalizeDepthMeters,
  resolveSafetyDepthMeters,
  safetyDepthToZUpThresholdMeters,
} from "../internal/products/depthStyle.js";
