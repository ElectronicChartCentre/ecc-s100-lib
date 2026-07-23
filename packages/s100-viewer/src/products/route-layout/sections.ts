import type {
  RouteDiagnostic,
  RouteLayoutPosition,
  RoutePlan,
  RouteWaypoint,
} from "../route-plan.js";
import { metadata, waypointMap } from "./shared.js";
import type {
  RouteLayoutLegSection,
  RouteLayoutLegSections,
  RouteProjection,
} from "./types.js";

const TAU = Math.PI * 2;
const EPSILON = 1e-6;
const DEFAULT_TURN_ARC_SEGMENT_ANGLE_DEGREES = 3;
const MAX_TURN_RADIUS_LEG_FRACTION = 0.95;

type Vec2 = {
  x: number;
  y: number;
};

type ProjectedWaypoint = {
  waypoint: RouteWaypoint;
  position: RouteLayoutPosition;
};

type TurnGeometry = {
  firstHalf: readonly RouteLayoutPosition[];
  secondHalf: readonly RouteLayoutPosition[];
};

export const buildRouteLayoutLegSections = (
  routePlan: RoutePlan,
  projection: RouteProjection,
  turnArcSegmentAngleDegrees: number | undefined,
): RouteLayoutLegSections => {
  const diagnostics: RouteDiagnostic[] = [];
  const waypoints = routePlan.waypoints.map((waypoint) => ({
    waypoint,
    position: projection.project(waypoint.position),
  }));
  const waypointIndexById = new Map(
    waypoints.map((waypoint, index) => [waypoint.waypoint.id, index]),
  );
  const turnStepRadians = turnStep(turnArcSegmentAngleDegrees);
  const turns = new Map<number, TurnGeometry>();

  for (let index = 1; index < waypoints.length - 1; index += 1) {
    const turn = buildTurnGeometry(
      routePlan,
      waypoints[index - 1],
      waypoints[index],
      waypoints[index + 1],
      turnStepRadians,
      diagnostics,
    );
    if (turn) {
      turns.set(index, turn);
    }
  }

  const waypointsById = waypointMap(routePlan);
  const sections = routePlan.legs.flatMap((leg) => {
    const fromIndex = waypointIndexById.get(leg.fromWaypointId);
    const toIndex = waypointIndexById.get(leg.toWaypointId);
    const from = waypointsById.get(leg.fromWaypointId);
    const to = waypointsById.get(leg.toWaypointId);
    if (
      fromIndex === undefined ||
      toIndex === undefined ||
      from === undefined ||
      to === undefined ||
      fromIndex >= toIndex
    ) {
      diagnostics.push({
        code: "route-layout-leg-waypoint-missing",
        severity: "warning",
        message: `Route leg '${leg.id}' does not reference two ordered route waypoints.`,
        values: {
          legId: leg.id,
          fromWaypointId: leg.fromWaypointId,
          toWaypointId: leg.toWaypointId,
        },
      });
      return [];
    }

    const centerline: RouteLayoutPosition[] = [];
    appendPositions(
      centerline,
      turns.get(fromIndex)?.secondHalf ?? [waypoints[fromIndex]?.position],
    );
    appendPositions(
      centerline,
      turns.get(toIndex)?.firstHalf ?? [waypoints[toIndex]?.position],
    );

    const section: RouteLayoutLegSection = {
      id: `${routePlan.id}:leg:${leg.id}:section`,
      leg,
      centerline,
      ...(leg.portsideXtdMeters !== undefined && centerline.length > 1
        ? { portsideBoundary: offsetPolyline(centerline, leg.portsideXtdMeters, "portside") }
        : {}),
      ...(leg.starboardXtdMeters !== undefined && centerline.length > 1
        ? { starboardBoundary: offsetPolyline(centerline, leg.starboardXtdMeters, "starboard") }
        : {}),
    };
    return [section];
  });

  return {
    sections,
    diagnostics,
  };
};

