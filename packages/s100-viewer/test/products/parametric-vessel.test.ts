import { describe, expect, it } from "vitest";
import {
  LayerBuilder,
  buildParametricVesselLayout,
  vesselDimensionsFromParametricVessel,
  type ParametricVesselLayoutPart,
  type ParametricVesselSpec,
} from "../../src/index.js";

describe("parametric vessel layout", () => {
  it("builds a stable default layout from total vessel dimensions", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: 6,
        bow: 102,
        stern: 18,
        port: 12,
        starboard: 12,
        hullHeightMeters: 10,
      },
    });

    expect(layout.dimensions).toEqual({
      draught: 6,
      bow: 102,
      stern: 18,
      port: 12,
      starboard: 12,
    });
    expect(layout.physicalDimensions).toMatchObject({
      lengthMeters: 120,
      beamMeters: 24,
      draughtMeters: 6,
      freeboardMeters: 4,
      hullHeightMeters: 10,
    });
    expect(layout.referencePoint).toEqual({
      longitudinalFromSternMeters: 18,
      lateralFromCenterMeters: 0,
      verticalFromKeelMeters: 6,
    });
    expect(layout.coordinateSystem).toEqual({
      x: "starboard-positive",
      y: "bow-positive",
      z: "up-positive",
      units: "meters",
    });
    expect(layout.assembly).toEqual({
      style: "straight-edge",
      hullCrossSection: "rectangular",
    });
    expect(layout.parts.map((part) => part.id)).toEqual([
      "hull-stern",
      "hull-midship",
      "hull-bow",
      "main-deck",
      "bridge",
      "mast",
      "transponder",
    ]);
    const midship = layout.parts.find((part) => part.id === "hull-midship");
    const bow = layout.parts.find((part) => part.id === "hull-bow");
    const deck = layout.parts.find((part) => part.id === "main-deck");
    const bridge = layout.parts.find((part) => part.id === "bridge");
    const mast = layout.parts.find((part) => part.id === "mast");
    const transponder = layout.parts.find((part) => part.id === "transponder");
    expect(midship).toMatchObject({
      role: "hull-midship",
      sizeMeters: {
        beamMeters: 24,
        heightMeters: 10,
      },
      geometry: {
        kind: "box",
        edgeTreatment: "sharp",
      },
      tags: ["hull", "stretch-length"],
    });
    expect(bow?.geometry).toMatchObject({
      kind: "wedge",
      edgeTreatment: "sharp",
      taperEnd: "bow",
    });
    expect(mast?.geometry).toMatchObject({
      kind: "cylinder",
      axis: "z",
    });
    expect(transponder?.geometry).toMatchObject({
      kind: "disc",
      axis: "z",
    });
    expect(deck?.geometry).toMatchObject({
      kind: "deck-outline",
      edgeTreatment: "sharp",
    });
    expect(midship?.sizeMeters.lengthMeters).toBeCloseTo(81.6);
    expect(deck?.boundsMeters.min.yMeters).toBeCloseTo(-17.04);
    expect(deck?.boundsMeters.max.yMeters).toBeLessThan(
      bow?.boundsMeters.max.yMeters ?? -Infinity,
    );
    expect(deck?.sizeMeters.beamMeters).toBeCloseTo(22.08);
    expect(deckOutlineSideInsetMeters(24, 80.4, 102, deck)).toBeCloseTo(0.96);
    expect(bridge?.centerMeters.yMeters).toBe(0);
    expect(bridge?.sizeMeters.beamMeters).toBeCloseTo(14.4);
    expect(bridge?.sizeMeters.lengthMeters).toBeCloseTo(14.76);
    expect(mast?.centerMeters.xMeters).toBe(0);
    expect(mast?.centerMeters.yMeters).toBe(0);
    expect(mast?.sizeMeters.beamMeters).toBeCloseTo(0.84);
    expect(mast?.sizeMeters.lengthMeters).toBeCloseTo(
      mast?.sizeMeters.beamMeters ?? NaN,
    );
    expect(mast?.sizeMeters.heightMeters).toBeCloseTo(
      (bridge?.sizeMeters.heightMeters ?? NaN) * 1.4,
    );
    expect(bridge?.boundsMeters.min.zMeters).toBeCloseTo(4);
    expect(mast?.boundsMeters.min.zMeters).toBeCloseTo(4);
    expect(transponder?.centerMeters.xMeters).toBe(0);
    expect(transponder?.centerMeters.yMeters).toBe(0);
    expect(transponder?.boundsMeters.max.zMeters).toBeCloseTo(
      mast?.boundsMeters.max.zMeters ?? NaN,
    );
    expect(layout.boundsMeters.min.zMeters).toBe(-6);
    expect(layout.boundsMeters.max.zMeters).toBeGreaterThan(10);
  });

  it("uses AIS-style dimensions as the canonical vessel dimensions", () => {
    const spec: ParametricVesselSpec = {
      dimensions: {
        draught: 7,
        bow: 170,
        stern: 30,
        port: 25,
        starboard: 15,
      },
    };
    const dimensions = vesselDimensionsFromParametricVessel(spec);
    const layout = buildParametricVesselLayout(spec);

    expect(dimensions).toEqual({
      draught: 7,
      bow: 170,
      stern: 30,
      port: 25,
      starboard: 15,
    });
    expect(layout.physicalDimensions).toMatchObject({
      lengthMeters: 200,
      beamMeters: 40,
      draughtMeters: 7,
    });
    expect(layout.referencePoint).toEqual({
      longitudinalFromSternMeters: 30,
      lateralFromCenterMeters: 5,
      verticalFromKeelMeters: 7,
    });
  });

  it("derives freeboard from hull height and draught", () => {
    const tall = buildParametricVesselLayout({
      dimensions: {
        draught: 6,
        bow: 102,
        stern: 18,
        port: 12,
        starboard: 12,
        hullHeightMeters: 16,
      },
    });
    const short = buildParametricVesselLayout({
      dimensions: {
        draught: 6,
        bow: 102,
        stern: 18,
        port: 12,
        starboard: 12,
        hullHeightMeters: 10,
      },
    });

    expect(tall.physicalDimensions.freeboardMeters).toBe(10);
    expect(short.physicalDimensions.freeboardMeters).toBe(4);
  });

  it("defaults hull height from beam while keeping the hull taller than draught", () => {
    const noExplicitHeight = buildParametricVesselLayout({
      dimensions: {
        draught: 5,
        bow: 20,
        stern: 12,
        port: 6,
        starboard: 6,
      },
    });
    const narrowDeep = buildParametricVesselLayout({
      dimensions: {
        draught: 5,
        bow: 10,
        stern: 5,
        port: 1,
        starboard: 1,
      },
    });

    expect(noExplicitHeight.physicalDimensions.hullHeightMeters).toBeCloseTo(6.75);
    expect(narrowDeep.physicalDimensions.hullHeightMeters).toBeCloseTo(5.5);
  });

  it("caps default bridge and mast height against hull height for small vessels", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: (3 * 0.55) / 1.35,
        bow: 8,
        stern: 2,
        port: 2,
        starboard: 1,
      },
    });

    expect(layout.physicalDimensions.hullHeightMeters).toBeCloseTo(1.65);
    expect(layout.physicalDimensions.bridgeHeightMeters).toBeLessThanOrEqual(
      layout.physicalDimensions.hullHeightMeters,
    );
    expect(layout.physicalDimensions.mastHeightMeters).toBeLessThanOrEqual(
      layout.physicalDimensions.hullHeightMeters * 2,
    );
    expect(layout.physicalDimensions.bridgeHeightMeters).toBeCloseTo(1.65);
    expect(layout.physicalDimensions.mastHeightMeters).toBeCloseTo(3.3);
  });

  it("places generated mast and transponder at the AIS top-view reference point", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: 5,
        bow: 75,
        stern: 25,
        port: 12,
        starboard: 6,
        hullHeightMeters: 9,
        bridgeHeightMeters: 5,
        mastHeightMeters: 8,
      },
    });

    const hull = layout.parts.find((part) => part.id === "hull-midship");
    const bridge = layout.parts.find((part) => part.id === "bridge");
    const mast = layout.parts.find((part) => part.id === "mast");
    const transponder = layout.parts.find((part) => part.id === "transponder");

    expect(layout.referencePoint).toEqual({
      longitudinalFromSternMeters: 25,
      lateralFromCenterMeters: 3,
      verticalFromKeelMeters: 5,
    });
    expect(hull?.centerMeters.xMeters).toBe(-3);
    expect(bridge?.centerMeters.xMeters).toBe(0);
    expect(bridge?.centerMeters.yMeters).toBe(0);
    expect(mast?.centerMeters.xMeters).toBe(0);
    expect(mast?.centerMeters.yMeters).toBe(0);
    expect(transponder?.centerMeters.xMeters).toBe(0);
    expect(transponder?.centerMeters.yMeters).toBe(0);
    expect(layout.boundsMeters.min.zMeters).toBe(-5);
    expect(mast?.boundsMeters.max.zMeters).toBeGreaterThan(0);
  });

  it("allows a zero stern distance and keeps default superstructure at the AIS reference", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: 4,
        bow: 80,
        stern: 0,
        port: 8,
        starboard: 8,
      },
    });

    const bridge = layout.parts.find((part) => part.id === "bridge");
    const mast = layout.parts.find((part) => part.id === "mast");
    const transponder = layout.parts.find((part) => part.id === "transponder");

    expect(layout.referencePoint.longitudinalFromSternMeters).toBe(0);
    expect(bridge?.boundsMeters.min.yMeters).toBeCloseTo(0);
    expect(mast?.boundsMeters.min.yMeters).toBeGreaterThanOrEqual(0);
    expect(transponder?.boundsMeters.min.yMeters).toBeGreaterThanOrEqual(0);
  });

  it("keeps bridge, mast, and transponder inside lateral hull edges", () => {
    const starboardEdgeLayout = buildParametricVesselLayout({
      dimensions: {
        draught: 4,
        bow: 80,
        stern: 10,
        port: 16,
        starboard: 0,
      },
    });
    const portEdgeLayout = buildParametricVesselLayout({
      dimensions: {
        draught: 4,
        bow: 80,
        stern: 10,
        port: 0,
        starboard: 16,
      },
    });

    const starboardBridge = starboardEdgeLayout.parts.find((part) => part.id === "bridge");
    const starboardMast = starboardEdgeLayout.parts.find((part) => part.id === "mast");
    const starboardTransponder = starboardEdgeLayout.parts.find(
      (part) => part.id === "transponder",
    );
    const portBridge = portEdgeLayout.parts.find((part) => part.id === "bridge");
    const portMast = portEdgeLayout.parts.find((part) => part.id === "mast");
    const portTransponder = portEdgeLayout.parts.find(
      (part) => part.id === "transponder",
    );

    expect(starboardBridge?.boundsMeters.max.xMeters).toBeCloseTo(0);
    expect(starboardMast?.boundsMeters.max.xMeters).toBeLessThanOrEqual(0);
    expect(starboardTransponder?.boundsMeters.max.xMeters).toBeCloseTo(0);
    expect(portBridge?.boundsMeters.min.xMeters).toBeCloseTo(0);
    expect(portMast?.boundsMeters.min.xMeters).toBeGreaterThanOrEqual(0);
    expect(portTransponder?.boundsMeters.min.xMeters).toBeCloseTo(0);
  });

  it("clamps the bridge to lateral hull edges before the antenna footprint reaches them", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: 4,
        bow: 80,
        stern: 10,
        port: 16,
        starboard: 1,
      },
    });

    const bridge = layout.parts.find((part) => part.id === "bridge");
    const transponder = layout.parts.find((part) => part.id === "transponder");

    expect(bridge?.boundsMeters.max.xMeters).toBeCloseTo(1);
    expect(transponder?.boundsMeters.max.xMeters).toBeLessThan(1);
  });

  it("uses mast radius as a circular generated mast cross section", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: 4,
        bow: 80,
        stern: 10,
        port: 8,
        starboard: 8,
      },
      layout: {
        mast: {
          radiusMeters: 1.25,
        },
      },
    });

    const mast = layout.parts.find((part) => part.id === "mast");

    expect(mast?.sizeMeters.beamMeters).toBe(2.5);
    expect(mast?.sizeMeters.lengthMeters).toBe(2.5);
  });

  it("records rounded-corner assembly intent without changing the default part contract", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: 4,
        bow: 68,
        stern: 12,
        port: 8,
        starboard: 8,
      },
      assembly: {
        style: "rounded-corner",
        cornerRadiusMeters: 1.5,
      },
    });

    const hullParts = layout.parts.filter((part) => part.tags?.includes("hull"));

    expect(layout.assembly).toEqual({
      style: "rounded-corner",
      hullCrossSection: "rounded-rectangle",
      cornerRadiusMeters: 1.5,
    });
    expect(hullParts.map((part) => part.id)).toEqual([
      "hull-stern",
      "hull-midship",
      "hull-bow",
    ]);
    expect(hullParts.every((part) => part.geometry?.edgeTreatment === "rounded"))
      .toBe(true);
    expect(hullParts[0]?.geometry?.parameters).toEqual({
      cornerRadiusMeters: 1.5,
    });
  });

  it("builds one deck outline from the inset hull-top polygon", () => {
    const layout = buildParametricVesselLayout({
      dimensions: {
        draught: 5,
        bow: 85,
        stern: 15,
        port: 10,
        starboard: 10,
        hullHeightMeters: 9,
      },
      layout: {
        bowLengthMeters: 20,
        deckInsetMeters: 2,
      },
    });

    const bow = layout.parts.find((part) => part.id === "hull-bow");
    const deck = layout.parts.find((part) => part.id === "main-deck");
    const starboardBowShoulder = deckOutlineStarboardBowShoulder(deck);

    expect(deck?.sizeMeters.beamMeters).toBe(16);
    expect((deck?.boundsMeters.min.yMeters ?? 0) - -15).toBeCloseTo(2);
    expect(10 - (deck?.boundsMeters.max.xMeters ?? 0)).toBeCloseTo(2);
    expect(deck?.geometry?.metadata?.outlineMeters).toHaveLength(5);
    expect(deckOutlineSideInsetMeters(20, 65, 85, deck)).toBeCloseTo(2);
    expect(starboardBowShoulder?.yMeters).toBeLessThan(65);
    expect(deck?.boundsMeters.max.yMeters).toBeCloseTo(
      (bow?.boundsMeters.max.yMeters ?? 0) - 4.472,
    );
  });

  it("keeps deck bow-side inset stable when bow section length changes", () => {
    const baseSpec = {
      dimensions: {
        draught: 5,
        bow: 85,
        stern: 15,
        port: 10,
        starboard: 10,
        hullHeightMeters: 9,
      },
    } satisfies ParametricVesselSpec;
    const shortBow = buildParametricVesselLayout({
      ...baseSpec,
      layout: {
        bowLengthMeters: 10,
        deckInsetMeters: 2,
      },
    });
    const longBow = buildParametricVesselLayout({
      ...baseSpec,
      layout: {
        bowLengthMeters: 30,
        deckInsetMeters: 2,
      },
    });

    const shortDeck = shortBow.parts.find((part) => part.id === "main-deck");
    const longDeck = longBow.parts.find((part) => part.id === "main-deck");
    const shortDeckShoulder = deckOutlineStarboardBowShoulder(shortDeck);
    const longDeckShoulder = deckOutlineStarboardBowShoulder(longDeck);

    expect(deckOutlineSideInsetMeters(20, 75, 85, shortDeck)).toBeCloseTo(2);
    expect(deckOutlineSideInsetMeters(20, 55, 85, longDeck)).toBeCloseTo(2);
    expect(shortDeckShoulder?.yMeters).toBeLessThan(75);
    expect(longDeckShoulder?.yMeters).toBeLessThan(55);
    expect(shortDeck?.boundsMeters.max.yMeters).toBeCloseTo(82.172);
    expect(longDeck?.boundsMeters.max.yMeters).toBeCloseTo(78.675);
  });

  it("allows part assets, size overrides, removal, and custom parts", () => {
    const spec: ParametricVesselSpec = {
      dimensions: {
        draught: 4,
        bow: 76.5,
        stern: 13.5,
        port: 9,
        starboard: 9,
      },
      assets: {
        "hull-midship": {
          url: "/parts/hull-midship.glb",
          naturalSizeMeters: {
            lengthMeters: 10,
            beamMeters: 18,
            heightMeters: 6,
          },
        },
        funnel: {
          url: "/parts/funnel.glb",
          naturalSizeMeters: {
            beamMeters: 1,
            lengthMeters: 1,
            heightMeters: 2,
          },
        },
      },
      layout: {
        parts: [
          {
            id: "mast",
            enabled: false,
          },
          {
            id: "hull-midship",
            sizeMeters: {
              lengthMeters: 50,
            },
            geometry: {
              kind: "box",
              metadata: {
                assetVariant: "stretchable-midship",
              },
            },
          },
          {
            id: "funnel",
            role: "funnel",
            assetId: "funnel",
            centerMeters: {
              yMeters: -12,
              zMeters: 8,
            },
            sizeMeters: {
              beamMeters: 2,
              lengthMeters: 2,
              heightMeters: 5,
            },
            geometry: {
              kind: "cylinder",
              axis: "z",
            },
          },
        ],
      },
    };

    const layout = buildParametricVesselLayout(spec);
    const midship = layout.parts.find((part) => part.id === "hull-midship");
    const funnel = layout.parts.find((part) => part.id === "funnel");

    expect(layout.parts.some((part) => part.id === "mast")).toBe(false);
    expect(midship?.asset?.url).toBe("/parts/hull-midship.glb");
    expect(midship?.sizeMeters.lengthMeters).toBe(50);
    expect(midship?.geometry).toMatchObject({
      kind: "box",
      edgeTreatment: "sharp",
      metadata: {
        assetVariant: "stretchable-midship",
      },
    });
    expect(midship?.scale[0]).toBeCloseTo(1);
    expect(midship?.scale[1]).toBeCloseTo(5);
    expect(midship?.scale[2]).toBeCloseTo((18 * 0.55) / 6);
    expect(funnel).toMatchObject({
      role: "funnel",
      assetId: "funnel",
      asset: {
        url: "/parts/funnel.glb",
      },
      geometry: {
        kind: "cylinder",
        axis: "z",
      },
      scale: [2, 2, 2.5],
    });
  });

  it("creates a parametric vessel layer spec with computed layout metadata", () => {
    const layer = LayerBuilder.createParametricVessel({
      id: "parametric-vessel",
      pose: {
        position: {
          kind: "projected",
          x: 1,
          y: 2,
          z: 0,
          crs: "EPSG:32633",
        },
      },
      parametric: {
        dimensions: {
          draught: 5,
          bow: 85,
          stern: 15,
          port: 10,
          starboard: 10,
        },
      },
    });

    expect(layer).toMatchObject({
      id: "parametric-vessel",
      product: "vessel",
      source: {
        kind: "parametric-vessel",
      },
      dimensions: {
        draught: 5,
        bow: 85,
        stern: 15,
        port: 10,
        starboard: 10,
      },
      parametricVessel: {
        layout: {
          kind: "parametric-vessel-layout",
        },
      },
    });
    expect(layer.parametricVessel?.layout.parts.length).toBeGreaterThan(0);
  });

  it("rejects invalid vessel dimensions early", () => {
    expect(() =>
      buildParametricVesselLayout({
        dimensions: {
          draught: 5,
          bow: 0,
          stern: 0,
          port: 10,
          starboard: 10,
        },
      }),
    ).toThrow("dimensions.bow + dimensions.stern");
  });
});

