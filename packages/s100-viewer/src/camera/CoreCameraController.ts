import type { EngineScene } from "../adapters/types.js";
import type { CameraController, CameraLookAt, CameraPose } from "./types.js";
import type { S100SceneEvents } from "../scene/types.js";
import type { S100EventBus, S100Unsubscribe } from "../events/S100EventBus.js";
import { S100Error } from "../errors/S100Error.js";

export class CoreCameraController implements CameraController {
  private readonly clearEngineCameraChangeListener: (() => void) | null = null;

  constructor(
    private readonly engineScene: EngineScene,
    private readonly events: S100EventBus<S100SceneEvents>,
  ) {
    if (engineScene.setCameraChangeListener) {
      engineScene.setCameraChangeListener((pose) => {
        this.events.emit("camera.changed", pose);
      });
      this.clearEngineCameraChangeListener = () => {
        engineScene.setCameraChangeListener?.(null);
      };
    }
  }

  getPose(): CameraPose {
    return this.engineScene.getCamera();
  }

  setPose(pose: CameraPose): void {
    this.engineScene.setCamera(pose);
    this.events.emit("camera.changed", pose);
  }

  lookAt(view: CameraLookAt): void {
    if (!this.engineScene.lookAt) {
      const error = new S100Error(
        "adapter-capability",
        "The active adapter does not support camera lookAt commands.",
      );
      this.events.emit("error", error);
      throw error;
    }

    this.engineScene.lookAt(view);
    this.events.emit("camera.changed", this.engineScene.getCamera());
  }

  onChanged(listener: (pose: CameraPose) => void): S100Unsubscribe {
    return this.events.on("camera.changed", listener);
  }

  destroy(): void {
    this.clearEngineCameraChangeListener?.();
  }
}
