import { S100DataCodingFormat } from "./data-coding.js";
import type {
  S104MetadataLike,
  S104ProjectedBounds,
  S104RegularGridMetadata,
} from "./s104.js";

export type S104MetadataAssessmentCode =
  | "metadata-error"
  | "unsupported-dcf"
  | "unsupported-interpolation"
  | "too-large";

export type S104MetadataAssessment =
  | {
      status: "accepted";
      datasetId: string;
      dataCodingFormat: number;
      numberOfCells: number;
      numberOfDataPoints: number;
      grid: S104RegularGridMetadata;
      verticalDatum?: string;
      projectedBounds?: S104ProjectedBounds;
      productSpecificationVersion?: string;
    }
  | {
      status: "rejected";
      datasetId: string;
      code: S104MetadataAssessmentCode;
      message: string;
      dataCodingFormat?: number;
      interpolationType?: string;
      numberOfDataPoints?: number;
    };

export type AssessS104MetadataOptions = {
  datasetId: string;
  metadata: S104MetadataLike | null | undefined;
  maxDataPoints?: number;
  supportedDataCodingFormats?: readonly number[];
  supportedInterpolationTypes?: readonly string[];
};

export const S104DefaultSupportedDataCodingFormats = [
  S100DataCodingFormat.RegularGrid,
] as const;

export const S104DefaultSupportedInterpolationTypes = [
  "nearestneighbor",
  "nearest-neighbor",
  "nearest_neighbor",
  "nearest",
] as const;

export const assessS104Metadata = (
  options: AssessS104MetadataOptions,
): S104MetadataAssessment => {
  const metadata = options.metadata;
  if (!isS104MetadataProduct(metadata)) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "metadata-error",
      message: "S-104 metadata product identifier is missing or invalid.",
    };
  }

  if (
    typeof metadata?.numberOfInstances === "number" &&
    Number.isFinite(metadata.numberOfInstances) &&
    metadata.numberOfInstances < 1
  ) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "metadata-error",
      message: "S-104 metadata does not describe any WaterLevel instances.",
    };
  }

  const dataCodingFormat = s104DataCodingFormatValue(metadata);
  const supportedDataCodingFormats =
    options.supportedDataCodingFormats ?? S104DefaultSupportedDataCodingFormats;
  if (dataCodingFormat === undefined) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "metadata-error",
      message: "S-104 metadata is missing a data coding format.",
    };
  }
  if (!supportedDataCodingFormats.includes(dataCodingFormat)) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "unsupported-dcf",
      message: "S-104 data coding format is not supported.",
      dataCodingFormat,
    };
  }

  const interpolationType = s104InterpolationTypeValue(metadata);
  const supportedInterpolationTypes = options.supportedInterpolationTypes
    ?? S104DefaultSupportedInterpolationTypes;
  if (
    interpolationType !== undefined &&
    !supportedInterpolationTypes.includes(interpolationType)
  ) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "unsupported-interpolation",
      message: "S-104 interpolation type is not supported.",
      dataCodingFormat,
      interpolationType,
    };
  }

  const grid = s104RegularGridFromMetadata(metadata);
  const counts = s104MetadataCounts(dataCodingFormat, grid);
  if (!grid || !counts) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "metadata-error",
      message: "S-104 metadata is missing regular grid dimensions.",
      dataCodingFormat,
    };
  }

  const gridValidationError = validateS104RegularGridMetadata(grid);
  if (gridValidationError !== null) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "metadata-error",
      message: gridValidationError,
      dataCodingFormat,
    };
  }

  if (
    options.maxDataPoints !== undefined &&
    options.maxDataPoints > 0 &&
    counts.numberOfDataPoints > options.maxDataPoints
  ) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "too-large",
      message: `S-104 dataset exceeds the maximum of ${options.maxDataPoints} data points.`,
      dataCodingFormat,
      numberOfDataPoints: counts.numberOfDataPoints,
    };
  }

  return {
    status: "accepted",
    datasetId: options.datasetId,
    dataCodingFormat,
    grid,
    ...counts,
    ...(grid.verticalDatum !== undefined ? { verticalDatum: grid.verticalDatum } : {}),
    ...(grid.bounds?.projected !== undefined ? { projectedBounds: grid.bounds.projected } : {}),
    ...(metadata?.productSpecificationVersion !== undefined
      ? { productSpecificationVersion: metadata.productSpecificationVersion }
      : {}),
  };
};

