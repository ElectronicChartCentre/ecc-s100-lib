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

describe("@ecc/s100-viewer-adapter-cesium map layer", () => {
  it("renders projected compatibility WMS maps as scene rectangles", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });
    const extent = {
      crs: "EPSG:32619",
      minX: 331100,
      minY: 5186420,
      maxX: 332100,
      maxY: 5187420,
    };

    await scene.layers.add(
      LayerBuilder.createS101Wms({
        id: "basemap",
        url: "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&SRS=EPSG:32619",
        layers: ["cells"],
        crs: "EPSG:32619",
        visible: true,
        opacity: 0.42,
        spatialExtent: extent,
        extensions: {
          nasaAmmos: {
            mapSpecification: {
              urlTemplate:
                "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&SRS=EPSG:32619",
              dataset: {
                extents: extent,
              },
            },
          },
        },
      }),
    );

    expect(cesium.operations.imageryAdded).toHaveLength(0);
    const primitive = cesium.operations.primitivesAdded.find((value) =>
      Boolean((value as { options?: { appearance?: { options?: { material?: { uniforms?: { image?: string } } } } } }).options?.appearance?.options?.material?.uniforms?.image),
    ) as {
      options?: {
        geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } };
        appearance?: { options?: { material?: { uniforms?: { image?: string; color?: { a?: number } } } } };
      };
    };
    expect(Array.from(primitive?.options?.geometryInstances?.geometry?.attributes?.position?.values ?? [])).toEqual([
      0, 0, 0.5,
      1000, 0, 0.5,
      1000, 1000, 0.5,
      0, 1000, 0.5,
    ]);
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("WIDTH=2048");
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("HEIGHT=2048");
    await viewer.destroy();
  });

  it("renders generic projected S-101 WMS specs as local scene rectangles", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });

    await scene.layers.add(
      LayerBuilder.createS101Wms({
        id: "generic-s101",
        url: "https://example.test/wms",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        visible: true,
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 331100,
          minY: 5186420,
          maxX: 332100,
          maxY: 5187420,
        },
      }),
    );

    expect(cesium.operations.imageryAdded).toHaveLength(0);
    const primitive = cesium.operations.primitivesAdded.find((value) =>
      Boolean((value as { options?: { appearance?: { options?: { material?: { uniforms?: { image?: string } } } } } }).options?.appearance?.options?.material?.uniforms?.image),
    ) as {
      options?: {
        geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } };
        appearance?: { options?: { material?: { uniforms?: { image?: string } } } };
      };
    };
    expect(Array.from(primitive?.options?.geometryInstances?.geometry?.attributes?.position?.values ?? [])).toEqual([
      0, 0, 0.5,
      1000, 0, 0.5,
      1000, 1000, 0.5,
      0, 1000, 0.5,
    ]);
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("LAYERS=s100dataSets.101");
    expect(primitive?.options?.appearance?.options?.material?.uniforms?.image).toContain("BBOX=331100,5186420,332100,5187420");
    await viewer.destroy();
  });

  it("keeps projected WMS primitives hidden until the tile image loads", async () => {
    const previousImage = (globalThis as Record<string, unknown>).Image;
    const images: MockDeferredImage[] = [];
    class MockDeferredImage {
      crossOrigin: string | null = null;
      src = "";
      complete = false;
      naturalWidth = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private readonly listeners: Record<"load" | "error", Array<() => void>> = {
        load: [],
        error: [],
      };

      constructor() {
        images.push(this);
      }

      addEventListener(type: "load" | "error", listener: () => void) {
        this.listeners[type].push(listener);
      }

      removeEventListener(type: "load" | "error", listener: () => void) {
        this.listeners[type] = this.listeners[type].filter((registered) => registered !== listener);
      }

      emitLoad() {
        this.complete = true;
        this.naturalWidth = 512;
        this.onload?.();
        for (const listener of [...this.listeners.load]) {
          listener();
        }
      }
    }
    (globalThis as Record<string, unknown>).Image = MockDeferredImage;

    try {
      const cesium = createMockCesium();
      const viewer = await createS100Viewer({
        container: createMockContainer(),
        adapter: createCesiumAdapter({ cesiumModule: cesium }),
      });
      const scene = await viewer.createScene({
        georeference: SceneBuilder.projectedLocal({
          crs: "EPSG:32619",
          origin: { x: 331100, y: 5186420 },
        }),
      });

      await scene.layers.add(
        LayerBuilder.createS101Wms({
          id: "deferred-s101",
          url: "https://example.test/wms",
          layers: ["s100dataSets.101"],
          crs: "EPSG:32619",
          visible: true,
          spatialExtent: {
            crs: "EPSG:32619",
            minX: 331100,
            minY: 5186420,
            maxX: 332100,
            maxY: 5187420,
          },
        }),
      );

      const primitive = cesium.operations.primitivesAdded[0] as {
        show?: boolean;
        options?: { appearance?: { options?: { material?: { uniforms?: { image?: unknown } } } } };
      };
      expect(images).toHaveLength(1);
      expect(primitive.show).toBe(false);
      expect(primitive.options?.appearance?.options?.material?.uniforms?.image).toBe(images[0]);
      expect(images[0]?.crossOrigin).toBe("anonymous");

      images[0]?.emitLoad();

      expect(primitive.show).toBe(true);
      expect(cesium.operations.requestRenderCount).toBe(1);
      await viewer.destroy();
    } finally {
      if (previousImage === undefined) {
        Reflect.deleteProperty(globalThis, "Image");
      } else {
        (globalThis as Record<string, unknown>).Image = previousImage;
      }
    }
  });

  it("cuts the projected S-101 opaque basemap around the transparent S-102 reveal area", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });

    await scene.layers.add(
      LayerBuilder.createS101Wms({
        id: "s101WMS",
        role: "overlay",
        url: "https://example.test/transparent?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&IGNORE=DepthArea,DepthContour&HIDE=90010,90020",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        style: {
          alphaMode: "binary",
          alphaCutoff: 0.01,
        },
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 331100,
          minY: 5186420,
          maxX: 332100,
          maxY: 5187420,
        },
      }),
    );
    await scene.layers.add(
      LayerBuilder.createS101Wms({
        id: "s101WMSOpaque",
        role: "basemap",
        url: "https://example.test/opaque?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256&HIDE=90010,90020",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        opacity: 1,
        transparent: false,
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 330100,
          minY: 5185420,
          maxX: 333100,
          maxY: 5188420,
        },
      }),
    );

    const getPrimitiveMaterial = (value: unknown): {
      uniforms?: { image?: unknown; alphaCutoff?: unknown };
      options?: { fabric?: { type?: string; uniforms?: { image?: unknown; alphaCutoff?: unknown } } };
    } | undefined =>
      (value as {
        options?: {
          appearance?: {
            options?: {
              material?: {
                uniforms?: { image?: unknown; alphaCutoff?: unknown };
                options?: { fabric?: { type?: string; uniforms?: { image?: unknown; alphaCutoff?: unknown } } };
              };
            };
          };
        };
      }).options?.appearance?.options?.material;
    const getPrimitiveMaterialImage = (value: unknown): unknown => {
      const material = getPrimitiveMaterial(value);
      return material?.uniforms?.image ?? material?.options?.fabric?.uniforms?.image;
    };

    const opaquePrimitives = cesium.operations.primitivesAdded.filter((value) =>
      String(getPrimitiveMaterialImage(value) ?? "").includes("/opaque"),
    ) as Array<{
      options?: {
        geometryInstances?: { geometry?: { attributes?: { position?: { values?: Float64Array } } } };
        appearance?: { options?: { material?: { uniforms?: { image?: string } }; translucent?: boolean } };
      };
    }>;
    const transparentPrimitive = cesium.operations.primitivesAdded.find((value) =>
      String(getPrimitiveMaterialImage(value) ?? "").includes("/transparent"),
    ) as {
      options?: {
        appearance?: {
          options?: {
            material?: {
              options?: {
                fabric?: {
                  type?: string;
                  uniforms?: { alphaCutoff?: number };
                };
              };
            };
            translucent?: boolean;
          };
        };
      };
    } | undefined;
    expect(transparentPrimitive?.options?.appearance?.options?.translucent).toBe(true);
    expect(transparentPrimitive?.options?.appearance?.options?.material?.options?.fabric).toMatchObject({
      type: "S100ProjectedWmsBinaryImage",
      uniforms: {
        alphaCutoff: 0.01,
      },
    });
    expect(opaquePrimitives).toHaveLength(4);
    expect(opaquePrimitives.every((primitive) =>
      primitive.options?.appearance?.options?.translucent === true,
    )).toBe(true);
    expect(Array.from(opaquePrimitives[0]?.options?.geometryInstances?.geometry?.attributes?.position?.values ?? [])).toEqual([
      -1000, -1000, 0.5,
      0, -1000, 0.5,
      0, 2000, 0.5,
      -1000, 2000, 0.5,
    ]);
    expect(opaquePrimitives.map((primitive) =>
      primitive.options?.appearance?.options?.material?.uniforms?.image,
    )).toEqual([
      expect.stringContaining("BBOX=330100,5185420,331100,5188420"),
      expect.stringContaining("BBOX=332100,5185420,333100,5188420"),
      expect.stringContaining("BBOX=331100,5185420,332100,5186420"),
      expect.stringContaining("BBOX=331100,5187420,332100,5188420"),
    ]);
    await viewer.destroy();
  });

  it("applies projected WMS visibility and opacity patches when rebuilding map entities", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });

    const layer = await scene.layers.add(
      LayerBuilder.createS101Wms({
        id: "patchable-s101",
        url: "https://example.test/wms",
        layers: ["s100dataSets.101"],
        crs: "EPSG:32619",
        visible: false,
        opacity: 1,
        spatialExtent: {
          crs: "EPSG:32619",
          minX: 331100,
          minY: 5186420,
          maxX: 332100,
          maxY: 5187420,
        },
      }),
    );

    expect(cesium.operations.entitiesAdded).toHaveLength(0);
    expect(cesium.operations.primitivesAdded).toHaveLength(1);
    const initialPrimitive = cesium.operations.primitivesAdded[0] as {
      destroyed?: boolean;
      show?: boolean;
      options?: { appearance?: { options?: { material?: { uniforms?: { color?: { a?: number } } } } } };
    };
    expect(initialPrimitive.show).toBe(false);

    await layer.update({ visible: true, opacity: 0.35 });

    expect(cesium.operations.primitivesAdded).toHaveLength(1);
    expect(cesium.operations.primitivesAdded[0]).toBe(initialPrimitive);
    expect(initialPrimitive.destroyed).toBe(false);
    const rebuiltPrimitive = cesium.operations.primitivesAdded[0] as {
      show?: boolean;
      options?: { appearance?: { options?: { material?: { uniforms?: { color?: { a?: number } } } } } };
    };
    expect(rebuiltPrimitive.show).toBe(true);
    expect(rebuiltPrimitive.options?.appearance?.options?.material?.uniforms?.color?.a).toBe(0.35);

    await layer.update({ opacity: 1 });

    expect(cesium.operations.primitivesAdded).toHaveLength(1);
    expect(cesium.operations.primitivesAdded[0]).toBe(initialPrimitive);
    expect(initialPrimitive.show).toBe(true);
    expect(initialPrimitive.options?.appearance?.options?.material?.uniforms?.color?.a).toBe(1);
    await viewer.destroy();
  });
});
