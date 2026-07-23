import type { RouteLinePrimitive, RoutePlan } from "../route-plan.js";
import { routeSectionMetadata } from "./sections.js";
import type { RouteLayoutLegSection } from "./types.js";

export const buildLegBoundaryLines = (
  routePlan: RoutePlan,
  sections: readonly RouteLayoutLegSection[],
): RouteLinePrimitive[] =>
  sections.flatMap((section) => {
    const starboard = section.starboardBoundary;
    const portside = section.portsideBoundary;
    if (!starboard || !portside || starboard.length < 2 || portside.length < 2) {
      return [];
    }
    return [
      {
        id: `${routePlan.id}:leg:${section.leg.id}:portside-xtd`,
        positions: portside,
        metadata: routeSectionMetadata(routePlan, "xtd-boundary", section.leg.id, "portside"),
      },
      {
        id: `${routePlan.id}:leg:${section.leg.id}:starboard-xtd`,
        positions: starboard,
        metadata: routeSectionMetadata(routePlan, "xtd-boundary", section.leg.id, "starboard"),
      },
    ];
  });
