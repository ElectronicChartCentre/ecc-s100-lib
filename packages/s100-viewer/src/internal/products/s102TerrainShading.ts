export type S100TerrainShaderUniform<T = number> = {
  value: T;
};

export type S100TerrainShaderUniforms = {
  seaLevel: S100TerrainShaderUniform;
  safetyDepthMeters: S100TerrainShaderUniform;
  heightSign: S100TerrainShaderUniform;
  unsafeTransparency: S100TerrainShaderUniform;
  contourInterval: S100TerrainShaderUniform;
  ambientStrength: S100TerrainShaderUniform;
  vesselShadowCount: S100TerrainShaderUniform;
  vesselShadowIntensity: S100TerrainShaderUniform;
  vesselShadowData: S100TerrainShaderUniform<Float32Array>;
  vesselShadowOrientation: S100TerrainShaderUniform<Float32Array>;
  vesselShadowShape: S100TerrainShaderUniform<Float32Array>;
  waterLevelGridEnabled: S100TerrainShaderUniform;
  waterLevelGridTexture: S100TerrainShaderUniform<unknown>;
  waterLevelGridWidth: S100TerrainShaderUniform;
  waterLevelGridHeight: S100TerrainShaderUniform;
  waterLevelGridNoDataValue: S100TerrainShaderUniform;
  waterLevelGridOriginX: S100TerrainShaderUniform;
  waterLevelGridOriginY: S100TerrainShaderUniform;
  waterLevelGridLongitudinalX: S100TerrainShaderUniform;
  waterLevelGridLongitudinalY: S100TerrainShaderUniform;
  waterLevelGridLatitudinalX: S100TerrainShaderUniform;
  waterLevelGridLatitudinalY: S100TerrainShaderUniform;
};

export type S100TerrainShaderVerticalAxis = "x" | "y" | "z";

export type S100TerrainShaderSource = {
  vertexShader: string;
  fragmentShader: string;
};

export type S100TerrainShaderPatchOptions = {
  verticalAxis?: S100TerrainShaderVerticalAxis;
};

export type S100TerrainVesselShadowStamp = {
  x: number;
  y: number;
  bowMeters: number;
  sternMeters: number;
  portMeters: number;
  starboardMeters: number;
  headingRadians?: number;
  opacity?: number;
  softness?: number;
};

export type S100TerrainWaterLevelGridUniformState = {
  texture: unknown;
  width: number;
  height: number;
  noDataValue: number;
  originX: number;
  originY: number;
  longitudinalX: number;
  longitudinalY: number;
  latitudinalX: number;
  latitudinalY: number;
};

export const S100_TERRAIN_MAX_VESSEL_SHADOWS = 64;
export const S100_TERRAIN_SHADER_CACHE_KEY = "s100-terrain-v7";

export const S100_TERRAIN_SHADER_DEFAULTS = {
  seaLevel: 0,
  safetyDepthMeters: 10,
  heightSign: 1,
  unsafeTransparency: 0.6,
  contourInterval: 2.5,
  ambientStrength: 0.06,
  vesselShadowIntensity: 1,
  vesselShadowOpacity: 0.34,
  vesselShadowSoftness: 0.42,
} as const;

export const createS100TerrainShaderUniforms = (): S100TerrainShaderUniforms => ({
  seaLevel: { value: S100_TERRAIN_SHADER_DEFAULTS.seaLevel },
  safetyDepthMeters: { value: S100_TERRAIN_SHADER_DEFAULTS.safetyDepthMeters },
  heightSign: { value: S100_TERRAIN_SHADER_DEFAULTS.heightSign },
  unsafeTransparency: { value: S100_TERRAIN_SHADER_DEFAULTS.unsafeTransparency },
  contourInterval: { value: S100_TERRAIN_SHADER_DEFAULTS.contourInterval },
  ambientStrength: { value: S100_TERRAIN_SHADER_DEFAULTS.ambientStrength },
  vesselShadowCount: { value: 0 },
  vesselShadowIntensity: { value: S100_TERRAIN_SHADER_DEFAULTS.vesselShadowIntensity },
  vesselShadowData: { value: new Float32Array(S100_TERRAIN_MAX_VESSEL_SHADOWS * 4) },
  vesselShadowOrientation: { value: new Float32Array(S100_TERRAIN_MAX_VESSEL_SHADOWS * 4) },
  vesselShadowShape: { value: new Float32Array(S100_TERRAIN_MAX_VESSEL_SHADOWS * 4) },
  waterLevelGridEnabled: { value: 0 },
  waterLevelGridTexture: { value: null },
  waterLevelGridWidth: { value: 1 },
  waterLevelGridHeight: { value: 1 },
  waterLevelGridNoDataValue: { value: -1_000_000 },
  waterLevelGridOriginX: { value: 0 },
  waterLevelGridOriginY: { value: 0 },
  waterLevelGridLongitudinalX: { value: 1 },
  waterLevelGridLongitudinalY: { value: 0 },
  waterLevelGridLatitudinalX: { value: 0 },
  waterLevelGridLatitudinalY: { value: 1 },
});

