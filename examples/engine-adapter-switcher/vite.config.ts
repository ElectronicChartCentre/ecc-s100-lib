import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(demoRoot, "../..");
const cesiumSource = resolve(workspaceRoot, "node_modules/cesium/Build/Cesium");
const cesiumPublicPath = "/cesium";

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

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify(cesiumPublicPath),
  },
  plugins: [cesiumAssets()],
  build: {
    sourcemap: true,
    target: "es2022",
  },
});
