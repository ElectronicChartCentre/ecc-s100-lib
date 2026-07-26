import {
  type Coordinate,
  type S100Scene,
} from "@ecc/s100-viewer";
import {
  createFixtureS104Service,
  S104Workflow,
  type S104Catalog,
  type S104CatalogDataset,
  type S104WorkflowDataset,
  type S104WorkflowTimeline,
} from "@ecc/s100-viewer/products/s104";
import {
  getDemoLookAtTarget,
  getDemoS104FixtureConfig,
  stavangerDemoSceneSettings,
  type DemoS104FixtureConfig,
  type DemoSceneSettings,
} from "./demoConfig";
import {
  addDemoVesselLayer,
  addTransparentS101Overlay,
  errorMessage,
  tryAddStavangerS102Terrain,
} from "./sceneRecipeShared";
import {
  registerS104DemoBinding,
  unregisterS104DemoBinding,
  type S104DemoSamplePoint,
} from "./s104Demo";
import type {
  DemoSceneRecipe,
  DemoSceneRecipeContext,
} from "./sceneRecipes";

export const s104WaterLevelRecipe: DemoSceneRecipe = {
  id: "s104-water-level",
  label: "S-104 Water Level",
  description: "Loads generated Stavanger S-104 fixture data with S-102 terrain, S-101 overlay, and a demo vessel.",
  requiredProducts: ["S-102", "S-101", "vessel"],
  requiredDataSources: ["3d-tiles", "wms", "model"],
  requiredWaterLevelField: "sampled",
  sceneSettings: stavangerDemoSceneSettings,
  initialCamera: {
    target: getDemoLookAtTarget(stavangerDemoSceneSettings),
    rangeMeters: 3_800,
    headingDegrees: 28,
    pitchDegrees: 58,
  },
  async apply(scene, context) {
    const fixtureConfig = getDemoS104FixtureConfig();
    const service = createFixtureS104Service({
      endpoint: fixtureConfig.serviceUrl,
    });
    const dataset = await loadS104FixtureDataset(service, fixtureConfig, context);
    const workflowResult = await S104Workflow.prepare({
      datasets: [dataset],
      crs: context.sceneSettings.crs,
      service,
      limits: {
        maxDataPoints: fixtureConfig.maxDataPoints,
        metadataFetchConcurrency: 1,
        dataFetchConcurrency: 1,
      },
    });

    for (const status of workflowResult.statuses) {
      if (status.status === "error") {
        context.log("warn", `S-104 dataset ${status.datasetId} was not loaded: ${status.message}`);
      }
    }
    if (workflowResult.acceptedCount === 0) {
      throw new Error(
        `S-104 fixture dataset '${fixtureConfig.datasetId}' could not be prepared. Start npm run demo:s104-fixture-service and verify VITE_S104_FIXTURE_SERVICE_URL.`,
      );
    }

    configureS104SceneTime(scene, workflowResult.timeline);
    scene.waterLevel.setSampler(workflowResult.sampler);
    await addTransparentS101Overlay(scene, context);
    await tryAddStavangerS102Terrain(scene, context, {
      id: "demo-s104-s102-terrain",
      title: "Stavanger S-102 bathymetry",
      description: "Stavanger S-102 terrain used by the S-104 water-level fixture scene.",
      safetyDepthMeters: 10,
    });
    const vessel = await addDemoVesselLayer(scene, context, {
      id: "demo-s104-vessel",
      title: "S-104 demo vessel",
      headingDegrees: 35,
      showOceanSurface: context.engineId !== "cesium",
    });

    const prepared = workflowResult.prepared[0];
    registerS104DemoBinding(scene, {
      datasetId: prepared?.datasetId ?? fixtureConfig.datasetId,
      ...(prepared?.title !== undefined ? { datasetTitle: prepared.title } : {}),
      sampler: workflowResult.sampler,
      timeline: workflowResult.timeline,
      observedGrid: workflowResult.observedGrid,
      samplePoints: createS104DemoSamplePoints(context.sceneSettings),
      getVesselCoordinate: () => vessel.controllers.vessel.getPosition(),
    });
    context.registerCleanup(() => {
      if (scene.waterLevel.getSampler() === workflowResult.sampler) {
        scene.waterLevel.setSampler(null);
      }
      unregisterS104DemoBinding(scene);
    });

    context.log(
      "info",
      `Prepared ${workflowResult.acceptedCount} S-104 fixture dataset(s) from ${fixtureConfig.serviceUrl}.`,
    );
  },
};

const loadS104FixtureDataset = async (
  service: ReturnType<typeof createFixtureS104Service>,
  config: DemoS104FixtureConfig,
  context: DemoSceneRecipeContext,
): Promise<S104WorkflowDataset> => {
  try {
    const catalog = service.fetchCatalog
      ? await service.fetchCatalog({})
      : null;
    if (isS104Catalog(catalog)) {
      const dataset = catalog.datasets.find((item) => item.id === config.datasetId);
      if (dataset) {
        return catalogDatasetToWorkflowDataset(dataset);
      }
      context.log(
        "warn",
        `S-104 fixture catalog does not list '${config.datasetId}'. The demo will try the configured id directly.`,
      );
    }
  } catch (error) {
    context.log("warn", `S-104 fixture catalog could not be loaded: ${errorMessage(error)}`);
  }

  return {
    id: config.datasetId,
    title: config.datasetId,
  };
};

const catalogDatasetToWorkflowDataset = (
  dataset: S104CatalogDataset,
): S104WorkflowDataset => ({
  id: dataset.id,
  ...(dataset.title !== undefined ? { title: dataset.title } : {}),
  ...(dataset.bounds !== undefined ? { bounds: dataset.bounds } : {}),
});

const isS104Catalog = (value: unknown): value is S104Catalog =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as { datasets?: unknown }).datasets);

const configureS104SceneTime = (
  scene: S100Scene,
  timeline: S104WorkflowTimeline | null,
): void => {
  if (!timeline) {
    return;
  }

  scene.time.setAvailability({
    start: new Date(timeline.startTime),
    end: new Date(timeline.endTime),
  });
  scene.time.setCurrent(new Date(timeline.initialTime));
};

const createS104DemoSamplePoints = (
  settings: DemoSceneSettings,
): readonly S104DemoSamplePoint[] => {
  const offset = settings.mapWidthMeters * 0.25;
  return [
    {
      id: "center",
      label: "Center",
      coordinate: projectedCoordinate(settings, 0, 0),
    },
    {
      id: "north-east",
      label: "North-east",
      coordinate: projectedCoordinate(settings, offset, offset),
    },
    {
      id: "south-west",
      label: "South-west",
      coordinate: projectedCoordinate(settings, -offset, -offset),
    },
  ];
};

const projectedCoordinate = (
  settings: DemoSceneSettings,
  dx: number,
  dy: number,
): Coordinate => ({
  kind: "projected",
  crs: settings.crs,
  x: settings.origin.x + dx,
  y: settings.origin.y + dy,
  z: settings.origin.z,
});
