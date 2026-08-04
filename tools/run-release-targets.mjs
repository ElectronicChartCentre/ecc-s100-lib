#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve, sep } from "node:path";
import { releaseTargets } from "./release-targets.mjs";

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const [command, ...commandArgs] = process.argv.slice(2);

const usage = () => {
  console.error("Usage: node tools/run-release-targets.mjs <check|test|build|pack> [...args]");
};

if (command === undefined) {
  usage();
  process.exit(1);
}

const validCommands = new Set(["check", "test", "build", "pack"]);
if (!validCommands.has(command)) {
  console.error(`Unsupported release-target command: ${command}`);
  usage();
  process.exit(1);
}

const readPackage = (target) => {
  const manifestPath = join(process.cwd(), target.directory, "package.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Release target ${target.name} is missing ${target.directory}/package.json`);
  }

  return JSON.parse(readFileSync(manifestPath, "utf8"));
};

const run = (args) => {
  const result = spawnSync(npmBin, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const packageRelativePath = (packageRoot, path) => {
  const absolute = resolve(packageRoot, path);
  const packagePath = relative(packageRoot, absolute);
  if (packagePath.startsWith(`..${sep}`) || packagePath === "..") {
    throw new Error(`Package path escapes its package root: ${path}`);
  }
  return packagePath.split(sep).join("/");
};

const collectExportPaths = (value, paths = []) => {
  if (typeof value === "string") {
    if (value.startsWith("./") && !value.includes("*")) {
      paths.push(value.slice(2));
    }
    return paths;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectExportPaths(entry, paths);
    }
    return paths;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      collectExportPaths(entry, paths);
    }
  }

  return paths;
};

const validatePackInputs = (target, manifest) => {
  const packageRoot = join(process.cwd(), target.directory);
  const exportPaths = [...new Set(collectExportPaths(manifest.exports))];

  if (manifest.private !== false) {
    throw new Error(`Release target ${target.name} must declare private: false.`);
  }

  if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
    throw new Error(`Release target ${target.name} must include dist in package files.`);
  }

  if (!existsSync(join(packageRoot, "dist"))) {
    throw new Error(`Release target ${target.name} is missing built dist output.`);
  }

  if (exportPaths.length === 0) {
    throw new Error(`Release target ${target.name} does not declare concrete package exports.`);
  }

  for (const exportPath of exportPaths) {
    const packagedPath = packageRelativePath(packageRoot, exportPath);
    if (!existsSync(join(packageRoot, packagedPath))) {
      throw new Error(`Release target ${target.name} is missing exported file ${exportPath}.`);
    }
  }

  for (const dependencyGroup of ["dependencies", "optionalDependencies"]) {
    for (const [name, version] of Object.entries(manifest[dependencyGroup] ?? {})) {
      if (/^(?:file|link|workspace):/u.test(version) || version.startsWith("/")) {
        throw new Error(
          `Release target ${target.name} has non-publishable ${dependencyGroup} entry ${name}: ${version}.`,
        );
      }
    }
  }

  return exportPaths;
};

const runPack = (target, manifest, args) => {
  const exportPaths = validatePackInputs(target, manifest);
  const npmArgs = ["pack", "--json", ...args];
  if (!npmArgs.includes("--cache")) {
    npmArgs.push("--cache", "/tmp/ecc-s100-viewer-npm-cache");
  }
  npmArgs.push("-w", target.name);

  const result = spawnSync(npmBin, npmArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    process.exit(result.status ?? 1);
  }

  let packs;
  try {
    packs = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse npm pack output for ${target.name}.`, { cause: error });
  }

  if (!Array.isArray(packs) || packs.length !== 1 || !Array.isArray(packs[0].files)) {
    throw new Error(`npm pack returned an unexpected manifest for ${target.name}.`);
  }

  const packedPaths = new Set(packs[0].files.map(({ path }) => path));
  const requiredPaths = ["package.json", "README.md", "LICENSE", ...exportPaths];
  for (const path of requiredPaths) {
    if (!packedPaths.has(path)) {
      throw new Error(`Packed ${target.name} archive is missing ${path}.`);
    }
  }

  if (![...packedPaths].some((path) => path.startsWith("dist/"))) {
    throw new Error(`Packed ${target.name} archive does not contain dist output.`);
  }

  const [{ files, ...summary }] = packs;
  process.stdout.write(
    `${JSON.stringify({ ...summary, validatedFileCount: files.length }, null, 2)}\n`,
  );
};

for (const target of releaseTargets) {
  const manifest = readPackage(target);
  if (manifest.name !== target.name) {
    throw new Error(
      `Release target ${target.directory} declares ${manifest.name}, expected ${target.name}.`,
    );
  }

  if (command === "pack") {
    runPack(target, manifest, commandArgs);
    continue;
  }

  if (manifest.scripts?.[command] === undefined) {
    throw new Error(`Release target ${target.name} does not define a ${command} script.`);
  }

  run(["run", command, "-w", target.name, ...commandArgs]);
}
