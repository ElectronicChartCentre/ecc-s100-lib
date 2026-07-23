export type S100OceanSurfaceUniforms = {
  s100WaterTime: { value: number };
  s100WaterBumpScale: { value: number };
  s100WaterWaveSpeed: { value: number };
};

export type S100OceanSurfaceShader = {
  uniforms: Record<string, unknown>;
  vertexShader: string;
  fragmentShader: string;
};

export const S100_OCEAN_SURFACE_SHADER_CACHE_KEY = "s100-ocean-surface";

export const S100_OCEAN_SURFACE_SHADER_DEFAULTS = {
  bumpScale: 1.25,
  waveSpeed: 0.27,
} as const;

export const createS100OceanSurfaceUniforms = (
  options: Partial<{ bumpScale: number; waveSpeed: number }> = {},
): S100OceanSurfaceUniforms => ({
  s100WaterTime: { value: 0 },
  s100WaterBumpScale: {
    value: finitePositiveNumber(
      options.bumpScale,
      S100_OCEAN_SURFACE_SHADER_DEFAULTS.bumpScale,
    ),
  },
  s100WaterWaveSpeed: {
    value: finitePositiveNumber(
      options.waveSpeed,
      S100_OCEAN_SURFACE_SHADER_DEFAULTS.waveSpeed,
    ),
  },
});

export const assignS100OceanSurfaceShaderUniforms = (
  target: Record<string, unknown>,
  uniforms: S100OceanSurfaceUniforms,
): void => {
  target.s100WaterTime = uniforms.s100WaterTime;
  target.s100WaterBumpScale = uniforms.s100WaterBumpScale;
  target.s100WaterWaveSpeed = uniforms.s100WaterWaveSpeed;
};

export const patchS100OceanSurfaceShader = (
  shader: S100OceanSurfaceShader,
  uniforms: S100OceanSurfaceUniforms,
): void => {
  assignS100OceanSurfaceShaderUniforms(shader.uniforms, uniforms);
  const patched = patchS100OceanSurfaceShaderSource(shader);
  shader.vertexShader = patched.vertexShader;
  shader.fragmentShader = patched.fragmentShader;
};

