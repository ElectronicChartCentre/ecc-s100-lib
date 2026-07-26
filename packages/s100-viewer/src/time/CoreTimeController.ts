import type { S100EventBus, S100Unsubscribe } from "../events/S100EventBus.js";
import type { S100SceneEvents } from "../scene/types.js";
import type { TimeController, TimeInterval, TimePlaybackOptions, TimePlaybackState } from "./types.js";
import type { EngineScene } from "../adapters/types.js";

const defaultPlaybackRate = 1;
const defaultPlaybackStepMs = 1000;

export class CoreTimeController implements TimeController {
  private current = new Date(0);
  private availability: TimeInterval | null = null;
  private playbackState: TimePlaybackState = {
    playing: false,
    rate: defaultPlaybackRate,
    loop: false,
    stepMs: defaultPlaybackStepMs,
  };
  private playbackTimer: ReturnType<typeof setInterval> | null = null;

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
    const seaLevelSource = this.engineScene.getSeaLevelSource?.();
    if (
      typeof seaLevel === "number" &&
      Number.isFinite(seaLevel) &&
      (seaLevelSource === "simulated-water-level" || seaLevelSource === undefined)
    ) {
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

  play(options: TimePlaybackOptions = {}): void {
    const rate = positiveFiniteNumber(options.rate, this.playbackState.rate, defaultPlaybackRate);
    const stepMs = positiveFiniteNumber(
      options.stepMs,
      this.playbackState.stepMs,
      defaultPlaybackStepMs,
    );
    this.playbackState = {
      playing: true,
      rate,
      loop: options.loop ?? this.playbackState.loop,
      stepMs,
    };
    this.events.emit("time.playback.changed", this.getPlaybackState());
    this.restartPlaybackTimer();
  }

  pause(): void {
    this.stopPlaybackTimer();
    this.playbackState = {
      ...this.playbackState,
      playing: false,
    };
    this.events.emit("time.playback.changed", this.getPlaybackState());
  }

  onChanged(listener: (value: Date) => void): S100Unsubscribe {
    return this.events.on("time.changed", listener);
  }

  destroy(): void {
    this.stopPlaybackTimer();
  }

  private restartPlaybackTimer(): void {
    this.stopPlaybackTimer();
    const intervalMs = Math.max(1, Math.round(1000 / this.playbackState.rate));
    this.playbackTimer = setInterval(() => {
      this.advancePlaybackStep();
    }, intervalMs);
  }

  private stopPlaybackTimer(): void {
    if (this.playbackTimer === null) {
      return;
    }

    clearInterval(this.playbackTimer);
    this.playbackTimer = null;
  }

  private advancePlaybackStep(): void {
    if (!this.playbackState.playing) {
      return;
    }

    const nextTime = this.nextPlaybackTime();
    if (nextTime === null) {
      return;
    }

    this.setCurrent(new Date(nextTime));
  }

  private nextPlaybackTime(): number | null {
    const currentTime = this.current.getTime();
    const availability = this.availability;
    if (!availability) {
      return currentTime + this.playbackState.stepMs;
    }

    const startTime = availability.start.getTime();
    const endTime = availability.end.getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
      return currentTime + this.playbackState.stepMs;
    }

    if (currentTime < startTime || currentTime > endTime) {
      return startTime;
    }

    const nextTime = currentTime + this.playbackState.stepMs;
    if (nextTime <= endTime) {
      return nextTime;
    }

    if (this.playbackState.loop) {
      return startTime;
    }

    this.pause();
    return currentTime < endTime ? endTime : null;
  }
}

const positiveFiniteNumber = (
  value: number | undefined,
  previousValue: number,
  fallback: number,
): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (Number.isFinite(previousValue) && previousValue > 0) {
    return previousValue;
  }
  return fallback;
};
