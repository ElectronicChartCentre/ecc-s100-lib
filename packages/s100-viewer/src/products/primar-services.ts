import type { ProjectedMapCenter } from "./projected-map-template.js";
import { buildWmsUrlTemplate } from "./enc-builders.js";
import type {
  EncAvailabilityService,
  EncWmsSessionStandardOptions,
} from "./enc-wms-session.js";
import type { S102TerrainSource } from "./s102-session.js";
import { createPrimarS111Service, type PrimarS111ServiceOptions } from "./s111-service-primar.js";

export type PrimarS102TilesSourceOptions = {
  endpoint: string;
  apiKey: string;
  extraQuery?: Record<string, string | number | boolean>;
};

export type PrimarEncWmsCommonOptions = {
  licenseeKey: string;
  center: ProjectedMapCenter;
  widthMeters: number;
  wmsBaseUrl: string;
};

export type PrimarS101EncWmsOptions = PrimarEncWmsCommonOptions & {
  pixelRatio?: number;
  refScale?: number;
  imageSize?: number;
};

export type PrimarS57EncWmsOptions = PrimarEncWmsCommonOptions & {
  wmsTemplatePath: string;
  customStyleId?: string;
  opaqueStyleId?: string;
  includeOpaqueLayer?: boolean;
  imageSize?: number;
};

export type PrimarEncAvailabilityRequests<TBounds = unknown> = {
  getLicensedProductsWithinBounds(
    licenseeKey: string,
    productSpecifications: number[],
    bounds: TBounds,
  ): Promise<readonly unknown[] | Error>;
  getValidProductTypes(
    licenseeKey: string,
  ): Promise<readonly unknown[] | Error>;
  getS57WithinBounds(bounds: TBounds): Promise<unknown>;
  onError?: (message: string, error: unknown) => void;
  s101ProductSpecification?: number;
  s57ProductTypeId?: number;
};

const DEFAULT_S101_REF_SCALE = 10000;
const DEFAULT_S57_STYLE_ID = "style-id-245";
const DEFAULT_IMAGE_SIZE = 256;
const DEFAULT_S101_PRODUCT_SPECIFICATION = 101;
const DEFAULT_S57_PRODUCT_TYPE_ID = 1;

export const createPrimarS102TilesSource = (
  options: PrimarS102TilesSourceOptions,
): S102TerrainSource => ({
  urlForDatasetIds(datasetIds: readonly string[]) {
    return joinPath(
      options.endpoint,
      options.apiKey,
      datasetIds.join(","),
    );
  },
  queryForDatasetIds(_datasetIds, context) {
    return {
      crs: context.crs,
      ...(options.extraQuery ?? {}),
    };
  },
});

export const createPrimarS101EncWmsOptions = (
  options: PrimarS101EncWmsOptions,
): EncWmsSessionStandardOptions => {
  const imageSize = positiveInteger(options.imageSize, DEFAULT_IMAGE_SIZE);
  const refScale = positiveNumber(options.refScale, DEFAULT_S101_REF_SCALE);
  const devicePixelRatio = positiveNumber(options.pixelRatio, 1);
  const crs = centerCrs(options.center);
  const baseTemplate = buildWmsUrlTemplate({
    baseUrl: options.wmsBaseUrl,
    parameters: [
      ["bbox", "{xmin},{ymin},{xmax},{ymax}"],
      ["FORMAT", "image/png"],
      ["SERVICE", "WMS"],
      ["VERSION", "1.1.1"],
      ["SRS", crs],
      ["WIDTH", imageSize],
      ["HEIGHT", imageSize],
      ["REQUEST", "GetMap"],
      ["CELLPICKER", `vesselFolio,${options.licenseeKey}`],
      ["LAYERS", "s100dataSets.101"],
      ["TRANSPARENT", true],
      ["DPI", devicePixelRatio * 96],
      ["MULTIRES", refScale],
      ["DISPLAYSCALES", "IGNORE"],
    ],
  });

  return {
    center: options.center,
    widthMeters: options.widthMeters,
    transparent: {
      id: "s101WMS",
      urlTemplate: buildWmsUrlTemplate({
        baseUrl: baseTemplate,
        parameters: [
          ["IGNORE", "DepthArea,DepthContour,DredgedArea"],
          ["HIDE", "90010,90020"],
        ],
      }),
      role: "overlay",
      visible: false,
      opacity: 1,
    },
    opaque: {
      id: "s101WMSOpaque",
      urlTemplate: buildWmsUrlTemplate({
        baseUrl: baseTemplate,
        parameters: [
          ["HIDE", "90010,90020"],
        ],
      }),
      role: "basemap",
      visible: false,
      opacity: 1,
      scale: 4,
    },
  };
};

