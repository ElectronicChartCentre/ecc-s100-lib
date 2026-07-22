import type {
  ParametricVesselLayout,
  ParametricVesselLayoutPart,
  ParametricVesselLocalPoint,
  ParametricVesselPartSize,
  ParametricVesselPlanPoint,
} from "./types.js";

export function boundsForPlanPoints(points: readonly ParametricVesselPlanPoint[]): {
  min: ParametricVesselPlanPoint;
  max: ParametricVesselPlanPoint;
} {
  const first = points[0] as ParametricVesselPlanPoint;
  return points.reduce(
    (bounds, point) => ({
      min: {
        xMeters: Math.min(bounds.min.xMeters, point.xMeters),
        yMeters: Math.min(bounds.min.yMeters, point.yMeters),
      },
      max: {
        xMeters: Math.max(bounds.max.xMeters, point.xMeters),
        yMeters: Math.max(bounds.max.yMeters, point.yMeters),
      },
    }),
    {
      min: { ...first },
      max: { ...first },
    },
  );
}

export function boundsForPart(
  center: ParametricVesselLocalPoint,
  size: ParametricVesselPartSize,
): ParametricVesselLayoutPart["boundsMeters"] {
  const halfBeam = size.beamMeters / 2;
  const halfLength = size.lengthMeters / 2;
  const halfHeight = size.heightMeters / 2;
  return {
    min: {
      xMeters: center.xMeters - halfBeam,
      yMeters: center.yMeters - halfLength,
      zMeters: center.zMeters - halfHeight,
    },
    max: {
      xMeters: center.xMeters + halfBeam,
      yMeters: center.yMeters + halfLength,
      zMeters: center.zMeters + halfHeight,
    },
  };
}

export function boundsForParts(
  parts: readonly ParametricVesselLayoutPart[],
): ParametricVesselLayout["boundsMeters"] {
  if (parts.length === 0) {
    return {
      min: { xMeters: 0, yMeters: 0, zMeters: 0 },
      max: { xMeters: 0, yMeters: 0, zMeters: 0 },
    };
  }
  const first = parts[0] as ParametricVesselLayoutPart;
  return parts.reduce(
    (bounds, part) => ({
      min: {
        xMeters: Math.min(bounds.min.xMeters, part.boundsMeters.min.xMeters),
        yMeters: Math.min(bounds.min.yMeters, part.boundsMeters.min.yMeters),
        zMeters: Math.min(bounds.min.zMeters, part.boundsMeters.min.zMeters),
      },
      max: {
        xMeters: Math.max(bounds.max.xMeters, part.boundsMeters.max.xMeters),
        yMeters: Math.max(bounds.max.yMeters, part.boundsMeters.max.yMeters),
        zMeters: Math.max(bounds.max.zMeters, part.boundsMeters.max.zMeters),
      },
    }),
    {
      min: { ...first.boundsMeters.min },
      max: { ...first.boundsMeters.max },
    },
  );
}
