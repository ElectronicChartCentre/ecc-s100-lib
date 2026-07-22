import {
  type CameraControlAction,
  type CameraControlConfig,
  type CameraControlModifier,
  type CameraControlPointerBinding,
} from "@ecc/s100-viewer";
import type {
  CesiumConstructor,
  CesiumModule,
  CesiumObject,
} from "../adapter/types.js";
import {
  getObject,
  hasFunction,
} from "../cesium/object.js";

export type CesiumPanHandler = (dx: number, dy: number, panSpeed: number) => void;
export type CesiumCameraPointGuard = (point: { x: number; y: number }) => boolean;

type DomListenerTarget = {
  addEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ) => void;
};

export function applyCesiumCameraControls(
  cesium: CesiumModule,
  viewer: CesiumObject,
  config: CameraControlConfig,
): void {
  const scene = getObject(viewer, "scene");
  const controller = getObject(scene, "screenSpaceCameraController");
  if (!controller) {
    return;
  }

  const enabled = config.enabled !== false && config.preset !== "disabled";
  controller.enableInputs = enabled;
  if (!enabled) {
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;
    controller.enableTilt = false;
    controller.enableLook = false;
    controller.rotateEventTypes = [];
    controller.translateEventTypes = [];
    controller.zoomEventTypes = [];
    controller.tiltEventTypes = [];
    controller.lookEventTypes = [];
    return;
  }

  if (config.preset === "engine-default" || config.preset === "cesium-default") {
    applyCesiumDefaultCameraControls(cesium, controller);
    applyCesiumCameraConstraints(controller, config);
    return;
  }

  const rotateEvents = cameraEventsForAction(cesium, config, "orbit");
  const translateEvents = cameraEventsForAction(cesium, config, "pan");
  const zoomEvents = cameraEventsForAction(cesium, config, "zoom");
  const tiltEvents = cameraEventsForAction(cesium, config, "tilt");
  const lookEvents = cameraEventsForAction(cesium, config, "look");

  controller.enableRotate = rotateEvents.length > 0;
  controller.enableTranslate = translateEvents.length > 0;
  controller.enableZoom = zoomEvents.length > 0;
  controller.enableTilt = tiltEvents.length > 0;
  controller.enableLook = lookEvents.length > 0;
  controller.rotateEventTypes = rotateEvents;
  controller.translateEventTypes = translateEvents;
  controller.zoomEventTypes = zoomEvents;
  controller.tiltEventTypes = tiltEvents;
  controller.lookEventTypes = lookEvents;

  applyCesiumCameraConstraints(controller, config);
}

