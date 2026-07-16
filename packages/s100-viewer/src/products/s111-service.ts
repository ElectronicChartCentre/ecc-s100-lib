export type S111ServiceRequestKind = "metadata" | "data";

export type S111ServiceRequestContext = {
  crs: string;
  signal?: AbortSignal;
};

export type S111DataService<TMetadata = unknown, TData = unknown> = {
  fetchMetadata(
    datasetId: string,
    context: S111ServiceRequestContext,
  ): Promise<TMetadata>;
  fetchData(
    datasetId: string,
    context: S111ServiceRequestContext,
  ): Promise<TData>;
  unwrapData?(response: TData, datasetId: string): unknown;
};

export type S111ServiceRequestErrorDetails = {
  datasetId: string;
  requestKind: S111ServiceRequestKind;
  status?: number;
  statusText?: string;
  url?: string;
  path?: string;
};

export class S111ServiceRequestError extends Error {
  readonly name = "S111ServiceRequestError";
  readonly datasetId: string;
  readonly requestKind: S111ServiceRequestKind;
  readonly status?: number;
  readonly statusText?: string;
  readonly url?: string;
  readonly path?: string;

  constructor(message: string, details: S111ServiceRequestErrorDetails) {
    super(message);
    this.datasetId = details.datasetId;
    this.requestKind = details.requestKind;
    if (details.status !== undefined) {
      this.status = details.status;
    }
    if (details.statusText !== undefined) {
      this.statusText = details.statusText;
    }
    if (details.url !== undefined) {
      this.url = details.url;
    }
    if (details.path !== undefined) {
      this.path = details.path;
    }
  }

  toDetails(): S111ServiceRequestErrorDetails {
    return {
      datasetId: this.datasetId,
      requestKind: this.requestKind,
      ...(this.status !== undefined ? { status: this.status } : {}),
      ...(this.statusText !== undefined ? { statusText: this.statusText } : {}),
      ...(this.url !== undefined ? { url: this.url } : {}),
      ...(this.path !== undefined ? { path: this.path } : {}),
    };
  }
}

export const unwrapS111DataResponse = <TData>(
  response: TData,
): unknown => {
  const record = recordFromUnknown(response);
  const instances = record.instances;
  if (Array.isArray(instances) && instances[0] !== undefined && instances[0] !== null) {
    return instances[0];
  }
  return response;
};

export const isS111ServiceRequestError = (
  error: unknown,
): error is S111ServiceRequestError =>
  error instanceof S111ServiceRequestError;

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
