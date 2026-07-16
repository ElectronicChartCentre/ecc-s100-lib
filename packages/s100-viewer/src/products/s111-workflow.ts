import type { S100Layer } from "../layers/types.js";
import type { S100Scene } from "../scene/types.js";
import type { SourceMetadata } from "./sources.js";
import type { ProductTimeOptions, S111SurfaceCurrentStyle } from "./style.js";
import type { S111SurfaceCurrentLayerSpec } from "./iho-s100.js";
import {
  prepareStaticS111Dataset,
  summarizePreparedS111Datasets,
  S111WorkflowDefaults,
  type PreparedS111Dataset,
  type S111PreparedDatasetSummary,
} from "./iho-builders.js";
import {
  assessS111Metadata,
  type S111MetadataAssessment,
  type S111MetadataLike,
  type S111ProjectedBounds,
} from "./s111-metadata.js";
import {
  isS111ServiceRequestError,
  unwrapS111DataResponse,
  type S111DataService,
} from "./s111-service.js";

export type S111WorkflowDataset<TMetadata = unknown, TLatLonBounds = unknown> = {
  id: string;
  title?: string;
  bounds?: {
    projected?: S111ProjectedBounds;
    latLon?: TLatLonBounds;
  };
  metadata?: TMetadata;
};

export type S111WorkflowProjection<TLatLonBounds = unknown> = {
  projectBounds?: (
    bounds: TLatLonBounds,
    crs: string,
    dataset: S111WorkflowDataset<unknown, TLatLonBounds>,
  ) => S111ProjectedBounds;
};

export type S111WorkflowLimits = {
  maxDataPoints?: number | string;
  metadataFetchConcurrency?: number;
  dataFetchConcurrency?: number;
};

export type S111WorkflowStyleOptions = {
  renderer?: S111SurfaceCurrentStyle["renderer"];
  scale?: S111SurfaceCurrentStyle["scale"];
  scaleMultiplier?: number;
};

export type S111WorkflowSourceOptions = {
  verticalDatum?: string;
  sourceMetadata?: SourceMetadata;
};

export type S111WorkflowMessages = {
  metadataError: string;
  unsupportedDcf: string;
  tooLarge: (maxDataPoints: number) => string;
  datasetError: string;
  canceled: string;
  success?: string;
};

export type PrepareS111WorkflowOptions<
  TMetadata = unknown,
  TData = unknown,
  TLatLonBounds = unknown,
> = {
  datasets: readonly S111WorkflowDataset<TMetadata, TLatLonBounds>[];
  crs: string;
  service: S111DataService<TMetadata, TData>;
  projection?: S111WorkflowProjection<TLatLonBounds>;
  limits?: S111WorkflowLimits;
  time?: ProductTimeOptions;
  style?: S111WorkflowStyleOptions;
  source?: S111WorkflowSourceOptions;
  messages?: Partial<S111WorkflowMessages>;
  signal?: AbortSignal;
  isCanceled?: () => boolean;
};

export type S111WorkflowStatus =
  | {
      datasetId: string;
      status: "success";
      message?: string;
    }
  | {
      datasetId: string;
      status: "error";
      code:
        | "metadata-error"
        | "unsupported-dcf"
        | "too-large"
        | "dataset-error"
        | "canceled";
      message: string;
      cause?: unknown;
      details?: Record<string, unknown>;
    };

export type S111WorkflowResult<TData = unknown> = {
  prepared: readonly PreparedS111Dataset<TData>[];
  statuses: readonly S111WorkflowStatus[];
  timeline: S111PreparedDatasetSummary["timeline"];
  observedGrid: S111PreparedDatasetSummary["observedGrid"];
  initialScale: number | "auto";
  acceptedCount: number;
  rejectedCount: number;
};

type AcceptedMetadata<TMetadata, TLatLonBounds> = {
  dataset: S111WorkflowDataset<TMetadata, TLatLonBounds>;
  assessment: Extract<S111MetadataAssessment, { status: "accepted" }>;
};

type MetadataStage<TMetadata, TLatLonBounds> =
  | {
      status: "accepted";
      accepted: AcceptedMetadata<TMetadata, TLatLonBounds>;
    }
  | {
      status: "rejected";
      workflowStatus: S111WorkflowStatus;
    };

