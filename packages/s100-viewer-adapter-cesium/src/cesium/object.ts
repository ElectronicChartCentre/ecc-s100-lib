import {
  S100Error,
  type EngineHandleBundle,
} from "@ecc/s100-viewer";
import type {
  CesiumConstructor,
  CesiumModule,
  CesiumObject,
} from "../adapter/types.js";

export function createEngineVersionFields(cesium: CesiumModule): Pick<EngineHandleBundle, "engineVersion"> {
  return typeof cesium.VERSION === "string" ? { engineVersion: cesium.VERSION } : {};
}

export function getCesiumConstructor(cesium: CesiumModule, key: string): CesiumConstructor {
  const value = cesium[key];
  if (typeof value !== "function") {
    throw new S100Error("adapter-lifecycle", `Cesium module does not expose '${key}'.`);
  }
  return value as CesiumConstructor;
}

export function hasConstructor(cesium: CesiumModule, key: string): boolean {
  return typeof cesium[key] === "function";
}

export function getObject(value: unknown, key: string): CesiumObject | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object" ? (child as CesiumObject) : null;
}

export function hasFunction(value: unknown, key: string): value is Record<string, (...args: unknown[]) => unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as Record<string, unknown>)[key] === "function");
}
