import { S100DataCodingFormat } from "./data-coding.js";

export type S111MetadataInstanceAttributes = {
  numberOfTimes?: number;
  numPointsLongitudinal?: number;
  numPointsLatitudinal?: number;
  numberOfNodes?: number;
};

export type S111MetadataLike = {
  dataCodingFormat?: number | { value?: number };
  instanceAttributes?: readonly S111MetadataInstanceAttributes[];
};

export type S111ProjectedBounds = {
  north: number;
  east: number;
  south: number;
  west: number;
};

export type S111MetadataAssessmentCode =
  | "metadata-error"
  | "unsupported-dcf"
  | "too-large";

export type S111MetadataAssessment =
  | {
      status: "accepted";
      datasetId: string;
      dataCodingFormat: number;
      numberOfCells: number;
      numberOfDataPoints: number;
      observedGridMeters?: number;
    }
  | {
      status: "rejected";
      datasetId: string;
      code: S111MetadataAssessmentCode;
      message: string;
      dataCodingFormat?: number;
      numberOfDataPoints?: number;
    };

export type AssessS111MetadataOptions = {
  datasetId: string;
  metadata: S111MetadataLike | null | undefined;
  maxDataPoints?: number;
  projectedBounds?: S111ProjectedBounds;
  supportedDataCodingFormats?: readonly number[];
};

export const S111DefaultSupportedDataCodingFormats = [
  S100DataCodingFormat.RegularGrid,
  S100DataCodingFormat.UngeorectifiedGrid,
] as const;

export const assessS111Metadata = (
  options: AssessS111MetadataOptions,
): S111MetadataAssessment => {
  const dataCodingFormat = s111DataCodingFormatValue(options.metadata);
  const supportedDataCodingFormats =
    options.supportedDataCodingFormats ?? S111DefaultSupportedDataCodingFormats;
  if (dataCodingFormat === undefined) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "metadata-error",
      message: "S-111 metadata is missing a data coding format.",
    };
  }
  if (!supportedDataCodingFormats.includes(dataCodingFormat)) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "unsupported-dcf",
      message: "S-111 data coding format is not supported.",
      dataCodingFormat,
    };
  }

  const attributes = options.metadata?.instanceAttributes?.[0];
  const counts = s111MetadataCounts(dataCodingFormat, attributes);
  if (!counts) {
    return {
      status: "rejected",
      datasetId: options.datasetId,
      code: "metadata-error",
      message: "S-111 metadata is missing grid dimensions.",
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
      message: `S-111 dataset exceeds the maximum of ${options.maxDataPoints} data points.`,
      dataCodingFormat,
      numberOfDataPoints: counts.numberOfDataPoints,
    };
  }

  return {
    status: "accepted",
    datasetId: options.datasetId,
    dataCodingFormat,
    ...counts,
    ...observedGridField(options.projectedBounds, counts.numberOfCells),
  };
};

export const s111MetadataCounts = (
  dataCodingFormat: number,
  attributes: S111MetadataInstanceAttributes | undefined,
): { numberOfCells: number; numberOfDataPoints: number } | null => {
  if (!attributes) {
    return null;
  }
  const numberOfTimes = normalizePositiveInteger(attributes.numberOfTimes, 1);
  if (dataCodingFormat === S100DataCodingFormat.RegularGrid) {
    const longitudinal = positiveIntegerOrNull(attributes.numPointsLongitudinal);
    const latitudinal = positiveIntegerOrNull(attributes.numPointsLatitudinal);
    if (longitudinal === null || latitudinal === null) {
      return null;
    }
    const numberOfCells = longitudinal * latitudinal;
    return {
      numberOfCells,
      numberOfDataPoints: numberOfCells * numberOfTimes,
    };
  }
  if (dataCodingFormat === S100DataCodingFormat.UngeorectifiedGrid) {
    const numberOfNodes = positiveIntegerOrNull(attributes.numberOfNodes);
    if (numberOfNodes === null) {
      return null;
    }
    return {
      numberOfCells: numberOfNodes,
      numberOfDataPoints: numberOfNodes * numberOfTimes,
    };
  }
  return null;
};

export const s111DataCodingFormatValue = (
  metadata: S111MetadataLike | null | undefined,
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

const observedGridField = (
  bounds: S111ProjectedBounds | undefined,
  numberOfCells: number,
): { observedGridMeters: number } | {} => {
  if (!bounds || numberOfCells <= 0) {
    return {};
  }
  const width = Math.abs(bounds.east - bounds.west);
  const height = Math.abs(bounds.north - bounds.south);
  const area = width * height;
  if (!Number.isFinite(area) || area <= 0) {
    return {};
  }
  return {
    observedGridMeters: Math.sqrt(area / numberOfCells),
  };
};

const normalizePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

const positiveIntegerOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
