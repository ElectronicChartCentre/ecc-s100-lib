import type { SceneGeoreference } from "../../coordinates/types.js";
import {
  routeCentroid,
  WGS84_MEAN_EARTH_RADIUS_METERS,
} from "../route-geodesy.js";
import type { GeographicPosition, RoutePlan } from "../route-plan.js";
import type {
  ResolvedProjection,
  RouteLayoutOptions,
  RouteProjection,
} from "./types.js";

export const createLocalTangentRouteProjection = (
  origin: GeographicPosition,
): RouteProjection => ({
  crs: "LOCAL_TANGENT_WGS84_METERS",
  origin,
  project(position) {
    const deltaLat = degreesToRadians(position.lat - origin.lat);
    const deltaLon = degreesToRadians(normalizeLongitudeDelta(position.lon - origin.lon));
    const originLat = degreesToRadians(origin.lat);
    return {
      x: deltaLon * Math.cos(originLat) * WGS84_MEAN_EARTH_RADIUS_METERS,
      y: deltaLat * WGS84_MEAN_EARTH_RADIUS_METERS,
      z: position.heightMeters ?? 0,
    };
  },
});

export const resolveRouteProjection = (
  routePlan: RoutePlan,
  options: RouteLayoutOptions,
): ResolvedProjection => {
  if (options.projection !== undefined) {
    return {
      projection: options.projection,
      diagnostics: [],
    };
  }

  const origin = geodeticOriginFromGeoreference(options.georeference) ?? routeCentroid(routePlan);
  return {
    projection: createLocalTangentRouteProjection(origin),
    diagnostics: [
      {
        code: "route-layout-local-tangent-projection",
        severity: "info",
        message:
          "Route layout used a local tangent WGS84 meter projection. Pass a RouteProjection for scene-specific CRS projection.",
        values: {
          origin,
          crs: options.georeference?.mode === "projected-local"
            ? options.georeference.crs
            : undefined,
        },
      },
    ],
  };
};

const geodeticOriginFromGeoreference = (
  georeference: SceneGeoreference | undefined,
): GeographicPosition | undefined => {
  const origin = georeference?.origin;
  if (origin?.kind !== "geodetic") {
    return undefined;
  }
  return {
    lon: origin.lon,
    lat: origin.lat,
    ...(origin.height !== undefined ? { heightMeters: origin.height } : {}),
  };
};

const degreesToRadians = (value: number): number =>
  value * Math.PI / 180;

const normalizeLongitudeDelta = (delta: number): number =>
  ((delta + 180) % 360 + 360) % 360 - 180;
