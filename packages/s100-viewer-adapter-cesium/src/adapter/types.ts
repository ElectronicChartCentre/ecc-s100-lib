export type FetchLike = typeof fetch;
export type CesiumModule = Record<string, unknown>;
export type CesiumObject = Record<string, unknown>;
export type CesiumConstructor = new (...args: unknown[]) => CesiumObject;
export type CesiumModuleProvider =
  | CesiumModule
  | (() => CesiumModule | Promise<CesiumModule>);

export type CesiumAdapterOptions = {
  cesiumModule?: CesiumModuleProvider;
  viewerOptions?: Record<string, unknown>;
  accessToken?: string;
  fetchHandler?: FetchLike;
  s111MaxEntityCount?: number;
  dynamicLighting?: boolean;
};
