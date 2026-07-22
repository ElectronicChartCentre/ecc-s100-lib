import type { S100EngineAdapter } from "@ecc/s100-viewer";
import { S100NasaViewer, type S100NasaViewerConfig } from "../runtime/index.js";
import { getHtmlElement } from "../coordinates/projectedLocal.js";
import type { NasaAmmosAdapterOptions } from "../options.js";
import { nasaAmmosAdapterCapabilities } from "./capabilities.js";
import { NasaAmmosViewerHost } from "./NasaAmmosViewerHost.js";

export const createNasaAmmosAdapter = (
  options: NasaAmmosAdapterOptions = {},
): S100EngineAdapter => ({
  id: "nasa-ammos",
  displayName: "NASA-AMMOS / Three.js",
  capabilities: nasaAmmosAdapterCapabilities,
  getCapabilities: () => nasaAmmosAdapterCapabilities,
  async createViewerHost(hostOptions) {
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
