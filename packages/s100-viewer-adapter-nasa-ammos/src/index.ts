import {
  S100Error,
  S100SupportedProductVersions,
  type AdapterCapabilities,
  type BaseLayerSpec,
  type CameraControlConfig,
  type CameraLookAt,
  type EngineCameraPose,
  type Coordinate,
  type EncLayerSpec,
  type EngineCameraChangeListener,
  type EngineHandleBundle,
  type EngineLayerHandle,
  type EnginePrismCorners2D,
  type EngineRgba,
  type EngineScene,
  type EngineViewerHost,
  type EnvironmentState,
  type LayerPatch,
  type LivePickingOptions,
  type PickRequest,
  type PickResult,
  type S100EngineAdapter,
  type SceneOptions,
  type ViewerHostOptions,
  type MapOverlayLayerSpec,
  type ModelSource,
  type RestJsonSource,
  type S102BathymetryLayerSpec,
  type S111SurfaceCurrentLayerSpec,
  type ServiceReadySource,
  type SimulatedWaterLevelLayerSpec,
  type StaticJsonSource,
  type ThreeDTilesSource,
  type VesselLayerSpec,
  type WmsSource,
  type WmsTemplateSource,
  type WmtsSource,
} from "@ecc/s100-viewer";
import {
  S100NasaLogLevel,
  S100NasaViewer,
  type S100NasaLogSettings,
  type S100NasaViewerConfig,
  type Vec3,
} from "./runtime/index.js";
import {
  MapLayerType,
  SeaLevelIndicatorMode,
  ViewerScene,
  type CustomModelView,
  type MapSpecification,
  type MapView,
  type ModelAssetSpecification,
  type PickedInfo,
  type S111View,
  type SurfaceCurrentDataset,
  type TerrainView,
  type VesselDimensions,
  type VesselView,
} from "./runtime/compat/s100-viewer.js";
import * as THREE from "three";
import {
  AmbientLight,
  Color,
  CubeTextureLoader,
  DirectionalLight,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  Raycaster,
  TextureLoader,
  Vector2,
  Vector3,
  type Camera,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

type FetchLike = typeof fetch;
const SIMULATED_WATER_LEVEL_PRODUCT = "simulated-water-level";

type NasaRenderContext = {
  canvas: HTMLCanvasElement;
  camera: Camera;
  renderer: WebGLRenderer;
  scene: Scene;
};

type SubscriptionLike = {
  unsubscribe(): void;
};

export type NasaAmmosAdapterOptions = S100NasaViewerConfig & {
  fetchHandler?: FetchLike;
};

export { S100NasaLogLevel };
export type { S100NasaLogSettings };

type NasaLayerNative =
  | { kind: "terrain"; spec: S102BathymetryLayerSpec; view: TerrainView }
  | { kind: "s111"; spec: S111SurfaceCurrentLayerSpec; view: S111View }
  | { kind: "simulated-water-level"; spec: SimulatedWaterLevelLayerSpec; data: unknown }
  | { kind: "map"; spec: EncLayerSpec | MapOverlayLayerSpec; view: MapView }
  | { kind: "vessel"; spec: VesselLayerSpec; view: VesselView }
  | { kind: "model"; spec: BaseLayerSpec; view: CustomModelView };

export const nasaAmmosAdapterCapabilities: AdapterCapabilities = {
  sceneGeoreferences: ["projected-local"],
  layerProducts: ["S-101", "S-57", "S-102", "S-111", "simulated-water-level", "vessel", "map-overlay", "tool"],
  supportedProductVersions: S100SupportedProductVersions,
  dataSources: ["3d-tiles", "wms", "wmts", "rest-json", "static-json", "model"],
  cameraControls: ["pose", "look-at"],
  picking: true,
  timeDynamicLayers: true,
  nativeHandles: true,
  precisionStrategy: "origin-rebased",
  globe: {
    ellipsoidEcef: false,
    globeNative3dTiles: false,
    oceanMasking: false,
  },
  visualFeatures: {
    depthRay: true,
    hoverPrism: true,
    vesselTransformGizmo: { supported: true, modes: ["translate", "rotate", "translate-rotate"] },
    vesselOceanSurface: true,
    vesselShadow: true,
    staticLighting: true,
    dynamicLighting: false,
  },
};

export const createNasaAmmosAdapter = (
  options: NasaAmmosAdapterOptions = {},
): S100EngineAdapter => ({
  id: "nasa-ammos",
  displayName: "NASA-AMMOS / Three.js",
  capabilities: nasaAmmosAdapterCapabilities,
  getCapabilities: () => nasaAmmosAdapterCapabilities,
  async createViewerHost(hostOptions) {
    const parent = getHtmlElement(hostOptions.container);
    const viewerConfig: S100NasaViewerConfig = { ...options };
    const logger = options.logger ?? hostOptions.logger;
    if (logger !== undefined) {
      viewerConfig.logger = logger;
    }
    if (options.fetchHandler !== undefined) {
      viewerConfig.fetchHandler = options.fetchHandler;
    }

    const viewer = await S100NasaViewer.create(parent, viewerConfig);
    return new NasaAmmosViewerHost(viewer, options);
  },
  async destroyViewerHost(host) {
    await host.destroy();
  },
});

class NasaAmmosViewerHost implements EngineViewerHost {
  constructor(
    private readonly viewer: S100NasaViewer,
    private readonly options: NasaAmmosAdapterOptions,
  ) {}

  getEngineHandles(): EngineHandleBundle {
    return {
      adapterId: "nasa-ammos",
      engineName: "NASA-AMMOS / Three.js",
      engineVersion: `three r${THREE.REVISION}`,
      engineInstance: this.viewer,
      instances: {
        viewer: this.viewer,
        canvas: this.viewer.element,
      },
      staticObjects: {
        THREE,
      },
      resources: {
        threeDocs: "https://threejs.org/docs/",
        tilesRendererDocs: "https://github.com/NASA-AMMOS/3DTilesRendererJS",
      },
    };
  }

  async createScene(options: SceneOptions): Promise<EngineScene> {
    if (options.georeference?.mode === "ellipsoid-ecef") {
      throw new S100Error(
        "adapter-capability",
        "NASA-AMMOS adapter currently supports projected-local scenes only.",
      );
    }

    const sceneOptions: { crs?: string; origin?: Vec3 } = {};
    if (options.georeference?.mode === "projected-local") {
      sceneOptions.crs = options.georeference.crs;
    }
    const origin = getProjectedOrigin(options);
    if (origin !== undefined) {
      sceneOptions.origin = origin;
    }

    const coreScene = await this.viewer.createScene(sceneOptions);
    const scene = new ViewerScene(coreScene, this.options);
    return new NasaAmmosEngineScene(scene, this.options, {
      ...(sceneOptions.crs !== undefined ? { crs: sceneOptions.crs } : {}),
      ...(origin !== undefined ? { origin } : {}),
    });
  }

  destroy(): void {
    this.viewer.destroy();
  }
}

class NasaAmmosEngineScene implements EngineScene {
  private readonly raycaster = new Raycaster();
  private readonly layers = new Map<EngineLayerHandle, NasaLayerNative>();
  private currentTime = new Date(0);
  private livePickingSubscription: SubscriptionLike | null = null;
  private cameraChangeListener: EngineCameraChangeListener | null = null;
  private cameraChangeSubscription: SubscriptionLike | null = null;
  private environmentLoadSerial = 0;
  private environmentTextures: Texture[] = [];
  private disposed = false;

  constructor(
    private readonly scene: ViewerScene,
    private readonly options: NasaAmmosAdapterOptions,
    private readonly georeference: { crs?: string; origin?: Vec3 },
  ) {
    this.cameraChangeSubscription = this.scene.cameraChanged.subscribe((pose) => {
      this.cameraChangeListener?.(tupleCameraPoseToObjectPose(pose));
    });
  }

  getEngineHandles(): EngineHandleBundle {
    const renderContext = getRenderContext(this.scene);
    return {
      adapterId: "nasa-ammos",
      engineName: "NASA-AMMOS / Three.js",
      engineVersion: `three r${THREE.REVISION}`,
      engineInstance: this.scene,
      instances: {
        viewerScene: this.scene,
        cameraNavigation: this.scene.cameraNavigation,
        picking: this.scene.Picking,
        pickingRay: this.scene.PickingRay,
        hoverPrism: this.scene.HoverPrism,
        renderer: renderContext?.renderer,
        scene: renderContext?.scene,
        camera: renderContext?.camera,
        canvas: renderContext?.canvas,
      },
      staticObjects: {
        THREE,
      },
      resources: {
        threeDocs: "https://threejs.org/docs/",
        tilesRendererDocs: "https://github.com/NASA-AMMOS/3DTilesRendererJS",
      },
    };
  }

  setCamera(pose: EngineCameraPose): void {
    const cameraPose: {
      position: [number, number, number];
      rotation: [number, number, number, number];
      focalDistance?: number;
    } = {
      position: [pose.position.x, pose.position.y, pose.position.z],
      rotation: [pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w],
    };
    if (pose.focalDistance !== undefined) {
      cameraPose.focalDistance = pose.focalDistance;
    }
    this.scene.cameraNavigation.setCameraPose(cameraPose);
  }

  getCamera(): EngineCameraPose {
    const pose = this.scene.cameraNavigation.getCameraPose();
    const cameraPose: EngineCameraPose = {
      position: {
        x: pose.position[0],
        y: pose.position[1],
        z: pose.position[2],
      },
      rotation: {
        x: pose.rotation[0],
        y: pose.rotation[1],
        z: pose.rotation[2],
        w: pose.rotation[3],
      },
    };
    if (pose.focalDistance !== undefined) {
      cameraPose.focalDistance = pose.focalDistance;
    }
    return cameraPose;
  }

  lookAt(view: CameraLookAt): void {
    const target = this.coordinateToEngineVec3(view.target);
    this.scene.cameraNavigation.lookAt(
      [target.x, target.y, target.z],
      view.rangeMeters,
      view.headingDegrees ?? 0,
      view.pitchDegrees ?? 45,
    );
  }

  setCameraChangeListener(listener: EngineCameraChangeListener | null): void {
    this.cameraChangeListener = listener;
  }

  setCameraControls(config: CameraControlConfig): void {
    this.scene.cameraNavigation.navigationEnabled = config.enabled !== false && config.preset !== "disabled";
  }

  setTime(time: Date): void {
    this.currentTime = new Date(time);
    for (const native of this.layers.values()) {
      if (native.kind === "s111") {
        native.view.time.currentTime = this.currentTime.getTime();
      }
      if (native.kind === "simulated-water-level") {
        const seaLevel = resolveWaterLevel(native.data, this.currentTime);
        if (seaLevel !== null) {
          this.setSeaLevel(seaLevel);
        }
      }
    }
  }

  setSeaLevel(value: number): void {
    this.scene.seaLevel = value;
  }

  getSeaLevel(): number {
    return this.scene.seaLevel;
  }

  setEnvironment(state: EnvironmentState): void {
    const renderContext = getRenderContext(this.scene);
    if (!renderContext) {
      return;
    }

    applyNasaLighting(renderContext.scene, state.lighting);
    applyNasaBackground(renderContext, state);

    if (state.background === "skybox" && state.skyboxFaces) {
      this.loadCubeSkybox(renderContext, state);
      return;
    }

    if (state.background === "skybox" && (state.skyboxUrl || state.lighting?.environmentMapUrl)) {
      this.loadEquirectangularSkybox(renderContext, state);
      return;
    }

    this.environmentLoadSerial += 1;
    this.clearEnvironmentTexture();
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

  showHoverPrism(
    corners: EnginePrismCorners2D,
    zPos?: number,
    height?: number,
    rgba?: EngineRgba,
  ): void {
    this.scene.HoverPrism.showPrism(corners, zPos, height, rgba);
  }

  clearHoverPrism(): void {
    this.scene.HoverPrism.clear();
  }

  async pick(request: PickRequest): Promise<PickResult | null> {
    const renderContext = getRenderContext(this.scene);
    if (!renderContext) {
      return null;
    }

    const { camera, canvas, scene } = renderContext;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    this.raycaster.setFromCamera(getCanvasPointer(request, canvas), camera);

    const roots = getPickableSceneRoots(scene);
    const hit = roots.length
      ? this.raycaster.intersectObjects(roots, true).find((candidate) => {
          const root = getPickableRootForObject(candidate.object);
          return root !== null && !hasUnpickableAncestor(candidate.object, root);
        })
      : undefined;

    if (hit) {
      return {
        screen: { x: request.screenX, y: request.screenY },
        world: {
          kind: "engine-local",
          x: hit.point.x,
          y: hit.point.y,
          z: hit.point.z,
          frameId: "nasa-ammos",
        },
        source: "geometry",
        depthMeters: hit.point.z - this.scene.seaLevel,
        native: request.includeNative ? hit : undefined,
      };
    }

    if (request.fallback === "sea-level-plane") {
      const point = getSeaLevelRayPoint(this.raycaster, this.scene.seaLevel);
      if (point) {
        return {
          screen: { x: request.screenX, y: request.screenY },
        world: {
            kind: "engine-local",
            x: point.x,
            y: point.y,
            z: point.z,
            frameId: "nasa-ammos",
          },
          source: "sea-level-plane",
          values: {
            seaLevel: this.scene.seaLevel,
          },
        };
      }
    }

    return null;
  }

  setLivePickingMode(
    options: LivePickingOptions,
    emitPick: (result: PickResult | null) => void,
  ): void {
    const visualEnabled = options.enabled && options.includeVisual !== false;
    this.scene.PickingRay.enabled = visualEnabled;
    applyPickingRayVisualOptions(this.scene.PickingRay, options.visual);

    this.livePickingSubscription?.unsubscribe();
    this.livePickingSubscription = null;

    if (!options.enabled) {
      return;
    }

    this.livePickingSubscription = this.scene.Picking.Mousemove.subscribe((pick) => {
      emitPick(legacyPickToPickResult(pick));
    });
  }

  dispose(): void {
    this.disposed = true;
    this.environmentLoadSerial += 1;
    this.cameraChangeSubscription?.unsubscribe();
    this.cameraChangeSubscription = null;
    this.cameraChangeListener = null;
    this.livePickingSubscription?.unsubscribe();
    this.livePickingSubscription = null;
    this.clearEnvironmentTexture();
    this.scene.PickingRay.enabled = false;
    this.clearHoverPrism();
    for (const handle of [...this.layers.keys()]) {
      const native = this.layers.get(handle);
      if (native) {
        void this.disposeNativeLayer(native);
      }
    }
    this.layers.clear();
    this.scene.destroy();
  }

  private loadCubeSkybox(renderContext: NasaRenderContext, state: EnvironmentState): void {
    const faces = state.skyboxFaces;
    if (!faces) {
      return;
    }

    const serial = ++this.environmentLoadSerial;
    new CubeTextureLoader().load(
      [
        faces.positiveX,
        faces.negativeX,
        faces.positiveY,
        faces.negativeY,
        faces.positiveZ,
        faces.negativeZ,
      ],
      (texture) => {
        if (this.disposed || serial !== this.environmentLoadSerial) {
          texture.dispose();
          return;
        }

        this.replaceEnvironmentTextures([texture]);
        applyNasaEnvironmentTexture(renderContext, texture, texture, state);
      },
      undefined,
      (error) => {
        if (!this.disposed && serial === this.environmentLoadSerial) {
          this.options.logger?.warn?.("Failed to load NASA-AMMOS skybox faces", error);
        }
      },
    );
  }

  private loadEquirectangularSkybox(renderContext: NasaRenderContext, state: EnvironmentState): void {
    const url = state.lighting?.environmentMapUrl ?? state.skyboxUrl;
    if (!url) {
      return;
    }

    if (isHdrEnvironmentMap(url)) {
      this.loadHdrSkybox(renderContext, state, url);
      return;
    }

    const serial = ++this.environmentLoadSerial;
    new TextureLoader().load(
      url,
      (texture) => {
        if (this.disposed || serial !== this.environmentLoadSerial) {
          texture.dispose();
          return;
        }

        texture.mapping = EquirectangularReflectionMapping;
        const pmremGenerator = new PMREMGenerator(renderContext.renderer);
        const environmentTexture = pmremGenerator.fromEquirectangular(texture).texture;
        pmremGenerator.dispose();
        this.replaceEnvironmentTextures([texture, environmentTexture]);
        applyNasaEnvironmentTexture(renderContext, texture, environmentTexture, state);
      },
      undefined,
      (error) => {
        if (!this.disposed && serial === this.environmentLoadSerial) {
          this.options.logger?.warn?.("Failed to load NASA-AMMOS skybox image", error);
        }
      },
    );
  }

  private loadHdrSkybox(
    renderContext: NasaRenderContext,
    state: EnvironmentState,
    url: string,
  ): void {
    const serial = ++this.environmentLoadSerial;
    new RGBELoader().load(
      url,
      (texture) => {
        if (this.disposed || serial !== this.environmentLoadSerial) {
          texture.dispose();
          return;
        }

        texture.mapping = EquirectangularReflectionMapping;
        const pmremGenerator = new PMREMGenerator(renderContext.renderer);
        const environmentTexture = pmremGenerator.fromEquirectangular(texture).texture;
        pmremGenerator.dispose();
        this.replaceEnvironmentTextures([texture, environmentTexture]);
        applyNasaEnvironmentTexture(renderContext, texture, environmentTexture, state);
      },
      undefined,
      (error) => {
        if (!this.disposed && serial === this.environmentLoadSerial) {
          this.options.logger?.warn?.("Failed to load NASA-AMMOS HDR environment map", error);
        }
      },
    );
  }

  private replaceEnvironmentTextures(textures: Texture[]): void {
    this.clearEnvironmentTexture();
    this.environmentTextures = textures;
  }

  private clearEnvironmentTexture(): void {
    for (const texture of this.environmentTextures) {
      texture.dispose();
    }
    this.environmentTextures = [];
  }

  private coordinateToEngineVec3(coordinate: Coordinate): Vec3 {
    const position = coordinateToVec3(coordinate);
    if (coordinate.kind !== "projected") {
      return position;
    }

    const origin = this.georeference.origin;
    const sceneCrs = this.georeference.crs;
    if (!origin || !sceneCrs || coordinate.crs.toUpperCase() !== sceneCrs.toUpperCase()) {
      return position;
    }

    return {
      x: position.x - origin.x,
      y: position.y - origin.y,
      z: position.z - origin.z,
    };
  }

  private getTerrainOriginOffset(
    spec: S102BathymetryLayerSpec,
  ): { originOffset?: [number, number, number] } {
    if (spec.source.sourceFrame === "engine-local") {
      return {};
    }

    const origin = this.georeference.origin;
    if (!origin) {
      return {};
    }

    return {
      originOffset: [-origin.x, -origin.y, -origin.z],
    };
  }

  private async createNativeLayer(spec: BaseLayerSpec): Promise<NasaLayerNative> {
    switch (spec.product) {
      case "S-102":
        return this.createTerrainLayer(spec as S102BathymetryLayerSpec);
      case "S-111":
        return this.createS111Layer(spec as S111SurfaceCurrentLayerSpec);
      case "S-101":
        return this.createMapLayer(spec as EncLayerSpec);
      case "S-57":
        return this.createMapLayer(spec as EncLayerSpec);
      case SIMULATED_WATER_LEVEL_PRODUCT:
        return this.createSimulatedWaterLevelLayer(spec as SimulatedWaterLevelLayerSpec);
      case "map-overlay":
        return this.createMapLayer(spec as MapOverlayLayerSpec);
      case "vessel":
        return this.createVesselLayer(spec as VesselLayerSpec);
      default:
        throw new S100Error(
          "adapter-capability",
          `NASA-AMMOS adapter does not yet support layer product '${String(spec.product)}'.`,
          spec,
        );
    }
  }

  private createTerrainLayer(spec: S102BathymetryLayerSpec): NasaLayerNative {
    assertSourceKind(spec, "3d-tiles");
    const terrainDataset: {
      baseURL: string;
      additionalURLParameters: string;
      accessToken?: string;
      detailFactor: number;
      originOffset?: [number, number, number];
    } = {
      baseURL: spec.source.url,
      additionalURLParameters: buildAdditionalUrlParameters(spec),
      detailFactor: getS102DetailFactor(spec),
      ...this.getTerrainOriginOffset(spec),
    };
    const accessToken = getAuthorizationBearer(spec.source);
    if (accessToken !== undefined) {
      terrainDataset.accessToken = accessToken;
    }
    const view = this.scene.Terrain.add(terrainDataset);
    applyTerrainStyle(view, spec);
    applyVisibility(view, spec.visible);

    return { kind: "terrain", spec, view };
  }

  private async createS111Layer(spec: S111SurfaceCurrentLayerSpec): Promise<NasaLayerNative> {
    const data = await loadJsonSource(spec.source, this.options.fetchHandler);
    const view = this.scene.S111.add(data as SurfaceCurrentDataset, {
      originOffset: getS111OriginOffset(spec, this.georeference),
    });
    applyS111Style(view, spec);
    applyVisibility(view, spec.visible);
    view.time.currentTime = this.currentTime.getTime();

    return { kind: "s111", spec, view };
  }

  private async createSimulatedWaterLevelLayer(
    spec: SimulatedWaterLevelLayerSpec,
  ): Promise<NasaLayerNative> {
    const data = await loadJsonSource(spec.source, this.options.fetchHandler);
    const seaLevel = resolveWaterLevel(data, this.currentTime);
    if (seaLevel !== null) {
      this.setSeaLevel(seaLevel);
    }

    return { kind: "simulated-water-level", spec, data };
  }

  private createMapLayer(spec: EncLayerSpec | MapOverlayLayerSpec): NasaLayerNative {
    const mapSpecification = createMapSpecification(spec, this.georeference);
    const view = this.scene.Map.add(mapSpecification);
    view.alpha = spec.opacity ?? 1;
    view.setVisibility(spec.visible ?? true);

    return { kind: "map", spec, view };
  }

  private createVesselLayer(spec: VesselLayerSpec): NasaLayerNative {
    assertSourceKind(spec, "model");
    const model = getVesselModel(spec);
    const verticalPositionLimits = getVesselTransformGizmoVerticalPositionLimits(spec);
    const view = this.scene.VesselFeature.add({
      model: {
        path: spec.source.url,
        name: spec.title ?? spec.id,
        boundingBox: model.boundingBox,
        orientation: model.orientation,
      },
      dimensions: getVesselDimensions(spec),
      ...(verticalPositionLimits !== undefined ? { verticalPositionLimits } : {}),
    });
    const position = this.coordinateToEngineVec3(spec.pose.position);
    view.setPosition([position.x, position.y, position.z]);
    view.setHeading(spec.pose.headingDegrees ?? 0);
    view.setVisibility(spec.visible ?? true);
    applyVesselPresentation(view, spec);

    return { kind: "vessel", spec, view };
  }

  private applyLayerPatch(native: NasaLayerNative, patch: LayerPatch): void {
    if (native.kind === "terrain") {
      applyTerrainStyle(native.view, native.spec);
      applyVisibility(native.view, patch.visible);
      return;
    }

    if (native.kind === "s111") {
      applyS111Style(native.view, native.spec);
      applyVisibility(native.view, patch.visible);
      return;
    }

    if (native.kind === "map") {
      if (typeof patch.opacity === "number") {
        native.view.alpha = patch.opacity;
      }
      applyVisibility(native.view, patch.visible);
      return;
    }

    if (native.kind === "vessel") {
      const vesselPatch = patch as LayerPatch<VesselLayerSpec>;
      if (vesselPatch.pose) {
        const position = this.coordinateToEngineVec3(native.spec.pose.position);
        native.view.setPosition([position.x, position.y, position.z]);
        native.view.setHeading(native.spec.pose.headingDegrees ?? native.view.getHeading());
      }
      if (
        vesselPatch.dimensions !== undefined ||
        vesselPatch.style?.draughtMeters !== undefined ||
        getNasaAmmosExtension(vesselPatch as BaseLayerSpec, "dimensions") !== undefined
      ) {
        native.view.setDimensions(getVesselDimensions(native.spec));
      }
      if (vesselPatch.visible !== undefined) {
        applyVisibility(native.view, vesselPatch.visible);
      }
      if (vesselPatch.style !== undefined || vesselPatch.extensions !== undefined) {
        native.view.setVerticalPositionLimits(
          getVesselTransformGizmoVerticalPositionLimits(native.spec),
        );
        applyVesselPresentation(native.view, native.spec);
      }
    }
  }

  private async disposeNativeLayer(native: NasaLayerNative): Promise<void> {
    switch (native.kind) {
      case "terrain":
        this.scene.Terrain.remove(native.view);
        return;
      case "s111":
        this.scene.S111.remove(native.view);
        return;
      case "map":
        this.scene.Map.remove(native.view);
        return;
      case "vessel":
        this.scene.VesselFeature.remove(native.view);
        return;
      case "model":
        this.scene.CustomModels.remove(native.view);
        return;
      case "simulated-water-level":
        return;
    }
  }

  private getNativeLayer(handle: EngineLayerHandle): NasaLayerNative {
    const native = this.layers.get(handle) ?? handle.native;
    if (isNasaLayerNative(native)) {
      return native;
    }

    throw new S100Error("layer-not-found", `NASA-AMMOS layer '${handle.id ?? "<unknown>"}' not found.`);
  }
}

function isNasaLayerNative(value: unknown): value is NasaLayerNative {
  return Boolean(value && typeof value === "object" && "kind" in value && "spec" in value);
}

function tupleCameraPoseToObjectPose(pose: {
  position: [number, number, number];
  rotation: [number, number, number, number];
  focalDistance?: number;
}): EngineCameraPose {
  return {
    position: {
      x: pose.position[0],
      y: pose.position[1],
      z: pose.position[2],
    },
    rotation: {
      x: pose.rotation[0],
      y: pose.rotation[1],
      z: pose.rotation[2],
      w: pose.rotation[3],
    },
    ...(pose.focalDistance !== undefined
      ? { focalDistance: pose.focalDistance }
      : {}),
  };
}

function getHtmlElement(container: unknown): HTMLElement | null {
  if (container && typeof container === "object" && "appendChild" in container) {
    return container as HTMLElement;
  }
  return null;
}

function getProjectedOrigin(options: SceneOptions): Vec3 | undefined {
  if (options.georeference?.mode !== "projected-local") {
    return undefined;
  }

  const origin = coordinateToVec3(options.georeference.origin);
  return { x: origin.x, y: origin.y, z: origin.z };
}

function coordinateToVec3(coordinate: Coordinate): Vec3 {
  if (coordinate.kind === "projected" || coordinate.kind === "ecef" || coordinate.kind === "engine-local") {
    return {
      x: coordinate.x,
      y: coordinate.y,
      z: coordinate.z ?? 0,
    };
  }

  return {
    x: coordinate.lon,
    y: coordinate.lat,
    z: coordinate.height ?? 0,
  };
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
      `Layer '${spec.id}' must use a '${kind}' source for NASA-AMMOS.`,
      spec,
    );
  }
}

