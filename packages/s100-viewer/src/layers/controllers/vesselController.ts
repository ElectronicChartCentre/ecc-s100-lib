import type { Coordinate } from "../../coordinates/types.js";
import type { S100Unsubscribe } from "../../events/S100EventBus.js";
import type { Vec3Tuple } from "../../math.js";
import type {
  VesselDimensions,
  VesselLayerSpec,
  VesselPose,
  VesselTransformControlMode,
} from "../../products/viewer-features.js";
import type { S100Layer } from "../types.js";
import {
  finiteNumber,
  getBooleanFromExtensions,
  isRecord,
  normalizeDegrees,
  recordFromUnknown,
} from "./baseController.js";
import type {
  VesselLayerController,
  VesselPosePatch,
  VesselSeaLevelIndicatorController,
  VesselSeaLevelIndicatorMode,
  VesselTransformController,
} from "./types.js";

type NativeSubscription = {
  unsubscribe(): void;
};

type PromiseCallbacks = {
  resolve(): void;
  reject(error: unknown): void;
};

type NativeVesselViewLike = {
  getPosition?: () => Vec3Tuple;
  getHeading?: () => number;
  positionChanged?: {
    subscribe(listener: (position: Vec3Tuple) => void): NativeSubscription;
  };
  headingChanged?: {
    subscribe(listener: (heading: number) => void): NativeSubscription;
  };
  transformControls?: {
    mode?: VesselTransformControlMode;
    setMode?: (mode: VesselTransformControlMode) => void;
  };
  seaLevelIndicator?: {
    mode?: unknown;
    seaSurfaceVisible?: boolean;
    setSeaSurfaceVisible?: (visible: boolean) => void;
  };
};

export class CoreVesselLayerController implements VesselLayerController {
  readonly kind = "vessel" as const;
  readonly dimensions: VesselDimensions;
  readonly seaLevelIndicator: VesselSeaLevelIndicatorController;
  readonly transformControls: VesselTransformController;
  private positionState: Vec3Tuple;
  private headingState: number;
  private seaLevelIndicatorModeState: VesselSeaLevelIndicatorMode;
  private oceanSurfaceVisibleState: boolean;
  private transformModeState: VesselTransformControlMode;
  private readonly positionListeners = new Set<(position: Coordinate) => void>();
  private readonly headingListeners = new Set<(heading: number) => void>();
  private readonly subscriptions: S100Unsubscribe[] = [];
  private nativePositionSubscription: NativeSubscription | null = null;
  private nativeHeadingSubscription: NativeSubscription | null = null;
  private nativeHeadingPoll: ReturnType<typeof setInterval> | null = null;
  private pendingPosePatch: VesselPosePatch | null = null;
  private pendingPoseWaiters: PromiseCallbacks[] = [];
  private poseUpdateInFlight = false;
  private poseUpdateScheduled = false;

  constructor(private readonly layer: S100Layer<VesselLayerSpec>) {
    this.dimensions = vesselDimensionsFromSpec(layer.spec);
    this.positionState = coordinateToVec3Tuple(layer.spec.pose.position);
    this.headingState = normalizeDegrees(layer.spec.pose.headingDegrees ?? 0);
    this.seaLevelIndicatorModeState = layer.spec.rendering?.seaLevelIndicator === false ||
      layer.spec.style?.showSeaLevelIndicator === false
      ? "off"
      : "circle";
    this.oceanSurfaceVisibleState = vesselOceanSurfaceVisible(layer.spec);
    this.transformModeState = normalizeVesselTransformMode(layer.spec.style?.transformControls);

    const controller = this;
    this.seaLevelIndicator = {
      get mode() {
        controller.syncFromLayerSpec(false);
        return controller.seaLevelIndicatorModeState;
      },
      get oceanSurfaceVisible() {
        controller.syncFromLayerSpec(false);
        return controller.oceanSurfaceVisibleState;
      },
      setMode(mode: VesselSeaLevelIndicatorMode) {
        return controller.setSeaLevelIndicatorMode(mode);
      },
      setOceanSurfaceVisible(visible: boolean) {
        return controller.setOceanSurfaceVisible(visible);
      },
    };

    this.transformControls = {
      get mode() {
        return controller.getTransformMode();
      },
      setMode(mode: VesselTransformControlMode) {
        return controller.setTransformMode(mode);
      },
    };

    this.attachNativeBridge();
    this.subscriptions.push(
      this.layer.onChanged(() => {
        this.syncFromLayerSpec(true);
      }),
    );
  }

