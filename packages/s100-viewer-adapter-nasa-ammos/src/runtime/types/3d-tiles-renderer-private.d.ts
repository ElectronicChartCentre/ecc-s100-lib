declare module "3d-tiles-renderer/src/core/plugins/SUBTREELoader.js" {
  export class SUBTREELoader {
    workingPath: string;
    fetchOptions: RequestInit;

    constructor(tile: unknown);
    parse(buffer: ArrayBuffer): Promise<void>;
  }
}
