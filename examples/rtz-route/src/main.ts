import "./styles.css";
import sampleRouteXml from "./sample-route.rtz?raw";
import {
  CameraControlPresets,
  SceneBuilder,
  createS100Viewer,
  type S100Scene,
  type S100Viewer,
} from "@ecc/s100-viewer";
import { PrimarServices } from "@ecc/s100-viewer/products";
import {
  RouteFeatureSession,
  RouteStyles,
  type RouteFeatureHandle,
  type RouteFeatureStyle,
  type RoutePlanLayout,
} from "@ecc/s100-viewer/products/route";
import { S102TerrainSession } from "@ecc/s100-viewer/products/s102";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";
import {
  createSceneAlignedSampleRouteXml,
  createProjectedRouteProjection,
  getRtzRouteDemoConfig,
  s102SourceEndpoint,
  type RtzRouteDemoConfig,
} from "./config";

type RouteSourceState = {
  xml: string;
  sourceId: string;
};

type StatusState = "idle" | "busy" | "ready" | "error";

const ROUTE_LAYER_ID = "rtz-demo-route";
const config = getRtzRouteDemoConfig();
const SAMPLE_SOURCE: RouteSourceState = {
  xml: createSceneAlignedSampleRouteXml(config) ?? sampleRouteXml,
  sourceId: "scene-aligned-sample.rtz",
};

const viewerElement = getElement<HTMLElement>("viewer");
const fileInput = getElement<HTMLInputElement>("route-file");
const sampleButton = getElement<HTMLButtonElement>("sample-button");
const statusPill = getElement<HTMLElement>("status-pill");
const routeSummary = getElement<HTMLElement>("route-summary");
const s102Summary = getElement<HTMLElement>("s102-summary");
const diagnosticsList = getElement<HTMLOListElement>("diagnostics-list");
const toggles = {
  s102: getElement<HTMLInputElement>("s102-toggle"),
  centerline: getElement<HTMLInputElement>("centerline-toggle"),
  waypoints: getElement<HTMLInputElement>("waypoints-toggle"),
  corridor: getElement<HTMLInputElement>("corridor-toggle"),
  xtd: getElement<HTMLInputElement>("xtd-toggle"),
  volume: getElement<HTMLInputElement>("volume-toggle"),
  sides: getElement<HTMLInputElement>("sides-toggle"),
  debug: getElement<HTMLInputElement>("debug-toggle"),
};

let viewer: S100Viewer | null = null;
let scene: S100Scene | null = null;
let s102Session: S102TerrainSession | null = null;
let routeSession: RouteFeatureSession | null = null;
let activeRoute: RouteFeatureHandle | null = null;
let activeSource: RouteSourceState = SAMPLE_SOURCE;
let loadSerial = 0;

initializeS102Controls(config);
setStatus("Starting", "busy");
setControlsEnabled(false);
void startDemo();

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }
  void loadFile(file);
});

sampleButton.addEventListener("click", () => {
  fileInput.value = "";
  activeSource = SAMPLE_SOURCE;
  void renderRoute({ fitCamera: true });
});

for (const toggle of Object.values(toggles)) {
  toggle.addEventListener("change", () => {
    if (toggle === toggles.s102) {
      void s102Session?.setVisible(toggle.checked);
      renderS102Summary(config, toggle.checked);
      return;
    }
    void renderRoute({ fitCamera: false });
  });
}

window.addEventListener("beforeunload", () => {
  void destroyDemo();
});

async function startDemo(): Promise<void> {
  try {
    viewer = await createS100Viewer({
      container: viewerElement,
      adapter: createNasaAmmosAdapter(),
      cameraControls: CameraControlPresets.S100_DEFAULT,
      metadata: {
        app: "@ecc/s100-rtz-route-demo",
      },
    });
    scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: config.scene.crs,
        origin: {
          x: config.scene.origin.x,
          y: config.scene.origin.y,
          z: config.scene.origin.z,
        },
      }),
    });
    scene.environment.setState({
      background: "solid",
      lighting: {
        ambientIntensity: 0.12,
        directionalIntensity: 0.18,
      },
    });
    await prepareS102Bathymetry(scene, config);
    routeSession = RouteFeatureSession.create({
      scene,
      layoutOptions: {
        projection: createProjectedRouteProjection(config),
        seaLevelMeters: 0,
        turnDebugSegments: 36,
      },
    });
    await renderRoute({ fitCamera: true });
    setControlsEnabled(true);
  } catch (error) {
    setStatus(errorMessage(error), "error");
  }
}