function deckOutlineSideInsetMeters(
  hullBeamMeters: number,
  bowStartYMeters: number,
  bowTipYMeters: number,
  deck: ParametricVesselLayoutPart | undefined,
): number {
  const shoulder = deckOutlineStarboardBowShoulder(deck);
  if (!shoulder) {
    return Number.NaN;
  }
  const hullHalfBeam = hullBeamMeters / 2;
  return distanceToLine(
    shoulder,
    { xMeters: hullHalfBeam, yMeters: bowStartYMeters },
    { xMeters: 0, yMeters: bowTipYMeters },
  );
}

function deckOutlineStarboardBowShoulder(
  deck: ParametricVesselLayoutPart | undefined,
): { xMeters: number; yMeters: number } | undefined {
  const outline = absoluteDeckOutline(deck);
  if (outline.length < 5) {
    return undefined;
  }
  const maxX = Math.max(...outline.map((point) => point.xMeters));
  return outline
    .filter((point) => Math.abs(point.xMeters - maxX) < 1e-6)
    .sort((first, second) => second.yMeters - first.yMeters)[0];
}

function absoluteDeckOutline(
  deck: ParametricVesselLayoutPart | undefined,
): readonly { xMeters: number; yMeters: number }[] {
  const outline = deck?.geometry?.metadata?.outlineMeters;
  if (!deck || !Array.isArray(outline)) {
    return [];
  }
  return outline.flatMap((point) => {
    if (typeof point !== "object" || point === null) {
      return [];
    }
    const candidate = point as Record<string, unknown>;
    if (
      typeof candidate.xMeters !== "number" ||
      typeof candidate.yMeters !== "number"
    ) {
      return [];
    }
    return [{
      xMeters: deck.centerMeters.xMeters + candidate.xMeters,
      yMeters: deck.centerMeters.yMeters + candidate.yMeters,
    }];
  });
}

function distanceToLine(
  point: { xMeters: number; yMeters: number },
  start: { xMeters: number; yMeters: number },
  end: { xMeters: number; yMeters: number },
): number {
  const dx = end.xMeters - start.xMeters;
  const dy = end.yMeters - start.yMeters;
  return Math.abs(
    dy * point.xMeters -
      dx * point.yMeters +
      end.xMeters * start.yMeters -
      end.yMeters * start.xMeters,
  ) / Math.hypot(dx, dy);
}
