#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveS104FixtureOutputRoot } from "./output-root.mjs";

const outputRoot = resolveS104FixtureOutputRoot();

const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;
const DAYS_TO_MILLISECONDS = 24 * HOURS_TO_MILLISECONDS;
const LUNAR_ORBIT_DAYS =
  (27 * DAYS_TO_MILLISECONDS + 7 * HOURS_TO_MILLISECONDS + 43 * 60 * 1000 + 11.6 * 1000) /
  DAYS_TO_MILLISECONDS;
const DAILY_PHASE_TERM = 4 * Math.PI / 24;
const MONTHLY_PHASE_TERM = 2 * Math.PI / (24 * LUNAR_ORBIT_DAYS);
const HEIGHT_FILL_VALUE = -9999;
const TREND_FILL_VALUE = 0;
const UNCERTAINTY_FILL_VALUE = -1;
const TREND_EPSILON_METERS = 0.005;

const fixture = {
  generatorVersion: "0.1.0",
  datasetId: "stavanger-spatial-phase-tide",
  title: "Generated Stavanger S-104 Spatial Phase Tide",
  productSpecificationVersion: "generated-fixture",
  crs: "EPSG:32631",
  origin: {
    x: 649_890.818,
    y: 6_538_260.725,
  },
  center: {
    x: 654_390.818,
    y: 6_542_760.725,
  },
  spacingMeters: {
    x: 150,
    y: 150,
  },
  gridSize: {
    columns: 61,
    rows: 61,
  },
  startTimeMs: Date.UTC(2026, 6, 26, 0, 0, 0),
  intervalSeconds: 3600,
  numberOfTimes: 13,
  propagationSpeedMetersPerHour: 2_000,
  radialRippleAmplitudeMeters: 0.18,
  radialRippleWavelengthMeters: 3_200,
  radialRipplePeriodHours: 9,
  datumOffsetMeters: 0.35,
  verticalDatum: "MSL",
  bounds: {
    geographic: {
      west: 5.625,
      south: 58.968708,
      east: 5.749944,
      north: 59.024184,
    },
  },
  relatedS102DatasetIds: [
    "102NO006J0811_10_U",
    "102NO006T0711_40_U",
    "102NO006T0711_30_U",
    "102NO006J0811_20_U",
  ],
  noDataRegions: [
    {
      center: {
        x: 651_600,
        y: 6_546_000,
      },
      radiusMeters: 450,
    },
  ],
  tide: {
    dailyAmplitude: 1.15,
    dailyOffsetHours: 8,
    monthlyAmplitude: 1.6,
    monthlyAmplitudeOffsetHours: 72,
    monthlyAmplitudeFloor: 0.4,
    monthlyVariationAmplitude: 0.16,
    monthlyVariationOffsetHours: 20,
  },
};

const run = async () => {
  const generated = generateFixture(fixture);
  const s104Root = join(outputRoot, "s104");
  const datasetRoot = join(s104Root, fixture.datasetId);
  await mkdir(datasetRoot, { recursive: true });
  await writeJson(join(s104Root, "catalog.json"), generated.catalog, true);
  await writeJson(join(datasetRoot, "metadata.json"), generated.metadata, true);
  await writeJson(join(datasetRoot, "data.json"), generated.data, false);
  console.log(`Generated S-104 fixture service at ${outputRoot}`);
  console.log(`Dataset '${fixture.datasetId}' has ${fixture.gridSize.columns}x${fixture.gridSize.rows} grid points and ${fixture.numberOfTimes} time records.`);
};

