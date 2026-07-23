import type {
  Coordinate,
} from "@ecc/s100-viewer";
import type { PrimarEncAvailabilityRequests } from "@ecc/s100-viewer/products";
import type { S111WorkflowDataset } from "@ecc/s100-viewer/products/s111";
import type { VesselDimensions } from "@ecc/s100-viewer/products/vessel";

export type LatLonBounds = {
  north: number;
  east: number;
  south: number;
  west: number;
};

export type ReferenceAppConfig = {
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
  datasets: {
    visibleS102Ids: readonly string[];
    s111: readonly S111WorkflowDataset<unknown, LatLonBounds>[];
    visibleS111Ids: readonly string[];
  };
  vessel: {
    modelUrl: string;
    position: Coordinate;
    headingDegrees: number;
    dimensions: VesselDimensions;
  };
};

const defaultSceneBounds: LatLonBounds = {
  north: 46.85,
  east: -70.95,
  south: 46.75,
  west: -71.08,
};

export const readReferenceAppConfig = (): ReferenceAppConfig => {
  const crs = readEnv("VITE_REFERENCE_CRS") ?? "EPSG:32619";
  const origin = {
    x: readNumberEnv("VITE_REFERENCE_ORIGIN_X", 331100),
    y: readNumberEnv("VITE_REFERENCE_ORIGIN_Y", 5186420),
    z: readNumberEnv("VITE_REFERENCE_ORIGIN_Z", 0),
  };
  const sceneBounds = {
    north: readNumberEnv("VITE_REFERENCE_BOUNDS_NORTH", defaultSceneBounds.north),
    east: readNumberEnv("VITE_REFERENCE_BOUNDS_EAST", defaultSceneBounds.east),
    south: readNumberEnv("VITE_REFERENCE_BOUNDS_SOUTH", defaultSceneBounds.south),
    west: readNumberEnv("VITE_REFERENCE_BOUNDS_WEST", defaultSceneBounds.west),
  };
  const s111DatasetIds = readCsvEnv("VITE_REFERENCE_S111_DATASET_IDS");

  return {
    crs,
    origin,
    mapWidthMeters: readNumberEnv("VITE_REFERENCE_MAP_WIDTH_METERS", 5000),
    sceneBounds,
    licenseeKey: readFirstEnv([
      "VITE_REFERENCE_LICENSEE_KEY",
      "VITE_REFERENCE_LICENSEE_ID",
      "VITE_LICENSEE_KEY",
    ]),
    endpoints: {
      s102Tiles: readEnv("VITE_REFERENCE_S102_3D_TILES_ENDPOINT"),
      s111: readEnv("VITE_REFERENCE_S111_ENDPOINT"),
      encWmsBaseUrl: readEnv("VITE_REFERENCE_ENC_WMS_BASE_URL"),
      s57WmsTemplatePath: readEnv("VITE_REFERENCE_S57_WMS_TEMPLATE_PATH"),
    },
    apiKeys: {
      s102Tiles: readEnv("VITE_REFERENCE_S102_API_KEY"),
    },
    datasets: {
      visibleS102Ids: readCsvEnv("VITE_REFERENCE_S102_DATASET_IDS"),
      s111: s111DatasetIds.map((id) => ({
        id,
        title: `S-111 ${id}`,
        bounds: {
          latLon: sceneBounds,
        },
      })),
      visibleS111Ids: s111DatasetIds,
    },
    vessel: {
      modelUrl:
        readEnv("VITE_REFERENCE_VESSEL_MODEL_URL") ??
        "/demo-assets/vessel/panama-tanker-origin-at-transponder.glb",
      position: {
        kind: "projected",
        crs,
        x: origin.x,
        y: origin.y,
        z: origin.z,
      },
      headingDegrees: readNumberEnv("VITE_REFERENCE_VESSEL_HEADING_DEGREES", 35),
      dimensions: {
        draught: readNumberEnv("VITE_REFERENCE_VESSEL_DRAUGHT_METERS", 12),
        bow: readNumberEnv("VITE_REFERENCE_VESSEL_BOW_METERS", 195.2),
        stern: readNumberEnv("VITE_REFERENCE_VESSEL_STERN_METERS", 30),
        port: readNumberEnv("VITE_REFERENCE_VESSEL_PORT_METERS", 20.8),
        starboard: readNumberEnv("VITE_REFERENCE_VESSEL_STARBOARD_METERS", 11.2),
      },
    },
  };
};

export const missingSessionConfig = (config: ReferenceAppConfig): readonly string[] => {
  const missing: string[] = [];
  if (!config.licenseeKey) {
    missing.push("VITE_REFERENCE_LICENSEE_KEY");
  }
  if (!config.endpoints.s102Tiles) {
    missing.push("VITE_REFERENCE_S102_3D_TILES_ENDPOINT");
  }
  if (!config.apiKeys.s102Tiles) {
    missing.push("VITE_REFERENCE_S102_API_KEY");
  }
  if (config.datasets.visibleS102Ids.length === 0) {
    missing.push("VITE_REFERENCE_S102_DATASET_IDS");
  }
  if (!config.endpoints.s111) {
    missing.push("VITE_REFERENCE_S111_ENDPOINT");
  }
  if (config.datasets.s111.length === 0) {
    missing.push("VITE_REFERENCE_S111_DATASET_IDS");
  }
  if (!config.endpoints.encWmsBaseUrl) {
    missing.push("VITE_REFERENCE_ENC_WMS_BASE_URL");
  }
  if (!config.endpoints.s57WmsTemplatePath) {
    missing.push("VITE_REFERENCE_S57_WMS_TEMPLATE_PATH");
  }
  return missing;
};

export const createReferenceEncAvailabilityRequests =
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

export const projectBoundsAroundSceneOrigin = (
  _bounds: LatLonBounds,
  crs: string,
): { north: number; east: number; south: number; west: number } => {
  const config = readReferenceAppConfig();
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

const readNumberEnv = (key: string, fallback: number): number => {
  const value = readEnv(key);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
