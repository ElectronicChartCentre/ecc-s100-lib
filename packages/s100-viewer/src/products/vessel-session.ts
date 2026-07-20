import { Coordinates, type Coordinate } from "../coordinates/types.js";
import type { S100Unsubscribe } from "../events/S100EventBus.js";
import type { VesselSeaLevelIndicatorMode } from "../layers/controllers.js";
import type { S100Layer } from "../layers/types.js";
import type { S100Scene } from "../scene/types.js";
import { FeatureLifecycleScope } from "../features/index.js";
import {
  createVessel,
  type CreateVesselLayerOptions,
} from "./viewer-feature-builders.js";
import type {
  VesselDimensions,
  VesselLayerSpec,
  VesselPose,
  VesselStyle,
  VesselTransformControlMode,
  VesselVerticalPositionLimits,
} from "./viewer-features.js";

export type VesselLayer = S100Layer<VesselLayerSpec>;

export type VesselVerticalConstraint = {
  minMeters?: number;
  maxMeters?: number | "draught";
  reference?: VesselVerticalPositionLimits["reference"];
};

export type VesselFeatureSessionOptions =
  Omit<CreateVesselLayerOptions, "pose" | "style"> & {
    scene: S100Scene;
    pose: VesselPose;
    style?: Partial<VesselStyle>;
    constraints?: {
      vertical?: VesselVerticalConstraint;
    };
    onPoseChanged?: (pose: VesselPose) => void;
    onPositionChanged?: (position: Coordinate) => void;
    onHeadingChanged?: (heading: number) => void;
  };

export class VesselFeatureSession {
  private readonly lifecycle = new FeatureLifecycleScope();
  private readonly positionListeners = new Set<(position: Coordinate) => void>();
  private readonly headingListeners = new Set<(heading: number) => void>();
  private readonly poseListeners = new Set<(pose: VesselPose) => void>();
  private readonly subscriptions: S100Unsubscribe[] = [];

  private constructor(
    private readonly scene: S100Scene,
    private readonly layer: VesselLayer,
    private readonly verticalConstraint: VesselVerticalConstraint | undefined,
  ) {
    this.subscriptions.push(
      this.layer.controllers.vessel.onPositionChanged((position) => {
        this.handlePositionChanged(position);
      }),
      this.layer.controllers.vessel.onHeadingChanged((heading) => {
        this.handleHeadingChanged(heading);
      }),
    );
    this.lifecycle.onDispose(async () => {
      for (const unsubscribe of this.subscriptions.splice(0)) {
        unsubscribe();
      }
      this.positionListeners.clear();
      this.headingListeners.clear();
      this.poseListeners.clear();
      await this.layer.remove();
    });
  }

  static async add(options: VesselFeatureSessionOptions): Promise<VesselFeatureSession> {
    const {
      scene,
      constraints,
      onPoseChanged,
      onPositionChanged,
      onHeadingChanged,
      pose: inputPose,
      style,
      ...layerOptions
    } = options;
    const pose = normalizePose(inputPose, scene, options.dimensions, constraints?.vertical);
    const layerStyle = withVerticalTransformLimits(
      style,
      options.dimensions,
      constraints?.vertical,
    );
    const layer = await scene.layers.add(
      createVessel({
        ...layerOptions,
        pose,
        ...(layerStyle !== undefined ? { style: layerStyle } : {}),
      }),
    );
    const session = new VesselFeatureSession(
      scene,
      layer,
      constraints?.vertical,
    );
    if (onPositionChanged) {
      session.onPositionChanged(onPositionChanged);
    }
    if (onHeadingChanged) {
      session.onHeadingChanged(onHeadingChanged);
    }
    if (onPoseChanged) {
      session.onPoseChanged(onPoseChanged);
    }
    return session;
  }

  get vesselLayer(): VesselLayer {
    return this.layer;
  }

  get dimensions(): VesselDimensions {
    return { ...this.layer.controllers.vessel.dimensions };
  }

  getPose(): VesselPose {
    return this.layer.controllers.vessel.getPose();
  }

  getPosition(): Coordinate {
    return this.layer.controllers.vessel.getPosition();
  }

  getHeading(): number {
    return normalizeDegrees(this.layer.controllers.vessel.getHeading());
  }

  async setPose(pose: VesselPose): Promise<void> {
    await this.layer.controllers.vessel.setPose(
      normalizePose(pose, this.scene, this.dimensions, this.verticalConstraint),
    );
  }

  async setPosition(position: Coordinate): Promise<void> {
    await this.layer.controllers.vessel.setPosition(
      clampVerticalPosition(position, this.scene, this.dimensions, this.verticalConstraint),
    );
  }

  async setHeading(heading: number): Promise<void> {
    await this.layer.controllers.vessel.setHeading(normalizeDegrees(heading));
  }

  async setDimensions(dimensions: VesselDimensions): Promise<void> {
    await this.layer.controllers.vessel.setDimensions(dimensions);
    if (this.verticalConstraint?.maxMeters === "draught") {
      const style = withVerticalTransformLimits(
        this.layer.spec.style,
        dimensions,
        this.verticalConstraint,
      );
      if (style !== undefined) {
        await this.layer.update({ style });
      }
      await this.setPosition(this.getPosition());
    }
  }

