import type {
  RouteDiagnostic,
  RouteFeatureStyle,
  RoutePlan,
  RoutePlanLayout,
} from "../../products/route-plan.js";

export const ROUTE_S421_DEFAULT_STYLE = {
  visible: true,
  opacity: 1,
  portrayal: "s421",
  visualization: "standard",
  showCenterline: true,
  showWaypoints: true,
  showCorridor: true,
  showXtdBoundaries: true,
  showRouteVolume: false,
  showRouteSides: false,
  showTurnDebugGeometry: false,
  centerlineColor: "#6f43ff",
  waypointColor: "#ffffff",
  portsideBoundaryColor: "#e53935",
  starboardBoundaryColor: "#43a047",
  corridorFillColor: { r: 0.42, g: 0.26, b: 1, a: 0.18 },
  routeVolumeFillColor: { r: 0.14, g: 0.48, b: 0.9, a: 0.22 },
} satisfies RouteFeatureStyle;

export const createS421RouteStyle = (
  options: Partial<RouteFeatureStyle> = {},
): RouteFeatureStyle => ({
  ...ROUTE_S421_DEFAULT_STYLE,
  ...options,
});

export const createS421Hybrid3dRouteStyle = (
  options: Partial<RouteFeatureStyle> = {},
): RouteFeatureStyle => ({
  ...ROUTE_S421_DEFAULT_STYLE,
  visualization: "hybrid-3d",
  showRouteVolume: true,
  showRouteSides: true,
  ...options,
});

export const createRouteDebug3dStyle = (
  options: Partial<RouteFeatureStyle> = {},
): RouteFeatureStyle => ({
  ...ROUTE_S421_DEFAULT_STYLE,
  visualization: "debug-3d",
  showRouteVolume: true,
  showRouteSides: true,
  showTurnDebugGeometry: true,
  ...options,
});

export const setRouteHybrid3d = (
  current: RouteFeatureStyle,
  enabled: boolean,
): RouteFeatureStyle => ({
  ...(enabled ? createS421Hybrid3dRouteStyle(current) : createS421RouteStyle(current)),
  visualization: enabled ? "hybrid-3d" : "standard",
  showRouteVolume: enabled,
  showRouteSides: enabled,
});

export const setRouteDebugGeometryVisible = (
  current: RouteFeatureStyle,
  visible: boolean,
): RouteFeatureStyle => ({
  ...current,
  showTurnDebugGeometry: visible,
});

export const mergeRouteDiagnostics = (
  routePlan: Pick<RoutePlan, "diagnostics">,
  layout: Pick<RoutePlanLayout, "diagnostics"> | null | undefined,
): readonly RouteDiagnostic[] => [
  ...routePlan.diagnostics,
  ...(layout?.diagnostics ?? []),
];

