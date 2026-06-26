import proj4 from "proj4";
import {
  S100Error,
  S100ProductType,
  S100SupportedProductVersions,
  type AdapterCapabilities,
  type BaseLayerSpec,
  type CameraControlAction,
  type CameraControlConfig,
  type CameraControlModifier,
  type CameraControlPointerBinding,
  type CameraLookAt,
  type EngineCameraPose,
  type Coordinate,
  type EncLayerSpec,
  type EngineHandleBundle,
  type EngineLayerHandle,
  type EngineLayerPatchListener,
  type EnginePrismCorners2D,
  type EngineRgba,
  type EngineScene,
  type EngineViewerHost,
  type EnvironmentState,
  type LayerPatch,
  type LivePickingOptions,
  type MapOverlayLayerSpec,
  type ModelSource,
  type PickRequest,
  type PickResult,
  type RestJsonSource,
  type S100EngineAdapter,
  type S102BathymetryLayerSpec,
  type S111SurfaceCurrentLayerSpec,
  type SceneGeoreference,
  type SceneOptions,
  type ServiceReadySource,
  type SimulatedWaterLevelLayerSpec,
  type SpatialExtent,
  type StaticJsonSource,
  type VesselLayerSpec,
  type ViewerHostOptions,
  type WmsSource,
  type WmtsSource,
  isEncLayerSpec,
} from "@ecc/s100-viewer";

type FetchLike = typeof fetch;
type CesiumObject = Record<string, unknown>;
type CesiumConstructor = new (...args: unknown[]) => CesiumObject;
type Vector3Fields = { x: number; y: number; z: number };
type CesiumSceneDrawable =
  | { kind: "entity"; value: CesiumObject }
  | { kind: "primitive"; value: CesiumObject };
type CesiumPositionGeometry = {
  positions: CesiumObject[];
  modelMatrix?: unknown;
};
type CesiumSegmentGeometry = {
  segments: Array<readonly [CesiumObject, CesiumObject]>;
  modelMatrix?: unknown;
};

export type CesiumModule = Record<string, unknown>;
export type CesiumModuleProvider =
  | CesiumModule
  | (() => CesiumModule | Promise<CesiumModule>);

export type CesiumAdapterOptions = {
  cesiumModule?: CesiumModuleProvider;
  viewerOptions?: Record<string, unknown>;
  accessToken?: string;
  fetchHandler?: FetchLike;
  s111MaxEntityCount?: number;
  dynamicLighting?: boolean;
};

type CesiumLayerNative =
  | {
      kind: "3d-tiles";
      spec: S102BathymetryLayerSpec;
      primitive: CesiumObject;
      cleanup: Array<() => void>;
    }
  | {
      kind: "imagery";
      spec: EncLayerSpec | MapOverlayLayerSpec;
      layer: CesiumObject;
      provider: CesiumObject;
    }
  | {
      kind: "projected-wms";
      spec: EncLayerSpec | MapOverlayLayerSpec;
      urlTemplate: string;
      extent: SpatialExtent;
      drawables: CesiumSceneDrawable[];
    }
  | {
      kind: "s111";
      spec: S111SurfaceCurrentLayerSpec;
      data: unknown;
      drawables: CesiumSceneDrawable[];
    }
  | {
      kind: "entities";
      spec: S111SurfaceCurrentLayerSpec | VesselLayerSpec | BaseLayerSpec;
      entities: CesiumObject[];
    }
  | {
      kind: "vessel";
      spec: VesselLayerSpec;
      entity: CesiumObject;
      drawables: CesiumSceneDrawable[];
      view: CesiumVesselNativeView;
    }
  | { kind: "simulated-water-level"; spec: SimulatedWaterLevelLayerSpec; data: unknown };

type CesiumVesselGizmoScene = CesiumObject & {
  __s100VesselGizmoDragging?: boolean;
};

type S111Sample = {
  position: readonly [number, number];
  speedKnots: number;
  directionDegrees: number;
};

type S111RenderData = {
  samples: S111Sample[];
  minSpeedKnots: number;
  maxSpeedKnots: number;
  gridSizeMeters: number;
};

type S111ArrowGlyph = {
  positions: CesiumObject[];
  outlinePositions: CesiumObject[];
  indices: number[];
  colorKey: string;
  color: unknown;
};

type BrowserImageLike = {
  crossOrigin?: string | null;
  src: string;
  complete?: boolean;
  naturalWidth?: number;
  onload?: (() => void) | null;
  onerror?: (() => void) | null;
  addEventListener?: (type: "load" | "error", listener: () => void, options?: { once?: boolean }) => void;
  removeEventListener?: (type: "load" | "error", listener: () => void) => void;
};

type DeferredImageSource = {
  image: string | BrowserImageLike;
  readonly ready: boolean;
  onLoad(callback: () => void): void;
};

type S102HeightCoordinate = {
  axisIndex: 0 | 1 | 2;
  sign: 1 | -1;
};

type S102ShaderCoordinateContext = {
  useProjectedLocalWorldHeight: boolean;
  worldToProjectedLocalMatrix?: unknown;
  projectedLocalOriginZ: number;
};

type ProjectedWmsDefinition = {
  urlTemplate: string;
  extent: SpatialExtent;
};

type CesiumPanHandler = (dx: number, dy: number, panSpeed: number) => void;
type VesselDimensionsLike = {
  draught: number;
  bow: number;
  stern: number;
  port: number;
  starboard: number;
};

type NativeSubscription = {
  unsubscribe(): void;
};

type NativeEmitter<TPayload> = {
  subscribe(listener: (payload: TPayload) => void): NativeSubscription;
  emit(payload: TPayload): void;
  clear(): void;
};

type CesiumVesselNativeView = {
  getPosition(): [number, number, number];
  getHeading(): number;
  positionChanged: NativeEmitter<[number, number, number]>;
  headingChanged: NativeEmitter<number>;
};

type VesselGizmoAxis = "x" | "y" | "z" | "heading";

type VesselGizmoPickInfo = {
  layer: Extract<CesiumLayerNative, { kind: "vessel" }>;
  axis: VesselGizmoAxis;
};

type CesiumSkyboxFaces = {
  positiveX: string;
  negativeX: string;
  positiveY: string;
  negativeY: string;
  positiveZ: string;
  negativeZ: string;
};

type S102LightingFallbackState = {
  enabled: boolean;
  directionWC: Vector3Fields;
  ambientIntensity: number;
  directionalIntensity: number;
};

const DEFAULT_PROJECTED_MAP_HEIGHT_OFFSET_METERS = 0.5;
const DEFAULT_S111_HEIGHT_OFFSET_METERS = 1;
const PROJECTED_S102_MAXIMUM_SCREEN_SPACE_ERROR = 0.25;
const CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION: Vector3Fields = { x: 0, y: 0.55, z: -0.83 };
const S102_LIGHTING_FALLBACK_AMBIENT_INTENSITY = 0.48;
const S102_LIGHTING_FALLBACK_DIRECTIONAL_INTENSITY = 0.82;
const CESIUM_TILE_CONTENT_STATE_UNLOADED = 0;
const CESIUM_TILE_CONTENT_STATE_FAILED = 5;
const S102_FAILED_TILE_RETRY_INITIAL_DELAY_MS = 1000;
const S102_FAILED_TILE_RETRY_MAX_DELAY_MS = 30000;
const S102_FAILED_TILE_RETRY_MAX_ATTEMPTS = 10;
const S102_FAILED_TILE_RETRY_JITTER_RATIO = 0.35;
const CENTIMETERS_PER_SECOND_TO_KNOTS = 0.019438444924406;
const S111_SPEED_LEGEND_MAX_KNOTS = 99;
const S111_ARROW_MIN_SPEED_SCALE = 0.2;
const S111_ARROW_MAX_SPEED_SCALE = 1;
const S111_ARROW_EXPLICIT_MAX_SPEED_SCALE = 0.65;
const S111_ARROW_EXPLICIT_REFERENCE_SPEED_KNOTS = 10;
const S111_ARROW_MAX_LOCAL_SPACING_FACTOR = 1;
const S111_ARROW_OUTLINE_WIDTH = 0.0105;
const S111_ARROW_FILL_Z_OFFSET_METERS = 0.02;
const S111_SPEED_COLOR_BANDS: readonly (readonly [number, number, number, number])[] = [
  [0.5, 0x76 / 255, 0x52 / 255, 0xe2 / 255],
  [1, 0x48 / 255, 0x98 / 255, 0xd3 / 255],
  [2, 0x61 / 255, 0xcb / 255, 0xe5 / 255],
  [3, 0x6d / 255, 0xbc / 255, 0x45 / 255],
  [5, 0xb4 / 255, 0xdc / 255, 0x00 / 255],
  [7, 0xcd / 255, 0xc1 / 255, 0x00 / 255],
  [10, 0xf8 / 255, 0xa7 / 255, 0x18 / 255],
  [13, 0xf7 / 255, 0xa2 / 255, 0x9d / 255],
  [S111_SPEED_LEGEND_MAX_KNOTS, 0xff / 255, 0x1e / 255, 0x1e / 255],
];
const S111_ARROW_POLYGON: readonly (readonly [number, number])[] = [
  [0.5, 0],
  [0.15, 0.2],
  [0.15, 0.1],
  [-0.5, 0.05],
  [-0.5, -0.05],
  [0.15, -0.1],
  [0.15, -0.2],
];
const S111_ARROW_OUTLINE_POLYGON = offsetClosedPolygon(S111_ARROW_POLYGON, S111_ARROW_OUTLINE_WIDTH);
const S111_ARROW_FILL_INDICES = [0, 1, 6, 2, 3, 4, 2, 4, 5] as const;
const SIMULATED_WATER_LEVEL_PRODUCT = "simulated-water-level";

type DomListenerTarget = {
  addEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ) => void;
};

export const cesiumAdapterCapabilities: AdapterCapabilities = {
  sceneGeoreferences: ["projected-local", "ellipsoid-ecef"],
  layerProducts: ["S-101", "S-57", "S-102", "S-111", "simulated-water-level", "vessel", "map-overlay", "tool"],
  supportedProductVersions: S100SupportedProductVersions,
  dataSources: ["3d-tiles", "wms", "wmts", "rest-json", "static-json", "model"],
  cameraControls: ["pose", "look-at"],
  picking: true,
  timeDynamicLayers: true,
  nativeHandles: true,
  precisionStrategy: "engine-native",
  globe: {
    ellipsoidEcef: true,
    globeNative3dTiles: true,
    oceanMasking: false,
  },
  visualFeatures: {
    depthRay: true,
    hoverPrism: true,
    vesselTransformGizmo: { supported: true, modes: ["translate", "rotate", "translate-rotate"] },
    vesselOceanSurface: { supported: true, modes: ["projected-local-disc"] },
    vesselShadow: { supported: true, modes: ["projected-local-shadow"] },
    staticLighting: true,
    dynamicLighting: { supported: true, modes: ["scene-time"] },
  },
  extensions: {
    adapterLimitations: [
      "Projected-local S-102 tiles must be supplied as Cesium-compatible 3D Tiles or transformed by the service.",
      "Ocean masking and curved-earth surface replacement are deferred to the dedicated globe/ECEF phase.",
    ],
  },
};

export const createCesiumAdapter = (
  options: CesiumAdapterOptions = {},
): S100EngineAdapter => ({
  id: "cesium",
  displayName: "Cesium",
  capabilities: cesiumAdapterCapabilities,
  getCapabilities: () => cesiumAdapterCapabilities,
  async createViewerHost(hostOptions) {
    const cesium = await resolveCesiumModule(options.cesiumModule);
    const parent = getHtmlElement(hostOptions.container);
    if (options.accessToken !== undefined) {
      setCesiumAccessToken(cesium, options.accessToken);
    }
    return new CesiumViewerHost(cesium, parent, options, hostOptions);
  },
  async destroyViewerHost(host) {
    await host.destroy();
  },
});

class CesiumViewerHost implements EngineViewerHost {
  private readonly viewer: CesiumObject;

  constructor(
    private readonly cesium: CesiumModule,
    parent: HTMLElement | null,
    private readonly options: CesiumAdapterOptions,
    hostOptions: ViewerHostOptions,
  ) {
    const Viewer = getCesiumConstructor(cesium, "Viewer");
    if (!parent) {
      throw new S100Error("adapter-lifecycle", "Cesium adapter requires an HTML container.");
    }

    const viewerOptions = {
      animation: false,
      timeline: false,
      baseLayerPicker: true,
      geocoder: false,
      homeButton: true,
      navigationHelpButton: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
      useBrowserRecommendedResolution: false,
      ...options.viewerOptions,
    };
    hostOptions.logger?.debug?.("Creating Cesium viewer", viewerOptions);
    this.viewer = new Viewer(parent, viewerOptions);
  }

  getEngineHandles(): EngineHandleBundle {
    return {
      adapterId: "cesium",
      engineName: "Cesium",
      ...createEngineVersionFields(this.cesium),
      engineInstance: this.viewer,
      instances: {
        viewer: this.viewer,
        scene: getObject(this.viewer, "scene"),
        camera: getObject(this.viewer, "camera"),
        canvas: getObject(getObject(this.viewer, "scene"), "canvas"),
      },
      staticObjects: {
        Cesium: this.cesium,
        Color: this.cesium.Color,
        Cartesian2: this.cesium.Cartesian2,
        Cartesian3: this.cesium.Cartesian3,
        Matrix4: this.cesium.Matrix4,
      },
      resources: {
        cesiumDocs: "https://cesium.com/learn/cesiumjs/ref-doc/",
      },
    };
  }

  createScene(options: SceneOptions): Promise<EngineScene> {
    return Promise.resolve(new CesiumEngineScene(this.cesium, this.viewer, options, this.options));
  }

  destroy(): void {
    destroyCesiumObject(this.viewer);
  }
}

class CesiumEngineScene implements EngineScene {
  private readonly layers = new Map<EngineLayerHandle, CesiumLayerNative>();
  private currentTime = new Date(0);
  private currentSeaLevel = 0;
  private hoverPrismDrawables: CesiumSceneDrawable[] = [];
  private readonly projectedWmsCutoutCandidates: SpatialExtent[] = [];
  private cameraPanAbort: (() => void) | null = null;
  private cameraOrbitAbort: (() => void) | null = null;
  private vesselGizmoAbort: (() => void) | null = null;
  private livePickAbort: (() => void) | null = null;
  private layerPatchListener: EngineLayerPatchListener | null = null;
  private depthRayDrawables: CesiumSceneDrawable[] = [];
  private dynamicLightingEnabled = false;
  private environmentLightingState: EnvironmentState["lighting"] | undefined;
  private environmentTextureLightingAvailable = false;
  private lastSceneLightDirectionWC: Vector3Fields = CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION;
  private lastSceneLightIntensity = 1.35;
  private s102LightingFallbackState: S102LightingFallbackState = {
    enabled: true,
    directionWC: CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION,
    ambientIntensity: S102_LIGHTING_FALLBACK_AMBIENT_INTENSITY,
    directionalIntensity: S102_LIGHTING_FALLBACK_DIRECTIONAL_INTENSITY,
  };
  private lastCameraPose: EngineCameraPose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  constructor(
    private readonly cesium: CesiumModule,
    private readonly viewer: CesiumObject,
    private readonly sceneOptions: SceneOptions,
    private readonly options: CesiumAdapterOptions,
  ) {
    if (this.isProjectedLocalScene()) {
      this.configureProjectedLocalScene();
    }
    this.dynamicLightingEnabled = options.dynamicLighting === true;
    this.applyStaticLighting();
    if (this.dynamicLightingEnabled) {
      this.updateDynamicLightingForTime(this.currentTime);
    }
    this.vesselGizmoAbort = this.installVesselGizmoHandler();
  }

  getEngineHandles(): EngineHandleBundle {
    return {
      adapterId: "cesium",
      engineName: "Cesium",
      ...createEngineVersionFields(this.cesium),
      engineInstance: this.viewer,
      instances: {
        viewer: this.viewer,
        scene: getObject(this.viewer, "scene"),
        camera: getObject(this.viewer, "camera"),
        canvas: getObject(getObject(this.viewer, "scene"), "canvas"),
        clock: getObject(this.viewer, "clock"),
        sceneOptions: this.sceneOptions,
      },
      staticObjects: {
        Cesium: this.cesium,
        Color: this.cesium.Color,
        Cartesian2: this.cesium.Cartesian2,
        Cartesian3: this.cesium.Cartesian3,
        Matrix4: this.cesium.Matrix4,
      },
      resources: {
        cesiumDocs: "https://cesium.com/learn/cesiumjs/ref-doc/",
      },
    };
  }

  setCameraControls(config: CameraControlConfig): void {
    this.cameraPanAbort?.();
    this.cameraPanAbort = null;
    this.cameraOrbitAbort?.();
    this.cameraOrbitAbort = null;
    applyCesiumCameraControls(this.cesium, this.viewer, config);
    if (this.isProjectedLocalScene()) {
      this.cameraOrbitAbort = installCesiumCameraOrbitHandler(
        this.cesium,
        this.viewer,
        config,
        (dx, dy, orbitSpeed) => this.orbitProjectedLocalCamera(dx, dy, orbitSpeed),
      );
      if (this.cameraOrbitAbort) {
        disableCesiumNativeCameraRotate(this.viewer);
      }
    }
    this.cameraPanAbort = installCesiumCameraPanHandler(
      this.cesium,
      this.viewer,
      config,
      this.isProjectedLocalScene()
        ? (dx, dy, panSpeed) => this.panProjectedLocalCamera(dx, dy, panSpeed)
        : undefined,
    );
  }

  setCamera(pose: EngineCameraPose): void {
    this.lastCameraPose = cloneCameraPose(pose);
    const camera = getObject(this.viewer, "camera");
    const destination = this.coordinateToCartesian({
      kind: "engine-local",
      x: pose.position.x,
      y: pose.position.y,
      z: pose.position.z,
      frameId: "camera",
    });
    const orientation = this.createCameraOrientationFromPose(pose);
    if (hasFunction(camera, "setView")) {
      camera.setView?.(orientation ? { destination, orientation } : { destination });
    }
  }

  getCamera(): EngineCameraPose {
    const camera = getObject(this.viewer, "camera");
    const position = getObject(camera, "position");
    if (!camera || !position) {
      return cloneCameraPose(this.lastCameraPose);
    }

    const projectedPosition = this.worldCartesianToProjected(position);
    const posePosition = projectedPosition ?? {
      x: getFiniteNumber(position.x, this.lastCameraPose.position.x),
      y: getFiniteNumber(position.y, this.lastCameraPose.position.y),
      z: getFiniteNumber(position.z, this.lastCameraPose.position.z),
    };
    const rotation = this.cameraRotationFromCesium(camera) ?? { ...this.lastCameraPose.rotation };
    this.lastCameraPose = {
      position: posePosition,
      rotation,
      ...(this.lastCameraPose.focalDistance !== undefined
        ? { focalDistance: this.lastCameraPose.focalDistance }
        : {}),
    };

    return {
      position: posePosition,
      rotation: { ...rotation },
      ...(this.lastCameraPose.focalDistance !== undefined
        ? { focalDistance: this.lastCameraPose.focalDistance }
        : {}),
    };
  }

  lookAt(view: CameraLookAt): void {
    const camera = getObject(this.viewer, "camera");
    const target = this.coordinateToCartesian(view.target);
    const heading = degreesToRadians(this.cesium, view.headingDegrees ?? 0);
    const pitch = degreesToRadians(this.cesium, -(view.pitchDegrees ?? 45));
    const range = view.rangeMeters;
    if (hasFunction(camera, "lookAt") && hasConstructor(this.cesium, "HeadingPitchRange")) {
      const HeadingPitchRange = getCesiumConstructor(this.cesium, "HeadingPitchRange");
      camera.lookAt?.(target, new HeadingPitchRange(heading, pitch, range));
      return;
    }
    if (hasFunction(camera, "setView")) {
      const geodetic = this.coordinateToLonLatHeight(view.target);
      camera.setView?.({
        destination: this.cartesianFromDegrees(geodetic.lon, geodetic.lat, geodetic.height + range),
      });
    }
  }

  setTime(time: Date): void {
    this.currentTime = new Date(time);
    const clock = getObject(this.viewer, "clock");
    const JulianDate = this.cesium.JulianDate as
      | { fromDate?: (date: Date) => unknown }
      | undefined;
    if (clock && JulianDate?.fromDate) {
      clock.currentTime = JulianDate.fromDate(this.currentTime);
    }
    if (this.dynamicLightingEnabled) {
      this.updateDynamicLightingForTime(this.currentTime);
    }

    for (const native of this.layers.values()) {
      if (native.kind === "simulated-water-level") {
        const seaLevel = resolveWaterLevel(native.data, this.currentTime);
        if (seaLevel !== null) {
          this.setSeaLevel(seaLevel);
        }
      }
      if (native.kind === "s111") {
        this.rebuildS111Layer(native);
      }
    }
    this.updateVesselPresentationDrawables();
  }

  setSeaLevel(value: number): void {
    this.currentSeaLevel = value;
    for (const native of this.layers.values()) {
      if (native.kind !== "3d-tiles") {
        continue;
      }
      if (!updateS102TilesetSeaLevel(native.primitive, this.currentSeaLevel)) {
        applyS102TilesetStyle(
          this.cesium,
          native.primitive,
          native.spec,
          this.createS102ShaderCoordinateContext(native.spec),
          this.currentSeaLevel,
          this.s102LightingFallbackState,
        );
      }
    }
    this.updateVesselPresentationDrawables();
    if (this.depthRayDrawables.length > 0) {
      this.clearDepthRayVisual();
    }
  }

  getSeaLevel(): number {
    return this.currentSeaLevel;
  }

  setLayerPatchListener(listener: EngineLayerPatchListener | null): void {
    this.layerPatchListener = listener;
  }

  setEnvironment(state: EnvironmentState): void {
    const scene = getObject(this.viewer, "scene");
    if (!scene) {
      return;
    }
    this.applyCesiumBackgroundEnvironment(scene, state);
    const textureLightingAvailable = this.applyCesiumSpecularEnvironment(scene, state);
    if (textureLightingAvailable !== this.environmentTextureLightingAvailable) {
      this.environmentTextureLightingAvailable = textureLightingAvailable;
      this.updateS102LightingFallbackState(this.lastSceneLightDirectionWC, this.lastSceneLightIntensity);
    }
    if (state.background === "solid" && state.metadata?.color !== undefined) {
      scene.backgroundColor = toCesiumColor(this.cesium, state.metadata.color);
    }
    const globe = getObject(scene, "globe");
    if (globe && state.background === "transparent") {
      globe.show = false;
    } else if (globe && state.background !== "transparent") {
      globe.show = true;
    }
    if (state.lighting !== undefined) {
      this.environmentLightingState = state.lighting;
      this.dynamicLightingEnabled =
        state.lighting.dynamic?.enabled ?? this.options.dynamicLighting === true;
      if (this.dynamicLightingEnabled) {
        this.updateDynamicLightingForTime(this.currentTime);
      } else {
        this.applyStaticLighting(state);
      }
    }
  }

  private applyCesiumBackgroundEnvironment(scene: CesiumObject, state: EnvironmentState): void {
    const skyBox = getObject(scene, "skyBox");
    const skyAtmosphere = getObject(scene, "skyAtmosphere");
    if (state.background !== "skybox") {
      if (skyBox) {
        skyBox.show = false;
      }
      return;
    }

    const sources = resolveCesiumSkyboxSources(state);
    const SkyBox = this.cesium.SkyBox as CesiumConstructor | undefined;
    if (sources && typeof SkyBox === "function") {
      const existingSkyBox = getObject(scene, "skyBox");
      if (existingSkyBox && hasFunction(existingSkyBox, "destroy")) {
        destroyCesiumObject(existingSkyBox);
      }
      scene.skyBox = new SkyBox({ sources });
    }
    const activeSkyBox = getObject(scene, "skyBox");
    if (activeSkyBox) {
      activeSkyBox.show = Boolean(sources);
    }
    if (skyAtmosphere) {
      skyAtmosphere.show = !sources;
    }
  }

  private applyCesiumSpecularEnvironment(scene: CesiumObject, state: EnvironmentState): boolean {
    const environmentMapUrl = state.lighting?.environmentMapUrl ?? getStringMetadata(state, "environmentMapUrl");
    if (!environmentMapUrl) {
      scene.specularEnvironmentMaps = undefined;
      return false;
    }
    scene.__s100EnvironmentMapUrl = environmentMapUrl;
    if (isKtx2EnvironmentMap(environmentMapUrl)) {
      scene.specularEnvironmentMaps = environmentMapUrl;
      return true;
    }
    scene.specularEnvironmentMaps = undefined;
    return false;
  }

  private applyStaticLighting(state?: EnvironmentState): void {
    const lighting = state?.lighting ?? this.environmentLightingState;
    const requestedDirection = lighting?.sunDirection;
    const direction = normalizeVector3(requestedDirection ?? null) ?? CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION;
    const worldDirection = this.projectedLocalVectorToWorld(direction) ?? direction;
    this.setSceneDirectionalLight(worldDirection, lighting?.directionalIntensity ?? 1.35);
    const scene = getObject(this.viewer, "scene");
    const globe = getObject(scene, "globe");
    if (globe) {
      globe.enableLighting = false;
    }
  }

  private updateDynamicLightingForTime(time: Date): void {
    const direction = this.sunDirectionFromTime(time);
    const worldDirection = this.projectedLocalVectorToWorld(direction) ?? direction;
    this.setSceneDirectionalLight(worldDirection, this.environmentLightingState?.directionalIntensity ?? 1.25);
    const scene = getObject(this.viewer, "scene");
    const globe = getObject(scene, "globe");
    if (globe) {
      globe.enableLighting = true;
    }
  }

  private setSceneDirectionalLight(direction: Vector3Fields, intensity: number): void {
    const scene = getObject(this.viewer, "scene");
    if (!scene) {
      return;
    }
    const normalized = normalizeVector3(direction) ?? CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION;
    const DirectionalLight = this.cesium.DirectionalLight as CesiumConstructor | undefined;
    const lightOptions = {
      direction: cartesianFromElements(this.cesium, normalized.x, normalized.y, normalized.z),
      intensity: normalizePositiveNumber(intensity, 1.25),
    };
    scene.light = DirectionalLight ? new DirectionalLight(lightOptions) : lightOptions;
    this.updateS102LightingFallbackState(normalized, lightOptions.intensity);
  }

  private updateS102LightingFallbackState(directionWC: Vector3Fields, sceneLightIntensity: number): void {
    this.lastSceneLightDirectionWC = normalizeVector3(directionWC) ?? CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION;
    this.lastSceneLightIntensity = normalizePositiveNumber(sceneLightIntensity, 1.25);
    const lighting = this.environmentLightingState;
    const enabled = !this.environmentTextureLightingAvailable;
    this.s102LightingFallbackState = {
      enabled,
      directionWC: this.lastSceneLightDirectionWC,
      ambientIntensity: enabled
        ? Math.max(
            normalizePositiveNumber(lighting?.ambientIntensity, 0),
            normalizePositiveNumber(lighting?.environmentIntensity, 0) * 0.75,
            S102_LIGHTING_FALLBACK_AMBIENT_INTENSITY,
          )
        : normalizePositiveNumber(lighting?.ambientIntensity, 0),
      directionalIntensity: enabled
        ? Math.max(
            normalizePositiveNumber(lighting?.directionalIntensity, 0),
            this.lastSceneLightIntensity,
            S102_LIGHTING_FALLBACK_DIRECTIONAL_INTENSITY,
          )
        : normalizePositiveNumber(lighting?.directionalIntensity, this.lastSceneLightIntensity),
    };
    this.updateS102LightingFallbackUniforms();
  }

  private updateS102LightingFallbackUniforms(): void {
    for (const native of this.layers.values()) {
      if (native.kind === "3d-tiles") {
        updateS102TilesetLightingFallback(native.primitive, this.s102LightingFallbackState);
      }
    }
  }

  private sunDirectionFromTime(time: Date): Vector3Fields {
    const hours = time.getUTCHours() + time.getUTCMinutes() / 60 + time.getUTCSeconds() / 3600;
    const dayProgress = hours / 24;
    const daylight = Math.sin((dayProgress - 0.25) * Math.PI * 2);
    const elevation = Math.max(0.12, daylight) * (Math.PI / 3);
    const horizontal = Math.cos(elevation);
    return normalizeVector3({
      x: 0,
      y: horizontal,
      z: -Math.sin(elevation),
    }) ?? CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION;
  }

  async addLayer(spec: BaseLayerSpec): Promise<EngineLayerHandle> {
    const native = await this.createNativeLayer(spec);
    const handle: EngineLayerHandle = {
      id: spec.id,
      native,
      dispose: async () => {
        await this.disposeNativeLayer(native);
      },
    };
    this.layers.set(handle, native);
    return handle;
  }

  async updateLayer(handle: EngineLayerHandle, patch: LayerPatch): Promise<void> {
    const native = this.getNativeLayer(handle);
    Object.assign(native.spec, patch);
    this.applyLayerPatch(native, patch);
  }

  async removeLayer(handle: EngineLayerHandle): Promise<void> {
    const native = this.getNativeLayer(handle);
    await this.disposeNativeLayer(native);
    this.layers.delete(handle);
  }

  async pick(request: PickRequest): Promise<PickResult | null> {
    const scene = getObject(this.viewer, "scene");
    const canvas = getObject(scene, "canvas");
    const screenPosition = createCartesian2(this.cesium, request.screenX, request.screenY);
    const picked = hasFunction(scene, "pick") ? scene.pick?.(screenPosition) : undefined;
    const world =
      hasFunction(scene, "pickPosition") && picked
        ? scene.pickPosition?.(screenPosition)
        : this.pickFallbackWorld(request);
    if (!world) {
      return null;
    }

    const worldCoordinate = this.cartesianToPickWorld(world as CesiumObject);
    const result: PickResult = {
      screen: { x: request.screenX, y: request.screenY },
      world: worldCoordinate,
      source: picked ? "geometry" : request.fallback === "sea-level-plane" ? "sea-level-plane" : "terrain",
    };
    const geodetic = this.pickWorldToGeodetic(worldCoordinate);
    if (geodetic !== undefined) {
      result.geodetic = geodetic;
    }
    if (request.includeNative) {
      result.native = { picked, world, canvas };
    }
    return result;
  }

