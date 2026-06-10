import type { EngineLayerHandle } from "../adapters/types.js";
import { EventBus } from "../events/S100EventBus.js";
import type { S100Unsubscribe } from "../events/S100EventBus.js";
import type { BaseLayerSpec, LayerPatch, S100Layer } from "./types.js";

type UpdateLayer<TSpec extends BaseLayerSpec> = (
  layer: CoreS100Layer<TSpec>,
  patch: LayerPatch<TSpec>,
) => Promise<void>;

type RemoveLayer<TSpec extends BaseLayerSpec> = (layer: CoreS100Layer<TSpec>) => Promise<void>;

type LayerEvents<TSpec extends BaseLayerSpec> = {
  changed: S100Layer<TSpec>;
};

export class CoreS100Layer<TSpec extends BaseLayerSpec> implements S100Layer<TSpec> {
  private currentSpec: TSpec;
  private readonly events = new EventBus<LayerEvents<TSpec>>();

  constructor(
    spec: TSpec,
    private readonly engineHandle: EngineLayerHandle,
    private readonly updateLayer: UpdateLayer<TSpec>,
    private readonly removeLayer: RemoveLayer<TSpec>,
  ) {
    this.id = spec.id;
    this.currentSpec = { ...spec };
    this.visible = spec.visible ?? true;
    this.opacity = spec.opacity ?? 1;
  }

  readonly id: string;
  visible: boolean;
  opacity: number;

  get product(): TSpec["product"] {
    return this.currentSpec.product;
  }

  get spec(): TSpec {
    return { ...this.currentSpec };
  }

  get nativeHandle(): unknown {
    return this.engineHandle.native ?? this.engineHandle;
  }

  get engineLayerHandle(): EngineLayerHandle {
    return this.engineHandle;
  }

  async update(patch: LayerPatch<TSpec>): Promise<void> {
    await this.updateLayer(this, patch);
  }

  applyEnginePatch(patch: LayerPatch<TSpec>): void {
    this.currentSpec = {
      ...this.currentSpec,
      ...patch,
    };
    this.visible = patch.visible ?? this.visible;
    this.opacity = patch.opacity ?? this.opacity;
    this.events.emit("changed", this);
  }

  async remove(): Promise<void> {
    await this.removeLayer(this);
  }

  getNativeHandle<TNative = unknown>(): TNative | null {
    return (this.engineHandle.native ?? this.engineHandle ?? null) as TNative | null;
  }

  onChanged(listener: (layer: S100Layer<TSpec>) => void): S100Unsubscribe {
    return this.events.on("changed", listener);
  }
}
