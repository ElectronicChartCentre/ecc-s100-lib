export const resolveWaterLevel = (data: unknown, time: Date): number | null => {
  if (typeof data === "number" && Number.isFinite(data)) {
    return data;
  }
  if (!data || typeof data !== "object") {
    return null;
  }

  const direct = getNumericProperty(data, ["waterLevelMeters", "seaLevel", "value", "height"]);
  if (direct !== null) {
    return direct;
  }

  const records = getRecordArray(data);
  if (!records) {
    return null;
  }

  let best: { value: number; delta: number } | null = null;
  const target = time.getTime();
  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }
    const value = getNumericProperty(record, ["waterLevelMeters", "seaLevel", "value", "height"]);
    if (value === null) {
      continue;
    }
    const recordTime = getRecordTime(record);
    const delta = recordTime === null ? 0 : Math.abs(recordTime - target);
    if (!best || delta < best.delta) {
      best = { value, delta };
    }
  }

  return best?.value ?? null;
};

const getRecordArray = (data: object): unknown[] | null => {
  for (const key of ["records", "values", "timeSeries", "features"]) {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
};

const getNumericProperty = (data: object, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

const getRecordTime = (data: object): number | null => {
  for (const key of ["time", "dateTime", "timestamp", "datetime"]) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};
