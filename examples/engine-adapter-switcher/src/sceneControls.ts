import {
  S100ProductType,
  type Coordinate,
  type S100Layer,
  type S100Scene,
  type WaterLevelFieldSample,
} from "@ecc/s100-viewer";
import { getS104DemoBinding } from "./s104Demo";
import type { DemoLogSink, ViewerSession } from "./viewerLifecycle";

export type SceneControlPanel = {
  bind(session: ViewerSession | null): void;
  destroy(): void;
  setDisabled(disabled: boolean): void;
};

export type CreateSceneControlPanelOptions = {
  root: HTMLElement;
  viewerElement: HTMLElement;
  log: DemoLogSink;
};

const defaultS111PlaybackRate = 10;
const defaultS104PlaybackRate = 2;
const minSafetyDepthMeters = 0;
const maxSafetyDepthMeters = 30;
const minPlaybackRate = 1;
const maxPlaybackRate = 20;

let nextControlId = 1;

export const createSceneControlPanel = (
  options: CreateSceneControlPanelOptions,
): SceneControlPanel => {
  const root = options.root;
  const viewerElement = options.viewerElement;
  const log = options.log;
  let cleanupCallbacks: Array<() => void> = [];
  let controlledElements: Array<HTMLInputElement | HTMLButtonElement> = [];
  let disabled = false;

  const cleanup = (): void => {
    for (const callback of cleanupCallbacks.splice(0)) {
      callback();
    }
    controlledElements = [];
  };

  const setCurrentControlsDisabled = (): void => {
    for (const element of controlledElements) {
      element.disabled = disabled;
    }
  };

  const bind = (session: ViewerSession | null): void => {
    cleanup();
    root.replaceChildren();

    if (!session) {
      root.append(createEmptyState("No active scene."));
      return;
    }

    const groups = [
      createEncTransparencyControl(session.scene, log, cleanupCallbacks, controlledElements),
      createTerrainDepthControl(session.scene, log, cleanupCallbacks, controlledElements),
      createS104WaterLevelControl(session.scene, viewerElement, log, cleanupCallbacks, controlledElements),
      createS104TimeControl(session.scene, cleanupCallbacks, controlledElements),
      createS111TimeControl(session.scene, cleanupCallbacks, controlledElements),
    ].filter((group): group is HTMLElement => group !== null);

    if (groups.length === 0) {
      root.append(createEmptyState("No adjustable controls for this scene."));
      return;
    }

    root.append(...groups);
    setCurrentControlsDisabled();
  };

  return {
    bind,
    destroy() {
      cleanup();
      root.replaceChildren();
    },
    setDisabled(nextDisabled: boolean) {
      disabled = nextDisabled;
      setCurrentControlsDisabled();
    },
  };
};

const createEncTransparencyControl = (
  scene: S100Scene,
  log: DemoLogSink,
  cleanupCallbacks: Array<() => void>,
  controlledElements: Array<HTMLInputElement | HTMLButtonElement>,
): HTMLElement | null => {
  const encLayers = scene.layers.all().filter(isEncMapLayer);
  if (encLayers.length === 0) {
    return null;
  }

  const currentAlpha = clamp01(encLayers[0]?.opacity ?? encLayers[0]?.spec.opacity ?? 1);
  const currentTransparency = Math.round((1 - currentAlpha) * 100);
  const control = createRangeControl({
    label: "ENC transparency",
    min: 0,
    max: 100,
    step: 1,
    value: currentTransparency,
    formatValue: (value) => `${Math.round(value)}%`,
  });
  const applyTransparency = createLatestMutation<number>(
    async (transparency) => {
      const alpha = 1 - clamp(transparency, 0, 100) / 100;
      await Promise.all(encLayers.map((layer) => layer.controllers.map?.setAlpha(alpha)));
    },
    (error) => log("error", `ENC transparency update failed: ${errorMessage(error)}`),
  );

  control.input.addEventListener("input", () => {
    const value = readNumericInput(control.input, currentTransparency);
    control.value.textContent = control.formatValue(value);
    applyTransparency(value);
  });
  cleanupCallbacks.push(() => {
    control.input.replaceWith(control.input.cloneNode(true));
  });
  controlledElements.push(control.input);

  return control.element;
};

