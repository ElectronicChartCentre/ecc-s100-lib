import type { S100EngineAdapter } from "@ecc/s100-viewer";
import type { ThreeAdapterOptions } from "../options.js";
import { threeAdapterCapabilities } from "./capabilities.js";

export const createThreeAdapter = (
  options: ThreeAdapterOptions = {},
): S100EngineAdapter => ({
  id: "three",
  displayName: "Three.js Reference",
  capabilities: threeAdapterCapabilities,
  getCapabilities: () => threeAdapterCapabilities,
  async createViewerHost(hostOptions) {
    const { ThreeViewerHost } = await import("./ThreeViewerHost.js");
    const viewerOptions: ThreeAdapterOptions = { ...options };
    const logger = options.logger ?? hostOptions.logger;
    if (logger !== undefined) {
      viewerOptions.logger = logger;
    }
    return new ThreeViewerHost(hostOptions, {
      ...viewerOptions,
    });
  },
  async destroyViewerHost(host) {
    await host.destroy();
  },
});
