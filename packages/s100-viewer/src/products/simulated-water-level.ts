import type { BaseLayerSpec } from "../layers/types.js";
import type { RestJsonSource, StaticJsonSource } from "./sources.js";
import type { ProductTimeOptions, SimulatedWaterLevelStyle } from "./style.js";

export const SimulatedWaterLevelProduct = "simulated-water-level" as const;

export interface SimulatedWaterLevelLayerSpec
  extends BaseLayerSpec<typeof SimulatedWaterLevelProduct> {
  source: RestJsonSource | StaticJsonSource;
  time?: ProductTimeOptions;
  style?: SimulatedWaterLevelStyle;
}

export const SimulatedWaterLevelStyles = {
  DEFAULT: {
    visible: true,
    opacity: 1,
    colorRamp: "s100-default",
    showSurface: true,
  } satisfies SimulatedWaterLevelStyle,
};
