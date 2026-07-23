import {
  S100Error,
  type Coordinate,
  type SceneOptions,
} from "@ecc/s100-viewer";
import * as THREE from "three";

export type ThreeProjectedLocalReference = {
  crs: string;
  origin: {
    x: number;
    y: number;
    z: number;
  };
};

export const getHtmlElement = (container: unknown): HTMLElement => {
  if (container instanceof HTMLElement) {
    return container;
  }
  if (typeof container === "string") {
    const element = document.querySelector(container);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  throw new S100Error(
    "invalid-layer-spec",
    "Three.js adapter requires an HTMLElement container or a selector for one.",
  );
};

export const getProjectedLocalReference = (
  options: SceneOptions,
): ThreeProjectedLocalReference => {
  const georeference = options.georeference;
  if (georeference?.mode === "ellipsoid-ecef") {
    throw new S100Error(
      "adapter-capability",
      "Three.js reference adapter currently supports projected-local scenes only.",
    );
  }

  const crs = georeference?.mode === "projected-local"
    ? georeference.crs
    : "EPSG:4326";
  const origin = georeference?.mode === "projected-local"
    ? georeference.origin
    : undefined;

  return {
    crs,
    origin: projectedOrigin(origin, crs),
  };
};

export const coordinateToWorld = (
  coordinate: Coordinate,
  reference: ThreeProjectedLocalReference,
): THREE.Vector3 => {
  if (coordinate.kind === "projected") {
    return projectedMetersToWorld(
      coordinate.x,
      coordinate.y,
      coordinate.z ?? 0,
      reference,
    );
  }

  if (coordinate.kind === "engine-local") {
    return new THREE.Vector3(coordinate.x, coordinate.z, -coordinate.y);
  }

  if (coordinate.kind === "ecef") {
    return new THREE.Vector3(coordinate.x, coordinate.z, -coordinate.y);
  }

  return new THREE.Vector3(0, coordinate.height ?? 0, 0);
};

export const projectedMetersToWorld = (
  x: number,
  y: number,
  z: number,
  reference: ThreeProjectedLocalReference,
): THREE.Vector3 =>
  new THREE.Vector3(
    x - reference.origin.x,
    z - reference.origin.z,
    -(y - reference.origin.y),
  );

export const worldToProjectedCoordinate = (
  world: THREE.Vector3,
  reference: ThreeProjectedLocalReference,
): Coordinate => ({
  kind: "projected",
  crs: reference.crs,
  x: world.x + reference.origin.x,
  y: reference.origin.y - world.z,
  z: world.y + reference.origin.z,
});

const projectedOrigin = (
  origin: Coordinate | undefined,
  crs: string,
): ThreeProjectedLocalReference["origin"] => {
  if (!origin) {
    return { x: 0, y: 0, z: 0 };
  }

  if (origin.kind === "projected") {
    return {
      x: origin.x,
      y: origin.y,
      z: origin.z ?? 0,
    };
  }

  if (origin.kind === "engine-local" || origin.kind === "ecef") {
    return {
      x: origin.x,
      y: origin.y,
      z: origin.z,
    };
  }

  return {
    x: 0,
    y: 0,
    z: origin.height ?? 0,
  };
};
