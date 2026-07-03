import { S100ProductType } from "../layers/types.js";
import { S100DataCodingFormat } from "./data-coding.js";
import {
  S100ProductSpecificationVersions,
  S102Styles,
  S111Styles,
  type S102DebugOptions,
  type S102LayerSpec,
  type S102RenderingOptions,
  type S111SurfaceCurrentData,
  type S111LayerSpec,
} from "./iho-s100.js";
import type { HttpMethod, SourceMetadata, ThreeDTilesSource } from "./sources.js";
import type {
  ProductTimeOptions,
  S102BathymetryStyle,
  S111SurfaceCurrentStyle,
} from "./style.js";
import {
  commonLayerFields,
  productSpecificationVersionField,
  requestOptions,
  type LayerBuilderCommonOptions,
  type ProductSpecificationVersionOptions,
  type SourceRequestBuilderOptions,
} from "./builder-shared.js";

export type CreateS102LayerOptions = LayerBuilderCommonOptions<S102BathymetryStyle> &
  ProductSpecificationVersionOptions &
  SourceRequestBuilderOptions & {
    url: string;
    crs?: string;
    verticalDatum?: string;
    ellipsoid?: "WGS84";
    sourceFrame?: ThreeDTilesSource["sourceFrame"];
    rendering?: S102RenderingOptions;
    debug?: S102DebugOptions;
    detailFactor?: number;
  };

export type CreateS111LayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<S111SurfaceCurrentStyle> &
    ProductSpecificationVersionOptions &
    SourceRequestBuilderOptions & {
      url: string;
      crs?: string;
      verticalDatum?: string;
      method?: HttpMethod;
      body?: unknown;
      schema?: string;
      sample?: TData;
      time?: ProductTimeOptions;
    };

export type CreateStaticS111LayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<S111SurfaceCurrentStyle> &
    ProductSpecificationVersionOptions & {
      data: TData;
      crs?: string;
      verticalDatum?: string;
      sourceMetadata?: SourceMetadata;
      time?: ProductTimeOptions;
    };

export type S111Timeline = {
  startTime: number;
  endTime: number;
  stepSeconds: number;
  recordCount: number;
  times: readonly number[];
};

export type PreparedStaticS111Layer<TData = unknown> = {
  layer: S111LayerSpec;
  timeline: S111Timeline;
  data: TData;
};

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

export type PrepareStaticS111DatasetOptions<TData = unknown> =
  CreateStaticS111LayerOptions<TData> & {
    datasetId?: string;
    interpolation?: ProductTimeOptions["interpolation"];
    renderer?: S111SurfaceCurrentStyle["renderer"];
    scale?: S111SurfaceCurrentStyle["scale"];
    observedGridMeters?: number;
  };

export type PreparedS111Dataset<TData = unknown> =
  PreparedStaticS111Layer<TData> & {
    datasetId: string;
    observedGridMeters?: number;
  };

export type S111PreparedDatasetSummary = {
  timeline: {
    startTime: number;
    endTime: number;
    stepSeconds: number;
    times: readonly number[];
    initialTime: number;
  } | null;
  observedGrid: {
    minMeters: number;
    maxMeters: number;
  } | null;
};

export const S111WorkflowDefaults = {
  supportedDataCodingFormats: [
    S100DataCodingFormat.RegularGrid,
    S100DataCodingFormat.UngeorectifiedGrid,
  ],
  interpolation: "nearest",
  renderer: "arrows",
  scale: "auto",
} as const;

const mergeS102Style = (
  style: Partial<S102BathymetryStyle> | undefined,
): S102BathymetryStyle => ({
  ...S102Styles.DEFAULT,
  ...style,
  contours: {
    ...S102Styles.DEFAULT.contours,
    ...style?.contours,
  },
});

const mergeS111Style = (
  style: Partial<S111SurfaceCurrentStyle> | undefined,
): S111SurfaceCurrentStyle => ({
  ...S111Styles.DEFAULT,
  ...style,
  legend: {
    ...S111Styles.DEFAULT.legend,
    ...style?.legend,
  },
});

export const createS102 = (options: CreateS102LayerOptions): S102LayerSpec => {
  const rendering =
    options.rendering ?? (options.detailFactor !== undefined ? { detailFactor: options.detailFactor } : undefined);

  return {
    id: options.id ?? "s102-bathymetry",
    product: S100ProductType.S102,
    ...productSpecificationVersionField(options),
    ...commonLayerFields(options),
    source: {
      kind: "3d-tiles",
      url: options.url,
      ...requestOptions(options),
      ...(options.crs !== undefined ? { crs: options.crs } : {}),
      ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
      ...(options.ellipsoid !== undefined ? { ellipsoid: options.ellipsoid } : {}),
      ...(options.sourceFrame !== undefined ? { sourceFrame: options.sourceFrame } : {}),
      ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
    },
    ...(rendering !== undefined ? { rendering } : {}),
    ...(options.debug !== undefined ? { debug: options.debug } : {}),
    style: mergeS102Style(options.style),
  };
};

