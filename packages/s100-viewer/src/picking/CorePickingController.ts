import type { EngineScene } from "../adapters/types.js";
import type { S100EventBus } from "../events/S100EventBus.js";
import type { S100SceneEvents } from "../scene/types.js";
import type { LivePickingOptions, PickingController, PickRequest, PickResult } from "./types.js";

export class CorePickingController implements PickingController {
  private liveMode: LivePickingOptions = {
    enabled: false,
    fallback: "none",
  };

  constructor(
    private readonly engineScene: EngineScene,
    private readonly events: S100EventBus<S100SceneEvents>,
  ) {}

  async pick(request: PickRequest): Promise<PickResult | null> {
    const result = await this.engineScene.pick(request);
    this.events.emit("pick.changed", result);
    return result;
  }

  getLiveMode(): LivePickingOptions {
    return { ...this.liveMode };
  }

  setLiveMode(options: LivePickingOptions): void {
    this.liveMode = { ...options };
    this.engineScene.setLivePickingMode?.(this.liveMode, (result) => {
      this.events.emit("pick.changed", result);
    });
  }
}
