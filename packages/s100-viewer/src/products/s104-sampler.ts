import {
  getNearestTimeRecordIndex,
  isFillValue,
  nearestRegularGridPoint,
  parseProductTime,
} from "../internal/products/griddedTimeSeries.js";
import { projectCoordinateToProjectedCrs } from "../internal/coordinates/projection.js";
import {
  s104WaterLevelTrendCodeFromValue,
  s104WaterLevelTrendFromCode,
} from "./s104-dataset.js";
import {
  S104DefaultWaterLevelFillValues,
  type PreparedS104Dataset,
  type S104DecodedDataset,
  type S104SamplingMode,
  type S104WaterLevelSample,
  type S104WaterLevelSampler,
  type S104WaterLevelTrendCode,
} from "./s104.js";
import type { Coordinate, ProjectedCoordinate } from "../coordinates/types.js";

export type S104SamplerDatasetInput =
  | S104DecodedDataset
  | Pick<PreparedS104Dataset, "decoded">;

export type S104CoordinateProjector = (
  coordinate: Coordinate,
  targetCrs: string,
) => ProjectedCoordinate | null;

export type CreateS104WaterLevelSamplerOptions = {
  datasets: S104SamplerDatasetInput | readonly S104SamplerDatasetInput[];
  coordinateProjector?: S104CoordinateProjector;
};

export type SampleS104WaterLevelOptions = {
  datasets: S104SamplerDatasetInput | readonly S104SamplerDatasetInput[];
  coordinate: Coordinate;
  time: Date | number | string;
  coordinateProjector?: S104CoordinateProjector;
};

const S104_NEAREST_NEIGHBOR: S104SamplingMode = "s104-nearest-neighbor";

export const createS104WaterLevelSampler = (
  options: CreateS104WaterLevelSamplerOptions,
): S104WaterLevelSampler => ({
  sample: (sampleOptions) =>
    sampleS104WaterLevel({
      datasets: options.datasets,
      coordinate: sampleOptions.coordinate,
      time: sampleOptions.time,
      ...(options.coordinateProjector !== undefined
        ? { coordinateProjector: options.coordinateProjector }
        : {}),
    }),
});

export const sampleS104WaterLevel = (
  options: SampleS104WaterLevelOptions,
): S104WaterLevelSample => {
  const requestedTimeMs = parseProductTime(options.time);
  const requestedTime = requestedTimeMs !== null
    ? new Date(requestedTimeMs)
    : undefined;
  const datasets = normalizeDatasets(options.datasets);
  if (datasets.length === 0) {
    return unavailableSample({
      status: "outside-coverage",
      reason: "No decoded S-104 datasets are available.",
      requestedCoordinate: options.coordinate,
      ...(requestedTime !== undefined ? { requestedTime } : {}),
    });
  }

  const coordinateProjector = options.coordinateProjector ?? projectCoordinateToProjectedCrs;
  let sawProjectionFailure = false;
  for (const dataset of datasets) {
    const projectedCoordinate = coordinateProjector(options.coordinate, dataset.crs);
    if (projectedCoordinate === null) {
      sawProjectionFailure = true;
      continue;
    }

    const nearest = nearestRegularGridPoint(dataset.grid, projectedCoordinate);
    if (nearest === null) {
      continue;
    }

    if (requestedTimeMs === null || requestedTime === undefined) {
      return unavailableSample({
        status: "outside-time-range",
        datasetId: dataset.datasetId,
        reason: "Requested S-104 sample time could not be parsed.",
        requestedCoordinate: options.coordinate,
      });
    }

    const timeIndex = getNearestTimeRecordIndex(dataset.timeline, requestedTimeMs, {
      tieBreaker: "earlier",
    });
    if (timeIndex === null) {
      return unavailableSample({
        status: "outside-time-range",
        datasetId: dataset.datasetId,
        reason: "Requested S-104 sample time is outside the dataset timeline.",
        requestedCoordinate: options.coordinate,
        requestedTime,
      });
    }

    const record = dataset.records[timeIndex];
    if (record === undefined) {
      return unavailableSample({
        status: "missing-value",
        datasetId: dataset.datasetId,
        reason: "S-104 time record is missing for the selected time index.",
        requestedCoordinate: options.coordinate,
        requestedTime,
      });
    }

    const height = record.waterLevelHeight[nearest.linearIndex];
    if (
      typeof height !== "number" ||
      isFillValue(height, dataset.fillValues.waterLevelHeight)
    ) {
      return unavailableSample({
        status: "missing-value",
        datasetId: dataset.datasetId,
        reason: "S-104 water level height is missing at the nearest grid point.",
        requestedCoordinate: options.coordinate,
        requestedTime,
      });
    }

    const trendCode = normalizedTrendCode(
      record.waterLevelTrend?.[nearest.linearIndex],
      dataset.fillValues.waterLevelTrend,
    );
    const uncertainty = normalizedUncertainty(
      record.uncertainty?.[nearest.linearIndex],
      dataset.fillValues.uncertainty,
    );

    return {
      status: "value",
      heightMeters: height,
      trend: s104WaterLevelTrendFromCode(trendCode),
      ...(uncertainty !== undefined ? { uncertaintyMeters: uncertainty } : {}),
      coordinate: nearest.coordinate,
      requestedCoordinate: options.coordinate,
      projectedCoordinate,
      sourceTime: new Date(record.time),
      requestedTime,
      timeIndex,
      gridIndex: nearest.index,
      linearIndex: nearest.linearIndex,
      datasetId: dataset.datasetId,
      ...(dataset.verticalDatum !== undefined ? { verticalDatum: dataset.verticalDatum } : {}),
      samplingMode: S104_NEAREST_NEIGHBOR,
      ...(dataset.productSpecificationVersion !== undefined
        ? { productSpecificationVersion: dataset.productSpecificationVersion }
        : {}),
    };
  }

  return unavailableSample({
    status: sawProjectionFailure ? "unsupported-grid" : "outside-coverage",
    reason: sawProjectionFailure
      ? "Requested coordinate could not be projected into any S-104 dataset CRS."
      : "Requested coordinate is outside all decoded S-104 dataset coverage.",
    requestedCoordinate: options.coordinate,
    ...(requestedTime !== undefined ? { requestedTime } : {}),
  });
};

const normalizeDatasets = (
  datasets: S104SamplerDatasetInput | readonly S104SamplerDatasetInput[],
): readonly S104DecodedDataset[] => {
  const items = Array.isArray(datasets) ? datasets : [datasets];
  return items.map(decodedDatasetFromInput);
};

const decodedDatasetFromInput = (
  input: S104SamplerDatasetInput,
): S104DecodedDataset =>
  "decoded" in input ? input.decoded : input;

const normalizedTrendCode = (
  value: unknown,
  fillValue: S104WaterLevelTrendCode,
): S104WaterLevelTrendCode => {
  if (isFillValue(value, fillValue)) {
    return S104DefaultWaterLevelFillValues.waterLevelTrend;
  }
  return s104WaterLevelTrendCodeFromValue(value)
    ?? S104DefaultWaterLevelFillValues.waterLevelTrend;
};

const normalizedUncertainty = (
  value: unknown,
  fillValue: number,
): number | undefined =>
  typeof value === "number" && !isFillValue(value, fillValue)
    ? value
    : undefined;

const unavailableSample = (
  sample: Extract<S104WaterLevelSample, { status: Exclude<S104WaterLevelSample["status"], "value"> }>,
): S104WaterLevelSample => sample;
