import type { Coordinate } from "../coordinates/types.js";
import type { S100Unsubscribe } from "../events/S100EventBus.js";

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type CameraPose = {
  position: Vec3;
  rotation: Quaternion;
  focalDistance?: number;
};

export type CameraLookAt = {
  target: Coordinate;
  rangeMeters: number;
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
};

export type CameraControlPreset =
  | "s100-default"
  | "engine-default"
  | "cesium-default"
  | "disabled";

export type CameraControlAction =
  | "orbit"
  | "pan"
  | "zoom"
  | "tilt"
  | "look"
  | "reset-view";

export type CameraControlMouseButton = "left" | "middle" | "right";
export type CameraControlModifier = "shift" | "ctrl" | "alt" | "meta";

export type CameraControlPointerBinding = {
  kind: "drag";
  action: CameraControlAction;
  button: CameraControlMouseButton;
  modifiers?: readonly CameraControlModifier[];
};

export type CameraControlWheelBinding = {
  kind: "wheel";
  action: "zoom";
  modifiers?: readonly CameraControlModifier[];
};

export type CameraControlTouchBinding = {
  kind: "touch";
  action: "orbit" | "pan" | "zoom";
  gesture: "one-finger-drag" | "two-finger-pan" | "pinch";
};

export type CameraControlKeyBinding = {
  action: CameraControlAction;
  keys: readonly string[];
  modifiers?: readonly CameraControlModifier[];
};

export type CameraControlConfig = {
  preset?: CameraControlPreset;
  enabled?: boolean;
  pointer?: readonly CameraControlPointerBinding[];
  wheel?: CameraControlWheelBinding | false;
  touch?: readonly CameraControlTouchBinding[];
  keyboard?: {
    enabled?: boolean;
    bindings?: readonly CameraControlKeyBinding[];
  };
  speeds?: {
    orbit?: number;
    pan?: number;
    zoom?: number;
  };
  constraints?: {
    minDistanceMeters?: number;
    maxDistanceMeters?: number;
    minPitchDegrees?: number;
    maxPitchDegrees?: number;
  };
  metadata?: Record<string, unknown>;
};

export const CameraControlPresets = {
  S100_DEFAULT: {
    preset: "s100-default",
    enabled: true,
    pointer: [
      { kind: "drag", action: "orbit", button: "left" },
      { kind: "drag", action: "pan", button: "middle" },
      { kind: "drag", action: "zoom", button: "right" },
      { kind: "drag", action: "pan", button: "left", modifiers: ["shift"] },
    ],
    wheel: { kind: "wheel", action: "zoom" },
    touch: [
      { kind: "touch", action: "orbit", gesture: "one-finger-drag" },
      { kind: "touch", action: "pan", gesture: "two-finger-pan" },
      { kind: "touch", action: "zoom", gesture: "pinch" },
    ],
    keyboard: {
      enabled: false,
      bindings: [],
    },
    speeds: {
      orbit: 1,
      pan: 1,
      zoom: 1,
    },
    constraints: {
      minDistanceMeters: 1,
      maxDistanceMeters: 1_000_000,
      minPitchDegrees: 0.5,
      maxPitchDegrees: 179.5,
    },
  } satisfies CameraControlConfig,
  ENGINE_DEFAULT: {
    preset: "engine-default",
    enabled: true,
  } satisfies CameraControlConfig,
  CESIUM_DEFAULT: {
    preset: "cesium-default",
    enabled: true,
  } satisfies CameraControlConfig,
  DISABLED: {
    preset: "disabled",
    enabled: false,
    pointer: [],
    wheel: false,
    touch: [],
    keyboard: {
      enabled: false,
      bindings: [],
    },
  } satisfies CameraControlConfig,
} as const;