export const patchS100OceanSurfaceShaderSource = (
  source: Pick<S100OceanSurfaceShader, "vertexShader" | "fragmentShader">,
): Pick<S100OceanSurfaceShader, "vertexShader" | "fragmentShader"> => ({
  vertexShader: source.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec2 vS100WaterLocalPosition;
varying vec3 vS100WaterViewTangentX;
varying vec3 vS100WaterViewTangentY;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vS100WaterLocalPosition = position.xy;
vS100WaterViewTangentX = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
vS100WaterViewTangentY = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`,
    ),
  fragmentShader: source.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
uniform float s100WaterTime;
uniform float s100WaterBumpScale;
uniform float s100WaterWaveSpeed;
varying vec2 vS100WaterLocalPosition;
varying vec3 vS100WaterViewTangentX;
varying vec3 vS100WaterViewTangentY;

float s100WaterHash(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 s100WaterGradient(vec2 cell) {
  float angle = s100WaterHash(cell) * 6.28318530718;
  return vec2(cos(angle), sin(angle));
}

float s100WaterPerlin(vec2 position) {
  vec2 cell = floor(position);
  vec2 local = fract(position);
  vec2 blend = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);
  float a = dot(s100WaterGradient(cell + vec2(0.0, 0.0)), local - vec2(0.0, 0.0));
  float b = dot(s100WaterGradient(cell + vec2(1.0, 0.0)), local - vec2(1.0, 0.0));
  float c = dot(s100WaterGradient(cell + vec2(0.0, 1.0)), local - vec2(0.0, 1.0));
  float d = dot(s100WaterGradient(cell + vec2(1.0, 1.0)), local - vec2(1.0, 1.0));
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

float s100WaterWaveHeight(vec2 localPosition) {
  float time = s100WaterTime * s100WaterWaveSpeed;
  vec2 p = localPosition * 0.035;
  float wave =
    s100WaterPerlin(p + vec2(time * 0.74, time * 0.31)) * 0.50 +
    s100WaterPerlin(p * 2.1 + vec2(-time * 0.42, time * 0.67)) * 0.26 +
    s100WaterPerlin(p * 4.4 + vec2(time * 0.18, -time * 0.52)) * 0.16 +
    s100WaterPerlin(p * 9.2 + vec2(-time * 0.64, -time * 0.23)) * 0.08;
  vec2 midDetailPosition = localPosition / 1.20;
  float midDetailRipple =
    s100WaterPerlin(midDetailPosition + vec2(-time * 0.96, time * 0.83)) * 0.02275;
  vec2 microPosition = localPosition / 0.30;
  float microRipple =
    s100WaterPerlin(microPosition + vec2(time * 1.43, -time * 1.17)) * 0.01225;
  return wave + midDetailRipple + microRipple;
}

vec2 s100WaterWaveGradient(vec2 localPosition) {
  float sampleDistance = 0.0375;
  float left = s100WaterWaveHeight(localPosition - vec2(sampleDistance, 0.0));
  float right = s100WaterWaveHeight(localPosition + vec2(sampleDistance, 0.0));
  float down = s100WaterWaveHeight(localPosition - vec2(0.0, sampleDistance));
  float up = s100WaterWaveHeight(localPosition + vec2(0.0, sampleDistance));
  return vec2(right - left, up - down) / (sampleDistance * 2.0);
}

vec3 s100WaterSurfaceColor(float waveHeight, float slope) {
  float waveBand = smoothstep(-0.20, 0.28, waveHeight);
  vec3 deepWater = vec3(0.015, 0.144, 0.30);
  vec3 blueWater = vec3(0.015, 0.344, 0.62);
  vec3 crestWater = vec3(0.34, 0.78, 0.92);
  vec3 baseWater = mix(deepWater, blueWater, waveBand);
  return mix(baseWater, crestWater, clamp(slope * 0.95, 0.0, 0.58));
}`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
vec2 s100WaterGradientValue = s100WaterWaveGradient(vS100WaterLocalPosition);
float s100WaterWaveValue = s100WaterWaveHeight(vS100WaterLocalPosition);
float s100WaterSlopeValue = clamp(length(s100WaterGradientValue) * 10.0, 0.0, 1.0);
float s100WaterFaceDirection = gl_FrontFacing ? 1.0 : -1.0;
vec3 s100WaterPerturbation =
  (-vS100WaterViewTangentX * s100WaterGradientValue.x -
   vS100WaterViewTangentY * s100WaterGradientValue.y) *
  s100WaterBumpScale *
  s100WaterFaceDirection;
normal = normalize(normal + s100WaterPerturbation);
nonPerturbedNormal = normal;`,
    )
    .replace(
      "#include <output_fragment>",
      `float s100WaterTopsideBlend = gl_FrontFacing ? 0.62 : 0.30;
float s100WaterCrest = smoothstep(0.10, 0.26, s100WaterWaveValue);
vec3 s100WaterColor = s100WaterSurfaceColor(
  s100WaterWaveValue,
  s100WaterSlopeValue
);
outgoingLight = mix(outgoingLight, s100WaterColor, s100WaterTopsideBlend);
outgoingLight += vec3(0.18, 0.50, 0.62) *
  s100WaterCrest *
  (gl_FrontFacing ? 0.10 : 0.06);
diffuseColor.a = clamp(diffuseColor.a + s100WaterSlopeValue * 0.08, 0.0, 0.76);
#include <output_fragment>`,
    ),
});

export const updateS100OceanSurfaceTime = (
  uniforms: S100OceanSurfaceUniforms,
  startTimeSeconds: number,
  nowSeconds = getS100OceanSurfaceTimeSeconds(),
): void => {
  uniforms.s100WaterTime.value = Math.max(
    0,
    finiteNumber(nowSeconds, 0) - finiteNumber(startTimeSeconds, nowSeconds),
  );
};

export const getS100OceanSurfaceTimeSeconds = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now() / 1000;
  }
  return Date.now() / 1000;
};

const finitePositiveNumber = (
  value: number | undefined,
  fallback: number,
): number => {
  const normalized = finiteNumber(value, fallback);
  return normalized > 0 ? normalized : fallback;
};

const finiteNumber = (
  value: number | undefined,
  fallback: number,
): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;
