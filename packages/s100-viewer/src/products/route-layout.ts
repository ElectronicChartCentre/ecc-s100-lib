import type { SceneGeoreference } from "../coordinates/types.js";
import {
  computeRouteBounds,
  destinationPoint,
  distanceMeters,
  offsetLeg,
  routeCentroid,
  WGS84_MEAN_EARTH_RADIUS_METERS,
} from "./route-geodesy.js";
import type {
  GeographicPosition,
  RouteDiagnostic,
  RouteLayoutPosition,
  RouteLinePrimitive,
  RouteMeshPrimitive,
  RoutePlan,
  RoutePlanLayout,
  RoutePointPrimitive,
  RoutePolygonPrimitive,
  RoutePrimitiveMetadata,
  RouteWaypoint,
  RouteWaypointLeg,
} from "./route-plan.js";

export type RouteProjection = {
  crs?: string;
  origin?: GeographicPosition;
  project(position: GeographicPosition): RouteLayoutPosition;
};

export type RouteLayoutOptions = {
  georeference?: SceneGeoreference;
  projection?: RouteProjection;
  includeCorridor?: boolean;
  includeXtdBoundaries?: boolean;
  includeRouteVolume?: boolean;
  includeRouteSides?: boolean;
  includeTurnDebugGeometry?: boolean;
  turnDebugSegments?: number;
  seaLevelMeters?: number;
};

type ResolvedProjection = {
  projection: RouteProjection;
  diagnostics: readonly RouteDiagnostic[];
};

const DEFAULT_TURN_DEBUG_SEGMENTS = 36;

export const buildRoutePlanLayout = (
  routePlan: RoutePlan,
  options: RouteLayoutOptions = {},
): RoutePlanLayout => {
  const resolvedProjection = resolveRouteProjection(routePlan, options);
  const projection = resolvedProjection.projection;
  const diagnostics = [...resolvedProjection.diagnostics];
  const includeXtdBoundaries = options.includeXtdBoundaries ?? true;
  const includeCorridor = options.includeCorridor ?? true;
  const centerline = buildCenterline(routePlan, projection);
  const waypoints = buildWaypointPoints(routePlan, projection);
  const bounds = computeRouteBounds(routePlan);
  const legBoundaries = includeXtdBoundaries
    ? buildLegBoundaryLines(routePlan, projection)
    : [];
  const corridors = includeCorridor
    ? buildCorridorPolygons(routePlan, projection)
    : [];
  const routeVolumes = options.includeRouteVolume === true || options.includeRouteSides === true
    ? buildRouteVolumeMeshes(routePlan, projection, options.seaLevelMeters ?? 0)
    : [];
  const debug = options.includeTurnDebugGeometry === true
    ? buildTurnDebugGeometry(
        routePlan,
        projection,
        Math.max(8, Math.floor(options.turnDebugSegments ?? DEFAULT_TURN_DEBUG_SEGMENTS)),
      )
    : [];

  return {
    routeId: routePlan.id,
    sourceFormat: routePlan.sourceFormat,
    ...(projection.origin !== undefined ? { origin: projection.origin } : {}),
    ...(bounds !== undefined ? { bounds } : {}),
    centerline,
    waypoints,
    legBoundaries,
    corridors,
    routeVolumes,
    debug,
    diagnostics,
  };
};

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

