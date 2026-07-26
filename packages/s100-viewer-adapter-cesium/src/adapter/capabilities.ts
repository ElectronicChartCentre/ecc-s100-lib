import {
  S100SupportedProductVersions,
  type AdapterCapabilities,
} from "@ecc/s100-viewer";

export const cesiumAdapterCapabilities: AdapterCapabilities = {
  sceneGeoreferences: ["projected-local", "ellipsoid-ecef"],
  layerProducts: ["S-101", "S-57", "S-102", "S-111", "simulated-water-level", "vessel", "map-overlay", "tool"],
  supportedProductVersions: S100SupportedProductVersions,
  dataSources: ["3d-tiles", "wms", "wmts", "rest-json", "static-json", "model"],
  cameraControls: ["pose", "look-at"],
  picking: true,
  timeDynamicLayers: true,
  nativeHandles: true,
  precisionStrategy: "engine-native",
  waterLevelField: "sampled",
  waterLevelTerrainShading: "global",
  globe: {
    ellipsoidEcef: true,
    globeNative3dTiles: true,
    oceanMasking: false,
  },
  visualFeatures: {
    depthRay: true,
    hoverPrism: true,
    vesselTransformGizmo: { supported: true, modes: ["translate", "rotate", "translate-rotate"] },
    vesselOceanSurface: { supported: true, modes: ["projected-local-disc"] },
    vesselShadow: { supported: true, modes: ["projected-local-shadow"] },
    staticLighting: true,
    dynamicLighting: { supported: true, modes: ["scene-time"] },
  },
  extensions: {
    adapterLimitations: [
      "Projected-local S-102 tiles must be supplied as Cesium-compatible 3D Tiles or transformed by the service.",
      "Ocean masking and curved-earth surface replacement are deferred to the dedicated globe/ECEF phase.",
    ],
  },
};
