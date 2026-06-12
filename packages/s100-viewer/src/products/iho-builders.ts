import { S100ProductType } from "../layers/types.js";
import {
  S100ProductSpecificationVersions,
  S101Styles,
  S102Styles,
  S104Styles,
  S111Styles,
  type S101EncLayerSpec,
  type S101LayerSpec,
  type S102LayerSpec,
  type S104LayerSpec,
  type S111LayerSpec,
} from "./iho-s100.js";
import type { HttpMethod, SourceMetadata, ThreeDTilesSource, WmsSource } from "./sources.js";
import type {
  ProductTimeOptions,
  S101EncStyle,
  S102BathymetryStyle,
  S104WaterLevelStyle,
  S111SurfaceCurrentStyle,
} from "./style.js";
import {
  commonLayerFields,
  productSpecificationVersionField,
  requestOptions,
  type LayerBuilderCommonOptions,
  type ProductSpecificationVersionOptions,
  type SourceRequestBuilderOptions,
} from "./builder-shared.js";

export type CreateS102LayerOptions = LayerBuilderCommonOptions<S102BathymetryStyle> &
  ProductSpecificationVersionOptions &
  SourceRequestBuilderOptions & {
    url: string;
    crs?: string;
    verticalDatum?: string;
    ellipsoid?: "WGS84";
    sourceFrame?: ThreeDTilesSource["sourceFrame"];
  };

export type CreateS101WmsLayerOptions = LayerBuilderCommonOptions<S101EncStyle> &
  ProductSpecificationVersionOptions &
  SourceRequestBuilderOptions & {
    url: string;
    layers: readonly string[];
    crs?: string;
    role?: S101EncLayerSpec["role"];
    styles?: readonly string[];
    version?: WmsSource["version"];
    format?: string;
    transparent?: boolean;
    parameters?: Record<string, string | number | boolean>;
  };

export type CreateS101WmtsLayerOptions = LayerBuilderCommonOptions<S101EncStyle> &
  ProductSpecificationVersionOptions &
  SourceRequestBuilderOptions & {
    url: string;
    layer: string;
    tileMatrixSet: string;
    crs?: string;
    role?: S101EncLayerSpec["role"];
    styleName?: string;
    format?: string;
    parameters?: Record<string, string | number | boolean>;
  };

export type CreateS104LayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<S104WaterLevelStyle> &
    ProductSpecificationVersionOptions &
    SourceRequestBuilderOptions & {
      url: string;
      crs?: string;
      verticalDatum?: string;
      method?: HttpMethod;
      body?: unknown;
      schema?: string;
      sample?: TData;
      time?: ProductTimeOptions;
    };

export type CreateStaticS104LayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<S104WaterLevelStyle> &
    ProductSpecificationVersionOptions & {
      data: TData;
      crs?: string;
      verticalDatum?: string;
      sourceMetadata?: SourceMetadata;
      time?: ProductTimeOptions;
    };

export type CreateS111LayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<S111SurfaceCurrentStyle> &
    ProductSpecificationVersionOptions &
    SourceRequestBuilderOptions & {
      url: string;
      crs?: string;
      verticalDatum?: string;
      method?: HttpMethod;
      body?: unknown;
      schema?: string;
      sample?: TData;
      time?: ProductTimeOptions;
    };

export type CreateStaticS111LayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<S111SurfaceCurrentStyle> &
    ProductSpecificationVersionOptions & {
      data: TData;
      crs?: string;
      verticalDatum?: string;
      sourceMetadata?: SourceMetadata;
      time?: ProductTimeOptions;
    };

const mergeS102Style = (
  style: Partial<S102BathymetryStyle> | undefined,
): S102BathymetryStyle => ({
  ...S102Styles.DEFAULT,
  ...style,
  contours: {
    ...S102Styles.DEFAULT.contours,
    ...style?.contours,
  },
});

const mergeS101Style = (style: Partial<S101EncStyle> | undefined): S101EncStyle => ({
  ...S101Styles.DEFAULT,
  ...style,
  cutout: {
    ...S101Styles.DEFAULT.cutout,
    ...style?.cutout,
  },
});

const mergeS104Style = (
  style: Partial<S104WaterLevelStyle> | undefined,
): S104WaterLevelStyle => ({
  ...S104Styles.DEFAULT,
  ...style,
});

