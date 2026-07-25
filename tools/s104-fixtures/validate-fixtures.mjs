#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveS104FixtureOutputRoot } from "./output-root.mjs";

const run = async () => {
  const outputRoot = resolveS104FixtureOutputRoot();
  const catalog = await readJson(join(outputRoot, "s104/catalog.json"));
  assert(catalog.product === "S-104", "catalog product must be S-104");
  assert(Array.isArray(catalog.datasets), "catalog datasets must be an array");
  assert(catalog.datasets.length > 0, "catalog must include at least one dataset");

  const dataset = catalog.datasets[0];
  assert(typeof dataset.id === "string" && dataset.id.length > 0, "dataset id is required");
  assert(dataset.dataPath === `/s104/${dataset.id}/data.json`, "dataset dataPath must match id");
  assert(
    dataset.metadataPath === `/s104/${dataset.id}/metadata.json`,
    "dataset metadataPath must match id",
  );

  const metadata = await readJson(join(outputRoot, dataset.metadataPath));
  const data = await readJson(join(outputRoot, dataset.dataPath));
  assert(data.id === dataset.id, "data id must match catalog dataset id");
  assert(metadata.product === "S-104", "metadata product must be S-104");
  assert(metadata.dataCodingFormat?.value === 2, "metadata must describe a regular grid");
  assert(metadata.interpolationType === "nearestneighbor", "fixture interpolation must be nearestneighbor");
  assert(Array.isArray(metadata.instanceAttributes), "metadata instanceAttributes must be an array");
  assert(metadata.instanceAttributes.length === 1, "fixture should contain one grid instance");

  const grid = metadata.instanceAttributes[0];
  const columns = grid.numPointsLongitudinal;
  const rows = grid.numPointsLatitudinal;
  assert(Number.isInteger(columns) && columns > 1, "grid columns must be an integer greater than 1");
  assert(Number.isInteger(rows) && rows > 1, "grid rows must be an integer greater than 1");
  assert(data.grid?.numPointsLongitudinal === columns, "data grid columns must match metadata");
  assert(data.grid?.numPointsLatitudinal === rows, "data grid rows must match metadata");
  assert(data.numberOfTimes === dataset.numberOfTimes, "data numberOfTimes must match catalog");
  assert(Array.isArray(data.values), "data values must be an array");
  assert(data.values.length === data.numberOfTimes, "time record count must match numberOfTimes");

  const expectedSampleCount = columns * rows;
  const heightFill = data.fillValues?.waterLevelHeight;
  assert(Number.isFinite(heightFill), "height fill value is required");

  for (const [recordIndex, record] of data.values.entries()) {
    assert(typeof record.timePoint === "string", `record ${recordIndex} timePoint is required`);
    assert(
      Array.isArray(record.waterLevelHeight) &&
        record.waterLevelHeight.length === expectedSampleCount,
      `record ${recordIndex} waterLevelHeight sample count must match grid`,
    );
    assert(
      Array.isArray(record.waterLevelTrend) &&
        record.waterLevelTrend.length === expectedSampleCount,
      `record ${recordIndex} waterLevelTrend sample count must match grid`,
    );
    assert(
      Array.isArray(record.uncertainty) && record.uncertainty.length === expectedSampleCount,
      `record ${recordIndex} uncertainty sample count must match grid`,
    );
  }

  const firstHeights = data.values[0].waterLevelHeight;
  const lastHeights = data.values[data.values.length - 1].waterLevelHeight;
  const centerIndex = Math.floor(rows / 2) * columns + Math.floor(columns / 2);
  const cornerIndex = 0;
  assert(firstHeights.some((value) => value === heightFill), "fixture should include fill/no-data samples");
  assert(firstHeights.some((value) => value !== heightFill), "fixture should include valid samples");
  assert(
    firstHeights[centerIndex] !== firstHeights[cornerIndex],
    "fixture should vary spatially within a time record",
  );
  assert(
    firstHeights[centerIndex] !== lastHeights[centerIndex],
    "fixture should vary over time at the same point",
  );

  console.log(`Validated S-104 fixture service at ${outputRoot}`);
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
