import type { BaseLayerSpec, PickResult } from "@ecc/s100-viewer";
import * as THREE from "three";

export type ThreeLayerNative<TSpec extends BaseLayerSpec = BaseLayerSpec> = {
  readonly spec: TSpec;
  readonly root: THREE.Object3D | null;
  update?(time: Date): void;
  patch?(patch: Partial<TSpec>): void | Promise<void>;
  setVisible?(visible: boolean): void;
  setOpacity?(opacity: number): void;
  getPickableObjects?(): THREE.Object3D[];
  dispose(): void | Promise<void>;
};

export const setObjectVisibility = (
  object: THREE.Object3D | null,
  visible: boolean | undefined,
): void => {
  if (object && visible !== undefined) {
    object.visible = visible;
  }
};

export const setObjectOpacity = (
  object: THREE.Object3D | null,
  opacity: number | undefined,
): void => {
  if (!object || opacity === undefined) {
    return;
  }
  object.traverse((child) => {
    const material = (child as THREE.Mesh).material;
    if (Array.isArray(material)) {
      for (const item of material) {
        setMaterialOpacity(item, opacity);
      }
      return;
    }
    if (material) {
      setMaterialOpacity(material, opacity);
    }
  });
};

export const setLayerUserData = (
  object: THREE.Object3D,
  spec: BaseLayerSpec,
  pickSource: PickResult["source"],
  featureId?: string,
): void => {
  object.userData = {
    ...object.userData,
    layerId: spec.id,
    product: spec.product,
    pickSource,
    ...(featureId !== undefined ? { featureId } : {}),
  };
};

const setMaterialOpacity = (material: THREE.Material, opacity: number): void => {
  material.opacity = opacity;
  material.transparent = opacity < 1 || material.transparent;
  material.needsUpdate = true;
};
