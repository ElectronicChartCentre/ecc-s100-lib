import proj4 from "proj4";

import {
  Coordinates,
  type Coordinate,
  type ProjectedCoordinate,
} from "../../coordinates/types.js";

const WGS84_CRS = "EPSG:4326";

export const normalizeGeodeticCrs = (crs: string | undefined): string => {
  const normalized = crs?.trim().toUpperCase();
  if (!normalized || normalized === "WGS84" || normalized === "EPSG:4258") {
    return WGS84_CRS;
  }
  return normalized;
};

export const projectCoordinateToProjectedCrs = (
  coordinate: Coordinate,
  targetCrs: string,
): ProjectedCoordinate | null => {
  const normalizedTargetCrs = normalizeCrs(targetCrs);
  if (coordinate.kind === "projected") {
    const normalizedSourceCrs = normalizeCrs(coordinate.crs);
    if (normalizedSourceCrs === normalizedTargetCrs) {
      return Coordinates.projected({
        crs: normalizedTargetCrs,
        x: coordinate.x,
        y: coordinate.y,
        ...(coordinate.z !== undefined ? { z: coordinate.z } : {}),
      });
    }
    return projectProjectedCoordinate(coordinate, normalizedSourceCrs, normalizedTargetCrs);
  }

  if (coordinate.kind === "geodetic") {
    return projectGeodeticCoordinate(coordinate, normalizedTargetCrs);
  }

  return null;
};

export function ensureSupportedProjectedCrs(crs: string): void {
  const normalized = normalizeCrs(crs);
  const match = /^EPSG:(326|327|258)(\d{2})$/u.exec(normalized);
  if (!match) {
    return;
  }

  const code = match[1];
  const zone = Number(match[2]);
  if (zone < 1 || zone > 60) {
    return;
  }

  const south = code === "327" ? " +south" : "";
  const datum = code === "258"
    ? "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0"
    : "+datum=WGS84";
  proj4.defs(
    normalized,
    `+proj=utm +zone=${zone} ${datum} +units=m +no_defs +type=crs${south}`,
  );
}

const projectProjectedCoordinate = (
  coordinate: ProjectedCoordinate,
  sourceCrs: string,
  targetCrs: string,
): ProjectedCoordinate | null => {
  ensureSupportedProjectedCrs(sourceCrs);
  ensureSupportedProjectedCrs(targetCrs);
  return projectXY({
    sourceCrs,
    targetCrs,
    x: coordinate.x,
    y: coordinate.y,
    ...(coordinate.z !== undefined ? { z: coordinate.z } : {}),
  });
};

const projectGeodeticCoordinate = (
  coordinate: Extract<Coordinate, { kind: "geodetic" }>,
  targetCrs: string,
): ProjectedCoordinate | null => {
  ensureSupportedProjectedCrs(targetCrs);
  return projectXY({
    sourceCrs: normalizeGeodeticCrs(coordinate.datum),
    targetCrs,
    x: coordinate.lon,
    y: coordinate.lat,
    ...(coordinate.height !== undefined ? { z: coordinate.height } : {}),
  });
};

const projectXY = (options: {
  sourceCrs: string;
  targetCrs: string;
  x: number;
  y: number;
  z?: number;
}): ProjectedCoordinate | null => {
  try {
    const [x, y] = proj4(options.sourceCrs, options.targetCrs, [options.x, options.y]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return Coordinates.projected({
      crs: options.targetCrs,
      x,
      y,
      ...(options.z !== undefined ? { z: options.z } : {}),
    });
  } catch {
    return null;
  }
};

const normalizeCrs = (crs: string): string => crs.trim().toUpperCase();
