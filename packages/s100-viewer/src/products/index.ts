import type { Coordinate, SpatialExtent } from "../coordinates/types.js";
import { S100Error } from "../errors/S100Error.js";
import type { BaseLayerSpec } from "../layers/types.js";
import { S100ProductType } from "../layers/types.js";
import type { TimeInterval } from "../time/types.js";

export type HttpMethod = "GET" | "POST";

export type ServiceReadySource =
  | ThreeDTilesSource
  | WmsSource
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

export type ColorValue =
  | string
  | {
      r: number;
      g: number;
      b: number;
      a?: number;
    };

export type ColorStop = {
  value: number;
  color: ColorValue;
  label?: string;
};

export type ColorRampRef =
  | "s100-default"
  | "s102-depth-default"
  | "s111-default"
  | "viridis"
  | "turbo"
  | "grayscale"
  | (string & {});

export type OpacityVisibilityStyle = {
  visible?: boolean;
  opacity?: number;
};

export type ProductFilter = {
  property: string;
  operator: "eq" | "neq" | "in" | "not-in" | "lt" | "lte" | "gt" | "gte" | "contains";
  value: unknown;
};

export type ContourStyle = {
  visible: boolean;
  intervalMeters?: number;
  majorIntervalMeters?: number;
  color?: ColorValue;
  widthPixels?: number;
};

export type DepthColorStyle = ColorRampRef | readonly ColorStop[];

export type S101EncStyle = OpacityVisibilityStyle & {
  displayCategories?: readonly string[];
  ignoredCategories?: readonly string[];
  filters?: readonly ProductFilter[];
  cutout?: {
    enabled: boolean;
    extent?: SpatialExtent;
    featherMeters?: number;
  };
};

export type S102BathymetryStyle = OpacityVisibilityStyle & {
  unsafeDepth?: number;
  seaLevel?: number;
  contours?: ContourStyle;
  depthColors?: DepthColorStyle;
  shading?: "flat" | "lit" | "hypsometric";
  verticalExaggeration?: number;
};

export type S104WaterLevelStyle = OpacityVisibilityStyle & {
  datum?: string;
  colorRamp?: ColorRampRef | readonly ColorStop[];
  minMeters?: number;
  maxMeters?: number;
  showSurface?: boolean;
};

export type S111SurfaceCurrentStyle = OpacityVisibilityStyle & {
  renderer: "arrows" | "particles" | "streamlines";
  glyph?: "arrow" | "chevron" | "barb";
  minSpeed?: number;
  maxSpeed?: number;
  scale?: number | "auto";
  speedScale?: number | "auto";
  colorRamp?: ColorRampRef | readonly ColorStop[];
  vectorSpacingMeters?: number;
  legend?: {
    visible: boolean;
    units?: "m/s" | "knots";
  };
};

export type VesselPose = {
  position: Coordinate;
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
};

export type VesselTransformControlMode = "none" | "translate" | "rotate" | "translate-rotate";

export type VesselTransformGizmoStyle =
  | boolean
  | {
      enabled?: boolean;
      mode?: VesselTransformControlMode;
      sizeMeters?: number;
    };

export type VesselOceanSurfaceStyle =
  | boolean
  | {
      enabled?: boolean;
      radiusMeters?: number;
      color?: ColorValue;
      opacity?: number;
      roughness?: number;
      reflectivity?: number;
    };

export type VesselShadowStyle =
  | boolean
  | {
      enabled?: boolean;
      opacity?: number;
      softness?: number;
      color?: ColorValue;
    };

export type VesselStyle = OpacityVisibilityStyle & {
  draughtMeters?: number;
  showSeaLevelIndicator?: boolean;
  transformControls?: VesselTransformControlMode;
  transformGizmo?: VesselTransformGizmoStyle;
  showOceanSurface?: boolean;
  oceanSurface?: VesselOceanSurfaceStyle;
  shadow?: VesselShadowStyle;
};

export type MapOverlayStyle = OpacityVisibilityStyle & {
  blendMode?: "normal" | "multiply" | "screen" | "overlay";
  filters?: readonly ProductFilter[];
};

export type ProductTimeOptions = {
  availability?: readonly TimeInterval[];
  interpolation?: "nearest" | "linear" | "step";
  field?: string;
};

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

export interface VesselLayerSpec extends BaseLayerSpec<"vessel"> {
  source: ModelSource;
  pose: VesselPose;
  style?: VesselStyle;
}

