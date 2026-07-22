#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
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

for (const target of releaseTargets) {
  const manifest = readPackage(target);
  if (manifest.name !== target.name) {
    throw new Error(
      `Release target ${target.directory} declares ${manifest.name}, expected ${target.name}.`,
    );
  }

  if (command === "pack") {
    const args = ["pack", ...commandArgs];
    if (!args.includes("--cache")) {
      args.push("--cache", "/tmp/ecc-s100-viewer-npm-cache");
    }
    args.push("-w", target.name);
    run(args);
    continue;
  }

  if (manifest.scripts?.[command] === undefined) {
    throw new Error(`Release target ${target.name} does not define a ${command} script.`);
  }

  run(["run", command, "-w", target.name, ...commandArgs]);
}