function buildAdditionalUrlParameters(spec: S102BathymetryLayerSpec): string {
  const legacyAdditionalURLParameters = getNasaAmmosExtension<string>(
    spec,
    "additionalURLParameters",
  );
  if (legacyAdditionalURLParameters !== undefined) {
    return normalizeQueryString(legacyAdditionalURLParameters);
  }

  const source = spec.source;
  const params = new URLSearchParams();
  if (source.crs) {
    params.set("crs", source.crs);
  }
  if (source.verticalDatum) {
    params.set("verticalDatum", source.verticalDatum);
  }
  for (const [key, value] of Object.entries(source.query ?? {})) {
    params.set(key, String(value));
  }
  return params.toString();
}

function normalizeQueryString(value: string): string {
  return value.trim().replace(/^[?&]+/, "");
}

function getAuthorizationBearer(source: ThreeDTilesSource): string | undefined {
  const authorization = source.headers?.Authorization ?? source.headers?.authorization;
  if (!authorization) {
    return undefined;
  }

  return authorization.replace(/^Bearer\s+/iu, "");
}

function applyTerrainStyle(view: TerrainView, spec: S102BathymetryLayerSpec): void {
  const style = spec.style;
  if (!style) {
    return;
  }

  if (typeof style.unsafeDepth === "number") {
    view.terrain.unsafeDepth = style.unsafeDepth;
  }
  if (typeof style.seaLevel === "number") {
    view.terrain.seaLevel = style.seaLevel;
  }
  if (style.contours) {
    view.terrain.showContour = style.contours.visible;
    view.terrain.seaContour = style.contours.visible;
    if (typeof style.contours.intervalMeters === "number") {
      view.terrain.contourInterval = style.contours.intervalMeters;
    }
  }
}

