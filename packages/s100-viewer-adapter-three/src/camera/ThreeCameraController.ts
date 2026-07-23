import {
  normalizeCameraControlConfig,
  type CameraControlConfig,
  type CameraLookAt,
  type EngineCameraPose,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import {
  coordinateToWorld,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";

type CameraControlMode = "orbit" | "pan";

export class ThreeCameraController {
  private static readonly MIN_DISTANCE = 1;
  private static readonly MAX_DISTANCE = 1_000_000;
  private static readonly ROTATE_SPEED = 0.005;
  private static readonly WHEEL_INTERACTION_IDLE_MS = 140;
  private static readonly WORLD_UP = new THREE.Vector3(0, 0, 1);

  private config: CameraControlConfig = normalizeCameraControlConfig(undefined);
  private readonly target = new THREE.Vector3();
  private activePointerId: number | null = null;
  private wheelInteractionTimeout: ReturnType<typeof setTimeout> | null = null;
  private mode: CameraControlMode = "orbit";
  private lastClientX = 0;
  private lastClientY = 0;
  private focalDistance = 100;
  private panAnchor: THREE.Vector3 | null = null;
  private interactionSuppressed = false;
  private destroyed = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly reference: ThreeProjectedLocalReference,
    private readonly getSeaLevel: () => number,
    private readonly onPoseChange: (pose: EngineCameraPose) => void,
  ) {
    this.camera.up.copy(ThreeCameraController.WORLD_UP);
    this.camera.lookAt(this.target);
    this.focalDistance = Math.max(
      ThreeCameraController.MIN_DISTANCE,
      this.camera.position.distanceTo(this.target),
    );
    this.target.copy(this.computeTargetFromCamera(this.focalDistance));
    this.bind();
    this.emitPose();
  }

  setPose(pose: EngineCameraPose): void {
    this.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.camera.quaternion.set(
      pose.rotation.x,
      pose.rotation.y,
      pose.rotation.z,
      pose.rotation.w,
    );
    this.focalDistance = Math.max(
      ThreeCameraController.MIN_DISTANCE,
      pose.focalDistance ?? this.focalDistance,
    );
    this.target.copy(this.computeTargetFromCamera(this.focalDistance));
    this.emitPose();
  }

  getPose(): EngineCameraPose {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      rotation: {
        x: this.camera.quaternion.x,
        y: this.camera.quaternion.y,
        z: this.camera.quaternion.z,
        w: this.camera.quaternion.w,
      },
      focalDistance: this.camera.position.distanceTo(this.target),
    };
  }

  lookAt(view: CameraLookAt): void {
    this.target.copy(coordinateToWorld(view.target, this.reference));
    const heading = THREE.MathUtils.degToRad(view.headingDegrees ?? 0);
    const pitch = THREE.MathUtils.degToRad(view.pitchDegrees ?? 45);
    const range = Math.max(1, view.rangeMeters);
    const horizontal = Math.cos(pitch) * range;
    const position = new THREE.Vector3(
      this.target.x + Math.sin(heading) * horizontal,
      this.target.y - Math.cos(heading) * horizontal,
      this.target.z + Math.sin(pitch) * range,
    );
    this.camera.position.copy(position);
    this.camera.lookAt(this.target);
    this.focalDistance = range;
    this.emitPose();
  }

  setControls(config: CameraControlConfig): void {
    this.config = normalizeCameraControlConfig(config);
  }

  setInteractionSuppressed(suppressed: boolean): void {
    this.interactionSuppressed = suppressed;
    if (suppressed) {
      this.activePointerId = null;
      this.panAnchor = null;
    }
  }

  update(): void {
    // Placeholder for future damping and keyboard support.
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    if (this.wheelInteractionTimeout) {
      clearTimeout(this.wheelInteractionTimeout);
      this.wheelInteractionTimeout = null;
    }
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.domElement.removeEventListener("pointercancel", this.onPointerUp);
    this.domElement.removeEventListener("wheel", this.onWheel);
    this.domElement.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private bind(): void {
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.preventContextMenu = this.preventContextMenu.bind(this);

    this.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.domElement.addEventListener("pointermove", this.onPointerMove);
    this.domElement.addEventListener("pointerup", this.onPointerUp);
    this.domElement.addEventListener("pointercancel", this.onPointerUp);
    this.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    this.domElement.addEventListener("contextmenu", this.preventContextMenu);
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.config.enabled === false || this.interactionSuppressed || this.destroyed) {
      return;
    }
    this.activePointerId = event.pointerId;
    this.mode =
      event.button === 1 || event.button === 2 || event.shiftKey
        ? "pan"
        : "orbit";
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    this.panAnchor =
      this.mode === "pan"
        ? this.getViewPlanePoint(event.clientX, event.clientY)
        : null;
    this.domElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.interactionSuppressed) {
      this.activePointerId = null;
      this.panAnchor = null;
      return;
    }

    if (this.activePointerId !== event.pointerId) {
      return;
    }

    if (this.config.enabled === false || this.destroyed) {
      this.activePointerId = null;
      this.panAnchor = null;
      return;
    }

    const deltaX = event.clientX - this.lastClientX;
    const deltaY = event.clientY - this.lastClientY;
    this.lastClientX = event.clientX;
    this.lastClientY = event.clientY;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    if (this.mode === "pan") {
      this.pan(event.clientX, event.clientY, deltaX, deltaY);
    } else {
      this.orbit(deltaX, deltaY);
    }
    event.preventDefault();
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.activePointerId = null;
    this.panAnchor = null;
    this.domElement.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  private onWheel(event: WheelEvent): void {
    if (
      this.config.enabled === false ||
      this.config.wheel === false ||
      this.interactionSuppressed ||
      this.destroyed
    ) {
      return;
    }
    event.preventDefault();

    this.beginWheelInteraction();
    const zoomTarget = this.getCenterSeaPlanePoint();
    if (zoomTarget) {
      this.target.copy(zoomTarget);
      this.focalDistance = THREE.MathUtils.clamp(
        this.camera.position.distanceTo(this.target),
        this.minDistance(),
        this.maxDistance(),
      );
    }

    const zoomSpeed = this.config.speeds?.zoom ?? 1;
    const zoomFactor = Math.exp(event.deltaY * 0.001 * zoomSpeed);
    const nextDistance = THREE.MathUtils.clamp(
      this.focalDistance * zoomFactor,
      this.minDistance(),
      this.maxDistance(),
    );
    const viewDirection = this.target
      .clone()
      .sub(this.camera.position)
      .normalize();
    if (viewDirection.lengthSq() === 0) {
      return;
    }

    this.focalDistance = nextDistance;
    this.camera.position.copy(
      this.target.clone().addScaledVector(viewDirection, -this.focalDistance),
    );
    this.camera.lookAt(this.target);
    this.emitPose();
  }

  private preventContextMenu(event: Event): void {
    event.preventDefault();
  }

  private beginWheelInteraction(): void {
    if (this.wheelInteractionTimeout) {
      clearTimeout(this.wheelInteractionTimeout);
    }
    this.wheelInteractionTimeout = setTimeout(() => {
      this.wheelInteractionTimeout = null;
    }, ThreeCameraController.WHEEL_INTERACTION_IDLE_MS);
  }

  private orbit(deltaX: number, deltaY: number): void {
    const offset = this.camera.position.clone().sub(this.target);
    const radius = THREE.MathUtils.clamp(
      offset.length(),
      this.minDistance(),
      this.maxDistance(),
    );
    const horizontalDistance = Math.hypot(offset.x, offset.y);
    const rotateSpeed =
      ThreeCameraController.ROTATE_SPEED * (this.config.speeds?.orbit ?? 1);
    const azimuth = Math.atan2(offset.y, offset.x) - deltaX * rotateSpeed;
    const polar = THREE.MathUtils.clamp(
      Math.atan2(horizontalDistance, offset.z) - deltaY * rotateSpeed,
      this.minPolarAngle(),
      this.maxPolarAngle(),
    );

    const sinPolar = Math.sin(polar);
    offset.set(
      radius * sinPolar * Math.cos(azimuth),
      radius * sinPolar * Math.sin(azimuth),
      radius * Math.cos(polar),
    );

    this.focalDistance = radius;
    this.camera.position.copy(this.target).add(offset);
    this.camera.up.copy(ThreeCameraController.WORLD_UP);
    this.camera.lookAt(this.target);
    this.emitPose();
  }

  private pan(
    clientX: number,
    clientY: number,
    deltaX: number,
    deltaY: number,
  ): void {
    const planePoint = this.getViewPlanePoint(clientX, clientY);
    if (planePoint && this.panAnchor) {
      const panOffset = this.panAnchor.clone().sub(planePoint);
      this.target.add(panOffset);
      this.camera.position.add(panOffset);
      this.emitPose();
      return;
    }

    this.panByScreenDelta(deltaX, deltaY);
  }

  private panByScreenDelta(deltaX: number, deltaY: number): void {
    const worldPerPixel = this.getWorldUnitsPerPixel();
    const panSpeed = this.config.speeds?.pan ?? 1;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    if (right.lengthSq() === 0) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    if (up.lengthSq() === 0) {
      up.crossVectors(ThreeCameraController.WORLD_UP, right).normalize();
    } else {
      up.normalize();
    }

    const panOffset = right
      .multiplyScalar(-deltaX * worldPerPixel * panSpeed)
      .add(up.multiplyScalar(deltaY * worldPerPixel * panSpeed));
    this.target.add(panOffset);
    this.camera.position.add(panOffset);
    this.emitPose();
  }

  private getViewPlanePoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const ray = this.getPointerRay(clientX, clientY);
    if (!ray) {
      return null;
    }

    const planeNormal = this.camera.position.clone().sub(this.target);
    if (planeNormal.lengthSq() === 0) {
      this.camera.getWorldDirection(planeNormal);
    }
    planeNormal.normalize();
    const denominator = ray.direction.dot(planeNormal);
    if (Math.abs(denominator) < 1e-6) {
      return null;
    }

    const distanceToPlane = this.target
      .clone()
      .sub(ray.origin)
      .dot(planeNormal) / denominator;
    if (!Number.isFinite(distanceToPlane)) {
      return null;
    }

    return ray.origin.clone().addScaledVector(ray.direction, distanceToPlane);
  }

  private getCenterSeaPlanePoint(): THREE.Vector3 | null {
    const rect = this.domElement.getBoundingClientRect();
    const width = rect.width || this.domElement.clientWidth;
    const height = rect.height || this.domElement.clientHeight;
    if (!width || !height) {
      return null;
    }

    return this.getSeaPlanePoint(rect.left + width / 2, rect.top + height / 2);
  }

  private getSeaPlanePoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const ray = this.getPointerRay(clientX, clientY);
    if (!ray) {
      return null;
    }

    const denominator = ray.direction.dot(ThreeCameraController.WORLD_UP);
    if (Math.abs(denominator) < 1e-6) {
      return null;
    }

    const distanceToPlane = (this.getSeaLevel() - ray.origin.z) / denominator;
    if (!Number.isFinite(distanceToPlane) || distanceToPlane <= 0) {
      return null;
    }

    return ray.origin.clone().addScaledVector(ray.direction, distanceToPlane);
  }

  private getPointerRay(
    clientX: number,
    clientY: number,
  ): { origin: THREE.Vector3; direction: THREE.Vector3 } | null {
    const rect = this.domElement.getBoundingClientRect();
    const width = rect.width || this.domElement.clientWidth;
    const height = rect.height || this.domElement.clientHeight;
    if (!width || !height) {
      return null;
    }

    const ndcX = ((clientX - rect.left) / width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / height) * 2 - 1);
    const rayPoint = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.camera);
    return {
      origin: this.camera.position.clone(),
      direction: rayPoint.sub(this.camera.position).normalize(),
    };
  }

  private getWorldUnitsPerPixel(): number {
    const height = Math.max(
      1,
      this.domElement.getBoundingClientRect().height ||
        this.domElement.clientHeight,
    );
    const verticalFovRadians = THREE.MathUtils.degToRad(this.camera.fov);
    return (
      (2 * this.focalDistance * Math.tan(verticalFovRadians / 2)) / height
    );
  }

  private computeTargetFromCamera(distance: number): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      this.camera.quaternion,
    );
    if (forward.lengthSq() === 0) {
      forward.set(0, -1, 0);
    }
    return this.camera.position.clone().addScaledVector(
      forward.normalize(),
      distance,
    );
  }

  private minDistance(): number {
    return this.config.constraints?.minDistanceMeters ??
      ThreeCameraController.MIN_DISTANCE;
  }

  private maxDistance(): number {
    return this.config.constraints?.maxDistanceMeters ??
      ThreeCameraController.MAX_DISTANCE;
  }

  private minPolarAngle(): number {
    return THREE.MathUtils.degToRad(
      this.config.constraints?.minPitchDegrees ?? 0.5,
    );
  }

  private maxPolarAngle(): number {
    return THREE.MathUtils.degToRad(
      this.config.constraints?.maxPitchDegrees ?? 179.5,
    );
  }

  private emitPose(): void {
    this.onPoseChange(this.getPose());
  }
}