export const routeSectionMetadata = (
  routePlan: RoutePlan,
  primitiveKind: Parameters<typeof metadata>[1],
  legId: string,
  side?: "portside" | "starboard",
  depthBand?: "safety-depth" | "below-safety-depth",
) =>
  metadata(routePlan, primitiveKind, {
    legId,
    ...(side !== undefined ? { side } : {}),
    ...(depthBand !== undefined ? { depthBand } : {}),
  });

const buildTurnGeometry = (
  routePlan: RoutePlan,
  previous: ProjectedWaypoint | undefined,
  current: ProjectedWaypoint | undefined,
  next: ProjectedWaypoint | undefined,
  turnStepRadians: number,
  diagnostics: RouteDiagnostic[],
): TurnGeometry | null => {
  if (!previous || !current || !next) {
    return null;
  }
  const requestedRadius = current.waypoint.radiusMeters ?? 0;
  if (requestedRadius <= EPSILON) {
    return null;
  }

  const p0 = toVec2(previous.position);
  const p1 = toVec2(current.position);
  const p2 = toVec2(next.position);
  const incomingLength = distance(p1, p0);
  const outgoingLength = distance(p1, p2);
  if (incomingLength <= EPSILON || outgoingLength <= EPSILON) {
    return null;
  }

  const directionToPrevious = normalize(subtract(p0, p1));
  const directionToNext = normalize(subtract(p2, p1));
  const theta = Math.acos(clamp(dot(directionToPrevious, directionToNext), -1, 1));
  const routeDeflection = Math.PI - theta;
  if (routeDeflection <= EPSILON || theta <= EPSILON || Math.abs(Math.tan(theta / 2)) <= EPSILON) {
    return null;
  }

  const maxRadius = Math.min(incomingLength, outgoingLength) *
    Math.tan(theta / 2) *
    MAX_TURN_RADIUS_LEG_FRACTION;
  if (maxRadius <= EPSILON) {
    return null;
  }
  const radius = Math.min(requestedRadius, maxRadius);
  if (radius < requestedRadius) {
    diagnostics.push({
      code: "route-layout-turn-radius-clamped",
      severity: "warning",
      message: `Route waypoint '${current.waypoint.id}' turn radius was reduced to fit adjacent legs.`,
      values: {
        routeId: routePlan.id,
        waypointId: current.waypoint.id,
        requestedRadiusMeters: requestedRadius,
        appliedRadiusMeters: radius,
      },
    });
  }

  const tangentLength = radius / Math.tan(theta / 2);
  const tangent0 = add(p1, scale(directionToPrevious, tangentLength));
  const tangent1 = add(p1, scale(directionToNext, tangentLength));
  const bisector = normalize(add(directionToPrevious, directionToNext));
  const center = add(p1, scale(bisector, radius / Math.sin(theta / 2)));
  const startAngle = Math.atan2(tangent0.y - center.y, tangent0.x - center.x);
  const endAngle = Math.atan2(tangent1.y - center.y, tangent1.x - center.x);
  const clockwise = crossZ(subtract(tangent0, center), subtract(tangent1, center)) < 0;
  const delta = signedArcDelta(startAngle, endAngle, clockwise);
  if (Math.abs(delta) <= EPSILON) {
    return null;
  }

  const firstHalf = sampleArc(
    center,
    radius,
    startAngle,
    delta / 2,
    turnStepRadians,
    current.position.z,
  );
  const secondHalf = sampleArc(
    center,
    radius,
    startAngle + delta / 2,
    delta / 2,
    turnStepRadians,
    current.position.z,
  );

  return {
    firstHalf,
    secondHalf,
  };
};

const sampleArc = (
  center: Vec2,
  radius: number,
  startAngle: number,
  delta: number,
  turnStepRadians: number,
  z: number | undefined,
): RouteLayoutPosition[] => {
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / turnStepRadians));
  return Array.from({ length: segments + 1 }, (_item, index) => {
    const ratio = index / segments;
    const angle = startAngle + delta * ratio;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      ...(z !== undefined ? { z } : {}),
    };
  });
};

