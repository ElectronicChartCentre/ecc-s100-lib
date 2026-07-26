import { describe, expect, it } from "vitest";
import {
  createS104WaterLevelSampler,
  decodeS104Dataset,
  S100DataCodingFormat,
  S104Workflow,
  sampleS104WaterLevel,
  type PreparedS104Dataset,
  type S104DecodedDataset,
  type S104WaterLevelData,
} from "../src/index.js";

describe("S-104 water-level sampler", () => {
  it("samples an exact projected grid point with CRS-aware provenance", () => {
    const dataset = decodedFixture();
    const sample = sampleS104WaterLevel({
      datasets: dataset,
      coordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 0,
        y: 0,
      },
      time: "20260726T000000Z",
    });

    expect(sample).toMatchObject({
      status: "value",
      heightMeters: 0.1,
      trend: "not-available",
      coordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 0,
        y: 0,
      },
      requestedCoordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 0,
        y: 0,
      },
      projectedCoordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 0,
        y: 0,
      },
      sourceTime: new Date(Date.UTC(2026, 6, 26, 0, 0, 0)),
      requestedTime: new Date(Date.UTC(2026, 6, 26, 0, 0, 0)),
      timeIndex: 0,
      gridIndex: { i: 0, j: 0 },
      linearIndex: 0,
      datasetId: "fixture",
      verticalDatum: "MSL",
      samplingMode: "s104-nearest-neighbor",
    });
    expect(sample.status === "value" ? sample.uncertaintyMeters : undefined).toBeUndefined();
  });

  it("uses deterministic earlier-time and low-index spatial tie breakers", () => {
    const dataset = decodedFixture();
    const sample = sampleS104WaterLevel({
      datasets: dataset,
      coordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 5,
        y: 5,
      },
      time: "20260726T000500Z",
    });

    expect(sample).toMatchObject({
      status: "value",
      heightMeters: 0.1,
      sourceTime: new Date(Date.UTC(2026, 6, 26, 0, 0, 0)),
      gridIndex: { i: 0, j: 0 },
      linearIndex: 0,
    });
  });

  it("reports outside coverage and outside time range without extrapolating", () => {
    const dataset = decodedFixture();
    expect(
      sampleS104WaterLevel({
        datasets: dataset,
        coordinate: {
          kind: "projected",
          crs: "EPSG:32631",
          x: -1,
          y: 0,
        },
        time: "20260726T000000Z",
      }),
    ).toMatchObject({
      status: "outside-coverage",
      reason: "Requested coordinate is outside all decoded S-104 dataset coverage.",
    });

    expect(
      sampleS104WaterLevel({
        datasets: dataset,
        coordinate: {
          kind: "projected",
          crs: "EPSG:32631",
          x: 0,
          y: 0,
        },
        time: "20260726T002000Z",
      }),
    ).toMatchObject({
      status: "outside-time-range",
      datasetId: "fixture",
      reason: "Requested S-104 sample time is outside the dataset timeline.",
    });
  });

  it("honors fill values and maps optional trend and uncertainty samples", () => {
    const dataset = decodedFixture();
    expect(
      sampleS104WaterLevel({
        datasets: dataset,
        coordinate: {
          kind: "projected",
          crs: "EPSG:32631",
          x: 10,
          y: 0,
        },
        time: "20260726T000000Z",
      }),
    ).toMatchObject({
      status: "missing-value",
      datasetId: "fixture",
      reason: "S-104 water level height is missing at the nearest grid point.",
    });

    const increasing = sampleS104WaterLevel({
      datasets: dataset,
      coordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 0,
        y: 10,
      },
      time: "20260726T000000Z",
    });
    expect(increasing).toMatchObject({
      status: "value",
      heightMeters: 0.3,
      trend: "increasing",
      uncertaintyMeters: 0.12,
    });

    const noUncertainty = sampleS104WaterLevel({
      datasets: decodedFixture({
        values: [
          {
            timePoint: "20260726T000000Z",
            waterLevelHeight: [1, 2, 3, 4],
          },
          {
            timePoint: "20260726T001000Z",
            waterLevelHeight: [2, 3, 4, 5],
          },
        ],
      }),
      coordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 10,
        y: 10,
      },
      time: "20260726T001000Z",
    });
    expect(noUncertainty).toMatchObject({
      status: "value",
      heightMeters: 5,
      trend: "not-available",
    });
    expect(noUncertainty.status === "value" ? noUncertainty.uncertaintyMeters : undefined).toBeUndefined();
  });

  it("projects geodetic coordinates into the dataset CRS when proj4 supports the target CRS", () => {
    const dataset = decodedFixture({
      grid: {
        ...s104Grid(),
        origin: { x: 500000, y: 0, crs: "EPSG:32631" },
        numPointsLongitudinal: 1,
        numPointsLatitudinal: 1,
      },
      values: [
        {
          timePoint: "20260726T000000Z",
          waterLevelHeight: [1.25],
        },
        {
          timePoint: "20260726T001000Z",
          waterLevelHeight: [1.35],
        },
      ],
    });

    const sample = sampleS104WaterLevel({
      datasets: dataset,
      coordinate: {
        kind: "geodetic",
        lon: 3,
        lat: 0,
        datum: "EPSG:4258",
      },
      time: "20260726T000000Z",
    });

    expect(sample).toMatchObject({
      status: "value",
      heightMeters: 1.25,
      gridIndex: { i: 0, j: 0 },
      projectedCoordinate: {
        kind: "projected",
        crs: "EPSG:32631",
      },
    });
    expect(sample.status === "value" ? sample.projectedCoordinate.x : 0).toBeCloseTo(500000, 6);
    expect(sample.status === "value" ? sample.projectedCoordinate.y : 0).toBeCloseTo(0, 6);
  });

  it("accepts prepared workflow datasets and is available from S104Workflow", () => {
    const decoded = decodedFixture();
    const prepared: PreparedS104Dataset = {
      datasetId: "fixture",
      crs: "EPSG:32631",
      metadata: s104Metadata(),
      data: s104Dataset(),
      decoded,
      grid: s104Grid(),
      numberOfCells: decoded.numberOfCells,
      numberOfDataPoints: decoded.numberOfDataPoints,
    };

    const sampler = createS104WaterLevelSampler({ datasets: [prepared] });
    expect(
      sampler.sample({
        coordinate: {
          kind: "projected",
          crs: "EPSG:32631",
          x: 0,
          y: 10,
        },
        time: "20260726T001000Z",
      }),
    ).toMatchObject({
      status: "value",
      heightMeters: 0.4,
      trend: "increasing",
      datasetId: "fixture",
    });

    expect(S104Workflow.createSampler({ datasets: prepared })).toBeDefined();
  });
});

