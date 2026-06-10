import type { S100EventBus, S100Unsubscribe } from "../events/S100EventBus.js";
import type { S100SceneEvents } from "../scene/types.js";
import type { TimeController, TimeInterval, TimePlaybackState } from "./types.js";
import type { EngineScene } from "../adapters/types.js";

export class CoreTimeController implements TimeController {
  private current = new Date(0);
  private availability: TimeInterval | null = null;
  private playbackState: TimePlaybackState = {
    playing: false,
    rate: 1,
    loop: false,
  };

  constructor(
    private readonly engineScene: EngineScene,
    private readonly events: S100EventBus<S100SceneEvents>,
    private readonly onEngineSeaLevelChanged: (value: number) => void = () => {},
  ) {}

  getCurrent(): Date {
    return new Date(this.current);
  }

  setCurrent(value: Date): void {
    this.current = new Date(value);
    this.engineScene.setTime(this.current);
    const seaLevel = this.engineScene.getSeaLevel?.();
    if (typeof seaLevel === "number" && Number.isFinite(seaLevel)) {
      this.onEngineSeaLevelChanged(seaLevel);
    }
    this.events.emit("time.changed", this.getCurrent());
  }

  getAvailability(): TimeInterval | null {
    if (!this.availability) {
      return null;
    }

    return {
      start: new Date(this.availability.start),
      end: new Date(this.availability.end),
    };
  }

  setAvailability(value: TimeInterval | null): void {
    this.availability = value
      ? {
          start: new Date(value.start),
          end: new Date(value.end),
        }
      : null;
  }

  getPlaybackState(): TimePlaybackState {
    return { ...this.playbackState };
  }

  play(options: Partial<Pick<TimePlaybackState, "rate" | "loop">> = {}): void {
    this.playbackState = {
      playing: true,
      rate: options.rate ?? this.playbackState.rate,
      loop: options.loop ?? this.playbackState.loop,
    };
    this.events.emit("time.playback.changed", this.getPlaybackState());
  }

  pause(): void {
    this.playbackState = {
      ...this.playbackState,
      playing: false,
    };
    this.events.emit("time.playback.changed", this.getPlaybackState());
  }

  onChanged(listener: (value: Date) => void): S100Unsubscribe {
    return this.events.on("time.changed", listener);
  }
}
