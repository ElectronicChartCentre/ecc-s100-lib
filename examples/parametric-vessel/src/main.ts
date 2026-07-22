import "./styles.css";
import {
  CameraControlPresets,
  SceneBuilder,
  VesselFeatureSession,
  createS100Viewer,
  type ParametricVesselSpec,
  type S100Scene,
  type S100Viewer,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

type ControlGroup =
  | "dimensions"
  | "layout"
  | "bridge"
  | "mast"
  | "transponder";

type ControlKey =
  | "bowMeters"
  | "sternMeters"
  | "portMeters"
  | "starboardMeters"
  | "draughtMeters"
  | "hullHeightMeters"
  | "deckThicknessMeters"
  | "bowLengthMeters"
  | "deckInsetMeters"
  | "bridgeLengthRatio"
  | "bridgeBeamRatio"
  | "bridgeHeightOverrideMeters"
  | "mastHeightOverrideMeters"
  | "mastRadiusMeters"
  | "transponderDistanceBelowMastTopMeters"
  | "transponderBeamMeters"
  | "transponderLengthMeters"
  | "transponderHeightMeters";

type ControlState = Record<ControlKey, number>;

type ControlDefinition = {
  key: ControlKey;
  group: ControlGroup;
  label: string;
  min: number | ((state: ControlState) => number);
  max: number | ((state: ControlState) => number);
  step: number;
  unit?: "meters" | "ratio";
};

type ControlElements = {
  slider: HTMLInputElement;
  number: HTMLInputElement;
  value: HTMLOutputElement;
};

const CRS = "EPSG:32633";
const CONTROL_UPDATE_DELAY_MS = 120;

const defaultState: ControlState = {
  bowMeters: 102,
  sternMeters: 18,
  portMeters: 12,
  starboardMeters: 12,
  draughtMeters: 6,
  hullHeightMeters: 10,
  deckThicknessMeters: 0.35,
  bowLengthMeters: 21.6,
  deckInsetMeters: 0.96,
  bridgeLengthRatio: 0.15,
  bridgeBeamRatio: 0.6,
  bridgeHeightOverrideMeters: 8.4,
  mastHeightOverrideMeters: 11.76,
  mastRadiusMeters: 0.42,
  transponderDistanceBelowMastTopMeters: 0,
  transponderBeamMeters: 2,
  transponderLengthMeters: 2,
  transponderHeightMeters: 0.25,
};

const controlDefinitions: readonly ControlDefinition[] = [
  { key: "bowMeters", group: "dimensions", label: "Bow", min: 1, max: 340, step: 0.5 },
  { key: "sternMeters", group: "dimensions", label: "Stern", min: 0, max: 120, step: 0.5 },
  { key: "portMeters", group: "dimensions", label: "Port", min: 0, max: 45, step: 0.25 },
  { key: "starboardMeters", group: "dimensions", label: "Starboard", min: 0, max: 45, step: 0.25 },
  { key: "draughtMeters", group: "dimensions", label: "Draught", min: 0.5, max: 25, step: 0.25 },
  { key: "hullHeightMeters", group: "dimensions", label: "Hull height", min: (state) => state.draughtMeters, max: 60, step: 0.25 },
  { key: "deckThicknessMeters", group: "dimensions", label: "Deck thickness", min: 0.05, max: 3, step: 0.05 },
  { key: "bowLengthMeters", group: "layout", label: "Bow section", min: 1, max: (state) => vesselLength(state) * 0.45, step: 0.5 },
  { key: "deckInsetMeters", group: "layout", label: "Deck inset", min: 0, max: (state) => vesselBeam(state) * 0.33, step: 0.1 },
  {
    key: "bridgeLengthRatio",
    group: "bridge",
    label: "Length ratio",
    min: 0.05,
    max: 1,
    step: 0.01,
    unit: "ratio",
  },
  {
    key: "bridgeBeamRatio",
    group: "bridge",
    label: "Beam ratio",
    min: 0.1,
    max: 1,
    step: 0.01,
    unit: "ratio",
  },
  { key: "bridgeHeightOverrideMeters", group: "bridge", label: "Height", min: 1, max: 35, step: 0.25 },
  { key: "mastHeightOverrideMeters", group: "mast", label: "Height", min: 1, max: 45, step: 0.25 },
  { key: "mastRadiusMeters", group: "mast", label: "Radius", min: 0.05, max: (state) => vesselBeam(state) * 0.125, step: 0.025 },
  {
    key: "transponderDistanceBelowMastTopMeters",
    group: "transponder",
    label: "Below mast top",
    min: 0,
    max: (state) => state.mastHeightOverrideMeters,
    step: 0.25,
  },
  { key: "transponderBeamMeters", group: "transponder", label: "Beam", min: 0.1, max: (state) => vesselBeam(state) * 0.5, step: 0.05 },
  { key: "transponderLengthMeters", group: "transponder", label: "Length", min: 0.1, max: (state) => vesselBeam(state) * 0.5, step: 0.05 },
  { key: "transponderHeightMeters", group: "transponder", label: "Height", min: 0.05, max: 3, step: 0.05 },
];

const viewerElement = getElement<HTMLElement>("viewer");
const statusPill = getElement<HTMLElement>("status-pill");
const resetButton = getElement<HTMLButtonElement>("reset-button");
const specPreview = getElement<HTMLPreElement>("spec-preview");
const derivedValues = getElement<HTMLElement>("derived-values");
const controlContainers: Record<ControlGroup, HTMLElement> = {
  dimensions: getElement("dimension-controls"),
  layout: getElement("layout-controls"),
  bridge: getElement("bridge-controls"),
  mast: getElement("mast-controls"),
  transponder: getElement("transponder-controls"),
};
const controls = new Map<ControlKey, ControlElements>();

let state: ControlState = { ...defaultState };
let viewer: S100Viewer | null = null;
let scene: S100Scene | null = null;
let vessel: VesselFeatureSession | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let rebuildInFlight = false;
let pendingSpec: ParametricVesselSpec | null = null;

renderControls();
syncControls();
setStatus("Starting", "busy");
void startDemo();

resetButton.addEventListener("click", () => {
  state = { ...defaultState };
  syncControls();
  scheduleVesselRebuild();
});

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
        app: "@ecc/s100-parametric-vessel-demo",
      },
    });
    scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: CRS,
        origin: { x: 0, y: 0, z: 0 },
      }),
    });
    scene.environment.setState({
      background: "solid",
      lighting: {
        ambientIntensity: 0.12,
        directionalIntensity: 0.18,
      },
    });
    scene.camera.lookAt({
      target: { kind: "projected", crs: CRS, x: 0, y: 0, z: 0 },
      rangeMeters: 260,
      headingDegrees: 40,
      pitchDegrees: 62,
    });
    await rebuildVessel(buildSpec());
    setStatus("Ready", "ready");
  } catch (error) {
    setStatus(errorMessage(error), "error");
  }
}

