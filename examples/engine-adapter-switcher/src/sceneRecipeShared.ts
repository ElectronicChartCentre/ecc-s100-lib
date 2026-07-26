import {
  createBoundingBox,
  createQuatIdentity,
  LayerBuilder,
  type S100Scene,
} from "@ecc/s100-viewer";
import {
  type VesselLayer,
  type VesselDimensions,
} from "@ecc/s100-viewer/products/vessel";
import {
  getDemoSceneSettings,
  getDemoLookAtTarget,
  getDemoServiceConfig,
  getDemoStavangerS102DatasetIds,
  requireDemoServiceConfig,
  type DemoSceneSettings,
} from "./demoConfig";
import {
  appendWmsTemplateParameters,
  buildS101WmsUrlTemplate,
  buildS102TilesUrl,
} from "./serviceData";
import { demoVesselModelUrl } from "./staticAssets";

type RecipeContextLike = {
  engineId: string;
  sceneSettings: DemoSceneSettings;
  log(level: "info" | "warn" | "error", message: string): void;
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

export const requireConfiguredValue = (
  value: string | undefined,
  label: string,
): string => {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
};

export const createS101BasemapLayer = (
  settings: DemoSceneSettings = getDemoSceneSettings(),
) => {
  const config = requireDemoServiceConfig([
    "licenseeKey",
    "s101WmsBaseUrl",
  ], settings);
  const urlTemplate = buildS101WmsUrlTemplate(config, {
    imageSizePixels: demoEncWmsImageSizePixels,
    styleId: config.s101WmsBasemapStyleId,
    transparent: false,
  });
  const projectedMap = LayerBuilder.ProjectedMap.fromCenterExtent({
    center: {
      x: config.origin.x,
      y: config.origin.y,
      crs: config.crs,
    },
    widthMeters: config.mapWidthMeters,
    heightMeters: config.mapWidthMeters,
    crs: config.crs,
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

export const addTransparentS101Overlay = async (
  scene: S100Scene,
  context: RecipeContextLike,
): Promise<void> => {
  await scene.layers.add(createTransparentS101OverlayLayer(context.sceneSettings));
  context.log("info", "Added transparent S-101 ENC overlay.");
};

export const tryAddOptionalS101Basemap = async (
  scene: S100Scene,
  context: RecipeContextLike,
): Promise<void> => {
  const config = getDemoServiceConfig(context.sceneSettings);
  if (!config.licenseeKey || !config.s101WmsBaseUrl) {
    context.log("warn", "Optional S-101 basemap skipped for live AIS scene; WMS config is incomplete.");
    return;
  }

  await scene.layers.add(createS101BasemapLayer(context.sceneSettings));
  context.log("info", "Added optional S-101 basemap for live AIS scene.");
};

export const tryAddStavangerS102Terrain = async (
  scene: S100Scene,
  context: RecipeContextLike,
  options: {
    id: string;
    title: string;
    description: string;
    safetyDepthMeters: number;
    datasetIds?: readonly string[];
  },
): Promise<void> => {
  const datasetIds = options.datasetIds ?? getDemoStavangerS102DatasetIds();
  const baseConfig = getDemoServiceConfig(context.sceneSettings);
  if (!baseConfig.primarApiKey || !baseConfig.s102TilesEndpoint || datasetIds.length === 0) {
    context.log("warn", `${options.title} skipped; S-102 endpoint, API key, or dataset ids are incomplete.`);
    return;
  }

  const config = {
    ...baseConfig,
    s102DatasetIds: datasetIds,
  };
  const datasetLabel = datasetIds.join(",");
  const terrain = await scene.layers.add(
    LayerBuilder.createS102({
      id: options.id,
      title: options.title,
      url: buildS102TilesUrl(config),
      crs: config.crs,
      query: { crs: config.crs },
      rendering: {
        detailFactor: 500,
      },
      style: {
        safetyDepthMeters: options.safetyDepthMeters,
        shading: "hypsometric",
      },
      metadata: {
        datasetId: datasetLabel,
        description: options.description,
      },
    }),
  );
  await terrain.controllers.terrain.setContours({ visible: true, intervalMeters: 5 });
  context.log("info", `Added Stavanger S-102 terrain datasets: ${datasetLabel}.`);
};

export const addDemoVesselLayer = async (
  scene: S100Scene,
  context: RecipeContextLike,
  options: {
    id: string;
    title: string;
    headingDegrees: number;
    showOceanSurface: boolean;
  },
): Promise<VesselLayer> => {
  const lookAtTarget = getDemoLookAtTarget(context.sceneSettings);
  const vessel = await scene.layers.add(
    LayerBuilder.createVessel({
      id: options.id,
      title: options.title,
      url: demoVesselModelUrl,
      format: "glb",
      crs: lookAtTarget.crs,
      pose: {
        position: lookAtTarget,
        headingDegrees: options.headingDegrees,
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
        oceanSurface: { enabled: options.showOceanSurface, radiusMeters: 260, opacity: 0.35 },
        shadow: { enabled: true, opacity: 0.2 },
      },
    }),
  );

  await vessel.controllers.vessel.setOceanSurfaceVisible(options.showOceanSurface);
  await vessel.controllers.vessel.setTransformMode("translate-rotate");
  context.log("info", "Added vessel and configured transform/ocean-surface controllers.");
  return vessel;
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const createTransparentS101OverlayLayer = (settings?: DemoSceneSettings) => {
  const config = requireDemoServiceConfig([
    "licenseeKey",
    "s101WmsBaseUrl",
  ], settings);
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
