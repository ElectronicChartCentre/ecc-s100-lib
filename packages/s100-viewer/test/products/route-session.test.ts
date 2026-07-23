import { describe, expect, it, vi } from "vitest";
import {
  parseRtzRoute,
  RouteFeatureError,
  RouteFeatureSession,
  RouteStyles,
  SceneBuilder,
  type RouteFetchLike,
  type RoutePlanLayerSpec,
} from "../../src/index.js";
import type { S100Unsubscribe } from "../../src/events/S100EventBus.js";
import { createLayerControllers } from "../../src/layers/controllers.js";
import type { S100Layer } from "../../src/layers/types.js";
import type { S100Scene } from "../../src/scene/types.js";

describe("RouteFeatureSession", () => {
  it("loads RTZ from a URL source, builds layout, and adds a route-plan layer", async () => {
    const fetchHandler = vi.fn<RouteFetchLike>(async () => ({
      ok: true,
      text: async () => sampleRtz,
    }));
    const diagnostics = vi.fn();
    const scene = createScene();
    const session = RouteFeatureSession.create({
      scene,
      fetchHandler,
      defaults: RouteStyles.s421Defaults({
        showCorridor: true,
      }),
      onDiagnostics: diagnostics,
    });

    const handle = await session.addRtz({
      id: "pilot-route",
      source: { kind: "url", url: "https://example.test/route.rtz" },
      style: {
        showWaypoints: false,
      },
    });

    expect(fetchHandler).toHaveBeenCalledWith(
      "https://example.test/route.rtz",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(scene.layers.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pilot-route",
        product: "route-plan",
        title: "Pilot Route",
        source: expect.objectContaining({
          kind: "route-plan",
          routePlan: expect.objectContaining({
            id: "pilot-route",
            sourceFormat: "rtz",
          }),
          layout: expect.objectContaining({
            routeId: "pilot-route",
            centerline: expect.objectContaining({
              positions: expect.arrayContaining([
                expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
              ]),
            }),
            corridors: expect.arrayContaining([
              expect.objectContaining({
                metadata: expect.objectContaining({
                  primitiveKind: "corridor",
                }),
              }),
            ]),
          }),
        }),
        style: expect.objectContaining({
          portrayal: "s421",
          showCorridor: true,
          showWaypoints: false,
        }),
      }),
    );
    expect(handle.id).toBe("pilot-route");
    expect(handle.layer.spec.source.layout?.corridors).toHaveLength(2);
    expect(handle.layer.spec.source.layout?.corridors.map((corridor) => corridor.metadata.side))
      .toEqual(["starboard", "portside"]);
    expect(diagnostics).toHaveBeenCalledWith([
      expect.objectContaining({
        code: "route-layout-local-tangent-projection",
      }),
    ]);
  });

  it("loads RTZ from XML and file-like sources", async () => {
    const scene = createScene();
    const session = RouteFeatureSession.create({ scene });

    const xmlHandle = await session.addRtz({
      source: { kind: "xml", xml: sampleRtz, sourceId: "inline-route" },
    });
    const fileHandle = await session.addRtz({
      id: "file-route",
      source: {
        kind: "file",
        name: "route.rtz",
        file: {
          text: async () => sampleRtz,
        },
      },
    });

    expect(xmlHandle.routePlan.id).toBe("inline-route");
    expect(fileHandle.id).toBe("file-route");
    expect(session.routeHandles.map((handle) => handle.id)).toEqual([
      "inline-route",
      "file-route",
    ]);
  });

  it("adds already parsed route plans without fetching or reparsing", async () => {
    const routePlan = parseRtzRoute(sampleRtz, { id: "parsed-route" });
    const scene = createScene();
    const session = RouteFeatureSession.create({ scene });

    const handle = await session.addRoutePlan({
      routePlan,
      style: RouteStyles.s421Hybrid3d(),
    });

    expect(handle.routePlan).toBe(routePlan);
    expect(handle.layer.spec.style).toMatchObject({
      visualization: "hybrid-3d",
      showRouteVolume: true,
      showRouteSides: true,
    });
    expect(handle.layout.routeVolumes).toHaveLength(8);
    expect(scene.layers.add).toHaveBeenCalledTimes(1);
  });

  it("forwards handle updates and removal to the route layer", async () => {
    const scene = createScene();
    const session = RouteFeatureSession.create({ scene });
    const handle = await session.addRtz({
      source: { kind: "xml", xml: sampleRtz },
    });
    const layer = handle.layer;

    await handle.setVisible(false);
    await handle.setOpacity(0.25);
    await handle.setStyle({ showCorridor: false });
    await handle.remove();

    expect(layer.update).toHaveBeenCalledWith({
      visible: false,
      style: expect.objectContaining({
        visible: false,
      }),
    });
    expect(layer.update).toHaveBeenCalledWith({
      opacity: 0.25,
      style: expect.objectContaining({
        opacity: 0.25,
      }),
    });
    expect(layer.update).toHaveBeenCalledWith({
      style: expect.objectContaining({
        showCorridor: false,
      }),
    });
    expect(layer.remove).toHaveBeenCalledTimes(1);
    expect(session.routeHandles).toEqual([]);
  });

  it("removes all tracked route layers on clear and dispose", async () => {
    const scene = createScene();
    const session = RouteFeatureSession.create({ scene });
    const first = await session.addRtz({
      id: "first",
      source: { kind: "xml", xml: sampleRtz },
    });
    const second = await session.addRtz({
      id: "second",
      source: { kind: "xml", xml: sampleRtz },
    });

    await session.clear();

    expect(first.layer.remove).toHaveBeenCalledTimes(1);
    expect(second.layer.remove).toHaveBeenCalledTimes(1);
    expect(session.routeHandles).toEqual([]);

    const third = await session.addRtz({
      id: "third",
      source: { kind: "xml", xml: sampleRtz },
    });
    await session.dispose();

    expect(third.layer.remove).toHaveBeenCalledTimes(1);
  });

  it("throws RouteFeatureError when URL sources cannot be fetched", async () => {
    const session = RouteFeatureSession.create({
      scene: createScene(),
      fetchHandler: vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "",
      })),
    });

    await expect(session.addRtz({
      source: { kind: "url", url: "https://example.test/missing.rtz" },
    })).rejects.toMatchObject({
      name: "RouteFeatureError",
      code: "route-source-unavailable",
    } satisfies Partial<RouteFeatureError>);
  });
});

