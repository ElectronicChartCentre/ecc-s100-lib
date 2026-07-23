import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  coordinateToWorld,
  projectedMetersToWorld,
  worldToProjectedCoordinate,
  type ThreeProjectedLocalReference,
} from "../src/coordinates/projectedLocal.js";

describe("@ecc/s100-viewer-adapter-three projected-local coordinates", () => {
  it("uses a z-up world frame matching NASA-AMMOS projected-local scenes", () => {
    const reference: ThreeProjectedLocalReference = {
      crs: "EPSG:32633",
      origin: { x: 100, y: 200, z: 5 },
    };

    expect(projectedMetersToWorld(110, 230, 9, reference)).toMatchObject({
      x: 10,
      y: 30,
      z: 4,
    });
    expect(coordinateToWorld({
      kind: "engine-local",
      x: 1,
      y: 2,
      z: 3,
      frameId: "three",
    }, reference)).toMatchObject({
      x: 1,
      y: 2,
      z: 3,
    });
    expect(worldToProjectedCoordinate(new THREE.Vector3(10, 30, 4), reference))
      .toEqual({
        kind: "projected",
        crs: "EPSG:32633",
        x: 110,
        y: 230,
        z: 9,
      });
  });
});
