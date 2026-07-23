import type {
  BaseLayerSpec,
  RouteLinePrimitive,
  RoutePlanLayerSpec,
  RoutePointPrimitive,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import {
  projectedMetersToWorld,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";
import { disposeThreeObject } from "../shared/dispose.js";
import {
  setLayerUserData,
  setObjectOpacity,
  setObjectVisibility,
  type ThreeLayerNative,
} from "./types.js";

export const createRoutePlanLayer = (
  spec: BaseLayerSpec,
  scene: THREE.Scene,
  reference: ThreeProjectedLocalReference,
): ThreeLayerNative<RoutePlanLayerSpec> => {
  const routeSpec = spec as RoutePlanLayerSpec;
  const group = new THREE.Group();
  group.name = `three-route-${spec.id}`;
  group.visible = spec.visible ?? routeSpec.style.visible ?? true;
  addLine(group, routeSpec, routeSpec.source.layout?.centerline, reference, 0x2388ff);
  for (const boundary of routeSpec.source.layout?.legBoundaries ?? []) {
    addLine(group, routeSpec, boundary, reference, 0xffffff);
  }
  for (const waypoint of routeSpec.source.layout?.waypoints ?? []) {
    addWaypoint(group, routeSpec, waypoint, reference);
  }
  setObjectOpacity(group, spec.opacity ?? routeSpec.style.opacity ?? 1);
  scene.add(group);

  return {
    spec: routeSpec,
    root: group,
    setVisible: (visible) => {
      group.visible = visible;
    },
    setOpacity: (opacity) => {
      setObjectOpacity(group, opacity);
    },
    getPickableObjects: () => [group],
    patch: (patch) => {
      setObjectVisibility(group, patch.visible ?? patch.style?.visible);
      setObjectOpacity(group, patch.opacity ?? patch.style?.opacity);
    },
    dispose: () => {
      scene.remove(group);
      disposeThreeObject(group);
    },
  };
};

const addLine = (
  group: THREE.Group,
  spec: RoutePlanLayerSpec,
  primitive: RouteLinePrimitive | undefined,
  reference: ThreeProjectedLocalReference,
  color: number,
): void => {
  if (!primitive || primitive.positions.length < 2) {
    return;
  }
  const points = primitive.positions.map((position) =>
    projectedMetersToWorld(position.x, position.y, position.z ?? 6, reference),
  );
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: spec.style.opacity ?? 1,
  });
  const line = new THREE.Line(geometry, material);
  setLayerUserData(line, spec, "vector", primitive.id);
  group.add(line);
};

const addWaypoint = (
  group: THREE.Group,
  spec: RoutePlanLayerSpec,
  primitive: RoutePointPrimitive,
  reference: ThreeProjectedLocalReference,
): void => {
  const geometry = new THREE.SphereGeometry(12, 12, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffcc00,
    transparent: true,
    opacity: spec.style.opacity ?? 1,
  });
  const point = new THREE.Mesh(geometry, material);
  point.position.copy(
    projectedMetersToWorld(
      primitive.position.x,
      primitive.position.y,
      primitive.position.z ?? 8,
      reference,
    ),
  );
  setLayerUserData(point, spec, "vector", primitive.id);
  group.add(point);
};
