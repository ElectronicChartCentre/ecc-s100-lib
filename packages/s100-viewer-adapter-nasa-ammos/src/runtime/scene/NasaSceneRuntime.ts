/// <reference path="../types/3d-tiles-renderer-private.d.ts" />

import { TilesRenderer } from "3d-tiles-renderer";
import type { Tile } from "3d-tiles-renderer/core";
import { ImplicitTilingPlugin } from "3d-tiles-renderer/core/plugins";
import { SUBTREELoader } from "3d-tiles-renderer/src/core/plugins/SUBTREELoader.js";
import { UnloadTilesPlugin } from "3d-tiles-renderer/three/plugins";
import {
  BackSide,
  Box3,
  BufferGeometry,
  CircleGeometry,
  DirectionalLight,
  DoubleSide,
  type Euler,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Quaternion,
  Raycaster,
  RingGeometry,
  Vector3,
  Vector2,
  type Camera,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { EventEmitter, type Subscription } from "../core/EventEmitter.js";
import type { S100Scene as CoreS100Scene } from "../core/S100Scene.js";
import type {
  FrameSubscription,
  S100NasaLogSettings,
  S100NasaViewerConfig,
  S100RenderContext,
} from "../core/types.js";
import { S100NasaLogLevel } from "../core/types.js";
import type {
  S100TerrainVesselShadowStamp,
  S100TerrainWaterLevelGridUniformState,
} from "@ecc/s100-viewer/internal/products/s102TerrainShading";
import {
  TerrainDisplayPropertyAdapter,
  TerrainMaterialController,
} from "../terrain/terrainShading.js";
import {
  FlatMapOverlay,
  type MapOverlayExtents,
} from "../map/FlatMapOverlay.js";
import {
  getSurfaceCurrentRecordCount,
  parseSurfaceCurrentTime,
  SeaCurrentsOverlay,
} from "../s111/SeaCurrentsOverlay.js";
import {
  constrainVesselPoseZ,
  normalizeVesselVerticalPositionLimits,
  renderedEngineZFromVesselPose,
  vesselPoseZFromRenderedEngineZ,
} from "@ecc/s100-viewer/internal/products/vesselPose";
import {
  createS100OceanSurfaceUniforms,
  getS100OceanSurfaceTimeSeconds,
  patchS100OceanSurfaceShader,
  S100_OCEAN_SURFACE_SHADER_CACHE_KEY,
  updateS100OceanSurfaceTime,
  type S100OceanSurfaceUniforms,
} from "@ecc/s100-viewer/internal/products/oceanSurfaceShader";

export { EventEmitter };
export type { Subscription };

export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number];
export type TransformControlsMode = "translate" | "rotate" | "scale";

export type CameraPose = {
  position: Vec3Tuple;
  rotation: QuatTuple;
  focalDistance?: number;
};

export type CameraUpdate = CameraPose;

export type PrismVec2Tuple = [number, number];

export type PrismCorners2D = {
  topLeft: PrismVec2Tuple;
  topRight: PrismVec2Tuple;
  bottomLeft: PrismVec2Tuple;
  bottomRight: PrismVec2Tuple;
};

export type RGBA = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type ViewerConfig = S100NasaViewerConfig & {
  logSettings?: LogSettings;
};

export type LogSettings = S100NasaLogSettings;
export { S100NasaLogLevel as LogLevel };

export class ConsoleLogger {
  debug(...args: unknown[]): void {
    console.debug(...args);
  }

  info(...args: unknown[]): void {
    console.info(...args);
  }

  warn(...args: unknown[]): void {
    console.warn(...args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }
}

export enum DataFormat {
  Grid = 2,
  Grid_UngeoRectified = 3,
}

export enum MapLayerType {
  Base = 0,
  MaskLayer = 1,
  BaseTransparent = 2,
}

export enum MapDiscardMode {
  BaseMapAlpha = 0,
  None = 1,
  Transparent = 1,
  MaskLayerAlphaZero = 2,
  MaskLayerAlphaOne = 3,
}

export enum SeaLevelIndicatorMode {
  Off = 0,
  Circle = 1,
}

export type TerrainDataset = {
  baseURL: string;
  additionalURLParameters: string;
  accessToken?: string;
  detailFactor: number;
  originOffset?: Vec3Tuple;
};

export type TerrainSettings = {
  rootPosition?: Vec3Tuple;
  renderBBoxes: boolean;
  detailFactor: number;
  neverDiscardRootNodes: boolean;
  waitForSiblings: boolean;
};

export type TerrainDisplayProperties = {
  safetyDepthMeters: number;
  unsafeDepth: number;
  heightSign: number;
  seaContour: boolean;
  seaLevel: number;
  showContour: boolean;
  contourInterval: number;
};

export type MapSpecification = {
  id: string;
  type: MapLayerType;
  corners: {
    upperLeft: [number, number];
    upperRight: [number, number];
    lowerLeft: [number, number];
    lowerRight: [number, number];
  };
  dataset: {
    mapSubset: {
      min: [number, number];
      max: [number, number];
    };
    extents: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
    minLevel: number;
    maxLevel: number;
  };
  originOffset?: Vec3Tuple;
  quality?: number;
  alphaMode?: "source" | "binary";
  alphaCutoff?: number;
  urlTemplate: string;
};

export type VesselDimensions = {
  draught: number;
  bow: number;
  stern: number;
  port: number;
  starboard: number;
};

export type ModelAssetSpecification = {
  path: string;
  name: string;
  object?: () => Object3D;
  orientation?: unknown;
  boundingBox?: unknown;
};

export type VesselSpecification = {
  model: ModelAssetSpecification;
  dimensions: VesselDimensions;
  verticalPositionLimits?: VesselVerticalPositionLimits;
  shadow?: boolean | VesselShadowSpecification;
};

export type CustomModelScale = number | Vec3Tuple;

export type CustomModelTransformPositionConstraint = (
  position: Vec3Tuple,
) => Vec3Tuple;

export type CustomModelSpecification = ModelAssetSpecification & {
  position?: Vec3Tuple;
  rotation?: QuatTuple;
  scale?: CustomModelScale;
  modelOffset?: Vec3Tuple;
  modelOrientation?: unknown;
  modelScale?: CustomModelScale;
  headingVector?: Vec3Tuple;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  environmentIntensity?: number;
  materialBrightness?: number;
  transformControls?: boolean | CustomModelTransformControlsOptions;
  transformPositionConstraint?: CustomModelTransformPositionConstraint;
  verticalShadow?: boolean | VerticalShadowOptions;
};

export type CustomModelTransformControlsOptions = {
  enabled?: boolean;
  mode?: TransformControlsMode;
  modes?: TransformControlsMode[];
  selectable?: boolean;
  selected?: boolean;
  size?: number;
  translationAxes?: TransformControlAxisOptions;
  rotationAxes?: TransformControlAxisOptions;
  scaleAxes?: TransformControlAxisOptions;
};

export type TransformControlAxisOptions = {
  x?: boolean;
  y?: boolean;
  z?: boolean;
};

export type VesselVerticalPositionLimits = {
  minMeters?: number;
  maxMeters?: number;
  reference?: "scene" | "sea-level";
};

type NormalizedTransformControlsOptions = {
  enabled: boolean;
  mode: TransformControlsMode;
  modes: TransformControlsMode[];
  selectable: boolean;
  selected: boolean;
  size: number;
  translationAxes: Required<TransformControlAxisOptions>;
  rotationAxes: Required<TransformControlAxisOptions>;
  scaleAxes: Required<TransformControlAxisOptions>;
};

type TransformControlHandle = {
  mode: TransformControlsMode;
  controls: TransformControls;
  helper: Object3D;
};

type TransformControlsPrivateGizmo = {
  object?: Object3D;
  _gizmo?: {
    gizmo?: Partial<Record<TransformControlsMode, Object3D>>;
    picker?: Partial<Record<TransformControlsMode, Object3D>>;
  };
};

type TransformControlPickHit = {
  handle: TransformControlHandle;
  axis: TransformControls["axis"];
  distance: number;
  priority: number;
};

export type VerticalShadowOptions = {
  enabled?: boolean;
  intensity?: number;
  radius?: number;
  height?: number;
  far?: number;
  mapSize?: number;
};

export type VesselShadowMode = "high-quality" | "shared-texture";

export type VesselShadowSpecification = VerticalShadowOptions & {
  mode?: VesselShadowMode;
  opacity?: number;
  softness?: number;
  color?: unknown;
  radiusMeters?: number;
};

export type ModelLoadStatus = "idle" | "loading" | "loaded" | "error";

export type ModelLoadEvent = {
  status: ModelLoadStatus;
  error?: unknown;
  object?: Object3D;
};

export type TransformControlsFacade = {
  mode: TransformControlsMode;
  setMode(mode: TransformControlsMode): void;
};

export type PickedInfo = {
  isValid: boolean;
  xyz: Vec3Tuple;
  hasDepth?: boolean;
  seaLevel?: number;
  source?: "geometry" | "sea-level-plane" | "none";
  entity?: unknown;
  view?: unknown;
  selected?: unknown;
};

export type SurfaceCurrentDataset = {
  id?: string;
  timeRecordInterval?: number;
  dateTimeOfFirstRecord?: string;
  dateTimeOfLastRecord?: string;
  numberOfTimes?: number;
  dataCodingFormat?: DataFormat;
  [key: string]: unknown;
};

export type S111ViewOptions = {
  originOffset?: readonly [number, number, number] | undefined;
};

type TerrainUnloadTilesPlugin = UnloadTilesPlugin & {
  bytesTarget: number;
};

type SceneBackedTile = Tile & {
  engineData?: {
    scene?: Object3D | null;
  };
};

type RuntimeTile = Omit<Tile, "traversal"> & {
  traversal?: Tile["traversal"];
};

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const TERRAIN_LOD_NEAR_REFINEMENT_DISTANCE = 400;
const TERRAIN_LOD_FAR_REFINEMENT_DISTANCE = 5000;
const TERRAIN_CAMERA_HEIGHT_DISTANCE_WEIGHT = 6;
const TERRAIN_OPTIMIZED_TRAVERSAL_DISTANCE_RATIO = 0.55;
const TERRAIN_FAR_ERROR_MULTIPLIER = 16;
const TERRAIN_MAX_ERROR_TARGET = 64;
const TERRAIN_CLOSE_CACHE_MIN_TILES = 256;
const TERRAIN_CLOSE_CACHE_MAX_TILES = 1024;
const TERRAIN_FAR_CACHE_MIN_TILES = 48;
const TERRAIN_FAR_CACHE_MAX_TILES = 1024;
const TERRAIN_CLOSE_CACHE_MIN_BYTES = 192 * BYTES_PER_MEBIBYTE;
const TERRAIN_CLOSE_CACHE_MAX_BYTES = 512 * BYTES_PER_MEBIBYTE;
const TERRAIN_FAR_CACHE_MIN_BYTES = 32 * BYTES_PER_MEBIBYTE;
const TERRAIN_FAR_CACHE_MAX_BYTES = 512 * BYTES_PER_MEBIBYTE;
const TERRAIN_GPU_UNLOAD_DELAY_MS = 400;
const TERRAIN_CLOSE_GPU_BYTES_TARGET = 256 * BYTES_PER_MEBIBYTE;
const TERRAIN_FAR_GPU_BYTES_TARGET = 48 * BYTES_PER_MEBIBYTE;
const TERRAIN_CLOSE_DOWNLOAD_MAX_JOBS = 12;
const TERRAIN_FAR_DOWNLOAD_MAX_JOBS = 16;
const TERRAIN_CLOSE_PARSE_MAX_JOBS = 3;
const TERRAIN_FAR_PARSE_MAX_JOBS = 3;
const TERRAIN_CLOSE_PROCESS_NODE_MAX_JOBS = 24;
const TERRAIN_FAR_PROCESS_NODE_MAX_JOBS = 32;
const TERRAIN_CLOSE_MAX_TILES_PROCESSED_PER_FRAME = 240;
const TERRAIN_FAR_MAX_TILES_PROCESSED_PER_FRAME = 200;
const TERRAIN_RETRY_INITIAL_DELAY_MS = 2_000;
const TERRAIN_RETRY_MAX_DELAY_MS = 30_000;
const TERRAIN_RETRY_BACKOFF_FACTOR = 1.8;
const TERRAIN_RETRY_JITTER_RATIO = 0.35;
const TERRAIN_CAMERA_DIRECTION = new Vector3();
const HOVER_PRISM_DEFAULT_COLOR: RGBA = { r: 0.3, g: 0.75, b: 1, a: 0.6 };
const HOVER_PRISM_DEFAULT_Z_POS = -100;
const HOVER_PRISM_DEFAULT_HEIGHT = 101;
const DEFAULT_MODEL_SHADOW_ENABLED = true;
const DEFAULT_MODEL_RECEIVE_SHADOW = false;
const DEFAULT_MODEL_ENVIRONMENT_INTENSITY = 2;
const DEFAULT_VESSEL_ENVIRONMENT_INTENSITY = 0.65;
const DEFAULT_MODEL_MATERIAL_BRIGHTNESS = 1;
const DEFAULT_VESSEL_MATERIAL_BRIGHTNESS = 1.15;
const MODEL_MATERIAL_BRIGHTNESS_USER_DATA_KEY = "s100ModelMaterialBrightness";
const DEFAULT_TRANSFORM_CONTROL_SIZE = 1.1;
const TRANSFORM_CONTROL_PICKER_SCALE: Record<TransformControlsMode, number> = {
  translate: 0.6,
  rotate: 0.8,
  scale: 0.65,
};
const TRANSFORM_CONTROL_PICKER_SCALE_USER_DATA_KEY =
  "s100TransformPickerScale";
const TRANSFORM_CONTROL_PICKER_DISABLED_SCALE_USER_DATA_KEY =
  "s100TransformPickerDisabledScale";
const TRANSFORM_CONTROL_PICKER_DISABLED_SCALE = 1e-6;
const TRANSFORM_CONTROL_TRANSLATE_AXIS_LENGTH_FACTOR = 1.2;
const TRANSFORM_CONTROL_TRANSLATE_AXIS_LENGTH_USER_DATA_KEY =
  "s100TransformTranslateAxisLength";
const TRANSFORM_CONTROL_ROTATE_RING_RADIUS_FACTOR =
  1 / TRANSFORM_CONTROL_TRANSLATE_AXIS_LENGTH_FACTOR;
const TRANSFORM_CONTROL_ROTATE_RING_RADIUS_USER_DATA_KEY =
  "s100TransformRotateRingRadius";
const DEFAULT_VERTICAL_SHADOW_INTENSITY = 0.22;
const DEFAULT_VERTICAL_SHADOW_HEIGHT = 700;
const DEFAULT_VERTICAL_SHADOW_FAR = 5000;
const DEFAULT_VERTICAL_SHADOW_MAP_SIZE = 1024;
const DEFAULT_VERTICAL_SHADOW_RADIUS_PADDING_FACTOR = 2.5;
const DEFAULT_VERTICAL_SHADOW_BOUNDS_PADDING_FACTOR = 1.5;
const DEFAULT_SHARED_VESSEL_SHADOW_OPACITY = 0.34;
const DEFAULT_SHARED_VESSEL_SHADOW_SOFTNESS = 0.42;
const SHARED_VESSEL_SHADOW_FOOTPRINT_PADDING_FACTOR = 1.04;
const PICKABLE_OBJECT_USER_DATA_KEY = "s100Pickable";
const UNPICKABLE_OBJECT_USER_DATA_KEY = "s100Unpickable";
const PICKING_RAY_ABOVE_SEA_HEIGHT = 100;
const PICKING_RAY_BELOW_SEA_LEVEL_DEPTH = 500;
const PICKING_RAY_DEFAULT_ABOVE_SEA_COLOR: [number, number, number] = [
  1, 1, 0.3,
];
const PICKING_RAY_DEFAULT_OPACITY = 0.9;
const DEFAULT_SEA_LEVEL_INDICATOR_COLOR = 0x1976d2;
const DEFAULT_SEA_LEVEL_INDICATOR_OPACITY = 0.48;
const DEFAULT_SEA_LEVEL_SURFACE_COLOR = 0x0d66a6;
const DEFAULT_SEA_LEVEL_SURFACE_OPACITY = 0.68;
const DEFAULT_SEA_LEVEL_SURFACE_ENVIRONMENT_INTENSITY = 0.42;
const DEFAULT_SEA_LEVEL_SURFACE_BUMP_SCALE = 1.25;
const SEA_LEVEL_SURFACE_WAVE_SPEED = 0.27;
const SEA_LEVEL_SURFACE_Z_OFFSET = 0.03;
const VESSEL_INDICATOR_RADIUS_FACTOR = 0.56;
const IDENTITY_QUATERNION = new Quaternion();
const MODEL_FORWARD_VECTOR = new Vector3(0, 1, 0);
const VESSEL_GLTF_TO_Z_UP_ORIENTATION = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  Math.PI / 2,
);
const Z_UP_VECTOR = new Vector3(0, 0, 1);

class VesselTerrainShadowRegistry {
  private readonly materialControllers = new Set<TerrainMaterialController>();
  private readonly stamps = new Map<object, S100TerrainVesselShadowStamp>();

  registerMaterialController(controller: TerrainMaterialController): Subscription {
    this.materialControllers.add(controller);
    controller.setVesselShadows(this.getStamps());
    return {
      unsubscribe: () => {
        this.materialControllers.delete(controller);
      },
    };
  }

  setStamp(key: object, stamp: S100TerrainVesselShadowStamp): void {
    this.stamps.set(key, stamp);
    this.sync();
  }

  removeStamp(key: object): void {
    if (this.stamps.delete(key)) {
      this.sync();
    }
  }

  clear(): void {
    if (this.stamps.size === 0) {
      return;
    }
    this.stamps.clear();
    this.sync();
  }

  private sync(): void {
    const stamps = this.getStamps();
    for (const controller of this.materialControllers) {
      controller.setVesselShadows(stamps);
    }
  }

  private getStamps(): S100TerrainVesselShadowStamp[] {
    return [...this.stamps.values()];
  }
}

export class NasaSceneRuntime {
  readonly runtime = {};
  readonly cameraChanged = new EventEmitter<CameraUpdate>();
  readonly Terrain: TerrainFeature;
  readonly S111: S111Feature;
  readonly Map: MapFeature;
  readonly HoverPrism: HoverPrismFeature;
  readonly CustomModels: CustomModelFeature;
  readonly Models: CustomModelFeature;
  readonly VesselFeature: VesselFeature;
  readonly PickingRay = new PickingRayFeature();
  readonly Picking: PickingFeature;
  readonly CameraConstraint = new PlaceholderFeature("CameraConstraint");
  readonly Lighting = new LightingFeature();
  readonly Debug = new DebugFeature();
  readonly cameraNavigation: CameraNavigation;
  private readonly vesselTerrainShadows = new VesselTerrainShadowRegistry();

