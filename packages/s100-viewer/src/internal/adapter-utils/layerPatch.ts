import type { BaseLayerSpec, LayerPatch } from "../../layers/types.js";

export const mergeLayerSpecPatch = <TSpec extends BaseLayerSpec>(
  spec: TSpec,
  patch: LayerPatch,
): TSpec => ({
  ...spec,
  ...patch,
}) as TSpec;

export const isLayerDisplayPatch = (
  patch: LayerPatch,
  keys: readonly string[] = ["opacity", "visible"],
): boolean => {
  const allowed = new Set(keys);
  const patchKeys = Object.keys(patch as Record<string, unknown>);
  return patchKeys.length > 0 && patchKeys.every((key) => allowed.has(key));
};

