import { describe, expect, it } from "vitest";
import type { VesselLayerSpec } from "@ecc/s100-viewer";
import * as THREE from "three";
import { createVesselLayer } from "../src/layers/vesselLayer.js";
import type { ThreeProjectedLocalReference } from "../src/coordinates/projectedLocal.js";

describe("@ecc/s100-viewer-adapter-three vessel layer", () => {
  it("renders a vessel-local animated ocean surface in the z-up sea-level plane", async () => {
    const scene = new THREE.Scene();
    const reference: ThreeProjectedLocalReference = {
      crs: "EPSG:32633",
      origin: { x: 0, y: 0, z: 0 },
    };
    let seaLevel = 3;
    const spec = sampleVesselSpec();

    const native = await createVesselLayer(spec, scene, reference, () => seaLevel);
    const oceanSurface = getOceanSurface(scene, spec.id);

    expect(oceanSurface.visible).toBe(true);
    expect(oceanSurface.geometry.parameters.radius).toBe(70);
    expect(oceanSurface.material.opacity).toBeCloseTo(0.4);
    expect(oceanSurface.position.x).toBeCloseTo(110);
    expect(oceanSurface.position.y).toBeCloseTo(195);
    expect(oceanSurface.position.z).toBeCloseTo(3.03);
    expect(oceanSurface.material.userData.s100WaterUniforms).toBeDefined();

    seaLevel = 4.5;
    native.update?.(new Date());
    expect(oceanSurface.position.z).toBeCloseTo(4.53);

    native.dispose();
    expect(scene.children).not.toContain(oceanSurface);
  });
});

const getOceanSurface = (
  scene: THREE.Scene,
  vesselId: string,
): THREE.Mesh<THREE.CircleGeometry, THREE.MeshPhysicalMaterial> => {
  const object = scene.children.find((child) =>
    child.name === `three-vessel-ocean-surface-${vesselId}`);
  if (!(object instanceof THREE.Mesh)) {
    throw new Error("Expected vessel ocean surface mesh.");
  }
  return object as THREE.Mesh<THREE.CircleGeometry, THREE.MeshPhysicalMaterial>;
};

const sampleVesselSpec = (): VesselLayerSpec => ({
  id: "vessel",
  product: "vessel",
  opacity: 0.8,
  source: {
    kind: "parametric-vessel",
    spec: {},
  } as unknown as VesselLayerSpec["source"],
  pose: {
    position: {
      kind: "projected",
      crs: "EPSG:32633",
      x: 100,
      y: 200,
      z: 6,
    },
    headingDegrees: 90,
  },
  dimensions: {
    draught: 8,
    bow: 30,
    stern: 10,
    port: 5,
    starboard: 15,
  },
  style: {
    oceanSurface: {
      enabled: true,
      radiusMeters: 70,
      opacity: 0.5,
    },
  },
});
