export type S100TerrainShaderUniform = {
  value: number;
};

export type S100TerrainShaderUniforms = {
  seaLevel: S100TerrainShaderUniform;
  safetyDepthMeters: S100TerrainShaderUniform;
  heightSign: S100TerrainShaderUniform;
  unsafeTransparency: S100TerrainShaderUniform;
  contourInterval: S100TerrainShaderUniform;
  ambientStrength: S100TerrainShaderUniform;
};

export type S100TerrainShaderVerticalAxis = "x" | "y" | "z";

export type S100TerrainShaderSource = {
  vertexShader: string;
  fragmentShader: string;
};

export type S100TerrainShaderPatchOptions = {
  verticalAxis?: S100TerrainShaderVerticalAxis;
};

export const S100_TERRAIN_SHADER_CACHE_KEY = "s100-terrain-v3";

export const S100_TERRAIN_SHADER_DEFAULTS = {
  seaLevel: 0,
  safetyDepthMeters: 10,
  heightSign: 1,
  unsafeTransparency: 0.6,
  contourInterval: 2.5,
  ambientStrength: 0.06,
} as const;

export const createS100TerrainShaderUniforms = (): S100TerrainShaderUniforms => ({
  seaLevel: { value: S100_TERRAIN_SHADER_DEFAULTS.seaLevel },
  safetyDepthMeters: { value: S100_TERRAIN_SHADER_DEFAULTS.safetyDepthMeters },
  heightSign: { value: S100_TERRAIN_SHADER_DEFAULTS.heightSign },
  unsafeTransparency: { value: S100_TERRAIN_SHADER_DEFAULTS.unsafeTransparency },
  contourInterval: { value: S100_TERRAIN_SHADER_DEFAULTS.contourInterval },
  ambientStrength: { value: S100_TERRAIN_SHADER_DEFAULTS.ambientStrength },
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
}`,
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
float s100TerrainElevation = vS100TerrainWorldPosition.${verticalAxis} * s100TerrainHeightSign;
float s100TerrainDepth = s100TerrainSeaLevel - s100TerrainElevation;
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
diffuseColor.rgb = s100TerrainColor;`,
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * s100TerrainAmbientStrength;`,
    );
