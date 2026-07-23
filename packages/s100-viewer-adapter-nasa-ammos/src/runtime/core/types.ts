import type { Mesh, PerspectiveCamera, Scene, Texture, WebGLRenderer } from "three";
export { S100NasaLogLevel } from "../../options.js";
export type {
  S100NasaLoggerLike as LoggerLike,
  S100NasaLogSettings,
  S100NasaViewerConfig,
} from "../../options.js";

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

export type S100SceneOptions = {
  crs?: string;
  origin?: Vec3;
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
