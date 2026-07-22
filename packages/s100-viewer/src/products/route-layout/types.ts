import type { SceneGeoreference } from "../../coordinates/types.js";
import type {
  GeographicPosition,
  RouteDiagnostic,
  RouteLayoutPosition,
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
  turnDebugSegments?: number;
  seaLevelMeters?: number;
};

export type ResolvedProjection = {
  projection: RouteProjection;
  diagnostics: readonly RouteDiagnostic[];
};