const createTerrainDepthControl = (
  scene: S100Scene,
  log: DemoLogSink,
  cleanupCallbacks: Array<() => void>,
  controlledElements: Array<HTMLInputElement | HTMLButtonElement>,
): HTMLElement | null => {
  const terrainLayer = scene.layers.all().find((layer) => layer.controllers.terrain);
  const terrainController = terrainLayer?.controllers.terrain;
  if (!terrainController) {
    return null;
  }

  const initialDepth = clamp(
    terrainController.terrain.safetyDepthMeters,
    minSafetyDepthMeters,
    maxSafetyDepthMeters,
  );
  const control = createRangeControl({
    label: "Safety depth",
    min: minSafetyDepthMeters,
    max: maxSafetyDepthMeters,
    step: 0.5,
    value: initialDepth,
    formatValue: (value) => `${value.toFixed(1)} m`,
  });
  const applyDepth = createLatestMutation<number>(
    async (depth) => {
      await terrainController.setSafetyDepthMeters(depth);
    },
    (error) => log("error", `Safety depth update failed: ${errorMessage(error)}`),
  );

  control.input.addEventListener("input", () => {
    const value = readNumericInput(control.input, initialDepth);
    control.value.textContent = control.formatValue(value);
    applyDepth(value);
  });
  cleanupCallbacks.push(() => {
    control.input.replaceWith(control.input.cloneNode(true));
  });
  controlledElements.push(control.input);

  return control.element;
};

const createS104WaterLevelControl = (
  scene: S100Scene,
  viewerElement: HTMLElement,
  log: DemoLogSink,
  cleanupCallbacks: Array<() => void>,
  controlledElements: Array<HTMLInputElement | HTMLButtonElement>,
): HTMLElement | null => {
  const binding = getS104DemoBinding(scene);
  if (!binding) {
    return null;
  }

  const group = createControlGroup("S-104 water level");
  const toggleLabel = document.createElement("label");
  toggleLabel.className = "control-toggle";

  const toggleInput = document.createElement("input");
  toggleInput.type = "checkbox";
  toggleInput.checked = scene.waterLevel.getSampler() === binding.sampler;

  const toggleText = document.createElement("span");
  toggleText.textContent = "Use fixture field";
  toggleLabel.append(toggleInput, toggleText);

  const samples = document.createElement("div");
  samples.className = "water-level-samples";
  let cursorCoordinate: Coordinate | null = null;
  let pointerTimer: ReturnType<typeof setTimeout> | null = null;
  let latestPointerEvent: PointerEvent | null = null;
  let pickSequence = 0;

  const render = (): void => {
    const state = scene.waterLevel.getState();
    const rows: HTMLElement[] = [
      createWaterLevelRow("Dataset", binding.datasetTitle ?? binding.datasetId),
      createWaterLevelRow("Source", state.source),
      createWaterLevelRow("Time", formatTimestamp(scene.time.getCurrent().getTime())),
    ];

    if (binding.observedGrid) {
      rows.push(
        createWaterLevelRow(
          "Grid",
          `${formatMeters(binding.observedGrid.minMeters)}-${formatMeters(binding.observedGrid.maxMeters)}`,
        ),
      );
    }

    const vesselCoordinate = binding.getVesselCoordinate?.() ?? null;
    if (vesselCoordinate) {
      rows.push(createWaterLevelRow("Vessel", formatWaterLevelSample(
        scene.waterLevel.sample({ coordinate: vesselCoordinate }),
      )));
    }

    for (const point of binding.samplePoints) {
      rows.push(createWaterLevelRow(point.label, formatWaterLevelSample(
        scene.waterLevel.sample({ coordinate: point.coordinate }),
      )));
    }

    rows.push(createWaterLevelRow(
      "Cursor",
      cursorCoordinate
        ? formatWaterLevelSample(scene.waterLevel.sample({ coordinate: cursorCoordinate }))
        : "move over scene",
    ));
    samples.replaceChildren(...rows);
  };

  const setFieldEnabled = (): void => {
    if (toggleInput.checked) {
      scene.waterLevel.setSampler(binding.sampler);
      log("info", "S-104 water-level fixture field enabled.");
    } else {
      scene.waterLevel.setSampler(null);
      log("info", "S-104 water-level fixture field disabled.");
    }
    render();
  };

  const pickCursor = (): void => {
    if (pointerTimer !== null || latestPointerEvent === null) {
      return;
    }
    pointerTimer = setTimeout(() => {
      pointerTimer = null;
      const event = latestPointerEvent;
      latestPointerEvent = null;
      if (!event) {
        return;
      }
      const sequence = ++pickSequence;
      void (async () => {
        try {
          const pick = await scene.picking.pick({
            screenX: event.clientX,
            screenY: event.clientY,
            fallback: "sea-level-plane",
            includeNative: false,
          });
          if (sequence !== pickSequence) {
            return;
          }
          cursorCoordinate = pick?.world ?? null;
          render();
        } catch {
          if (sequence === pickSequence) {
            cursorCoordinate = null;
            render();
          }
        }
      })();
    }, 150);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    latestPointerEvent = event;
    pickCursor();
  };
  const handlePointerLeave = (): void => {
    latestPointerEvent = null;
    cursorCoordinate = null;
    render();
  };

  toggleInput.addEventListener("change", setFieldEnabled);
  viewerElement.addEventListener("pointermove", handlePointerMove);
  viewerElement.addEventListener("pointerleave", handlePointerLeave);
  const waterLevelUnsubscribe = scene.waterLevel.onChanged(render);
  const timeUnsubscribe = scene.time.onChanged(render);

  cleanupCallbacks.push(
    waterLevelUnsubscribe,
    timeUnsubscribe,
    () => {
      toggleInput.removeEventListener("change", setFieldEnabled);
      viewerElement.removeEventListener("pointermove", handlePointerMove);
      viewerElement.removeEventListener("pointerleave", handlePointerLeave);
      if (pointerTimer !== null) {
        clearTimeout(pointerTimer);
      }
      pickSequence += 1;
    },
  );
  controlledElements.push(toggleInput);

  group.body.append(toggleLabel, samples);
  render();
  return group.element;
};

