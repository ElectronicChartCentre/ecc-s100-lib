import type { BaseLayerSpec } from "../layers/types.js";
import {
  ROUTE_S421_DEFAULT_STYLE,
  createRouteDebug3dStyle,
  createS421Hybrid3dRouteStyle,
  createS421RouteStyle,
} from "../internal/products/routeStyle.js";
import type { RoutePlanSource } from "./sources.js";
import type { ColorValue, OpacityVisibilityStyle } from "./style.js";

export const RoutePlanProductType = {
  RoutePlan: "route-plan",
} as const;

export type RoutePlanProductType =
  (typeof RoutePlanProductType)[keyof typeof RoutePlanProductType];

export type RouteSourceFormat = "rtz" | "s421" | "route-plan";

export type GeographicPosition = {
  lon: number;
  lat: number;
  heightMeters?: number;
};

export type RouteInfo = {
  name?: string;
  routeName?: string;
  author?: string;
  status?: string;
  validFrom?: string;
  validTo?: string;
  vesselName?: string;
  vesselMmsi?: string;
  vesselImo?: string;
  values: Record<string, string>;
};

export type RouteExtension = {
  manufacturer?: string;
  name?: string;
  version?: string;
  attributes: Record<string, string>;
  children: readonly RouteRawXmlNode[];
  text?: string;
};

export type RouteRawXmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: readonly RouteRawXmlNode[];
  text?: string;
};

export type RouteWaypoint = {
  id: string;
  revision?: string;
  name?: string;
  position: GeographicPosition;
  radiusMeters?: number;
  sourceRadiusNm?: number;
  extensions: readonly RouteExtension[];
};

export type RouteGeometryType = "loxodrome" | "orthodrome" | "unknown";

export type RouteWaypointLeg = {
  id: string;
  fromWaypointId: string;
  toWaypointId: string;
  geometryType: RouteGeometryType;
  starboardXtdMeters?: number;
  portsideXtdMeters?: number;
  sourceStarboardXtdNm?: number;
  sourcePortsideXtdNm?: number;
  safetyDepthMeters?: number;
  safetyContourMeters?: number;
  speedMinKnots?: number;
  speedMaxKnots?: number;
  draughtMeters?: number;
  ukcMeters?: number;
  mastheadMeters?: number;
  notes?: string;
  report?: string;
  info?: string;
  extensions: readonly RouteExtension[];
};

export type RouteScheduleElement = {
  waypointId?: string;
  etd?: string;
  eta?: string;
  etdWindowBefore?: string;
  etdWindowAfter?: string;
  etaWindowBefore?: string;
  etaWindowAfter?: string;
  speedKnots?: number;
  speedWindowKnots?: number;
  values: Record<string, string>;
  extensions: readonly RouteExtension[];
};

export type RouteSchedule = {
  id?: string;
  name?: string;
  elements: readonly RouteScheduleElement[];
  values: Record<string, string>;
  extensions: readonly RouteExtension[];
};

export type RouteDiagnosticSeverity = "info" | "warning" | "error";

export type RouteDiagnostic = {
  code: string;
  severity: RouteDiagnosticSeverity;
  message: string;
  path?: string;
  values?: Record<string, unknown>;
};

export type RoutePlan = {
  id: string;
  sourceFormat: RouteSourceFormat;
  sourceVersion?: string;
  routeInfo: RouteInfo;
  waypoints: readonly RouteWaypoint[];
  legs: readonly RouteWaypointLeg[];
  schedules: readonly RouteSchedule[];
  extensions: readonly RouteExtension[];
  diagnostics: readonly RouteDiagnostic[];
  raw?: unknown;
};

export type RouteBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type RoutePrimitiveMetadata = {
  routeId: string;
  sourceFormat: RouteSourceFormat;
  primitiveKind: "centerline" | "waypoint" | "xtd-boundary" | "corridor" | "route-volume" | "debug";
  waypointId?: string;
  legId?: string;
  side?: "portside" | "starboard";
  depthBand?: "safety-depth" | "below-safety-depth";
};