async function destroyDemo(): Promise<void> {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  await vessel?.dispose();
  vessel = null;
  await viewer?.destroy();
  viewer = null;
  scene = null;
}

function renderControls(): void {
  for (const definition of controlDefinitions) {
    const row = document.createElement("label");
    row.className = "parameter-row";

    const title = document.createElement("span");
    title.className = "parameter-row__label";
    title.textContent = definition.label;

    const slider = document.createElement("input");
    slider.type = "range";

    const number = document.createElement("input");
    number.type = "number";

    const value = document.createElement("output");
    value.className = "parameter-row__value";

    slider.addEventListener("input", () => {
      updateStateFromInput(definition, Number(slider.value));
    });
    number.addEventListener("input", () => {
      updateStateFromInput(definition, Number(number.value));
    });

    row.append(title, slider, number, value);
    controlContainers[definition.group].append(row);
    controls.set(definition.key, { slider, number, value });
  }
}

function updateStateFromInput(definition: ControlDefinition, value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }
  state = sanitizeState({
    ...state,
    [definition.key]: value,
  });
  syncControls();
  scheduleVesselRebuild();
}

function syncControls(): void {
  state = sanitizeState(state);
  for (const definition of controlDefinitions) {
    const elements = controls.get(definition.key);
    if (!elements) {
      continue;
    }
    const min = resolveBound(definition.min, state);
    const max = resolveBound(definition.max, state);
    const value = state[definition.key];
    elements.slider.min = formatNumber(min);
    elements.slider.max = formatNumber(max);
    elements.slider.step = String(definition.step);
    elements.slider.value = formatNumber(value);
    elements.number.min = formatNumber(min);
    elements.number.max = formatNumber(max);
    elements.number.step = String(definition.step);
    elements.number.value = formatNumber(value);
    elements.value.value = formatControlValue(value, definition);
    elements.value.textContent = elements.value.value;
  }
  renderDerivedValues();
  renderSpecPreview();
}