export const createS111 = <TData = unknown>(options: CreateS111LayerOptions<TData>): S111LayerSpec => ({
  id: options.id ?? "s111-currents",
  product: S100ProductType.S111,
  ...productSpecificationVersionField(options),
  ...commonLayerFields(options),
  source: {
    kind: "rest-json",
    url: options.url,
    ...requestOptions(options),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.method !== undefined ? { method: options.method } : {}),
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.schema !== undefined ? { schema: options.schema } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
    ...(options.sample !== undefined ? { sample: options.sample } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeS111Style(options.style),
});

export const createStaticS111 = <TData = unknown>(
  options: CreateStaticS111LayerOptions<TData>,
): S111LayerSpec => ({
  id: options.id ?? "s111-currents",
  product: S100ProductType.S111,
  ...productSpecificationVersionField(options),
  ...commonLayerFields(options),
  source: {
    kind: "static-json",
    data: options.data,
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeS111Style(options.style),
});

export const prepareStaticS111 = <TData = unknown>(
  options: CreateStaticS111LayerOptions<TData>,
): PreparedStaticS111Layer<TData> => {
  const layer = createStaticS111(options);
  return {
    layer,
    timeline: s111TimelineFromData(options.data),
    data: options.data,
  };
};

export const assessS111Metadata = (
  options: AssessS111MetadataOptions,
): S111MetadataAssessment => {
  const dataCodingFormat = s111DataCodingFormatValue(options.metadata);
  const supportedDataCodingFormats =
    options.supportedDataCodingFormats ?? S111WorkflowDefaults.supportedDataCodingFormats;
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

export const prepareStaticS111Dataset = <TData = unknown>(
  options: PrepareStaticS111DatasetOptions<TData>,
): PreparedS111Dataset<TData> => {
  const datasetId = options.datasetId ?? options.id ?? "s111-currents";
  const prepared = prepareStaticS111({
    ...options,
    id: options.id ?? datasetId,
    time: {
      interpolation: options.interpolation ?? S111WorkflowDefaults.interpolation,
      ...options.time,
    },
    style: {
      renderer: options.renderer ?? S111WorkflowDefaults.renderer,
      ...(options.scale !== undefined ? { scale: options.scale } : {}),
      ...options.style,
    },
  });
  return {
    ...prepared,
    datasetId,
    ...(options.observedGridMeters !== undefined
      ? { observedGridMeters: options.observedGridMeters }
      : {}),
  };
};

export const summarizePreparedS111Datasets = (
  datasets: readonly Pick<PreparedS111Dataset, "timeline" | "observedGridMeters">[],
): S111PreparedDatasetSummary => {
  if (datasets.length === 0) {
    return {
      timeline: null,
      observedGrid: null,
    };
  }

  const startTimes = datasets.map((dataset) => dataset.timeline.startTime);
  const endTimes = datasets.map((dataset) => dataset.timeline.endTime);
  const positiveSteps = datasets
    .map((dataset) => dataset.timeline.stepSeconds)
    .filter((step) => step > 0);
  const times = [...new Set(datasets.flatMap((dataset) => dataset.timeline.times))]
    .sort((a, b) => a - b);
  const observedGrids = datasets
    .map((dataset) => dataset.observedGridMeters)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    timeline: {
      startTime: Math.min(...startTimes),
      endTime: Math.max(...endTimes),
      stepSeconds: positiveSteps.length > 0 ? Math.min(...positiveSteps) : 1,
      times,
      initialTime: times[0] ?? Math.min(...startTimes),
    },
    observedGrid: observedGrids.length > 0
      ? {
          minMeters: Math.min(...observedGrids),
          maxMeters: Math.max(...observedGrids),
        }
      : null,
  };
};

export const S100IhoProductLayerBuilder = {
  ProductSpecificationVersions: S100ProductSpecificationVersions,
  S102Styles,
  S111Styles,
  createS102,
  createS111,
  createStaticS111,
  prepareStaticS111,
  assessS111Metadata,
  prepareStaticS111Dataset,
  summarizePreparedS111Datasets,
  S111WorkflowDefaults,
};

const s111TimelineFromData = (data: unknown): S111Timeline => {
  const dataset = recordFromUnknown(data) as S111SurfaceCurrentData;
  const startTime = parseS111Time(dataset.dateTimeOfFirstRecord) ?? 0;
  const stepSeconds = normalizePositiveInteger(dataset.timeRecordInterval, 1);
  const recordCount = s111RecordCount(dataset);
  const endTime =
    parseS111Time(dataset.dateTimeOfLastRecord) ??
    startTime + stepSeconds * 1000 * Math.max(0, recordCount - 1);
  const stepMs = stepSeconds * 1000;
  const times: number[] = [];
  for (let recordIndex = 0; recordIndex < recordCount; recordIndex++) {
    const time = startTime + stepMs * recordIndex;
    if (time <= endTime) {
      times.push(time);
    }
  }

  return {
    startTime,
    endTime,
    stepSeconds,
    recordCount,
    times,
  };
};

const s111RecordCount = (dataset: S111SurfaceCurrentData): number => {
  if (typeof dataset.numberOfTimes === "number" && dataset.numberOfTimes > 0) {
    return Math.floor(dataset.numberOfTimes);
  }
  if (Array.isArray(dataset.data)) {
    return dataset.data.length;
  }
  return 1;
};

const s111DataCodingFormatValue = (
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

const s111MetadataCounts = (
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

const parseS111Time = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!compact) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = compact;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
};

const normalizePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

const positiveIntegerOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
