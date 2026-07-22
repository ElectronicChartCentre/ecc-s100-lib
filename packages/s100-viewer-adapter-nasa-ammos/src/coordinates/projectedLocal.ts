import type { Coordinate, SceneOptions } from "@ecc/s100-viewer";
import type { Vec3 } from "../runtime/index.js";

export const getHtmlElement = (container: unknown): HTMLElement | null => {
  if (container && typeof container === "object" && "appendChild" in container) {
    return container as HTMLElement;
  }
  return null;
};

export const getProjectedOrigin = (options: SceneOptions): Vec3 | undefined => {
  if (options.georeference?.mode !== "projected-local") {
    return undefined;
  }

  const origin = coordinateToVec3(options.georeference.origin);
  return { x: origin.x, y: origin.y, z: origin.z };
};

export const coordinateToVec3 = (coordinate: Coordinate): Vec3 => {
  if (
    coordinate.kind === "projected" ||
    coordinate.kind === "ecef" ||
    coordinate.kind === "engine-local"
  ) {
    return {
      x: coordinate.x,
      y: coordinate.y,
      z: coordinate.z ?? 0,
    };
  }

  return {
    x: coordinate.lon,
    y: coordinate.lat,
    z: coordinate.height ?? 0,
  };
};
