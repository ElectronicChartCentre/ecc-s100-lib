import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, "../..");
const viewerSource = resolve(workspaceRoot, "packages/s100-viewer/src/index.ts");
const viewerFeaturesSource = resolve(workspaceRoot, "packages/s100-viewer/src/entrypoints/features.ts");
const viewerProductsSource = resolve(workspaceRoot, "packages/s100-viewer/src/entrypoints/products.ts");
const viewerProductSource = resolve(workspaceRoot, "packages/s100-viewer/src/entrypoints/products/$1.ts");
const viewerInternalSource = resolve(workspaceRoot, "packages/s100-viewer/src/internal/$1");
const nasaAmmosAdapterSource = resolve(
  workspaceRoot,
  "packages/s100-viewer-adapter-nasa-ammos/src/index.ts",
);
const threeSource = resolve(workspaceRoot, "node_modules/three");

const createS102TileProxy = (endpoint: string | undefined): Record<string, string | ProxyOptions> => {
  if (!endpoint) {
    return {};
  }

  try {
    const url = new URL(endpoint);
    const endpointPath = url.pathname.replace(/\/$/, "");
    return {
      "/demo-proxy/s102-tiles": {
        target: url.origin,
        changeOrigin: true,
        rewrite: (path) =>
          `${endpointPath}${path.replace(/^\/demo-proxy\/s102-tiles/, "")}`,
      },
    };
  } catch {
    return {};
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appRoot, "");
  const s102Endpoint =
    env.VITE_RTZ_ROUTE_S102_3D_TILES_ENDPOINT ??
    env.VITE_DEMO_S102_3D_TILES_ENDPOINT ??
    env.VITE_S102_PRIMAR_3D_TILES_ENDPOINT ??
    env.VITE_REFERENCE_S102_3D_TILES_ENDPOINT;

  return {
    resolve: {
      alias: [
        {
          find: /^@ecc\/s100-viewer\/internal\/(.+)$/u,
          replacement: viewerInternalSource,
        },
        {
          find: /^@ecc\/s100-viewer\/products\/(.+)$/u,
          replacement: viewerProductSource,
        },
        { find: /^@ecc\/s100-viewer\/products$/u, replacement: viewerProductsSource },
        { find: /^@ecc\/s100-viewer\/features$/u, replacement: viewerFeaturesSource },
        { find: /^@ecc\/s100-viewer$/u, replacement: viewerSource },
        {
          find: /^@ecc\/s100-viewer-adapter-nasa-ammos$/u,
          replacement: nasaAmmosAdapterSource,
        },
        // Source-aliased adapter workspaces must share one Three runtime.
        { find: /^three$/u, replacement: threeSource },
        { find: /^three\/addons\/(.+)$/u, replacement: `${threeSource}/examples/jsm/$1` },
        { find: /^three\/examples\/jsm\/(.+)$/u, replacement: `${threeSource}/examples/jsm/$1` },
      ],
      dedupe: ["three"],
    },
    server: {
      fs: {
        allow: [workspaceRoot],
      },
      proxy: createS102TileProxy(s102Endpoint),
    },
    build: {
      sourcemap: true,
      target: "es2022",
    },
  };
});
