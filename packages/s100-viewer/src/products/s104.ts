import type { Coordinate } from "../coordinates/types.js";

export type S104WaterLevelTrend =
  | "decreasing"
  | "increasing"
  | "steady"
  | "not-available";

export type S104SamplingMode = "s104-nearest-neighbor";

export type S104WaterLevelSample =
  | {
      status: "value";
      heightMeters: number;
      trend: S104WaterLevelTrend;
      uncertaintyMeters?: number;
      coordinate: Coordinate;
      sourceTime: Date;
      requestedTime: Date;
      gridIndex: { i: number; j: number };
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
