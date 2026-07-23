import type { RoutePlan, RoutePolygonPrimitive } from "../route-plan.js";
import { routeSectionMetadata } from "./sections.js";
import type { RouteLayoutLegSection } from "./types.js";

export const buildCorridorPolygons = (
  routePlan: RoutePlan,
  sections: readonly RouteLayoutLegSection[],
): RoutePolygonPrimitive[] =>
  sections.flatMap((section) => {
    const starboard = section.starboardBoundary;
    const portside = section.portsideBoundary;
    const centerline = section.centerline;
    if (
      !starboard ||
      !portside ||
      centerline.length < 2 ||
      starboard.length < 2 ||
      portside.length < 2
    ) {
      return [];
    }
    const firstStarboardCenterline = centerline[0];
    const firstPortside = portside[0];
    if (!firstStarboardCenterline || !firstPortside) {
      return [];
    }
    const starboardRing = [
      ...centerline,
      ...[...starboard].reverse(),
      firstStarboardCenterline,
    ];
    const portsideRing = [
      ...portside,
      ...[...centerline].reverse(),
      firstPortside,
    ];
    return [
      {
        id: `${routePlan.id}:leg:${section.leg.id}:starboard-corridor`,
        rings: [starboardRing],
        metadata: routeSectionMetadata(routePlan, "corridor", section.leg.id, "starboard"),
      },
      {
        id: `${routePlan.id}:leg:${section.leg.id}:portside-corridor`,
        rings: [portsideRing],
        metadata: routeSectionMetadata(routePlan, "corridor", section.leg.id, "portside"),
      },
    ];
  });
