import { getS102SafetyDepthMeters, normalizeDepthMeters } from "../../products/depth.js";
import type { S102BathymetryLayerSpec } from "../../products/iho-s100.js";
import type { S100Layer } from "../types.js";
import {
  finiteNumber,
  getNumberFromExtensions,
} from "./baseController.js";
import type {
  Mutable,
  TerrainContourOptions,
  TerrainDebugPatch,
  TerrainDisplayController,
  TerrainDisplayPatch,
  TerrainLayerController,
  TerrainSettingsController,
} from "./types.js";

export class CoreTerrainLayerController implements TerrainLayerController {
  readonly kind = "s102-terrain" as const;
  readonly terrain: TerrainDisplayController;
  readonly settings: TerrainSettingsController;
  private readonly terrainState: Mutable<TerrainDisplayController>;
  private readonly settingsState: Mutable<TerrainSettingsController>;

  constructor(private readonly layer: S100Layer<S102BathymetryLayerSpec>) {
    const spec = layer.spec;
    const contours = spec.style?.contours;
    this.terrainState = {
      safetyDepthMeters: getS102SafetyDepthMeters(spec.style),
      seaLevel: finiteNumber(spec.style?.seaLevel, 0),
      seaContour: contours?.visible ?? false,
      showContour: contours?.visible ?? false,
      contourInterval: finiteNumber(contours?.intervalMeters, 5),
    };
    this.settingsState = {
      renderBBoxes: spec.debug?.showTileBounds ?? false,
      detailFactor: spec.rendering?.detailFactor ?? getNumberFromExtensions(spec.extensions, "detailFactor", 1),
      neverDiscardRootNodes: false,
      waitForSiblings: false,
    };

    const controller = this;
    this.terrain = {
      get safetyDepthMeters() {
        controller.syncFromLayerSpec();
        return controller.terrainState.safetyDepthMeters;
      },
      get seaLevel() {
        controller.syncFromLayerSpec();
        return controller.terrainState.seaLevel;
      },
      get seaContour() {
        controller.syncFromLayerSpec();
        return controller.terrainState.seaContour;
      },
      get showContour() {
        controller.syncFromLayerSpec();
        return controller.terrainState.showContour;
      },
      get contourInterval() {
        controller.syncFromLayerSpec();
        return controller.terrainState.contourInterval;
      },
    };

    this.settings = {
      get renderBBoxes() {
        controller.syncFromLayerSpec();
        return controller.settingsState.renderBBoxes;
      },
      get detailFactor() {
        controller.syncFromLayerSpec();
        return controller.settingsState.detailFactor;
      },
      get neverDiscardRootNodes() {
        return controller.settingsState.neverDiscardRootNodes;
      },
      get waitForSiblings() {
        return controller.settingsState.waitForSiblings;
      },
    };
  }

  private syncFromLayerSpec(): void {
    const spec = this.layer.spec;
    const contours = spec.style?.contours;
    this.terrainState.safetyDepthMeters = getS102SafetyDepthMeters(
      spec.style,
      this.terrainState.safetyDepthMeters,
    );
    this.terrainState.seaLevel = finiteNumber(spec.style?.seaLevel, this.terrainState.seaLevel);
    if (contours?.visible !== undefined) {
      this.terrainState.showContour = contours.visible;
      this.terrainState.seaContour = contours.visible;
    }
    this.terrainState.contourInterval = finiteNumber(
      contours?.intervalMeters,
      this.terrainState.contourInterval,
    );
    this.settingsState.renderBBoxes = spec.debug?.showTileBounds ?? this.settingsState.renderBBoxes;
    this.settingsState.detailFactor =
      spec.rendering?.detailFactor ??
      getNumberFromExtensions(spec.extensions, "detailFactor", this.settingsState.detailFactor);
  }

  setSafetyDepthMeters(value: number): Promise<void> {
    return this.updateDisplayStyle({ safetyDepthMeters: value });
  }

  setSeaLevel(value: number): Promise<void> {
    return this.updateDisplayStyle({ seaLevel: value });
  }

  setContours(options: TerrainContourOptions): Promise<void> {
    return this.updateDisplayStyle({ contours: options });
  }

  async updateDisplayStyle(patch: TerrainDisplayPatch): Promise<void> {
    this.syncFromLayerSpec();
    if (patch.safetyDepthMeters !== undefined) {
      this.terrainState.safetyDepthMeters = normalizeDepthMeters(
        patch.safetyDepthMeters,
        this.terrainState.safetyDepthMeters,
      );
    } else if (patch.unsafeDepth !== undefined) {
      this.terrainState.safetyDepthMeters = getS102SafetyDepthMeters(
        { unsafeDepth: patch.unsafeDepth },
        this.terrainState.safetyDepthMeters,
      );
    }
    if (patch.seaLevel !== undefined) {
      this.terrainState.seaLevel = finiteNumber(patch.seaLevel, this.terrainState.seaLevel);
    }
    if (patch.contours?.visible !== undefined) {
      this.terrainState.showContour = patch.contours.visible;
    }
    if (patch.contours?.seaContour !== undefined) {
      this.terrainState.seaContour = patch.contours.seaContour;
    }
    if (patch.contours?.intervalMeters !== undefined) {
      this.terrainState.contourInterval = finiteNumber(
        patch.contours.intervalMeters,
        this.terrainState.contourInterval,
      );
    }

    const style = { ...this.layer.spec.style };
    delete style.unsafeDepth;
    await this.layer.update({
      style: {
        ...style,
        safetyDepthMeters: this.terrainState.safetyDepthMeters,
        seaLevel: this.terrainState.seaLevel,
        contours: {
          ...style.contours,
          visible: this.terrainState.showContour || this.terrainState.seaContour,
          intervalMeters: this.terrainState.contourInterval,
        },
      },
    });
  }

  async setDetailFactor(value: number): Promise<void> {
    this.syncFromLayerSpec();
    this.settingsState.detailFactor = finiteNumber(value, this.settingsState.detailFactor);
    await this.layer.update({
      rendering: {
        ...this.layer.spec.rendering,
        detailFactor: this.settingsState.detailFactor,
      },
    });
  }

  setTileBoundsVisible(visible: boolean): Promise<void> {
    return this.updateDebugOptions({ showTileBounds: visible });
  }

  async updateDebugOptions(patch: TerrainDebugPatch): Promise<void> {
    this.syncFromLayerSpec();
    if (patch.showTileBounds !== undefined) {
      this.settingsState.renderBBoxes = patch.showTileBounds;
    }
    await this.layer.update({
      debug: {
        ...this.layer.spec.debug,
        showTileBounds: this.settingsState.renderBBoxes,
      },
    });
  }
}