function scheduleVesselRebuild(): void {
  pendingSpec = buildSpec();
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
  }
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    void flushVesselRebuild();
  }, CONTROL_UPDATE_DELAY_MS);
}

async function flushVesselRebuild(): Promise<void> {
  if (rebuildInFlight || !pendingSpec) {
    return;
  }
  rebuildInFlight = true;
  try {
    while (pendingSpec) {
      const spec = pendingSpec;
      pendingSpec = null;
      setStatus("Updating", "busy");
      await rebuildVessel(spec);
    }
    setStatus("Ready", "ready");
  } catch (error) {
    setStatus(errorMessage(error), "error");
  } finally {
    rebuildInFlight = false;
    if (pendingSpec) {
      void flushVesselRebuild();
    }
  }
}

async function rebuildVessel(spec: ParametricVesselSpec): Promise<void> {
  if (!scene) {
    return;
  }
  const pose = vessel?.getPose() ?? {
    position: { kind: "projected" as const, crs: CRS, x: 0, y: 0, z: 0 },
    headingDegrees: 35,
  };
  await vessel?.dispose();
  vessel = await VesselFeatureSession.add({
    scene,
    parametric: spec,
    pose,
    constraints: {
      vertical: {
        minMeters: -120,
        maxMeters: "draught",
        reference: "sea-level",
      },
    },
    style: {
      transformControls: "translate",
      transformGizmo: {
        enabled: true,
        mode: "translate",
        sizeMeters: 35,
      },
      showOceanSurface: true,
      oceanSurface: true,
      shadow: true,
    },
  });
}

function buildSpec(): ParametricVesselSpec {
  const safe = sanitizeState(state);
  return {
    template: "generic-straight-edge",
    dimensions: {
      draught: safe.draughtMeters,
      bow: safe.bowMeters,
      stern: safe.sternMeters,
      port: safe.portMeters,
      starboard: safe.starboardMeters,
      hullHeightMeters: safe.hullHeightMeters,
      deckThicknessMeters: safe.deckThicknessMeters,
    },
    assembly: {
      style: "straight-edge",
      hullCrossSection: "rectangular",
    },
    layout: {
      bowLengthMeters: safe.bowLengthMeters,
      deckInsetMeters: safe.deckInsetMeters,
      bridge: {
        lengthRatio: safe.bridgeLengthRatio,
        beamRatio: safe.bridgeBeamRatio,
        heightMeters: safe.bridgeHeightOverrideMeters,
      },
      mast: {
        heightMeters: safe.mastHeightOverrideMeters,
        radiusMeters: safe.mastRadiusMeters,
      },
      transponder: {
        distanceBelowMastTopMeters: safe.transponderDistanceBelowMastTopMeters,
        beamMeters: safe.transponderBeamMeters,
        lengthMeters: safe.transponderLengthMeters,
        heightMeters: safe.transponderHeightMeters,
      },
    },
    colors: {
      hull: "#cc1400",
      deck: "#858b90",
      superstructure: "#eeeeea",
      mast: "#003fc8",
      transponder: "#18b600",
    },
  };
}

