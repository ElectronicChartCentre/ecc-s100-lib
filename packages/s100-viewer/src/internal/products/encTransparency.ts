import {
  normalizeOpacity,
  resolveRasterAlphaOptions,
  type RasterAlphaOptions,
} from "../adapter-utils/opacity.js";

export type EncTransparencyStyleInput = {
  visible?: boolean;
  opacity?: number;
  alphaMode?: unknown;
  alphaCutoff?: unknown;
};

export type EncTransparencyLayerInput = {
  role?: string;
  visible?: boolean;
  opacity?: number;
  style?: EncTransparencyStyleInput;
};

export const resolveLayerOpacity = (
  layer: EncTransparencyLayerInput,
  fallback = 1,
): number => normalizeOpacity(layer.opacity ?? layer.style?.opacity, fallback);

export const resolveLayerVisible = (
  layer: EncTransparencyLayerInput,
  fallback = true,
): boolean => layer.visible ?? layer.style?.visible ?? fallback;

export const resolveEncRasterAlphaOptions = (
  style: EncTransparencyStyleInput | undefined,
): RasterAlphaOptions => resolveRasterAlphaOptions(style);

export const shouldRenderTransparentRaster = (
  layer: EncTransparencyLayerInput,
  sourceRequestsTransparency: boolean,
): boolean =>
  resolveLayerOpacity(layer) < 1 ||
  layer.role === "overlay" ||
  sourceRequestsTransparency;

