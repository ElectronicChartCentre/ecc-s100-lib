import type { Coordinate, ProjectedCoordinate } from "../../coordinates/types.js";

export type ProductTimeInput = Date | number | string;

export type ProductTimeline = {
  startTime: number;
  endTime: number;
  intervalSeconds: number;
  numberOfTimes: number;
  times: readonly number[];
};

export type BuildUniformTimelineOptions = {
  startTime: ProductTimeInput;
  intervalSeconds: number;
  numberOfTimes: number;
  endTime?: ProductTimeInput;
};

export type TimeRecordTieBreaker = "earlier" | "later";

export type NearestTimeRecordOptions = {
  clamp?: boolean;
  tieBreaker?: TimeRecordTieBreaker;
};

export type RegularGridDataOffsetCode = "lower-left" | "cell-center";

export type RegularGridGeometry = {
  crs: string;
  origin: {
    x: number;
    y: number;
    z?: number;
  };
  offsetVectors: {
    longitudinal: readonly [number, number];
    latitudinal: readonly [number, number];
  };
  numPointsLongitudinal: number;
  numPointsLatitudinal: number;
  dataOffsetCode?: RegularGridDataOffsetCode;
};

export type FractionalGridIndex = {
  i: number;
  j: number;
};

export type RegularGridIndex = {
  i: number;
  j: number;
};

export type NearestRegularGridPoint = {
  index: RegularGridIndex;
  fractionalIndex: FractionalGridIndex;
  linearIndex: number;
  coordinate: ProjectedCoordinate;
};

const COMPACT_UTC_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u;
const HALF_TIE_EPSILON = 1e-12;

export const parseProductTime = (value: unknown): number | null => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalized = trimmed.includes("T")
    ? trimmed.replace(COMPACT_UTC_TIME_PATTERN, "$1-$2-$3T$4:$5:$6Z")
    : trimmed;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildUniformTimeline = (
  options: BuildUniformTimelineOptions,
): ProductTimeline | null => {
  const startTime = parseProductTime(options.startTime);
  const intervalSeconds = normalizePositiveNumber(options.intervalSeconds);
  const numberOfTimes = normalizePositiveInteger(options.numberOfTimes);
  if (startTime === null || intervalSeconds === null || numberOfTimes === null) {
    return null;
  }

  const intervalMs = intervalSeconds * 1000;
  const times = Array.from({ length: numberOfTimes }, (_value, index) =>
    startTime + intervalMs * index,
  );
  const lastTime = times[numberOfTimes - 1];
  if (lastTime === undefined) {
    return null;
  }

  const parsedEndTime = options.endTime !== undefined
    ? parseProductTime(options.endTime)
    : null;
  const endTime = parsedEndTime ?? lastTime;

  return {
    startTime,
    endTime,
    intervalSeconds,
    numberOfTimes,
    times,
  };
};

export const getNearestTimeRecordIndex = (
  timeline: ProductTimeline,
  time: ProductTimeInput,
  options: NearestTimeRecordOptions = {},
): number | null => {
  const timeMs = parseProductTime(time);
  if (timeMs === null || timeline.numberOfTimes <= 0 || timeline.times.length === 0) {
    return null;
  }

  const firstTime = timeline.times[0];
  const lastTime = timeline.times[timeline.times.length - 1];
  if (firstTime === undefined || lastTime === undefined) {
    return null;
  }

  const shouldClamp = options.clamp ?? false;
  if (!shouldClamp && (timeMs < firstTime || timeMs > lastTime)) {
    return null;
  }

  const intervalMs = Math.max(1, timeline.intervalSeconds * 1000);
  const rawIndex = (timeMs - timeline.startTime) / intervalMs;
  const lower = Math.floor(rawIndex);
  const upper = Math.ceil(rawIndex);
  const lowerDelta = Math.abs(rawIndex - lower);
  const upperDelta = Math.abs(upper - rawIndex);
  const tieBreaker = options.tieBreaker ?? "earlier";
  const rounded =
    Math.abs(lowerDelta - upperDelta) <= HALF_TIE_EPSILON
      ? (tieBreaker === "later" ? upper : lower)
      : (lowerDelta < upperDelta ? lower : upper);

  return clampInteger(rounded, 0, timeline.numberOfTimes - 1);
};

