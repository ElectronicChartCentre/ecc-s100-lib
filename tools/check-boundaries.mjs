#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize as normalizePath, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", "artifacts"]);
const rootsToScan = ["packages", "examples", "tools"];

const normalize = (path) => path.split(sep).join("/");

const extensionOf = (path) => {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
};

const walk = (directory, files) => {
  if (!existsSync(directory)) {
    return;
  }

  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const absolute = join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      walk(absolute, files);
      continue;
    }

    const relativePath = normalize(relative(root, absolute));
    if (!sourceExtensions.has(extensionOf(relativePath))) {
      continue;
    }

    files.push({ absolute, relativePath });
  }
};

const resolveImport = (importer, specifier) => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const resolved = normalizePath(join(dirname(importer), specifier));
  return normalize(resolved);
};

const collectSpecifiers = (source) => {
  const specifiers = [];
  const importExportPattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gs;
  const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of source.matchAll(importExportPattern)) {
    specifiers.push(match[1]);
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    specifiers.push(match[1]);
  }

  return specifiers;
};

const isPackageFile = (path) => path.startsWith("packages/");
const isCoreSourceFile = (path) => path.startsWith("packages/s100-viewer/src/");
const isPackageRootIndex = (path) =>
  /^packages\/[^/]+\/src\/index\.(ts|tsx|js|mjs|cjs)$/.test(path);

const files = [];
for (const scanRoot of rootsToScan) {
  walk(join(root, scanRoot), files);
}

const violations = [];

const addViolation = (file, specifier, message) => {
  violations.push(`${file.relativePath}: ${message} (${specifier})`);
};

for (const file of files) {
  const source = readFileSync(file.absolute, "utf8");
  const specifiers = collectSpecifiers(source);

  for (const specifier of specifiers) {
    const resolved = resolveImport(file.relativePath, specifier);

    if (isCoreSourceFile(file.relativePath) && specifier.startsWith("@ecc/s100-viewer-adapter-")) {
      addViolation(file, specifier, "core viewer package must not import adapter packages");
    }

    if (isPackageFile(file.relativePath)) {
      if (
        resolved?.startsWith("examples/") ||
        specifier === "examples" ||
        specifier.startsWith("examples/")
      ) {
        addViolation(file, specifier, "package source must not import examples");
      }

      if (resolved?.startsWith("apps/") || specifier.includes("s100-explorer-webapp")) {
        addViolation(file, specifier, "package source must not import app code");
      }
    }

    if (specifier.includes("runtime/compat")) {
      addViolation(file, specifier, "runtime/compat imports are not allowed");
    }
  }

  if (isPackageRootIndex(file.relativePath)) {
    const exportFromPattern = /\bexport\s+(?:type\s+)?[^'";]*?\s+from\s+["']([^"']+)["']/gs;
    for (const match of source.matchAll(exportFromPattern)) {
      if (match[1].includes("runtime/compat")) {
        addViolation(file, match[1], "package root must not export runtime/compat modules");
      }
    }
  }
}

const coreRoot = join(root, "packages/s100-viewer/src/index.ts");
if (existsSync(coreRoot)) {
  const source = readFileSync(coreRoot, "utf8");
  for (const legacySymbol of ["Viewer", "ViewerScene"]) {
    const pattern = new RegExp(`\\b${legacySymbol}\\b`);
    if (pattern.test(source)) {
      violations.push(
        `packages/s100-viewer/src/index.ts: core root export should not expose legacy ${legacySymbol}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Boundary check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Boundary check passed: ${files.length} files scanned.`);