  getPosition(): Coordinate {
    this.syncFromLayerSpec(false);
    return coordinateFromVec3Tuple(this.positionState, this.layer.spec.pose.position);
  }

  getPose(): VesselPose {
    this.syncFromLayerSpec(false);
    const pose = this.layer.spec.pose;
    return {
      ...pose,
      position: coordinateFromVec3Tuple(this.positionState, pose.position),
      headingDegrees: this.headingState,
    };
  }

  setPose(pose: VesselPosePatch): Promise<void> {
    const normalizedPose = this.normalizePendingPosePatch(pose);
    if (!normalizedPose) {
      return Promise.resolve();
    }

    this.pendingPosePatch = mergeVesselPosePatches(this.pendingPosePatch, normalizedPose);
    const promise = new Promise<void>((resolve, reject) => {
      this.pendingPoseWaiters.push({ resolve, reject });
    });
    this.schedulePoseUpdate();
    return promise;
  }

  async setPosition(position: Coordinate): Promise<void> {
    await this.setPose({ position });
  }

  getHeading(): number {
    this.syncFromLayerSpec(false);
    return this.headingState;
  }

  async setHeading(heading: number): Promise<void> {
    await this.setPose({ headingDegrees: heading });
  }

  async setDimensions(dimensions: VesselDimensions): Promise<void> {
    const nextDimensions = normalizeVesselDimensions(dimensions, this.dimensions);
    Object.assign(this.dimensions, nextDimensions);
    await this.layer.update({
      dimensions: { ...this.dimensions },
      style: {
        ...this.layer.spec.style,
        draughtMeters: this.dimensions.draught,
      },
    });
  }

  setVisibility(visible: boolean): Promise<void> {
    this.layer.visible = visible;
    return this.layer.update({ visible });
  }

  async setSeaLevelIndicatorMode(mode: VesselSeaLevelIndicatorMode): Promise<void> {
    this.seaLevelIndicatorModeState = mode;
    await this.layer.update({
      rendering: {
        ...this.layer.spec.rendering,
        seaLevelIndicator: mode === "circle",
      },
      style: {
        ...this.layer.spec.style,
        showSeaLevelIndicator: mode === "circle",
      },
    });
  }

  async setOceanSurfaceVisible(visible: boolean): Promise<void> {
    this.oceanSurfaceVisibleState = visible;
    await this.layer.update({
      rendering: {
        ...this.layer.spec.rendering,
        oceanSurfaceVisible: visible,
      },
      style: {
        ...this.layer.spec.style,
        showOceanSurface: visible,
        oceanSurface: visible,
      },
    });
  }

  getTransformMode(): VesselTransformControlMode {
    this.syncFromLayerSpec(false);
    return this.transformModeState;
  }

  async setTransformMode(mode: VesselTransformControlMode): Promise<void> {
    this.transformModeState = mode;
    const nativeView = getNativeVesselView(this.layer.getNativeHandle());
    const nativeMode = nativeVesselTransformMode(mode);
    if (nativeMode && typeof nativeView?.transformControls?.setMode === "function") {
      nativeView.transformControls.setMode(nativeMode);
    } else if (nativeView?.transformControls) {
      nativeView.transformControls.mode = nativeMode ?? mode;
    }
    await this.layer.update({
      style: {
        ...this.layer.spec.style,
        transformControls: mode,
      },
    });
  }