  constructor(
    private readonly coreScene: CoreS100Scene,
    private readonly config: ViewerConfig = {},
  ) {
    this.Picking = new PickingFeature(coreScene, this.PickingRay);
    this.Terrain = new TerrainFeature(coreScene, this.vesselTerrainShadows);
    this.S111 = new S111Feature(coreScene);
    this.Map = new MapFeature(coreScene);
    this.HoverPrism = new HoverPrismFeature(coreScene);
    let cameraInteractionActive = false;
    let transformInteractionActive = false;
    const syncSceneInteractionActive = (): void => {
      coreScene.setCameraInteractionActive(
        cameraInteractionActive || transformInteractionActive,
      );
    };
    this.cameraNavigation = new CameraNavigation(
      this.cameraChanged,
      coreScene.renderContext,
      () => coreScene.seaLevel,
      (active) => {
        cameraInteractionActive = active;
        syncSceneInteractionActive();
      },
    );
    const setNavigationEnabled = (enabled: boolean): void => {
      this.cameraNavigation.navigationEnabled = enabled;
      transformInteractionActive = !enabled;
      syncSceneInteractionActive();
    };
    this.CustomModels = new CustomModelFeature(
      coreScene,
      config,
      setNavigationEnabled,
    );
    this.Models = this.CustomModels;
    this.VesselFeature = new VesselFeature(
      coreScene,
      config,
      setNavigationEnabled,
      this.vesselTerrainShadows,
    );
  }

  initialized(): Promise<boolean> {
    return this.coreScene.initialized();
  }

  destroy(): void {
    this.VesselFeature.destroy();
    this.CustomModels.destroy();
    this.HoverPrism.destroy();
    this.S111.destroy();
    this.cameraNavigation.destroy();
    this.Picking.destroy();
    this.cameraChanged.clear();
    this.vesselTerrainShadows.clear();
    this.coreScene.destroy();
  }

  get seaLevel(): number {
    return this.coreScene.seaLevel;
  }

  set seaLevel(value: number) {
    this.coreScene.seaLevel = value;
  }

  getRenderContext(): S100RenderContext | null {
    return this.coreScene.renderContext;
  }

  getSeaLevel(): number {
    return this.coreScene.seaLevel;
  }

  onBeforeRender(callback: () => void): FrameSubscription {
    return this.coreScene.onBeforeRender(callback);
  }

  onCameraInteractionChanged(callback: (active: boolean) => void): Subscription {
    return this.coreScene.cameraInteractionChanged.subscribe(callback);
  }
}

export class CameraNavigation {
  navigationEnabled = true;

  private pose: CameraPose = {
    position: [0, 0, 100],
    rotation: [0, 0, 0, 1],
    focalDistance: 100,
  };
  private readonly controls: S100CameraControls | null;

  constructor(
    private readonly cameraChanged: EventEmitter<CameraUpdate>,
    private readonly renderContext: S100RenderContext | null = null,
    private readonly getSeaLevel: () => number = () => 0,
    private readonly setCameraInteractionActive: (active: boolean) => void = () => {},
  ) {
    this.controls = renderContext
      ? new S100CameraControls(
          renderContext.canvas,
          renderContext.camera,
          () => this.navigationEnabled,
          this.getSeaLevel,
          (pose) => {
            this.pose = pose;
            this.cameraChanged.emit(cloneCameraPose(this.pose));
          },
          this.setCameraInteractionActive,
        )
      : null;
  }

  lookAt(
    target: Vec3Tuple,
    distance: number,
    _horizontalAngle: number,
    _verticalAngle: number,
  ): void {
    const position: Vec3Tuple = [
      target[0],
      target[1] - distance,
      target[2] + distance,
    ];
    const camera = this.renderContext?.camera;
    if (camera) {
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(target[0], target[1], target[2]);
      camera.updateMatrixWorld();
      this.pose = {
        position,
        rotation: [
          camera.quaternion.x,
          camera.quaternion.y,
          camera.quaternion.z,
          camera.quaternion.w,
        ],
        focalDistance: distance,
      };
      this.controls?.setPose(this.pose);
      this.cameraChanged.emit(cloneCameraPose(this.pose));
      return;
    }

    this.pose = {
      position,
      rotation: [0, 0, 0, 1],
      focalDistance: distance,
    };
    this.cameraChanged.emit(cloneCameraPose(this.pose));
  }

  getCameraPose(): CameraPose {
    return cloneCameraPose(this.pose);
  }

  setCameraPose(pose: CameraPose): void {
    this.pose = normalizeCameraPose(pose, this.pose);
    const camera = this.renderContext?.camera;
    if (camera) {
      const { position, rotation } = this.pose;
      camera.position.set(position[0], position[1], position[2]);
      camera.quaternion.set(rotation[0], rotation[1], rotation[2], rotation[3]);
      camera.quaternion.normalize();
      this.pose.rotation = [
        camera.quaternion.x,
        camera.quaternion.y,
        camera.quaternion.z,
        camera.quaternion.w,
      ];
      camera.updateMatrixWorld();
      this.controls?.setPose(this.pose);
    }
    this.cameraChanged.emit(cloneCameraPose(this.pose));
  }

  getCameraPos(): Vec3Tuple {
    return [...this.pose.position];
  }

  destroy(): void {
    this.controls?.dispose();
    this.setCameraInteractionActive(false);
  }
}

type CameraControlMode = "orbit" | "pan";

class S100CameraControls {
  private static readonly MIN_DISTANCE = 1;
  private static readonly MAX_DISTANCE = 1_000_000;
  private static readonly MIN_POLAR_ANGLE = 0.01;
  private static readonly MAX_POLAR_ANGLE = Math.PI - 0.01;
  private static readonly ROTATE_SPEED = 0.005;
  private static readonly Z_UP = new Vector3(0, 0, 1);
  private static readonly WHEEL_INTERACTION_IDLE_MS = 140;

  private readonly target = new Vector3();
  private activePointerId: number | null = null;
  private wheelInteractionTimeout: ReturnType<typeof setTimeout> | null = null;
  private mode: CameraControlMode = "orbit";
  private lastClientX = 0;
  private lastClientY = 0;
  private focalDistance = 100;
  private panAnchor: Vector3 | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: S100RenderContext["camera"],
    private readonly isEnabled: () => boolean,
    private readonly getSeaLevel: () => number,
    private readonly onPoseChange: (pose: CameraPose) => void,
    private readonly onInteractionActive: (active: boolean) => void = () => {},
  ) {
    this.camera.up.copy(S100CameraControls.Z_UP);
    this.focalDistance = Math.max(
      S100CameraControls.MIN_DISTANCE,
      this.camera.position.distanceTo(this.target),
    );
    this.target.copy(this.computeTargetFromCamera(this.focalDistance));

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.preventContextMenu);
  }

  setPose(pose: CameraPose): void {
    const focalDistance = normalizeOptionalNumber(pose.focalDistance);
    this.focalDistance =
      focalDistance && focalDistance > 0
        ? focalDistance
        : Math.max(S100CameraControls.MIN_DISTANCE, this.focalDistance);
    this.target.copy(this.computeTargetFromCamera(this.focalDistance));
  }

  dispose(): void {
    if (this.wheelInteractionTimeout) {
      clearTimeout(this.wheelInteractionTimeout);
      this.wheelInteractionTimeout = null;
    }
    this.onInteractionActive(false);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.isEnabled()) {
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
    this.onInteractionActive(true);
    this.canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    if (!this.isEnabled()) {
      this.activePointerId = null;
      this.panAnchor = null;
      this.onInteractionActive(false);
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
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.activePointerId = null;
    this.panAnchor = null;
    if (!this.wheelInteractionTimeout) {
      this.onInteractionActive(false);
    }
    this.canvas.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.isEnabled()) {
      return;
    }

    this.beginWheelInteraction();
    const zoomTarget = this.getCenterSeaPlanePoint();
    if (zoomTarget) {
      this.target.copy(zoomTarget);
      this.focalDistance = MathUtils.clamp(
        this.camera.position.distanceTo(this.target),
        S100CameraControls.MIN_DISTANCE,
        S100CameraControls.MAX_DISTANCE,
      );
    }

    const zoomFactor = Math.exp(event.deltaY * 0.001);
    const nextDistance = MathUtils.clamp(
      this.focalDistance * zoomFactor,
      S100CameraControls.MIN_DISTANCE,
      S100CameraControls.MAX_DISTANCE,
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
    this.camera.updateMatrixWorld();
    this.emitPoseChange();
    event.preventDefault();
  };

  private beginWheelInteraction(): void {
    this.onInteractionActive(true);
    if (this.wheelInteractionTimeout) {
      clearTimeout(this.wheelInteractionTimeout);
    }
    this.wheelInteractionTimeout = setTimeout(() => {
      this.wheelInteractionTimeout = null;
      if (this.activePointerId === null) {
        this.onInteractionActive(false);
      }
    }, S100CameraControls.WHEEL_INTERACTION_IDLE_MS);
  }

  private readonly preventContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private orbit(deltaX: number, deltaY: number): void {
    const offset = this.camera.position.clone().sub(this.target);
    const radius = MathUtils.clamp(
      offset.length(),
      S100CameraControls.MIN_DISTANCE,
      S100CameraControls.MAX_DISTANCE,
    );
    const horizontalDistance = Math.hypot(offset.x, offset.y);
    const azimuth = Math.atan2(offset.y, offset.x) -
      deltaX * S100CameraControls.ROTATE_SPEED;
    const polar = MathUtils.clamp(
      Math.atan2(horizontalDistance, offset.z) -
        deltaY * S100CameraControls.ROTATE_SPEED,
      S100CameraControls.MIN_POLAR_ANGLE,
      S100CameraControls.MAX_POLAR_ANGLE,
    );

    const sinPolar = Math.sin(polar);
    offset.set(
      radius * sinPolar * Math.cos(azimuth),
      radius * sinPolar * Math.sin(azimuth),
      radius * Math.cos(polar),
    );

    this.focalDistance = radius;
    this.camera.position.copy(this.target).add(offset);
    this.camera.up.copy(S100CameraControls.Z_UP);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.emitPoseChange();
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
      this.camera.updateMatrixWorld();
      this.emitPoseChange();
      return;
    }

    this.panByScreenDelta(deltaX, deltaY);
  }

  private panByScreenDelta(deltaX: number, deltaY: number): void {
    const worldPerPixel = this.getWorldUnitsPerPixel();
    const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    if (right.lengthSq() === 0) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    if (up.lengthSq() === 0) {
      up.crossVectors(S100CameraControls.Z_UP, right).normalize();
    } else {
      up.normalize();
    }

    const panOffset = right
      .multiplyScalar(-deltaX * worldPerPixel)
      .add(up.multiplyScalar(deltaY * worldPerPixel));
    this.target.add(panOffset);
    this.camera.position.add(panOffset);
    this.camera.updateMatrixWorld();
    this.emitPoseChange();
  }

  private getViewPlanePoint(clientX: number, clientY: number): Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.clientWidth || this.canvas.width;
    const height = rect.height || this.canvas.clientHeight || this.canvas.height;
    if (!width || !height) {
      return null;
    }

    const ndcX = ((clientX - rect.left) / width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / height) * 2 - 1);
    const rayPoint = new Vector3(ndcX, ndcY, 0.5).unproject(this.camera);
    const rayDirection = rayPoint.sub(this.camera.position).normalize();
    const planeNormal = this.camera.position.clone().sub(this.target);
    if (planeNormal.lengthSq() === 0) {
      this.camera.getWorldDirection(planeNormal);
    }
    planeNormal.normalize();

    const denominator = rayDirection.dot(planeNormal);
    if (Math.abs(denominator) < 1e-6) {
      return null;
    }

    const distanceToPlane = this.target
      .clone()
      .sub(this.camera.position)
      .dot(planeNormal) / denominator;
    if (!Number.isFinite(distanceToPlane)) {
      return null;
    }

    return this.camera.position
      .clone()
      .addScaledVector(rayDirection, distanceToPlane);
  }

  private getCenterSeaPlanePoint(): Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.clientWidth || this.canvas.width;
    const height = rect.height || this.canvas.clientHeight || this.canvas.height;
    if (!width || !height) {
      return null;
    }

    return this.getSeaPlanePoint(rect.left + width / 2, rect.top + height / 2);
  }

  private getSeaPlanePoint(clientX: number, clientY: number): Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.clientWidth || this.canvas.width;
    const height = rect.height || this.canvas.clientHeight || this.canvas.height;
    if (!width || !height) {
      return null;
    }

    const ndcX = ((clientX - rect.left) / width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / height) * 2 - 1);
    const rayPoint = new Vector3(ndcX, ndcY, 0.5).unproject(this.camera);
    const rayDirection = rayPoint.sub(this.camera.position).normalize();
    const denominator = rayDirection.dot(S100CameraControls.Z_UP);
    if (Math.abs(denominator) < 1e-6) {
      return null;
    }

    const distanceToPlane =
      (this.getSeaLevel() - this.camera.position.z) / denominator;
    if (!Number.isFinite(distanceToPlane) || distanceToPlane <= 0) {
      return null;
    }

    return this.camera.position
      .clone()
      .addScaledVector(rayDirection, distanceToPlane);
  }

  private getWorldUnitsPerPixel(): number {
    const height = Math.max(
      1,
      this.canvas.getBoundingClientRect().height ||
        this.canvas.clientHeight ||
        this.canvas.height,
    );
    const verticalFovRadians = MathUtils.degToRad(this.camera.fov);
    return (
      (2 * this.focalDistance * Math.tan(verticalFovRadians / 2)) / height
    );
  }

  private computeTargetFromCamera(distance: number): Vector3 {
    const forward = new Vector3(0, 0, -1).applyQuaternion(
      this.camera.quaternion,
    );
    if (forward.lengthSq() === 0) {
      forward.set(0, 1, -1).normalize();
    }
    return this.camera.position.clone().addScaledVector(forward, distance);
  }

  private emitPoseChange(): void {
    this.onPoseChange({
      position: [
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ],
      rotation: [
        this.camera.quaternion.x,
        this.camera.quaternion.y,
        this.camera.quaternion.z,
        this.camera.quaternion.w,
      ],
      focalDistance: this.focalDistance,
    });
  }
}

export class TerrainFeature {
  private readonly views = new Set<TerrainView>();

  constructor(
    private readonly coreScene: CoreS100Scene,
    private readonly vesselTerrainShadows: VesselTerrainShadowRegistry,
  ) {}

  add(dataset: TerrainDataset): TerrainView {
    const view = new TerrainView(
      dataset,
      this.coreScene,
      this.vesselTerrainShadows,
      () => {
        this.views.delete(view);
      },
    );
    this.views.add(view);
    return view;
  }

  remove(view: TerrainView): void {
    view.destroy();
  }

  get size(): number {
    return this.views.size;
  }
}

export class TerrainView {
  visible = true;
  readonly tilesetURL: string;
  readonly terrain: TerrainDisplayProperties;
  readonly settings: TerrainSettings;
  private readonly renderContext: S100RenderContext | null;
  private readonly materialController = new TerrainMaterialController();
  private frameSubscription: FrameSubscription | null = null;
  private seaLevelSubscription: Subscription | null = null;
  private cameraInteractionSubscription: Subscription | null = null;
  private terrainShadowSubscription: Subscription | null = null;
  private tiles: TilesRenderer | null = null;
  private retryController: TerrainTileRetryController | null = null;
  private readonly handleLoadModel = (event: { scene: Object3D }): void => {
    this.materialController.applyToObject(event.scene);
    configureTerrainObjectForShadows(event.scene);
  };
  private readonly handleLoadError = (event: TerrainTileLoadErrorEvent): void => {
    console.error("Failed to load S-102 terrain tile", event.url, event.error);
    this.retryController?.handleLoadError(event);
  };

  constructor(
    readonly dataset: TerrainDataset,
    coreScene: CoreS100Scene,
    vesselTerrainShadows: VesselTerrainShadowRegistry,
    private readonly onDestroy: () => void,
  ) {
    this.renderContext = coreScene.renderContext;
    this.tilesetURL = normalizeTerrainTilesetURL(dataset.baseURL);
    this.terrain = new TerrainDisplayPropertyAdapter(this.materialController);
    this.terrainShadowSubscription = vesselTerrainShadows.registerMaterialController(
      this.materialController,
    );
    this.terrain.seaLevel = coreScene.seaLevel;
    this.seaLevelSubscription = coreScene.seaLevelChanged.subscribe(
      (seaLevel) => {
        this.terrain.seaLevel = seaLevel;
      },
    );
    this.settings = {
      renderBBoxes: false,
      detailFactor: dataset.detailFactor,
      neverDiscardRootNodes: false,
      waitForSiblings: false,
    };
    this.initializeTilesRenderer(coreScene);
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
    if (this.tiles) {
      this.tiles.group.visible = visible;
    }
  }

  setWaterLevelGrid(grid: S100TerrainWaterLevelGridUniformState | null): void {
    this.materialController.setWaterLevelGrid(grid);
    if (this.tiles) {
      this.materialController.applyToObject(this.tiles.group);
    }
  }

  destroy(): void {
    this.frameSubscription?.unsubscribe();
    this.frameSubscription = null;
    this.seaLevelSubscription?.unsubscribe();
    this.seaLevelSubscription = null;
    this.cameraInteractionSubscription?.unsubscribe();
    this.cameraInteractionSubscription = null;
    this.terrainShadowSubscription?.unsubscribe();
    this.terrainShadowSubscription = null;
    this.retryController?.dispose();
    this.retryController = null;
    if (this.tiles) {
      this.tiles.removeEventListener("load-model", this.handleLoadModel);
      this.tiles.removeEventListener("load-error", this.handleLoadError);
      this.renderContext?.scene.remove(this.tiles.group);
      this.tiles.dispose();
      this.tiles = null;
    }
    this.materialController.dispose();
    this.onDestroy();
  }

  private initializeTilesRenderer(coreScene: CoreS100Scene): void {
    if (!this.renderContext) {
      return;
    }

    const { camera, renderer, scene } = this.renderContext;
    const tiles = new TilesRenderer(this.tilesetURL);
    tiles.group.name = `s100-terrain:${this.tilesetURL}`;
    if (this.dataset.originOffset) {
      tiles.group.position.fromArray(this.dataset.originOffset);
      tiles.group.updateMatrixWorld(true);
    }
    tiles.group.userData[PICKABLE_OBJECT_USER_DATA_KEY] = true;
    tiles.group.visible = this.visible;
    const unloadTilesPlugin = configureTerrainTilesRenderer(tiles);
    updateTerrainRuntimeForCamera(
      tiles,
      camera,
      this.settings.detailFactor,
      unloadTilesPlugin,
      this.terrain.seaLevel,
    );

    if (this.dataset.accessToken) {
      tiles.fetchOptions.headers = {
        ...tiles.fetchOptions.headers,
        Authorization: `Bearer ${this.dataset.accessToken}`,
      };
    }

    tiles.registerPlugin(new S100ImplicitTilingPlugin());
    tiles.registerPlugin(
      createAdditionalUrlParametersPlugin(this.dataset.additionalURLParameters),
    );
    this.retryController = new TerrainTileRetryController(tiles, {
      isRetryDeferred: () =>
        !this.visible || coreScene.isCameraInteractionActive,
    });
    tiles.addEventListener("load-model", this.handleLoadModel);
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);
    tiles.addEventListener("load-error", this.handleLoadError);
    setTerrainTileQueuesPaused(tiles, coreScene.isCameraInteractionActive);
    this.cameraInteractionSubscription = coreScene.cameraInteractionChanged.subscribe(
      (active) => {
        if (this.tiles) {
          setTerrainTileQueuesPaused(this.tiles, active);
        }
      },
    );

