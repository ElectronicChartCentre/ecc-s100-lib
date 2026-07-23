import type { LoggerLike } from "@ecc/s100-viewer";
import type * as THREE from "three";

export type FetchLike = typeof fetch;

export type ThreeAdapterOptions = {
  fetchHandler?: FetchLike;
  logger?: LoggerLike;
  rendererParameters?: THREE.WebGLRendererParameters;
  pixelRatio?: number;
  backgroundColor?: number;
};