async function destroyDemo(): Promise<void> {
  await routeSession?.dispose();
  await s102Session?.dispose();
  routeSession = null;
  s102Session = null;
  activeRoute = null;
  await viewer?.destroy();
  viewer = null;
  scene = null;
}

async function loadFile(file: File): Promise<void> {
  try {
    setStatus("Reading file", "busy");
    activeSource = {
      xml: await file.text(),
      sourceId: file.name,
    };
    await renderRoute({ fitCamera: true });
  } catch (error) {
    setStatus(errorMessage(error), "error");
  }
}

async function prepareS102Bathymetry(
  routeScene: S100Scene,
  demoConfig: RtzRouteDemoConfig,
): Promise<void> {
  if (!demoConfig.s102.configured) {
    renderS102Summary(demoConfig, false);
    return;
  }

  const endpoint = demoConfig.s102.endpoint;
  const apiKey = demoConfig.s102.apiKey;
  if (!endpoint || !apiKey) {
    renderS102Summary(demoConfig, false);
    return;
  }

  try {
    s102Session = S102TerrainSession.create({
      scene: routeScene,
      crs: demoConfig.scene.crs,
      source: PrimarServices.s102Tiles({
        endpoint: s102SourceEndpoint(endpoint),
        apiKey,
      }),
      idPrefix: "rtz-demo-s102",
      title: "S-102 bathymetry",
      visible: toggles.s102.checked,
      rendering: {
        detailFactor: demoConfig.s102.detailFactor,
      },
      style: {
        safetyDepthMeters: demoConfig.s102.safetyDepthMeters,
        shading: "hypsometric",
        contours: {
          visible: true,
          intervalMeters: 5,
        },
      },
    });
    await s102Session.setDatasetIds(demoConfig.s102.datasetIds);
    renderS102Summary(demoConfig, toggles.s102.checked);
  } catch (error) {
    diagnosticsList.append(diagnosticItem("warning", `S-102 bathymetry unavailable: ${errorMessage(error)}`));
    s102Session = null;
    renderS102Summary(demoConfig, false, "failed");
  }
}

async function renderRoute(options: { fitCamera: boolean }): Promise<void> {
  const session = routeSession;
  if (!session) {
    return;
  }

  const serial = ++loadSerial;
  setStatus("Loading route", "busy");
  try {
    const handle = await session.addRtz({
      id: ROUTE_LAYER_ID,
      title: activeSource.sourceId,
      source: {
        kind: "xml",
        xml: activeSource.xml,
        sourceId: activeSource.sourceId,
      },
      style: createRouteStyle(),
    });
    if (serial !== loadSerial) {
      await handle.remove();
      return;
    }
    activeRoute = handle;
    renderRouteSummary(handle, activeSource.sourceId);
    renderDiagnostics(handle);
    if (options.fitCamera) {
      fitCameraToRoute(handle.layout);
    }
    setStatus("Ready", "ready");
  } catch (error) {
    setStatus(errorMessage(error), "error");
    renderDiagnostics(null, error);
  }
}

function createRouteStyle(): RouteFeatureStyle {
  const has3d = toggles.volume.checked || toggles.sides.checked || toggles.debug.checked;
  const base = has3d ? RouteStyles.s421Hybrid3d() : RouteStyles.s421Defaults();
  return {
    ...base,
    visualization: toggles.debug.checked
      ? "debug-3d"
      : has3d
        ? "hybrid-3d"
        : "standard",
    showCenterline: toggles.centerline.checked,
    showWaypoints: toggles.waypoints.checked,
    showCorridor: toggles.corridor.checked,
    showXtdBoundaries: toggles.xtd.checked,
    showRouteVolume: toggles.volume.checked,
    showRouteSides: toggles.sides.checked,
    showTurnDebugGeometry: toggles.debug.checked,
  };
}

