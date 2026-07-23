import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(demoRoot, "../..");
const cesiumSource = resolve(workspaceRoot, "node_modules/cesium/Build/Cesium");
const cesiumPublicPath = "/cesium";
const viewerSource = resolve(workspaceRoot, "packages/s100-viewer/src/index.ts");
const viewerFeaturesSource = resolve(workspaceRoot, "packages/s100-viewer/src/entrypoints/features.ts");
const viewerProductsSource = resolve(workspaceRoot, "packages/s100-viewer/src/entrypoints/products.ts");
const viewerProductSource = resolve(workspaceRoot, "packages/s100-viewer/src/entrypoints/products/$1.ts");
const viewerInternalSource = resolve(workspaceRoot, "packages/s100-viewer/src/internal/$1");
const nasaAmmosAdapterSource = resolve(workspaceRoot, "packages/s100-viewer-adapter-nasa-ammos/src/index.ts");
const cesiumAdapterSource = resolve(workspaceRoot, "packages/s100-viewer-adapter-cesium/src/index.ts");

const contentTypes: Record<string, string> = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

const cesiumAssets = (): Plugin => ({
  name: "s100-demo-cesium-assets",
  configureServer(server) {
    server.middlewares.use(cesiumPublicPath, (request, response, next) => {
      const requestedUrl = new URL(request.url ?? "/", "http://localhost");
      const assetPath = decodeURIComponent(requestedUrl.pathname).replace(/^\/+/, "");
      const absoluteAssetPath = resolve(cesiumSource, assetPath);

      if (!absoluteAssetPath.startsWith(cesiumSource) || !existsSync(absoluteAssetPath)) {
        next();
        return;
      }

      const stat = statSync(absoluteAssetPath);
      if (!stat.isFile()) {
        next();
        return;
      }

      response.setHeader("Content-Type", contentTypes[extname(absoluteAssetPath)] ?? "application/octet-stream");
      createReadStream(absoluteAssetPath).pipe(response);
    });
  },
  closeBundle() {
    if (existsSync(cesiumSource)) {
      cpSync(cesiumSource, resolve(demoRoot, "dist/cesium"), { recursive: true });
    }
  },
});

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
  const env = loadEnv(mode, demoRoot, "");
  const s102Endpoint =
    env.VITE_DEMO_S102_3D_TILES_ENDPOINT ?? env.VITE_S102_PRIMAR_3D_TILES_ENDPOINT;

  return {
    define: {
      CESIUM_BASE_URL: JSON.stringify(cesiumPublicPath),
    },
    plugins: [cesiumAssets()],
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
        { find: /^@ecc\/s100-viewer-adapter-nasa-ammos$/u, replacement: nasaAmmosAdapterSource },
        { find: /^@ecc\/s100-viewer-adapter-cesium$/u, replacement: cesiumAdapterSource },
      ],
    },
    server: {
      proxy: createS102TileProxy(s102Endpoint),
    },
    build: {
      sourcemap: true,
      target: "es2022",
    },
  };
});