export const assignS100TerrainShaderUniforms = (
  target: Record<string, unknown>,
  uniforms: S100TerrainShaderUniforms,
): void => {
  target.s100TerrainSeaLevel = uniforms.seaLevel;
  target.s100TerrainSafetyDepthMeters = uniforms.safetyDepthMeters;
  target.s100TerrainHeightSign = uniforms.heightSign;
  target.s100TerrainUnsafeTransparency = uniforms.unsafeTransparency;
  target.s100TerrainContourInterval = uniforms.contourInterval;
  target.s100TerrainAmbientStrength = uniforms.ambientStrength;
  target.s100TerrainVesselShadowCount = uniforms.vesselShadowCount;
  target.s100TerrainVesselShadowIntensity = uniforms.vesselShadowIntensity;
  target.s100TerrainVesselShadowData = uniforms.vesselShadowData;
  target.s100TerrainVesselShadowOrientation = uniforms.vesselShadowOrientation;
  target.s100TerrainVesselShadowShape = uniforms.vesselShadowShape;
  target.s100TerrainWaterLevelGridEnabled = uniforms.waterLevelGridEnabled;
  target.s100TerrainWaterLevelGridTexture = uniforms.waterLevelGridTexture;
  target.s100TerrainWaterLevelGridWidth = uniforms.waterLevelGridWidth;
  target.s100TerrainWaterLevelGridHeight = uniforms.waterLevelGridHeight;
  target.s100TerrainWaterLevelGridNoDataValue = uniforms.waterLevelGridNoDataValue;
  target.s100TerrainWaterLevelGridOriginX = uniforms.waterLevelGridOriginX;
  target.s100TerrainWaterLevelGridOriginY = uniforms.waterLevelGridOriginY;
  target.s100TerrainWaterLevelGridLongitudinalX = uniforms.waterLevelGridLongitudinalX;
  target.s100TerrainWaterLevelGridLongitudinalY = uniforms.waterLevelGridLongitudinalY;
  target.s100TerrainWaterLevelGridLatitudinalX = uniforms.waterLevelGridLatitudinalX;
  target.s100TerrainWaterLevelGridLatitudinalY = uniforms.waterLevelGridLatitudinalY;
};

export const updateS100TerrainWaterLevelGridUniforms = (
  uniforms: S100TerrainShaderUniforms,
  grid: S100TerrainWaterLevelGridUniformState | null,
): void => {
  if (!grid || grid.width <= 0 || grid.height <= 0) {
    uniforms.waterLevelGridEnabled.value = 0;
    return;
  }

  uniforms.waterLevelGridEnabled.value = 1;
  uniforms.waterLevelGridTexture.value = grid.texture;
  uniforms.waterLevelGridWidth.value = Math.max(1, Math.floor(grid.width));
  uniforms.waterLevelGridHeight.value = Math.max(1, Math.floor(grid.height));
  uniforms.waterLevelGridNoDataValue.value = normalizeS100TerrainFiniteNumber(
    grid.noDataValue,
    -1_000_000,
  );
  uniforms.waterLevelGridOriginX.value = normalizeS100TerrainFiniteNumber(grid.originX, 0);
  uniforms.waterLevelGridOriginY.value = normalizeS100TerrainFiniteNumber(grid.originY, 0);
  uniforms.waterLevelGridLongitudinalX.value = normalizeS100TerrainFiniteNumber(
    grid.longitudinalX,
    1,
  );
  uniforms.waterLevelGridLongitudinalY.value = normalizeS100TerrainFiniteNumber(
    grid.longitudinalY,
    0,
  );
  uniforms.waterLevelGridLatitudinalX.value = normalizeS100TerrainFiniteNumber(
    grid.latitudinalX,
    0,
  );
  uniforms.waterLevelGridLatitudinalY.value = normalizeS100TerrainFiniteNumber(
    grid.latitudinalY,
    1,
  );
};

