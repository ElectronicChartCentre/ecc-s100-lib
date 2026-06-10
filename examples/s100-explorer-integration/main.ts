import {
  createS100Viewer,
  SceneBuilder,
  type S100EngineAdapter,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

type ViewerEngineId = "nasa-ammos";

const adapters: Record<ViewerEngineId, () => S100EngineAdapter> = {
  "nasa-ammos": () =>
    createNasaAmmosAdapter({
      environmentMapURL:
        "/textures/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr",
      showEnvironmentBackground: true,
      backgroundIntensity: 1,
      environmentIntensity: 0.2025,
      ambientLightIntensity: 0.06,
      directionalLightIntensity: 0.108,
    }),
};

export async function createScenarioViewer(options: {
  container: HTMLElement;
  engine: ViewerEngineId;
  crs: string;
  origin: { x: number; y: number; z?: number };
}) {
  const viewer = await createS100Viewer({
    container: options.container,
    adapter: adapters[options.engine](),
  });

  const scene = await viewer.createScene({
    georeference: SceneBuilder.projectedLocal({
      crs: options.crs,
      origin: {
        ...options.origin,
      },
    }),
  });

  scene.events.on("error", (error) => {
    console.error("S-100 scene error", error);
  });

  return { viewer, scene };
}
