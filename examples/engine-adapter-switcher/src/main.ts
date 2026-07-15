import "cesium/Build/Cesium/Widgets/widgets.css";
import "./styles.css";
import type { EngineCameraPose } from "@ecc/s100-viewer";
import { formatCameraPose, formatCapabilities } from "./capabilityPanel";
import { allEngineDefinitions, getEngineDefinition } from "./engineRegistry";
import { allSceneRecipes, getSceneRecipe } from "./sceneRecipes";
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
const logPanel = getElement<HTMLOListElement>("log-panel");

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
    });

    if (currentRun !== rebuildCounter) {
      await session.destroy();
      return;
    }

    activeSession = session;
    capabilityPanel.textContent = formatCapabilities(session.adapter, session.recipeSupport);
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
  statusPill.textContent = message;
  statusPill.dataset.state = isBusy ? "busy" : message === "Failed" ? "error" : "ready";
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
