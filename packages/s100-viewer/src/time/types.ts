import type { S100Unsubscribe } from "../events/S100EventBus.js";

export type TimeInterval = {
  start: Date;
  end: Date;
};

export type TimePlaybackState = {
  playing: boolean;
  rate: number;
  loop: boolean;
};

export interface TimeController {
  getCurrent(): Date;
  setCurrent(value: Date): void;
  getAvailability(): TimeInterval | null;
  setAvailability(value: TimeInterval | null): void;
  getPlaybackState(): TimePlaybackState;
  play(options?: Partial<Pick<TimePlaybackState, "rate" | "loop">>): void;
  pause(): void;
  onChanged(listener: (value: Date) => void): S100Unsubscribe;
}
