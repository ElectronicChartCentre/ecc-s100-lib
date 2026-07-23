import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@ecc\/s100-viewer\/internal\/(.+)$/u,
        replacement: fileURLToPath(new URL("../s100-viewer/src/internal/$1", import.meta.url)),
      },
      {
        find: "@ecc/s100-viewer",
        replacement: fileURLToPath(new URL("../s100-viewer/src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
