import type {
  BaseLayerSpec,
  ColorValue,
  Coordinate,
  VesselLayerSpec,
  VesselDimensions,
  VesselOceanSurfaceStyle,
  VesselTransformControlMode,
  VesselTransformGizmoStyle,
} from "@ecc/s100-viewer";
import {
  createS100OceanSurfaceUniforms,
  getS100OceanSurfaceTimeSeconds,
  patchS100OceanSurfaceShader,
  S100_OCEAN_SURFACE_SHADER_CACHE_KEY,
  updateS100OceanSurfaceTime,
  type S100OceanSurfaceUniforms,
} from "@ecc/s100-viewer/internal/products/oceanSurfaceShader";
import {
  renderedEngineZFromVesselPose,
  vesselPoseZFromRenderedEngineZ,
} from "@ecc/s100-viewer/internal/products/vesselPose";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  TransformControls,
  type TransformControlsMode,
} from "three/examples/jsm/controls/TransformControls.js";
import {
  coordinateToWorld,
  worldToProjectedCoordinate,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";
import { disposeThreeObject } from "../shared/dispose.js";
import {
  setLayerUserData,
  setObjectOpacity,
  setObjectVisibility,
  type ThreeLayerNative,
} from "./types.js";

const DEFAULT_OCEAN_SURFACE_COLOR = 0x0d66a6;
const DEFAULT_OCEAN_SURFACE_OPACITY = 0.68;
const DEFAULT_OCEAN_SURFACE_ROUGHNESS = 0.096;
const DEFAULT_OCEAN_SURFACE_REFLECTIVITY = 0.4;
const DEFAULT_OCEAN_SURFACE_Z_OFFSET_METERS = 0.03;
const VESSEL_OCEAN_SURFACE_RADIUS_FACTOR = 0.56;
const DEFAULT_TRANSFORM_CONTROL_SIZE = 1.2;
const Z_UP = new THREE.Vector3(0, 0, 1);
const GLTF_Y_UP_TO_Z_UP_ORIENTATION = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI / 2,
);
type WaterLevelAtCoordinate = (coordinate: Coordinate) => number;

export const createVesselLayer = async (
  spec: BaseLayerSpec,
  scene: THREE.Scene,
  reference: ThreeProjectedLocalReference,
  getSeaLevel: () => number = () => 0,
  getWaterLevelAt: WaterLevelAtCoordinate = () => getSeaLevel(),
  camera?: THREE.Camera,
  domElement?: HTMLElement,
  setCameraInteractionSuppressed: (suppressed: boolean) => void = () => undefined,
): Promise<ThreeLayerNative<VesselLayerSpec>> => {
  const vesselSpec = spec as VesselLayerSpec;
  const group = new THREE.Group();
  group.name = `three-vessel-${spec.id}`;
  group.visible = spec.visible ?? true;
  const model = await createVesselObject(vesselSpec);
  const oceanSurface = new VesselOceanSurfaceView(
    vesselSpec,
    scene,
    reference,
    getSeaLevel,
    getWaterLevelAt,
  );
  let transformControls: VesselTransformControlsView | null = null;
  setLayerUserData(model, vesselSpec, "vector", vesselSpec.id);
  group.add(model);
  applyVesselPose(group, vesselSpec, reference, getWaterLevelAt);
  setObjectOpacity(group, spec.opacity ?? vesselSpec.style?.opacity ?? 1);
  oceanSurface.setLayerOpacity(spec.opacity ?? vesselSpec.style?.opacity ?? 1);
  oceanSurface.updateSpec(vesselSpec);
  scene.add(group);
  transformControls = camera && domElement
    ? new VesselTransformControlsView(
      vesselSpec,
      group,
      scene,
      camera,
      domElement,
      reference,
      getSeaLevel,
      getWaterLevelAt,
      () => oceanSurface.update(),
      setCameraInteractionSuppressed,
    )
    : null;
  transformControls?.updateSpec(vesselSpec);

  return {
    spec: vesselSpec,
    root: group,
    setVisible: (visible) => {
      vesselSpec.visible = visible;
      group.visible = visible;
      oceanSurface.updateSpec(vesselSpec);
      transformControls?.updateSpec(vesselSpec);
    },
    setOpacity: (opacity) => {
      setObjectOpacity(group, opacity);
      oceanSurface.setLayerOpacity(opacity);
    },
    getPickableObjects: () => [group],
    update: () => {
      applyVesselPose(group, vesselSpec, reference, getWaterLevelAt);
      oceanSurface.update();
    },
    patch: (patch) => {
      setObjectVisibility(group, patch.visible);
      const opacity = patch.opacity ?? patch.style?.opacity;
      setObjectOpacity(group, opacity);
      if (opacity !== undefined) {
        oceanSurface.setLayerOpacity(opacity);
      }
      applyVesselPose(group, vesselSpec, reference, getWaterLevelAt);
      oceanSurface.updateSpec(vesselSpec);
      transformControls?.updateSpec(vesselSpec);
    },
    dispose: () => {
      transformControls?.dispose();
      oceanSurface.dispose();
      scene.remove(group);
      disposeThreeObject(group);
    },
  };
};

