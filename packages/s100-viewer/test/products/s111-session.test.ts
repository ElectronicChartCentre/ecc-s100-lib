import { describe, expect, it, vi } from "vitest";
import {
  S100DataCodingFormat,
  S111SurfaceCurrentSession,
  type S111DataService,
} from "../../src/index.js";
import type { S100Layer } from "../../src/layers/types.js";
import type { S100Scene } from "../../src/scene/types.js";
import type { S111SurfaceCurrentLayerSpec } from "../../src/products/iho-s100.js";

describe("S111SurfaceCurrentSession", () => {
  it("prepares data, adds layers, and exposes workflow status and timeline", async () => {
    const layer = createS111Layer("s111-a");
    const scene = createScene([layer]);
    const service = createService();
    const onStatus = vi.fn();
    const onTimeline = vi.fn();

    const session = await S111SurfaceCurrentSession.load({
      scene,
      datasets: [createDataset("s111-a")],
      crs: "EPSG:32633",
      service,
      onStatus,
      onTimeline,
    });

    expect(service.fetchData).toHaveBeenCalledWith("s111-a", expect.objectContaining({
      crs: "EPSG:32633",
    }));
    expect(scene.layers.addMany).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "s111-a",
        product: "S-111",
      }),
    ]);
    expect(session.statuses).toEqual([
      expect.objectContaining({
        datasetId: "s111-a",
        status: "success",
      }),
    ]);
    expect(session.timeline?.times).toEqual([
      Date.UTC(2026, 0, 1, 0, 0, 0),
      Date.UTC(2026, 0, 1, 0, 10, 0),
    ]);
    expect(onStatus).toHaveBeenCalledWith(session.statuses);
    expect(onTimeline).toHaveBeenCalledWith(session.timeline);
  });

  it("controls visibility, current time, and scale across loaded layers", async () => {
    const layer = createS111Layer("s111-a");
    const session = await S111SurfaceCurrentSession.load({
      scene: createScene([layer]),
      datasets: [createDataset("s111-a")],
      crs: "EPSG:32633",
      service: createService(),
      projection: {
        projectBounds: () => ({
          north: 100,
          east: 100,
          south: 0,
          west: 0,
        }),
      },
    });

    await session.setVisibleDatasetIds([]);
    session.setCurrentTime(Date.UTC(2026, 0, 1, 0, 10, 0));
    await session.setScaleMultiplier(2);

    expect(layer.update).toHaveBeenCalledWith({ visible: false });
    expect(layer.controllers.surfaceCurrent.setCurrentTime).toHaveBeenCalledWith(
      Date.UTC(2026, 0, 1, 0, 10, 0),
    );
    expect(layer.controllers.surfaceCurrent.setCustomScale).toHaveBeenCalledWith(100);
  });

  it("removes loaded layers when disposed", async () => {
    const layer = createS111Layer("s111-a");
    const session = await S111SurfaceCurrentSession.load({
      scene: createScene([layer]),
      datasets: [createDataset("s111-a")],
      crs: "EPSG:32633",
      service: createService(),
    });

    await session.dispose();

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });
});

function createDataset(id: string) {
  return {
    id,
    metadata: {
      dataCodingFormat: S100DataCodingFormat.RegularGrid,
      instanceAttributes: [
        {
          numberOfTimes: 2,
          numPointsLongitudinal: 2,
          numPointsLatitudinal: 2,
        },
      ],
    },
    bounds: {
      latLon: {
        north: 1,
        east: 1,
        south: 0,
        west: 0,
      },
    },
  };
}

function createService(): S111DataService {
  return {
    fetchMetadata: vi.fn(),
    fetchData: vi.fn().mockResolvedValue({
      dateTimeOfFirstRecord: "2026-01-01T00:00:00Z",
      dateTimeOfLastRecord: "2026-01-01T00:10:00Z",
      timeRecordInterval: 600,
      numberOfTimes: 2,
      data: [{}, {}],
    }),
  };
}

function createScene(layers: S111Layer[]): S100Scene {
  return {
    layers: {
      addMany: vi.fn().mockResolvedValue(layers),
    },
  } as unknown as S100Scene;
}

type S111Layer = S100Layer<S111SurfaceCurrentLayerSpec>;

function createS111Layer(id: string): S111Layer {
  return {
    id,
    product: "S-111",
    spec: { id, product: "S-111" },
    controllers: {
      surfaceCurrent: {
        kind: "s111-surface-current",
        disableAutoScaling: false,
        scalingMode: "auto",
        customScale: 1,
        time: {
          startTime: 0,
          endTime: 0,
          currentTime: 0,
        },
        setCustomScale: vi.fn().mockResolvedValue(undefined),
        setAutoScaling: vi.fn().mockResolvedValue(undefined),
        setCurrentTime: vi.fn(),
      },
    },
    nativeHandle: null,
    visible: true,
    opacity: 1,
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getNativeHandle: vi.fn().mockReturnValue(null),
    onChanged: vi.fn().mockReturnValue(() => {}),
  } as unknown as S111Layer;
}
