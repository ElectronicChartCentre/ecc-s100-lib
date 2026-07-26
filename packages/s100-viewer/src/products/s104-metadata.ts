import { S100DataCodingFormat } from "./data-coding.js";
import type {
  S104MetadataLike,
  S104ProjectedBounds,
  S104RegularGridMetadata,
} from "./s104.js";

export type S104MetadataAssessmentCode =
  | "metadata-error"
  | "unsupported-dcf"
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
      numberOfDataPoints?: number;
    };

export type AssessS104MetadataOptions = {
  datasetId: string;
  metadata: S104MetadataLike | null | undefined;
  maxDataPoints?: number;
  supportedDataCodingFormats?: readonly number[];
};

export const S104DefaultSupportedDataCodingFormats = [
  S100DataCodingFormat.RegularGrid,
] as const;

export const assessS104Metadata = (
  options: AssessS104MetadataOptions,
): S104MetadataAssessment => {
  const dataCodingFormat = s104DataCodingFormatValue(options.metadata);
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

  const grid = s104RegularGridFromMetadata(options.metadata);
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
    ...(options.metadata?.productSpecificationVersion !== undefined
      ? { productSpecificationVersion: options.metadata.productSpecificationVersion }
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

export const s104RegularGridFromMetadata = (
  metadata: S104MetadataLike | null | undefined,
): S104RegularGridMetadata | null =>
  metadata?.instanceAttributes?.[0] ?? null;

const normalizePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

const positiveIntegerOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
