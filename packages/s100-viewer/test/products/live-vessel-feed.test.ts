import { describe, expect, it, vi } from "vitest";

import {
  createLiveVesselFeedLayer,
  mapLiveAisVesselToParametricVessel,
  projectLiveAisVesselToProjectedCoordinate,
  type Coordinate,
  type LiveAisVessel,
  type S100Layer,
  type S100Scene,
  type S100Unsubscribe,
  type VesselDimensions,
  type VesselLayerSpec,
  type VesselPose,
} from "../../src/index.js";

describe("live vessel feed", () => {
  it("maps AIS dimensions and draught into parametric vessel semantics", () => {
    const spec = mapLiveAisVesselToParametricVessel(
      liveVessel({
        dimensionsMeters: {
          bow: 44,
          stern: 25,
          port: 14,
          starboard: 1,
          length: 69,
          width: 15,
        },
        draughtMeters: 8,
        shipType: 70,
      }),
    );

    expect(spec).toMatchObject({
      template: "generic-cargo",
      dimensions: {
        draught: 8,
        bow: 44,
        stern: 25,
        port: 14,
        starboard: 1,
      },
      metadata: {
        mmsi: 257076860,
        source: "barentswatch-live-ais",
        draughtSource: "ais",
        draughtEstimated: false,
      },
    });
  });

  it("preserves zero-valued AIS dimension offsets", () => {
    const spec = mapLiveAisVesselToParametricVessel(
      liveVessel({
        dimensionsMeters: {
          bow: 31,
          stern: 31,
          port: 0,
          starboard: 14,
          length: 62,
          width: 14,
        },
      }),
    );

    expect(spec.dimensions).toMatchObject({
      bow: 31,
      stern: 31,
      port: 0,
      starboard: 14,
    });
  });

  it("uses a size-scaled draught fallback when AIS draught is missing", () => {
    const smallCraft = mapLiveAisVesselToParametricVessel(
      liveVessel({
        dimensionsMeters: {
          bow: 8,
          stern: 2,
          port: 2,
          starboard: 1,
          length: 10,
          width: 3,
        },
      }),
    );
    const coaster = mapLiveAisVesselToParametricVessel(
      liveVessel({
        dimensionsMeters: {
          bow: 20,
          stern: 12,
          port: 6,
          starboard: 6,
          length: 32,
          width: 12,
        },
      }),
    );

    expect(smallCraft.dimensions.draught).toBeCloseTo((3 * 0.55) / 1.35);
    expect(coaster.dimensions.draught).toBeCloseTo((12 * 0.55) / 1.35);
    expect(smallCraft.metadata).toMatchObject({
      draughtSource: "estimated",
      draughtEstimated: true,
    });
  });

  it("projects AIS geodetic positions into a projected scene CRS", () => {
    const projected = projectLiveAisVesselToProjectedCoordinate(
      liveVessel({
        longitude: 5.7,
        latitude: 58.9,
        positionCrs: "EPSG:4258",
      }),
      { crs: "EPSG:32632" },
    );

    expect(projected).toMatchObject({
      kind: "projected",
      crs: "EPSG:32632",
      z: 0,
    });
    expect(projected.x).toBeCloseTo(309906.967, 3);
    expect(projected.y).toBeCloseTo(6533606.491, 3);
  });

  it("creates, updates, and removes MMSI-keyed vessel sessions", async () => {
    const scene = createScene();
    const feed = await createLiveVesselFeedLayer({
      scene,
      id: "ais",
      now: () => new Date("2026-07-24T10:00:00.000Z"),
    });

    await feed.updateVessels([
      liveVessel({ mmsi: 1, longitude: 5.7, latitude: 58.9, trueHeading: 10 }),
      liveVessel({ mmsi: 2, longitude: 5.8, latitude: 58.95, trueHeading: 20 }),
    ]);

    expect(scene.layers.add).toHaveBeenCalledTimes(2);
    expect(feed.getVesselCount()).toBe(2);
    expect(feed.getVessel(1)?.pose).toMatchObject({
      headingDegrees: 10,
      position: {
        kind: "geodetic",
        lon: 5.7,
        lat: 58.9,
      },
    });

    await feed.updateVessels([
      liveVessel({ mmsi: 1, longitude: 5.9, latitude: 59, trueHeading: 30 }),
    ]);

    expect(scene.layers.add).toHaveBeenCalledTimes(2);
    expect(feed.getVesselCount()).toBe(1);
    expect(feed.getVessel(1)?.pose.headingDegrees).toBe(30);
    expect(scene.__layersById.get("ais-2")?.remove).toHaveBeenCalledTimes(1);
  });

  it("filters stale vessels and can keep previous vessels when removeMissing is disabled", async () => {
    const scene = createScene();
    const feed = await createLiveVesselFeedLayer({
      scene,
      stalePolicy: {
        maxAgeSeconds: 60,
        removeMissing: false,
      },
      now: () => new Date("2026-07-24T10:00:00.000Z"),
    });

    await feed.updateVessels([
      liveVessel({ mmsi: 1, messageTime: "2026-07-24T09:59:30.000Z" }),
      liveVessel({ mmsi: 2, messageTime: "2026-07-24T09:00:00.000Z" }),
    ]);

    expect(feed.getVesselCount()).toBe(1);

    await feed.updateVessels([]);

    expect(feed.getVesselCount()).toBe(1);
  });

  it("tracks selected vessel state", async () => {
    const scene = createScene();
    const feed = await createLiveVesselFeedLayer({
      scene,
      style: {
        style: { opacity: 0.5 },
        selectedStyle: { opacity: 1 },
      },
    });

    await feed.updateVessels([liveVessel({ mmsi: 1 }), liveVessel({ mmsi: 2 })]);
    await feed.selectVessel(2);

    expect(feed.getVessel(1)?.selected).toBe(false);
    expect(feed.getVessel(2)?.selected).toBe(true);
    expect(scene.__layersById.get("live-vessel-2")?.update).toHaveBeenCalledWith({
      style: {
        opacity: 1,
      },
    });
  });
});

