import proj4 from "proj4";
import type {
  GeographicPosition,
  RouteProjection,
  RouteLayoutPosition,
} from "@ecc/s100-viewer/products/route";

const WGS84_CRS = "EPSG:4326";
const DEFAULT_ROUTE_CRS = "EPSG:32632";
const DEFAULT_ORIGIN_LON = 5.29;
const DEFAULT_ORIGIN_LAT = 60.42;
const DEFAULT_S102_SAFETY_DEPTH_METERS = 12;
const DEFAULT_S102_DETAIL_FACTOR = 500;
const S102_TILE_PROXY_ENDPOINT = "/demo-proxy/s102-tiles";

export type ProjectedOrigin = {
  x: number;
  y: number;
  z: number;
};

export type RtzRouteDemoConfig = {
  scene: {
    crs: string;
    origin: ProjectedOrigin;
    originGeographic: GeographicPosition;
  };
  s102: {
    configured: boolean;
    endpoint?: string;
    apiKey?: string;
    datasetIds: readonly string[];
    safetyDepthMeters: number;
    detailFactor: number;
    missing: readonly string[];
  };
};

type SampleWaypoint = {
  id: string;
  name: string;
  x: number;
  y: number;
  geographic: GeographicPosition;
};

export const getRtzRouteDemoConfig = (): RtzRouteDemoConfig => {
  const crs = normalizeCrs(readFirstEnv([
    "VITE_RTZ_ROUTE_CRS",
    "VITE_DEMO_CRS",
    "VITE_REFERENCE_CRS",
  ]) ?? DEFAULT_ROUTE_CRS);
  ensureSupportedProjection(crs);

  const configuredOriginX = readFirstNumberEnv([
    "VITE_RTZ_ROUTE_ORIGIN_X",
    "VITE_DEMO_ORIGIN_X",
    "VITE_REFERENCE_ORIGIN_X",
  ]);
  const configuredOriginY = readFirstNumberEnv([
    "VITE_RTZ_ROUTE_ORIGIN_Y",
    "VITE_DEMO_ORIGIN_Y",
    "VITE_REFERENCE_ORIGIN_Y",
  ]);
  const configuredOriginZ = readFirstNumberEnv([
    "VITE_RTZ_ROUTE_ORIGIN_Z",
    "VITE_DEMO_ORIGIN_Z",
    "VITE_REFERENCE_ORIGIN_Z",
  ]);
  const inverseProjectedOrigin = configuredOriginX !== undefined && configuredOriginY !== undefined
    ? unprojectToGeographic(crs, { x: configuredOriginX, y: configuredOriginY, z: configuredOriginZ ?? 0 })
    : undefined;
  const originGeographic = {
    lon: readNumberEnv(
      "VITE_RTZ_ROUTE_ORIGIN_LON",
      inverseProjectedOrigin?.lon ?? DEFAULT_ORIGIN_LON,
    ),
    lat: readNumberEnv(
      "VITE_RTZ_ROUTE_ORIGIN_LAT",
      inverseProjectedOrigin?.lat ?? DEFAULT_ORIGIN_LAT,
    ),
    heightMeters: configuredOriginZ ?? 0,
  };
  const defaultOrigin = projectGeographic(crs, originGeographic);
  const origin = {
    x: configuredOriginX ?? defaultOrigin.x,
    y: configuredOriginY ?? defaultOrigin.y,
    z: originGeographic.heightMeters ?? 0,
  };
  const endpoint = readFirstEnv([
    "VITE_RTZ_ROUTE_S102_3D_TILES_ENDPOINT",
    "VITE_DEMO_S102_3D_TILES_ENDPOINT",
    "VITE_S102_PRIMAR_3D_TILES_ENDPOINT",
    "VITE_REFERENCE_S102_3D_TILES_ENDPOINT",
  ]);
  const apiKey = readFirstEnv([
    "VITE_RTZ_ROUTE_S102_API_KEY",
    "VITE_DEMO_PRIMAR_API_KEY",
    "VITE_S111_PRIMAR_API_KEY",
    "VITE_REFERENCE_S102_API_KEY",
  ]);
  const datasetIds = readFirstCsvEnv([
    "VITE_RTZ_ROUTE_S102_DATASET_IDS",
    "VITE_DEMO_S102_DATASET_IDS",
    "VITE_REFERENCE_S102_DATASET_IDS",
  ]);
  const missing = [
    endpoint ? undefined : "VITE_RTZ_ROUTE_S102_3D_TILES_ENDPOINT",
    apiKey ? undefined : "VITE_RTZ_ROUTE_S102_API_KEY",
    datasetIds.length > 0 ? undefined : "VITE_RTZ_ROUTE_S102_DATASET_IDS",
  ].filter((value): value is string => value !== undefined);

  return {
    scene: {
      crs,
      origin,
      originGeographic,
    },
    s102: {
      configured: missing.length === 0,
      ...(endpoint !== undefined ? { endpoint } : {}),
      ...(apiKey !== undefined ? { apiKey } : {}),
      datasetIds,
      safetyDepthMeters: readNumberEnv(
        "VITE_RTZ_ROUTE_S102_SAFETY_DEPTH_METERS",
        DEFAULT_S102_SAFETY_DEPTH_METERS,
      ),
      detailFactor: readNumberEnv(
        "VITE_RTZ_ROUTE_S102_DETAIL_FACTOR",
        DEFAULT_S102_DETAIL_FACTOR,
      ),
      missing,
    },
  };
};

