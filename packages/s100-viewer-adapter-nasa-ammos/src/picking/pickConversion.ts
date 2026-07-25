import {
  type LivePickingOptions,
  type PickRequest,
  type PickResult,
} from "@ecc/s100-viewer";
import { depthFromElevation } from "@ecc/s100-viewer/internal/products/depthStyle";
import {
  Raycaster,
  Vector2,
  Vector3,
  type Object3D,
} from "three";
import type { PickedInfo } from "../runtime/scene/NasaSceneRuntime.js";

export const applyPickingRayVisualOptions = (
  pickingRay: {
    lineThickness: number;
    ray: {
      belowSeaLevelColor: [number, number, number];
      aboveSeaLevelColor: [number, number, number];
      seaLevelMarkerVisible: boolean;
      seaLevelMarkerSize: number;
      seaLevelMarkerOpacity: number;
      seaLevelMarkerColor: [number, number, number];
    };
  },
  visual: LivePickingOptions["visual"] | undefined,
): void => {
  if (!visual) {
    return;
  }

  if (visual.lineThickness !== undefined) {
    pickingRay.lineThickness = visual.lineThickness;
  }
  if (visual.belowSeaLevelColor !== undefined) {
    pickingRay.ray.belowSeaLevelColor = [...visual.belowSeaLevelColor];
  }
  if (visual.aboveSeaLevelColor !== undefined) {
    pickingRay.ray.aboveSeaLevelColor = [...visual.aboveSeaLevelColor];
  }
  if (visual.seaLevelMarkerVisible !== undefined) {
    pickingRay.ray.seaLevelMarkerVisible = visual.seaLevelMarkerVisible;
  }
  if (visual.seaLevelMarkerSize !== undefined) {
    pickingRay.ray.seaLevelMarkerSize = visual.seaLevelMarkerSize;
  }
  if (visual.seaLevelMarkerOpacity !== undefined) {
    pickingRay.ray.seaLevelMarkerOpacity = visual.seaLevelMarkerOpacity;
  }
  if (visual.seaLevelMarkerColor !== undefined) {
    pickingRay.ray.seaLevelMarkerColor = [...visual.seaLevelMarkerColor];
  }
};

export const legacyPickToPickResult = (pick: PickedInfo): PickResult | null => {
  if (!pick.isValid || pick.source === "none") {
    return null;
  }

  const result: PickResult = {
    screen: { x: 0, y: 0 },
    world: {
      kind: "engine-local",
      x: pick.xyz[0],
      y: pick.xyz[1],
      z: pick.xyz[2],
      frameId: "nasa-ammos",
    },
    source: pick.source === "sea-level-plane" ? "sea-level-plane" : "geometry",
    native: pick.entity ?? pick.view,
  };
  if (pick.hasDepth) {
    result.depthMeters = depthFromElevation(pick.xyz[2], pick.seaLevel ?? 0);
  }
  return result;
};

export const pickValuesToResultFields = (
  values: Record<string, unknown> | undefined,
): Partial<Pick<PickResult, "product" | "layerId" | "featureId" | "values">> => {
  if (values === undefined) {
    return {};
  }

  const result: Partial<Pick<PickResult, "product" | "layerId" | "featureId" | "values">> = {
    values,
  };
  if (typeof values.product === "string") {
    result.product = values.product;
  }
  if (typeof values.layerId === "string") {
    result.layerId = values.layerId;
  }
  if (typeof values.featureId === "string") {
    result.featureId = values.featureId;
  } else if (typeof values.waypointId === "string") {
    result.featureId = values.waypointId;
  } else if (typeof values.legId === "string") {
    result.featureId = values.legId;
  }
  return result;
};

export const getS100PickValues = (
  object: Object3D,
  stopAt: Object3D | null,
): Record<string, unknown> | undefined => {
  let current: Object3D | null = object;
  while (current) {
    const metadata = current.userData.s100PickMetadata;
    if (isPickMetadata(metadata)) {
      return metadata;
    }
    if (current === stopAt) {
      break;
    }
    current = current.parent;
  }
  return undefined;
};

export const getCanvasPointer = (
  request: PickRequest,
  canvas: HTMLCanvasElement,
): Vector2 => {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.clientWidth || canvas.width || 1;
  const height = rect.height || canvas.clientHeight || canvas.height || 1;
  return new Vector2(
    ((request.screenX - rect.left) / width) * 2 - 1,
    -(((request.screenY - rect.top) / height) * 2 - 1),
  );
};

export const getPickableSceneRoots = (scene: Object3D): Object3D[] => {
  const roots: Object3D[] = [];
  for (const child of scene.children) {
    if (isPickableObject(child)) {
      roots.push(child);
      continue;
    }
    const nested = findPickableDescendants(child);
    roots.push(...nested);
  }
  return roots;
};

export const getPickableRootForObject = (object: Object3D): Object3D | null => {
  let current: Object3D | null = object;
  while (current) {
    if (isPickableObject(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
};

export const hasUnpickableAncestor = (
  object: Object3D,
  stopAt: Object3D,
): boolean => {
  let current: Object3D | null = object;
  while (current) {
    if (current.userData.s100Unpickable === true) {
      return true;
    }
    if (current === stopAt) {
      return false;
    }
    current = current.parent;
  }
  return false;
};

export const getSeaLevelRayPoint = (
  raycaster: Raycaster,
  seaLevel: number,
): Vector3 | null => {
  const zUp = new Vector3(0, 0, 1);
  const denominator = raycaster.ray.direction.dot(zUp);
  if (Math.abs(denominator) < 1e-6) {
    return null;
  }

  const distance = (seaLevel - raycaster.ray.origin.z) / denominator;
  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  return raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, distance);
};

const findPickableDescendants = (root: Object3D): Object3D[] => {
  const pickable: Object3D[] = [];
  root.traverse((object) => {
    if (object !== root && isPickableObject(object)) {
      pickable.push(object);
    }
  });
  return pickable;
};

const isPickableObject = (object: Object3D): boolean =>
  object.userData.s100Pickable === true;

function isPickMetadata(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
