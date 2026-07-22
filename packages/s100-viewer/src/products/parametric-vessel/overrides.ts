import { boundsForPart } from "./bounds.js";
import { normalizeOptionalPositive } from "./normalize.js";
import type {
  ParametricVesselLayoutPart,
  ParametricVesselLocalPoint,
  ParametricVesselPartAsset,
  ParametricVesselPartGeometry,
  ParametricVesselPartOverride,
  ParametricVesselPartRole,
  ParametricVesselPartSize,
} from "./types.js";

export function createLayoutPart(options: {
  id: string;
  role: ParametricVesselPartRole;
  centerMeters: ParametricVesselLocalPoint;
  sizeMeters: ParametricVesselPartSize;
  naturalSizeMeters?: Partial<ParametricVesselPartSize>;
  assetId?: string;
  asset?: ParametricVesselPartAsset;
  geometry?: ParametricVesselPartGeometry;
  tags?: readonly string[];
  metadata?: Record<string, unknown>;
}): ParametricVesselLayoutPart {
  const natural = completePartSize(options.naturalSizeMeters, options.sizeMeters);
  const assetNatural = completePartSize(options.asset?.naturalSizeMeters, natural);
  const naturalSizeMeters = completePartSize(options.naturalSizeMeters, assetNatural);
  const part: ParametricVesselLayoutPart = {
    id: options.id,
    role: options.role,
    centerMeters: { ...options.centerMeters },
    sizeMeters: { ...options.sizeMeters },
    naturalSizeMeters,
    scale: [
      safeScale(options.sizeMeters.beamMeters, naturalSizeMeters.beamMeters),
      safeScale(options.sizeMeters.lengthMeters, naturalSizeMeters.lengthMeters),
      safeScale(options.sizeMeters.heightMeters, naturalSizeMeters.heightMeters),
    ],
    boundsMeters: boundsForPart(options.centerMeters, options.sizeMeters),
  };
  if (options.assetId !== undefined) {
    part.assetId = options.assetId;
  }
  if (options.asset !== undefined) {
    part.asset = options.asset;
  }
  if (options.geometry !== undefined) {
    part.geometry = clonePartGeometry(options.geometry);
  }
  if (options.tags !== undefined) {
    part.tags = [...options.tags];
  }
  if (options.metadata !== undefined) {
    part.metadata = { ...options.metadata };
  }
  return part;
}

export function applyPartOverrides(
  defaults: readonly ParametricVesselLayoutPart[],
  overrides: readonly ParametricVesselPartOverride[] | undefined,
  assets: Record<string, ParametricVesselPartAsset> | undefined,
): readonly ParametricVesselLayoutPart[] {
  if (!overrides?.length) {
    return defaults.map((part) => attachAsset(part, assets));
  }

  const parts = new Map(defaults.map((part) => [part.id, attachAsset(part, assets)]));
  for (const override of overrides) {
    const existing = parts.get(override.id);
    if (override.enabled === false) {
      parts.delete(override.id);
      continue;
    }
    if (existing) {
      parts.set(override.id, applyPartOverride(existing, override, assets));
      continue;
    }
    parts.set(
      override.id,
      applyPartOverride(
        createLayoutPart({
          id: override.id,
          role: override.role ?? override.id,
          centerMeters: { xMeters: 0, yMeters: 0, zMeters: 0 },
          sizeMeters: { beamMeters: 1, lengthMeters: 1, heightMeters: 1 },
        }),
        override,
        assets,
      ),
    );
  }
  return [...parts.values()];
}

function applyPartOverride(
  part: ParametricVesselLayoutPart,
  override: ParametricVesselPartOverride,
  assets: Record<string, ParametricVesselPartAsset> | undefined,
): ParametricVesselLayoutPart {
  const assetId = override.assetId ?? part.assetId;
  const asset = override.asset ?? (assetId !== undefined ? assets?.[assetId] : part.asset);
  const geometry = mergePartGeometry(part.geometry, override.geometry);
  const tags = override.tags ?? part.tags;
  const metadata = {
    ...part.metadata,
    ...override.metadata,
  };
  return createLayoutPart({
    id: part.id,
    role: override.role ?? part.role,
    centerMeters: {
      ...part.centerMeters,
      ...override.centerMeters,
    },
    sizeMeters: {
      ...part.sizeMeters,
      ...override.sizeMeters,
    },
    naturalSizeMeters: {
      ...part.naturalSizeMeters,
      ...asset?.naturalSizeMeters,
      ...override.naturalSizeMeters,
    },
    ...(assetId !== undefined ? { assetId } : {}),
    ...(asset !== undefined ? { asset } : {}),
    ...(geometry !== undefined ? { geometry } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  });
}

function clonePartGeometry(
  input: ParametricVesselPartGeometry,
): ParametricVesselPartGeometry {
  const geometry: ParametricVesselPartGeometry = { kind: input.kind };
  if (input.edgeTreatment !== undefined) {
    geometry.edgeTreatment = input.edgeTreatment;
  }
  if (input.axis !== undefined) {
    geometry.axis = input.axis;
  }
  if (input.taperEnd !== undefined) {
    geometry.taperEnd = input.taperEnd;
  }
  if (input.corner !== undefined) {
    geometry.corner = input.corner;
  }
  if (input.parameters !== undefined) {
    geometry.parameters = { ...input.parameters };
  }
  if (input.metadata !== undefined) {
    geometry.metadata = { ...input.metadata };
  }
  return geometry;
}

function mergePartGeometry(
  base: ParametricVesselPartGeometry | undefined,
  override: ParametricVesselPartGeometry | undefined,
): ParametricVesselPartGeometry | undefined {
  if (base === undefined) {
    return override === undefined ? undefined : clonePartGeometry(override);
  }
  if (override === undefined) {
    return clonePartGeometry(base);
  }
  const geometry: ParametricVesselPartGeometry = {
    ...clonePartGeometry(base),
    ...clonePartGeometry(override),
  };
  const parameters = {
    ...base.parameters,
    ...override.parameters,
  };
  if (Object.keys(parameters).length > 0) {
    geometry.parameters = parameters;
  }
  const metadata = {
    ...base.metadata,
    ...override.metadata,
  };
  if (Object.keys(metadata).length > 0) {
    geometry.metadata = metadata;
  }
  return geometry;
}

function attachAsset(
  part: ParametricVesselLayoutPart,
  assets: Record<string, ParametricVesselPartAsset> | undefined,
): ParametricVesselLayoutPart {
  const assetId = part.assetId ?? part.id;
  const asset = assets?.[assetId];
  if (!asset) {
    return part;
  }
  return applyPartOverride(part, { id: part.id, assetId }, assets);
}

function completePartSize(
  partial: Partial<ParametricVesselPartSize> | undefined,
  fallback: ParametricVesselPartSize,
): ParametricVesselPartSize {
  return {
    beamMeters: normalizeOptionalPositive(partial?.beamMeters, fallback.beamMeters, "part.beamMeters"),
    lengthMeters: normalizeOptionalPositive(partial?.lengthMeters, fallback.lengthMeters, "part.lengthMeters"),
    heightMeters: normalizeOptionalPositive(partial?.heightMeters, fallback.heightMeters, "part.heightMeters"),
  };
}

function safeScale(size: number, naturalSize: number): number {
  return naturalSize > 0 ? size / naturalSize : 1;
}
