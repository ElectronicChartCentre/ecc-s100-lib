import {
  S100Error,
  type EncLayerSpec,
  type MapOverlayLayerSpec,
  type StaticJsonSource,
  type WmsSource,
  type WmsTemplateSource,
  type WmtsSource,
} from "@ecc/s100-viewer";
import {
  MapLayerType,
  type MapSpecification,
} from "../runtime/scene/NasaSceneRuntime.js";
import type { NasaSceneGeoreference } from "../adapter/layerNativeTypes.js";
import {
  getNasaAmmosExtension,
  getNumberExtension,
} from "../shared/extensions.js";

export const createMapSpecification = (
  spec: EncLayerSpec | MapOverlayLayerSpec,
  georeference: NasaSceneGeoreference,
): MapSpecification => {
  const nativeSpec = spec.projectedMap ?? getNasaAmmosExtension<MapSpecification>(spec, "mapSpecification");
  if (nativeSpec) {
    return withMapOriginOffset(
      {
        ...nativeSpec,
        ...getMapAlphaOptions(spec),
      },
      spec,
      georeference,
    );
  }

  const extents = getProjectedExtents(spec);
  const source = spec.source;
  const minLevel = getNumberExtension(spec, "minLevel", 0);
  const maxLevel = getNumberExtension(spec, "maxLevel", 18);
  const originOffset = getMapOriginOffset(spec, georeference);

  const mapSpecification: MapSpecification = {
    id: spec.id,
    type: getMapLayerType(spec),
    corners: {
      upperLeft: [extents.minX, extents.maxY],
      upperRight: [extents.maxX, extents.maxY],
      lowerLeft: [extents.minX, extents.minY],
      lowerRight: [extents.maxX, extents.minY],
    },
    dataset: {
      mapSubset: {
        min: [extents.minX, extents.minY],
        max: [extents.maxX, extents.maxY],
      },
      extents,
      minLevel,
      maxLevel,
    },
    ...getMapAlphaOptions(spec),
    urlTemplate: createMapUrlTemplate(source),
  };
  if (originOffset !== undefined) {
    mapSpecification.originOffset = originOffset;
  }
  return mapSpecification;
};

const withMapOriginOffset = (
  specification: MapSpecification,
  spec: EncLayerSpec | MapOverlayLayerSpec,
  georeference: NasaSceneGeoreference,
): MapSpecification => {
  const originOffset = getMapOriginOffset(spec, georeference);
  if (originOffset === undefined) {
    return specification;
  }
  return {
    ...specification,
    originOffset,
  };
};

const getMapAlphaOptions = (
  spec: EncLayerSpec | MapOverlayLayerSpec,
): Pick<MapSpecification, "alphaMode" | "alphaCutoff"> => {
  const style = spec.style as { alphaMode?: unknown; alphaCutoff?: unknown } | undefined;
  const alphaMode = normalizeMapAlphaMode(style?.alphaMode);
  const alphaCutoff = normalizeMapAlphaCutoff(style?.alphaCutoff, alphaMode);
  return {
    ...(alphaMode !== undefined ? { alphaMode } : {}),
    ...(alphaCutoff !== undefined ? { alphaCutoff } : {}),
  };
};

const normalizeMapAlphaMode = (value: unknown): MapSpecification["alphaMode"] =>
  value === "binary" || value === "source" ? value : undefined;

const normalizeMapAlphaCutoff = (
  value: unknown,
  alphaMode: MapSpecification["alphaMode"],
): number | undefined => {
  if (alphaMode !== "binary") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.01;
  }
  return Math.max(0, Math.min(1, value));
};

const getMapOriginOffset = (
  spec: EncLayerSpec | MapOverlayLayerSpec,
  georeference: NasaSceneGeoreference,
): [number, number, number] | undefined => {
  const origin = georeference.origin;
  const sceneCrs = georeference.crs;
  if (!origin || !sceneCrs) {
    return undefined;
  }

  const mapCrs = spec.projectedMap?.dataset.extents.crs ?? spec.spatialExtent?.crs ?? spec.source.crs;
  if (mapCrs !== undefined && mapCrs.toUpperCase() !== sceneCrs.toUpperCase()) {
    return undefined;
  }

  return [-origin.x, -origin.y, -origin.z];
};