  setLivePickingMode(
    options: LivePickingOptions,
    emitPick: (result: PickResult | null) => void,
  ): void {
    this.livePickAbort?.();
    this.livePickAbort = null;
    this.clearDepthRayVisual();

    if (!options.enabled) {
      return;
    }

    const scene = getObject(this.viewer, "scene");
    const canvas = getObject(scene, "canvas");
    if (!canvas || !hasFunction(canvas, "addEventListener")) {
      return;
    }

    const onMove = (event: Event) => {
      const mouse = event as MouseEvent;
      const request: PickRequest = {
        screenX: mouse.offsetX ?? mouse.clientX,
        screenY: mouse.offsetY ?? mouse.clientY,
      };
      if (options.fallback !== undefined) {
        request.fallback = options.fallback;
      }
      void this.pick(request).then((result) => {
        emitPick(result);
        if (options.includeVisual) {
          this.updateDepthRayVisual(result, options.visual);
        }
      });
    };
    canvas.addEventListener?.("mousemove", onMove);
    this.livePickAbort = () => {
      if (hasFunction(canvas, "removeEventListener")) {
        canvas.removeEventListener?.("mousemove", onMove);
      }
      this.clearDepthRayVisual();
    };
  }

  private updateDepthRayVisual(
    result: PickResult | null,
    visual: LivePickingOptions["visual"] | undefined,
  ): void {
    this.clearDepthRayVisual();
    if (!result?.world) {
      return;
    }
    const projected = this.pickResultWorldToProjected(result);
    if (!projected) {
      return;
    }
    const seaPoint = this.projectedPairToCartesian(
      projected.x,
      projected.y,
      this.currentSeaLevel,
      projected.crs,
    );
    const hitPoint = this.projectedPairToCartesian(projected.x, projected.y, projected.z, projected.crs);
    const topPoint = this.projectedPairToCartesian(
      projected.x,
      projected.y,
      Math.max(projected.z, this.currentSeaLevel) + 120,
      projected.crs,
    );
    const lineWidth = normalizePositiveNumber(visual?.lineThickness, 4);
    const aboveColor = toCesiumColor(
      this.cesium,
      rgbTupleToRgba(visual?.aboveSeaLevelColor, 1, { r: 1, g: 1, b: 0 }),
    );
    const belowColor = toCesiumColor(
      this.cesium,
      rgbTupleToRgba(visual?.belowSeaLevelColor, 1, { r: 0, g: 0, b: 1 }),
    );
    const above = this.createPolylineCollectionPrimitive(
      [[topPoint, seaPoint]],
      () => createColorMaterial(this.cesium, aboveColor),
      lineWidth,
      true,
      false,
    );
    if (above) {
      this.depthRayDrawables.push(this.addPrimitiveDrawable(above));
    }
    if (projected.z < this.currentSeaLevel - 1e-6) {
      const below = this.createPolylineCollectionPrimitive(
        [[seaPoint, hitPoint]],
        () => createColorMaterial(this.cesium, belowColor),
        lineWidth,
        true,
        false,
      );
      if (below) {
        this.depthRayDrawables.push(this.addPrimitiveDrawable(below));
      }
    }
    if (visual?.seaLevelMarkerVisible !== false) {
      const markerSize = normalizePositiveNumber(visual?.seaLevelMarkerSize, 60);
      const markerOpacity = clamp01(visual?.seaLevelMarkerOpacity ?? 0.35);
      const markerColor = toCesiumColor(
        this.cesium,
        rgbTupleToRgba(visual?.seaLevelMarkerColor, markerOpacity, { r: 1, g: 1, b: 1 }),
      );
      const markerPositions = this.createDiscPositions(
        projected.x,
        projected.y,
        this.currentSeaLevel + 0.02,
        markerSize,
        projected.crs,
        36,
      );
      const marker = this.createColoredGeometryPrimitive(
        markerPositions,
        createTriangleFanIndices(markerPositions.length),
        "TRIANGLES",
        markerColor,
        true,
        true,
      );
      if (marker) {
        this.depthRayDrawables.push(this.addPrimitiveDrawable(marker));
      }
    }
  }

  private clearDepthRayVisual(): void {
    for (const drawable of this.depthRayDrawables) {
      this.removeDrawable(drawable);
    }
    this.depthRayDrawables = [];
  }

  private pickResultWorldToProjected(result: PickResult): { x: number; y: number; z: number; crs: string } | null {
    const world = result.world;
    if (!world) {
      return null;
    }
    if (this.isProjectedLocalScene()) {
      if (world.kind === "projected") {
        if (world.crs.toUpperCase() === this.sceneCrs().toUpperCase()) {
          return {
            x: world.x,
            y: world.y,
            z: world.z ?? 0,
            crs: world.crs,
          };
        }
        const [lon, lat] = projectedToLonLat(world.crs, world.x, world.y);
        const [x, y] = lonLatToProjected(this.sceneCrs(), lon, lat);
        return {
          x,
          y,
          z: world.z ?? 0,
          crs: this.sceneCrs(),
        };
      }
      const projected = this.worldCartesianToProjected(this.coordinateToCartesian(world));
      return projected ? { ...projected, crs: this.sceneCrs() } : null;
    }
    if (result.geodetic?.kind === "geodetic") {
      const crs = this.sceneCrs();
      const [x, y] = lonLatToProjected(crs, result.geodetic.lon, result.geodetic.lat);
      return { x, y, z: result.geodetic.height ?? 0, crs };
    }
    return null;
  }

  showHoverPrism(
    corners: EnginePrismCorners2D,
    zPos = 0,
    height = 0,
    rgba?: EngineRgba,
  ): void {
    this.clearHoverPrism();
    const color = toCesiumColor(this.cesium, rgba ?? { r: 0.2, g: 0.7, b: 1, a: 0.24 });
    const top = [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ].map(([x, y]) => this.projectedPairToCartesian(x, y, zPos + height));
    const bottom = [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ].map(([x, y]) => this.projectedPairToCartesian(x, y, zPos));
    const outlineColor = toCesiumColor(this.cesium, { r: 0, g: 0.25, b: 0.45, a: 0.85 });
    const primitiveDrawables = this.createHoverPrismPrimitiveDrawables(top, bottom, color, outlineColor);
    if (primitiveDrawables.length > 0) {
      this.hoverPrismDrawables = primitiveDrawables;
      return;
    }

    const arcTypeNone = getCesiumConstant(this.cesium, "ArcType", "NONE");
    const flatArc = arcTypeNone !== undefined ? { arcType: arcTypeNone } : {};
    this.hoverPrismDrawables = [
      this.addEntityDrawable({
        polygon: {
          hierarchy: createPolygonHierarchy(this.cesium, top),
          perPositionHeight: true,
          material: color,
          outline: true,
          outlineColor,
          ...flatArc,
        },
        polyline: {
          positions: [...top, top[0]],
          material: color,
          depthFailMaterial: color,
          width: 2,
          clampToGround: false,
          ...flatArc,
        },
      }),
      this.addEntityDrawable({
        polyline: {
          positions: [...bottom, bottom[0]],
          material: color,
          depthFailMaterial: color,
          width: 1,
          clampToGround: false,
          ...flatArc,
        },
      }),
    ];
  }

  clearHoverPrism(): void {
    for (const drawable of this.hoverPrismDrawables) {
      this.removeDrawable(drawable);
    }
    this.hoverPrismDrawables = [];
  }

  async dispose(): Promise<void> {
    this.cameraPanAbort?.();
    this.cameraPanAbort = null;
    this.cameraOrbitAbort?.();
    this.cameraOrbitAbort = null;
    this.vesselGizmoAbort?.();
    this.vesselGizmoAbort = null;
    this.livePickAbort?.();
    this.livePickAbort = null;
    this.clearDepthRayVisual();
    this.clearHoverPrism();
    for (const handle of [...this.layers.keys()]) {
      const native = this.layers.get(handle);
      if (native) {
        await this.disposeNativeLayer(native);
      }
    }
    this.layers.clear();
  }

  private async createNativeLayer(spec: BaseLayerSpec): Promise<CesiumLayerNative> {
    switch (spec.product) {
      case S100ProductType.S102:
        return this.createTilesLayer(spec as S102BathymetryLayerSpec);
      case S100ProductType.S101:
        return this.createImageryLayer(spec as EncLayerSpec);
      case "S-57":
        return this.createImageryLayer(spec as EncLayerSpec);
      case S100ProductType.S111:
        return this.createS111Layer(spec as S111SurfaceCurrentLayerSpec);
      case SIMULATED_WATER_LEVEL_PRODUCT:
        return this.createSimulatedWaterLevelLayer(spec as SimulatedWaterLevelLayerSpec);
      case "map-overlay":
        return this.createImageryLayer(spec as MapOverlayLayerSpec);
      case "vessel":
        return this.createVesselLayer(spec as VesselLayerSpec);
      default:
        throw new S100Error(
          "adapter-capability",
          `Cesium adapter does not yet support layer product '${String(spec.product)}'.`,
          spec,
        );
    }
  }

  private async createTilesLayer(spec: S102BathymetryLayerSpec): Promise<CesiumLayerNative> {
    assertSourceKind(spec, "3d-tiles");
    const url = createTilesetUrl(spec.source);
    const modelMatrix = this.createProjectedTilesetModelMatrix(spec.source);
    const options: Record<string, unknown> = {
      show: spec.visible ?? true,
      maximumScreenSpaceError: getNumberExtension(
        spec,
        "maximumScreenSpaceError",
        modelMatrix ? PROJECTED_S102_MAXIMUM_SCREEN_SPACE_ERROR : 16,
      ),
    };
    if (modelMatrix) {
      options.modelMatrix = modelMatrix;
      options.cullWithChildrenBounds = false;
      options.cullRequestsWhileMoving = false;
      options.cullRequestsWhileMovingMultiplier = 0;
      options.dynamicScreenSpaceError = false;
      options.foveatedScreenSpaceError = false;
      options.progressiveResolutionHeightFraction = 0;
      options.skipLevelOfDetail = getBooleanExtension(spec, "skipLevelOfDetail", false);
      options.baseScreenSpaceError = getNumberExtension(spec, "baseScreenSpaceError", 1024);
      options.skipScreenSpaceErrorFactor = getNumberExtension(spec, "skipScreenSpaceErrorFactor", 16);
      options.skipLevels = getNumberExtension(spec, "skipLevels", 1);
      options.loadSiblings = getBooleanExtension(spec, "loadSiblings", true);
      options.immediatelyLoadDesiredLevelOfDetail = getBooleanExtension(
        spec,
        "immediatelyLoadDesiredLevelOfDetail",
        true,
      );
      options.preferLeaves = getBooleanExtension(spec, "preferLeaves", true);
      options.preloadFlightDestinations = getBooleanExtension(spec, "preloadFlightDestinations", false);
      options.cacheBytes = getNumberExtension(spec, "cacheBytes", 768 * 1024 * 1024);
      options.maximumCacheOverflowBytes = getNumberExtension(
        spec,
        "maximumCacheOverflowBytes",
        768 * 1024 * 1024,
      );
      options.maximumMemoryUsage = getNumberExtension(spec, "maximumMemoryUsage", 768);
    }
    const tileset = await createCesium3DTileset(this.cesium, url, options);
    const cleanup = configureS102TilesetRefinement(this.cesium, tileset, spec);
    applyS102TilesetStyle(
      this.cesium,
      tileset,
      spec,
      this.createS102ShaderCoordinateContext(spec),
      this.currentSeaLevel,
      this.s102LightingFallbackState,
    );
    this.addPrimitive(tileset);
    return { kind: "3d-tiles", spec, primitive: tileset, cleanup };
  }

  private createImageryLayer(spec: EncLayerSpec | MapOverlayLayerSpec): CesiumLayerNative {
    const projectedWms = this.createProjectedWmsDefinition(spec);
    if (projectedWms) {
      return this.createProjectedWmsLayer(spec, projectedWms.urlTemplate, projectedWms.extent);
    }

    const provider = this.createImageryProvider(spec);
    const layer = this.addImageryProvider(provider);
    layer.alpha = spec.opacity ?? spec.style?.opacity ?? 1;
    layer.show = spec.visible ?? spec.style?.visible ?? true;
    return { kind: "imagery", spec, provider, layer };
  }

  private async createSimulatedWaterLevelLayer(
    spec: SimulatedWaterLevelLayerSpec,
  ): Promise<CesiumLayerNative> {
    const data = await loadJsonSource(spec.source, this.options.fetchHandler);
    const seaLevel = resolveWaterLevel(data, this.currentTime);
    if (seaLevel !== null) {
      this.setSeaLevel(seaLevel);
    }
    return { kind: "simulated-water-level", spec, data };
  }

  private async createS111Layer(spec: S111SurfaceCurrentLayerSpec): Promise<CesiumLayerNative> {
    const data = await loadJsonSource(spec.source, this.options.fetchHandler);
    return {
      kind: "s111",
      spec,
      data,
      drawables: this.createS111Drawables(spec, data),
    };
  }

  private createVesselLayer(spec: VesselLayerSpec): CesiumLayerNative {
    assertSourceKind(spec, "model");
    const entity = this.addEntity({
      id: spec.id,
      name: spec.title ?? spec.id,
      position: this.coordinateToCartesian(this.vesselModelRootCoordinate(spec), spec.source),
      orientation: this.createHeadingOrientation(spec),
      model: {
        uri: spec.source.url,
        minimumPixelSize: getNumberExtension(spec, "minimumPixelSize", 32),
        maximumScale: getNumberExtension(spec, "maximumScale", 5000),
      },
      show: spec.visible ?? spec.style?.visible ?? true,
    });
    let native: Extract<CesiumLayerNative, { kind: "vessel" }>;
    const view = createCesiumVesselNativeView(() => native.spec);
    native = {
      kind: "vessel",
      spec,
      entity,
      drawables: [],
      view,
    };
    native.drawables = this.createVesselPresentationDrawables(native);
    return native;
  }

  private updateVesselPresentationDrawables(): void {
    for (const native of this.layers.values()) {
      if (native.kind === "vessel") {
        this.rebuildVesselPresentationDrawables(native);
      }
    }
  }

  private rebuildVesselPresentationDrawables(native: Extract<CesiumLayerNative, { kind: "vessel" }>): void {
    for (const drawable of native.drawables) {
      this.removeDrawable(drawable);
    }
    native.drawables = this.createVesselPresentationDrawables(native);
  }

  private createVesselPresentationDrawables(native: Extract<CesiumLayerNative, { kind: "vessel" }>): CesiumSceneDrawable[] {
    const spec = native.spec;
    return [
      ...this.createVesselShadowDrawables(spec),
      ...this.createVesselOceanSurfaceDrawables(spec),
      ...this.createVesselGizmoDrawables(native),
    ];
  }

  private createVesselGizmoDrawables(native: Extract<CesiumLayerNative, { kind: "vessel" }>): CesiumSceneDrawable[] {
    const spec = native.spec;
    const mode = getVesselTransformControlMode(spec);
    if (!getVesselTransformGizmoEnabled(spec) || mode === "none") {
      return [];
    }
    const center = this.vesselProjectedCenter(spec);
    if (!center) {
      return [];
    }
    const visible = spec.visible ?? spec.style?.visible ?? true;
    const size = getVesselGizmoSizeMeters(spec);
    const baseZ = this.currentSeaLevel + 1;
    const xStart = this.projectedPairToCartesian(center.x - size, center.y, baseZ, center.crs);
    const xEnd = this.projectedPairToCartesian(center.x + size, center.y, baseZ, center.crs);
    const yStart = this.projectedPairToCartesian(center.x, center.y - size, baseZ, center.crs);
    const yEnd = this.projectedPairToCartesian(center.x, center.y + size, baseZ, center.crs);
    const zStart = this.projectedPairToCartesian(center.x, center.y, baseZ, center.crs);
    const zEnd = this.projectedPairToCartesian(center.x, center.y, baseZ + size * 1.25, center.crs);
    const drawables: CesiumSceneDrawable[] = [];

    if (mode === "translate" || mode === "translate-rotate") {
      const xAxis = this.createPolylineCollectionPrimitive(
        [[xStart, xEnd]],
        () => createColorMaterial(this.cesium, toCesiumColor(this.cesium, { r: 1, g: 0.05, b: 0.05, a: 1 })),
        4,
        visible,
        false,
      );
      const yAxis = this.createPolylineCollectionPrimitive(
        [[yStart, yEnd]],
        () => createColorMaterial(this.cesium, toCesiumColor(this.cesium, { r: 0.05, g: 0.8, b: 0.05, a: 1 })),
        4,
        visible,
        false,
      );
      const zAxis = this.createPolylineCollectionPrimitive(
        [[zStart, zEnd]],
        () => createColorMaterial(this.cesium, toCesiumColor(this.cesium, { r: 0.05, g: 0.2, b: 1, a: 1 })),
        4,
        visible,
        false,
      );
      if (xAxis) {
        this.tagVesselGizmoPrimitive(xAxis, native, "x");
      }
      if (yAxis) {
        this.tagVesselGizmoPrimitive(yAxis, native, "y");
      }
      if (zAxis) {
        this.tagVesselGizmoPrimitive(zAxis, native, "z");
      }
      for (const primitive of [xAxis, yAxis, zAxis]) {
        if (primitive) {
          drawables.push(this.addPrimitiveDrawable(primitive));
        }
      }
    }

    if (mode === "rotate" || mode === "translate-rotate") {
      const ringSegments = this.createVesselRingSegments(center.x, center.y, baseZ, size * 1.15, center.crs);
      const ring = this.createPolylineCollectionPrimitive(
        ringSegments,
        () => createColorMaterial(this.cesium, toCesiumColor(this.cesium, { r: 1, g: 0.95, b: 0, a: 1 })),
        3,
        visible,
        false,
      );
      if (ring) {
        this.tagVesselGizmoPrimitive(ring, native, "heading");
        drawables.push(this.addPrimitiveDrawable(ring));
      }
    }

    return drawables;
  }

  private tagVesselGizmoPrimitive(
    primitive: CesiumObject,
    layer: Extract<CesiumLayerNative, { kind: "vessel" }>,
    axis: VesselGizmoAxis,
  ): void {
    const pickInfo: VesselGizmoPickInfo = { layer, axis };
    primitive.__s100VesselGizmo = pickInfo;
    const polylineItems = primitive.__s100PolylineItems;
    if (Array.isArray(polylineItems)) {
      for (const item of polylineItems) {
        if (item && typeof item === "object") {
          (item as CesiumObject).__s100VesselGizmo = pickInfo;
        }
      }
    }
  }

  private installVesselGizmoHandler(): (() => void) | null {
    const ScreenSpaceEventHandler = this.cesium.ScreenSpaceEventHandler as CesiumConstructor | undefined;
    const screenEvents = this.cesium.ScreenSpaceEventType as Record<string, unknown> | undefined;
    const scene = getObject(this.viewer, "scene") as CesiumVesselGizmoScene | null;
    const canvas = getObject(scene, "canvas");
    if (
      !scene ||
      !ScreenSpaceEventHandler ||
      !screenEvents?.LEFT_DOWN ||
      !screenEvents.LEFT_UP ||
      !screenEvents.MOUSE_MOVE ||
      !canvas
    ) {
      return null;
    }

    const handler = new ScreenSpaceEventHandler(canvas) as CesiumObject & {
      setInputAction?: (callback: (movement: unknown) => void, type: unknown) => void;
      destroy?: () => void;
    };
    if (typeof handler.setInputAction !== "function") {
      return null;
    }

    let drag: {
      pickInfo: VesselGizmoPickInfo;
      lastX: number;
      lastY: number;
      previousCameraInputs?: unknown;
    } | null = null;

    const setCameraInputsEnabled = (enabled: boolean): unknown => {
      const controller = getObject(scene, "screenSpaceCameraController");
      if (!controller || !("enableInputs" in controller)) {
        return undefined;
      }
      const previous = controller.enableInputs;
      controller.enableInputs = enabled;
      return previous;
    };

    const stopDrag = () => {
      if (drag?.previousCameraInputs !== undefined) {
        const controller = getObject(scene, "screenSpaceCameraController");
        if (controller) {
          controller.enableInputs = drag.previousCameraInputs;
        }
      }
      scene.__s100VesselGizmoDragging = false;
      drag = null;
    };

    handler.setInputAction((movement: unknown) => {
      const point = screenSpaceMovementPoint(movement, "position");
      if (!point || !hasFunction(scene, "pick")) {
        return;
      }
      const picked = scene.pick?.(createCartesian2(this.cesium, point.x, point.y));
      const pickInfo = this.resolveVesselGizmoPick(picked);
      if (!pickInfo) {
        return;
      }
      (scene as CesiumVesselGizmoScene).__s100VesselGizmoDragging = true;
      drag = {
        pickInfo,
        lastX: point.x,
        lastY: point.y,
        previousCameraInputs: setCameraInputsEnabled(false),
      };
    }, screenEvents.LEFT_DOWN);

    handler.setInputAction((movement: unknown) => {
      if (!drag) {
        return;
      }
      const point = screenSpaceMovementPoint(movement, "endPosition");
      if (!point) {
        return;
      }
      const dx = point.x - drag.lastX;
      const dy = point.y - drag.lastY;
      drag.lastX = point.x;
      drag.lastY = point.y;
      if (dx === 0 && dy === 0) {
        return;
      }
      this.applyVesselGizmoDrag(drag.pickInfo, dx, dy);
    }, screenEvents.MOUSE_MOVE);

    handler.setInputAction(stopDrag, screenEvents.LEFT_UP);

    return () => {
      stopDrag();
      if (typeof handler.destroy === "function") {
        handler.destroy();
      }
    };
  }

  private resolveVesselGizmoPick(picked: unknown): VesselGizmoPickInfo | null {
    return resolveVesselGizmoPickInfo(picked);
  }

  private applyVesselGizmoDrag(pickInfo: VesselGizmoPickInfo, dx: number, dy: number): void {
    const native = pickInfo.layer;
    if (!this.layersHasNative(native)) {
      return;
    }
    const metersPerPixel = Math.max(getVesselGizmoSizeMeters(native.spec) / 45, 0.25);
    if (pickInfo.axis === "heading") {
      const heading = normalizeDegrees((native.spec.pose.headingDegrees ?? 0) + dx * 0.45);
      this.updateNativeVesselPose(native, {
        ...native.spec.pose,
        headingDegrees: heading,
      }, true);
      return;
    }

    const delta =
      pickInfo.axis === "x"
        ? { x: dx * metersPerPixel, y: 0, z: 0 }
        : pickInfo.axis === "y"
          ? { x: 0, y: -dy * metersPerPixel, z: 0 }
          : { x: 0, y: 0, z: -dy * metersPerPixel };
    this.updateNativeVesselPose(native, {
      ...native.spec.pose,
      position: offsetCoordinate(native.spec.pose.position, delta, this.sceneCrs()),
    }, true);
  }

  private layersHasNative(native: CesiumLayerNative): boolean {
    for (const candidate of this.layers.values()) {
      if (candidate === native) {
        return true;
      }
    }
    return false;
  }

  private updateNativeVesselPose(
    native: Extract<CesiumLayerNative, { kind: "vessel" }>,
    pose: VesselLayerSpec["pose"],
    emitLayerPatch = false,
  ): void {
    native.spec = {
      ...native.spec,
      pose,
    };
    native.entity.position = this.coordinateToCartesian(
      this.vesselModelRootCoordinate(native.spec),
      native.spec.source,
    );
    native.entity.orientation = this.createHeadingOrientation(native.spec);
    this.rebuildVesselPresentationDrawables(native);
    native.view.positionChanged.emit(native.view.getPosition());
    native.view.headingChanged.emit(native.view.getHeading());
    if (emitLayerPatch) {
      this.emitNativeLayerPatch<VesselLayerSpec>(native, { pose }, "vessel-transform-gizmo");
    }
    this.requestSceneRender();
  }

  private emitNativeLayerPatch<TSpec extends BaseLayerSpec>(
    native: CesiumLayerNative,
    patch: LayerPatch<TSpec>,
    source: string,
  ): void {
    if (!this.layerPatchListener) {
      return;
    }
    const handle = this.findHandleForNative(native);
    if (!handle) {
      return;
    }
    this.layerPatchListener({ handle, patch, source });
  }

  private findHandleForNative(native: CesiumLayerNative): EngineLayerHandle | null {
    for (const [handle, candidate] of this.layers) {
      if (candidate === native) {
        return handle;
      }
    }
    return null;
  }

  private requestSceneRender(): void {
    const scene = getObject(this.viewer, "scene");
    if (hasFunction(scene, "requestRender")) {
      scene.requestRender?.();
    }
  }

  private createVesselOceanSurfaceDrawables(spec: VesselLayerSpec): CesiumSceneDrawable[] {
    const options = getVesselOceanSurfaceOptions(spec);
    if (!options.enabled) {
      return [];
    }
    const center = this.vesselProjectedCenter(spec);
    if (!center) {
      return [];
    }
    const dimensions = getVesselDimensions(spec);
    const radius = normalizePositiveNumber(
      options.radiusMeters,
      Math.max(dimensions.bow + dimensions.stern, dimensions.port + dimensions.starboard) * 0.7,
    );
    const surface = this.createDiscSurfaceGeometry(
      center.x,
      center.y,
      this.currentSeaLevel + 0.03,
      radius,
      center.crs,
    );
    const positions = surface.positions;
    const indices = createTriangleFanIndices(positions.length);
    const opacity = clamp01(options.opacity ?? 0.55);
    const visible = spec.visible ?? spec.style?.visible ?? true;
    const colorValue = normalizeColorValue(options.color, opacity, { r: 0.05, g: 0.4, b: 0.65 });
    const color = toCesiumColor(this.cesium, colorValue);
    const drawables: CesiumSceneDrawable[] = [];

    if (getBooleanExtension(spec, "useCesiumWaterMaterial", true)) {
      const materialPrimitive = this.createWaterSurfacePrimitive(
        positions,
        indices,
        colorValue,
        opacity,
        visible,
        surface.modelMatrix,
        radius,
        options.reflectivity,
        options.roughness,
      );
      if (materialPrimitive) {
        drawables.push(this.addPrimitiveDrawable(materialPrimitive));
      }
    }

    if (drawables.length === 0) {
      const primitive = this.createColoredGeometryPrimitive(
        positions,
        indices,
        "TRIANGLES",
        color,
        true,
        visible,
        surface.modelMatrix,
      );
      if (primitive) {
        drawables.push(this.addPrimitiveDrawable(primitive));
      }
    }

    const outlineGeometry = this.createRingSurfaceGeometry(
      center.x,
      center.y,
      this.currentSeaLevel + 0.05,
      radius,
      center.crs,
      96,
    );
    const outline = this.createPolylineCollectionPrimitive(
      outlineGeometry.segments,
      () => createColorMaterial(this.cesium, toCesiumColor(this.cesium, { r: 0.02, g: 0.36, b: 0.85, a: 0.95 })),
      4,
      visible,
      false,
      outlineGeometry.modelMatrix,
    );
    if (outline) {
      drawables.push(this.addPrimitiveDrawable(outline));
    }
    return drawables;
  }

  private createVesselShadowDrawables(spec: VesselLayerSpec): CesiumSceneDrawable[] {
    const options = getVesselShadowOptions(spec);
    if (!options.enabled) {
      return [];
    }
    const center = this.vesselProjectedCenter(spec);
    if (!center) {
      return [];
    }
    const dimensions = getVesselDimensions(spec);
    const length = dimensions.bow + dimensions.stern;
    const width = dimensions.port + dimensions.starboard;
    const positions = this.createEllipsePositions(
      center.x,
      center.y,
      this.currentSeaLevel - 0.04,
      Math.max(length * 0.52, 1),
      Math.max(width * 0.72, 1),
      spec.pose.headingDegrees ?? 0,
      center.crs,
    );
    const opacity = clamp01(options.opacity ?? 0.22);
    const color = toCesiumColor(
      this.cesium,
      normalizeColorValue(options.color, opacity, { r: 0, g: 0, b: 0 }),
    );
    const primitive = this.createColoredGeometryPrimitive(
      positions,
      createTriangleFanIndices(positions.length),
      "TRIANGLES",
      color,
      true,
      spec.visible ?? spec.style?.visible ?? true,
    );
    return primitive ? [this.addPrimitiveDrawable(primitive)] : [];
  }

  private createVesselRingSegments(
    x: number,
    y: number,
    z: number,
    radius: number,
    crs: string,
    segments = 48,
  ): Array<readonly [CesiumObject, CesiumObject]> {
    const points = this.createDiscPositions(x, y, z, radius, crs, segments).slice(1);
    return points.map((point, index) => [point, points[(index + 1) % points.length] ?? point] as const);
  }

  private createDiscSurfaceGeometry(
    x: number,
    y: number,
    z: number,
    radius: number,
    crs: string,
    segments = 96,
  ): CesiumPositionGeometry {
    const modelMatrix = this.createProjectedLocalPlacementMatrix(x, y, z, crs);
    if (modelMatrix) {
      return {
        positions: createLocalDiscPositions(this.cesium, radius, segments),
        modelMatrix,
      };
    }
    return {
      positions: this.createDiscPositions(x, y, z, radius, crs, segments),
    };
  }

  private createRingSurfaceGeometry(
    x: number,
    y: number,
    z: number,
    radius: number,
    crs: string,
    segments = 96,
  ): CesiumSegmentGeometry {
    const modelMatrix = this.createProjectedLocalPlacementMatrix(x, y, z, crs);
    if (modelMatrix) {
      const points = createLocalRingPositions(this.cesium, radius, segments);
      return {
        segments: points.map((point, index) => [point, points[(index + 1) % points.length] ?? point] as const),
        modelMatrix,
      };
    }
    return {
      segments: this.createVesselRingSegments(x, y, z, radius, crs, segments),
    };
  }

  private createProjectedLocalPlacementMatrix(
    x: number,
    y: number,
    z: number,
    crs: string,
  ): unknown | null {
    if (!this.isProjectedLocalScene()) {
      return null;
    }
    const origin = this.projectedLocalOrigin();
    const localToWorld = this.projectedLocalToWorldMatrix();
    if (!origin || !localToWorld) {
      return null;
    }
    let projectedX = x;
    let projectedY = y;
    const sceneCrs = this.sceneCrs();
    if (crs.toUpperCase() !== sceneCrs.toUpperCase()) {
      const [lon, lat] = projectedToLonLat(crs, x, y);
      [projectedX, projectedY] = lonLatToProjected(sceneCrs, lon, lat);
    }
    const translation = createTranslationMatrix(
      this.cesium,
      projectedX - origin.x,
      projectedY - origin.y,
      z - origin.z,
    );
    return multiplyMatrix4(this.cesium, localToWorld, translation);
  }