export const updateS100TerrainVesselShadowUniforms = (
  uniforms: S100TerrainShaderUniforms,
  stamps: readonly S100TerrainVesselShadowStamp[],
): void => {
  const data = uniforms.vesselShadowData.value;
  const orientation = uniforms.vesselShadowOrientation.value;
  const shape = uniforms.vesselShadowShape.value;
  data.fill(0);
  orientation.fill(0);
  shape.fill(0);

  const count = Math.min(stamps.length, S100_TERRAIN_MAX_VESSEL_SHADOWS);
  for (let index = 0; index < count; index += 1) {
    const stamp = stamps[index];
    if (!stamp) {
      continue;
    }
    const offset = index * 4;
    const heading = normalizeS100TerrainFiniteNumber(stamp.headingRadians ?? 0, 0);
    data[offset] = normalizeS100TerrainFiniteNumber(stamp.x, 0);
    data[offset + 1] = normalizeS100TerrainFiniteNumber(stamp.y, 0);
    data[offset + 2] = Math.max(0.001, normalizeS100TerrainFiniteNumber(stamp.portMeters, 0.001));
    data[offset + 3] = Math.max(0.001, normalizeS100TerrainFiniteNumber(stamp.starboardMeters, 0.001));
    orientation[offset] = Math.cos(heading);
    orientation[offset + 1] = Math.sin(heading);
    orientation[offset + 2] = clamp01(
      stamp.opacity ?? S100_TERRAIN_SHADER_DEFAULTS.vesselShadowOpacity,
    );
    orientation[offset + 3] = clampRange(
      stamp.softness ?? S100_TERRAIN_SHADER_DEFAULTS.vesselShadowSoftness,
      0.05,
      0.95,
    );
    shape[offset] = Math.max(0.001, normalizeS100TerrainFiniteNumber(stamp.bowMeters, 0.001));
    shape[offset + 1] = Math.max(0.001, normalizeS100TerrainFiniteNumber(stamp.sternMeters, 0.001));
  }
  uniforms.vesselShadowCount.value = count;
};

export const patchS100TerrainShaderSource = (
  source: S100TerrainShaderSource,
  options: S100TerrainShaderPatchOptions = {},
): S100TerrainShaderSource => {
  const verticalAxis = options.verticalAxis ?? "z";
  return {
    vertexShader: patchS100TerrainVertexShader(source.vertexShader),
    fragmentShader: patchS100TerrainFragmentShader(source.fragmentShader, verticalAxis),
  };
};

export const normalizeS100TerrainFiniteNumber = (
  value: number,
  fallback: number,
): number => Number.isFinite(value) ? value : fallback;

export const normalizeS100TerrainHeightSign = (value: number): 1 | -1 =>
  Number.isFinite(value) && value < 0 ? -1 : 1;

export const parseS102TerrainHeightSign = (value: unknown): 1 | -1 => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 0 ? -1 : 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "-1" ||
      normalized === "-" ||
      normalized === "negative" ||
      normalized === "inverted"
    ) {
      return -1;
    }
    if (normalized.startsWith("-")) {
      return -1;
    }
  }
  return 1;
};

const clamp01 = (value: number): number => clampRange(value, 0, 1);

const clampRange = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const patchS100TerrainVertexShader = (vertexShader: string): string =>
  vertexShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec3 vS100TerrainWorldPosition;`,
    )
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
vec4 s100TerrainWorldPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
  s100TerrainWorldPosition = batchingMatrix * s100TerrainWorldPosition;
#endif
#ifdef USE_INSTANCING
  s100TerrainWorldPosition = instanceMatrix * s100TerrainWorldPosition;
#endif
vS100TerrainWorldPosition = (modelMatrix * s100TerrainWorldPosition).xyz;`,
    );

const patchS100TerrainFragmentShader = (
  fragmentShader: string,
  verticalAxis: S100TerrainShaderVerticalAxis,
): string =>
  fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec3 vS100TerrainWorldPosition;