    scene.add(tiles.group);
    tiles.forEachLoadedModel((model) => {
      this.materialController.applyToObject(model);
      configureTerrainObjectForShadows(model);
    });
    this.frameSubscription = coreScene.onBeforeRender(() => {
      if (!this.visible) {
        return;
      }
      if (coreScene.isCameraInteractionActive) {
        return;
      }
      tiles.setCamera(camera);
      tiles.setResolutionFromRenderer(camera, renderer);
      updateTerrainRuntimeForCamera(
        tiles,
        camera,
        this.settings.detailFactor,
        unloadTilesPlugin,
        this.terrain.seaLevel,
      );
      tiles.update();
      flushTerrainQueuesForCurrentView(tiles);
      updateTerrainRuntimeForCamera(
        tiles,
        camera,
        this.settings.detailFactor,
        unloadTilesPlugin,
        this.terrain.seaLevel,
      );
    });
    this.tiles = tiles;
  }
}

export class S111Feature {
  private readonly views = new Set<S111View>();

  constructor(private readonly coreScene: CoreS100Scene) {}

  add(dataset: SurfaceCurrentDataset, options: S111ViewOptions = {}): S111View {
    const view = new S111View(dataset, options, this.coreScene, () => {
      this.views.delete(view);
    });
    this.views.add(view);
    return view;
  }

  remove(view: S111View): void {
    view.destroy();
  }

  destroy(): void {
    for (const view of [...this.views]) {
      view.destroy();
    }
  }
}

export class S111View {
  visible = true;
  readonly time: {
    startTime: number;
    endTime: number;
    currentTime: number;
  };
  private readonly overlay: SeaCurrentsOverlay | null;
  private readonly seaLevelSubscription: Subscription | null = null;
  private currentTime: number;
  private disableAutoScalingState = false;
  private scalingModeState: "auto" | "custom" = "auto";
  private customScaleState = 1;
  private destroyed = false;

  constructor(
    readonly dataset: SurfaceCurrentDataset,
    options: S111ViewOptions,
    coreScene: CoreS100Scene,
    private readonly onDestroy: () => void,
  ) {
    const interval = dataset.timeRecordInterval ?? 1;
    const numberOfTimes =
      typeof dataset.numberOfTimes === "number"
        ? dataset.numberOfTimes
        : getSurfaceCurrentRecordCount(dataset);
    const startTime = parseSurfaceCurrentTime(dataset.dateTimeOfFirstRecord) ?? 0;
    const endTime =
      parseSurfaceCurrentTime(dataset.dateTimeOfLastRecord) ??
      startTime + interval * 1000 * Math.max(0, numberOfTimes - 1);
    this.currentTime = startTime;
    const view = this;
    this.time = {
      startTime,
      endTime,
      get currentTime() {
        return view.currentTime;
      },
      set currentTime(currentTime: number) {
        view.setCurrentTime(currentTime);
      },
    };
    const renderContext = coreScene.renderContext;
    if (renderContext) {
      this.overlay = new SeaCurrentsOverlay(dataset, renderContext.scene, {
        currentTimeMs: this.currentTime,
        customScale: this.customScaleState,
        autoScaling: !this.disableAutoScalingState,
        zOffset: getS111ZOffset(coreScene.seaLevel),
        originOffset: options.originOffset,
      });
      this.overlay.setVisible(this.visible);
      this.seaLevelSubscription = coreScene.seaLevelChanged.subscribe(
        (seaLevel) => {
          this.overlay?.setZOffset(getS111ZOffset(seaLevel));
        },
      );
    } else {
      this.overlay = null;
    }
  }

  get disableAutoScaling(): boolean {
    return this.disableAutoScalingState;
  }

  set disableAutoScaling(disableAutoScaling: boolean) {
    const disabled = Boolean(disableAutoScaling);
    if (disabled === this.disableAutoScalingState) {
      return;
    }
    this.disableAutoScalingState = disabled;
    this.scalingModeState = disabled ? "custom" : "auto";
    this.overlay?.setAutoScaling(!disabled);
  }

  get scalingMode(): "auto" | "custom" {
    return this.scalingModeState;
  }

  set scalingMode(mode: "auto" | "custom" | string) {
    this.disableAutoScaling = mode !== "auto";
  }

  get customScale(): number {
    return this.customScaleState;
  }

  set customScale(scale: number) {
    this.setCustomScale(scale);
  }

  setCustomScale(scale: number): void {
    const nextScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.customScaleState = nextScale;
    this.disableAutoScalingState = true;
    this.scalingModeState = "custom";
    this.overlay?.setAutoScaling(false);
    this.overlay?.setCustomScale(nextScale);
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
    this.overlay?.setVisible(visible);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.seaLevelSubscription?.unsubscribe();
    this.overlay?.dispose();
    this.onDestroy();
  }

  private setCurrentTime(currentTime: number): void {
    const parsed = Number(currentTime);
    this.currentTime = Number.isFinite(parsed) ? parsed : this.time.startTime;
    this.overlay?.setCurrentTime(this.currentTime);
  }
}

export class MapFeature {
  discardMode = MapDiscardMode.Transparent;
  private readonly views = new Set<MapView>();
  private readonly transparentLayerExtents: MapOverlayExtents[] = [];

  constructor(private readonly coreScene: CoreS100Scene) {}

  add(specification: MapSpecification): MapView {
    const clipExtents =
      specification.type === MapLayerType.Base
        ? this.findClipExtents(specification)
        : undefined;
    const view = new MapView(
      specification,
      this.coreScene,
      () => {
        this.views.delete(view);
      },
      clipExtents ? { clipExtents } : {},
    );
    this.views.add(view);
    if (specification.type === MapLayerType.BaseTransparent) {
      const extents = getMapSpecificationExtents(specification);
      if (extents) {
        this.transparentLayerExtents.push(extents);
      }
    }
    return view;
  }

  remove(view: MapView): void {
    view.destroy();
  }

  private findClipExtents(
    specification: MapSpecification,
  ): MapOverlayExtents | undefined {
    const baseExtents = getMapSpecificationExtents(specification);
    if (!baseExtents) {
      return undefined;
    }

    for (let i = this.transparentLayerExtents.length - 1; i >= 0; i -= 1) {
      const candidate = this.transparentLayerExtents[i];
      if (candidate && extentsOverlap(baseExtents, candidate)) {
        return candidate;
      }
    }

    return undefined;
  }
}

export class HoverPrismFeature {
  private mesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;

  constructor(private readonly coreScene: CoreS100Scene) {}

  showPrism(
    corners: PrismCorners2D,
    zPos = HOVER_PRISM_DEFAULT_Z_POS,
    height = HOVER_PRISM_DEFAULT_HEIGHT,
    rgba: RGBA = HOVER_PRISM_DEFAULT_COLOR,
  ): void {
    const scene = this.coreScene.renderContext?.scene;
    if (!scene) {
      return;
    }

    this.clear();
    const geometry = createPrismGeometry(corners, zPos, height);
    const material = new MeshBasicMaterial({
      color: rgbToHex(rgba),
      opacity: MathUtils.clamp(rgba.a, 0, 1),
      transparent: rgba.a < 1,
      depthWrite: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = "s100-hover-prism";
    mesh.renderOrder = 50;
    scene.add(mesh);
    this.mesh = mesh;
  }

  show(
    corners: PrismCorners2D,
    zPos = HOVER_PRISM_DEFAULT_Z_POS,
    height = HOVER_PRISM_DEFAULT_HEIGHT,
    rgba: RGBA = HOVER_PRISM_DEFAULT_COLOR,
  ): void {
    this.showPrism(corners, zPos, height, rgba);
  }

  clear(): void {
    if (!this.mesh) {
      return;
    }

    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }

  destroy(): void {
    this.clear();
  }
}

type MapViewOptions = {
  clipExtents?: MapOverlayExtents;
};

export class MapView {
  private currentVisible = false;
  private currentAlpha = 1;
  private destroyed = false;
  private readonly overlay: FlatMapOverlay | null;
  private readonly frameSubscription: FrameSubscription | null = null;
  private readonly cameraInteractionSubscription: Subscription | null = null;

  constructor(
    readonly specification: MapSpecification,
    coreScene: CoreS100Scene,
    private readonly onDestroy: () => void,
    options: MapViewOptions = {},
  ) {
    const renderContext = coreScene.renderContext;
    if (renderContext) {
      const overlayOptions: ConstructorParameters<typeof FlatMapOverlay>[2] = {
        camera: renderContext.camera,
        maxTextureAnisotropy:
          renderContext.renderer.capabilities.getMaxAnisotropy(),
      };
      if (options.clipExtents) {
        overlayOptions.clipExtents = options.clipExtents;
      }
      this.overlay = new FlatMapOverlay(
        specification,
        renderContext.scene,
        overlayOptions,
      );
      this.overlay.setLoadingPaused(coreScene.isCameraInteractionActive);
    } else {
      this.overlay = null;
    }
    this.frameSubscription = this.overlay
      ? coreScene.onBeforeRender(() => {
          if (
            !this.currentVisible ||
            this.currentAlpha <= 0 ||
            coreScene.isCameraInteractionActive
          ) {
            return;
          }
          this.overlay?.updateForCamera();
        })
      : null;
    this.cameraInteractionSubscription = this.overlay
      ? coreScene.cameraInteractionChanged.subscribe((active) => {
          this.overlay?.setLoadingPaused(active);
          if (!active && this.currentVisible && this.currentAlpha > 0) {
            this.overlay?.updateForCamera();
          }
        })
      : null;
  }

  get visible(): boolean {
    return this.currentVisible;
  }

  set visible(visible: boolean) {
    this.setVisibility(visible);
  }

  get alpha(): number {
    return this.currentAlpha;
  }

  set alpha(alpha: number) {
    this.currentAlpha = normalizeOpacity(alpha);
    this.overlay?.setOpacity(this.currentAlpha);
  }

  setVisibility(visible: boolean): void {
    this.currentVisible = visible;
    this.overlay?.setVisible(visible);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.frameSubscription?.unsubscribe();
    this.cameraInteractionSubscription?.unsubscribe();
    this.overlay?.dispose();
    this.onDestroy();
  }
}

export class CustomModelFeature {
  private readonly views = new Set<CustomModelView>();

  constructor(
    private readonly coreScene: CoreS100Scene,
    private readonly config: ViewerConfig = {},
    private readonly setNavigationEnabled: (enabled: boolean) => void = () => {},
  ) {}

  add(specification: CustomModelSpecification): CustomModelView {
    const view = new CustomModelView(
      specification,
      this.coreScene,
      this.config,
      this.setNavigationEnabled,
      () => {
        this.views.delete(view);
      },
    );
    this.views.add(view);
    return view;
  }

  remove(view: CustomModelView): void {
    view.destroy();
  }

  destroy(): void {
    for (const view of [...this.views]) {
      view.destroy();
    }
  }
}

export class CustomModelView {
  readonly group = new Group();
  readonly loadChanged = new EventEmitter<ModelLoadEvent>();
  readonly positionChanged = new EventEmitter<Vec3Tuple>();
  readonly headingChanged = new EventEmitter<number>();
  readonly loaded: Promise<boolean>;

  private readonly scene: S100RenderContext["scene"] | null;
  private readonly baseOrientation: Quaternion;
  private readonly headingVector: Vector3;
  private readonly transformControlOptions: NormalizedTransformControlsOptions;
  private readonly transformPositionConstraint: CustomModelTransformPositionConstraint | null;
  private transformControls: TransformControlHandle[] = [];
  private transformControlArbitrationCleanup: (() => void) | null = null;
  private transformControlSelectionCleanup: (() => void) | null = null;
  private verticalShadow: VerticalShadowProjector | null = null;
  private modelObject: Object3D | null = null;
  private status: ModelLoadStatus = "idle";
  private position: Vec3Tuple = [0, 0, 0];
  private heading = 0;
  private visible = true;
  private destroyed = false;

  constructor(
    readonly specification: CustomModelSpecification,
    private readonly coreScene: CoreS100Scene,
    private readonly config: ViewerConfig,
    private readonly setNavigationEnabled: (enabled: boolean) => void,
    private readonly onDestroy: () => void,
  ) {
    this.scene = coreScene.renderContext?.scene ?? null;
    this.baseOrientation = parseQuaternion(specification.orientation);
    this.headingVector = normalizeDirectionVector(
      specification.headingVector,
      MODEL_FORWARD_VECTOR,
    );
    this.transformControlOptions = normalizeTransformControlOptions(
      specification.transformControls,
    );
    this.transformPositionConstraint =
      typeof specification.transformPositionConstraint === "function"
        ? specification.transformPositionConstraint
        : null;
    this.group.name = `s100-model:${specification.name ?? specification.path}`;
    this.group.userData[PICKABLE_OBJECT_USER_DATA_KEY] = true;
    this.visible = specification.visible !== false;
    this.group.visible = this.visible;
    this.applyScale(specification.scale);
    this.applyPosition(specification.position ?? [0, 0, 0], false);
    this.applyHeading(0, false);
    if (specification.rotation) {
      this.group.quaternion.fromArray(specification.rotation);
      this.heading = getHeadingFromQuaternion(
        this.group.quaternion,
        this.headingVector,
      );
    }
    this.scene?.add(this.group);
    if (this.transformControlOptions.enabled) {
      this.setTransformControlsEnabled(true);
    }
    this.loaded = this.loadModel();
  }

  initialized(): Promise<boolean> {
    return this.loaded;
  }

  getStatus(): ModelLoadStatus {
    return this.status;
  }

  getObject(): Object3D | null {
    return this.modelObject;
  }

  getPosition(): Vec3Tuple {
    return [...this.position];
  }

  setPosition(position: Vec3Tuple): void {
    this.applyPosition(position, true);
  }

  getHeading(): number {
    return this.heading;
  }

  setHeading(heading: number): void {
    this.applyHeading(heading, true);
  }

  setScale(scale: CustomModelScale): void {
    this.applyScale(scale);
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
    this.group.visible = visible;
    this.verticalShadow?.setEnabled(visible);
    this.updateTransformControlsVisibility();
  }

  setTransformMode(mode: TransformControlsMode): void {
    this.transformControlOptions.mode = mode;
    if (this.transformControlOptions.modes.length === 1) {
      this.transformControlOptions.modes = [mode];
      this.transformControls[0]?.controls.setMode(mode);
      if (this.transformControls[0]) {
        this.transformControls[0].mode = mode;
      }
    }
    this.updateTransformControlsAxisVisibility();
  }

  getTransformMode(): TransformControlsMode {
    return this.transformControlOptions.mode;
  }

  getTransformControlsSelected(): boolean {
    return this.transformControlOptions.selected;
  }

  setTransformControlsSelected(selected: boolean): void {
    this.transformControlOptions.selected = selected;
    this.updateTransformControlsVisibility();
  }

  setTransformControlsEnabled(enabled: boolean): void {
    this.transformControlOptions.enabled = enabled;
    if (!enabled) {
      this.updateTransformControlsVisibility();
      return;
    }

    if (this.transformControls.length > 0 || !this.coreScene.renderContext) {
      this.updateTransformControlsVisibility();
      return;
    }

    const { camera, canvas, scene } = this.coreScene.renderContext;
    for (const mode of this.transformControlOptions.modes) {
      const controls = new TransformControls(camera, canvas);
      controls.setMode(mode);
      controls.setSize(this.transformControlOptions.size);
      controls.space = "world";
      this.applyTransformControlsAxisVisibility(controls, mode);
      extendTranslateAxisHandles(controls, mode);
      if (this.transformControlOptions.modes.includes("translate")) {
        preserveRotateRingRadiusWithExtendedTranslateHandles(controls, mode);
      }
      tightenTransformControlPicker(controls, mode);
      controls.addEventListener("dragging-changed", (event) => {
        this.setNavigationEnabled(event.value !== true);
      });
      controls.addEventListener("objectChange", () => {
        this.syncTransformFromObject();
      });
      controls.attach(this.group);
      const helper = controls.getHelper();
      helper.name = `s100-model-transform:${this.specification.name ?? this.specification.path}:${mode}`;
      scene.add(helper);
      this.transformControls.push({
        controls,
        helper,
        mode,
      });
    }
    this.installTransformControlSelection(canvas);
    this.installTransformControlArbitration(canvas);
    this.updateTransformControlsVisibility();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.setNavigationEnabled(true);
    this.transformControlArbitrationCleanup?.();
    this.transformControlArbitrationCleanup = null;
    this.transformControlSelectionCleanup?.();
    this.transformControlSelectionCleanup = null;
    for (const handle of this.transformControls) {
      handle.controls.detach();
      handle.controls.dispose();
      handle.helper.parent?.remove(handle.helper);
    }
    this.transformControls = [];
    this.verticalShadow?.dispose();
    this.verticalShadow = null;
    this.group.parent?.remove(this.group);
    disposeObjectTree(this.group);
    this.positionChanged.clear();
    this.headingChanged.clear();
    this.loadChanged.clear();
    this.onDestroy();
  }

  private async loadModel(): Promise<boolean> {
    if (!this.scene || (!this.specification.path && !this.specification.object)) {
      return false;
    }

    const url = resolveModelAssetURL(this.specification.path, this.config);
    this.setLoadStatus("loading");
    try {
      const object = await loadCustomModelObject(this.specification, url);
      if (this.destroyed) {
        disposeObjectTree(object);
        return false;
      }

      object.name = this.specification.name ?? object.name ?? "s100-model";
      configureModelObjectForRendering(
        object,
        this.specification.castShadow ?? DEFAULT_MODEL_SHADOW_ENABLED,
        this.specification.receiveShadow ?? DEFAULT_MODEL_RECEIVE_SHADOW,
        this.specification.environmentIntensity,
        this.coreScene.renderContext?.environmentMap ?? null,
        this.coreScene.renderContext?.scene.environmentRotation,
        this.specification.materialBrightness,
      );
      const modelRoot = new Group();
      modelRoot.name = `s100-model-root:${this.specification.name ?? this.specification.path}`;
      modelRoot.position.fromArray(this.specification.modelOffset ?? [0, 0, 0]);
      modelRoot.quaternion.copy(parseQuaternion(this.specification.modelOrientation));
      applyObjectScale(modelRoot, this.specification.modelScale);
      modelRoot.add(object);
      this.group.add(modelRoot);
      this.modelObject = object;
      this.enableVerticalShadowIfRequested(modelRoot);
      this.setLoadStatus("loaded", { object });
      return true;
    } catch (error) {
      this.config.logger?.warn?.("Failed to load model", url, error);
      this.setLoadStatus("error", { error });
      return false;
    }
  }

  private setLoadStatus(
    status: ModelLoadStatus,
    event: Partial<ModelLoadEvent> = {},
  ): void {
    this.status = status;
    this.loadChanged.emit({
      ...event,
      status,
    });
  }

  private applyPosition(position: Vec3Tuple, emit: boolean): void {
    this.position = normalizeVec3Tuple(position, this.position);
    this.group.position.set(this.position[0], this.position[1], this.position[2]);
    this.group.updateMatrixWorld();
    this.verticalShadow?.update();
    if (emit) {
      this.positionChanged.emit(this.getPosition());
    }
  }

  private applyHeading(heading: number, emit: boolean): void {
    this.heading = normalizeDegrees(heading);
    const headingQuaternion = new Quaternion().setFromAxisAngle(
      Z_UP_VECTOR,
      MathUtils.degToRad(-this.heading),
    );
    this.group.quaternion.multiplyQuaternions(
      headingQuaternion,
      this.baseOrientation,
    );
    this.group.updateMatrixWorld();
    this.verticalShadow?.update();
    if (emit) {
      this.headingChanged.emit(this.heading);
    }
  }

  private applyScale(scale: CustomModelScale | undefined): void {
    if (Array.isArray(scale)) {
      this.group.scale.set(
        normalizePositiveNumber(scale[0], 1),
        normalizePositiveNumber(scale[1], 1),
        normalizePositiveNumber(scale[2], 1),
      );
      return;
    }

    const uniformScale = normalizePositiveNumber(scale, 1);
    this.group.scale.set(uniformScale, uniformScale, uniformScale);
  }

  private syncTransformFromObject(): void {
    const objectPosition: Vec3Tuple = [
      this.group.position.x,
      this.group.position.y,
      this.group.position.z,
    ];
    const nextPosition = this.constrainTransformPosition(objectPosition);
    if (!vec3TupleEquals(objectPosition, nextPosition)) {
      this.group.position.set(nextPosition[0], nextPosition[1], nextPosition[2]);
      this.group.updateMatrixWorld();
    }
    if (!vec3TupleEquals(this.position, nextPosition)) {
      this.position = nextPosition;
      this.verticalShadow?.update();
      this.positionChanged.emit(this.getPosition());
    }

    const nextHeading = getHeadingFromQuaternion(
      this.group.quaternion,
      this.headingVector,
    );
    if (Math.abs(nextHeading - this.heading) > 1e-6) {
      this.heading = nextHeading;
      this.verticalShadow?.update();
      this.headingChanged.emit(nextHeading);
    }
  }

  private constrainTransformPosition(position: Vec3Tuple): Vec3Tuple {
    if (!this.transformPositionConstraint) {
      return position;
    }
    return normalizeVec3Tuple(
      this.transformPositionConstraint([...position]),
      position,
    );
  }

  private enableVerticalShadowIfRequested(object: Object3D): void {
    const options = normalizeVerticalShadowOptions(this.specification.verticalShadow);
    if (!options.enabled || !this.coreScene.renderContext) {
      return;
    }

    this.verticalShadow = new VerticalShadowProjector(
      this.coreScene,
      this.group,
      getModelShadowDimensions(object),
      options,
    );
    this.verticalShadow.setEnabled(this.visible);
  }

  private updateTransformControlsVisibility(): void {
    const enabled =
      this.transformControlOptions.enabled &&
      this.visible &&
      (!this.transformControlOptions.selectable ||
        this.transformControlOptions.selected);
    for (const handle of this.transformControls) {
      handle.helper.visible = enabled;
      handle.controls.enabled = enabled;
    }
  }

  private updateTransformControlsAxisVisibility(): void {
    for (const handle of this.transformControls) {
      handle.controls.setMode(handle.mode);
      this.applyTransformControlsAxisVisibility(handle.controls, handle.mode);
    }
  }

  private installTransformControlArbitration(canvas: HTMLCanvasElement): void {
    if (
      this.transformControls.length < 2 ||
      this.transformControlArbitrationCleanup
    ) {
      return;
    }

    let activeHandle: TransformControlHandle | null = null;
    const restoreControls = () => {
      if (!activeHandle) {
        return;
      }
      activeHandle = null;
      this.updateTransformControlsVisibility();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !this.visible ||
        !this.transformControlOptions.enabled
      ) {
        restoreControls();
        return;
      }

      const winner = chooseTransformControlHandle(
        this.transformControls,
        event,
        canvas,
      );
      if (!winner) {
        restoreControls();
        return;
      }

      activeHandle = winner;
      for (const handle of this.transformControls) {
        const enabled = handle === winner;
        handle.controls.enabled = enabled;
        handle.helper.visible =
          this.visible && this.transformControlOptions.enabled;
        if (!enabled) {
          handle.controls.axis = null;
        }
      }
    };
    const onPointerEnd = () => {
      deferTransformControlRestore(restoreControls);
    };
    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("pointerup", onPointerEnd, true);
    canvas.addEventListener("pointercancel", onPointerEnd, true);

    this.transformControlArbitrationCleanup = () => {
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("pointerup", onPointerEnd, true);
      canvas.removeEventListener("pointercancel", onPointerEnd, true);
    };
  }

  private installTransformControlSelection(canvas: HTMLCanvasElement): void {
    if (
      !this.transformControlOptions.selectable ||
      this.transformControlSelectionCleanup ||
      !this.coreScene.renderContext
    ) {
      return;
    }

    const { camera } = this.coreScene.renderContext;
    const onClick = (event: MouseEvent) => {
      if (!this.visible || !this.transformControlOptions.enabled) {
        return;
      }

      const hitGizmo =
        this.transformControlOptions.selected &&
        chooseTransformControlHandle(this.transformControls, event, canvas) !==
          null;
      const hitModel = isObjectHit(this.group, camera, event, canvas);
      this.setTransformControlsSelected(hitGizmo || hitModel);
    };
    canvas.addEventListener("click", onClick, true);

    this.transformControlSelectionCleanup = () => {
      canvas.removeEventListener("click", onClick, true);
    };
  }

  private applyTransformControlsAxisVisibility(
    controls: TransformControls,
    mode = controls.mode,
  ): void {
    const axes =
      mode === "rotate"
        ? this.transformControlOptions.rotationAxes
        : mode === "scale"
          ? this.transformControlOptions.scaleAxes
          : this.transformControlOptions.translationAxes;
    controls.showX = axes.x;
    controls.showY = axes.y;
    controls.showZ = axes.z;
    disableUnavailableTransformControlPickers(controls, mode, axes);
  }
}

function extendTranslateAxisHandles(
  controls: TransformControls,
  mode: TransformControlsMode,
): void {
  if (mode !== "translate") {
    return;
  }

  const gizmo = getTransformControlGizmo(controls, mode);
  if (!gizmo) {
    return;
  }

  scaleTransformControlAxisGeometries(
    gizmo,
    TRANSFORM_CONTROL_TRANSLATE_AXIS_LENGTH_FACTOR,
    TRANSFORM_CONTROL_TRANSLATE_AXIS_LENGTH_USER_DATA_KEY,
  );
}

function preserveRotateRingRadiusWithExtendedTranslateHandles(
  controls: TransformControls,
  mode: TransformControlsMode,
): void {
  if (mode !== "rotate") {
    return;
  }

  const gizmo = getTransformControlGizmo(controls, mode);
  if (!gizmo) {
    return;
  }

  scaleTransformControlModeGeometries(
    gizmo,
    TRANSFORM_CONTROL_ROTATE_RING_RADIUS_FACTOR,
    TRANSFORM_CONTROL_ROTATE_RING_RADIUS_USER_DATA_KEY,
  );
}

function tightenTransformControlPicker(
  controls: TransformControls,
  mode: TransformControlsMode,
): void {
  const picker = getTransformControlPicker(controls, mode);
  if (!picker) {
    return;
  }

  const factor = TRANSFORM_CONTROL_PICKER_SCALE[mode];
  if (factor === undefined) {
    return;
  }
  picker.traverse((object) => {
    const geometry = (object as Object3D & { geometry?: BufferGeometry })
      .geometry;
    if (!geometry) {
      return;
    }

    scaleTransformControlPickerGeometry(
      geometry,
      factor,
      TRANSFORM_CONTROL_PICKER_SCALE_USER_DATA_KEY,
    );
  });
}

function scaleTransformControlModeGeometries(
  root: Object3D,
  factor: number,
  userDataKey: string,
): void {
  root.traverse((object) => {
    const geometry = (object as Object3D & { geometry?: BufferGeometry })
      .geometry;
    if (!geometry) {
      return;
    }

    const userData = geometry.userData as Record<string, unknown>;
    if (userData[userDataKey]) {
      return;
    }

    geometry.scale(factor, factor, factor);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    userData[userDataKey] = factor;
  });
}

function scaleTransformControlAxisGeometries(
  root: Object3D,
  factor: number,
  userDataKey: string,
): void {
  root.traverse((object) => {
    const axis = normalizeSingleTransformControlAxis(object.name);
    const geometry = (object as Object3D & { geometry?: BufferGeometry })
      .geometry;
    if (!axis || !geometry) {
      return;
    }

    const userData = geometry.userData as Record<string, unknown>;
    if (userData[userDataKey]) {
      return;
    }

    geometry.scale(
      axis === "X" ? factor : 1,
      axis === "Y" ? factor : 1,
      axis === "Z" ? factor : 1,
    );
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    userData[userDataKey] = factor;
  });
}

function disableUnavailableTransformControlPickers(
  controls: TransformControls,
  mode: TransformControlsMode,
  axes: Required<TransformControlAxisOptions>,
): void {
  const picker = getTransformControlPicker(controls, mode);
  if (!picker) {
    return;
  }

  picker.traverse((object) => {
    const geometry = (object as Object3D & { geometry?: BufferGeometry })
      .geometry;
    if (!geometry || isTransformControlAxisAvailable(object.name, axes)) {
      return;
    }

    scaleTransformControlPickerGeometry(
      geometry,
      TRANSFORM_CONTROL_PICKER_DISABLED_SCALE,
      TRANSFORM_CONTROL_PICKER_DISABLED_SCALE_USER_DATA_KEY,
    );
  });
}

function scaleTransformControlPickerGeometry(
  geometry: BufferGeometry,
  factor: number,
  userDataKey: string,
): void {
  const userData = geometry.userData as Record<string, unknown>;
  if (userData[userDataKey]) {
    return;
  }

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) {
    return;
  }