const createS111TimeControl = (
  scene: S100Scene,
  cleanupCallbacks: Array<() => void>,
  controlledElements: Array<HTMLInputElement | HTMLButtonElement>,
): HTMLElement | null => {
  if (!scene.layers.all().some((layer) => layer.controllers.surfaceCurrent)) {
    return null;
  }

  return createTimelineControl(scene, cleanupCallbacks, controlledElements, {
    label: "S-111 time",
    defaultRate: defaultS111PlaybackRate,
  });
};

const createS104TimeControl = (
  scene: S100Scene,
  cleanupCallbacks: Array<() => void>,
  controlledElements: Array<HTMLInputElement | HTMLButtonElement>,
): HTMLElement | null => {
  const binding = getS104DemoBinding(scene);
  if (!binding) {
    return null;
  }

  return createTimelineControl(scene, cleanupCallbacks, controlledElements, {
    label: "S-104 time",
    defaultRate: defaultS104PlaybackRate,
    ...(binding.timeline?.stepSeconds !== undefined
      ? { stepMs: binding.timeline.stepSeconds * 1000 }
      : {}),
  });
};

const createTimelineControl = (
  scene: S100Scene,
  cleanupCallbacks: Array<() => void>,
  controlledElements: Array<HTMLInputElement | HTMLButtonElement>,
  options: {
    label: string;
    defaultRate: number;
    stepMs?: number;
  },
): HTMLElement | null => {
  const availability = scene.time.getAvailability();
  if (!availability) {
    return null;
  }

  const playbackState = scene.time.getPlaybackState();
  const startTime = availability.start.getTime();
  const endTime = availability.end.getTime();
  const stepMs = positiveFiniteNumber(options.stepMs ?? playbackState.stepMs, 1000);
  const maxStep = Math.max(0, Math.round((endTime - startTime) / stepMs));
  let preferredLoop = playbackState.loop;
  let preferredRate = clamp(
    positiveFiniteNumber(playbackState.rate, options.defaultRate),
    minPlaybackRate,
    maxPlaybackRate,
  );

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    return null;
  }

  const group = createControlGroup(options.label);
  const timeRow = document.createElement("div");
  timeRow.className = "scene-control__time-row";

  const timeOutput = document.createElement("output");
  timeOutput.className = "scene-control__value scene-control__value--time";

  const timeInput = document.createElement("input");
  timeInput.id = nextDomId("s111-time");
  timeInput.type = "range";
  timeInput.min = "0";
  timeInput.max = String(maxStep);
  timeInput.step = "1";

  timeRow.append(timeInput, timeOutput);

  const playbackRow = document.createElement("div");
  playbackRow.className = "playback-controls";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "control-button";

  const loopLabel = document.createElement("label");
  loopLabel.className = "control-toggle";
  const loopInput = document.createElement("input");
  loopInput.type = "checkbox";
  loopInput.checked = preferredLoop;
  const loopText = document.createElement("span");
  loopText.textContent = "Loop";
  loopLabel.append(loopInput, loopText);

  playbackRow.append(playButton, loopLabel);

  const speedControl = createRangeControl({
    label: "Playback speed",
    min: minPlaybackRate,
    max: maxPlaybackRate,
    step: 1,
    value: preferredRate,
    formatValue: (value) => `${Math.round(value)} steps/s`,
  });
  speedControl.element.classList.add("scene-control__nested");

  const applyPlayback = (): void => {
    scene.time.play({
      loop: preferredLoop,
      rate: preferredRate,
      stepMs,
    });
  };

  const syncFromScene = (): void => {
    const state = scene.time.getPlaybackState();
    const currentStep = stepFromTime(scene.time.getCurrent().getTime(), startTime, stepMs, maxStep);
    timeInput.value = String(currentStep);
    timeOutput.value = formatTimestamp(startTime + currentStep * stepMs);
    timeOutput.textContent = timeOutput.value;

    playButton.textContent = state.playing ? "Pause" : "Play";
    if (state.playing) {
      preferredLoop = state.loop;
      preferredRate = clamp(
        positiveFiniteNumber(state.rate, preferredRate),
        minPlaybackRate,
        maxPlaybackRate,
      );
      loopInput.checked = preferredLoop;
      speedControl.input.value = String(preferredRate);
      speedControl.value.textContent = speedControl.formatValue(preferredRate);
    }
  };

  timeInput.addEventListener("input", () => {
    const nextStep = readNumericInput(timeInput, 0);
    const nextTime = startTime + nextStep * stepMs;
    scene.time.setCurrent(new Date(nextTime));
  });
  playButton.addEventListener("click", () => {
    if (scene.time.getPlaybackState().playing) {
      scene.time.pause();
      return;
    }
    applyPlayback();
  });
  loopInput.addEventListener("change", () => {
    preferredLoop = loopInput.checked;
    if (scene.time.getPlaybackState().playing) {
      applyPlayback();
    }
  });
  speedControl.input.addEventListener("input", () => {
    preferredRate = clamp(
      readNumericInput(speedControl.input, preferredRate),
      minPlaybackRate,
      maxPlaybackRate,
    );
    speedControl.value.textContent = speedControl.formatValue(preferredRate);
    if (scene.time.getPlaybackState().playing) {
      applyPlayback();
    }
  });

  const changedUnsubscribe = scene.time.onChanged(syncFromScene);
  const playbackUnsubscribe = scene.events.on("time.playback.changed", syncFromScene);
  cleanupCallbacks.push(
    changedUnsubscribe,
    playbackUnsubscribe,
    () => timeInput.replaceWith(timeInput.cloneNode(true)),
    () => playButton.replaceWith(playButton.cloneNode(true)),
    () => loopInput.replaceWith(loopInput.cloneNode(true)),
    () => speedControl.input.replaceWith(speedControl.input.cloneNode(true)),
  );
  controlledElements.push(timeInput, playButton, loopInput, speedControl.input);

  group.body.append(timeRow, playbackRow, speedControl.element);
  syncFromScene();

  return group.element;
};

