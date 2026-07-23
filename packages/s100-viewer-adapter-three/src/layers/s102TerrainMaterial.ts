import type { S102BathymetryLayerSpec } from "@ecc/s100-viewer";
import { normalizeDepthMeters, resolveSafetyDepthMeters } from "@ecc/s100-viewer/internal/products/depthStyle";
import {
  assignS100TerrainShaderUniforms,
  createS100TerrainShaderUniforms,
  normalizeS100TerrainFiniteNumber,
  normalizeS100TerrainHeightSign,
  parseS102TerrainHeightSign,
  patchS100TerrainShaderSource,
  S100_TERRAIN_SHADER_CACHE_KEY,
  S100_TERRAIN_SHADER_DEFAULTS,
  type S100TerrainShaderUniforms,
} from "@ecc/s100-viewer/internal/products/s102TerrainShading";
import type { Material, Object3D } from "three";

const THREE_TERRAIN_SHADER_PATCH = Symbol("s100ThreeTerrainShaderPatch");
const DEFAULT_ROUGHNESS = 0.8;
const DEFAULT_METALNESS = 0.2;

type ThreeTerrainPatchedMaterial = Material & {
  [THREE_TERRAIN_SHADER_PATCH]?: S100TerrainShaderUniforms;
  roughness?: number;
  metalness?: number;
};

type MaterialLikeObject = Object3D & {
  material?: Material | Material[];
};

type ThreeTerrainShader = Parameters<Material["onBeforeCompile"]>[0];

export class ThreeS102TerrainMaterialController {
  private readonly uniforms = createS100TerrainShaderUniforms();
  private currentShowContour = true;
  private currentContourInterval: number = S100_TERRAIN_SHADER_DEFAULTS.contourInterval;

  applyToObject(root: Object3D): void {
    root.traverse((object) => {
      const material = (object as MaterialLikeObject).material;
      if (Array.isArray(material)) {
        for (const item of material) {
          this.applyToMaterial(item);
        }
      } else if (material) {
        this.applyToMaterial(material);
      }
    });
  }

  setSeaLevel(value: number): void {
    this.uniforms.seaLevel.value = normalizeS100TerrainFiniteNumber(
      value,
      S100_TERRAIN_SHADER_DEFAULTS.seaLevel,
    );
  }

  setSafetyDepthMeters(value: number): void {
    this.uniforms.safetyDepthMeters.value = normalizeDepthMeters(
      value,
      S100_TERRAIN_SHADER_DEFAULTS.safetyDepthMeters,
    );
  }

  setHeightSign(value: number): void {
    this.uniforms.heightSign.value = normalizeS100TerrainHeightSign(value);
  }

  setContours(visible: boolean | undefined, intervalMeters: number | undefined): void {
    if (visible !== undefined) {
      this.currentShowContour = visible;
    }
    if (intervalMeters !== undefined) {
      this.currentContourInterval = Math.max(
        0,
        normalizeS100TerrainFiniteNumber(intervalMeters, this.currentContourInterval),
      );
    }
    this.uniforms.contourInterval.value =
      this.currentShowContour ? this.currentContourInterval : 0;
  }

  private applyToMaterial(material: Material): void {
    const terrainMaterial = material as ThreeTerrainPatchedMaterial;
    if (terrainMaterial[THREE_TERRAIN_SHADER_PATCH] === this.uniforms) {
      return;
    }

    terrainMaterial[THREE_TERRAIN_SHADER_PATCH] = this.uniforms;
    if (typeof terrainMaterial.roughness === "number") {
      terrainMaterial.roughness = DEFAULT_ROUGHNESS;
    }
    if (typeof terrainMaterial.metalness === "number") {
      terrainMaterial.metalness = DEFAULT_METALNESS;
    }

    const previousOnBeforeCompile =
      terrainMaterial.onBeforeCompile.bind(terrainMaterial);
    const previousProgramCacheKey =
      terrainMaterial.customProgramCacheKey.bind(terrainMaterial);

    terrainMaterial.onBeforeCompile = (shader, renderer): void => {
      previousOnBeforeCompile(shader, renderer);
      patchThreeTerrainShader(shader, this.uniforms);
    };
    terrainMaterial.customProgramCacheKey = (): string =>
      `${previousProgramCacheKey()}|${S100_TERRAIN_SHADER_CACHE_KEY}|three-z-up`;
    terrainMaterial.needsUpdate = true;
  }
}

export const applyThreeS102TerrainStyle = (
  materialController: ThreeS102TerrainMaterialController,
  spec: S102BathymetryLayerSpec,
): void => {
  const style = spec.style;
  materialController.setSafetyDepthMeters(resolveSafetyDepthMeters(style));
  materialController.setHeightSign(
    parseS102TerrainHeightSign(spec.source.metadata?.values?.heightSign),
  );

  if (typeof style?.seaLevel === "number") {
    materialController.setSeaLevel(style.seaLevel);
  }
  materialController.setContours(
    style?.contours?.visible,
    style?.contours?.intervalMeters,
  );
};

const patchThreeTerrainShader = (
  shader: ThreeTerrainShader,
  uniforms: S100TerrainShaderUniforms,
): void => {
  assignS100TerrainShaderUniforms(shader.uniforms, uniforms);
  const patched = patchS100TerrainShaderSource(shader, { verticalAxis: "z" });
  shader.vertexShader = patched.vertexShader;
  shader.fragmentShader = patched.fragmentShader;
};
