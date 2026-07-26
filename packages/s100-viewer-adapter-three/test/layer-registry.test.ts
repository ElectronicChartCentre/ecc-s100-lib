import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { LayerRegistry } from "../src/layers/LayerRegistry.js";
import type { ThreeLayerNative } from "../src/layers/types.js";

describe("@ecc/s100-viewer-adapter-three layer registry", () => {
  it("refreshes water-level-field layers when scene time changes", () => {
    const registry = new LayerRegistry(
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      {} as THREE.WebGLRenderer,
      {
        crs: "EPSG:32631",
        origin: { x: 0, y: 0, z: 0 },
      },
      undefined,
      () => 0,
      () => 0,
      () => undefined,
      () => undefined,
    );
    const native: ThreeLayerNative = {
      spec: {
        id: "s102",
        product: "S-102",
        source: {
          kind: "3d-tiles",
          url: "https://example.test/tileset.json",
        },
      },
      root: null,
      update: vi.fn(),
      setWaterLevelField: vi.fn(),
      dispose: vi.fn(),
    };
    const handle = {
      id: "s102",
      native,
      dispose: vi.fn(),
    };

    (registry as unknown as { layers: Map<unknown, ThreeLayerNative> })
      .layers
      .set(handle, native);
    registry.setWaterLevelField({
      sampler: null,
      source: "static",
      seaLevelMeters: 0,
    });

    const nextTime = new Date("2026-07-26T00:10:00Z");
    registry.update(nextTime);

    expect(native.update).toHaveBeenCalledWith(nextTime);
    expect(native.setWaterLevelField).toHaveBeenLastCalledWith(
      {
        sampler: null,
        source: "static",
        seaLevelMeters: 0,
      },
      nextTime,
    );
  });
});
