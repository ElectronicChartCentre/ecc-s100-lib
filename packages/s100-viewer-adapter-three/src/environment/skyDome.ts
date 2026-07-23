import * as THREE from "three";

const SKYDOME_RADIUS_METERS = 50_000;
const DEFAULT_BACKGROUND_INTENSITY = 1;
const DEFAULT_AZIMUTH_ROTATION = -THREE.MathUtils.degToRad(75);

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

export type ThreeZUpSkyDomeOptions = {
  backgroundIntensity?: number;
  azimuthRotation?: number;
};

export const createThreeZUpSkyDome = (
  texture: THREE.Texture,
  options: ThreeZUpSkyDomeOptions = {},
): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> => {
  const geometry = new THREE.SphereGeometry(SKYDOME_RADIUS_METERS, 64, 32);
  const material = new THREE.ShaderMaterial({
    name: "S100ThreeZUpSkyDomeMaterial",
    uniforms: {
      skyMap: { value: texture },
      intensity: {
        value: normalizePositiveNumber(
          options.backgroundIntensity,
          DEFAULT_BACKGROUND_INTENSITY,
        ),
      },
      azimuthRotation: {
        value: normalizeFiniteNumber(
          options.azimuthRotation,
          DEFAULT_AZIMUTH_ROTATION,
        ),
      },
    },
    vertexShader: SKYDOME_VERTEX_SHADER,
    fragmentShader: SKYDOME_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(geometry, material);
  skyDome.name = "three-s100-environment-skydome";
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -10_000;
  skyDome.userData.s100Unpickable = true;
  skyDome.onBeforeRender = (_renderer, _scene, camera) => {
    skyDome.position.copy(camera.position);
  };
  return skyDome;
};

export const disposeThreeSkyDome = (
  skyDome: THREE.Mesh | null | undefined,
): void => {
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

const normalizePositiveNumber = (
  value: number | undefined,
  fallback: number,
): number => {
  const normalized = normalizeFiniteNumber(value, fallback);
  return normalized >= 0 ? normalized : fallback;
};

const normalizeFiniteNumber = (
  value: number | undefined,
  fallback: number,
): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