const createRangeControl = (options: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  formatValue(value: number): string;
}): {
  element: HTMLElement;
  input: HTMLInputElement;
  value: HTMLOutputElement;
  formatValue(value: number): string;
} => {
  const group = createControlGroup(options.label);
  const input = document.createElement("input");
  const value = document.createElement("output");

  input.id = nextDomId(options.label);
  input.type = "range";
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  value.className = "scene-control__value";
  value.value = options.formatValue(options.value);
  value.textContent = value.value;
  group.label.htmlFor = input.id;
  group.header.append(value);
  group.body.append(input);

  return {
    element: group.element,
    input,
    value,
    formatValue: options.formatValue,
  };
};

const createControlGroup = (labelText: string): {
  element: HTMLElement;
  header: HTMLElement;
  body: HTMLElement;
  label: HTMLLabelElement;
} => {
  const element = document.createElement("div");
  element.className = "scene-control";

  const header = document.createElement("div");
  header.className = "scene-control__header";

  const label = document.createElement("label");
  label.textContent = labelText;

  const body = document.createElement("div");
  body.className = "scene-control__body";

  header.append(label);
  element.append(header, body);

  return { element, header, body, label };
};

const createEmptyState = (message: string): HTMLElement => {
  const element = document.createElement("p");
  element.className = "control-panel__empty";
  element.textContent = message;
  return element;
};

