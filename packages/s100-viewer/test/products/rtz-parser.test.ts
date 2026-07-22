import { describe, expect, it } from "vitest";
import {
  nauticalMilesToMeters,
  parseRtzRoute,
  RtzParseError,
} from "../../src/index.js";

describe("parseRtzRoute", () => {
  it("parses RTZ 1.2 route info, waypoints, default leg values, schedules, and extensions", () => {
    const route = parseRtzRoute(sampleRtz, {
      id: "test-route",
      includeRaw: true,
    });

    expect(route).toMatchObject({
      id: "test-route",
      sourceFormat: "rtz",
      sourceVersion: "1.2",
      routeInfo: {
        name: "Pilot Route",
        routeName: "Pilot Route",
        author: "ECC",
        vesselName: "Demo Vessel",
      },
    });
    expect(route.waypoints).toHaveLength(3);
    expect(route.waypoints[0]).toMatchObject({
      id: "1",
      revision: "1",
      name: "Start",
      position: {
        lon: 5.1,
        lat: 60.1,
      },
      sourceRadiusNm: 0.4,
      radiusMeters: nauticalMilesToMeters(0.4),
    });
    expect(route.waypoints[1]).toMatchObject({
      id: "2",
      sourceRadiusNm: 0.2,
      radiusMeters: nauticalMilesToMeters(0.2),
    });
    expect(route.legs).toHaveLength(2);
    expect(route.legs[0]).toMatchObject({
      id: "1:2",
      fromWaypointId: "1",
      toWaypointId: "2",
      geometryType: "loxodrome",
      sourceStarboardXtdNm: 0.1,
      starboardXtdMeters: nauticalMilesToMeters(0.1),
      sourcePortsideXtdNm: 0.2,
      portsideXtdMeters: nauticalMilesToMeters(0.2),
      safetyDepthMeters: 12,
      speedMinKnots: 5,
      speedMaxKnots: 12,
      draughtMeters: 9,
      ukcMeters: 1.5,
      notes: "ETA note\nLocal note",
      report: "Report at WP2",
      info: "Pilot boarding area",
    });
    expect(route.legs[1]).toMatchObject({
      id: "2:3",
      geometryType: "orthodrome",
      sourceStarboardXtdNm: 0.3,
      sourcePortsideXtdNm: 0.4,
    });
    expect(route.schedules).toEqual([
      {
        id: "1",
        name: "Manual",
        values: {
          id: "1",
          name: "Manual",
        },
        elements: [
          {
            waypointId: "1",
            etd: "2026-07-22T10:00:00Z",
            speedKnots: 8,
            values: {
              waypointId: "1",
              etd: "2026-07-22T10:00:00Z",
              speed: "8",
            },
            extensions: [],
          },
        ],
        extensions: [],
      },
    ]);
    expect(route.extensions).toHaveLength(1);
    expect(route.extensions[0]).toMatchObject({
      manufacturer: "ECC",
      name: "RouteNote",
      version: "1",
      children: [
        {
          name: "ecc:note",
          text: "Preserve me",
        },
      ],
    });
    expect(route.diagnostics).toEqual([]);
    expect(route.raw).toBeDefined();
  });

  it("warns for compatible-but-not-primary RTZ versions", () => {
    const route = parseRtzRoute(sampleRtz.replace('version="1.2"', 'version="1.0"'));

    expect(route.sourceVersion).toBe("1.0");
    expect(route.diagnostics).toEqual([
      expect.objectContaining({
        code: "rtz-version-unsupported",
        severity: "warning",
      }),
    ]);
  });

  it("throws when the route has fewer than two valid waypoints", () => {
    expect(() => parseRtzRoute(`
      <route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2">
        <routeInfo routeName="Invalid" />
        <waypoints>
          <waypoint id="1" revision="1">
            <position lat="60" lon="5" />
          </waypoint>
        </waypoints>
      </route>
    `)).toThrow(RtzParseError);
  });

  it("keeps parsing with diagnostics for non-fatal invalid values", () => {
    const route = parseRtzRoute(`
      <route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2">
        <routeInfo routeName="Diagnostics" />
        <waypoints>
          <defaultWaypoint radius="7">
            <leg starboardXTD="12" portsideXTD="0.2" geometryType="Curved" />
          </defaultWaypoint>
          <waypoint id="1" revision="1">
            <position lat="60" lon="5" />
          </waypoint>
          <waypoint id="2" revision="1">
            <position lat="60.1" lon="5.1" />
          </waypoint>
        </waypoints>
      </route>
    `);

    expect(route.waypoints[0]?.radiusMeters).toBeUndefined();
    expect(route.legs[0]).toMatchObject({
      geometryType: "unknown",
      sourcePortsideXtdNm: 0.2,
      portsideXtdMeters: nauticalMilesToMeters(0.2),
    });
    expect(route.diagnostics.map((item) => item.code)).toEqual([
      "rtz-radius-out-of-range",
      "rtz-geometry-type-unsupported",
      "rtz-xtd-out-of-range",
    ]);
  });
});

const sampleRtz = `<?xml version="1.0" encoding="utf-8"?>
<route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2" xmlns:ecc="https://ecc.no/rtz">
  <routeInfo routeName="Pilot Route" routeAuthor="ECC" vesselName="Demo Vessel" />
  <waypoints>
    <defaultWaypoint radius="0.4">
      <leg starboardXTD="0.1" portsideXTD="0.2" safetyDepth="12" geometryType="Loxodrome" speedMin="5" speedMax="12" draughtForward="8" draughtAft="9" staticUKC="2" dynamicUKC="1.5" legReport="Report at WP2" legInfo="Pilot boarding area" legNote1="ETA note" legNote2="Local note" />
    </defaultWaypoint>
    <waypoint id="1" revision="1" name="Start">
      <position lat="60.1" lon="5.1" />
    </waypoint>
    <waypoint id="2" revision="1" radius="0.2">
      <position lat="60.2" lon="5.2" />
      <leg starboardXTD="0.3" portsideXTD="0.4" geometryType="Orthodrome" />
    </waypoint>
    <waypoint id="3" revision="1" name="Finish">
      <position lat="60.3" lon="5.3" />
    </waypoint>
  </waypoints>
  <schedules>
    <schedule id="1" name="Manual">
      <manual>
        <scheduleElement waypointId="1" etd="2026-07-22T10:00:00Z" speed="8" />
      </manual>
    </schedule>
  </schedules>
  <extensions>
    <extension manufacturer="ECC" name="RouteNote" version="1">
      <ecc:note>Preserve me</ecc:note>
    </extension>
  </extensions>
</route>`;

