import { type EnvironmentState } from "@ecc/s100-viewer";
import { getObject } from "../cesium/object.js";

export type CesiumSkyboxFaces = {
  positiveX: string;
  negativeX: string;
  positiveY: string;
  negativeY: string;
  positiveZ: string;
  negativeZ: string;
};

export function resolveCesiumSkyboxSources(state: EnvironmentState): CesiumSkyboxFaces | null {
  const explicitFaces = normalizeCesiumSkyboxFaces(state.skyboxFaces ?? getObject(state.metadata, "skyboxFaces"));
  if (explicitFaces) {
    return explicitFaces;
  }

  const template = getStringMetadata(state, "skyboxUrlTemplate");
  if (template) {
    return createSkyboxFacesFromTemplate(template);
  }

  return null;
}

export function getCesiumEquirectangularSkyboxUrl(state: EnvironmentState): string | null {
  const url = state.skyboxUrl;
  if (!url || state.skyboxFaces || isHdrEnvironmentMap(url) || isKtx2EnvironmentMap(url)) {
    return null;
  }
  return url;
}

export function getStringMetadata(state: EnvironmentState, key: string): string | undefined {
  const value = state.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getNumberMetadata(state: EnvironmentState, key: string, fallback: number): number {
  const value = state.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function isKtx2EnvironmentMap(url: string): boolean {
  return /\.ktx2(?:[?#].*)?$/i.test(url);
}

function normalizeCesiumSkyboxFaces(value: unknown): CesiumSkyboxFaces | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const faces = {
    positiveX: record.positiveX,
    negativeX: record.negativeX,
    positiveY: record.positiveY,
    negativeY: record.negativeY,
    positiveZ: record.positiveZ,
    negativeZ: record.negativeZ,
  };
  if (Object.values(faces).every((face) => typeof face === "string" && face.length > 0)) {
    return faces as CesiumSkyboxFaces;
  }
  return null;
}

function createSkyboxFacesFromTemplate(template: string): CesiumSkyboxFaces {
  const replaceFace = (face: string) =>
    template
      .replaceAll("{face}", face)
      .replaceAll("{FACE}", face.toUpperCase());
  return {
    positiveX: replaceFace("positiveX"),
    negativeX: replaceFace("negativeX"),
    positiveY: replaceFace("positiveY"),
    negativeY: replaceFace("negativeY"),
    positiveZ: replaceFace("positiveZ"),
    negativeZ: replaceFace("negativeZ"),
  };
}

function isHdrEnvironmentMap(url: string): boolean {
  return /\.hdr(?:[?#].*)?$/i.test(url);
}
