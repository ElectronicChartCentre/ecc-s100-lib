import type { Coordinate } from "../coordinates/types.js";

export type PickFallbackMode = "none" | "sea-level-plane";

export type PickRequest = {
  screenX: number;
  screenY: number;
  fallback?: PickFallbackMode;
  includeNative?: boolean;
};

export type PickResultSource =
  | "geometry"
  | "terrain"
  | "raster"
  | "vector"
  | "sea-level-plane"
  | "none";

export type PickResult = {
  screen: { x: number; y: number };
  world?: Coordinate;
  geodetic?: Coordinate;
  product?: string;
  layerId?: string;
  featureId?: string;
  source: PickResultSource;
  depthMeters?: number;
  values?: Record<string, unknown>;
  native?: unknown;
};

export type LivePickingOptions = {
  enabled: boolean;
  includeVisual?: boolean;
  fallback?: PickFallbackMode;
  visual?: {
    lineThickness?: number;
    belowSeaLevelColor?: [number, number, number];
    aboveSeaLevelColor?: [number, number, number];
    seaLevelMarkerVisible?: boolean;
    seaLevelMarkerSize?: number;
    seaLevelMarkerOpacity?: number;
    seaLevelMarkerColor?: [number, number, number];
  };
};

export type DepthRayVisualOptions = NonNullable<LivePickingOptions["visual"]>;

export type DepthRayState = DepthRayVisualOptions & {
  enabled: boolean;
  fallback?: PickFallbackMode;
};

export interface PickingController {
  pick(request: PickRequest): Promise<PickResult | null>;
  getLiveMode(): LivePickingOptions;
  setLiveMode(options: LivePickingOptions): void;
}

export interface DepthRayController {
  getState(): DepthRayState;
  setState(state: Partial<DepthRayState>): void;
  setEnabled(enabled: boolean): void;
}