export function installCesiumCameraPanHandler(
  cesium: CesiumModule,
  viewer: CesiumObject,
  config: CameraControlConfig,
  customPan?: CesiumPanHandler,
  shouldIgnorePoint?: CesiumCameraPointGuard,
): (() => void) | null {
  if (config.enabled === false || config.preset === "disabled") {
    return null;
  }
  const panBindings = (config.pointer ?? []).filter((binding) => binding.action === "pan");
  if (panBindings.length === 0) {
    return null;
  }

  const scene = getObject(viewer, "scene");
  const canvas = getObject(scene, "canvas");
  const canvasTarget = getDomListenerTarget(canvas);
  if (!canvas || !canvasTarget) {
    return null;
  }
  const screenSpacePanAbort = installCesiumScreenSpaceCameraPanHandler(
    cesium,
    viewer,
    canvas,
    config,
    panBindings,
    customPan,
    shouldIgnorePoint,
  );
  if (screenSpacePanAbort) {
    return screenSpacePanAbort;
  }
  const canvasObject = canvas;
  const documentTarget = getDomListenerTarget(getObject(canvas, "ownerDocument")) ?? canvasTarget;
  const capture = true;

  let active = false;
  let activeButtonMaskValue = 0;
  let lastX = 0;
  let lastY = 0;

  const onMouseDown = (event: Event) => {
    if (!eventTargetsCanvas(event, canvasObject)) {
      return;
    }
    const mouse = event as MouseEvent;
    if (!panBindings.some((binding) => mouseEventMatchesPanBinding(mouse, binding.button, binding.modifiers))) {
      return;
    }
    active = true;
    activeButtonMaskValue = mouseButtonMask(mouse.button);
    lastX = mouse.clientX;
    lastY = mouse.clientY;
    preventDefaultIfPossible(event);
  };

  const onMouseMove = (event: Event) => {
    if (!active) {
      return;
    }
    const mouse = event as MouseEvent;
    if (typeof mouse.buttons === "number" && mouse.buttons !== 0 && (mouse.buttons & activeButtonMaskValue) === 0) {
      active = false;
      activeButtonMaskValue = 0;
      return;
    }
    const dx = mouse.clientX - lastX;
    const dy = mouse.clientY - lastY;
    lastX = mouse.clientX;
    lastY = mouse.clientY;
    if (dx !== 0 || dy !== 0) {
      runCesiumPan(viewer, dx, dy, config.speeds?.pan ?? 1, customPan);
      preventDefaultIfPossible(event);
    }
  };

  const stopPan = (event?: Event) => {
    if (active && event) {
      preventDefaultIfPossible(event);
    }
    active = false;
    activeButtonMaskValue = 0;
  };

  const preventAuxClick = (event: Event) => {
    const mouse = event as MouseEvent;
    if (panBindings.some((binding) => mouseButtonNumber(binding.button) === mouse.button)) {
      preventDefaultIfPossible(event);
    }
  };

  documentTarget.addEventListener("mousedown", onMouseDown, capture);
  documentTarget.addEventListener("mousemove", onMouseMove, capture);
  documentTarget.addEventListener("mouseup", stopPan, capture);
  canvasTarget.addEventListener("mousedown", onMouseDown, capture);
  canvasTarget.addEventListener("mouseleave", stopPan, capture);
  canvasTarget.addEventListener("auxclick", preventAuxClick, capture);
  canvasTarget.addEventListener("contextmenu", preventAuxClick, capture);

  return () => {
    documentTarget.removeEventListener("mousedown", onMouseDown, capture);
    documentTarget.removeEventListener("mousemove", onMouseMove, capture);
    documentTarget.removeEventListener("mouseup", stopPan, capture);
    canvasTarget.removeEventListener("mousedown", onMouseDown, capture);
    canvasTarget.removeEventListener("mouseleave", stopPan, capture);
    canvasTarget.removeEventListener("auxclick", preventAuxClick, capture);
    canvasTarget.removeEventListener("contextmenu", preventAuxClick, capture);
  };
}

export function installCesiumCameraOrbitHandler(
  cesium: CesiumModule,
  viewer: CesiumObject,
  config: CameraControlConfig,
  customOrbit: CesiumPanHandler,
  shouldIgnorePoint?: CesiumCameraPointGuard,
): (() => void) | null {
  const orbitPointer = (config.pointer ?? [])
    .filter((binding) => binding.action === "orbit")
    .map((binding): CameraControlPointerBinding => ({
      ...binding,
      action: "pan",
    }));
  if (orbitPointer.length === 0) {
    return null;
  }
  return installCesiumCameraPanHandler(
    cesium,
    viewer,
    {
      ...config,
      pointer: orbitPointer,
      speeds: {
        ...config.speeds,
        pan: config.speeds?.orbit ?? config.speeds?.pan ?? 1,
      },
    },
    customOrbit,
    shouldIgnorePoint,
  );
}

export function disableCesiumNativeCameraRotate(viewer: CesiumObject): void {
  const controller = getObject(getObject(viewer, "scene"), "screenSpaceCameraController");
  if (!controller) {
    return;
  }
  controller.enableRotate = false;
  controller.rotateEventTypes = [];
}

function applyCesiumDefaultCameraControls(cesium: CesiumModule, controller: CesiumObject): void {
  const cameraEvents = getCesiumCameraEventType(cesium);
  const modifier = cesium.KeyboardEventModifier as Record<string, unknown> | undefined;
  controller.enableRotate = true;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.enableTilt = true;
  controller.enableLook = true;
  controller.rotateEventTypes = cameraEvents?.LEFT_DRAG;
  controller.translateEventTypes = undefined;
  controller.zoomEventTypes = compactCameraEvents([
    cameraEvents?.RIGHT_DRAG,
    cameraEvents?.WHEEL,
    cameraEvents?.PINCH,
  ]);
  controller.tiltEventTypes = compactCameraEvents([
    cameraEvents?.MIDDLE_DRAG,
    createCesiumModifiedCameraEvent(cameraEvents?.LEFT_DRAG, modifier?.CTRL),
    createCesiumModifiedCameraEvent(cameraEvents?.RIGHT_DRAG, modifier?.CTRL),
  ]);
  controller.lookEventTypes = undefined;
}

