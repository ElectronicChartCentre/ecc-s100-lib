import type { Coordinate, ProjectedCoordinate } from "../coordinates/types.js";

export type S104WaterLevelTrend =
  | "decreasing"
  | "increasing"
  | "steady"
  | "not-available";

export type S104SamplingMode = "s104-nearest-neighbor";

export type S104WaterLevelTrendCode = 0 | 1 | 2 | 3;

export const S104WaterLevelTrendCodes = {
  NotAvailable: 0,
  Decreasing: 1,
  Increasing: 2,
  Steady: 3,
} as const satisfies Record<string, S104WaterLevelTrendCode>;

export const S104DefaultWaterLevelFillValues = {
  waterLevelHeight: -9999,
  waterLevelTrend: S104WaterLevelTrendCodes.NotAvailable,
  uncertainty: -1,
} as const;

export type S104WaterLevelSample =
  | {
      status: "value";
      heightMeters: number;
      trend: S104WaterLevelTrend;
      uncertaintyMeters?: number;
      coordinate: Coordinate;
      requestedCoordinate: Coordinate;
      projectedCoordinate: ProjectedCoordinate;
      sourceTime: Date;
      requestedTime: Date;
      timeIndex: number;
      gridIndex: { i: number; j: number };
      linearIndex: number;
      datasetId: string;
      verticalDatum?: string;
      samplingMode: S104SamplingMode;
      productSpecificationVersion?: string;
    }
  | {
      status:
        | "outside-coverage"
        | "outside-time-range"
        | "missing-value"
        | "unsupported-grid"
        | "datum-mismatch";
      reason: string;
      datasetId?: string;
      requestedCoordinate?: Coordinate;
      requestedTime?: Date;
    };

export interface S104WaterLevelSampler {
  sample(options: {
    coordinate: Coordinate;
    time: Date | number | string;
  }): S104WaterLevelSample;
}

export type S104ProjectedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type S104GeographicBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type S104RegularGridMetadata = {
  datasetId?: string;
  numberOfTimes?: number;
  timeRecordInterval?: number;
  dateTimeOfFirstRecord?: string;
  dateTimeOfLastRecord?: string;
  numPointsLongitudinal?: number;
  numPointsLatitudinal?: number;
  origin?: {
    x?: number;
    y?: number;
    z?: number;
    crs?: string;
  };
  offsetVectors?: {
    longitudinal?: readonly [number, number];
    latitudinal?: readonly [number, number];
  };
  dataOffsetCode?: "lower-left" | "cell-center" | (string & {});
  verticalDatum?: string;
  bounds?: {
    projected?: S104ProjectedBounds;
    geographic?: S104GeographicBounds;
  };
  [key: string]: unknown;
};

export type S104MetadataLike = {
  product?: "S-104" | (string & {});
  productSpecificationVersion?: string;
  numberOfInstances?: number;
  dataCodingFormat?: number | { value?: number; label?: string };
  interpolationType?: "nearestneighbor" | (string & {});
  instanceAttributes?: readonly S104RegularGridMetadata[];
  [key: string]: unknown;
};

export type S104WaterLevelRecord = {
  timePoint: string;
  waterLevelHeight: readonly number[];
  waterLevelTrend?: readonly (number | string)[];
  uncertainty?: readonly number[];
  [key: string]: unknown;
};

export type S104WaterLevelData = {
  id?: string;
  title?: string;
  product?: "S-104" | (string & {});
  productSpecificationVersion?: string;
  dateTimeOfFirstRecord?: string;
  dateTimeOfLastRecord?: string;
  timeRecordInterval?: number;
  numberOfTimes?: number;
  grid?: S104RegularGridMetadata;
  values?: readonly S104WaterLevelRecord[];
  fillValues?: {
    waterLevelHeight?: number;
    waterLevelTrend?: number | string;
    uncertainty?: number;
  };
  fixtureMetadata?: {
    generated?: boolean;
    field?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type S104WaterLevelFillValues = {
  waterLevelHeight: number;
  waterLevelTrend: S104WaterLevelTrendCode;
  uncertainty: number;
};

export type S104ProductTimeline = {
  startTime: number;
  endTime: number;
  intervalSeconds: number;
  numberOfTimes: number;
  times: readonly number[];
};

export type S104WorkflowTimeline = {
  startTime: number;
  endTime: number;
  stepSeconds: number;
  times: readonly number[];
  initialTime: number;
};

export type S104ObservedGrid = {
  minMeters: number;
  maxMeters: number;
};

export type S104PreparedDatasetSummary = {
  timeline: S104WorkflowTimeline | null;
  observedGrid: S104ObservedGrid | null;
};

export type S104NormalizedRegularGrid = {
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
  numPointsLongitudinal: number;
  numPointsLatitudinal: number;
  dataOffsetCode: "lower-left" | "cell-center";
  bounds?: {
    projected?: S104ProjectedBounds;
    geographic?: S104GeographicBounds;
  };
  sourceMetadata: S104RegularGridMetadata;
};

export type S104DecodedWaterLevelRecord = {
  timePoint: string;
  time: number;
  waterLevelHeight: Float64Array;
  waterLevelTrend?: Uint8Array;
  uncertainty?: Float64Array;
  sourceRecord: S104WaterLevelRecord;
};

export type S104DecodedDataset = {
  datasetId: string;
  title?: string;
  productSpecificationVersion?: string;
  crs: string;
  grid: S104NormalizedRegularGrid;
  timeline: S104ProductTimeline;
  records: readonly S104DecodedWaterLevelRecord[];
  numberOfCells: number;
  numberOfDataPoints: number;
  fillValues: S104WaterLevelFillValues;
  verticalDatum?: string;
  bounds?: {
    projected?: S104ProjectedBounds;
    geographic?: S104GeographicBounds;
  };
  source: {
    metadata: S104MetadataLike;
    data: S104WaterLevelData;
    fixtureMetadata?: Record<string, unknown>;
  };
};

export type S104DatasetDecodeErrorCode =
  | "metadata-error"
  | "unsupported-dcf"
  | "unsupported-interpolation"
  | "too-large"
  | "data-error";

export type S104DatasetDecodeResult =
  | {
      status: "success";
      dataset: S104DecodedDataset;
    }
  | {
      status: "error";
      datasetId: string;
      code: S104DatasetDecodeErrorCode;
      message: string;
      details?: Record<string, unknown>;
    };

export type S104CatalogDataset = {
  id: string;
  title?: string;
  crs?: string;
  metadataPath?: string;
  dataPath?: string;
  bounds?: {
    projected?: S104ProjectedBounds;
    geographic?: S104GeographicBounds;
  };
  numberOfTimes?: number;
  timeRecordInterval?: number;
  dateTimeOfFirstRecord?: string;
  dateTimeOfLastRecord?: string;
  productSpecificationVersion?: string;
  fixtureMetadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type S104Catalog = {
  product?: "S-104" | (string & {});
  productSpecificationVersion?: string;
  generated?: boolean;
  generatorVersion?: string;
  generatedAt?: string;
  datasets: readonly S104CatalogDataset[];
  [key: string]: unknown;
};

export type PreparedS104Dataset<TData = unknown, TMetadata = unknown> = {
  datasetId: string;
  title?: string;
  crs: string;
  metadata: TMetadata;
  data: TData;
  decoded: S104DecodedDataset;
  grid: S104RegularGridMetadata;
  numberOfCells: number;
  numberOfDataPoints: number;
  verticalDatum?: string;
  productSpecificationVersion?: string;
  bounds?: {
    projected?: S104ProjectedBounds;
    geographic?: S104GeographicBounds;
  };
};
