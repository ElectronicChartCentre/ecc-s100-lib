import type {
  RouteLinePrimitive,
  RouteLayoutPosition,
  RoutePlan,
  RoutePointPrimitive,
} from "../route-plan.js";
import { metadata } from "./shared.js";
import type { RouteLayoutLegSection, RouteProjection } from "./types.js";

export const buildCenterline = (
  routePlan: RoutePlan,
  projection: RouteProjection,
  sections: readonly RouteLayoutLegSection[],
): RouteLinePrimitive => ({
  id: `${routePlan.id}:centerline`,
  positions: sections.length > 0
    ? mergeSectionPositions(sections)
    : routePlan.waypoints.map((waypoint) => projection.project(waypoint.position)),
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

const mergeSectionPositions = (
  sections: readonly RouteLayoutLegSection[],
): RouteLayoutPosition[] => {
  const positions: RouteLayoutPosition[] = [];
  for (const section of sections) {
    for (const position of section.centerline) {
      const previous = positions[positions.length - 1];
      if (
        previous &&
        Math.abs(previous.x - position.x) < 1e-6 &&
        Math.abs(previous.y - position.y) < 1e-6 &&
        Math.abs((previous.z ?? 0) - (position.z ?? 0)) < 1e-6
      ) {
        continue;
      }
      positions.push(position);
    }
  }
  return positions;
};