const createVesselObject = async (
  spec: VesselLayerSpec,
): Promise<THREE.Object3D> => {
  if (spec.source.kind === "model") {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(spec.source.url);
      const model = gltf.scene;
      applyLoadedVesselModelBasis(model);
      applyModelOrientation(model, spec);
      return createLoadedVesselModelRoot(model, spec);
    } catch {
      return createFallbackVessel(spec);
    }
  }

  return createFallbackVessel(spec);
};

const applyLoadedVesselModelBasis = (model: THREE.Object3D): void => {
  model.quaternion.premultiply(GLTF_Y_UP_TO_Z_UP_ORIENTATION);
};

const createLoadedVesselModelRoot = (
  model: THREE.Object3D,
  spec: VesselLayerSpec,
): THREE.Object3D => {
  const bounds = getVesselModelBounds(spec, model);
  if (!bounds) {
    return model;
  }

  const dimensions = resolveDimensions(spec.dimensions);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
    return model;
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const centerOffset = getVesselCenterOffset(dimensions);
  const scaleX = normalizePositiveNumber(
    (dimensions.port + dimensions.starboard) / size.x,
    1,
  );
  const scaleY = normalizePositiveNumber(
    (dimensions.bow + dimensions.stern) / size.y,
    1,
  );
  const scaleZ = (scaleX + scaleY) / 2;
  const root = new THREE.Group();
  root.name = `three-vessel-model-normalization-${spec.id}`;
  root.scale.set(scaleX, scaleY, scaleZ);
  root.position.set(
    centerOffset.x - center.x * scaleX,
    centerOffset.y - center.y * scaleY,
    -bounds.min.z * scaleZ - dimensions.draught,
  );
  root.add(model);
  return root;
};

const createFallbackVessel = (spec: VesselLayerSpec): THREE.Object3D => {
  const dimensions = resolveDimensions(spec.dimensions);
  const width = dimensions.port + dimensions.starboard;
  const length = dimensions.bow + dimensions.stern;
  const height = Math.max(4, dimensions.draught * 1.35);
  const shape = new THREE.Shape();
  shape.moveTo(0, dimensions.bow);
  shape.lineTo(dimensions.starboard, dimensions.bow * 0.25);
  shape.lineTo(dimensions.starboard, -dimensions.stern);
  shape.lineTo(-dimensions.port, -dimensions.stern);
  shape.lineTo(-dimensions.port, dimensions.bow * 0.25);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(2, width * 0.08),
    bevelThickness: Math.min(2, height * 0.2),
  });
  geometry.translate(0, 0, -dimensions.draught);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd0d4d8,
    roughness: 0.72,
    metalness: 0.18,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const applyVesselPose = (
  group: THREE.Group,
  spec: VesselLayerSpec,
  reference: ThreeProjectedLocalReference,
  getWaterLevelAt: WaterLevelAtCoordinate,
): void => {
  const position = coordinateToWorld(spec.pose.position, reference);
  position.z = renderedEngineZFromVesselPose(
    position.z,
    getWaterLevelAt(spec.pose.position),
  );
  group.position.copy(position);
  const heading = spec.pose.headingDegrees ?? 0;
  const pitch = spec.pose.pitchDegrees ?? 0;
  const roll = spec.pose.rollDegrees ?? 0;
  group.rotation.set(
    THREE.MathUtils.degToRad(pitch),
    THREE.MathUtils.degToRad(roll),
    THREE.MathUtils.degToRad(-heading),
  );
};

