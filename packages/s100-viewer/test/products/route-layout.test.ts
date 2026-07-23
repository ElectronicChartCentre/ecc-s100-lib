import { describe, expect, it } from "vitest";
import {
  buildRoutePlanLayout,
  nauticalMilesToMeters,
  parseRtzRoute,
  type RoutePlan,
  RouteStyles,
} from "../../src/index.js";

describe("buildRoutePlanLayout", () => {
  it("builds meter-correct centerline, waypoint, XTD boundary, and corridor primitives", () => {
    const routePlan = parseRtzRoute(sampleRtz);
    const layout = buildRoutePlanLayout(routePlan);

    expect(layout.centerline?.positions).toHaveLength(2);
    expect(layout.waypoints).toHaveLength(2);
    expect(layout.legBoundaries).toHaveLength(2);
    expect(layout.corridors).toHaveLength(2);
    expect(layout.corridors.map((corridor) => corridor.metadata.side)).toEqual([
      "starboard",
      "portside",
    ]);
    expect(layout.diagnostics).toEqual([
      expect.objectContaining({
        code: "route-layout-local-tangent-projection",
        severity: "info",
      }),
    ]);

    const starboardRing = layout.corridors[0]?.rings[0];
    const portsideRing = layout.corridors[1]?.rings[0];
    expect(starboardRing).toHaveLength(5);
    expect(portsideRing).toHaveLength(5);
    const starboardHalfWidth = projectedDistance(starboardRing?.[0], starboardRing?.[3]);
    const portsideHalfWidth = projectedDistance(portsideRing?.[0], portsideRing?.[3]);
    expect(
      Math.abs((starboardHalfWidth + portsideHalfWidth) - nauticalMilesToMeters(0.2)),
    ).toBeLessThan(1);
    expect(starboardRing?.[3]?.x).toBeGreaterThan(0);
    expect(portsideRing?.[0]?.x).toBeLessThan(0);
  });

  it("uses a caller-provided projection without local tangent diagnostics", () => {
    const routePlan = parseRtzRoute(sampleRtz);
    const layout = buildRoutePlanLayout(routePlan, {
      projection: {
        crs: "test-projection",
        project(position) {
          return {
            x: position.lon * 1000,
            y: position.lat * 1000,
            z: position.heightMeters ?? 0,
          };
        },
      },
    });

    expect(layout.diagnostics).toEqual([]);
    expect(layout.centerline?.positions[0]).toEqual({
      x: 5000,
      y: 60000,
      z: 0,
    });
  });

  it("creates optional turn-radius debug geometry", () => {
    const routePlan = parseRtzRoute(sampleRtz);
    const layout = buildRoutePlanLayout(routePlan, {
      includeTurnDebugGeometry: true,
      turnDebugSegments: 12,
    });

    expect(layout.debug).toHaveLength(2);
    expect(layout.debug[0]).toMatchObject({
      id: "North Route:waypoint:1:turn-radius-debug",
      positions: expect.arrayContaining([
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      ]),
      metadata: {
        routeId: "North Route",
        sourceFormat: "rtz",
        primitiveKind: "debug",
        waypointId: "1",
      },
    });
    const debugPrimitive = layout.debug[0];
    if (!debugPrimitive || !("positions" in debugPrimitive)) {
      throw new Error("Expected debug primitive with positions.");
    }
    expect(debugPrimitive.positions).toHaveLength(13);
  });

  it("creates optional COGS-style route side and cap meshes", () => {
    const routePlan = parseRtzRoute(sampleRtz);
    const layout = buildRoutePlanLayout(routePlan, {
      includeRouteVolume: true,
      seaLevelMeters: 2,
    });

    expect(layout.routeVolumes).toHaveLength(8);
    expect(layout.routeVolumes[0]).toMatchObject({
      id: "North Route:leg:1:2:starboard-safety-depth-side",
      positions: expect.arrayContaining([
        expect.objectContaining({ z: 2 }),
        expect.objectContaining({ z: -10 }),
      ]),
      indices: [0, 1, 2, 0, 2, 3],
      metadata: {
        routeId: "North Route",
        sourceFormat: "rtz",
        primitiveKind: "route-volume",
        legId: "1:2",
        side: "starboard",
        depthBand: "safety-depth",
      },
    });
    expect(layout.routeVolumes[4]).toEqual(expect.objectContaining({
      id: "North Route:leg:1:2:starboard-below-safety-depth-side",
      positions: expect.arrayContaining([
        expect.objectContaining({ z: -10 }),
        expect.objectContaining({ z: -98 }),
      ]),
      metadata: expect.objectContaining({
        side: "starboard",
        depthBand: "below-safety-depth",
      }),
    }));
    expect(layout.routeVolumes.map((volume) => volume.id)).toEqual([
      "North Route:leg:1:2:starboard-safety-depth-side",
      "North Route:leg:1:2:portside-safety-depth-side",
      "North Route:leg:1:2:start-safety-depth-cap",
      "North Route:leg:1:2:end-safety-depth-cap",
      "North Route:leg:1:2:starboard-below-safety-depth-side",
      "North Route:leg:1:2:portside-below-safety-depth-side",
      "North Route:leg:1:2:start-below-safety-depth-cap",
      "North Route:leg:1:2:end-below-safety-depth-cap",
    ]);
  });

  it("samples waypoint turn radii into curved centerline, corridor, and volume geometry", () => {
    const routePlan = sampleRightTurnRoutePlan();
    const layout = buildRoutePlanLayout(routePlan, {
      includeRouteVolume: true,
      projection: directPlanarProjection(),
      seaLevelMeters: 1,
      turnArcSegmentAngleDegrees: 10,
    });

    expect(layout.diagnostics).toEqual([]);
    expect(layout.centerline?.positions.length).toBeGreaterThan(3);
    expect(layout.centerline?.positions).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: expect.closeTo(0, 6), y: expect.closeTo(80, 6) }),
      expect.objectContaining({ x: expect.closeTo(20, 6), y: expect.closeTo(100, 6) }),
    ]));
    expect(layout.centerline?.positions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ x: expect.closeTo(0, 6), y: expect.closeTo(100, 6) }),
    ]));
    expect(layout.legBoundaries).toHaveLength(4);
    expect(layout.legBoundaries.every((boundary) => boundary.positions.length > 2)).toBe(true);
    expect(layout.corridors).toHaveLength(4);
    expect(layout.corridors.every((corridor) => (corridor.rings[0]?.length ?? 0) > 5)).toBe(true);
    expect(layout.routeVolumes).toHaveLength(16);
    expect(
      layout.routeVolumes
        .filter((volume) => volume.metadata.side !== undefined)
        .every((volume) => volume.positions.length > 8),
    ).toBe(true);
  });

  it("omits corridor primitives when XTD values are missing", () => {
    const routePlan = parseRtzRoute(`
      <route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2">
        <routeInfo routeName="No XTD" />
        <waypoints>
          <waypoint id="1" revision="1">
            <position lat="60" lon="5" />
          </waypoint>
          <waypoint id="2" revision="1">
            <position lat="60.1" lon="5" />
          </waypoint>
        </waypoints>
      </route>
    `);
    const layout = buildRoutePlanLayout(routePlan);

    expect(layout.centerline?.positions).toHaveLength(2);
    expect(layout.legBoundaries).toEqual([]);
    expect(layout.corridors).toEqual([]);
  });

  it("keeps default S-421 style separate from hybrid 3D style", () => {
    expect(RouteStyles.s421Defaults()).toMatchObject({
      visualization: "standard",
      showRouteVolume: false,
      showRouteSides: false,
    });
    expect(RouteStyles.s421Hybrid3d()).toMatchObject({
      visualization: "hybrid-3d",
      showRouteVolume: true,
      showRouteSides: true,
    });
  });
});

