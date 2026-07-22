import { S100Error } from "../errors/S100Error.js";
import { EncLayerBuilder } from "./enc-builders.js";
import type { EncLayerSpec } from "./enc.js";
import { S100IhoProductLayerBuilder } from "./iho-builders.js";
import type { S100IhoProductLayerSpec } from "./iho-s100.js";
import { RoutePlanLayerBuilder } from "./route-builders.js";
import type { RoutePlanLayerSpec } from "./route-plan.js";
import { isServiceReadySource } from "./sources.js";
import { SimulatedWaterLevelLayerBuilder } from "./simulated-water-level-builders.js";
import type { SimulatedWaterLevelLayerSpec } from "./simulated-water-level.js";
import { ViewerFeatureLayerBuilder } from "./viewer-feature-builders.js";
import type { ViewerFeatureLayerSpec } from "./viewer-features.js";

export type S100ProductLayerSpec =
  | S100IhoProductLayerSpec
  | EncLayerSpec
  | RoutePlanLayerSpec
  | SimulatedWaterLevelLayerSpec
  | ViewerFeatureLayerSpec;

export type S100ServiceProductType = S100ProductLayerSpec["product"];

export const LayerBuilder = {
  ...EncLayerBuilder,
  ...S100IhoProductLayerBuilder,
  ...RoutePlanLayerBuilder,
  ...SimulatedWaterLevelLayerBuilder,
  ...ViewerFeatureLayerBuilder,
};

export const defineS100LayerSpec = <TSpec extends S100ProductLayerSpec>(spec: TSpec): TSpec => spec;

export const assertServiceReadyLayerSpec = (spec: S100ProductLayerSpec): void => {
  if (!isServiceReadySource(spec.source)) {
    throw new S100Error("invalid-layer-spec", `Layer '${spec.id}' must use a service-ready source.`);
  }
};

export const getLayerDisplayTitle = (spec: S100ProductLayerSpec): string =>
  spec.title ?? spec.metadata?.title ?? spec.id;
