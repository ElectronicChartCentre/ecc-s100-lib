import type { RouteLayoutPosition, RouteMeshPrimitive, RoutePlan } from "../route-plan.js";
import { withZ } from "./shared.js";
import { routeSectionMetadata } from "./sections.js";
import type { RouteLayoutLegSection } from "./types.js";

export const buildRouteVolumeMeshes = (
  routePlan: RoutePlan,
  sections: readonly RouteLayoutLegSection[],
  seaLevelMeters: number,
  bottomDepthMeters = 100,
): RouteMeshPrimitive[] =>
  sections.flatMap((section) => {
    const starboard = section.starboardBoundary;
    const portside = section.portsideBoundary;
    const safetyDepthMeters = section.leg.safetyDepthMeters;
    if (
      !starboard ||
      !portside ||
      starboard.length < 2 ||
      portside.length < 2 ||
      safetyDepthMeters === undefined ||
      safetyDepthMeters <= 0
    ) {
      return [];
    }

    const safetyDepthZ = seaLevelMeters - safetyDepthMeters;
    const bottomZ = seaLevelMeters - Math.max(safetyDepthMeters, bottomDepthMeters);
    const startStarboard = starboard[0];
    const startPortside = portside[0];
    const endStarboard = starboard[starboard.length - 1];
    const endPortside = portside[portside.length - 1];
    if (!startStarboard || !startPortside || !endStarboard || !endPortside) {
      return [];
    }

    return [
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:starboard-safety-depth-side`,
        routePlan,
        section.leg.id,
        starboard,
        seaLevelMeters,
        safetyDepthZ,
        "starboard",
        "safety-depth",
      ),
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:portside-safety-depth-side`,
        routePlan,
        section.leg.id,
        portside,
        seaLevelMeters,
        safetyDepthZ,
        "portside",
        "safety-depth",
      ),
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:start-safety-depth-cap`,
        routePlan,
        section.leg.id,
        [startStarboard, startPortside],
        seaLevelMeters,
        safetyDepthZ,
        undefined,
        "safety-depth",
      ),
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:end-safety-depth-cap`,
        routePlan,
        section.leg.id,
        [endPortside, endStarboard],
        seaLevelMeters,
        safetyDepthZ,
        undefined,
        "safety-depth",
      ),
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:starboard-below-safety-depth-side`,
        routePlan,
        section.leg.id,
        starboard,
        safetyDepthZ,
        bottomZ,
        "starboard",
        "below-safety-depth",
      ),
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:portside-below-safety-depth-side`,
        routePlan,
        section.leg.id,
        portside,
        safetyDepthZ,
        bottomZ,
        "portside",
        "below-safety-depth",
      ),
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:start-below-safety-depth-cap`,
        routePlan,
        section.leg.id,
        [startStarboard, startPortside],
        safetyDepthZ,
        bottomZ,
        undefined,
        "below-safety-depth",
      ),
      verticalPanelMesh(
        `${routePlan.id}:leg:${section.leg.id}:end-below-safety-depth-cap`,
        routePlan,
        section.leg.id,
        [endPortside, endStarboard],
        safetyDepthZ,
        bottomZ,
        undefined,
        "below-safety-depth",
      ),
    ].filter((mesh): mesh is RouteMeshPrimitive => mesh !== null);
  });

const verticalPanelMesh = (
  id: string,
  routePlan: RoutePlan,
  legId: string,
  topLine: readonly RouteLayoutPosition[],
  topZ: number,
  bottomZ: number,
  side?: "portside" | "starboard",
  depthBand?: "safety-depth" | "below-safety-depth",
): RouteMeshPrimitive | null => {
  if (Math.abs(topZ - bottomZ) < 1e-6) {
    return null;
  }
  const positions = createVerticalPanelPositions(topLine, topZ, bottomZ);
  if (positions.length < 4) {
    return null;
  }
  return {
    id,
    positions,
    indices: verticalPanelIndices(positions.length),
    metadata: routeSectionMetadata(routePlan, "route-volume", legId, side, depthBand),
  };
};

const createVerticalPanelPositions = (
  topLine: readonly RouteLayoutPosition[],
  topZ: number,
  bottomZ: number,
): RouteLayoutPosition[] => {
  const positions: RouteLayoutPosition[] = [];
  for (let index = 0; index < topLine.length - 1; index += 1) {
    const current = topLine[index];
    const next = topLine[index + 1];
    if (!current || !next || samePlanarPosition(current, next)) {
      continue;
    }
    positions.push(
      withZ(current, topZ),
      withZ(next, topZ),
      withZ(next, bottomZ),
      withZ(current, bottomZ),
    );
  }
  return positions;
};

const verticalPanelIndices = (
  positionCount: number,
): number[] => {
  const indices: number[] = [];
  for (let index = 0; index < positionCount; index += 4) {
    indices.push(index, index + 1, index + 2);
    indices.push(index, index + 2, index + 3);
  }
  return indices;
};

const samePlanarPosition = (
  left: RouteLayoutPosition,
  right: RouteLayoutPosition,
): boolean =>
  Math.abs(left.x - right.x) < 1e-6 &&
  Math.abs(left.y - right.y) < 1e-6;