  private createDiscPositions(
    x: number,
    y: number,
    z: number,
    radius: number,
    crs: string,
    segments = 64,
  ): CesiumObject[] {
    const positions = [this.projectedPairToCartesian(x, y, z, crs)];
    for (let index = 0; index < segments; index += 1) {
      const radians = (index / segments) * Math.PI * 2;
      positions.push(
        this.projectedPairToCartesian(
          x + Math.cos(radians) * radius,
          y + Math.sin(radians) * radius,
          z,
          crs,
        ),
      );
    }
    return positions;
  }

  private createEllipsePositions(
    x: number,
    y: number,
    z: number,
    radiusX: number,
    radiusY: number,
    headingDegrees: number,
    crs: string,
    segments = 64,
  ): CesiumObject[] {
    const positions = [this.projectedPairToCartesian(x, y, z, crs)];
    const heading = (headingDegrees * Math.PI) / 180;
    const cosHeading = Math.cos(heading);
    const sinHeading = Math.sin(heading);
    for (let index = 0; index < segments; index += 1) {
      const radians = (index / segments) * Math.PI * 2;
      const localX = Math.cos(radians) * radiusX;
      const localY = Math.sin(radians) * radiusY;
      positions.push(
        this.projectedPairToCartesian(
          x + localX * cosHeading + localY * sinHeading,
          y - localX * sinHeading + localY * cosHeading,
          z,
          crs,
        ),
      );
    }
    return positions;
  }

  private vesselProjectedCenter(spec: VesselLayerSpec): { x: number; y: number; z: number; crs: string } | null {
    const crs = spec.source.crs ?? this.sceneCrs();
    if (this.isProjectedLocalScene()) {
      const cartesian = this.coordinateToCartesian(spec.pose.position, spec.source);
      const projected = this.worldCartesianToProjected(cartesian);
      if (!projected) {
        return null;
      }
      return { ...projected, crs: this.sceneCrs() };
    }
    if (spec.pose.position.kind === "projected") {
      return {
        x: spec.pose.position.x,
        y: spec.pose.position.y,
        z: spec.pose.position.z ?? 0,
        crs: spec.pose.position.crs,
      };
    }
    if (spec.pose.position.kind === "engine-local") {
      const projected = this.engineLocalToProjected(spec.pose.position.x, spec.pose.position.y, crs);
      return { x: projected.x, y: projected.y, z: spec.pose.position.z, crs };
    }
    if (spec.pose.position.kind === "geodetic") {
      const [x, y] = lonLatToProjected(crs, spec.pose.position.lon, spec.pose.position.lat);
      return { x, y, z: spec.pose.position.height ?? 0, crs };
    }
    return null;
  }

  private applyLayerPatch(native: CesiumLayerNative, patch: LayerPatch): void {
    if (native.kind === "3d-tiles") {
      native.spec = mergeLayerSpecPatch(native.spec, patch);
      if (patch.visible !== undefined) {
        native.primitive.show = patch.visible;
      }
      if (patch.style !== undefined || patch.opacity !== undefined) {
        applyS102TilesetStyle(
          this.cesium,
          native.primitive,
          native.spec,
          this.createS102ShaderCoordinateContext(native.spec),
          this.currentSeaLevel,
          this.s102LightingFallbackState,
        );
      }
      return;
    }

    if (native.kind === "imagery") {
      native.spec = mergeLayerSpecPatch(native.spec, patch);
      if (typeof patch.opacity === "number") {
        native.layer.alpha = patch.opacity;
      }
      if (patch.visible !== undefined) {
        native.layer.show = patch.visible;
      }
      return;
    }

    if (native.kind === "projected-wms") {
      native.spec = mergeLayerSpecPatch(native.spec, patch);
      this.rebuildProjectedWmsLayer(native);
      return;
    }

    if (native.kind === "s111") {
      native.spec = mergeLayerSpecPatch(native.spec, patch);
      this.rebuildS111Layer(native);
      return;
    }

    if (native.kind === "entities") {
      native.spec = mergeLayerSpecPatch(native.spec, patch);
      const visible = patch.visible ?? native.spec.visible;
      if (visible !== undefined) {
        for (const entity of native.entities) {
          entity.show = visible;
        }
      }
      return;
    }

    if (native.kind === "vessel") {
      native.spec = mergeLayerSpecPatch(native.spec, patch);
      native.entity.show = native.spec.visible ?? native.spec.style?.visible ?? true;
      native.entity.position = this.coordinateToCartesian(
        this.vesselModelRootCoordinate(native.spec),
        native.spec.source,
      );
      native.entity.orientation = this.createHeadingOrientation(native.spec);
      this.rebuildVesselPresentationDrawables(native);
    }
  }

  private async disposeNativeLayer(native: CesiumLayerNative): Promise<void> {
    if (native.kind === "3d-tiles") {
      for (const cleanup of native.cleanup) {
        cleanup();
      }
      const removed = this.removePrimitive(native.primitive);
      if (!removed) {
        destroyCesiumObject(native.primitive);
      }
      return;
    }
    if (native.kind === "imagery") {
      this.removeImageryLayer(native.layer);
      return;
    }
    if (native.kind === "projected-wms") {
      for (const drawable of native.drawables) {
        this.removeDrawable(drawable);
      }
      return;
    }
    if (native.kind === "entities") {
      for (const entity of native.entities) {
        this.removeEntity(entity);
      }
      return;
    }
    if (native.kind === "vessel") {
      this.removeEntity(native.entity);
      for (const drawable of native.drawables) {
        this.removeDrawable(drawable);
      }
      return;
    }
    if (native.kind === "s111") {
      for (const drawable of native.drawables) {
        this.removeDrawable(drawable);
      }
      return;
    }
  }

  private getNativeLayer(handle: EngineLayerHandle): CesiumLayerNative {
    const native = this.layers.get(handle) ?? handle.native;
    if (isCesiumLayerNative(native)) {
      return native;
    }
    throw new S100Error("layer-not-found", `Cesium layer '${handle.id ?? "<unknown>"}' not found.`);
  }

  private createImageryProvider(spec: EncLayerSpec | MapOverlayLayerSpec): CesiumObject {
    const source = spec.source;
    if (source.kind === "wmts") {
      const Provider = getCesiumConstructor(this.cesium, "WebMapTileServiceImageryProvider");
      return new Provider({
        url: source.url,
        layer: source.layer,
        style: source.style ?? "default",
        tileMatrixSetID: source.tileMatrixSet,
        format: source.format ?? "image/png",
        ...source.parameters,
      });
    }

    if (source.kind === "wms") {
      const Provider = getCesiumConstructor(this.cesium, "WebMapServiceImageryProvider");
      return new Provider({
        url: stripQuery(source.url),
        layers: source.layers.join(","),
        parameters: createWmsParameters(source),
      });
    }

    throw new S100Error(
      "invalid-layer-spec",
      `Cesium imagery layers require WMS or WMTS sources; received '${source.kind}'.`,
      source,
    );
  }

  private createProjectedWmsLayer(
    spec: EncLayerSpec | MapOverlayLayerSpec,
    urlTemplate: string,
    extent: SpatialExtent,
  ): CesiumLayerNative {
    const drawables = this.createProjectedWmsDrawables(spec, urlTemplate, extent);
    this.registerProjectedWmsCutoutCandidate(spec, urlTemplate, extent);
    return {
      kind: "projected-wms",
      spec,
      urlTemplate,
      extent,
      drawables,
    };
  }

  private rebuildProjectedWmsLayer(native: Extract<CesiumLayerNative, { kind: "projected-wms" }>): void {
    for (const drawable of native.drawables) {
      this.removeDrawable(drawable);
    }
    native.drawables = this.createProjectedWmsDrawables(native.spec, native.urlTemplate, native.extent);
  }

  private createProjectedWmsDrawables(
    spec: EncLayerSpec | MapOverlayLayerSpec,
    urlTemplate: string,
    extent: SpatialExtent,
  ): CesiumSceneDrawable[] {
    if (!this.isProjectedLocalScene()) {
      return [this.createProjectedWmsDrawable(spec, urlTemplate, extent)];
    }
    const crs = extent.crs ?? getCrsFromUrl(urlTemplate) ?? this.sceneCrs();
    const projectedExtent = { ...normalizeProjectedExtent({ ...extent, crs }), crs };
    const cutoutExtent = this.getProjectedWmsCutoutExtent(spec, projectedExtent);
    if (!cutoutExtent) {
      return [this.createProjectedWmsDrawable(spec, urlTemplate, projectedExtent)];
    }
    const visibleExtents = subtractProjectedExtent(projectedExtent, cutoutExtent);
    return visibleExtents.map((visibleExtent) =>
      this.createProjectedWmsDrawable(spec, urlTemplate, visibleExtent),
    );
  }

  private registerProjectedWmsCutoutCandidate(
    spec: EncLayerSpec | MapOverlayLayerSpec,
    urlTemplate: string,
    extent: SpatialExtent,
  ): void {
    if (
      !isEncLayerSpec(spec) ||
      spec.role !== "overlay" ||
      !urlTemplate.includes("IGNORE=DepthArea,DepthContour")
    ) {
      return;
    }
    const crs = extent.crs ?? getCrsFromUrl(urlTemplate) ?? this.sceneCrs();
    const normalized = { ...normalizeProjectedExtent({ ...extent, crs }), crs };
    this.projectedWmsCutoutCandidates.push(normalized);
  }

  private getProjectedWmsCutoutExtent(
    spec: EncLayerSpec | MapOverlayLayerSpec,
    extent: SpatialExtent,
  ): SpatialExtent | null {
    if (!isEncLayerSpec(spec) || spec.role !== "basemap") {
      return null;
    }
    for (let index = this.projectedWmsCutoutCandidates.length - 1; index >= 0; index -= 1) {
      const candidate = this.projectedWmsCutoutCandidates[index];
      if (!candidate || !sameCrs(candidate.crs, extent.crs) || !projectedExtentsOverlap(candidate, extent)) {
        continue;
      }
      return candidate;
    }
    return null;
  }

  private createProjectedWmsDrawable(
    spec: EncLayerSpec | MapOverlayLayerSpec,
    urlTemplate: string,
    extent: SpatialExtent,
  ): CesiumSceneDrawable {
    const projectedExtent = normalizeProjectedExtent(extent);
    const crs = extent.crs ?? getCrsFromUrl(urlTemplate) ?? this.sceneCrs();
    const rectangle = projectedExtentToRectangle(this.cesium, projectedExtent, crs);
    const params = new URLSearchParams(urlTemplate.split("?")[1] ?? "");
    const imageUrl = fillWmsTemplate(
      urlTemplate,
      projectedExtent,
      Math.max(getPositiveInteger(params.get("WIDTH"), 2048), 2048),
      Math.max(getPositiveInteger(params.get("HEIGHT"), 2048), 2048),
    );
    const opacity = spec.opacity ?? spec.style?.opacity ?? 1;
    const visible = spec.visible ?? spec.style?.visible ?? true;
    const height =
      this.currentSeaLevel +
      getNumberExtension(
        spec,
        "mapHeightOffsetMeters",
        DEFAULT_PROJECTED_MAP_HEIGHT_OFFSET_METERS,
      );

    if (this.isProjectedLocalScene()) {
      const positions = [
        this.projectedPairToCartesian(projectedExtent.minX, projectedExtent.minY, height, crs),
        this.projectedPairToCartesian(projectedExtent.maxX, projectedExtent.minY, height, crs),
        this.projectedPairToCartesian(projectedExtent.maxX, projectedExtent.maxY, height, crs),
        this.projectedPairToCartesian(projectedExtent.minX, projectedExtent.maxY, height, crs),
      ];
      const primitive = this.createTexturedQuadPrimitive(positions, imageUrl, opacity, visible);
      if (primitive) {
        return this.addPrimitiveDrawable(primitive);
      }
    }

    return this.addEntityDrawable({
      id: spec.id,
      name: spec.title ?? spec.id,
      ...this.createProjectedMapGeometry(
        rectangle,
        projectedExtent,
        crs,
        createImageMaterial(this.cesium, imageUrl, opacity),
        height,
      ),
      show: visible,
    });
  }

  private createProjectedWmsDefinition(
    spec: EncLayerSpec | MapOverlayLayerSpec,
  ): ProjectedWmsDefinition | null {
    const mapSpec = getMapSpecificationExtension(spec);
    if (mapSpec?.urlTemplate && mapSpec.dataset?.extents) {
      const crs = mapSpec.dataset.extents.crs ?? spec.source.crs ?? this.sceneCrs();
      return {
        urlTemplate: mapSpec.urlTemplate,
        extent: {
          ...mapSpec.dataset.extents,
          crs,
        },
      };
    }

    if (
      !this.isProjectedLocalScene() ||
      (spec.source.kind !== "wms" && spec.source.kind !== "wms-template")
    ) {
      return null;
    }

    const extent = getProjectedMapExtent(spec);
    if (!extent) {
      return null;
    }

    return {
      urlTemplate: spec.source.kind === "wms-template"
        ? spec.source.urlTemplate
        : createWmsUrlTemplate(spec.source),
      extent: {
        ...extent,
        crs: extent.crs ?? spec.source.crs ?? this.sceneCrs(),
      },
    };
  }

  private createS111Drawables(spec: S111SurfaceCurrentLayerSpec, data: unknown): CesiumSceneDrawable[] {
    const renderData = extractS111RenderData(data, this.currentTime, this.options.s111MaxEntityCount ?? 600);
    const glyphDrawables = this.createS111GlyphDrawables(spec, renderData);
    if (glyphDrawables.length > 0) {
      return glyphDrawables;
    }
    return renderData.samples.map((sample) => this.addEntityDrawable(this.createS111ArrowEntity(spec, sample)));
  }

  private rebuildS111Layer(native: Extract<CesiumLayerNative, { kind: "s111" }>): void {
    for (const drawable of native.drawables) {
      this.removeDrawable(drawable);
    }
    native.drawables = this.createS111Drawables(native.spec, native.data);
  }

  private createS111ArrowEntity(spec: S111SurfaceCurrentLayerSpec, sample: S111Sample): CesiumObject {
    const segments = this.createS111ArrowSegments(spec, sample);
    const positions: CesiumObject[] = segments
      ? [
          segments[0]?.[0],
          segments[0]?.[1],
          segments[1]?.[1],
          segments[1]?.[0],
          segments[2]?.[1],
        ].filter((position): position is CesiumObject => Boolean(position))
      : [];
    const vectorHeight =
      this.currentSeaLevel +
      getNumberExtension(
        spec,
        "heightOffsetMeters",
        getNumberExtension(spec, "s111HeightOffsetMeters", DEFAULT_S111_HEIGHT_OFFSET_METERS),
      );
    const speedColor = getS111SpeedColor(sample.speedKnots);
    const color = toCesiumColor(this.cesium, {
      r: speedColor[0],
      g: speedColor[1],
      b: speedColor[2],
      a: spec.opacity ?? spec.style?.opacity ?? 1,
    });
    const arcTypeNone = getCesiumConstant(this.cesium, "ArcType", "NONE");
    return {
      polyline: {
        positions,
        width: getNumberExtension(spec, "lineWidthPixels", 4),
        material: color,
        depthFailMaterial: color,
        clampToGround: false,
        ...(arcTypeNone !== undefined ? { arcType: arcTypeNone } : {}),
      },
      position: positions[1] ?? this.projectedPairToCartesian(
        sample.position[0],
        sample.position[1],
        vectorHeight,
        spec.source.crs ?? this.sceneCrs(),
      ),
      show: spec.visible ?? spec.style?.visible ?? true,
    };
  }

  private createS111GlyphDrawables(
    spec: S111SurfaceCurrentLayerSpec,
    renderData: S111RenderData,
  ): CesiumSceneDrawable[] {
    if (!this.isProjectedLocalScene()) {
      return [];
    }
    const visible = spec.visible ?? spec.style?.visible ?? true;
    const opacity = clamp01(spec.opacity ?? spec.style?.opacity ?? 1);
    const fillBuckets = new Map<
      string,
      { color: unknown; positions: CesiumObject[]; indices: number[] }
    >();
    const outlineBucket: { positions: CesiumObject[]; indices: number[] } = {
      positions: [],
      indices: [],
    };

    for (const sample of renderData.samples) {
      const glyph = this.createS111ArrowGlyph(spec, sample, renderData, opacity);
      if (!glyph) {
        continue;
      }
      const bucket = fillBuckets.get(glyph.colorKey) ?? {
        color: glyph.color,
        positions: [],
        indices: [],
      };
      const indexOffset = bucket.positions.length;
      bucket.positions.push(...glyph.positions);
      bucket.indices.push(...glyph.indices.map((index) => index + indexOffset));
      fillBuckets.set(glyph.colorKey, bucket);

      const outlineIndexOffset = outlineBucket.positions.length;
      outlineBucket.positions.push(...glyph.outlinePositions);
      outlineBucket.indices.push(...glyph.indices.map((index) => index + outlineIndexOffset));
    }

    const drawables: CesiumSceneDrawable[] = [];
    if (outlineBucket.positions.length > 0) {
      const outlinePrimitive = this.createColoredGeometryPrimitive(
        outlineBucket.positions,
        outlineBucket.indices,
        "TRIANGLES",
        toCesiumColor(this.cesium, { r: 0, g: 0, b: 0, a: opacity }),
        opacity < 1,
        visible,
      );
      if (outlinePrimitive) {
        drawables.push(this.addPrimitiveDrawable(outlinePrimitive));
      }
    }

    for (const bucket of fillBuckets.values()) {
      const primitive = this.createColoredGeometryPrimitive(
        bucket.positions,
        bucket.indices,
        "TRIANGLES",
        bucket.color,
        opacity < 1,
        visible,
      );
      if (primitive) {
        drawables.push(this.addPrimitiveDrawable(primitive));
      }
    }
    return drawables;
  }

  private createS111ArrowGlyph(
    spec: S111SurfaceCurrentLayerSpec,
    sample: S111Sample,
    renderData: S111RenderData,
    opacity: number,
  ): S111ArrowGlyph | null {
    const crs = spec.source.crs ?? this.sceneCrs();
    const vectorHeight =
      this.currentSeaLevel +
      getNumberExtension(
        spec,
        "heightOffsetMeters",
        getNumberExtension(spec, "s111HeightOffsetMeters", DEFAULT_S111_HEIGHT_OFFSET_METERS),
      );
    const scale = s111ArrowScaleMeters(sample.speedKnots, spec, renderData);
    const radians = ((90 - sample.directionDegrees) * Math.PI) / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const positions = S111_ARROW_POLYGON.map(([localX, localY]) => {
      const scaledX = localX * scale;
      const scaledY = localY * scale;
      const projectedX = sample.position[0] + scaledX * cos - scaledY * sin;
      const projectedY = sample.position[1] + scaledX * sin + scaledY * cos;
      return this.projectedPairToCartesian(
        projectedX,
        projectedY,
        vectorHeight + S111_ARROW_FILL_Z_OFFSET_METERS,
        crs,
      );
    });
    const outlinePositions = S111_ARROW_OUTLINE_POLYGON.map(([localX, localY]) => {
      const scaledX = localX * scale;
      const scaledY = localY * scale;
      const projectedX = sample.position[0] + scaledX * cos - scaledY * sin;
      const projectedY = sample.position[1] + scaledX * sin + scaledY * cos;
      return this.projectedPairToCartesian(projectedX, projectedY, vectorHeight, crs);
    });
    if (!positions.every(isFiniteCartesianLike) || !outlinePositions.every(isFiniteCartesianLike)) {
      return null;
    }

    const speedColor = getS111SpeedColor(sample.speedKnots);
    return {
      positions,
      outlinePositions,
      indices: [...S111_ARROW_FILL_INDICES],
      colorKey: `${speedColor[0]}:${speedColor[1]}:${speedColor[2]}:${opacity}`,
      color: toCesiumColor(this.cesium, {
        r: speedColor[0],
        g: speedColor[1],
        b: speedColor[2],
        a: opacity,
      }),
    };
  }

  private createS111ArrowSegments(
    spec: S111SurfaceCurrentLayerSpec,
    sample: S111Sample,
  ): Array<readonly [CesiumObject, CesiumObject]> | null {
    const crs = spec.source.crs ?? this.sceneCrs();
    const vectorHeight =
      this.currentSeaLevel +
      getNumberExtension(
        spec,
        "heightOffsetMeters",
        getNumberExtension(spec, "s111HeightOffsetMeters", DEFAULT_S111_HEIGHT_OFFSET_METERS),
      );
    const start = this.projectedPairToCartesian(sample.position[0], sample.position[1], vectorHeight, crs);
    const arrowLengthMeters = s111ArrowLengthMeters(sample.speedKnots, spec);
    const endProjected = offsetProjectedVector(
      sample.position[0],
      sample.position[1],
      sample.directionDegrees,
      arrowLengthMeters,
    );
    const end = this.projectedPairToCartesian(endProjected.x, endProjected.y, vectorHeight, crs);
    const leftHeadProjected = offsetProjectedVector(
      endProjected.x,
      endProjected.y,
      sample.directionDegrees + 145,
      arrowLengthMeters * 0.28,
    );
    const rightHeadProjected = offsetProjectedVector(
      endProjected.x,
      endProjected.y,
      sample.directionDegrees - 145,
      arrowLengthMeters * 0.28,
    );
    const leftHead = this.projectedPairToCartesian(
      leftHeadProjected.x,
      leftHeadProjected.y,
      vectorHeight,
      crs,
    );
    const rightHead = this.projectedPairToCartesian(
      rightHeadProjected.x,
      rightHeadProjected.y,
      vectorHeight,
      crs,
    );
    if (![start, end, leftHead, rightHead].every(isFiniteCartesianLike)) {
      return null;
    }
    return [
      [start, end],
      [end, leftHead],
      [end, rightHead],
    ];
  }

  private createHoverPrismPrimitiveDrawables(
    top: CesiumObject[],
    bottom: CesiumObject[],
    fillColor: unknown,
    outlineColor: unknown,
  ): CesiumSceneDrawable[] {
    if (!this.isProjectedLocalScene()) {
      return [];
    }
    const [top0, top1, top2, top3] = top;
    const [bottom0, bottom1, bottom2, bottom3] = bottom;
    if (!top0 || !top1 || !top2 || !top3 || !bottom0 || !bottom1 || !bottom2 || !bottom3) {
      return [];
    }
    const drawables: CesiumSceneDrawable[] = [];
    const fillPrimitive = this.createColoredGeometryPrimitive(
      [top0, top1, top2, top3],
      [0, 1, 2, 0, 2, 3],
      "TRIANGLES",
      fillColor,
      true,
      true,
    );
    if (fillPrimitive) {
      drawables.push(this.addPrimitiveDrawable(fillPrimitive));
    }

    const edgeSegments: Array<readonly [CesiumObject, CesiumObject]> = [
      [top0, top1],
      [top1, top2],
      [top2, top3],
      [top3, top0],
      [bottom0, bottom1],
      [bottom1, bottom2],
      [bottom2, bottom3],
      [bottom3, bottom0],
      [bottom0, top0],
      [bottom1, top1],
      [bottom2, top2],
      [bottom3, top3],
    ];
    const outlinePrimitive = this.createPolylineCollectionPrimitive(
      edgeSegments,
      () => createColorMaterial(this.cesium, outlineColor),
      2,
      true,
    );
    if (outlinePrimitive) {
      drawables.push(this.addPrimitiveDrawable(outlinePrimitive));
    }
    return drawables;
  }

  private createPolylineCollectionPrimitive(
    segments: readonly (readonly [CesiumObject, CesiumObject])[],
    createMaterial: () => unknown,
    width: number,
    visible: boolean,
    useDepthFailMaterial = true,
    modelMatrix?: unknown,
  ): CesiumObject | null {
    if (segments.length === 0) {
      return null;
    }
    const PolylineCollection = this.cesium.PolylineCollection as CesiumConstructor | undefined;
    if (typeof PolylineCollection !== "function") {
      return null;
    }
    const collection = new PolylineCollection({
      show: visible,
      ...(modelMatrix !== undefined ? { modelMatrix } : {}),
    });
    if (!hasFunction(collection, "add")) {
      return null;
    }
    const polylineItems: unknown[] = [];
    for (const [start, end] of segments) {
      const material = createMaterial();
      const polyline = collection.add?.({
        positions: [start, end],
        material,
        ...(useDepthFailMaterial ? { depthFailMaterial: createMaterial() } : {}),
        width,
        show: visible,
      });
      if (polyline) {
        polylineItems.push(polyline);
      }
    }
    (collection as CesiumObject).show = visible;
    (collection as CesiumObject).__s100PolylineItems = polylineItems;
    return collection;
  }

  private createTexturedQuadPrimitive(
    positions: CesiumObject[],
    imageUrl: string,
    opacity: number,
    visible: boolean,
  ): CesiumObject | null {
    const Geometry = this.cesium.Geometry as CesiumConstructor | undefined;
    const GeometryAttribute = this.cesium.GeometryAttribute as CesiumConstructor | undefined;
    const GeometryInstance = this.cesium.GeometryInstance as CesiumConstructor | undefined;
    const Primitive = this.cesium.Primitive as CesiumConstructor | undefined;
    const MaterialAppearance = this.cesium.MaterialAppearance as
      | (CesiumConstructor & { MaterialSupport?: Record<string, unknown> })
      | undefined;
    const Material = this.cesium.Material as
      | {
          fromType?: (type: string, uniforms?: Record<string, unknown>) => unknown;
          ImageType?: string;
        }
      | undefined;
    if (
      !Geometry ||
      !GeometryAttribute ||
      !GeometryInstance ||
      !Primitive ||
      !MaterialAppearance ||
      !Material?.fromType
    ) {
      return null;
    }

    const positionValues = cartesianArrayToFloat64(positions);
    const normalValues = createQuadNormalValues(positions);
    const attributes = this.createGeometryAttributes({
      position: new GeometryAttribute({
        componentDatatype: getCesiumComponentDatatype(this.cesium, "DOUBLE"),
        componentsPerAttribute: 3,
        values: positionValues,
      }),
      normal: new GeometryAttribute({
        componentDatatype: getCesiumComponentDatatype(this.cesium, "FLOAT"),
        componentsPerAttribute: 3,
        values: normalValues,
      }),
      st: new GeometryAttribute({
        componentDatatype: getCesiumComponentDatatype(this.cesium, "FLOAT"),
        componentsPerAttribute: 2,
        values: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      }),
    });
    const geometry = new Geometry({
      attributes,
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
      primitiveType: getCesiumPrimitiveType(this.cesium, "TRIANGLES"),
      boundingSphere: createBoundingSphere(this.cesium, positions, positionValues),
    });
    const imageSource = createDeferredImageSource(imageUrl);
    const material = Material.fromType(Material.ImageType ?? "Image", {
      image: imageSource.image,
      color: toCesiumColor(this.cesium, { r: 1, g: 1, b: 1, a: clamp01(opacity) }),
      repeat: createCartesian2(this.cesium, 1, 1),
    });
    const appearance = new MaterialAppearance({
      material,
      flat: true,
      faceForward: true,
      translucent: opacity < 1,
      closed: false,
      materialSupport: MaterialAppearance.MaterialSupport?.TEXTURED,
      renderState: {
        depthTest: { enabled: true },
        depthMask: false,
      },
    });
    const primitive = new Primitive({
      geometryInstances: new GeometryInstance({ geometry }),
      appearance,
      asynchronous: false,
      show: visible && imageSource.ready,
    });
    if (!imageSource.ready) {
      imageSource.onLoad(() => {
        if (isCesiumObjectDestroyed(primitive)) {
          return;
        }
        primitive.show = visible;
        const scene = getObject(this.viewer, "scene");
        if (hasFunction(scene, "requestRender")) {
          scene.requestRender?.();
        }
      });
    }
    return primitive;
  }

  private createWaterSurfacePrimitive(
    positions: CesiumObject[],
    indices: readonly number[],
    colorValue: unknown,
    opacity: number,
    visible: boolean,
    modelMatrix?: unknown,
    radiusMeters?: number,
    reflectivity?: number,
    roughness?: number,
  ): CesiumObject | null {
    const Geometry = this.cesium.Geometry as CesiumConstructor | undefined;
    const GeometryAttribute = this.cesium.GeometryAttribute as CesiumConstructor | undefined;
    const GeometryInstance = this.cesium.GeometryInstance as CesiumConstructor | undefined;
    const Primitive = this.cesium.Primitive as CesiumConstructor | undefined;
    const MaterialAppearance = this.cesium.MaterialAppearance as
      | (CesiumConstructor & { MaterialSupport?: Record<string, unknown> })
      | undefined;
    const Material = this.cesium.Material as
      | (CesiumConstructor & {
          fromType?: (type: string, uniforms?: Record<string, unknown>) => unknown;
        })
      | undefined;
    if (!Geometry || !GeometryAttribute || !GeometryInstance || !Primitive || !MaterialAppearance || !Material) {
      return null;
    }

    const normalizedColor = normalizeColorValue(colorValue, opacity, { r: 0.05, g: 0.4, b: 0.65 });
    const positionValues = cartesianArrayToFloat64(positions);
    const normalValues = createDiscNormalValues(positions.length);
    const stValues = createDiscTextureCoordinates(positions.length);
    const geometry = new Geometry({
      attributes: this.createGeometryAttributes({
        position: new GeometryAttribute({
          componentDatatype: getCesiumComponentDatatype(this.cesium, "DOUBLE"),
          componentsPerAttribute: 3,
          values: positionValues,
        }),
        normal: new GeometryAttribute({
          componentDatatype: getCesiumComponentDatatype(this.cesium, "FLOAT"),
          componentsPerAttribute: 3,
          values: normalValues,
        }),
        st: new GeometryAttribute({
          componentDatatype: getCesiumComponentDatatype(this.cesium, "FLOAT"),
          componentsPerAttribute: 2,
          values: stValues,
        }),
      }),
      indices: createIndexArray(indices),
      primitiveType: getCesiumPrimitiveType(this.cesium, "TRIANGLES"),
      boundingSphere: createBoundingSphere(this.cesium, positions, positionValues),
    });
    const material = createS100VesselOceanSurfaceMaterial(
      this.cesium,
      Material,
      normalizedColor,
      opacity,
      radiusMeters,
      reflectivity,
      roughness,
    );
    const appearance = new MaterialAppearance({
      material,
      flat: false,
      faceForward: true,
      translucent: opacity < 1,
      closed: false,
      materialSupport: MaterialAppearance.MaterialSupport?.TEXTURED,
      renderState: {
        depthTest: { enabled: true },
        depthMask: false,
        cull: { enabled: false },
      },
    });
    return new Primitive({
      geometryInstances: new GeometryInstance({ geometry }),
      appearance,
      asynchronous: false,
      show: visible,
      ...(modelMatrix !== undefined ? { modelMatrix } : {}),
    });
  }