function applyS111Style(view: S111View, spec: S111SurfaceCurrentLayerSpec): void {
  const scale = spec.style?.scale ?? spec.style?.speedScale;
  if (typeof scale === "number") {
    view.disableAutoScaling = true;
    view.setCustomScale(scale);
  } else if (scale === "auto") {
    view.disableAutoScaling = false;
  }
}

function applyVisibility(
  view: { setVisibility?: (visible: boolean) => void; visible?: boolean },
  visible: boolean | undefined,
): void {
  if (visible === undefined) {
    return;
  }
  if (view.setVisibility) {
    view.setVisibility(visible);
  } else {
    view.visible = visible;
  }
}

function createMapSpecification(
  spec: EncLayerSpec | MapOverlayLayerSpec,
  georeference: { crs?: string; origin?: Vec3 },
): MapSpecification {
  const nativeSpec = spec.projectedMap ?? getNasaAmmosExtension<MapSpecification>(spec, "mapSpecification");
  if (nativeSpec) {
    return withMapOriginOffset(
      {
        ...nativeSpec,
        ...getMapAlphaOptions(spec),
      },
      spec,
      georeference,
    );
  }

  const extents = getProjectedExtents(spec);
  const source = spec.source;
  const minLevel = getNumberExtension(spec, "minLevel", 0);
  const maxLevel = getNumberExtension(spec, "maxLevel", 18);
  const originOffset = getMapOriginOffset(spec, georeference);

  const mapSpecification: MapSpecification = {
    id: spec.id,
    type: getMapLayerType(spec),
    corners: {
      upperLeft: [extents.minX, extents.maxY],
      upperRight: [extents.maxX, extents.maxY],
      lowerLeft: [extents.minX, extents.minY],
      lowerRight: [extents.maxX, extents.minY],
    },
    dataset: {
      mapSubset: {
        min: [extents.minX, extents.minY],
        max: [extents.maxX, extents.maxY],
      },
      extents,
      minLevel,
      maxLevel,
    },
    ...getMapAlphaOptions(spec),
    urlTemplate: createMapUrlTemplate(source),
  };
  if (originOffset !== undefined) {
    mapSpecification.originOffset = originOffset;
  }
  return mapSpecification;
}

