import { describe, expect, it, vi } from "vitest";
import {
  assessS104Metadata,
  createFixtureS104Service,
  S100DataCodingFormat,
  S104ServiceRequestError,
  S104Workflow,
  type S104DataService,
} from "../src/index.js";

describe("S104Workflow", () => {
  it("prepares service-backed S-104 datasets without creating viewer layers", async () => {
    const service = fakeS104Service({
      stavanger: s104Dataset("stavanger"),
    });

    const result = await S104Workflow.prepare({
      datasets: [
        {
          id: "stavanger",
          title: "Stavanger water level",
          bounds: {
            projected: {
              minX: 0,
              minY: 0,
              maxX: 1000,
              maxY: 1000,
            },
          },
        },
      ],
      crs: "EPSG:32631",
      service,
      limits: { maxDataPoints: 100 },
    });

    expect(service.fetchData).toHaveBeenCalledWith("stavanger", expect.objectContaining({
      crs: "EPSG:32631",
    }));
    expect(result.statuses).toEqual([
      { datasetId: "stavanger", status: "success" },
    ]);
    expect(result.prepared).toHaveLength(1);
    expect(result.prepared[0]).toMatchObject({
      datasetId: "stavanger",
      title: "Stavanger water level",
      crs: "EPSG:32631",
      numberOfCells: 4,
      numberOfDataPoints: 8,
      verticalDatum: "MSL",
      data: {
        id: "stavanger",
      },
      decoded: {
        datasetId: "stavanger",
        crs: "EPSG:32631",
        numberOfCells: 4,
        numberOfDataPoints: 8,
      },
      bounds: {
        projected: {
          minX: 0,
          minY: 0,
          maxX: 1000,
          maxY: 1000,
        },
      },
    });
  });

  it("rejects unsupported, too-large, and malformed metadata before data fetch", async () => {
    const fetchData = vi.fn();
    const service: S104DataService = {
      fetchMetadata: async (datasetId) => {
        if (datasetId === "unsupported") {
          return {
            dataCodingFormat: S100DataCodingFormat.UngeorectifiedGrid,
            instanceAttributes: [{ numberOfTimes: 1 }],
          };
        }
        if (datasetId === "too-large") {
          return s104Metadata({ numberOfTimes: 10, numPointsLongitudinal: 20, numPointsLatitudinal: 20 });
        }
        return {
          dataCodingFormat: S100DataCodingFormat.RegularGrid,
          instanceAttributes: [{}],
        };
      },
      fetchData,
    };

    const result = await S104Workflow.prepare({
      datasets: [
        { id: "unsupported" },
        { id: "too-large" },
        { id: "malformed" },
      ],
      crs: "EPSG:32631",
      service,
      limits: { maxDataPoints: 1000 },
      messages: {
        unsupportedDcf: "unsupported",
        tooLarge: (limit) => `too-large:${limit}`,
        metadataError: "metadata",
      },
    });

    expect(fetchData).not.toHaveBeenCalled();
    expect(result.statuses).toMatchObject([
      { datasetId: "unsupported", status: "error", code: "unsupported-dcf", message: "unsupported" },
      { datasetId: "too-large", status: "error", code: "too-large", message: "too-large:1000" },
      { datasetId: "malformed", status: "error", code: "metadata-error", message: "metadata" },
    ]);
    expect(result.prepared).toHaveLength(0);
  });

  it("reports malformed data as a dataset error without preparing raw payloads", async () => {
    const service = fakeS104Service({
      malformed: {
        ...s104Dataset("malformed"),
        values: [
          { timePoint: "20260726T000000Z", waterLevelHeight: [0.1] },
          { timePoint: "20260726T001000Z", waterLevelHeight: [0.2, 0.3, 0.4, 0.5] },
        ],
      },
    });

    const result = await S104Workflow.prepare({
      datasets: [{ id: "malformed" }],
      crs: "EPSG:32631",
      service,
      messages: {
        datasetError: "data failed",
      },
    });

    expect(result.prepared).toHaveLength(0);
    expect(result.statuses).toMatchObject([
      {
        datasetId: "malformed",
        status: "error",
        code: "dataset-error",
        message: "data failed",
        details: {
          decodeCode: "data-error",
          timeIndex: 0,
          expected: 4,
        },
      },
    ]);
  });

  it("propagates AbortSignal and reports structured cancellation", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const service: S104DataService = {
      fetchMetadata: vi.fn(),
      fetchData: vi.fn(),
    };

    const result = await S104Workflow.prepare({
      datasets: [{ id: "a" }, { id: "b" }],
      crs: "EPSG:32631",
      service,
      signal: abortController.signal,
    });

    expect(service.fetchMetadata).not.toHaveBeenCalled();
    expect(service.fetchData).not.toHaveBeenCalled();
    expect(result.statuses).toEqual([
      { datasetId: "a", status: "error", code: "canceled", message: "S-104 workflow was canceled." },
      { datasetId: "b", status: "error", code: "canceled", message: "S-104 workflow was canceled." },
    ]);
  });
});