const getMapLayerType = (spec: EncLayerSpec | MapOverlayLayerSpec): MapLayerType => {
  if (spec.product === "map-overlay" && spec.role === "mask") {
    return MapLayerType.MaskLayer;
  }
  if (spec.role === "basemap") {
    return MapLayerType.Base;
  }
  return MapLayerType.BaseTransparent;
};

const getProjectedExtents = (spec: EncLayerSpec | MapOverlayLayerSpec): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} => {
  const extension = getNasaAmmosExtension<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }>(spec, "extents");
  if (extension) {
    return extension;
  }

  const extent = spec.spatialExtent;
  if (
    extent?.minX !== undefined &&
    extent.maxX !== undefined &&
    extent.minY !== undefined &&
    extent.maxY !== undefined
  ) {
    return {
      minX: extent.minX,
      maxX: extent.maxX,
      minY: extent.minY,
      maxY: extent.maxY,
    };
  }

  throw new S100Error(
    "invalid-layer-spec",
    `NASA-AMMOS map layer '${spec.id}' requires projected spatialExtent minX/minY/maxX/maxY or extensions.nasaAmmos.extents.`,
    spec,
  );
};

const createMapUrlTemplate = (
  source: WmsSource | WmsTemplateSource | WmtsSource | StaticJsonSource | { kind: "mvt"; urlTemplate: string },
): string => {
  if (source.kind === "wms") {
    return createWmsUrlTemplate(source);
  }
  if (source.kind === "wms-template") {
    return source.urlTemplate;
  }
  if (source.kind === "wmts") {
    return createWmtsUrlTemplate(source);
  }
  if (source.kind === "mvt") {
    return source.urlTemplate;
  }

  throw new S100Error(
    "invalid-layer-spec",
    `NASA-AMMOS map layers require WMS, WMS template, WMTS, or MVT sources; received '${source.kind}'.`,
    source,
  );
};

const createWmsUrlTemplate = (source: WmsSource): string => {
  const params = new URLSearchParams();
  params.set("SERVICE", "WMS");
  params.set("REQUEST", "GetMap");
  params.set("VERSION", source.version ?? "1.3.0");
  params.set("LAYERS", source.layers.join(","));
  params.set("STYLES", source.styles?.join(",") ?? "");
  params.set("FORMAT", source.format ?? "image/png");
  params.set("TRANSPARENT", String(source.transparent ?? true));
  params.set(source.version === "1.1.1" ? "SRS" : "CRS", source.crs ?? "EPSG:3857");
  params.set("WIDTH", "256");
  params.set("HEIGHT", "256");
  params.set("BBOX", "{xmin},{ymin},{xmax},{ymax}");
  for (const [key, value] of Object.entries(source.parameters ?? {})) {
    params.set(key, String(value));
  }

  return appendQuery(source.url, params);
};

const createWmtsUrlTemplate = (source: WmtsSource): string => {
  const params = new URLSearchParams();
  params.set("SERVICE", "WMTS");
  params.set("REQUEST", "GetTile");
  params.set("LAYER", source.layer);
  params.set("STYLE", source.style ?? "default");
  params.set("TILEMATRIXSET", source.tileMatrixSet);
  params.set("TILEMATRIX", "{z}");
  params.set("TILEROW", "{y}");
  params.set("TILECOL", "{x}");
  params.set("FORMAT", source.format ?? "image/png");
  for (const [key, value] of Object.entries(source.parameters ?? {})) {
    params.set(key, String(value));
  }

  return appendQuery(source.url, params);
};

const appendQuery = (url: string, params: URLSearchParams): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${params.toString()}`;
};