  const center = bounds.getCenter(new Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(factor, factor, factor);
  geometry.translate(center.x, center.y, center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  userData[userDataKey] = factor;
}

function chooseTransformControlHandle(
  handles: TransformControlHandle[],
  event: Pick<MouseEvent, "clientX" | "clientY">,
  canvas: HTMLCanvasElement,
): TransformControlHandle | null {
  const pointer = getCanvasPointer(event, canvas);
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
}

function getTransformControlPickHit(
  handle: TransformControlHandle,
  pointer: Vector2,
): TransformControlPickHit | null {
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
  const raycaster = new Raycaster();
  raycaster.setFromCamera(pointer, handle.controls.camera);
  const intersection = raycaster
    .intersectObject(picker, true)
    .find((hit) => hit.object.visible);
  if (!intersection) {
    return null;
  }

  const axis = normalizeTransformControlAxis(intersection.object.name);
  if (!axis) {
    return null;
  }

  return {
    handle,
    axis,
    distance: intersection.distance,
    priority: getTransformControlHitPriority(handle.mode, axis),
  };
}

function getTransformControlPicker(
  controls: TransformControls,
  mode: TransformControlsMode,
): Object3D | null {
  return (
    ((controls as unknown as TransformControlsPrivateGizmo)._gizmo?.picker?.[
      mode
    ] as Object3D | undefined) ?? null
  );
}

function getTransformControlGizmo(
  controls: TransformControls,
  mode: TransformControlsMode,
): Object3D | null {
  return (
    ((controls as unknown as TransformControlsPrivateGizmo)._gizmo?.gizmo?.[
      mode
    ] as Object3D | undefined) ?? null
  );
}

function getCanvasPointer(
  event: Pick<MouseEvent, "clientX" | "clientY">,
  canvas: HTMLCanvasElement,
): Vector2 {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.clientWidth || canvas.width || 1;
  const height = rect.height || canvas.clientHeight || canvas.height || 1;
  return new Vector2(
    ((event.clientX - rect.left) / width) * 2 - 1,
    -((event.clientY - rect.top) / height) * 2 + 1,
  );
}

function isObjectHit(
  object: Object3D,
  camera: Camera,
  event: Pick<MouseEvent, "clientX" | "clientY">,
  canvas: HTMLCanvasElement,
): boolean {
  object.updateMatrixWorld(true);
  camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  raycaster.setFromCamera(getCanvasPointer(event, canvas), camera);
  return raycaster
    .intersectObject(object, true)
    .some((hit) => hit.object.visible);
}

function normalizeTransformControlAxis(
  value: string,
): TransformControls["axis"] {
  switch (value) {
    case "X":
    case "Y":
    case "Z":
    case "E":
    case "XY":
    case "YZ":
    case "XZ":
    case "XYZ":
    case "XYZE":
      return value;
    default:
      return null;
  }
}

function normalizeSingleTransformControlAxis(value: string): "X" | "Y" | "Z" | null {
  return value === "X" || value === "Y" || value === "Z" ? value : null;
}

function getTransformControlHitPriority(
  mode: TransformControlsMode,
  axis: TransformControls["axis"],
): number {
  if (mode === "rotate") {
    return axis === "X" || axis === "Y" || axis === "Z" ? 30 : 10;
  }
  if (mode === "translate") {
    return axis === "X" || axis === "Y" || axis === "Z" ? 20 : 5;
  }
  return 0;
}

function isTransformControlAxisAvailable(
  name: string,
  axes: Required<TransformControlAxisOptions>,
): boolean {
  if (name.includes("X") && !axes.x) {
    return false;
  }
  if (name.includes("Y") && !axes.y) {
    return false;
  }
  if (name.includes("Z") && !axes.z) {
    return false;
  }
  if (name.includes("E") && (!axes.x || !axes.y || !axes.z)) {
    return false;
  }
  return true;
}

function deferTransformControlRestore(callback: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }
  setTimeout(callback, 0);
}

export class VesselFeature {
  private readonly views = new Set<VesselView>();

  constructor(
    private readonly coreScene: CoreS100Scene,
    private readonly config: ViewerConfig = {},
    private readonly setNavigationEnabled: (enabled: boolean) => void = () => {},
    private readonly vesselTerrainShadows: VesselTerrainShadowRegistry =
      new VesselTerrainShadowRegistry(),
  ) {}

  add(specification: VesselSpecification): VesselView {
    const view = new VesselView(
      specification,
      this.coreScene,
      this.config,
      this.setNavigationEnabled,
      this.vesselTerrainShadows,
      () => {
        this.views.delete(view);
      },
    );
    this.views.add(view);
    return view;
  }

  remove(view: VesselView): void {
    view.destroy();
  }

  destroy(): void {
    for (const view of [...this.views]) {
      view.destroy();
    }
  }
}

export class VesselView {
  readonly positionChanged = new EventEmitter<Vec3Tuple>();
  readonly model: VesselDimensions;
  readonly seaLevelIndicator: {
    mode: SeaLevelIndicatorMode;
    seaSurfaceVisible: boolean;
    setSeaSurfaceVisible(visible: boolean): void;
  };
  readonly transformControls: TransformControlsFacade;
  readonly verticalShadowControl: {
    visible: boolean;
    setVisible(visible: boolean): void;
  };
  readonly modelView: CustomModelView;
  visible = true;

  private readonly coreScene: CoreS100Scene;
  private readonly seaLevelSubscription: Subscription | null = null;
  private readonly modelPositionSubscription: Subscription;
  private readonly modelHeadingSubscription: Subscription;
  private readonly seaSurfaceFrameSubscription: FrameSubscription | null = null;
  private readonly indicator: Mesh<RingGeometry, MeshBasicMaterial> | null;
  private readonly seaSurface: Mesh<CircleGeometry, MeshPhysicalMaterial> | null;
  private readonly verticalShadow: VerticalShadowProjector | null;
  private readonly sharedShadow: SharedVesselTerrainShadow | null;
  private position: Vec3Tuple = [0, 0, 0];
  private verticalPositionLimits: VesselVerticalPositionLimits | null = null;
  private seaLevelIndicatorMode = SeaLevelIndicatorMode.Off;
  private seaSurfaceVisible = false;
  private verticalShadowVisible = true;
  private destroyed = false;

  constructor(
    readonly specification: VesselSpecification,
    coreScene: CoreS100Scene,
    config: ViewerConfig,
    setNavigationEnabled: (enabled: boolean) => void,
    vesselTerrainShadows: VesselTerrainShadowRegistry,
    private readonly onDestroy: () => void,
  ) {
    this.coreScene = coreScene;
    this.model = specification.dimensions;
    this.verticalPositionLimits = normalizeVesselVerticalPositionLimits(
      specification.verticalPositionLimits,
    );
    const vessel = this;
    this.seaLevelIndicator = {
      get mode() {
        return vessel.seaLevelIndicatorMode;
      },
      set mode(mode: SeaLevelIndicatorMode) {
        vessel.setSeaLevelIndicatorMode(mode);
      },
      get seaSurfaceVisible() {
        return vessel.seaSurfaceVisible;
      },
      set seaSurfaceVisible(visible: boolean) {
        vessel.setSeaSurfaceVisible(visible);
      },
      setSeaSurfaceVisible(visible: boolean) {
        vessel.setSeaSurfaceVisible(visible);
      },
    };
    this.transformControls = {
      get mode() {
        return vessel.modelView.getTransformMode();
      },
      set mode(mode: TransformControlsMode) {
        vessel.modelView.setTransformMode(mode);
      },
      setMode(mode: TransformControlsMode) {
        vessel.modelView.setTransformMode(mode);
      },
    };
    this.verticalShadowControl = {
      get visible() {
        return vessel.verticalShadowVisible;
      },
      set visible(visible: boolean) {
        vessel.setVerticalShadowVisible(visible);
      },
      setVisible(visible: boolean) {
        vessel.setVerticalShadowVisible(visible);
      },
    };
    this.modelView = new CustomModelView(
      {
        ...specification.model,
        ...createVesselModelTransform(specification),
        environmentIntensity: DEFAULT_VESSEL_ENVIRONMENT_INTENSITY,
        materialBrightness: DEFAULT_VESSEL_MATERIAL_BRIGHTNESS,
        transformControls: {
          enabled: true,
          mode: "translate",
          modes: ["translate", "rotate"],
          selectable: true,
          selected: false,
          size: DEFAULT_TRANSFORM_CONTROL_SIZE,
          rotationAxes: {
            x: false,
            y: false,
            z: true,
          },
        },
        transformPositionConstraint: (position) =>
          vessel.constrainTransformRenderPosition(position),
      },
      coreScene,
      config,
      setNavigationEnabled,
      () => {},
    );
    this.indicator = createSeaLevelIndicator(specification.dimensions);
    if (this.indicator) {
      coreScene.renderContext?.scene.add(this.indicator);
    }
    this.seaSurface = createSeaLevelSurface(
      specification.dimensions,
      coreScene.renderContext?.environmentMap ?? null,
      coreScene.renderContext?.scene.environmentRotation,
    );
    const seaSurface = this.seaSurface;
    if (seaSurface) {
      coreScene.renderContext?.scene.add(seaSurface);
      this.seaSurfaceFrameSubscription = coreScene.onBeforeRender(() => {
        updateSeaLevelSurfaceAnimation(seaSurface);
      });
    }
    const shadow = normalizeVesselShadowSpecification(specification.shadow);
    this.verticalShadowVisible = shadow.enabled;
    this.verticalShadow = coreScene.renderContext && shadow.enabled && shadow.mode === "high-quality"
      ? new VerticalShadowProjector(
          coreScene,
          this.modelView.group,
          specification.dimensions,
          shadow,
        )
      : null;
    this.sharedShadow = coreScene.renderContext && shadow.enabled && shadow.mode === "shared-texture"
      ? new SharedVesselTerrainShadow(
          vesselTerrainShadows,
          this.modelView.group,
          specification.dimensions,
          shadow,
        )
      : null;
    this.seaLevelSubscription = coreScene.seaLevelChanged.subscribe(() => {
      this.updateSeaLevelVisuals(coreScene.seaLevel);
    });
    this.modelPositionSubscription = this.modelView.positionChanged.subscribe(
      (renderPosition) => {
        this.position = [
          renderPosition[0],
          renderPosition[1],
          vesselPoseZFromRenderedEngineZ(renderPosition[2], coreScene.seaLevel),
        ];
        this.updateSeaLevelVisuals(coreScene.seaLevel);
        this.positionChanged.emit(this.getPosition());
      },
    );
    this.modelHeadingSubscription = this.modelView.headingChanged.subscribe(
      () => {
        this.updateSeaLevelVisuals(coreScene.seaLevel);
      },
    );
    this.updateSeaLevelVisuals(coreScene.seaLevel);
  }

