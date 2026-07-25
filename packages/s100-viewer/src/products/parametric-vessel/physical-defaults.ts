const DEFAULT_HULL_HEIGHT_TO_BEAM_RATIO = 0.55;
const DEFAULT_HULL_HEIGHT_TO_DRAUGHT_RATIO = 1.35;
const DEFAULT_MAX_HULL_HEIGHT_TO_BEAM_RATIO = 1.5;
const DEFAULT_MIN_HULL_HEIGHT_TO_DRAUGHT_RATIO = 1.1;
const DEFAULT_BRIDGE_HEIGHT_TO_BEAM_RATIO = 0.35;
const DEFAULT_MIN_BRIDGE_HEIGHT_METERS = 4;
const DEFAULT_MAST_HEIGHT_TO_BRIDGE_RATIO = 1.4;
const DEFAULT_MIN_MAST_HEIGHT_METERS = 6;
const DEFAULT_MAX_BRIDGE_HEIGHT_TO_HULL_RATIO = 1;
const DEFAULT_MAX_MAST_HEIGHT_TO_HULL_RATIO = 2;

export function defaultParametricHullHeightMeters(options: {
  beamMeters: number;
  draughtMeters?: number;
  fallbackMeters?: number;
}): number {
  const beamMeters = positive(options.beamMeters);
  if (beamMeters === undefined) {
    return positive(options.fallbackMeters) ?? 2;
  }

  const beamBasedHeight = beamMeters * DEFAULT_HULL_HEIGHT_TO_BEAM_RATIO;
  const draughtMeters = positive(options.draughtMeters);
  if (draughtMeters === undefined) {
    return beamBasedHeight;
  }

  const preferredHeight = Math.max(
    draughtMeters * DEFAULT_HULL_HEIGHT_TO_DRAUGHT_RATIO,
    beamBasedHeight,
  );
  const maxHeight = beamMeters * DEFAULT_MAX_HULL_HEIGHT_TO_BEAM_RATIO;
  const minHeight = draughtMeters * DEFAULT_MIN_HULL_HEIGHT_TO_DRAUGHT_RATIO;
  return Math.max(minHeight, Math.min(preferredHeight, maxHeight));
}

export function estimateParametricDraughtFromBeamMeters(
  beamMeters: number,
  fallbackMeters = 4,
): number {
  const hullHeightMeters = defaultParametricHullHeightMeters({
    beamMeters,
    fallbackMeters,
  });
  return hullHeightMeters / DEFAULT_HULL_HEIGHT_TO_DRAUGHT_RATIO;
}

export function defaultParametricBridgeHeightMeters(options: {
  beamMeters: number;
  hullHeightMeters: number;
  requestedHeightMeters?: number;
}): number {
  const hullHeightMeters = positive(options.hullHeightMeters) ?? 2;
  const requestedHeight = positive(options.requestedHeightMeters);
  const preferredHeight = requestedHeight ??
    Math.max(
      (positive(options.beamMeters) ?? 0) * DEFAULT_BRIDGE_HEIGHT_TO_BEAM_RATIO,
      DEFAULT_MIN_BRIDGE_HEIGHT_METERS,
    );
  return Math.min(
    preferredHeight,
    hullHeightMeters * DEFAULT_MAX_BRIDGE_HEIGHT_TO_HULL_RATIO,
  );
}

export function defaultParametricMastHeightMeters(options: {
  bridgeHeightMeters: number;
  hullHeightMeters: number;
  requestedHeightMeters?: number;
}): number {
  const hullHeightMeters = positive(options.hullHeightMeters) ?? 2;
  const requestedHeight = positive(options.requestedHeightMeters);
  const preferredHeight = requestedHeight ??
    Math.max(
      (positive(options.bridgeHeightMeters) ?? 0) * DEFAULT_MAST_HEIGHT_TO_BRIDGE_RATIO,
      DEFAULT_MIN_MAST_HEIGHT_METERS,
    );
  return Math.min(
    preferredHeight,
    hullHeightMeters * DEFAULT_MAX_MAST_HEIGHT_TO_HULL_RATIO,
  );
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}
