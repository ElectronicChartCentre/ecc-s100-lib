#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize as normalizePath, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const normalize = (path) => path.split(sep).join("/");

const sourceExtensions = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

const resolveSource = (importer, specifier) => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = normalizePath(join(dirname(importer), specifier));
  const candidates = [];

  if (/\.[cm]?[jt]sx?$/u.test(base)) {
    candidates.push(base);
    if (base.endsWith(".js")) {
      candidates.push(`${base.slice(0, -3)}.ts`);
    }
  } else {
    for (const extension of sourceExtensions) {
      candidates.push(`${base}${extension}`);
    }
    for (const extension of sourceExtensions) {
      candidates.push(join(base, `index${extension}`));
    }
  }

  const match = candidates.find((candidate) => existsSync(join(root, candidate)));
  return match ? normalize(match) : null;
};

const isTypeOnlyImportStatement = (statement) => {
  if (/^\s*(?:import|export)\s+type\b/u.test(statement)) {
    return true;
  }

  const namedOnly = /^\s*import\s+\{\s*([^}]+)\s*\}\s+from/u.exec(statement);
  if (!namedOnly) {
    return false;
  }

  return namedOnly[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .every((part) => part.startsWith("type "));
};

const staticImportSpecifiers = (source) => {
  const specifiers = [];
  const pattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gs;

  for (const match of source.matchAll(pattern)) {
    const statement = match[0];
    if (isTypeOnlyImportStatement(statement)) {
      continue;
    }
    specifiers.push(match[1]);
  }

  return specifiers;
};

const collectStaticGraph = (entry) => {
  const visited = new Set();
  const stack = [entry];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const absolute = join(root, current);
    if (!existsSync(absolute)) {
      continue;
    }

    const source = readFileSync(absolute, "utf8");
    for (const specifier of staticImportSpecifiers(source)) {
      const resolved = resolveSource(current, specifier);
      if (resolved) {
        stack.push(resolved);
      }
    }
  }

  return [...visited].sort();
};

const checks = [
  {
    name: "core-s102-only",
    entry: "packages/s100-viewer/src/entrypoints/products/s102.ts",
    forbidden: [
      "packages/s100-viewer/src/products/rtz-parser",
      "packages/s100-viewer/src/products/route-layout",
      "packages/s100-viewer/src/products/route-session",
      "packages/s100-viewer/src/products/s111-workflow.ts",
    ],
  },
  {
    name: "core-route-only",
    entry: "packages/s100-viewer/src/entrypoints/products/route.ts",
    forbidden: [
      "packages/s100-viewer/src/products/s111-session.ts",
      "packages/s100-viewer/src/products/s111-workflow.ts",
    ],
  },
  {
    name: "nasa-adapter-root",
    entry: "packages/s100-viewer-adapter-nasa-ammos/src/index.ts",
    forbidden: [
      "packages/s100-viewer-adapter-nasa-ammos/src/adapter/NasaAmmosViewerHost.ts",
      "packages/s100-viewer-adapter-nasa-ammos/src/adapter/NasaAmmosEngineScene.ts",
      "packages/s100-viewer-adapter-nasa-ammos/src/runtime/",
      "packages/s100-viewer-adapter-nasa-ammos/src/layers/",
    ],
  },
  {
    name: "nasa-scene-shell",
    entry: "packages/s100-viewer-adapter-nasa-ammos/src/adapter/NasaAmmosEngineScene.ts",
    forbidden: [
      "packages/s100-viewer-adapter-nasa-ammos/src/layers/mapLayer.ts",
      "packages/s100-viewer-adapter-nasa-ammos/src/layers/routePlanLayer.ts",
      "packages/s100-viewer-adapter-nasa-ammos/src/layers/s102TerrainLayer.ts",
      "packages/s100-viewer-adapter-nasa-ammos/src/layers/s111SurfaceCurrentLayer.ts",
      "packages/s100-viewer-adapter-nasa-ammos/src/layers/vesselLayer.ts",
    ],
  },
  {
    name: "cesium-adapter-root",
    entry: "packages/s100-viewer-adapter-cesium/src/index.ts",
    forbidden: [
      "packages/s100-viewer-adapter-cesium/src/adapter/CesiumViewerHost.ts",
      "packages/s100-viewer-adapter-cesium/src/adapter/CesiumEngineScene.ts",
    ],
  },
  {
    name: "cesium-viewer-host",
    entry: "packages/s100-viewer-adapter-cesium/src/adapter/CesiumViewerHost.ts",
    forbidden: [
      "packages/s100-viewer-adapter-cesium/src/adapter/CesiumEngineScene.ts",
    ],
  },
  {
    name: "three-adapter-root",
    entry: "packages/s100-viewer-adapter-three/src/index.ts",
    forbidden: [
      "packages/s100-viewer-adapter-three/src/adapter/ThreeViewerHost.ts",
      "packages/s100-viewer-adapter-three/src/adapter/ThreeEngineScene.ts",
      "packages/s100-viewer-adapter-three/src/layers/",
    ],
  },
  {
    name: "three-viewer-host",
    entry: "packages/s100-viewer-adapter-three/src/adapter/ThreeViewerHost.ts",
    forbidden: [
      "packages/s100-viewer-adapter-three/src/adapter/ThreeEngineScene.ts",
      "packages/s100-viewer-adapter-three/src/layers/",
    ],
  },
  {
    name: "three-scene-shell",
    entry: "packages/s100-viewer-adapter-three/src/adapter/ThreeEngineScene.ts",
    forbidden: [
      "packages/s100-viewer-adapter-three/src/layers/mapLayer.ts",
      "packages/s100-viewer-adapter-three/src/layers/routePlanLayer.ts",
      "packages/s100-viewer-adapter-three/src/layers/s102TilesLayer.ts",
      "packages/s100-viewer-adapter-three/src/layers/s111SurfaceCurrentLayer.ts",
      "packages/s100-viewer-adapter-three/src/layers/vesselLayer.ts",
    ],
  },
];

const violations = [];

for (const check of checks) {
  const graph = collectStaticGraph(check.entry);
  for (const forbidden of check.forbidden) {
    const matched = graph.filter((path) => path.startsWith(forbidden));
    if (matched.length === 0) {
      continue;
    }
    violations.push({
      check: check.name,
      entry: check.entry,
      forbidden,
      matched,
    });
  }
}

if (violations.length > 0) {
  console.error("Bundle-shape check failed:");
  for (const violation of violations) {
    console.error(
      `- ${violation.check}: ${violation.entry} statically reaches ${violation.forbidden}`,
    );
    for (const path of violation.matched.slice(0, 8)) {
      console.error(`  - ${path}`);
    }
    if (violation.matched.length > 8) {
      console.error(`  - ... ${violation.matched.length - 8} more`);
    }
  }
  process.exit(1);
}

console.log(`Bundle-shape check passed: ${checks.length} entry graphs scanned.`);
