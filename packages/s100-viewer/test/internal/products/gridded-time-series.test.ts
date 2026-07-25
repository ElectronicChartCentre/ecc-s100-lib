import { describe, expect, it } from "vitest";
import {
  buildUniformTimeline,
  getNearestTimeRecordIndex,
  isFillValue,
  linearIndexFromGridIndex,
  nearestRegularGridPoint,
  parseProductTime,
  projectRegularGridIndex,
  regularGridPointCoordinate,
  type RegularGridGeometry,
} from "../../../src/internal/products/griddedTimeSeries.js";

describe("gridded time-series helpers", () => {
  it("parses S-100 compact UTC times and builds uniform timelines", () => {
    expect(parseProductTime("20260722T101112Z")).toBe(Date.UTC(2026, 6, 22, 10, 11, 12));
    expect(parseProductTime(1_800)).toBe(1_800_000);
    expect(parseProductTime(new Date(Date.UTC(2026, 6, 22)))).toBe(Date.UTC(2026, 6, 22));

    const timeline = buildUniformTimeline({
      startTime: "20260722T100000Z",
      intervalSeconds: 900,
      numberOfTimes: 3,
    });

    expect(timeline).toEqual({
      startTime: Date.UTC(2026, 6, 22, 10, 0, 0),
      endTime: Date.UTC(2026, 6, 22, 10, 30, 0),
      intervalSeconds: 900,
      numberOfTimes: 3,
      times: [
        Date.UTC(2026, 6, 22, 10, 0, 0),
        Date.UTC(2026, 6, 22, 10, 15, 0),
        Date.UTC(2026, 6, 22, 10, 30, 0),
      ],
    });
  });

  it("selects nearest time records with explicit range and tie behavior", () => {
    const timeline = buildUniformTimeline({
      startTime: "20260722T100000Z",
      intervalSeconds: 600,
      numberOfTimes: 4,
    });
    expect(timeline).not.toBeNull();
    if (timeline === null) {
      return;
    }

    expect(getNearestTimeRecordIndex(timeline, "20260722T100000Z")).toBe(0);
    expect(getNearestTimeRecordIndex(timeline, "20260722T101000Z")).toBe(1);
    expect(getNearestTimeRecordIndex(timeline, "20260722T100500Z")).toBe(0);
    expect(getNearestTimeRecordIndex(timeline, "20260722T100500Z", { tieBreaker: "later" })).toBe(1);
    expect(getNearestTimeRecordIndex(timeline, "20260722T095959Z")).toBeNull();
    expect(getNearestTimeRecordIndex(timeline, "20260722T095959Z", { clamp: true })).toBe(0);
    expect(getNearestTimeRecordIndex(timeline, "20260722T103001Z", { clamp: true })).toBe(3);
  });

  it("projects projected coordinates into regular grid indices", () => {
    const grid: RegularGridGeometry = {
      crs: "EPSG:32631",
      origin: { x: 100, y: 200, z: 0 },
      offsetVectors: {
        longitudinal: [10, 0],
        latitudinal: [0, 20],
      },
      numPointsLongitudinal: 4,
      numPointsLatitudinal: 3,
    };

    expect(projectRegularGridIndex(grid, {
      kind: "projected",
      crs: "EPSG:32631",
      x: 115,
      y: 230,
    })).toEqual({ i: 1.5, j: 1.5 });

    const nearest = nearestRegularGridPoint(grid, {
      kind: "projected",
      crs: "EPSG:32631",
      x: 115,
      y: 230,
    });
    expect(nearest).toMatchObject({
      index: { i: 1, j: 1 },
      fractionalIndex: { i: 1.5, j: 1.5 },
      linearIndex: 5,
      coordinate: {
        kind: "projected",
        crs: "EPSG:32631",
        x: 110,
        y: 220,
        z: 0,
      },
    });

    expect(nearestRegularGridPoint(grid, {
      kind: "projected",
      crs: "EPSG:32632",
      x: 115,
      y: 230,
    })).toBeNull();
    expect(nearestRegularGridPoint(grid, {
      kind: "projected",
      crs: "EPSG:32631",
      x: 99,
      y: 200,
    })).toBeNull();
  });

  it("handles cell-center offsets and non-axis-aligned offset vectors", () => {
    const cellCentered: RegularGridGeometry = {
      crs: "EPSG:32631",
      origin: { x: 0, y: 0 },
      offsetVectors: {
        longitudinal: [10, 0],
        latitudinal: [0, 10],
      },
      numPointsLongitudinal: 2,
      numPointsLatitudinal: 2,
      dataOffsetCode: "cell-center",
    };

    expect(regularGridPointCoordinate(cellCentered, { i: 0, j: 0 })).toEqual({
      kind: "projected",
      crs: "EPSG:32631",
      x: 5,
      y: 5,
    });
    expect(projectRegularGridIndex(cellCentered, {
      kind: "projected",
      crs: "EPSG:32631",
      x: 5,
      y: 5,
    })).toEqual({ i: 0, j: 0 });

    const skewed: RegularGridGeometry = {
      crs: "EPSG:32631",
      origin: { x: 0, y: 0 },
      offsetVectors: {
        longitudinal: [10, 0],
        latitudinal: [2, 8],
      },
      numPointsLongitudinal: 5,
      numPointsLatitudinal: 5,
    };

    expect(projectRegularGridIndex(skewed, {
      kind: "projected",
      crs: "EPSG:32631",
      x: 26,
      y: 24,
    })).toEqual({ i: 2, j: 3 });
  });

  it("normalizes row-major indices and fill-value checks", () => {
    expect(linearIndexFromGridIndex({ i: 2, j: 3 }, 10)).toBe(32);
    expect(linearIndexFromGridIndex({ i: -1, j: 0 }, 10)).toBeNull();
    expect(linearIndexFromGridIndex({ i: 1, j: 0 }, 0)).toBeNull();

    expect(isFillValue(-9999, -9999)).toBe(true);
    expect(isFillValue(-9999.0000000001, -9999)).toBe(true);
    expect(isFillValue(-9998, -9999)).toBe(false);
    expect(isFillValue("missing", "missing")).toBe(true);
  });
});
