import { describe, expect, it } from "vitest";
import { CameraControlPresets, createS100Viewer, LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
import {
  cesiumAdapterCapabilities,
  createCesiumAdapter,
} from "../src/index.js";
import {
  createMockCesium,
  createMockContainer,
  dispatchScreenSpace,
} from "./fixtures/mockCesium.js";

describe("@ecc/s100-viewer-adapter-cesium capabilities", () => {
  it("reports globe-native S-100 capabilities", () => {
    expect(cesiumAdapterCapabilities.sceneGeoreferences).toContain("ellipsoid-ecef");
    expect(cesiumAdapterCapabilities.layerProducts).toContain("S-102");
    expect(cesiumAdapterCapabilities.supportedProductVersions?.length).toBeGreaterThan(0);
    expect(cesiumAdapterCapabilities.visualFeatures).toMatchObject({
      depthRay: true,
      hoverPrism: true,
      vesselOceanSurface: expect.objectContaining({ supported: true }),
      vesselShadow: expect.objectContaining({ supported: true }),
      dynamicLighting: expect.objectContaining({ supported: true }),
    });
  });

  it("renders at full device-pixel resolution by default", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });

    expect(viewer.getEngineHandles()).toMatchObject({
      adapterId: "cesium",
      engineName: "Cesium",
      engineInstance: expect.any(Object),
      instances: {
        viewer: expect.any(Object),
        scene: expect.any(Object),
        camera: expect.any(Object),
      },
      staticObjects: {
        Cesium: cesium,
      },
      resources: {
        cesiumDocs: "https://cesium.com/learn/cesiumjs/ref-doc/",
      },
    });
    expect(cesium.operations.viewerOptions[0]).toMatchObject({
      skyBox: false,
      useBrowserRecommendedResolution: false,
    });
    await viewer.destroy();

    const overrideCesium = createMockCesium();
    const overrideViewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({
        cesiumModule: overrideCesium,
        viewerOptions: { useBrowserRecommendedResolution: true },
      }),
    });

    expect(overrideCesium.operations.viewerOptions[0]).toMatchObject({
      useBrowserRecommendedResolution: true,
    });
    await overrideViewer.destroy();
  });

  it("patches nonconstructible browser Image globals on the viewer window", async () => {
    const cesium = createMockCesium();
    const createdImages: Array<{ tagName: string; width?: number; height?: number; src: string }> = [];
    function HTMLImageElement() {
      throw new TypeError("Illegal constructor");
    }
    const ownerWindow = {
      HTMLImageElement,
      Image: HTMLImageElement as unknown as new (width?: number, height?: number) => {
        height?: number;
        src: string;
        tagName: string;
        width?: number;
      },
    };
    const ownerDocument = {
      defaultView: ownerWindow,
      createElement(tagName: string) {
        const image = { tagName, src: "" };
        createdImages.push(image);
        return image;
      },
    };
    const viewer = await createS100Viewer({
      container: {
        ownerDocument,
        appendChild() {
          return undefined;
        },
      } as unknown as HTMLElement,
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });

    const image = new ownerWindow.Image(12, 13);
    expect(image).toMatchObject({ tagName: "img", width: 12, height: 13 });
    expect(createdImages).toHaveLength(1);
    await viewer.destroy();
  });
});
