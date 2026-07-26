import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  exports: Record<string, { types: string; import: string }>;
};

const packageRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
) as PackageJson;

const publicEntrypoints = [
  {
    subpath: "./features",
    source: "src/entrypoints/features.ts",
    importPath: "./dist/entrypoints/features.js",
    typesPath: "./dist/entrypoints/features.d.ts",
  },
  {
    subpath: "./products",
    source: "src/entrypoints/products.ts",
    importPath: "./dist/entrypoints/products.js",
    typesPath: "./dist/entrypoints/products.d.ts",
  },
  {
    subpath: "./products/enc",
    source: "src/entrypoints/products/enc.ts",
    importPath: "./dist/entrypoints/products/enc.js",
    typesPath: "./dist/entrypoints/products/enc.d.ts",
  },
  {
    subpath: "./products/route",
    source: "src/entrypoints/products/route.ts",
    importPath: "./dist/entrypoints/products/route.js",
    typesPath: "./dist/entrypoints/products/route.d.ts",
  },
  {
    subpath: "./products/s102",
    source: "src/entrypoints/products/s102.ts",
    importPath: "./dist/entrypoints/products/s102.js",
    typesPath: "./dist/entrypoints/products/s102.d.ts",
  },
  {
    subpath: "./products/s104",
    source: "src/entrypoints/products/s104.ts",
    importPath: "./dist/entrypoints/products/s104.js",
    typesPath: "./dist/entrypoints/products/s104.d.ts",
  },
  {
    subpath: "./products/s111",
    source: "src/entrypoints/products/s111.ts",
    importPath: "./dist/entrypoints/products/s111.js",
    typesPath: "./dist/entrypoints/products/s111.d.ts",
  },
  {
    subpath: "./products/simulated-water-level",
    source: "src/entrypoints/products/simulated-water-level.ts",
    importPath: "./dist/entrypoints/products/simulated-water-level.js",
    typesPath: "./dist/entrypoints/products/simulated-water-level.d.ts",
  },
  {
    subpath: "./products/vessel",
    source: "src/entrypoints/products/vessel.ts",
    importPath: "./dist/entrypoints/products/vessel.js",
    typesPath: "./dist/entrypoints/products/vessel.d.ts",
  },
] as const;

describe("public feature entrypoints", () => {
  it("declares a package export for each documented feature subpath", () => {
    for (const entrypoint of publicEntrypoints) {
      expect(packageJson.exports[entrypoint.subpath]).toEqual({
        types: entrypoint.typesPath,
        import: entrypoint.importPath,
      });
      expect(existsSync(resolve(packageRoot, entrypoint.source))).toBe(true);
    }
  });

  it("keeps feature entrypoints out of internals and adapter packages", () => {
    for (const entrypoint of publicEntrypoints) {
      const source = readFileSync(resolve(packageRoot, entrypoint.source), "utf8");
      expect(source).not.toContain("../internal/");
      expect(source).not.toContain("../../internal/");
      expect(source).not.toContain("@ecc/s100-viewer-adapter");
    }
  });
});
