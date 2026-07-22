import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, "../..");
const viewerSource = resolve(workspaceRoot, "packages/s100-viewer/src/index.ts");
const nasaAmmosAdapterSource = resolve(
  workspaceRoot,
  "packages/s100-viewer-adapter-nasa-ammos/src/index.ts",
);

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
        { find: "@ecc/s100-viewer", replacement: viewerSource },
        {
          find: "@ecc/s100-viewer-adapter-nasa-ammos",
          replacement: nasaAmmosAdapterSource,
        },
      ],
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
