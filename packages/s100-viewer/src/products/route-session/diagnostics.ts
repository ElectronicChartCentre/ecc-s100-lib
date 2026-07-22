import type { RoutePlan } from "../route-plan.js";
import type { RouteFeatureLayerOptions } from "./types.js";

export const routeTitle = (
  options: RouteFeatureLayerOptions,
  routePlan: RoutePlan,
): string | undefined =>
  options.title ?? routePlan.routeInfo.name ?? routePlan.routeInfo.routeName;
