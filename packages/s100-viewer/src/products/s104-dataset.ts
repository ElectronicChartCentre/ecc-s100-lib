import {
  buildUniformTimeline,
  type ProductTimeline,
  type RegularGridGeometry,
} from "../internal/products/griddedTimeSeries.js";
import {
  assessS104Metadata,
  s104RegularGridFromMetadata,
} from "./s104-metadata.js";
import {
  S104DefaultWaterLevelFillValues,
  S104WaterLevelTrendCodes,
  type S104DatasetDecodeErrorCode,
  type S104DatasetDecodeResult,
  type S104DecodedDataset,
  type S104DecodedWaterLevelRecord,
  type S104GeographicBounds,
  type S104MetadataLike,
  type S104NormalizedRegularGrid,
  type S104ProjectedBounds,
  type S104RegularGridMetadata,
  type S104WaterLevelData,
  type S104WaterLevelFillValues,
  type S104WaterLevelRecord,
  type S104WaterLevelTrend,
  type S104WaterLevelTrendCode,
} from "./s104.js";

export type DecodeS104DatasetOptions = {
  datasetId: string;
  metadata: S104MetadataLike | null | undefined;
  data: S104WaterLevelData | null | undefined;
  maxDataPoints?: number;
  supportedDataCodingFormats?: readonly number[];
  supportedInterpolationTypes?: readonly string[];
};

export const decodeS104Dataset = (
  options: DecodeS104DatasetOptions,
): S104DatasetDecodeResult => {
  const assessment = assessS104Metadata({
    datasetId: options.datasetId,
    metadata: options.metadata,
    ...(options.maxDataPoints !== undefined ? { maxDataPoints: options.maxDataPoints } : {}),
    ...(options.supportedDataCodingFormats !== undefined
      ? { supportedDataCodingFormats: options.supportedDataCodingFormats }
      : {}),
    ...(options.supportedInterpolationTypes !== undefined
      ? { supportedInterpolationTypes: options.supportedInterpolationTypes }
      : {}),
  });
  if (assessment.status === "rejected") {
    return decodeError(
      options.datasetId,
      assessment.code,
      assessment.message,
      {
        ...(assessment.dataCodingFormat !== undefined
          ? { dataCodingFormat: assessment.dataCodingFormat }
          : {}),
        ...(assessment.interpolationType !== undefined
          ? { interpolationType: assessment.interpolationType }
          : {}),
        ...(assessment.numberOfDataPoints !== undefined
          ? { numberOfDataPoints: assessment.numberOfDataPoints }
          : {}),
      },
    );
  }

  if (!isRecord(options.data)) {
    return decodeError(
      options.datasetId,
      "data-error",
      "S-104 data payload is missing or invalid.",
    );
  }

  const data = options.data;
  if (data.product !== undefined && data.product !== "S-104") {
    return decodeError(
      options.datasetId,
      "data-error",
      "S-104 data payload product identifier is invalid.",
      { product: data.product },
    );
  }

  const dataGrid = data.grid;
  if (dataGrid !== undefined) {
    const gridCompatibilityError = compatibleGridError(assessment.grid, dataGrid);
    if (gridCompatibilityError !== null) {
      return decodeError(options.datasetId, "data-error", gridCompatibilityError);
    }
  }

  const timeline = createS104Timeline(assessment.grid, data);
  if (timeline === null) {
    return decodeError(
      options.datasetId,
      "data-error",
      "S-104 data payload time metadata is missing or invalid.",
    );
  }

  if (!Array.isArray(data.values)) {
    return decodeError(
      options.datasetId,
      "data-error",
      "S-104 data payload is missing WaterLevel records.",
    );
  }
  if (data.values.length !== timeline.numberOfTimes) {
    return decodeError(
      options.datasetId,
      "data-error",
      "S-104 data payload time record count does not match metadata.",
      {
        expected: timeline.numberOfTimes,
        actual: data.values.length,
      },
    );
  }

  const fillValues = normalizeS104FillValues(data.fillValues);
  const recordsResult = decodeRecords({
    records: data.values,
    numberOfCells: assessment.numberOfCells,
    timeline,
    fillValues,
  });
  if (recordsResult.status === "error") {
    return decodeError(
      options.datasetId,
      "data-error",
      recordsResult.message,
      recordsResult.details,
    );
  }

  const grid = normalizeGrid(assessment.grid);
  const bounds = normalizeBounds(assessment.grid, grid);
  const source: S104DecodedDataset["source"] = {
    metadata: options.metadata as S104MetadataLike,
    data,
    ...(data.fixtureMetadata !== undefined
      ? { fixtureMetadata: data.fixtureMetadata }
      : {}),
  };
  const decoded: S104DecodedDataset = {
    datasetId: options.datasetId,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(assessment.productSpecificationVersion !== undefined
      ? { productSpecificationVersion: assessment.productSpecificationVersion }
      : data.productSpecificationVersion !== undefined
        ? { productSpecificationVersion: data.productSpecificationVersion }
        : {}),
    crs: grid.crs,
    grid: {
      ...grid,
      ...(bounds !== undefined ? { bounds } : {}),
    },
    timeline,
    records: recordsResult.records,
    numberOfCells: assessment.numberOfCells,
    numberOfDataPoints: assessment.numberOfDataPoints,
    fillValues,
    ...(assessment.verticalDatum !== undefined
      ? { verticalDatum: assessment.verticalDatum }
      : {}),
    ...(bounds !== undefined ? { bounds } : {}),
    source,
  };

  return {
    status: "success",
    dataset: decoded,
  };
};

