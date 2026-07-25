import {
  createBoundingBox,
  createQuatIdentity,
  LayerBuilder,
  type AdapterCapabilities,
  type Coordinate,
  type S100Scene,
} from "@ecc/s100-viewer";
import {
  createPrimarS111Service,
  S111Workflow,
  type S111ProjectedBounds,
} from "@ecc/s100-viewer/products/s111";
import {
  createLiveVesselFeedLayer,
  createProjectedLiveAisPositionMapper,
  type LiveVesselFeedController,
  type LiveVesselFeedVesselState,
  type VesselDimensions,
} from "@ecc/s100-viewer/products/vessel";
import {
  getDemoLiveAisConfig,
  getDemoLiveAisS101Enabled,
  getDemoLiveAisS102DatasetIds,
  getDemoSceneSettings,
  getDemoLookAtTarget,
  getDemoServiceConfig,
  requireDemoServiceConfig,
  type DemoSceneSettings,
} from "./demoConfig";
import {
  fetchLiveAisVessels,
  inactiveLiveAisStatus,
  loadingLiveAisStatus,
  missingLiveAisConfigStatus,
  norwayLiveAisSceneBbox,
  norwayLiveAisSceneSettings,
  type LiveAisDemoStatus,
} from "./liveAisDemo";
import {
  appendWmsTemplateParameters,
  buildS101WmsUrlTemplate,
  buildS102TilesUrl,
} from "./serviceData";
import { demoVesselModelUrl } from "./staticAssets";

export type DemoRecipeId =
  | "minimal"
  | "s101-enc"
  | "s102-terrain"
  | "s111-time"
  | "vessel"
  | "live-ais";

export type DemoSceneRecipeContext = {
  engineId: string;
  container: HTMLElement;
  sceneSettings: DemoSceneSettings;
  log(level: "info" | "warn" | "error", message: string): void;
  registerCleanup(cleanup: () => void | Promise<void>): void;
  onLiveAisStatus?(status: LiveAisDemoStatus): void;
  onLiveAisSelection?(selection: LiveVesselFeedVesselState | null): void;
};