const defaultMessages: S111WorkflowMessages = {
  metadataError: "S-111 metadata could not be loaded.",
  unsupportedDcf: "S-111 data coding format is not supported.",
  tooLarge: (maxDataPoints) =>
    `S-111 dataset exceeds the maximum of ${maxDataPoints} data points.`,
  datasetError: "S-111 dataset could not be loaded.",
  canceled: "S-111 workflow was canceled.",
};

export const prepareS111Workflow = async <
  TMetadata = unknown,
  TData = unknown,
  TLatLonBounds = unknown,
>(
  options: PrepareS111WorkflowOptions<TMetadata, TData, TLatLonBounds>,
): Promise<S111WorkflowResult<unknown>> => {
  const messages = { ...defaultMessages, ...options.messages };
  const maxDataPoints = normalizePositiveNumber(options.limits?.maxDataPoints);
  const metadataConcurrency = normalizePositiveInteger(
    options.limits?.metadataFetchConcurrency,
    4,
  );
  const dataConcurrency = normalizePositiveInteger(
    options.limits?.dataFetchConcurrency,
    2,
  );
  const statusesByDataset = new Map<string, S111WorkflowStatus>();

  const metadataStages = await mapWithConcurrency(
    options.datasets,
    metadataConcurrency,
    async (dataset): Promise<MetadataStage<TMetadata, TLatLonBounds>> => {
      if (isWorkflowCanceled(options)) {
        return rejectWithStatus(canceledStatus(dataset.id, messages));
      }

      try {
        const metadata = await loadMetadata(dataset, options);
        if (metadata instanceof Error) {
          throw metadata;
        }
        if (isWorkflowCanceled(options)) {
          return rejectWithStatus(canceledStatus(dataset.id, messages));
        }
        const projectedBounds = projectDatasetBounds(dataset, options);
        const assessment = assessS111Metadata({
          datasetId: dataset.id,
          metadata: metadata as S111MetadataLike,
          ...(maxDataPoints !== undefined ? { maxDataPoints } : {}),
          ...(projectedBounds !== undefined ? { projectedBounds } : {}),
        });
        if (assessment.status === "rejected") {
          return rejectWithStatus(statusFromMetadataAssessment(assessment, messages, maxDataPoints));
        }
        return {
          status: "accepted",
          accepted: {
            dataset,
            assessment,
          },
        };
      } catch (error) {
        if (isWorkflowCanceled(options)) {
          return rejectWithStatus(canceledStatus(dataset.id, messages));
        }
        return rejectWithStatus(errorStatus(dataset.id, "metadata-error", messages.metadataError, error));
      }
    },
  );

  const acceptedMetadata: AcceptedMetadata<TMetadata, TLatLonBounds>[] = [];
  for (const stage of metadataStages) {
    if (stage.status === "accepted") {
      acceptedMetadata.push(stage.accepted);
    } else {
      statusesByDataset.set(stage.workflowStatus.datasetId, stage.workflowStatus);
    }
  }

  const metadataSummary = summarizeAcceptedMetadata(acceptedMetadata);
  const initialScale = resolveInitialScale(options.style, metadataSummary.observedGrid);
  const prepared = await mapWithConcurrency(
    acceptedMetadata,
    dataConcurrency,
    async (accepted): Promise<PreparedS111Dataset<unknown> | S111WorkflowStatus> => {
      const dataset = accepted.dataset;
      if (isWorkflowCanceled(options)) {
        return canceledStatus(dataset.id, messages);
      }

      try {
        const response = await options.service.fetchData(dataset.id, {
          crs: options.crs,
          ...(options.signal !== undefined ? { signal: options.signal } : {}),
        });
        if (response instanceof Error) {
          throw response;
        }
        if (isWorkflowCanceled(options)) {
          return canceledStatus(dataset.id, messages);
        }
        const data = options.service.unwrapData
          ? options.service.unwrapData(response, dataset.id)
          : unwrapS111DataResponse(response);
        if (data instanceof Error) {
          throw data;
        }
        const preparedDataset = prepareStaticS111Dataset({
          id: dataset.id,
          datasetId: dataset.id,
          ...(dataset.title !== undefined ? { title: dataset.title } : {}),
          data,
          crs: options.crs,
          ...(options.source?.verticalDatum !== undefined
            ? { verticalDatum: options.source.verticalDatum }
            : {}),
          ...(options.source?.sourceMetadata !== undefined
            ? { sourceMetadata: options.source.sourceMetadata }
            : {}),
          ...(options.time !== undefined ? { time: options.time } : {}),
          renderer: options.style?.renderer ?? S111WorkflowDefaults.renderer,
          scale: initialScale,
          ...(accepted.assessment.observedGridMeters !== undefined
            ? { observedGridMeters: accepted.assessment.observedGridMeters }
            : {}),
        });
        statusesByDataset.set(dataset.id, successStatus(dataset.id, messages));
        return preparedDataset;
      } catch (error) {
        if (isWorkflowCanceled(options)) {
          return canceledStatus(dataset.id, messages);
        }
        return errorStatus(dataset.id, "dataset-error", messages.datasetError, error);
      }
    },
  );

  const preparedDatasets: PreparedS111Dataset<unknown>[] = [];
  for (const item of prepared) {
    if (isWorkflowStatus(item)) {
      statusesByDataset.set(item.datasetId, item);
    } else {
      preparedDatasets.push(item);
    }
  }

  const preparedSummary = summarizePreparedS111Datasets(preparedDatasets);
  const statuses = options.datasets
    .map((dataset) => statusesByDataset.get(dataset.id))
    .filter((status): status is S111WorkflowStatus => status !== undefined);

  return {
    prepared: preparedDatasets,
    statuses,
    timeline: preparedSummary.timeline,
    observedGrid: preparedSummary.observedGrid,
    initialScale,
    acceptedCount: preparedDatasets.length,
    rejectedCount: statuses.filter((status) => status.status === "error").length,
  };
};

