import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, "../..");
const viewerSource = resolve(workspaceRoot, "packages/s100-viewer/src/index.ts");
const viewerInternalSource = resolve(workspaceRoot, "packages/s100-viewer/src/internal/$1");
const nasaAmmosAdapterSource = resolve(
  workspaceRoot,
  "packages/s100-viewer-adapter-nasa-ammos/src/index.ts",
);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@ecc\/s100-viewer\/internal\/(.+)$/u,
        replacement: viewerInternalSource,
      },
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
  },
  build: {
    sourcemap: true,
    target: "es2022",
  },
});
