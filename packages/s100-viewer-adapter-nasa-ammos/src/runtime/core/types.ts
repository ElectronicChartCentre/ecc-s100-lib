import type { PerspectiveCamera, Scene, Texture, WebGLRenderer } from "three";

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Quat = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type CameraPose = {
  position: Vec3;
  rotation: Quat;
  focalDistance: number;
};

export type CrsDefinition = {
  epsgCrs: string;
};

export type S100NasaViewerConfig = {
  staticFiles?: string;
  fetchHandler?: typeof fetch;
  fieldOfViewDegrees?: number;
  environmentMapURL?: string;
  showEnvironmentBackground?: boolean;
  backgroundIntensity?: number;
  environmentIntensity?: number;
  backgroundRotationX?: number;
  backgroundRotationZ?: number;
  environmentRotationX?: number;
  environmentRotationZ?: number;
  ambientLightIntensity?: number;
  directionalLightIntensity?: number;
  logger?: LoggerLike;
};

export type S100SceneOptions = {
  crs?: string;
  origin?: Vec3;
};

export type LoggerLike = {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

export type Disposable = {
  destroy(): void;
};

export type FrameSubscription = {
  unsubscribe(): void;
};

export type S100RenderContext = {
  backgroundMap: Texture | null;
  canvas: HTMLCanvasElement;
  camera: PerspectiveCamera;
  environmentMap: Texture | null;
  renderer: WebGLRenderer;
  scene: Scene;
};
