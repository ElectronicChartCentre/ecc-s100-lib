import type { BaseLayerSpec, VesselLayerSpec, VesselDimensions } from "@ecc/s100-viewer";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  coordinateToWorld,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";
import { disposeThreeObject } from "../shared/dispose.js";
import {
  setLayerUserData,
  setObjectOpacity,
  setObjectVisibility,
  type ThreeLayerNative,
} from "./types.js";

export const createVesselLayer = async (
  spec: BaseLayerSpec,
  scene: THREE.Scene,
  reference: ThreeProjectedLocalReference,
): Promise<ThreeLayerNative<VesselLayerSpec>> => {
  const vesselSpec = spec as VesselLayerSpec;
  const group = new THREE.Group();
  group.name = `three-vessel-${spec.id}`;
  group.visible = spec.visible ?? true;
  const model = await createVesselObject(vesselSpec);
  setLayerUserData(model, vesselSpec, "vector", vesselSpec.id);
  group.add(model);
  applyVesselPose(group, vesselSpec, reference);
  setObjectOpacity(group, spec.opacity ?? vesselSpec.style?.opacity ?? 1);
  scene.add(group);

  return {
    spec: vesselSpec,
    root: group,
    setVisible: (visible) => {
      group.visible = visible;
    },
    setOpacity: (opacity) => {
      setObjectOpacity(group, opacity);
    },
    getPickableObjects: () => [group],
    patch: (patch) => {
      setObjectVisibility(group, patch.visible);
      setObjectOpacity(group, patch.opacity ?? patch.style?.opacity);
      applyVesselPose(group, vesselSpec, reference);
    },
    dispose: () => {
      scene.remove(group);
      disposeThreeObject(group);
    },
  };
};

const createVesselObject = async (
  spec: VesselLayerSpec,
): Promise<THREE.Object3D> => {
  if (spec.source.kind === "model") {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(spec.source.url);
      const model = gltf.scene;
      applyModelOrientation(model, spec);
      return model;
    } catch {
      return createFallbackVessel(spec);
    }
  }

  return createFallbackVessel(spec);
};

const createFallbackVessel = (spec: VesselLayerSpec): THREE.Object3D => {
  const dimensions = resolveDimensions(spec.dimensions);
  const width = dimensions.port + dimensions.starboard;
  const length = dimensions.bow + dimensions.stern;
  const height = Math.max(4, dimensions.draught * 0.6);
  const shape = new THREE.Shape();
  shape.moveTo(0, dimensions.bow);
  shape.lineTo(dimensions.starboard, dimensions.bow * 0.25);
  shape.lineTo(dimensions.starboard, -dimensions.stern);
  shape.lineTo(-dimensions.port, -dimensions.stern);
  shape.lineTo(-dimensions.port, dimensions.bow * 0.25);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(2, width * 0.08),
    bevelThickness: Math.min(2, height * 0.2),
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, height / 2, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd0d4d8,
    roughness: 0.72,
    metalness: 0.18,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const applyVesselPose = (
  group: THREE.Group,
  spec: VesselLayerSpec,
  reference: ThreeProjectedLocalReference,
): void => {
  group.position.copy(coordinateToWorld(spec.pose.position, reference));
  const heading = spec.pose.headingDegrees ?? 0;
  const pitch = spec.pose.pitchDegrees ?? 0;
  const roll = spec.pose.rollDegrees ?? 0;
  group.rotation.set(
    THREE.MathUtils.degToRad(pitch),
    THREE.MathUtils.degToRad(-heading),
    THREE.MathUtils.degToRad(roll),
  );
};

const applyModelOrientation = (
  model: THREE.Object3D,
  spec: VesselLayerSpec,
): void => {
  const orientation = spec.model?.orientation;
  if (orientation) {
    model.quaternion.multiply(
      new THREE.Quaternion(
        orientation[0],
        orientation[1],
        orientation[2],
        orientation[3],
      ),
    );
  }
};

const resolveDimensions = (
  dimensions: VesselDimensions | undefined,
): VesselDimensions => ({
  draught: dimensions?.draught ?? 8,
  bow: dimensions?.bow ?? 35,
  stern: dimensions?.stern ?? 15,
  port: dimensions?.port ?? 8,
  starboard: dimensions?.starboard ?? 8,
});