type RouteLayer = S100Layer<RoutePlanLayerSpec>;

const createScene = (): S100Scene => ({
  georeference: SceneBuilder.projectedLocal({
    crs: "EPSG:32633",
    origin: {
      kind: "geodetic",
      lon: 5,
      lat: 60,
      height: 0,
      datum: "WGS84",
    },
  }),
  layers: {
    add: vi.fn(async (spec: RoutePlanLayerSpec) => createRouteLayer(spec)),
  },
} as unknown as S100Scene);

const createRouteLayer = (initialSpec: RoutePlanLayerSpec): RouteLayer => {
  let currentSpec = initialSpec;
  const layer = {
    id: initialSpec.id,
    product: initialSpec.product,
    get spec() {
      return currentSpec;
    },
    controllers: {} as RouteLayer["controllers"],
    nativeHandle: null,
    visible: initialSpec.visible ?? true,
    opacity: initialSpec.opacity ?? 1,
    update: vi.fn(async (patch: Partial<RoutePlanLayerSpec>) => {
      currentSpec = {
        ...currentSpec,
        ...patch,
      };
    }),
    remove: vi.fn(async () => {}),
    getNativeHandle: vi.fn(() => null),
    onChanged: vi.fn((): S100Unsubscribe => () => {}),
  } satisfies RouteLayer;
  layer.controllers = createLayerControllers(layer);
  return layer;
};

const sampleRtz = `<?xml version="1.0" encoding="utf-8"?>
<route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2">
  <routeInfo routeName="Pilot Route" />
  <waypoints>
    <defaultWaypoint radius="0.1">
      <leg starboardXTD="0.1" portsideXTD="0.1" safetyDepth="12" geometryType="Loxodrome" />
    </defaultWaypoint>
    <waypoint id="1" revision="1">
      <position lat="60" lon="5" />
    </waypoint>
    <waypoint id="2" revision="1">
      <position lat="60.1" lon="5" />
    </waypoint>
  </waypoints>
</route>`;
