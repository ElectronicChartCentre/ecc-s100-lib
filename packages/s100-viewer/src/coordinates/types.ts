export type Coordinate =
  | GeodeticCoordinate
  | ProjectedCoordinate
  | EcefCoordinate
  | EngineLocalCoordinate;

export type GeodeticCoordinate = {
  kind: "geodetic";
  lon: number;
  lat: number;
  height?: number;
  datum?: string;
};

export type ProjectedCoordinate = {
  kind: "projected";
  x: number;
  y: number;
  z?: number;
  crs: string;
};

export type EcefCoordinate = {
  kind: "ecef";
  x: number;
  y: number;
  z: number;
  datum?: string;
};

export type EngineLocalCoordinate = {
  kind: "engine-local";
  x: number;
  y: number;
  z: number;
  frameId: string;
};

export type SceneGeoreferenceMode = "projected-local" | "ellipsoid-ecef";

export type SceneGeoreference = ProjectedLocalGeoreference | EllipsoidEcefGeoreference;

export type ProjectedLocalGeoreference = {
  mode: "projected-local";
  crs: string;
  origin: Coordinate;
  upAxis: "z";
  units: "meters";
};

export type EllipsoidEcefGeoreference = {
  mode: "ellipsoid-ecef";
  ellipsoid: "WGS84";
  origin?: Coordinate;
  localFrame?: "enu" | "ned" | "engine-native";
  units: "meters";
};

export type SpatialExtent = {
  crs?: string;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
  minZ?: number;
  maxZ?: number;
};

export type ProjectedLocalOriginInput =
  | Coordinate
  | {
      x: number;
      y: number;
      z?: number;
    };

export type ProjectedLocalSceneBuilderOptions = {
  crs: string;
  origin: ProjectedLocalOriginInput;
};

export const defaultProjectedLocalGeoreference = (): ProjectedLocalGeoreference => ({
  mode: "projected-local",
  crs: "EPSG:4326",
  origin: { kind: "geodetic", lon: 0, lat: 0, height: 0, datum: "WGS84" },
  upAxis: "z",
  units: "meters",
});

const normalizeProjectedLocalOrigin = (
  crs: string,
  origin: ProjectedLocalOriginInput,
): Coordinate => {
  if ("kind" in origin) {
    return origin;
  }

  return {
    kind: "projected",
    crs,
    x: origin.x,
    y: origin.y,
    ...(origin.z !== undefined ? { z: origin.z } : {}),
  };
};

export const SceneBuilder = {
  projectedLocal(options: ProjectedLocalSceneBuilderOptions): ProjectedLocalGeoreference {
    return {
      mode: "projected-local",
      crs: options.crs,
      origin: normalizeProjectedLocalOrigin(options.crs, options.origin),
      upAxis: "z",
      units: "meters",
    };
  },
};
