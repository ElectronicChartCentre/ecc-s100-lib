import type { RouteLinePrimitive, RoutePlan } from "../route-plan.js";
import { metadata, routeLegOffset, waypointMap } from "./shared.js";
import type { RouteProjection } from "./types.js";

export const buildLegBoundaryLines = (
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
