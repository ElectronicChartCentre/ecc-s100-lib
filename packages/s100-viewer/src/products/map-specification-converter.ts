import type { EncLayerSpec, EncStandard } from "./enc.js";
import { LayerBuilder } from "./layer-builder.js";
import {
  ProjectedMapDiscardMode,
  ProjectedMapLayerType,
  type ProjectedMapSpecification,
} from "./projected-map-template.js";
import type { MapOverlayLayerSpec } from "./viewer-features.js";

export type ProjectedMapLayerTypeValue =
  (typeof ProjectedMapLayerType)[keyof typeof ProjectedMapLayerType];

export type ProjectedMapDiscardModeValue =
  (typeof ProjectedMapDiscardMode)[keyof typeof ProjectedMapDiscardMode];

export type EncProjectedMapSpecification = ProjectedMapSpecification & {
  encStandard?: Extract<EncStandard, "S-101" | "S-57">;
};

export const getCrsFromQuery = (
  query: Record<string, string> | undefined,
): string | undefined => {
  if (!query) {
    return undefined;
  }
  return query.crs ?? query.CRS ?? query.srs ?? query.SRS;
};

export const getCrsFromUrlTemplate = (urlTemplate: string): string | undefined => {
  const queryString = urlTemplate.split("?")[1];
  if (!queryString) {
    return undefined;
  }

  const normalizedTemplate = queryString
    .split("{xmin}").join("0")
    .split("{ymin}").join("0")
    .split("{xmax}").join("1")
    .split("{ymax}").join("1");
  return getCrsFromQuery(Object.fromEntries(new URLSearchParams(normalizedTemplate)));
};

export const mapSpecificationToLayerSpec = (
  specification: EncProjectedMapSpecification,
  discardMode: ProjectedMapDiscardModeValue,
): EncLayerSpec | MapOverlayLayerSpec => {
  const crs = getCrsFromUrlTemplate(specification.urlTemplate) ?? specification.dataset.extents.crs;
  const quality = typeof specification.quality === "number" ? specification.quality : undefined;
  const baseOptions = {
    id: specification.id,
    urlTemplate: specification.urlTemplate,
    layers: [specification.id],
    ...(crs !== undefined ? { crs } : {}),
    visible: false,
    opacity: 1,
    corners: specification.corners,
    extents: {
      ...specification.dataset.extents,
      ...(crs !== undefined ? { crs } : {}),
    },
    mapSubset: specification.dataset.mapSubset,
    minLevel: specification.dataset.minLevel,
    maxLevel: specification.dataset.maxLevel,
    ...(quality !== undefined ? { quality } : {}),
    mapLayerType: specification.type,
    discardMode,
  };

  if (specification.type === ProjectedMapLayerType.MaskLayer) {
    return LayerBuilder.createMapOverlayWmsTemplate({
      ...baseOptions,
      role: "mask",
    });
  }

  const role = specification.type === ProjectedMapLayerType.Base ? "basemap" : "overlay";

  if (specification.encStandard === "S-57") {
    return LayerBuilder.createS57WmsTemplate({
      ...baseOptions,
      role,
    });
  }

  return LayerBuilder.createS101WmsTemplate({
    ...baseOptions,
    role,
  });
};
