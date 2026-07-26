import type {
  AdapterCapabilities,
  EngineCameraPose,
  S100EngineAdapter,
} from "@ecc/s100-viewer";
import type { DemoRecipeSupport } from "./sceneRecipes";

export const formatCapabilities = (
  adapter: S100EngineAdapter | null,
  support: DemoRecipeSupport | null,
): string => {
  if (!adapter) {
    return "No adapter loaded.";
  }

  const capabilities = adapter.capabilities;
  const lines = [
    `${adapter.displayName} (${adapter.id})`,
    "",
    `Recipe support: ${support?.supported ? "supported" : "not checked"}`,
  ];

  if (support && !support.supported) {
    lines.push(...support.reasons.map((reason) => `- ${reason}`));
  }

  lines.push(
    "",
    `Scene georeferences: ${capabilities.sceneGeoreferences.join(", ")}`,
    `Layer products: ${capabilities.layerProducts.join(", ")}`,
    `Data sources: ${capabilities.dataSources.join(", ")}`,
    `Camera controls: ${capabilities.cameraControls.join(", ")}`,
    `Picking: ${formatBoolean(capabilities.picking)}`,
    `Time dynamic layers: ${formatBoolean(capabilities.timeDynamicLayers)}`,
    `Native handles: ${formatBoolean(capabilities.nativeHandles)}`,
    `Precision strategy: ${capabilities.precisionStrategy ?? "unspecified"}`,
    `Water-level field: ${capabilities.waterLevelField ?? "none"}`,
    `Water-level terrain shading: ${capabilities.waterLevelTerrainShading ?? "none"}`,
    "",
    "Visual features:",
    ...formatVisualFeatures(capabilities),
  );

  return lines.join("\n");
};

export const formatCameraPose = (pose: EngineCameraPose | null): string => {
  if (!pose) {
    return "No camera pose reported yet.";
  }

  return [
    `position: ${formatVector(pose.position)}`,
    `rotation: x=${round(pose.rotation.x)}, y=${round(pose.rotation.y)}, z=${round(pose.rotation.z)}, w=${round(pose.rotation.w)}`,
    `focalDistance: ${pose.focalDistance === undefined ? "n/a" : round(pose.focalDistance)}`,
  ].join("\n");
};

const formatVisualFeatures = (capabilities: AdapterCapabilities): string[] => {
  const visualFeatures = capabilities.visualFeatures;
  if (!visualFeatures) {
    return ["- none reported"];
  }

  return Object.entries(visualFeatures).map(([key, value]) => {
    if (value === true || value === false) {
      return `- ${key}: ${formatBoolean(value)}`;
    }

    const modes = value.modes?.length ? ` (${value.modes.join(", ")})` : "";
    const notes = value.notes ? ` - ${value.notes}` : "";
    return `- ${key}: ${formatBoolean(value.supported)}${modes}${notes}`;
  });
};

const formatVector = (vector: { x: number; y: number; z: number }): string =>
  `x=${round(vector.x)}, y=${round(vector.y)}, z=${round(vector.z)}`;

const round = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(3) : String(value);

const formatBoolean = (value: boolean): string => value ? "yes" : "no";
