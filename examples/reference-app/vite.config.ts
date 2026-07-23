import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

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
const sharedDemoAssets = resolve(
  workspaceRoot,
  "examples/engine-adapter-switcher/public/demo-assets",
);
const demoAssetsPublicPath = "/demo-assets";

const contentTypes: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".hdr": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".png": "image/png",
};

const sharedDemoAssetsPlugin = (): Plugin => ({
  name: "s100-reference-shared-demo-assets",
  configureServer(server) {
    server.middlewares.use(demoAssetsPublicPath, (request, response, next) => {
      const requestedUrl = new URL(request.url ?? "/", "http://localhost");
      const assetPath = decodeURIComponent(requestedUrl.pathname).replace(/^\/+/, "");
      const absoluteAssetPath = resolve(sharedDemoAssets, assetPath);

      if (!absoluteAssetPath.startsWith(sharedDemoAssets) || !existsSync(absoluteAssetPath)) {
        next();
        return;
      }

      const stat = statSync(absoluteAssetPath);
      if (!stat.isFile()) {
        next();
        return;
      }

      const extension = absoluteAssetPath.slice(absoluteAssetPath.lastIndexOf("."));
      response.setHeader("Content-Type", contentTypes[extension] ?? "application/octet-stream");
      createReadStream(absoluteAssetPath).pipe(response);
    });
  },
  closeBundle() {
    if (existsSync(sharedDemoAssets)) {
      cpSync(sharedDemoAssets, resolve(appRoot, "dist/demo-assets"), {
        recursive: true,
      });
    }
  },
});

export default defineConfig({
  plugins: [sharedDemoAssetsPlugin()],
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
    ],
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    sourcemap: true,
    target: "es2022",
  },
});
