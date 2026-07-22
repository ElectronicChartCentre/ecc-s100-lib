import { describe, expect, it } from "vitest";
import {
  createInMemoryAdapter,
  createS100Viewer,
  LayerBuilder,
  type EngineLayerHandle,
  type EngineLayerPatchListener,
} from "../../src/index.js";
import { projectedExtent, withInMemoryScene } from "./helpers.js";

describe("adapter contract: layer lifecycle", () => {
  it("adds, patches, hides, shows, and removes a canonical layer", async () => {
    await withInMemoryScene(async (scene) => {
      const events: string[] = [];
      const updatedOpacities: number[] = [];

      scene.events.on("layer.added", (layer) => events.push(`added:${layer.id}`));
      scene.events.on("layer.updated", (layer) => {
        events.push(`updated:${layer.id}`);
        updatedOpacities.push(layer.opacity);
      });
      scene.events.on("layer.removed", (layer) => events.push(`removed:${layer.id}`));

      const layer = await scene.layers.add(
        LayerBuilder.createS101WmsTemplate({
          id: "contract-enc",
          urlTemplate: "https://example.test/s101/{z}/{x}/{y}.png",
          extents: projectedExtent(),
          visible: true,
          opacity: 0.75,
        }),
      );

      await layer.update({ opacity: 0.5, visible: false });
      await layer.update({ visible: true });
      const removed = await scene.layers.remove(layer);

      expect(removed).toBe(true);
      expect(layer.opacity).toBe(0.5);
      expect(layer.visible).toBe(true);
      expect(scene.layers.size).toBe(0);
      expect(updatedOpacities).toEqual([0.5, 0.5]);
      expect(events).toEqual([
        "added:contract-enc",
        "updated:contract-enc",
        "updated:contract-enc",
        "removed:contract-enc",
      ]);
    });
  });

  it("applies adapter-originated layer patches through normal layer events", async () => {
    let emitAdapterPatch: EngineLayerPatchListener | null = null;
    const viewer = await createS100Viewer({
      adapter: createInMemoryAdapter({
        onLayerPatchListener: (listener) => {
          emitAdapterPatch = listener;
        },
      }),
    });

    try {
      const scene = await viewer.createScene({ id: "adapter-patch-contract-scene" });
      const layerEvents: string[] = [];
      const changedEvents: string[] = [];

      scene.events.on("layer.updated", (layer) => {
        layerEvents.push(`${layer.id}:${layer.opacity}:${String(layer.visible)}`);
      });

      const layer = await scene.layers.add(
        LayerBuilder.createS101WmsTemplate({
          id: "adapter-updated-enc",
          urlTemplate: "https://example.test/s101/{z}/{x}/{y}.png",
          extents: projectedExtent(),
          opacity: 1,
        }),
      );

      layer.onChanged((updatedLayer) => {
        changedEvents.push(
          `${updatedLayer.id}:${updatedLayer.opacity}:${String(updatedLayer.visible)}`,
        );
      });

      const handle = (layer as unknown as { engineLayerHandle: EngineLayerHandle })
        .engineLayerHandle;
      expect(typeof emitAdapterPatch).toBe("function");
      const adapterPatchListener = emitAdapterPatch as unknown as EngineLayerPatchListener;
      adapterPatchListener({
        handle,
        patch: {
          opacity: 0.35,
          visible: false,
        },
        source: "test-adapter",
      });

      expect(layer.opacity).toBe(0.35);
      expect(layer.visible).toBe(false);
      expect(layer.spec.opacity).toBe(0.35);
      expect(layer.spec.visible).toBe(false);
      expect(changedEvents).toEqual(["adapter-updated-enc:0.35:false"]);
      expect(layerEvents).toEqual(["adapter-updated-enc:0.35:false"]);
    } finally {
      await viewer.destroy();
    }
  });
});