  getPosition(): Vec3Tuple {
    return [...this.position];
  }

  setPosition(position: Vec3Tuple): void {
    this.position = normalizeVec3Tuple(position, this.position);
    this.modelView.setPosition(this.getRenderPosition());
  }

  getHeading(): number {
    return this.modelView.getHeading();
  }

  setHeading(heading: number): void {
    this.modelView.setHeading(heading);
  }

  setDimensions(dimensions: VesselDimensions): void {
    Object.assign(this.model, dimensions);
  }

  setVerticalPositionLimits(limits: VesselVerticalPositionLimits | undefined): void {
    this.verticalPositionLimits = normalizeVesselVerticalPositionLimits(limits);
  }

  setWidth(width: number): void {
    const halfWidth = width / 2;
    this.model.port = halfWidth;
    this.model.starboard = halfWidth;
  }

  setLength(length: number): void {
    this.model.bow = length / 2;
    this.model.stern = length / 2;
  }

  setVisibility(visible: boolean): void {
    this.visible = visible;
    this.modelView.setVisibility(visible);
    this.updateSeaLevelIndicatorVisibility();
    this.updateVerticalShadowVisibility();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.seaLevelSubscription?.unsubscribe();
    this.modelPositionSubscription.unsubscribe();
    this.modelHeadingSubscription.unsubscribe();
    this.seaSurfaceFrameSubscription?.unsubscribe();
    this.verticalShadow?.dispose();
    this.indicator?.geometry.dispose();
    this.indicator?.material.dispose();
    this.indicator?.parent?.remove(this.indicator);
    this.seaSurface?.geometry.dispose();
    this.seaSurface?.material.bumpMap?.dispose();
    this.seaSurface?.material.dispose();
    this.seaSurface?.parent?.remove(this.seaSurface);
    this.sharedShadow?.dispose();
    this.modelView.destroy();
    this.positionChanged.clear();
    this.onDestroy();
  }

  private setSeaLevelIndicatorMode(mode: SeaLevelIndicatorMode): void {
    this.seaLevelIndicatorMode = mode;
    this.updateSeaLevelIndicatorVisibility();
  }

  private setSeaSurfaceVisible(visible: boolean): void {
    this.seaSurfaceVisible = visible;
    this.updateSeaLevelIndicatorVisibility();
  }

  setVerticalShadowVisible(visible: boolean): void {
    this.verticalShadowVisible = visible;
    this.updateVerticalShadowVisibility();
  }

  private updateSeaLevelVisuals(seaLevel: number): void {
    const renderPosition = this.getRenderPosition();
    const currentRenderPosition = this.modelView.getPosition();
    if (!vec3TupleEquals(renderPosition, currentRenderPosition)) {
      this.modelView.setPosition(renderPosition);
      return;
    }
    if (this.indicator) {
      const centerOffset = getVesselCenterOffset(this.model);
      centerOffset.applyQuaternion(this.modelView.group.quaternion);
      const centerX = renderPosition[0] + centerOffset.x;
      const centerY = renderPosition[1] + centerOffset.y;
      this.indicator.position.set(centerX, centerY, seaLevel);
      this.indicator.quaternion.identity();
      if (this.seaSurface) {
        this.seaSurface.position.set(
          centerX,
          centerY,
          seaLevel + SEA_LEVEL_SURFACE_Z_OFFSET,
        );
        this.seaSurface.quaternion.identity();
      }
    }
    this.verticalShadow?.update();
    this.sharedShadow?.update();
  }

  private updateSeaLevelIndicatorVisibility(): void {
    if (this.indicator) {
      this.indicator.visible =
        this.visible && this.seaLevelIndicatorMode === SeaLevelIndicatorMode.Circle;
    }
    if (this.seaSurface) {
      this.seaSurface.visible =
        this.visible &&
        this.seaSurfaceVisible &&
        this.seaLevelIndicatorMode === SeaLevelIndicatorMode.Circle;
    }
  }

  private updateVerticalShadowVisibility(): void {
    const enabled = this.visible && this.verticalShadowVisible;
    this.verticalShadow?.setEnabled(enabled);
    this.sharedShadow?.setEnabled(enabled);
  }

  private getRenderPosition(): Vec3Tuple {
    return [
      this.position[0],
      this.position[1],
      renderedEngineZFromVesselPose(this.position[2], this.coreScene.seaLevel),
    ];
  }

  private constrainTransformRenderPosition(renderPosition: Vec3Tuple): Vec3Tuple {
    const positionZ = vesselPoseZFromRenderedEngineZ(renderPosition[2], this.coreScene.seaLevel);
    const constrainedPositionZ = this.verticalPositionLimits
      ? constrainVesselPoseZ(
          positionZ,
          this.verticalPositionLimits,
          this.coreScene.seaLevel,
        )
      : positionZ;
    if (Object.is(positionZ, constrainedPositionZ)) {
      return renderPosition;
    }
    return [
      renderPosition[0],
      renderPosition[1],
      renderedEngineZFromVesselPose(constrainedPositionZ, this.coreScene.seaLevel),
    ];
  }
}

class VerticalShadowProjector {
  private readonly light = new DirectionalLight(
    0xffffff,
    DEFAULT_VERTICAL_SHADOW_INTENSITY,
  );
  private readonly target = new Group();
  private readonly seaLevelSubscription: Subscription;
  private readonly minimumRadius: number;
  private readonly shadowBounds = new Box3();
  private readonly shadowCenter = new Vector3();
  private readonly shadowSize = new Vector3();
  private enabled = true;

  constructor(
    private readonly coreScene: CoreS100Scene,
    private readonly object: Object3D,
    dimensions: VesselDimensions,
    options: VerticalShadowOptions = {},
  ) {
    const scene = coreScene.renderContext?.scene;
    this.minimumRadius = normalizePositiveNumber(
      options.radius,
      getVesselShadowRadius(dimensions),
    );
    const height = normalizePositiveNumber(
      options.height,
      DEFAULT_VERTICAL_SHADOW_HEIGHT,
    );
    const far = normalizePositiveNumber(options.far, DEFAULT_VERTICAL_SHADOW_FAR);
    const mapSize = normalizePositiveNumber(
      options.mapSize,
      DEFAULT_VERTICAL_SHADOW_MAP_SIZE,
    );

    this.enabled = options.enabled !== false;
    this.light.name = "s100-vessel-vertical-shadow-light";
    this.target.name = "s100-vessel-vertical-shadow-target";
    this.light.castShadow = true;
    this.light.intensity = normalizePositiveNumber(
      options.intensity,
      DEFAULT_VERTICAL_SHADOW_INTENSITY,
    );
    this.light.target = this.target;
    this.light.shadow.mapSize.set(mapSize, mapSize);
    this.setShadowCameraRadius(this.minimumRadius);
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.camera.far = far;
    this.light.shadow.camera.updateProjectionMatrix();
    this.light.userData.s100VerticalShadowHeight = height;

    if (scene) {
      scene.add(this.target);
      scene.add(this.light);
    }
    this.seaLevelSubscription = coreScene.seaLevelChanged.subscribe(() => {
      this.update();
    });
    this.update();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.light.visible = enabled;
    this.target.visible = enabled;
  }

  update(): void {
    const shadowCenter = this.getShadowCenter();
    const seaLevel = this.coreScene.seaLevel;
    const height = normalizePositiveNumber(
      this.light.userData.s100VerticalShadowHeight,
      DEFAULT_VERTICAL_SHADOW_HEIGHT,
    );
    this.setShadowCameraRadius(this.getShadowCameraRadius());
    this.light.position.set(
      shadowCenter.x,
      shadowCenter.y,
      seaLevel + height,
    );
    this.target.position.set(shadowCenter.x, shadowCenter.y, seaLevel - height);
    this.target.updateMatrixWorld(true);
    this.light.updateMatrixWorld(true);
    this.light.shadow.camera.updateMatrixWorld(true);
    this.light.shadow.needsUpdate = true;
    this.setEnabled(this.enabled);
  }

  private getShadowCenter(): Vector3 {
    this.object.updateMatrixWorld(true);
    this.shadowBounds.setFromObject(this.object);
    if (this.shadowBounds.isEmpty()) {
      return this.object.getWorldPosition(this.shadowCenter);
    }
    return this.shadowBounds.getCenter(this.shadowCenter);
  }

  private getShadowCameraRadius(): number {
    if (this.shadowBounds.isEmpty()) {
      return this.minimumRadius * DEFAULT_VERTICAL_SHADOW_RADIUS_PADDING_FACTOR;
    }
    const size = this.shadowBounds.getSize(this.shadowSize);
    const boundsRadius =
      Math.hypot(size.x, size.y) *
      0.5 *
      DEFAULT_VERTICAL_SHADOW_BOUNDS_PADDING_FACTOR;
    return Math.max(
      this.minimumRadius * DEFAULT_VERTICAL_SHADOW_RADIUS_PADDING_FACTOR,
      boundsRadius,
    );
  }

  private setShadowCameraRadius(radius: number): void {
    const camera = this.light.shadow.camera;
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    camera.updateProjectionMatrix();
    this.light.shadow.needsUpdate = true;
  }

  dispose(): void {
    this.seaLevelSubscription.unsubscribe();
    this.light.parent?.remove(this.light);
    this.target.parent?.remove(this.target);
    this.light.dispose();
  }
}

class SharedVesselTerrainShadow {
  private readonly key = {};
  private readonly worldPosition = new Vector3();
  private enabled = true;

  constructor(
    private readonly vesselTerrainShadows: VesselTerrainShadowRegistry,
    private readonly object: Object3D,
    private readonly dimensions: VesselDimensions,
    private readonly options: VesselShadowSpecification = {},
  ) {
    this.update();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.vesselTerrainShadows.removeStamp(this.key);
      return;
    }
    this.update();
  }

  update(): void {
    if (!this.enabled) {
      this.vesselTerrainShadows.removeStamp(this.key);
      return;
    }

    this.object.updateMatrixWorld(true);
    this.object.getWorldPosition(this.worldPosition);
    const headingRadians = MathUtils.degToRad(
      -getHeadingFromQuaternion(this.object.quaternion),
    );
    const footprint = this.getFootprintDimensions();
    this.vesselTerrainShadows.setStamp(this.key, {
      x: this.worldPosition.x,
      y: this.worldPosition.y,
      bowMeters: footprint.bow,
      sternMeters: footprint.stern,
      portMeters: footprint.port,
      starboardMeters: footprint.starboard,
      headingRadians,
      opacity: normalizeUnitInterval(
        this.options.opacity,
        DEFAULT_SHARED_VESSEL_SHADOW_OPACITY,
      ),
      softness: normalizeUnitInterval(
        this.options.softness,
        DEFAULT_SHARED_VESSEL_SHADOW_SOFTNESS,
      ),
    });
  }

  dispose(): void {
    this.vesselTerrainShadows.removeStamp(this.key);
  }

  private getFootprintDimensions(): VesselDimensions {
    const uniformRadius = normalizePositiveNumber(
      this.options.radiusMeters ?? this.options.radius,
      0,
    );
    if (uniformRadius > 0) {
      return {
        ...this.dimensions,
        bow: uniformRadius,
        stern: uniformRadius,
        port: uniformRadius,
        starboard: uniformRadius,
      };
    }
    return {
      ...this.dimensions,
      bow: this.dimensions.bow * SHARED_VESSEL_SHADOW_FOOTPRINT_PADDING_FACTOR,
      stern: this.dimensions.stern * SHARED_VESSEL_SHADOW_FOOTPRINT_PADDING_FACTOR,
      port: this.dimensions.port * SHARED_VESSEL_SHADOW_FOOTPRINT_PADDING_FACTOR,
      starboard: this.dimensions.starboard * SHARED_VESSEL_SHADOW_FOOTPRINT_PADDING_FACTOR,
    };
  }
}

class PickingFeature {
  readonly Mousemove = new EventEmitter<PickedInfo>();
  readonly MouseSelect = new EventEmitter<PickedInfo>();
  readonly SelectionChanged = new EventEmitter<PickedInfo>();
  private readonly controller: PickingController | null;

  constructor(
    coreScene: CoreS100Scene | null = null,
    pickingRay: PickingRayFeature | null = null,
  ) {
    this.controller = coreScene
      ? new PickingController(coreScene, this, pickingRay)
      : null;
  }

  destroy(): void {
    this.controller?.destroy();
    this.Mousemove.clear();
    this.MouseSelect.clear();
    this.SelectionChanged.clear();
  }
}

class PickingRayFeature {
  private currentEnabled = false;
  private currentLineThickness = 1;
  readonly changed = new EventEmitter<void>();
  readonly ray = {
    belowSeaLevelColor: [0, 0, 1] as [number, number, number],
    aboveSeaLevelColor: [
      ...PICKING_RAY_DEFAULT_ABOVE_SEA_COLOR,
    ] as [number, number, number],
    seaLevelMarkerVisible: false,
    seaLevelMarkerSize: 60,
    seaLevelMarkerOpacity: 0.6,
    seaLevelMarkerColor: [1, 1, 0.3] as [number, number, number],
  };

  get enabled(): boolean {
    return this.currentEnabled;
  }

  set enabled(enabled: boolean) {
    const nextEnabled = Boolean(enabled);
    if (nextEnabled === this.currentEnabled) {
      return;
    }
    this.currentEnabled = nextEnabled;
    this.changed.emit();
  }

  get lineThickness(): number {
    return this.currentLineThickness;
  }

  set lineThickness(lineThickness: number) {
    const nextLineThickness = normalizePositiveNumber(lineThickness, 1);
    if (Math.abs(nextLineThickness - this.currentLineThickness) < 1e-6) {
      return;
    }
    this.currentLineThickness = nextLineThickness;
    this.changed.emit();
  }
}

class PickingController {
  private readonly renderContext: S100RenderContext | null;
  private readonly raycaster = new Raycaster();
  private readonly rayVisual: PickingRayVisual | null;
  private readonly pickingRaySubscription: Subscription | null = null;
  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.coreScene.isDestroyed) {
      return;
    }

    const shouldRenderRay = this.pickingRay?.enabled === true;
    const shouldEmitPicking = this.picking.Mousemove.size > 0;
    if (!shouldRenderRay && !shouldEmitPicking) {
      this.rayVisual?.hide();
      return;
    }

    const pick = this.pick(event);
    if (shouldRenderRay) {
      this.rayVisual?.update(pick, this.coreScene.seaLevel, this.pickingRay);
    } else {
      this.rayVisual?.hide();
    }
    if (shouldEmitPicking) {
      this.picking.Mousemove.emit(pick);
    }
  };

  constructor(
    private readonly coreScene: CoreS100Scene,
    private readonly picking: PickingFeature,
    private readonly pickingRay: PickingRayFeature | null = null,
  ) {
    this.renderContext = coreScene.renderContext;
    this.rayVisual =
      this.renderContext && pickingRay
        ? new PickingRayVisual(this.renderContext)
        : null;
    this.pickingRaySubscription = pickingRay
      ? pickingRay.changed.subscribe(() => {
          if (!pickingRay.enabled) {
            this.rayVisual?.hide();
          }
        })
      : null;
    this.renderContext?.canvas.addEventListener(
      "pointermove",
      this.handlePointerMove,
    );
  }

  destroy(): void {
    this.pickingRaySubscription?.unsubscribe();
    this.renderContext?.canvas.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );
    this.rayVisual?.dispose();
  }

  private pick(event: Pick<PointerEvent, "clientX" | "clientY">): PickedInfo {
    const renderContext = this.renderContext;
    if (!renderContext) {
      return createInvalidPick(this.coreScene.seaLevel);
    }

    const { camera, canvas, scene } = renderContext;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    this.raycaster.setFromCamera(getCanvasPointer(event, canvas), camera);

    const geometryHit = this.pickGeometry(scene);
    if (geometryHit) {
      return createGeometryPick(geometryHit, this.coreScene.seaLevel);
    }

    const seaPlanePoint = getSeaLevelRayPoint(
      this.raycaster,
      this.coreScene.seaLevel,
    );
    if (seaPlanePoint) {
      return {
        isValid: true,
        hasDepth: false,
        xyz: vectorToTuple(seaPlanePoint),
        seaLevel: this.coreScene.seaLevel,
        source: "sea-level-plane",
      };
    }

    return createInvalidPick(this.coreScene.seaLevel);
  }

  private pickGeometry(scene: Object3D): PickingGeometryHit | null {
    const roots = getPickableSceneRoots(scene);
    if (roots.length === 0) {
      return null;
    }

    const intersection = this.raycaster
      .intersectObjects(roots, true)
      .find((hit) => {
        const root = getPickableRootForObject(hit.object);
        return (
          root !== null &&
          isObjectVisibleInHierarchy(hit.object, root) &&
          isFiniteVector(hit.point)
        );
      });
    if (!intersection) {
      return null;
    }

    const root = getPickableRootForObject(intersection.object);
    if (!root) {
      return null;
    }

    return {
      object: intersection.object,
      point: intersection.point,
      root,
    };
  }
}