  async setVisible(visible: boolean): Promise<void> {
    await this.layer.controllers.vessel.setVisibility(visible);
  }

  async setSeaLevelIndicatorMode(mode: VesselSeaLevelIndicatorMode): Promise<void> {
    await this.layer.controllers.vessel.setSeaLevelIndicatorMode(mode);
  }

  async setOceanSurfaceVisible(visible: boolean): Promise<void> {
    await this.layer.controllers.vessel.setOceanSurfaceVisible(visible);
  }

  async setTransformMode(mode: VesselTransformControlMode): Promise<void> {
    await this.layer.controllers.vessel.setTransformMode(mode);
  }

  onPositionChanged(listener: (position: Coordinate) => void): S100Unsubscribe {
    this.positionListeners.add(listener);
    return () => {
      this.positionListeners.delete(listener);
    };
  }

  onHeadingChanged(listener: (heading: number) => void): S100Unsubscribe {
    this.headingListeners.add(listener);
    return () => {
      this.headingListeners.delete(listener);
    };
  }

  onPoseChanged(listener: (pose: VesselPose) => void): S100Unsubscribe {
    this.poseListeners.add(listener);
    return () => {
      this.poseListeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    await this.lifecycle.dispose();
  }

  private handlePositionChanged(position: Coordinate): void {
    const safePosition = clampVerticalPosition(
      position,
      this.scene,
      this.dimensions,
      this.verticalConstraint,
    );
    if (!sameVerticalPosition(position, safePosition)) {
      void this.layer.controllers.vessel.setPosition(safePosition);
    }
    for (const listener of [...this.positionListeners]) {
      listener(safePosition);
    }
    this.emitPoseChanged({
      ...this.getPose(),
      position: safePosition,
    });
  }

  private handleHeadingChanged(heading: number): void {
    const normalizedHeading = normalizeDegrees(heading);
    for (const listener of [...this.headingListeners]) {
      listener(normalizedHeading);
    }
    this.emitPoseChanged({
      ...this.getPose(),
      headingDegrees: normalizedHeading,
    });
  }

  private emitPoseChanged(pose: VesselPose): void {
    for (const listener of [...this.poseListeners]) {
      listener(pose);
    }
  }
}

function normalizePose(
  pose: VesselPose,
  scene: S100Scene,
  dimensions: VesselDimensions | undefined,
  verticalConstraint: VesselVerticalConstraint | undefined,
): VesselPose {
  return {
    ...pose,
    position: clampVerticalPosition(pose.position, scene, dimensions, verticalConstraint),
    ...(pose.headingDegrees !== undefined
      ? { headingDegrees: normalizeDegrees(pose.headingDegrees) }
      : {}),
  };
}

function clampVerticalPosition(
  position: Coordinate,
  scene: S100Scene,
  dimensions: VesselDimensions | undefined,
  verticalConstraint: VesselVerticalConstraint | undefined,
): Coordinate {
  if (!verticalConstraint) {
    return position;
  }

  const referenceOffset = verticalConstraint.reference === "sea-level"
    ? scene.getSeaLevel()
    : 0;
  const min = addReferenceOffset(verticalConstraint.minMeters, referenceOffset);
  const maxValue = verticalConstraint.maxMeters === "draught"
    ? dimensions?.draught
    : verticalConstraint.maxMeters;
  const max = addReferenceOffset(maxValue, referenceOffset);
  const current = Coordinates.getVerticalMeters(position);
  const next = clampOptional(current, min, max);
  return Object.is(current, next)
    ? position
    : Coordinates.withVerticalMeters(position, next);
}

function withVerticalTransformLimits(
  style: Partial<VesselStyle> | undefined,
  dimensions: VesselDimensions | undefined,
  verticalConstraint: VesselVerticalConstraint | undefined,
): Partial<VesselStyle> | undefined {
  if (!verticalConstraint) {
    return style;
  }

  const maxMeters = verticalConstraint.maxMeters === "draught"
    ? dimensions?.draught
    : verticalConstraint.maxMeters;
  const transformGizmo = typeof style?.transformGizmo === "object"
    ? style.transformGizmo
    : {};
  return {
    ...style,
    transformGizmo: {
      ...transformGizmo,
      enabled: transformGizmo.enabled ?? true,
      verticalPositionLimits: {
        ...(verticalConstraint.minMeters !== undefined
          ? { minMeters: verticalConstraint.minMeters }
          : {}),
        ...(maxMeters !== undefined ? { maxMeters } : {}),
        ...(verticalConstraint.reference !== undefined
          ? { reference: verticalConstraint.reference }
          : {}),
      },
    },
  };
}

function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return ((value % 360) + 360) % 360;
}

function addReferenceOffset(
  value: number | undefined,
  referenceOffset: number,
): number | undefined {
  return value !== undefined ? value + referenceOffset : undefined;
}

function clampOptional(
  value: number,
  min: number | undefined,
  max: number | undefined,
): number {
  let next = value;
  if (min !== undefined) {
    next = Math.max(next, min);
  }
  if (max !== undefined) {
    next = Math.min(next, max);
  }
  return next;
}

function sameVerticalPosition(left: Coordinate, right: Coordinate): boolean {
  return Object.is(Coordinates.getVerticalMeters(left), Coordinates.getVerticalMeters(right));
}
