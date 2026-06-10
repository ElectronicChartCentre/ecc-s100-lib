import { describe, expect, it } from "vitest";
import { createInMemoryAdapter, S100ProductType } from "@ecc/s100-viewer";
import {
  createLegacyS100ViewerFacade,
  MapDiscardMode,
  MapLayerType,
  SeaLevelIndicatorMode,
  Viewer,
  type S101EncLayerSpec,
  type S102BathymetryLayerSpec,
  type S111SurfaceCurrentLayerSpec,
  type VesselLayerSpec,
} from "../src/index.js";

type NativeSpec<TSpec> = {
  spec: TSpec;
};

describe("@ecc/s100-viewer-compat facade", () => {
  it("keeps the simple lifecycle wrapper available", async () => {
    const facade = await createLegacyS100ViewerFacade({
      adapter: createInMemoryAdapter(),
    });

    expect(facade.viewer.adapterId).toBe("in-memory");
    expect(MapDiscardMode.BaseMapAlpha).toBe(0);
    expect(MapDiscardMode.None).toBe(1);
    expect(MapDiscardMode.Transparent).toBe(1);

    const scene = await facade.createScene();
    expect(scene.id).toBe("scene-1");

    await facade.destroy();
  });

  it("preserves the legacy Viewer.create and camera/sea-level scene surface", async () => {
    const viewer = await Viewer.create(null, {
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene();

    scene.seaLevel = 2.5;
    scene.cameraNavigation.setCameraPose({
      position: [1, 2, 3],
      rotation: [0, 0, 0, 1],
      focalDistance: 20,
    });

    expect(scene.seaLevel).toBe(2.5);
    expect(scene.cameraNavigation.getCameraPos()).toEqual([1, 2, 3]);

    await viewer.destroy();
  });

  it("forwards legacy hover prism calls to the engine scene", async () => {
    const prismEvents: unknown[] = [];
    const viewer = await Viewer.create(null, {
      adapter: createInMemoryAdapter({
        onHoverPrism: (corners, zPos, height, rgba) => {
          prismEvents.push({ type: "show", corners, zPos, height, rgba });
        },
        onClearHoverPrism: () => {
          prismEvents.push({ type: "clear" });
        },
      }),
    });
    const scene = await viewer.createScene();
    const corners = {
      topLeft: [0, 10] as [number, number],
      topRight: [10, 10] as [number, number],
      bottomLeft: [0, 0] as [number, number],
      bottomRight: [10, 0] as [number, number],
    };

    scene.HoverPrism.showPrism(corners, -100, 101, {
      r: 1,
      g: 0,
      b: 0,
      a: 0.4,
    });
    scene.HoverPrism.clear();

    expect(scene.HoverPrism.getState().visible).toBe(false);
    expect(prismEvents).toEqual([
      {
        type: "show",
        corners,
        zPos: -100,
        height: 101,
        rgba: {
          r: 1,
          g: 0,
          b: 0,
          a: 0.4,
        },
      },
      { type: "clear" },
    ]);

    await viewer.destroy();
  });

  it("maps legacy terrain calls to S-102 bathymetry layer specs", async () => {
    const viewer = await Viewer.create(null, {
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene();

    const terrain = scene.Terrain.add({
      baseURL: "https://example.test/s102",
      additionalURLParameters: "crs=EPSG:32633",
      detailFactor: 2,
    });
    terrain.terrain.unsafeDepth = -7;
    terrain.terrain.showContour = true;
    terrain.terrain.contourInterval = 5;

    await terrain.initialized();
    const native = terrain.getNativeHandle<NativeSpec<S102BathymetryLayerSpec>>();

    expect(native?.spec.product).toBe(S100ProductType.S102);
    expect(native?.spec.source.kind).toBe("3d-tiles");
    expect(native?.spec.source.query).toEqual({ crs: "EPSG:32633" });
    expect(native?.spec.extensions?.nasaAmmos).toEqual({
      detailFactor: 2,
      additionalURLParameters: "crs=EPSG:32633",
    });

    await terrain.destroy();
    await viewer.destroy();
  });

  it("maps legacy map, S-111, and vessel calls to product layer specs", async () => {
    const viewer = await Viewer.create(null, {
      adapter: createInMemoryAdapter(),
    });
    const scene = await viewer.createScene();

    scene.Map.discardMode = MapDiscardMode.None;
    const map = scene.Map.add({
      id: "chart",
      type: MapLayerType.BaseTransparent,
      corners: {
        upperLeft: [0, 100],
        upperRight: [100, 100],
        lowerLeft: [0, 0],
        lowerRight: [100, 0],
      },
      dataset: {
        mapSubset: { min: [0, 0], max: [100, 100] },
        extents: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        minLevel: 0,
        maxLevel: 4,
      },
      urlTemplate: "https://example.test/wms?BBOX={xmin},{ymin},{xmax},{ymax}",
    });
    map.alpha = 0.4;
    await map.initialized();
    const mapNative = map.getNativeHandle<NativeSpec<S101EncLayerSpec>>();

    const currents = scene.S111.add({
      id: "currents",
      dateTimeOfFirstRecord: "20260529T120000Z",
      timeRecordInterval: 3600,
      numberOfTimes: 3,
    });
    currents.setCustomScale(3);
    await currents.initialized();
    const currentsNative = currents.getNativeHandle<NativeSpec<S111SurfaceCurrentLayerSpec>>();

    const vesselBoundingBox = {
      min: [-15, -90, -40.2],
      max: [15, 100, 6.4],
    };
    const vesselOrientation = [0, 0, 0, 1];
    const vessel = scene.VesselFeature.add({
      model: {
        path: "/assets/vessel.glb",
        name: "vessel",
        boundingBox: vesselBoundingBox,
        orientation: vesselOrientation,
      },
      dimensions: {
        draught: 8,
        bow: 100,
        stern: 90,
        port: 15,
        starboard: 15,
      },
    });
    vessel.setPosition([10, 20, 0]);
    vessel.setHeading(45);
    vessel.seaLevelIndicator.mode = SeaLevelIndicatorMode.Circle;
    await vessel.initialized();
    const vesselNative = vessel.getNativeHandle<NativeSpec<VesselLayerSpec>>();

    expect(mapNative?.spec.product).toBe(S100ProductType.S101);
    expect(mapNative?.spec.extensions?.cogs).toMatchObject({
      discardMode: MapDiscardMode.None,
    });
    expect(map.alpha).toBe(0.4);
    expect(currentsNative?.spec.product).toBe(S100ProductType.S111);
    expect(currents.customScale).toBe(3);
    expect(currents.time.startTime).toBe(Date.UTC(2026, 4, 29, 12, 0, 0));
    expect(currents.time.endTime).toBe(Date.UTC(2026, 4, 29, 14, 0, 0));
    expect(vesselNative?.spec.product).toBe("vessel");
    expect(vesselNative?.spec.extensions?.nasaAmmos).toMatchObject({
      dimensions: {
        draught: 8,
        bow: 100,
        stern: 90,
        port: 15,
        starboard: 15,
      },
      model: {
        boundingBox: vesselBoundingBox,
        orientation: vesselOrientation,
      },
    });
    expect(vessel.getHeading()).toBe(45);
    expect(vessel.seaLevelIndicator.mode).toBe(SeaLevelIndicatorMode.Circle);

    await scene.destroy();
    await viewer.destroy();
  });
});
