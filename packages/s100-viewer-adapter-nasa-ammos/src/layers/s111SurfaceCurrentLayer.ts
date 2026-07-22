import type { S111SurfaceCurrentLayerSpec } from "@ecc/s100-viewer";
import { resolveS111Scale } from "@ecc/s100-viewer/internal/products/s111Style";
import type { S111View } from "../runtime/scene/NasaSceneRuntime.js";
import type { NasaSceneGeoreference } from "../adapter/layerNativeTypes.js";

export const applyS111Style = (
  view: S111View,
  spec: S111SurfaceCurrentLayerSpec,
): void => {
  const scale = resolveS111Scale(spec.style);
  if (typeof scale === "number") {
    view.disableAutoScaling = true;
    view.setCustomScale(scale);
  } else if (scale === "auto") {
    view.disableAutoScaling = false;
  }
};

export const getS111OriginOffset = (
  spec: S111SurfaceCurrentLayerSpec,
  georeference: NasaSceneGeoreference,
): [number, number, number] | undefined => {
  const origin = georeference.origin;
  const sceneCrs = georeference.crs;
  if (!origin || !sceneCrs) {
    return undefined;
  }

  const sourceCrs = spec.source.crs;
  if (sourceCrs !== undefined && sourceCrs.toUpperCase() !== sceneCrs.toUpperCase()) {
    return undefined;
  }

  return [-origin.x, -origin.y, -origin.z];
};
