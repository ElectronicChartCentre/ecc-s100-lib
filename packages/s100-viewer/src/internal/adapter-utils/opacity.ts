import { clamp01 } from "./numeric.js";

export type RasterAlphaMode = "source" | "binary";

export type RasterAlphaOptions = {
  mode: RasterAlphaMode;
  cutoff: number;
};

export const DEFAULT_BINARY_ALPHA_CUTOFF = 0.01;

export const normalizeOpacity = (value: unknown, fallback = 1): number =>
  clamp01(value, fallback);

export const normalizeRasterAlphaMode = (
  value: unknown,
  fallback: RasterAlphaMode = "source",
): RasterAlphaMode =>
  value === "binary" || value === "source" ? value : fallback;

export const normalizeRasterAlphaCutoff = (
  value: unknown,
  fallback = DEFAULT_BINARY_ALPHA_CUTOFF,
): number =>
  clamp01(value, fallback);

export const resolveRasterAlphaOptions = (
  style: { alphaMode?: unknown; alphaCutoff?: unknown } | undefined,
  fallbackMode: RasterAlphaMode = "source",
): RasterAlphaOptions => {
  const mode = normalizeRasterAlphaMode(style?.alphaMode, fallbackMode);
  return {
    mode,
    cutoff: mode === "binary"
      ? normalizeRasterAlphaCutoff(style?.alphaCutoff)
      : 0,
  };
};