uniform float s100TerrainSeaLevel;
uniform float s100TerrainSafetyDepthMeters;
uniform float s100TerrainHeightSign;
uniform float s100TerrainUnsafeTransparency;
uniform float s100TerrainContourInterval;
uniform float s100TerrainAmbientStrength;
uniform int s100TerrainVesselShadowCount;
uniform float s100TerrainVesselShadowIntensity;
uniform vec4 s100TerrainVesselShadowData[${S100_TERRAIN_MAX_VESSEL_SHADOWS}];
uniform vec4 s100TerrainVesselShadowOrientation[${S100_TERRAIN_MAX_VESSEL_SHADOWS}];
uniform vec4 s100TerrainVesselShadowShape[${S100_TERRAIN_MAX_VESSEL_SHADOWS}];
uniform float s100TerrainWaterLevelGridEnabled;
uniform sampler2D s100TerrainWaterLevelGridTexture;
uniform float s100TerrainWaterLevelGridWidth;
uniform float s100TerrainWaterLevelGridHeight;
uniform float s100TerrainWaterLevelGridNoDataValue;
uniform float s100TerrainWaterLevelGridOriginX;
uniform float s100TerrainWaterLevelGridOriginY;
uniform float s100TerrainWaterLevelGridLongitudinalX;
uniform float s100TerrainWaterLevelGridLongitudinalY;
uniform float s100TerrainWaterLevelGridLatitudinalX;
uniform float s100TerrainWaterLevelGridLatitudinalY;
const float S100_TERRAIN_CONTOUR_FULL_DISTANCE = 750.0;
const float S100_TERRAIN_CONTOUR_FADE_DISTANCE = 3250.0;

vec3 s100TerrainElevationColor(float elevation) {
  if (elevation > 0.0) {
    return vec3(1.0, 1.0, 1.0);
  } else if (elevation > -1.0) {
    return vec3(0.447, 0.667, 0.608);
  } else if (elevation > -5.0) {
    return vec3(0.478, 0.702, 0.976);
  } else if (elevation > -10.0) {
    return vec3(0.584, 0.776, 0.97656);
  } else if (elevation > -20.0) {
    return vec3(0.706, 0.839, 0.969);
  }
  return vec3(0.827, 0.918, 0.984);
}

float s100TerrainContourLine(float elevation, float interval) {
  if (interval <= 0.0) {
    return 0.0;
  }

  float contourCoord = elevation / interval;
  float lineDistance = abs(fract(contourCoord - 0.5) - 0.5);
  float lineWidth = max(fwidth(contourCoord), 0.00001);
  float line = 1.0 - min(lineDistance / lineWidth, 1.0);
  float viewDistance = max(length(vS100TerrainWorldPosition - cameraPosition), 1.0);
  float fade = 1.0 - smoothstep(
    S100_TERRAIN_CONTOUR_FULL_DISTANCE,
    S100_TERRAIN_CONTOUR_FADE_DISTANCE,
    viewDistance
  );
  return clamp(line * fade, 0.0, 1.0);
}

float s100TerrainSoftInside(float signedDistance, float blurMeters) {
  return smoothstep(-blurMeters, blurMeters, signedDistance);
}

