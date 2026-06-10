import { EventEmitter } from "./EventEmitter.js";
import type {
  FrameSubscription,
  S100RenderContext,
  S100SceneOptions,
  Vec3,
} from "./types.js";

const DEFAULT_ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

export class S100Scene {
  readonly crs: string | undefined;
  readonly origin: Vec3;
  readonly seaLevelChanged = new EventEmitter<number>();
  readonly cameraInteractionChanged = new EventEmitter<boolean>();
  readonly renderContext: S100RenderContext | null;

  private destroyed = false;
  private currentSeaLevel = 0;
  private cameraInteractionActive = false;
  private readonly frameCallbacks = new Set<() => void>();

  constructor(
    options: S100SceneOptions = {},
    renderContext: S100RenderContext | null = null,
  ) {
    this.crs = options.crs;
    this.origin = options.origin ?? DEFAULT_ORIGIN;
    this.renderContext = renderContext;
  }

  initialized(): Promise<boolean> {
    return Promise.resolve(!this.destroyed);
  }

  get seaLevel(): number {
    return this.currentSeaLevel;
  }

  set seaLevel(value: number) {
    this.assertActive();
    this.currentSeaLevel = value;
    this.seaLevelChanged.emit(value);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.frameCallbacks.clear();
    this.seaLevelChanged.clear();
    this.cameraInteractionChanged.clear();
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get isCameraInteractionActive(): boolean {
    return this.cameraInteractionActive;
  }

  setCameraInteractionActive(active: boolean): void {
    if (this.destroyed || this.cameraInteractionActive === active) {
      return;
    }

    this.cameraInteractionActive = active;
    this.cameraInteractionChanged.emit(active);
  }

  onBeforeRender(callback: () => void): FrameSubscription {
    this.assertActive();
    this.frameCallbacks.add(callback);
    return {
      unsubscribe: () => {
        this.frameCallbacks.delete(callback);
      },
    };
  }

  updateBeforeRender(): void {
    if (this.destroyed) {
      return;
    }

    for (const callback of this.frameCallbacks) {
      callback();
    }
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new Error("Cannot use a destroyed S100Scene.");
    }
  }
}
