import { S100ProductType } from "../layers/types.js";
import {
  S100ProductSpecificationVersions,
  S102Styles,
  S111Styles,
  type S102DebugOptions,
  type S102LayerSpec,
  type S102RenderingOptions,
  type S111LayerSpec,
} from "./iho-s100.js";
import type { HttpMethod, SourceMetadata, ThreeDTilesSource } from "./sources.js";
import type {
  ProductTimeOptions,
  S102BathymetryStyle,
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
    rendering?: S102RenderingOptions;
    debug?: S102DebugOptions;
    detailFactor?: number;
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

export const createS102 = (options: CreateS102LayerOptions): S102LayerSpec => {
  const rendering =
    options.rendering ?? (options.detailFactor !== undefined ? { detailFactor: options.detailFactor } : undefined);

  return {
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
    ...(rendering !== undefined ? { rendering } : {}),
    ...(options.debug !== undefined ? { debug: options.debug } : {}),
    style: mergeS102Style(options.style),
  };
};

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
  S102Styles,
  S111Styles,
  createS102,
  createS111,
  createStaticS111,
};