export const s104MetadataCounts = (
  dataCodingFormat: number,
  grid: S104RegularGridMetadata | null | undefined,
): { numberOfCells: number; numberOfDataPoints: number } | null => {
  if (dataCodingFormat !== S100DataCodingFormat.RegularGrid || !grid) {
    return null;
  }
  const longitudinal = positiveIntegerOrNull(grid.numPointsLongitudinal);
  const latitudinal = positiveIntegerOrNull(grid.numPointsLatitudinal);
  if (longitudinal === null || latitudinal === null) {
    return null;
  }
  const numberOfTimes = normalizePositiveInteger(grid.numberOfTimes, 1);
  const numberOfCells = longitudinal * latitudinal;
  return {
    numberOfCells,
    numberOfDataPoints: numberOfCells * numberOfTimes,
  };
};

export const s104DataCodingFormatValue = (
  metadata: S104MetadataLike | null | undefined,
): number | undefined => {
  const value = metadata?.dataCodingFormat;
  if (typeof value === "number") {
    return value;
  }
  if (typeof value?.value === "number") {
    return value.value;
  }
  return undefined;
};

export const s104InterpolationTypeValue = (
  metadata: S104MetadataLike | null | undefined,
): string | undefined => {
  const value = metadata?.interpolationType;
  return typeof value === "string" && value.trim().length > 0
    ? normalizeToken(value)
    : undefined;
};

export const s104RegularGridFromMetadata = (
  metadata: S104MetadataLike | null | undefined,
): S104RegularGridMetadata | null => {
  const grid = metadata?.instanceAttributes?.[0];
  if (!grid) {
    return null;
  }
  return {
    ...grid,
    ...(grid.dataOffsetCode === undefined
      ? { dataOffsetCode: "lower-left" as const }
      : {}),
  };
};

export const validateS104RegularGridMetadata = (
  grid: S104RegularGridMetadata,
): string | null => {
  if (positiveIntegerOrNull(grid.numberOfTimes) === null) {
    return "S-104 metadata is missing a positive number of time records.";
  }
  if (positiveNumberOrNull(grid.timeRecordInterval) === null) {
    return "S-104 metadata is missing a positive time record interval.";
  }
  if (typeof grid.dateTimeOfFirstRecord !== "string" || grid.dateTimeOfFirstRecord.trim().length === 0) {
    return "S-104 metadata is missing the first time record.";
  }
  if (positiveIntegerOrNull(grid.numPointsLongitudinal) === null) {
    return "S-104 metadata is missing a positive longitudinal point count.";
  }
  if (positiveIntegerOrNull(grid.numPointsLatitudinal) === null) {
    return "S-104 metadata is missing a positive latitudinal point count.";
  }
  if (!isFiniteNumber(grid.origin?.x) || !isFiniteNumber(grid.origin?.y)) {
    return "S-104 metadata is missing a parseable regular-grid origin.";
  }
  if (typeof grid.origin?.crs !== "string" || grid.origin.crs.trim().length === 0) {
    return "S-104 metadata is missing a regular-grid CRS.";
  }
  if (!isFiniteVector2(grid.offsetVectors?.longitudinal)) {
    return "S-104 metadata is missing a parseable longitudinal offset vector.";
  }
  if (!isFiniteVector2(grid.offsetVectors?.latitudinal)) {
    return "S-104 metadata is missing a parseable latitudinal offset vector.";
  }
  const longitudinal = grid.offsetVectors?.longitudinal;
  const latitudinal = grid.offsetVectors?.latitudinal;
  if (longitudinal !== undefined && latitudinal !== undefined) {
    const determinant = longitudinal[0] * latitudinal[1] - longitudinal[1] * latitudinal[0];
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) {
      return "S-104 metadata regular-grid offset vectors are degenerate.";
    }
  }
  if (
    grid.dataOffsetCode !== undefined &&
    grid.dataOffsetCode !== "lower-left" &&
    grid.dataOffsetCode !== "cell-center"
  ) {
    return "S-104 metadata data offset code is not supported.";
  }
  return null;
};

const isS104MetadataProduct = (metadata: S104MetadataLike | null | undefined): boolean =>
  metadata !== null &&
  metadata !== undefined &&
  (metadata.product === undefined || metadata.product === "S-104");

const normalizePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

const positiveIntegerOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;

const positiveNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isFiniteVector2 = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  isFiniteNumber(value[0]) &&
  isFiniteNumber(value[1]);

const normalizeToken = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/gu, "");
