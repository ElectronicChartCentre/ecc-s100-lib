import { describe, expect, it } from "vitest";
import {
  assessS104Metadata,
  decodeS104Dataset,
  S100DataCodingFormat,
  s104WaterLevelTrendFromCode,
  S104WaterLevelTrendCodes,
} from "../src/index.js";

describe("decodeS104Dataset", () => {
  it("normalizes generated fixture JSON into grid, timeline, typed arrays, and provenance", () => {
    const result = decodeS104Dataset({
      datasetId: "fixture",
      metadata: s104Metadata(),
      data: s104Dataset(),
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }

    expect(result.dataset).toMatchObject({
      datasetId: "fixture",
      crs: "EPSG:32631",
      numberOfCells: 4,
      numberOfDataPoints: 8,
      fillValues: {
        waterLevelHeight: -9999,
        waterLevelTrend: 0,
        uncertainty: -1,
      },
      grid: {
        crs: "EPSG:32631",
        numPointsLongitudinal: 2,
        numPointsLatitudinal: 2,
        dataOffsetCode: "lower-left",
        bounds: {
          projected: {
            minX: 0,
            minY: 0,
            maxX: 10,
            maxY: 10,
          },
        },
      },
      timeline: {
        startTime: Date.UTC(2026, 6, 26, 0, 0, 0),
        endTime: Date.UTC(2026, 6, 26, 0, 10, 0),
        intervalSeconds: 600,
        numberOfTimes: 2,
      },
      source: {
        fixtureMetadata: {
          generated: true,
        },
      },
    });
    expect(result.dataset.timeline.times).toEqual([
      Date.UTC(2026, 6, 26, 0, 0, 0),
      Date.UTC(2026, 6, 26, 0, 10, 0),
    ]);
    expect(result.dataset.records[0]?.waterLevelHeight).toBeInstanceOf(Float64Array);
    expect(Array.from(result.dataset.records[0]?.waterLevelHeight ?? [])).toEqual([
      0.1,
      -9999,
      0.3,
      0.4,
    ]);
    expect(result.dataset.records[0]?.waterLevelTrend).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.dataset.records[0]?.waterLevelTrend ?? [])).toEqual([0, 1, 2, 3]);
    expect(result.dataset.records[0]?.uncertainty).toBeInstanceOf(Float64Array);
    expect(Array.from(result.dataset.records[0]?.uncertainty ?? [])).toEqual([
      -1,
      0.11,
      0.12,
      0.13,
    ]);
    expect(s104WaterLevelTrendFromCode(S104WaterLevelTrendCodes.Increasing)).toBe("increasing");
  });

  it("rejects malformed value arrays with actionable decode details", () => {
    const result = decodeS104Dataset({
      datasetId: "bad-data",
      metadata: s104Metadata(),
      data: {
        ...s104Dataset(),
        values: [
          {
            timePoint: "20260726T000000Z",
            waterLevelHeight: [1],
          },
          {
            timePoint: "20260726T001000Z",
            waterLevelHeight: [1, 2, 3, 4],
          },
        ],
      },
    });

    expect(result).toMatchObject({
      status: "error",
      datasetId: "bad-data",
      code: "data-error",
      message: "S-104 data payload WaterLevel height sample count does not match the grid.",
      details: {
        timeIndex: 0,
        expected: 4,
      },
    });
  });
});

describe("assessS104Metadata", () => {
  it("rejects unsupported interpolation and missing CRS before data fetch", () => {
    expect(
      assessS104Metadata({
        datasetId: "bad-interpolation",
        metadata: {
          ...s104Metadata(),
          interpolationType: "linear",
        },
      }),
    ).toMatchObject({
      status: "rejected",
      code: "unsupported-interpolation",
      interpolationType: "linear",
    });

    expect(
      assessS104Metadata({
        datasetId: "missing-crs",
        metadata: {
          ...s104Metadata(),
          instanceAttributes: [
            {
              ...s104Grid(),
              origin: { x: 0, y: 0 },
            },
          ],
        },
      }),
    ).toMatchObject({
      status: "rejected",
      code: "metadata-error",
      message: "S-104 metadata is missing a regular-grid CRS.",
    });
  });
});

const s104Metadata = () => ({
  product: "S-104" as const,
  productSpecificationVersion: "generated-fixture",
  numberOfInstances: 1,
  dataCodingFormat: { value: S100DataCodingFormat.RegularGrid },
  interpolationType: "nearestneighbor" as const,
  instanceAttributes: [s104Grid()],
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
  fixtureMetadata: {
    generated: true,
  },
});
