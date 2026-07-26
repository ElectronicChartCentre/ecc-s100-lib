import "cesium/Build/Cesium/Widgets/widgets.css";
import "./styles.css";
import type { EngineCameraPose } from "@ecc/s100-viewer";
import type { LiveAisVessel, LiveVesselFeedVesselState } from "@ecc/s100-viewer/products/vessel";
import { formatCameraPose, formatCapabilities } from "./capabilityPanel";
import { getDemoLiveAisConfig } from "./demoConfig";
import { allEngineDefinitions, getEngineDefinition } from "./engineRegistry";
import {
  inactiveLiveAisStatus,
  type LiveAisDemoStatus,
} from "./liveAisDemo";
import { allSceneRecipes, getSceneRecipe } from "./sceneRecipes";
import { createSceneControlPanel } from "./sceneControls";
import {
  createViewerSession,
  destroyViewerSession,
  type DemoLogLevel,
  type ViewerSession,
} from "./viewerLifecycle";

const viewerElement = getElement<HTMLElement>("viewer");
const engineSelect = getElement<HTMLSelectElement>("engine-select");
const recipeSelect = getElement<HTMLSelectElement>("recipe-select");
const reloadButton = getElement<HTMLButtonElement>("reload-button");
const statusPill = getElement<HTMLElement>("status-pill");
const capabilityPanel = getElement<HTMLElement>("capability-panel");
const cameraPanel = getElement<HTMLElement>("camera-panel");
const controlPanel = getElement<HTMLElement>("control-panel");
const liveAisStatusPanel = getElement<HTMLElement>("live-ais-status");
const liveAisSelectionPanel = getElement<HTMLElement>("live-ais-selection");
const logPanel = getElement<HTMLOListElement>("log-panel");
const sceneControlPanel = createSceneControlPanel({
  root: controlPanel,
  viewerElement,
  log: appendLog,
});

let activeSession: ViewerSession | null = null;
let lastCameraPose: EngineCameraPose | null = null;
let rebuildCounter = 0;

for (const engine of allEngineDefinitions) {
  engineSelect.append(new Option(engine.label, engine.id));
}

for (const recipe of allSceneRecipes) {
  recipeSelect.append(new Option(recipe.label, recipe.id));
}

engineSelect.value = "nasa-ammos";
recipeSelect.value = "minimal";
capabilityPanel.textContent = formatCapabilities(null, null);
cameraPanel.textContent = formatCameraPose(null);
resetLiveAisStatus();
resetLiveAisSelection();

reloadButton.addEventListener("click", () => {
  void rebuild();
});
engineSelect.addEventListener("change", () => {
  void rebuild();
});
recipeSelect.addEventListener("change", () => {
  void rebuild();
});

window.addEventListener("beforeunload", () => {
  void destroyViewerSession(activeSession);
});

void rebuild();

async function rebuild(): Promise<void> {
  const currentRun = ++rebuildCounter;
  const engine = getEngineDefinition(engineSelect.value);
  const recipe = getSceneRecipe(recipeSelect.value);

  setBusy(true, `Loading ${engine.label}`);
  appendLog("info", `Starting ${engine.label} with ${recipe.label}.`);

  const previousSession = activeSession;
  activeSession = null;
  sceneControlPanel.bind(null);
  try {
    await destroyViewerSession(previousSession);
  } catch (error) {
    appendLog("warn", `Previous viewer teardown reported: ${errorMessage(error)}`);
  } finally {
    viewerElement.replaceChildren();
  }
  lastCameraPose = null;
  cameraPanel.textContent = formatCameraPose(null);
  capabilityPanel.textContent = formatCapabilities(null, null);
  resetLiveAisStatus();
  resetLiveAisSelection();

  try {
    const session = await createViewerSession({
      container: viewerElement,
      engine,
      recipe,
      log: appendLog,
      onCameraPose(pose) {
        lastCameraPose = pose;
        cameraPanel.textContent = formatCameraPose(lastCameraPose);
      },
      onLiveAisStatus: renderLiveAisStatus,
      onLiveAisSelection: renderLiveAisSelection,
    });

    if (currentRun !== rebuildCounter) {
      await session.destroy();
      return;
    }

    activeSession = session;
    capabilityPanel.textContent = formatCapabilities(session.adapter, session.recipeSupport);
    sceneControlPanel.bind(session);
    setBusy(false, `${session.adapter.displayName} ready`);
    appendLog("info", `${recipe.label} loaded on ${session.adapter.displayName}.`);
  } catch (error) {
    if (currentRun !== rebuildCounter) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    setBusy(false, "Failed");
    appendLog("error", message);
  }
}

function appendLog(level: DemoLogLevel, message: string): void {
  const item = document.createElement("li");
  item.className = `log-list__item log-list__item--${level}`;

  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString();

  const body = document.createElement("span");
  body.textContent = message;

  item.append(time, body);
  logPanel.prepend(item);

  while (logPanel.children.length > 80) {
    logPanel.lastElementChild?.remove();
  }
}

function setBusy(isBusy: boolean, message: string): void {
  reloadButton.disabled = isBusy;
  engineSelect.disabled = isBusy;
  recipeSelect.disabled = isBusy;
  sceneControlPanel.setDisabled(isBusy);
  statusPill.textContent = message;
  statusPill.dataset.state = isBusy ? "busy" : message === "Failed" ? "error" : "ready";
}

