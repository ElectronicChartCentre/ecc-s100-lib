import type { SpatialExtent } from "../../coordinates/types.js";
import type { S100Layer } from "../../layers/types.js";
import type { S100Scene } from "../../scene/types.js";
import type { RouteLayoutOptions } from "../route-layout.js";
import type {
  RouteDiagnostic,
  RouteFeatureStyle,
  RoutePlan,
  RoutePlanLayerSpec,
  RoutePlanLayout,
} from "../route-plan.js";

export type RoutePlanLayer = S100Layer<RoutePlanLayerSpec>;

export type RouteFetchRequest = {
  headers?: Record<string, string>;
  credentials?: "omit" | "same-origin" | "include";
  signal?: AbortSignal;
};

export type RouteFetchResponse = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  text(): Promise<string>;
};

export type RouteFetchLike = (
  url: string,
  request?: RouteFetchRequest,
) => Promise<RouteFetchResponse>;

export type RouteTextSource = {
  text(): Promise<string> | string;
};

export type RtzRouteSource =
  | {
      kind: "url";
      url: string;
      request?: RouteFetchRequest;
    }
  | {
      kind: "file";
      file: RouteTextSource;
      name?: string;
    }
  | {
      kind: "xml";
      xml: string;
      sourceId?: string;
    }
  | {
      kind: "route-plan";
      routePlan: RoutePlan;
    };

export type RouteFeatureLayerOptions = {
  id?: string;
  title?: string;
  visible?: boolean;
  opacity?: number;
  zOrder?: number;
  style?: Partial<RouteFeatureStyle>;
  metadata?: RoutePlanLayerSpec["metadata"];
  spatialExtent?: SpatialExtent;
  extensions?: Record<string, unknown>;
  layoutOptions?: Omit<RouteLayoutOptions, "georeference">;
  signal?: AbortSignal;
};

export type AddRtzRouteOptions = RouteFeatureLayerOptions & {
  source: RtzRouteSource;
};

export type AddRoutePlanOptions = RouteFeatureLayerOptions & {
  routePlan: RoutePlan;
};

export type RouteFeatureSessionOptions = {
  scene: S100Scene;
  fetchHandler?: RouteFetchLike;
  defaults?: Partial<RouteFeatureStyle>;
  layoutOptions?: Omit<RouteLayoutOptions, "georeference">;
  onDiagnostics?: (diagnostics: readonly RouteDiagnostic[]) => void;
  onRouteAdded?: (route: RouteFeatureHandle) => void;
};

export type RouteFeatureHandle = {
  readonly id: string;
  readonly routePlan: RoutePlan;
  readonly layout: RoutePlanLayout;
  readonly diagnostics: readonly RouteDiagnostic[];
  readonly layer: RoutePlanLayer;
  setVisible(visible: boolean): Promise<void>;
  setOpacity(opacity: number): Promise<void>;
  setStyle(style: Partial<RouteFeatureStyle>): Promise<void>;
  remove(): Promise<void>;
};