function withMapOriginOffset(
  specification: MapSpecification,
  spec: EncLayerSpec | MapOverlayLayerSpec,
  georeference: { crs?: string; origin?: Vec3 },
): MapSpecification {
  const originOffset = getMapOriginOffset(spec, georeference);
  if (originOffset === undefined) {
    return specification;
  }
  return {
    ...specification,
    originOffset,
  };
}

function getMapAlphaOptions(
  spec: EncLayerSpec | MapOverlayLayerSpec,
): Pick<MapSpecification, "alphaMode" | "alphaCutoff"> {
  const style = spec.style as { alphaMode?: unknown; alphaCutoff?: unknown } | undefined;
  const alphaMode = normalizeMapAlphaMode(style?.alphaMode);
  const alphaCutoff = normalizeMapAlphaCutoff(style?.alphaCutoff, alphaMode);
  return {
    ...(alphaMode !== undefined ? { alphaMode } : {}),
    ...(alphaCutoff !== undefined ? { alphaCutoff } : {}),
  };
}

function normalizeMapAlphaMode(value: unknown): MapSpecification["alphaMode"] {
  return value === "binary" || value === "source" ? value : undefined;
}

function normalizeMapAlphaCutoff(
  value: unknown,
  alphaMode: MapSpecification["alphaMode"],
): number | undefined {
  if (alphaMode !== "binary") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.01;
  }
  return Math.max(0, Math.min(1, value));
}

