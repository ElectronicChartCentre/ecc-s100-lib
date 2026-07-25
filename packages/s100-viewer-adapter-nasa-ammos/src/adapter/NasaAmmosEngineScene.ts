import {
  S100Error,
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
  type EnvironmentState,
  type LayerPatch,
  type LivePickingOptions,
  type PickRequest,
  type PickResult,
  type RoutePlanLayerSpec,
  type MapOverlayLayerSpec,
  type S102BathymetryLayerSpec,
  type S111SurfaceCurrentLayerSpec,
  type SimulatedWaterLevelLayerSpec,
  type VesselLayerSpec,
} from "@ecc/s100-viewer";
import { depthFromElevation } from "@ecc/s100-viewer/internal/products/depthStyle";
import type { Vec3 } from "../runtime/index.js";
import type {
  NasaSceneRuntime,
  SurfaceCurrentDataset,
} from "../runtime/scene/NasaSceneRuntime.js";
import * as THREE from "three";
import type { NasaAmmosAdapterOptions } from "../options.js";
import {
  type NasaLayerNative,
  type NasaRenderContext,
  type NasaSceneGeoreference,
  isNasaLayerNative,
} from "./layerNativeTypes.js";
import { tupleCameraPoseToObjectPose } from "../camera/cameraPose.js";
import { coordinateToVec3 } from "../coordinates/projectedLocal.js";
import {
  applyNasaBackground,
  applyNasaEquirectangularEnvironmentTexture,
  applyNasaEnvironmentTexture,
  applyNasaLighting,
  isHdrEnvironmentMap,
} from "../environment/environmentController.js";
import { resolveWaterLevel } from "../layers/simulatedWaterLevelLayer.js";
import {
  applyPickingRayVisualOptions,
  getCanvasPointer,
  getPickableRootForObject,
  getPickableSceneRoots,
  getSeaLevelRayPoint,
  getS100PickValues,
  hasUnpickableAncestor,
  legacyPickToPickResult,
  pickValuesToResultFields,
} from "../picking/pickConversion.js";
import { getNasaAmmosExtension } from "../shared/extensions.js";
import { getRenderContext } from "../shared/nativeHandles.js";
import { assertSourceKind, loadJsonSource } from "../shared/source.js";
import { applyVisibility } from "../shared/visibility.js";
import {
  loadNasaMapLayerModule,
  loadNasaRoutePlanLayerModule,
  loadNasaS102TerrainLayerModule,
  loadNasaS111SurfaceCurrentLayerModule,
  loadNasaVesselLayerModule,
} from "./layerModules.js";
import {
  CubeTextureLoader,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  Raycaster,
  TextureLoader,
  type Texture,
} from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const SIMULATED_WATER_LEVEL_PRODUCT = "simulated-water-level";

const createVesselPickValues = (spec: VesselLayerSpec): Record<string, unknown> => {
  const values: Record<string, unknown> = {
    layerId: spec.id,
    product: spec.product,
    featureId: spec.id,
  };
  copyRecordValues(values, spec.metadata?.values);
  copyRecordValues(values, spec.source.metadata?.values);
  if (spec.source.kind === "parametric-vessel") {
    copyRecordValues(values, spec.source.spec.metadata);
  }
  if (spec.dimensions !== undefined) {
    values.dimensions = { ...spec.dimensions };
  }
  return values;
};

const copyRecordValues = (
  target: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
): void => {
  if (source !== undefined) {
    Object.assign(target, source);
  }
};

type SubscriptionLike = {
  unsubscribe(): void;
};