  onPositionChanged(listener: (position: Coordinate) => void): S100Unsubscribe {
    this.positionListeners.add(listener);
    this.attachNativeBridge();
    return () => {
      this.positionListeners.delete(listener);
    };
  }

  onHeadingChanged(listener: (heading: number) => void): S100Unsubscribe {
    this.headingListeners.add(listener);
    this.attachNativeBridge();
    return () => {
      this.headingListeners.delete(listener);
    };
  }

  destroy(): void {
    for (const unsubscribe of this.subscriptions.splice(0)) {
      unsubscribe();
    }
    this.nativePositionSubscription?.unsubscribe();
    this.nativePositionSubscription = null;
    this.nativeHeadingSubscription?.unsubscribe();
    this.nativeHeadingSubscription = null;
    if (this.nativeHeadingPoll) {
      clearInterval(this.nativeHeadingPoll);
      this.nativeHeadingPoll = null;
    }
    this.positionListeners.clear();
    this.headingListeners.clear();
  }

  private attachNativeBridge(): void {
    const nativeView = getNativeVesselView(this.layer.getNativeHandle());
    if (!nativeView) {
      return;
    }
    if (!this.nativePositionSubscription && nativeView.positionChanged?.subscribe) {
      this.nativePositionSubscription = nativeView.positionChanged.subscribe((position) => {
        const nextPosition = normalizeVec3Tuple(position, this.positionState);
        if (vec3TupleEquals(nextPosition, this.positionState)) {
          return;
        }
        this.positionState = nextPosition;
        this.emitPosition(coordinateFromVec3Tuple(nextPosition, this.layer.spec.pose.position));
      });
    }
    if (!this.nativeHeadingSubscription && nativeView.headingChanged?.subscribe) {
      this.nativeHeadingSubscription = nativeView.headingChanged.subscribe((heading) => {
        const nextHeading = normalizeDegrees(heading);
        if (Object.is(nextHeading, this.headingState)) {
          return;
        }
        this.headingState = nextHeading;
        this.emitHeading(nextHeading);
      });
    }
    if (
      !this.nativeHeadingSubscription &&
      !this.nativeHeadingPoll &&
      typeof nativeView.getHeading === "function"
    ) {
      this.nativeHeadingPoll = setInterval(() => {
        const nextHeading = normalizeDegrees(nativeView.getHeading?.() ?? this.headingState);
        if (Object.is(nextHeading, this.headingState)) {
          return;
        }
        this.headingState = nextHeading;
        this.emitHeading(nextHeading);
      }, 60);
    }
  }

  private syncFromLayerSpec(emitChanges: boolean): void {
    const spec = this.layer.spec;
    const nextPosition = coordinateToVec3Tuple(spec.pose.position);
    const nextHeading = normalizeDegrees(spec.pose.headingDegrees ?? this.headingState);
    const positionChanged = !vec3TupleEquals(nextPosition, this.positionState);
    const headingChanged = !Object.is(nextHeading, this.headingState);
    this.positionState = nextPosition;
    this.headingState = nextHeading;
    Object.assign(this.dimensions, vesselDimensionsFromSpec(spec));
    this.seaLevelIndicatorModeState = spec.rendering?.seaLevelIndicator === false ||
      spec.style?.showSeaLevelIndicator === false
      ? "off"
      : "circle";
    this.oceanSurfaceVisibleState = vesselOceanSurfaceVisible(spec);
    this.transformModeState = normalizeVesselTransformMode(spec.style?.transformControls);

    if (emitChanges && positionChanged) {
      this.emitPosition(coordinateFromVec3Tuple(nextPosition, spec.pose.position));
    }
    if (emitChanges && headingChanged) {
      this.emitHeading(nextHeading);
    }
  }

  private emitPosition(position: Coordinate): void {
    for (const listener of [...this.positionListeners]) {
      listener(cloneCoordinate(position));
    }
  }

  private emitHeading(heading: number): void {
    for (const listener of [...this.headingListeners]) {
      listener(heading);
    }
  }