  private createColoredGeometryPrimitive(
    positions: CesiumObject[],
    indices: readonly number[],
    primitiveType: "LINES" | "TRIANGLES",
    color: unknown,
    translucent: boolean,
    visible: boolean,
    modelMatrix?: unknown,
  ): CesiumObject | null {
    const Geometry = this.cesium.Geometry as CesiumConstructor | undefined;
    const GeometryAttribute = this.cesium.GeometryAttribute as CesiumConstructor | undefined;
    const GeometryInstance = this.cesium.GeometryInstance as CesiumConstructor | undefined;
    const Primitive = this.cesium.Primitive as CesiumConstructor | undefined;
    const PerInstanceColorAppearance = this.cesium.PerInstanceColorAppearance as CesiumConstructor | undefined;
    const ColorGeometryInstanceAttribute = this.cesium.ColorGeometryInstanceAttribute as
      | { fromColor?: (color: unknown) => unknown }
      | undefined;
    if (
      !Geometry ||
      !GeometryAttribute ||
      !GeometryInstance ||
      !Primitive ||
      !PerInstanceColorAppearance ||
      !ColorGeometryInstanceAttribute?.fromColor
    ) {
      return null;
    }
    const positionValues = cartesianArrayToFloat64(positions);
    const geometry = new Geometry({
      attributes: this.createGeometryAttributes({
        position: new GeometryAttribute({
          componentDatatype: getCesiumComponentDatatype(this.cesium, "DOUBLE"),
          componentsPerAttribute: 3,
          values: positionValues,
        }),
      }),
      indices: createIndexArray(indices),
      primitiveType: getCesiumPrimitiveType(this.cesium, primitiveType),
      boundingSphere: createBoundingSphere(this.cesium, positions, positionValues),
    });
    const appearance = new PerInstanceColorAppearance({
      flat: true,
      translucent,
      closed: false,
      renderState: {
        depthTest: { enabled: true },
        depthMask: false,
        cull: { enabled: false },
      },
    });
    return new Primitive({
      geometryInstances: new GeometryInstance({
        geometry,
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(color),
        },
      }),
      appearance,
      asynchronous: false,
      show: visible,
      ...(modelMatrix !== undefined ? { modelMatrix } : {}),
    });
  }

  private createGeometryAttributes(attributes: Record<string, unknown>): unknown {
    const GeometryAttributes = this.cesium.GeometryAttributes as CesiumConstructor | undefined;
    return GeometryAttributes ? new GeometryAttributes(attributes) : attributes;
  }

  private addEntityDrawable(entity: CesiumObject): CesiumSceneDrawable {
    return { kind: "entity", value: this.addEntity(entity) };
  }

  private addPrimitiveDrawable(primitive: CesiumObject): CesiumSceneDrawable {
    this.addPrimitive(primitive);
    return { kind: "primitive", value: primitive };
  }

  private removeDrawable(drawable: CesiumSceneDrawable): void {
    if (drawable.kind === "entity") {
      this.removeEntity(drawable.value);
      return;
    }
    const removed = this.removePrimitive(drawable.value);
    if (!removed) {
      destroyCesiumObject(drawable.value);
    }
  }

  private addPrimitive(primitive: CesiumObject): void {
    const primitives = getObject(getObject(this.viewer, "scene"), "primitives");
    if (hasFunction(primitives, "add")) {
      primitives.add?.(primitive);
    }
  }

  private removePrimitive(primitive: CesiumObject): boolean {
    const primitives = getObject(getObject(this.viewer, "scene"), "primitives");
    if (hasFunction(primitives, "remove")) {
      return Boolean(primitives.remove?.(primitive));
    }
    return false;
  }

  private addImageryProvider(provider: CesiumObject): CesiumObject {
    const imageryLayers = getObject(this.viewer, "imageryLayers");
    if (!hasFunction(imageryLayers, "addImageryProvider")) {
      throw new S100Error("adapter-lifecycle", "Cesium viewer imagery layer collection is unavailable.");
    }
    return imageryLayers.addImageryProvider?.(provider) as CesiumObject;
  }

  private removeImageryLayer(layer: CesiumObject): void {
    const imageryLayers = getObject(this.viewer, "imageryLayers");
    if (hasFunction(imageryLayers, "remove")) {
      imageryLayers.remove?.(layer, true);
    }
  }

  private addEntity(entity: CesiumObject): CesiumObject {
    const entities = getObject(this.viewer, "entities");
    if (!hasFunction(entities, "add")) {
      throw new S100Error("adapter-lifecycle", "Cesium viewer entity collection is unavailable.");
    }
    return entities.add?.(entity) as CesiumObject;
  }

  private removeEntity(entity: CesiumObject): void {
    const entities = getObject(this.viewer, "entities");
    if (hasFunction(entities, "remove")) {
      entities.remove?.(entity);
    }
  }

  private coordinateToCartesian(coordinate: Coordinate, source?: { crs?: string }): CesiumObject {
    if (coordinate.kind === "ecef") {
      return cartesianFromElements(this.cesium, coordinate.x, coordinate.y, coordinate.z);
    }

    if (this.isProjectedLocalScene()) {
      return this.coordinateToProjectedCartesian(coordinate, source);
    }

    const geodetic = this.coordinateToLonLatHeight(coordinate, source);
    return this.cartesianFromDegrees(geodetic.lon, geodetic.lat, geodetic.height);
  }

  private coordinateToLonLatHeight(
    coordinate: Coordinate,
    source?: { crs?: string },
  ): { lon: number; lat: number; height: number } {
    if (coordinate.kind === "geodetic") {
      return {
        lon: coordinate.lon,
        lat: coordinate.lat,
        height: coordinate.height ?? 0,
      };
    }

    if (coordinate.kind === "projected") {
      const [lon, lat] = projectedToLonLat(coordinate.crs, coordinate.x, coordinate.y);
      return { lon, lat, height: coordinate.z ?? 0 };
    }

    if (coordinate.kind === "engine-local") {
      const crs = source?.crs ?? this.sceneCrs();
      const projected = this.engineLocalToProjected(coordinate.x, coordinate.y, crs);
      const [lon, lat] = projectedToLonLat(crs, projected.x, projected.y);
      return { lon, lat, height: coordinate.z ?? 0 };
    }

    const cartographic = cartesianToCartographic(this.cesium, coordinate);
    if (!cartographic) {
      return { lon: 0, lat: 0, height: coordinate.z };
    }
    return {
      lon: radiansToDegrees(cartographic.longitude),
      lat: radiansToDegrees(cartographic.latitude),
      height: cartographic.height ?? 0,
    };
  }

  private engineLocalToProjected(x: number, y: number, crs: string): { x: number; y: number } {
    if (Math.abs(x) > 10000 || Math.abs(y) > 10000) {
      return { x, y };
    }
    const georeference = this.sceneOptions.georeference;
    if (georeference?.mode !== "projected-local") {
      return { x, y };
    }
    const origin = georeference.origin;
    if (origin.kind === "projected") {
      return { x: origin.x + x, y: origin.y + y };
    }
    const originLonLat = this.coordinateToLonLatHeight(origin);
    const [originX, originY] = lonLatToProjected(crs, originLonLat.lon, originLonLat.lat);
    return { x: originX + x, y: originY + y };
  }

  private projectedPairToCartesian(x: number, y: number, z = 0, crs = this.sceneCrs()): CesiumObject {
    if (this.isProjectedLocalScene()) {
      const sceneCrs = this.sceneCrs();
      if (crs.toUpperCase() === sceneCrs.toUpperCase()) {
        return this.projectedToWorldCartesian(x, y, z, sceneCrs);
      }
      const [lon, lat] = projectedToLonLat(crs, x, y);
      const [projectedX, projectedY] = lonLatToProjected(sceneCrs, lon, lat);
      return this.projectedToWorldCartesian(projectedX, projectedY, z, sceneCrs);
    }
    const [lon, lat] = projectedToLonLat(crs, x, y);
    return this.cartesianFromDegrees(lon, lat, z);
  }

  private createHeadingOrientation(spec: VesselLayerSpec): unknown {
    const Transforms = this.cesium.Transforms as
      | { headingPitchRollQuaternion?: (position: unknown, hpr: unknown) => unknown }
      | undefined;
    const HeadingPitchRoll = this.cesium.HeadingPitchRoll as
      | { fromDegrees?: (heading: number, pitch: number, roll: number) => unknown }
      | CesiumConstructor
      | undefined;
    if (!Transforms?.headingPitchRollQuaternion || !HeadingPitchRoll) {
      return undefined;
    }
    const headingDegrees = toCesiumHeadingDegrees(spec, spec.pose.headingDegrees ?? 0);
    const hpr =
      "fromDegrees" in HeadingPitchRoll && typeof HeadingPitchRoll.fromDegrees === "function"
        ? HeadingPitchRoll.fromDegrees(headingDegrees, 0, 0)
        : new (HeadingPitchRoll as CesiumConstructor)(degreesToRadians(this.cesium, headingDegrees), 0, 0);
    return Transforms.headingPitchRollQuaternion(this.coordinateToCartesian(spec.pose.position, spec.source), hpr);
  }

  private vesselModelRootCoordinate(spec: VesselLayerSpec): Coordinate {
    const offset = getVesselModelRootOffset(spec);
    if (Math.hypot(offset.x, offset.y, offset.z) < 1e-9) {
      return spec.pose.position;
    }

    const horizontalOffset = rotateHeadingOffset(offset.x, offset.y, spec.pose.headingDegrees ?? 0);
    return offsetCoordinate(
      spec.pose.position,
      { x: horizontalOffset.x, y: horizontalOffset.y, z: offset.z },
      this.sceneCrs(),
    );
  }

  private cartesianFromDegrees(lon: number, lat: number, height = 0): CesiumObject {
    const Cartesian3 = this.cesium.Cartesian3 as
      | { fromDegrees?: (lon: number, lat: number, height?: number) => CesiumObject }
      | undefined;
    if (Cartesian3?.fromDegrees) {
      return Cartesian3.fromDegrees(lon, lat, height);
    }
    return { lon, lat, height };
  }

  private cartesianToPickWorld(cartesian: CesiumObject): Coordinate {
    if (this.isProjectedLocalScene()) {
      const projected = this.worldCartesianToProjected(cartesian);
      if (projected) {
        return {
          kind: "projected",
          x: projected.x,
          y: projected.y,
          z: projected.z,
          crs: this.sceneCrs(),
        };
      }
    }

    return {
      kind: "ecef",
      x: getFiniteNumber(cartesian.x, 0),
      y: getFiniteNumber(cartesian.y, 0),
      z: getFiniteNumber(cartesian.z, 0),
      datum: "WGS84",
    };
  }

  private pickWorldToGeodetic(coordinate: Coordinate): Coordinate | undefined {
    if (coordinate.kind === "geodetic") {
      return coordinate;
    }

    if (coordinate.kind === "projected") {
      return this.projectedPointToGeodetic(
        coordinate.x,
        coordinate.y,
        coordinate.z ?? 0,
        coordinate.crs,
      );
    }

    if (coordinate.kind === "ecef") {
      return this.cartesianToGeodetic(cartesianFromElements(
        this.cesium,
        coordinate.x,
        coordinate.y,
        coordinate.z,
      ));
    }

    return undefined;
  }

  private projectedPointToGeodetic(x: number, y: number, z: number, crs: string): Coordinate {
    const [lon, lat] = projectedToLonLat(crs, x, y);
    return {
      kind: "geodetic",
      lon,
      lat,
      height: z,
      datum: "WGS84",
    };
  }

  private cartesianToGeodetic(cartesian: CesiumObject): Coordinate | undefined {
    if (this.isProjectedLocalScene()) {
      const projected = this.worldCartesianToProjected(cartesian);
      if (projected) {
        return this.projectedPointToGeodetic(
          projected.x,
          projected.y,
          projected.z,
          this.sceneCrs(),
        );
      }
    }

    const cartographic = cartesianToCartographic(this.cesium, cartesian);
    if (!cartographic) {
      return undefined;
    }
    return {
      kind: "geodetic",
      lon: radiansToDegrees(cartographic.longitude),
      lat: radiansToDegrees(cartographic.latitude),
      height: cartographic.height ?? 0,
      datum: "WGS84",
    };
  }

  private pickFallbackWorld(request: PickRequest): CesiumObject | null {
    const camera = getObject(this.viewer, "camera");
    const scene = getObject(this.viewer, "scene");
    const globe = getObject(scene, "globe");
    const screenPosition = createCartesian2(this.cesium, request.screenX, request.screenY);
    const ray = hasFunction(camera, "getPickRay") ? camera.getPickRay?.(screenPosition) : undefined;
    if (ray && hasFunction(globe, "pick")) {
      return globe.pick?.(ray, scene) as CesiumObject;
    }
    if (hasFunction(camera, "pickEllipsoid")) {
      return camera.pickEllipsoid?.(screenPosition) as CesiumObject | null;
    }
    return null;
  }

  private sceneCrs(): string {
    const georeference = this.sceneOptions.georeference;
    return georeference?.mode === "projected-local" ? georeference.crs : "EPSG:4326";
  }

  private isProjectedLocalScene(): boolean {
    return this.sceneOptions.georeference?.mode === "projected-local";
  }

  private configureProjectedLocalScene(): void {
    const scene = getObject(this.viewer, "scene");
    this.configureProjectedLocalSceneMode(scene);
    this.configureProjectedLocalSceneVisibility(scene);
    const globe = getObject(scene, "globe");
    if (globe) {
      globe.show = false;
      globe.depthTestAgainstTerrain = false;
    }
    const skyAtmosphere = getObject(scene, "skyAtmosphere");
    if (skyAtmosphere) {
      skyAtmosphere.show = false;
    }
    const skyBox = getObject(scene, "skyBox");
    if (skyBox) {
      skyBox.show = false;
    }
    const sun = getObject(scene, "sun");
    if (sun) {
      sun.show = false;
    }
    const moon = getObject(scene, "moon");
    if (moon) {
      moon.show = false;
    }
    if (scene) {
      scene.backgroundColor = toCesiumColor(this.cesium, { r: 0.68, g: 0.78, b: 0.9, a: 1 });
    }
  }

  private configureProjectedLocalSceneVisibility(scene: CesiumObject | null): void {
    const fog = getObject(scene, "fog");
    if (fog) {
      fog.enabled = false;
      fog.renderable = false;
      fog.density = 0;
      fog.screenSpaceErrorFactor = 0;
    }
    if (scene) {
      scene.farToNearRatio = Math.max(getFiniteNumber(scene.farToNearRatio, 1000), 100_000);
      scene.logarithmicDepthFarToNearRatio = Math.max(
        getFiniteNumber(scene.logarithmicDepthFarToNearRatio, 1_000_000_000),
        1_000_000_000,
      );
    }
    const frustum = getObject(getObject(this.viewer, "camera"), "frustum");
    if (frustum) {
      frustum.far = Math.max(getFiniteNumber(frustum.far, 0), 50_000_000);
    }
  }

  private configureProjectedLocalSceneMode(scene: CesiumObject | null): void {
    if (!scene) {
      return;
    }
    const modePreference = String(this.sceneOptions.metadata?.cesiumSceneMode ?? "scene3d").toLowerCase();
    if (modePreference !== "columbus-view" && modePreference !== "columbus") {
      return;
    }
    const SceneMode = this.cesium.SceneMode as Record<string, unknown> | undefined;
    const columbusView = SceneMode?.COLUMBUS_VIEW;
    if (columbusView === undefined || scene.mode === columbusView) {
      return;
    }
    if (hasFunction(scene, "morphToColumbusView")) {
      scene.morphToColumbusView?.(0);
      return;
    }
    scene.mode = columbusView;
  }

  private coordinateToProjectedCartesian(coordinate: Coordinate, source?: { crs?: string }): CesiumObject {
    if (coordinate.kind === "projected") {
      const sceneCrs = this.sceneCrs();
      if (coordinate.crs.toUpperCase() === sceneCrs.toUpperCase()) {
        return this.projectedToWorldCartesian(coordinate.x, coordinate.y, coordinate.z ?? 0, sceneCrs);
      }
      const [lon, lat] = projectedToLonLat(coordinate.crs, coordinate.x, coordinate.y);
      const [x, y] = lonLatToProjected(sceneCrs, lon, lat);
      return this.projectedToWorldCartesian(x, y, coordinate.z ?? 0, sceneCrs);
    }

    if (coordinate.kind === "geodetic") {
      const [x, y] = lonLatToProjected(this.sceneCrs(), coordinate.lon, coordinate.lat);
      return this.projectedToWorldCartesian(x, y, coordinate.height ?? 0, this.sceneCrs());
    }

    if (coordinate.kind === "engine-local") {
      const crs = source?.crs ?? this.sceneCrs();
      const projected = this.engineLocalToProjected(coordinate.x, coordinate.y, crs);
      if (crs.toUpperCase() === this.sceneCrs().toUpperCase()) {
        return this.projectedToWorldCartesian(projected.x, projected.y, coordinate.z ?? 0, crs);
      }
      const [lon, lat] = projectedToLonLat(crs, projected.x, projected.y);
      const [x, y] = lonLatToProjected(this.sceneCrs(), lon, lat);
      return this.projectedToWorldCartesian(x, y, coordinate.z ?? 0, this.sceneCrs());
    }

    return cartesianFromElements(this.cesium, coordinate.x, coordinate.y, coordinate.z);
  }

  private createProjectedMapGeometry(
    rectangle: CesiumObject,
    extent: Required<Pick<SpatialExtent, "minX" | "minY" | "maxX" | "maxY">>,
    crs: string,
    material: unknown,
    height: number,
  ): CesiumObject {
    if (!this.isProjectedLocalScene()) {
      return {
        rectangle: {
          coordinates: rectangle,
          material,
          height,
        },
      };
    }

    const arcTypeNone = getCesiumConstant(this.cesium, "ArcType", "NONE");
    const positions = [
      this.projectedPairToCartesian(extent.minX, extent.minY, height, crs),
      this.projectedPairToCartesian(extent.maxX, extent.minY, height, crs),
      this.projectedPairToCartesian(extent.maxX, extent.maxY, height, crs),
      this.projectedPairToCartesian(extent.minX, extent.maxY, height, crs),
    ];

    return {
      polygon: {
        hierarchy: createPolygonHierarchy(this.cesium, positions),
        material,
        perPositionHeight: true,
        ...(arcTypeNone !== undefined ? { arcType: arcTypeNone } : {}),
      },
    };
  }

  private createProjectedTilesetModelMatrix(source: { crs?: string; sourceFrame?: string }): unknown {
    if (!this.isProjectedLocalScene() || source.sourceFrame === "ecef") {
      return undefined;
    }
    const sourceCrs = source.crs ?? this.sceneCrs();
    if (sourceCrs.toUpperCase() !== this.sceneCrs().toUpperCase()) {
      return undefined;
    }

    const origin = this.projectedLocalOrigin();
    const localToWorld = this.projectedLocalToWorldMatrix();
    if (!origin || !localToWorld) {
      return undefined;
    }

    const translationMatrix = createTranslationMatrix(
      this.cesium,
      -origin.x,
      -origin.y,
      -origin.z,
    );
    return multiplyMatrix4(this.cesium, localToWorld, translationMatrix);
  }

  private projectedToWorldCartesian(x: number, y: number, z: number, crs: string): CesiumObject {
    let projectedX = x;
    let projectedY = y;
    if (crs.toUpperCase() !== this.sceneCrs().toUpperCase()) {
      const [lon, lat] = projectedToLonLat(crs, x, y);
      [projectedX, projectedY] = lonLatToProjected(this.sceneCrs(), lon, lat);
    }

    const origin = this.projectedLocalOrigin();
    const localToWorld = this.projectedLocalToWorldMatrix();
    if (!origin || !localToWorld) {
      return cartesianFromElements(this.cesium, projectedX, projectedY, z);
    }
    const local = cartesianFromElements(
      this.cesium,
      projectedX - origin.x,
      projectedY - origin.y,
      z - origin.z,
    );
    return multiplyMatrix4ByPoint(this.cesium, localToWorld, local);
  }

  private worldCartesianToProjected(cartesian: CesiumObject): { x: number; y: number; z: number } | null {
    const origin = this.projectedLocalOrigin();
    const localToWorld = this.projectedLocalToWorldMatrix();
    if (!origin || !localToWorld) {
      return null;
    }
    const worldToLocal = invertMatrix4Transformation(this.cesium, localToWorld);
    if (!worldToLocal) {
      return null;
    }
    const local = multiplyMatrix4ByPoint(this.cesium, worldToLocal, cartesian);
    const x = getFiniteNumber(local.x, Number.NaN);
    const y = getFiniteNumber(local.y, Number.NaN);
    const z = getFiniteNumber(local.z, Number.NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return null;
    }
    return {
      x: origin.x + x,
      y: origin.y + y,
      z: origin.z + z,
    };
  }

  private worldVectorToProjectedLocal(vector: CesiumObject): { x: number; y: number; z: number } | null {
    const localToWorld = this.projectedLocalToWorldMatrix();
    if (!localToWorld) {
      return null;
    }
    const worldToLocal = invertMatrix4Transformation(this.cesium, localToWorld);
    if (!worldToLocal) {
      return null;
    }
    const local = multiplyMatrix4ByPointAsVector(this.cesium, worldToLocal, vector);
    const x = getFiniteNumber(local.x, Number.NaN);
    const y = getFiniteNumber(local.y, Number.NaN);
    const z = getFiniteNumber(local.z, Number.NaN);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
      ? { x, y, z }
      : null;
  }

  private createCameraOrientationFromPose(pose: EngineCameraPose): { direction: CesiumObject; up: CesiumObject } | undefined {
    const directionLocal = rotateVectorByQuaternion({ x: 0, y: 0, z: -1 }, pose.rotation);
    const upLocal = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, pose.rotation);
    return this.createCameraOrientationFromVectors(directionLocal, upLocal);
  }

  private projectedLocalVectorToWorld(vector: Vector3Fields): Vector3Fields | null {
    if (!this.isProjectedLocalScene()) {
      return vector;
    }
    const localToWorld = this.projectedLocalToWorldMatrix();
    if (!localToWorld) {
      return null;
    }
    const world = multiplyMatrix4ByPointAsVector(
      this.cesium,
      localToWorld,
      cartesianFromElements(this.cesium, vector.x, vector.y, vector.z),
    );
    return vectorFromObject(world);
  }

  private cameraRotationFromCesium(camera: CesiumObject): EngineCameraPose["rotation"] | null {
    const directionWorld = vectorFromObject(getObject(camera, "directionWC") ?? getObject(camera, "direction"));
    const upWorld = vectorFromObject(getObject(camera, "upWC") ?? getObject(camera, "up"));
    if (!directionWorld || !upWorld) {
      return null;
    }
    const directionLocal = this.isProjectedLocalScene()
      ? this.worldVectorToProjectedLocal(cartesianFromElements(this.cesium, directionWorld.x, directionWorld.y, directionWorld.z))
      : directionWorld;
    const upLocal = this.isProjectedLocalScene()
      ? this.worldVectorToProjectedLocal(cartesianFromElements(this.cesium, upWorld.x, upWorld.y, upWorld.z))
      : upWorld;
    return quaternionFromCameraDirectionUp(directionLocal, upLocal);
  }

  private orbitProjectedLocalCamera(dx: number, dy: number, orbitSpeed: number): void {
    const camera = getObject(this.viewer, "camera");
    const position = getObject(camera, "position");
    if (!camera || !position || !hasFunction(camera, "setView")) {
      return;
    }

    const directionWorld = vectorFromObject(getObject(camera, "directionWC") ?? getObject(camera, "direction"));
    const upWorld = vectorFromObject(getObject(camera, "upWC") ?? getObject(camera, "up"));
    const directionLocal = directionWorld
      ? this.worldVectorToProjectedLocal(cartesianFromElements(this.cesium, directionWorld.x, directionWorld.y, directionWorld.z))
      : rotateVectorByQuaternion({ x: 0, y: 0, z: -1 }, this.lastCameraPose.rotation);
    const upLocal = upWorld
      ? this.worldVectorToProjectedLocal(cartesianFromElements(this.cesium, upWorld.x, upWorld.y, upWorld.z))
      : rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, this.lastCameraPose.rotation);
    const direction = normalizeVector3(directionLocal);
    const up = normalizeVector3(upLocal);
    if (!direction || !up) {
      return;
    }

    const sensitivity = 0.0045 * Math.max(0.05, orbitSpeed);
    const worldUp = { x: 0, y: 0, z: 1 };
    const yawedDirection = rotateVectorAroundAxis(direction, worldUp, -dx * sensitivity);
    const yawedUp = rotateVectorAroundAxis(up, worldUp, -dx * sensitivity);
    const right = normalizeVector3(crossVector3(yawedDirection, yawedUp));
    if (!right) {
      return;
    }
    const pitchedDirection = normalizeVector3(rotateVectorAroundAxis(yawedDirection, right, -dy * sensitivity));
    const pitchedUp = normalizeVector3(rotateVectorAroundAxis(yawedUp, right, -dy * sensitivity));
    if (!pitchedDirection || !pitchedUp) {
      return;
    }
    const orientation = this.createCameraOrientationFromVectors(pitchedDirection, pitchedUp);
    if (!orientation) {
      return;
    }
    camera.setView?.({ destination: position, orientation });

    const scene = getObject(this.viewer, "scene");
    if (hasFunction(scene, "requestRender")) {
      scene.requestRender?.();
    }
  }

  private createCameraOrientationFromVectors(
    directionLocal: Vector3Fields,
    upLocal: Vector3Fields,
  ): { direction: CesiumObject; up: CesiumObject } | undefined {
    const direction = normalizeVector3(this.projectedLocalVectorToWorld(directionLocal));
    const up = normalizeVector3(this.projectedLocalVectorToWorld(upLocal));
    if (!direction || !up || Math.abs(dotVector3(direction, up)) > 0.999) {
      return undefined;
    }
    return {
      direction: cartesianFromElements(this.cesium, direction.x, direction.y, direction.z),
      up: cartesianFromElements(this.cesium, up.x, up.y, up.z),
    };
  }

  private panProjectedLocalCamera(dx: number, dy: number, panSpeed: number): void {
    const camera = getObject(this.viewer, "camera");
    const position = getObject(camera, "position");
    if (!camera || !position) {
      return;
    }
    const currentProjected = this.worldCartesianToProjected(position);
    if (!currentProjected) {
      panCesiumCamera(this.viewer, dx, dy, panSpeed);
      return;
    }

    const amountPerPixel = cesiumPanMetersPerPixel(camera) * Math.max(0.05, panSpeed);
    const cameraRight = getObject(camera, "rightWC") ?? getObject(camera, "right") ?? { x: 1, y: 0, z: 0 };
    const cameraUp = getObject(camera, "upWC") ?? getObject(camera, "up") ?? { x: 0, y: 1, z: 0 };
    const right = normalizeHorizontalVector(
      this.worldVectorToProjectedLocal(cameraRight),
      { x: 1, y: 0 },
    );
    const up = normalizeHorizontalVector(
      this.worldVectorToProjectedLocal(cameraUp),
      { x: 0, y: 1 },
    );
    const deltaX = (-dx * right.x + dy * up.x) * amountPerPixel;
    const deltaY = (-dx * right.y + dy * up.y) * amountPerPixel;
    const destination = this.projectedToWorldCartesian(
      currentProjected.x + deltaX,
      currentProjected.y + deltaY,
      currentProjected.z,
      this.sceneCrs(),
    );

    if (!assignCameraPosition(camera, destination) && hasFunction(camera, "setView")) {
      const orientation = createCameraDirectionUpOrientation(camera);
      camera.setView?.(orientation ? { destination, orientation } : { destination });
    }

    const scene = getObject(this.viewer, "scene");
    if (hasFunction(scene, "requestRender")) {
      scene.requestRender?.();
    }
  }

  private createS102ShaderCoordinateContext(spec: S102BathymetryLayerSpec): S102ShaderCoordinateContext {
    const source = spec.source;
    if (!shouldUseProjectedLocalWorldHeight(spec) || !this.isProjectedLocalScene() || source.sourceFrame === "ecef") {
      return {
        useProjectedLocalWorldHeight: false,
        projectedLocalOriginZ: 0,
      };
    }
    const sourceCrs = source.crs ?? this.sceneCrs();
    if (sourceCrs.toUpperCase() !== this.sceneCrs().toUpperCase()) {
      return {
        useProjectedLocalWorldHeight: false,
        projectedLocalOriginZ: 0,
      };
    }
    const origin = this.projectedLocalOrigin();
    const localToWorld = this.projectedLocalToWorldMatrix();
    const worldToProjectedLocalMatrix = localToWorld
      ? invertMatrix4Transformation(this.cesium, localToWorld)
      : undefined;
    return {
      useProjectedLocalWorldHeight: Boolean(origin && worldToProjectedLocalMatrix),
      worldToProjectedLocalMatrix,
      projectedLocalOriginZ: origin?.z ?? 0,
    };
  }

  private projectedLocalToWorldMatrix(): unknown {
    const origin = this.projectedLocalOrigin();
    const Transforms = this.cesium.Transforms as
      | { eastNorthUpToFixedFrame?: (origin: unknown) => unknown }
      | undefined;
    if (!origin || !Transforms?.eastNorthUpToFixedFrame) {
      return undefined;
    }
    return Transforms.eastNorthUpToFixedFrame(origin.cartesian);
  }

  private projectedLocalOrigin(): { x: number; y: number; z: number; cartesian: CesiumObject } | null {
    const georeference = this.sceneOptions.georeference;
    if (georeference?.mode !== "projected-local") {
      return null;
    }

    const crs = georeference.crs;
    const origin = georeference.origin;
    let x: number;
    let y: number;
    let z = 0;
    let lon: number;
    let lat: number;

    if (origin.kind === "projected") {
      z = origin.z ?? 0;
      if (origin.crs.toUpperCase() === crs.toUpperCase()) {
        x = origin.x;
        y = origin.y;
        [lon, lat] = projectedToLonLat(crs, x, y);
      } else {
        [lon, lat] = projectedToLonLat(origin.crs, origin.x, origin.y);
        [x, y] = lonLatToProjected(crs, lon, lat);
      }
    } else if (origin.kind === "geodetic") {
      lon = origin.lon;
      lat = origin.lat;
      z = origin.height ?? 0;
      [x, y] = lonLatToProjected(crs, lon, lat);
    } else {
      return null;
    }

    return {
      x,
      y,
      z,
      cartesian: this.cartesianFromDegrees(lon, lat, z),
    };
  }
}

