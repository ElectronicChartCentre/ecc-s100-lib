import {
  createBoundingBox,
  createQuatIdentity,
  LayerBuilder,
  type AdapterCapabilities,
  type S100Scene,
  type VesselDimensions,
} from "@ecc/s100-viewer";
import {
  getDemoSceneSettings,
  getDemoLookAtTarget,
  requireDemoServiceConfig,
} from "./demoConfig";
import {
  appendWmsTemplateParameters,
  buildS101WmsUrlTemplate,
  buildS102TilesUrl,
  fetchS111Dataset,
} from "./serviceData";
import { demoVesselModelUrl } from "./staticAssets";

export type DemoRecipeId = "minimal" | "s101-enc" | "s102-terrain" | "s111-time" | "vessel";

export type DemoSceneRecipeContext = {
  engineId: string;
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

const demoVesselDimensions: VesselDimensions = {
  draught: 12,
  bow: 195.2,
  stern: 30,
  port: 20.8,
  starboard: 11.2,
};

const demoVesselBoundingBox = createBoundingBox(
  [-demoVesselDimensions.port, -demoVesselDimensions.stern, -40.2],
  [demoVesselDimensions.starboard, demoVesselDimensions.bow, 6.4],
);

const demoEncMapMinLevel = 3;
const demoEncMapMaxLevel = 5;
const demoEncMapQuality = 2;
const demoEncMapScale = 1;
const demoEncWmsImageSizePixels = 2048;

export const sceneRecipes = {
  minimal: {
    id: "minimal",
    label: "Minimal Scene",
    description: "Creates a projected-local scene with a service-backed S-101 ENC basemap.",
    requiredProducts: ["S-101"],
    requiredDataSources: ["wms"],
    async apply(scene, context) {
      await scene.layers.add(createS101BasemapLayer());
      context.log("info", "Added S-101 ENC WMS basemap for the projected-local scene.");
    },
  },
  "s101-enc": {
    id: "s101-enc",
    label: "S-101 ENC",
    description: "Adds a service-backed S-101 WMS layer using Explorer-compatible PRIMAR settings.",
    requiredProducts: ["S-101"],
    requiredDataSources: ["wms"],
    async apply(scene, context) {
      await addTransparentS101Overlay(scene, context);
    },
  },
  "s102-terrain": {
    id: "s102-terrain",
    label: "S-102 Terrain",
    description: "Adds service-backed S-102 3D Tiles terrain with a transparent S-101 ENC overlay.",
    requiredProducts: ["S-102", "S-101"],
    requiredDataSources: ["3d-tiles", "wms"],
    async apply(scene, context) {
      const config = requireDemoServiceConfig([
        "primarApiKey",
        "s102TilesEndpoint",
        "s102DatasetIds",
      ]);
      await addTransparentS101Overlay(scene, context);
      const datasetLabel = config.s102DatasetIds.join(",");
      const terrain = await scene.layers.add(
        LayerBuilder.createS102({
          id: datasetLabel,
          title: "Demo S-102 bathymetry",
          url: buildS102TilesUrl(config),
          crs: config.crs,
          query: { crs: config.crs },
          rendering: {
            detailFactor: 500,
          },
          style: {
            unsafeDepth: 8,
            shading: "hypsometric",
          },
          metadata: {
            datasetId: datasetLabel,
            description: "Service-backed S-102 3D Tiles dataset.",
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
    description: "Fetches S-111 data and adds a transparent S-101 ENC overlay.",
    requiredProducts: ["S-111", "S-101"],
    requiredDataSources: ["static-json", "wms"],
    async apply(scene, context) {
      const config = requireDemoServiceConfig([
        "licenseeKey",
        "s111Endpoint",
        "s111DatasetIds",
      ]);
      await addTransparentS101Overlay(scene, context);
      let initialTime: number | null = null;

      for (const datasetId of config.s111DatasetIds) {
        const fetched = await fetchS111Dataset(config, datasetId);
        const prepared = LayerBuilder.prepareStaticS111({
          id: datasetId,
          title: `S-111 ${datasetId}`,
          crs: config.crs,
          data: fetched.data,
          sourceMetadata: {
            id: datasetId,
            title: `S-111 ${datasetId}`,
            values: {
              metadata: fetched.metadata,
            },
          },
          time: {
            interpolation: "nearest",
          },
          style: {
            renderer: "arrows",
            scale: "auto",
          },
        });
        const currents = await scene.layers.add(prepared.layer);
        await currents.controllers.surfaceCurrent.setAutoScaling(true);

        if (initialTime === null && prepared.timeline.times.length > 0) {
          initialTime = prepared.timeline.times[0] ?? null;
        }
      }

      if (initialTime !== null) {
        const current = new Date(initialTime);
        scene.time.setCurrent(current);
        for (const layer of scene.layers.all()) {
          layer.controllers.surfaceCurrent?.setCurrentTime(current);
        }
      }

      context.log("info", `Fetched and added ${config.s111DatasetIds.length} S-111 dataset(s).`);
    },
  },
  vessel: {
    id: "vessel",
    label: "Vessel",
    description: "Adds a demo vessel layer over a transparent S-101 ENC overlay.",
    requiredProducts: ["vessel", "S-101"],
    requiredDataSources: ["model", "wms"],
    requiredVisualFeatures: ["vesselTransformGizmo"],
    async apply(scene, context) {
      const showOceanSurface = context.engineId !== "cesium";
      await addTransparentS101Overlay(scene, context);
      const vessel = await scene.layers.add(
        LayerBuilder.createVessel({
          id: "demo-vessel",
          title: "Demo vessel",
          url: demoVesselModelUrl,
          format: "glb",
          crs: getDemoLookAtTarget().crs,
          pose: {
            position: getDemoLookAtTarget(),
            headingDegrees: 35,
          },
          dimensions: demoVesselDimensions,
          model: {
            boundingBox: demoVesselBoundingBox,
            orientation: createQuatIdentity(),
          },
          referencePoint: "transponder",
          style: {
            draughtMeters: demoVesselDimensions.draught,
            showSeaLevelIndicator: true,
            transformControls: "translate-rotate",
            transformGizmo: {
              enabled: true,
              mode: "translate-rotate",
              sizeMeters: 45,
              verticalPositionLimits: { minMeters: -30, maxMeters: 12 },
            },
            oceanSurface: { enabled: showOceanSurface, radiusMeters: 260, opacity: 0.35 },
            shadow: { enabled: true, opacity: 0.2 },
          },
        }),
      );

      await vessel.controllers.vessel.setOceanSurfaceVisible(showOceanSurface);
      await vessel.controllers.vessel.setTransformMode("translate-rotate");
      context.log("info", "Added vessel and configured transform/ocean-surface controllers.");
    },
  },
} satisfies Record<DemoRecipeId, DemoSceneRecipe>;

export const allSceneRecipes = Object.values(sceneRecipes);

export const getSceneRecipe = (id: string): DemoSceneRecipe => {
  if (
    id === "minimal" ||
    id === "s101-enc" ||
    id === "s102-terrain" ||
    id === "s111-time" ||
    id === "vessel"
  ) {
    return sceneRecipes[id];
  }

  return sceneRecipes.minimal;
};

const createS101BasemapLayer = () => {
  const settings = getDemoSceneSettings();
  const config = requireDemoServiceConfig([
    "licenseeKey",
    "s101WmsBaseUrl",
  ]);
  const urlTemplate = buildS101WmsUrlTemplate(config, {
    imageSizePixels: demoEncWmsImageSizePixels,
    styleId: config.s101WmsBasemapStyleId,
    transparent: false,
  });
  const projectedMap = LayerBuilder.ProjectedMap.fromCenterExtent({
    center: {
      x: settings.origin.x,
      y: settings.origin.y,
      crs: settings.crs,
    },
    widthMeters: settings.mapWidthMeters,
    heightMeters: settings.mapWidthMeters,
    crs: settings.crs,
    minLevel: demoEncMapMinLevel,
    maxLevel: demoEncMapMaxLevel,
    quality: demoEncMapQuality,
    scale: demoEncMapScale,
    discardMode: LayerBuilder.ProjectedMapDiscardMode.None,
  });

  return LayerBuilder.createS101WmsTemplate({
    id: "demo-s101-basemap",
    title: "S-101 ENC basemap",
    urlTemplate,
    layers: config.s101WmsLayers,
    role: "basemap",
    ...projectedMap,
    style: {
      visible: true,
      opacity: 1,
      cutout: {
        enabled: false,
      },
    },
    metadata: {
      description: "Service-backed S-101 WMS basemap for the current projected-local scene.",
    },
  });
};

const addTransparentS101Overlay = async (
  scene: S100Scene,
  context: DemoSceneRecipeContext,
): Promise<void> => {
  await scene.layers.add(createTransparentS101OverlayLayer());
  context.log("info", "Added transparent S-101 ENC overlay.");
};

const createTransparentS101OverlayLayer = () => {
  const config = requireDemoServiceConfig([
    "licenseeKey",
    "s101WmsBaseUrl",
  ]);
  const baseTemplate = buildS101WmsUrlTemplate(config, {
    imageSizePixels: demoEncWmsImageSizePixels,
    styleId: config.s101WmsStyleId,
    transparent: true,
  });
  const transparentTemplate = appendWmsTemplateParameters(baseTemplate, [
    ["IGNORE", "DepthArea,DepthContour,DredgedArea"],
    ["HIDE", "90010,90020"],
  ]);

  const mapPair = LayerBuilder.createEncWmsPair({
    standard: LayerBuilder.EncStandard.S101,
    center: {
      x: config.origin.x,
      y: config.origin.y,
      crs: config.crs,
    },
    widthMeters: config.mapWidthMeters,
    crs: config.crs,
    minLevel: demoEncMapMinLevel,
    maxLevel: demoEncMapMaxLevel,
    quality: demoEncMapQuality,
    discardMode: LayerBuilder.ProjectedMapDiscardMode.None,
    transparent: {
      id: "demo-s101-enc",
      urlTemplate: transparentTemplate,
      layers: config.s101WmsLayers,
      role: "overlay",
      visible: true,
      opacity: 1,
      style: {
        alphaMode: "binary",
        alphaCutoff: 0.01,
      },
      scale: demoEncMapScale,
    },
  });

  return mapPair.transparent;
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