  private normalizePendingPosePatch(pose: VesselPosePatch): VesselPosePatch | null {
    const patch: VesselPosePatch = {};
    if (pose.position) {
      patch.position = normalizeCoordinatePosition(
        pose.position,
        this.pendingPosePatch?.position ??
          coordinateFromVec3Tuple(this.positionState, this.layer.spec.pose.position),
      );
    }
    if (pose.headingDegrees !== undefined) {
      patch.headingDegrees = normalizeDegrees(pose.headingDegrees);
    }
    return patch.position || patch.headingDegrees !== undefined ? patch : null;
  }

  private schedulePoseUpdate(): void {
    if (this.poseUpdateScheduled || this.poseUpdateInFlight) {
      return;
    }
    this.poseUpdateScheduled = true;
    scheduleFrame(() => {
      this.poseUpdateScheduled = false;
      void this.flushPendingPoseUpdate();
    });
  }

  private async flushPendingPoseUpdate(): Promise<void> {
    if (this.poseUpdateInFlight || !this.pendingPosePatch) {
      return;
    }
    const pose = this.pendingPosePatch;
    const waiters = this.pendingPoseWaiters.splice(0);
    this.pendingPosePatch = null;
    this.poseUpdateInFlight = true;

    try {
      await this.applyPosePatch(pose);
      for (const waiter of waiters) {
        waiter.resolve();
      }
    } catch (error) {
      for (const waiter of waiters) {
        waiter.reject(error);
      }
    } finally {
      this.poseUpdateInFlight = false;
      if (this.pendingPosePatch) {
        this.schedulePoseUpdate();
      }
    }
  }

  private async applyPosePatch(pose: VesselPosePatch): Promise<void> {
    const currentPose = this.layer.spec.pose;
    const nextPositionCoordinate = pose.position
      ? normalizeCoordinatePosition(pose.position, currentPose.position)
      : coordinateFromVec3Tuple(this.positionState, currentPose.position);
    const nextPosition = coordinateToVec3Tuple(nextPositionCoordinate);
    const nextHeading = pose.headingDegrees !== undefined
      ? normalizeDegrees(pose.headingDegrees)
      : this.headingState;
    const positionChanged = !vec3TupleEquals(nextPosition, this.positionState);
    const headingChanged = !Object.is(nextHeading, this.headingState);

    this.positionState = [...nextPosition];
    this.headingState = nextHeading;

    await this.layer.update({
      pose: {
        ...currentPose,
        position: nextPositionCoordinate,
        headingDegrees: nextHeading,
      },
    });

    if (positionChanged) {
      this.emitPosition(nextPositionCoordinate);
    }
    if (headingChanged) {
      this.emitHeading(nextHeading);
    }
  }
}

