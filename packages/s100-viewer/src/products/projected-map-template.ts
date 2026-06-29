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

export const projectedMapTemplateExtensions = (
  existing: Record<string, unknown> | undefined,
  mapSpecification: ProjectedMapSpecification,
  options: ProjectedMapTemplateOptions,
): Record<string, unknown> => {
  const extents = mapSpecification.dataset.extents;
  const minLevel = mapSpecification.dataset.minLevel;
  const maxLevel = mapSpecification.dataset.maxLevel;
  const quality = mapSpecification.quality;
  const discardMode = options.discardMode;

  return {
    ...existing,
    cesium: {
      ...extensionRecord(existing?.cesium),
      extents,
      mapSpecification,
    },
    nasaAmmos: {
      ...extensionRecord(existing?.nasaAmmos),
      extents,
      minLevel,
      maxLevel,
      ...(quality !== undefined ? { quality } : {}),
      mapSpecification,
    },
    cogs: {
      ...extensionRecord(existing?.cogs),
      extents,
      minLevel,
      maxLevel,
      ...(quality !== undefined ? { quality } : {}),
      ...(discardMode !== undefined ? { discardMode } : {}),
      mapLayerType: mapSpecification.type,
      mapSpecification,
    },
  };
};

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

const extensionRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
