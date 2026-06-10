import type { EngineScene } from "../adapters/types.js";
import type { S100EventBus, S100Unsubscribe } from "../events/S100EventBus.js";
import type { EnvironmentController, EnvironmentState, S100SceneEvents } from "./types.js";

export class CoreEnvironmentController implements EnvironmentController {
  private state: EnvironmentState = {};

  constructor(
    private readonly engineScene: EngineScene,
    private readonly events: S100EventBus<S100SceneEvents>,
  ) {}

  getState(): EnvironmentState {
    return { ...this.state };
  }

  setState(state: EnvironmentState): void {
    const hasSkyboxUrl = Object.prototype.hasOwnProperty.call(state, "skyboxUrl");
    const hasSkyboxFaces = Object.prototype.hasOwnProperty.call(state, "skyboxFaces");
    this.state = {
      ...this.state,
      ...state,
      lighting: {
        ...this.state.lighting,
        ...state.lighting,
      },
    };
    if (hasSkyboxUrl && !hasSkyboxFaces) {
      delete this.state.skyboxFaces;
    }
    if (hasSkyboxFaces && !hasSkyboxUrl) {
      delete this.state.skyboxUrl;
    }
    this.engineScene.setEnvironment?.(this.getState());
    this.events.emit("environment.changed", this.getState());
  }

  onChanged(listener: (state: EnvironmentState) => void): S100Unsubscribe {
    return this.events.on("environment.changed", listener);
  }
}
