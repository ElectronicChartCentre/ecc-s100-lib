export const normalizePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

export const finiteNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));

export const normalizeDegrees = (value: number): number => {
  const finite = Number.isFinite(value) ? value : 0;
  return ((finite % 360) + 360) % 360;
};

export const getNumberFromExtensions = (
  extensions: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number => {
  for (const namespace of ["nasaAmmos", "cogs", "cesium"]) {
    const value = recordFromUnknown(extensions?.[namespace])[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
};

export const getBooleanFromExtensions = (
  extensions: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean => {
  for (const namespace of ["nasaAmmos", "cogs", "cesium"]) {
    const value = recordFromUnknown(extensions?.[namespace])[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return fallback;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};