class VesselTransformControlsView {
  private handles: VesselTransformControlHandle[] = [];
  private modesKey = "";
  private arbitrationCleanup: (() => void) | null = null;
  private disposed = false;
  private applyingPose = false;

  constructor(
    private readonly spec: VesselLayerSpec,
    private readonly group: THREE.Group,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly domElement: HTMLElement,
    private readonly reference: ThreeProjectedLocalReference,
    private readonly getSeaLevel: () => number,
    private readonly getWaterLevelAt: WaterLevelAtCoordinate,
    private readonly onChanged: () => void,
    private readonly setCameraInteractionSuppressed: (suppressed: boolean) => void,
  ) {}

  updateSpec(spec: VesselLayerSpec): void {
    Object.assign(this.spec, spec);
    const style = resolveTransformGizmoStyle(this.spec);
    const nextModesKey = style.modes.join("|");
    if (nextModesKey !== this.modesKey) {
      this.rebuildControls(style);
    }
    this.applyStyle(style);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.disposeControls();
  }

  private rebuildControls(style: ResolvedTransformGizmoStyle): void {
    this.disposeControls();
    this.modesKey = style.modes.join("|");
    for (const mode of style.modes) {
      const controls = new TransformControls(this.camera, this.domElement);
      controls.attach(this.group);
      controls.setMode(mode);
      controls.space = "world";
      controls.addEventListener("objectChange", this.handleObjectChange);
      controls.addEventListener("dragging-changed", this.handleDraggingChanged);
      const helper = controls.getHelper();
      helper.name = `three-vessel-transform-controls-${this.spec.id}-${mode}`;
      this.scene.add(helper);
      this.handles.push({
        controls,
        helper,
        mode,
      });
    }
    this.installControlArbitration();
  }

  private disposeControls(): void {
    this.arbitrationCleanup?.();
    this.arbitrationCleanup = null;
    this.setCameraInteractionSuppressed(false);
    for (const handle of this.handles) {
      handle.controls.removeEventListener("objectChange", this.handleObjectChange);
      handle.controls.removeEventListener("dragging-changed", this.handleDraggingChanged);
      handle.controls.detach();
      this.scene.remove(handle.helper);
      handle.controls.dispose();
    }
    this.handles = [];
    this.modesKey = "";
  }

  private applyStyle(style: ResolvedTransformGizmoStyle): void {
    const enabled = style.enabled && (this.spec.visible ?? true);
    if (!enabled) {
      this.setCameraInteractionSuppressed(false);
    }
    for (const handle of this.handles) {
      handle.controls.enabled = enabled;
      handle.controls.setMode(handle.mode);
      handle.controls.setSize(style.size);
      handle.helper.visible = enabled;
      applyTransformControlAxisVisibility(handle.controls, handle.mode);
    }
  }

  private readonly handleObjectChange = (): void => {
    if (this.disposed || this.applyingPose) {
      return;
    }
    this.applyingPose = true;
    try {
      this.applyTransformToSpec();
      this.onChanged();
    } finally {
      this.applyingPose = false;
    }
  };

  private readonly handleDraggingChanged = (event: { value?: unknown }): void => {
    this.setCameraInteractionSuppressed(event.value === true);
  };

  private installControlArbitration(): void {
    if (this.handles.length === 0 || this.arbitrationCleanup) {
      return;
    }

    let activeHandle: VesselTransformControlHandle | null = null;
    const restoreControls = () => {
      if (this.disposed) {
        return;
      }
      activeHandle = null;
      this.setCameraInteractionSuppressed(false);
      this.applyStyle(resolveTransformGizmoStyle(this.spec));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || this.disposed) {
        return;
      }
      const winner = chooseTransformControlHandle(
        this.handles,
        event,
        this.domElement,
      );
      if (!winner) {
        restoreControls();
        return;
      }

      activeHandle = winner;
      this.setCameraInteractionSuppressed(true);
      for (const handle of this.handles) {
        const enabled = handle === winner;
        handle.controls.enabled = enabled;
        handle.helper.visible = this.spec.visible ?? true;
        if (!enabled) {
          handle.controls.axis = null;
        }
      }
    };
    const onPointerEnd = () => {
      if (!activeHandle) {
        return;
      }
      setTimeout(restoreControls, 0);
    };