export function normalizeCameraControlConfig(
  config: CameraControlConfig | undefined,
): CameraControlConfig {
  if (!config) {
    return cloneCameraControlConfig(CameraControlPresets.S100_DEFAULT);
  }
  if (config.preset === "engine-default") {
    return {
      ...cloneCameraControlConfig(CameraControlPresets.ENGINE_DEFAULT),
      ...config,
    };
  }
  if (config.preset === "cesium-default") {
    return {
      ...cloneCameraControlConfig(CameraControlPresets.CESIUM_DEFAULT),
      ...config,
    };
  }
  if (config.preset === "disabled" || config.enabled === false) {
    return {
      ...cloneCameraControlConfig(CameraControlPresets.DISABLED),
      ...config,
      enabled: false,
    };
  }

  const base = cloneCameraControlConfig(CameraControlPresets.S100_DEFAULT);
  const merged = cloneCameraControlConfig(config);
  if (merged.preset === undefined && base.preset !== undefined) {
    merged.preset = base.preset;
  }
  if (merged.enabled === undefined && base.enabled !== undefined) {
    merged.enabled = base.enabled;
  }
  const pointer = config.pointer ?? base.pointer;
  if (pointer !== undefined) {
    merged.pointer = pointer;
  }
  const wheel = config.wheel ?? base.wheel;
  if (wheel !== undefined) {
    merged.wheel = wheel;
  }
  const touch = config.touch ?? base.touch;
  if (touch !== undefined) {
    merged.touch = touch;
  }
  const keyboard = {
    ...base.keyboard,
    ...config.keyboard,
  };
  const keyboardBindings = config.keyboard?.bindings ?? base.keyboard?.bindings;
  if (keyboardBindings !== undefined) {
    keyboard.bindings = keyboardBindings;
  }
  merged.keyboard = keyboard;
  merged.speeds = {
    ...base.speeds,
    ...config.speeds,
  };
  merged.constraints = {
    ...base.constraints,
    ...config.constraints,
  };
  return merged;
}

export function cloneCameraControlConfig(config: CameraControlConfig): CameraControlConfig {
  const clone: CameraControlConfig = {
    ...config,
  };
  if (config.pointer !== undefined) {
    clone.pointer = config.pointer.map(clonePointerBinding);
  }
  if (config.wheel !== undefined) {
    clone.wheel = config.wheel === false ? false : cloneWheelBinding(config.wheel);
  }
  if (config.touch !== undefined) {
    clone.touch = config.touch.map((binding) => ({ ...binding }));
  }
  if (config.keyboard !== undefined) {
    clone.keyboard = { ...config.keyboard };
    if (config.keyboard.bindings !== undefined) {
      clone.keyboard.bindings = config.keyboard.bindings.map(cloneKeyBinding);
    }
  }
  if (config.speeds !== undefined) {
    clone.speeds = { ...config.speeds };
  }
  if (config.constraints !== undefined) {
    clone.constraints = { ...config.constraints };
  }
  if (config.metadata !== undefined) {
    clone.metadata = { ...config.metadata };
  }
  return clone;
}

function clonePointerBinding(binding: CameraControlPointerBinding): CameraControlPointerBinding {
  const clone: CameraControlPointerBinding = {
    kind: binding.kind,
    action: binding.action,
    button: binding.button,
  };
  if (binding.modifiers !== undefined) {
    clone.modifiers = [...binding.modifiers];
  }
  return clone;
}

function cloneWheelBinding(binding: CameraControlWheelBinding): CameraControlWheelBinding {
  const clone: CameraControlWheelBinding = {
    kind: binding.kind,
    action: binding.action,
  };
  if (binding.modifiers !== undefined) {
    clone.modifiers = [...binding.modifiers];
  }
  return clone;
}

function cloneKeyBinding(binding: CameraControlKeyBinding): CameraControlKeyBinding {
  const clone: CameraControlKeyBinding = {
    action: binding.action,
    keys: [...binding.keys],
  };
  if (binding.modifiers !== undefined) {
    clone.modifiers = [...binding.modifiers];
  }
  return clone;
}

export interface CameraController {
  getPose(): CameraPose;
  setPose(pose: CameraPose): void;
  lookAt(view: CameraLookAt): void;
  onChanged(listener: (pose: CameraPose) => void): S100Unsubscribe;
}