function applyCesiumCameraConstraints(
  controller: CesiumObject,
  config: CameraControlConfig,
): void {
  const constraints = config.constraints;
  if (!constraints) {
    return;
  }
  if (constraints.minDistanceMeters !== undefined) {
    controller.minimumZoomDistance = constraints.minDistanceMeters;
  }
  if (constraints.maxDistanceMeters !== undefined) {
    controller.maximumZoomDistance = constraints.maxDistanceMeters;
  }
}

function installCesiumScreenSpaceCameraPanHandler(
  cesium: CesiumModule,
  viewer: CesiumObject,
  canvas: CesiumObject,
  config: CameraControlConfig,
  panBindings: readonly CameraControlPointerBinding[],
  customPan?: CesiumPanHandler,
  shouldIgnorePoint?: CesiumCameraPointGuard,
): (() => void) | null {
  const ScreenSpaceEventHandler = cesium.ScreenSpaceEventHandler as CesiumConstructor | undefined;
  const screenEvents = cesium.ScreenSpaceEventType as Record<string, unknown> | undefined;
  if (
    !ScreenSpaceEventHandler ||
    !screenEvents?.MOUSE_MOVE ||
    !screenEvents.MIDDLE_DOWN ||
    !screenEvents.MIDDLE_UP
  ) {
    return null;
  }

  const handler = new ScreenSpaceEventHandler(canvas) as CesiumObject & {
    setInputAction?: (callback: (movement: unknown) => void, type: unknown, modifier?: unknown) => void;
    destroy?: () => void;
  };
  if (typeof handler.setInputAction !== "function") {
    return null;
  }

  let active = false;
  let lastX = 0;
  let lastY = 0;

  for (const binding of panBindings) {
    const downType = pointerButtonToScreenSpaceDownEvent(screenEvents, binding.button);
    if (downType === undefined) {
      continue;
    }
    const modifier = singleCesiumModifier(cesium, binding.modifiers);
    handler.setInputAction((movement: unknown) => {
      const point = screenSpaceMovementPoint(movement, "position");
      if (!point) {
        return;
      }
      if (shouldIgnorePoint?.(point)) {
        active = false;
        return;
      }
      active = true;
      lastX = point.x;
      lastY = point.y;
    }, downType, modifier);
  }

  handler.setInputAction((movement: unknown) => {
    if (!active) {
      return;
    }
    const scene = getObject(viewer, "scene");
    if (scene?.__s100VesselGizmoDragging === true) {
      return;
    }
    const point = screenSpaceMovementPoint(movement, "endPosition");
    if (!point) {
      return;
    }
    const dx = point.x - lastX;
    const dy = point.y - lastY;
    lastX = point.x;
    lastY = point.y;
    if (dx !== 0 || dy !== 0) {
      runCesiumPan(viewer, dx, dy, config.speeds?.pan ?? 1, customPan);
    }
  }, screenEvents.MOUSE_MOVE);

  for (const binding of panBindings) {
    const upType = pointerButtonToScreenSpaceUpEvent(screenEvents, binding.button);
    if (upType === undefined) {
      continue;
    }
    const modifier = singleCesiumModifier(cesium, binding.modifiers);
    handler.setInputAction(() => {
      active = false;
    }, upType, modifier);
  }

  return () => {
    if (typeof handler.destroy === "function") {
      handler.destroy();
    }
  };
}

function pointerButtonToScreenSpaceDownEvent(
  screenEvents: Record<string, unknown>,
  button: "left" | "middle" | "right",
): unknown {
  return button === "left"
    ? screenEvents.LEFT_DOWN
    : button === "middle"
      ? screenEvents.MIDDLE_DOWN
      : screenEvents.RIGHT_DOWN;
}

function pointerButtonToScreenSpaceUpEvent(
  screenEvents: Record<string, unknown>,
  button: "left" | "middle" | "right",
): unknown {
  return button === "left"
    ? screenEvents.LEFT_UP
    : button === "middle"
      ? screenEvents.MIDDLE_UP
      : screenEvents.RIGHT_UP;
}

