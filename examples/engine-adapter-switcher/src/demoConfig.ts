export type DemoSceneSettings = {
  crs: string;
  origin: {
    x: number;
    y: number;
    z: number;
  };
  mapWidthMeters: number;
};

export type LonLatBoundingBox = [
  west: number,
  south: number,
  east: number,
  north: number,
];

export type DemoServiceConfig = DemoSceneSettings & {
  primarApiKey: string | undefined;
  licenseeKey: string | undefined;
  s102TilesEndpoint: string | undefined;
  s102DatasetIds: readonly string[];
  s111Endpoint: string | undefined;
  s111DatasetIds: readonly string[];
  s101WmsBaseUrl: string | undefined;
  s101WmsStyleId: string | undefined;
  s101WmsBasemapStyleId: string | undefined;
  s101WmsLayers: readonly string[];
};

export type DemoLiveAisConfig = {
  proxyUrl: string | null;
  refreshIntervalMs: number;
  maxVessels: number;
  maxAgeSeconds?: number;
};

export type DemoS104FixtureConfig = {
  serviceUrl: string;
  datasetId: string;
  maxDataPoints: number;
};

export type DemoServiceRequirement =
  | "primarApiKey"
  | "licenseeKey"
  | "s102TilesEndpoint"
  | "s102DatasetIds"
  | "s111Endpoint"
  | "s111DatasetIds"
  | "s101WmsBaseUrl";

export const stavangerDemoSceneSettings: DemoSceneSettings = {
  crs: "EPSG:32631",
  origin: {
    x: 654_390.818,
    y: 6_542_760.725,
    z: 0,
  },
  mapWidthMeters: 9_000,
};

export const stavangerDemoLonLatBbox: LonLatBoundingBox = [
  5.625,
  58.968708,
  5.749944,
  59.024184,
];

export const stavangerS102DatasetIds = [
  "102NO006J0811_10_U",
  "102NO006T0711_40_U",
  "102NO006T0711_30_U",
  "102NO006J0811_20_U",
] as const;

export const defaultS104FixtureDatasetId = "stavanger-spatial-phase-tide";

export const getDemoSceneSettings = (): DemoSceneSettings => ({
  crs: readEnv("VITE_DEMO_CRS") ?? "EPSG:32619",
  origin: {
    x: readNumberEnv("VITE_DEMO_ORIGIN_X", 331100),
    y: readNumberEnv("VITE_DEMO_ORIGIN_Y", 5186420),
    z: readNumberEnv("VITE_DEMO_ORIGIN_Z", 0),
  },
  mapWidthMeters: readNumberEnv("VITE_DEMO_MAP_WIDTH_METERS", 5000),
});

export const getDemoLookAtTarget = (settings: DemoSceneSettings = getDemoSceneSettings()) => {
  return {
    kind: "projected",
    crs: settings.crs,
    x: settings.origin.x,
    y: settings.origin.y,
    z: settings.origin.z,
  } as const;
};

export const getDemoServiceConfig = (
  settings: DemoSceneSettings = getDemoSceneSettings(),
): DemoServiceConfig => {
  return {
    ...settings,
    primarApiKey: readFirstEnv(["VITE_DEMO_PRIMAR_API_KEY", "VITE_S111_PRIMAR_API_KEY"]),
    licenseeKey: readFirstEnv([
      "VITE_DEMO_LICENSEE_KEY",
      "VITE_DEMO_LICENSEE_ID",
      "VITE_LICENSEE_KEY",
    ]),
    s102TilesEndpoint: readFirstEnv([
      "VITE_DEMO_S102_3D_TILES_ENDPOINT",
      "VITE_S102_PRIMAR_3D_TILES_ENDPOINT",
    ]),
    s102DatasetIds: readCsvEnv("VITE_DEMO_S102_DATASET_IDS"),
    s111Endpoint: readFirstEnv(["VITE_DEMO_S111_ENDPOINT", "VITE_S111_PRIMAR_ENDPOINT"]),
    s111DatasetIds: readCsvEnv("VITE_DEMO_S111_DATASET_IDS"),
    s101WmsBaseUrl: readFirstEnv([
      "VITE_DEMO_PRIMAR_WMS_URL_BASE",
      "VITE_PRIMAR_WMS_URL_BASE",
    ]),
    s101WmsStyleId: readFirstEnv(["VITE_DEMO_S101_WMS_STYLE_ID"]) ?? "transparentLand",
    s101WmsBasemapStyleId: readFirstEnv(["VITE_DEMO_S101_WMS_BASEMAP_STYLE_ID"]) ?? "default",
    s101WmsLayers: readCsvEnv("VITE_DEMO_S101_WMS_LAYERS", ["s100dataSets.101"]),
  };
};

