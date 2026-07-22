export class RouteFeatureError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "RouteFeatureError";
    this.code = code;
    this.details = details;
  }
}
