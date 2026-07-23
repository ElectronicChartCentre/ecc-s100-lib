import {
  type BaseLayerSpec,
  type S102BathymetryLayerSpec,
  type ThreeDTilesSource,
} from "@ecc/s100-viewer";
import { resolveSafetyDepthMeters } from "@ecc/s100-viewer/internal/products/depthStyle";
import { parseS102TerrainHeightSign } from "@ecc/s100-viewer/internal/products/s102TerrainShading";
import type { TerrainView } from "../runtime/scene/NasaSceneRuntime.js";
import {
  getNasaAmmosExtension,
  getNumberExtension,
} from "../shared/extensions.js";

export const buildAdditionalUrlParameters = (
  spec: S102BathymetryLayerSpec,
): string => {
  const legacyAdditionalURLParameters = getNasaAmmosExtension<string>(
    spec,
    "additionalURLParameters",
  );
  if (legacyAdditionalURLParameters !== undefined) {
    return normalizeQueryString(legacyAdditionalURLParameters);
  }

  const source = spec.source;
  const params = new URLSearchParams();
  if (source.crs) {
    params.set("crs", source.crs);
  }
  if (source.verticalDatum) {
    params.set("verticalDatum", source.verticalDatum);
  }
  for (const [key, value] of Object.entries(source.query ?? {})) {
    params.set(key, String(value));
  }
  return params.toString();
};

export const getAuthorizationBearer = (
  source: ThreeDTilesSource,
): string | undefined => {
  const authorization = source.headers?.Authorization ?? source.headers?.authorization;
  if (!authorization) {
    return undefined;
  }

  return authorization.replace(/^Bearer\s+/iu, "");
};

export const applyTerrainStyle = (
  view: TerrainView,
  spec: S102BathymetryLayerSpec,
): void => {
  const style = spec.style;
  if (!style) {
    return;
  }

  if (typeof style.seaLevel === "number") {
    view.terrain.seaLevel = style.seaLevel;
  }
  view.terrain.safetyDepthMeters = resolveSafetyDepthMeters(style);
  view.terrain.heightSign = getS102HeightSign(spec);
  if (style.contours) {
    view.terrain.showContour = style.contours.visible;
    view.terrain.seaContour = style.contours.visible;
    if (typeof style.contours.intervalMeters === "number") {
      view.terrain.contourInterval = style.contours.intervalMeters;
    }
  }
};

export const getS102DetailFactor = (spec: S102BathymetryLayerSpec): number =>
  spec.rendering?.detailFactor ?? getNumberExtension(spec, "detailFactor", 1);

const normalizeQueryString = (value: string): string =>
  value.trim().replace(/^[?&]+/, "");

const getS102HeightSign = (spec: S102BathymetryLayerSpec): 1 | -1 => {
  const heightCoordinate = getNasaAmmosExtension<{ sign?: unknown }>(spec, "heightCoordinate");
  return parseS102TerrainHeightSign(
    heightCoordinate?.sign ??
      getNasaAmmosExtension<unknown>(spec, "heightSign") ??
      spec.source.metadata?.values?.heightSign,
  );
};