    this.domElement.addEventListener("pointerdown", onPointerDown, true);
    this.domElement.addEventListener("pointerup", onPointerEnd, true);
    this.domElement.addEventListener("pointercancel", onPointerEnd, true);
    this.arbitrationCleanup = () => {
      this.domElement.removeEventListener("pointerdown", onPointerDown, true);
      this.domElement.removeEventListener("pointerup", onPointerEnd, true);
      this.domElement.removeEventListener("pointercancel", onPointerEnd, true);
    };
  }

  private applyTransformToSpec(): void {
    const nextPosition = constrainVesselWorldPosition(
      this.group.position,
      this.spec,
      this.reference,
      this.getWaterLevelAt,
    );
    if (!nextPosition.equals(this.group.position)) {
      this.group.position.copy(nextPosition);
    }
    const renderedPosition = worldToProjectedCoordinate(nextPosition, this.reference);
    this.spec.pose.position = {
      ...renderedPosition,
      z: vesselPoseZFromRenderedEngineZ(
        renderedPosition.z ?? 0,
        this.getWaterLevelAt(renderedPosition),
      ),
    };
    this.spec.pose.headingDegrees = normalizeHeadingDegrees(
      -THREE.MathUtils.radToDeg(this.group.rotation.z),
    );
  }
}

type VesselTransformControlHandle = {
  mode: TransformControlsMode;
  controls: TransformControls;
  helper: THREE.Object3D;
};

type TransformControlsPrivateGizmo = {
  object?: THREE.Object3D;
  _gizmo?: {
    picker?: Partial<Record<TransformControlsMode, THREE.Object3D>>;
  };
};

type TransformControlPickHit = {
  handle: VesselTransformControlHandle;
  distance: number;
  priority: number;
};

type ResolvedTransformGizmoStyle = {
  enabled: boolean;
  modes: TransformControlsMode[];
  size: number;
};

const resolveTransformGizmoStyle = (
  spec: VesselLayerSpec,
): ResolvedTransformGizmoStyle => {
  const style = getTransformGizmoObject(spec.style?.transformGizmo);
  const configuredMode =
    style?.mode ??
    spec.style?.transformControls ??
    (spec.style?.transformGizmo === true ? "translate-rotate" : "none");
  const modes = resolveTransformControlsModes(configuredMode);
  const transformGizmo = spec.style?.transformGizmo;
  const enabled = typeof transformGizmo === "object"
    ? transformGizmo.enabled !== false
    : Boolean(transformGizmo);
  return {
    enabled: enabled && modes.length > 0,
    modes,
    size: normalizeTransformControlSize(style?.sizeMeters),
  };
};

const resolveTransformControlsModes = (
  mode: VesselTransformControlMode | undefined,
): TransformControlsMode[] => {
  if (mode === "rotate") {
    return ["rotate"];
  }
  if (mode === "translate") {
    return ["translate"];
  }
  if (mode === "translate-rotate") {
    return ["translate", "rotate"];
  }
  return [];
};

const applyTransformControlAxisVisibility = (
  controls: TransformControls,
  mode: TransformControlsMode,
): void => {
  controls.showX = mode === "translate";
  controls.showY = mode === "translate";
  controls.showZ = true;
};

const chooseTransformControlHandle = (
  handles: readonly VesselTransformControlHandle[],
  event: Pick<MouseEvent, "clientX" | "clientY">,
  domElement: HTMLElement,
): VesselTransformControlHandle | null => {
  const pointer = getDomElementPointer(event, domElement);
  const hits: TransformControlPickHit[] = [];
  for (const handle of handles) {
    const hit = getTransformControlPickHit(handle, pointer);
    if (hit) {
      hits.push(hit);
    }
  }

  hits.sort((a, b) => {
    const distanceDelta = a.distance - b.distance;
    if (Math.abs(distanceDelta) > 1e-5) {
      return distanceDelta;
    }
    return b.priority - a.priority;
  });
  return hits[0]?.handle ?? null;
};

const getTransformControlPickHit = (
  handle: VesselTransformControlHandle,
  pointer: THREE.Vector2,
): TransformControlPickHit | null => {
  const picker = getTransformControlPicker(handle.controls, handle.mode);
  if (
    !picker ||
    !handle.helper.visible ||
    !handle.controls.enabled ||
    !(handle.controls as unknown as TransformControlsPrivateGizmo).object
  ) {
    return null;
  }

  handle.controls.camera.updateMatrixWorld();
  handle.helper.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, handle.controls.camera);
  const intersection = raycaster
    .intersectObject(picker, true)
    .find((hit) => hit.object.visible);
  if (!intersection) {
    return null;
  }

  return {
    handle,
    distance: intersection.distance,
    priority: handle.mode === "rotate" ? 30 : 20,
  };
};