export const normalizeS104FillValues = (
  fillValues: S104WaterLevelData["fillValues"],
): S104WaterLevelFillValues => ({
  waterLevelHeight: finiteNumberOrFallback(
    fillValues?.waterLevelHeight,
    S104DefaultWaterLevelFillValues.waterLevelHeight,
  ),
  waterLevelTrend: s104WaterLevelTrendCodeFromValue(fillValues?.waterLevelTrend)
    ?? S104DefaultWaterLevelFillValues.waterLevelTrend,
  uncertainty: finiteNumberOrFallback(
    fillValues?.uncertainty,
    S104DefaultWaterLevelFillValues.uncertainty,
  ),
});

export const s104WaterLevelTrendFromCode = (
  code: S104WaterLevelTrendCode,
): S104WaterLevelTrend => {
  switch (code) {
    case S104WaterLevelTrendCodes.Decreasing:
      return "decreasing";
    case S104WaterLevelTrendCodes.Increasing:
      return "increasing";
    case S104WaterLevelTrendCodes.Steady:
      return "steady";
    case S104WaterLevelTrendCodes.NotAvailable:
      return "not-available";
  }
};

export const s104WaterLevelTrendCodeFromValue = (
  value: unknown,
): S104WaterLevelTrendCode | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.trunc(value);
    if (rounded === 0 || rounded === 1 || rounded === 2 || rounded === 3) {
      return rounded;
    }
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = normalizeToken(value);
  if (normalized === "0" || normalized === "notavailable" || normalized === "notapplicable") {
    return S104WaterLevelTrendCodes.NotAvailable;
  }
  if (normalized === "1" || normalized === "decreasing" || normalized === "falling") {
    return S104WaterLevelTrendCodes.Decreasing;
  }
  if (normalized === "2" || normalized === "increasing" || normalized === "rising") {
    return S104WaterLevelTrendCodes.Increasing;
  }
  if (normalized === "3" || normalized === "steady" || normalized === "unchanged") {
    return S104WaterLevelTrendCodes.Steady;
  }
  return null;
};

export const createS104Timeline = (
  grid: S104RegularGridMetadata,
  data?: Pick<
    S104WaterLevelData,
    "dateTimeOfFirstRecord" | "dateTimeOfLastRecord" | "timeRecordInterval" | "numberOfTimes"
  >,
): ProductTimeline | null => {
  const startTime = data?.dateTimeOfFirstRecord ?? grid.dateTimeOfFirstRecord;
  const intervalSeconds = data?.timeRecordInterval ?? grid.timeRecordInterval;
  const numberOfTimes = data?.numberOfTimes ?? grid.numberOfTimes;
  if (
    startTime === undefined ||
    intervalSeconds === undefined ||
    numberOfTimes === undefined
  ) {
    return null;
  }
  return buildUniformTimeline({
    startTime,
    intervalSeconds,
    numberOfTimes,
    ...(data?.dateTimeOfLastRecord !== undefined
      ? { endTime: data.dateTimeOfLastRecord }
      : grid.dateTimeOfLastRecord !== undefined
        ? { endTime: grid.dateTimeOfLastRecord }
        : {}),
  });
};

