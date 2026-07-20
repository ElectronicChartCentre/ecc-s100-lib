import { describe, expect, it, vi } from "vitest";
import { VesselFeatureSession, type Coordinate, type VesselDimensions, type VesselPose } from "../../src/index.js";
import type { S100Unsubscribe } from "../../src/events/S100EventBus.js";
import type { S100Layer } from "../../src/layers/types.js";
import type { S100Scene } from "../../src/scene/types.js";
import type { VesselLayerSpec } from "../../src/products/viewer-features.js";

describe("VesselFeatureSession", () => {
  it("adds a vessel layer with clamped initial pose and transform limits", async () => {
    const layer = createVesselLayer();
    const scene = createScene(layer, 10);

    await VesselFeatureSession.add({
      scene,
      id: "demo-vessel",
      url: "/vessel.glb",
      pose: {
        position: projected(0, 0, 99),
        headingDegrees: -10,
      },
      dimensions,
      constraints: {
        vertical: {
          minMeters: -75,
          maxMeters: "draught",
          reference: "sea-level",
        },
      },
      style: {
        transformControls: "translate",
      },
    });

    expect(scene.layers.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "demo-vessel",
        product: "vessel",
        pose: {
          position: projected(0, 0, 15),
          headingDegrees: 350,
        },
        style: expect.objectContaining({
          transformControls: "translate",
          transformGizmo: expect.objectContaining({
            verticalPositionLimits: {
              minMeters: -75,
              maxMeters: 5,
              reference: "sea-level",
            },
          }),
        }),
      }),
    );
  });

  it("clamps programmatic position updates", async () => {
    const layer = createVesselLayer();
    const session = await VesselFeatureSession.add({
      scene: createScene(layer, 10),
      url: "/vessel.glb",
      pose: {
        position: projected(0, 0, 0),
      },
      dimensions,
      constraints: {
        vertical: {
          minMeters: -75,
          maxMeters: "draught",
          reference: "sea-level",
        },
      },
    });

    await session.setPosition(projected(1, 2, 99));

    expect(layer.controllers.vessel.setPosition).toHaveBeenCalledWith(projected(1, 2, 15));
  });

  it("refreshes draught-based transform limits when dimensions change", async () => {
    const layer = createVesselLayer();
    const session = await VesselFeatureSession.add({
      scene: createScene(layer, 10),
      url: "/vessel.glb",
      pose: {
        position: projected(0, 0, 0),
      },
      dimensions,
      constraints: {
        vertical: {
          minMeters: -75,
          maxMeters: "draught",
          reference: "sea-level",
        },
      },
    });
    vi.mocked(layer.update).mockClear();
    const nextDimensions = {
      ...dimensions,
      draught: 8,
    };

    await session.setDimensions(nextDimensions);

    expect(layer.controllers.vessel.setDimensions).toHaveBeenCalledWith(nextDimensions);
    expect(layer.update).toHaveBeenCalledWith({
      style: expect.objectContaining({
        transformGizmo: expect.objectContaining({
          verticalPositionLimits: {
            minMeters: -75,
            maxMeters: 8,
            reference: "sea-level",
          },
        }),
      }),
    });
  });

  it("clamps controller position events before notifying app listeners", async () => {
    const layer = createVesselLayer();
    const scene = createScene(layer, 10);
    const session = await VesselFeatureSession.add({
      scene,
      url: "/vessel.glb",
      pose: {
        position: projected(0, 0, 0),
      },
      dimensions,
      constraints: {
        vertical: {
          minMeters: -75,
          maxMeters: "draught",
          reference: "sea-level",
        },
      },
    });
    const listener = vi.fn();
    session.onPositionChanged(listener);

    layer.__emitPosition(projected(1, 2, 99));

    expect(layer.controllers.vessel.setPosition).toHaveBeenCalledWith(projected(1, 2, 15));
    expect(listener).toHaveBeenCalledWith(projected(1, 2, 15));
  });

  it("normalizes heading events and removes the layer on dispose", async () => {
    const layer = createVesselLayer();
    const session = await VesselFeatureSession.add({
      scene: createScene(layer, 0),
      url: "/vessel.glb",
      pose: {
        position: projected(0, 0, 0),
      },
      dimensions,
    });
    const listener = vi.fn();
    session.onHeadingChanged(listener);

    layer.__emitHeading(-1);
    await session.dispose();

    expect(listener).toHaveBeenCalledWith(359);
    expect(layer.__positionUnsubscribe).toHaveBeenCalledTimes(1);
    expect(layer.__headingUnsubscribe).toHaveBeenCalledTimes(1);
    expect(layer.remove).toHaveBeenCalledTimes(1);
  });
});

