import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildRoutePlanLayout,
  LayerBuilder,
  RouteStyles,
  type RoutePlan,
  type RoutePlanLayerSpec,
} from "@ecc/s100-viewer";
import { createRoutePlanLayer } from "../src/layers/routePlanLayer.js";

describe("@ecc/s100-viewer-adapter-three route layer", () => {
  it("renders curved S-421 route corridor, boundaries, waypoints, and hybrid volume", () => {
    const scene = new THREE.Scene();
    const routePlan = sampleRightTurnRoutePlan();
    const layout = buildRoutePlanLayout(routePlan, {
      includeRouteVolume: true,
      projection: directPlanarProjection(),
      turnArcSegmentAngleDegrees: 10,
    });
    const spec = LayerBuilder.createRoutePlan({
      id: "three-route",
      routePlan,
      layout,
      style: RouteStyles.s421Hybrid3d(),
    });

    const native = createRoutePlanLayer(spec, scene, {
      crs: "test-planar",
      origin: { x: 0, y: 0, z: 0 },
    });
    const root = native.root;
    if (!root) {
      throw new Error("Expected route layer root.");
    }

    expect(scene.children).toContain(root);
    expect(routePrimitiveKinds(root)).toEqual(expect.arrayContaining([
      "centerline",
      "corridor",
      "route-volume",
      "waypoint",
      "xtd-boundary",
    ]));
    expect(routeMetadata(root).filter((metadata) => metadata.primitiveKind === "corridor"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ side: "starboard" }),
        expect.objectContaining({ side: "portside" }),
      ]));
    const firstCorridor = root.children.find((child) =>
      child.userData.s100PickMetadata?.primitiveKind === "corridor");
    if (!(firstCorridor instanceof THREE.Mesh)) {
      throw new Error("Expected corridor mesh.");
    }
    const vertexCount = firstCorridor.geometry.getAttribute("position").count;
    expect(Array.from(firstCorridor.geometry.getIndex()?.array ?? []).slice(0, 6)).toEqual([
      0,
      1,
      vertexCount - 2,
      0,
      vertexCount - 2,
      vertexCount - 1,
    ]);
    expect(routeMetadata(root).filter((metadata) => metadata.primitiveKind === "route-volume"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ side: "starboard", depthBand: "safety-depth" }),
        expect.objectContaining({ side: "portside", depthBand: "safety-depth" }),
        expect.objectContaining({ depthBand: "below-safety-depth" }),
      ]));

    const patch = { style: RouteStyles.s421Defaults() } satisfies Partial<RoutePlanLayerSpec>;
    Object.assign(native.spec, patch);
    native.patch?.(patch);
    expect(routePrimitiveKinds(root)).not.toContain("route-volume");

    native.dispose();
    expect(scene.children).not.toContain(root);
  });
});

const routePrimitiveKinds = (root: THREE.Object3D | null): string[] => {
  if (!root) {
    return [];
  }
  return root.children
    .map((child) => child.userData.s100PickMetadata?.primitiveKind)
    .filter((value): value is string => typeof value === "string");
};

const routeMetadata = (root: THREE.Object3D | null): Array<Record<string, unknown>> => {
  if (!root) {
    return [];
  }
  return root.children
    .map((child) => child.userData.s100PickMetadata)
    .filter((value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null);
};

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
