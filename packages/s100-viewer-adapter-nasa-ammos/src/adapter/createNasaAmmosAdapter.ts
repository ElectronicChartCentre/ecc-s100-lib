import type { S100EngineAdapter } from "@ecc/s100-viewer";
import type {
  NasaAmmosAdapterOptions,
  S100NasaViewerConfig,
} from "../options.js";
import { nasaAmmosAdapterCapabilities } from "./capabilities.js";

export const createNasaAmmosAdapter = (
  options: NasaAmmosAdapterOptions = {},
): S100EngineAdapter => ({
  id: "nasa-ammos",
  displayName: "NASA-AMMOS / Three.js",
  capabilities: nasaAmmosAdapterCapabilities,
  getCapabilities: () => nasaAmmosAdapterCapabilities,
  async createViewerHost(hostOptions) {
    const [{ S100NasaViewer }, { getHtmlElement }, { NasaAmmosViewerHost }] =
      await Promise.all([
        import("../runtime/index.js"),
        import("../coordinates/projectedLocal.js"),
        import("./NasaAmmosViewerHost.js"),
      ]);
    const parent = getHtmlElement(hostOptions.container);
    const viewerConfig: S100NasaViewerConfig = { ...options };
    const logger = options.logger ?? hostOptions.logger;
    if (logger !== undefined) {
      viewerConfig.logger = logger;
    }
    if (options.fetchHandler !== undefined) {
      viewerConfig.fetchHandler = options.fetchHandler;
    }

    const viewer = await S100NasaViewer.create(parent, viewerConfig);
    return new NasaAmmosViewerHost(viewer, options);
  },
  async destroyViewerHost(host) {
    await host.destroy();
  },
});