const decodedFixture = (
  dataOverrides: Partial<S104WaterLevelData> = {},
): S104DecodedDataset => {
  const metadata = s104Metadata(dataOverrides.grid);
  const result = decodeS104Dataset({
    datasetId: "fixture",
    metadata,
    data: {
      ...s104Dataset(),
      ...dataOverrides,
    },
  });
  if (result.status === "error") {
    throw new Error(result.message);
  }
  return result.dataset;
};

const s104Metadata = (grid?: S104WaterLevelData["grid"]) => ({
  product: "S-104" as const,
  productSpecificationVersion: "generated-fixture",
  numberOfInstances: 1,
  dataCodingFormat: { value: S100DataCodingFormat.RegularGrid },
  interpolationType: "nearestneighbor" as const,
  instanceAttributes: [grid ?? s104Grid()],
});

const s104Grid = () => ({
  datasetId: "fixture",
  numberOfTimes: 2,
  timeRecordInterval: 600,
  dateTimeOfFirstRecord: "20260726T000000Z",
  dateTimeOfLastRecord: "20260726T001000Z",
  numPointsLongitudinal: 2,
  numPointsLatitudinal: 2,
  origin: { x: 0, y: 0, crs: "EPSG:32631" },
  offsetVectors: {
    longitudinal: [10, 0] as const,
    latitudinal: [0, 10] as const,
  },
  dataOffsetCode: "lower-left" as const,
  verticalDatum: "MSL",
});

const s104Dataset = () => ({
  id: "fixture",
  product: "S-104" as const,
  productSpecificationVersion: "generated-fixture",
  dateTimeOfFirstRecord: "20260726T000000Z",
  dateTimeOfLastRecord: "20260726T001000Z",
  timeRecordInterval: 600,
  numberOfTimes: 2,
  grid: s104Grid(),
  values: [
    {
      timePoint: "20260726T000000Z",
      waterLevelHeight: [0.1, -9999, 0.3, 0.4],
      waterLevelTrend: [0, 1, 2, 3],
      uncertainty: [-1, 0.11, 0.12, 0.13],
    },
    {
      timePoint: "20260726T001000Z",
      waterLevelHeight: [0.2, 0.3, 0.4, 0.5],
      waterLevelTrend: ["not-available", "decreasing", "increasing", "steady"],
      uncertainty: [0.1, 0.11, 0.12, 0.13],
    },
  ],
  fillValues: {
    waterLevelHeight: -9999,
    waterLevelTrend: 0,
    uncertainty: -1,
  },
});