export class NasaAmmosEngineScene implements EngineScene {
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
    private readonly scene: NasaSceneRuntime,
    private readonly options: NasaAmmosAdapterOptions,
    private readonly georeference: NasaSceneGeoreference,
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
    await this.applyLayerPatch(native, patch);
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
      const pickableRoot = getPickableRootForObject(hit.object);
      const pickValues = getS100PickValues(hit.object, pickableRoot);
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
        depthMeters: depthFromElevation(hit.point.z, this.scene.seaLevel),
        ...pickValuesToResultFields(pickValues),
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
        applyNasaEquirectangularEnvironmentTexture(
          renderContext,
          texture,
          environmentTexture,
          state,
        );
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
        applyNasaEquirectangularEnvironmentTexture(
          renderContext,
          texture,
          environmentTexture,
          state,
        );
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
      case "route-plan":
        return this.createRoutePlanLayer(spec as RoutePlanLayerSpec);
      default:
        throw new S100Error(
          "adapter-capability",
          `NASA-AMMOS adapter does not yet support layer product '${String(spec.product)}'.`,
          spec,
        );
    }
  }

  private async createTerrainLayer(spec: S102BathymetryLayerSpec): Promise<NasaLayerNative> {
    assertSourceKind(spec, "3d-tiles");
    const {
      applyTerrainStyle,
      buildAdditionalUrlParameters,
      getAuthorizationBearer,
      getS102DetailFactor,
    } = await loadNasaS102TerrainLayerModule();
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
    const { applyS111Style, getS111OriginOffset } = await loadNasaS111SurfaceCurrentLayerModule();
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

  private async createMapLayer(spec: EncLayerSpec | MapOverlayLayerSpec): Promise<NasaLayerNative> {
    const { createMapSpecification } = await loadNasaMapLayerModule();
    const mapSpecification = createMapSpecification(spec, this.georeference);
    const view = this.scene.Map.add(mapSpecification);
    view.alpha = spec.opacity ?? 1;
    view.setVisibility(spec.visible ?? true);

    return { kind: "map", spec, view };
  }

  private async createVesselLayer(spec: VesselLayerSpec): Promise<NasaLayerNative> {
    const {
      applyVesselPresentation,
      createVesselModelSpecification,
      getVesselDimensions,
      getVesselShadowSpecification,
      getVesselTransformGizmoVerticalPositionLimits,
    } = await loadNasaVesselLayerModule();
    const model = createVesselModelSpecification(spec);
    const verticalPositionLimits = getVesselTransformGizmoVerticalPositionLimits(spec);
    const view = this.scene.VesselFeature.add({
      model,
      dimensions: getVesselDimensions(spec),
      shadow: getVesselShadowSpecification(spec),
      ...(verticalPositionLimits !== undefined ? { verticalPositionLimits } : {}),
    });
    const position = this.coordinateToEngineVec3(spec.pose.position);
    view.setPosition([position.x, position.y, position.z]);
    view.setHeading(spec.pose.headingDegrees ?? 0);
    view.setVisibility(spec.visible ?? true);
    view.modelView.group.userData.s100Pickable = true;
    view.modelView.group.userData.s100PickMetadata = createVesselPickValues(spec);
    applyVesselPresentation(view, spec);

    return { kind: "vessel", spec, view };
  }

  private async createRoutePlanLayer(spec: RoutePlanLayerSpec): Promise<NasaLayerNative> {
    assertSourceKind(spec, "route-plan");
    const { createRoutePlanView } = await loadNasaRoutePlanLayerModule();
    const renderContext = getRenderContext(this.scene);
    const view = createRoutePlanView(spec, renderContext?.scene);
    view.setVisibility(spec.visible ?? spec.style.visible ?? true);
    view.setOpacity(spec.opacity ?? spec.style.opacity ?? 1);

    return { kind: "route-plan", spec, view };
  }

  private async applyLayerPatch(native: NasaLayerNative, patch: LayerPatch): Promise<void> {
    if (native.kind === "terrain") {
      const { applyTerrainStyle } = await loadNasaS102TerrainLayerModule();
      applyTerrainStyle(native.view, native.spec);
      applyVisibility(native.view, patch.visible);
      return;
    }

    if (native.kind === "s111") {
      const { applyS111Style } = await loadNasaS111SurfaceCurrentLayerModule();
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
      const {
        applyVesselPresentation,
        getVesselDimensions,
        getVesselTransformGizmoVerticalPositionLimits,
      } = await loadNasaVesselLayerModule();
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

    if (native.kind === "route-plan") {
      native.view.update(native.spec, patch as LayerPatch<RoutePlanLayerSpec>);
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
      case "route-plan":
        native.view.dispose();
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
