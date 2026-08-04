import type { VesselLayerSpec } from "@ecc/s100-viewer";

export const createVesselPickValues = (
  spec: VesselLayerSpec,
): Record<string, unknown> => {
  const values: Record<string, unknown> = {
    layerId: spec.id,
    product: spec.product,
    featureId: spec.id,
  };
  copyRecordValues(values, spec.metadata?.values);
  copyRecordValues(values, spec.source.metadata?.values);
  if (spec.source.kind === "parametric-vessel") {
    copyRecordValues(values, spec.source.spec.metadata);
  }
  if (spec.dimensions !== undefined) {
    values.dimensions = { ...spec.dimensions };
  }
  return values;
};

const copyRecordValues = (
  target: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
): void => {
  if (source !== undefined) {
    Object.assign(target, source);
  }
};