function applyCesiumCameraControls(
  cesium: CesiumModule,
  viewer: CesiumObject,
  config: CameraControlConfig,
): void {
  const scene = getObject(viewer, "scene");
  const controller = getObject(scene, "screenSpaceCameraController");
  if (!controller) {
    return;
  }

  const enabled = config.enabled !== false && config.preset !== "disabled";
  controller.enableInputs = enabled;
  if (!enabled) {
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;
    controller.enableTilt = false;
    controller.enableLook = false;
    controller.rotateEventTypes = [];
    controller.translateEventTypes = [];
    controller.zoomEventTypes = [];
    controller.tiltEventTypes = [];
    controller.lookEventTypes = [];
    return;
  }

  if (config.preset === "engine-default" || config.preset === "cesium-default") {
    applyCesiumDefaultCameraControls(cesium, controller);
    applyCesiumCameraConstraints(controller, config);
    return;
  }

  const rotateEvents = cameraEventsForAction(cesium, config, "orbit");
  const translateEvents = cameraEventsForAction(cesium, config, "pan");
  const zoomEvents = cameraEventsForAction(cesium, config, "zoom");
  const tiltEvents = cameraEventsForAction(cesium, config, "tilt");
  const lookEvents = cameraEventsForAction(cesium, config, "look");

  controller.enableRotate = rotateEvents.length > 0;
  controller.enableTranslate = translateEvents.length > 0;
  controller.enableZoom = zoomEvents.length > 0;
  controller.enableTilt = tiltEvents.length > 0;
  controller.enableLook = lookEvents.length > 0;
  controller.rotateEventTypes = rotateEvents;
  controller.translateEventTypes = translateEvents;
  controller.zoomEventTypes = zoomEvents;
  controller.tiltEventTypes = tiltEvents;
  controller.lookEventTypes = lookEvents;

  applyCesiumCameraConstraints(controller, config);
}

function applyCesiumDefaultCameraControls(cesium: CesiumModule, controller: CesiumObject): void {
  const cameraEvents = getCesiumCameraEventType(cesium);
  const modifier = cesium.KeyboardEventModifier as Record<string, unknown> | undefined;
  controller.enableRotate = true;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.enableTilt = true;
  controller.enableLook = true;
  controller.rotateEventTypes = cameraEvents?.LEFT_DRAG;
  controller.translateEventTypes = undefined;
  controller.zoomEventTypes = compactCameraEvents([
    cameraEvents?.RIGHT_DRAG,
    cameraEvents?.WHEEL,
    cameraEvents?.PINCH,
  ]);
  controller.tiltEventTypes = compactCameraEvents([
    cameraEvents?.MIDDLE_DRAG,
    createCesiumModifiedCameraEvent(cameraEvents?.LEFT_DRAG, modifier?.CTRL),
    createCesiumModifiedCameraEvent(cameraEvents?.RIGHT_DRAG, modifier?.CTRL),
  ]);
  controller.lookEventTypes = undefined;
}

function applyCesiumCameraConstraints(
  controller: CesiumObject,
  config: CameraControlConfig,
): void {
  const constraints = config.constraints;
  if (!constraints) {
    return;
  }
  if (constraints.minDistanceMeters !== undefined) {
    controller.minimumZoomDistance = constraints.minDistanceMeters;
  }
  if (constraints.maxDistanceMeters !== undefined) {
    controller.maximumZoomDistance = constraints.maxDistanceMeters;
  }
}

function installCesiumCameraPanHandler(
  cesium: CesiumModule,
  viewer: CesiumObject,
  config: CameraControlConfig,
  customPan?: CesiumPanHandler,
): (() => void) | null {
  if (config.enabled === false || config.preset === "disabled") {
    return null;
  }
  const panBindings = (config.pointer ?? []).filter((binding) => binding.action === "pan");
  if (panBindings.length === 0) {
    return null;
  }

  const scene = getObject(viewer, "scene");
  const canvas = getObject(scene, "canvas");
  const canvasTarget = getDomListenerTarget(canvas);
  if (!canvas || !canvasTarget) {
    return null;
  }
  const screenSpacePanAbort = installCesiumScreenSpaceCameraPanHandler(
    cesium,
    viewer,
    canvas,
    config,
    panBindings,
    customPan,
  );
  if (screenSpacePanAbort) {
    return screenSpacePanAbort;
  }
  const canvasObject = canvas;
  const documentTarget = getDomListenerTarget(getObject(canvas, "ownerDocument")) ?? canvasTarget;
  const capture = true;

  let active = false;
  let activeButtonMaskValue = 0;
  let lastX = 0;
  let lastY = 0;

  const onMouseDown = (event: Event) => {
    if (!eventTargetsCanvas(event, canvasObject)) {
      return;
    }
    const mouse = event as MouseEvent;
    if (!panBindings.some((binding) => mouseEventMatchesPanBinding(mouse, binding.button, binding.modifiers))) {
      return;
    }
    active = true;
    activeButtonMaskValue = mouseButtonMask(mouse.button);
    lastX = mouse.clientX;
    lastY = mouse.clientY;
    preventDefaultIfPossible(event);
  };

  const onMouseMove = (event: Event) => {
    if (!active) {
      return;
    }
    const mouse = event as MouseEvent;
    if (typeof mouse.buttons === "number" && mouse.buttons !== 0 && (mouse.buttons & activeButtonMaskValue) === 0) {
      active = false;
      activeButtonMaskValue = 0;
      return;
    }
    const dx = mouse.clientX - lastX;
    const dy = mouse.clientY - lastY;
    lastX = mouse.clientX;
    lastY = mouse.clientY;
    if (dx !== 0 || dy !== 0) {
      runCesiumPan(viewer, dx, dy, config.speeds?.pan ?? 1, customPan);
      preventDefaultIfPossible(event);
    }
  };

  const stopPan = (event?: Event) => {
    if (active && event) {
      preventDefaultIfPossible(event);
    }
    active = false;
    activeButtonMaskValue = 0;
  };

  const preventAuxClick = (event: Event) => {
    const mouse = event as MouseEvent;
    if (panBindings.some((binding) => mouseButtonNumber(binding.button) === mouse.button)) {
      preventDefaultIfPossible(event);
    }
  };

  documentTarget.addEventListener("mousedown", onMouseDown, capture);
  documentTarget.addEventListener("mousemove", onMouseMove, capture);
  documentTarget.addEventListener("mouseup", stopPan, capture);
  canvasTarget.addEventListener("mousedown", onMouseDown, capture);
  canvasTarget.addEventListener("mouseleave", stopPan, capture);
  canvasTarget.addEventListener("auxclick", preventAuxClick, capture);
  canvasTarget.addEventListener("contextmenu", preventAuxClick, capture);

  return () => {
    documentTarget.removeEventListener("mousedown", onMouseDown, capture);
    documentTarget.removeEventListener("mousemove", onMouseMove, capture);
    documentTarget.removeEventListener("mouseup", stopPan, capture);
    canvasTarget.removeEventListener("mousedown", onMouseDown, capture);
    canvasTarget.removeEventListener("mouseleave", stopPan, capture);
    canvasTarget.removeEventListener("auxclick", preventAuxClick, capture);
    canvasTarget.removeEventListener("contextmenu", preventAuxClick, capture);
  };
}

function installCesiumCameraOrbitHandler(
  cesium: CesiumModule,
  viewer: CesiumObject,
  config: CameraControlConfig,
  customOrbit: CesiumPanHandler,
): (() => void) | null {
  const orbitPointer = (config.pointer ?? [])
    .filter((binding) => binding.action === "orbit")
    .map((binding): CameraControlPointerBinding => ({
      ...binding,
      action: "pan",
    }));
  if (orbitPointer.length === 0) {
    return null;
  }
  return installCesiumCameraPanHandler(
    cesium,
    viewer,
    {
      ...config,
      pointer: orbitPointer,
      speeds: {
        ...config.speeds,
        pan: config.speeds?.orbit ?? config.speeds?.pan ?? 1,
      },
    },
    customOrbit,
  );
}

function disableCesiumNativeCameraRotate(viewer: CesiumObject): void {
  const controller = getObject(getObject(viewer, "scene"), "screenSpaceCameraController");
  if (!controller) {
    return;
  }
  controller.enableRotate = false;
  controller.rotateEventTypes = [];
}

function installCesiumScreenSpaceCameraPanHandler(
  cesium: CesiumModule,
  viewer: CesiumObject,
  canvas: CesiumObject,
  config: CameraControlConfig,
  panBindings: readonly CameraControlPointerBinding[],
  customPan?: CesiumPanHandler,
): (() => void) | null {
  const ScreenSpaceEventHandler = cesium.ScreenSpaceEventHandler as CesiumConstructor | undefined;
  const screenEvents = cesium.ScreenSpaceEventType as Record<string, unknown> | undefined;
  if (
    !ScreenSpaceEventHandler ||
    !screenEvents?.MOUSE_MOVE ||
    !screenEvents.MIDDLE_DOWN ||
    !screenEvents.MIDDLE_UP
  ) {
    return null;
  }

  const handler = new ScreenSpaceEventHandler(canvas) as CesiumObject & {
    setInputAction?: (callback: (movement: unknown) => void, type: unknown, modifier?: unknown) => void;
    destroy?: () => void;
  };
  if (typeof handler.setInputAction !== "function") {
    return null;
  }

  let active = false;
  let lastX = 0;
  let lastY = 0;

  for (const binding of panBindings) {
    const downType = pointerButtonToScreenSpaceDownEvent(screenEvents, binding.button);
    if (downType === undefined) {
      continue;
    }
    const modifier = singleCesiumModifier(cesium, binding.modifiers);
    handler.setInputAction((movement: unknown) => {
      const point = screenSpaceMovementPoint(movement, "position");
      if (!point) {
        return;
      }
      if (screenPointHitsVesselGizmo(cesium, viewer, point)) {
        active = false;
        return;
      }
      active = true;
      lastX = point.x;
      lastY = point.y;
    }, downType, modifier);
  }

  handler.setInputAction((movement: unknown) => {
    if (!active) {
      return;
    }
    const scene = getObject(viewer, "scene");
    if (scene?.__s100VesselGizmoDragging === true) {
      return;
    }
    const point = screenSpaceMovementPoint(movement, "endPosition");
    if (!point) {
      return;
    }
    const dx = point.x - lastX;
    const dy = point.y - lastY;
    lastX = point.x;
    lastY = point.y;
    if (dx !== 0 || dy !== 0) {
      runCesiumPan(viewer, dx, dy, config.speeds?.pan ?? 1, customPan);
    }
  }, screenEvents.MOUSE_MOVE);

  for (const binding of panBindings) {
    const upType = pointerButtonToScreenSpaceUpEvent(screenEvents, binding.button);
    if (upType === undefined) {
      continue;
    }
    const modifier = singleCesiumModifier(cesium, binding.modifiers);
    handler.setInputAction(() => {
      active = false;
    }, upType, modifier);
  }

  return () => {
    if (typeof handler.destroy === "function") {
      handler.destroy();
    }
  };
}

function pointerButtonToScreenSpaceDownEvent(
  screenEvents: Record<string, unknown>,
  button: "left" | "middle" | "right",
): unknown {
  return button === "left"
    ? screenEvents.LEFT_DOWN
    : button === "middle"
      ? screenEvents.MIDDLE_DOWN
      : screenEvents.RIGHT_DOWN;
}

function pointerButtonToScreenSpaceUpEvent(
  screenEvents: Record<string, unknown>,
  button: "left" | "middle" | "right",
): unknown {
  return button === "left"
    ? screenEvents.LEFT_UP
    : button === "middle"
      ? screenEvents.MIDDLE_UP
      : screenEvents.RIGHT_UP;
}

function singleCesiumModifier(
  cesium: CesiumModule,
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown {
  if (!modifiers || modifiers.length === 0) {
    return undefined;
  }
  if (modifiers.length > 1) {
    return undefined;
  }
  const modifier = modifiers[0];
  return modifier === undefined ? undefined : cameraControlModifierToCesium(cesium, modifier);
}

function screenSpaceMovementPoint(
  movement: unknown,
  key: "position" | "endPosition",
): { x: number; y: number } | null {
  if (!movement || typeof movement !== "object") {
    return null;
  }
  const point = (movement as Record<string, unknown>)[key];
  if (!point || typeof point !== "object") {
    return null;
  }
  const x = (point as { x?: unknown }).x;
  const y = (point as { y?: unknown }).y;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
    ? { x, y }
    : null;
}

function getDomListenerTarget(value: unknown): DomListenerTarget | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const target = value as {
    addEventListener?: unknown;
    removeEventListener?: unknown;
  };
  if (typeof target.addEventListener !== "function" || typeof target.removeEventListener !== "function") {
    return null;
  }
  return {
    addEventListener: target.addEventListener.bind(value) as DomListenerTarget["addEventListener"],
    removeEventListener: target.removeEventListener.bind(value) as DomListenerTarget["removeEventListener"],
  };
}

function eventTargetsCanvas(event: Event, canvas: CesiumObject): boolean {
  const target = (event as { target?: unknown }).target;
  if (!target || target === canvas) {
    return true;
  }
  const contains = (canvas as { contains?: unknown }).contains;
  return typeof contains === "function" ? Boolean(contains.call(canvas, target)) : false;
}

function mouseEventMatchesPanBinding(
  event: MouseEvent,
  button: "left" | "middle" | "right",
  modifiers: readonly CameraControlModifier[] | undefined,
): boolean {
  return event.button === mouseButtonNumber(button) && mouseEventMatchesModifiers(event, modifiers);
}

function mouseButtonNumber(button: "left" | "middle" | "right"): number {
  return button === "left" ? 0 : button === "middle" ? 1 : 2;
}

function mouseEventMatchesModifiers(
  event: MouseEvent,
  modifiers: readonly CameraControlModifier[] | undefined,
): boolean {
  const expected = new Set(modifiers ?? []);
  return (
    Boolean(event.shiftKey) === expected.has("shift") &&
    Boolean(event.ctrlKey) === expected.has("ctrl") &&
    Boolean(event.altKey) === expected.has("alt") &&
    Boolean(event.metaKey) === expected.has("meta")
  );
}

function mouseButtonMask(button: number): number {
  return button === 0 ? 1 : button === 1 ? 4 : button === 2 ? 2 : 0;
}

function runCesiumPan(
  viewer: CesiumObject,
  dx: number,
  dy: number,
  panSpeed: number,
  customPan?: CesiumPanHandler,
): void {
  if (customPan) {
    customPan(dx, dy, panSpeed);
    return;
  }
  panCesiumCamera(viewer, dx, dy, panSpeed);
}

function panCesiumCamera(viewer: CesiumObject, dx: number, dy: number, panSpeed: number): void {
  const camera = getObject(viewer, "camera");
  if (!camera) {
    return;
  }
  const amountPerPixel = cesiumPanMetersPerPixel(camera) * Math.max(0.05, panSpeed);
  const rightAmount = -dx * amountPerPixel;
  const upAmount = dy * amountPerPixel;

  if (hasFunction(camera, "moveRight")) {
    camera.moveRight?.(rightAmount);
  } else {
    translateCameraPositionFallback(camera, "x", rightAmount);
  }
  if (hasFunction(camera, "moveUp")) {
    camera.moveUp?.(upAmount);
  } else {
    translateCameraPositionFallback(camera, "y", upAmount);
  }

  const scene = getObject(viewer, "scene");
  if (hasFunction(scene, "requestRender")) {
    scene.requestRender?.();
  }
}

function cesiumPanMetersPerPixel(camera: CesiumObject): number {
  const cartographic = getObject(camera, "positionCartographic");
  const cartographicHeight = getFiniteNumber(cartographic?.height, Number.NaN);
  if (Number.isFinite(cartographicHeight) && Math.abs(cartographicHeight) > 0) {
    return Math.max(1, Math.min(10_000, Math.abs(cartographicHeight) * 0.004));
  }
  const position = getObject(camera, "position");
  const positionDistance = Math.hypot(
    getFiniteNumber(position?.x, 0),
    getFiniteNumber(position?.y, 0),
    getFiniteNumber(position?.z, 0),
  );
  if (Number.isFinite(positionDistance) && positionDistance > 0 && positionDistance < 100_000) {
    return Math.max(1, Math.min(10_000, positionDistance * 0.004));
  }
  return 10;
}

function translateCameraPositionFallback(camera: CesiumObject, axis: "x" | "y", amount: number): void {
  const position = getObject(camera, "position");
  if (position && typeof position[axis] === "number") {
    position[axis] += amount;
  }
}

function preventDefaultIfPossible(event: Event): void {
  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }
}

function cameraEventsForAction(
  cesium: CesiumModule,
  config: CameraControlConfig,
  action: CameraControlAction,
): unknown[] {
  const events: unknown[] = [];
  for (const binding of config.pointer ?? []) {
    if (binding.action !== action) {
      continue;
    }
    events.push(...pointerBindingToCesiumEvents(cesium, binding.button, binding.modifiers));
  }

  if (action === "zoom" && config.wheel !== false && config.wheel?.action === "zoom") {
    events.push(...wheelBindingToCesiumEvents(cesium, config.wheel.modifiers));
  }

  if (action === "zoom") {
    for (const binding of config.touch ?? []) {
      if (binding.action === "zoom" && binding.gesture === "pinch") {
        const cameraEvents = getCesiumCameraEventType(cesium);
        if (cameraEvents?.PINCH !== undefined) {
          events.push(cameraEvents.PINCH);
        }
      }
    }
  }

  return events;
}

function pointerBindingToCesiumEvents(
  cesium: CesiumModule,
  button: "left" | "middle" | "right",
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown[] {
  const cameraEvents = getCesiumCameraEventType(cesium);
  const eventType = button === "left"
    ? cameraEvents?.LEFT_DRAG
    : button === "middle"
      ? cameraEvents?.MIDDLE_DRAG
      : cameraEvents?.RIGHT_DRAG;
  return createCesiumCameraEvents(cesium, eventType, modifiers);
}

function wheelBindingToCesiumEvents(
  cesium: CesiumModule,
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown[] {
  const cameraEvents = getCesiumCameraEventType(cesium);
  return createCesiumCameraEvents(cesium, cameraEvents?.WHEEL, modifiers);
}

function getCesiumCameraEventType(cesium: CesiumModule): Record<string, unknown> | undefined {
  return (cesium.CameraEventType ?? cesium.ScreenSpaceEventType) as
    | Record<string, unknown>
    | undefined;
}

function createCesiumCameraEvents(
  cesium: CesiumModule,
  eventType: unknown,
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown[] {
  if (eventType === undefined) {
    return [];
  }
  if (!modifiers || modifiers.length === 0) {
    return [eventType];
  }

  const events: unknown[] = [];
  for (const modifier of modifiers) {
    const cesiumModifier = cameraControlModifierToCesium(cesium, modifier);
    if (cesiumModifier !== undefined) {
      events.push(createCesiumModifiedCameraEvent(eventType, cesiumModifier));
    }
  }
  return events;
}

function cameraControlModifierToCesium(
  cesium: CesiumModule,
  modifier: CameraControlModifier,
): unknown {
  const modifiers = cesium.KeyboardEventModifier as Record<string, unknown> | undefined;
  switch (modifier) {
    case "shift":
      return modifiers?.SHIFT;
    case "ctrl":
      return modifiers?.CTRL;
    case "alt":
      return modifiers?.ALT;
    case "meta":
      return undefined;
  }
}

function createCesiumModifiedCameraEvent(eventType: unknown, modifier: unknown): unknown {
  if (eventType === undefined || modifier === undefined) {
    return undefined;
  }
  return { eventType, modifier };
}

function compactCameraEvents(events: readonly unknown[]): unknown[] {
  return events.filter((event) => event !== undefined);
}

function isCesiumLayerNative(value: unknown): value is CesiumLayerNative {
  return Boolean(value && typeof value === "object" && "kind" in value && "spec" in value);
}

function createNativeEmitter<TPayload>(): NativeEmitter<TPayload> {
  const listeners = new Set<(payload: TPayload) => void>();
  return {
    subscribe(listener: (payload: TPayload) => void) {
      listeners.add(listener);
      return {
        unsubscribe() {
          listeners.delete(listener);
        },
      };
    },
    emit(payload: TPayload) {
      for (const listener of [...listeners]) {
        listener(payload);
      }
    },
    clear() {
      listeners.clear();
    },
  };
}

function createCesiumVesselNativeView(getSpec: () => VesselLayerSpec): CesiumVesselNativeView {
  return {
    getPosition() {
      return vesselPositionTuple(getSpec());
    },
    getHeading() {
      return normalizeDegrees(getSpec().pose.headingDegrees ?? 0);
    },
    positionChanged: createNativeEmitter<[number, number, number]>(),
    headingChanged: createNativeEmitter<number>(),
  };
}

function vesselPositionTuple(spec: VesselLayerSpec): [number, number, number] {
  const position = spec.pose.position;
  if (position.kind === "projected") {
    return [position.x, position.y, position.z ?? 0];
  }
  if (position.kind === "engine-local") {
    return [position.x, position.y, position.z];
  }
  if (position.kind === "geodetic") {
    return [position.lon, position.lat, position.height ?? 0];
  }
  return [position.x, position.y, position.z];
}

function isVesselGizmoPickInfo(value: unknown): value is VesselGizmoPickInfo {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as { layer?: unknown; axis?: unknown };
  return (
    isCesiumLayerNative(record.layer) &&
    record.layer.kind === "vessel" &&
    (record.axis === "x" || record.axis === "y" || record.axis === "z" || record.axis === "heading")
  );
}

function resolveVesselGizmoPickInfo(picked: unknown): VesselGizmoPickInfo | null {
  const stack = [picked];
  const visited = new Set<unknown>();
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== "object" || visited.has(value)) {
      continue;
    }
    visited.add(value);
    const record = value as CesiumObject;
    const pickInfo = record.__s100VesselGizmo;
    if (isVesselGizmoPickInfo(pickInfo)) {
      return pickInfo;
    }
    for (const key of ["primitive", "id", "collection", "object"]) {
      if (record[key]) {
        stack.push(record[key]);
      }
    }
  }
  return null;
}

function screenPointHitsVesselGizmo(
  cesium: CesiumModule,
  viewer: CesiumObject,
  point: { x: number; y: number },
): boolean {
  const scene = getObject(viewer, "scene");
  if (scene?.__s100VesselGizmoDragging === true) {
    return true;
  }
  if (!hasFunction(scene, "pick")) {
    return false;
  }
  const picked = scene.pick?.(createCartesian2(cesium, point.x, point.y));
  return resolveVesselGizmoPickInfo(picked) !== null;
}

function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return ((value % 360) + 360) % 360;
}

function resolveCesiumSkyboxSources(state: EnvironmentState): CesiumSkyboxFaces | null {
  const explicitFaces = normalizeCesiumSkyboxFaces(state.skyboxFaces ?? getObject(state.metadata, "skyboxFaces"));
  if (explicitFaces) {
    return explicitFaces;
  }

  const template = getStringMetadata(state, "skyboxUrlTemplate");
  if (template) {
    return createSkyboxFacesFromTemplate(template);
  }

  const url = state.skyboxUrl;
  if (!url || isHdrEnvironmentMap(url) || isKtx2EnvironmentMap(url)) {
    return null;
  }

  return {
    positiveX: url,
    negativeX: url,
    positiveY: url,
    negativeY: url,
    positiveZ: url,
    negativeZ: url,
  };
}

function normalizeCesiumSkyboxFaces(value: unknown): CesiumSkyboxFaces | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const faces = {
    positiveX: record.positiveX,
    negativeX: record.negativeX,
    positiveY: record.positiveY,
    negativeY: record.negativeY,
    positiveZ: record.positiveZ,
    negativeZ: record.negativeZ,
  };
  if (Object.values(faces).every((face) => typeof face === "string" && face.length > 0)) {
    return faces as CesiumSkyboxFaces;
  }
  return null;
}

function createSkyboxFacesFromTemplate(template: string): CesiumSkyboxFaces {
  const replaceFace = (face: string) =>
    template
      .replaceAll("{face}", face)
      .replaceAll("{FACE}", face.toUpperCase());
  return {
    positiveX: replaceFace("positiveX"),
    negativeX: replaceFace("negativeX"),
    positiveY: replaceFace("positiveY"),
    negativeY: replaceFace("negativeY"),
    positiveZ: replaceFace("positiveZ"),
    negativeZ: replaceFace("negativeZ"),
  };
}

function getStringMetadata(state: EnvironmentState, key: string): string | undefined {
  const value = state.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isHdrEnvironmentMap(url: string): boolean {
  return /\.hdr(?:[?#].*)?$/i.test(url);
}

function isKtx2EnvironmentMap(url: string): boolean {
  return /\.ktx2(?:[?#].*)?$/i.test(url);
}

function mergeLayerSpecPatch<TSpec extends BaseLayerSpec>(spec: TSpec, patch: LayerPatch): TSpec {
  return {
    ...spec,
    ...patch,
  } as TSpec;
}

async function resolveCesiumModule(provider: CesiumModuleProvider | undefined): Promise<CesiumModule> {
  if (!provider) {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<CesiumModule>;
    return dynamicImport("cesium");
  }
  return typeof provider === "function" ? provider() : provider;
}

function setCesiumAccessToken(cesium: CesiumModule, accessToken: string): void {
  const Ion = cesium.Ion as { defaultAccessToken?: string } | undefined;
  if (Ion) {
    Ion.defaultAccessToken = accessToken;
  }
}

function getHtmlElement(container: unknown): HTMLElement | null {
  if (container && typeof container === "object" && "appendChild" in container) {
    return container as HTMLElement;
  }
  return null;
}

function createEngineVersionFields(cesium: CesiumModule): Pick<EngineHandleBundle, "engineVersion"> {
  return typeof cesium.VERSION === "string" ? { engineVersion: cesium.VERSION } : {};
}

function getCesiumConstructor(cesium: CesiumModule, key: string): CesiumConstructor {
  const value = cesium[key];
  if (typeof value !== "function") {
    throw new S100Error("adapter-lifecycle", `Cesium module does not expose '${key}'.`);
  }
  return value as CesiumConstructor;
}

function hasConstructor(cesium: CesiumModule, key: string): boolean {
  return typeof cesium[key] === "function";
}

function getObject(value: unknown, key: string): CesiumObject | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object" ? (child as CesiumObject) : null;
}

function hasFunction(value: unknown, key: string): value is Record<string, (...args: unknown[]) => unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as Record<string, unknown>)[key] === "function");
}

function callIfFunction(value: unknown, key: string): void {
  if (hasFunction(value, key)) {
    value[key]?.();
  }
}

function destroyCesiumObject(value: unknown): void {
  if (!hasFunction(value, "destroy")) {
    return;
  }
  if (hasFunction(value, "isDestroyed")) {
    try {
      if (Boolean(value.isDestroyed?.())) {
        return;
      }
    } catch (error) {
      if (isCesiumDestroyedError(error)) {
        return;
      }
      throw error;
    }
  }
  try {
    value.destroy?.();
  } catch (error) {
    if (!isCesiumDestroyedError(error)) {
      throw error;
    }
  }
}

function isCesiumObjectDestroyed(value: unknown): boolean {
  if (!hasFunction(value, "isDestroyed")) {
    return false;
  }
  try {
    return Boolean(value.isDestroyed?.());
  } catch (error) {
    if (isCesiumDestroyedError(error)) {
      return true;
    }
    throw error;
  }
}

function isCesiumDestroyedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  const message = (error as { message?: unknown }).message;
  return (
    name === "DeveloperError" &&
    typeof message === "string" &&
    /destroyed|destroy\(\)/iu.test(message)
  );
}

function getFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return getFiniteNumber(value, fallback);
}

