import type { RouteMeshPrimitive, RoutePlan } from "../route-plan.js";
import { metadata, routeLegOffset, waypointMap, withZ } from "./shared.js";
import type { RouteProjection } from "./types.js";

export const buildRouteVolumeMeshes = (
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