const dimensions: VesselDimensions = {
  draught: 5,
  bow: 50,
  stern: 50,
  port: 10,
  starboard: 10,
};

type TestVesselLayer = S100Layer<VesselLayerSpec> & {
  __emitPosition(position: Coordinate): void;
  __emitHeading(heading: number): void;
  __positionUnsubscribe: ReturnType<typeof vi.fn>;
  __headingUnsubscribe: ReturnType<typeof vi.fn>;
};

function createScene(layer: TestVesselLayer, seaLevel: number): S100Scene {
  return {
    layers: {
      add: vi.fn().mockResolvedValue(layer),
    },
    getSeaLevel: vi.fn().mockReturnValue(seaLevel),
  } as unknown as S100Scene;
}

function createVesselLayer(): TestVesselLayer {
  let pose: VesselPose = {
    position: projected(0, 0, 0),
    headingDegrees: 0,
  };
  let positionListener: ((position: Coordinate) => void) | undefined;
  let headingListener: ((heading: number) => void) | undefined;
  const positionUnsubscribe = vi.fn();
  const headingUnsubscribe = vi.fn();
  const layer = {
    id: "vessel",
    product: "vessel",
    spec: {
      id: "vessel",
      product: "vessel",
      source: {
        kind: "model",
        url: "/vessel.glb",
      },
      pose,
      dimensions,
    },
    controllers: {
      vessel: {
        kind: "vessel",
        dimensions,
        seaLevelIndicator: {
          mode: "circle",
          oceanSurfaceVisible: false,
          setMode: vi.fn().mockResolvedValue(undefined),
          setOceanSurfaceVisible: vi.fn().mockResolvedValue(undefined),
        },
        transformControls: {
          mode: "translate",
          setMode: vi.fn().mockResolvedValue(undefined),
        },
        getPosition: vi.fn(() => pose.position),
        getPose: vi.fn(() => pose),
        setPose: vi.fn().mockImplementation((patch: Partial<VesselPose>) => {
          pose = {
            ...pose,
            ...patch,
          };
          return Promise.resolve();
        }),
        setPosition: vi.fn().mockImplementation((position: Coordinate) => {
          pose = {
            ...pose,
            position,
          };
          return Promise.resolve();
        }),
        getHeading: vi.fn(() => pose.headingDegrees ?? 0),
        setHeading: vi.fn().mockImplementation((headingDegrees: number) => {
          pose = {
            ...pose,
            headingDegrees,
          };
          return Promise.resolve();
        }),
        setDimensions: vi.fn().mockResolvedValue(undefined),
        setVisibility: vi.fn().mockResolvedValue(undefined),
        setSeaLevelIndicatorMode: vi.fn().mockResolvedValue(undefined),
        setOceanSurfaceVisible: vi.fn().mockResolvedValue(undefined),
        getTransformMode: vi.fn(() => "translate"),
        setTransformMode: vi.fn().mockResolvedValue(undefined),
        onPositionChanged: vi.fn((listener: (position: Coordinate) => void): S100Unsubscribe => {
          positionListener = listener;
          return positionUnsubscribe;
        }),
        onHeadingChanged: vi.fn((listener: (heading: number) => void): S100Unsubscribe => {
          headingListener = listener;
          return headingUnsubscribe;
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
    __positionUnsubscribe: positionUnsubscribe,
    __headingUnsubscribe: headingUnsubscribe,
  };
  return layer as unknown as TestVesselLayer;
}

function projected(x: number, y: number, z: number): Coordinate {
  return {
    kind: "projected",
    x,
    y,
    z,
    crs: "EPSG:32633",
  };
}
