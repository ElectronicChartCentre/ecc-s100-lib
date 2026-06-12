export type S100ErrorCode =
  | "adapter-capability"
  | "adapter-lifecycle"
  | "layer-duplicate"
  | "layer-not-found"
  | "invalid-layer-spec"
  | "invalid-scene-options"
  | "scene-destroyed"
  | "viewer-destroyed";

export class S100Error extends Error {
  readonly code: S100ErrorCode;
  readonly details: unknown;

  constructor(code: S100ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "S100Error";
    this.code = code;
    this.details = details;
  }
}
