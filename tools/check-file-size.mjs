#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const allowlistPath = join(root, "tools/file-size-allowlist.json");

const normalize = (path) => path.split(sep).join("/");

const allowlist = new Map(
  JSON.parse(readFileSync(allowlistPath, "utf8")).map((entry) => [normalize(entry.path), entry]),
);

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".md"]);
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "artifacts",
]);
const rootsToScan = ["packages", "examples", "docs", "tools"];

const extensionOf = (path) => {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
};

const thresholdFor = (path) => {
  if (path.includes("/fixtures/")) {
    return { maxLines: 1200, category: "fixture" };
  }
  if (path.includes("/test/") || path.endsWith(".test.ts") || path.endsWith(".test.tsx")) {
    return { maxLines: 900, category: "test" };
  }
  if (path.startsWith("docs/")) {
    return { maxLines: 2000, category: "docs" };
  }
  return { maxLines: 900, category: "source" };
};

const countLines = (path) => {
  const text = readFileSync(path, "utf8");
  if (text.length === 0) {
    return 0;
  }
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
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

const files = [];
for (const scanRoot of rootsToScan) {
  walk(join(root, scanRoot), files);
}

const violations = [];
const accepted = [];

for (const file of files) {
  const { maxLines, category } = thresholdFor(file.relativePath);
  const lines = countLines(file.absolute);
  if (lines <= maxLines) {
    continue;
  }

  const allowlistEntry = allowlist.get(file.relativePath);
  if (allowlistEntry !== undefined) {
    accepted.push({ ...file, lines, maxLines, category, allowlistEntry });
    continue;
  }

  violations.push({ ...file, lines, maxLines, category });
}

for (const entry of accepted) {
  console.log(
    `[allowlisted:${entry.allowlistEntry.phase}] ${entry.relativePath} has ${entry.lines} lines; target ${entry.maxLines} for ${entry.category}. ${entry.allowlistEntry.reason}`,
  );
}

if (violations.length > 0) {
  console.error("File-size check failed:");
  for (const violation of violations) {
    console.error(
      `- ${violation.relativePath}: ${violation.lines} lines exceeds ${violation.maxLines} (${violation.category})`,
    );
  }
  process.exit(1);
}

console.log(
  `File-size check passed: ${files.length} files scanned, ${accepted.length} allowlisted oversized files.`,
);
