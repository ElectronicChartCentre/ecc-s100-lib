import "./styles.css";
import {
  CameraControlPresets,
  EncStandard,
  SceneBuilder,
  createS100Viewer,
  type S100Scene,
  type S100Unsubscribe,
  type S100Viewer,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";
import {
  createFeatureSessions,
  type FeatureSessions,
} from "../main";
import {
  configuredValue,
  createGettingStartedEncAvailabilityRequests,
  missingSessionConfig,
  projectBoundsAroundSceneOrigin,
  readGettingStartedConfig,
  type GettingStartedConfig,
} from "./config";

type LogLevel = "info" | "warn" | "error";

type ActiveGettingStartedApp = {
  viewer: S100Viewer;
  sessions: FeatureSessions | null;
  unsubscribers: S100Unsubscribe[];
};

const viewerElement = getElement<HTMLElement>("viewer");
const loadButton = getElement<HTMLButtonElement>("load-button");
const disposeButton = getElement<HTMLButtonElement>("dispose-button");
const statusPill = getElement<HTMLElement>("status-pill");
const configPanel = getElement<HTMLDListElement>("config-panel");
const logPanel = getElement<HTMLOListElement>("log-panel");
const encToggle = getElement<HTMLInputElement>("enc-toggle");
const encPreference = getElement<HTMLSelectElement>("enc-preference");
const timeSlider = getElement<HTMLInputElement>("time-slider");
const timeOutput = getElement<HTMLOutputElement>("time-output");

let activeApp: ActiveGettingStartedApp | null = null;
let loadCounter = 0;

renderConfig(readGettingStartedConfig());
setControlsEnabled(false);
setStatus("Idle", "idle");

loadButton.addEventListener("click", () => {
  void loadGettingStartedApp();
});

disposeButton.addEventListener("click", () => {
  void disposeGettingStartedApp();
});

window.addEventListener("beforeunload", () => {
  void disposeGettingStartedApp();
});

async function loadGettingStartedApp(): Promise<void> {
  const currentRun = ++loadCounter;
  const config = readGettingStartedConfig();

  setStatus("Loading", "busy");
  setControlsEnabled(false);
  await disposeGettingStartedApp({ keepLog: true, supersedeLoad: false });
  viewerElement.replaceChildren();
  renderConfig(config);
  appendLog("info", "Creating viewer.");

  try {
    const viewer = await createS100Viewer({
      container: viewerElement,
      adapter: createNasaAmmosAdapter(),
      cameraControls: CameraControlPresets.S100_DEFAULT,
      metadata: {
        app: "@ecc/s100-getting-started",
      },
    });

    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: config.crs,
        origin: config.origin,
      }),
    });

    if (currentRun !== loadCounter) {
      await viewer.destroy();
      return;
    }

    activeApp = {
      viewer,
      sessions: null,
      unsubscribers: [
        scene.events.on("error", (error) => {
          appendLog("error", error.message);
        }),
      ],
    };

    scene.environment.setState({
      background: "solid",
      lighting: {
        ambientIntensity: 0.08,
        directionalIntensity: 0.1,
      },
    });
    lookAtScene(scene, config);

    const missing = missingSessionConfig(config);
    if (missing.length > 0) {
      setStatus("Viewer ready", "ready");
      appendLog("warn", `Session loading skipped. Missing ${missing.join(", ")}.`);
      disposeButton.disabled = false;
      return;
    }

    appendLog("info", "Creating feature sessions.");
    const sessions = await createFeatureSessions({
      scene,
      crs: config.crs,
      licenseeKey: configuredValue(config.licenseeKey, "licenseeKey"),
      sceneBounds: config.sceneBounds,
      mapCenter: {
        easting: config.origin.x,
        northing: config.origin.y,
        epsgCrs: config.crs,
      },
      mapWidthMeters: config.mapWidthMeters,
      endpoints: {
        s102Tiles: configuredValue(config.endpoints.s102Tiles, "s102Tiles"),
        s111: configuredValue(config.endpoints.s111, "s111"),
        encWmsBaseUrl: configuredValue(
          config.endpoints.encWmsBaseUrl,
          "encWmsBaseUrl",
        ),
        s57WmsTemplatePath: configuredValue(
          config.endpoints.s57WmsTemplatePath,
          "s57WmsTemplatePath",
        ),
      },
      apiKeys: {
        s102Tiles: configuredValue(config.apiKeys.s102Tiles, "s102TilesApiKey"),
      },
      encAvailabilityRequests: createGettingStartedEncAvailabilityRequests(),
      datasets: config.datasets,
      projectBounds: projectBoundsAroundSceneOrigin(config),
      onS111Status: (statuses) => {
        for (const status of statuses) {
          appendLog(
            status.status === "success" ? "info" : "warn",
            `S-111 ${status.datasetId}: ${status.status}`,
          );
        }
      },
      onS111Timeline: (timeline) => {
        configureTimeline(timeline?.times ?? []);
      },
    });

    if (currentRun !== loadCounter) {
      await sessions.dispose();
      await viewer.destroy();
      return;
    }

    activeApp.sessions = sessions;
    bindControls(sessions);
    configureTimeline(sessions.currents.timeline?.times ?? []);
    setControlsEnabled(true);
    disposeButton.disabled = false;
    setStatus("Ready", "ready");
    appendLog("info", "Feature sessions ready.");
  } catch (error) {
    setStatus("Failed", "error");
    appendLog("error", errorMessage(error));
    await disposeGettingStartedApp({ keepLog: true });
  }
}

