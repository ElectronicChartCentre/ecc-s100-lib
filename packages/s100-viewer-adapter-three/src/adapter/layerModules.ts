type MapLayerModule = typeof import("../layers/mapLayer.js");
type RoutePlanLayerModule = typeof import("../layers/routePlanLayer.js");
type S102TilesLayerModule = typeof import("../layers/s102TilesLayer.js");
type S111LayerModule = typeof import("../layers/s111SurfaceCurrentLayer.js");
type SimulatedWaterLevelLayerModule =
  typeof import("../layers/simulatedWaterLevelLayer.js");
type VesselLayerModule = typeof import("../layers/vesselLayer.js");

let mapLayerModule: Promise<MapLayerModule> | null = null;
let routePlanLayerModule: Promise<RoutePlanLayerModule> | null = null;
let s102TilesLayerModule: Promise<S102TilesLayerModule> | null = null;
let s111LayerModule: Promise<S111LayerModule> | null = null;
let simulatedWaterLevelLayerModule:
  | Promise<SimulatedWaterLevelLayerModule>
  | null = null;
let vesselLayerModule: Promise<VesselLayerModule> | null = null;

export const loadThreeMapLayerModule = (): Promise<MapLayerModule> => {
  mapLayerModule ??= import("../layers/mapLayer.js");
  return mapLayerModule;
};

export const loadThreeRoutePlanLayerModule = (): Promise<RoutePlanLayerModule> => {
  routePlanLayerModule ??= import("../layers/routePlanLayer.js");
  return routePlanLayerModule;
};

export const loadThreeS102TilesLayerModule = (): Promise<S102TilesLayerModule> => {
  s102TilesLayerModule ??= import("../layers/s102TilesLayer.js");
  return s102TilesLayerModule;
};

export const loadThreeS111LayerModule = (): Promise<S111LayerModule> => {
  s111LayerModule ??= import("../layers/s111SurfaceCurrentLayer.js");
  return s111LayerModule;
};

export const loadThreeSimulatedWaterLevelLayerModule = ():
Promise<SimulatedWaterLevelLayerModule> => {
  simulatedWaterLevelLayerModule ??= import("../layers/simulatedWaterLevelLayer.js");
  return simulatedWaterLevelLayerModule;
};

export const loadThreeVesselLayerModule = (): Promise<VesselLayerModule> => {
  vesselLayerModule ??= import("../layers/vesselLayer.js");
  return vesselLayerModule;
};
