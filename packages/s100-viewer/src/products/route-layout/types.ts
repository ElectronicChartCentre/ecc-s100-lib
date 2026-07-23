import type { SceneGeoreference } from "../../coordinates/types.js";
import type {
  GeographicPosition,
  RouteDiagnostic,
  RouteLayoutPosition,
  RouteWaypointLeg,
} from "../route-plan.js";

export type RouteProjection = {
  crs?: string;
  origin?: GeographicPosition;
  project(position: GeographicPosition): RouteLayoutPosition;
};

export type RouteLayoutOptions = {
  georeference?: SceneGeoreference;
  projection?: RouteProjection;
  includeCorridor?: boolean;
  includeXtdBoundaries?: boolean;
  includeRouteVolume?: boolean;
  includeRouteSides?: boolean;
  includeTurnDebugGeometry?: boolean;
  turnArcSegmentAngleDegrees?: number;
  turnDebugSegments?: number;
  seaLevelMeters?: number;
  routeVolumeBottomDepthMeters?: number;
};

export type ResolvedProjection = {
  projection: RouteProjection;
  diagnostics: readonly RouteDiagnostic[];
};

export type RouteLayoutLegSection = {
  id: string;
  leg: RouteWaypointLeg;
  centerline: readonly RouteLayoutPosition[];
  portsideBoundary?: readonly RouteLayoutPosition[];
  starboardBoundary?: readonly RouteLayoutPosition[];
};

export type RouteLayoutLegSections = {
  sections: readonly RouteLayoutLegSection[];
  diagnostics: readonly RouteDiagnostic[];
};