type TestScene = S100Scene & {
  __layersById: Map<string, TestVesselLayer>;
};

type TestVesselLayer = S100Layer<VesselLayerSpec> & {
  __emitPosition(position: Coordinate): void;
  __emitHeading(heading: number): void;
};

function createScene(): TestScene {
  const layersById = new Map<string, TestVesselLayer>();
  return {
    layers: {
      add: vi.fn().mockImplementation(async (spec: VesselLayerSpec) => {
        const layer = createVesselLayer(spec);
        layersById.set(spec.id, layer);
        return layer;
      }),
    },
    getSeaLevel: vi.fn().mockReturnValue(0),
    __layersById: layersById,
  } as unknown as TestScene;
}

function createVesselLayer(spec: VesselLayerSpec): TestVesselLayer {
  let pose: VesselPose = spec.pose;
  let dimensions: VesselDimensions = spec.dimensions ?? {
    draught: 4,
    bow: 30,
    stern: 30,
    port: 6,
    starboard: 6,
  };
  let positionListener: ((position: Coordinate) => void) | undefined;
  let headingListener: ((heading: number) => void) | undefined;
  const layer = {
    id: spec.id,
    product: "vessel",
    spec,
    controllers: {
      vessel: {
        kind: "vessel",
        get dimensions() {
          return dimensions;
        },
        seaLevelIndicator: {
          mode: "circle",
          oceanSurfaceVisible: false,
          setMode: vi.fn().mockResolvedValue(undefined),
          setOceanSurfaceVisible: vi.fn().mockResolvedValue(undefined),
        },
        transformControls: {
          mode: "translate-rotate",
          setMode: vi.fn().mockResolvedValue(undefined),
        },
        getPosition: vi.fn(() => pose.position),
        getPose: vi.fn(() => pose),
        setPose: vi.fn().mockImplementation((patch: Partial<VesselPose>) => {
          pose = { ...pose, ...patch };
          return Promise.resolve();
        }),
        setPosition: vi.fn().mockImplementation((position: Coordinate) => {
          pose = { ...pose, position };
          return Promise.resolve();
        }),
        getHeading: vi.fn(() => pose.headingDegrees ?? 0),
        setHeading: vi.fn().mockImplementation((headingDegrees: number) => {
          pose = { ...pose, headingDegrees };
          return Promise.resolve();
        }),
        setDimensions: vi.fn().mockImplementation((next: VesselDimensions) => {
          dimensions = next;
          return Promise.resolve();
        }),
        setVisibility: vi.fn().mockResolvedValue(undefined),
        setSeaLevelIndicatorMode: vi.fn().mockResolvedValue(undefined),
        setOceanSurfaceVisible: vi.fn().mockResolvedValue(undefined),
        getTransformMode: vi.fn(() => "translate-rotate"),
        setTransformMode: vi.fn().mockResolvedValue(undefined),
        onPositionChanged: vi.fn((listener: (position: Coordinate) => void): S100Unsubscribe => {
          positionListener = listener;
          return () => {};
        }),
        onHeadingChanged: vi.fn((listener: (heading: number) => void): S100Unsubscribe => {
          headingListener = listener;
          return () => {};
        }),
        destroy: vi.fn(),
      },
    },
    nativeHandle: null,
    visible: true,
    opacity: 1,
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getNativeHandle: vi.fn().mockReturnValue(null),
    onChanged: vi.fn().mockReturnValue(() => {}),
    __emitPosition(position: Coordinate): void {
      positionListener?.(position);
    },
    __emitHeading(heading: number): void {
      headingListener?.(heading);
    },
  };
  return layer as unknown as TestVesselLayer;
}

function liveVessel(
  options: {
    mmsi?: number;
    longitude?: number;
    latitude?: number;
    trueHeading?: number;
    positionCrs?: string;
    messageTime?: string;
    dimensionsMeters?: LiveAisVessel["dimensionsMeters"];
    draughtMeters?: number;
    shipType?: number;
  } = {},
): LiveAisVessel {
  const vessel: LiveAisVessel = {
    source: "barentswatch-live-ais",
    mmsi: options.mmsi ?? 257076860,
    name: "ODD LUNDBERG",
    position: {
      kind: "geodetic",
      crs: options.positionCrs ?? "EPSG:4326",
      longitude: options.longitude ?? 9.588648,
      latitude: options.latitude ?? 63.727733,
      heightMeters: 0,
    },
    courseOverGroundDegrees: 213.8,
    messageTime: options.messageTime ?? "2026-07-24T09:59:30.000Z",
  };
  if (options.trueHeading !== undefined) {
    vessel.headingDegrees = options.trueHeading;
  }
  if (options.dimensionsMeters !== undefined) {
    vessel.dimensionsMeters = options.dimensionsMeters;
  }
  if (options.draughtMeters !== undefined) {
    vessel.draughtMeters = options.draughtMeters;
  }
  if (options.shipType !== undefined) {
    vessel.shipType = options.shipType;
  }
  return vessel;
}