const normalizeVec3Tuple = (value: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple => [
  finiteNumber(value[0], fallback[0]),
  finiteNumber(value[1], fallback[1]),
  finiteNumber(value[2], fallback[2]),
];

const vec3TupleEquals = (a: Vec3Tuple, b: Vec3Tuple): boolean =>
  Object.is(a[0], b[0]) && Object.is(a[1], b[1]) && Object.is(a[2], b[2]);

const coordinateToVec3Tuple = (coordinate: Coordinate): Vec3Tuple => {
  if (coordinate.kind === "geodetic") {
    return [coordinate.lon, coordinate.lat, coordinate.height ?? 0];
  }
  return [coordinate.x, coordinate.y, coordinate.z ?? 0];
};

const cloneCoordinate = (coordinate: Coordinate): Coordinate => ({ ...coordinate });

const normalizeCoordinatePosition = (
  coordinate: Coordinate,
  fallback: Coordinate,
): Coordinate => {
  const position = normalizeVec3Tuple(
    coordinateToVec3Tuple(coordinate),
    coordinateToVec3Tuple(fallback),
  );
  return coordinateFromVec3Tuple(position, coordinate);
};

const coordinateFromVec3Tuple = (position: Vec3Tuple, previous: Coordinate): Coordinate => {
  if (previous.kind === "projected") {
    return {
      kind: "projected",
      crs: previous.crs,
      x: position[0],
      y: position[1],
      z: position[2],
    };
  }
  if (previous.kind === "geodetic") {
    return {
      kind: "geodetic",
      lon: position[0],
      lat: position[1],
      height: position[2],
      ...(previous.datum !== undefined ? { datum: previous.datum } : {}),
    };
  }
  if (previous.kind === "ecef") {
    return {
      kind: "ecef",
      x: position[0],
      y: position[1],
      z: position[2],
      ...(previous.datum !== undefined ? { datum: previous.datum } : {}),
    };
  }
  return {
    kind: "engine-local",
    x: position[0],
    y: position[1],
    z: position[2],
    frameId: previous.frameId,
  };
};

const vesselDimensionsFromSpec = (spec: VesselLayerSpec): VesselDimensions =>
  normalizeVesselDimensions(spec.dimensions ?? {}, {
    draught: spec.style?.draughtMeters ?? 0,
    bow: 0,
    stern: 0,
    port: 0,
    starboard: 0,
  });

const normalizeVesselDimensions = (
  dimensions: Partial<VesselDimensions>,
  fallback: VesselDimensions,
): VesselDimensions => ({
  draught: finiteNumber(dimensions.draught, fallback.draught),
  bow: finiteNumber(dimensions.bow, fallback.bow),
  stern: finiteNumber(dimensions.stern, fallback.stern),
  port: finiteNumber(dimensions.port, fallback.port),
  starboard: finiteNumber(dimensions.starboard, fallback.starboard),
});

const vesselOceanSurfaceVisible = (spec: VesselLayerSpec): boolean => {
  if (typeof spec.rendering?.oceanSurfaceVisible === "boolean") {
    return spec.rendering.oceanSurfaceVisible;
  }
  if (typeof spec.style?.oceanSurface === "boolean") {
    return spec.style.oceanSurface;
  }
  if (isRecord(spec.style?.oceanSurface)) {
    return spec.style.oceanSurface.enabled === true;
  }
  if (typeof spec.style?.showOceanSurface === "boolean") {
    return spec.style.showOceanSurface;
  }
  return getBooleanFromExtensions(spec.extensions, "seaSurfaceVisible", false);
};

const normalizeVesselTransformMode = (
  mode: VesselTransformControlMode | undefined,
): VesselTransformControlMode => mode ?? "translate-rotate";

const nativeVesselTransformMode = (
  mode: VesselTransformControlMode,
): "translate" | "rotate" | null =>
  mode === "translate" || mode === "rotate" ? mode : null;

const mergeVesselPosePatches = (
  current: VesselPosePatch | null,
  next: VesselPosePatch,
): VesselPosePatch => ({
  ...(current ?? {}),
  ...(next.position ? { position: next.position } : {}),
  ...(next.headingDegrees !== undefined ? { headingDegrees: next.headingDegrees } : {}),
});

const scheduleFrame = (callback: () => void): void => {
  const scheduler = globalThis as unknown as {
    requestAnimationFrame?: (callback: () => void) => unknown;
  };
  if (typeof scheduler.requestAnimationFrame === "function") {
    scheduler.requestAnimationFrame(callback);
    return;
  }
  setTimeout(callback, 0);
};

const getNativeVesselView = (nativeHandle: unknown): NativeVesselViewLike | null => {
  if (!isRecord(nativeHandle)) {
    return null;
  }
  if (isNativeVesselViewLike(nativeHandle)) {
    return nativeHandle;
  }
  const view = nativeHandle.view;
  return isNativeVesselViewLike(view) ? view : null;
};

const isNativeVesselViewLike = (value: unknown): value is NativeVesselViewLike =>
  isRecord(value) &&
  (typeof value.getPosition === "function" ||
    typeof value.getHeading === "function" ||
    isRecord(value.positionChanged) ||
    isRecord(value.headingChanged) ||
    isRecord(value.transformControls) ||
    isRecord(value.seaLevelIndicator));
