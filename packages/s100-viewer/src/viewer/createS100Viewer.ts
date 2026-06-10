import type { CreateS100ViewerOptions, S100Viewer } from "./types.js";
import { CoreS100Viewer } from "./CoreS100Viewer.js";
import { validateAdapterCapabilities } from "../validation.js";
import type { ViewerHostOptions } from "../adapters/types.js";

export const createS100Viewer = async (options: CreateS100ViewerOptions): Promise<S100Viewer> => {
  validateAdapterCapabilities(options.adapter.capabilities);

  const hostOptions: ViewerHostOptions = {};
  if (options.container !== undefined) {
    hostOptions.container = options.container;
  }
  if (options.logger !== undefined) {
    hostOptions.logger = options.logger;
  }
  if (options.metadata !== undefined) {
    hostOptions.metadata = options.metadata;
  }

  const host = await options.adapter.createViewerHost(hostOptions);

  return new CoreS100Viewer(options.adapter, host, options.cameraControls);
};
