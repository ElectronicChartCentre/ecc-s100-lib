declare module "three/examples/jsm/loaders/HDRLoader.js" {
  import type { Texture } from "three";

  export class HDRLoader {
    load(
      url: string,
      onLoad: (texture: Texture) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: unknown) => void,
    ): unknown;
    loadAsync(
      url: string,
      onProgress?: (event: ProgressEvent) => void,
    ): Promise<Texture>;
  }
}
