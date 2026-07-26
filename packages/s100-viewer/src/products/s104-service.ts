export type S104ServiceRequestKind = "catalog" | "metadata" | "data";

export type S104ServiceRequestContext = {
  crs: string;
  signal?: AbortSignal;
};

export type S104DataService<TMetadata = unknown, TData = unknown, TCatalog = unknown> = {
  fetchCatalog?(context: Pick<S104ServiceRequestContext, "signal">): Promise<TCatalog>;
  fetchMetadata(datasetId: string, context: S104ServiceRequestContext): Promise<TMetadata>;
  fetchData(datasetId: string, context: S104ServiceRequestContext): Promise<TData>;
  unwrapData?(response: TData, datasetId: string): unknown;
};

export type S104ServiceRequestErrorDetails = {
  datasetId?: string;
  requestKind: S104ServiceRequestKind;
  status?: number;
  statusText?: string;
  url?: string;
  path?: string;
};

export class S104ServiceRequestError extends Error {
  readonly name = "S104ServiceRequestError";
  readonly datasetId?: string;
  readonly requestKind: S104ServiceRequestKind;
  readonly status?: number;
  readonly statusText?: string;
  readonly url?: string;
  readonly path?: string;

  constructor(message: string, details: S104ServiceRequestErrorDetails) {
    super(message);
    if (details.datasetId !== undefined) {
      this.datasetId = details.datasetId;
    }
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

  toDetails(): S104ServiceRequestErrorDetails {
    return {
      ...(this.datasetId !== undefined ? { datasetId: this.datasetId } : {}),
      requestKind: this.requestKind,
      ...(this.status !== undefined ? { status: this.status } : {}),
      ...(this.statusText !== undefined ? { statusText: this.statusText } : {}),
      ...(this.url !== undefined ? { url: this.url } : {}),
      ...(this.path !== undefined ? { path: this.path } : {}),
    };
  }
}

export type FixtureS104ServiceOptions = {
  endpoint: string;
  fetchHandler?: typeof fetch;
  catalogPath?: string;
  metadataPath?: string;
  dataPath?: string;
  unwrapInstances?: boolean;
  extraQuery?: Record<string, string | number | boolean>;
};

export const createFixtureS104Service = (
  options: FixtureS104ServiceOptions,
): S104DataService => {
  const fetchHandler = options.fetchHandler ?? globalThis.fetch;
  if (typeof fetchHandler !== "function") {
    throw new S104ServiceRequestError("No fetch handler is available for S-104 requests.", {
      requestKind: "catalog",
    });
  }

  const catalogPath = normalizePath(options.catalogPath ?? "s104/catalog.json");
  const metadataPath = normalizePath(options.metadataPath ?? "metadata.json");
  const dataPath = normalizePath(options.dataPath ?? "data.json");
  const unwrapInstances = options.unwrapInstances ?? false;

  const service: S104DataService = {
    fetchCatalog: async (context) => {
      const request = buildFixtureS104Url({
        endpoint: options.endpoint,
        path: catalogPath,
        requestKind: "catalog",
        ...(options.extraQuery !== undefined ? { extraQuery: options.extraQuery } : {}),
      });
      return fetchJson(fetchHandler, request, context);
    },
    fetchMetadata: async (datasetId, context) => {
      const request = buildFixtureS104Url({
        endpoint: options.endpoint,
        datasetId,
        path: metadataPath,
        requestKind: "metadata",
        crs: context.crs,
        ...(options.extraQuery !== undefined ? { extraQuery: options.extraQuery } : {}),
      });
      return fetchJson(fetchHandler, request, context);
    },
    fetchData: async (datasetId, context) => {
      const request = buildFixtureS104Url({
        endpoint: options.endpoint,
        datasetId,
        path: dataPath,
        requestKind: "data",
        crs: context.crs,
        ...(options.extraQuery !== undefined ? { extraQuery: options.extraQuery } : {}),
      });
      return fetchJson(fetchHandler, request, context);
    },
  };

  if (unwrapInstances) {
    service.unwrapData = (response, datasetId) => {
      const instances = recordFromUnknown(response).instances;
      if (Array.isArray(instances) && instances[0] !== undefined && instances[0] !== null) {
        return instances[0];
      }
      throw new S104ServiceRequestError(
        `S-104 data for '${datasetId}' has no instances.`,
        {
          datasetId,
          requestKind: "data",
        },
      );
    };
  }

  return service;
};

export const unwrapS104DataResponse = <TData>(response: TData): unknown => response;

export const isS104ServiceRequestError = (
  error: unknown,
): error is S104ServiceRequestError =>
  error instanceof S104ServiceRequestError;

type FixtureUrlOptions = {
  endpoint: string;
  requestKind: S104ServiceRequestKind;
  path: string;
  datasetId?: string;
  crs?: string;
  extraQuery?: Record<string, string | number | boolean>;
};

type FixtureRequest = {
  url: string;
  details: S104ServiceRequestErrorDetails;
};

const buildFixtureS104Url = (options: FixtureUrlOptions): FixtureRequest => {
  const relativePath = options.datasetId === undefined
    ? options.path
    : `s104/${encodeURIComponent(options.datasetId)}/${options.path}`;
  const url = buildUrl({
    endpoint: options.endpoint,
    relativePath,
    params: buildQueryParams(options),
  });

  return {
    url,
    details: {
      ...(options.datasetId !== undefined ? { datasetId: options.datasetId } : {}),
      requestKind: options.requestKind,
      url,
      path: relativePath,
    },
  };
};

const fetchJson = async (
  fetchHandler: typeof fetch,
  request: FixtureRequest,
  context: Pick<S104ServiceRequestContext, "signal">,
): Promise<unknown> => {
  let response: Awaited<ReturnType<typeof fetchHandler>>;
  try {
    response = await fetchHandler(
      request.url,
      context.signal !== undefined ? { signal: context.signal } : undefined,
    );
  } catch {
    throw new S104ServiceRequestError("S-104 request failed before receiving a response.", request.details);
  }

  if (!response.ok) {
    throw new S104ServiceRequestError(
      `S-104 request failed with HTTP ${response.status}.`,
      {
        ...request.details,
        status: response.status,
        statusText: response.statusText,
      },
    );
  }

  return response.json();
};

type UrlBuildOptions = {
  endpoint: string;
  relativePath: string;
  params: URLSearchParams;
};

const buildUrl = (options: UrlBuildOptions): string => {
  const endpoint = normalizeEndpoint(options.endpoint);
  const path = `${endpoint}/${options.relativePath}`;
  if (isAbsoluteUrl(path)) {
    const url = new URL(path);
    url.search = options.params.toString();
    return url.toString();
  }

  const query = options.params.toString();
  return `${normalizeRelativePath(path)}${query.length > 0 ? `?${query}` : ""}`;
};

const buildQueryParams = (options: FixtureUrlOptions): URLSearchParams => {
  const params = new URLSearchParams();
  if (options.crs !== undefined) {
    params.set("crs", options.crs);
  }
  for (const [key, value] of Object.entries(options.extraQuery ?? {})) {
    params.set(key, String(value));
  }
  return params;
};

const isAbsoluteUrl = (value: string): boolean =>
  /^[a-z][a-z\d+\-.]*:\/\//i.test(value);

const normalizeEndpoint = (endpoint: string): string =>
  endpoint.trim().replace(/\/+$/, "");

const normalizeRelativePath = (path: string): string =>
  `/${path.replace(/^\/+/, "")}`;

const normalizePath = (path: string): string =>
  path.replace(/^\/+/, "");

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
