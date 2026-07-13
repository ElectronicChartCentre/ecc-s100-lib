import {
  LayerBuilder,
  type AdapterCapabilities,
  type S100Scene,
} from "@ecc/s100-viewer";

export type DemoRecipeId = "minimal" | "s102-terrain" | "s111-time" | "vessel" | "map-overlay";

export type DemoSceneRecipeContext = {
  log(level: "info" | "warn" | "error", message: string): void;
};

export type DemoSceneRecipe = {
  id: DemoRecipeId;
  label: string;
  description: string;
  requiredProducts?: readonly string[];
  requiredDataSources?: readonly string[];
  requiredVisualFeatures?: readonly (keyof NonNullable<AdapterCapabilities["visualFeatures"]>)[];
  apply(scene: S100Scene, context: DemoSceneRecipeContext): Promise<void>;
};

export type DemoRecipeSupport = {
  supported: boolean;
  reasons: readonly string[];
};

export const demoCrs = "EPSG:32619";
export const demoOrigin = { x: 331100, y: 5186420, z: 0 };
export const demoLookAtTarget = {
  kind: "projected",
  crs: demoCrs,
  x: demoOrigin.x,
  y: demoOrigin.y,
  z: demoOrigin.z,
} as const;

const emptyVesselGltfUrl =
  `data:model/gltf+json,${encodeURIComponent(JSON.stringify({
    asset: { version: "2.0", generator: "@ecc/s100-engine-adapter-switcher" },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
  }))}`;

