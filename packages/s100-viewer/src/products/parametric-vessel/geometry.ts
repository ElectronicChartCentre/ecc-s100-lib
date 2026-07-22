import { boundsForPlanPoints } from "./bounds.js";
import type {
  NormalizedParametricVesselAssembly,
  ParametricVesselEdgeTreatment,
  ParametricVesselPartGeometry,
  ParametricVesselPartGeometryKind,
  ParametricVesselPartSize,
  ParametricVesselPlanPoint,
  ParametricVesselReferencePoint,
} from "./types.js";

export function hullGeometry(
  kind: ParametricVesselPartGeometryKind,
  assembly: NormalizedParametricVesselAssembly,
  options?: Pick<ParametricVesselPartGeometry, "corner" | "taperEnd">,
): ParametricVesselPartGeometry {
  const geometry: ParametricVesselPartGeometry = {
    kind,
    edgeTreatment: hullEdgeTreatment(assembly),
  };
  if (options?.corner !== undefined) {
    geometry.corner = options.corner;
  }
  if (options?.taperEnd !== undefined) {
    geometry.taperEnd = options.taperEnd;
  }
  if (assembly.cornerRadiusMeters !== undefined) {
    geometry.parameters = {
      cornerRadiusMeters: assembly.cornerRadiusMeters,
    };
  }
  return geometry;
}

export function componentGeometry(
  kind: ParametricVesselPartGeometryKind,
  options?: Pick<ParametricVesselPartGeometry, "axis" | "edgeTreatment">,
): ParametricVesselPartGeometry {
  const geometry: ParametricVesselPartGeometry = { kind };
  if (options?.axis !== undefined) {
    geometry.axis = options.axis;
  }
  if (options?.edgeTreatment !== undefined) {
    geometry.edgeTreatment = options.edgeTreatment;
  }
  return geometry;
}

export function deckOutlineGeometry(
  outlineMeters: readonly ParametricVesselPlanPoint[],
): ParametricVesselPartGeometry {
  return {
    kind: "deck-outline",
    edgeTreatment: "sharp",
    metadata: {
      outlineMeters: outlineMeters.map((point) => ({ ...point })),
    },
  };
}

function hullEdgeTreatment(
  assembly: NormalizedParametricVesselAssembly,
): ParametricVesselEdgeTreatment {
  return assembly.style === "rounded-corner" ||
    assembly.hullCrossSection === "rounded-rectangle"
    ? "rounded"
    : "sharp";
}

export function insetHullTopOutline(
  lengthMeters: number,
  beamMeters: number,
  bowStartFromSternMeters: number,
  deckInsetMeters: number,
  reference: Required<ParametricVesselReferencePoint>,
): {
  centerMeters: ParametricVesselPlanPoint;
  sizeMeters: Pick<ParametricVesselPartSize, "beamMeters" | "lengthMeters">;
  outlineMeters: readonly ParametricVesselPlanPoint[];
} | undefined {
  const halfBeam = beamMeters / 2;
  const hullOutline: readonly ParametricVesselPlanPoint[] = [
    { xMeters: -halfBeam, yMeters: 0 },
    { xMeters: halfBeam, yMeters: 0 },
    { xMeters: halfBeam, yMeters: bowStartFromSternMeters },
    { xMeters: 0, yMeters: lengthMeters },
    { xMeters: -halfBeam, yMeters: bowStartFromSternMeters },
  ];
  const insetOutline = insetConvexPolygon(hullOutline, deckInsetMeters);
  if (insetOutline.length < 3) {
    return undefined;
  }
  const localOutline = insetOutline.map((point) => ({
    xMeters: point.xMeters - reference.lateralFromCenterMeters,
    yMeters: point.yMeters - reference.longitudinalFromSternMeters,
  }));
  const bounds = boundsForPlanPoints(localOutline);
  const beam = bounds.max.xMeters - bounds.min.xMeters;
  const length = bounds.max.yMeters - bounds.min.yMeters;
  if (beam <= 0 || length <= 0) {
    return undefined;
  }
  const center = {
    xMeters: (bounds.min.xMeters + bounds.max.xMeters) / 2,
    yMeters: (bounds.min.yMeters + bounds.max.yMeters) / 2,
  };
  return {
    centerMeters: center,
    sizeMeters: {
      beamMeters: beam,
      lengthMeters: length,
    },
    outlineMeters: localOutline.map((point) => ({
      xMeters: point.xMeters - center.xMeters,
      yMeters: point.yMeters - center.yMeters,
    })),
  };
}

function insetConvexPolygon(
  points: readonly ParametricVesselPlanPoint[],
  insetMeters: number,
): readonly ParametricVesselPlanPoint[] {
  if (points.length < 3) {
    return [];
  }
  if (insetMeters <= 0) {
    return points.map((point) => ({ ...point }));
  }
  const orientation = signedPlanArea(points) >= 0 ? 1 : -1;
  const offsetLines = points.map((point, index) => {
    const next = points[(index + 1) % points.length] as ParametricVesselPlanPoint;
    const dx = next.xMeters - point.xMeters;
    const dy = next.yMeters - point.yMeters;
    const length = Math.hypot(dx, dy);
    if (length <= 0) {
      return undefined;
    }
    const inwardNormal = {
      xMeters: (-orientation * dy) / length,
      yMeters: (orientation * dx) / length,
    };
    return {
      point: {
        xMeters: point.xMeters + inwardNormal.xMeters * insetMeters,
        yMeters: point.yMeters + inwardNormal.yMeters * insetMeters,
      },
      direction: {
        xMeters: dx,
        yMeters: dy,
      },
    };
  });
  if (offsetLines.some((line) => line === undefined)) {
    return [];
  }
  const inset = points.map((_, index) => {
    const previous = offsetLines[
      (index - 1 + offsetLines.length) % offsetLines.length
    ];
    const current = offsetLines[index];
    if (!previous || !current) {
      return undefined;
    }
    return intersectPlanLines(previous, current);
  });
  if (inset.some((point) => point === undefined)) {
    return [];
  }
  const completeInset = inset as ParametricVesselPlanPoint[];
  if (
    Math.abs(signedPlanArea(completeInset)) < 1e-6 ||
    signedPlanArea(completeInset) * orientation <= 0
  ) {
    return [];
  }
  return completeInset;
}

function intersectPlanLines(
  first: { point: ParametricVesselPlanPoint; direction: ParametricVesselPlanPoint },
  second: { point: ParametricVesselPlanPoint; direction: ParametricVesselPlanPoint },
): ParametricVesselPlanPoint | undefined {
  const denominator =
    first.direction.xMeters * second.direction.yMeters -
    first.direction.yMeters * second.direction.xMeters;
  if (Math.abs(denominator) < 1e-9) {
    return undefined;
  }
  const dx = second.point.xMeters - first.point.xMeters;
  const dy = second.point.yMeters - first.point.yMeters;
  const t =
    (dx * second.direction.yMeters - dy * second.direction.xMeters) /
    denominator;
  return {
    xMeters: first.point.xMeters + first.direction.xMeters * t,
    yMeters: first.point.yMeters + first.direction.yMeters * t,
  };
}

function signedPlanArea(points: readonly ParametricVesselPlanPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length] as ParametricVesselPlanPoint;
    return area + point.xMeters * next.yMeters - next.xMeters * point.yMeters;
  }, 0) / 2;
}