const getTransformControlPicker = (
  controls: TransformControls,
  mode: TransformControlsMode,
): THREE.Object3D | null =>
  ((controls as unknown as TransformControlsPrivateGizmo)._gizmo?.picker?.[
    mode
  ] as THREE.Object3D | undefined) ?? null;

const getDomElementPointer = (
  event: Pick<MouseEvent, "clientX" | "clientY">,
  domElement: HTMLElement,
): THREE.Vector2 => {
  const rect = domElement.getBoundingClientRect();
  const width = rect.width || domElement.clientWidth || 1;
  const height = rect.height || domElement.clientHeight || 1;
  return new THREE.Vector2(
    ((event.clientX - rect.left) / width) * 2 - 1,
    -((event.clientY - rect.top) / height) * 2 + 1,
  );
};

const getTransformGizmoObject = (
  style: VesselTransformGizmoStyle | undefined,
): Exclude<VesselTransformGizmoStyle, boolean> | null =>
  typeof style === "object" && style !== null ? style : null;

const getVesselModelBounds = (
  spec: VesselLayerSpec,
  model: THREE.Object3D,
): THREE.Box3 | null => {
  const configuredBounds = spec.model?.boundingBox;
  if (configuredBounds) {
    const min = configuredBounds.min;
    const max = configuredBounds.max;
    if ([...min, ...max].every(Number.isFinite)) {
      return new THREE.Box3(
        new THREE.Vector3(min[0], min[1], min[2]),
        new THREE.Vector3(max[0], max[1], max[2]),
      );
    }
  }

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  return bounds.isEmpty() ? null : bounds;
};

const normalizeTransformControlSize = (
  sizeMeters: number | undefined,
): number => {
  if (typeof sizeMeters !== "number" || !Number.isFinite(sizeMeters)) {
    return DEFAULT_TRANSFORM_CONTROL_SIZE;
  }
  return Math.max(0.4, Math.min(3, sizeMeters / 45));
};

const constrainVesselWorldPosition = (
  worldPosition: THREE.Vector3,
  spec: VesselLayerSpec,
  reference: ThreeProjectedLocalReference,
  getWaterLevelAt: WaterLevelAtCoordinate,
): THREE.Vector3 => {
  const limits = getTransformGizmoObject(spec.style?.transformGizmo)
    ?.verticalPositionLimits;
  const projected = worldToProjectedCoordinate(worldPosition, reference);
  const currentZ = projected.z ?? 0;
  const waterLevel = getWaterLevelAt(projected);
  const poseZ = vesselPoseZFromRenderedEngineZ(currentZ, waterLevel);
  const nextPoseZ = constrainVerticalMeters(poseZ, limits, waterLevel);
  const nextZ = renderedEngineZFromVesselPose(nextPoseZ, waterLevel);
  return nextZ === projected.z
    ? worldPosition.clone()
    : coordinateToWorld({ ...projected, z: nextZ }, reference);
};

const constrainVerticalMeters = (
  current: number,
  limits: NonNullable<Exclude<VesselTransformGizmoStyle, boolean>["verticalPositionLimits"]> | undefined,
  seaLevel: number,
): number => {
  if (!limits) {
    return current;
  }
  const offset = limits.reference === "sea-level" ? normalizeFiniteNumber(seaLevel, 0) : 0;
  const min = limits.minMeters !== undefined ? limits.minMeters + offset : -Infinity;
  const max = limits.maxMeters !== undefined ? limits.maxMeters + offset : Infinity;
  return Math.max(Math.min(min, max), Math.min(Math.max(min, max), current));
};

const normalizeHeadingDegrees = (value: number): number =>
  ((value % 360) + 360) % 360;

class VesselOceanSurfaceView {
  private mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshPhysicalMaterial> | null = null;
  private uniforms: S100OceanSurfaceUniforms | null = null;
  private animationStartSeconds = getS100OceanSurfaceTimeSeconds();
  private layerOpacity = 1;
  private resolvedStyle: ResolvedOceanSurfaceStyle | null = null;