export const normalizeS104RegularGrid = (
  metadata: S104MetadataLike | null | undefined,
): S104NormalizedRegularGrid | null => {
  const grid = s104RegularGridFromMetadata(metadata);
  return grid !== null ? normalizeGrid(grid) : null;
};

const decodeRecords = (options: {
  records: readonly S104WaterLevelRecord[];
  numberOfCells: number;
  timeline: ProductTimeline;
  fillValues: S104WaterLevelFillValues;
}): { status: "success"; records: readonly S104DecodedWaterLevelRecord[] } | {
  status: "error";
  message: string;
  details?: Record<string, unknown>;
} => {
  const decodedRecords: S104DecodedWaterLevelRecord[] = [];
  for (const [timeIndex, record] of options.records.entries()) {
    const expectedTime = options.timeline.times[timeIndex];
    if (expectedTime === undefined) {
      return {
        status: "error",
        message: "S-104 data payload contains an unexpected time record.",
        details: { timeIndex },
      };
    }
    const recordTime = Date.parse(record.timePoint.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u,
      "$1-$2-$3T$4:$5:$6Z",
    ));
    if (!Number.isFinite(recordTime)) {
      return {
        status: "error",
        message: "S-104 data payload contains an invalid time record.",
        details: { timeIndex, timePoint: record.timePoint },
      };
    }
    if (Math.abs(recordTime - expectedTime) > 1) {
      return {
        status: "error",
        message: "S-104 data payload time records do not match the uniform timeline.",
        details: {
          timeIndex,
          expectedTime,
          actualTime: recordTime,
        },
      };
    }

    const height = numericArrayFromUnknown(record.waterLevelHeight, options.numberOfCells);
    if (height === null) {
      return {
        status: "error",
        message: "S-104 data payload WaterLevel height sample count does not match the grid.",
        details: { timeIndex, expected: options.numberOfCells },
      };
    }

    const trend = record.waterLevelTrend !== undefined
      ? trendArrayFromUnknown(record.waterLevelTrend, options.numberOfCells)
      : undefined;
    if (trend === null) {
      return {
        status: "error",
        message: "S-104 data payload WaterLevel trend sample count does not match the grid.",
        details: { timeIndex, expected: options.numberOfCells },
      };
    }

    const uncertainty = record.uncertainty !== undefined
      ? numericArrayFromUnknown(record.uncertainty, options.numberOfCells)
      : undefined;
    if (uncertainty === null) {
      return {
        status: "error",
        message: "S-104 data payload WaterLevel uncertainty sample count does not match the grid.",
        details: { timeIndex, expected: options.numberOfCells },
      };
    }

    decodedRecords.push({
      timePoint: record.timePoint,
      time: recordTime,
      waterLevelHeight: height,
      ...(trend !== undefined ? { waterLevelTrend: trend } : {}),
      ...(uncertainty !== undefined ? { uncertainty } : {}),
      sourceRecord: record,
    });
  }

  return {
    status: "success",
    records: decodedRecords,
  };
};

const normalizeGrid = (grid: S104RegularGridMetadata): S104NormalizedRegularGrid => {
  const origin = grid.origin;
  const offsetVectors = grid.offsetVectors;
  return {
    crs: origin?.crs ?? "unknown",
    origin: {
      x: origin?.x ?? 0,
      y: origin?.y ?? 0,
      ...(origin?.z !== undefined ? { z: origin.z } : {}),
    },
    offsetVectors: {
      longitudinal: offsetVectors?.longitudinal ?? [1, 0],
      latitudinal: offsetVectors?.latitudinal ?? [0, 1],
    },
    numPointsLongitudinal: Math.floor(grid.numPointsLongitudinal ?? 0),
    numPointsLatitudinal: Math.floor(grid.numPointsLatitudinal ?? 0),
    dataOffsetCode: grid.dataOffsetCode === "cell-center" ? "cell-center" : "lower-left",
    sourceMetadata: grid,
  };
};

const normalizeBounds = (
  sourceGrid: S104RegularGridMetadata,
  grid: S104NormalizedRegularGrid,
): S104NormalizedRegularGrid["bounds"] | undefined => {
  const projected = sourceGrid.bounds?.projected ?? deriveProjectedBounds(grid);
  const geographic = sourceGrid.bounds?.geographic;
  if (projected === undefined && geographic === undefined) {
    return undefined;
  }
  return {
    ...(projected !== undefined ? { projected } : {}),
    ...(geographic !== undefined ? { geographic } : {}),
  };
};

