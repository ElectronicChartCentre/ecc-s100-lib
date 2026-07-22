import {
  clampNumber,
  finiteNumber,
  lerpNumber,
  normalizePositiveNumber,
} from "../adapter-utils/numeric.js";

export type S111ScaleStyleInput = {
  scale?: number | "auto";
  speedScale?: number | "auto";
};

export type S111SpeedRange = {
  minSpeedKnots: number;
  maxSpeedKnots: number;
};

export type S111ArrowScaleInput = S111SpeedRange & {
  speedKnots: number;
  customScaleMeters?: number;
  autoScaling?: boolean;
  gridSizeMeters?: number;
};

export const CENTIMETERS_PER_SECOND_TO_KNOTS = 0.019438444924406;
export const S111_SPEED_LEGEND_MAX_KNOTS = 99;
export const S111_ARROW_MIN_SPEED_SCALE = 0.2;
export const S111_ARROW_MAX_SPEED_SCALE = 1;
export const S111_ARROW_EXPLICIT_MAX_SPEED_SCALE = 0.65;
export const S111_ARROW_EXPLICIT_REFERENCE_SPEED_KNOTS = 10;
export const S111_ARROW_MAX_LOCAL_SPACING_FACTOR = 1;
export const DEFAULT_S111_ARROW_SCALE_METERS = 250;

export const S111_SPEED_COLOR_BANDS: readonly (readonly [number, number, number, number])[] = [
  [0.5, 0x76 / 255, 0x52 / 255, 0xe2 / 255],
  [1, 0x48 / 255, 0x98 / 255, 0xd3 / 255],
  [2, 0x61 / 255, 0xcb / 255, 0xe5 / 255],
  [3, 0x6d / 255, 0xbc / 255, 0x45 / 255],
  [5, 0xb4 / 255, 0xdc / 255, 0x00 / 255],
  [7, 0xcd / 255, 0xc1 / 255, 0x00 / 255],
  [10, 0xf8 / 255, 0xa7 / 255, 0x18 / 255],
  [13, 0xf7 / 255, 0xa2 / 255, 0x9d / 255],
  [S111_SPEED_LEGEND_MAX_KNOTS, 0xff / 255, 0x1e / 255, 0x1e / 255],
];

export const inferS111SpeedKnotsScale = (rawMaxSpeed: number): number => {
  if (!Number.isFinite(rawMaxSpeed) || rawMaxSpeed <= 0) {
    return 1;
  }
  return rawMaxSpeed > S111_SPEED_LEGEND_MAX_KNOTS
    ? CENTIMETERS_PER_SECOND_TO_KNOTS
    : 1;
};

export const resolveS111Scale = (
  style: S111ScaleStyleInput | undefined,
): number | "auto" | undefined => {
  const scale = style?.scale ?? style?.speedScale;
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0
    ? scale
    : scale === "auto"
      ? "auto"
      : undefined;
};

export const resolveS111ArrowScaleMeters = (input: S111ArrowScaleInput): number => {
  const gridScale = normalizeS111GridScaleMeters(input.gridSizeMeters);
  const customScale = normalizePositiveNumber(
    input.customScaleMeters,
    DEFAULT_S111_ARROW_SCALE_METERS,
  );

  if (input.autoScaling) {
    return gridScale * resolveS111SpeedScaleFactor(input.speedKnots, input);
  }

  if (customScale > 1) {
    return resolveS111ExplicitArrowScaleMeters(input.speedKnots, customScale);
  }

  return Math.min(customScale, gridScale) *
    resolveS111SpeedScaleFactor(input.speedKnots, input);
};

export const resolveS111ArrowLengthMeters = (
  speedKnots: number,
  customScaleMeters: unknown,
): number => {
  const scale = normalizePositiveNumber(customScaleMeters, DEFAULT_S111_ARROW_SCALE_METERS);
  const scaledLength = resolveS111ExplicitArrowScaleMeters(speedKnots, scale);
  return Math.max(30, scale * 0.12, Number.isFinite(scaledLength) ? scaledLength : 30);
};

export const resolveS111ExplicitArrowScaleMeters = (
  speedKnots: number,
  maxScaleMeters: number,
): number => {
  if (!Number.isFinite(speedKnots) || speedKnots < 0) {
    return 0;
  }
  return maxScaleMeters * resolveS111ExplicitSpeedScaleFactor(speedKnots);
};

export const resolveS111ExplicitSpeedScaleFactor = (speedKnots: number): number => {
  const normalized = clampNumber(
    speedKnots / S111_ARROW_EXPLICIT_REFERENCE_SPEED_KNOTS,
    0,
    1,
  );
  return lerpNumber(
    S111_ARROW_MIN_SPEED_SCALE,
    S111_ARROW_EXPLICIT_MAX_SPEED_SCALE,
    normalized,
  );
};

export const resolveS111SpeedScaleFactor = (
  speedKnots: number,
  range: S111SpeedRange,
): number => {
  if (!Number.isFinite(speedKnots) || speedKnots < 0) {
    return 0;
  }
  const minSpeed = finiteNumber(range.minSpeedKnots, 0);
  const maxSpeed = finiteNumber(range.maxSpeedKnots, 0);
  if (maxSpeed <= minSpeed) {
    return S111_ARROW_MAX_SPEED_SCALE;
  }
  const normalized = clampNumber(
    (speedKnots - minSpeed) / (maxSpeed - minSpeed),
    0,
    1,
  );
  return lerpNumber(S111_ARROW_MIN_SPEED_SCALE, S111_ARROW_MAX_SPEED_SCALE, normalized);
};

export const resolveS111SpeedColor = (
  speedKnots: number,
): readonly [number, number, number] => {
  const lastBand = S111_SPEED_COLOR_BANDS[S111_SPEED_COLOR_BANDS.length - 1];
  for (const band of S111_SPEED_COLOR_BANDS) {
    if (!band || speedKnots > band[0]) {
      continue;
    }
    return [band[1], band[2], band[3]];
  }
  return [
    lastBand?.[1] ?? 1,
    lastBand?.[2] ?? 1,
    lastBand?.[3] ?? 1,
  ];
};

export const normalizeS111GridScaleMeters = (gridSizeMeters: unknown): number => {
  const gridSize = finiteNumber(gridSizeMeters, 0);
  return gridSize > 0
    ? gridSize * S111_ARROW_MAX_LOCAL_SPACING_FACTOR
    : DEFAULT_S111_ARROW_SCALE_METERS;
};

