import {
  S100NasaLogLevel,
  type S100NasaLogSettings,
  type S100NasaViewerConfig,
} from "./runtime/index.js";

export type FetchLike = typeof fetch;

export type NasaAmmosAdapterOptions = S100NasaViewerConfig & {
  fetchHandler?: FetchLike;
};

export { S100NasaLogLevel };
export type { S100NasaLogSettings };