function singleCesiumModifier(
  cesium: CesiumModule,
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown {
  if (!modifiers || modifiers.length === 0) {
    return undefined;
  }
  if (modifiers.length > 1) {
    return undefined;
  }
  const modifier = modifiers[0];
  return modifier === undefined ? undefined : cameraControlModifierToCesium(cesium, modifier);
}

export function screenSpaceMovementPoint(
  movement: unknown,
  key: "position" | "endPosition",
): { x: number; y: number } | null {
  if (!movement || typeof movement !== "object") {
    return null;
  }
  const point = (movement as Record<string, unknown>)[key];
  if (!point || typeof point !== "object") {
    return null;
  }
  const x = (point as { x?: unknown }).x;
  const y = (point as { y?: unknown }).y;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
    ? { x, y }
    : null;
}

function getDomListenerTarget(value: unknown): DomListenerTarget | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const target = value as {
    addEventListener?: unknown;
    removeEventListener?: unknown;
  };
  if (typeof target.addEventListener !== "function" || typeof target.removeEventListener !== "function") {
    return null;
  }
  return {
    addEventListener: target.addEventListener.bind(value) as DomListenerTarget["addEventListener"],
    removeEventListener: target.removeEventListener.bind(value) as DomListenerTarget["removeEventListener"],
  };
}

function eventTargetsCanvas(event: Event, canvas: CesiumObject): boolean {
  const target = (event as { target?: unknown }).target;
  if (!target || target === canvas) {
    return true;
  }
  const contains = (canvas as { contains?: unknown }).contains;
  return typeof contains === "function" ? Boolean(contains.call(canvas, target)) : false;
}

function mouseEventMatchesPanBinding(
  event: MouseEvent,
  button: "left" | "middle" | "right",
  modifiers: readonly CameraControlModifier[] | undefined,
): boolean {
  return event.button === mouseButtonNumber(button) && mouseEventMatchesModifiers(event, modifiers);
}

function mouseButtonNumber(button: "left" | "middle" | "right"): number {
  return button === "left" ? 0 : button === "middle" ? 1 : 2;
}

function mouseEventMatchesModifiers(
  event: MouseEvent,
  modifiers: readonly CameraControlModifier[] | undefined,
): boolean {
  const expected = new Set(modifiers ?? []);
  return (
    Boolean(event.shiftKey) === expected.has("shift") &&
    Boolean(event.ctrlKey) === expected.has("ctrl") &&
    Boolean(event.altKey) === expected.has("alt") &&
    Boolean(event.metaKey) === expected.has("meta")
  );
}

function mouseButtonMask(button: number): number {
  return button === 0 ? 1 : button === 1 ? 4 : button === 2 ? 2 : 0;
}

function runCesiumPan(
  viewer: CesiumObject,
  dx: number,
  dy: number,
  panSpeed: number,
  customPan?: CesiumPanHandler,
): void {
  if (customPan) {
    customPan(dx, dy, panSpeed);
    return;
  }
  panCesiumCamera(viewer, dx, dy, panSpeed);
}

export function panCesiumCamera(viewer: CesiumObject, dx: number, dy: number, panSpeed: number): void {
  const camera = getObject(viewer, "camera");
  if (!camera) {
    return;
  }
  const amountPerPixel = cesiumPanMetersPerPixel(camera) * Math.max(0.05, panSpeed);
  const rightAmount = -dx * amountPerPixel;
  const upAmount = dy * amountPerPixel;

  if (hasFunction(camera, "moveRight")) {
    camera.moveRight?.(rightAmount);
  } else {
    translateCameraPositionFallback(camera, "x", rightAmount);
  }
  if (hasFunction(camera, "moveUp")) {
    camera.moveUp?.(upAmount);
  } else {
    translateCameraPositionFallback(camera, "y", upAmount);
  }

  const scene = getObject(viewer, "scene");
  if (hasFunction(scene, "requestRender")) {
    scene.requestRender?.();
  }
}