  constructor(
    private spec: VesselLayerSpec,
    private readonly scene: THREE.Scene,
    private readonly reference: ThreeProjectedLocalReference,
    private readonly getSeaLevel: () => number,
    private readonly getWaterLevelAt: WaterLevelAtCoordinate,
  ) {}

  updateSpec(spec: VesselLayerSpec): void {
    this.spec = spec;
    const nextStyle = resolveOceanSurfaceStyle(spec);
    const previousStyle = this.resolvedStyle;
    this.resolvedStyle = nextStyle;
    if (!previousStyle || radiusChanged(previousStyle, nextStyle)) {
      this.rebuild(nextStyle);
    } else {
      this.applyMaterialStyle(nextStyle);
    }
    this.update();
  }

  setLayerOpacity(opacity: number): void {
    this.layerOpacity = clamp01(opacity);
    this.applyOpacity();
  }

  update(): void {
    const mesh = this.mesh;
    const style = this.resolvedStyle;
    if (!mesh || !style) {
      return;
    }

    if (this.uniforms) {
      updateS100OceanSurfaceTime(this.uniforms, this.animationStartSeconds);
    }
    const vesselPosition = coordinateToWorld(this.spec.pose.position, this.reference);
    const centerOffset = getVesselCenterOffset(resolveDimensions(this.spec.dimensions));
    centerOffset.applyAxisAngle(
      Z_UP,
      THREE.MathUtils.degToRad(-(this.spec.pose.headingDegrees ?? 0)),
    );
    mesh.position.set(
      vesselPosition.x + centerOffset.x,
      vesselPosition.y + centerOffset.y,
      normalizeFiniteNumber(
        this.getWaterLevelAt(this.spec.pose.position),
        this.getSeaLevel(),
      ) + DEFAULT_OCEAN_SURFACE_Z_OFFSET_METERS,
    );
    mesh.quaternion.identity();
    mesh.visible = style.enabled && (this.spec.visible ?? true);
  }

  dispose(): void {
    if (!this.mesh) {
      return;
    }
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
    this.uniforms = null;
  }

  private rebuild(style: ResolvedOceanSurfaceStyle): void {
    this.dispose();
    this.uniforms = createS100OceanSurfaceUniforms();
    this.animationStartSeconds = getS100OceanSurfaceTimeSeconds();
    const material = createOceanSurfaceMaterial(style, this.uniforms);
    const geometry = new THREE.CircleGeometry(style.radiusMeters, 128);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `three-vessel-ocean-surface-${this.spec.id}`;
    this.mesh.renderOrder = 1315;
    this.mesh.frustumCulled = false;
    this.mesh.userData.s100Unpickable = true;
    this.scene.add(this.mesh);
    this.applyOpacity();
  }

  private applyMaterialStyle(style: ResolvedOceanSurfaceStyle): void {
    if (!this.mesh) {
      return;
    }
    this.mesh.material.color.copy(colorToThree(style.color, DEFAULT_OCEAN_SURFACE_COLOR));
    this.mesh.material.roughness = style.roughness;
    this.mesh.material.reflectivity = style.reflectivity;
    this.applyOpacity();
    this.mesh.material.needsUpdate = true;
  }

  private applyOpacity(): void {
    if (!this.mesh || !this.resolvedStyle) {
      return;
    }
    const opacity = this.resolvedStyle.opacity * this.layerOpacity;
    this.mesh.material.opacity = opacity;
    this.mesh.material.transparent = opacity < 1;
  }
}

type ResolvedOceanSurfaceStyle = {
  enabled: boolean;
  radiusMeters: number;
  color: ColorValue | undefined;
  opacity: number;
  roughness: number;
  reflectivity: number;
};

type OceanSurfaceMaterial = THREE.MeshPhysicalMaterial & {
  userData: THREE.MeshPhysicalMaterial["userData"] & {
    s100WaterUniforms?: S100OceanSurfaceUniforms;
  };
};

