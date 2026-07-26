import type {
  S104CatalogDataset,
  S104MetadataLike,
  S104ProjectedBounds,
  PreparedS104Dataset,
} from "./s104.js";
import {
  assessS104Metadata,
  type S104MetadataAssessment,
} from "./s104-metadata.js";
import {
  isS104ServiceRequestError,
  unwrapS104DataResponse,
  type S104DataService,
} from "./s104-service.js";

export type S104WorkflowDataset<TMetadata = unknown, TLatLonBounds = unknown> = {
  id: string;
  title?: string;
  bounds?: S104CatalogDataset["bounds"] & {
    latLon?: TLatLonBounds;
  };
  metadata?: TMetadata;
};

export type S104WorkflowProjection<TLatLonBounds = unknown> = {
  projectBounds?: (
    bounds: TLatLonBounds,
    crs: string,
    dataset: S104WorkflowDataset<unknown, TLatLonBounds>,
  ) => S104ProjectedBounds;
};

export type S104WorkflowLimits = {
  maxDataPoints?: number | string;
  metadataFetchConcurrency?: number;
  dataFetchConcurrency?: number;
};

export type S104WorkflowMessages = {
  metadataError: string;
  unsupportedDcf: string;
  tooLarge: (maxDataPoints: number) => string;
  datasetError: string;
  canceled: string;
  success?: string;
};

export type PrepareS104WorkflowOptions<
  TMetadata = unknown,
  TData = unknown,
  TLatLonBounds = unknown,
> = {
  datasets: readonly S104WorkflowDataset<TMetadata, TLatLonBounds>[];
  crs: string;
  service: S104DataService<TMetadata, TData>;
  projection?: S104WorkflowProjection<TLatLonBounds>;
  limits?: S104WorkflowLimits;
  messages?: Partial<S104WorkflowMessages>;
  signal?: AbortSignal;
  isCanceled?: () => boolean;
};

export type S104WorkflowStatus =
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

export type S104WorkflowResult<TData = unknown, TMetadata = unknown> = {
  prepared: readonly PreparedS104Dataset<TData, TMetadata>[];
  statuses: readonly S104WorkflowStatus[];
  acceptedCount: number;
  rejectedCount: number;
};

type AcceptedMetadata<TMetadata, TLatLonBounds> = {
  dataset: S104WorkflowDataset<TMetadata, TLatLonBounds>;
  assessment: Extract<S104MetadataAssessment, { status: "accepted" }>;
  metadata: TMetadata;
};

type MetadataStage<TMetadata, TLatLonBounds> =
  | {
      status: "accepted";
      accepted: AcceptedMetadata<TMetadata, TLatLonBounds>;
    }
  | {
      status: "rejected";
      workflowStatus: S104WorkflowStatus;
    };

const defaultMessages: S104WorkflowMessages = {
  metadataError: "S-104 metadata could not be loaded.",
  unsupportedDcf: "S-104 data coding format is not supported.",
  tooLarge: (maxDataPoints) =>
    `S-104 dataset exceeds the maximum of ${maxDataPoints} data points.`,
  datasetError: "S-104 dataset could not be loaded.",
  canceled: "S-104 workflow was canceled.",
};

export const prepareS104Workflow = async <
  TMetadata = unknown,
  TData = unknown,
  TLatLonBounds = unknown,