function getMapOriginOffset(
  spec: EncLayerSpec | MapOverlayLayerSpec,
  georeference: { crs?: string; origin?: Vec3 },
): [number, number, number] | undefined {
  const origin = georeference.origin;
  const sceneCrs = georeference.crs;
  if (!origin || !sceneCrs) {
    return undefined;
  }

  const mapCrs = spec.projectedMap?.dataset.extents.crs ?? spec.spatialExtent?.crs ?? spec.source.crs;
  if (mapCrs !== undefined && mapCrs.toUpperCase() !== sceneCrs.toUpperCase()) {
    return undefined;
  }

  return [-origin.x, -origin.y, -origin.z];
}

function getS111OriginOffset(
  spec: S111SurfaceCurrentLayerSpec,
  georeference: { crs?: string; origin?: Vec3 },
): [number, number, number] | undefined {
  const origin = georeference.origin;
  const sceneCrs = georeference.crs;
  if (!origin || !sceneCrs) {
    return undefined;
  }

  const sourceCrs = spec.source.crs;
  if (sourceCrs !== undefined && sourceCrs.toUpperCase() !== sceneCrs.toUpperCase()) {
    return undefined;
  }

  return [-origin.x, -origin.y, -origin.z];
}

function getMapLayerType(spec: EncLayerSpec | MapOverlayLayerSpec): MapLayerType {
  if (spec.product === "map-overlay" && spec.role === "mask") {
    return MapLayerType.MaskLayer;
  }
  if (spec.role === "basemap") {
    return MapLayerType.Base;
  }
  return MapLayerType.BaseTransparent;
}

