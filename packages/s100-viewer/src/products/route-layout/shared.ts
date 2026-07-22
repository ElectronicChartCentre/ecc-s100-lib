import {
  distanceMeters,
  offsetLeg,
} from "../route-geodesy.js";
import type {
  RouteLayoutPosition,
  RoutePlan,
  RoutePrimitiveMetadata,
  RouteWaypoint,
  RouteWaypointLeg,
} from "../route-plan.js";

export const routeLegOffset = (
  leg: RouteWaypointLeg,
  waypointsById: ReadonlyMap<string, RouteWaypoint>,
) => {
  const from = waypointsById.get(leg.fromWaypointId);
  const to = waypointsById.get(leg.toWaypointId);
  if (
    from === undefined ||
    to === undefined ||
    leg.portsideXtdMeters === undefined ||
    leg.starboardXtdMeters === undefined
  ) {
    return null;
  }
  if (distanceMeters(from.position, to.position) <= 0) {
    return null;
  }
  return offsetLeg(from.position, to.position, {
    portsideMeters: leg.portsideXtdMeters,
    starboardMeters: leg.starboardXtdMeters,
  });
};

export const waypointMap = (routePlan: RoutePlan): ReadonlyMap<string, RouteWaypoint> =>
  new Map(routePlan.waypoints.map((waypoint) => [waypoint.id, waypoint]));

export const metadata = (
  routePlan: RoutePlan,
  primitiveKind: RoutePrimitiveMetadata["primitiveKind"],
  details: {
    waypointId?: string;
    legId?: string;
    side?: "portside" | "starboard";
  } = {},
): RoutePrimitiveMetadata => ({
  routeId: routePlan.id,
  sourceFormat: routePlan.sourceFormat,
  primitiveKind,
  ...(details.waypointId !== undefined ? { waypointId: details.waypointId } : {}),
  ...(details.legId !== undefined ? { legId: details.legId } : {}),
  ...(details.side !== undefined ? { side: details.side } : {}),
});

export const withZ = (
  position: RouteLayoutPosition,
  z: number,
): RouteLayoutPosition => ({
  ...position,
  z,
});