const createOceanSurfaceMaterial = (
  style: ResolvedOceanSurfaceStyle,
  uniforms: S100OceanSurfaceUniforms,
): THREE.MeshPhysicalMaterial => {
  const material = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.08,
    clearcoatRoughness: 0.26,
    color: colorToThree(style.color, DEFAULT_OCEAN_SURFACE_COLOR),
    depthWrite: false,
    ior: 1.333,
    metalness: 0,
    opacity: style.opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    reflectivity: style.reflectivity,
    roughness: style.roughness,
    side: THREE.DoubleSide,
    transparent: style.opacity < 1,
  }) as OceanSurfaceMaterial;
  material.userData.s100WaterUniforms = uniforms;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    patchS100OceanSurfaceShader(shader, uniforms);
  };
  material.customProgramCacheKey = (): string =>
    `${previousProgramCacheKey()}|${S100_OCEAN_SURFACE_SHADER_CACHE_KEY}`;
  return material;
};

const resolveOceanSurfaceStyle = (
  spec: VesselLayerSpec,
): ResolvedOceanSurfaceStyle => {
  const dimensions = resolveDimensions(spec.dimensions);
  const style = getOceanSurfaceObject(spec.style?.oceanSurface);
  return {
    enabled: getOceanSurfaceEnabled(spec),
    radiusMeters: Math.max(
      1,
      normalizeFiniteNumber(
        style?.radiusMeters,
        getVesselOceanSurfaceRadius(dimensions),
      ),
    ),
    color: style?.color,
    opacity: clamp01(style?.opacity ?? DEFAULT_OCEAN_SURFACE_OPACITY),
    roughness: clamp01(style?.roughness ?? DEFAULT_OCEAN_SURFACE_ROUGHNESS),
    reflectivity: clamp01(style?.reflectivity ?? DEFAULT_OCEAN_SURFACE_REFLECTIVITY),
  };
};

const getOceanSurfaceEnabled = (spec: VesselLayerSpec): boolean => {
  if (typeof spec.rendering?.oceanSurfaceVisible === "boolean") {
    return spec.rendering.oceanSurfaceVisible;
  }
  if (typeof spec.style?.oceanSurface === "boolean") {
    return spec.style.oceanSurface;
  }
  if (typeof spec.style?.oceanSurface === "object") {
    return spec.style.oceanSurface.enabled ?? false;
  }
  return spec.style?.showOceanSurface ?? false;
};

const getOceanSurfaceObject = (
  style: VesselOceanSurfaceStyle | undefined,
): Exclude<VesselOceanSurfaceStyle, boolean> | null =>
  typeof style === "object" && style !== null ? style : null;

const getVesselCenterOffset = (
  dimensions: VesselDimensions,
): THREE.Vector3 =>
  new THREE.Vector3(
    (dimensions.starboard - dimensions.port) / 2,
    (dimensions.bow - dimensions.stern) / 2,
    0,
  );

const getVesselOceanSurfaceRadius = (
  dimensions: VesselDimensions,
): number =>
  Math.max(
    dimensions.bow + dimensions.stern,
    dimensions.port + dimensions.starboard,
  ) * VESSEL_OCEAN_SURFACE_RADIUS_FACTOR * 0.965;

const radiusChanged = (
  current: ResolvedOceanSurfaceStyle,
  next: ResolvedOceanSurfaceStyle,
): boolean => Math.abs(current.radiusMeters - next.radiusMeters) > 1e-6;

const colorToThree = (
  color: ColorValue | undefined,
  fallback: THREE.ColorRepresentation,
): THREE.Color => {
  if (typeof color === "string") {
    return new THREE.Color(color);
  }
  if (color && typeof color === "object") {
    return new THREE.Color(
      normalizeColorChannel(color.r),
      normalizeColorChannel(color.g),
      normalizeColorChannel(color.b),
    );
  }
  return new THREE.Color(fallback);
};

const normalizeColorChannel = (value: number): number =>
  value > 1 ? clamp01(value / 255) : clamp01(value);

const normalizeFiniteNumber = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizePositiveNumber = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));

const applyModelOrientation = (
  model: THREE.Object3D,
  spec: VesselLayerSpec,
): void => {
  const orientation = spec.model?.orientation;
  if (orientation) {
    model.quaternion.multiply(
      new THREE.Quaternion(
        orientation[0],
        orientation[1],
        orientation[2],
        orientation[3],
      ),
    );
  }
};

const resolveDimensions = (
  dimensions: VesselDimensions | undefined,
): VesselDimensions => ({
  draught: dimensions?.draught ?? 8,
  bow: dimensions?.bow ?? 35,
  stern: dimensions?.stern ?? 15,
  port: dimensions?.port ?? 8,
  starboard: dimensions?.starboard ?? 8,
});