function sanitizeState(input: ControlState): ControlState {
  const next = { ...input };
  next.bowMeters = clampToDefinition("bowMeters", next.bowMeters, next);
  next.sternMeters = clampToDefinition("sternMeters", next.sternMeters, next);
  next.portMeters = clampToDefinition("portMeters", next.portMeters, next);
  next.starboardMeters = clampToDefinition("starboardMeters", next.starboardMeters, next);
  if (vesselBeam(next) <= 0) {
    next.starboardMeters = 1;
  }
  next.draughtMeters = clampToDefinition("draughtMeters", next.draughtMeters, next);
  next.hullHeightMeters = clampToDefinition("hullHeightMeters", next.hullHeightMeters, next);
  next.deckThicknessMeters = clampToDefinition("deckThicknessMeters", next.deckThicknessMeters, next);
  for (const definition of controlDefinitions) {
    next[definition.key] = clampToDefinition(definition.key, next[definition.key], next);
  }
  return next;
}

function clampToDefinition(
  key: ControlKey,
  value: number,
  stateForBounds: ControlState,
): number {
  const definition = controlDefinitions.find((candidate) => candidate.key === key);
  if (!definition) {
    return value;
  }
  return clamp(
    value,
    resolveBound(definition.min, stateForBounds),
    resolveBound(definition.max, stateForBounds),
  );
}

function vesselLength(state: ControlState): number {
  return state.bowMeters + state.sternMeters;
}

function vesselBeam(state: ControlState): number {
  return state.portMeters + state.starboardMeters;
}

function vesselHullHeight(state: ControlState): number {
  return state.hullHeightMeters;
}

function vesselFreeboard(state: ControlState): number {
  return state.hullHeightMeters - state.draughtMeters;
}

function aisReference(state: ControlState): {
  centerFromSternMeters: number;
  lateralFromCenterMeters: number;
} {
  return {
    centerFromSternMeters: state.sternMeters,
    lateralFromCenterMeters: (state.portMeters - state.starboardMeters) / 2,
  };
}

function renderDerivedValues(): void {
  const reference = aisReference(state);
  derivedValues.replaceChildren(
    derivedValue("Length", vesselLength(state)),
    derivedValue("Beam", vesselBeam(state)),
    derivedValue("Freeboard", vesselFreeboard(state)),
    derivedValue("Total height", vesselHullHeight(state) + state.mastHeightOverrideMeters),
    derivedValue("Antenna from stern", reference.centerFromSternMeters),
    derivedValue("Antenna lateral", reference.lateralFromCenterMeters),
  );
}

function derivedValue(label: string, value: number): HTMLElement {
  const container = document.createElement("div");
  container.className = "derived-value";
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  const valueElement = document.createElement("strong");
  valueElement.textContent = `${formatNumber(value)} m`;
  container.append(labelElement, valueElement);
  return container;
}

function renderSpecPreview(): void {
  specPreview.textContent = JSON.stringify(buildSpec(), null, 2);
}

function resolveBound(
  bound: number | ((state: ControlState) => number),
  value: ControlState,
): number {
  return typeof bound === "function" ? bound(value) : bound;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function formatControlValue(value: number, definition: ControlDefinition): string {
  if (definition.unit === "ratio") {
    return `${formatNumber(value * 100)}%`;
  }
  return `${formatNumber(value)} m`;
}

function setStatus(message: string, state: "busy" | "ready" | "error"): void {
  statusPill.textContent = message;
  statusPill.dataset.state = state;
  resetButton.disabled = state === "busy" && !viewer;
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
