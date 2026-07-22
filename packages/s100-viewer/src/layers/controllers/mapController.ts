import type { EncLayerSpec } from "../../products/enc.js";
import type { MapOverlayLayerSpec } from "../../products/viewer-features.js";
import type { S100Layer } from "../types.js";
import {
  clamp01,
  finiteNumber,
  getNumberFromExtensions,
} from "./baseController.js";
import type { MapLayerController } from "./types.js";

export class CoreMapLayerController implements MapLayerController {
  readonly kind = "projected-map" as const;
  private alphaState: number;
  private discardModeState: number;

  constructor(private readonly layer: S100Layer<EncLayerSpec | MapOverlayLayerSpec>) {
    this.alphaState = clamp01(layer.spec.opacity ?? 1);
    this.discardModeState = getMapDiscardMode(layer.spec, 1);
  }

  get alpha(): number {
    this.syncFromLayerSpec();
    return this.alphaState;
  }

  get discardMode(): number {
    this.syncFromLayerSpec();
    return this.discardModeState;
  }

  async setAlpha(value: number): Promise<void> {
    this.syncFromLayerSpec();
    this.alphaState = clamp01(value);
    await this.layer.update({ opacity: this.alphaState });
  }

  setVisibility(visible: boolean): Promise<void> {
    this.layer.visible = visible;
    return this.layer.update({ visible });
  }

  async setDiscardMode(discardMode: number): Promise<void> {
    this.syncFromLayerSpec();
    this.discardModeState = finiteNumber(discardMode, this.discardModeState);
    await this.layer.update({
      mapRendering: {
        ...this.layer.spec.mapRendering,
        discardMode: this.discardModeState,
      },
    });
  }

  private syncFromLayerSpec(): void {
    this.alphaState = clamp01(this.layer.spec.opacity ?? this.layer.opacity);
    this.discardModeState = getMapDiscardMode(this.layer.spec, this.discardModeState);
  }
}

const getMapDiscardMode = (
  spec: EncLayerSpec | MapOverlayLayerSpec,
  fallback: number,
): number =>
  finiteNumber(
    spec.mapRendering?.discardMode,
    getNumberFromExtensions(spec.extensions, "discardMode", fallback),
  );
