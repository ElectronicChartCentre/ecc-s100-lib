type NasaMapLayerModule = typeof import("../layers/mapLayer.js");
type NasaRoutePlanLayerModule = typeof import("../layers/routePlanLayer.js");
type NasaS102TerrainLayerModule = typeof import("../layers/s102TerrainLayer.js");
type NasaS111SurfaceCurrentLayerModule =
  typeof import("../layers/s111SurfaceCurrentLayer.js");
type NasaVesselLayerModule = typeof import("../layers/vesselLayer.js");

let mapLayerModule: Promise<NasaMapLayerModule> | null = null;
let routePlanLayerModule: Promise<NasaRoutePlanLayerModule> | null = null;
let s102TerrainLayerModule: Promise<NasaS102TerrainLayerModule> | null = null;
let s111SurfaceCurrentLayerModule:
  | Promise<NasaS111SurfaceCurrentLayerModule>
  | null = null;
let vesselLayerModule: Promise<NasaVesselLayerModule> | null = null;

export const loadNasaMapLayerModule = (): Promise<NasaMapLayerModule> => {
  mapLayerModule ??= import("../layers/mapLayer.js");
  return mapLayerModule;
};

export const loadNasaRoutePlanLayerModule = (): Promise<NasaRoutePlanLayerModule> => {
  routePlanLayerModule ??= import("../layers/routePlanLayer.js");
  return routePlanLayerModule;
};

export const loadNasaS102TerrainLayerModule = (): Promise<NasaS102TerrainLayerModule> => {
  s102TerrainLayerModule ??= import("../layers/s102TerrainLayer.js");
  return s102TerrainLayerModule;
};

export const loadNasaS111SurfaceCurrentLayerModule = (): Promise<NasaS111SurfaceCurrentLayerModule> => {
  s111SurfaceCurrentLayerModule ??= import("../layers/s111SurfaceCurrentLayer.js");
  return s111SurfaceCurrentLayerModule;
};

export const loadNasaVesselLayerModule = (): Promise<NasaVesselLayerModule> => {
  vesselLayerModule ??= import("../layers/vesselLayer.js");
  return vesselLayerModule;
};