const createWaterLevelRow = (label: string, value: string): HTMLElement => {
  const row = document.createElement("div");
  row.className = "water-level-sample__row";

  const rowLabel = document.createElement("span");
  rowLabel.className = "water-level-sample__label";
  rowLabel.textContent = label;

  const rowValue = document.createElement("span");
  rowValue.className = "water-level-sample__value";
  rowValue.textContent = value;

  row.append(rowLabel, rowValue);
  return row;
};

const formatWaterLevelSample = (sample: WaterLevelFieldSample): string => {
  if (sample.status !== "value") {
    return `${formatStatus(sample.status)}: ${sample.reason}`;
  }

  const trend = "trend" in sample ? `, ${sample.trend}` : "";
  const datum = "verticalDatum" in sample && sample.verticalDatum
    ? ` ${sample.verticalDatum}`
    : "";
  const sourceTime = "sourceTime" in sample ? ` @ ${formatTimestamp(sample.sourceTime.getTime())}` : "";
  return `${sample.heightMeters.toFixed(2)} m${datum}${trend}${sourceTime}`;
};

const formatStatus = (status: string): string =>
  status.replace(/-/g, " ");

const isEncMapLayer = (layer: S100Layer): boolean =>
  layer.controllers.map !== undefined &&
  (layer.product === S100ProductType.S101 || layer.product === "S-57");

const nextDomId = (prefix: string): string => {
  const normalizedPrefix = prefix.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `scene-control-${normalizedPrefix}-${nextControlId++}`;
};

const createLatestMutation = <T>(
  apply: (value: T) => Promise<void>,
  onError: (error: unknown) => void,
): ((value: T) => void) => {
  let pendingValue: T | null = null;
  let hasPendingValue = false;
  let running = false;

  const run = async (): Promise<void> => {
    if (running) {
      return;
    }

    running = true;
    try {
      while (hasPendingValue) {
        const value = pendingValue as T;
        pendingValue = null;
        hasPendingValue = false;
        await apply(value);
      }
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (hasPendingValue) {
        void run();
      }
    }
  };

  return (value: T): void => {
    pendingValue = value;
    hasPendingValue = true;
    void run();
  };
};

const readNumericInput = (input: HTMLInputElement, fallback: number): number => {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
};

const stepFromTime = (
  currentTime: number,
  startTime: number,
  stepMs: number,
  maxStep: number,
): number => clamp(Math.round((currentTime - startTime) / stepMs), 0, maxStep);

const formatTimestamp = (time: number): string =>
  new Date(time).toISOString().replace(".000Z", "Z");

const formatMeters = (value: number): string =>
  `${value.toFixed(value < 10 ? 1 : 0)} m`;

const positiveFiniteNumber = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const clamp01 = (value: number): number => clamp(value, 0, 1);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
