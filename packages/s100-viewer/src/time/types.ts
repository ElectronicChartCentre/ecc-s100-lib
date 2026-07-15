import type { S100Unsubscribe } from "../events/S100EventBus.js";

export type TimeInterval = {
  start: Date;
  end: Date;
};

export type TimePlaybackState = {
  playing: boolean;
  /** Timesteps advanced per second while playback is running. */
  rate: number;
  loop: boolean;
  /** Scene-time increment applied for each playback timestep. */
  stepMs: number;
};

export type TimePlaybackOptions = Partial<Pick<TimePlaybackState, "rate" | "loop" | "stepMs">>;

export interface TimeController {
  getCurrent(): Date;
  setCurrent(value: Date): void;
  getAvailability(): TimeInterval | null;
  setAvailability(value: TimeInterval | null): void;
  getPlaybackState(): TimePlaybackState;
  play(options?: TimePlaybackOptions): void;
  pause(): void;
  onChanged(listener: (value: Date) => void): S100Unsubscribe;
}
