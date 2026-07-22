import type { VesselDimensions } from "../viewer-features.js";
import { boundsForParts } from "./bounds.js";
import { defaultLayoutParts } from "./defaults.js";
import {
  normalizeAssemblyOptions,
  normalizePhysicalDimensions,
  normalizeReferencePoint,
  normalizeSectionLengths,
  normalizeVesselDimensions,
} from "./normalize.js";
import { applyPartOverrides } from "./overrides.js";
import type {
  ParametricVesselLayout,
  ParametricVesselSpec,
} from "./types.js";

export function buildParametricVesselLayout(
  input: ParametricVesselSpec,
): ParametricVesselLayout {
  const spec = normalizeParametricVesselSpec(input);
  const dimensions = vesselDimensionsFromParametricVessel(spec);
  const physical = normalizePhysicalDimensions(spec.dimensions);
  const reference = normalizeReferencePoint(spec.dimensions);
  const assembly = normalizeAssemblyOptions(spec.assembly);
  const sections = normalizeSectionLengths(physical, spec.layout);
  const parts = applyPartOverrides(
    defaultLayoutParts(spec, physical, reference, assembly, sections),
    spec.layout?.parts,
    spec.assets,
  );

  return {
    kind: "parametric-vessel-layout",
    coordinateSystem: {
      x: "starboard-positive",
      y: "bow-positive",
      z: "up-positive",
      units: "meters",
    },
    spec,
    assembly,
    dimensions,
    physicalDimensions: physical,
    referencePoint: reference,
    parts,
    boundsMeters: boundsForParts(parts),
  };
}

export function normalizeParametricVesselSpec(
  input: ParametricVesselSpec,
): ParametricVesselSpec {
  const dimensions = normalizeVesselDimensions(input.dimensions);
  const physical = normalizePhysicalDimensions(input.dimensions);
  const assembly = normalizeAssemblyOptions(input.assembly);

  return {
    ...input,
    kind: "parametric",
    dimensions: {
      ...dimensions,
      hullHeightMeters: physical.hullHeightMeters,
      deckThicknessMeters: physical.deckThicknessMeters,
      bridgeHeightMeters: physical.bridgeHeightMeters,
      mastHeightMeters: physical.mastHeightMeters,
    },
    assembly,
  };
}

export function vesselDimensionsFromParametricVessel(
  input: ParametricVesselSpec,
): VesselDimensions {
  return normalizeVesselDimensions(input.dimensions);
}
