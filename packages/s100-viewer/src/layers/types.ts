import type { SpatialExtent } from "../coordinates/types.js";
import type { S100Unsubscribe } from "../events/S100EventBus.js";
import type { LayerControllers } from "./controllers.js";

export const S100ProductType = {
  S101: "S-101",
  S102: "S-102",
  S111: "S-111",
} as const;

export type S100ProductType = (typeof S100ProductType)[keyof typeof S100ProductType];
export type OperationalLayerType = "vessel" | "map-overlay" | "simulated-water-level" | "route-plan" | "tool";
export type LayerProduct = S100ProductType | OperationalLayerType | string;

export type LayerMetadata = {
  title?: string;
  description?: string;
  attribution?: string;
  productVersion?: string;
  sourceId?: string;
  datasetId?: string;
  values?: Record<string, unknown>;
};

export type LayerTemporalOptions = {
  availability?: readonly { start: Date; end: Date }[];
  interpolation?: "nearest" | "linear" | "step";
};

export type BaseLayerSpec<TProduct extends LayerProduct = LayerProduct> = {
  id: string;
  product: TProduct;
  title?: string;
  role?: string;
  visible?: boolean;
  opacity?: number;
  zOrder?: number;
  source?: unknown;
  style?: unknown;
  filters?: unknown;
  time?: LayerTemporalOptions;
  spatialExtent?: SpatialExtent;
  metadata?: LayerMetadata;
  extensions?: Record<string, unknown>;
};

export type LayerSpec = BaseLayerSpec;
export type LayerPatch<TSpec extends BaseLayerSpec = BaseLayerSpec> = Partial<TSpec>;

export interface S100Layer<TSpec extends BaseLayerSpec = BaseLayerSpec> {
  readonly id: string;
  readonly product: TSpec["product"];
  readonly spec: TSpec;
  readonly controllers: LayerControllers<TSpec>;
  readonly nativeHandle: unknown;
  visible: boolean;
  opacity: number;
  update(patch: LayerPatch<TSpec>): Promise<void>;
  remove(): Promise<void>;
  getNativeHandle<TNative = unknown>(): TNative | null;
  onChanged(listener: (layer: S100Layer<TSpec>) => void): S100Unsubscribe;
}

export interface LayerCollection {
  readonly size: number;
  add<TSpec extends BaseLayerSpec>(spec: TSpec): Promise<S100Layer<TSpec>>;
  addMany<TSpec extends BaseLayerSpec>(
    specs: readonly TSpec[],
  ): Promise<Array<S100Layer<TSpec>>>;
  get<TSpec extends BaseLayerSpec = BaseLayerSpec>(id: string): S100Layer<TSpec> | undefined;
  has(id: string): boolean;
  remove(idOrLayer: string | S100Layer): Promise<boolean>;
  clear(): Promise<void>;
  all(): readonly S100Layer[];
  [Symbol.iterator](): IterableIterator<S100Layer>;
}