function getProjectedExtents(spec: EncLayerSpec | MapOverlayLayerSpec): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const extension = getNasaAmmosExtension<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }>(spec, "extents");
  if (extension) {
    return extension;
  }

  const extent = spec.spatialExtent;
  if (
    extent?.minX !== undefined &&
    extent.maxX !== undefined &&
    extent.minY !== undefined &&
    extent.maxY !== undefined
  ) {
    return {
      minX: extent.minX,
      maxX: extent.maxX,
      minY: extent.minY,
      maxY: extent.maxY,
    };
  }

  throw new S100Error(
    "invalid-layer-spec",
    `NASA-AMMOS map layer '${spec.id}' requires projected spatialExtent minX/minY/maxX/maxY or extensions.nasaAmmos.extents.`,
    spec,
  );
}

function createMapUrlTemplate(
  source: WmsSource | WmsTemplateSource | WmtsSource | StaticJsonSource | { kind: "mvt"; urlTemplate: string },
): string {
  if (source.kind === "wms") {
    return createWmsUrlTemplate(source);
  }
  if (source.kind === "wms-template") {
    return source.urlTemplate;
  }
  if (source.kind === "wmts") {
    return createWmtsUrlTemplate(source);
  }
  if (source.kind === "mvt") {
    return source.urlTemplate;
  }

  throw new S100Error(
    "invalid-layer-spec",
    `NASA-AMMOS map layers require WMS, WMS template, WMTS, or MVT sources; received '${source.kind}'.`,
    source,
  );
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

  return appendQuery(source.url, params);
}

function createWmtsUrlTemplate(source: WmtsSource): string {
  const params = new URLSearchParams();
  params.set("SERVICE", "WMTS");
  params.set("REQUEST", "GetTile");
  params.set("LAYER", source.layer);
  params.set("STYLE", source.style ?? "default");
  params.set("TILEMATRIXSET", source.tileMatrixSet);
  params.set("TILEMATRIX", "{z}");
  params.set("TILEROW", "{y}");
  params.set("TILECOL", "{x}");
  params.set("FORMAT", source.format ?? "image/png");
  for (const [key, value] of Object.entries(source.parameters ?? {})) {
    params.set(key, String(value));
  }

  return appendQuery(source.url, params);
}

function appendQuery(url: string, params: URLSearchParams): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${params.toString()}`;
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

  const init: RequestInit = {
    method: source.method ?? "GET",
  };
  if (source.headers !== undefined) {
    init.headers = source.headers;
  }
  if (source.body !== undefined) {
    init.body = JSON.stringify(source.body);
  }
  if (source.credentials !== undefined) {
    init.credentials = source.credentials;
  }

  const response = await fetchImpl(source.url, init);

  if (!response.ok) {
    throw new S100Error(
      "invalid-layer-spec",
      `Failed to load REST JSON source '${source.url}': ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
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

