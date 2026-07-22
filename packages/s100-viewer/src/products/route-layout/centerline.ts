import type {
  RouteLinePrimitive,
  RoutePlan,
  RoutePointPrimitive,
} from "../route-plan.js";
import { metadata } from "./shared.js";
import type { RouteProjection } from "./types.js";

export const buildCenterline = (
  routePlan: RoutePlan,
  projection: RouteProjection,
): RouteLinePrimitive => ({
  id: `${routePlan.id}:centerline`,
  positions: routePlan.waypoints.map((waypoint) => projection.project(waypoint.position)),
  metadata: metadata(routePlan, "centerline"),
});

export const buildWaypointPoints = (
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
