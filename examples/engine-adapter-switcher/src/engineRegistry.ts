import type { LoggerLike, S100EngineAdapter } from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

export type DemoEngineId = "nasa-ammos" | "cesium";

export type DemoEngineDefinition = {
  id: DemoEngineId;
  label: string;
  description: string;
  load(logger?: LoggerLike): Promise<S100EngineAdapter>;
};

export const engineDefinitions = {
  "nasa-ammos": {
    id: "nasa-ammos",
    label: "NASA-AMMOS",
    description: "Three.js-backed projected-local S-100 adapter.",
    async load(logger) {
      const adapterOptions = {
        showEnvironmentBackground: true,
        backgroundIntensity: 0.8,
        environmentIntensity: 0.2,
        ambientLightIntensity: 0.08,
        directionalLightIntensity: 0.16,
      };

      return createNasaAmmosAdapter(
        logger === undefined ? adapterOptions : { ...adapterOptions, logger },
      );
    },
  },
  cesium: {
    id: "cesium",
    label: "Cesium",
    description: "Globe-native Cesium adapter using the public S-100 viewer API.",
    async load() {
      const [{ createCesiumAdapter }, cesiumModule] = await Promise.all([
        import("@ecc/s100-viewer-adapter-cesium"),
        import("cesium"),
      ]);

      return createCesiumAdapter({
        cesiumModule,
        dynamicLighting: true,
        viewerOptions: {
          animation: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          timeline: false,
        },
        fetchHandler: window.fetch.bind(window),
      });
    },
  },
} satisfies Record<DemoEngineId, DemoEngineDefinition>;

export const allEngineDefinitions = Object.values(engineDefinitions);

export const getEngineDefinition = (id: string): DemoEngineDefinition => {
  if (id === "nasa-ammos" || id === "cesium") {
    return engineDefinitions[id];
  }

  return engineDefinitions["nasa-ammos"];
};