export interface MapOverlayLayerSpec extends BaseLayerSpec<"map-overlay"> {
  source: WmsSource | WmtsSource | MvtSource | StaticJsonSource;
  role?: "basemap" | "overlay" | "mask" | "annotation";
  style?: MapOverlayStyle;
}

export type S101LayerSpec = S101EncLayerSpec;
export type S102LayerSpec = S102BathymetryLayerSpec;
export type S104LayerSpec = S104WaterLevelLayerSpec;
export type S111LayerSpec = S111SurfaceCurrentLayerSpec;

export type S100ProductLayerSpec =
  | S101EncLayerSpec
  | S102BathymetryLayerSpec
  | S104WaterLevelLayerSpec
  | S111SurfaceCurrentLayerSpec
  | VesselLayerSpec
  | MapOverlayLayerSpec;

export type S100ServiceProductType = S100ProductLayerSpec["product"];

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

export const VesselStyles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    draughtMeters: 0,
    showSeaLevelIndicator: true,
    transformControls: "translate-rotate",
    transformGizmo: true,
    showOceanSurface: false,
    oceanSurface: false,
    shadow: true,
  } satisfies VesselStyle,
};

export const MapOverlayStyles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    blendMode: "normal",
  } satisfies MapOverlayStyle,
};

type LayerBuilderCommonOptions<TStyle> = {
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

type SourceRequestBuilderOptions = SourceRequestOptions & {
  sourceMetadata?: SourceMetadata;
};

type ProductSpecificationVersionOptions = {
  productSpecificationVersion?: S100ProductSpecificationVersion;
};

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

const requestOptions = (options: SourceRequestBuilderOptions): SourceRequestOptions => ({
  ...(options.headers !== undefined ? { headers: options.headers } : {}),
  ...(options.query !== undefined ? { query: options.query } : {}),
  ...(options.credentials !== undefined ? { credentials: options.credentials } : {}),
});

const commonLayerFields = <TStyle>(
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

const productSpecificationVersionField = (
  options: ProductSpecificationVersionOptions,
): Required<ProductSpecificationVersionOptions> => ({
  productSpecificationVersion:
    options.productSpecificationVersion ??
    S100ProductSpecificationVersions.LATEST_CONFIRMED_SUPPORTED,
});

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

const createS102 = (options: CreateS102LayerOptions): S102LayerSpec => ({
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

const createS101Wms = (options: CreateS101WmsLayerOptions): S101LayerSpec => ({
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

const createS101Wmts = (options: CreateS101WmtsLayerOptions): S101LayerSpec => ({
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

const createS104 = <TData = unknown>(options: CreateS104LayerOptions<TData>): S104LayerSpec => ({
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

const createStaticS104 = <TData = unknown>(
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

const createS111 = <TData = unknown>(options: CreateS111LayerOptions<TData>): S111LayerSpec => ({
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

const createStaticS111 = <TData = unknown>(
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

const createVessel = (options: CreateVesselLayerOptions): VesselLayerSpec => ({
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

const createMapOverlayWms = (
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

export const LayerBuilder = {
  ProductSpecificationVersions: S100ProductSpecificationVersions,
  S101Styles,
  S102Styles,
  S104Styles,
  S111Styles,
  VesselStyles,
  MapOverlayStyles,
  createS102,
  createS101Wms,
  createS101Wmts,
  createS104,
  createStaticS104,
  createS111,
  createStaticS111,
  createVessel,
  createMapOverlayWms,
};

export const defineS100LayerSpec = <TSpec extends S100ProductLayerSpec>(spec: TSpec): TSpec => spec;

export const isServiceReadySource = (source: unknown): source is ServiceReadySource => {
  if (!source || typeof source !== "object" || !("kind" in source)) {
    return false;
  }

  const kind = (source as { kind: string }).kind;
  return ["3d-tiles", "wms", "wmts", "rest-json", "static-json", "model", "mvt"].includes(kind);
};

export const assertServiceReadyLayerSpec = (spec: S100ProductLayerSpec): void => {
  if (!isServiceReadySource(spec.source)) {
    throw new S100Error("invalid-layer-spec", `Layer '${spec.id}' must use a service-ready source.`);
  }
};

export const getLayerDisplayTitle = (spec: S100ProductLayerSpec): string =>
  spec.title ?? spec.metadata?.title ?? spec.id;

export {
  S100ProductType,
  type BaseLayerSpec,
  type Coordinate,
  type SpatialExtent,
  type TimeInterval,
};
