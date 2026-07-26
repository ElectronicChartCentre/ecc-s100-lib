import type {
  BaseLayerSpec,
  SimulatedWaterLevelLayerSpec,
  WaterLevelFieldSource,
} from "@ecc/s100-viewer";
import type { ThreeLayerNative } from "./types.js";

export const createSimulatedWaterLevelLayer = (
  spec: BaseLayerSpec,
  getSeaLevel: () => number,
  setSeaLevel: (value: number, source?: WaterLevelFieldSource) => void,
): ThreeLayerNative<SimulatedWaterLevelLayerSpec> => {
  const layerSpec = spec as SimulatedWaterLevelLayerSpec;
  return {
    spec: layerSpec,
    root: null,
    update: (time) => {
      const seaLevel = resolveWaterLevel(layerSpec, time);
      if (seaLevel !== null && seaLevel !== getSeaLevel()) {
        setSeaLevel(seaLevel, "simulated-water-level");
      }
    },
    dispose: () => {},
  };
};

const resolveWaterLevel = (
  spec: SimulatedWaterLevelLayerSpec,
  time: Date,
): number | null => {
  const source = spec.source;
  if (source.kind !== "static-json") {
    return null;
  }
  const data = source.data;
  if (!data || typeof data !== "object") {
    return null;
  }
  const values = "values" in data && Array.isArray(data.values) ? data.values : null;
  if (!values || values.length === 0) {
    return null;
  }
  const timeMs = time.getTime();
  let best: { seaLevelMeters: number; distance: number } | null = null;
  for (const item of values) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const seaLevelMeters = record.seaLevelMeters;
    if (typeof seaLevelMeters !== "number" || !Number.isFinite(seaLevelMeters)) {
      continue;
    }
    const recordTime = typeof record.time === "string" ? Date.parse(record.time) : NaN;
    const distance = Number.isFinite(recordTime) ? Math.abs(recordTime - timeMs) : 0;
    if (!best || distance < best.distance) {
      best = { seaLevelMeters, distance };
    }
  }
  return best?.seaLevelMeters ?? null;
};
