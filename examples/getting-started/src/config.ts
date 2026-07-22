import type { PrimarEncAvailabilityRequests } from "@ecc/s100-viewer";
import type {
  FeatureSessionWorkflowOptions,
  LatLonBounds,
} from "../../shared/featureSessions";

export type GettingStartedConfig = {
  crs: string;
  origin: {
    x: number;
    y: number;
    z: number;
  };
  mapWidthMeters: number;
  sceneBounds: LatLonBounds;
  licenseeKey: string | undefined;
  endpoints: {
    s102Tiles: string | undefined;
    s111: string | undefined;
    encWmsBaseUrl: string | undefined;
    s57WmsTemplatePath: string | undefined;
  };
  apiKeys: {
    s102Tiles: string | undefined;
  };
  datasets: FeatureSessionWorkflowOptions["datasets"];
};

const defaultSceneBounds: LatLonBounds = {
  north: 46.85,
  east: -70.95,
  south: 46.75,
  west: -71.08,
};

export const readGettingStartedConfig = (): GettingStartedConfig => {
  const crs = readFirstEnv(["VITE_GETTING_STARTED_CRS", "VITE_REFERENCE_CRS"]) ?? "EPSG:32619";
  const origin = {
    x: readNumberFirstEnv(["VITE_GETTING_STARTED_ORIGIN_X", "VITE_REFERENCE_ORIGIN_X"], 331100),
    y: readNumberFirstEnv(["VITE_GETTING_STARTED_ORIGIN_Y", "VITE_REFERENCE_ORIGIN_Y"], 5186420),
    z: readNumberFirstEnv(["VITE_GETTING_STARTED_ORIGIN_Z", "VITE_REFERENCE_ORIGIN_Z"], 0),
  };
  const sceneBounds = {
    north: readNumberFirstEnv(
      ["VITE_GETTING_STARTED_BOUNDS_NORTH", "VITE_REFERENCE_BOUNDS_NORTH"],
      defaultSceneBounds.north,
    ),
    east: readNumberFirstEnv(
      ["VITE_GETTING_STARTED_BOUNDS_EAST", "VITE_REFERENCE_BOUNDS_EAST"],
      defaultSceneBounds.east,
    ),
    south: readNumberFirstEnv(
      ["VITE_GETTING_STARTED_BOUNDS_SOUTH", "VITE_REFERENCE_BOUNDS_SOUTH"],
      defaultSceneBounds.south,
    ),
    west: readNumberFirstEnv(
      ["VITE_GETTING_STARTED_BOUNDS_WEST", "VITE_REFERENCE_BOUNDS_WEST"],
      defaultSceneBounds.west,
    ),
  };
  const s111DatasetIds = readCsvFirstEnv([
    "VITE_GETTING_STARTED_S111_DATASET_IDS",
    "VITE_REFERENCE_S111_DATASET_IDS",
  ]);

  return {
    crs,
    origin,
    mapWidthMeters: readNumberFirstEnv(
      ["VITE_GETTING_STARTED_MAP_WIDTH_METERS", "VITE_REFERENCE_MAP_WIDTH_METERS"],
      5000,
    ),
    sceneBounds,
    licenseeKey: readFirstEnv([
      "VITE_GETTING_STARTED_LICENSEE_KEY",
      "VITE_REFERENCE_LICENSEE_KEY",
      "VITE_REFERENCE_LICENSEE_ID",
      "VITE_LICENSEE_KEY",
    ]),
    endpoints: {
      s102Tiles: readFirstEnv([
        "VITE_GETTING_STARTED_S102_3D_TILES_ENDPOINT",
        "VITE_REFERENCE_S102_3D_TILES_ENDPOINT",
      ]),
      s111: readFirstEnv([
        "VITE_GETTING_STARTED_S111_ENDPOINT",
        "VITE_REFERENCE_S111_ENDPOINT",
      ]),
      encWmsBaseUrl: readFirstEnv([
        "VITE_GETTING_STARTED_ENC_WMS_BASE_URL",
        "VITE_REFERENCE_ENC_WMS_BASE_URL",
      ]),
      s57WmsTemplatePath: readFirstEnv([
        "VITE_GETTING_STARTED_S57_WMS_TEMPLATE_PATH",
        "VITE_REFERENCE_S57_WMS_TEMPLATE_PATH",
      ]),
    },
    apiKeys: {
      s102Tiles: readFirstEnv([
        "VITE_GETTING_STARTED_S102_API_KEY",
        "VITE_REFERENCE_S102_API_KEY",
      ]),
    },
    datasets: {
      visibleS102Ids: readCsvFirstEnv([
        "VITE_GETTING_STARTED_S102_DATASET_IDS",
        "VITE_REFERENCE_S102_DATASET_IDS",
      ]),
      s111: s111DatasetIds.map((id) => ({
        id,
        title: `S-111 ${id}`,
        bounds: {
          latLon: sceneBounds,
        },
      })),
      visibleS111Ids: s111DatasetIds,
    },
  };
};

