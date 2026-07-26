import {
  Coordinates,
  type Coordinate,
  type ProjectedCoordinate,
} from "../coordinates/types.js";
import {
  normalizeGeodeticCrs,
  projectCoordinateToProjectedCrs,
} from "../internal/coordinates/projection.js";
import type { LiveAisVessel } from "./live-vessel-feed.js";

export { ensureSupportedProjectedCrs } from "../internal/coordinates/projection.js";

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
  const coordinate = projectCoordinateToProjectedCrs(
    Coordinates.geodetic({
      lon: vessel.position.longitude,
      lat: vessel.position.latitude,
      datum: normalizeLiveAisGeodeticCrs(vessel.position.crs),
      ...(vessel.position.heightMeters !== undefined
        ? { height: vessel.position.heightMeters }
        : {}),
    }),
    options.crs,
  );
  if (coordinate === null) {
    throw new Error(`Could not project live AIS vessel ${vessel.mmsi} to ${options.crs}.`);
  }
  return coordinate;
}

export function normalizeLiveAisGeodeticCrs(crs: string | undefined): string {
  return normalizeGeodeticCrs(crs);
}
