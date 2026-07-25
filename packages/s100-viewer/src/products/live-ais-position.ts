import proj4 from "proj4";

import {
  Coordinates,
  type Coordinate,
  type ProjectedCoordinate,
} from "../coordinates/types.js";
import type { LiveAisVessel } from "./live-vessel-feed.js";

const WGS84_CRS = "EPSG:4326";

export type LiveAisProjectedPositionMapperOptions = {
  /**
   * Target projected CRS for the scene, for example `EPSG:32632` or
   * `EPSG:25832`.
   */
  crs: string;
};

export function createProjectedLiveAisPositionMapper(
  options: LiveAisProjectedPositionMapperOptions,
): (vessel: LiveAisVessel) => Coordinate {
  return (vessel) => projectLiveAisVesselToProjectedCoordinate(vessel, options);
}

export function projectLiveAisVesselToProjectedCoordinate(
  vessel: LiveAisVessel,
  options: LiveAisProjectedPositionMapperOptions,
): ProjectedCoordinate {
  ensureSupportedProjectedCrs(options.crs);
  const sourceCrs = normalizeLiveAisGeodeticCrs(vessel.position.crs);
  const [x, y] = proj4(sourceCrs, options.crs, [
    vessel.position.longitude,
    vessel.position.latitude,
  ]);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Could not project live AIS vessel ${vessel.mmsi} to ${options.crs}.`);
  }

  return Coordinates.projected({
    crs: options.crs,
    x,
    y,
    z: vessel.position.heightMeters ?? 0,
  });
}

export function normalizeLiveAisGeodeticCrs(crs: string | undefined): string {
  return crs?.toUpperCase() === "EPSG:4258" ? WGS84_CRS : crs ?? WGS84_CRS;
}

export function ensureSupportedProjectedCrs(crs: string): void {
  const normalized = crs.toUpperCase();
  const match = /^EPSG:(326|327|258)(\d{2})$/.exec(normalized);
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
