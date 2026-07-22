import { destinationPoint } from "../route-geodesy.js";
import type { RouteLinePrimitive, RoutePlan } from "../route-plan.js";
import { metadata } from "./shared.js";
import type { RouteProjection } from "./types.js";

export const buildTurnDebugGeometry = (
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
