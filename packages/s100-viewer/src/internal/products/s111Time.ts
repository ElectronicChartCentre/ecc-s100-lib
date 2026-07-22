import { clampNumber, normalizePositiveInteger } from "../adapter-utils/numeric.js";

export type S111TimeDatasetLike = {
  timeRecordInterval?: unknown;
  dateTimeOfFirstRecord?: unknown;
  dateTimeOfLastRecord?: unknown;
  numberOfTimes?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

export const DEFAULT_S111_INTERVAL_SECONDS = 1;

export const parseS111Time = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.includes("T")
    ? value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u, "$1-$2-$3T$4:$5:$6Z")
    : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getS111RecordCount = (dataset: S111TimeDatasetLike | undefined): number => {
  if (typeof dataset?.numberOfTimes === "number" && dataset.numberOfTimes > 0) {
    return Math.floor(dataset.numberOfTimes);
  }
  if (Array.isArray(dataset?.data)) {
    return dataset.data.length;
  }
  const candidateArrays = ["positions", "records", "samples", "values"];
  for (const key of candidateArrays) {
    const value = dataset?.[key];
    if (Array.isArray(value) && value.length > 0) {
      return value.length;
    }
  }
  return 1;
};

export const resolveS111IntervalSeconds = (value: unknown): number =>
  normalizePositiveInteger(value, DEFAULT_S111_INTERVAL_SECONDS);

export const resolveS111TimeRange = (
  dataset: S111TimeDatasetLike | undefined,
): { startTime: number; endTime: number; intervalSeconds: number; recordCount: number } => {
  const startTime = parseS111Time(dataset?.dateTimeOfFirstRecord) ?? 0;
  const intervalSeconds = resolveS111IntervalSeconds(dataset?.timeRecordInterval);
  const recordCount = getS111RecordCount(dataset);
  const endTime =
    parseS111Time(dataset?.dateTimeOfLastRecord) ??
    startTime + intervalSeconds * 1000 * Math.max(0, recordCount - 1);
  return { startTime, endTime, intervalSeconds, recordCount };
};

export const getS111RecordIndexForTime = (
  recordCount: number,
  startTime: number,
  intervalSeconds: number,
  currentTimeMs: number,
): number => {
  if (recordCount <= 1) {
    return 0;
  }
  const intervalMs = Math.max(1, intervalSeconds * 1000);
  return Math.floor(
    clampNumber(
      Math.round((currentTimeMs - startTime) / intervalMs),
      0,
      recordCount - 1,
    ),
  );
};

export const getNearestS111TimedRecord = (
  records: readonly unknown[],
  time: Date,
): Record<string, unknown> | null => {
  let best: { record: Record<string, unknown>; delta: number } | null = null;
  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }
    const recordObject = record as Record<string, unknown>;
    const recordTime = parseS111Time(
      recordObject.time ??
        recordObject.dateTime ??
        recordObject.timestamp ??
        recordObject.Timestamp ??
        recordObject.FromTime,
    );
    if (recordTime === null) {
      continue;
    }
    const delta = Math.abs(time.getTime() - recordTime);
    if (!best || delta < best.delta) {
      best = { record: recordObject, delta };
    }
  }
  return best?.record ?? null;
};