export type RouteLayoutPosition = {
  x: number;
  y: number;
  z?: number;
};

export type RouteLinePrimitive = {
  id: string;
  positions: readonly RouteLayoutPosition[];
  metadata: RoutePrimitiveMetadata;
};

export type RoutePointPrimitive = {
  id: string;
  position: RouteLayoutPosition;
  metadata: RoutePrimitiveMetadata;
};

export type RoutePolygonPrimitive = {
  id: string;
  rings: readonly (readonly RouteLayoutPosition[])[];
  metadata: RoutePrimitiveMetadata;
};

export type RouteMeshPrimitive = {
  id: string;
  positions: readonly RouteLayoutPosition[];
  indices: readonly number[];
  metadata: RoutePrimitiveMetadata;
};

export type RoutePlanLayout = {
  routeId: string;
  sourceFormat: RouteSourceFormat;
  origin?: GeographicPosition;
  bounds?: RouteBounds;
  centerline?: RouteLinePrimitive;
  waypoints: readonly RoutePointPrimitive[];
  legBoundaries: readonly RouteLinePrimitive[];
  corridors: readonly RoutePolygonPrimitive[];
  routeVolumes: readonly RouteMeshPrimitive[];
  debug: readonly (RouteLinePrimitive | RoutePointPrimitive | RoutePolygonPrimitive | RouteMeshPrimitive)[];
  diagnostics: readonly RouteDiagnostic[];
};

export type RoutePortrayalMode = "s421";
export type RouteVisualizationMode = "standard" | "hybrid-3d" | "debug-3d";

export type RouteFeatureStyle = OpacityVisibilityStyle & {
  portrayal: RoutePortrayalMode;
  visualization: RouteVisualizationMode;
  showCenterline: boolean;
  showWaypoints: boolean;
  showCorridor: boolean;
  showXtdBoundaries: boolean;
  showRouteVolume: boolean;
  showRouteSides: boolean;
  showTurnDebugGeometry: boolean;
  centerlineColor?: ColorValue;
  waypointColor?: ColorValue;
  portsideBoundaryColor?: ColorValue;
  starboardBoundaryColor?: ColorValue;
  corridorFillColor?: ColorValue;
  routeVolumeFillColor?: ColorValue;
};

export interface RoutePlanLayerSpec
  extends BaseLayerSpec<typeof RoutePlanProductType.RoutePlan> {
  source: RoutePlanSource<RoutePlan, RoutePlanLayout>;
  style: RouteFeatureStyle;
}

export const RouteStyleDefaults = {
  S421: ROUTE_S421_DEFAULT_STYLE,
} as const;

export const s421RouteStyle = (
  options: Partial<RouteFeatureStyle> = {},
): RouteFeatureStyle => createS421RouteStyle(options);

export const s421Hybrid3dRouteStyle = (
  options: Partial<RouteFeatureStyle> = {},
): RouteFeatureStyle => createS421Hybrid3dRouteStyle(options);

export const routeDebug3dStyle = (
  options: Partial<RouteFeatureStyle> = {},
): RouteFeatureStyle => createRouteDebug3dStyle(options);

export const RouteStyles = {
  s421Defaults: s421RouteStyle,
  s421Hybrid3d: s421Hybrid3dRouteStyle,
  routeDebug3d: routeDebug3dStyle,
};

export const createEmptyRoutePlanLayout = (
  routePlan: Pick<RoutePlan, "id" | "sourceFormat" | "diagnostics">,
): RoutePlanLayout => ({
  routeId: routePlan.id,
  sourceFormat: routePlan.sourceFormat,
  waypoints: [],
  legBoundaries: [],
  corridors: [],
  routeVolumes: [],
  debug: [],
  diagnostics: routePlan.diagnostics,
});