function clamp01(value: unknown): number {
  return Math.max(0, Math.min(1, finiteNumber(value, 1)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerpNumber(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function createDeferredImageSource(imageUrl: string): DeferredImageSource {
  const ImageConstructor = (globalThis as { Image?: new () => BrowserImageLike }).Image;
  if (typeof ImageConstructor !== "function") {
    return {
      image: imageUrl,
      ready: true,
      onLoad(callback: () => void): void {
        callback();
      },
    };
  }

  const image = new ImageConstructor();
  const loadCallbacks: Array<() => void> = [];
  let ready = false;
  let failed = false;

  const markReady = () => {
    if (ready || failed) {
      return;
    }
    ready = true;
    const callbacks = loadCallbacks.splice(0);
    for (const callback of callbacks) {
      callback();
    }
  };
  const markFailed = () => {
    if (ready || failed) {
      return;
    }
    failed = true;
    loadCallbacks.length = 0;
  };

  if (typeof image.addEventListener === "function") {
    image.addEventListener("load", markReady, { once: true });
    image.addEventListener("error", markFailed, { once: true });
  } else {
    image.onload = markReady;
    image.onerror = markFailed;
  }

  image.crossOrigin = "anonymous";
  image.src = imageUrl;
  if (image.complete && (image.naturalWidth ?? 1) > 0) {
    markReady();
  }

  return {
    image,
    get ready() {
      return ready;
    },
    onLoad(callback: () => void): void {
      if (ready) {
        callback();
        return;
      }
      if (!failed) {
        loadCallbacks.push(callback);
      }
    },
  };
}

type LocalPoint2D = readonly [number, number];

function offsetClosedPolygon(
  points: readonly LocalPoint2D[],
  distance: number,
): LocalPoint2D[] {
  if (points.length < 3 || !Number.isFinite(distance) || distance <= 0) {
    return [...points];
  }

  const orientation = signedPolygonArea(points) >= 0 ? 1 : -1;
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length] ?? point;
    const next = points[(index + 1) % points.length] ?? point;
    const previousEdge = subtractLocalPoint(point, previous);
    const nextEdge = subtractLocalPoint(next, point);
    const previousNormal = outwardEdgeNormal(previousEdge, orientation);
    const nextNormal = outwardEdgeNormal(nextEdge, orientation);
    const previousOffsetStart = addScaledLocalPoint(previous, previousNormal, distance);
    const nextOffsetStart = addScaledLocalPoint(point, nextNormal, distance);
    const intersection = intersectLocalLines(
      previousOffsetStart,
      previousEdge,
      nextOffsetStart,
      nextEdge,
    );
    if (intersection) {
      return intersection;
    }

    const averageNormal = normalizeLocalPoint([
      previousNormal[0] + nextNormal[0],
      previousNormal[1] + nextNormal[1],
    ]);
    return addScaledLocalPoint(point, averageNormal, distance);
  });
}

function signedPolygonArea(points: readonly LocalPoint2D[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index] ?? [0, 0];
    const next = points[(index + 1) % points.length] ?? current;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function subtractLocalPoint(left: LocalPoint2D, right: LocalPoint2D): LocalPoint2D {
  return [left[0] - right[0], left[1] - right[1]];
}

function addScaledLocalPoint(point: LocalPoint2D, vector: LocalPoint2D, scale: number): LocalPoint2D {
  return [point[0] + vector[0] * scale, point[1] + vector[1] * scale];
}

function outwardEdgeNormal(edge: LocalPoint2D, orientation: 1 | -1): LocalPoint2D {
  const length = Math.hypot(edge[0], edge[1]) || 1;
  return orientation > 0
    ? [edge[1] / length, -edge[0] / length]
    : [-edge[1] / length, edge[0] / length];
}

function normalizeLocalPoint(point: LocalPoint2D): LocalPoint2D {
  const length = Math.hypot(point[0], point[1]);
  return length > 1e-9 ? [point[0] / length, point[1] / length] : [0, 0];
}

function intersectLocalLines(
  firstPoint: LocalPoint2D,
  firstDirection: LocalPoint2D,
  secondPoint: LocalPoint2D,
  secondDirection: LocalPoint2D,
): LocalPoint2D | null {
  const cross =
    firstDirection[0] * secondDirection[1] -
    firstDirection[1] * secondDirection[0];
  if (Math.abs(cross) < 1e-9) {
    return null;
  }
  const delta = subtractLocalPoint(secondPoint, firstPoint);
  const t =
    (delta[0] * secondDirection[1] - delta[1] * secondDirection[0]) /
    cross;
  return [
    firstPoint[0] + firstDirection[0] * t,
    firstPoint[1] + firstDirection[1] * t,
  ];
}

function createMatrix4Result(cesium: CesiumModule): unknown {
  const Matrix4 = cesium.Matrix4 as CesiumConstructor | undefined;
  return Matrix4 ? new Matrix4() : {};
}

function createTranslationMatrix(cesium: CesiumModule, x: number, y: number, z: number): unknown {
  const Matrix4 = cesium.Matrix4 as
    | { fromTranslation?: (translation: unknown, result?: unknown) => unknown }
    | undefined;
  const translation = cartesianFromElements(cesium, x, y, z);
  return Matrix4?.fromTranslation
    ? Matrix4.fromTranslation(translation, createMatrix4Result(cesium))
    : { kind: "translation", translation };
}

function multiplyMatrix4(cesium: CesiumModule, left: unknown, right: unknown): unknown {
  const Matrix4 = cesium.Matrix4 as
    | { multiply?: (left: unknown, right: unknown, result?: unknown) => unknown }
    | undefined;
  return Matrix4?.multiply
    ? Matrix4.multiply(left, right, createMatrix4Result(cesium))
    : { kind: "multiply", left, right };
}

function multiplyMatrix4ByPoint(cesium: CesiumModule, matrix: unknown, point: CesiumObject): CesiumObject {
  const Matrix4 = cesium.Matrix4 as
    | { multiplyByPoint?: (matrix: unknown, point: unknown, result?: unknown) => CesiumObject }
    | undefined;
  return Matrix4?.multiplyByPoint
    ? Matrix4.multiplyByPoint(matrix, point, cartesianFromElements(cesium, 0, 0, 0))
    : point;
}

function multiplyMatrix4ByPointAsVector(cesium: CesiumModule, matrix: unknown, vector: CesiumObject): CesiumObject {
  const Matrix4 = cesium.Matrix4 as
    | { multiplyByPointAsVector?: (matrix: unknown, vector: unknown, result?: unknown) => CesiumObject }
    | undefined;
  return Matrix4?.multiplyByPointAsVector
    ? Matrix4.multiplyByPointAsVector(matrix, vector, cartesianFromElements(cesium, 0, 0, 0))
    : multiplyMatrix4ByPoint(cesium, matrix, vector);
}

function invertMatrix4Transformation(cesium: CesiumModule, matrix: unknown): unknown {
  const Matrix4 = cesium.Matrix4 as
    | {
        inverseTransformation?: (matrix: unknown, result?: unknown) => unknown;
        inverse?: (matrix: unknown, result?: unknown) => unknown;
      }
    | undefined;
  if (Matrix4?.inverseTransformation) {
    return Matrix4.inverseTransformation(matrix, createMatrix4Result(cesium));
  }
  if (Matrix4?.inverse) {
    return Matrix4.inverse(matrix, createMatrix4Result(cesium));
  }
  return undefined;
}

function createIdentityMatrix4(cesium: CesiumModule): unknown {
  const Matrix4 = cesium.Matrix4 as
    | {
        IDENTITY?: unknown;
        clone?: (matrix: unknown, result?: unknown) => unknown;
      }
    | undefined;
  if (Matrix4?.IDENTITY !== undefined) {
    return Matrix4.clone
      ? Matrix4.clone(Matrix4.IDENTITY, createMatrix4Result(cesium))
      : Matrix4.IDENTITY;
  }
  return { kind: "identity" };
}

function normalizeHorizontalVector(
  vector: { x: number; y: number; z: number } | null,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const x = getFiniteNumber(vector?.x, Number.NaN);
  const y = getFiniteNumber(vector?.y, Number.NaN);
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length < 1e-6) {
    return fallback;
  }
  return {
    x: x / length,
    y: y / length,
  };
}

function vectorFromObject(value: unknown): Vector3Fields | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const vector = value as { x?: unknown; y?: unknown; z?: unknown };
  const x = getFiniteNumber(vector.x, Number.NaN);
  const y = getFiniteNumber(vector.y, Number.NaN);
  const z = getFiniteNumber(vector.z, Number.NaN);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? { x, y, z }
    : null;
}

