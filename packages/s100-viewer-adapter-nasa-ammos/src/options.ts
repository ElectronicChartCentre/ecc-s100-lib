export type FetchLike = typeof fetch;

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

export type S100NasaLoggerLike = {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

export type S100NasaViewerConfig = {
  staticFiles?: string;
  fetchHandler?: FetchLike;
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
  logger?: S100NasaLoggerLike;
};

export type NasaAmmosAdapterOptions = S100NasaViewerConfig & {
  fetchHandler?: FetchLike;
};
