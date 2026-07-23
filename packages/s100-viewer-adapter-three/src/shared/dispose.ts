import * as THREE from "three";

export const disposeThreeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        disposeMaterial(item);
      }
    } else if (material) {
      disposeMaterial(material);
    }
  });
};

const disposeMaterial = (material: THREE.Material): void => {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && "isTexture" in value) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
};
