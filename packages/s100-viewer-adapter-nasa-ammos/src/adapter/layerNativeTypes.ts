import type {
  BaseLayerSpec,
  EncLayerSpec,
  MapOverlayLayerSpec,
  RoutePlanLayerSpec,
  S102BathymetryLayerSpec,
  S111SurfaceCurrentLayerSpec,
  SimulatedWaterLevelLayerSpec,
  VesselLayerSpec,
} from "@ecc/s100-viewer";
import type { S100RenderContext } from "../runtime/core/types.js";
import type {
  CustomModelView,
  MapView,
  S111View,
  TerrainView,
  VesselView,
} from "../runtime/scene/NasaSceneRuntime.js";
import type { Vec3 } from "../runtime/index.js";
import type { NasaRoutePlanView } from "../layers/routePlanLayer.js";

export type NasaSceneGeoreference = {
  crs?: string;
  origin?: Vec3;
};

export type NasaRenderContext = S100RenderContext;

export type NasaLayerNative =
  | { kind: "terrain"; spec: S102BathymetryLayerSpec; view: TerrainView }
  | { kind: "s111"; spec: S111SurfaceCurrentLayerSpec; view: S111View }
  | { kind: "simulated-water-level"; spec: SimulatedWaterLevelLayerSpec; data: unknown }
  | { kind: "map"; spec: EncLayerSpec | MapOverlayLayerSpec; view: MapView }
  | { kind: "vessel"; spec: VesselLayerSpec; view: VesselView }
  | { kind: "route-plan"; spec: RoutePlanLayerSpec; view: NasaRoutePlanView }
  | { kind: "model"; spec: BaseLayerSpec; view: CustomModelView };

export const isNasaLayerNative = (value: unknown): value is NasaLayerNative =>
  Boolean(value && typeof value === "object" && "kind" in value && "spec" in value);
