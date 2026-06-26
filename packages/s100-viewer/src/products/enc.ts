import type { BaseLayerSpec } from "../layers/types.js";
import { S100ProductType } from "../layers/types.js";
import type { S100ProductSpecificationVersion } from "./iho-s100.js";
import type { MvtSource, WmsSource, WmtsSource } from "./sources.js";
import type { EncCommonStyle, S101EncStyle, S57EncStyle } from "./style.js";

export const EncStandard = {
  S101: S100ProductType.S101,
  S57: "S-57",
} as const;

export type EncStandard = (typeof EncStandard)[keyof typeof EncStandard];
export type EncLayerRole = "basemap" | "overlay" | "chart";
export type EncSource = WmsSource | WmtsSource | MvtSource;

export interface BaseEncLayerSpec<
  TStandard extends EncStandard = EncStandard,
  TStyle extends EncCommonStyle = EncCommonStyle,
> extends BaseLayerSpec<TStandard> {
  category: "enc";
  standard: TStandard;
  source: EncSource;
  role?: EncLayerRole;
  style?: TStyle;
}

export interface S101EncLayerSpec
  extends BaseEncLayerSpec<typeof EncStandard.S101, S101EncStyle> {
  productSpecificationVersion?: S100ProductSpecificationVersion;
}

export interface S57EncLayerSpec
  extends BaseEncLayerSpec<typeof EncStandard.S57, S57EncStyle> {}

export type EncLayerSpec = S101EncLayerSpec | S57EncLayerSpec;

export const S101Styles = {
  DEFAULT: {
    visible: true,
    opacity: 0.72,
    cutout: {
      enabled: true,
    },
  } satisfies S101EncStyle,
};

export const S57Styles = {
  DEFAULT: {
    visible: true,
    opacity: 0.72,
    cutout: {
      enabled: true,
    },
    legacyDisplayMode: "standard",
  } satisfies S57EncStyle,
};

export const isEncLayerSpec = (spec: BaseLayerSpec): spec is EncLayerSpec => {
  const candidate = spec as BaseLayerSpec & {
    category?: unknown;
    standard?: unknown;
  };
  return (
    candidate.category === "enc" &&
    (candidate.standard === EncStandard.S101 || candidate.standard === EncStandard.S57)
  );
};
