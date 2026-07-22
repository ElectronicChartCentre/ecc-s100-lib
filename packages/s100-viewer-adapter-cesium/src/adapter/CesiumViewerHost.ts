import {
  S100Error,
  type EngineHandleBundle,
  type EngineScene,
  type EngineViewerHost,
  type SceneOptions,
  type ViewerHostOptions,
} from "@ecc/s100-viewer";
import {
  CesiumEngineScene,
} from "./CesiumEngineScene.js";
import {
  createEngineVersionFields,
  getCesiumConstructor,
  getObject,
} from "../cesium/object.js";
import { destroyCesiumObject } from "../cesium/lifecycle.js";
import type {
  CesiumAdapterOptions,
  CesiumModule,
  CesiumObject,
} from "./types.js";

export class CesiumViewerHost implements EngineViewerHost {
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
      skyBox: false,
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