export const createProjectedRouteProjection = (
  config: RtzRouteDemoConfig,
): RouteProjection => ({
  crs: config.scene.crs,
  origin: config.scene.originGeographic,
  project(position) {
    const projected = projectGeographic(config.scene.crs, position);
    return {
      x: projected.x - config.scene.origin.x,
      y: projected.y - config.scene.origin.y,
      z: position.heightMeters ?? 0,
    };
  },
});

export const createSceneAlignedSampleRouteXml = (
  config: RtzRouteDemoConfig,
): string | undefined => {
  const offsets = [
    { id: "WP001", name: "Approach", x: -1600, y: -650 },
    { id: "WP002", name: "Turn North", x: -560, y: -120 },
    { id: "WP003", name: "Inner Fairway", x: 480, y: 220 },
    { id: "WP004", name: "Berth Limit", x: 1620, y: 640 },
  ];
  const waypoints: SampleWaypoint[] = [];
  for (const offset of offsets) {
    const geographic = unprojectToGeographic(config.scene.crs, {
      x: config.scene.origin.x + offset.x,
      y: config.scene.origin.y + offset.y,
      z: 0,
    });
    if (!geographic) {
      return undefined;
    }
    waypoints.push({ ...offset, geographic });
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2">
  <routeInfo routeName="Scene-Aligned S-102 Demo" routeAuthor="ECC" routeStatus="planned" />
  <waypoints>
    <defaultWaypoint radius="0.12">
      <leg starboardXTD="0.08" portsideXTD="0.08" safetyDepth="16" safetyContour="20" geometryType="Loxodrome" speedMin="5" speedMax="12" />
    </defaultWaypoint>
${waypoints.map((waypoint, index) => waypointXml(waypoint, index)).join("\n")}
  </waypoints>
</route>
`;
};

export const s102SourceEndpoint = (endpoint: string): string => {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return endpoint;
  }

  try {
    const endpointUrl = new URL(endpoint, window.location.href);
    return endpointUrl.origin === window.location.origin
      ? endpoint
      : S102_TILE_PROXY_ENDPOINT;
  } catch {
    return endpoint;
  }
};

function projectGeographic(
  crs: string,
  position: GeographicPosition,
): RouteLayoutPosition {
  const [x, y] = proj4(WGS84_CRS, crs, [position.lon, position.lat]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Could not project WGS84 position to ${crs}.`);
  }
  return {
    x,
    y,
    z: position.heightMeters ?? 0,
  };
}

function waypointXml(
  waypoint: SampleWaypoint,
  index: number,
): string {
  const leg = index === 1
    ? `\n      <leg starboardXTD="0.06" portsideXTD="0.10" safetyDepth="14" geometryType="Loxodrome" />`
    : index === 2
      ? `\n      <leg starboardXTD="0.07" portsideXTD="0.07" safetyDepth="12" geometryType="Loxodrome" />`
      : "";
  return `    <waypoint id="${waypoint.id}" revision="1" name="${waypoint.name}">
      <position lat="${waypoint.geographic.lat.toFixed(7)}" lon="${waypoint.geographic.lon.toFixed(7)}" />${leg}
    </waypoint>`;
}

function unprojectToGeographic(
  crs: string,
  position: ProjectedOrigin,
): GeographicPosition | undefined {
  const [lon, lat] = proj4(crs, WGS84_CRS, [position.x, position.y]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return undefined;
  }
  return {
    lon,
    lat,
    heightMeters: position.z,
  };
}

function ensureSupportedProjection(crs: string): void {
  const match = /^EPSG:(326|327)(\d{2})$/.exec(crs);
  if (!match) {
    return;
  }

  const hemisphereCode = match[1];
  const zone = Number(match[2]);
  if (zone < 1 || zone > 60) {
    return;
  }
  const south = hemisphereCode === "327" ? " +south" : "";
  proj4.defs(crs, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs +type=crs${south}`);
}

function normalizeCrs(value: string): string {
  return value.trim().toUpperCase();
}

function readFirstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = readEnv(key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readFirstNumberEnv(keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = readOptionalNumberEnv(key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function readFirstCsvEnv(keys: readonly string[]): readonly string[] {
  for (const key of keys) {
    const values = readCsvEnv(key);
    if (values.length > 0) {
      return values;
    }
  }
  return [];
}

function readCsvEnv(key: string): readonly string[] {
  const value = readEnv(key);
  if (!value) {
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function readNumberEnv(key: string, fallback: number): number {
  return readOptionalNumberEnv(key) ?? fallback;
}

function readOptionalNumberEnv(key: string): number | undefined {
  const value = readEnv(key);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