float s100TerrainVesselShadow(vec2 worldPosition) {
  float shadow = 0.0;
  for (int index = 0; index < ${S100_TERRAIN_MAX_VESSEL_SHADOWS}; index++) {
    if (index >= s100TerrainVesselShadowCount) {
      break;
    }
    vec4 data = s100TerrainVesselShadowData[index];
    vec4 orientation = s100TerrainVesselShadowOrientation[index];
    vec4 shape = s100TerrainVesselShadowShape[index];
    vec2 delta = worldPosition - data.xy;
    // The stamp orientation is vessel-local to world. Terrain samples need the
    // inverse transform back into vessel-local hull coordinates.
    vec2 local = vec2(
      orientation.x * delta.x + orientation.y * delta.y,
      -orientation.y * delta.x + orientation.x * delta.y
    );
    float port = max(data.z, 0.001);
    float starboard = max(data.w, 0.001);
    float bow = max(shape.x, 0.001);
    float stern = max(shape.y, 0.001);
    float length = bow + stern;
    float beam = port + starboard;
    float bowTipLength = min(bow, max(length * 0.18, min(length, 0.75)));
    float bodyBow = bow - bowTipLength;
    float blurMeters = max(0.45, orientation.w * min(max(beam, 1.0), 18.0));

    float bodyDistance = min(
      min(local.x + port, starboard - local.x),
      min(local.y + stern, bodyBow - local.y)
    );
    float bodyShadow = s100TerrainSoftInside(bodyDistance, blurMeters);

    float bowT = clamp((bow - local.y) / max(bowTipLength, 0.001), 0.0, 1.0);
    float bowPort = port * bowT;
    float bowStarboard = starboard * bowT;
    float bowDistance = min(
      min(local.x + bowPort, bowStarboard - local.x),
      min(local.y - bodyBow, bow - local.y)
    );
    float bowShadow = s100TerrainSoftInside(bowDistance, blurMeters);

    float stamp = max(bodyShadow, bowShadow);
    shadow = max(shadow, stamp * orientation.z * s100TerrainVesselShadowIntensity);
  }
  return clamp(shadow, 0.0, 0.8);
}

float s100TerrainLocalWaterLevel(vec2 worldPosition, float fallbackSeaLevel) {
  if (s100TerrainWaterLevelGridEnabled < 0.5) {
    return fallbackSeaLevel;
  }

  vec2 longitudinal = vec2(
    s100TerrainWaterLevelGridLongitudinalX,
    s100TerrainWaterLevelGridLongitudinalY
  );
  vec2 latitudinal = vec2(
    s100TerrainWaterLevelGridLatitudinalX,
    s100TerrainWaterLevelGridLatitudinalY
  );
  float determinant =
    longitudinal.x * latitudinal.y - longitudinal.y * latitudinal.x;
  if (abs(determinant) <= 0.000001) {
    return 0.0;
  }

  vec2 delta = worldPosition - vec2(
    s100TerrainWaterLevelGridOriginX,
    s100TerrainWaterLevelGridOriginY
  );
  vec2 fractionalIndex = vec2(
    (delta.x * latitudinal.y - delta.y * latitudinal.x) / determinant,
    (longitudinal.x * delta.y - longitudinal.y * delta.x) / determinant
  );
  vec2 nearest = floor(fractionalIndex + 0.5);
  if (
    nearest.x < 0.0 ||
    nearest.y < 0.0 ||
    nearest.x > s100TerrainWaterLevelGridWidth - 1.0 ||
    nearest.y > s100TerrainWaterLevelGridHeight - 1.0
  ) {
    return 0.0;
  }

  vec2 uv = (nearest + vec2(0.5)) /
    vec2(s100TerrainWaterLevelGridWidth, s100TerrainWaterLevelGridHeight);
  float value = texture2D(s100TerrainWaterLevelGridTexture, uv).r;
  if (
    abs(value - s100TerrainWaterLevelGridNoDataValue) < 0.5 ||
    value != value
  ) {
    return 0.0;
  }
  return value;
}`,
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
float s100TerrainElevation = vS100TerrainWorldPosition.${verticalAxis} * s100TerrainHeightSign;
float s100TerrainSeaLevelAtPosition = s100TerrainLocalWaterLevel(
  vS100TerrainWorldPosition.xy,
  s100TerrainSeaLevel
);
float s100TerrainDepth = s100TerrainSeaLevelAtPosition - s100TerrainElevation;
vec3 s100TerrainColor = s100TerrainElevationColor(s100TerrainElevation);

float s100TerrainContour = s100TerrainContourLine(
  s100TerrainElevation,
  s100TerrainContourInterval
);
s100TerrainColor = mix(
  s100TerrainColor,
  vec3(0.0, 0.0, 0.0),
  s100TerrainContour
);

if (s100TerrainDepth >= 0.0 && s100TerrainDepth <= s100TerrainSafetyDepthMeters) {
  s100TerrainColor = mix(
    s100TerrainColor,
    vec3(1.0, 0.0, 0.0),
    s100TerrainUnsafeTransparency
  );
}
s100TerrainColor *= 1.0 - s100TerrainVesselShadow(vS100TerrainWorldPosition.xy);
diffuseColor.rgb = s100TerrainColor;`,
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * s100TerrainAmbientStrength;`,
    );
