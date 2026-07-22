import { type EnvironmentState } from "@ecc/s100-viewer";

export type CesiumVector3 = { x: number; y: number; z: number };

export type S102LightingFallbackState = {
  enabled: boolean;
  directionWC: CesiumVector3;
  ambientIntensity: number;
  directionalIntensity: number;
};

export const CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION: CesiumVector3 = {
  x: 0,
  y: 0.55,
  z: -0.83,
};

const S102_LIGHTING_FALLBACK_AMBIENT_INTENSITY = 0.48;
const S102_LIGHTING_FALLBACK_DIRECTIONAL_INTENSITY = 0.82;

export function createDefaultS102LightingFallbackState(): S102LightingFallbackState {
  return {
    enabled: true,
    directionWC: CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION,
    ambientIntensity: S102_LIGHTING_FALLBACK_AMBIENT_INTENSITY,
    directionalIntensity: S102_LIGHTING_FALLBACK_DIRECTIONAL_INTENSITY,
  };
}

export function resolveS102LightingFallbackState(options: {
  directionWC: CesiumVector3;
  sceneLightIntensity: number;
  lighting?: EnvironmentState["lighting"];
  environmentTextureLightingAvailable: boolean;
}): S102LightingFallbackState {
  const directionWC = normalizeCesiumVector3(options.directionWC) ?? CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION;
  const sceneLightIntensity = normalizePositiveNumber(options.sceneLightIntensity, 1.25);
  const enabled = !options.environmentTextureLightingAvailable;
  const lighting = options.lighting;
  return {
    enabled,
    directionWC,
    ambientIntensity: enabled
      ? Math.max(
          normalizePositiveNumber(lighting?.ambientIntensity, 0),
          normalizePositiveNumber(lighting?.environmentIntensity, 0) * 0.75,
          S102_LIGHTING_FALLBACK_AMBIENT_INTENSITY,
        )
      : normalizePositiveNumber(lighting?.ambientIntensity, 0),
    directionalIntensity: enabled
      ? Math.max(
          normalizePositiveNumber(lighting?.directionalIntensity, 0),
          sceneLightIntensity,
          S102_LIGHTING_FALLBACK_DIRECTIONAL_INTENSITY,
        )
      : normalizePositiveNumber(lighting?.directionalIntensity, sceneLightIntensity),
  };
}

export function cesiumSunDirectionFromTime(time: Date): CesiumVector3 {
  const hours = time.getUTCHours() + time.getUTCMinutes() / 60 + time.getUTCSeconds() / 3600;
  const dayProgress = hours / 24;
  const daylight = Math.sin((dayProgress - 0.25) * Math.PI * 2);
  const elevation = Math.max(0.12, daylight) * (Math.PI / 3);
  const horizontal = Math.cos(elevation);
  return normalizeCesiumVector3({
    x: 0,
    y: horizontal,
    z: -Math.sin(elevation),
  }) ?? CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION;
}

function normalizeCesiumVector3(vector: CesiumVector3 | null): CesiumVector3 | null {
  if (!vector) {
    return null;
  }
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < 1e-9) {
    return null;
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
