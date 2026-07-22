import type {
  NormalizedParametricVesselAssembly,
  ParametricVesselLayout,
  ParametricVesselLayoutPart,
  ParametricVesselPartSize,
  ParametricVesselReferencePoint,
  ParametricVesselSpec,
} from "./types.js";
import {
  componentGeometry,
  deckOutlineGeometry,
  hullGeometry,
  insetHullTopOutline,
} from "./geometry.js";
import {
  clampCenterInsideRange,
  clampContainerCenter,
  centerFromSternRange,
  localPointFromVesselPoint,
  localZFromKeel,
  normalizeCenterFromStern,
  normalizeLateralFromCenter,
  normalizeOptionalNonNegative,
  normalizeOptionalPositive,
  resolveProportionalSize,
} from "./normalize.js";
import { createLayoutPart } from "./overrides.js";

export function defaultLayoutParts(
  spec: ParametricVesselSpec,
  physical: ParametricVesselLayout["physicalDimensions"],
  reference: Required<ParametricVesselReferencePoint>,
  assembly: NormalizedParametricVesselAssembly,
  sections: { bowLengthMeters: number; sternLengthMeters: number },
): ParametricVesselLayoutPart[] {
  const hullZ = localZFromKeel(physical.hullHeightMeters / 2, reference);
  const deckCenterZ = localZFromKeel(
    physical.hullHeightMeters + physical.deckThicknessMeters / 2,
    reference,
  );
  const superstructureBaseZFromKeel = physical.hullHeightMeters;
  const hullSize = {
    beamMeters: physical.beamMeters,
    heightMeters: physical.hullHeightMeters,
  };
  const sternEnd = sections.sternLengthMeters;
  const bowStart = physical.lengthMeters - sections.bowLengthMeters;
  const deckInset = normalizeOptionalNonNegative(
    spec.layout?.deckInsetMeters,
    physical.beamMeters * 0.04,
    "layout.deckInsetMeters",
  );
  const hullBox = {
    minFromSternMeters: 0,
    maxFromSternMeters: bowStart,
    minLateralFromCenterMeters: -physical.beamMeters / 2,
    maxLateralFromCenterMeters: physical.beamMeters / 2,
  };
  const hullBoxLength = hullBox.maxFromSternMeters - hullBox.minFromSternMeters;
  const deckOutline = insetHullTopOutline(
    physical.lengthMeters,
    physical.beamMeters,
    bowStart,
    deckInset,
    reference,
  );
  const mastHeight = normalizeOptionalPositive(
    spec.layout?.mast?.heightMeters,
    physical.mastHeightMeters,
    "layout.mast.heightMeters",
  );
  const mastRadius = normalizeOptionalPositive(
    spec.layout?.mast?.radiusMeters,
    Math.max(physical.beamMeters * 0.0175, 0.25),
    "layout.mast.radiusMeters",
  );
  const mastDiameter = mastRadius * 2;
  const transponderBeam = normalizeOptionalPositive(
    spec.layout?.transponder?.beamMeters,
    Math.max(mastDiameter * 2.4, 0.7),
    "layout.transponder.beamMeters",
  );
  const transponderLength = normalizeOptionalPositive(
    spec.layout?.transponder?.lengthMeters,
    transponderBeam,
    "layout.transponder.lengthMeters",
  );
  const transponderHeight = normalizeOptionalPositive(
    spec.layout?.transponder?.heightMeters,
    Math.max(mastDiameter * 0.28, 0.15),
    "layout.transponder.heightMeters",
  );
  const requestedAntennaCenterFromStern = normalizeCenterFromStern(
    spec.layout?.transponder?.centerFromSternMeters,
    reference.longitudinalFromSternMeters,
    physical.lengthMeters,
    "layout.transponder.centerFromSternMeters",
  );
  const requestedAntennaLateralFromCenter = normalizeLateralFromCenter(
    spec.layout?.transponder?.lateralFromCenterMeters,
    reference.lateralFromCenterMeters,
    physical.beamMeters,
    "layout.transponder.lateralFromCenterMeters",
  );
  const antennaFootprint = {
    beamMeters: Math.max(mastDiameter, transponderBeam),
    lengthMeters: Math.max(mastDiameter, transponderLength),
  };
  const antennaCenterFromStern = clampCenterInsideRange(
    requestedAntennaCenterFromStern,
    hullBox.minFromSternMeters,
    hullBox.maxFromSternMeters,
    antennaFootprint.lengthMeters,
  );
  const antennaLateralFromCenter = clampCenterInsideRange(
    requestedAntennaLateralFromCenter,
    hullBox.minLateralFromCenterMeters,
    hullBox.maxLateralFromCenterMeters,
    antennaFootprint.beamMeters,
  );
  const bridgeLength = resolveProportionalSize(
    spec.layout?.bridge?.lengthMeters,
    spec.layout?.bridge?.lengthRatio,
    hullBoxLength,
    0.15,
    antennaFootprint.lengthMeters,
    "layout.bridge.length",
  );
  const bridgeBeam = resolveProportionalSize(
    spec.layout?.bridge?.beamMeters,
    spec.layout?.bridge?.beamRatio,
    physical.beamMeters,
    0.6,
    antennaFootprint.beamMeters,
    "layout.bridge.beam",
  );
  const bridgeHeight = normalizeOptionalPositive(
    spec.layout?.bridge?.heightMeters,
    physical.bridgeHeightMeters,
    "layout.bridge.heightMeters",
  );
  const requestedBridgeCenterFromStern = normalizeCenterFromStern(
    spec.layout?.bridge?.centerFromSternMeters,
    antennaCenterFromStern,
    physical.lengthMeters,
    "layout.bridge.centerFromSternMeters",
  );
  const requestedBridgeLateralFromCenter = normalizeLateralFromCenter(
    spec.layout?.bridge?.lateralFromCenterMeters,
    antennaLateralFromCenter,
    physical.beamMeters,
    "layout.bridge.lateralFromCenterMeters",
  );
  const bridgeCenterFromStern = clampContainerCenter(
    requestedBridgeCenterFromStern,
    antennaCenterFromStern,
    hullBox.minFromSternMeters,
    hullBox.maxFromSternMeters,
    bridgeLength,
    antennaFootprint.lengthMeters,
  );
  const bridgeLateralFromCenter = clampContainerCenter(
    requestedBridgeLateralFromCenter,
    antennaLateralFromCenter,
    hullBox.minLateralFromCenterMeters,
    hullBox.maxLateralFromCenterMeters,
    bridgeBeam,
    antennaFootprint.beamMeters,
  );
  const transponderDistanceBelowMastTop = normalizeOptionalNonNegative(
    spec.layout?.transponder?.distanceBelowMastTopMeters,
    0,
    "layout.transponder.distanceBelowMastTopMeters",
  );
  if (transponderDistanceBelowMastTop > mastHeight) {
    throw new RangeError("layout.transponder.distanceBelowMastTopMeters must be within mast height.");
  }
  const mastTopZFromKeel = superstructureBaseZFromKeel + mastHeight;
  const transponderTopZFromKeel = mastTopZFromKeel - transponderDistanceBelowMastTop;
  const transponderCenterZFromKeel = Math.max(
    superstructureBaseZFromKeel + transponderHeight / 2,
    transponderTopZFromKeel - transponderHeight / 2,
  );

  const parts: ParametricVesselLayoutPart[] = [
    createLayoutPart({
      id: "hull-stern",
      role: "hull-stern",
      centerMeters: centerFromSternRange(0, sternEnd, reference, hullZ),
      sizeMeters: {
        ...hullSize,
        lengthMeters: sternEnd,
      },
      geometry: hullGeometry("box", assembly),
      tags: ["hull", "aft"],
    }),
    createLayoutPart({
      id: "hull-midship",
      role: "hull-midship",
      centerMeters: centerFromSternRange(sternEnd, bowStart, reference, hullZ),
      sizeMeters: {
        ...hullSize,
        lengthMeters: Math.max(bowStart - sternEnd, physical.lengthMeters * 0.1),
      },
      geometry: hullGeometry("box", assembly),
      tags: ["hull", "stretch-length"],
    }),
    createLayoutPart({
      id: "hull-bow",
      role: "hull-bow",
      centerMeters: centerFromSternRange(bowStart, physical.lengthMeters, reference, hullZ),
      sizeMeters: {
        ...hullSize,
        lengthMeters: physical.lengthMeters - bowStart,
      },
      geometry: hullGeometry("wedge", assembly, { taperEnd: "bow" }),
      tags: ["hull", "fore"],
    }),
  ];

  if (deckOutline !== undefined) {
    parts.push(createLayoutPart({
      id: "main-deck",
      role: "main-deck",
      centerMeters: {
        xMeters: deckOutline.centerMeters.xMeters,
        yMeters: deckOutline.centerMeters.yMeters,
        zMeters: deckCenterZ,
      },
      sizeMeters: {
        beamMeters: deckOutline.sizeMeters.beamMeters,
        lengthMeters: deckOutline.sizeMeters.lengthMeters,
        heightMeters: physical.deckThicknessMeters,
      },
      geometry: deckOutlineGeometry(deckOutline.outlineMeters),
      tags: ["deck", "stretch-length"],
    }));
  }

  parts.push(
    createLayoutPart({
      id: "bridge",
      role: "bridge",
      centerMeters: {
        xMeters: bridgeLateralFromCenter - reference.lateralFromCenterMeters,
        yMeters: bridgeCenterFromStern - reference.longitudinalFromSternMeters,
        zMeters: localZFromKeel(
          superstructureBaseZFromKeel + bridgeHeight / 2,
          reference,
        ),
      },
      sizeMeters: {
        beamMeters: bridgeBeam,
        lengthMeters: bridgeLength,
        heightMeters: bridgeHeight,
      },
      geometry: componentGeometry("box", { edgeTreatment: "sharp" }),
      tags: ["superstructure"],
    }),
    createLayoutPart({
      id: "mast",
      role: "mast",
      centerMeters: {
        xMeters: antennaLateralFromCenter - reference.lateralFromCenterMeters,
        yMeters: antennaCenterFromStern - reference.longitudinalFromSternMeters,
        zMeters: localZFromKeel(
          superstructureBaseZFromKeel + mastHeight / 2,
          reference,
        ),
      },
      sizeMeters: {
        beamMeters: mastDiameter,
        lengthMeters: mastDiameter,
        heightMeters: mastHeight,
      },
      geometry: componentGeometry("cylinder", { axis: "z" }),
      tags: ["mast"],
    }),
    createLayoutPart({
      id: "transponder",
      role: "transponder",
      centerMeters: localPointFromVesselPoint(
        {
          longitudinalFromSternMeters: antennaCenterFromStern,
          lateralFromCenterMeters: antennaLateralFromCenter,
          verticalFromKeelMeters: transponderCenterZFromKeel,
        },
        reference,
      ),
      sizeMeters: {
        beamMeters: transponderBeam,
        lengthMeters: transponderLength,
        heightMeters: transponderHeight,
      },
      geometry: componentGeometry("disc", { axis: "z" }),
      tags: ["transponder", "reference-marker"],
    }),
  );

  return parts;
}
