import {
  EncStandard,
  S101Styles,
  S57Styles,
  type EncLayerRole,
  type EncLayerSpec,
  type EncStandard as EncStandardValue,
  type S101EncLayerSpec,
  type S57EncLayerSpec,
} from "./enc.js";
import type { WmsSource } from "./sources.js";
import type { S101EncStyle, S57EncStyle } from "./style.js";
import {
  ProjectedMap,
  ProjectedMapDiscardMode,
  ProjectedMapLayerType,
  projectedMapFromCenterExtent,
  projectedMapSpecification,
  projectedSpatialExtent,
  type ProjectedMapCenterExtentOptions,
  type ProjectedMapTemplateOptions,
} from "./projected-map-template.js";
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

type CreateEncWmsTemplateLayerBaseOptions<TStyle> =
  LayerBuilderCommonOptions<TStyle> &
    ProjectedMapTemplateOptions & {
      urlTemplate: string;
      layers?: readonly string[];
      crs?: string;
      role?: EncLayerRole;
    };

export type CreateS101WmsLayerOptions =
  CreateEncWmsLayerBaseOptions<S101EncStyle> & ProductSpecificationVersionOptions;

export type CreateS101WmtsLayerOptions =
  CreateEncWmtsLayerBaseOptions<S101EncStyle> & ProductSpecificationVersionOptions;

export type CreateS101WmsTemplateLayerOptions =
  CreateEncWmsTemplateLayerBaseOptions<S101EncStyle> & ProductSpecificationVersionOptions;

export type CreateS57WmsLayerOptions = CreateEncWmsLayerBaseOptions<S57EncStyle>;

export type CreateS57WmtsLayerOptions = CreateEncWmtsLayerBaseOptions<S57EncStyle>;

export type CreateS57WmsTemplateLayerOptions = CreateEncWmsTemplateLayerBaseOptions<S57EncStyle>;

export type CreateEncWmsPairLayerOptions = {
  id?: string;
  urlTemplate: string;
  role?: EncLayerRole;
  visible?: boolean;
  opacity?: number;
  layers?: readonly string[];
  scale?: number;
};

export type CreateEncWmsPairOptions =
  ProductSpecificationVersionOptions &
    Omit<ProjectedMapCenterExtentOptions, "scale" | "mapLayerType"> & {
      standard: EncStandardValue;
      transparent: CreateEncWmsPairLayerOptions;
      opaque?: CreateEncWmsPairLayerOptions;
    };

export type EncWmsPairLayerSpecs<TSpec extends EncLayerSpec = EncLayerSpec> = {
  transparent: TSpec;
  opaque?: TSpec;
};

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

export const createS101WmsTemplate = (
  options: CreateS101WmsTemplateLayerOptions,
): S101EncLayerSpec => {
  const common = commonLayerFields(options);
  const role = options.role ?? "overlay";
  const mapSpecification = projectedMapSpecification(
    options.id ?? "s101-enc",
    options.urlTemplate,
    options,
    mapLayerTypeForRole(role),
  );
  return {
    id: options.id ?? "s101-enc",
    product: EncStandard.S101,
    category: "enc",
    standard: EncStandard.S101,
    ...productSpecificationVersionField(options),
    role,
    ...common,
    spatialExtent: options.spatialExtent ?? projectedSpatialExtent(options.extents),
    projectedMap: mapSpecification,
    ...(options.discardMode !== undefined ? { mapRendering: { discardMode: options.discardMode } } : {}),
    source: {
      kind: "wms-template",
      urlTemplate: options.urlTemplate,
      layers: options.layers ?? [options.id ?? "s101-enc"],
      ...(options.crs !== undefined ? { crs: options.crs } : {}),
    },
    style: mergeS101Style(options.style),
  };
};

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