function getVesselDimensions(spec: VesselLayerSpec): VesselDimensions {
  const semantic: Partial<VesselDimensions> = spec.dimensions ?? {};
  const extension = getNasaAmmosExtension<Partial<VesselDimensions>>(spec, "dimensions") ?? {};
  const draught = semantic.draught ?? extension.draught ?? spec.style?.draughtMeters ?? 7;

  return {
    draught,
    bow: semantic.bow ?? extension.bow ?? 100,
    stern: semantic.stern ?? extension.stern ?? 100,
    port: semantic.port ?? extension.port ?? 20,
    starboard: semantic.starboard ?? extension.starboard ?? 20,
  };
}

function getVesselModel(spec: VesselLayerSpec): Partial<ModelAssetSpecification> {
  return spec.model ?? getNasaAmmosExtension<Partial<ModelAssetSpecification>>(spec, "model") ?? {};
}

function getVesselTransformGizmoVerticalPositionLimits(
  spec: VesselLayerSpec,
) {
  const transformGizmo = spec.style?.transformGizmo;
  if (!transformGizmo || typeof transformGizmo !== "object") {
    return undefined;
  }
  return transformGizmo.verticalPositionLimits;
}

function applyVesselPresentation(view: VesselView, spec: VesselLayerSpec): void {
  const seaLevelIndicator = spec.rendering?.seaLevelIndicator ?? spec.style?.showSeaLevelIndicator;
  view.seaLevelIndicator.mode = seaLevelIndicator !== false
    ? SeaLevelIndicatorMode.Circle
    : SeaLevelIndicatorMode.Off;
  view.seaLevelIndicator.seaSurfaceVisible = getVesselOceanSurfaceEnabled(spec);
  applyVesselShadowPresentation(view, spec);
}

function getVesselOceanSurfaceEnabled(spec: VesselLayerSpec): boolean {
  if (typeof spec.rendering?.oceanSurfaceVisible === "boolean") {
    return spec.rendering.oceanSurfaceVisible;
  }
  if (typeof spec.style?.oceanSurface === "boolean") {
    return spec.style.oceanSurface;
  }
  if (typeof spec.style?.oceanSurface === "object") {
    return spec.style.oceanSurface.enabled ?? false;
  }
  if (typeof spec.style?.showOceanSurface === "boolean") {
    return spec.style.showOceanSurface;
  }
  return getBooleanExtension(spec, "seaSurfaceVisible", false);
}

function getVesselShadowEnabled(spec: VesselLayerSpec): boolean {
  if (typeof spec.rendering?.shadowVisible === "boolean") {
    return spec.rendering.shadowVisible;
  }
  if (typeof spec.style?.shadow === "boolean") {
    return spec.style.shadow;
  }
  if (typeof spec.style?.shadow === "object") {
    return spec.style.shadow.enabled ?? true;
  }
  return getBooleanExtension(spec, "verticalShadow", true);
}

function applyVesselShadowPresentation(view: VesselView, spec: VesselLayerSpec): void {
  const candidate = view as unknown as {
    setVerticalShadowVisible?: (visible: boolean) => void;
    verticalShadowControl?: { visible?: boolean; setVisible?: (visible: boolean) => void };
    verticalShadow?: { visible?: boolean; setVisible?: (visible: boolean) => void };
  };
  const visible = getVesselShadowEnabled(spec);
  if (typeof candidate.setVerticalShadowVisible === "function") {
    candidate.setVerticalShadowVisible(visible);
    return;
  }
  if (candidate.verticalShadowControl?.setVisible) {
    candidate.verticalShadowControl.setVisible(visible);
    return;
  }
  if (candidate.verticalShadowControl) {
    candidate.verticalShadowControl.visible = visible;
    return;
  }
  if (candidate.verticalShadow?.setVisible) {
    candidate.verticalShadow.setVisible(visible);
    return;
  }
  if (candidate.verticalShadow) {
    candidate.verticalShadow.visible = visible;
  }
}

function getNasaAmmosExtension<T>(spec: BaseLayerSpec, key: string): T | undefined {
  const extension = spec.extensions?.nasaAmmos;
  if (!extension || typeof extension !== "object") {
    return undefined;
  }
  return (extension as Record<string, unknown>)[key] as T | undefined;
}

function getS102DetailFactor(spec: S102BathymetryLayerSpec): number {
  return spec.rendering?.detailFactor ?? getNumberExtension(spec, "detailFactor", 1);
}

