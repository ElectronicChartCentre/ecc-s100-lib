import { describe, expect, it, vi } from "vitest";
import {
  EncStandard,
  EncWmsSession,
  resolveEncWmsAvailability,
  type EncWmsSessionStandardOptions,
} from "../../src/index.js";
import type { S100Layer } from "../../src/layers/types.js";
import type { EncLayerSpec } from "../../src/products/enc.js";
import type { S100Scene } from "../../src/scene/types.js";

describe("EncWmsSession", () => {
  it("creates the first available preferred standard and applies visibility", async () => {
    const s101Transparent = createMapLayer("s101-transparent");
    const s101Opaque = createMapLayer("s101-opaque");
    const scene = createScene([s101Transparent, s101Opaque]);

    const session = await EncWmsSession.create({
      scene,
      standards: {
        [EncStandard.S101]: createStandardOptions("s101"),
        [EncStandard.S57]: createStandardOptions("s57"),
      },
      availability: {
        [EncStandard.S101]: true,
        [EncStandard.S57]: true,
      },
      preference: [EncStandard.S101, EncStandard.S57],
      visible: true,
      opacity: 0.7,
    });

    expect(session.status.activeStandard).toBe(EncStandard.S101);
    expect(scene.layers.addMany).toHaveBeenCalledTimes(1);
    expect(scene.layers.addMany).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "s101-transparent",
        product: "S-101",
      }),
      expect.objectContaining({
        id: "s101-opaque",
        product: "S-101",
      }),
    ]);
    expect(s101Transparent.controllers.map.setVisibility).toHaveBeenCalledWith(true);
    expect(s101Opaque.controllers.map.setVisibility).toHaveBeenCalledWith(true);
    expect(s101Transparent.controllers.map.setAlpha).toHaveBeenCalledWith(0.7);
    expect(s101Opaque.controllers.map.setAlpha).toHaveBeenCalledWith(0.7);
  });

  it("falls back to the next preferred available standard", async () => {
    const s57Transparent = createMapLayer("s57-transparent");
    const s57Opaque = createMapLayer("s57-opaque");
    const scene = createScene([s57Transparent, s57Opaque]);

    const session = await EncWmsSession.create({
      scene,
      standards: {
        [EncStandard.S101]: createStandardOptions("s101"),
        [EncStandard.S57]: createStandardOptions("s57"),
      },
      availability: {
        [EncStandard.S101]: false,
        [EncStandard.S57]: true,
      },
      preference: [EncStandard.S101, EncStandard.S57],
      visible: true,
    });

    expect(session.status.activeStandard).toBe(EncStandard.S57);
    expect(scene.layers.addMany).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "s57-transparent",
        product: "S-57",
      }),
      expect.objectContaining({
        id: "s57-opaque",
        product: "S-57",
      }),
    ]);
  });

  it("hides the previous pair when preference changes", async () => {
    const s101Transparent = createMapLayer("s101-transparent");
    const s101Opaque = createMapLayer("s101-opaque");
    const s57Transparent = createMapLayer("s57-transparent");
    const s57Opaque = createMapLayer("s57-opaque");
    const session = await EncWmsSession.create({
      scene: createScene([
        s101Transparent,
        s101Opaque,
        s57Transparent,
        s57Opaque,
      ]),
      standards: {
        [EncStandard.S101]: createStandardOptions("s101"),
        [EncStandard.S57]: createStandardOptions("s57"),
      },
      preference: [EncStandard.S101, EncStandard.S57],
      visible: true,
    });

    await session.setPreferredStandard(EncStandard.S57);

    expect(s101Transparent.controllers.map.setVisibility).toHaveBeenCalledWith(false);
    expect(s101Opaque.controllers.map.setVisibility).toHaveBeenCalledWith(false);
    expect(s57Transparent.controllers.map.setVisibility).toHaveBeenCalledWith(true);
    expect(s57Opaque.controllers.map.setVisibility).toHaveBeenCalledWith(true);
    expect(session.status.activeStandard).toBe(EncStandard.S57);
  });

  it("updates opacity on the active pair and removes layers on dispose", async () => {
    const transparent = createMapLayer("s101-transparent");
    const opaque = createMapLayer("s101-opaque");
    const session = await EncWmsSession.create({
      scene: createScene([transparent, opaque]),
      standards: {
        [EncStandard.S101]: createStandardOptions("s101"),
      },
      visible: true,
    });

    await session.setOpacity(2);
    await session.dispose();

    expect(transparent.controllers.map.setAlpha).toHaveBeenCalledWith(1);
    expect(opaque.controllers.map.setAlpha).toHaveBeenCalledWith(1);
    expect(transparent.remove).toHaveBeenCalledTimes(1);
    expect(opaque.remove).toHaveBeenCalledTimes(1);
  });

  it("animates opacity only when explicitly requested", async () => {
    vi.useFakeTimers();
    try {
      const transparent = createMapLayer("s101-transparent");
      const opaque = createMapLayer("s101-opaque");
      const session = await EncWmsSession.create({
        scene: createScene([transparent, opaque]),
        standards: {
          [EncStandard.S101]: createStandardOptions("s101"),
        },
        visible: true,
      });

      const animation = session.setOpacityAnimated(0.8, {
        from: 0.2,
        durationMs: 20,
        frameIntervalMs: 10,
      });
      await Promise.resolve();

      expect(lastAlpha(transparent)).toBe(0.2);

      await vi.advanceTimersByTimeAsync(10);
      expect(lastAlpha(transparent)).toBeCloseTo(0.5);
      expect(lastAlpha(opaque)).toBeCloseTo(0.5);

      await vi.advanceTimersByTimeAsync(10);
      await animation;
      expect(lastAlpha(transparent)).toBeCloseTo(0.8);
      expect(lastAlpha(opaque)).toBeCloseTo(0.8);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets direct opacity supersede an active animation", async () => {
    vi.useFakeTimers();
    try {
      const transparent = createMapLayer("s101-transparent");
      const opaque = createMapLayer("s101-opaque");
      const session = await EncWmsSession.create({
        scene: createScene([transparent, opaque]),
        standards: {
          [EncStandard.S101]: createStandardOptions("s101"),
        },
        visible: true,
      });

      const animation = session.setOpacityAnimated(1, {
        from: 0,
        durationMs: 100,
        frameIntervalMs: 10,
      });
      await Promise.resolve();

      await session.setOpacity(0.3);
      await vi.advanceTimersByTimeAsync(100);
      await animation;

      expect(lastAlpha(transparent)).toBe(0.3);
      expect(lastAlpha(opaque)).toBe(0.3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("resolveEncWmsAvailability", () => {
  it("combines S-101 and S-57 availability checks", async () => {
    const bounds = { west: 1, south: 2, east: 3, north: 4 };
    const service = {
      hasS101: vi.fn().mockResolvedValue(true),
      hasS57Access: vi.fn().mockResolvedValue(true),
      hasS57: vi.fn().mockResolvedValue(false),
    };

    const availability = await resolveEncWmsAvailability({
      bounds,
      licenseeKey: "license-key",
      service,
    });

    expect(availability).toEqual({
      [EncStandard.S101]: true,
      [EncStandard.S57]: false,
    });
    expect(service.hasS101).toHaveBeenCalledWith(bounds, "license-key");
    expect(service.hasS57Access).toHaveBeenCalledWith("license-key");
    expect(service.hasS57).toHaveBeenCalledWith(bounds);
  });

  it("returns unavailable without service calls when bounds are missing", async () => {
    const service = {
      hasS101: vi.fn().mockResolvedValue(true),
      hasS57Access: vi.fn().mockResolvedValue(true),
      hasS57: vi.fn().mockResolvedValue(true),
    };

    const availability = await resolveEncWmsAvailability({
      bounds: undefined,
      licenseeKey: "license-key",
      service,
    });

    expect(availability).toEqual({
      [EncStandard.S101]: false,
      [EncStandard.S57]: false,
    });
    expect(service.hasS101).not.toHaveBeenCalled();
    expect(service.hasS57Access).not.toHaveBeenCalled();
    expect(service.hasS57).not.toHaveBeenCalled();
  });

  it("reports failed checks and treats them as unavailable", async () => {
    const failure = new Error("availability service failed");
    const onError = vi.fn();

    const availability = await resolveEncWmsAvailability({
      bounds: {},
      licenseeKey: "license-key",
      service: {
        hasS101: vi.fn().mockRejectedValue(failure),
        hasS57Access: vi.fn().mockResolvedValue(true),
        hasS57: vi.fn().mockResolvedValue(true),
      },
      onError,
    });

    expect(availability).toEqual({
      [EncStandard.S101]: false,
      [EncStandard.S57]: true,
    });
    expect(onError).toHaveBeenCalledWith(failure, "s101");
  });
});

type EncLayer = S100Layer<EncLayerSpec>;

function createStandardOptions(prefix: string): EncWmsSessionStandardOptions {
  return {
    center: {
      easting: 500000,
      northing: 7000000,
      epsgCrs: "EPSG:32633",
    },
    widthMeters: 1000,
    transparent: {
      id: `${prefix}-transparent`,
      urlTemplate: `https://example.test/${prefix}/transparent?bbox={xmin},{ymin},{xmax},{ymax}`,
      visible: false,
      opacity: 1,
    },
    opaque: {
      id: `${prefix}-opaque`,
      urlTemplate: `https://example.test/${prefix}/opaque?bbox={xmin},{ymin},{xmax},{ymax}`,
      visible: false,
      opacity: 1,
    },
  };
}

function createScene(layers: EncLayer[]): S100Scene {
  const queue = [...layers];
  return {
    layers: {
      addMany: vi.fn().mockImplementation((specs: unknown[]) =>
        Promise.resolve(queue.splice(0, specs.length)),
      ),
    },
  } as unknown as S100Scene;
}

function createMapLayer(id: string): EncLayer {
  return {
    id,
    product: id.startsWith("s57") ? "S-57" : "S-101",
    spec: { id, product: id.startsWith("s57") ? "S-57" : "S-101", category: "enc", standard: id.startsWith("s57") ? "S-57" : "S-101" },
    controllers: {
      map: {
        kind: "projected-map",
        alpha: 1,
        discardMode: 0,
        setAlpha: vi.fn().mockResolvedValue(undefined),
        setVisibility: vi.fn().mockResolvedValue(undefined),
        setDiscardMode: vi.fn().mockResolvedValue(undefined),
      },
    },
    nativeHandle: null,
    visible: true,
    opacity: 1,
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getNativeHandle: vi.fn().mockReturnValue(null),
    onChanged: vi.fn().mockReturnValue(() => {}),
  } as unknown as EncLayer;
}

function lastAlpha(layer: EncLayer): number {
  const calls = vi.mocked(layer.controllers.map.setAlpha).mock.calls;
  const lastCall = calls.at(-1);
  if (!lastCall) {
    throw new Error(`Layer ${layer.id} has no setAlpha calls.`);
  }
  return lastCall[0];
}
