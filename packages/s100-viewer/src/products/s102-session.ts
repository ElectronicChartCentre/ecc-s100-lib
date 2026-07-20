import type { S100Layer } from "../layers/types.js";
import type { TerrainDebugPatch, TerrainDisplayPatch } from "../layers/controllers.js";
import type { S100Scene } from "../scene/types.js";
import { FeatureLifecycleScope } from "../features/index.js";
import { createS102, type CreateS102LayerOptions } from "./iho-builders.js";
import type { S102BathymetryLayerSpec } from "./iho-s100.js";

export type S102TerrainLayer = S100Layer<S102BathymetryLayerSpec>;

export type S102TerrainSource = {
  urlForDatasetIds(
    datasetIds: readonly string[],
    context: { crs: string },
  ): string;
  queryForDatasetIds?(
    datasetIds: readonly string[],
    context: { crs: string },
  ): Record<string, string | number | boolean>;
};

export type S102TerrainSessionOptions = {
  scene: S100Scene;
  crs: string;
  source: S102TerrainSource;
  idPrefix?: string;
  title?: string;
  visible?: boolean;
  opacity?: number;
  zOrder?: number;
  verticalDatum?: CreateS102LayerOptions["verticalDatum"];
  ellipsoid?: CreateS102LayerOptions["ellipsoid"];
  sourceFrame?: CreateS102LayerOptions["sourceFrame"];
  rendering?: CreateS102LayerOptions["rendering"];
  detailFactor?: CreateS102LayerOptions["detailFactor"];
  style?: CreateS102LayerOptions["style"];
  debug?: CreateS102LayerOptions["debug"];
  replacement?: {
    oldLayerRemovalDelayMs?: number;
  };
};

export class S102TerrainSession {
  private readonly lifecycle = new FeatureLifecycleScope();
  private current:
    | {
        id: string;
        layer: S102TerrainLayer;
      }
    | null = null;
  private readonly pendingRemovalTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly pendingRemovalLayers = new Set<S102TerrainLayer>();

  private constructor(private readonly options: S102TerrainSessionOptions) {
    this.lifecycle.onDispose(async () => {
      this.clearPendingRemovalTimers();
      const layers = [
        ...(this.current ? [this.current.layer] : []),
        ...this.pendingRemovalLayers,
      ];
      this.current = null;
      this.pendingRemovalLayers.clear();
      await Promise.allSettled(layers.map((layer) => layer.remove()));
    });
  }

  static create(options: S102TerrainSessionOptions): S102TerrainSession {
    return new S102TerrainSession(options);
  }

  get currentLayer(): S102TerrainLayer | null {
    return this.current?.layer ?? null;
  }

  get currentDatasetIds(): readonly string[] {
    return terrainLayerIds(this.current?.id);
  }

  async setDatasetIds(datasetIds: readonly string[]): Promise<S102TerrainLayer | null> {
    const normalizedDatasetIds = normalizeDatasetIds(datasetIds);
    const nextLayerId = normalizedDatasetIds.join(",");

    if (this.current?.id === nextLayerId) {
      return this.current.layer;
    }

    const token = this.lifecycle.begin();
    const previous = this.current;

    if (normalizedDatasetIds.length === 0) {
      this.current = null;
      if (previous) {
        await previous.layer.remove();
      }
      this.lifecycle.assertActive(token);
      return null;
    }

    const layer = await this.options.scene.layers.add(
      createS102({
        id: layerId(this.options, nextLayerId),
        ...(this.options.title !== undefined ? { title: this.options.title } : {}),
        ...(this.options.visible !== undefined ? { visible: this.options.visible } : {}),
        ...(this.options.opacity !== undefined ? { opacity: this.options.opacity } : {}),
        ...(this.options.zOrder !== undefined ? { zOrder: this.options.zOrder } : {}),
        url: this.options.source.urlForDatasetIds(normalizedDatasetIds, {
          crs: this.options.crs,
        }),
        crs: this.options.crs,
        query: this.options.source.queryForDatasetIds?.(normalizedDatasetIds, {
          crs: this.options.crs,
        }) ?? { crs: this.options.crs },
        ...(this.options.verticalDatum !== undefined ? { verticalDatum: this.options.verticalDatum } : {}),
        ...(this.options.ellipsoid !== undefined ? { ellipsoid: this.options.ellipsoid } : {}),
        ...(this.options.sourceFrame !== undefined ? { sourceFrame: this.options.sourceFrame } : {}),
        ...(this.options.rendering !== undefined ? { rendering: this.options.rendering } : {}),
        ...(this.options.detailFactor !== undefined ? { detailFactor: this.options.detailFactor } : {}),
        ...(this.options.style !== undefined ? { style: this.options.style } : {}),
        ...(this.options.debug !== undefined ? { debug: this.options.debug } : {}),
      }),
    );

    if (!this.lifecycle.isActive(token)) {
      await layer.remove();
      this.lifecycle.assertActive(token);
    }

    this.current = {
      id: nextLayerId,
      layer,
    };
    this.removePreviousLayer(previous?.layer);
    return layer;
  }

  async setVisible(visible: boolean): Promise<void> {
    await this.current?.layer.update({ visible });
  }

  async updateDisplayStyle(patch: TerrainDisplayPatch): Promise<void> {
    await this.current?.layer.controllers.terrain.updateDisplayStyle(patch);
  }

  async updateDebugOptions(patch: TerrainDebugPatch): Promise<void> {
    await this.current?.layer.controllers.terrain.updateDebugOptions(patch);
  }

  async setTileBoundsVisible(visible: boolean): Promise<void> {
    await this.current?.layer.controllers.terrain.setTileBoundsVisible(visible);
  }

  async dispose(): Promise<void> {
    await this.lifecycle.dispose();
  }

  private removePreviousLayer(layer: S102TerrainLayer | undefined): void {
    if (!layer) {
      return;
    }
    const delayMs = this.options.replacement?.oldLayerRemovalDelayMs ?? 0;
    if (delayMs <= 0) {
      void layer.remove();
      return;
    }

    this.pendingRemovalLayers.add(layer);
    const timer = setTimeout(() => {
      this.pendingRemovalTimers.delete(timer);
      this.pendingRemovalLayers.delete(layer);
      void layer.remove();
    }, delayMs);
    this.pendingRemovalTimers.add(timer);
  }

  private clearPendingRemovalTimers(): void {
    for (const timer of this.pendingRemovalTimers) {
      clearTimeout(timer);
    }
    this.pendingRemovalTimers.clear();
  }
}

function normalizeDatasetIds(datasetIds: readonly string[]): string[] {
  return [...new Set(datasetIds.filter(Boolean))].sort();
}

function terrainLayerIds(handleId: string | undefined): string[] {
  return handleId ? handleId.split(",").filter(Boolean) : [];
}

function layerId(options: S102TerrainSessionOptions, datasetKey: string): string {
  return options.idPrefix ? `${options.idPrefix}:${datasetKey}` : datasetKey;
}