describe("assessS104Metadata", () => {
  it("accepts regular-grid metadata and reports app-ready counts", () => {
    expect(
      assessS104Metadata({
        datasetId: "fixture",
        metadata: s104Metadata(),
      }),
    ).toMatchObject({
      status: "accepted",
      datasetId: "fixture",
      dataCodingFormat: S100DataCodingFormat.RegularGrid,
      numberOfCells: 4,
      numberOfDataPoints: 8,
      verticalDatum: "MSL",
    });
  });
});

describe("createFixtureS104Service", () => {
  it("builds fixture-service URLs with CRS query parameters", async () => {
    const requestedUrls: string[] = [];
    const fetchHandler = vi.fn(async (url: string | URL | Request) => {
      requestedUrls.push(String(url));
      return responseJson(s104Metadata());
    });
    const service = createFixtureS104Service({
      endpoint: "s104-fixtures/",
      fetchHandler: fetchHandler as typeof fetch,
    });

    await service.fetchCatalog?.({});
    await service.fetchMetadata("dataset with spaces", { crs: "EPSG:32631" });
    await service.fetchData("dataset with spaces", { crs: "EPSG:32631" });

    expect(requestedUrls).toEqual([
      "/s104-fixtures/s104/catalog.json",
      "/s104-fixtures/s104/dataset%20with%20spaces/metadata.json?crs=EPSG%3A32631",
      "/s104-fixtures/s104/dataset%20with%20spaces/data.json?crs=EPSG%3A32631",
    ]);
  });

  it("reports structured request failures", async () => {
    const service = createFixtureS104Service({
      endpoint: "https://example.test/fixtures",
      fetchHandler: (async () => responseJson({ error: true }, false, 400, "Bad Request")) as typeof fetch,
    });

    await expect(service.fetchData("blocked", { crs: "EPSG:4326" }))
      .rejects.toBeInstanceOf(S104ServiceRequestError);
    await expect(service.fetchData("blocked", { crs: "EPSG:4326" }))
      .rejects.toMatchObject({
        datasetId: "blocked",
        requestKind: "data",
        status: 400,
        url: "https://example.test/fixtures/s104/blocked/data.json?crs=EPSG%3A4326",
      });
  });
});

const fakeS104Service = (
  datasets: Record<string, unknown>,
): S104DataService => ({
  fetchMetadata: vi.fn(async () => s104Metadata()),
  fetchData: vi.fn(async (datasetId) => datasets[datasetId] ?? s104Dataset(datasetId)),
});

const s104Metadata = (
  attributes: {
    numberOfTimes?: number;
    numPointsLongitudinal?: number;
    numPointsLatitudinal?: number;
  } = {},
) => ({
  product: "S-104",
  productSpecificationVersion: "generated-fixture",
  numberOfInstances: 1,
  dataCodingFormat: { value: S100DataCodingFormat.RegularGrid },
  instanceAttributes: [
    {
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
      verticalDatum: "MSL",
      ...attributes,
    },
  ],
});

const s104Dataset = (id: string) => ({
  id,
  product: "S-104",
  dateTimeOfFirstRecord: "20260726T000000Z",
  timeRecordInterval: 600,
  numberOfTimes: 2,
  values: [
    { timePoint: "20260726T000000Z", waterLevelHeight: [0.1, 0.2, 0.3, 0.4] },
    { timePoint: "20260726T001000Z", waterLevelHeight: [0.2, 0.3, 0.4, 0.5] },
  ],
});

const responseJson = (
  value: unknown,
  ok = true,
  status = 200,
  statusText = "OK",
) => ({
  ok,
  status,
  statusText,
  json: async () => value,
}) as Response;
