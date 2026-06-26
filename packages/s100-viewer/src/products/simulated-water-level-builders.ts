import {
  SimulatedWaterLevelProduct,
  SimulatedWaterLevelStyles,
  type SimulatedWaterLevelLayerSpec,
} from "./simulated-water-level.js";
import type { HttpMethod, SourceMetadata } from "./sources.js";
import type { ProductTimeOptions, SimulatedWaterLevelStyle } from "./style.js";
import {
  commonLayerFields,
  requestOptions,
  type LayerBuilderCommonOptions,
  type SourceRequestBuilderOptions,
} from "./builder-shared.js";

export type CreateSimulatedWaterLevelLayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<SimulatedWaterLevelStyle> &
    SourceRequestBuilderOptions & {
      url: string;
      crs?: string;
      verticalDatum?: string;
      method?: HttpMethod;
      body?: unknown;
      schema?: string;
      sample?: TData;
      time?: ProductTimeOptions;
    };

export type CreateStaticSimulatedWaterLevelLayerOptions<TData = unknown> =
  LayerBuilderCommonOptions<SimulatedWaterLevelStyle> & {
    data: TData;
    crs?: string;
    verticalDatum?: string;
    sourceMetadata?: SourceMetadata;
    time?: ProductTimeOptions;
  };

const mergeSimulatedWaterLevelStyle = (
  style: Partial<SimulatedWaterLevelStyle> | undefined,
): SimulatedWaterLevelStyle => ({
  ...SimulatedWaterLevelStyles.DEFAULT,
  ...style,
});

export const createSimulatedWaterLevel = <TData = unknown>(
  options: CreateSimulatedWaterLevelLayerOptions<TData>,
): SimulatedWaterLevelLayerSpec => ({
  id: options.id ?? "simulated-water-level",
  product: SimulatedWaterLevelProduct,
  ...commonLayerFields(options),
  source: {
    kind: "rest-json",
    url: options.url,
    ...requestOptions(options),
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.method !== undefined ? { method: options.method } : {}),
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.schema !== undefined ? { schema: options.schema } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
    ...(options.sample !== undefined ? { sample: options.sample } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeSimulatedWaterLevelStyle(options.style),
});

export const createStaticSimulatedWaterLevel = <TData = unknown>(
  options: CreateStaticSimulatedWaterLevelLayerOptions<TData>,
): SimulatedWaterLevelLayerSpec => ({
  id: options.id ?? "simulated-water-level",
  product: SimulatedWaterLevelProduct,
  ...commonLayerFields(options),
  source: {
    kind: "static-json",
    data: options.data,
    ...(options.crs !== undefined ? { crs: options.crs } : {}),
    ...(options.verticalDatum !== undefined ? { verticalDatum: options.verticalDatum } : {}),
    ...(options.sourceMetadata !== undefined ? { metadata: options.sourceMetadata } : {}),
  },
  ...(options.time !== undefined ? { time: options.time } : {}),
  style: mergeSimulatedWaterLevelStyle(options.style),
});

export const SimulatedWaterLevelLayerBuilder = {
  SimulatedWaterLevelStyles,
  createSimulatedWaterLevel,
  createStaticSimulatedWaterLevel,
};