class PickingRayVisual {
  private readonly group = new Group();
  private readonly belowGeometry = new LineGeometry();
  private readonly aboveGeometry = new LineGeometry();
  private readonly belowSeafloorGeometry = new LineGeometry();
  private readonly belowMaterial = createPickingRayLineMaterial([0, 0, 1]);
  private readonly aboveMaterial = createPickingRayLineMaterial(
    PICKING_RAY_DEFAULT_ABOVE_SEA_COLOR,
  );
  private readonly belowSeafloorMaterial = createPickingRayLineMaterial(
    PICKING_RAY_DEFAULT_ABOVE_SEA_COLOR,
    true,
  );
  private readonly belowLine = new Line2(
    this.belowGeometry,
    this.belowMaterial,
  );
  private readonly aboveLine = new Line2(
    this.aboveGeometry,
    this.aboveMaterial,
  );
  private readonly belowSeafloorLine = new Line2(
    this.belowSeafloorGeometry,
    this.belowSeafloorMaterial,
  );
  private readonly markerMaterial = new MeshBasicMaterial({
    color: rgbTupleToHex(PICKING_RAY_DEFAULT_ABOVE_SEA_COLOR),
    depthTest: false,
    depthWrite: false,
    opacity: 0.6,
    side: DoubleSide,
    transparent: true,
  });
  private readonly marker = new Mesh(
    createPickingRayMarkerGeometry(60),
    this.markerMaterial,
  );
  private markerSize = 60;

  constructor(private readonly renderContext: S100RenderContext) {
    this.group.name = "s100-picking-ray";
    this.group.userData[UNPICKABLE_OBJECT_USER_DATA_KEY] = true;
    this.group.visible = false;
    this.group.renderOrder = 2000;

    this.belowLine.name = "s100-picking-ray-below";
    this.aboveLine.name = "s100-picking-ray-above";
    this.belowSeafloorLine.name = "s100-picking-ray-below-seafloor";
    this.marker.name = "s100-picking-ray-sea-level-marker";
    for (const object of [
      this.belowLine,
      this.aboveLine,
      this.belowSeafloorLine,
      this.marker,
    ]) {
      object.userData[UNPICKABLE_OBJECT_USER_DATA_KEY] = true;
      object.frustumCulled = false;
      object.renderOrder = 2000;
      object.visible = false;
      this.group.add(object);
    }

    this.renderContext.scene.add(this.group);
  }

  update(
    pick: PickedInfo,
    seaLevel: number,
    pickingRay: PickingRayFeature,
  ): void {
    if (!pick.isValid || pick.source === "none" || !isFiniteVec3Tuple(pick.xyz)) {
      this.hide();
      return;
    }

    this.updateMaterials(pickingRay);
    const x = pick.xyz[0];
    const y = pick.xyz[1];
    const topZ = getPickingRayTopZ(seaLevel);
    const bottomZ = getPickingRayBottomZ(seaLevel);
    const hasDepthSegment = pick.hasDepth === true && pick.xyz[2] < seaLevel;

    updatePickingRayLine(
      this.belowLine,
      this.belowGeometry,
      [x, y, pick.xyz[2]],
      [x, y, seaLevel],
      hasDepthSegment,
    );
    updatePickingRayLine(
      this.aboveLine,
      this.aboveGeometry,
      [x, y, seaLevel],
      [x, y, topZ],
      topZ > seaLevel,
    );
    updatePickingRayLine(
      this.belowSeafloorLine,
      this.belowSeafloorGeometry,
      [x, y, bottomZ],
      [x, y, pick.xyz[2]],
      hasDepthSegment && bottomZ < pick.xyz[2],
    );
    this.updateSeaLevelMarker(x, y, seaLevel, pickingRay);
    this.group.visible =
      this.aboveLine.visible ||
      this.belowLine.visible ||
      this.belowSeafloorLine.visible;
    this.group.visible = this.group.visible || this.marker.visible;
  }

  hide(): void {
    this.group.visible = false;
    this.belowLine.visible = false;
    this.aboveLine.visible = false;
    this.belowSeafloorLine.visible = false;
    this.marker.visible = false;
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    this.belowGeometry.dispose();
    this.aboveGeometry.dispose();
    this.belowSeafloorGeometry.dispose();
    this.belowMaterial.dispose();
    this.aboveMaterial.dispose();
    this.belowSeafloorMaterial.dispose();
    this.marker.geometry.dispose();
    this.markerMaterial.dispose();
  }

  private updateMaterials(pickingRay: PickingRayFeature): void {
    const resolution = getPickingRayResolution(this.renderContext.canvas);
    updatePickingRayLineMaterial(
      this.belowMaterial,
      pickingRay.ray.belowSeaLevelColor,
      pickingRay.lineThickness,
      resolution,
    );
    updatePickingRayLineMaterial(
      this.aboveMaterial,
      pickingRay.ray.aboveSeaLevelColor,
      pickingRay.lineThickness,
      resolution,
    );
    updatePickingRayLineMaterial(
      this.belowSeafloorMaterial,
      pickingRay.ray.aboveSeaLevelColor,
      pickingRay.lineThickness,
      resolution,
    );
  }

  private updateSeaLevelMarker(
    x: number,
    y: number,
    seaLevel: number,
    pickingRay: PickingRayFeature,
  ): void {
    const size = normalizePositiveNumber(
      pickingRay.ray.seaLevelMarkerSize,
      this.markerSize,
    );
    if (Math.abs(size - this.markerSize) > 1e-6) {
      this.marker.geometry.dispose();
      this.marker.geometry = createPickingRayMarkerGeometry(size);
      this.markerSize = size;
    }

    this.markerMaterial.color.setHex(
      rgbTupleToHex(pickingRay.ray.seaLevelMarkerColor),
    );
    this.markerMaterial.opacity = normalizeOpacity(
      pickingRay.ray.seaLevelMarkerOpacity,
    );
    this.markerMaterial.needsUpdate = true;
    this.marker.position.set(x, y, seaLevel);
    this.marker.visible =
      pickingRay.ray.seaLevelMarkerVisible && this.markerMaterial.opacity > 0;
  }
}

type PickingGeometryHit = {
  object: Object3D;
  point: Vector3;
  root: Object3D;
};

function createGeometryPick(
  hit: PickingGeometryHit,
  seaLevel: number,
): PickedInfo {
  return {
    isValid: true,
    hasDepth: true,
    xyz: vectorToTuple(hit.point),
    seaLevel,
    source: "geometry",
    entity: hit.object,
    view: hit.root,
  };
}

function createInvalidPick(seaLevel: number): PickedInfo {
  return {
    isValid: false,
    hasDepth: false,
    xyz: [0, 0, 0],
    seaLevel,
    source: "none",
  };
}

function getSeaLevelRayPoint(
  raycaster: Raycaster,
  seaLevel: number,
): Vector3 | null {
  const denominator = raycaster.ray.direction.z;
  if (Math.abs(denominator) < 1e-6) {
    return null;
  }

  const distance = (seaLevel - raycaster.ray.origin.z) / denominator;
  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  const point = raycaster.ray.origin
    .clone()
    .addScaledVector(raycaster.ray.direction, distance);
  point.z = seaLevel;
  return point;
}

function getPickableSceneRoots(scene: Object3D): Object3D[] {
  const roots: Object3D[] = [];
  for (const child of scene.children) {
    collectPickableSceneRoots(child, roots);
  }
  return roots;
}

function collectPickableSceneRoots(
  object: Object3D,
  roots: Object3D[],
): void {
  if (isObjectMarkedUnpickable(object)) {
    return;
  }
  if (isObjectMarkedPickable(object)) {
    roots.push(object);
    return;
  }

  for (const child of object.children) {
    collectPickableSceneRoots(child, roots);
  }
}

function getPickableRootForObject(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  let pickableRoot: Object3D | null = null;
  while (current) {
    if (isObjectMarkedUnpickable(current)) {
      return null;
    }
    if (isObjectMarkedPickable(current)) {
      pickableRoot = current;
    }
    current = current.parent;
  }
  return pickableRoot;
}

function isObjectMarkedPickable(object: Object3D): boolean {
  return (
    object.userData[PICKABLE_OBJECT_USER_DATA_KEY] === true ||
    object.name.startsWith("s100-terrain:") ||
    object.name.startsWith("s100-model:")
  );
}

function isObjectMarkedUnpickable(object: Object3D): boolean {
  return (
    object.userData[UNPICKABLE_OBJECT_USER_DATA_KEY] === true ||
    object.name.startsWith("s100-map:") ||
    object.name.startsWith("s100-map-tile:") ||
    object.name.startsWith("s100-model-transform:") ||
    object.name.startsWith("s100-hover-prism") ||
    object.name.startsWith("s100-current")
  );
}

function isObjectVisibleInHierarchy(object: Object3D, root: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) {
      return false;
    }
    if (current === root) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isFiniteVector(vector: Vector3): boolean {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}

function vectorToTuple(vector: Vector3): Vec3Tuple {
  return [vector.x, vector.y, vector.z];
}

function createPickingRayLineMaterial(
  color: [number, number, number],
  depthTest = false,
): LineMaterial {
  const material = new LineMaterial({
    color: rgbTupleToHex(color),
    depthTest,
    depthWrite: false,
    linewidth: 1,
    opacity: PICKING_RAY_DEFAULT_OPACITY,
    transparent: true,
    worldUnits: false,
  });
  material.resolution.set(1, 1);
  return material;
}

function updatePickingRayLineMaterial(
  material: LineMaterial,
  color: [number, number, number],
  lineThickness: number,
  resolution: { width: number; height: number },
): void {
  material.color.setHex(rgbTupleToHex(color));
  material.linewidth = normalizePositiveNumber(lineThickness, 1);
  material.opacity = PICKING_RAY_DEFAULT_OPACITY;
  material.resolution.set(resolution.width, resolution.height);
}

function updatePickingRayLine(
  line: Line2,
  geometry: LineGeometry,
  start: Vec3Tuple,
  end: Vec3Tuple,
  visible: boolean,
): void {
  if (!visible || !isFiniteVec3Tuple(start) || !isFiniteVec3Tuple(end)) {
    line.visible = false;
    return;
  }
  if (getVec3TupleDistance(start, end) < 1e-6) {
    line.visible = false;
    return;
  }

  geometry.setPositions([...start, ...end]);
  line.computeLineDistances();
  line.visible = true;
}

function createPickingRayMarkerGeometry(size: number): BufferGeometry {
  const halfSize = normalizePositiveNumber(size, 60) / 2;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -halfSize,
        -halfSize,
        0,
        halfSize,
        -halfSize,
        0,
        halfSize,
        halfSize,
        0,
        -halfSize,
        halfSize,
        0,
      ],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function getPickingRayResolution(canvas: HTMLCanvasElement): {
  width: number;
  height: number;
} {
  const rect = canvas.getBoundingClientRect();
  return {
    width: rect.width || canvas.clientWidth || canvas.width || 1,
    height: rect.height || canvas.clientHeight || canvas.height || 1,
  };
}

function getPickingRayTopZ(seaLevel: number): number {
  return seaLevel + PICKING_RAY_ABOVE_SEA_HEIGHT;
}

function getPickingRayBottomZ(seaLevel: number): number {
  return seaLevel - PICKING_RAY_BELOW_SEA_LEVEL_DEPTH;
}

function rgbTupleToHex(color: [number, number, number]): number {
  return rgbToHex({ r: color[0], g: color[1], b: color[2], a: 1 });
}

function isFiniteVec3Tuple(tuple: Vec3Tuple): boolean {
  return tuple.every(Number.isFinite);
}

function getVec3TupleDistance(a: Vec3Tuple, b: Vec3Tuple): number {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return Math.sqrt(x * x + y * y + z * z);
}

class LightingFeature {
  environment = "default";
  skyDomeEnabled = false;

  setEnvironment(environment: string): void {
    this.environment = environment;
  }

  enableSkyDome(): void {
    this.skyDomeEnabled = true;
  }
}

class DebugFeature {
  wireframe = false;
  freeze = false;
  showGUI = false;
  developerVessels = false;
}

class PlaceholderFeature {
  constructor(readonly featureName: string) {}
}

type ImplicitTileLike = {
  implicitTilingData?: unknown;
  internal?: {
    basePath?: string;
  };
};

type RendererLike = {
  fetchOptions?: RequestInit;
};

type BaseImplicitTilingPlugin = {
  init?: (tiles: RendererLike) => void;
  parseTile?: (
    content: unknown,
    tile: ImplicitTileLike,
    extension: string,
  ) => Promise<void> | undefined;
};

export class S100ImplicitTilingPlugin extends ImplicitTilingPlugin {
  readonly name = "s100-implicit-tiling";
  private tilesRenderer: RendererLike | null = null;

  init(tiles: RendererLike): void {
    this.tilesRenderer = tiles;
    const basePlugin = ImplicitTilingPlugin.prototype as BaseImplicitTilingPlugin;
    basePlugin.init?.call(this, tiles);
  }

  parseTile(
    content: unknown,
    tile: ImplicitTileLike,
    extension: string,
  ): Promise<void> | undefined {
    if (
      extension.toLowerCase() === "json" &&
      tile.implicitTilingData &&
      isSubtreeJSON(content)
    ) {
      const loader = new SUBTREELoader(tile);
      loader.workingPath = tile.internal?.basePath ?? "";
      loader.fetchOptions = this.tilesRenderer?.fetchOptions ?? {};
      return loader.parse(createBinarySubtreeBuffer(content));
    }

    const basePlugin = ImplicitTilingPlugin.prototype as BaseImplicitTilingPlugin;
    return basePlugin.parseTile?.call(this, content, tile, extension);
  }
}

class S100VisibleAncestorPruningPlugin {
  readonly name = "s100-visible-ancestor-pruning";
  private tiles: TilesRenderer | null = null;
  private readonly handleUpdateAfter = (): void => {
    if (this.tiles) {
      pruneVisibleAncestorTileScenes(this.tiles);
    }
  };

  init(tiles: TilesRenderer): void {
    this.tiles = tiles;
    tiles.addEventListener("update-after", this.handleUpdateAfter);
  }

  dispose(): void {
    this.tiles?.removeEventListener("update-after", this.handleUpdateAfter);
    this.tiles = null;
  }
}

function parseDatasetTime(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(
    value,
  );
  if (!compact) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second] = compact;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function cloneCameraPose(pose: CameraPose): CameraPose {
  const cloned: CameraPose = {
    position: [...pose.position],
    rotation: [...pose.rotation],
  };
  if (pose.focalDistance !== undefined) {
    cloned.focalDistance = pose.focalDistance;
  }
  return cloned;
}

function normalizeCameraPose(
  pose: CameraPose,
  fallback: CameraPose,
): CameraPose {
  const normalized: CameraPose = {
    position: normalizeVec3(pose.position, fallback.position),
    rotation: normalizeQuat(pose.rotation, fallback.rotation),
  };
  const focalDistance = normalizeOptionalNumber(pose.focalDistance);
  if (focalDistance !== undefined) {
    normalized.focalDistance = focalDistance;
  } else if (fallback.focalDistance !== undefined) {
    normalized.focalDistance = fallback.focalDistance;
  }
  return normalized;
}

function normalizeVec3(value: unknown, fallback: Vec3Tuple): Vec3Tuple {
  const source = value as Record<number, unknown>;
  return [
    normalizeNumber(source?.[0], fallback[0]),
    normalizeNumber(source?.[1], fallback[1]),
    normalizeNumber(source?.[2], fallback[2]),
  ];
}

function normalizeQuat(value: unknown, fallback: QuatTuple): QuatTuple {
  const source = value as Record<number, unknown>;
  return [
    normalizeNumber(source?.[0], fallback[0]),
    normalizeNumber(source?.[1], fallback[1]),
    normalizeNumber(source?.[2], fallback[2]),
    normalizeNumber(source?.[3], fallback[3]),
  ];
}

function normalizeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOpacity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(1, Math.max(0, parsed));
}

function getMapSpecificationExtents(
  specification: MapSpecification,
): MapOverlayExtents | undefined {
  const { minX, maxX, minY, maxY } = specification.dataset.extents;
  const extents = {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  };
  return Object.values(extents).every(Number.isFinite) ? extents : undefined;
}

function extentsOverlap(
  a: MapOverlayExtents,
  b: MapOverlayExtents,
): boolean {
  return !(
    a.maxX <= b.minX ||
    b.maxX <= a.minX ||
    a.maxY <= b.minY ||
    b.maxY <= a.minY
  );
}