export const addPreparedS111WorkflowLayers = async (
  scene: S100Scene,
  prepared: readonly PreparedS111Dataset[],
  options: { scale?: number | "auto" } = {},
): Promise<readonly S100Layer<S111SurfaceCurrentLayerSpec>[]> => {
  if (prepared.length === 0) {
    return [];
  }

  const layers = await scene.layers.addMany(prepared.map((dataset) => dataset.layer));
  const scale = options.scale;
  if (scale !== undefined) {
    await Promise.all(
      layers.map((layer) =>
        scale === "auto"
          ? layer.controllers.surfaceCurrent.setAutoScaling(true)
          : layer.controllers.surfaceCurrent.setCustomScale(scale),
      ),
    );
  }
  return layers;
};

export const configureS111SceneTime = (
  scene: S100Scene,
  timeline: S111WorkflowResult["timeline"],
  options: {
    initialTime?: Date | number;
    play?: boolean;
    loop?: boolean;
    rate?: number;
  } = {},
): void => {
  if (!timeline) {
    return;
  }

  const start = new Date(timeline.startTime);
  const end = new Date(timeline.endTime);
  scene.time.setAvailability({ start, end });
  scene.time.setCurrent(resolveInitialTime(options.initialTime, timeline.initialTime, timeline.startTime));

  if (options.play === true) {
    scene.time.play({
      loop: options.loop ?? false,
      ...(options.rate !== undefined ? { rate: options.rate } : {}),
      stepMs: Math.max(1, timeline.stepSeconds * 1000),
    });
  }
};

export const S111Workflow = {
  prepare: prepareS111Workflow,
  addPreparedLayers: addPreparedS111WorkflowLayers,
  configureSceneTime: configureS111SceneTime,
};

const loadMetadata = async <
  TMetadata,
  TData,
  TLatLonBounds,