function fitCameraToRoute(layout: RoutePlanLayout): void {
  const routeScene = scene;
  const positions = [
    ...(layout.centerline?.positions ?? []),
    ...layout.waypoints.map((waypoint) => waypoint.position),
  ];
  if (!routeScene || positions.length === 0) {
    return;
  }
  const xs = positions.map((position) => position.x);
  const ys = positions.map((position) => position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  routeScene.camera.lookAt({
    target: {
      kind: "engine-local",
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: 0,
      frameId: "nasa-ammos",
    },
    rangeMeters: Math.max(2500, diagonal * 1.55),
    headingDegrees: 36,
    pitchDegrees: 63,
  });
}

function renderRouteSummary(handle: RouteFeatureHandle, sourceId: string): void {
  const routePlan = handle.routePlan;
  routeSummary.replaceChildren(
    summaryItem("Source", sourceId),
    summaryItem("Name", routePlan.routeInfo.name ?? routePlan.routeInfo.routeName ?? routePlan.id),
    summaryItem("Waypoints", String(routePlan.waypoints.length)),
    summaryItem("Legs", String(routePlan.legs.length)),
    summaryItem("Corridors", String(handle.layout.corridors.length)),
    summaryItem("Volumes", String(handle.layout.routeVolumes.length)),
  );
}

function initializeS102Controls(demoConfig: RtzRouteDemoConfig): void {
  toggles.s102.disabled = !demoConfig.s102.configured;
  renderS102Summary(demoConfig, demoConfig.s102.configured && toggles.s102.checked);
}

function renderS102Summary(
  demoConfig: RtzRouteDemoConfig,
  visible: boolean,
  statusOverride?: "failed",
): void {
  const status = statusOverride === "failed"
    ? "failed"
    : demoConfig.s102.configured
      ? visible ? "visible" : "hidden"
      : "not configured";
  const datasetLabel = demoConfig.s102.datasetIds.join(", ") || "none";
  s102Summary.replaceChildren(
    summaryItem("Status", status),
    summaryItem("CRS", demoConfig.scene.crs),
    summaryItem("Origin X", Math.round(demoConfig.scene.origin.x).toLocaleString()),
    summaryItem("Origin Y", Math.round(demoConfig.scene.origin.y).toLocaleString()),
    summaryItem("Datasets", datasetLabel),
    summaryItem(
      "Missing",
      demoConfig.s102.missing.length > 0 ? demoConfig.s102.missing.join(", ") : "none",
    ),
  );
}

function renderDiagnostics(
  handle: RouteFeatureHandle | null,
  error?: unknown,
): void {
  diagnosticsList.replaceChildren();
  if (error !== undefined) {
    diagnosticsList.append(diagnosticItem("error", errorMessage(error)));
    return;
  }

  const diagnostics = handle?.diagnostics ?? [];
  if (diagnostics.length === 0) {
    diagnosticsList.append(diagnosticItem("info", "No diagnostics."));
    return;
  }

  for (const diagnostic of diagnostics) {
    diagnosticsList.append(diagnosticItem(
      diagnostic.severity,
      `${diagnostic.code}: ${diagnostic.message}`,
    ));
  }
}

function summaryItem(label: string, value: string): HTMLElement {
  const item = document.createElement("div");
  item.className = "summary-item";
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  const valueElement = document.createElement("strong");
  valueElement.textContent = value;
  item.append(labelElement, valueElement);
  return item;
}

function diagnosticItem(severity: string, message: string): HTMLLIElement {
  const item = document.createElement("li");
  item.dataset.severity = severity;
  item.textContent = message;
  return item;
}

function setStatus(label: string, state: StatusState): void {
  statusPill.textContent = label;
  statusPill.dataset.state = state;
}

function setControlsEnabled(enabled: boolean): void {
  sampleButton.disabled = !enabled;
  fileInput.disabled = !enabled;
  for (const [key, toggle] of Object.entries(toggles)) {
    toggle.disabled = !enabled || (key === "s102" && !config.s102.configured);
  }
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}.`);
  }
  return element as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
