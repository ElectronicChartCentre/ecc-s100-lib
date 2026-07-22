import type { EnvironmentState } from "@ecc/s100-viewer";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Vector3,
  type Scene,
  type Texture,
} from "three";
import type { NasaRenderContext } from "../adapter/layerNativeTypes.js";

export const applyNasaBackground = (
  renderContext: NasaRenderContext,
  state: EnvironmentState,
): void => {
  const { renderer, scene } = renderContext;
  const backgroundIntensity = normalizeOptionalPositiveNumber(state.backgroundIntensity);
  if (backgroundIntensity !== null) {
    scene.backgroundIntensity = backgroundIntensity;
  }

  if (state.background === "transparent") {
    scene.background = null;
    scene.environment = null;
    renderer.setClearColor(new Color(0x000000), 0);
    return;
  }

  if (state.background === "solid") {
    const color = new Color(0x102033);
    scene.background = color;
    scene.environment = null;
    renderer.setClearColor(color, 1);
    return;
  }

  if (state.background === "skybox") {
    renderer.setClearColor(new Color(0x102033), 1);
  }
};

export const applyNasaLighting = (
  scene: Scene,
  lighting: EnvironmentState["lighting"],
): void => {
  if (!lighting) {
    return;
  }

  const ambientIntensity = normalizeOptionalPositiveNumber(lighting.ambientIntensity);
  if (ambientIntensity !== null) {
    getOrCreateAmbientLight(scene).intensity = ambientIntensity;
  }

  const directionalIntensity = normalizeOptionalPositiveNumber(lighting.directionalIntensity);
  const sunDirection = lighting.sunDirection;
  if (directionalIntensity !== null || sunDirection !== undefined) {
    const directionalLight = getOrCreateDirectionalLight(scene);
    if (directionalIntensity !== null) {
      directionalLight.intensity = directionalIntensity;
    }
    if (sunDirection !== undefined) {
      const direction = new Vector3(sunDirection.x, sunDirection.y, sunDirection.z);
      if (direction.lengthSq() > 0) {
        directionalLight.position.copy(direction.normalize().multiplyScalar(1000));
      }
    }
  }

  const environmentIntensity = normalizeOptionalPositiveNumber(lighting.environmentIntensity);
  if (environmentIntensity !== null) {
    scene.environmentIntensity = environmentIntensity;
  }
};

export const applyNasaEnvironmentTexture = (
  renderContext: NasaRenderContext,
  backgroundTexture: Texture,
  environmentTexture: Texture,
  state: EnvironmentState,
): void => {
  renderContext.scene.background = backgroundTexture;
  renderContext.scene.environment = environmentTexture;
  renderContext.scene.backgroundIntensity = normalizePositiveNumber(
    state.backgroundIntensity,
    renderContext.scene.backgroundIntensity,
  );
  renderContext.scene.environmentIntensity = normalizePositiveNumber(
    state.lighting?.environmentIntensity,
    renderContext.scene.environmentIntensity,
  );
  renderContext.renderer.setClearColor(new Color(0x102033), 1);
};

export const isHdrEnvironmentMap = (url: string): boolean =>
  /\.hdr(?:[?#].*)?$/i.test(url);

const getOrCreateAmbientLight = (scene: Scene): AmbientLight => {
  const existing = scene.children.find((child): child is AmbientLight => child instanceof AmbientLight);
  if (existing) {
    return existing;
  }

  const light = new AmbientLight(0xffffff, 0);
  scene.add(light);
  return light;
};

const getOrCreateDirectionalLight = (scene: Scene): DirectionalLight => {
  const existing = scene.children.find((child): child is DirectionalLight => child instanceof DirectionalLight);
  if (existing) {
    return existing;
  }

  const light = new DirectionalLight(0xffffff, 0);
  light.position.set(150, -200, 300);
  scene.add(light);
  return light;
};

const normalizePositiveNumber = (value: unknown, fallback: number): number => {
  const normalized = normalizeOptionalPositiveNumber(value);
  return normalized ?? fallback;
};

const normalizeOptionalPositiveNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
};