const deriveProjectedBounds = (
  grid: Pick<
    RegularGridGeometry,
    "origin" | "offsetVectors" | "numPointsLongitudinal" | "numPointsLatitudinal" | "dataOffsetCode"
  >,
): S104ProjectedBounds | undefined => {
  if (
    grid.numPointsLongitudinal <= 0 ||
    grid.numPointsLatitudinal <= 0
  ) {
    return undefined;
  }
  const sampleOrigin = {
    x: grid.origin.x + (grid.dataOffsetCode === "cell-center"
      ? (grid.offsetVectors.longitudinal[0] + grid.offsetVectors.latitudinal[0]) / 2
      : 0),
    y: grid.origin.y + (grid.dataOffsetCode === "cell-center"
      ? (grid.offsetVectors.longitudinal[1] + grid.offsetVectors.latitudinal[1]) / 2
      : 0),
  };
  const lastI = grid.numPointsLongitudinal - 1;
  const lastJ = grid.numPointsLatitudinal - 1;
  const corners = [
    sampleOrigin,
    {
      x: sampleOrigin.x + grid.offsetVectors.longitudinal[0] * lastI,
      y: sampleOrigin.y + grid.offsetVectors.longitudinal[1] * lastI,
    },
    {
      x: sampleOrigin.x + grid.offsetVectors.latitudinal[0] * lastJ,
      y: sampleOrigin.y + grid.offsetVectors.latitudinal[1] * lastJ,
    },
    {
      x: sampleOrigin.x + grid.offsetVectors.longitudinal[0] * lastI
        + grid.offsetVectors.latitudinal[0] * lastJ,
      y: sampleOrigin.y + grid.offsetVectors.longitudinal[1] * lastI
        + grid.offsetVectors.latitudinal[1] * lastJ,
    },
  ];
  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
};

const compatibleGridError = (
  metadataGrid: S104RegularGridMetadata,
  dataGrid: S104RegularGridMetadata,
): string | null => {
  if (
    dataGrid.numPointsLongitudinal !== undefined &&
    dataGrid.numPointsLongitudinal !== metadataGrid.numPointsLongitudinal
  ) {
    return "S-104 data grid longitudinal point count does not match metadata.";
  }
  if (
    dataGrid.numPointsLatitudinal !== undefined &&
    dataGrid.numPointsLatitudinal !== metadataGrid.numPointsLatitudinal
  ) {
    return "S-104 data grid latitudinal point count does not match metadata.";
  }
  const metadataCrs = metadataGrid.origin?.crs;
  const dataCrs = dataGrid.origin?.crs;
  if (metadataCrs !== undefined && dataCrs !== undefined && metadataCrs !== dataCrs) {
    return "S-104 data grid CRS does not match metadata.";
  }
  return null;
};

const numericArrayFromUnknown = (
  value: unknown,
  expectedLength: number,
): Float64Array | null => {
  if (!Array.isArray(value) && !(value instanceof Float32Array) && !(value instanceof Float64Array)) {
    return null;
  }
  if (value.length !== expectedLength) {
    return null;
  }
  const array = new Float64Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    const item = value[index];
    if (typeof item !== "number" || !Number.isFinite(item)) {
      return null;
    }
    array[index] = item;
  }
  return array;
};

const trendArrayFromUnknown = (
  value: unknown,
  expectedLength: number,
): Uint8Array | null => {
  if (!Array.isArray(value) && !(value instanceof Uint8Array)) {
    return null;
  }
  if (value.length !== expectedLength) {
    return null;
  }
  const array = new Uint8Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    const code = s104WaterLevelTrendCodeFromValue(value[index]);
    if (code === null) {
      return null;
    }
    array[index] = code;
  }
  return array;
};

const finiteNumberOrFallback = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const decodeError = (
  datasetId: string,
  code: S104DatasetDecodeErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Extract<S104DatasetDecodeResult, { status: "error" }> => ({
  status: "error",
  datasetId,
  code,
  message,
  ...(details !== undefined && Object.keys(details).length > 0 ? { details } : {}),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const normalizeToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s_-]+/gu, "");
