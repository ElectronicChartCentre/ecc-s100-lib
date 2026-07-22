import {
  S100Error,
  type EngineHandleBundle,
  type EngineScene,
  type EngineViewerHost,
  type SceneOptions,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import { S100NasaViewer, type Vec3 } from "../runtime/index.js";
import { ViewerScene } from "../runtime/compat/s100-viewer.js";
import { getProjectedOrigin } from "../coordinates/projectedLocal.js";
import type { NasaAmmosAdapterOptions } from "../options.js";
import { NasaAmmosEngineScene } from "./NasaAmmosEngineScene.js";

export class NasaAmmosViewerHost implements EngineViewerHost {
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