>(
  options: PrepareS104WorkflowOptions<TMetadata, TData, TLatLonBounds>,
): Promise<S104WorkflowResult<unknown, TMetadata>> => {
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
  const statusesByDataset = new Map<string, S104WorkflowStatus>();

  const metadataStages = await mapWithConcurrency(
    options.datasets,
    metadataConcurrency,
    async (dataset): Promise<MetadataStage<TMetadata, TLatLonBounds>> => {
      if (isWorkflowCanceled(options)) {
        return rejectWithStatus(canceledStatus(dataset.id, messages));
      }

      try {
        const metadata = await loadMetadata(dataset, options);
        if (isWorkflowCanceled(options)) {
          return rejectWithStatus(canceledStatus(dataset.id, messages));
        }
        const assessment = assessS104Metadata({
          datasetId: dataset.id,
          metadata: metadata as S104MetadataLike,
          ...(maxDataPoints !== undefined ? { maxDataPoints } : {}),
        });
        if (assessment.status === "rejected") {
          return rejectWithStatus(statusFromMetadataAssessment(assessment, messages, maxDataPoints));
        }
        return {
          status: "accepted",
          accepted: {
            dataset,
            assessment,
            metadata,
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

  const prepared = await mapWithConcurrency(
    acceptedMetadata,
    dataConcurrency,
    async (accepted): Promise<PreparedS104Dataset<unknown, TMetadata> | S104WorkflowStatus> => {
      const dataset = accepted.dataset;
      if (isWorkflowCanceled(options)) {
        return canceledStatus(dataset.id, messages);
      }

      try {
        const response = await options.service.fetchData(dataset.id, {
          crs: options.crs,
          ...(options.signal !== undefined ? { signal: options.signal } : {}),
        });
        if (isWorkflowCanceled(options)) {
          return canceledStatus(dataset.id, messages);
        }
        const data = options.service.unwrapData
          ? options.service.unwrapData(response, dataset.id)
          : unwrapS104DataResponse(response);
        const bounds = resolvedDatasetBounds(dataset, options);
        const preparedDataset: PreparedS104Dataset<unknown, TMetadata> = {
          datasetId: dataset.id,
          ...(dataset.title !== undefined ? { title: dataset.title } : {}),
          crs: options.crs,
          metadata: accepted.metadata,
          data,
          grid: accepted.assessment.grid,
          numberOfCells: accepted.assessment.numberOfCells,
          numberOfDataPoints: accepted.assessment.numberOfDataPoints,
          ...(accepted.assessment.verticalDatum !== undefined
            ? { verticalDatum: accepted.assessment.verticalDatum }
            : {}),
          ...(accepted.assessment.productSpecificationVersion !== undefined
            ? { productSpecificationVersion: accepted.assessment.productSpecificationVersion }
            : {}),
          ...(bounds !== undefined ? { bounds } : {}),
        };
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

  const preparedDatasets: PreparedS104Dataset<unknown, TMetadata>[] = [];
  for (const item of prepared) {
    if (isWorkflowStatus(item)) {
      statusesByDataset.set(item.datasetId, item);
    } else {
      preparedDatasets.push(item);
    }
  }

  const statuses = options.datasets
    .map((dataset) => statusesByDataset.get(dataset.id))
    .filter((status): status is S104WorkflowStatus => status !== undefined);

  return {
    prepared: preparedDatasets,
    statuses,
    acceptedCount: preparedDatasets.length,
    rejectedCount: statuses.filter((status) => status.status === "error").length,
  };
};

export const S104Workflow = {
  prepare: prepareS104Workflow,
};

const loadMetadata = async <
  TMetadata,
  TData,
  TLatLonBounds,
>(
  dataset: S104WorkflowDataset<TMetadata, TLatLonBounds>,
  options: PrepareS104WorkflowOptions<TMetadata, TData, TLatLonBounds>,
): Promise<TMetadata> => {
  if (dataset.metadata !== undefined) {
    return dataset.metadata;
  }
  return options.service.fetchMetadata(dataset.id, {
    crs: options.crs,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
};

const resolvedDatasetBounds = <
  TMetadata,
  TData,
  TLatLonBounds,
>(
  dataset: S104WorkflowDataset<TMetadata, TLatLonBounds>,
  options: PrepareS104WorkflowOptions<TMetadata, TData, TLatLonBounds>,
): S104CatalogDataset["bounds"] | undefined => {
  if (dataset.bounds?.projected !== undefined || dataset.bounds?.geographic !== undefined) {
    return {
      ...(dataset.bounds.projected !== undefined ? { projected: dataset.bounds.projected } : {}),
      ...(dataset.bounds.geographic !== undefined ? { geographic: dataset.bounds.geographic } : {}),
    };
  }
  if (
    dataset.bounds?.latLon !== undefined &&
    options.projection?.projectBounds !== undefined
  ) {
    const projected = options.projection.projectBounds(
      dataset.bounds.latLon,
      options.crs,
      dataset,
    );
    return {
      projected,
    };
  }
  return undefined;
};

const statusFromMetadataAssessment = (
  assessment: Extract<S104MetadataAssessment, { status: "rejected" }>,
  messages: S104WorkflowMessages,
  maxDataPoints: number | undefined,
): S104WorkflowStatus => {
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
  assessment: Extract<S104MetadataAssessment, { status: "rejected" }>,
  messages: S104WorkflowMessages,
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
  messages: S104WorkflowMessages,
): S104WorkflowStatus => ({
  datasetId,
  status: "success",
  ...(messages.success !== undefined ? { message: messages.success } : {}),
});

const canceledStatus = (
  datasetId: string,
  messages: S104WorkflowMessages,
): S104WorkflowStatus => ({
  datasetId,
  status: "error",
  code: "canceled",
  message: messages.canceled,
});

const errorStatus = (
  datasetId: string,
  code: Extract<S104WorkflowStatus, { status: "error" }>["code"],
  message: string,
  error: unknown,
): S104WorkflowStatus => ({
  datasetId,
  status: "error",
  code,
  message,
  cause: error,
  ...(isS104ServiceRequestError(error)
    ? { details: error.toDetails() as Record<string, unknown> }
    : {}),
});

const rejectWithStatus = <TMetadata, TLatLonBounds>(
  workflowStatus: S104WorkflowStatus,
): MetadataStage<TMetadata, TLatLonBounds> => ({
  status: "rejected",
  workflowStatus,
});

const isWorkflowStatus = (value: unknown): value is S104WorkflowStatus =>
  recordFromUnknown(value).status === "success" || recordFromUnknown(value).status === "error";

const isWorkflowCanceled = (
  options: Pick<PrepareS104WorkflowOptions, "signal" | "isCanceled">,
): boolean =>
  options.signal?.aborted === true || options.isCanceled?.() === true;

const normalizePositiveNumber = (value: unknown): number | undefined => {
  if (typeof value === "string" && value.trim().length > 0) {
    return normalizePositiveNumber(Number(value));
  }
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
};

const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  const normalized = normalizePositiveNumber(value);
  return normalized !== undefined ? Math.max(1, Math.floor(normalized)) : fallback;
};

const mapWithConcurrency = async <TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> => {
  const results: TOutput[] = new Array<TOutput>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), Math.max(1, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) {
        results[index] = await mapper(item, index);
      }
    }
  }));

  return results;
};

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
