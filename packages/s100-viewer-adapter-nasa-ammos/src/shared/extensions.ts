import type { BaseLayerSpec } from "@ecc/s100-viewer";

export const getNasaAmmosExtension = <T>(
  spec: BaseLayerSpec,
  key: string,
): T | undefined => {
  const extension = spec.extensions?.nasaAmmos;
  if (!extension || typeof extension !== "object") {
    return undefined;
  }
  return (extension as Record<string, unknown>)[key] as T | undefined;
};

export const getNumberExtension = (
  spec: BaseLayerSpec,
  key: string,
  fallback: number,
): number => {
  const value = getNasaAmmosExtension<unknown>(spec, key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

export const getBooleanExtension = (
  spec: BaseLayerSpec,
  key: string,
  fallback: boolean,
): boolean => {
  const value = getNasaAmmosExtension<unknown>(spec, key);
  return typeof value === "boolean" ? value : fallback;
};
