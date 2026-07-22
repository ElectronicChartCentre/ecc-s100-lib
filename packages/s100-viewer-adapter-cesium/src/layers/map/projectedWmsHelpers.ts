import {
  S100Error,
  type EncLayerSpec,
  type MapOverlayLayerSpec,
  type SpatialExtent,
  type WmsSource,
} from "@ecc/s100-viewer";
import { clampNumber } from "@ecc/s100-viewer/internal/adapter-utils/numeric";
import {
  resolveEncRasterAlphaOptions,
  shouldRenderTransparentRaster,
} from "@ecc/s100-viewer/internal/products/encTransparency";
import {
  appendUrlQuery,
  fillProjectedBboxTemplate,
} from "@ecc/s100-viewer/internal/adapter-utils/urlTemplate";

export type ProjectedWmsAlphaOptions = {
  mode: "source" | "binary";
  cutoff: number;
};

export function createWmsParameters(source: WmsSource): Record<string, string | number | boolean> {
  return {
    service: "WMS",
    request: "GetMap",
    version: source.version ?? "1.3.0",
    format: source.format ?? "image/png",
    transparent: source.transparent ?? true,
    styles: source.styles?.join(",") ?? "",
    ...(source.crs !== undefined ? { crs: source.crs } : {}),
    ...source.parameters,
  };
}

export function createWmsUrlTemplate(source: WmsSource): string {
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
  return appendUrlQuery(source.url, params)
    .replaceAll("%7B", "{")
    .replaceAll("%7D", "}")
    .replaceAll("%2C", ",");
}

export function stripQuery(url: string): string {
  return url.split("?")[0] ?? url;
}

export function fillWmsTemplate(
  template: string,
  extent: Required<Pick<SpatialExtent, "minX" | "minY" | "maxX" | "maxY">>,
  width: number,
  height: number,
): string {
  return fillProjectedBboxTemplate(template, extent, { width, height });
}

export function projectedWmsImageSize(
  spec: EncLayerSpec | MapOverlayLayerSpec,
  params: URLSearchParams,
): { width: number; height: number } {
  const baseWidth = Math.max(getPositiveInteger(params.get("WIDTH"), 2048), 2048);
  const baseHeight = Math.max(getPositiveInteger(params.get("HEIGHT"), 2048), 2048);
  const quality = spec.projectedMap?.quality;
  if (typeof quality !== "number" || !Number.isFinite(quality) || quality <= 0) {
    return { width: baseWidth, height: baseHeight };
  }
  return {
    width: Math.round(clampNumber(baseWidth * quality, baseWidth, 8192)),
    height: Math.round(clampNumber(baseHeight * quality, baseHeight, 8192)),
  };
}

export function isProjectedWmsTranslucent(
  spec: EncLayerSpec | MapOverlayLayerSpec,
  params: URLSearchParams,
  opacity: number,
): boolean {
  const transparent = params.get("TRANSPARENT") ?? params.get("transparent");
  return shouldRenderTransparentRaster(
    { ...spec, opacity },
    transparent?.toLowerCase() === "true",
  );
}

export function getProjectedWmsAlphaOptions(
  spec: EncLayerSpec | MapOverlayLayerSpec,
): ProjectedWmsAlphaOptions {
  const style = spec.style as { alphaMode?: unknown; alphaCutoff?: unknown } | undefined;
  return resolveEncRasterAlphaOptions(style);
}

export function normalizeProjectedExtent(
  extent: SpatialExtent,
): Required<Pick<SpatialExtent, "minX" | "minY" | "maxX" | "maxY">> {
  if (
    extent.minX === undefined ||
    extent.minY === undefined ||
    extent.maxX === undefined ||
    extent.maxY === undefined
  ) {
    throw new S100Error(
      "invalid-layer-spec",
      "Projected WMS single-tile imagery requires minX/minY/maxX/maxY spatial extent.",
      extent,
    );
  }
  return {
    minX: extent.minX,
    minY: extent.minY,
    maxX: extent.maxX,
    maxY: extent.maxY,
  };
}

export function sameCrs(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").toUpperCase() === (right ?? "").toUpperCase();
}

export function projectedExtentsOverlap(left: SpatialExtent, right: SpatialExtent): boolean {
  return !(
    (left.maxX ?? Number.NEGATIVE_INFINITY) <= (right.minX ?? Number.POSITIVE_INFINITY) ||
    (left.minX ?? Number.POSITIVE_INFINITY) >= (right.maxX ?? Number.NEGATIVE_INFINITY) ||
    (left.maxY ?? Number.NEGATIVE_INFINITY) <= (right.minY ?? Number.POSITIVE_INFINITY) ||
    (left.minY ?? Number.POSITIVE_INFINITY) >= (right.maxY ?? Number.NEGATIVE_INFINITY)
  );
}

export function subtractProjectedExtent(outer: SpatialExtent, cutout: SpatialExtent): SpatialExtent[] {
  if (!projectedExtentsOverlap(outer, cutout)) {
    return [outer];
  }
  const minX = outer.minX ?? 0;
  const minY = outer.minY ?? 0;
  const maxX = outer.maxX ?? 0;
  const maxY = outer.maxY ?? 0;
  const cutMinX = clampNumber(cutout.minX ?? minX, minX, maxX);
  const cutMaxX = clampNumber(cutout.maxX ?? maxX, minX, maxX);
  const cutMinY = clampNumber(cutout.minY ?? minY, minY, maxY);
  const cutMaxY = clampNumber(cutout.maxY ?? maxY, minY, maxY);
  const middleMinX = Math.max(minX, cutMinX);
  const middleMaxX = Math.min(maxX, cutMaxX);
  const pieces: SpatialExtent[] = [
    createProjectedExtentPiece(outer, minX, minY, cutMinX, maxY),
    createProjectedExtentPiece(outer, cutMaxX, minY, maxX, maxY),
    createProjectedExtentPiece(outer, middleMinX, minY, middleMaxX, cutMinY),
    createProjectedExtentPiece(outer, middleMinX, cutMaxY, middleMaxX, maxY),
  ];
  return pieces.filter((piece) =>
    (piece.maxX ?? 0) > (piece.minX ?? 0) &&
    (piece.maxY ?? 0) > (piece.minY ?? 0),
  );
}

function getPositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createProjectedExtentPiece(
  template: SpatialExtent,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): SpatialExtent {
  return {
    ...(template.crs !== undefined ? { crs: template.crs } : {}),
    minX,
    minY,
    maxX,
    maxY,
  };
}