export const requireDemoServiceConfig = (
  requirements: readonly DemoServiceRequirement[],
  settings?: DemoSceneSettings,
): DemoServiceConfig => {
  const config = getDemoServiceConfig(settings);
  const missing = requirements.filter((requirement) => {
    const value = config[requirement];
    return Array.isArray(value) ? value.length === 0 : !value;
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing demo service configuration: ${missing.join(", ")}. Copy .env.example to .env.local and fill in the required values.`,
    );
  }

  return config;
};

export const getDemoLiveAisConfig = (): DemoLiveAisConfig => {
  const maxAgeSeconds = readOptionalPositiveIntegerEnv("VITE_AIS_MAX_AGE_SECONDS");
  return {
    proxyUrl: readFirstEnv(["VITE_AIS_PROXY_URL", "VITE_DEMO_AIS_PROXY_URL"])?.replace(/\/+$/, "") ?? null,
    refreshIntervalMs: Math.max(readPositiveIntegerEnv("VITE_AIS_REFRESH_INTERVAL_MS", 30_000), 30_000),
    maxVessels: readPositiveIntegerEnv("VITE_AIS_MAX_VESSELS", 250),
    ...(maxAgeSeconds !== undefined ? { maxAgeSeconds } : {}),
  };
};

export const getDemoLiveAisS102DatasetIds = (): readonly string[] =>
  readCsvEnv("VITE_DEMO_LIVE_AIS_S102_DATASET_IDS", getDemoStavangerS102DatasetIds());

export const getDemoStavangerS102DatasetIds = (): readonly string[] =>
  readCsvEnv("VITE_DEMO_STAVANGER_S102_DATASET_IDS", stavangerS102DatasetIds);

export const getDemoLiveAisS101Enabled = (): boolean =>
  readBooleanEnv("VITE_DEMO_LIVE_AIS_S101_ENABLED", false);

export const getDemoS104FixtureConfig = (): DemoS104FixtureConfig => ({
  serviceUrl: readFirstEnv(["VITE_S104_FIXTURE_SERVICE_URL", "VITE_DEMO_S104_FIXTURE_SERVICE_URL"])
    ?? "http://localhost:8794",
  datasetId: readFirstEnv(["VITE_S104_DATASET_ID", "VITE_DEMO_S104_DATASET_ID"])
    ?? defaultS104FixtureDatasetId,
  maxDataPoints: readPositiveIntegerEnv("VITE_S104_MAX_DATA_POINTS", 100_000),
});

const readFirstEnv = (keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = readEnv(key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

const readEnv = (key: string): string | undefined => {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const readCsvEnv = (key: string, fallback: readonly string[] = []): readonly string[] => {
  const value = readEnv(key);
  if (!value) {
    return fallback;
  }

  return value.split(",").map((item) => item.trim()).filter(Boolean);
};

const readNumberEnv = (key: string, fallback: number): number => {
  const value = readEnv(key);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readPositiveIntegerEnv = (key: string, fallback: number): number => {
  const value = readEnv(key);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const readOptionalPositiveIntegerEnv = (key: string): number | undefined => {
  const value = readEnv(key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const readBooleanEnv = (key: string, fallback: boolean): boolean => {
  const value = readEnv(key)?.toLowerCase();
  if (value === undefined) {
    return fallback;
  }
  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no") {
    return false;
  }
  return fallback;
};
