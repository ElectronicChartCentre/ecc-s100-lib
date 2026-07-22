import { RouteFeatureError } from "./errors.js";

export type LinkedAbortSignal = {
  signal: AbortSignal;
  dispose(): void;
};

export const linkAbortSignals = (
  primarySignal: AbortSignal,
  secondarySignal: AbortSignal | undefined,
): LinkedAbortSignal => {
  if (secondarySignal === undefined) {
    return {
      signal: primarySignal,
      dispose: () => {},
    };
  }
  if (secondarySignal.aborted) {
    const abortController = new AbortController();
    abortController.abort();
    return {
      signal: abortController.signal,
      dispose: () => {},
    };
  }
  if (primarySignal.aborted) {
    return {
      signal: primarySignal,
      dispose: () => {},
    };
  }
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  primarySignal.addEventListener("abort", abort, { once: true });
  secondarySignal.addEventListener("abort", abort, { once: true });
  return {
    signal: abortController.signal,
    dispose: () => {
      primarySignal.removeEventListener("abort", abort);
      secondarySignal.removeEventListener("abort", abort);
    },
  };
};

export const assertNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new RouteFeatureError("route-load-aborted", "RTZ route loading was aborted.");
  }
};