const generateFixture = (options) => {
  const grid = createGridMetadata(options);
  const heightsByTime = [];
  const uncertaintyByTime = [];
  const missingByTime = [];

  for (let timeIndex = 0; timeIndex < options.numberOfTimes; timeIndex += 1) {
    const timeMs = timeAtIndex(options, timeIndex);
    const heights = [];
    const uncertainty = [];
    const missing = [];

    for (let j = 0; j < options.gridSize.rows; j += 1) {
      for (let i = 0; i < options.gridSize.columns; i += 1) {
        const point = pointAtGridIndex(options, i, j);
        const isMissing = isNoDataPoint(options, point);
        missing.push(isMissing);
        if (isMissing) {
          heights.push(HEIGHT_FILL_VALUE);
          uncertainty.push(UNCERTAINTY_FILL_VALUE);
          continue;
        }

        heights.push(roundMeters(waterLevelHeight(options, point, timeMs)));
        uncertainty.push(roundMeters(uncertaintyMeters(options, point)));
      }
    }

    heightsByTime.push(heights);
    uncertaintyByTime.push(uncertainty);
    missingByTime.push(missing);
  }

  const values = heightsByTime.map((waterLevelHeight, timeIndex) => ({
    timePoint: compactUtc(timeAtIndex(options, timeIndex)),
    waterLevelHeight,
    waterLevelTrend: trendForTimeIndex(heightsByTime, missingByTime[timeIndex] ?? [], timeIndex),
    uncertainty: uncertaintyByTime[timeIndex] ?? [],
  }));

  const data = {
    id: options.datasetId,
    title: options.title,
    product: "S-104",
    productSpecificationVersion: options.productSpecificationVersion,
    dateTimeOfFirstRecord: compactUtc(options.startTimeMs),
    dateTimeOfLastRecord: compactUtc(timeAtIndex(options, options.numberOfTimes - 1)),
    timeRecordInterval: options.intervalSeconds,
    numberOfTimes: options.numberOfTimes,
    grid,
    values,
    fillValues: {
      waterLevelHeight: HEIGHT_FILL_VALUE,
      waterLevelTrend: TREND_FILL_VALUE,
      uncertainty: UNCERTAINTY_FILL_VALUE,
    },
    fixtureMetadata: {
      generated: true,
      generatorVersion: options.generatorVersion,
      field: "spatial-phase-tide",
      generatedAt: "2026-07-26T00:00:00Z",
      relatedS102DatasetIds: options.relatedS102DatasetIds,
      generationParameters: {
        center: options.center,
        propagationSpeedMetersPerHour: options.propagationSpeedMetersPerHour,
        radialRippleAmplitudeMeters: options.radialRippleAmplitudeMeters,
        radialRippleWavelengthMeters: options.radialRippleWavelengthMeters,
        radialRipplePeriodHours: options.radialRipplePeriodHours,
        datumOffsetMeters: options.datumOffsetMeters,
      },
    },
  };

  const metadata = {
    product: "S-104",
    productSpecificationVersion: options.productSpecificationVersion,
    numberOfInstances: 1,
    dataCodingFormat: {
      value: 2,
      label: "RegularGrid",
    },
    interpolationType: "nearestneighbor",
    instanceAttributes: [grid],
  };

  const catalog = {
    product: "S-104",
    productSpecificationVersion: options.productSpecificationVersion,
    generated: true,
    generatorVersion: options.generatorVersion,
    generatedAt: "2026-07-26T00:00:00Z",
    datasets: [
      {
        id: options.datasetId,
        title: options.title,
        crs: options.crs,
        metadataPath: `/s104/${options.datasetId}/metadata.json`,
        dataPath: `/s104/${options.datasetId}/data.json`,
        bounds: grid.bounds,
        numberOfTimes: options.numberOfTimes,
        timeRecordInterval: options.intervalSeconds,
        dateTimeOfFirstRecord: compactUtc(options.startTimeMs),
        dateTimeOfLastRecord: compactUtc(timeAtIndex(options, options.numberOfTimes - 1)),
        fixtureMetadata: {
          generated: true,
          field: "spatial-phase-tide",
          relatedS102DatasetIds: options.relatedS102DatasetIds,
        },
      },
    ],
  };

  return { catalog, metadata, data };
};

const createGridMetadata = (options) => {
  const maxX = options.origin.x + options.spacingMeters.x * (options.gridSize.columns - 1);
  const maxY = options.origin.y + options.spacingMeters.y * (options.gridSize.rows - 1);
  return {
    datasetId: options.datasetId,
    numberOfTimes: options.numberOfTimes,
    timeRecordInterval: options.intervalSeconds,
    dateTimeOfFirstRecord: compactUtc(options.startTimeMs),
    dateTimeOfLastRecord: compactUtc(timeAtIndex(options, options.numberOfTimes - 1)),
    numPointsLongitudinal: options.gridSize.columns,
    numPointsLatitudinal: options.gridSize.rows,
    origin: {
      x: options.origin.x,
      y: options.origin.y,
      crs: options.crs,
    },
    offsetVectors: {
      longitudinal: [options.spacingMeters.x, 0],
      latitudinal: [0, options.spacingMeters.y],
    },
    dataOffsetCode: "lower-left",
    verticalDatum: options.verticalDatum,
    bounds: {
      projected: {
        minX: options.origin.x,
        minY: options.origin.y,
        maxX,
        maxY,
      },
      geographic: options.bounds.geographic,
    },
  };
};

