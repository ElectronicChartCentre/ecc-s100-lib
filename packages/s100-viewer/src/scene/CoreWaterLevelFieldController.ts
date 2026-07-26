import type { Coordinate } from "../coordinates/types.js";
import type { S100EventBus, S100Unsubscribe } from "../events/S100EventBus.js";
import type { S104WaterLevelSampler } from "../products/s104.js";
import type {
  S100SceneEvents,
  WaterLevelFieldController,
  WaterLevelFieldSample,
  WaterLevelFieldSource,
  WaterLevelFieldState,
} from "./types.js";

export type CoreWaterLevelFieldControllerOptions = {
  getSeaLevel: () => number;
  getSeaLevelSource: () => Exclude<WaterLevelFieldSource, "s104">;
  getSceneTime: () => Date;
  onSamplerChanged?: () => void;
};

export class CoreWaterLevelFieldController implements WaterLevelFieldController {
  private sampler: S104WaterLevelSampler | null = null;

  constructor(
    private readonly events: S100EventBus<S100SceneEvents>,
    private readonly options: CoreWaterLevelFieldControllerOptions,
  ) {}

  setSampler(sampler: S104WaterLevelSampler | null): void {
    if (Object.is(this.sampler, sampler)) {
      return;
    }

    this.sampler = sampler;
    this.options.onSamplerChanged?.();
    this.emitChanged();
  }

  getSampler(): S104WaterLevelSampler | null {
    return this.sampler;
  }

  getState(): WaterLevelFieldState {
    return {
      sampler: this.sampler,
      source: this.sampler !== null ? "s104" : this.options.getSeaLevelSource(),
      seaLevelMeters: this.options.getSeaLevel(),
    };
  }

  sample(options: {
    coordinate: Coordinate;
    time?: Date | number | string;
  }): WaterLevelFieldSample {
    const requestedTime = normalizeRequestedTime(options.time, this.options.getSceneTime());
    if (this.sampler !== null) {
      return {
        ...this.sampler.sample({
          coordinate: options.coordinate,
          time: requestedTime,
        }),
        source: "s104",
      };
    }

    return {
      status: "value",
      source: this.options.getSeaLevelSource(),
      heightMeters: this.options.getSeaLevel(),
      coordinate: options.coordinate,
      requestedCoordinate: options.coordinate,
      sourceTime: requestedTime,
      requestedTime,
      samplingMode: "scene-global-sea-level",
    };
  }

  onChanged(listener: (state: WaterLevelFieldState) => void): S100Unsubscribe {
    return this.events.on("waterLevel.changed", listener);
  }

  notifyChanged(): void {
    this.emitChanged();
  }

  private emitChanged(): void {
    this.events.emit("waterLevel.changed", this.getState());
  }
}

const normalizeRequestedTime = (
  value: Date | number | string | undefined,
  fallback: Date,
): Date => {
  if (value instanceof Date) {
    return new Date(value);
  }

  if (typeof value === "number" || typeof value === "string") {
    const time = new Date(value);
    return Number.isFinite(time.getTime()) ? time : new Date(fallback);
  }

  return new Date(fallback);
};