export const createS57WmsTemplate = (
  options: CreateS57WmsTemplateLayerOptions,
): S57EncLayerSpec => {
  const common = commonLayerFields(options);
  const role = options.role ?? "overlay";
  const mapSpecification = projectedMapSpecification(
    options.id ?? "s57-enc",
    options.urlTemplate,
    options,
    mapLayerTypeForRole(role),
  );
  return {
    id: options.id ?? "s57-enc",
    product: EncStandard.S57,
    category: "enc",
    standard: EncStandard.S57,
    role,
    ...common,
    spatialExtent: options.spatialExtent ?? projectedSpatialExtent(options.extents),
    projectedMap: mapSpecification,
    ...(options.discardMode !== undefined ? { mapRendering: { discardMode: options.discardMode } } : {}),
    source: {
      kind: "wms-template",
      urlTemplate: options.urlTemplate,
      layers: options.layers ?? [options.id ?? "s57-enc"],
      ...(options.crs !== undefined ? { crs: options.crs } : {}),
    },
    style: mergeS57Style(options.style),
  };
};

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

export function createEncWmsPair(
  options: CreateEncWmsPairOptions & { standard: typeof EncStandard.S101 },
): EncWmsPairLayerSpecs<S101EncLayerSpec>;
export function createEncWmsPair(
  options: CreateEncWmsPairOptions & { standard: typeof EncStandard.S57 },
): EncWmsPairLayerSpecs<S57EncLayerSpec>;
export function createEncWmsPair(options: CreateEncWmsPairOptions): EncWmsPairLayerSpecs {
  const transparent = createEncWmsTemplateFromPairLayer(options, options.transparent, "overlay");
  const opaque = options.opaque
    ? createEncWmsTemplateFromPairLayer(options, options.opaque, "basemap")
    : undefined;

  return {
    transparent,
    ...(opaque !== undefined ? { opaque } : {}),
  };
}

export const EncLayerBuilder = {
  EncStandard,
  ProjectedMap,
  ProjectedMapDiscardMode,
  ProjectedMapLayerType,
  S101Styles,
  S57Styles,
  createEncWmsPair,
  createS101Wms,
  createS101WmsTemplate,
  createS101Wmts,
  createS57Wms,
  createS57WmsTemplate,
  createS57Wmts,
};

const mapLayerTypeForRole = (role: EncLayerRole): number =>
  role === "basemap"
    ? ProjectedMapLayerType.Base
    : ProjectedMapLayerType.BaseTransparent;

const createEncWmsTemplateFromPairLayer = (
  options: CreateEncWmsPairOptions,
  layer: CreateEncWmsPairLayerOptions,
  defaultRole: EncLayerRole,
): EncLayerSpec => {
  const role = layer.role ?? defaultRole;
  const geometry = projectedMapFromCenterExtent({
    center: options.center,
    widthMeters: options.widthMeters,
    ...(options.heightMeters !== undefined ? { heightMeters: options.heightMeters } : {}),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.mapSubset !== undefined ? { mapSubset: options.mapSubset } : {}),
    ...(options.minLevel !== undefined ? { minLevel: options.minLevel } : {}),
    ...(options.maxLevel !== undefined ? { maxLevel: options.maxLevel } : {}),
    ...(options.quality !== undefined ? { quality: options.quality } : {}),
    ...(options.discardMode !== undefined ? { discardMode: options.discardMode } : {}),
    ...(layer.scale !== undefined ? { scale: layer.scale } : {}),
    mapLayerType: mapLayerTypeForRole(role),
  });
  const templateOptions = {
    urlTemplate: layer.urlTemplate,
    role,
    ...(layer.id !== undefined ? { id: layer.id } : {}),
    ...(layer.visible !== undefined ? { visible: layer.visible } : {}),
    ...(layer.opacity !== undefined ? { opacity: layer.opacity } : {}),
    ...(layer.layers !== undefined ? { layers: layer.layers } : {}),
    ...(options.productSpecificationVersion !== undefined
      ? { productSpecificationVersion: options.productSpecificationVersion }
      : {}),
    ...geometry,
  };

  if (options.standard === EncStandard.S57) {
    return createS57WmsTemplate(templateOptions);
  }
  return createS101WmsTemplate(templateOptions);
};
