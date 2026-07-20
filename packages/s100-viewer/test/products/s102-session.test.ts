import { describe, expect, it, vi } from "vitest";
import { S102TerrainSession, type S102TerrainSource } from "../../src/index.js";
import type { S100Layer } from "../../src/layers/types.js";
import type { S100Scene } from "../../src/scene/types.js";
import type { S102BathymetryLayerSpec } from "../../src/products/iho-s100.js";

describe("S102TerrainSession", () => {
  it("adds one terrain layer for normalized dataset ids", async () => {
    const layer = createTerrainLayer("s102-a,s102-b");
    const scene = createScene([layer]);
    const source = createSource();
    const session = S102TerrainSession.create({
      scene,
      crs: "EPSG:32633",
      source,
      detailFactor: 500,
      style: {
        safetyDepthMeters: 12,
      },
    });

    await session.setDatasetIds(["s102-b", "s102-a", "s102-a"]);

    expect(source.urlForDatasetIds).toHaveBeenCalledWith(["s102-a", "s102-b"], {
      crs: "EPSG:32633",
    });
    expect(scene.layers.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "s102-a,s102-b",
        product: "S-102",
        source: expect.objectContaining({
          url: "https://tiles.example/s102-a,s102-b",
          crs: "EPSG:32633",
        }),
        rendering: {
          detailFactor: 500,
        },
      }),
    );
    expect(session.currentDatasetIds).toEqual(["s102-a", "s102-b"]);
  });

  it("does not replace the current layer when dataset ids are unchanged", async () => {
    const layer = createTerrainLayer("s102-a");
    const scene = createScene([layer]);
    const session = S102TerrainSession.create({
      scene,
      crs: "EPSG:32633",
      source: createSource(),
    });

    await session.setDatasetIds(["s102-a"]);
    await session.setDatasetIds(["s102-a"]);

    expect(scene.layers.add).toHaveBeenCalledTimes(1);
  });

  it("removes the previous layer when datasets change", async () => {
    const oldLayer = createTerrainLayer("s102-a");
    const newLayer = createTerrainLayer("s102-b");
    const session = S102TerrainSession.create({
      scene: createScene([oldLayer, newLayer]),
      crs: "EPSG:32633",
      source: createSource(),
      replacement: {
        oldLayerRemovalDelayMs: 0,
      },
    });

    await session.setDatasetIds(["s102-a"]);
    await session.setDatasetIds(["s102-b"]);

    expect(oldLayer.remove).toHaveBeenCalledTimes(1);
    expect(newLayer.remove).not.toHaveBeenCalled();
  });

  it("forwards display, debug, and visibility updates to the active layer", async () => {
    const layer = createTerrainLayer("s102-a");
    const session = S102TerrainSession.create({
      scene: createScene([layer]),
      crs: "EPSG:32633",
      source: createSource(),
    });

    await session.setDatasetIds(["s102-a"]);
    await session.setVisible(false);
    await session.updateDisplayStyle({
      contours: {
        visible: true,
        intervalMeters: 5,
      },
    });
    await session.setTileBoundsVisible(true);

    expect(layer.update).toHaveBeenCalledWith({ visible: false });
    expect(layer.controllers.terrain.updateDisplayStyle).toHaveBeenCalledWith({
      contours: {
        visible: true,
        intervalMeters: 5,
      },
    });
    expect(layer.controllers.terrain.setTileBoundsVisible).toHaveBeenCalledWith(true);
  });

  it("removes the active layer on dispose", async () => {
    const layer = createTerrainLayer("s102-a");
    const session = S102TerrainSession.create({
      scene: createScene([layer]),
      crs: "EPSG:32633",
      source: createSource(),
    });

    await session.setDatasetIds(["s102-a"]);
    await session.dispose();

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });
});

type TerrainLayer = S100Layer<S102BathymetryLayerSpec>;

function createSource(): S102TerrainSource {
  return {
    urlForDatasetIds: vi.fn((datasetIds: readonly string[]) =>
      `https://tiles.example/${datasetIds.join(",")}`,
    ),
  };
}

function createScene(layers: TerrainLayer[]): S100Scene {
  const queue = [...layers];
  return {
    layers: {
      add: vi.fn().mockImplementation(() => Promise.resolve(queue.shift())),
    },
  } as unknown as S100Scene;
}

function createTerrainLayer(id: string): TerrainLayer {
  return {
    id,
    product: "S-102",
    spec: { id, product: "S-102" },
    controllers: {
      terrain: {
        kind: "s102-terrain",
        detailFactor: 1,
        displayStyle: {},
        settings: {},
        debug: {},
        updateDisplayStyle: vi.fn().mockResolvedValue(undefined),
        setDetailFactor: vi.fn().mockResolvedValue(undefined),
        setTileBoundsVisible: vi.fn().mockResolvedValue(undefined),
        updateDebugOptions: vi.fn().mockResolvedValue(undefined),
      },
    },
    nativeHandle: null,
    visible: true,
    opacity: 1,
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getNativeHandle: vi.fn().mockReturnValue(null),
    onChanged: vi.fn().mockReturnValue(() => {}),
  } as unknown as TerrainLayer;
}