function getS111ZOffset(seaLevel: number): number {
  return seaLevel + 0.5;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function detailFactorToErrorTarget(detailFactor: number): number {
  if (!Number.isFinite(detailFactor) || detailFactor <= 0) {
    return 16;
  }

  return Math.max(1, Math.min(32, 1000 / detailFactor));
}

function createPrismGeometry(
  corners: PrismCorners2D,
  zPos: number,
  height: number,
): BufferGeometry {
  const zBottom = zPos;
  const zTop = zPos + height;
  const bottomLeft: Vec3Tuple = [
    corners.bottomLeft[0],
    corners.bottomLeft[1],
    zBottom,
  ];
  const bottomRight: Vec3Tuple = [
    corners.bottomRight[0],
    corners.bottomRight[1],
    zBottom,
  ];
  const topRight: Vec3Tuple = [
    corners.topRight[0],
    corners.topRight[1],
    zBottom,
  ];
  const topLeft: Vec3Tuple = [
    corners.topLeft[0],
    corners.topLeft[1],
    zBottom,
  ];
  const upperBottomLeft: Vec3Tuple = [
    corners.bottomLeft[0],
    corners.bottomLeft[1],
    zTop,
  ];
  const upperBottomRight: Vec3Tuple = [
    corners.bottomRight[0],
    corners.bottomRight[1],
    zTop,
  ];
  const upperTopRight: Vec3Tuple = [
    corners.topRight[0],
    corners.topRight[1],
    zTop,
  ];
  const upperTopLeft: Vec3Tuple = [
    corners.topLeft[0],
    corners.topLeft[1],
    zTop,
  ];
  const faces: Array<[Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple]> = [
    [topLeft, topRight, bottomRight, bottomLeft],
    [upperBottomLeft, upperBottomRight, upperTopRight, upperTopLeft],
    [bottomLeft, bottomRight, upperBottomRight, upperBottomLeft],
    [bottomRight, topRight, upperTopRight, upperBottomRight],
    [topRight, topLeft, upperTopLeft, upperTopRight],
    [topLeft, bottomLeft, upperBottomLeft, upperTopLeft],
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const pushTriangle = (
    a: Vec3Tuple,
    b: Vec3Tuple,
    c: Vec3Tuple,
    uv: number[],
  ): void => {
    positions.push(...a, ...b, ...c);
    uvs.push(...uv);
  };

  for (const [a, b, c, d] of faces) {
    pushTriangle(a, b, c, [0, 0, 1, 0, 1, 1]);
    pushTriangle(a, c, d, [0, 0, 1, 1, 0, 1]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function rgbToHex(rgba: RGBA): number {
  const red = normalizeColorByte(rgba.r);
  const green = normalizeColorByte(rgba.g);
  const blue = normalizeColorByte(rgba.b);
  return (red << 16) | (green << 8) | blue;
}

function normalizeColorByte(value: number): number {
  return Math.round(MathUtils.clamp(value, 0, 1) * 255);
}

function resolveModelAssetURL(path: string, config: ViewerConfig): string {
  if (/^(https?:|data:|blob:)/i.test(path) || path.startsWith("/")) {
    return path;
  }

  const normalizedPath = path.replace(/^\.?\//, "");
  const staticFiles = config.staticFiles?.replace(/^\/+|\/+$/g, "");
  if (staticFiles && normalizedPath === staticFiles) {
    return `/${normalizedPath}`;
  }
  if (staticFiles && normalizedPath.startsWith(`${staticFiles}/`)) {
    return `/${normalizedPath}`;
  }
  if (staticFiles && !normalizedPath.includes("/")) {
    return `/${staticFiles}/${normalizedPath}`;
  }
  return `/${normalizedPath}`;
}

async function loadCustomModelObject(
  specification: CustomModelSpecification,
  url: string,
): Promise<Object3D> {
  if (specification.object) {
    return specification.object();
  }
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}

function configureModelObjectForRendering(
  root: Object3D,
  castShadow: boolean,
  receiveShadow: boolean,
  environmentIntensity: number | undefined = DEFAULT_MODEL_ENVIRONMENT_INTENSITY,
  environmentMap: Texture | null = null,
  environmentMapRotation?: Euler,
  materialBrightness: number | undefined = DEFAULT_MODEL_MATERIAL_BRIGHTNESS,
): void {
  root.traverse((object) => {
    object.castShadow = castShadow;
    object.receiveShadow = receiveShadow;
    const maybeMesh = object as Object3D & {
      material?: Material | Material[];
    };
    const material = maybeMesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        configureModelMaterial(
          item,
          castShadow,
          environmentIntensity,
          environmentMap,
          environmentMapRotation,
          materialBrightness,
        );
      }
    } else if (material) {
      configureModelMaterial(
        material,
        castShadow,
        environmentIntensity,
        environmentMap,
        environmentMapRotation,
        materialBrightness,
      );
    }
  });
}

function configureModelMaterial(
  material: Material,
  castShadow: boolean,
  environmentIntensity: number | undefined,
  environmentMap: Texture | null,
  environmentMapRotation: Euler | undefined,
  materialBrightness: number | undefined,
): void {
  let needsUpdate = false;
  if (castShadow && material.shadowSide !== DoubleSide) {
    material.shadowSide = DoubleSide;
    needsUpdate = true;
  }

  const litMaterial = material as Material & {
    envMap?: Texture | null;
    envMapIntensity?: unknown;
    envMapRotation?: Euler;
  };
  if (environmentMap && "envMap" in litMaterial && !litMaterial.envMap) {
    litMaterial.envMap = environmentMap;
    needsUpdate = true;
  }
  if (environmentMapRotation && litMaterial.envMapRotation) {
    litMaterial.envMapRotation.copy(environmentMapRotation);
    needsUpdate = true;
  }
  if (typeof litMaterial.envMapIntensity === "number") {
    const targetEnvironmentIntensity = normalizePositiveNumber(
      environmentIntensity,
      DEFAULT_MODEL_ENVIRONMENT_INTENSITY,
    );
    const envMapIntensity = targetEnvironmentIntensity;
    if (Math.abs(litMaterial.envMapIntensity - envMapIntensity) > 1e-6) {
      litMaterial.envMapIntensity = envMapIntensity;
      needsUpdate = true;
    }
  }

  const brightness = normalizePositiveNumber(
    materialBrightness,
    DEFAULT_MODEL_MATERIAL_BRIGHTNESS,
  );
  if (brightness > DEFAULT_MODEL_MATERIAL_BRIGHTNESS + 1e-6) {
    installModelMaterialBrightnessBoost(material, brightness);
    needsUpdate = true;
  }

  if (needsUpdate) {
    material.needsUpdate = true;
  }
}

function installModelMaterialBrightnessBoost(
  material: Material,
  brightness: number,
): void {
  const previousBrightness = material.userData[
    MODEL_MATERIAL_BRIGHTNESS_USER_DATA_KEY
  ] as number | undefined;
  if (Math.abs((previousBrightness ?? 1) - brightness) <= 1e-6) {
    return;
  }

  material.userData[MODEL_MATERIAL_BRIGHTNESS_USER_DATA_KEY] = brightness;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousCustomProgramCacheKey =
    material.customProgramCacheKey.bind(material);
  const brightnessLiteral = brightness.toFixed(3);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    const include = "#include <color_fragment>";
    if (!shader.fragmentShader.includes(include)) {
      return;
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      include,
      `${include}
diffuseColor.rgb *= ${brightnessLiteral};`,
    );
  };
  material.customProgramCacheKey = () =>
    `${previousCustomProgramCacheKey()}|s100Brightness:${brightnessLiteral}`;
}

function configureTerrainObjectForShadows(root: Object3D): void {
  root.traverse((object) => {
    object.receiveShadow = true;
    const maybeMesh = object as Object3D & {
      material?: Material | Material[];
    };
    const material = maybeMesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        configureTerrainMaterial(item);
      }
    } else if (material) {
      configureTerrainMaterial(material);
    }
  });
}

function configureTerrainMaterial(material: Material): void {
  if (material.side !== BackSide) {
    material.side = BackSide;
    material.needsUpdate = true;
  }
}

function applyObjectScale(object: Object3D, scale: CustomModelScale | undefined): void {
  if (Array.isArray(scale)) {
    object.scale.set(
      normalizePositiveNumber(scale[0], 1),
      normalizePositiveNumber(scale[1], 1),
      normalizePositiveNumber(scale[2], 1),
    );
    return;
  }

  const uniformScale = normalizePositiveNumber(scale, 1);
  object.scale.set(uniformScale, uniformScale, uniformScale);
}

function createSeaLevelIndicator(
  dimensions: VesselDimensions,
): Mesh<RingGeometry, MeshBasicMaterial> | null {
  const radius = getVesselIndicatorRadius(dimensions);
  if (!Number.isFinite(radius) || radius <= 0) {
    return null;
  }

  const geometry = new RingGeometry(radius * 0.97, radius, 128);
  const material = new MeshBasicMaterial({
    color: DEFAULT_SEA_LEVEL_INDICATOR_COLOR,
    depthWrite: false,
    opacity: DEFAULT_SEA_LEVEL_INDICATOR_OPACITY,
    side: DoubleSide,
    transparent: true,
  });
  const indicator = new Mesh(geometry, material);
  indicator.name = "s100-vessel-sea-level-indicator";
  indicator.renderOrder = 1320;
  indicator.frustumCulled = false;
  indicator.visible = false;
  return indicator;
}

function createSeaLevelSurface(
  dimensions: VesselDimensions,
  environmentMap: Texture | null,
  environmentMapRotation?: Euler,
): Mesh<CircleGeometry, MeshPhysicalMaterial> | null {
  const radius = getVesselIndicatorRadius(dimensions) * 0.965;
  if (!Number.isFinite(radius) || radius <= 0) {
    return null;
  }

  const geometry = new CircleGeometry(radius, 128);
  const material = new MeshPhysicalMaterial({
    clearcoat: 0.08,
    clearcoatRoughness: 0.26,
    color: DEFAULT_SEA_LEVEL_SURFACE_COLOR,
    depthWrite: false,
    envMap: environmentMap,
    envMapIntensity: DEFAULT_SEA_LEVEL_SURFACE_ENVIRONMENT_INTENSITY,
    ior: 1.333,
    metalness: 0,
    opacity: DEFAULT_SEA_LEVEL_SURFACE_OPACITY,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    reflectivity: 0.4,
    roughness: 0.096,
    side: DoubleSide,
    transparent: true,
  });
  if (environmentMapRotation) {
    material.envMapRotation.copy(environmentMapRotation);
  }
  configureSeaLevelSurfaceMaterial(material);
  const surface = new Mesh(geometry, material);
  surface.name = "s100-vessel-sea-level-surface";
  surface.renderOrder = 1315;
  surface.frustumCulled = false;
  surface.visible = false;
  return surface;
}

type SeaLevelSurfaceMaterial = MeshPhysicalMaterial & {
  userData: MeshPhysicalMaterial["userData"] & {
    s100WaterAnimationStart?: number;
    s100WaterUniforms?: S100OceanSurfaceUniforms;
  };
};

function configureSeaLevelSurfaceMaterial(material: MeshPhysicalMaterial): void {
  const surfaceMaterial = material as SeaLevelSurfaceMaterial;
  const uniforms = createS100OceanSurfaceUniforms({
    bumpScale: DEFAULT_SEA_LEVEL_SURFACE_BUMP_SCALE,
    waveSpeed: SEA_LEVEL_SURFACE_WAVE_SPEED,
  });
  surfaceMaterial.userData.s100WaterAnimationStart = getS100OceanSurfaceTimeSeconds();
  surfaceMaterial.userData.s100WaterUniforms = uniforms;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    patchS100OceanSurfaceShader(shader, uniforms);
  };
  material.customProgramCacheKey = (): string =>
    `${previousProgramCacheKey()}|${S100_OCEAN_SURFACE_SHADER_CACHE_KEY}`;
}

function updateSeaLevelSurfaceAnimation(
  surface: Mesh<CircleGeometry, MeshPhysicalMaterial>,
): void {
  const material = surface.material as SeaLevelSurfaceMaterial;
  const start =
    material.userData.s100WaterAnimationStart ?? getS100OceanSurfaceTimeSeconds();
  material.userData.s100WaterAnimationStart = start;
  const uniforms = material.userData.s100WaterUniforms;
  if (!uniforms) {
    return;
  }
  updateS100OceanSurfaceTime(uniforms, start);
}

function createVesselModelTransform(
  specification: VesselSpecification,
): Pick<CustomModelSpecification, "modelOffset" | "modelOrientation" | "modelScale"> {
  const bounds = parseModelBoundingBox(specification.model.boundingBox);
  const orientation = createVesselModelOrientation(specification.model.orientation);
  if (!bounds) {
    return {
      modelOrientation: orientation,
    };
  }

  const size: Vec3Tuple = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const center: Vec3Tuple = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const vesselWidth =
    specification.dimensions.port + specification.dimensions.starboard;
  const vesselLength =
    specification.dimensions.bow + specification.dimensions.stern;
  const scaleX = normalizePositiveNumber(vesselWidth / size[0], 1);
  const scaleY = normalizePositiveNumber(vesselLength / size[1], 1);
  const scaleZ = (scaleX + scaleY) / 2;

  return {
    modelOffset: [
      getVesselCenterOffset(specification.dimensions).x - center[0] * scaleX,
      getVesselCenterOffset(specification.dimensions).y - center[1] * scaleY,
      -bounds.min[2] * scaleZ - specification.dimensions.draught,
    ],
    modelOrientation: orientation,
    modelScale: [scaleX, scaleZ, scaleY],
  };
}

function parseModelBoundingBox(
  value: unknown,
): { min: Vec3Tuple; max: Vec3Tuple } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const min = normalizeVec3Tuple(record.min ?? record._min, [NaN, NaN, NaN]);
  const max = normalizeVec3Tuple(record.max ?? record._max, [NaN, NaN, NaN]);
  if (min.every(Number.isFinite) && max.every(Number.isFinite)) {
    return { min, max };
  }

  if (isArrayLike(record.data, 6)) {
    const data = record.data;
    const dataMin = normalizeVec3Tuple(data, [NaN, NaN, NaN]);
    const dataMax = normalizeVec3Tuple(
      {
        0: data[3],
        1: data[4],
        2: data[5],
        length: 3,
      },
      [NaN, NaN, NaN],
    );
    if (dataMin.every(Number.isFinite) && dataMax.every(Number.isFinite)) {
      return { min: dataMin, max: dataMax };
    }
  }

  return null;
}

function getVesselCenterOffset(dimensions: VesselDimensions): Vector3 {
  return new Vector3(
    (dimensions.starboard - dimensions.port) / 2,
    (dimensions.bow - dimensions.stern) / 2,
    0,
  );
}

function getVesselIndicatorRadius(dimensions: VesselDimensions): number {
  return (
    Math.max(
      dimensions.bow + dimensions.stern,
      dimensions.port + dimensions.starboard,
    ) * VESSEL_INDICATOR_RADIUS_FACTOR
  );
}

function getVesselShadowRadius(dimensions: VesselDimensions): number {
  return Math.max(getVesselIndicatorRadius(dimensions) * 1.35, 100);
}

function getModelShadowDimensions(root: Object3D): VesselDimensions {
  const size = new Vector3();
  new Box3().setFromObject(root).getSize(size);
  const width = normalizePositiveNumber(size.x, 100);
  const length = normalizePositiveNumber(size.y, 100);
  const height = normalizePositiveNumber(size.z, 20);
  return {
    bow: length / 2,
    stern: length / 2,
    port: width / 2,
    starboard: width / 2,
    draught: height / 2,
  };
}

function normalizeVerticalShadowOptions(
  value: CustomModelSpecification["verticalShadow"],
): VerticalShadowOptions & { enabled: boolean } {
  if (value === true) {
    return {
      enabled: true,
    };
  }
  if (typeof value === "object" && value !== null) {
    return {
      ...value,
      enabled: value.enabled !== false,
    };
  }
  return {
    enabled: false,
  };
}

function normalizeVesselShadowSpecification(
  value: VesselSpecification["shadow"],
): VesselShadowSpecification & { enabled: boolean; mode: VesselShadowMode } {
  if (value === undefined || value === true) {
    return {
      enabled: true,
      mode: "high-quality",
    };
  }
  if (value === false) {
    return {
      enabled: false,
      mode: "high-quality",
    };
  }
  const mode = value.mode === "shared-texture"
    ? "shared-texture"
    : "high-quality";
  return {
    ...value,
    enabled: value.enabled !== false,
    mode,
  };
}

function normalizeUnitInterval(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return MathUtils.clamp(fallback, 0, 1);
  }
  return MathUtils.clamp(value, 0, 1);
}

function normalizeTransformControlOptions(
  value: CustomModelSpecification["transformControls"],
): NormalizedTransformControlsOptions {
  const defaultAxes = normalizeTransformControlAxisOptions();
  if (value === true) {
    return {
      enabled: true,
      mode: "translate",
      modes: ["translate"],
      selectable: false,
      selected: true,
      size: DEFAULT_TRANSFORM_CONTROL_SIZE,
      translationAxes: defaultAxes,
      rotationAxes: defaultAxes,
      scaleAxes: defaultAxes,
    };
  }
  if (typeof value === "object" && value !== null) {
    const mode = normalizeTransformControlMode(value.mode);
    const selectable = value.selectable === true;
    return {
      enabled: value.enabled === true,
      mode,
      modes: normalizeTransformControlModes(value.modes, mode),
      selectable,
      selected: selectable ? value.selected === true : value.selected !== false,
      size: normalizePositiveNumber(value.size, DEFAULT_TRANSFORM_CONTROL_SIZE),
      translationAxes: normalizeTransformControlAxisOptions(
        value.translationAxes,
      ),
      rotationAxes: normalizeTransformControlAxisOptions(value.rotationAxes),
      scaleAxes: normalizeTransformControlAxisOptions(value.scaleAxes),
    };
  }
  return {
    enabled: false,
    mode: "translate",
    modes: ["translate"],
    selectable: false,
    selected: true,
    size: DEFAULT_TRANSFORM_CONTROL_SIZE,
    translationAxes: defaultAxes,
    rotationAxes: defaultAxes,
    scaleAxes: defaultAxes,
  };
}

function normalizeTransformControlAxisOptions(
  value: TransformControlAxisOptions | undefined = {},
): Required<TransformControlAxisOptions> {
  return {
    x: value.x !== false,
    y: value.y !== false,
    z: value.z !== false,
  };
}

function normalizeTransformControlMode(
  value: TransformControlsMode | undefined,
): TransformControlsMode {
  return value === "rotate" || value === "scale" ? value : "translate";
}

function normalizeTransformControlModes(
  values: TransformControlsMode[] | undefined,
  fallback: TransformControlsMode,
): TransformControlsMode[] {
  const modes = new Set<TransformControlsMode>();
  if (Array.isArray(values)) {
    for (const value of values) {
      modes.add(normalizeTransformControlMode(value));
    }
  }
  if (modes.size === 0) {
    modes.add(fallback);
  }
  return [...modes];
}

function parseQuaternion(value: unknown): Quaternion {
  const tuple = parseQuatTuple(value);
  if (!tuple) {
    return IDENTITY_QUATERNION.clone();
  }

  return new Quaternion(tuple[0], tuple[1], tuple[2], tuple[3]).normalize();
}

function createVesselModelOrientation(value: unknown): Quaternion {
  return parseQuaternion(value).multiply(VESSEL_GLTF_TO_Z_UP_ORIENTATION);
}

function parseQuatTuple(value: unknown): QuatTuple | null {
  if (isArrayLike(value, 4)) {
    return [
      normalizeOptionalNumber(value[0]) ?? 0,
      normalizeOptionalNumber(value[1]) ?? 0,
      normalizeOptionalNumber(value[2]) ?? 0,
      normalizeOptionalNumber(value[3]) ?? 1,
    ];
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return [
      normalizeOptionalNumber(record.x) ?? 0,
      normalizeOptionalNumber(record.y) ?? 0,
      normalizeOptionalNumber(record.z) ?? 0,
      normalizeOptionalNumber(record.w) ?? 1,
    ];
  }

  return null;
}

function normalizeVec3Tuple(value: unknown, fallback: Vec3Tuple): Vec3Tuple {
  if (!isArrayLike(value, 3)) {
    return [...fallback];
  }

  return [
    normalizeOptionalNumber(value[0]) ?? fallback[0],
    normalizeOptionalNumber(value[1]) ?? fallback[1],
    normalizeOptionalNumber(value[2]) ?? fallback[2],
  ];
}

function normalizeDirectionVector(value: unknown, fallback: Vector3): Vector3 {
  const tuple = normalizeVec3Tuple(value, [fallback.x, fallback.y, fallback.z]);
  const direction = new Vector3(tuple[0], tuple[1], tuple[2]);
  if (direction.lengthSq() < 1e-12) {
    return fallback.clone();
  }

  return direction.normalize();
}

function isArrayLike(value: unknown, minLength: number): value is ArrayLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "length" in value &&
    typeof (value as { length: unknown }).length === "number" &&
    (value as { length: number }).length >= minLength
  );
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function getHeadingFromQuaternion(
  quaternion: Quaternion,
  headingVector = MODEL_FORWARD_VECTOR,
): number {
  const direction = headingVector.clone().applyQuaternion(quaternion);
  return normalizeDegrees(MathUtils.radToDeg(Math.atan2(direction.x, direction.y)));
}