>(
  dataset: S111WorkflowDataset<TMetadata, TLatLonBounds>,
  options: PrepareS111WorkflowOptions<TMetadata, TData, TLatLonBounds>,
): Promise<TMetadata> => {
  if (dataset.metadata !== undefined) {
    return dataset.metadata;
  }
  return options.service.fetchMetadata(dataset.id, {
    crs: options.crs,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
};

const projectDatasetBounds = <
  TMetadata,
  TData,
  TLatLonBounds,
>(
  dataset: S111WorkflowDataset<TMetadata, TLatLonBounds>,
  options: PrepareS111WorkflowOptions<TMetadata, TData, TLatLonBounds>,
): S111ProjectedBounds | undefined => {
  if (dataset.bounds?.projected !== undefined) {
    return dataset.bounds.projected;
  }
  if (
    dataset.bounds?.latLon !== undefined &&
    options.projection?.projectBounds !== undefined
  ) {
    return options.projection.projectBounds(
      dataset.bounds.latLon,
      options.crs,
      dataset,
    );
  }
  return undefined;
};

const summarizeAcceptedMetadata = (
  accepted: readonly AcceptedMetadata<unknown, unknown>[],
): Pick<S111PreparedDatasetSummary, "observedGrid"> => {
  const observedGrids = accepted
    .map((item) => item.assessment.observedGridMeters)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    observedGrid: observedGrids.length > 0
      ? {
          minMeters: Math.min(...observedGrids),
          maxMeters: Math.max(...observedGrids),
        }
      : null,
  };
};

const resolveInitialScale = (
  style: S111WorkflowStyleOptions | undefined,
  observedGrid: S111PreparedDatasetSummary["observedGrid"],
): number | "auto" => {
  if (typeof style?.scale === "number" && Number.isFinite(style.scale) && style.scale > 0) {
    return style.scale;
  }
  if (observedGrid) {
    const multiplier = Math.max(0.01, normalizePositiveNumber(style?.scaleMultiplier) ?? 1);
    const scale = observedGrid.maxMeters * multiplier;
    return Number.isFinite(scale) && scale > 0 ? scale : "auto";
  }
  return "auto";
};

const statusFromMetadataAssessment = (
  assessment: Extract<S111MetadataAssessment, { status: "rejected" }>,
  messages: S111WorkflowMessages,
  maxDataPoints: number | undefined,
): S111WorkflowStatus => {
  const message = assessmentMessage(assessment, messages, maxDataPoints);
  return {
    datasetId: assessment.datasetId,
    status: "error",
    code: assessment.code,
    message,
    details: {
      ...(assessment.dataCodingFormat !== undefined
        ? { dataCodingFormat: assessment.dataCodingFormat }
        : {}),
      ...(assessment.numberOfDataPoints !== undefined
        ? { numberOfDataPoints: assessment.numberOfDataPoints }
        : {}),
    },
  };
};

const assessmentMessage = (
  assessment: Extract<S111MetadataAssessment, { status: "rejected" }>,
  messages: S111WorkflowMessages,
  maxDataPoints: number | undefined,
): string => {
  if (assessment.code === "unsupported-dcf") {
    return messages.unsupportedDcf;
  }
  if (assessment.code === "too-large") {
    return messages.tooLarge(maxDataPoints ?? assessment.numberOfDataPoints ?? 0);
  }
  return messages.metadataError;
};

const successStatus = (
  datasetId: string,
  messages: S111WorkflowMessages,
): S111WorkflowStatus => ({
  datasetId,
  status: "success",
  ...(messages.success !== undefined ? { message: messages.success } : {}),
});

const canceledStatus = (
  datasetId: string,
  messages: S111WorkflowMessages,
): S111WorkflowStatus => ({
  datasetId,
  status: "error",
  code: "canceled",
  message: messages.canceled,
});

const errorStatus = (
  datasetId: string,
  code: Extract<S111WorkflowStatus, { status: "error" }>["code"],
  message: string,
  error: unknown,
): S111WorkflowStatus => ({
  datasetId,
  status: "error",
  code,
  message,
  cause: error,
  ...(isS111ServiceRequestError(error)
    ? { details: error.toDetails() as Record<string, unknown> }
    : {}),
});

const rejectWithStatus = <TMetadata, TLatLonBounds>(
  workflowStatus: S111WorkflowStatus,
): MetadataStage<TMetadata, TLatLonBounds> => ({
  status: "rejected",
  workflowStatus,
});

const isWorkflowStatus = (value: unknown): value is S111WorkflowStatus =>
  recordFromUnknown(value).status === "success" || recordFromUnknown(value).status === "error";

const isWorkflowCanceled = (
  options: Pick<PrepareS111WorkflowOptions, "signal" | "isCanceled">,
): boolean =>
  options.signal?.aborted === true || options.isCanceled?.() === true;

const resolveInitialTime = (
  requested: Date | number | undefined,
  timelineInitial: number,
  fallback: number,
): Date => {
  const value = requested instanceof Date
    ? requested.getTime()
    : typeof requested === "number"
      ? requested
      : timelineInitial;
  return new Date(Number.isFinite(value) ? value : fallback);
};

const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  const number = normalizePositiveNumber(value);
  return number !== undefined ? Math.max(1, Math.floor(number)) : fallback;
};

const normalizePositiveNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === "string" && value.trim().length > 0
    ? Number(value)
    : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
};

const mapWithConcurrency = async <TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (item !== undefined) {
          results[index] = await mapper(item, index);
        }
      }
    }),
  );

  return results;
};

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
