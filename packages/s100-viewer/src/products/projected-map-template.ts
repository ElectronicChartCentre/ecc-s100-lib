import type { SpatialExtent } from "../coordinates/types.js";

export type ProjectedMapPoint = [number, number];

export type ProjectedMapCorners = {
  upperLeft: ProjectedMapPoint;
  upperRight: ProjectedMapPoint;
  lowerLeft: ProjectedMapPoint;
  lowerRight: ProjectedMapPoint;
};

export type ProjectedMapExtents = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  crs?: string;
};

export type ProjectedMapSubset = {
  min: ProjectedMapPoint;
  max: ProjectedMapPoint;
};

export type ProjectedMapTemplateOptions = {
  corners?: ProjectedMapCorners;
  extents: ProjectedMapExtents;
  mapSubset?: ProjectedMapSubset;
  minLevel?: number;
  maxLevel?: number;
  quality?: number;
  mapLayerType?: number;
  discardMode?: number;
};

export type ProjectedMapCenter =
  | {
      x: number;
      y: number;
      crs?: string;
    }
  | {
      easting: number;
      northing: number;
      epsgCrs?: string;
    };

export type ProjectedMapCenterExtentOptions =
  Omit<ProjectedMapTemplateOptions, "corners" | "extents"> & {
    center: ProjectedMapCenter;
    widthMeters: number;
    heightMeters?: number;
    scale?: number;
    crs?: string;
  };

export type ProjectedMapCenterExtentTemplate = ProjectedMapTemplateOptions & {
  crs?: string;
};

export type ProjectedMapSpecification = {
  id: string;
  type: number;
  corners: ProjectedMapCorners;
  dataset: {
    mapSubset: ProjectedMapSubset;
    extents: ProjectedMapExtents;
    minLevel: number;
    maxLevel: number;
  };
  quality?: number;
  urlTemplate: string;
};

export const ProjectedMapLayerType = {
  Base: 0,
  MaskLayer: 1,
  BaseTransparent: 2,
} as const;

export const ProjectedMapDiscardMode = {
  BaseMapAlpha: 0,
  None: 1,
  Transparent: 1,
  MaskLayerAlphaZero: 2,
  MaskLayerAlphaOne: 3,
} as const;

export const projectedSpatialExtent = (
  extents: ProjectedMapExtents,
): SpatialExtent => ({
  ...(extents.crs !== undefined ? { crs: extents.crs } : {}),
  minX: extents.minX,
  minY: extents.minY,
  maxX: extents.maxX,
  maxY: extents.maxY,
});

export const projectedMapSpecification = (
  id: string,
  urlTemplate: string,
  options: ProjectedMapTemplateOptions,
  fallbackMapLayerType: number,
): ProjectedMapSpecification => {
  const minLevel = options.minLevel ?? 0;
  const maxLevel = options.maxLevel ?? 18;
  const specification: ProjectedMapSpecification = {
    id,
    type: options.mapLayerType ?? fallbackMapLayerType,
    corners: options.corners ?? projectedCornersFromExtents(options.extents),
    dataset: {
      mapSubset: options.mapSubset ?? projectedMapSubsetFromExtents(options.extents),
      extents: options.extents,
      minLevel,
      maxLevel,
    },
    urlTemplate,
  };
  if (options.quality !== undefined) {
    specification.quality = options.quality;
  }
  return specification;
};

export const projectedMapFromCenterExtent = (
  options: ProjectedMapCenterExtentOptions,
): ProjectedMapCenterExtentTemplate => {
  const center = projectedMapCenter(options.center);
  const scale = positiveNumber(options.scale, 1);
  const width = positiveNumber(options.widthMeters, 1) * scale;
  const height = positiveNumber(options.heightMeters ?? options.widthMeters, 1) * scale;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const crs = options.crs ?? center.crs;
  const extents: ProjectedMapExtents = {
    minX: center.x - halfWidth,
    maxX: center.x + halfWidth,
    minY: center.y - halfHeight,
    maxY: center.y + halfHeight,
    ...(crs !== undefined ? { crs } : {}),
  };

  return {
    ...(crs !== undefined ? { crs } : {}),
    corners: projectedCornersFromExtents(extents),
    mapSubset: options.mapSubset ?? {
      min: [0, 0],
      max: [1, 1],
    },
    extents,
    minLevel: options.minLevel ?? 0,
    maxLevel: options.maxLevel ?? 10,
    ...(options.quality !== undefined ? { quality: options.quality } : {}),
    ...(options.mapLayerType !== undefined ? { mapLayerType: options.mapLayerType } : {}),
    ...(options.discardMode !== undefined ? { discardMode: options.discardMode } : {}),
  };
};

export const ProjectedMap = {
  DiscardMode: ProjectedMapDiscardMode,
  LayerType: ProjectedMapLayerType,
  fromCenterExtent: projectedMapFromCenterExtent,
} as const;

const projectedCornersFromExtents = (
  extents: ProjectedMapExtents,
): ProjectedMapCorners => ({
  upperLeft: [extents.minX, extents.maxY],
  upperRight: [extents.maxX, extents.maxY],
  lowerLeft: [extents.minX, extents.minY],
  lowerRight: [extents.maxX, extents.minY],
});

const projectedMapSubsetFromExtents = (
  extents: ProjectedMapExtents,
): ProjectedMapSubset => ({
  min: [extents.minX, extents.minY],
  max: [extents.maxX, extents.maxY],
});

const projectedMapCenter = (
  center: ProjectedMapCenter,
): { x: number; y: number; crs?: string } => {
  if ("easting" in center) {
    return {
      x: center.easting,
      y: center.northing,
      ...(center.epsgCrs !== undefined ? { crs: center.epsgCrs } : {}),
    };
  }
  return center;
};

const positiveNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
