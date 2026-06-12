import type { BaseLayerSpec } from "../layers/types.js";
import { S100ProductType } from "../layers/types.js";
import type { MvtSource, RestJsonSource, StaticJsonSource, ThreeDTilesSource, WmsSource, WmtsSource } from "./sources.js";
import type {
  S101EncStyle,
  S102BathymetryStyle,
  S104WaterLevelStyle,
  S111SurfaceCurrentStyle,
  ProductTimeOptions,
} from "./style.js";

export const LATEST_CONFIRMED_SUPPORTED_PRODUCT_SPEC_VERSION = "latest-confirmed-supported" as const;

export type S100ProductSpecificationVersion =
  | typeof LATEST_CONFIRMED_SUPPORTED_PRODUCT_SPEC_VERSION
  | (string & {});

export type ProductSpecificationVersionedLayerSpec = {
  productSpecificationVersion?: S100ProductSpecificationVersion;
};

export const S100ProductSpecificationVersions = {
  LATEST_CONFIRMED_SUPPORTED: LATEST_CONFIRMED_SUPPORTED_PRODUCT_SPEC_VERSION,
  S101: {
    LATEST_CONFIRMED_SUPPORTED: LATEST_CONFIRMED_SUPPORTED_PRODUCT_SPEC_VERSION,
  },
  S102: {
    LATEST_CONFIRMED_SUPPORTED: LATEST_CONFIRMED_SUPPORTED_PRODUCT_SPEC_VERSION,
  },
  S104: {
    LATEST_CONFIRMED_SUPPORTED: LATEST_CONFIRMED_SUPPORTED_PRODUCT_SPEC_VERSION,
  },
  S111: {
    LATEST_CONFIRMED_SUPPORTED: LATEST_CONFIRMED_SUPPORTED_PRODUCT_SPEC_VERSION,
  },
} as const;

export type S100ProductVersionSupport = {
  product: S100ProductType | (string & {});
  versions: readonly S100ProductSpecificationVersion[];
  defaultVersion: S100ProductSpecificationVersion;
  notes?: string;
};

export const S100SupportedProductVersions = [
  {
    product: S100ProductType.S101,
    versions: [S100ProductSpecificationVersions.S101.LATEST_CONFIRMED_SUPPORTED],
    defaultVersion: S100ProductSpecificationVersions.S101.LATEST_CONFIRMED_SUPPORTED,
  },
  {
    product: S100ProductType.S102,
    versions: [S100ProductSpecificationVersions.S102.LATEST_CONFIRMED_SUPPORTED],
    defaultVersion: S100ProductSpecificationVersions.S102.LATEST_CONFIRMED_SUPPORTED,
  },
  {
    product: S100ProductType.S104,
    versions: [S100ProductSpecificationVersions.S104.LATEST_CONFIRMED_SUPPORTED],
    defaultVersion: S100ProductSpecificationVersions.S104.LATEST_CONFIRMED_SUPPORTED,
  },
  {
    product: S100ProductType.S111,
    versions: [S100ProductSpecificationVersions.S111.LATEST_CONFIRMED_SUPPORTED],
    defaultVersion: S100ProductSpecificationVersions.S111.LATEST_CONFIRMED_SUPPORTED,
  },
] as const satisfies readonly S100ProductVersionSupport[];

export interface S101EncLayerSpec
  extends BaseLayerSpec<typeof S100ProductType.S101>,
    ProductSpecificationVersionedLayerSpec {
  source: WmsSource | WmtsSource | MvtSource;
  role?: "basemap" | "overlay" | "chart";
  style?: S101EncStyle;
}

export interface S102BathymetryLayerSpec
  extends BaseLayerSpec<typeof S100ProductType.S102>,
    ProductSpecificationVersionedLayerSpec {
  source: ThreeDTilesSource;
  style?: S102BathymetryStyle;
}

export interface S104WaterLevelLayerSpec
  extends BaseLayerSpec<typeof S100ProductType.S104>,
    ProductSpecificationVersionedLayerSpec {
  source: RestJsonSource | StaticJsonSource;
  time?: ProductTimeOptions;
  style?: S104WaterLevelStyle;
}

export interface S111SurfaceCurrentLayerSpec
  extends BaseLayerSpec<typeof S100ProductType.S111>,
    ProductSpecificationVersionedLayerSpec {
  source: RestJsonSource | StaticJsonSource;
  time?: ProductTimeOptions;
  style?: S111SurfaceCurrentStyle;
}

export type S101LayerSpec = S101EncLayerSpec;
export type S102LayerSpec = S102BathymetryLayerSpec;
export type S104LayerSpec = S104WaterLevelLayerSpec;
export type S111LayerSpec = S111SurfaceCurrentLayerSpec;

export type S100IhoProductLayerSpec =
  | S101EncLayerSpec
  | S102BathymetryLayerSpec
  | S104WaterLevelLayerSpec
  | S111SurfaceCurrentLayerSpec;

export const S102Styles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    seaLevel: 0,
    contours: {
      visible: true,
      intervalMeters: 2,
    },
    depthColors: "s102-depth-default",
    shading: "lit",
    verticalExaggeration: 1,
  } satisfies S102BathymetryStyle,
};

export const S101Styles = {
  DEFAULT: {
    visible: true,
    opacity: 0.72,
    cutout: {
      enabled: true,
    },
  } satisfies S101EncStyle,
};

export const S104Styles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    colorRamp: "s100-default",
    showSurface: true,
  } satisfies S104WaterLevelStyle,
};

export const S111Styles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    renderer: "arrows",
    glyph: "arrow",
    scale: "auto",
    speedScale: "auto",
    colorRamp: "s111-default",
    legend: {
      visible: true,
      units: "knots",
    },
  } satisfies S111SurfaceCurrentStyle,
};
