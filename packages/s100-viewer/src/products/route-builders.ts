import type { RoutePlanSource } from "./sources.js";
import {
  createEmptyRoutePlanLayout,
  RoutePlanProductType,
  RouteStyles,
  type RouteFeatureStyle,
  type RoutePlan,
  type RoutePlanLayerSpec,
  type RoutePlanLayout,
} from "./route-plan.js";
import {
  commonLayerFields,
  type LayerBuilderCommonOptions,
} from "./builder-shared.js";

export type CreateRoutePlanLayerOptions =
  LayerBuilderCommonOptions<RouteFeatureStyle> & {
    routePlan: RoutePlan;
    layout?: RoutePlanLayout;
  };

export const mergeRouteStyle = (
  style: Partial<RouteFeatureStyle> | undefined,
): RouteFeatureStyle => RouteStyles.s421Defaults(style);

export const createRoutePlan = (
  options: CreateRoutePlanLayerOptions,
): RoutePlanLayerSpec => {
  const layout = options.layout ?? createEmptyRoutePlanLayout(options.routePlan);
  const source: RoutePlanSource<RoutePlan, RoutePlanLayout> = {
    kind: "route-plan",
    routePlan: options.routePlan,
    layout,
  };

  return {
    id: options.id ?? options.routePlan.id,
    product: RoutePlanProductType.RoutePlan,
    ...commonLayerFields(options),
    source,
    style: mergeRouteStyle(options.style),
  };
};

export const RoutePlanLayerBuilder = {
  RouteStyles,
  createRoutePlan,
};

