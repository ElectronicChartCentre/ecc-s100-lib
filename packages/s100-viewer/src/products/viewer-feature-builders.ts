import type { ModelSource, WmsSource } from "./sources.js";
import type { MapOverlayLayerSpec, MapOverlayStyle, VesselLayerSpec, VesselPose, VesselStyle } from "./viewer-features.js";
import { MapOverlayStyles, VesselStyles } from "./viewer-features.js";
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

export const ViewerFeatureLayerBuilder = {
  VesselStyles,
  MapOverlayStyles,
  createVessel,
  createMapOverlayWms,
};
