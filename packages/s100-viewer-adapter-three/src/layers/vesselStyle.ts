import type {
  ColorValue,
  VesselDimensions,
  VesselLayerSpec,
  VesselOceanSurfaceStyle,
} from "@ecc/s100-viewer";
import * as THREE from "three";

const DEFAULT_OCEAN_SURFACE_OPACITY = 0.68;
const DEFAULT_OCEAN_SURFACE_ROUGHNESS = 0.096;
const DEFAULT_OCEAN_SURFACE_REFLECTIVITY = 0.4;
const VESSEL_OCEAN_SURFACE_RADIUS_FACTOR = 0.56;

export type ResolvedOceanSurfaceStyle = {
  enabled: boolean;
  radiusMeters: number;
  color: ColorValue | undefined;
  opacity: number;
  roughness: number;
  reflectivity: number;
};

export const resolveOceanSurfaceStyle = (
  spec: VesselLayerSpec,
): ResolvedOceanSurfaceStyle => {
  const dimensions = resolveDimensions(spec.dimensions);
  const style = getOceanSurfaceObject(spec.style?.oceanSurface);
  return {
    enabled: getOceanSurfaceEnabled(spec),
    radiusMeters: Math.max(
      1,
      normalizeFiniteNumber(
        style?.radiusMeters,
        getVesselOceanSurfaceRadius(dimensions),
      ),
    ),
    color: style?.color,
    opacity: clamp01(style?.opacity ?? DEFAULT_OCEAN_SURFACE_OPACITY),
    roughness: clamp01(style?.roughness ?? DEFAULT_OCEAN_SURFACE_ROUGHNESS),
    reflectivity: clamp01(style?.reflectivity ?? DEFAULT_OCEAN_SURFACE_REFLECTIVITY),
  };
};

export const radiusChanged = (
  current: ResolvedOceanSurfaceStyle,
  next: ResolvedOceanSurfaceStyle,
): boolean => Math.abs(current.radiusMeters - next.radiusMeters) > 1e-6;

export const getVesselCenterOffset = (
  dimensions: VesselDimensions,
): THREE.Vector3 =>
  new THREE.Vector3(
    (dimensions.starboard - dimensions.port) / 2,
    (dimensions.bow - dimensions.stern) / 2,
    0,
  );

export const resolveDimensions = (
  dimensions: VesselDimensions | undefined,
): VesselDimensions => ({
  draught: dimensions?.draught ?? 8,
  bow: dimensions?.bow ?? 35,
  stern: dimensions?.stern ?? 15,
  port: dimensions?.port ?? 8,
  starboard: dimensions?.starboard ?? 8,
});

export const normalizeFiniteNumber = (
  value: number | undefined,
  fallback: number,
): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const normalizePositiveNumber = (
  value: number | undefined,
  fallback: number,
): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

export const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));

const getOceanSurfaceEnabled = (spec: VesselLayerSpec): boolean => {
  if (typeof spec.rendering?.oceanSurfaceVisible === "boolean") {
    return spec.rendering.oceanSurfaceVisible;
  }
  if (typeof spec.style?.oceanSurface === "boolean") {
    return spec.style.oceanSurface;
  }
  if (typeof spec.style?.oceanSurface === "object") {
    return spec.style.oceanSurface.enabled ?? false;
  }
  return spec.style?.showOceanSurface ?? false;
};

const getOceanSurfaceObject = (
  style: VesselOceanSurfaceStyle | undefined,
): Exclude<VesselOceanSurfaceStyle, boolean> | null =>
  typeof style === "object" && style !== null ? style : null;

const getVesselOceanSurfaceRadius = (
  dimensions: VesselDimensions,
): number =>
  Math.max(
    dimensions.bow + dimensions.stern,
    dimensions.port + dimensions.starboard,
  ) * VESSEL_OCEAN_SURFACE_RADIUS_FACTOR * 0.965;