const projectedDistance = (
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
): number => {
  if (!a || !b) {
    throw new Error("Missing projected point.");
  }
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const sampleRtz = `<?xml version="1.0" encoding="utf-8"?>
<route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2">
  <routeInfo routeName="North Route" />
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

const directPlanarProjection = () => ({
  crs: "test-planar",
  project(position: { lon: number; lat: number; heightMeters?: number }) {
    return {
      x: position.lon,
      y: position.lat,
      z: position.heightMeters ?? 0,
    };
  },
});

const sampleRightTurnRoutePlan = (): RoutePlan => ({
  id: "right-turn-route",
  sourceFormat: "route-plan",
  routeInfo: {
    name: "Right turn route",
    values: {},
  },
  waypoints: [
    {
      id: "A",
      position: { lon: 0, lat: 0 },
      extensions: [],
    },
    {
      id: "B",
      position: { lon: 0, lat: 100 },
      radiusMeters: 20,
      extensions: [],
    },
    {
      id: "C",
      position: { lon: 100, lat: 100 },
      extensions: [],
    },
  ],
  legs: [
    {
      id: "A:B",
      fromWaypointId: "A",
      toWaypointId: "B",
      geometryType: "loxodrome",
      portsideXtdMeters: 10,
      starboardXtdMeters: 10,
      safetyDepthMeters: 12,
      extensions: [],
    },
    {
      id: "B:C",
      fromWaypointId: "B",
      toWaypointId: "C",
      geometryType: "loxodrome",
      portsideXtdMeters: 10,
      starboardXtdMeters: 10,
      safetyDepthMeters: 12,
      extensions: [],
    },
  ],
  schedules: [],
  extensions: [],
  diagnostics: [],
});
