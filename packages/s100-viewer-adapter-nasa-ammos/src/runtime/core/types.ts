import type { Mesh, PerspectiveCamera, Scene, Texture, WebGLRenderer } from "three";

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

export enum S100NasaLogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Off = 5,
}

export type S100NasaLogSettings = {
  logLevel?: S100NasaLogLevel | number;
  cogsLogging?: boolean;
  webTexLoader?: boolean;
  resources?: boolean;
  extensionLoading?: boolean;
  capabilities?: boolean;
  GLES30?: boolean;
  shaderInfo?: boolean;
  shaderSource?: boolean;
  OGC3DTiles?: boolean;
};

export type S100NasaViewerConfig = {
  staticFiles?: string;
  fetchHandler?: typeof fetch;
  fieldOfViewDegrees?: number;
  logSettings?: S100NasaLogSettings;
  environmentMapURL?: string;
  showEnvironmentBackground?: boolean;
  backgroundIntensity?: number;
  environmentIntensity?: number;
  backgroundRotationX?: number;
  backgroundRotationY?: number;
  backgroundRotationZ?: number;
  environmentRotationX?: number;
  environmentRotationY?: number;
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
  skyDome: Mesh | null;
};
