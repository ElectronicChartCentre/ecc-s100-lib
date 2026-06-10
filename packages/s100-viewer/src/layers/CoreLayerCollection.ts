import type { EngineScene } from "../adapters/types.js";
import { S100Error } from "../errors/S100Error.js";
import type { S100EventBus } from "../events/S100EventBus.js";
import type { S100SceneEvents } from "../scene/types.js";
import { validateLayerSpec } from "../validation.js";
import { CoreS100Layer } from "./CoreS100Layer.js";
import type { BaseLayerSpec, LayerCollection, S100Layer } from "./types.js";

export class CoreLayerCollection implements LayerCollection {
  private readonly layers = new Map<string, CoreS100Layer<BaseLayerSpec>>();
  private readonly layersByHandle = new Map<object, CoreS100Layer<BaseLayerSpec>>();

  constructor(
    private readonly engineScene: EngineScene,
    private readonly events: S100EventBus<S100SceneEvents>,
  ) {
    this.engineScene.setLayerPatchListener?.((event) => {
      const layer = this.layersByHandle.get(event.handle);
      if (!layer) {
        return;
      }
      layer.applyEnginePatch(event.patch);
      this.events.emit("layer.updated", layer);
    });
  }

  get size(): number {
    return this.layers.size;
  }

  async add<TSpec extends BaseLayerSpec>(spec: TSpec): Promise<S100Layer<TSpec>> {
    validateLayerSpec(spec);

    if (this.layers.has(spec.id)) {
      throw new S100Error("layer-duplicate", `Layer '${spec.id}' already exists.`, spec);
    }

    const handle = await this.engineScene.addLayer(spec);
    const layer = new CoreS100Layer<TSpec>(
      spec,
      handle,
      async (updatedLayer, patch) => {
        await this.engineScene.updateLayer(updatedLayer.engineLayerHandle, patch);
        updatedLayer.applyEnginePatch(patch);
        this.events.emit("layer.updated", updatedLayer);
      },
      async (removedLayer) => {
        await this.remove(removedLayer.id);
      },
    );

    this.layers.set(spec.id, layer as unknown as CoreS100Layer<BaseLayerSpec>);
    this.layersByHandle.set(handle, layer as unknown as CoreS100Layer<BaseLayerSpec>);
    this.events.emit("layer.added", layer);

    return layer;
  }

  get<TSpec extends BaseLayerSpec = BaseLayerSpec>(id: string): S100Layer<TSpec> | undefined {
    return this.layers.get(id) as S100Layer<TSpec> | undefined;
  }

  has(id: string): boolean {
    return this.layers.has(id);
  }

  async remove(idOrLayer: string | S100Layer): Promise<boolean> {
    const id = typeof idOrLayer === "string" ? idOrLayer : idOrLayer.id;
    const layer = this.layers.get(id);

    if (!layer) {
      return false;
    }

    await this.engineScene.removeLayer(layer.engineLayerHandle);
    this.layers.delete(id);
    this.layersByHandle.delete(layer.engineLayerHandle);
    this.events.emit("layer.removed", { id });

    return true;
  }

  async clear(): Promise<void> {
    for (const layer of [...this.layers.values()]) {
      await this.remove(layer.id);
    }
  }

  all(): readonly S100Layer[] {
    return [...this.layers.values()];
  }

  [Symbol.iterator](): IterableIterator<S100Layer> {
    return this.layers.values();
  }
}
