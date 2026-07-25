import {
  CameraControlPresets,
  SceneBuilder,
  createS100Viewer,
  type EngineCameraPose,
  type LoggerLike,
  type S100EngineAdapter,
  type S100Scene,
  type S100Unsubscribe,
  type S100Viewer,
} from "@ecc/s100-viewer";
import type { LiveVesselFeedVesselState } from "@ecc/s100-viewer/products/vessel";
import type { DemoEngineDefinition } from "./engineRegistry";
import {
  getDemoLookAtTarget,
  getDemoSceneSettings,
} from "./demoConfig";
import {
  assessRecipeSupport,
  type DemoRecipeSupport,
  type DemoSceneRecipeContext,
  type DemoSceneRecipe,
} from "./sceneRecipes";
import type { LiveAisDemoStatus } from "./liveAisDemo";
import { loadDemoEnvironment } from "./staticAssets";

export type DemoLogLevel = "info" | "warn" | "error";

export type DemoLogSink = (level: DemoLogLevel, message: string) => void;

export type ViewerSession = {
  adapter: S100EngineAdapter;
  viewer: S100Viewer;
  scene: S100Scene;
  recipeSupport: DemoRecipeSupport;
  destroy(): Promise<void>;
};

export type CreateViewerSessionOptions = {
  container: HTMLElement;
  engine: DemoEngineDefinition;
  recipe: DemoSceneRecipe;
  log: DemoLogSink;
  onCameraPose(pose: EngineCameraPose): void;
  onLiveAisStatus?(status: LiveAisDemoStatus): void;
  onLiveAisSelection?(selection: LiveVesselFeedVesselState | null): void;
};

export const createViewerSession = async (
  options: CreateViewerSessionOptions,
): Promise<ViewerSession> => {
  const logger = loggerFromSink(options.log);
  options.log("info", `Loading ${options.engine.label} adapter.`);
  const adapter = await options.engine.load(logger);
  const recipeSupport = assessRecipeSupport(options.recipe, adapter.capabilities);
  const sceneSettings = options.recipe.sceneSettings ?? getDemoSceneSettings();
  const cleanupCallbacks: Array<() => void | Promise<void>> = [];

  if (!recipeSupport.supported) {
    throw new Error(`Recipe is not supported by ${adapter.displayName}: ${recipeSupport.reasons.join("; ")}`);
  }

  const viewer = await createS100Viewer({
    container: options.container,
    adapter,
    logger,
    cameraControls: CameraControlPresets.S100_DEFAULT,
    metadata: {
      app: "@ecc/s100-engine-adapter-switcher",
      recipe: options.recipe.id,
    },
  });

  const scene = await viewer.createScene({
    georeference: SceneBuilder.projectedLocal({
      crs: sceneSettings.crs,
      origin: sceneSettings.origin,
    }),
    metadata: {
      recipe: options.recipe.id,
    },
  });

  const unsubscribers: S100Unsubscribe[] = [
    scene.camera.onChanged(options.onCameraPose),
    scene.events.on("error", (error) => {
      options.log("error", error.message);
    }),
    scene.events.on("layer.added", (layer) => {
      options.log("info", `Layer added: ${layer.id} (${layer.product})`);
    }),
    scene.events.on("layer.updated", (layer) => {
      options.log("info", `Layer updated: ${layer.id}`);
    }),
    scene.events.on("layer.removed", ({ id }) => {
      options.log("info", `Layer removed: ${id}`);
    }),
  ];

  try {
    scene.environment.setState(await loadDemoEnvironment(options.engine.id));
    options.log("info", "Applied static demo environment.");
  } catch (error) {
    options.log("warn", `Environment setup skipped: ${errorMessage(error)}`);
  }

  const recipeContext: DemoSceneRecipeContext = {
    engineId: options.engine.id,
    container: options.container,
    sceneSettings,
    log: options.log,
    registerCleanup(cleanup) {
      cleanupCallbacks.push(cleanup);
    },
  };
  if (options.onLiveAisStatus !== undefined) {
    recipeContext.onLiveAisStatus = options.onLiveAisStatus;
  }
  if (options.onLiveAisSelection !== undefined) {
    recipeContext.onLiveAisSelection = options.onLiveAisSelection;
  }

  await options.recipe.apply(scene, recipeContext);

  try {
    const initialCamera = options.recipe.initialCamera ?? {
      target: getDemoLookAtTarget(sceneSettings),
      rangeMeters: 900,
      headingDegrees: 25,
      pitchDegrees: 62,
    };
    scene.camera.lookAt(initialCamera);
    options.onCameraPose(scene.camera.getPose());
  } catch (error) {
    options.log("warn", `Camera look-at skipped: ${errorMessage(error)}`);
  }

  return {
    adapter,
    viewer,
    scene,
    recipeSupport,
    async destroy() {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      for (const cleanup of cleanupCallbacks.splice(0).reverse()) {
        await cleanup();
      }
      await viewer.destroy();
    },
  };
};

export const destroyViewerSession = async (session: ViewerSession | null): Promise<void> => {
  if (!session) {
    return;
  }

  await session.destroy();
};

const loggerFromSink = (log: DemoLogSink): LoggerLike => ({
  debug: (...args) => log("info", args.map(String).join(" ")),
  info: (...args) => log("info", args.map(String).join(" ")),
  warn: (...args) => log("warn", args.map(String).join(" ")),
  error: (...args) => log("error", args.map(String).join(" ")),
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