async function disposeGettingStartedApp(
  options: { keepLog?: boolean; supersedeLoad?: boolean } = {},
): Promise<void> {
  if (options.supersedeLoad !== false) {
    loadCounter += 1;
  }
  const app = activeApp;
  activeApp = null;
  setControlsEnabled(false);
  disposeButton.disabled = true;

  if (!app) {
    return;
  }

  for (const unsubscribe of app.unsubscribers.splice(0)) {
    unsubscribe();
  }
  await app.sessions?.dispose();
  await app.viewer.destroy();
  if (!options.keepLog) {
    appendLog("info", "Disposed viewer and feature sessions.");
    setStatus("Disposed", "idle");
  }
}

function bindControls(sessions: FeatureSessions): void {
  encToggle.checked = false;
  encToggle.onchange = () => {
    void sessions.setEncVisible(encToggle.checked);
  };

  encPreference.value = EncStandard.S101;
  encPreference.onchange = () => {
    const preferred =
      encPreference.value === EncStandard.S57
        ? [EncStandard.S57, EncStandard.S101]
        : [EncStandard.S101, EncStandard.S57];
    void sessions.setEncPreference(preferred);
  };
}

function configureTimeline(times: readonly number[]): void {
  if (times.length === 0) {
    timeSlider.min = "0";
    timeSlider.max = "0";
    timeSlider.value = "0";
    timeSlider.disabled = true;
    timeOutput.value = "No timeline";
    timeOutput.textContent = "No timeline";
    return;
  }

  timeSlider.min = "0";
  timeSlider.max = String(times.length - 1);
  timeSlider.value = "0";
  timeSlider.disabled = activeApp?.sessions === null;
  timeOutput.value = formatTime(times[0] ?? 0);
  timeOutput.textContent = timeOutput.value;
  timeSlider.oninput = () => {
    const index = Number(timeSlider.value);
    const time = times[index] ?? times[0];
    if (time === undefined) {
      return;
    }
    activeApp?.sessions?.setCurrentTime(time);
    timeOutput.value = formatTime(time);
    timeOutput.textContent = timeOutput.value;
  };
}

function lookAtScene(scene: S100Scene, config: GettingStartedConfig): void {
  try {
    scene.camera.lookAt({
      target: {
        kind: "projected",
        crs: config.crs,
        x: config.origin.x,
        y: config.origin.y,
        z: config.origin.z,
      },
      rangeMeters: config.mapWidthMeters / 5,
      headingDegrees: 25,
      pitchDegrees: 62,
    });
  } catch (error) {
    appendLog("warn", `Camera look-at skipped: ${errorMessage(error)}`);
  }
}

function setControlsEnabled(enabled: boolean): void {
  encToggle.disabled = !enabled;
  encPreference.disabled = !enabled;
  timeSlider.disabled = !enabled || timeSlider.max === "0";
}

function renderConfig(config: GettingStartedConfig): void {
  const missing = missingSessionConfig(config);
  const rows: readonly [string, string][] = [
    ["CRS", config.crs],
    ["Origin", `${config.origin.x}, ${config.origin.y}`],
    ["S-102", config.datasets.visibleS102Ids.join(", ") || "not configured"],
    ["S-111", config.datasets.visibleS111Ids.join(", ") || "not configured"],
    ["ENC WMS", config.endpoints.encWmsBaseUrl ? "configured" : "not configured"],
    ["Missing", missing.length > 0 ? missing.join(", ") : "none"],
  ];

  configPanel.replaceChildren();
  for (const [key, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = key;
    const description = document.createElement("dd");
    description.textContent = value;
    description.title = value;
    configPanel.append(term, description);
  }
}

function appendLog(level: LogLevel, message: string): void {
  const item = document.createElement("li");
  item.className = `log-list__item log-list__item--${level}`;

  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString();

  const body = document.createElement("span");
  body.textContent = message;

  item.append(time, body);
  logPanel.prepend(item);

  while (logPanel.children.length > 50) {
    logPanel.lastElementChild?.remove();
  }
}

function setStatus(message: string, state: "idle" | "busy" | "ready" | "error"): void {
  statusPill.textContent = message;
  statusPill.dataset.state = state;
  loadButton.disabled = state === "busy";
}

function formatTime(time: number): string {
  return new Date(time).toISOString();
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
