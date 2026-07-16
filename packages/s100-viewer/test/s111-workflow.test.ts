import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryAdapter,
  createPrimarS111Service,
  createS100Viewer,
  S100DataCodingFormat,
  S111ServiceRequestError,
  S111Workflow,
  type S111DataService,
} from "../src/index.js";

describe("S111Workflow", () => {
  it("prepares service-backed datasets with derived scale and timeline", async () => {
    const service = fakeS111Service({
      a: s111Dataset("20260529T120000Z"),
      b: s111Dataset("20260529T123000Z"),
    });

    const result = await S111Workflow.prepare({
      datasets: [
        {
          id: "a",
          bounds: { projected: { west: 0, east: 1000, south: 0, north: 1000 } },
        },
        {
          id: "b",
          bounds: { projected: { west: 0, east: 2000, south: 0, north: 1000 } },
        },
      ],
      crs: "EPSG:32633",
      service,
      limits: { maxDataPoints: 1000 },
      style: { scale: "auto", scaleMultiplier: 2 },
    });

    expect(result.statuses).toEqual([
      { datasetId: "a", status: "success" },
      { datasetId: "b", status: "success" },
    ]);
    const expectedScale = Math.sqrt((2000 * 1000) / 100) * 2;
    expect(result.initialScale).toBeCloseTo(expectedScale);
    expect(result.prepared).toHaveLength(2);
    expect(result.prepared[0]?.layer.style?.scale).toBeCloseTo(expectedScale);
    expect(result.timeline).toMatchObject({
      startTime: Date.UTC(2026, 4, 29, 12, 0, 0),
      endTime: Date.UTC(2026, 4, 29, 13, 30, 0),
      stepSeconds: 1800,
      initialTime: Date.UTC(2026, 4, 29, 12, 0, 0),
    });
  });

  it("rejects unsupported, too-large, and malformed metadata before data fetch", async () => {
    const fetchData = vi.fn();
    const service: S111DataService = {
      fetchMetadata: async (datasetId) => {
        if (datasetId === "unsupported") {
          return {
            dataCodingFormat: 999,
            instanceAttributes: [{ numberOfTimes: 1 }],
          };
        }
        if (datasetId === "too-large") {
          return s111Metadata({ numberOfTimes: 20, numPointsLongitudinal: 20, numPointsLatitudinal: 20 });
        }
        return {
          dataCodingFormat: S100DataCodingFormat.RegularGrid,
          instanceAttributes: [{}],
        };
      },
      fetchData,
    };

    const result = await S111Workflow.prepare({
      datasets: [
        { id: "unsupported" },
        { id: "too-large" },
        { id: "malformed" },
      ],
      crs: "EPSG:32633",
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

  it("propagates AbortSignal and reports structured cancellation", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const service: S111DataService = {
      fetchMetadata: vi.fn(),
      fetchData: vi.fn(),
    };

    const result = await S111Workflow.prepare({
      datasets: [{ id: "a" }, { id: "b" }],
      crs: "EPSG:32633",
      service,
      signal: abortController.signal,
    });

    expect(service.fetchMetadata).not.toHaveBeenCalled();
    expect(service.fetchData).not.toHaveBeenCalled();
    expect(result.statuses).toEqual([
      { datasetId: "a", status: "error", code: "canceled", message: "S-111 workflow was canceled." },
      { datasetId: "b", status: "error", code: "canceled", message: "S-111 workflow was canceled." },
    ]);
  });

  it("bounds data fetch concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const service: S111DataService = {
      fetchMetadata: async () => s111Metadata(),
      fetchData: async (datasetId) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(10);
        active -= 1;
        return s111Dataset("20260529T120000Z", datasetId);
      },
      unwrapData: (response) => response,
    };

    const result = await S111Workflow.prepare({
      datasets: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      crs: "EPSG:32633",
      service,
      limits: { dataFetchConcurrency: 2 },
    });

    expect(result.prepared).toHaveLength(4);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("adds prepared layers and configures scene time playback", async () => {
    const viewer = await createS100Viewer({ adapter: createInMemoryAdapter() });
    const scene = await viewer.createScene();
    const result = await S111Workflow.prepare({
      datasets: [{ id: "a" }],
      crs: "EPSG:32633",
      service: fakeS111Service({ a: s111Dataset("20260529T120000Z") }),
      style: { scale: 5 },
    });

    const layers = await S111Workflow.addPreparedLayers(scene, result.prepared);
    S111Workflow.configureSceneTime(scene, result.timeline, {
      play: true,
      loop: true,
      rate: 10,
    });

    expect(layers).toHaveLength(1);
    expect(layers[0]?.controllers.surfaceCurrent.customScale).toBe(5);
    expect(scene.time.getAvailability()).toEqual({
      start: new Date(Date.UTC(2026, 4, 29, 12, 0, 0)),
      end: new Date(Date.UTC(2026, 4, 29, 13, 0, 0)),
    });
    expect(scene.time.getPlaybackState()).toMatchObject({
      playing: true,
      loop: true,
      rate: 10,
      stepMs: 1800000,
    });

    await viewer.destroy();
  });
});

describe("createPrimarS111Service", () => {
  it("supports Vite dev proxy endpoints for PRIMAR requests", async () => {
    const requestedUrls: string[] = [];
    const fetchHandler = vi.fn(async (url: string | URL | Request) => {
      requestedUrls.push(String(url));
      return responseJson(s111Metadata());
    });
    const service = createPrimarS111Service({
      endpoint: "s111/",
      licenseeKey: "secret-license",
      fetchHandler: fetchHandler as typeof fetch,
    });

    await service.fetchMetadata("dataset with spaces", { crs: "EPSG:32633" });
    await service.fetchData("dataset with spaces", { crs: "EPSG:32633" });

    expect(requestedUrls[0]).toBe(
      "/s111/dataset%20with%20spaces/metadata.json?licenseeKey=secret-license",
    );
    expect(requestedUrls[1]).toBe(
      "/s111/dataset%20with%20spaces/data.json?licenseeKey=secret-license&crs=EPSG%3A32633",
    );
  });

  it("builds PRIMAR URLs, unwraps data instances, and rejects no-instance metadata", async () => {
    const fetchHandler = vi.fn(async (url: string | URL) => {
      const urlText = String(url);
      if (urlText.includes("empty/metadata.json")) {
        return responseJson({ numberOfInstances: 0 });
      }
      if (urlText.includes("data.json")) {
        return responseJson({ instances: [s111Dataset("20260529T120000Z")] });
      }
      return responseJson(s111Metadata());
    });
    const service = createPrimarS111Service({
      endpoint: "https://example.test/s111/",
      licenseeKey: "secret-license",
      fetchHandler: fetchHandler as typeof fetch,
    });

    await expect(service.fetchMetadata("empty", { crs: "EPSG:32633" }))
      .rejects.toMatchObject({
        datasetId: "empty",
        requestKind: "metadata",
        url: expect.not.stringContaining("secret-license"),
      });

    const data = await service.fetchData("dataset with spaces", { crs: "EPSG:32633" });
    expect(service.unwrapData?.(data, "dataset with spaces")).toMatchObject({
      dateTimeOfFirstRecord: "20260529T120000Z",
    });
    expect(String(fetchHandler.mock.calls.at(-1)?.[0])).toContain("dataset%20with%20spaces/data.json");
    expect(String(fetchHandler.mock.calls.at(-1)?.[0])).toContain("crs=EPSG%3A32633");
  });

  it("sanitizes failed PRIMAR request details", async () => {
    const service = createPrimarS111Service({
      endpoint: "https://example.test/s111",
      licenseeKey: "secret-license",
      fetchHandler: (async () => responseJson({ error: true }, false, 403, "Forbidden")) as typeof fetch,
    });

    await expect(service.fetchData("blocked", { crs: "EPSG:32633" }))
      .rejects.toBeInstanceOf(S111ServiceRequestError);
    await expect(service.fetchData("blocked", { crs: "EPSG:32633" }))
      .rejects.toMatchObject({
        datasetId: "blocked",
        requestKind: "data",
        status: 403,
        url: expect.not.stringContaining("secret-license"),
      });
  });
});

const fakeS111Service = (
  datasets: Record<string, unknown>,
): S111DataService => ({
  fetchMetadata: async () => s111Metadata(),
  fetchData: async (datasetId) => ({ instances: [datasets[datasetId] ?? s111Dataset("20260529T120000Z")] }),
});

const s111Metadata = (
  attributes: {
    numberOfTimes?: number;
    numPointsLongitudinal?: number;
    numPointsLatitudinal?: number;
    numberOfNodes?: number;
  } = {},
) => ({
  numberOfInstances: 1,
  dataCodingFormat: { value: S100DataCodingFormat.RegularGrid },
  instanceAttributes: [
    {
      numberOfTimes: 2,
      numPointsLongitudinal: 10,
      numPointsLatitudinal: 10,
      ...attributes,
    },
  ],
});

const s111Dataset = (
  startTime: string,
  id = "s111",
) => ({
  id,
  dateTimeOfFirstRecord: startTime,
  timeRecordInterval: 1800,
  numberOfTimes: 3,
  data: [{ speed: 1, direction: 90 }],
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

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