export type DemoSceneRecipe = {
  id: DemoRecipeId;
  label: string;
  description: string;
  requiredProducts?: readonly string[];
  requiredDataSources?: readonly string[];
  requiredVisualFeatures?: readonly (keyof NonNullable<AdapterCapabilities["visualFeatures"]>)[];
  sceneSettings?: DemoSceneSettings;
  initialCamera?: {
    target: Coordinate;
    rangeMeters: number;
    headingDegrees: number;
    pitchDegrees: number;
  };
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
const s111PlaybackTimestepsPerSecond = 10;

export const sceneRecipes = {
  minimal: {
    id: "minimal",
    label: "Minimal Scene",
    description: "Creates a projected-local scene with a service-backed S-101 ENC basemap.",
    requiredProducts: ["S-101"],
    requiredDataSources: ["wms"],
    async apply(scene, context) {
      await scene.layers.add(createS101BasemapLayer(context.sceneSettings));
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
      ], context.sceneSettings);
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
            safetyDepthMeters: 8,
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
      ], context.sceneSettings);
      const s111Endpoint = requireConfiguredValue(config.s111Endpoint, "s111Endpoint");
      const licenseeKey = requireConfiguredValue(config.licenseeKey, "licenseeKey");
      await addTransparentS101Overlay(scene, context);
      const workflowResult = await S111Workflow.prepare({
        datasets: config.s111DatasetIds.map((datasetId) => ({
          id: datasetId,
          title: `S-111 ${datasetId}`,
          bounds: {
            projected: demoProjectedBounds(config),
          },
        })),
        crs: config.crs,
        service: createPrimarS111Service({
          endpoint: s111Endpoint,
          licenseeKey,
        }),
        limits: {
          dataFetchConcurrency: 2,
        },
        time: {
          interpolation: "nearest",
        },
        style: {
          renderer: "arrows",
          scale: "auto",
        },
      });

      await S111Workflow.addPreparedLayers(scene, workflowResult.prepared);
      S111Workflow.configureSceneTime(scene, workflowResult.timeline, {
        play: true,
        loop: true,
        rate: s111PlaybackTimestepsPerSecond,
      });

      const failedDatasets = workflowResult.statuses.filter((status) => status.status === "error");
      for (const status of failedDatasets) {
        context.log("warn", `S-111 dataset ${status.datasetId} was not loaded: ${status.message}`);
      }

      if (workflowResult.timeline !== null) {
        context.log(
          "info",
          `Started loop playback at ${s111PlaybackTimestepsPerSecond} S-111 timesteps/s.`,
        );
      }

      context.log("info", `Fetched and added ${workflowResult.acceptedCount} S-111 dataset(s).`);
    },
  },
  vessel: {
    id: "vessel",
    label: "Vessel",
    description: "Adds a demo vessel layer over a transparent S-101 ENC overlay.",
    requiredProducts: ["vessel", "S-101"],
    requiredDataSources: ["model", "wms"],
    async apply(scene, context) {
      const showOceanSurface = context.engineId !== "cesium";
      const lookAtTarget = getDemoLookAtTarget(context.sceneSettings);
      await addTransparentS101Overlay(scene, context);
      const vessel = await scene.layers.add(
        LayerBuilder.createVessel({
          id: "demo-vessel",
          title: "Demo vessel",
          url: demoVesselModelUrl,
          format: "glb",
          crs: lookAtTarget.crs,
          pose: {
            position: lookAtTarget,
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
  "live-ais": {
    id: "live-ais",
    label: "Live AIS Norway",
    description: "Adds Stavanger S-102 terrain and renders BarentsWatch live AIS vessels through a proxy.",
    requiredProducts: ["vessel", "S-102"],
    requiredDataSources: ["3d-tiles"],
    sceneSettings: norwayLiveAisSceneSettings,
    initialCamera: {
      target: getDemoLookAtTarget(norwayLiveAisSceneSettings),
      rangeMeters: 12_000,
      headingDegrees: 20,
      pitchDegrees: 55,
    },
    async apply(scene, context) {
      const config = getDemoLiveAisConfig();
      context.onLiveAisStatus?.(config.proxyUrl
        ? inactiveLiveAisStatus(true)
        : missingLiveAisConfigStatus());

      if (getDemoLiveAisS101Enabled()) {
        await tryAddOptionalS101Basemap(scene, context);
      } else {
        context.log("info", "Live AIS S-101 basemap skipped by default to keep S-102 terrain visible.");
      }
      await tryAddLiveAisS102Terrain(scene, context);

      if (!config.proxyUrl) {
        context.log("warn", "Live AIS proxy is not configured. Set VITE_AIS_PROXY_URL to enable this scene.");
        return;
      }

      const feed = await createLiveVesselFeedLayer({
        scene,
        id: "demo-live-ais",
        stalePolicy: {
          removeMissing: true,
          ...(config.maxAgeSeconds !== undefined ? { maxAgeSeconds: config.maxAgeSeconds } : {}),
        },
        style: {
          style: {
            opacity: 0.92,
            showSeaLevelIndicator: true,
            showOceanSurface: false,
            oceanSurface: false,
            shadow: {
              enabled: true,
              mode: "shared-texture",
              opacity: 0.34,
            },
          },
          selectedStyle: {
            opacity: 1,
          },
        },
        positionMapper: createProjectedLiveAisPositionMapper({
          crs: context.sceneSettings.crs,
        }),
      });
      const selection = registerLiveAisSelection({
        scene,
        feed,
        context,
      });
      registerLiveAisPolling({
        feed,
        config,
        context,
        onAfterUpdate: selection.refresh,
      });
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
    id === "vessel" ||
    id === "live-ais"
  ) {
    return sceneRecipes[id];
  }

  return sceneRecipes.minimal;
};

const createS101BasemapLayer = (settings: DemoSceneSettings = getDemoSceneSettings()) => {
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

const demoProjectedBounds = (config: ReturnType<typeof requireDemoServiceConfig>): S111ProjectedBounds => {
  const halfWidth = config.mapWidthMeters / 2;
  return {
    west: config.origin.x - halfWidth,
    east: config.origin.x + halfWidth,
    south: config.origin.y - halfWidth,
    north: config.origin.y + halfWidth,
  };
};

const requireConfiguredValue = (value: string | undefined, label: string): string => {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
};

const addTransparentS101Overlay = async (
  scene: S100Scene,
  context: DemoSceneRecipeContext,
): Promise<void> => {
  await scene.layers.add(createTransparentS101OverlayLayer(context.sceneSettings));
  context.log("info", "Added transparent S-101 ENC overlay.");
};

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

const tryAddOptionalS101Basemap = async (
  scene: S100Scene,
  context: DemoSceneRecipeContext,
): Promise<void> => {
  const config = getDemoServiceConfig(context.sceneSettings);
  if (!config.licenseeKey || !config.s101WmsBaseUrl) {
    context.log("warn", "Optional S-101 basemap skipped for live AIS scene; WMS config is incomplete.");
    return;
  }

  await scene.layers.add(createS101BasemapLayer(context.sceneSettings));
  context.log("info", "Added optional S-101 basemap for live AIS scene.");
};

const tryAddLiveAisS102Terrain = async (
  scene: S100Scene,
  context: DemoSceneRecipeContext,
): Promise<void> => {
  const datasetIds = getDemoLiveAisS102DatasetIds();
  const baseConfig = getDemoServiceConfig(context.sceneSettings);
  if (!baseConfig.primarApiKey || !baseConfig.s102TilesEndpoint || datasetIds.length === 0) {
    context.log("warn", "Live AIS S-102 terrain skipped; S-102 endpoint, API key, or dataset ids are incomplete.");
    return;
  }

  const config = {
    ...baseConfig,
    s102DatasetIds: datasetIds,
  };
  const datasetLabel = datasetIds.join(",");
  const terrain = await scene.layers.add(
    LayerBuilder.createS102({
      id: "demo-live-ais-s102-terrain",
      title: "Stavanger S-102 bathymetry",
      url: buildS102TilesUrl(config),
      crs: config.crs,
      query: { crs: config.crs },
      rendering: {
        detailFactor: 500,
      },
      style: {
        safetyDepthMeters: 10,
        shading: "hypsometric",
      },
      metadata: {
        datasetId: datasetLabel,
        description: "Stavanger S-102 terrain used by the Live AIS Norway demo scene.",
      },
    }),
  );
  await terrain.controllers.terrain.setContours({ visible: true, intervalMeters: 5 });
  context.log("info", `Added Stavanger S-102 terrain datasets: ${datasetLabel}.`);
};

const registerLiveAisPolling = (options: {
  feed: LiveVesselFeedController;
  config: ReturnType<typeof getDemoLiveAisConfig>;
  context: DemoSceneRecipeContext;
  onAfterUpdate?: () => void;
}): void => {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;
  let refreshSequence = 0;

  const stopTimer = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (): void => {
    stopTimer();
    if (disposed) {
      return;
    }
    timer = setTimeout(() => {
      void refresh();
    }, options.config.refreshIntervalMs);
  };

  const refresh = async (): Promise<void> => {
    abortController?.abort();
    const currentAbortController = new AbortController();
    abortController = currentAbortController;
    const refreshId = ++refreshSequence;
    options.context.onLiveAisStatus?.(loadingLiveAisStatus());

    try {
      const result = await fetchLiveAisVessels({
        config: options.config,
        bbox: norwayLiveAisSceneBbox,
        signal: currentAbortController.signal,
      });
      if (disposed || refreshId !== refreshSequence || currentAbortController.signal.aborted) {
        return;
      }

      await options.feed.updateVessels(result.vessels);
      options.onAfterUpdate?.();
      options.context.onLiveAisStatus?.({
        state: result.sceneIntersectsCoverage ? "ready" : "outside-coverage",
        configured: true,
        message: result.sceneIntersectsCoverage
          ? "Live AIS vessels loaded."
          : "Scene is outside BarentsWatch open-AIS coverage.",
        vesselCount: result.vessels.length,
        latestFetchTime: result.generatedAt,
        upstreamFetchedAt: result.upstreamFetchedAt,
        servedFromWarmCache: result.servedFromWarmCache,
        sceneIntersectsCoverage: result.sceneIntersectsCoverage,
        warnings: result.warnings,
      });
      options.context.log("info", `Loaded ${result.vessels.length} live AIS vessel(s).`);
    } catch (error) {
      if (isAbortError(error) || disposed) {
        return;
      }
      await options.feed.clear();
      options.context.onLiveAisStatus?.({
        state: "error",
        configured: true,
        message: errorMessage(error),
      });
      options.context.log("error", `Live AIS refresh failed: ${errorMessage(error)}`);
    } finally {
      if (abortController === currentAbortController) {
        abortController = null;
      }
      schedule();
    }
  };

  options.context.registerCleanup(async () => {
    disposed = true;
    stopTimer();
    abortController?.abort();
    await options.feed.dispose();
  });

  void refresh();
};

const registerLiveAisSelection = (options: {
  scene: S100Scene;
  feed: LiveVesselFeedController;
  context: DemoSceneRecipeContext;
}): { refresh(): void } => {
  let disposed = false;
  let selectedMmsi: number | null = null;
  let selectionSequence = 0;

  const emitSelection = (): void => {
    const selected = selectedMmsi !== null
      ? options.feed.getVessel(selectedMmsi) ?? null
      : null;
    options.context.onLiveAisSelection?.(selected);
  };

  const selectMmsi = async (mmsi: number | null): Promise<void> => {
    const selectionId = ++selectionSequence;
    selectedMmsi = mmsi;
    await options.feed.selectVessel(mmsi);
    if (disposed || selectionId !== selectionSequence) {
      return;
    }
    emitSelection();
  };

  const handleClick = (event: MouseEvent): void => {
    void (async () => {
      const pick = await options.scene.picking.pick({
        screenX: event.clientX,
        screenY: event.clientY,
        includeNative: false,
      });
      if (disposed) {
        return;
      }
      await selectMmsi(liveAisMmsiFromLayerId(pick?.layerId ?? pick?.featureId));
    })();
  };

  options.context.container.addEventListener("click", handleClick);
  options.context.onLiveAisSelection?.(null);
  options.context.registerCleanup(async () => {
    disposed = true;
    selectionSequence += 1;
    options.context.container.removeEventListener("click", handleClick);
    await options.feed.selectVessel(null);
    options.context.onLiveAisSelection?.(null);
  });

  return {
    refresh: emitSelection,
  };
};

const liveAisMmsiFromLayerId = (layerId: string | undefined): number | null => {
  const match = /^demo-live-ais-(\d+)$/.exec(layerId ?? "");
  if (!match) {
    return null;
  }
  const mmsi = Number(match[1]);
  return Number.isSafeInteger(mmsi) ? mmsi : null;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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