export const sceneRecipes = {
  minimal: {
    id: "minimal",
    label: "Minimal Scene",
    description: "Creates a projected-local scene with no product layers.",
    async apply(_scene, context) {
      context.log("info", "Created an empty projected-local scene.");
    },
  },
  "s102-terrain": {
    id: "s102-terrain",
    label: "S-102 Terrain",
    description: "Adds an S-102 3D Tiles terrain layer through LayerBuilder.",
    requiredProducts: ["S-102"],
    requiredDataSources: ["3d-tiles"],
    async apply(scene, context) {
      const terrain = await scene.layers.add(
        LayerBuilder.createS102({
          id: "demo-s102",
          title: "Demo S-102 bathymetry",
          url: "https://example.test/s102/tileset.json",
          crs: demoCrs,
          style: {
            unsafeDepth: 8,
            shading: "hypsometric",
          },
          metadata: {
            description: "Replace the example URL with a real S-102 3D Tiles endpoint.",
          },
        }),
      );

      await terrain.controllers.terrain.setContours({ visible: true, intervalMeters: 5 });
      context.log("info", "Added S-102 terrain and configured contours through layer.controllers.");
    },
  },
  "s111-time": {
    id: "s111-time",
    label: "S-111 Time Scene",
    description: "Adds static S-111 current data and exercises the time controller.",
    requiredProducts: ["S-111"],
    requiredDataSources: ["static-json"],
    async apply(scene, context) {
      const firstStep = new Date("2026-05-29T12:00:00Z");
      const secondStep = new Date("2026-05-29T13:00:00Z");
      const currents = await scene.layers.add(
        LayerBuilder.createStaticS111({
          id: "demo-s111",
          title: "Demo S-111 currents",
          crs: demoCrs,
          data: {
            dateTimeOfFirstRecord: "20260529T120000Z",
            timeRecordInterval: 3600,
            numberOfTimes: 2,
            positions: [
              [331020, 5186380],
              [331150, 5186460],
              [331280, 5186540],
            ],
            data: [
              { speed: [0.35, 0.55, 0.42], direction: [75, 110, 145] },
              { speed: [0.5, 0.7, 0.63], direction: [95, 130, 160] },
            ],
          },
          time: {
            availability: [{ start: firstStep, end: secondStep }],
            interpolation: "nearest",
          },
          style: {
            renderer: "arrows",
            scale: "auto",
          },
        }),
      );

      scene.time.setCurrent(secondStep);
      currents.controllers.surfaceCurrent.setCurrentTime(secondStep);
      await currents.controllers.surfaceCurrent.setCustomScale(1.8);
      context.log("info", "Added S-111 currents and set scene time through product controllers.");
    },
  },
  vessel: {
    id: "vessel",
    label: "Vessel",
    description: "Adds a demo vessel layer and uses vessel controller handles.",
    requiredProducts: ["vessel"],
    requiredDataSources: ["model"],
    requiredVisualFeatures: ["vesselTransformGizmo"],
    async apply(scene, context) {
      const vessel = await scene.layers.add(
        LayerBuilder.createVessel({
          id: "demo-vessel",
          title: "Demo vessel",
          url: emptyVesselGltfUrl,
          format: "gltf",
          crs: demoCrs,
          pose: {
            position: demoLookAtTarget,
            headingDegrees: 35,
          },
          dimensions: {
            draught: 8,
            bow: 48,
            stern: 28,
            port: 10,
            starboard: 12,
          },
          referencePoint: "transponder",
          style: {
            showSeaLevelIndicator: true,
            transformControls: "translate-rotate",
            transformGizmo: {
              enabled: true,
              mode: "translate-rotate",
              sizeMeters: 25,
              verticalPositionLimits: { minMeters: -30, maxMeters: 12 },
            },
            oceanSurface: { enabled: true, radiusMeters: 120, opacity: 0.35 },
            shadow: { enabled: true, opacity: 0.2 },
          },
        }),
      );

      await vessel.controllers.vessel.setOceanSurfaceVisible(true);
      await vessel.controllers.vessel.setTransformMode("translate-rotate");
      context.log("info", "Added vessel and configured transform/ocean-surface controllers.");
    },
  },
  "map-overlay": {
    id: "map-overlay",
    label: "Map Overlay",
    description: "Adds a WMS map overlay through the generic map layer builder.",
    requiredProducts: ["map-overlay"],
    requiredDataSources: ["wms"],
    async apply(scene, context) {
      const map = await scene.layers.add(
        LayerBuilder.createMapOverlayWms({
          id: "demo-map-overlay",
          title: "Demo WMS overlay",
          url: "https://example.test/wms",
          layers: ["demo"],
          crs: demoCrs,
          opacity: 0.72,
          metadata: {
            description: "Replace the example URL with a real WMS endpoint.",
          },
        }),
      );

      await map.controllers.map.setAlpha(0.72);
      context.log("info", "Added WMS overlay and set opacity through map controllers.");
    },
  },
} satisfies Record<DemoRecipeId, DemoSceneRecipe>;

export const allSceneRecipes = Object.values(sceneRecipes);

export const getSceneRecipe = (id: string): DemoSceneRecipe => {
  if (
    id === "minimal" ||
    id === "s102-terrain" ||
    id === "s111-time" ||
    id === "vessel" ||
    id === "map-overlay"
  ) {
    return sceneRecipes[id];
  }

  return sceneRecipes.minimal;
};

export const assessRecipeSupport = (
  recipe: DemoSceneRecipe,
  capabilities: AdapterCapabilities,
): DemoRecipeSupport => {
  const reasons: string[] = [];

  for (const product of recipe.requiredProducts ?? []) {
    if (!capabilities.layerProducts.includes(product)) {
      reasons.push(`Missing layer product: ${product}`);
    }
  }

  for (const source of recipe.requiredDataSources ?? []) {
    if (!capabilities.dataSources.includes(source)) {
      reasons.push(`Missing data source: ${source}`);
    }
  }

  for (const feature of recipe.requiredVisualFeatures ?? []) {
    const value = capabilities.visualFeatures?.[feature];
    if (value !== true && (typeof value !== "object" || !value.supported)) {
      reasons.push(`Missing visual feature: ${feature}`);
    }
  }

  return {
    supported: reasons.length === 0,
    reasons,
  };
};
