import type { S100Layer } from "../layers/types.js";
import type { S100Scene } from "../scene/types.js";
import { FeatureLifecycleScope, LayerSetSession, type LayerHandle } from "../features/index.js";
import type { S111SurfaceCurrentLayerSpec } from "./iho-s100.js";
import {
  S111Workflow,
  type PrepareS111WorkflowOptions,
  type S111WorkflowResult,
  type S111WorkflowStatus,
} from "./s111-workflow.js";

export type S111SurfaceCurrentLayer =
  S100Layer<S111SurfaceCurrentLayerSpec>;

export type S111SurfaceCurrentSessionOptions<
  TMetadata = unknown,
  TData = unknown,
  TLatLonBounds = unknown,
> = PrepareS111WorkflowOptions<TMetadata, TData, TLatLonBounds> & {
  scene: S100Scene;
  layerScale?: number | "auto";
  onStatus?: (statuses: readonly S111WorkflowStatus[]) => void;
  onTimeline?: (timeline: S111WorkflowResult["timeline"]) => void;
  onResult?: (result: S111WorkflowResult) => void;
};

type S111SurfaceCurrentSessionLoadOptions<
  TMetadata = unknown,
  TData = unknown,
  TLatLonBounds = unknown,
> = Omit<S111SurfaceCurrentSessionOptions<TMetadata, TData, TLatLonBounds>, "scene">;

export class S111SurfaceCurrentSession {
  private readonly lifecycle = new FeatureLifecycleScope();
  private readonly layerSet = new LayerSetSession<S111SurfaceCurrentLayer>();
  private result: S111WorkflowResult | null = null;

  private constructor(private readonly scene: S100Scene) {
    this.lifecycle.onDispose(() => this.layerSet.removeAll());
  }

  static async load<
    TMetadata = unknown,
    TData = unknown,
    TLatLonBounds = unknown,
  >(
    options: S111SurfaceCurrentSessionOptions<TMetadata, TData, TLatLonBounds>,
  ): Promise<S111SurfaceCurrentSession> {
    const { scene, ...loadOptions } = options;
    const session = new S111SurfaceCurrentSession(scene);
    try {
      await session.reload(loadOptions);
      return session;
    } catch (error) {
      await session.dispose();
      throw error;
    }
  }

  get statuses(): readonly S111WorkflowStatus[] {
    return this.result?.statuses ?? [];
  }

  get timeline(): S111WorkflowResult["timeline"] {
    return this.result?.timeline ?? null;
  }

  get observedGrid(): S111WorkflowResult["observedGrid"] {
    return this.result?.observedGrid ?? null;
  }

  get layerHandles(): readonly LayerHandle<S111SurfaceCurrentLayer>[] {
    return this.layerSet.items;
  }

  get layers(): readonly S111SurfaceCurrentLayer[] {
    return this.layerSet.layers;
  }

  async reload<
    TMetadata = unknown,
    TData = unknown,
    TLatLonBounds = unknown,
  >(
    options: S111SurfaceCurrentSessionLoadOptions<TMetadata, TData, TLatLonBounds>,
  ): Promise<S111WorkflowResult> {
    const run = this.lifecycle.beginAbortable();
    const {
      layerScale,
      onStatus,
      onTimeline,
      onResult,
      signal,
      isCanceled,
      ...workflowOptions
    } = options;
    const linkedSignal = linkAbortSignals(run.signal, signal);

    try {
      const result = await S111Workflow.prepare({
        ...workflowOptions,
        signal: linkedSignal.signal,
        isCanceled: () => !run.isActive() || isCanceled?.() === true,
      });
      run.assertActive();

      const layers = await S111Workflow.addPreparedLayers(
        this.scene,
        result.prepared,
        layerScale !== undefined ? { scale: layerScale } : {},
      );

      if (!run.isActive()) {
        await Promise.allSettled(layers.map((layer) => layer.remove()));
        run.assertActive();
      }

      await this.layerSet.replace(
        layers.map((layer, index) => ({
          id: result.prepared[index]?.datasetId ?? layer.id,
          layer,
        })),
      );
      this.result = result;
      onStatus?.(result.statuses);
      onTimeline?.(result.timeline);
      onResult?.(result);
      return result;
    } finally {
      linkedSignal.dispose();
    }
  }

  async setVisibleDatasetIds(datasetIds: readonly string[]): Promise<void> {
    await this.layerSet.setVisibilityById(datasetIds);
  }

  setCurrentTime(time: number | Date): void {
    this.layerSet.layers.forEach((layer) => {
      layer.controllers.surfaceCurrent.setCurrentTime(time);
    });
  }

  async setScale(scale: number | "auto"): Promise<void> {
    await Promise.all(
      this.layerSet.layers.map((layer) =>
        scale === "auto"
          ? layer.controllers.surfaceCurrent.setAutoScaling(true)
          : layer.controllers.surfaceCurrent.setCustomScale(scale),
      ),
    );
  }

  async setScaleMultiplier(multiplier: number): Promise<void> {
    const observedGrid = this.observedGrid?.maxMeters ?? 250;
    const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0
      ? multiplier
      : 1;
    await this.setScale(observedGrid * safeMultiplier);
  }

  async dispose(): Promise<void> {
    await this.lifecycle.dispose();
  }
}

type LinkedAbortSignal = {
  signal: AbortSignal;
  dispose(): void;
};

const linkAbortSignals = (
  primarySignal: AbortSignal,
  secondarySignal: AbortSignal | undefined,
): LinkedAbortSignal => {
  if (secondarySignal === undefined) {
    return {
      signal: primarySignal,
      dispose: () => {},
    };
  }

  const abortController = new AbortController();
  const abort = () => {
    abortController.abort();
  };
  const signals = [primarySignal, secondarySignal];

  signals.forEach((signal) => {
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
  });

  return {
    signal: abortController.signal,
    dispose: () => {
      signals.forEach((signal) => {
        signal.removeEventListener("abort", abort);
      });
    },
  };
};
