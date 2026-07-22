import type { Material, Object3D } from "three";
import { normalizeDepthMeters } from "@ecc/s100-viewer/internal/products/depthStyle";

type TerrainUniforms = {
  seaLevel: { value: number };
  safetyDepthMeters: { value: number };
  heightSign: { value: number };
  unsafeTransparency: { value: number };
  contourInterval: { value: number };
  ambientStrength: { value: number };
};

const TERRAIN_SHADER_PATCH = Symbol("s100TerrainShaderPatch");
const DEFAULT_UNSAFE_TRANSPARENCY = 0.6;
const DEFAULT_AMBIENT_STRENGTH = 0.06;
const DEFAULT_ROUGHNESS = 0.8;
const DEFAULT_METALNESS = 0.2;
const TERRAIN_SHADER_CACHE_KEY = "s100-terrain-v2";

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
  private readonly uniforms: TerrainUniforms = {
    seaLevel: { value: 0 },
    safetyDepthMeters: { value: 10 },
    heightSign: { value: 1 },
    unsafeTransparency: { value: DEFAULT_UNSAFE_TRANSPARENCY },
    contourInterval: { value: 2.5 },
    ambientStrength: { value: DEFAULT_AMBIENT_STRENGTH },
  };

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
    this.uniforms.seaLevel.value = normalizeFiniteNumber(value, 0);
  }

  setSafetyDepthMeters(value: number): void {
    this.uniforms.safetyDepthMeters.value = normalizeDepthMeters(value, 10);
  }

  setHeightSign(value: number): void {
    this.uniforms.heightSign.value = normalizeHeightSign(value);
  }

  setContourInterval(value: number): void {
    this.uniforms.contourInterval.value = Math.max(
      0,
      normalizeFiniteNumber(value, 0),
    );
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
      `${previousProgramCacheKey()}|${TERRAIN_SHADER_CACHE_KEY}`;
    terrainMaterial.needsUpdate = true;
  }
}

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
    this.currentSafetyDepthMeters = normalizeDepthMeters(value, 10);
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
    this.currentHeightSign = normalizeHeightSign(value);
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
    this.currentSeaLevel = normalizeFiniteNumber(value, 0);
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
    this.currentContourInterval = Math.max(0, normalizeFiniteNumber(value, 0));
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
  shader.uniforms.s100TerrainSeaLevel = uniforms.seaLevel;
  shader.uniforms.s100TerrainSafetyDepthMeters = uniforms.safetyDepthMeters;
  shader.uniforms.s100TerrainHeightSign = uniforms.heightSign;
  shader.uniforms.s100TerrainUnsafeTransparency = uniforms.unsafeTransparency;
  shader.uniforms.s100TerrainContourInterval = uniforms.contourInterval;
  shader.uniforms.s100TerrainAmbientStrength = uniforms.ambientStrength;

  shader.vertexShader = shader.vertexShader
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

  shader.fragmentShader = shader.fragmentShader
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
float s100TerrainElevation = vS100TerrainWorldPosition.z * s100TerrainHeightSign;
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
}

function normalizeFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeHeightSign(value: number): number {
  return Number.isFinite(value) && value < 0 ? -1 : 1;
}
