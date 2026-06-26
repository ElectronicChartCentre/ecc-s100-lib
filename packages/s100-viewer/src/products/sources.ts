export type HttpMethod = "GET" | "POST";

export type ServiceReadySource =
  | ThreeDTilesSource
  | WmsSource
  | WmsTemplateSource
  | WmtsSource
  | RestJsonSource
  | StaticJsonSource
  | ModelSource
  | MvtSource;

export type SourceMetadata = {
  id?: string;
  title?: string;
  description?: string;
  attribution?: string;
  updatedAt?: Date;
  values?: Record<string, unknown>;
};

export type SourceRequestOptions = {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  credentials?: "omit" | "same-origin" | "include";
};

export type ThreeDTilesSource = SourceRequestOptions & {
  kind: "3d-tiles";
  url: string;
  crs?: string;
  verticalDatum?: string;
  ellipsoid?: "WGS84";
  sourceFrame?: "projected" | "ecef" | "engine-local";
  metadata?: SourceMetadata;
};

export type WmsSource = SourceRequestOptions & {
  kind: "wms";
  url: string;
  layers: readonly string[];
  styles?: readonly string[];
  version?: "1.1.1" | "1.3.0";
  format?: string;
  transparent?: boolean;
  crs?: string;
  parameters?: Record<string, string | number | boolean>;
  metadata?: SourceMetadata;
};

export type WmsTemplateSource = SourceRequestOptions & {
  kind: "wms-template";
  urlTemplate: string;
  layers?: readonly string[];
  crs?: string;
  metadata?: SourceMetadata;
};

export type WmtsSource = SourceRequestOptions & {
  kind: "wmts";
  url: string;
  layer: string;
  tileMatrixSet: string;
  style?: string;
  format?: string;
  crs?: string;
  parameters?: Record<string, string | number | boolean>;
  metadata?: SourceMetadata;
};

export type MvtSource = SourceRequestOptions & {
  kind: "mvt";
  urlTemplate: string;
  layer?: string;
  crs?: string;
  metadata?: SourceMetadata;
};

export type RestJsonSource<TData = unknown> = SourceRequestOptions & {
  kind: "rest-json";
  url: string;
  method?: HttpMethod;
  body?: unknown;
  schema?: string;
  crs?: string;
  verticalDatum?: string;
  metadata?: SourceMetadata;
  sample?: TData;
};

export type StaticJsonSource<TData = unknown> = {
  kind: "static-json";
  data: TData;
  crs?: string;
  verticalDatum?: string;
  metadata?: SourceMetadata;
};

export type ModelSource = SourceRequestOptions & {
  kind: "model";
  url: string;
  format: "glb" | "gltf";
  crs?: string;
  verticalDatum?: string;
  metadata?: SourceMetadata;
};

export const isServiceReadySource = (source: unknown): source is ServiceReadySource => {
  if (!source || typeof source !== "object" || !("kind" in source)) {
    return false;
  }

  const kind = (source as { kind: string }).kind;
  return ["3d-tiles", "wms", "wms-template", "wmts", "rest-json", "static-json", "model", "mvt"].includes(kind);
};
