import {
  EncStandard,
  S101Styles,
  S57Styles,
  type EncLayerRole,
  type S101EncLayerSpec,
  type S57EncLayerSpec,
} from "./enc.js";
import type { WmsSource } from "./sources.js";
import type { S101EncStyle, S57EncStyle } from "./style.js";
import {
  commonLayerFields,
  productSpecificationVersionField,
  requestOptions,
  type LayerBuilderCommonOptions,
  type ProductSpecificationVersionOptions,
  type SourceRequestBuilderOptions,
} from "./builder-shared.js";

type CreateEncWmsLayerBaseOptions<TStyle> =
  LayerBuilderCommonOptions<TStyle> &
    SourceRequestBuilderOptions & {
      url: string;
      layers: readonly string[];
      crs?: string;
      role?: EncLayerRole;
      styles?: readonly string[];
      version?: WmsSource["version"];
      format?: string;
      transparent?: boolean;
      parameters?: Record<string, string | number | boolean>;
    };

type CreateEncWmtsLayerBaseOptions<TStyle> =
  LayerBuilderCommonOptions<TStyle> &
    SourceRequestBuilderOptions & {
      url: string;
      layer: string;
      tileMatrixSet: string;
      crs?: string;
      role?: EncLayerRole;
      styleName?: string;
      format?: string;
      parameters?: Record<string, string | number | boolean>;
    };

export type CreateS101WmsLayerOptions =
  CreateEncWmsLayerBaseOptions<S101EncStyle> & ProductSpecificationVersionOptions;

export type CreateS101WmtsLayerOptions =
  CreateEncWmtsLayerBaseOptions<S101EncStyle> & ProductSpecificationVersionOptions;

export type CreateS57WmsLayerOptions = CreateEncWmsLayerBaseOptions<S57EncStyle>;

export type CreateS57WmtsLayerOptions = CreateEncWmtsLayerBaseOptions<S57EncStyle>;

const mergeS101Style = (style: Partial<S101EncStyle> | undefined): S101EncStyle => ({
  ...S101Styles.DEFAULT,
  ...style,
  cutout: {
    ...S101Styles.DEFAULT.cutout,
    ...style?.cutout,
  },
});

const mergeS57Style = (style: Partial<S57EncStyle> | undefined): S57EncStyle => ({
  ...S57Styles.DEFAULT,
  ...style,
  cutout: {
    ...S57Styles.DEFAULT.cutout,
    ...style?.cutout,
  },
});

export const createS101Wms = (options: CreateS101WmsLayerOptions): S101EncLayerSpec => ({
  id: options.id ?? "s101-enc",
  product: EncStandard.S101,
  category: "enc",
  standard: EncStandard.S101,
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

export const createS101Wmts = (options: CreateS101WmtsLayerOptions): S101EncLayerSpec => ({
  id: options.id ?? "s101-enc",
  product: EncStandard.S101,
  category: "enc",
  standard: EncStandard.S101,
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

export const createS57Wms = (options: CreateS57WmsLayerOptions): S57EncLayerSpec => ({
  id: options.id ?? "s57-enc",
  product: EncStandard.S57,
  category: "enc",
  standard: EncStandard.S57,
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
  style: mergeS57Style(options.style),
});

export const createS57Wmts = (options: CreateS57WmtsLayerOptions): S57EncLayerSpec => ({
  id: options.id ?? "s57-enc",
  product: EncStandard.S57,
  category: "enc",
  standard: EncStandard.S57,
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
  style: mergeS57Style(options.style),
});

export const EncLayerBuilder = {
  EncStandard,
  S101Styles,
  S57Styles,
  createS101Wms,
  createS101Wmts,
  createS57Wms,
  createS57Wmts,
};
