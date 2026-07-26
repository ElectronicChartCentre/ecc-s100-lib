import {
  getNearestTimeRecordIndex,
  isFillValue,
  parseProductTime,
} from "../internal/products/griddedTimeSeries.js";
import { projectCoordinateToProjectedCrs } from "../internal/coordinates/projection.js";
import { Coordinates, type ProjectedCoordinate } from "../coordinates/types.js";
import type {
  S104DecodedDataset,
  S104WaterLevelSampler,
} from "./s104.js";
import { getS104WaterLevelSamplerDatasets } from "./s104-sampler.js";

export type S104WaterLevelFieldGrid = {
  datasetId: string;
  crs: string;
  width: number;
  height: number;
  values: Float32Array;
  noDataValue: number;
  origin: {
    x: number;
    y: number;
    z?: number;
  };
  offsetVectors: {
    longitudinal: readonly [number, number];
    latitudinal: readonly [number, number];
  };
  sourceTime: Date;
  requestedTime: Date;
  timeIndex: number;
  verticalDatum?: string;
  productSpecificationVersion?: string;
};

export type S104ProjectedWaterLevelFieldGrid = Omit<
  S104WaterLevelFieldGrid,
  "crs" | "origin" | "offsetVectors"
> & {
  crs: string;
  origin: {
    x: number;
    y: number;
    z?: number;
  };
  offsetVectors: {
    longitudinal: readonly [number, number];
    latitudinal: readonly [number, number];
  };
};

const S104_RENDER_FIELD_NO_DATA_VALUE = -1_000_000;

export const createS104WaterLevelFieldGrid = (options: {
  sampler: S104WaterLevelSampler | null | undefined;
  time: Date | number | string;
}): S104WaterLevelFieldGrid | null => {
  if (!options.sampler) {
    return null;
  }

  const requestedTimeMs = parseProductTime(options.time);
  if (requestedTimeMs === null) {
    return null;
  }

  const datasets = getS104WaterLevelSamplerDatasets(options.sampler);
  for (const dataset of datasets) {
    const timeIndex = getNearestTimeRecordIndex(dataset.timeline, requestedTimeMs, {
      tieBreaker: "earlier",
    });
    if (timeIndex === null) {
      continue;
    }

    const grid = createS104DatasetWaterLevelFieldGrid({
      dataset,
      requestedTimeMs,
      timeIndex,
    });
    if (grid) {
      return grid;
    }
  }

  return null;
};

export const projectS104WaterLevelFieldGrid = (
  grid: S104WaterLevelFieldGrid,
  targetCrs: string,
): S104ProjectedWaterLevelFieldGrid | null => {
  const origin = projectS104GridPoint(
    {
      crs: grid.crs,
      x: grid.origin.x,
      y: grid.origin.y,
      ...(grid.origin.z !== undefined ? { z: grid.origin.z } : {}),
    },
    targetCrs,
  );
  if (!origin) {
    return null;
  }

  const longitudinalEnd = projectS104GridPoint(
    {
      crs: grid.crs,
      x: grid.origin.x + grid.offsetVectors.longitudinal[0],
      y: grid.origin.y + grid.offsetVectors.longitudinal[1],
      ...(grid.origin.z !== undefined ? { z: grid.origin.z } : {}),
    },
    targetCrs,
  );
  const latitudinalEnd = projectS104GridPoint(
    {
      crs: grid.crs,
      x: grid.origin.x + grid.offsetVectors.latitudinal[0],
      y: grid.origin.y + grid.offsetVectors.latitudinal[1],
      ...(grid.origin.z !== undefined ? { z: grid.origin.z } : {}),
    },
    targetCrs,
  );
  if (!longitudinalEnd || !latitudinalEnd) {
    return null;
  }

  return {
    ...grid,
    crs: targetCrs,
    origin: projectedPointFields(origin),
    offsetVectors: {
      longitudinal: [
        longitudinalEnd.x - origin.x,
        longitudinalEnd.y - origin.y,
      ],
      latitudinal: [
        latitudinalEnd.x - origin.x,
        latitudinalEnd.y - origin.y,
      ],
    },
  };
};

const createS104DatasetWaterLevelFieldGrid = (options: {
  dataset: S104DecodedDataset;
  requestedTimeMs: number;
  timeIndex: number;
}): S104WaterLevelFieldGrid | null => {
  const { dataset, requestedTimeMs, timeIndex } = options;
  const record = dataset.records[timeIndex];
  if (!record) {
    return null;
  }

  const width = dataset.grid.numPointsLongitudinal;
  const height = dataset.grid.numPointsLatitudinal;
  if (width <= 0 || height <= 0 || record.waterLevelHeight.length < width * height) {
    return null;
  }

  const values = new Float32Array(width * height);
  for (let index = 0; index < values.length; index += 1) {
    const value = record.waterLevelHeight[index];
    values[index] =
      typeof value === "number" &&
      !isFillValue(value, dataset.fillValues.waterLevelHeight)
        ? value
        : S104_RENDER_FIELD_NO_DATA_VALUE;
  }

  return {
    datasetId: dataset.datasetId,
    crs: dataset.crs,
    width,
    height,
    values,
    noDataValue: S104_RENDER_FIELD_NO_DATA_VALUE,
    origin: s104GridSampleOrigin(dataset),
    offsetVectors: dataset.grid.offsetVectors,
    sourceTime: new Date(record.time),
    requestedTime: new Date(requestedTimeMs),
    timeIndex,
    ...(dataset.verticalDatum !== undefined ? { verticalDatum: dataset.verticalDatum } : {}),
    ...(dataset.productSpecificationVersion !== undefined
      ? { productSpecificationVersion: dataset.productSpecificationVersion }
      : {}),
  };
};

const s104GridSampleOrigin = (
  dataset: S104DecodedDataset,
): S104WaterLevelFieldGrid["origin"] => {
  const origin = { ...dataset.grid.origin };
  if (dataset.grid.dataOffsetCode === "cell-center") {
    origin.x +=
      (dataset.grid.offsetVectors.longitudinal[0] +
        dataset.grid.offsetVectors.latitudinal[0]) / 2;
    origin.y +=
      (dataset.grid.offsetVectors.longitudinal[1] +
        dataset.grid.offsetVectors.latitudinal[1]) / 2;
  }
  return origin;
};

const projectS104GridPoint = (
  point: { crs: string; x: number; y: number; z?: number },
  targetCrs: string,
): ProjectedCoordinate | null =>
  projectCoordinateToProjectedCrs(
    Coordinates.projected({
      crs: point.crs,
      x: point.x,
      y: point.y,
      ...(point.z !== undefined ? { z: point.z } : {}),
    }),
    targetCrs,
  );

const projectedPointFields = (
  coordinate: ProjectedCoordinate,
): S104ProjectedWaterLevelFieldGrid["origin"] => ({
  x: coordinate.x,
  y: coordinate.y,
  ...(coordinate.z !== undefined ? { z: coordinate.z } : {}),
});