function normalizeVector3(vector: Vector3Fields | null): Vector3Fields | null {
  if (!vector) {
    return null;
  }
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < 1e-9) {
    return null;
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function dotVector3(left: Vector3Fields, right: Vector3Fields): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function crossVector3(left: Vector3Fields, right: Vector3Fields): Vector3Fields {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function rotateVectorAroundAxis(vector: Vector3Fields, axis: Vector3Fields, radians: number): Vector3Fields {
  const normalizedAxis = normalizeVector3(axis);
  if (!normalizedAxis) {
    return vector;
  }
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const axisDotVector = dotVector3(normalizedAxis, vector);
  const axisCrossVector = crossVector3(normalizedAxis, vector);
  return {
    x: vector.x * cos + axisCrossVector.x * sin + normalizedAxis.x * axisDotVector * (1 - cos),
    y: vector.y * cos + axisCrossVector.y * sin + normalizedAxis.y * axisDotVector * (1 - cos),
    z: vector.z * cos + axisCrossVector.z * sin + normalizedAxis.z * axisDotVector * (1 - cos),
  };
}

function rotateVectorByQuaternion(vector: Vector3Fields, rotation: EngineCameraPose["rotation"]): Vector3Fields {
  const quaternion = normalizeQuaternion(rotation);
  const qx = quaternion.x;
  const qy = quaternion.y;
  const qz = quaternion.z;
  const qw = quaternion.w;
  const ix = qw * vector.x + qy * vector.z - qz * vector.y;
  const iy = qw * vector.y + qz * vector.x - qx * vector.z;
  const iz = qw * vector.z + qx * vector.y - qy * vector.x;
  const iw = -qx * vector.x - qy * vector.y - qz * vector.z;

  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

function quaternionFromCameraDirectionUp(
  direction: Vector3Fields | null,
  up: Vector3Fields | null,
): EngineCameraPose["rotation"] | null {
  const forward = normalizeVector3(direction);
  const upVector = normalizeVector3(up);
  if (!forward || !upVector) {
    return null;
  }
  const right = normalizeVector3(crossVector3(forward, upVector));
  if (!right) {
    return null;
  }
  const back = { x: -forward.x, y: -forward.y, z: -forward.z };
  const correctedUp = normalizeVector3(crossVector3(back, right));
  if (!correctedUp) {
    return null;
  }
  return quaternionFromBasis(right, correctedUp, back);
}

function quaternionFromBasis(
  right: Vector3Fields,
  up: Vector3Fields,
  back: Vector3Fields,
): EngineCameraPose["rotation"] {
  const m00 = right.x;
  const m01 = up.x;
  const m02 = back.x;
  const m10 = right.y;
  const m11 = up.y;
  const m12 = back.y;
  const m20 = right.z;
  const m21 = up.z;
  const m22 = back.z;
  const trace = m00 + m11 + m22;
  let x = 0;
  let y = 0;
  let z = 0;
  let w = 1;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }

  return normalizeQuaternion({ x, y, z, w });
}

function normalizeQuaternion(rotation: EngineCameraPose["rotation"]): EngineCameraPose["rotation"] {
  const x = getFiniteNumber(rotation.x, 0);
  const y = getFiniteNumber(rotation.y, 0);
  const z = getFiniteNumber(rotation.z, 0);
  const w = getFiniteNumber(rotation.w, 1);
  const length = Math.hypot(x, y, z, w);
  if (!Number.isFinite(length) || length < 1e-9) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return {
    x: cleanSignedZero(x / length),
    y: cleanSignedZero(y / length),
    z: cleanSignedZero(z / length),
    w: cleanSignedZero(w / length),
  };
}

function cleanSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function createCameraDirectionUpOrientation(camera: CesiumObject): { direction: unknown; up: unknown } | undefined {
  const direction = getObject(camera, "directionWC") ?? getObject(camera, "direction");
  const up = getObject(camera, "upWC") ?? getObject(camera, "up");
  return direction && up ? { direction, up } : undefined;
}

function assignCameraPosition(camera: CesiumObject, destination: CesiumObject): boolean {
  try {
    (camera as { position?: unknown }).position = destination;
    (camera as { positionWC?: unknown }).positionWC = destination;
    return true;
  } catch {
    const position = getObject(camera, "position");
    if (!position) {
      return false;
    }
    return copyCartesianFields(position, destination);
  }
}

function copyCartesianFields(target: CesiumObject, source: CesiumObject): boolean {
  let copied = false;
  for (const key of ["x", "y", "z", "lon", "lat", "height", "frame", "origin"]) {
    if (key in source) {
      target[key] = source[key];
      copied = true;
    }
  }
  return copied;
}

function assertSourceKind<TKind extends ServiceReadySource["kind"]>(
  spec: BaseLayerSpec,
  kind: TKind,
): asserts spec is BaseLayerSpec & { source: Extract<ServiceReadySource, { kind: TKind }> } {
  if (!spec.source || typeof spec.source !== "object" || !("kind" in spec.source)) {
    throw new S100Error("invalid-layer-spec", `Layer '${spec.id}' must define a '${kind}' source.`);
  }
  if ((spec.source as ServiceReadySource).kind !== kind) {
    throw new S100Error(
      "invalid-layer-spec",
      `Layer '${spec.id}' must use a '${kind}' source for Cesium.`,
      spec,
    );
  }
}

function createTilesetUrl(
  source: { url: string; query?: Record<string, string | number | boolean>; crs?: string; verticalDatum?: string; sourceFrame?: string },
): string {
  return appendSourceQuery(
    normalizeTilesetEntryPoint(source.url),
    source,
    shouldForwardCrsToCesium(source),
  );
}

function normalizeTilesetEntryPoint(url: string): string {
  const hashIndex = url.indexOf("#");
  const urlWithoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const queryIndex = urlWithoutHash.indexOf("?");
  const path = queryIndex === -1 ? urlWithoutHash : urlWithoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : urlWithoutHash.slice(queryIndex);
  if (/\.json$/iu.test(path)) {
    return url;
  }

  const separator = path.endsWith("/") ? "" : "/";
  return `${path}${separator}tileset.json${query}${hash}`;
}

function appendSourceQuery(
  url: string,
  source: { query?: Record<string, string | number | boolean>; crs?: string; verticalDatum?: string },
  forwardCrs: boolean,
): string {
  const params = new URLSearchParams();
  if (forwardCrs && source.crs) {
    params.set("crs", source.crs);
  }
  if (source.verticalDatum) {
    params.set("verticalDatum", source.verticalDatum);
  }
  for (const [key, value] of Object.entries(source.query ?? {})) {
    if (key.toLowerCase() === "crs" && !forwardCrs) {
      continue;
    }
    params.set(key, String(value));
  }
  return params.size === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
}

function shouldForwardCrsToCesium(source: { crs?: string; sourceFrame?: string }): boolean {
  if (!source.crs || source.sourceFrame === "ecef") {
    return false;
  }
  return true;
}

async function createCesium3DTileset(
  cesium: CesiumModule,
  url: string,
  options: Record<string, unknown>,
): Promise<CesiumObject> {
  const Tileset = cesium.Cesium3DTileset as
    | (CesiumConstructor & { fromUrl?: (url: string, options?: Record<string, unknown>) => Promise<CesiumObject> })
    | undefined;
  if (!Tileset) {
    throw new S100Error("adapter-lifecycle", "Cesium module does not expose 'Cesium3DTileset'.");
  }
  if (typeof Tileset.fromUrl === "function") {
    return Tileset.fromUrl(url, options);
  }
  return new Tileset({ url, ...options });
}

function applyS102TilesetStyle(
  cesium: CesiumModule,
  tileset: CesiumObject,
  spec: S102BathymetryLayerSpec,
  coordinateContext?: S102ShaderCoordinateContext,
  seaLevelMeters = 0,
  lightingFallback: S102LightingFallbackState = createDefaultS102LightingFallbackState(),
): void {
  const customShader = createS102CustomShader(cesium, spec, coordinateContext, seaLevelMeters, lightingFallback);
  if (customShader) {
    const previous = tileset.customShader;
    tileset.customShader = customShader;
    if (previous && previous !== customShader && hasFunction(previous, "destroy")) {
      destroyCesiumObject(previous);
    }
    return;
  }

  const TileStyle = cesium.Cesium3DTileStyle as CesiumConstructor | undefined;
  if (TileStyle) {
    tileset.style = new TileStyle({
      color: "color('rgba(35, 126, 205, 1.0)')",
    });
  }
}

function updateS102TilesetSeaLevel(tileset: CesiumObject, seaLevelMeters: number): boolean {
  const customShader = tileset.customShader;
  if (!customShader || typeof customShader !== "object") {
    return false;
  }

  if (hasFunction(customShader, "setUniform")) {
    try {
      customShader.setUniform?.("u_s102SeaLevel", seaLevelMeters);
      return true;
    } catch {
      return false;
    }
  }

  const uniforms = getObject(getObject(customShader, "options"), "uniforms");
  const seaLevelUniform = getObject(uniforms, "u_s102SeaLevel");
  if (seaLevelUniform) {
    seaLevelUniform.value = seaLevelMeters;
    return true;
  }
  return false;
}

function updateS102TilesetLightingFallback(
  tileset: CesiumObject,
  lightingFallback: S102LightingFallbackState,
): boolean {
  const customShader = tileset.customShader;
  if (!customShader || typeof customShader !== "object") {
    return false;
  }

  const updates: Array<readonly [string, unknown]> = [
    ["u_s102FallbackLightingEnabled", lightingFallback.enabled],
    ["u_s102FallbackAmbientIntensity", lightingFallback.ambientIntensity],
    ["u_s102FallbackDirectionalIntensity", lightingFallback.directionalIntensity],
    ["u_s102FallbackLightDirectionWC", lightingFallback.directionWC],
  ];

  if (hasFunction(customShader, "setUniform")) {
    let updated = false;
    for (const [name, value] of updates) {
      try {
        customShader.setUniform?.(name, value);
        updated = true;
      } catch {
        // Older shader instances may not have fallback uniforms.
      }
    }
    return updated;
  }

  const uniforms = getObject(getObject(customShader, "options"), "uniforms");
  if (!uniforms) {
    return false;
  }
  let updated = false;
  for (const [name, value] of updates) {
    const uniform = getObject(uniforms, name);
    if (uniform) {
      uniform.value = value;
      updated = true;
    }
  }
  return updated;
}

function createDefaultS102LightingFallbackState(): S102LightingFallbackState {
  return {
    enabled: true,
    directionWC: CESIUM_PROJECTED_LOCAL_SOUTH_LIGHT_DIRECTION,
    ambientIntensity: S102_LIGHTING_FALLBACK_AMBIENT_INTENSITY,
    directionalIntensity: S102_LIGHTING_FALLBACK_DIRECTIONAL_INTENSITY,
  };
}

function configureS102TilesetRefinement(
  cesium: CesiumModule,
  tileset: CesiumObject,
  spec: S102BathymetryLayerSpec,
): Array<() => void> {
  if (!getBooleanExtension(spec, "forceReplaceRefinement", true)) {
    return [];
  }

  const replacementRefine = getCesiumConstant(cesium, "Cesium3DTileRefine", "REPLACE") ?? 1;
  const retryOptions = getS102FailedTileRetryOptions(spec);
  forceTileReplacementRefinement(tileset.root, replacementRefine);
  retryFailedS102Tiles(tileset.root, retryOptions);

  const cleanup: Array<() => void> = [];
  cleanup.push(...forceReplacementBeforeTilesetTraversal(tileset, replacementRefine, retryOptions));
  for (const eventName of ["tileLoad", "tileVisible", "tileFailed", "initialTilesLoaded", "allTilesLoaded"]) {
    const event = tileset[eventName];
    if (!event || typeof event !== "object" || !hasFunction(event, "addEventListener")) {
      continue;
    }
    const remove = event.addEventListener?.((tile: unknown) => {
      const targetTile = isCesiumTileLike(tile) ? tile : tileset.root;
      forceTileReplacementRefinement(targetTile, replacementRefine);
      retryFailedS102Tiles(tileset.root, retryOptions);
    });
    if (typeof remove === "function") {
      cleanup.push(() => {
        remove();
      });
    }
  }
  return cleanup;
}

function forceReplacementBeforeTilesetTraversal(
  tileset: CesiumObject,
  replacementRefine: unknown,
  retryOptions: S102FailedTileRetryOptions,
): Array<() => void> {
  const originalGetTraversal = (tileset as { getTraversal?: (...args: unknown[]) => unknown }).getTraversal;
  if (typeof originalGetTraversal !== "function") {
    return [];
  }
  const getTraversal = originalGetTraversal;

  const wrappedTraversals = new WeakMap<object, CesiumObject>();
  function wrappedGetTraversal(this: CesiumObject, ...args: unknown[]): unknown {
    forceTileReplacementRefinement((this ?? tileset).root, replacementRefine);
    const traversal = getTraversal.apply(this, args);
    if (!traversal || typeof traversal !== "object" || !hasFunction(traversal, "selectTiles")) {
      return traversal;
    }
    const cached = wrappedTraversals.get(traversal);
    if (cached) {
      return cached;
    }
    const wrappedTraversal = {
      ...(traversal as Record<string, unknown>),
      selectTiles(targetTileset: CesiumObject, frameState: unknown) {
        forceTileReplacementRefinement(targetTileset.root, replacementRefine);
        retryFailedS102Tiles(targetTileset.root, retryOptions);
        const result = (traversal as { selectTiles: (...selectArgs: unknown[]) => unknown }).selectTiles.call(
          traversal,
          targetTileset,
          frameState,
        );
        pruneSelectedS102Tiles(targetTileset);
        return result;
      },
    };
    wrappedTraversals.set(traversal, wrappedTraversal);
    return wrappedTraversal;
  }

  (tileset as { getTraversal?: (...args: unknown[]) => unknown }).getTraversal = wrappedGetTraversal;
  return [
    () => {
      if ((tileset as { getTraversal?: unknown }).getTraversal === wrappedGetTraversal) {
        (tileset as { getTraversal?: (...args: unknown[]) => unknown }).getTraversal = getTraversal;
      }
    },
  ];
}

const s102FailedTileRetryState = new WeakMap<object, S102FailedTileRetryState>();

function retryFailedS102Tiles(root: unknown, options: S102FailedTileRetryOptions): void {
  if (!options.enabled || !root || typeof root !== "object") {
    return;
  }

  const now = Date.now();
  const stack: unknown[] = [root];
  const visited = new Set<unknown>();
  while (stack.length > 0) {
    const tile = stack.pop();
    if (!tile || typeof tile !== "object" || visited.has(tile)) {
      continue;
    }
    visited.add(tile);

    const children = (tile as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        stack.push(child);
      }
    }

    if (!isFailedCesiumTileContent(tile)) {
      s102FailedTileRetryState.delete(tile);
      continue;
    }

    let state = s102FailedTileRetryState.get(tile);
    if (!state) {
      state = {
        attempts: 0,
        nextRetryAt: now + retryDelayWithJitter(options.initialDelayMs, options.jitterRatio),
      };
      s102FailedTileRetryState.set(tile, state);
    }

    if (state.attempts >= options.maxAttempts || now < state.nextRetryAt) {
      continue;
    }

    if (!resetFailedCesiumTileContent(tile)) {
      continue;
    }

    const attempts = state.attempts + 1;
    s102FailedTileRetryState.set(tile, {
      attempts,
      nextRetryAt: now + retryDelayWithJitter(
        Math.min(options.initialDelayMs * 2 ** attempts, options.maxDelayMs),
        options.jitterRatio,
      ),
    });
  }
}

function isFailedCesiumTileContent(tile: unknown): boolean {
  if (!tile || typeof tile !== "object") {
    return false;
  }
  const record = tile as { contentFailed?: unknown; _contentState?: unknown };
  return record.contentFailed === true || record._contentState === CESIUM_TILE_CONTENT_STATE_FAILED;
}

function isCesiumTileLike(value: unknown): value is object {
  return Boolean(
    value &&
    typeof value === "object" &&
    ("refine" in value || "children" in value || "geometricError" in value)
  );
}

function resetFailedCesiumTileContent(tile: unknown): boolean {
  if (!tile || typeof tile !== "object") {
    return false;
  }
  try {
    if (hasFunction(tile, "unloadContent")) {
      tile.unloadContent?.();
    }
  } catch {
    return false;
  }

  if (isFailedCesiumTileContent(tile)) {
    (tile as { _content?: unknown; _contentState?: unknown })._content = undefined;
    (tile as { _contentState?: unknown })._contentState = CESIUM_TILE_CONTENT_STATE_UNLOADED;
  }
  return !isFailedCesiumTileContent(tile);
}

function retryDelayWithJitter(delayMs: number, jitterRatio: number): number {
  const normalizedDelay = Math.max(0, delayMs);
  const normalizedJitter = clampNumber(jitterRatio, 0, 1);
  if (normalizedDelay === 0 || normalizedJitter === 0) {
    return normalizedDelay;
  }
  const multiplier = 1 - normalizedJitter + Math.random() * normalizedJitter * 2;
  return Math.max(0, normalizedDelay * multiplier);
}

function getS102FailedTileRetryOptions(spec: S102BathymetryLayerSpec): S102FailedTileRetryOptions {
  return {
    enabled: getBooleanExtension(spec, "failedTileRetry", true),
    initialDelayMs: getNumberExtension(
      spec,
      "failedTileRetryInitialDelayMs",
      S102_FAILED_TILE_RETRY_INITIAL_DELAY_MS,
    ),
    maxDelayMs: getNumberExtension(spec, "failedTileRetryMaxDelayMs", S102_FAILED_TILE_RETRY_MAX_DELAY_MS),
    maxAttempts: Math.max(
      0,
      Math.floor(getNumberExtension(spec, "failedTileRetryMaxAttempts", S102_FAILED_TILE_RETRY_MAX_ATTEMPTS)),
    ),
    jitterRatio: getNumberExtension(spec, "failedTileRetryJitterRatio", S102_FAILED_TILE_RETRY_JITTER_RATIO),
  };
}

function pruneSelectedS102Tiles(tileset: CesiumObject): void {
  const selectedTiles = (tileset as { _selectedTiles?: unknown })._selectedTiles;
  if (!Array.isArray(selectedTiles) || selectedTiles.length < 2) {
    return;
  }

  const selectedSet = new Set<unknown>(selectedTiles);
  const tilesToRemove = new Set<unknown>();
  for (const tile of selectedTiles) {
    let ancestor = getParentTile(tile);
    const visitedAncestors = new Set<unknown>();
    while (ancestor && !visitedAncestors.has(ancestor)) {
      visitedAncestors.add(ancestor);
      if (selectedSet.has(ancestor)) {
        tilesToRemove.add(ancestor);
      }
      ancestor = getParentTile(ancestor);
    }
  }

  pruneSelectedOverlappingCoarseTiles(selectedTiles, tilesToRemove);

  if (tilesToRemove.size === 0) {
    return;
  }

  filterSelectedTileArray(selectedTiles, tilesToRemove);

  const selectedTilesToStyle = (tileset as { _selectedTilesToStyle?: unknown })._selectedTilesToStyle;
  if (!Array.isArray(selectedTilesToStyle) || selectedTilesToStyle.length === 0) {
    return;
  }
  filterSelectedTileArray(selectedTilesToStyle, tilesToRemove);
}

type SelectedTileBounds = {
  tile: unknown;
  sphere: BoundingSphereLike;
  geometricError: number;
};

type BoundingSphereLike = {
  center: Cartesian3Like;
  radius: number;
};

type Cartesian3Like = {
  x: number;
  y: number;
  z: number;
};

type S102FailedTileRetryOptions = {
  enabled: boolean;
  initialDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  jitterRatio: number;
};

type S102FailedTileRetryState = {
  attempts: number;
  nextRetryAt: number;
};

const S102_COARSE_TILE_STRONG_FINE_COVERAGE_RATIO = 0.35;
const S102_COARSE_TILE_THIN_FINE_COVERAGE_RATIO = 0.08;
const S102_COARSE_TILE_THIN_FINE_COVERAGE_COUNT = 2;

function pruneSelectedOverlappingCoarseTiles(selectedTiles: unknown[], tilesToRemove: Set<unknown>): void {
  const candidates = selectedTiles
    .map((tile) => createSelectedTileBounds(tile))
    .filter((tile): tile is SelectedTileBounds => tile !== null);
  if (candidates.length < 2) {
    return;
  }

  for (const coarse of candidates) {
    if (tilesToRemove.has(coarse.tile) || coarse.sphere.radius <= 0) {
      continue;
    }

    let coveredRadiusSquared = 0;
    let coveredFineTileCount = 0;
    for (const fine of candidates) {
      if (
        fine.tile === coarse.tile ||
        tilesToRemove.has(fine.tile) ||
        !isFinerTile(fine, coarse) ||
        !spheresOverlap(coarse.sphere, fine.sphere)
      ) {
        continue;
      }

      const fineCoverageRadius = Math.min(fine.sphere.radius, coarse.sphere.radius);
      if (isSameCoverageAtDifferentLod(coarse.sphere, fine.sphere)) {
        tilesToRemove.add(coarse.tile);
        break;
      }
      if (isFineTileMostlyInsideCoarseTile(coarse.sphere, fine.sphere)) {
        coveredRadiusSquared += fineCoverageRadius * fineCoverageRadius;
        coveredFineTileCount += 1;
      }
    }

    const coverageRatio = coveredRadiusSquared / (coarse.sphere.radius * coarse.sphere.radius);
    if (
      coverageRatio >= S102_COARSE_TILE_STRONG_FINE_COVERAGE_RATIO ||
      (coveredFineTileCount >= S102_COARSE_TILE_THIN_FINE_COVERAGE_COUNT &&
        coverageRatio >= S102_COARSE_TILE_THIN_FINE_COVERAGE_RATIO)
    ) {
      tilesToRemove.add(coarse.tile);
    }
  }
}

function filterSelectedTileArray(selectedTiles: unknown[], tilesToRemove: Set<unknown>): void {
  let writeIndex = 0;
  for (const tile of selectedTiles) {
    if (!tilesToRemove.has(tile)) {
      selectedTiles[writeIndex] = tile;
      writeIndex += 1;
    }
  }
  selectedTiles.length = writeIndex;
}

function createSelectedTileBounds(tile: unknown): SelectedTileBounds | null {
  if (!tile || typeof tile !== "object") {
    return null;
  }

  const geometricError = getTileGeometricError(tile);
  const sphere = getTileBoundingSphere(tile);
  if (!Number.isFinite(geometricError) || !sphere) {
    return null;
  }
  return { tile, sphere, geometricError };
}

function isFinerTile(fine: SelectedTileBounds, coarse: SelectedTileBounds): boolean {
  if (fine.geometricError < coarse.geometricError) {
    return true;
  }
  if (fine.geometricError > coarse.geometricError) {
    return false;
  }
  return getTileDepth(fine.tile) > getTileDepth(coarse.tile);
}

function isSameCoverageAtDifferentLod(coarse: BoundingSphereLike, fine: BoundingSphereLike): boolean {
  return (
    fine.radius >= coarse.radius * 0.75 &&
    distanceBetweenCartesian3(coarse.center, fine.center) <= coarse.radius * 0.35
  );
}

function isFineTileMostlyInsideCoarseTile(coarse: BoundingSphereLike, fine: BoundingSphereLike): boolean {
  const distance = distanceBetweenCartesian3(coarse.center, fine.center);
  return distance + fine.radius <= coarse.radius * 1.2;
}

function spheresOverlap(a: BoundingSphereLike, b: BoundingSphereLike): boolean {
  return distanceBetweenCartesian3(a.center, b.center) <= a.radius + b.radius;
}

function distanceBetweenCartesian3(a: Cartesian3Like, b: Cartesian3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getTileGeometricError(tile: unknown): number {
  if (!tile || typeof tile !== "object") {
    return Number.NaN;
  }
  const record = tile as Record<string, unknown>;
  for (const key of ["geometricError", "_geometricError"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return Number.NaN;
}

function getTileDepth(tile: unknown): number {
  if (!tile || typeof tile !== "object") {
    return 0;
  }
  const depth = (tile as { _depth?: unknown })._depth;
  return typeof depth === "number" && Number.isFinite(depth) ? depth : 0;
}

function getTileBoundingSphere(tile: unknown): BoundingSphereLike | null {
  if (!tile || typeof tile !== "object") {
    return null;
  }

  for (const sphere of [
    getObject(tile, "boundingSphere"),
    getObject(tile, "_boundingSphere"),
    getObject(getObject(tile, "boundingVolume"), "boundingSphere"),
    getObject(getObject(tile, "boundingVolume"), "boundingVolume"),
    getObject(getObject(tile, "contentBoundingVolume"), "boundingSphere"),
    getObject(getObject(tile, "_contentBoundingVolume"), "boundingSphere"),
  ]) {
    const normalized = normalizeBoundingSphere(sphere);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function normalizeBoundingSphere(sphere: CesiumObject | null): BoundingSphereLike | null {
  if (!sphere) {
    return null;
  }
  const center = normalizeCartesian3(getObject(sphere, "center"));
  const radius = sphere.radius;
  if (!center || typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0) {
    return null;
  }
  return { center, radius };
}

function normalizeCartesian3(value: CesiumObject | null): Cartesian3Like | null {
  if (!value) {
    return null;
  }
  const { x, y, z } = value as { x?: unknown; y?: unknown; z?: unknown };
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    return null;
  }
  return { x, y, z };
}

function getParentTile(tile: unknown): unknown {
  if (!tile || typeof tile !== "object") {
    return undefined;
  }
  return (tile as { parent?: unknown; _parent?: unknown }).parent ?? (tile as { _parent?: unknown })._parent;
}

function forceTileReplacementRefinement(tile: unknown, replacementRefine: unknown, visited = new Set<unknown>()): void {
  if (!tile || typeof tile !== "object" || visited.has(tile)) {
    return;
  }
  visited.add(tile);
  try {
    (tile as { refine?: unknown }).refine = replacementRefine;
  } catch {
    return;
  }
  const children = (tile as { children?: unknown }).children;
  if (!Array.isArray(children)) {
    return;
  }
  for (const child of children) {
    forceTileReplacementRefinement(child, replacementRefine, visited);
  }
}

function createS102CustomShader(
  cesium: CesiumModule,
  spec: S102BathymetryLayerSpec,
  coordinateContext: S102ShaderCoordinateContext = {
    useProjectedLocalWorldHeight: false,
    projectedLocalOriginZ: 0,
  },
  seaLevelMeters = 0,
  lightingFallback: S102LightingFallbackState = createDefaultS102LightingFallbackState(),
): CesiumObject | null {
  const CustomShader = cesium.CustomShader as CesiumConstructor | undefined;
  const UniformType = cesium.UniformType as Record<string, unknown> | undefined;
  const VaryingType = cesium.VaryingType as Record<string, unknown> | undefined;
  if (!CustomShader || !UniformType?.FLOAT || !UniformType.BOOL || !UniformType.VEC3 || !VaryingType?.FLOAT) {
    return null;
  }
  if (coordinateContext.useProjectedLocalWorldHeight && !UniformType.MAT4) {
    return null;
  }

  const style = spec.style;
  const opacity = clamp01(spec.opacity ?? style?.opacity ?? 1);
  const heightCoordinate = getS102HeightCoordinate(spec);
  const CustomShaderMode = cesium.CustomShaderMode as Record<string, unknown> | undefined;
  const CustomShaderTranslucencyMode = cesium.CustomShaderTranslucencyMode as Record<string, unknown> | undefined;
  const LightingModel = cesium.LightingModel as Record<string, unknown> | undefined;
  return new CustomShader({
    mode: CustomShaderMode?.MODIFY_MATERIAL,
    lightingModel: LightingModel?.PBR,
    translucencyMode: opacity < 1
      ? CustomShaderTranslucencyMode?.TRANSLUCENT
      : CustomShaderTranslucencyMode?.OPAQUE,
    varyings: {
      v_s102Height: VaryingType.FLOAT,
    },
    uniforms: {
      u_s102SeaLevel: {
        type: UniformType.FLOAT,
        value: finiteNumber(seaLevelMeters, 0),
      },
      u_s102UnsafeDepth: {
        type: UniformType.FLOAT,
        value: finiteNumber(style?.unsafeDepth, 0),
      },
      u_s102ContourInterval: {
        type: UniformType.FLOAT,
        value: Math.max(0.05, finiteNumber(style?.contours?.intervalMeters, 5)),
      },
      u_s102ShowContours: {
        type: UniformType.BOOL,
        value: style?.contours?.visible ?? false,
      },
      u_s102Opacity: {
        type: UniformType.FLOAT,
        value: opacity,
      },
      u_s102HeightAxis: {
        type: UniformType.FLOAT,
        value: heightCoordinate.axisIndex,
      },
      u_s102HeightSign: {
        type: UniformType.FLOAT,
        value: heightCoordinate.sign,
      },
      u_s102UseProjectedLocalWorldHeight: {
        type: UniformType.BOOL,
        value: coordinateContext.useProjectedLocalWorldHeight,
      },
      ...(UniformType.MAT4
        ? {
            u_s102WorldToProjectedLocal: {
              type: UniformType.MAT4,
              value: coordinateContext.worldToProjectedLocalMatrix ?? createIdentityMatrix4(cesium),
            },
          }
        : {}),
      u_s102ProjectedLocalOriginZ: {
        type: UniformType.FLOAT,
        value: coordinateContext.projectedLocalOriginZ,
      },
      u_s102FallbackLightingEnabled: {
        type: UniformType.BOOL,
        value: lightingFallback.enabled,
      },
      u_s102FallbackAmbientIntensity: {
        type: UniformType.FLOAT,
        value: lightingFallback.ambientIntensity,
      },
      u_s102FallbackDirectionalIntensity: {
        type: UniformType.FLOAT,
        value: lightingFallback.directionalIntensity,
      },
      u_s102FallbackLightDirectionWC: {
        type: UniformType.VEC3,
        value: lightingFallback.directionWC,
      },
    },
    vertexShaderText: S102_CUSTOM_SHADER_VERTEX,
    fragmentShaderText: S102_CUSTOM_SHADER_FRAGMENT,
  });
}

const S102_CUSTOM_SHADER_VERTEX = `
float s102HeightFromModelPosition(vec3 positionMC)
{
    if (u_s102UseProjectedLocalWorldHeight) {
        mat4 modelToProjectedLocal = u_s102WorldToProjectedLocal * czm_model;
        vec3 projectedLocal = (modelToProjectedLocal * vec4(positionMC, 1.0)).xyz;
        return projectedLocal.z + u_s102ProjectedLocalOriginZ;
    }

    float height = positionMC.z;
    if (u_s102HeightAxis < 0.5) {
        height = positionMC.x;
    } else if (u_s102HeightAxis < 1.5) {
        height = positionMC.y;
    }
    return height * u_s102HeightSign;
}

void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput)
{
    v_s102Height = s102HeightFromModelPosition(vsInput.attributes.positionMC);
}
`;

const S102_CUSTOM_SHADER_FRAGMENT = `
vec3 s100TerrainElevationColor(float elevation) {
    if (elevation > 0.0) {
        return vec3(1.0, 1.0, 1.0);
    } else if (elevation > -1.0) {
        return vec3(0.447, 0.667, 0.608);
    } else if (elevation > -5.0) {
        return vec3(0.478, 0.702, 0.976);
    } else if (elevation > -10.0) {
        return vec3(0.584, 0.776, 0.97656);
    } else if (elevation > -20.0) {
        return vec3(0.706, 0.839, 0.969);
    }
    return vec3(0.827, 0.918, 0.984);
}

float s100TerrainContourLine(float elevation, float interval, vec3 positionEC) {
    if (interval <= 0.0) {
        return 0.0;
    }

    float contourCoord = elevation / interval;
    float lineDistance = abs(fract(contourCoord - 0.5) - 0.5);
    float lineWidth = max(fwidth(contourCoord), 0.00001);
    float line = 1.0 - min(lineDistance / lineWidth, 1.0);
    float viewDistance = max(length(positionEC), 1.0);
    float fade = 1.0 - smoothstep(750.0, 3250.0, viewDistance);
    return clamp(line * fade, 0.0, 1.0);
}

vec3 s100TerrainFallbackNormalEC(vec3 positionEC) {
    vec3 dx = dFdx(positionEC);
    vec3 dy = dFdy(positionEC);
    vec3 normalEC = normalize(cross(dx, dy));
    vec3 viewDirectionEC = normalize(-positionEC);
    if (dot(normalEC, viewDirectionEC) < 0.0) {
        normalEC = -normalEC;
    }
    return normalEC;
}

vec3 s100ApplyTerrainFallbackLighting(vec3 color, vec3 positionEC) {
    if (!u_s102FallbackLightingEnabled) {
        return color;
    }

    vec3 normalEC = s100TerrainFallbackNormalEC(positionEC);
    vec3 lightDirectionEC = normalize(czm_viewRotation * normalize(u_s102FallbackLightDirectionWC));
    float directional = max(dot(normalEC, -lightDirectionEC), 0.0);
    float intensity = max(0.0, u_s102FallbackAmbientIntensity) +
        max(0.0, u_s102FallbackDirectionalIntensity) * directional;
    return color * clamp(intensity, 0.18, 1.65);
}

void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    float height = v_s102Height;
    vec3 bathyColor = s100TerrainElevationColor(height);

    if (u_s102ShowContours) {
        float contour = s100TerrainContourLine(height, max(0.0, u_s102ContourInterval), fsInput.attributes.positionEC);
        bathyColor = mix(bathyColor, vec3(0.0, 0.0, 0.0), contour);
    }

    if (height - u_s102SeaLevel > u_s102UnsafeDepth && height < 0.0) {
        bathyColor = mix(bathyColor, vec3(1.0, 0.0, 0.0), 0.6);
    }

    bathyColor = s100ApplyTerrainFallbackLighting(bathyColor, fsInput.attributes.positionEC);
    if (u_s102FallbackLightingEnabled) {
        material.normalEC = s100TerrainFallbackNormalEC(fsInput.attributes.positionEC);
        material.emissive = bathyColor * 0.32;
    }

    material.diffuse = bathyColor;
    material.alpha = u_s102Opacity;
    material.roughness = 0.8;
}
`;

function getS102HeightCoordinate(spec: S102BathymetryLayerSpec): S102HeightCoordinate {
  const configuredAxis =
    getExtension<{ axis?: unknown; sign?: unknown }>(spec, "cesium", "heightCoordinate")?.axis ??
    getExtension<{ axis?: unknown; sign?: unknown }>(spec, "nasaAmmos", "heightCoordinate")?.axis ??
    getExtension<unknown>(spec, "cesium", "heightAxis") ??
    getExtension<unknown>(spec, "nasaAmmos", "heightAxis") ??
    spec.source.metadata?.values?.heightAxis;
  const configured =
    getExtension<{ axis?: unknown; sign?: unknown }>(spec, "cesium", "heightCoordinate") ??
    getExtension<{ axis?: unknown; sign?: unknown }>(spec, "nasaAmmos", "heightCoordinate");
  const axis = parseS102HeightAxis(
    configuredAxis,
  ) ?? "y";

  const defaultSign = parseS102HeightAxisSign(configuredAxis) ?? 1;
  const sign = parseS102HeightSign(
    configured?.sign ??
      getExtension<unknown>(spec, "cesium", "heightSign") ??
      getExtension<unknown>(spec, "nasaAmmos", "heightSign") ??
      spec.source.metadata?.values?.heightSign,
    defaultSign,
  );

  return {
    axisIndex: axis === "x" ? 0 : axis === "y" ? 1 : 2,
    sign,
  };
}

function parseS102HeightAxisSign(value: unknown): 1 | -1 | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (/^-[xyz]$/u.test(normalized)) {
    return -1;
  }
  if (/^\+[xyz]$/u.test(normalized)) {
    return 1;
  }
  return null;
}

function parseS102HeightAxis(value: unknown): "x" | "y" | "z" | null {
  if (value === 0 || value === "0") {
    return "x";
  }
  if (value === 1 || value === "1") {
    return "y";
  }
  if (value === 2 || value === "2") {
    return "z";
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "x" || normalized === "-x") {
    return "x";
  }
  if (normalized === "y" || normalized === "-y") {
    return "y";
  }
  if (normalized === "z" || normalized === "-z") {
    return "z";
  }
  return null;
}

function parseS102HeightSign(value: unknown, fallback: 1 | -1): 1 | -1 {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 0 ? -1 : 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "-1" || normalized === "-" || normalized === "negative" || normalized === "inverted") {
      return -1;
    }
    if (normalized === "1" || normalized === "+" || normalized === "positive") {
      return 1;
    }
    if (normalized.startsWith("-")) {
      return -1;
    }
  }
  return fallback;
}

function createWmsParameters(source: WmsSource): Record<string, string | number | boolean> {
  return {
    service: "WMS",
    request: "GetMap",
    version: source.version ?? "1.3.0",
    format: source.format ?? "image/png",
    transparent: source.transparent ?? true,
    styles: source.styles?.join(",") ?? "",
    ...(source.crs !== undefined ? { crs: source.crs } : {}),
    ...source.parameters,
  };
}

function createWmsUrlTemplate(source: WmsSource): string {
  const params = new URLSearchParams();
  params.set("SERVICE", "WMS");
  params.set("REQUEST", "GetMap");
  params.set("VERSION", source.version ?? "1.3.0");
  params.set("LAYERS", source.layers.join(","));
  params.set("STYLES", source.styles?.join(",") ?? "");
  params.set("FORMAT", source.format ?? "image/png");
  params.set("TRANSPARENT", String(source.transparent ?? true));
  params.set(source.version === "1.1.1" ? "SRS" : "CRS", source.crs ?? "EPSG:3857");
  params.set("WIDTH", "256");
  params.set("HEIGHT", "256");
  params.set("BBOX", "{xmin},{ymin},{xmax},{ymax}");
  for (const [key, value] of Object.entries(source.parameters ?? {})) {
    params.set(key, String(value));
  }
  return appendQuery(source.url, params)
    .replaceAll("%7B", "{")
    .replaceAll("%7D", "}")
    .replaceAll("%2C", ",");
}

function appendQuery(url: string, params: URLSearchParams): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${params.toString()}`;
}

function stripQuery(url: string): string {
  return url.split("?")[0] ?? url;
}

function fillWmsTemplate(
  template: string,
  extent: Required<Pick<SpatialExtent, "minX" | "minY" | "maxX" | "maxY">>,
  width: number,
  height: number,
): string {
  return template
    .replaceAll("{xmin}", String(extent.minX))
    .replaceAll("{ymin}", String(extent.minY))
    .replaceAll("{xmax}", String(extent.maxX))
    .replaceAll("{ymax}", String(extent.maxY))
    .replaceAll("%7Bxmin%7D", String(extent.minX))
    .replaceAll("%7Bymin%7D", String(extent.minY))
    .replaceAll("%7Bxmax%7D", String(extent.maxX))
    .replaceAll("%7Bymax%7D", String(extent.maxY))
    .replace(/([?&]WIDTH=)[^&]*/iu, `$1${width}`)
    .replace(/([?&]HEIGHT=)[^&]*/iu, `$1${height}`);
}

function getPositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeProjectedExtent(
  extent: SpatialExtent,
): Required<Pick<SpatialExtent, "minX" | "minY" | "maxX" | "maxY">> {
  if (
    extent.minX === undefined ||
    extent.minY === undefined ||
    extent.maxX === undefined ||
    extent.maxY === undefined
  ) {
    throw new S100Error(
      "invalid-layer-spec",
      "Projected WMS single-tile imagery requires minX/minY/maxX/maxY spatial extent.",
      extent,
    );
  }
  return {
    minX: extent.minX,
    minY: extent.minY,
    maxX: extent.maxX,
    maxY: extent.maxY,
  };
}

function sameCrs(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").toUpperCase() === (right ?? "").toUpperCase();
}

function projectedExtentsOverlap(left: SpatialExtent, right: SpatialExtent): boolean {
  return !(
    (left.maxX ?? Number.NEGATIVE_INFINITY) <= (right.minX ?? Number.POSITIVE_INFINITY) ||
    (left.minX ?? Number.POSITIVE_INFINITY) >= (right.maxX ?? Number.NEGATIVE_INFINITY) ||
    (left.maxY ?? Number.NEGATIVE_INFINITY) <= (right.minY ?? Number.POSITIVE_INFINITY) ||
    (left.minY ?? Number.POSITIVE_INFINITY) >= (right.maxY ?? Number.NEGATIVE_INFINITY)
  );
}

function subtractProjectedExtent(outer: SpatialExtent, cutout: SpatialExtent): SpatialExtent[] {
  if (!projectedExtentsOverlap(outer, cutout)) {
    return [outer];
  }
  const minX = outer.minX ?? 0;
  const minY = outer.minY ?? 0;
  const maxX = outer.maxX ?? 0;
  const maxY = outer.maxY ?? 0;
  const cutMinX = clampNumber(cutout.minX ?? minX, minX, maxX);
  const cutMaxX = clampNumber(cutout.maxX ?? maxX, minX, maxX);
  const cutMinY = clampNumber(cutout.minY ?? minY, minY, maxY);
  const cutMaxY = clampNumber(cutout.maxY ?? maxY, minY, maxY);
  const middleMinX = Math.max(minX, cutMinX);
  const middleMaxX = Math.min(maxX, cutMaxX);
  const pieces: SpatialExtent[] = [
    createProjectedExtentPiece(outer, minX, minY, cutMinX, maxY),
    createProjectedExtentPiece(outer, cutMaxX, minY, maxX, maxY),
    createProjectedExtentPiece(outer, middleMinX, minY, middleMaxX, cutMinY),
    createProjectedExtentPiece(outer, middleMinX, cutMaxY, middleMaxX, maxY),
  ];
  return pieces.filter((piece) =>
    (piece.maxX ?? 0) > (piece.minX ?? 0) &&
    (piece.maxY ?? 0) > (piece.minY ?? 0),
  );
}

function createProjectedExtentPiece(
  template: SpatialExtent,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): SpatialExtent {
  return {
    ...(template.crs !== undefined ? { crs: template.crs } : {}),
    minX,
    minY,
    maxX,
    maxY,
  };
}

function projectedExtentToRectangle(
  cesium: CesiumModule,
  extent: Required<Pick<SpatialExtent, "minX" | "minY" | "maxX" | "maxY">>,
  crs: string,
): CesiumObject {
  const [west, south] = projectedToLonLat(crs, extent.minX, extent.minY);
  const [east, north] = projectedToLonLat(crs, extent.maxX, extent.maxY);
  const Rectangle = cesium.Rectangle as
    | { fromDegrees?: (west: number, south: number, east: number, north: number) => CesiumObject }
    | undefined;
  if (Rectangle?.fromDegrees) {
    return Rectangle.fromDegrees(west, south, east, north);
  }
  return { west, south, east, north };
}

async function loadJsonSource(
  source: RestJsonSource | StaticJsonSource,
  fetchHandler: FetchLike | undefined,
): Promise<unknown> {
  if (source.kind === "static-json") {
    return source.data;
  }

  const fetchImpl = fetchHandler ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new S100Error("invalid-layer-spec", "A fetch implementation is required for REST JSON sources.");
  }

  const init: RequestInit = { method: source.method ?? "GET" };
  if (source.headers !== undefined) {
    init.headers = source.headers;
  }
  if (source.body !== undefined) {
    init.body = JSON.stringify(source.body);
  }
  if (source.credentials !== undefined) {
    init.credentials = source.credentials;
  }

  const response = await fetchImpl(appendRestQuery(source.url, source.query), init);
  if (!response.ok) {
    throw new S100Error(
      "invalid-layer-spec",
      `Failed to load REST JSON source '${source.url}': ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function appendRestQuery(
  url: string,
  query: Record<string, string | number | boolean> | undefined,
): string {
  if (!query || Object.keys(query).length === 0) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }
  return `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
}

function resolveWaterLevel(data: unknown, time: Date): number | null {
  if (typeof data === "number" && Number.isFinite(data)) {
    return data;
  }
  if (!data || typeof data !== "object") {
    return null;
  }

  const direct = getNumericProperty(data, ["waterLevelMeters", "seaLevel", "value", "height"]);
  if (direct !== null) {
    return direct;
  }

  const records = getRecordArray(data);
  if (!records) {
    return null;
  }

  let best: { value: number; delta: number } | null = null;
  const target = time.getTime();
  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }
    const value = getNumericProperty(record, ["waterLevelMeters", "seaLevel", "value", "height"]);
    if (value === null) {
      continue;
    }
    const recordTime = getRecordTime(record);
    const delta = recordTime === null ? 0 : Math.abs(recordTime - target);
    if (!best || delta < best.delta) {
      best = { value, delta };
    }
  }
  return best?.value ?? null;
}

function getRecordArray(data: object): unknown[] | null {
  for (const key of ["records", "values", "timeSeries", "features"]) {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
}

function getNumericProperty(data: object, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function getRecordTime(data: object): number | null {
  for (const key of ["time", "dateTime", "timestamp", "datetime"]) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function extractS111RenderData(data: unknown, time: Date, maxEntityCount: number): S111RenderData {
  if (!data || typeof data !== "object") {
    return createS111RenderData([]);
  }
  const dataset = data as Record<string, unknown>;
  const positions = parseS111Positions(getArrayProperty(dataset, ["positions", "Positions"]));
  const records = getArrayProperty(dataset, ["data", "Data"]);
  if (positions.length === 0 || !records) {
    return createS111RenderData(
      extractGeoJsonVectorSamples(dataset, maxEntityCount),
      getS111GridSize(dataset, []),
    );
  }

  const record = getS111RecordForTime(dataset, records, time);
  const speed = getNumericArrayProperty(record, [
    "speed",
    "Speed",
    "surfaceCurrentSpeed",
    "surface_current_speed",
    "surfaceCurrentSpeedValues",
  ]);
  const direction = getNumericArrayProperty(record, [
    "direction",
    "Direction",
    "surfaceCurrentDirection",
    "surface_current_direction",
    "surfaceCurrentDirectionValues",
  ]);
  const rawSpeedRange = getS111RawSpeedRange(records);
  const speedKnotsScale = inferS111SpeedKnotsScale(rawSpeedRange.max);
  const step = Math.max(1, Math.ceil(positions.length / maxEntityCount));
  const samples: S111Sample[] = [];
  for (let index = 0; index < positions.length; index += step) {
    const position = positions[index];
    const sampleSpeed = Number(speed?.[index]);
    const sampleDirection = Number(direction?.[index]);
    if (
      position &&
      isValidS111Speed(sampleSpeed) &&
      isValidS111Direction(sampleDirection)
    ) {
      samples.push({
        position: [position[0], position[1]],
        speedKnots: sampleSpeed * speedKnotsScale,
        directionDegrees: sampleDirection,
      });
    }
  }
  return {
    samples,
    minSpeedKnots: rawSpeedRange.min * speedKnotsScale,
    maxSpeedKnots: rawSpeedRange.max * speedKnotsScale,
    gridSizeMeters: getS111GridSize(dataset, positions),
  };
}

function getS111RecordForTime(
  dataset: Record<string, unknown>,
  records: unknown[],
  time: Date,
): Record<string, unknown> {
  const nearestTimedRecord = getNearestS111TimedRecord(records, time);
  if (nearestTimedRecord) {
    return nearestTimedRecord;
  }

  const start = parseS111Time(dataset.dateTimeOfFirstRecord ?? dataset.FirstRecordTimestamp) ?? 0;
  const intervalSeconds = Number(dataset.timeRecordInterval ?? dataset.TimeRecordInterval);
  const intervalMs = Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds * 1000 : 1;
  const index = Math.max(0, Math.min(records.length - 1, Math.round((time.getTime() - start) / intervalMs)));
  const record = records[index];
  return record && typeof record === "object" ? (record as Record<string, unknown>) : {};
}

function parseS111Time(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.includes("T")
    ? value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u, "$1-$2-$3T$4:$5:$6Z")
    : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNearestS111TimedRecord(records: unknown[], time: Date): Record<string, unknown> | null {
  let best: { record: Record<string, unknown>; delta: number } | null = null;
  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }
    const recordObject = record as Record<string, unknown>;
    const recordTime = parseS111Time(
      recordObject.time ??
        recordObject.dateTime ??
        recordObject.timestamp ??
        recordObject.Timestamp ??
        recordObject.FromTime,
    );
    if (recordTime === null) {
      continue;
    }
    const delta = Math.abs(time.getTime() - recordTime);
    if (!best || delta < best.delta) {
      best = { record: recordObject, delta };
    }
  }
  return best?.record ?? null;
}

function getArrayProperty(data: Record<string, unknown>, keys: readonly string[]): unknown[] | null {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
}

function getNumericArrayProperty(data: Record<string, unknown>, keys: readonly string[]): unknown[] | null {
  return getArrayProperty(data, keys);
}

function parseS111Positions(value: unknown[] | null): Array<[number, number]> {
  if (!value) {
    return [];
  }
  if (value.every((entry) => typeof entry === "number")) {
    const positions: Array<[number, number]> = [];
    for (let index = 0; index < value.length - 1; index += 2) {
      const x = normalizeFiniteS111Number(value[index]);
      const y = normalizeFiniteS111Number(value[index + 1]);
      if (x !== null && y !== null) {
        positions.push([x, y]);
      }
    }
    return positions;
  }

  const positions: Array<[number, number]> = [];
  for (const entry of value) {
    const position = parseS111Position(entry);
    if (position) {
      positions.push(position);
    }
  }
  return positions;
}

function parseS111Position(value: unknown): [number, number] | null {
  if (Array.isArray(value)) {
    const x = normalizeFiniteS111Number(value[0]);
    const y = normalizeFiniteS111Number(value[1]);
    return x !== null && y !== null ? [x, y] : null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const x =
    normalizeFiniteS111Number(record.x) ??
    normalizeFiniteS111Number(record.easting) ??
    normalizeFiniteS111Number(record.Easting);
  const y =
    normalizeFiniteS111Number(record.y) ??
    normalizeFiniteS111Number(record.northing) ??
    normalizeFiniteS111Number(record.Northing);
  return x !== null && y !== null ? [x, y] : null;
}

function normalizeFiniteS111Number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractGeoJsonVectorSamples(dataset: Record<string, unknown>, maxEntityCount: number): S111Sample[] {
  const features = Array.isArray(dataset.features) ? dataset.features : [];
  const step = Math.max(1, Math.ceil(features.length / maxEntityCount));
  const samples: S111Sample[] = [];
  for (let index = 0; index < features.length; index += step) {
    const feature = features[index];
    if (!feature || typeof feature !== "object") {
      continue;
    }
    const geometry = (feature as Record<string, unknown>).geometry;
    const properties = (feature as Record<string, unknown>).properties;
    if (!geometry || typeof geometry !== "object" || !properties || typeof properties !== "object") {
      continue;
    }
    const coordinates = (geometry as Record<string, unknown>).coordinates;
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") {
      continue;
    }
    const speed = getNumericProperty(properties, ["speed", "speedMetersPerSecond", "surfaceCurrentSpeed"]);
    const direction = getNumericProperty(properties, ["direction", "directionDegrees", "surfaceCurrentDirection"]);
    if (speed !== null && direction !== null && isValidS111Speed(speed) && isValidS111Direction(direction)) {
      samples.push({
        position: [coordinates[0], coordinates[1]],
        speedKnots: speed,
        directionDegrees: direction,
      });
    }
  }
  return samples;
}

function createS111RenderData(samples: S111Sample[], gridSizeMeters = 0): S111RenderData {
  let minSpeedKnots = Number.POSITIVE_INFINITY;
  let maxSpeedKnots = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample.speedKnots) || sample.speedKnots < 0) {
      continue;
    }
    minSpeedKnots = Math.min(minSpeedKnots, sample.speedKnots);
    maxSpeedKnots = Math.max(maxSpeedKnots, sample.speedKnots);
  }
  return {
    samples,
    minSpeedKnots: Number.isFinite(minSpeedKnots) ? minSpeedKnots : 0,
    maxSpeedKnots,
    gridSizeMeters,
  };
}

function getS111RawSpeedRange(records: unknown[]): { min: number; max: number } {
  let minSpeed = Number.POSITIVE_INFINITY;
  let maxSpeed = 0;
  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }
    const speed = getNumericArrayProperty(record as Record<string, unknown>, [
      "speed",
      "Speed",
      "surfaceCurrentSpeed",
      "surface_current_speed",
      "surfaceCurrentSpeedValues",
    ]);
    for (const value of speed ?? []) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        continue;
      }
      minSpeed = Math.min(minSpeed, numeric);
      maxSpeed = Math.max(maxSpeed, numeric);
    }
  }
  return {
    min: Number.isFinite(minSpeed) ? minSpeed : 0,
    max: maxSpeed,
  };
}

function inferS111SpeedKnotsScale(rawMaxSpeed: number): number {
  if (!Number.isFinite(rawMaxSpeed) || rawMaxSpeed <= 0) {
    return 1;
  }
  return rawMaxSpeed > S111_SPEED_LEGEND_MAX_KNOTS
    ? CENTIMETERS_PER_SECOND_TO_KNOTS
    : 1;
}

function getS111GridSize(
  dataset: Record<string, unknown>,
  positions: readonly (readonly [number, number])[],
): number {
  const explicitGridSize =
    normalizeFiniteS111Number(dataset.gridSize) ??
    normalizeFiniteS111Number(dataset.GridSize);
  if (explicitGridSize !== null && explicitGridSize > 0) {
    return explicitGridSize;
  }

  if (positions.length < 2) {
    return 0;
  }

  const nearestDistances: number[] = [];
  const sampledCount = Math.min(positions.length, 128);
  const stride = Math.max(1, Math.floor(positions.length / sampledCount));
  for (
    let positionIndex = 0;
    positionIndex < positions.length && nearestDistances.length < sampledCount;
    positionIndex += stride
  ) {
    const position = positions[positionIndex];
    if (!position) {
      continue;
    }
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let candidateIndex = 0; candidateIndex < positions.length; candidateIndex += 1) {
      if (candidateIndex === positionIndex) {
        continue;
      }
      const candidate = positions[candidateIndex];
      if (!candidate) {
        continue;
      }
      const distance = Math.hypot(position[0] - candidate[0], position[1] - candidate[1]);
      if (distance > 0 && distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
    if (Number.isFinite(nearestDistance)) {
      nearestDistances.push(nearestDistance);
    }
  }

  nearestDistances.sort((a, b) => a - b);
  return nearestDistances[Math.floor(nearestDistances.length / 2)] ?? 0;
}

function isValidS111Speed(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isValidS111Direction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 360;
}

function s111ArrowLengthMeters(speedKnots: number, spec: S111SurfaceCurrentLayerSpec): number {
  const scale = spec.style?.scale ?? spec.style?.speedScale;
  const numericScale = typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 250;
  const scaledLength = getExplicitS111ArrowScaleMeters(speedKnots, numericScale);
  return Math.max(30, numericScale * 0.12, Number.isFinite(scaledLength) ? scaledLength : 30);
}

function s111ArrowScaleMeters(
  speedKnots: number,
  spec: S111SurfaceCurrentLayerSpec,
  renderData: S111RenderData,
): number {
  const scale = spec.style?.scale ?? spec.style?.speedScale;
  const explicitScale = typeof scale === "number" && Number.isFinite(scale) && scale > 0
    ? scale
    : null;
  if (explicitScale !== null && explicitScale > 1) {
    const scaled = getExplicitS111ArrowScaleMeters(speedKnots, explicitScale);
    return Number.isFinite(scaled) && scaled > 0 ? scaled : 30;
  }

  const gridScale = renderData.gridSizeMeters > 0
    ? renderData.gridSizeMeters * S111_ARROW_MAX_LOCAL_SPACING_FACTOR
    : 250;
  const baseScale = explicitScale !== null
    ? Math.min(explicitScale, gridScale)
    : gridScale;
  const speedScale = getS111SpeedScaleFactor(speedKnots, renderData);
  const scaled = baseScale * speedScale;
  return Number.isFinite(scaled) && scaled > 0 ? scaled : 30;
}

function getExplicitS111ArrowScaleMeters(speedKnots: number, maxScaleMeters: number): number {
  if (!Number.isFinite(speedKnots) || speedKnots < 0) {
    return 0;
  }
  return maxScaleMeters * getExplicitS111SpeedScaleFactor(speedKnots);
}

function getExplicitS111SpeedScaleFactor(speedKnots: number): number {
  const normalized = clampNumber(
    speedKnots / S111_ARROW_EXPLICIT_REFERENCE_SPEED_KNOTS,
    0,
    1,
  );
  return lerpNumber(
    S111_ARROW_MIN_SPEED_SCALE,
    S111_ARROW_EXPLICIT_MAX_SPEED_SCALE,
    normalized,
  );
}

function getS111SpeedScaleFactor(speedKnots: number, renderData: S111RenderData): number {
  if (!Number.isFinite(speedKnots) || speedKnots < 0) {
    return 0;
  }
  if (renderData.maxSpeedKnots <= renderData.minSpeedKnots) {
    return S111_ARROW_MAX_SPEED_SCALE;
  }
  const normalized = clampNumber(
    (speedKnots - renderData.minSpeedKnots) /
      (renderData.maxSpeedKnots - renderData.minSpeedKnots),
    0,
    1,
  );
  return lerpNumber(S111_ARROW_MIN_SPEED_SCALE, S111_ARROW_MAX_SPEED_SCALE, normalized);
}

function getS111SpeedColor(speedKnots: number): readonly [number, number, number] {
  const lastBand = S111_SPEED_COLOR_BANDS[S111_SPEED_COLOR_BANDS.length - 1];
  for (const band of S111_SPEED_COLOR_BANDS) {
    if (!band || speedKnots > band[0]) {
      continue;
    }
    return [band[1], band[2], band[3]];
  }
  return [
    lastBand?.[1] ?? 1,
    lastBand?.[2] ?? 1,
    lastBand?.[3] ?? 1,
  ];
}

function offsetProjectedVector(
  x: number,
  y: number,
  directionDegrees: number,
  lengthMeters: number,
): { x: number; y: number } {
  const radians = (directionDegrees * Math.PI) / 180;
  return {
    x: x + Math.sin(radians) * lengthMeters,
    y: y + Math.cos(radians) * lengthMeters,
  };
}

function shouldUseProjectedLocalWorldHeight(spec: S102BathymetryLayerSpec): boolean {
  const heightCoordinate = getExtension<{ source?: unknown }>(spec, "cesium", "heightCoordinate");
  const source =
    heightCoordinate?.source ??
    getExtension<unknown>(spec, "cesium", "heightSource") ??
    spec.source.metadata?.values?.heightSource;
  if (typeof source !== "string") {
    return true;
  }
  const normalized = source.trim().toLowerCase();
  if (
    normalized === "model-local" ||
    normalized === "tile-local" ||
    normalized === "local-model" ||
    normalized === "local-tile"
  ) {
    return false;
  }
  return true;
}

function offsetCoordinate(coordinate: Coordinate, offset: Vector3Fields, projectedCrs: string): Coordinate {
  if (coordinate.kind === "projected") {
    return {
      ...coordinate,
      x: coordinate.x + offset.x,
      y: coordinate.y + offset.y,
      z: (coordinate.z ?? 0) + offset.z,
    };
  }

  if (coordinate.kind === "engine-local") {
    return {
      ...coordinate,
      x: coordinate.x + offset.x,
      y: coordinate.y + offset.y,
      z: coordinate.z + offset.z,
    };
  }

  if (coordinate.kind === "geodetic") {
    const [x, y] = lonLatToProjected(projectedCrs, coordinate.lon, coordinate.lat);
    const [lon, lat] = projectedToLonLat(projectedCrs, x + offset.x, y + offset.y);
    return {
      ...coordinate,
      lon,
      lat,
      height: (coordinate.height ?? 0) + offset.z,
    };
  }

  return {
    ...coordinate,
    x: coordinate.x + offset.x,
    y: coordinate.y + offset.y,
    z: coordinate.z + offset.z,
  };
}

function rotateHeadingOffset(x: number, y: number, headingDegrees: number): { x: number; y: number } {
  const radians = (headingDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos + y * sin,
    y: -x * sin + y * cos,
  };
}

function getVesselTransformControlMode(spec: VesselLayerSpec): "none" | "translate" | "rotate" | "translate-rotate" {
  const gizmo = spec.style?.transformGizmo;
  if (gizmo && typeof gizmo === "object" && gizmo.mode) {
    return gizmo.mode;
  }
  return spec.style?.transformControls ?? "translate-rotate";
}

function getVesselTransformGizmoEnabled(spec: VesselLayerSpec): boolean {
  const gizmo = spec.style?.transformGizmo;
  if (typeof gizmo === "boolean") {
    return gizmo;
  }
  if (typeof gizmo === "object" && typeof gizmo.enabled === "boolean") {
    return gizmo.enabled;
  }
  return spec.style?.transformControls !== "none";
}

function getVesselGizmoSizeMeters(spec: VesselLayerSpec): number {
  const gizmo = spec.style?.transformGizmo;
  if (typeof gizmo === "object") {
    return normalizePositiveNumber(gizmo.sizeMeters, defaultVesselGizmoSize(spec));
  }
  return defaultVesselGizmoSize(spec);
}

function defaultVesselGizmoSize(spec: VesselLayerSpec): number {
  const dimensions = getVesselDimensions(spec);
  return Math.max((dimensions.bow + dimensions.stern) * 0.18, 20);
}

function getVesselOceanSurfaceOptions(spec: VesselLayerSpec): {
  enabled: boolean;
  radiusMeters?: number;
  color?: unknown;
  opacity?: number;
  roughness?: number;
  reflectivity?: number;
} {
  const style = spec.style?.oceanSurface;
  if (typeof style === "boolean") {
    return { enabled: style };
  }
  if (style && typeof style === "object") {
    return {
      enabled: style.enabled ?? false,
      ...(style.radiusMeters !== undefined ? { radiusMeters: style.radiusMeters } : {}),
      ...(style.color !== undefined ? { color: style.color } : {}),
      ...(style.opacity !== undefined ? { opacity: style.opacity } : {}),
      ...(style.roughness !== undefined ? { roughness: style.roughness } : {}),
      ...(style.reflectivity !== undefined ? { reflectivity: style.reflectivity } : {}),
    };
  }
  return {
    enabled: spec.style?.showOceanSurface ?? getBooleanExtension(spec, "seaSurfaceVisible", false),
  };
}

function getVesselShadowOptions(spec: VesselLayerSpec): {
  enabled: boolean;
  opacity?: number;
  color?: unknown;
} {
  const style = spec.style?.shadow;
  if (typeof style === "boolean") {
    return { enabled: style };
  }
  if (style && typeof style === "object") {
    return {
      enabled: style.enabled ?? true,
      ...(style.opacity !== undefined ? { opacity: style.opacity } : {}),
      ...(style.color !== undefined ? { color: style.color } : {}),
    };
  }
  return {
    enabled: getBooleanExtension(spec, "verticalShadow", true),
  };
}

function getVesselModelRootOffset(spec: VesselLayerSpec): Vector3Fields {
  const model = getExtension<Record<string, unknown>>(spec, "nasaAmmos", "model") ?? {};
  const bounds = parseVesselBoundingBox(model.boundingBox);
  if (!bounds) {
    return { x: 0, y: 0, z: 0 };
  }

  const dimensions = getVesselDimensions(spec);
  const size = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  };
  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const vesselWidth = dimensions.port + dimensions.starboard;
  const vesselLength = dimensions.bow + dimensions.stern;
  const scaleX = normalizePositiveNumber(vesselWidth / size.x, 1);
  const scaleY = normalizePositiveNumber(vesselLength / size.y, 1);
  const scaleZ = (scaleX + scaleY) / 2;
  const centerOffset = {
    x: (dimensions.starboard - dimensions.port) / 2,
    y: (dimensions.bow - dimensions.stern) / 2,
  };

  return {
    x: centerOffset.x - center.x * scaleX,
    y: centerOffset.y - center.y * scaleY,
    z: -bounds.min.z * scaleZ - dimensions.draught,
  };
}

function getVesselDimensions(spec: VesselLayerSpec): VesselDimensionsLike {
  const semantic: Partial<VesselDimensionsLike> = spec.dimensions ?? {};
  const extension = getExtension<Partial<VesselDimensionsLike>>(spec, "nasaAmmos", "dimensions") ?? {};
  const draught = finiteNumber(semantic.draught ?? extension.draught ?? spec.style?.draughtMeters, 7);
  return {
    draught,
    bow: finiteNumber(semantic.bow ?? extension.bow, 100),
    stern: finiteNumber(semantic.stern ?? extension.stern, 100),
    port: finiteNumber(semantic.port ?? extension.port, 20),
    starboard: finiteNumber(semantic.starboard ?? extension.starboard, 20),
  };
}

function parseVesselBoundingBox(value: unknown): { min: Vector3Fields; max: Vector3Fields } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const min = normalizeVector3Like(record.min ?? record._min);
  const max = normalizeVector3Like(record.max ?? record._max);
  if (min && max) {
    return { min, max };
  }

  const data = record.data;
  if (isArrayLike(data, 6)) {
    const values = data as ArrayLike<unknown>;
    const dataMin = normalizeVector3Like(values);
    const dataMax = normalizeVector3Like({
      0: values[3],
      1: values[4],
      2: values[5],
      length: 3,
    });
    if (dataMin && dataMax) {
      return { min: dataMin, max: dataMax };
    }
  }

  return null;
}

function normalizeVector3Like(value: unknown): Vector3Fields | null {
  if (!isArrayLike(value, 3)) {
    return null;
  }
  const tuple = value as ArrayLike<unknown>;
  const vector = {
    x: getFiniteNumber(tuple[0], Number.NaN),
    y: getFiniteNumber(tuple[1], Number.NaN),
    z: getFiniteNumber(tuple[2], Number.NaN),
  };
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
    ? vector
    : null;
}

function isArrayLike(value: unknown, length: number): value is ArrayLike<unknown> {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as ArrayLike<unknown>).length === "number" &&
    (value as ArrayLike<unknown>).length >= length
  );
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function toCesiumHeadingDegrees(spec: VesselLayerSpec, trueNorthHeadingDegrees: number): number {
  return trueNorthHeadingDegrees + getNumberExtension(spec, "headingOffsetDegrees", 90);
}

function getMapSpecificationExtension(
  spec: BaseLayerSpec,
): { urlTemplate?: string; dataset?: { extents?: SpatialExtent } } | undefined {
  return (
    getExtension<{ urlTemplate?: string; dataset?: { extents?: SpatialExtent } }>(
      spec,
      "cesium",
      "mapSpecification",
    ) ??
    getExtension<{ urlTemplate?: string; dataset?: { extents?: SpatialExtent } }>(
      spec,
      "nasaAmmos",
      "mapSpecification",
    ) ??
    getExtension<{ urlTemplate?: string; dataset?: { extents?: SpatialExtent } }>(
      spec,
      "cogs",
      "mapSpecification",
    )
  );
}

function getProjectedMapExtent(spec: BaseLayerSpec): SpatialExtent | null {
  const extension =
    getExtension<SpatialExtent>(spec, "cesium", "extents") ??
    getExtension<SpatialExtent>(spec, "nasaAmmos", "extents") ??
    getExtension<SpatialExtent>(spec, "cogs", "extents");
  if (isCompleteProjectedExtent(extension)) {
    return extension;
  }
  return isCompleteProjectedExtent(spec.spatialExtent) ? spec.spatialExtent : null;
}

function isCompleteProjectedExtent(extent: SpatialExtent | undefined): extent is SpatialExtent {
  return (
    extent !== undefined &&
    extent.minX !== undefined &&
    extent.minY !== undefined &&
    extent.maxX !== undefined &&
    extent.maxY !== undefined
  );
}

function getExtension<T>(spec: BaseLayerSpec, namespace: string, key: string): T | undefined {
  const extension = spec.extensions?.[namespace];
  if (!extension || typeof extension !== "object") {
    return undefined;
  }
  return (extension as Record<string, unknown>)[key] as T | undefined;
}

function getNumberExtension(spec: BaseLayerSpec, key: string, fallback: number): number {
  const value =
    getExtension<unknown>(spec, "cesium", key) ??
    getExtension<unknown>(spec, "nasaAmmos", key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getBooleanExtension(spec: BaseLayerSpec, key: string, fallback: boolean): boolean {
  const value =
    getExtension<unknown>(spec, "cesium", key) ??
    getExtension<unknown>(spec, "nasaAmmos", key);
  return typeof value === "boolean" ? value : fallback;
}

function getCesiumConstant(
  cesium: CesiumModule,
  namespace: string,
  key: string,
): unknown {
  const container = cesium[namespace];
  return container && typeof container === "object"
    ? (container as Record<string, unknown>)[key]
    : undefined;
}

function toCesiumColor(cesium: CesiumModule, value: unknown): unknown {
  const Color = cesium.Color as
    | (CesiumConstructor & {
        fromCssColorString?: (value: string) => unknown;
      })
    | undefined;
  if (typeof value === "string" && Color?.fromCssColorString) {
    return Color.fromCssColorString(value);
  }
  const rgba =
    value && typeof value === "object"
      ? (value as { r?: number; g?: number; b?: number; a?: number })
      : { r: 1, g: 1, b: 1, a: 1 };
  if (Color) {
    return new Color(rgba.r ?? 1, rgba.g ?? 1, rgba.b ?? 1, rgba.a ?? 1);
  }
  return { red: rgba.r ?? 1, green: rgba.g ?? 1, blue: rgba.b ?? 1, alpha: rgba.a ?? 1 };
}

function normalizeColorValue(
  value: unknown,
  opacity: number,
  fallback: { r: number; g: number; b: number },
): { r: number; g: number; b: number; a: number } | string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const color = value as { r?: number; g?: number; b?: number; a?: number };
    return {
      r: getFiniteNumber(color.r, fallback.r),
      g: getFiniteNumber(color.g, fallback.g),
      b: getFiniteNumber(color.b, fallback.b),
      a: clamp01(color.a ?? opacity),
    };
  }
  return {
    ...fallback,
    a: clamp01(opacity),
  };
}

function rgbTupleToRgba(
  value: readonly [number, number, number] | undefined,
  opacity: number,
  fallback: { r: number; g: number; b: number },
): { r: number; g: number; b: number; a: number } {
  if (!value) {
    return { ...fallback, a: opacity };
  }
  return {
    r: getFiniteNumber(value[0], fallback.r),
    g: getFiniteNumber(value[1], fallback.g),
    b: getFiniteNumber(value[2], fallback.b),
    a: clamp01(opacity),
  };
}

function createImageMaterial(cesium: CesiumModule, image: string, opacity: number): unknown {
  const color = toCesiumColor(cesium, {
    r: 1,
    g: 1,
    b: 1,
    a: Math.max(0, Math.min(1, opacity)),
  });
  const ImageMaterialProperty = cesium.ImageMaterialProperty as CesiumConstructor | undefined;
  if (ImageMaterialProperty) {
    return new ImageMaterialProperty({
      image,
      transparent: true,
      color,
    });
  }
  return { image, transparent: true, color };
}

function createColorMaterial(cesium: CesiumModule, color: unknown): unknown {
  const Material = cesium.Material as
    | {
        fromType?: (type: string, uniforms?: Record<string, unknown>) => unknown;
        ColorType?: string;
      }
    | undefined;
  return Material?.fromType?.(Material.ColorType ?? "Color", { color }) ?? color;
}

function createS100VesselOceanSurfaceMaterial(
  cesium: CesiumModule,
  Material: CesiumConstructor & {
    fromType?: (type: string, uniforms?: Record<string, unknown>) => unknown;
  },
  colorValue: unknown,
  opacity: number,
  radiusMeters: number | undefined,
  reflectivity: number | undefined,
  roughness: number | undefined,
): unknown {
  const alpha = colorValue && typeof colorValue === "object"
    ? clamp01((colorValue as { a?: number }).a ?? opacity)
    : clamp01(opacity);
  const reflectivityValue = clamp01(reflectivity ?? 0.4);
  const roughnessValue = clamp01(roughness ?? 0.096);
  const uniforms = {
    u_s100WaterBaseColor: toCesiumColor(cesium, colorValue),
    u_s100WaterOpacity: alpha,
    u_s100WaterRadiusMeters: normalizePositiveNumber(radiusMeters, 80),
    u_s100WaterReflectivity: reflectivityValue,
    u_s100WaterRoughness: roughnessValue,
    u_s100WaterAnimationSpeed: 0.018,
  };
  if (typeof Material === "function") {
    try {
      return new Material({
        fabric: {
          type: "S100VesselOceanSurface",
          uniforms,
          source: `
float s100WaterHash(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 s100WaterGradient(vec2 cell) {
  float angle = s100WaterHash(cell) * 6.28318530718;
  return vec2(cos(angle), sin(angle));
}

float s100WaterPerlin(vec2 position) {
  vec2 cell = floor(position);
  vec2 local = fract(position);
  vec2 blend = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);
  float a = dot(s100WaterGradient(cell + vec2(0.0, 0.0)), local - vec2(0.0, 0.0));
  float b = dot(s100WaterGradient(cell + vec2(1.0, 0.0)), local - vec2(1.0, 0.0));
  float c = dot(s100WaterGradient(cell + vec2(0.0, 1.0)), local - vec2(0.0, 1.0));
  float d = dot(s100WaterGradient(cell + vec2(1.0, 1.0)), local - vec2(1.0, 1.0));
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

float s100WaterWaveHeight(vec2 localPosition) {
  float time = czm_frameNumber * u_s100WaterAnimationSpeed;
  vec2 p = localPosition * 0.035;
  float wave =
    s100WaterPerlin(p + vec2(time * 0.74, time * 0.31)) * 0.50 +
    s100WaterPerlin(p * 2.1 + vec2(-time * 0.42, time * 0.67)) * 0.26 +
    s100WaterPerlin(p * 4.4 + vec2(time * 0.18, -time * 0.52)) * 0.16 +
    s100WaterPerlin(p * 9.2 + vec2(-time * 0.64, -time * 0.23)) * 0.08;
  float midDetailRipple =
    s100WaterPerlin(localPosition / 1.20 + vec2(-time * 0.96, time * 0.83)) * 0.02275;
  float microRipple =
    s100WaterPerlin(localPosition / 0.30 + vec2(time * 1.43, -time * 1.17)) * 0.01225;
  return wave + midDetailRipple + microRipple;
}

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec2 centered = (materialInput.st - vec2(0.5)) * 2.0;
  vec2 localPosition = centered * u_s100WaterRadiusMeters;
  float waveHeight = s100WaterWaveHeight(localPosition);
  float waveDx = s100WaterWaveHeight(localPosition + vec2(0.0375, 0.0)) -
    s100WaterWaveHeight(localPosition - vec2(0.0375, 0.0));
  float waveDy = s100WaterWaveHeight(localPosition + vec2(0.0, 0.0375)) -
    s100WaterWaveHeight(localPosition - vec2(0.0, 0.0375));
  float slope = clamp(length(vec2(waveDx, waveDy)) * 5.0, 0.0, 1.0);
  float waveBand = smoothstep(-0.20, 0.28, waveHeight);
  vec3 deepWater = vec3(0.015, 0.144, 0.30);
  vec3 blueWater = vec3(0.015, 0.344, 0.62);
  vec3 crestWater = vec3(0.34, 0.78, 0.92);
  vec3 proceduralColor = mix(mix(deepWater, blueWater, waveBand), crestWater, clamp(slope * 0.95, 0.0, 0.58));
  material.diffuse = mix(u_s100WaterBaseColor.rgb, proceduralColor, 0.72);
  material.alpha = clamp(u_s100WaterOpacity + slope * 0.08, 0.0, 0.76);
  material.specular = u_s100WaterReflectivity;
  material.shininess = mix(42.0, 180.0, 1.0 - u_s100WaterRoughness);
  return material;
}`,
        },
        translucent: true,
      });
    } catch {
      // Fall back to Cesium's stock water material when Fabric construction is unavailable.
    }
  }
  return Material.fromType?.("Water", {
    baseWaterColor: uniforms.u_s100WaterBaseColor,
    blendColor: uniforms.u_s100WaterBaseColor,
    frequency: 18,
    animationSpeed: 0.01,
    amplitude: 0.35,
    specularIntensity: reflectivityValue,
  }) ?? {
    type: "S100VesselOceanSurface",
    uniforms,
  };
}

function createCartesian2(cesium: CesiumModule, x: number, y: number): unknown {
  const Cartesian2 = cesium.Cartesian2 as CesiumConstructor | undefined;
  return Cartesian2 ? new Cartesian2(x, y) : { x, y };
}

function createPolygonHierarchy(cesium: CesiumModule, positions: CesiumObject[]): unknown {
  const PolygonHierarchy = cesium.PolygonHierarchy as CesiumConstructor | undefined;
  return PolygonHierarchy ? new PolygonHierarchy(positions) : { positions };
}

function cartesianFromElements(cesium: CesiumModule, x: number, y: number, z: number): CesiumObject {
  const Cartesian3 = cesium.Cartesian3 as
    | { fromElements?: (x: number, y: number, z: number) => CesiumObject }
    | undefined;
  if (Cartesian3?.fromElements) {
    return Cartesian3.fromElements(x, y, z);
  }
  return { x, y, z };
}

function cartesianArrayToFloat64(positions: readonly CesiumObject[]): Float64Array {
  const values = new Float64Array(positions.length * 3);
  positions.forEach((position, index) => {
    const vector = cartesianFields(position);
    values[index * 3] = vector.x;
    values[index * 3 + 1] = vector.y;
    values[index * 3 + 2] = vector.z;
  });
  return values;
}

function createLocalDiscPositions(cesium: CesiumModule, radius: number, segments = 96): CesiumObject[] {
  return [
    cartesianFromElements(cesium, 0, 0, 0),
    ...createLocalRingPositions(cesium, radius, segments),
  ];
}

function createLocalRingPositions(cesium: CesiumModule, radius: number, segments = 96): CesiumObject[] {
  const positions: CesiumObject[] = [];
  for (let index = 0; index < segments; index += 1) {
    const radians = (index / segments) * Math.PI * 2;
    positions.push(
      cartesianFromElements(
        cesium,
        Math.cos(radians) * radius,
        Math.sin(radians) * radius,
        0,
      ),
    );
  }
  return positions;
}

function cartesianFields(position: CesiumObject): Vector3Fields {
  return {
    x: getFiniteNumber(position.x, 0),
    y: getFiniteNumber(position.y, 0),
    z: getFiniteNumber(position.z, 0),
  };
}

function isFiniteCartesianLike(position: CesiumObject): boolean {
  const vector = cartesianFields(position);
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function createQuadNormalValues(positions: readonly CesiumObject[]): Float32Array {
  const a = cartesianFields(positions[0] ?? {});
  const b = cartesianFields(positions[1] ?? {});
  const c = cartesianFields(positions[2] ?? {});
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  const normal = [nx / length, ny / length, nz / length] as const;
  return new Float32Array([
    ...normal,
    ...normal,
    ...normal,
    ...normal,
  ]);
}

function createDiscNormalValues(vertexCount: number): Float32Array {
  const values = new Float32Array(vertexCount * 3);
  for (let index = 0; index < vertexCount; index += 1) {
    values[index * 3 + 2] = 1;
  }
  return values;
}

function createDiscTextureCoordinates(vertexCount: number): Float32Array {
  const values = new Float32Array(vertexCount * 2);
  if (vertexCount <= 0) {
    return values;
  }
  values[0] = 0.5;
  values[1] = 0.5;
  const outerCount = Math.max(vertexCount - 1, 1);
  for (let index = 1; index < vertexCount; index += 1) {
    const radians = ((index - 1) / outerCount) * Math.PI * 2;
    values[index * 2] = 0.5 + Math.cos(radians) * 0.5;
    values[index * 2 + 1] = 0.5 + Math.sin(radians) * 0.5;
  }
  return values;
}

function createTriangleFanIndices(vertexCount: number): number[] {
  const indices: number[] = [];
  for (let index = 1; index < vertexCount - 1; index += 1) {
    indices.push(0, index, index + 1);
  }
  if (vertexCount > 3) {
    indices.push(0, vertexCount - 1, 1);
  }
  return indices;
}

function createIndexArray(indices: readonly number[]): Uint16Array | Uint32Array {
  return Math.max(...indices) > 65_535
    ? new Uint32Array(indices)
    : new Uint16Array(indices);
}

function getCesiumComponentDatatype(cesium: CesiumModule, key: "DOUBLE" | "FLOAT"): unknown {
  const ComponentDatatype = cesium.ComponentDatatype as Record<string, unknown> | undefined;
  return ComponentDatatype?.[key] ?? key;
}

function getCesiumPrimitiveType(cesium: CesiumModule, key: "LINES" | "TRIANGLES"): unknown {
  const PrimitiveType = cesium.PrimitiveType as Record<string, unknown> | undefined;
  return PrimitiveType?.[key] ?? key;
}

function createBoundingSphere(
  cesium: CesiumModule,
  positions: readonly CesiumObject[],
  vertices: Float64Array,
): unknown {
  const BoundingSphere = cesium.BoundingSphere as
    | {
        fromPoints?: (positions: readonly CesiumObject[]) => unknown;
        fromVertices?: (vertices: Float64Array) => unknown;
      }
    | undefined;
  return BoundingSphere?.fromPoints?.(positions) ?? BoundingSphere?.fromVertices?.(vertices);
}

function cartesianToCartographic(
  cesium: CesiumModule,
  cartesian: CesiumObject,
): { longitude: number; latitude: number; height?: number } | null {
  const Cartographic = cesium.Cartographic as
    | { fromCartesian?: (cartesian: CesiumObject) => { longitude: number; latitude: number; height?: number } }
    | undefined;
  if (Cartographic?.fromCartesian) {
    return Cartographic.fromCartesian(cartesian);
  }
  const Ellipsoid = cesium.Ellipsoid as { WGS84?: { cartesianToCartographic?: (cartesian: CesiumObject) => unknown } } | undefined;
  const result = Ellipsoid?.WGS84?.cartesianToCartographic?.(cartesian) as
    | { longitude: number; latitude: number; height?: number }
    | undefined;
  return result ?? null;
}

function degreesToRadians(cesium: CesiumModule, value: number): number {
  const CesiumMath = cesium.Math as { toRadians?: (value: number) => number } | undefined;
  return CesiumMath?.toRadians ? CesiumMath.toRadians(value) : (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function cloneCameraPose(pose: EngineCameraPose): EngineCameraPose {
  return {
    position: { ...pose.position },
    rotation: { ...pose.rotation },
    ...(pose.focalDistance !== undefined ? { focalDistance: pose.focalDistance } : {}),
  };
}

function getCrsFromUrl(url: string): string | undefined {
  const query = url.split("?")[1];
  if (!query) {
    return undefined;
  }
  const params = new URLSearchParams(query.replaceAll("{xmin}", "0").replaceAll("{ymin}", "0").replaceAll("{xmax}", "1").replaceAll("{ymax}", "1"));
  return params.get("CRS") ?? params.get("crs") ?? params.get("SRS") ?? params.get("srs") ?? undefined;
}

function projectedToLonLat(crs: string, x: number, y: number): [number, number] {
  if (crs.toUpperCase() === "EPSG:4326") {
    return [x, y];
  }
  ensureProj4Definition(crs);
  return proj4(crs, "EPSG:4326", [x, y]) as [number, number];
}

function lonLatToProjected(crs: string, lon: number, lat: number): [number, number] {
  if (crs.toUpperCase() === "EPSG:4326") {
    return [lon, lat];
  }
  ensureProj4Definition(crs);
  return proj4("EPSG:4326", crs, [lon, lat]) as [number, number];
}

function ensureProj4Definition(crs: string): void {
  const match = /^EPSG:(326|327)(\d{2})$/iu.exec(crs);
  if (!match) {
    return;
  }
  const hemisphere = match[1] === "327" ? " +south" : "";
  const zone = Number(match[2]);
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) {
    return;
  }
  proj4.defs(
    crs.toUpperCase(),
    `+proj=utm +zone=${zone}${hemisphere} +datum=WGS84 +units=m +no_defs +type=crs`,
  );
}
