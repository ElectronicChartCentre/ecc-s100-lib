import type { S100EventBus } from "../events/S100EventBus.js";
import type { S100SceneEvents } from "../scene/types.js";
import type { DepthRayController, DepthRayState, PickingController } from "./types.js";

const DEFAULT_DEPTH_RAY_STATE: DepthRayState = {
  enabled: false,
  fallback: "sea-level-plane",
  lineThickness: 4,
  aboveSeaLevelColor: [1, 1, 0],
  belowSeaLevelColor: [0, 0, 1],
  seaLevelMarkerVisible: true,
  seaLevelMarkerSize: 60,
  seaLevelMarkerOpacity: 0.35,
  seaLevelMarkerColor: [1, 1, 1],
};

export class CoreDepthRayController implements DepthRayController {
  private state: DepthRayState = { ...DEFAULT_DEPTH_RAY_STATE };

  constructor(
    private readonly picking: PickingController,
    private readonly events: S100EventBus<S100SceneEvents>,
  ) {}

  getState(): DepthRayState {
    return { ...this.state };
  }

  setState(state: Partial<DepthRayState>): void {
    this.state = {
      ...this.state,
      ...state,
    };
    this.apply();
  }

  setEnabled(enabled: boolean): void {
    this.setState({ enabled });
  }

  private apply(): void {
    const { enabled, fallback, ...visual } = this.state;
    const liveMode = {
      enabled,
      includeVisual: enabled,
      visual,
      ...(fallback !== undefined ? { fallback } : {}),
    };
    this.picking.setLiveMode(liveMode);
    if (!enabled) {
      this.events.emit("pick.changed", null);
    }
  }
}
