import { type S100EngineAdapter } from "@ecc/s100-viewer";
import { cesiumAdapterCapabilities } from "./capabilities.js";
import { ensureConstructibleBrowserImageGlobal } from "../environment/imageCompatibility.js";
import type {
  CesiumAdapterOptions,
  CesiumModule,
  CesiumModuleProvider,
} from "./types.js";

export const createCesiumAdapter = (
  options: CesiumAdapterOptions = {},
): S100EngineAdapter => ({
  id: "cesium",
  displayName: "Cesium",
  capabilities: cesiumAdapterCapabilities,
  getCapabilities: () => cesiumAdapterCapabilities,
  async createViewerHost(hostOptions) {
    const cesium = await resolveCesiumModule(options.cesiumModule);
    const parent = getHtmlElement(hostOptions.container);
    ensureConstructibleBrowserImageGlobal(parent?.ownerDocument);
    if (options.accessToken !== undefined) {
      setCesiumAccessToken(cesium, options.accessToken);
    }
    const { CesiumViewerHost } = await import("./CesiumViewerHost.js");
    return new CesiumViewerHost(cesium, parent, options, hostOptions);
  },
  async destroyViewerHost(host) {
    await host.destroy();
  },
});

async function resolveCesiumModule(provider: CesiumModuleProvider | undefined): Promise<CesiumModule> {
  if (!provider) {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<CesiumModule>;
    return dynamicImport("cesium");
  }
  return typeof provider === "function" ? provider() : provider;
}

function setCesiumAccessToken(cesium: CesiumModule, accessToken: string): void {
  const Ion = cesium.Ion as { defaultAccessToken?: string } | undefined;
  if (Ion) {
    Ion.defaultAccessToken = accessToken;
  }
}

function getHtmlElement(container: unknown): HTMLElement | null {
  if (container && typeof container === "object" && "appendChild" in container) {
    return container as HTMLElement;
  }
  return null;
}
