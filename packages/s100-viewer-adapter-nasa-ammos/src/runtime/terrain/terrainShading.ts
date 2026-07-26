import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  NearestFilter,
  RedFormat,
  type Material,
  type Object3D,
} from "three";
import { normalizeDepthMeters } from "@ecc/s100-viewer/internal/products/depthStyle";
import {
  assignS100TerrainShaderUniforms,
  createS100TerrainShaderUniforms,
  normalizeS100TerrainFiniteNumber,
  normalizeS100TerrainHeightSign,
  patchS100TerrainShaderSource,
  S100_TERRAIN_SHADER_CACHE_KEY,
  S100_TERRAIN_SHADER_DEFAULTS,
  updateS100TerrainWaterLevelGridUniforms,
  updateS100TerrainVesselShadowUniforms,
  type S100TerrainWaterLevelGridUniformState,
  type S100TerrainVesselShadowStamp,
  type S100TerrainShaderUniforms,
} from "@ecc/s100-viewer/internal/products/s102TerrainShading";

type TerrainUniforms = S100TerrainShaderUniforms;

const TERRAIN_SHADER_PATCH = Symbol("s100TerrainShaderPatch");
const DEFAULT_ROUGHNESS = 0.8;
const DEFAULT_METALNESS = 0.2;

type TerrainPatchedMaterial = Material & {
  [TERRAIN_SHADER_PATCH]?: TerrainUniforms;
  roughness?: number;
  metalness?: number;
};

type MaterialLikeObject = Object3D & {
  material?: Material | Material[];
};

type TerrainShader = Parameters<Material["onBeforeCompile"]>[0];

export class TerrainMaterialController {
  private readonly uniforms: TerrainUniforms = createS100TerrainShaderUniforms();
  private readonly emptyWaterLevelTexture = createEmptyWaterLevelTexture();
  private waterLevelTexture: DataTexture | null = null;

  constructor() {
    this.uniforms.waterLevelGridTexture.value = this.emptyWaterLevelTexture;
  }

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
    this.uniforms.seaLevel.value = normalizeS100TerrainFiniteNumber(value, 0);
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

  setContourInterval(value: number): void {
    this.uniforms.contourInterval.value = Math.max(
      0,
      normalizeS100TerrainFiniteNumber(value, 0),
    );
  }

  setVesselShadows(stamps: readonly S100TerrainVesselShadowStamp[]): void {
    updateS100TerrainVesselShadowUniforms(this.uniforms, stamps);
  }

  setWaterLevelGrid(grid: S100TerrainWaterLevelGridUniformState | null): void {
    if (this.waterLevelTexture && this.waterLevelTexture !== grid?.texture) {
      this.waterLevelTexture.dispose();
    }
    this.waterLevelTexture = grid?.texture instanceof DataTexture
      ? grid.texture
      : null;
    updateS100TerrainWaterLevelGridUniforms(this.uniforms, grid);
    if (!grid) {
      this.uniforms.waterLevelGridTexture.value = this.emptyWaterLevelTexture;
    }
  }

  dispose(): void {
    this.waterLevelTexture?.dispose();
    this.waterLevelTexture = null;
    this.emptyWaterLevelTexture.dispose();
  }

  private applyToMaterial(material: Material): void {
    const terrainMaterial = material as TerrainPatchedMaterial;
    if (terrainMaterial[TERRAIN_SHADER_PATCH] === this.uniforms) {
      return;
    }

    terrainMaterial[TERRAIN_SHADER_PATCH] = this.uniforms;
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
      patchTerrainShader(shader, this.uniforms);
    };
    terrainMaterial.customProgramCacheKey = (): string =>
      `${previousProgramCacheKey()}|${S100_TERRAIN_SHADER_CACHE_KEY}`;
    terrainMaterial.needsUpdate = true;
  }
}

const createEmptyWaterLevelTexture = (): DataTexture => {
  const texture = new DataTexture(
    new Float32Array([0]),
    1,
    1,
    RedFormat,
    FloatType,
  );
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
};

export class TerrainDisplayPropertyAdapter {
  private currentSafetyDepthMeters = 10;
  private currentHeightSign = 1;
  private currentSeaLevel = 0;
  private currentShowContour = true;
  private currentContourInterval = 2.5;

  constructor(private readonly materialController: TerrainMaterialController) {
    this.syncMaterialController();
  }

  get safetyDepthMeters(): number {
    return this.currentSafetyDepthMeters;
  }

  set safetyDepthMeters(value: number) {
    this.currentSafetyDepthMeters = normalizeDepthMeters(
      value,
      S100_TERRAIN_SHADER_DEFAULTS.safetyDepthMeters,
    );
    this.materialController.setSafetyDepthMeters(this.currentSafetyDepthMeters);
  }

  get unsafeDepth(): number {
    return this.currentSafetyDepthMeters;
  }

  set unsafeDepth(value: number) {
    this.safetyDepthMeters = value;
  }

  get heightSign(): number {
    return this.currentHeightSign;
  }

  set heightSign(value: number) {
    this.currentHeightSign = normalizeS100TerrainHeightSign(value);
    this.materialController.setHeightSign(this.currentHeightSign);
  }

  get seaContour(): boolean {
    return this.currentShowContour;
  }

  set seaContour(value: boolean) {
    this.showContour = value;
  }

  get seaLevel(): number {
    return this.currentSeaLevel;
  }

  set seaLevel(value: number) {
    this.currentSeaLevel = normalizeS100TerrainFiniteNumber(value, 0);
    this.materialController.setSeaLevel(this.currentSeaLevel);
  }

  get showContour(): boolean {
    return this.currentShowContour;
  }

  set showContour(value: boolean) {
    this.currentShowContour = Boolean(value);
    this.syncContourInterval();
  }

  get contourInterval(): number {
    return this.currentContourInterval;
  }

  set contourInterval(value: number) {
    this.currentContourInterval = Math.max(
      0,
      normalizeS100TerrainFiniteNumber(value, 0),
    );
    this.syncContourInterval();
  }

  private syncMaterialController(): void {
    this.materialController.setSafetyDepthMeters(this.currentSafetyDepthMeters);
    this.materialController.setHeightSign(this.currentHeightSign);
    this.materialController.setSeaLevel(this.currentSeaLevel);
    this.syncContourInterval();
  }

  private syncContourInterval(): void {
    this.materialController.setContourInterval(
      this.currentShowContour ? this.currentContourInterval : 0,
    );
  }
}

function patchTerrainShader(shader: TerrainShader, uniforms: TerrainUniforms): void {
  assignS100TerrainShaderUniforms(shader.uniforms, uniforms);
  const patched = patchS100TerrainShaderSource(shader, { verticalAxis: "z" });
  shader.vertexShader = patched.vertexShader;
  shader.fragmentShader = patched.fragmentShader;
}
