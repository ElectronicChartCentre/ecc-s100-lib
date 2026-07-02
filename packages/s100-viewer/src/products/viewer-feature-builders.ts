import type { ModelSource, WmsSource } from "./sources.js";
import type {
  MapOverlayLayerSpec,
  MapOverlayStyle,
  VesselDimensions,
  VesselLayerSpec,
  VesselModelOptions,
  VesselPose,
  VesselReferencePoint,
  VesselStyle,
} from "./viewer-features.js";
import { MapOverlayStyles, VesselStyles } from "./viewer-features.js";
import {
  ProjectedMapLayerType,
  projectedMapSpecification,
  projectedSpatialExtent,
  type ProjectedMapTemplateOptions,
} from "./projected-map-template.js";
import {
  commonLayerFields,
  requestOptions,
  type LayerBuilderCommonOptions,
  type SourceRequestBuilderOptions,
} from "./builder-shared.js";

export type CreateVesselLayerOptions = LayerBuilderCommonOptions<VesselStyle> &
  SourceRequestBuilderOptions & {
    url: string;
    format?: ModelSource["format"];
    crs?: string;
    verticalDatum?: string;
    pose: VesselPose;
    dimensions?: VesselDimensions;
    referencePoint?: VesselReferencePoint;
    model?: VesselModelOptions;
  };

export type CreateMapOverlayWmsLayerOptions = LayerBuilderCommonOptions<MapOverlayStyle> &
  SourceRequestBuilderOptions & {
    url: string;
    layers: readonly string[];
    crs?: string;
    role?: MapOverlayLayerSpec["role"];
    styles?: readonly string[];
    version?: WmsSource["version"];
    format?: string;
    transparent?: boolean;
    parameters?: Record<string, string | number | boolean>;
  };

export type CreateMapOverlayWmsTemplateLayerOptions =
  LayerBuilderCommonOptions<MapOverlayStyle> &
    ProjectedMapTemplateOptions & {
      urlTemplate: string;
      layers?: readonly string[];
      crs?: string;
      role?: MapOverlayLayerSpec["role"];
    };

const mergeVesselStyle = (style: Partial<VesselStyle> | undefined): VesselStyle => ({
  ...VesselStyles.DEFAULT,
  ...style,
});

const mergeMapOverlayStyle = (
  style: Partial<MapOverlayStyle> | undefined,
): MapOverlayStyle => ({
  ...MapOverlayStyles.DEFAULT,
  ...style,
});

export const createVessel = (options: CreateVesselLayerOptions): VesselLayerSpec => ({
    id: options.id ?? "vessel",
    product: "vessel",
    ...commonLayerFields(options),
    source: {
      kind: "model",
      url: options.url,
      format: options.format ?? "glb",
      ...requestOptions(options),
      ...(options.crs !== undefined ? { crs: options.crs } : {}),
      ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
      ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
    },
    pose: options.pose,
    ...(options.dimensions !== undefined ? { dimensions: options.dimensions } : {}),
    ...(options.referencePoint !== undefined ? { referencePoint: options.referencePoint } : {}),
    ...(options.model !== undefined ? { model: compactRecord(options.model) as VesselModelOptions } : {}),
    style: mergeVesselStyle(options.style),
  });

export const createMapOverlayWms = (
  options: CreateMapOverlayWmsLayerOptions,
): MapOverlayLayerSpec => ({
  id: options.id ?? "map-overlay",
  product: "map-overlay",
  role: options.role ?? "overlay",
  ...commonLayerFields(options),
  source: {
    kind: "wms",
    url: options.url,
    layers: options.layers,
    transparent: options.transparent ?? true,
    ...requestOptions(options),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.styles !== undefined ? { styles: options.styles } : {}),
    ...(options.version !== undefined ? { version: options.version } : {}),
    ...(options.format !== undefined ? { format: options.format } : {}),
    ...(options.parameters !== undefined ? { parameters: options.parameters } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
  },
  style: mergeMapOverlayStyle(options.style),
});

export const createMapOverlayWmsTemplate = (
  options: CreateMapOverlayWmsTemplateLayerOptions,
): MapOverlayLayerSpec => {
  const common = commonLayerFields(options);
  const role = options.role ?? "overlay";
  const mapSpecification = projectedMapSpecification(
    options.id ?? "map-overlay",
    options.urlTemplate,
    options,
    mapLayerTypeForRole(role),
  );
  return {
    id: options.id ?? "map-overlay",
    product: "map-overlay",
    role,
    ...common,
    spatialExtent: options.spatialExtent ?? projectedSpatialExtent(options.extents),
    projectedMap: mapSpecification,
    ...(options.discardMode !== undefined ? { mapRendering: { discardMode: options.discardMode } } : {}),
    source: {
      kind: "wms-template",
      urlTemplate: options.urlTemplate,
      layers: options.layers ?? [options.id ?? "map-overlay"],
      ...(options.crs !== undefined ? { crs: options.crs } : {}),
    },
    style: mergeMapOverlayStyle(options.style),
  };
};

export const ViewerFeatureLayerBuilder = {
  VesselStyles,
  MapOverlayStyles,
  createVessel,
  createMapOverlayWms,
  createMapOverlayWmsTemplate,
};

const mapLayerTypeForRole = (role: MapOverlayLayerSpec["role"]): number => {
  if (role === "basemap") {
    return ProjectedMapLayerType.Base;
  }
  if (role === "mask") {
    return ProjectedMapLayerType.MaskLayer;
  }
  return ProjectedMapLayerType.BaseTransparent;
};

const compactRecord = (
  value: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