function resetLiveAisStatus(): void {
  renderLiveAisStatus(inactiveLiveAisStatus(getDemoLiveAisConfig().proxyUrl !== null));
}

function resetLiveAisSelection(): void {
  renderLiveAisSelection(null);
}

function renderLiveAisStatus(status: LiveAisDemoStatus): void {
  liveAisStatusPanel.dataset.state = status.state;
  liveAisStatusPanel.replaceChildren();

  const message = document.createElement("div");
  message.className = "live-ais-status__message";
  message.textContent = status.message;
  liveAisStatusPanel.append(message);

  liveAisStatusPanel.append(
    createStatusRow("Proxy", status.configured ? "configured" : "missing"),
  );

  if (status.state === "ready" || status.state === "outside-coverage") {
    liveAisStatusPanel.append(
      createStatusRow("Vessels", String(status.vesselCount)),
      createStatusRow("Coverage", status.sceneIntersectsCoverage ? "inside" : "outside"),
      createStatusRow("Fetched", formatStatusTime(status.latestFetchTime)),
      createStatusRow(
        "Upstream",
        status.upstreamFetchedAt ? formatStatusTime(status.upstreamFetchedAt) : "not fetched",
      ),
      createStatusRow("Cache", status.servedFromWarmCache ? "warm" : "fresh"),
    );
    if (status.warnings.length > 0) {
      liveAisStatusPanel.append(createStatusRow("Warning", status.warnings[0] ?? ""));
    }
  }
}

function renderLiveAisSelection(selection: LiveVesselFeedVesselState | null): void {
  liveAisSelectionPanel.replaceChildren();
  if (!selection) {
    const message = document.createElement("div");
    message.className = "live-ais-details__message";
    message.textContent = "No vessel selected.";
    liveAisSelectionPanel.append(message);
    return;
  }

  const vessel = selection.vessel;
  const dimensions = selection.dimensions;
  liveAisSelectionPanel.append(
    createDetailsRow("Name", vessel.name ?? "unknown"),
    createDetailsRow("MMSI", String(vessel.mmsi)),
    createOptionalDetailsRow("Call sign", vessel.callSign),
    createOptionalDetailsRow("IMO", vessel.imoNumber !== undefined ? String(vessel.imoNumber) : undefined),
    createOptionalDetailsRow("Type", formatShipType(vessel.shipType)),
    createOptionalDetailsRow("Status", vessel.navigationalStatus !== undefined
      ? String(vessel.navigationalStatus)
      : undefined),
    createDetailsRow("Dimensions", `${formatMeters(dimensions.bow + dimensions.stern)} x ${formatMeters(dimensions.port + dimensions.starboard)}`),
    createDetailsRow("A/B/C/D", `${formatMeters(dimensions.bow)} / ${formatMeters(dimensions.stern)} / ${formatMeters(dimensions.port)} / ${formatMeters(dimensions.starboard)}`),
    createDetailsRow("Draught", formatDraught(selection)),
    createDetailsRow("Draught source", vessel.draughtMeters !== undefined
      ? "AIS service"
      : "Estimated; service did not provide draught"),
    createOptionalDetailsRow("Heading", formatDegrees(vessel.headingDegrees)),
    createOptionalDetailsRow("Course", formatDegrees(vessel.courseOverGroundDegrees)),
    createOptionalDetailsRow("Speed", vessel.speedOverGroundKnots !== undefined
      ? `${formatNumber(vessel.speedOverGroundKnots, 1)} kn`
      : undefined),
    createDetailsRow("Position", formatVesselPosition(vessel)),
    createDetailsRow("Reported", formatStatusTime(vessel.messageTime)),
    createOptionalDetailsRow("Stream", vessel.stream),
  );
}

function createStatusRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "live-ais-status__row";

  const rowLabel = document.createElement("span");
  rowLabel.className = "live-ais-status__label";
  rowLabel.textContent = label;

  const rowValue = document.createElement("span");
  rowValue.className = "live-ais-status__value";
  rowValue.textContent = value;

  row.append(rowLabel, rowValue);
  return row;
}

function createDetailsRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "live-ais-details__row";

  const rowLabel = document.createElement("span");
  rowLabel.className = "live-ais-details__label";
  rowLabel.textContent = label;

  const rowValue = document.createElement("span");
  rowValue.className = "live-ais-details__value";
  rowValue.textContent = value;

  row.append(rowLabel, rowValue);
  return row;
}

function createOptionalDetailsRow(label: string, value: string | undefined): HTMLElement {
  return createDetailsRow(label, value ?? "n/a");
}

function formatStatusTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleTimeString();
}

function formatVesselPosition(vessel: LiveAisVessel): string {
  return `${formatNumber(vessel.position.latitude, 5)}, ${formatNumber(vessel.position.longitude, 5)}`;
}

function formatShipType(value: number | undefined): string | undefined {
  return value !== undefined ? String(value) : undefined;
}

function formatMeters(value: number): string {
  return `${formatNumber(value, 1)} m`;
}

function formatDraught(selection: LiveVesselFeedVesselState): string {
  const suffix = selection.vessel.draughtMeters !== undefined ? "" : " estimated";
  return `${formatMeters(selection.dimensions.draught)}${suffix}`;
}

function formatDegrees(value: number | undefined): string | undefined {
  return value !== undefined ? `${formatNumber(value, 1)} deg` : undefined;
}

function formatNumber(value: number, fractionDigits: number): string {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : "n/a";
}

function getElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }

  return element as TElement;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
