import { computeRouteBounds } from "../route-geodesy.js";
import type { RoutePlan, RoutePlanLayout } from "../route-plan.js";
import { buildLegBoundaryLines } from "./boundaries.js";
import { buildCenterline, buildWaypointPoints } from "./centerline.js";
import { buildCorridorPolygons } from "./corridors.js";
import { buildTurnDebugGeometry } from "./debug.js";
import {
  createLocalTangentRouteProjection,
  resolveRouteProjection,
} from "./projection.js";
import { buildRouteVolumeMeshes } from "./routeVolume.js";
import type { RouteLayoutOptions } from "./types.js";

export type { RouteLayoutOptions, RouteProjection } from "./types.js";
export { createLocalTangentRouteProjection } from "./projection.js";

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
