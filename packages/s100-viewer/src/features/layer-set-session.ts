import type { S100Layer } from "../layers/types.js";

export type LayerHandle<TLayer extends S100Layer = S100Layer> = {
  id: string;
  layer: TLayer;
};

export class LayerSetSession<TLayer extends S100Layer = S100Layer> {
  private handles: LayerHandle<TLayer>[] = [];

  get items(): readonly LayerHandle<TLayer>[] {
    return this.handles.map((handle) => ({ ...handle }));
  }

  get layers(): readonly TLayer[] {
    return this.handles.map((handle) => handle.layer);
  }

  get length(): number {
    return this.handles.length;
  }

  set(handles: readonly LayerHandle<TLayer>[]): void {
    this.handles = handles.map((handle) => ({ ...handle }));
  }

  clearWithoutRemoving(): void {
    this.handles = [];
  }

  ids(): string[] {
    return this.handles.map((handle) => handle.id);
  }

  hasSameIds(ids: readonly string[]): boolean {
    return sameStringSet(this.ids(), ids);
  }

  async removeAll(): Promise<void> {
    const handles = this.handles;
    this.handles = [];
    await Promise.allSettled(handles.map((handle) => handle.layer.remove()));
  }

  async replace(handles: readonly LayerHandle<TLayer>[]): Promise<void> {
    const previousHandles = this.handles;
    this.set(handles);
    await Promise.allSettled(previousHandles.map((handle) => handle.layer.remove()));
  }

  async setVisibilityById(visibleIds: readonly string[]): Promise<void> {
    const visibleIdSet = new Set(visibleIds);
    await Promise.all(
      this.handles.map((handle) =>
        handle.layer.update({ visible: visibleIdSet.has(handle.id) }),
      ),
    );
  }
}

export function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}
