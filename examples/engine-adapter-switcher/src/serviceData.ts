import { LayerBuilder } from "@ecc/s100-viewer";
import type { DemoServiceConfig } from "./demoConfig";

const S102_TILE_PROXY_PREFIX = "/demo-proxy/s102-tiles";

export type FetchedS111Dataset = {
  datasetId: string;
  data: unknown;
  metadata: unknown;
};

export type BuildS101WmsUrlTemplateOptions = {
  imageSizePixels?: number | undefined;
  styleId?: string | undefined;
  transparent?: boolean | undefined;
};

export const buildS102TilesUrl = (config: DemoServiceConfig): string => {
  const endpoint = ensureTrailingSlash(requireValue(config.s102TilesEndpoint, "s102TilesEndpoint"));
  const apiKey = requireValue(config.primarApiKey, "primarApiKey");
  const datasetIds = config.s102DatasetIds.join(",");
  if (shouldUseS102TileProxy(endpoint)) {
    return `${S102_TILE_PROXY_PREFIX}/${apiKey}/${datasetIds}`;
  }

  return `${endpoint}${apiKey}/${datasetIds}`;
};

export const buildS101WmsUrlTemplate = (
  config: DemoServiceConfig,
  options: BuildS101WmsUrlTemplateOptions = {},
): string =>
  LayerBuilder.buildWmsUrlTemplate({
    baseUrl: requireValue(config.s101WmsBaseUrl, "s101WmsBaseUrl"),
    parameters: [
      ["bbox", "{xmin},{ymin},{xmax},{ymax}"],
      ["FORMAT", "image/png"],
      ["SERVICE", "WMS"],
      ["VERSION", "1.1.1"],
      ["SRS", config.crs],
      ["WIDTH", normalizeImageSize(options.imageSizePixels)],
      ["HEIGHT", normalizeImageSize(options.imageSizePixels)],
      ["REQUEST", "GetMap"],
      ["CELLPICKER", `vesselFolio,${requireValue(config.licenseeKey, "licenseeKey")}`],
      ["LAYERS", config.s101WmsLayers.join(",")],
      ["STYLES", normalizeOptionalParameter(options.styleId ?? config.s101WmsStyleId)],
      ["TRANSPARENT", options.transparent ?? true],
      ["DPI", Math.round(window.devicePixelRatio * 96)],
      ["MULTIRES", 10000],
      ["DISPLAYSCALES", "IGNORE"],
    ],
  });

export const fetchS111Dataset = async (
  config: DemoServiceConfig,
  datasetId: string,
): Promise<FetchedS111Dataset> => {
  const metadata = await fetchJson(buildS111Url(config, datasetId, "metadata.json"));
  const rawData = await fetchJson(buildS111Url(config, datasetId, "data.json", { crs: config.crs }));
  return {
    datasetId,
    metadata,
    data: unwrapS111Instance(rawData),
  };
};

export const appendWmsTemplateParameters = (
  baseUrl: string,
  parameters: readonly (readonly [string, string | number | boolean])[],
): string =>
  LayerBuilder.buildWmsUrlTemplate({
    baseUrl,
    parameters,
  });

const buildS111Url = (
  config: DemoServiceConfig,
  datasetId: string,
  path: "metadata.json" | "data.json",
  query: Record<string, string> = {},
): string => {
  const url = new URL(
    `${encodeURIComponent(datasetId)}/${path}`,
    ensureTrailingSlash(requireValue(config.s111Endpoint, "s111Endpoint")),
  );
  url.searchParams.set("licenseeKey", requireValue(config.licenseeKey, "licenseeKey"));
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json() as Promise<unknown>;
};

const unwrapS111Instance = (value: unknown): unknown => {
  if (isRecord(value) && Array.isArray(value.instances) && value.instances[0] !== undefined) {
    return value.instances[0];
  }
  return value;
};

const ensureTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value : `${value}/`;

const shouldUseS102TileProxy = (endpoint: string): boolean => {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  try {
    const endpointUrl = new URL(endpoint, window.location.href);
    return endpointUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const requireValue = (value: string | undefined, label: string): string => {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
};

const normalizeOptionalParameter = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const normalizeImageSize = (value: number | undefined): number =>
  Number.isFinite(value) && value !== undefined && value > 0 ? Math.round(value) : 256;

const isRecord = (value: unknown): value is { instances?: unknown[] } =>
  typeof value === "object" && value !== null;