const waterLevelHeight = (options, point, timeMs) => {
  const r = distance(point, options.center);
  const elapsedHours = (timeMs - options.startTimeMs) / HOURS_TO_MILLISECONDS;
  const phaseDelayHours = r / options.propagationSpeedMetersPerHour;
  const delayedTime = timeMs - phaseDelayHours * HOURS_TO_MILLISECONDS;
  const radialRipple =
    options.radialRippleAmplitudeMeters *
    Math.sin(
      (2 * Math.PI * r) / options.radialRippleWavelengthMeters -
      (2 * Math.PI * elapsedHours) / options.radialRipplePeriodHours,
    );
  return options.datumOffsetMeters + simulatedTide(options, delayedTime) + radialRipple;
};

const simulatedTide = (options, timeMs) => {
  const hoursSinceStart = (timeMs - options.startTimeMs) / HOURS_TO_MILLISECONDS;
  const tide = options.tide;
  const divisor = tide.monthlyAmplitude / 2 + tide.dailyAmplitude / 2;
  const dailyFactor =
    tide.dailyAmplitude *
    Math.sin(DAILY_PHASE_TERM * (hoursSinceStart + tide.dailyOffsetHours));
  const monthlyFactor =
    tide.monthlyAmplitudeFloor +
    Math.abs(
      tide.monthlyAmplitude *
      Math.sin(MONTHLY_PHASE_TERM * (hoursSinceStart + tide.monthlyAmplitudeOffsetHours)),
    );
  const monthlyVariation =
    tide.monthlyVariationAmplitude *
    Math.sin(MONTHLY_PHASE_TERM * (hoursSinceStart + tide.monthlyVariationOffsetHours));

  return (dailyFactor * monthlyFactor) / divisor + monthlyVariation + dailyFactor;
};

const trendForTimeIndex = (heightsByTime, missing, timeIndex) => {
  const current = heightsByTime[timeIndex] ?? [];
  const previous = heightsByTime[timeIndex - 1];
  const next = heightsByTime[timeIndex + 1];
  return current.map((height, index) => {
    if (missing[index] || height === HEIGHT_FILL_VALUE) {
      return TREND_FILL_VALUE;
    }
    const comparison = previous?.[index] ?? next?.[index];
    if (comparison === undefined || comparison === HEIGHT_FILL_VALUE) {
      return 3;
    }
    const delta = height - comparison;
    if (delta > TREND_EPSILON_METERS) {
      return 2;
    }
    if (delta < -TREND_EPSILON_METERS) {
      return 1;
    }
    return 3;
  });
};

const uncertaintyMeters = (options, point) => {
  const halfWidth = options.spacingMeters.x * (options.gridSize.columns - 1) / 2;
  const halfHeight = options.spacingMeters.y * (options.gridSize.rows - 1) / 2;
  const maxRadius = Math.hypot(halfWidth, halfHeight);
  return 0.05 + 0.1 * (distance(point, options.center) / maxRadius);
};

const isNoDataPoint = (options, point) =>
  options.noDataRegions.some((region) =>
    distance(point, region.center) <= region.radiusMeters,
  );

const pointAtGridIndex = (options, i, j) => ({
  x: options.origin.x + options.spacingMeters.x * i,
  y: options.origin.y + options.spacingMeters.y * j,
});

const timeAtIndex = (options, timeIndex) =>
  options.startTimeMs + options.intervalSeconds * 1000 * timeIndex;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const compactUtc = (timeMs) => {
  const iso = new Date(timeMs).toISOString();
  return iso.replace(/[-:]/gu, "").replace(".000", "");
};

const roundMeters = (value) => Math.round(value * 1000) / 1000;

const writeJson = async (path, value, pretty) => {
  const json = pretty
    ? `${JSON.stringify(value, null, 2)}\n`
    : `${JSON.stringify(value)}\n`;
  await writeFile(path, json, "utf8");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
