import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createThreeZUpSkyDome } from "../src/environment/skyDome.js";

describe("@ecc/s100-viewer-adapter-three environment", () => {
  it("creates a camera-centered z-up skydome for equirectangular backgrounds", () => {
    const texture = new THREE.Texture();
    const skyDome = createThreeZUpSkyDome(texture, {
      backgroundIntensity: 0.7,
    });
    const material = skyDome.material;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 20, 30);

    skyDome.onBeforeRender(
      {} as THREE.WebGLRenderer,
      scene,
      camera,
      new THREE.BufferGeometry(),
      material,
      new THREE.Group(),
    );

    expect(skyDome.name).toBe("three-s100-environment-skydome");
    expect(skyDome.position.toArray()).toEqual([10, 20, 30]);
    expect(material.side).toBe(THREE.BackSide);
    expect(material.depthWrite).toBe(false);
    expect(material.uniforms.skyMap?.value).toBe(texture);
    expect(material.uniforms.intensity?.value).toBe(0.7);
    expect(material.fragmentShader).toContain("worldDirection.z");
  });
});
