import type { RoutePlan, RoutePolygonPrimitive } from "../route-plan.js";
import { metadata, routeLegOffset, waypointMap } from "./shared.js";
import type { RouteProjection } from "./types.js";

export const buildCorridorPolygons = (
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
