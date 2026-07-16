import {
  S111ServiceRequestError,
  type S111DataService,
  type S111ServiceRequestContext,
  type S111ServiceRequestKind,
} from "./s111-service.js";

export type PrimarS111ServiceOptions = {
  endpoint: string;
  licenseeKey: string;
  fetchHandler?: typeof fetch;
  metadataPath?: string;
  dataPath?: string;
  unwrapInstances?: boolean;
  requireMetadataInstances?: boolean;
  extraQuery?: Record<string, string | number | boolean>;
};

export const createPrimarS111Service = (
  options: PrimarS111ServiceOptions,
): S111DataService => {
  const fetchHandler = options.fetchHandler ?? globalThis.fetch;
  if (typeof fetchHandler !== "function") {
    throw new S111ServiceRequestError("No fetch handler is available for S-111 requests.", {
      datasetId: "",
      requestKind: "metadata",
    });
  }

  const metadataPath = normalizePath(options.metadataPath ?? "metadata.json");
  const dataPath = normalizePath(options.dataPath ?? "data.json");
  const requireMetadataInstances = options.requireMetadataInstances ?? true;
  const unwrapInstances = options.unwrapInstances ?? true;

  const service: S111DataService = {
    fetchMetadata: async (datasetId, context) => {
      const request = buildPrimarS111Url({
        endpoint: options.endpoint,
        datasetId,
        path: metadataPath,
        requestKind: "metadata",
        licenseeKey: options.licenseeKey,
        ...(options.extraQuery !== undefined ? { extraQuery: options.extraQuery } : {}),
      });
      const metadata = await fetchJson(fetchHandler, request, context);
      if (requireMetadataInstances && hasNoMetadataInstances(metadata)) {
        throw new S111ServiceRequestError(
          `S-111 metadata for '${datasetId}' has no instances.`,
          request.details,
        );
      }
      return metadata;
    },
    fetchData: async (datasetId, context) => {
      const request = buildPrimarS111Url({
        endpoint: options.endpoint,
        datasetId,
        path: dataPath,
        requestKind: "data",
        licenseeKey: options.licenseeKey,
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
      throw new S111ServiceRequestError(
        `S-111 data for '${datasetId}' has no instances.`,
        {
          datasetId,
          requestKind: "data",
        },
      );
    };
  }

  return service;
};

type PrimarUrlOptions = {
  endpoint: string;
  datasetId: string;
  path: string;
  requestKind: S111ServiceRequestKind;
  licenseeKey: string;
  crs?: string;
  extraQuery?: Record<string, string | number | boolean>;
};

type PrimarRequest = {
  url: string;
  details: {
    datasetId: string;
    requestKind: S111ServiceRequestKind;
    url: string;
    path: string;
  };
};

const buildPrimarS111Url = (options: PrimarUrlOptions): PrimarRequest => {
  const endpoint = normalizeEndpoint(options.endpoint);
  const encodedDatasetId = encodeURIComponent(options.datasetId);
  const relativePath = `${encodedDatasetId}/${options.path}`;
  const url = new URL(`${endpoint}/${relativePath}`);
  url.searchParams.set("licenseeKey", options.licenseeKey);
  if (options.crs !== undefined) {
    url.searchParams.set("crs", options.crs);
  }
  for (const [key, value] of Object.entries(options.extraQuery ?? {})) {
    url.searchParams.set(key, String(value));
  }

  return {
    url: url.toString(),
    details: {
      datasetId: options.datasetId,
      requestKind: options.requestKind,
      url: sanitizeCredentialUrl(url),
      path: relativePath,
    },
  };
};

const fetchJson = async (
  fetchHandler: typeof fetch,
  request: PrimarRequest,
  context: S111ServiceRequestContext,
): Promise<unknown> => {
  let response: Awaited<ReturnType<typeof fetchHandler>>;
  try {
    response = await fetchHandler(
      request.url,
      context.signal !== undefined ? { signal: context.signal } : undefined,
    );
  } catch {
    throw new S111ServiceRequestError("S-111 request failed before receiving a response.", request.details);
  }

  if (!response.ok) {
    throw new S111ServiceRequestError(
      `S-111 request failed with HTTP ${response.status}.`,
      {
        ...request.details,
        status: response.status,
        statusText: response.statusText,
      },
    );
  }

  return response.json();
};

const hasNoMetadataInstances = (metadata: unknown): boolean => {
  const numberOfInstances = recordFromUnknown(metadata).numberOfInstances;
  return typeof numberOfInstances === "number" && numberOfInstances <= 0;
};

const normalizeEndpoint = (endpoint: string): string =>
  endpoint.replace(/\/+$/, "");

const normalizePath = (path: string): string =>
  path.replace(/^\/+/, "");

const sanitizeCredentialUrl = (url: URL): string => {
  const sanitized = new URL(url);
  if (sanitized.searchParams.has("licenseeKey")) {
    sanitized.searchParams.set("licenseeKey", "<redacted>");
  }
  return sanitized.toString();
};

const recordFromUnknown = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