export const projectRegularGridIndex = (
  grid: RegularGridGeometry,
  coordinate: Coordinate,
): FractionalGridIndex | null => {
  if (coordinate.kind !== "projected" || coordinate.crs !== grid.crs) {
    return null;
  }

  const sampleOrigin = regularGridSampleOrigin(grid);
  const dx = coordinate.x - sampleOrigin.x;
  const dy = coordinate.y - sampleOrigin.y;
  const longitudinal = grid.offsetVectors.longitudinal;
  const latitudinal = grid.offsetVectors.latitudinal;
  const determinant = longitudinal[0] * latitudinal[1] - longitudinal[1] * latitudinal[0];
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) {
    return null;
  }

  return {
    i: (dx * latitudinal[1] - dy * latitudinal[0]) / determinant,
    j: (longitudinal[0] * dy - longitudinal[1] * dx) / determinant,
  };
};

export const isFractionalGridIndexInside = (
  grid: RegularGridGeometry,
  index: FractionalGridIndex,
): boolean =>
  Number.isFinite(index.i) &&
  Number.isFinite(index.j) &&
  index.i >= 0 &&
  index.j >= 0 &&
  index.i <= grid.numPointsLongitudinal - 1 &&
  index.j <= grid.numPointsLatitudinal - 1;

export const nearestRegularGridPoint = (
  grid: RegularGridGeometry,
  coordinate: Coordinate,
): NearestRegularGridPoint | null => {
  const fractionalIndex = projectRegularGridIndex(grid, coordinate);
  if (fractionalIndex === null || !isFractionalGridIndexInside(grid, fractionalIndex)) {
    return null;
  }

  const i = clampInteger(
    roundNearestHalfDown(fractionalIndex.i),
    0,
    grid.numPointsLongitudinal - 1,
  );
  const j = clampInteger(
    roundNearestHalfDown(fractionalIndex.j),
    0,
    grid.numPointsLatitudinal - 1,
  );
  const linearIndex = linearIndexFromGridIndex({ i, j }, grid.numPointsLongitudinal);
  if (linearIndex === null) {
    return null;
  }

  return {
    index: { i, j },
    fractionalIndex,
    linearIndex,
    coordinate: regularGridPointCoordinate(grid, { i, j }),
  };
};

export const regularGridPointCoordinate = (
  grid: RegularGridGeometry,
  index: RegularGridIndex,
): ProjectedCoordinate => {
  const sampleOrigin = regularGridSampleOrigin(grid);
  const longitudinal = grid.offsetVectors.longitudinal;
  const latitudinal = grid.offsetVectors.latitudinal;
  const coordinate: ProjectedCoordinate = {
    kind: "projected",
    crs: grid.crs,
    x: sampleOrigin.x + longitudinal[0] * index.i + latitudinal[0] * index.j,
    y: sampleOrigin.y + longitudinal[1] * index.i + latitudinal[1] * index.j,
  };
  if (sampleOrigin.z !== undefined) {
    coordinate.z = sampleOrigin.z;
  }
  return coordinate;
};

export const linearIndexFromGridIndex = (
  index: RegularGridIndex,
  columns: number,
): number | null => {
  const normalizedColumns = normalizePositiveInteger(columns);
  if (
    normalizedColumns === null ||
    !Number.isInteger(index.i) ||
    !Number.isInteger(index.j) ||
    index.i < 0 ||
    index.j < 0
  ) {
    return null;
  }
  return index.j * normalizedColumns + index.i;
};

export const isFillValue = (
  value: unknown,
  fillValue: unknown,
  epsilon = 1e-9,
): boolean => {
  if (typeof value === "number" && typeof fillValue === "number") {
    if (!Number.isFinite(value) || !Number.isFinite(fillValue)) {
      return Object.is(value, fillValue);
    }
    return Math.abs(value - fillValue) <= Math.max(0, epsilon);
  }
  return Object.is(value, fillValue);
};

const regularGridSampleOrigin = (
  grid: RegularGridGeometry,
): { x: number; y: number; z?: number } => {
  const origin = { ...grid.origin };
  if (grid.dataOffsetCode === "cell-center") {
    origin.x += (grid.offsetVectors.longitudinal[0] + grid.offsetVectors.latitudinal[0]) / 2;
    origin.y += (grid.offsetVectors.longitudinal[1] + grid.offsetVectors.latitudinal[1]) / 2;
  }
  return origin;
};

const roundNearestHalfDown = (value: number): number => {
  const lower = Math.floor(value);
  const upper = Math.ceil(value);
  const lowerDelta = Math.abs(value - lower);
  const upperDelta = Math.abs(upper - value);
  if (Math.abs(lowerDelta - upperDelta) <= HALF_TIE_EPSILON) {
    return lower;
  }
  return lowerDelta < upperDelta ? lower : upper;
};

const clampInteger = (value: number, min: number, max: number): number =>
  Math.floor(Math.min(Math.max(value, min), max));

const normalizePositiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

const normalizePositiveInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