export const createPrimarS57EncWmsOptions = (
  options: PrimarS57EncWmsOptions,
): EncWmsSessionStandardOptions => {
  const imageSize = String(positiveInteger(options.imageSize, DEFAULT_IMAGE_SIZE));
  const sharedTemplatePath = fillUrlTemplatePath(options.wmsTemplatePath, {
    licenseeId: options.licenseeKey,
    width: imageSize,
    height: imageSize,
    crsParam: centerCrs(options.center),
  });
  const transparentUrlTemplate =
    options.wmsBaseUrl +
    fillUrlTemplatePath(sharedTemplatePath, {
      customStyleId: options.customStyleId ?? DEFAULT_S57_STYLE_ID,
    });
  const opaqueStyleId =
    options.opaqueStyleId ?? options.customStyleId ?? DEFAULT_S57_STYLE_ID;
  const opaqueUrlTemplate = options.includeOpaqueLayer
    ? options.wmsBaseUrl +
      fillUrlTemplatePath(sharedTemplatePath, {
        customStyleId: opaqueStyleId,
      })
    : undefined;

  return {
    center: options.center,
    widthMeters: options.widthMeters,
    transparent: {
      id: "basemap",
      urlTemplate: transparentUrlTemplate,
      role: "overlay",
      visible: false,
      opacity: 1,
    },
    ...(opaqueUrlTemplate
      ? {
          opaque: {
            id: "basemapOpaque",
            urlTemplate: opaqueUrlTemplate,
            role: "basemap",
            visible: false,
            opacity: 1,
            scale: 4,
          },
        }
      : {}),
  };
};

export const createPrimarEncAvailabilityService = <TBounds = unknown>(
  options: PrimarEncAvailabilityRequests<TBounds>,
): EncAvailabilityService<TBounds> => {
  const s101ProductSpecification =
    options.s101ProductSpecification ?? DEFAULT_S101_PRODUCT_SPECIFICATION;
  const s57ProductTypeId =
    options.s57ProductTypeId ?? DEFAULT_S57_PRODUCT_TYPE_ID;

  return {
    async hasS101(bounds, licenseeKey) {
      return readPrimarAvailability(
        () => options.getLicensedProductsWithinBounds(
          licenseeKey,
          [s101ProductSpecification],
          bounds,
        ),
        "Failed to determine if licensee has access to S-101 products in scene bounds",
        options.onError,
        (result) => Array.isArray(result) && result.length > 0,
      );
    },
    async hasS57Access(licenseeKey) {
      return readPrimarAvailability(
        () => options.getValidProductTypes(licenseeKey),
        "Failed to determine if licensee has access to S-57 products",
        options.onError,
        (result) => Array.isArray(result) && result.some((productType) =>
          readNumericProperty(productType, "id") === s57ProductTypeId,
        ),
      );
    },
    async hasS57(bounds) {
      return readPrimarAvailability(
        () => options.getS57WithinBounds(bounds),
        "Failed to determine if S-57 products exist in scene bounds",
        options.onError,
        (result) => (readNumericProperty(result, "total") ?? 0) > 0,
      );
    },
  };
};

export const PrimarServices = {
  s111: createPrimarS111Service,
  s102Tiles: createPrimarS102TilesSource,
  s101EncWms: createPrimarS101EncWmsOptions,
  s57EncWms: createPrimarS57EncWmsOptions,
  encAvailability: createPrimarEncAvailabilityService,
} satisfies {
  s111: (options: PrimarS111ServiceOptions) => ReturnType<typeof createPrimarS111Service>;
  s102Tiles: typeof createPrimarS102TilesSource;
  s101EncWms: typeof createPrimarS101EncWmsOptions;
  s57EncWms: typeof createPrimarS57EncWmsOptions;
  encAvailability: typeof createPrimarEncAvailabilityService;
};

function centerCrs(center: ProjectedMapCenter): string | undefined {
  if ("easting" in center) {
    return center.epsgCrs;
  }
  return center.crs;
}

function fillUrlTemplatePath(
  templatePath: string,
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  return templatePath.replace(/\{([^{}]+)\}/g, (token, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? token : String(value);
  });
}

function joinPath(...parts: readonly string[]): string {
  const [first = "", ...rest] = parts;
  return [
    first.replace(/\/+$/, ""),
    ...rest.map((part) => part.replace(/^\/+|\/+$/g, "")),
  ].filter(Boolean).join("/");
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return Math.round(positiveNumber(value, fallback));
}

async function readPrimarAvailability<TResponse>(
  request: () => Promise<TResponse | Error>,
  failureMessage: string,
  onError: ((message: string, error: unknown) => void) | undefined,
  isAvailable: (response: TResponse) => boolean,
): Promise<boolean> {
  try {
    const response = await request();
    if (response instanceof Error) {
      onError?.(response.message || failureMessage, response);
      return false;
    }
    return isAvailable(response);
  } catch (error) {
    onError?.(failureMessage, error);
    return false;
  }
}

function readNumericProperty(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "number" && Number.isFinite(property)
    ? property
    : undefined;
}