export const missingSessionConfig = (config: GettingStartedConfig): readonly string[] => {
  const missing: string[] = [];
  if (!config.licenseeKey) {
    missing.push("VITE_GETTING_STARTED_LICENSEE_KEY");
  }
  if (!config.endpoints.s102Tiles) {
    missing.push("VITE_GETTING_STARTED_S102_3D_TILES_ENDPOINT");
  }
  if (!config.apiKeys.s102Tiles) {
    missing.push("VITE_GETTING_STARTED_S102_API_KEY");
  }
  if (config.datasets.visibleS102Ids.length === 0) {
    missing.push("VITE_GETTING_STARTED_S102_DATASET_IDS");
  }
  if (!config.endpoints.s111) {
    missing.push("VITE_GETTING_STARTED_S111_ENDPOINT");
  }
  if (config.datasets.s111.length === 0) {
    missing.push("VITE_GETTING_STARTED_S111_DATASET_IDS");
  }
  if (!config.endpoints.encWmsBaseUrl) {
    missing.push("VITE_GETTING_STARTED_ENC_WMS_BASE_URL");
  }
  if (!config.endpoints.s57WmsTemplatePath) {
    missing.push("VITE_GETTING_STARTED_S57_WMS_TEMPLATE_PATH");
  }
  return missing;
};

export const createGettingStartedEncAvailabilityRequests =
  (): PrimarEncAvailabilityRequests<LatLonBounds> => ({
    async getLicensedProductsWithinBounds() {
      return [{ productSpecification: 101 }];
    },
    async getValidProductTypes() {
      return [{ id: 1, name: "S-57" }];
    },
    async getS57WithinBounds() {
      return { total: 1 };
    },
  });

export const projectBoundsAroundSceneOrigin =
  (config: GettingStartedConfig): FeatureSessionWorkflowOptions["projectBounds"] =>
  () => {
    const halfWidth = config.mapWidthMeters / 2;
    return {
      north: config.origin.y + halfWidth,
      east: config.origin.x + halfWidth,
      south: config.origin.y - halfWidth,
      west: config.origin.x - halfWidth,
    };
  };

export const configuredValue = (
  value: string | undefined,
  name: string,
): string => {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
};

const readFirstEnv = (keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = readEnv(key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

const readCsvFirstEnv = (keys: readonly string[]): readonly string[] => {
  for (const key of keys) {
    const values = readCsvEnv(key);
    if (values.length > 0) {
      return values;
    }
  }
  return [];
};

const readEnv = (key: string): string | undefined => {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
};

const readCsvEnv = (key: string): readonly string[] => {
  const value = readEnv(key);
  if (!value) {
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
};

const readNumberFirstEnv = (keys: readonly string[], fallback: number): number => {
  for (const key of keys) {
    const value = readEnv(key);
    if (!value) {
      continue;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};
