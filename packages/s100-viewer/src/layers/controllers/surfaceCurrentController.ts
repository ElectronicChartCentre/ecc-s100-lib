import { resolveS111Scale } from "../../internal/products/s111Style.js";
import { resolveS111TimeRange } from "../../internal/products/s111Time.js";
import type {
  S111SurfaceCurrentData,
  S111SurfaceCurrentLayerSpec,
} from "../../products/iho-s100.js";
import type { S100Layer } from "../types.js";
import { isRecord } from "./baseController.js";
import type {
  LayerControllerContext,
  SurfaceCurrentLayerController,
  SurfaceCurrentTimeController,
} from "./types.js";

export class CoreSurfaceCurrentLayerController implements SurfaceCurrentLayerController {
  readonly kind = "s111-surface-current" as const;
  readonly time: SurfaceCurrentTimeController;
  private currentTimeMs: number;
  private disableAutoScalingState = false;
  private scalingModeState: "auto" | "custom" = "custom";
  private customScaleState = 1;

  constructor(
    private readonly layer: S100Layer<S111SurfaceCurrentLayerSpec>,
    private readonly context: LayerControllerContext,
  ) {
    const dataset = surfaceCurrentDataFromSpec(layer.spec);
    const { startTime, endTime } = resolveS111TimeRange(dataset);
    const scale = resolveS111Scale(layer.spec.style);

    if (typeof scale === "number" && Number.isFinite(scale) && scale > 0) {
      this.customScaleState = scale;
      this.disableAutoScalingState = true;
      this.scalingModeState = "custom";
    } else if (scale === "auto") {
      this.disableAutoScalingState = false;
      this.scalingModeState = "auto";
    }

    this.currentTimeMs = startTime;
    const controller = this;
    this.time = {
      get startTime() {
        return startTime;
      },
      get endTime() {
        return endTime;
      },
      get currentTime() {
        const sceneTime = controller.context.getSceneTime?.();
        if (sceneTime !== undefined) {
          controller.currentTimeMs = sceneTime.getTime();
        }
        return controller.currentTimeMs;
      },
      set currentTime(value: number) {
        controller.setCurrentTime(value);
      },
    };
  }

  get disableAutoScaling(): boolean {
    this.syncScaleFromLayerSpec();
    return this.disableAutoScalingState;
  }

  get scalingMode(): "auto" | "custom" {
    this.syncScaleFromLayerSpec();
    return this.scalingModeState;
  }

  get customScale(): number {
    this.syncScaleFromLayerSpec();
    return this.customScaleState;
  }

  async setCustomScale(scale: number): Promise<void> {
    this.syncScaleFromLayerSpec();
    const finiteScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.customScaleState = finiteScale;
    this.disableAutoScalingState = true;
    this.scalingModeState = "custom";
    await this.layer.update({
      style: {
        renderer: this.layer.spec.style?.renderer ?? "arrows",
        ...this.layer.spec.style,
        scale: finiteScale,
      },
    });
  }

  async setAutoScaling(enabled: boolean): Promise<void> {
    this.syncScaleFromLayerSpec();
    this.disableAutoScalingState = !enabled;
    this.scalingModeState = enabled ? "auto" : "custom";
    await this.layer.update({
      style: {
        renderer: this.layer.spec.style?.renderer ?? "arrows",
        ...this.layer.spec.style,
        scale: enabled ? "auto" : this.customScaleState,
      },
    });
  }

  setCurrentTime(time: number | Date): void {
    const value = time instanceof Date ? time.getTime() : time;
    this.currentTimeMs = Number.isFinite(value) ? value : this.time.startTime;
    this.context.setSceneTime?.(new Date(this.currentTimeMs));
  }

  private syncScaleFromLayerSpec(): void {
    const scale = resolveS111Scale(this.layer.spec.style);
    if (typeof scale === "number" && Number.isFinite(scale) && scale > 0) {
      this.customScaleState = scale;
      this.disableAutoScalingState = true;
      this.scalingModeState = "custom";
      return;
    }
    if (scale === "auto") {
      this.disableAutoScalingState = false;
      this.scalingModeState = "auto";
    }
  }
}

const surfaceCurrentDataFromSpec = (
  spec: S111SurfaceCurrentLayerSpec,
): S111SurfaceCurrentData | undefined => {
  if (spec.source.kind === "static-json" && isRecord(spec.source.data)) {
    return spec.source.data as S111SurfaceCurrentData;
  }
  if (spec.source.kind === "rest-json" && isRecord(spec.source.sample)) {
    return spec.source.sample as S111SurfaceCurrentData;
  }
  return undefined;
};