function vec3TupleEquals(a: Vec3Tuple, b: Vec3Tuple): boolean {
  return (
    Math.abs(a[0] - b[0]) < 1e-6 &&
    Math.abs(a[1] - b[1]) < 1e-6 &&
    Math.abs(a[2] - b[2]) < 1e-6
  );
}

function disposeObjectTree(root: Object3D): void {
  const disposedMaterials = new Set<Material>();
  root.traverse((object) => {
    const maybeMesh = object as Object3D & {
      geometry?: { dispose?: () => void };
      material?: Material | Material[];
    };
    maybeMesh.geometry?.dispose?.();
    const material = maybeMesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        disposeModelMaterial(item, disposedMaterials);
      }
    } else if (material) {
      disposeModelMaterial(material, disposedMaterials);
    }
  });
}

function disposeModelMaterial(
  material: Material,
  disposedMaterials: Set<Material>,
): void {
  if (disposedMaterials.has(material)) {
    return;
  }

  disposedMaterials.add(material);
  material.dispose();
}

type TerrainTileQueue = {
  autoUpdate: boolean;
  maxJobs: number;
  tryRunJobs(): void;
};

type TerrainTileLoadErrorEvent = {
  error: unknown;
  tile?: Tile | null;
  url: string | URL;
};

type TerrainTileContentState = Pick<
  Tile["internal"],
  "hasContent" | "hasRenderableContent" | "hasUnrenderableContent"
>;

type TerrainTileQueuePauseState = {
  downloadAutoUpdate: boolean;
  downloadMaxJobs: number;
  parseAutoUpdate: boolean;
  parseMaxJobs: number;
  processNodeAutoUpdate: boolean;
  processNodeMaxJobs: number;
  paused: boolean;
};

const terrainTileQueuePauseStates = new WeakMap<
  TilesRenderer,
  TerrainTileQueuePauseState
>();

type TerrainTileRetryOptions = {
  isRetryDeferred(): boolean;
};

class TerrainTileRetryController {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private disposed = false;
  private readonly descendantFallbackStates = new WeakMap<
    Tile,
    TerrainTileContentState
  >();
  private readonly descendantFallbackTiles = new Set<Tile>();

  constructor(
    private readonly tiles: TilesRenderer,
    private readonly options: TerrainTileRetryOptions,
  ) {}

  handleLoadError(event: TerrainTileLoadErrorEvent): void {
    if (this.disposed) {
      return;
    }
    if (
      this.enableDescendantFallback(event.tile) &&
      !this.options.isRetryDeferred()
    ) {
      this.tiles.update();
      flushTerrainQueuesForCurrentView(this.tiles);
    }
    this.scheduleRetry();
  }

  dispose(): void {
    this.disposed = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) {
      return;
    }

    const delay = getTerrainRetryDelay(this.retryAttempt);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.disposed) {
        return;
      }

      if (this.options.isRetryDeferred()) {
        this.scheduleRetry();
        return;
      }

      this.restoreDescendantFallbackTiles();
      this.tiles.resetFailedTiles();
      this.tiles.update();
      flushTerrainQueuesForCurrentView(this.tiles);
    }, delay);
  }

  private enableDescendantFallback(tile: Tile | null | undefined): boolean {
    if (!tile?.internal.hasContent || !tile.internal.hasRenderableContent) {
      return false;
    }

    if (!this.descendantFallbackStates.has(tile)) {
      this.descendantFallbackStates.set(tile, {
        hasContent: tile.internal.hasContent,
        hasRenderableContent: tile.internal.hasRenderableContent,
        hasUnrenderableContent: tile.internal.hasUnrenderableContent,
      });
      this.descendantFallbackTiles.add(tile);
    }

    tile.internal.hasRenderableContent = false;
    tile.internal.hasUnrenderableContent = true;
    return true;
  }

  private restoreDescendantFallbackTiles(): void {
    for (const tile of this.descendantFallbackTiles) {
      const state = this.descendantFallbackStates.get(tile);
      if (!state) {
        continue;
      }
      tile.internal.hasContent = state.hasContent;
      tile.internal.hasRenderableContent = state.hasRenderableContent;
      tile.internal.hasUnrenderableContent = state.hasUnrenderableContent;
    }

    this.descendantFallbackTiles.clear();
  }
}

function configureTerrainTilesRenderer(tiles: TilesRenderer): TerrainUnloadTilesPlugin {
  tiles.loadAncestors = false;
  tiles.loadSiblings = false;
  tiles.displayActiveTiles = false;
  tiles.lruCache.unloadPercent = 0.35;
  tiles.registerPlugin(new S100VisibleAncestorPruningPlugin());
  const unloadTilesPlugin = new UnloadTilesPlugin({
    delay: TERRAIN_GPU_UNLOAD_DELAY_MS,
    bytesTarget: TERRAIN_CLOSE_GPU_BYTES_TARGET,
  }) as TerrainUnloadTilesPlugin;
  tiles.registerPlugin(unloadTilesPlugin);
  return unloadTilesPlugin;
}

function setTerrainTileQueuesPaused(
  tiles: TilesRenderer,
  paused: boolean,
): void {
  const downloadQueue = tiles.downloadQueue as TerrainTileQueue;
  const parseQueue = tiles.parseQueue as TerrainTileQueue;
  const processNodeQueue = tiles.processNodeQueue as TerrainTileQueue;
  const state = getTerrainTileQueuePauseState(
    tiles,
    downloadQueue,
    parseQueue,
    processNodeQueue,
  );
  if (state.paused === paused) {
    return;
  }

  state.paused = paused;
  if (paused) {
    state.downloadAutoUpdate = downloadQueue.autoUpdate;
    state.downloadMaxJobs = downloadQueue.maxJobs;
    state.parseAutoUpdate = parseQueue.autoUpdate;
    state.parseMaxJobs = parseQueue.maxJobs;
    state.processNodeAutoUpdate = processNodeQueue.autoUpdate;
    state.processNodeMaxJobs = processNodeQueue.maxJobs;

    downloadQueue.autoUpdate = false;
    parseQueue.autoUpdate = false;
    processNodeQueue.autoUpdate = false;
    downloadQueue.maxJobs = 0;
    parseQueue.maxJobs = 0;
    processNodeQueue.maxJobs = 0;
    return;
  }

  downloadQueue.autoUpdate = state.downloadAutoUpdate;
  parseQueue.autoUpdate = state.parseAutoUpdate;
  processNodeQueue.autoUpdate = state.processNodeAutoUpdate;
  downloadQueue.maxJobs = state.downloadMaxJobs;
  parseQueue.maxJobs = state.parseMaxJobs;
  processNodeQueue.maxJobs = state.processNodeMaxJobs;
}

function getTerrainTileQueuePauseState(
  tiles: TilesRenderer,
  downloadQueue: TerrainTileQueue,
  parseQueue: TerrainTileQueue,
  processNodeQueue: TerrainTileQueue,
): TerrainTileQueuePauseState {
  const existingState = terrainTileQueuePauseStates.get(tiles);
  if (existingState) {
    return existingState;
  }

  const state = {
    downloadAutoUpdate: downloadQueue.autoUpdate,
    downloadMaxJobs: downloadQueue.maxJobs,
    parseAutoUpdate: parseQueue.autoUpdate,
    parseMaxJobs: parseQueue.maxJobs,
    processNodeAutoUpdate: processNodeQueue.autoUpdate,
    processNodeMaxJobs: processNodeQueue.maxJobs,
    paused: false,
  };
  terrainTileQueuePauseStates.set(tiles, state);
  return state;
}

function getTerrainRetryDelay(attempt: number): number {
  const normalizedAttempt = Math.max(0, Math.floor(attempt));
  const baseDelay = Math.min(
    TERRAIN_RETRY_INITIAL_DELAY_MS *
      TERRAIN_RETRY_BACKOFF_FACTOR ** normalizedAttempt,
    TERRAIN_RETRY_MAX_DELAY_MS,
  );
  const jitter =
    baseDelay * TERRAIN_RETRY_JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.round(Math.max(250, baseDelay + jitter));
}

function updateTerrainRuntimeForCamera(
  tiles: TilesRenderer,
  camera: Camera,
  detailFactor: number,
  unloadTilesPlugin: TerrainUnloadTilesPlugin,
  seaLevel: number,
): void {
  const refinementDistance = getTerrainRefinementDistance(
    tiles,
    camera,
    seaLevel,
  );
  const baseErrorTarget = detailFactorToErrorTarget(detailFactor);
  const distanceRatio = MathUtils.clamp(
    (refinementDistance - TERRAIN_LOD_NEAR_REFINEMENT_DISTANCE) /
      (TERRAIN_LOD_FAR_REFINEMENT_DISTANCE -
        TERRAIN_LOD_NEAR_REFINEMENT_DISTANCE),
    0,
    1,
  );
  const smoothDistance = distanceRatio * distanceRatio * (3 - 2 * distanceRatio);
  const multiplier = MathUtils.lerp(
    1,
    TERRAIN_FAR_ERROR_MULTIPLIER,
    smoothDistance,
  );
  tiles.errorTarget = Math.min(
    TERRAIN_MAX_ERROR_TARGET,
    baseErrorTarget * multiplier,
  );
  updateTerrainCacheBudget(tiles, unloadTilesPlugin, smoothDistance);
}

function updateTerrainCacheBudget(
  tiles: TilesRenderer,
  unloadTilesPlugin: TerrainUnloadTilesPlugin,
  distanceRatio: number,
): void {
  const closenessRatio = 1 - distanceRatio;
  const previousMaxSize = tiles.lruCache.maxSize;
  const previousMaxBytesSize = tiles.lruCache.maxBytesSize;
  const shouldUseOptimizedTraversal =
    distanceRatio >= TERRAIN_OPTIMIZED_TRAVERSAL_DISTANCE_RATIO;

  tiles.loadAncestors = !shouldUseOptimizedTraversal;
  tiles.loadSiblings = shouldUseOptimizedTraversal;
  tiles.maxTilesProcessed = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_MAX_TILES_PROCESSED_PER_FRAME,
      TERRAIN_CLOSE_MAX_TILES_PROCESSED_PER_FRAME,
      closenessRatio,
    ),
  );
  tiles.downloadQueue.maxJobs = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_DOWNLOAD_MAX_JOBS,
      TERRAIN_CLOSE_DOWNLOAD_MAX_JOBS,
      closenessRatio,
    ),
  );
  tiles.parseQueue.maxJobs = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_PARSE_MAX_JOBS,
      TERRAIN_CLOSE_PARSE_MAX_JOBS,
      closenessRatio,
    ),
  );
  tiles.processNodeQueue.maxJobs = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_PROCESS_NODE_MAX_JOBS,
      TERRAIN_CLOSE_PROCESS_NODE_MAX_JOBS,
      closenessRatio,
    ),
  );
  tiles.lruCache.minSize = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_CACHE_MIN_TILES,
      TERRAIN_CLOSE_CACHE_MIN_TILES,
      closenessRatio,
    ),
  );
  tiles.lruCache.maxSize = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_CACHE_MAX_TILES,
      TERRAIN_CLOSE_CACHE_MAX_TILES,
      closenessRatio,
    ),
  );
  tiles.lruCache.minBytesSize = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_CACHE_MIN_BYTES,
      TERRAIN_CLOSE_CACHE_MIN_BYTES,
      closenessRatio,
    ),
  );
  tiles.lruCache.maxBytesSize = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_CACHE_MAX_BYTES,
      TERRAIN_CLOSE_CACHE_MAX_BYTES,
      closenessRatio,
    ),
  );
  tiles.lruCache.unloadPercent = MathUtils.lerp(1, 0.25, closenessRatio);
  unloadTilesPlugin.bytesTarget = Math.round(
    MathUtils.lerp(
      TERRAIN_FAR_GPU_BYTES_TARGET,
      TERRAIN_CLOSE_GPU_BYTES_TARGET,
      closenessRatio,
    ),
  );

  if (
    tiles.lruCache.maxSize < previousMaxSize ||
    tiles.lruCache.maxBytesSize < previousMaxBytesSize
  ) {
    tiles.lruCache.scheduleUnload();
  }
}

function flushTerrainQueuesForCurrentView(tiles: TilesRenderer): void {
  tiles.processNodeQueue.tryRunJobs();
  tiles.downloadQueue.tryRunJobs();
}

function pruneVisibleAncestorTileScenes(tiles: TilesRenderer): void {
  const visibleTiles = tiles.visibleTiles;
  const coverageCache = new WeakMap<Tile, boolean>();

  for (const tile of visibleTiles) {
    setTileSceneRenderVisible(tile, true);
  }

  for (const tile of visibleTiles) {
    if (shouldHideVisibleAncestorTile(tile, visibleTiles, coverageCache)) {
      setTileSceneRenderVisible(tile, false);
    }
  }
}

function shouldHideVisibleAncestorTile(
  tile: Tile,
  visibleTiles: Set<Tile>,
  coverageCache: WeakMap<Tile, boolean>,
): boolean {
  if (tile.refine === "ADD") {
    return false;
  }

  const children = tile.children ?? [];
  let hasVisibleChildCoverage = false;

  for (const child of children) {
    const traversal = getTileRuntimeTraversal(child);
    if (!traversal) {
      return false;
    }

    if (!traversal.inFrustum) {
      continue;
    }

    hasVisibleChildCoverage = true;
    if (!isVisibleTileCoverageComplete(child, visibleTiles, coverageCache)) {
      return false;
    }
  }

  return hasVisibleChildCoverage;
}

function isVisibleTileCoverageComplete(
  tile: Tile,
  visibleTiles: Set<Tile>,
  coverageCache: WeakMap<Tile, boolean>,
): boolean {
  const cached = coverageCache.get(tile);
  if (cached !== undefined) {
    return cached;
  }

  if (visibleTiles.has(tile)) {
    coverageCache.set(tile, true);
    return true;
  }

  if (tile.refine === "ADD") {
    coverageCache.set(tile, false);
    return false;
  }

  if (!getTileRuntimeTraversal(tile)) {
    coverageCache.set(tile, false);
    return false;
  }

  const children = tile.children ?? [];
  let hasVisibleChildCoverage = false;
  for (const child of children) {
    const traversal = getTileRuntimeTraversal(child);
    if (!traversal) {
      coverageCache.set(tile, false);
      return false;
    }

    if (!traversal.inFrustum) {
      continue;
    }

    hasVisibleChildCoverage = true;
    if (!isVisibleTileCoverageComplete(child, visibleTiles, coverageCache)) {
      coverageCache.set(tile, false);
      return false;
    }
  }

  coverageCache.set(tile, hasVisibleChildCoverage);
  return hasVisibleChildCoverage;
}

function getTileRuntimeTraversal(tile: Tile): Tile["traversal"] | undefined {
  return (tile as RuntimeTile).traversal;
}

function setTileSceneRenderVisible(tile: Tile, visible: boolean): void {
  const scene = (tile as SceneBackedTile).engineData?.scene;
  if (scene) {
    scene.visible = visible;
  }
}

function getTerrainRefinementDistance(
  tiles: TilesRenderer,
  camera: Camera,
  seaLevel: number,
): number {
  const distances = [
    getClosestTileDistance(tiles.visibleTiles),
    getClosestTileDistance(tiles.activeTiles),
    getCameraSeaPlaneDistance(camera, seaLevel),
    getWeightedCameraHeight(camera, seaLevel),
  ].filter((distance): distance is number => Number.isFinite(distance));

  if (distances.length === 0) {
    return TERRAIN_LOD_FAR_REFINEMENT_DISTANCE;
  }

  return Math.max(0, Math.min(...distances));
}

function getClosestTileDistance(tiles: Set<Tile>): number {
  let closest = Infinity;
  for (const tile of tiles) {
    const distance = tile.traversal?.distanceFromCamera;
    if (Number.isFinite(distance) && distance >= 0) {
      closest = Math.min(closest, distance);
    }
  }

  return closest;
}

function getCameraSeaPlaneDistance(camera: Camera, seaLevel: number): number {
  const height = camera.position.z - seaLevel;
  if (!Number.isFinite(height) || height <= 0) {
    return 0;
  }

  camera.getWorldDirection(TERRAIN_CAMERA_DIRECTION);
  if (TERRAIN_CAMERA_DIRECTION.z >= -0.01) {
    return Infinity;
  }

  return height / -TERRAIN_CAMERA_DIRECTION.z;
}

function getWeightedCameraHeight(camera: Camera, seaLevel: number): number {
  const height = Math.max(0, camera.position.z - seaLevel);
  if (!Number.isFinite(height)) {
    return Infinity;
  }

  return height * TERRAIN_CAMERA_HEIGHT_DISTANCE_WEIGHT;
}

function isSubtreeJSON(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    ("tileAvailability" in value ||
      "contentAvailability" in value ||
      "childSubtreeAvailability" in value)
  );
}

function createBinarySubtreeBuffer(
  subtreeJSON: Record<string, unknown>,
): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(subtreeJSON));
  const buffer = new ArrayBuffer(24 + jsonBytes.length);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  bytes.set([0x73, 0x75, 0x62, 0x74], 0);
  view.setUint32(4, 1, true);
  view.setUint32(8, jsonBytes.length, true);
  view.setUint32(12, 0, true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  bytes.set(jsonBytes, 24);

  return buffer;
}

function normalizeTerrainTilesetURL(baseURL: string): string {
  const trimmed = baseURL.trim();
  if (!trimmed) {
    return trimmed;
  }

  const hashIndex = trimmed.indexOf("#");
  const withoutHash =
    hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : trimmed.slice(hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const path =
    queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex);

  if (/(^|\/)tileset\.json$/i.test(path)) {
    return `${path}${query}${hash}`;
  }

  const separator = path.endsWith("/") ? "" : "/";
  return `${path}${separator}tileset.json${query}${hash}`;
}

function createAdditionalUrlParametersPlugin(
  additionalURLParameters: string,
): {
  name: string;
  preprocessURL(url: string | URL): string;
} {
  const normalizedParameters = normalizeAdditionalURLParameters(
    additionalURLParameters,
  );
  return {
    name: "s100-additional-url-parameters",
    preprocessURL: (url: string | URL) =>
      appendAdditionalURLParameters(url, normalizedParameters),
  };
}

function normalizeAdditionalURLParameters(value: string): string {
  return value.trim().replace(/^[?&]+/, "");
}

function appendAdditionalURLParameters(
  url: string | URL,
  additionalURLParameters: string,
): string {
  const urlString = String(url);
  if (!additionalURLParameters || urlString.includes(additionalURLParameters)) {
    return urlString;
  }

  const hashIndex = urlString.indexOf("#");
  const base = hashIndex === -1 ? urlString : urlString.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : urlString.slice(hashIndex);
  const separator =
    base.endsWith("?") || base.endsWith("&") ? "" : base.includes("?") ? "&" : "?";

  return `${base}${separator}${additionalURLParameters}${hash}`;
}
