import { describe, expect, it } from "vitest";
import {
  buildRoutePlanLayout,
  nauticalMilesToMeters,
  parseRtzRoute,
  RouteStyles,
} from "../../src/index.js";

describe("buildRoutePlanLayout", () => {
  it("builds meter-correct centerline, waypoint, XTD boundary, and corridor primitives", () => {
    const routePlan = parseRtzRoute(sampleRtz);
    const layout = buildRoutePlanLayout(routePlan);

    expect(layout.centerline?.positions).toHaveLength(2);
    expect(layout.waypoints).toHaveLength(2);
    expect(layout.legBoundaries).toHaveLength(2);
    expect(layout.corridors).toHaveLength(1);
    expect(layout.diagnostics).toEqual([
      expect.objectContaining({
        code: "route-layout-local-tangent-projection",
        severity: "info",
      }),
    ]);

    const ring = layout.corridors[0]?.rings[0];
    expect(ring).toHaveLength(5);
    const startWidth = projectedDistance(ring?.[0], ring?.[3]);
    expect(Math.abs(startWidth - nauticalMilesToMeters(0.2))).toBeLessThan(1);
    expect(ring?.[0]?.x).toBeGreaterThan(0);
    expect(ring?.[3]?.x).toBeLessThan(0);
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

  it("creates optional safety-depth route volume meshes", () => {
    const routePlan = parseRtzRoute(sampleRtz);
    const layout = buildRoutePlanLayout(routePlan, {
      includeRouteVolume: true,
      seaLevelMeters: 2,
    });

    expect(layout.routeVolumes).toHaveLength(1);
    expect(layout.routeVolumes[0]).toMatchObject({
      id: "North Route:leg:1:2:safety-depth-volume",
      positions: expect.arrayContaining([
        expect.objectContaining({ z: 2 }),
        expect.objectContaining({ z: -10 }),
      ]),
      indices: expect.arrayContaining([0, 1, 2, 3, 4, 0]),
      metadata: {
        routeId: "North Route",
        sourceFormat: "rtz",
        primitiveKind: "route-volume",
        legId: "1:2",
      },
    });
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