const mergeS111Style = (
  style: Partial<S111SurfaceCurrentStyle> | undefined,
): S111SurfaceCurrentStyle => ({
  ...S111Styles.DEFAULT,
  ...style,
  legend: {
    ...S111Styles.DEFAULT.legend,
    ...style?.legend,
  },
});

export const createS102 = (options: CreateS102LayerOptions): S102LayerSpec => ({
  id: options.id ?? "s102-bathymetry",
  product: S100ProductType.S102,
  ...productSpecificationVersionField(options),
  ...commonLayerFields(options),
  source: {
    kind: "3d-tiles",
    url: options.url,
    ...requestOptions(options),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.ellipsoid !== undefined ? { ellipsoid: options.ellipsoid } : {}),
    ...(options.sourceFrame !== undefined ? { sourceFrame: options.sourceFrame } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
  },
  style: mergeS102Style(options.style),
});

export const createS101Wms = (options: CreateS101WmsLayerOptions): S101LayerSpec => ({
  id: options.id ?? "s101-enc",
  product: S100ProductType.S101,
  ...productSpecificationVersionField(options),
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
  style: mergeS101Style(options.style),
});

export const createS101Wmts = (options: CreateS101WmtsLayerOptions): S101LayerSpec => ({
  id: options.id ?? "s101-enc",
  product: S100ProductType.S101,
  ...productSpecificationVersionField(options),
  role: options.role ?? "overlay",
  ...commonLayerFields(options),
  source: {
    kind: "wmts",
    url: options.url,
    layer: options.layer,
    tileMatrixSet: options.tileMatrixSet,
    ...requestOptions(options),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.styleName !== undefined ? { style: options.styleName } : {}),
    ...(options.format !== undefined ? { format: options.format } : {}),
    ...(options.parameters !== undefined ? { parameters: options.parameters } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
  },
  style: mergeS101Style(options.style),
});

export const createS104 = <TData = unknown>(options: CreateS104LayerOptions<TData>): S104LayerSpec => ({
  id: options.id ?? "s104-water-level",
  product: S100ProductType.S104,
  ...productSpecificationVersionField(options),
  ...commonLayerFields(options),
  source: {
    kind: "rest-json",
    url: options.url,
    ...requestOptions(options),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.method !== undefined ? { method: options.method } : {}),
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.schema !== undefined ? { schema: options.schema } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
    ...(options.sample !== undefined ? { sample: options.sample } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeS104Style(options.style),
});

export const createStaticS104 = <TData = unknown>(
  options: CreateStaticS104LayerOptions<TData>,
): S104LayerSpec => ({
  id: options.id ?? "s104-water-level",
  product: S100ProductType.S104,
  ...productSpecificationVersionField(options),
  ...commonLayerFields(options),
  source: {
    kind: "static-json",
    data: options.data,
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeS104Style(options.style),
});

export const createS111 = <TData = unknown>(options: CreateS111LayerOptions<TData>): S111LayerSpec => ({
  id: options.id ?? "s111-currents",
  product: S100ProductType.S111,
  ...productSpecificationVersionField(options),
  ...commonLayerFields(options),
  source: {
    kind: "rest-json",
    url: options.url,
    ...requestOptions(options),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.method !== undefined ? { method: options.method } : {}),
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.schema !== undefined ? { schema: options.schema } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
    ...(options.sample !== undefined ? { sample: options.sample } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeS111Style(options.style),
});

export const createStaticS111 = <TData = unknown>(
  options: CreateStaticS111LayerOptions<TData>,
): S111LayerSpec => ({
  id: options.id ?? "s111-currents",
  product: S100ProductType.S111,
  ...productSpecificationVersionField(options),
  ...commonLayerFields(options),
  source: {
    kind: "static-json",
    data: options.data,
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeS111Style(options.style),
});

export const S100IhoProductLayerBuilder = {
  ProductSpecificationVersions: S100ProductSpecificationVersions,
  S101Styles,
  S102Styles,
  S104Styles,
  S111Styles,
  createS102,
  createS101Wms,
  createS101Wmts,
  createS104,
  createStaticS104,
  createS111,
  createStaticS111,
};