function getNumberExtension(spec: BaseLayerSpec, key: string, fallback: number): number {
  const value = getNasaAmmosExtension<unknown>(spec, key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getBooleanExtension(spec: BaseLayerSpec, key: string, fallback: boolean): boolean {
  const value = getNasaAmmosExtension<unknown>(spec, key);
  return typeof value === "boolean" ? value : fallback;
}

function applyPickingRayVisualOptions(
  pickingRay: {
    lineThickness: number;
    ray: {
      belowSeaLevelColor: [number, number, number];
      aboveSeaLevelColor: [number, number, number];
      seaLevelMarkerVisible: boolean;
      seaLevelMarkerSize: number;
      seaLevelMarkerOpacity: number;
      seaLevelMarkerColor: [number, number, number];
    };
  },
  visual: LivePickingOptions["visual"] | undefined,
): void {
  if (!visual) {
    return;
  }

  if (visual.lineThickness !== undefined) {
    pickingRay.lineThickness = visual.lineThickness;
  }
  if (visual.belowSeaLevelColor !== undefined) {
    pickingRay.ray.belowSeaLevelColor = [...visual.belowSeaLevelColor];
  }
  if (visual.aboveSeaLevelColor !== undefined) {
    pickingRay.ray.aboveSeaLevelColor = [...visual.aboveSeaLevelColor];
  }
  if (visual.seaLevelMarkerVisible !== undefined) {
    pickingRay.ray.seaLevelMarkerVisible = visual.seaLevelMarkerVisible;
  }
  if (visual.seaLevelMarkerSize !== undefined) {
    pickingRay.ray.seaLevelMarkerSize = visual.seaLevelMarkerSize;
  }
  if (visual.seaLevelMarkerOpacity !== undefined) {
    pickingRay.ray.seaLevelMarkerOpacity = visual.seaLevelMarkerOpacity;
  }
  if (visual.seaLevelMarkerColor !== undefined) {
    pickingRay.ray.seaLevelMarkerColor = [...visual.seaLevelMarkerColor];
  }
}

function legacyPickToPickResult(pick: PickedInfo): PickResult | null {
  if (!pick.isValid || pick.source === "none") {
    return null;
  }

  const result: PickResult = {
    screen: { x: 0, y: 0 },
    world: {
      kind: "engine-local",
      x: pick.xyz[0],
      y: pick.xyz[1],
      z: pick.xyz[2],
      frameId: "nasa-ammos",
    },
    source: pick.source === "sea-level-plane" ? "sea-level-plane" : "geometry",
    native: pick.entity ?? pick.view,
  };
  if (pick.hasDepth) {
    result.depthMeters = pick.xyz[2] - (pick.seaLevel ?? 0);
  }
  return result;
}

function applyNasaBackground(renderContext: NasaRenderContext, state: EnvironmentState): void {
  const { renderer, scene } = renderContext;
  const backgroundIntensity = normalizeOptionalPositiveNumber(state.backgroundIntensity);
  if (backgroundIntensity !== null) {
    scene.backgroundIntensity = backgroundIntensity;
  }

  if (state.background === "transparent") {
    scene.background = null;
    scene.environment = null;
    renderer.setClearColor(new Color(0x000000), 0);
    return;
  }

  if (state.background === "solid") {
    const color = new Color(0x102033);
    scene.background = color;
    scene.environment = null;
    renderer.setClearColor(color, 1);
    return;
  }

  if (state.background === "skybox") {
    renderer.setClearColor(new Color(0x102033), 1);
  }
}

function applyNasaLighting(scene: Scene, lighting: EnvironmentState["lighting"]): void {
  if (!lighting) {
    return;
  }

  const ambientIntensity = normalizeOptionalPositiveNumber(lighting.ambientIntensity);
  if (ambientIntensity !== null) {
    getOrCreateAmbientLight(scene).intensity = ambientIntensity;
  }

  const directionalIntensity = normalizeOptionalPositiveNumber(lighting.directionalIntensity);
  const sunDirection = lighting.sunDirection;
  if (directionalIntensity !== null || sunDirection !== undefined) {
    const directionalLight = getOrCreateDirectionalLight(scene);
    if (directionalIntensity !== null) {
      directionalLight.intensity = directionalIntensity;
    }
    if (sunDirection !== undefined) {
      const direction = new Vector3(sunDirection.x, sunDirection.y, sunDirection.z);
      if (direction.lengthSq() > 0) {
        directionalLight.position.copy(direction.normalize().multiplyScalar(1000));
      }
    }
  }

  const environmentIntensity = normalizeOptionalPositiveNumber(lighting.environmentIntensity);
  if (environmentIntensity !== null) {
    scene.environmentIntensity = environmentIntensity;
  }
}

function applyNasaEnvironmentTexture(
  renderContext: NasaRenderContext,
  backgroundTexture: Texture,
  environmentTexture: Texture,
  state: EnvironmentState,
): void {
  renderContext.scene.background = backgroundTexture;
  renderContext.scene.environment = environmentTexture;
  renderContext.scene.backgroundIntensity = normalizePositiveNumber(
    state.backgroundIntensity,
    renderContext.scene.backgroundIntensity,
  );
  renderContext.scene.environmentIntensity = normalizePositiveNumber(
    state.lighting?.environmentIntensity,
    renderContext.scene.environmentIntensity,
  );
  renderContext.renderer.setClearColor(new Color(0x102033), 1);
}

function isHdrEnvironmentMap(url: string): boolean {
  return /\.hdr(?:[?#].*)?$/i.test(url);
}

function getOrCreateAmbientLight(scene: Scene): AmbientLight {
  const existing = scene.children.find((child): child is AmbientLight => child instanceof AmbientLight);
  if (existing) {
    return existing;
  }

  const light = new AmbientLight(0xffffff, 0);
  scene.add(light);
  return light;
}

function getOrCreateDirectionalLight(scene: Scene): DirectionalLight {
  const existing = scene.children.find((child): child is DirectionalLight => child instanceof DirectionalLight);
  if (existing) {
    return existing;
  }

  const light = new DirectionalLight(0xffffff, 0);
  light.position.set(150, -200, 300);
  scene.add(light);
  return light;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const normalized = normalizeOptionalPositiveNumber(value);
  return normalized ?? fallback;
}

function normalizeOptionalPositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function getRenderContext(scene: ViewerScene): NasaRenderContext | null {
  const fromCoreScene = (scene as unknown as { coreScene?: { renderContext?: NasaRenderContext | null } })
    .coreScene?.renderContext;
  if (fromCoreScene) {
    return fromCoreScene;
  }

  return (
    (scene as unknown as { renderContext?: NasaRenderContext | null }).renderContext ??
    null
  );
}

function getCanvasPointer(request: PickRequest, canvas: HTMLCanvasElement): Vector2 {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.clientWidth || canvas.width || 1;
  const height = rect.height || canvas.clientHeight || canvas.height || 1;
  return new Vector2(
    ((request.screenX - rect.left) / width) * 2 - 1,
    -(((request.screenY - rect.top) / height) * 2 - 1),
  );
}

function getPickableSceneRoots(scene: Object3D): Object3D[] {
  const roots: Object3D[] = [];
  for (const child of scene.children) {
    if (isPickableObject(child)) {
      roots.push(child);
      continue;
    }
    const nested = findPickableDescendants(child);
    roots.push(...nested);
  }
  return roots;
}

function findPickableDescendants(root: Object3D): Object3D[] {
  const pickable: Object3D[] = [];
  root.traverse((object) => {
    if (object !== root && isPickableObject(object)) {
      pickable.push(object);
    }
  });
  return pickable;
}

function getPickableRootForObject(object: Object3D): Object3D | null {
  let current: Object3D | null = object;
  while (current) {
    if (isPickableObject(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function isPickableObject(object: Object3D): boolean {
  return object.userData.s100Pickable === true;
}

function hasUnpickableAncestor(object: Object3D, stopAt: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.s100Unpickable === true) {
      return true;
    }
    if (current === stopAt) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

function getSeaLevelRayPoint(raycaster: Raycaster, seaLevel: number): Vector3 | null {
  const zUp = new Vector3(0, 0, 1);
  const denominator = raycaster.ray.direction.dot(zUp);
  if (Math.abs(denominator) < 1e-6) {
    return null;
  }

  const distance = (seaLevel - raycaster.ray.origin.z) / denominator;
  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  return raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, distance);
}

export type { PickedInfo };
