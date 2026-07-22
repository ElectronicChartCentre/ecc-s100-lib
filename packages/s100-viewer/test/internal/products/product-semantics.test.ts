import { describe, expect, it } from "vitest";
import {
  resolveSafetyDepthMeters,
  safetyDepthToZUpThresholdMeters,
} from "../../../src/internal/products/depthStyle.js";
import {
  resolveEncRasterAlphaOptions,
  shouldRenderTransparentRaster,
} from "../../../src/internal/products/encTransparency.js";
import {
  inferS111SpeedKnotsScale,
  resolveS111ArrowScaleMeters,
  resolveS111SpeedColor,
} from "../../../src/internal/products/s111Style.js";
import {
  getS111RecordIndexForTime,
  parseS111Time,
} from "../../../src/internal/products/s111Time.js";
import {
  constrainVesselPoseCoordinate,
  normalizeVesselVerticalPositionLimits,
  renderedEngineZFromVesselPose,
  resolveVesselDimensions,
  vesselPoseZFromRenderedEngineZ,
} from "../../../src/internal/products/vesselPose.js";
import {
  mergeRouteDiagnostics,
  setRouteHybrid3d,
} from "../../../src/internal/products/routeStyle.js";

describe("shared product semantics", () => {
  it("normalizes positive nautical safety depth and converts it to z-up thresholds", () => {
    expect(resolveSafetyDepthMeters({ safetyDepthMeters: 12 })).toBe(12);
    expect(resolveSafetyDepthMeters({ unsafeDepth: -7 })).toBe(7);
    expect(safetyDepthToZUpThresholdMeters(12, 2)).toBe(-10);
  });

  it("normalizes ENC transparency rules", () => {
    expect(resolveEncRasterAlphaOptions({ alphaMode: "binary", alphaCutoff: 2 })).toEqual({
      mode: "binary",
      cutoff: 1,
    });
    expect(shouldRenderTransparentRaster({ role: "basemap", opacity: 1 }, false)).toBe(false);
    expect(shouldRenderTransparentRaster({ role: "overlay", opacity: 1 }, false)).toBe(true);
  });

  it("normalizes S-111 time, speed scaling, and color bands", () => {
    expect(parseS111Time("20260722T101112Z")).toBe(Date.UTC(2026, 6, 22, 10, 11, 12));
    expect(getS111RecordIndexForTime(3, 1_000, 10, 24_000)).toBe(2);
    expect(inferS111SpeedKnotsScale(125)).toBeCloseTo(0.019438444924406);
    expect(resolveS111ArrowScaleMeters({
      speedKnots: 5,
      autoScaling: true,
      gridSizeMeters: 100,
      minSpeedKnots: 0,
      maxSpeedKnots: 10,
    })).toBeCloseTo(60);
    expect(resolveS111SpeedColor(0.2)).toEqual([0x76 / 255, 0x52 / 255, 0xe2 / 255]);
  });

  it("normalizes vessel dimensions, z rendering, and sea-level referenced clamps", () => {
    expect(resolveVesselDimensions(
      {
        dimensions: { bow: 30 },
        style: { draughtMeters: 6 },
        extensionDimensions: { stern: 20, port: 4, starboard: 5 },
      },
      { draught: 7, bow: 100, stern: 100, port: 20, starboard: 20 },
    )).toEqual({
      draught: 6,
      bow: 30,
      stern: 20,
      port: 4,
      starboard: 5,
    });

    expect(renderedEngineZFromVesselPose(-3, 2)).toBe(-1);
    expect(vesselPoseZFromRenderedEngineZ(-1, 2)).toBe(-3);
    const limits = normalizeVesselVerticalPositionLimits({
      minMeters: -4,
      maxMeters: 1,
      reference: "sea-level",
    });
    expect(constrainVesselPoseCoordinate(
      { kind: "projected", crs: "EPSG:32633", x: 1, y: 2, z: -8 },
      limits,
      2,
    )).toMatchObject({ z: -2 });
  });

  it("normalizes route hybrid style and diagnostic merging", () => {
    expect(setRouteHybrid3d({
      visible: true,
      opacity: 1,
      portrayal: "s421",
      visualization: "standard",
      showCenterline: true,
      showWaypoints: true,
      showCorridor: true,
      showXtdBoundaries: true,
      showRouteVolume: false,
      showRouteSides: false,
      showTurnDebugGeometry: false,
    }, true)).toMatchObject({
      visualization: "hybrid-3d",
      showRouteVolume: true,
      showRouteSides: true,
    });

    expect(mergeRouteDiagnostics(
      { diagnostics: [{ code: "route", severity: "info", message: "route" }] },
      { diagnostics: [{ code: "layout", severity: "warning", message: "layout" }] },
    )).toHaveLength(2);
  });
});

