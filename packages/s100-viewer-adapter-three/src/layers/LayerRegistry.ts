import {
  S100Error,
  type BaseLayerSpec,
  type EngineLayerHandle,
  type LayerPatch,
  type WaterLevelFieldSource,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import type { FetchLike } from "../options.js";
import type { ThreeProjectedLocalReference } from "../coordinates/projectedLocal.js";
import type { ThreeLayerNative } from "./types.js";
import {
  loadThreeMapLayerModule,
  loadThreeRoutePlanLayerModule,
  loadThreeS102TilesLayerModule,
  loadThreeS111LayerModule,
  loadThreeSimulatedWaterLevelLayerModule,
  loadThreeVesselLayerModule,
} from "../adapter/layerModules.js";

export class LayerRegistry {
  private readonly layers = new Map<EngineLayerHandle, ThreeLayerNative>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly reference: ThreeProjectedLocalReference,
    private readonly fetchHandler: FetchLike | undefined,
    private readonly getSeaLevel: () => number,
    private readonly setSeaLevel: (value: number, source?: WaterLevelFieldSource) => void,
    private readonly setCameraInteractionSuppressed: (suppressed: boolean) => void,
  ) {}

  async addLayer(spec: BaseLayerSpec): Promise<EngineLayerHandle> {
    const native = await this.createNativeLayer(spec);
    const handle: EngineLayerHandle = {
      id: spec.id,
      native,
      dispose: async () => {
        await native.dispose();
      },
    };
    this.layers.set(handle, native);
    return handle;
  }

  async updateLayer(handle: EngineLayerHandle, patch: LayerPatch): Promise<void> {
    const native = this.getNativeLayer(handle);
    Object.assign(native.spec, patch);
    if (patch.visible !== undefined) {
      native.setVisible?.(patch.visible);
    }
    if (patch.opacity !== undefined) {
      native.setOpacity?.(patch.opacity);
    }
    await native.patch?.(patch);
  }

  async removeLayer(handle: EngineLayerHandle): Promise<void> {
    const native = this.getNativeLayer(handle);
    await native.dispose();
    this.layers.delete(handle);
  }

  update(time: Date): void {
    for (const native of this.layers.values()) {
      native.update?.(time);
    }
  }

  getPickableObjects(): THREE.Object3D[] {
    return [...this.layers.values()].flatMap((native) => native.getPickableObjects?.() ?? []);
  }

  async destroy(): Promise<void> {
    for (const native of this.layers.values()) {
      await native.dispose();
    }
    this.layers.clear();
  }

  private async createNativeLayer(spec: BaseLayerSpec): Promise<ThreeLayerNative> {
    if (spec.product === "S-101" || spec.product === "S-57" || spec.product === "map-overlay") {
      const { createMapLayer } = await loadThreeMapLayerModule();
      return createMapLayer(spec, this.scene, this.reference);
    }

    if (spec.product === "S-102") {
      const { createS102TilesLayer } = await loadThreeS102TilesLayerModule();
      return createS102TilesLayer(
        spec,
        this.scene,
        this.camera,
        this.renderer,
        this.reference,
        this.getSeaLevel,
      );
    }

    if (spec.product === "S-111") {
      const { createS111SurfaceCurrentLayer } = await loadThreeS111LayerModule();
      return createS111SurfaceCurrentLayer(
        spec,
        this.scene,
        this.reference,
        this.fetchHandler,
        this.getSeaLevel,
      );
    }

    if (spec.product === "vessel") {
      const { createVesselLayer } = await loadThreeVesselLayerModule();
      return createVesselLayer(
        spec,
        this.scene,
        this.reference,
        this.getSeaLevel,
        this.camera,
        this.renderer.domElement,
        this.setCameraInteractionSuppressed,
      );
    }

    if (spec.product === "route-plan") {
      const { createRoutePlanLayer } = await loadThreeRoutePlanLayerModule();
      return createRoutePlanLayer(spec, this.scene, this.reference);
    }

    if (spec.product === "simulated-water-level") {
      const { createSimulatedWaterLevelLayer } =
        await loadThreeSimulatedWaterLevelLayerModule();
      return createSimulatedWaterLevelLayer(spec, this.getSeaLevel, this.setSeaLevel);
    }

    throw new S100Error(
      "adapter-capability",
      `Three.js reference adapter does not support layer product '${spec.product}'.`,
      spec,
    );
  }

  private getNativeLayer(handle: EngineLayerHandle): ThreeLayerNative {
    const native = this.layers.get(handle);
    if (!native) {
      throw new S100Error("invalid-layer-spec", "Unknown Three.js layer handle.", handle);
    }
    return native;
  }
}