export function cesiumPanMetersPerPixel(camera: CesiumObject): number {
  const cartographic = getObject(camera, "positionCartographic");
  const cartographicHeight = getFiniteNumber(cartographic?.height, Number.NaN);
  if (Number.isFinite(cartographicHeight) && Math.abs(cartographicHeight) > 0) {
    return Math.max(1, Math.min(10_000, Math.abs(cartographicHeight) * 0.004));
  }
  const position = getObject(camera, "position");
  const positionDistance = Math.hypot(
    getFiniteNumber(position?.x, 0),
    getFiniteNumber(position?.y, 0),
    getFiniteNumber(position?.z, 0),
  );
  if (Number.isFinite(positionDistance) && positionDistance > 0 && positionDistance < 100_000) {
    return Math.max(1, Math.min(10_000, positionDistance * 0.004));
  }
  return 10;
}

function translateCameraPositionFallback(camera: CesiumObject, axis: "x" | "y", amount: number): void {
  const position = getObject(camera, "position");
  if (position && typeof position[axis] === "number") {
    position[axis] += amount;
  }
}

function preventDefaultIfPossible(event: Event): void {
  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }
}

function cameraEventsForAction(
  cesium: CesiumModule,
  config: CameraControlConfig,
  action: CameraControlAction,
): unknown[] {
  const events: unknown[] = [];
  for (const binding of config.pointer ?? []) {
    if (binding.action !== action) {
      continue;
    }
    events.push(...pointerBindingToCesiumEvents(cesium, binding.button, binding.modifiers));
  }

  if (action === "zoom" && config.wheel !== false && config.wheel?.action === "zoom") {
    events.push(...wheelBindingToCesiumEvents(cesium, config.wheel.modifiers));
  }

  if (action === "zoom") {
    for (const binding of config.touch ?? []) {
      if (binding.action === "zoom" && binding.gesture === "pinch") {
        const cameraEvents = getCesiumCameraEventType(cesium);
        if (cameraEvents?.PINCH !== undefined) {
          events.push(cameraEvents.PINCH);
        }
      }
    }
  }

  return events;
}

function pointerBindingToCesiumEvents(
  cesium: CesiumModule,
  button: "left" | "middle" | "right",
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown[] {
  const cameraEvents = getCesiumCameraEventType(cesium);
  const eventType = button === "left"
    ? cameraEvents?.LEFT_DRAG
    : button === "middle"
      ? cameraEvents?.MIDDLE_DRAG
      : cameraEvents?.RIGHT_DRAG;
  return createCesiumCameraEvents(cesium, eventType, modifiers);
}

function wheelBindingToCesiumEvents(
  cesium: CesiumModule,
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown[] {
  const cameraEvents = getCesiumCameraEventType(cesium);
  return createCesiumCameraEvents(cesium, cameraEvents?.WHEEL, modifiers);
}

function getCesiumCameraEventType(cesium: CesiumModule): Record<string, unknown> | undefined {
  return (cesium.CameraEventType ?? cesium.ScreenSpaceEventType) as
    | Record<string, unknown>
    | undefined;
}

function createCesiumCameraEvents(
  cesium: CesiumModule,
  eventType: unknown,
  modifiers: readonly CameraControlModifier[] | undefined,
): unknown[] {
  if (eventType === undefined) {
    return [];
  }
  if (!modifiers || modifiers.length === 0) {
    return [eventType];
  }

  const events: unknown[] = [];
  for (const modifier of modifiers) {
    const cesiumModifier = cameraControlModifierToCesium(cesium, modifier);
    if (cesiumModifier !== undefined) {
      events.push(createCesiumModifiedCameraEvent(eventType, cesiumModifier));
    }
  }
  return events;
}

function cameraControlModifierToCesium(
  cesium: CesiumModule,
  modifier: CameraControlModifier,
): unknown {
  const modifiers = cesium.KeyboardEventModifier as Record<string, unknown> | undefined;
  switch (modifier) {
    case "shift":
      return modifiers?.SHIFT;
    case "ctrl":
      return modifiers?.CTRL;
    case "alt":
      return modifiers?.ALT;
    case "meta":
      return undefined;
  }
}

function createCesiumModifiedCameraEvent(eventType: unknown, modifier: unknown): unknown {
  if (eventType === undefined || modifier === undefined) {
    return undefined;
  }
  return { eventType, modifier };
}

function compactCameraEvents(events: readonly unknown[]): unknown[] {
  return events.filter((event) => event !== undefined);
}

function getFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
