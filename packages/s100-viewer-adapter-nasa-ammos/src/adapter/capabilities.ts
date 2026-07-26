import {
  S100SupportedProductVersions,
  type AdapterCapabilities,
} from "@ecc/s100-viewer";

export const nasaAmmosAdapterCapabilities: AdapterCapabilities = {
  sceneGeoreferences: ["projected-local"],
  layerProducts: [
    "S-101",
    "S-57",
    "S-102",
    "S-111",
    "simulated-water-level",
    "vessel",
    "route-plan",
    "map-overlay",
    "tool",
  ],
  supportedProductVersions: S100SupportedProductVersions,
  dataSources: [
    "3d-tiles",
    "wms",
    "wmts",
    "rest-json",
    "static-json",
    "model",
    "parametric-vessel",
    "route-plan",
  ],
  cameraControls: ["pose", "look-at"],
  picking: true,
  timeDynamicLayers: true,
  nativeHandles: true,
  precisionStrategy: "origin-rebased",
  waterLevelField: "sampled",
  waterLevelTerrainShading: "per-position",
  globe: {
    ellipsoidEcef: false,
    globeNative3dTiles: false,
    oceanMasking: false,
  },
  visualFeatures: {
    depthRay: true,
    hoverPrism: true,
    vesselTransformGizmo: {
      supported: true,
      modes: ["translate", "rotate", "translate-rotate"],
    },
    vesselOceanSurface: true,
    vesselShadow: true,
    staticLighting: true,
    dynamicLighting: false,
  },
};