const appendPositions = (
  target: RouteLayoutPosition[],
  positions: readonly (RouteLayoutPosition | undefined)[],
): void => {
  for (const position of positions) {
    if (!position) {
      continue;
    }
    const previous = target[target.length - 1];
    if (previous && samePosition(previous, position)) {
      continue;
    }
    target.push(position);
  }
};

const offsetPolyline = (
  positions: readonly RouteLayoutPosition[],
  offsetMeters: number,
  side: "portside" | "starboard",
): RouteLayoutPosition[] =>
  positions.map((position, index) => {
    const direction = directionAt(positions, index);
    const normal = side === "starboard"
      ? { x: direction.y, y: -direction.x }
      : { x: -direction.y, y: direction.x };
    return {
      x: position.x + normal.x * offsetMeters,
      y: position.y + normal.y * offsetMeters,
      ...(position.z !== undefined ? { z: position.z } : {}),
    };
  });

const directionAt = (
  positions: readonly RouteLayoutPosition[],
  index: number,
): Vec2 => {
  const current = positions[index];
  if (!current) {
    return { x: 1, y: 0 };
  }
  const previous = previousDistinct(positions, index);
  const next = nextDistinct(positions, index);
  if (previous && next) {
    return normalize(subtract(toVec2(next), toVec2(previous)));
  }
  if (next) {
    return normalize(subtract(toVec2(next), toVec2(current)));
  }
  if (previous) {
    return normalize(subtract(toVec2(current), toVec2(previous)));
  }
  return { x: 1, y: 0 };
};

const previousDistinct = (
  positions: readonly RouteLayoutPosition[],
  index: number,
): RouteLayoutPosition | undefined => {
  const current = positions[index];
  if (!current) {
    return undefined;
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = positions[cursor];
    if (candidate && !samePosition(candidate, current)) {
      return candidate;
    }
  }
  return undefined;
};

const nextDistinct = (
  positions: readonly RouteLayoutPosition[],
  index: number,
): RouteLayoutPosition | undefined => {
  const current = positions[index];
  if (!current) {
    return undefined;
  }
  for (let cursor = index + 1; cursor < positions.length; cursor += 1) {
    const candidate = positions[cursor];
    if (candidate && !samePosition(candidate, current)) {
      return candidate;
    }
  }
  return undefined;
};

const turnStep = (degrees: number | undefined): number => {
  const safeDegrees = Number.isFinite(degrees)
    ? Math.max(0.5, Math.min(30, degrees ?? DEFAULT_TURN_ARC_SEGMENT_ANGLE_DEGREES))
    : DEFAULT_TURN_ARC_SEGMENT_ANGLE_DEGREES;
  return safeDegrees * Math.PI / 180;
};

const toVec2 = (position: RouteLayoutPosition): Vec2 => ({
  x: position.x,
  y: position.y,
});

const add = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

const subtract = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

const scale = (vector: Vec2, value: number): Vec2 => ({
  x: vector.x * value,
  y: vector.y * value,
});

const dot = (a: Vec2, b: Vec2): number =>
  a.x * b.x + a.y * b.y;

const crossZ = (a: Vec2, b: Vec2): number =>
  a.x * b.y - a.y * b.x;

const distance = (a: Vec2, b: Vec2): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const normalize = (vector: Vec2): Vec2 => {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= EPSILON) {
    return { x: 1, y: 0 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
};

const signedArcDelta = (
  startAngle: number,
  endAngle: number,
  clockwise: boolean,
): number => {
  const ccwDelta = normalizeAngle(endAngle - startAngle);
  return clockwise && ccwDelta > EPSILON
    ? ccwDelta - TAU
    : ccwDelta;
};

const normalizeAngle = (angle: number): number =>
  ((angle % TAU) + TAU) % TAU;

const samePosition = (
  a: RouteLayoutPosition,
  b: RouteLayoutPosition,
): boolean =>
  Math.abs(a.x - b.x) <= EPSILON &&
  Math.abs(a.y - b.y) <= EPSILON &&
  Math.abs((a.z ?? 0) - (b.z ?? 0)) <= EPSILON;
