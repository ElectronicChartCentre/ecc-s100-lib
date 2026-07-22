import type { CesiumObject } from "../adapter/types.js";
import {
  getObject,
  hasFunction,
} from "./object.js";

export function callIfFunction(value: unknown, key: string): void {
  if (hasFunction(value, key)) {
    value[key]?.();
  }
}

export function destroyCesiumObject(value: unknown): void {
  if (!hasFunction(value, "destroy")) {
    return;
  }
  if (hasFunction(value, "isDestroyed")) {
    try {
      if (Boolean(value.isDestroyed?.())) {
        return;
      }
    } catch (error) {
      if (isCesiumDestroyedError(error)) {
        return;
      }
      throw error;
    }
  }
  try {
    value.destroy?.();
  } catch (error) {
    if (!isCesiumDestroyedError(error)) {
      throw error;
    }
  }
}

export function clearCesiumSkyBox(scene: CesiumObject): void {
  const skyBox = getObject(scene, "skyBox");
  if (skyBox) {
    destroyCesiumObject(skyBox);
  }
  scene.skyBox = undefined;
}

export function isCesiumObjectDestroyed(value: unknown): boolean {
  if (!hasFunction(value, "isDestroyed")) {
    return false;
  }
  try {
    return Boolean(value.isDestroyed?.());
  } catch (error) {
    if (isCesiumDestroyedError(error)) {
      return true;
    }
    throw error;
  }
}

function isCesiumDestroyedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  const message = (error as { message?: unknown }).message;
  return (
    name === "DeveloperError" &&
    typeof message === "string" &&
    /destroyed|destroy\(\)/iu.test(message)
  );
}
