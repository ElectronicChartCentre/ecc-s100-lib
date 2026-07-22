import type {
  GeographicPosition,
  RouteBounds,
  RoutePlan,
} from "./route-plan.js";

export const WGS84_MEAN_EARTH_RADIUS_METERS = 6371008.8;
export const NAUTICAL_MILE_METERS = 1852;

export type RouteLegOffset = {
  portside: {
    from: GeographicPosition;
    to: GeographicPosition;
  };
  starboard: {
    from: GeographicPosition;
    to: GeographicPosition;
  };
};

export const nauticalMilesToMeters = (value: number): number =>
  value * NAUTICAL_MILE_METERS;

export const metersToNauticalMiles = (value: number): number =>
  value / NAUTICAL_MILE_METERS;

export const degreesToRadians = (value: number): number =>
  value * Math.PI / 180;

export const radiansToDegrees = (value: number): number =>
  value * 180 / Math.PI;

export const normalizeLongitude = (lon: number): number => {
  const normalized = ((lon + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -180) ? 180 : normalized;
};

export const normalizeBearingDegrees = (value: number): number =>
  ((value % 360) + 360) % 360;

export const bearingDegrees = (
  from: GeographicPosition,
  to: GeographicPosition,
): number => {
  const lat1 = degreesToRadians(from.lat);
  const lat2 = degreesToRadians(to.lat);
  const deltaLon = degreesToRadians(to.lon - from.lon);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return normalizeBearingDegrees(radiansToDegrees(Math.atan2(y, x)));
};

export const distanceMeters = (
  from: GeographicPosition,
  to: GeographicPosition,
): number => {
  const lat1 = degreesToRadians(from.lat);
  const lat2 = degreesToRadians(to.lat);
  const deltaLat = degreesToRadians(to.lat - from.lat);
  const deltaLon = degreesToRadians(to.lon - from.lon);
  const sinHalfLat = Math.sin(deltaLat / 2);
  const sinHalfLon = Math.sin(deltaLon / 2);
  const a =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLon * sinHalfLon;
  return WGS84_MEAN_EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const destinationPoint = (
  from: GeographicPosition,
  bearing: number,
  distance: number,
): GeographicPosition => {
  const angularDistance = distance / WGS84_MEAN_EARTH_RADIUS_METERS;
  const bearingRadians = degreesToRadians(bearing);
  const lat1 = degreesToRadians(from.lat);
  const lon1 = degreesToRadians(from.lon);
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);
  const lat2 = Math.asin(
    sinLat1 * cosAngular +
    cosLat1 * sinAngular * Math.cos(bearingRadians),
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearingRadians) * sinAngular * cosLat1,
    cosAngular - sinLat1 * Math.sin(lat2),
  );

  return {
    lon: normalizeLongitude(radiansToDegrees(lon2)),
    lat: radiansToDegrees(lat2),
    ...(from.heightMeters !== undefined ? { heightMeters: from.heightMeters } : {}),
  };
};

export const offsetLeg = (
  from: GeographicPosition,
  to: GeographicPosition,
  offsets: {
    portsideMeters: number;
    starboardMeters: number;
  },
): RouteLegOffset => {
  const legBearing = bearingDegrees(from, to);
  const portBearing = normalizeBearingDegrees(legBearing - 90);
  const starboardBearing = normalizeBearingDegrees(legBearing + 90);
  return {
    portside: {
      from: destinationPoint(from, portBearing, offsets.portsideMeters),
      to: destinationPoint(to, portBearing, offsets.portsideMeters),
    },
    starboard: {
      from: destinationPoint(from, starboardBearing, offsets.starboardMeters),
      to: destinationPoint(to, starboardBearing, offsets.starboardMeters),
    },
  };
};

export const computeRouteBounds = (
  routePlan: Pick<RoutePlan, "waypoints">,
): RouteBounds | undefined => {
  if (routePlan.waypoints.length === 0) {
    return undefined;
  }
  const lons = routePlan.waypoints.map((waypoint) => waypoint.position.lon);
  const lats = routePlan.waypoints.map((waypoint) => waypoint.position.lat);
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };
};

export const routeCentroid = (
  routePlan: Pick<RoutePlan, "waypoints">,
): GeographicPosition => {
  if (routePlan.waypoints.length === 0) {
    return { lon: 0, lat: 0 };
  }
  const sum = routePlan.waypoints.reduce(
    (accumulator, waypoint) => ({
      lon: accumulator.lon + waypoint.position.lon,
      lat: accumulator.lat + waypoint.position.lat,
    }),
    { lon: 0, lat: 0 },
  );
  return {
    lon: sum.lon / routePlan.waypoints.length,
    lat: sum.lat / routePlan.waypoints.length,
  };
};