const resolveRouteProjection = (
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

const buildCenterline = (
  routePlan: RoutePlan,
  projection: RouteProjection,
): RouteLinePrimitive => ({
  id: `${routePlan.id}:centerline`,
  positions: routePlan.waypoints.map((waypoint) => projection.project(waypoint.position)),
  metadata: metadata(routePlan, "centerline"),
});

const buildWaypointPoints = (
  routePlan: RoutePlan,
  projection: RouteProjection,
): RoutePointPrimitive[] =>
  routePlan.waypoints.map((waypoint) => ({
    id: `${routePlan.id}:waypoint:${waypoint.id}`,
    position: projection.project(waypoint.position),
    metadata: metadata(routePlan, "waypoint", {
      waypointId: waypoint.id,
    }),
  }));

const buildLegBoundaryLines = (
  routePlan: RoutePlan,
  projection: RouteProjection,
): RouteLinePrimitive[] => {
  const waypointsById = waypointMap(routePlan);
  return routePlan.legs.flatMap((leg) => {
    const boundary = routeLegOffset(leg, waypointsById);
    if (!boundary) {
      return [];
    }
    return [
      {
        id: `${routePlan.id}:leg:${leg.id}:portside-xtd`,
        positions: [
          projection.project(boundary.portside.from),
          projection.project(boundary.portside.to),
        ],
        metadata: metadata(routePlan, "xtd-boundary", {
          legId: leg.id,
          side: "portside",
        }),
      },
      {
        id: `${routePlan.id}:leg:${leg.id}:starboard-xtd`,
        positions: [
          projection.project(boundary.starboard.from),
          projection.project(boundary.starboard.to),
        ],
        metadata: metadata(routePlan, "xtd-boundary", {
          legId: leg.id,
          side: "starboard",
        }),
      },
    ];
  });
};

const buildCorridorPolygons = (
  routePlan: RoutePlan,
  projection: RouteProjection,
): RoutePolygonPrimitive[] => {
  const waypointsById = waypointMap(routePlan);
  return routePlan.legs.flatMap((leg) => {
    const boundary = routeLegOffset(leg, waypointsById);
    if (!boundary) {
      return [];
    }
    const ring = [
      projection.project(boundary.starboard.from),
      projection.project(boundary.starboard.to),
      projection.project(boundary.portside.to),
      projection.project(boundary.portside.from),
      projection.project(boundary.starboard.from),
    ];
    return [{
      id: `${routePlan.id}:leg:${leg.id}:corridor`,
      rings: [ring],
      metadata: metadata(routePlan, "corridor", {
        legId: leg.id,
      }),
    }];
  });
};

const buildRouteVolumeMeshes = (
  routePlan: RoutePlan,
  projection: RouteProjection,
  seaLevelMeters: number,
): RouteMeshPrimitive[] => {
  const waypointsById = waypointMap(routePlan);
  return routePlan.legs.flatMap((leg) => {
    const boundary = routeLegOffset(leg, waypointsById);
    const safetyDepthMeters = leg.safetyDepthMeters;
    if (!boundary || safetyDepthMeters === undefined || safetyDepthMeters <= 0) {
      return [];
    }

    const top = [
      projection.project(boundary.starboard.from),
      projection.project(boundary.starboard.to),
      projection.project(boundary.portside.to),
      projection.project(boundary.portside.from),
    ].map((position) => withZ(position, seaLevelMeters));
    const bottom = top.map((position) => withZ(position, seaLevelMeters - safetyDepthMeters));

    return [{
      id: `${routePlan.id}:leg:${leg.id}:safety-depth-volume`,
      positions: [
        ...top,
        ...bottom,
      ],
      indices: [
        0, 1, 2,
        0, 2, 3,
        4, 6, 5,
        4, 7, 6,
        0, 4, 5,
        0, 5, 1,
        1, 5, 6,
        1, 6, 2,
        2, 6, 7,
        2, 7, 3,
        3, 7, 4,
        3, 4, 0,
      ],
      metadata: metadata(routePlan, "route-volume", {
        legId: leg.id,
      }),
    }];
  });
};

const buildTurnDebugGeometry = (
  routePlan: RoutePlan,
  projection: RouteProjection,
  segments: number,
): RouteLinePrimitive[] =>
  routePlan.waypoints.flatMap((waypoint) => {
    if (waypoint.radiusMeters === undefined || waypoint.radiusMeters <= 0) {
      return [];
    }
    const positions = Array.from({ length: segments + 1 }, (_item, index) => {
      const bearing = index / segments * 360;
      return projection.project(destinationPoint(waypoint.position, bearing, waypoint.radiusMeters ?? 0));
    });
    return [{
      id: `${routePlan.id}:waypoint:${waypoint.id}:turn-radius-debug`,
      positions,
      metadata: metadata(routePlan, "debug", {
        waypointId: waypoint.id,
      }),
    }];
  });

const routeLegOffset = (
  leg: RouteWaypointLeg,
  waypointsById: ReadonlyMap<string, RouteWaypoint>,
) => {
  const from = waypointsById.get(leg.fromWaypointId);
  const to = waypointsById.get(leg.toWaypointId);
  if (
    from === undefined ||
    to === undefined ||
    leg.portsideXtdMeters === undefined ||
    leg.starboardXtdMeters === undefined
  ) {
    return null;
  }
  if (distanceMeters(from.position, to.position) <= 0) {
    return null;
  }
  return offsetLeg(from.position, to.position, {
    portsideMeters: leg.portsideXtdMeters,
    starboardMeters: leg.starboardXtdMeters,
  });
};

const waypointMap = (routePlan: RoutePlan): ReadonlyMap<string, RouteWaypoint> =>
  new Map(routePlan.waypoints.map((waypoint) => [waypoint.id, waypoint]));

const metadata = (
  routePlan: RoutePlan,
  primitiveKind: RoutePrimitiveMetadata["primitiveKind"],
  details: {
    waypointId?: string;
    legId?: string;
    side?: "portside" | "starboard";
  } = {},
): RoutePrimitiveMetadata => ({
  routeId: routePlan.id,
  sourceFormat: routePlan.sourceFormat,
  primitiveKind,
  ...(details.waypointId !== undefined ? { waypointId: details.waypointId } : {}),
  ...(details.legId !== undefined ? { legId: details.legId } : {}),
  ...(details.side !== undefined ? { side: details.side } : {}),
});

const degreesToRadians = (value: number): number =>
  value * Math.PI / 180;

const normalizeLongitudeDelta = (delta: number): number =>
  ((delta + 180) % 360 + 360) % 360 - 180;

const withZ = (
  position: RouteLayoutPosition,
  z: number,
): RouteLayoutPosition => ({
  ...position,
  z,
});
