#!/usr/bin/env node
import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8794;

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(serverDirectory);
const workspaceRoot = dirname(dirname(packageRoot));

const options = {
  host: readOption("host") ?? process.env.S104_FIXTURE_SERVICE_HOST ?? DEFAULT_HOST,
  port: readPort(readOption("port") ?? process.env.S104_FIXTURE_SERVICE_PORT, DEFAULT_PORT),
  fixtureRoot: resolveFixtureRoot(readOption("root") ?? process.env.S104_FIXTURE_ROOT),
  allowedOrigins: readAllowedOrigins(
    readOption("allowed-origins") ?? process.env.S104_FIXTURE_ALLOWED_ORIGINS,
  ),
};

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

const server = createServer((request, response) => {
  handleRequest(request, response, options).catch((error) => {
    console.error(error);
    sendJsonError(response, 500, "internal_error", "Unexpected S-104 fixture service error.");
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`S-104 fixture service port ${options.port} is already in use.`);
    process.exit(1);
  }
  if (error.code === "EPERM") {
    console.error(`S-104 fixture service cannot listen on ${options.host}:${options.port}.`);
    process.exit(1);
  }
  throw error;
});

server.listen(options.port, options.host, () => {
  console.log(`S-104 fixture service listening on http://${options.host}:${options.port}`);
  console.log(`Fixture root: ${options.fixtureRoot}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function handleRequest(request, response, serviceOptions) {
  applyCorsHeaders(request, response, serviceOptions.allowedOrigins);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJsonError(response, 405, "method_not_allowed", "Only GET and OPTIONS are supported.");
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const path = decodePathname(url.pathname);
  if (path === null) {
    sendJsonError(response, 400, "invalid_path", "The request path is not valid UTF-8.");
    return;
  }

  if (path === "/" || path === "/health") {
    await sendHealth(response, serviceOptions);
    return;
  }

  if (path === "/s104/catalog.json") {
    await sendFixtureFile(response, serviceOptions.fixtureRoot, "/s104/catalog.json");
    return;
  }

  const match = /^\/s104\/([^/]+)\/(metadata|data)\.json$/u.exec(path);
  if (match === null) {
    sendJsonError(response, 404, "not_found", "No S-104 fixture route matches this request.");
    return;
  }

  const [, datasetId, payloadKind] = match;
  const catalog = await readCatalog(serviceOptions.fixtureRoot);
  if (catalog.status === "error") {
    sendJsonError(response, catalog.statusCode, catalog.code, catalog.message);
    return;
  }

  const dataset = catalog.value.datasets.find((entry) => entry.id === datasetId);
  if (dataset === undefined) {
    sendJsonError(
      response,
      404,
      "dataset_not_found",
      `S-104 fixture dataset '${datasetId}' is not available.`,
      {
        availableDatasetIds: catalog.value.datasets.map((entry) => entry.id),
      },
    );
    return;
  }

  const requestedCrs = normalizeQueryValue(url.searchParams.get("crs"));
  if (requestedCrs !== null && dataset.crs !== requestedCrs) {
    sendJsonError(
      response,
      400,
      "unsupported_crs",
      `S-104 fixture dataset '${dataset.id}' only supports ${dataset.crs}.`,
      {
        requestedCrs,
        supportedCrs: [dataset.crs],
      },
    );
    return;
  }

  const fixturePath = payloadKind === "metadata" ? dataset.metadataPath : dataset.dataPath;
  await sendFixtureFile(response, serviceOptions.fixtureRoot, fixturePath);
}

async function sendHealth(response, serviceOptions) {
  const catalog = await readCatalog(serviceOptions.fixtureRoot);
  const rootExists = existsSync(serviceOptions.fixtureRoot);
  sendJson(response, 200, {
    status: catalog.status === "ok" ? "ok" : "degraded",
    product: "S-104",
    fixtureRoot: serviceOptions.fixtureRoot,
    fixtureRootExists: rootExists,
    datasets: catalog.status === "ok" ? catalog.value.datasets.map((dataset) => dataset.id) : [],
    error: catalog.status === "error" ? catalog.message : undefined,
  });
}

async function sendFixtureFile(response, fixtureRoot, fixturePath) {
  const resolved = resolveFixturePath(fixtureRoot, fixturePath);
  if (resolved.status === "error") {
    sendJsonError(response, 400, resolved.code, resolved.message);
    return;
  }

  try {
    const fileStat = await stat(resolved.path);
    if (!fileStat.isFile()) {
      sendJsonError(response, 404, "fixture_file_not_found", "S-104 fixture file was not found.");
      return;
    }
  } catch {
    sendJsonError(response, 404, "fixture_file_not_found", "S-104 fixture file was not found.");
    return;
  }

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  createReadStream(resolved.path).pipe(response);
}

async function readCatalog(fixtureRoot) {
  const resolved = resolveFixturePath(fixtureRoot, "/s104/catalog.json");
  if (resolved.status === "error") {
    return {
      status: "error",
      statusCode: 400,
      code: resolved.code,
      message: resolved.message,
    };
  }

  try {
    const catalog = JSON.parse(await readFile(resolved.path, "utf8"));
    if (!isCatalog(catalog)) {
      return {
        status: "error",
        statusCode: 500,
        code: "invalid_catalog",
        message: "S-104 fixture catalog has an invalid shape.",
      };
    }
    return { status: "ok", value: catalog };
  } catch {
    return {
      status: "error",
      statusCode: 503,
      code: "catalog_unavailable",
      message: "S-104 fixture catalog is unavailable. Run npm run fixtures:s104:generate.",
    };
  }
}

function isCatalog(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.product === "S-104" &&
    Array.isArray(value.datasets) &&
    value.datasets.every(isCatalogDataset)
  );
}

function isCatalogDataset(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.crs === "string" &&
    typeof value.metadataPath === "string" &&
    typeof value.dataPath === "string"
  );
}

function resolveFixturePath(fixtureRoot, fixturePath) {
  if (!fixturePath.startsWith("/s104/")) {
    return {
      status: "error",
      code: "invalid_fixture_path",
      message: "Fixture path must be under /s104/.",
    };
  }

  const root = resolve(fixtureRoot);
  const path = resolve(root, `.${fixturePath}`);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    return {
      status: "error",
      code: "invalid_fixture_path",
      message: "Fixture path escapes the configured fixture root.",
    };
  }

  return { status: "ok", path };
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(`${JSON.stringify(removeUndefined(value), null, 2)}\n`);
}

function sendJsonError(response, statusCode, code, message, details = undefined) {
  sendJson(response, statusCode, {
    error: removeUndefined({
      code,
      message,
      details,
    }),
  });
}

function applyCorsHeaders(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (allowedOrigins.includes("*")) {
    response.setHeader("Access-Control-Allow-Origin", "*");
  } else if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Access-Control-Max-Age", "86400");
}

function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)]),
    );
  }
  return value;
}

function resolveFixtureRoot(value) {
  if (value) {
    return resolve(value);
  }

  const staticFilesRoot = resolve(
    workspaceRoot,
    "../../local/worktrees/S100ViewerStatic-static-assets/static/testdata/s104-fixtures/service",
  );
  if (existsSync(dirname(dirname(staticFilesRoot)))) {
    return staticFilesRoot;
  }

  return resolve(workspaceRoot, "local/generated/s104-fixtures/service");
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function normalizeQueryValue(value) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function readOption(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function readPort(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function readAllowedOrigins(value) {
  const origins = value?.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins && origins.length > 0 ? origins : ["*"];
}

function printHelp() {
  console.log(`Usage: node src/server.mjs [--host 127.0.0.1] [--port 8794] [--root /path/to/service-root]

Environment variables:
  S104_FIXTURE_SERVICE_HOST
  S104_FIXTURE_SERVICE_PORT
  S104_FIXTURE_ROOT
  S104_FIXTURE_ALLOWED_ORIGINS`);
}
