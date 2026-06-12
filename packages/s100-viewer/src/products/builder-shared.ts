import type { SpatialExtent } from "../coordinates/types.js";
import type { BaseLayerSpec } from "../layers/types.js";
import {
  S100ProductSpecificationVersions,
  type S100ProductSpecificationVersion,
} from "./iho-s100.js";
import type { SourceMetadata, SourceRequestOptions } from "./sources.js";

export type LayerBuilderCommonOptions<TStyle> = {
  id?: string;
  title?: string;
  visible?: boolean;
  opacity?: number;
  zOrder?: number;
  style?: Partial<TStyle>;
  metadata?: BaseLayerSpec["metadata"];
  spatialExtent?: SpatialExtent;
  extensions?: Record<string, unknown>;
};

export type SourceRequestBuilderOptions = SourceRequestOptions & {
  sourceMetadata?: SourceMetadata;
};

export type ProductSpecificationVersionOptions = {
  productSpecificationVersion?: S100ProductSpecificationVersion;
};

export const requestOptions = (options: SourceRequestBuilderOptions): SourceRequestOptions => ({
  ...(options.headers !== undefined ? { headers: options.headers } : {}),
  ...(options.query !== undefined ? { query: options.query } : {}),
  ...(options.credentials !== undefined ? { credentials: options.credentials } : {}),
});

export const commonLayerFields = <TStyle>(
  options: LayerBuilderCommonOptions<TStyle>,
): Pick<
  BaseLayerSpec,
  "title" | "visible" | "opacity" | "zOrder" | "metadata" | "spatialExtent" | "extensions"
> => ({
  ...(options.title !== undefined ? { title: options.title } : {}),
  ...(options.visible !== undefined ? { visible: options.visible } : {}),
  ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
  ...(options.zOrder !== undefined ? { zOrder: options.zOrder } : {}),
  ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
  ...(options.spatialExtent !== undefined ? { spatialExtent: options.spatialExtent } : {}),
  ...(options.extensions !== undefined ? { extensions: options.extensions } : {}),
});

export const productSpecificationVersionField = (
  options: ProductSpecificationVersionOptions,
): Required<ProductSpecificationVersionOptions> => ({
  productSpecificationVersion:
    options.productSpecificationVersion ??
    S100ProductSpecificationVersions.LATEST_CONFIRMED_SUPPORTED,
});
