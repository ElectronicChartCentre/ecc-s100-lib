import type { Texture } from "three";

export type NasaHdrTextureLoader = {
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
};

type NasaHdrTextureLoaderConstructor = new () => NasaHdrTextureLoader;

export const createNasaHdrTextureLoader =
  async (): Promise<NasaHdrTextureLoader> => {
    try {
      const { HDRLoader } = await import(
        "three/examples/jsm/loaders/HDRLoader.js"
      ) as { HDRLoader: NasaHdrTextureLoaderConstructor };
      return new HDRLoader();
    } catch {
      const { RGBELoader } = await import(
        "three/examples/jsm/loaders/RGBELoader.js"
      ) as { RGBELoader: NasaHdrTextureLoaderConstructor };
      return new RGBELoader();
    }
  };
