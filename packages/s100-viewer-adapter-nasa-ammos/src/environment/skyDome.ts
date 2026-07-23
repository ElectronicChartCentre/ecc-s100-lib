import {
  BackSide,
  MathUtils,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
} from "three";

export const Z_UP_BACKGROUND_ROTATION_X = Math.PI / 2;
export const Z_UP_BACKGROUND_ROTATION_Y = 0;
export const Z_UP_BACKGROUND_ROTATION_Z = -MathUtils.degToRad(75);
export const Z_UP_ENVIRONMENT_ROTATION_X = Z_UP_BACKGROUND_ROTATION_X;
export const Z_UP_ENVIRONMENT_ROTATION_Y = Z_UP_BACKGROUND_ROTATION_Y;
export const Z_UP_ENVIRONMENT_ROTATION_Z = Z_UP_BACKGROUND_ROTATION_Z;

const SKYDOME_RADIUS_METERS = 50_000;
const SKYDOME_VERTEX_SHADER = `
varying vec3 vWorldDirection;

void main() {
  vWorldDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKYDOME_FRAGMENT_SHADER = `
uniform sampler2D skyMap;
uniform float intensity;
uniform float azimuthRotation;

varying vec3 vWorldDirection;

const float RECIPROCAL_PI = 0.3183098861837907;
const float RECIPROCAL_PI2 = 0.15915494309189535;

void main() {
  vec3 worldDirection = normalize(vWorldDirection);
  float c = cos(azimuthRotation);
  float s = sin(azimuthRotation);
  vec2 horizontalDirection = vec2(
    c * worldDirection.x - s * worldDirection.y,
    s * worldDirection.x + c * worldDirection.y
  );
  vec3 textureDirection = normalize(vec3(
    horizontalDirection.x,
    worldDirection.z,
    -horizontalDirection.y
  ));
  vec2 sampleUV = vec2(
    atan(textureDirection.z, textureDirection.x) * RECIPROCAL_PI2 + 0.5,
    asin(clamp(textureDirection.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5
  );
  vec4 texColor = texture2D(skyMap, sampleUV);
  gl_FragColor = vec4(texColor.rgb * intensity, texColor.a);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export type NasaSkyDomeOptions = {
  backgroundIntensity?: unknown;
  backgroundRotationZ?: unknown;
};

export const createNasaZUpSkyDome = (
  texture: Texture,
  options: NasaSkyDomeOptions = {},
): Mesh => {
  const geometry = new SphereGeometry(SKYDOME_RADIUS_METERS, 64, 32);
  const material = new ShaderMaterial({
    name: "S100ZUpSkyDomeMaterial",
    uniforms: {
      skyMap: { value: texture },
      intensity: {
        value: normalizePositiveNumber(options.backgroundIntensity, 1),
      },
      azimuthRotation: {
        value: normalizeFiniteNumber(
          options.backgroundRotationZ,
          Z_UP_BACKGROUND_ROTATION_Z,
        ),
      },
    },
    vertexShader: SKYDOME_VERTEX_SHADER,
    fragmentShader: SKYDOME_FRAGMENT_SHADER,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });

  const skyDome = new Mesh(geometry, material);
  skyDome.name = "s100-environment-skydome";
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -10_000;
  return skyDome;
};

export const disposeNasaSkyDome = (skyDome: Mesh | null | undefined): void => {
  if (!skyDome) {
    return;
  }

  skyDome.removeFromParent();
  skyDome.geometry.dispose();
  const material = skyDome.material;
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
  } else {
    material.dispose();
  }
};

const normalizePositiveNumber = (value: unknown, fallback: number): number => {
  const normalized = normalizeFiniteNumber(value, fallback);
  return normalized >= 0 ? normalized : fallback;
};

const normalizeFiniteNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
