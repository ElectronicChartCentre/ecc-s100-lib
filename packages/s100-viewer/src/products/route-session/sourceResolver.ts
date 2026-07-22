import type { RoutePlan } from "../route-plan.js";
import { parseRtzRoute } from "../rtz-parser.js";
import { assertNotAborted, linkAbortSignals } from "./cancellation.js";
import { RouteFeatureError } from "./errors.js";
import type {
  RouteFetchLike,
  RtzRouteSource,
} from "./types.js";

export const resolveRtzRouteSource = async (
  source: RtzRouteSource,
  options: {
    id?: string;
    signal: AbortSignal;
    fetchHandler?: RouteFetchLike | undefined;
  },
): Promise<RoutePlan> => {
  assertNotAborted(options.signal);
  if (source.kind === "route-plan") {
    return source.routePlan;
  }

  const xml = await readRtzXml(source, options.signal, options.fetchHandler);
  assertNotAborted(options.signal);
  const sourceId = sourceIdFromRouteSource(source);
  return parseRtzRoute(xml, {
    ...(options.id !== undefined ? { id: options.id } : {}),
    ...(sourceId !== undefined ? { sourceId } : {}),
  });
};

const readRtzXml = async (
  source: Exclude<RtzRouteSource, { kind: "route-plan" }>,
  signal: AbortSignal,
  fetchHandler: RouteFetchLike | undefined,
): Promise<string> => {
  switch (source.kind) {
    case "xml":
      return source.xml;
    case "file":
      return String(await source.file.text());
    case "url":
      return fetchRtzXml(source, signal, fetchHandler);
  }
};

const fetchRtzXml = async (
  source: Extract<RtzRouteSource, { kind: "url" }>,
  signal: AbortSignal,
  fetchHandler: RouteFetchLike | undefined,
): Promise<string> => {
  const effectiveFetchHandler = fetchHandler ?? globalFetch();
  if (!effectiveFetchHandler) {
    throw new RouteFeatureError(
      "route-source-unavailable",
      "No fetch handler is available for RTZ route URL sources.",
    );
  }
  const linkedSignal = linkAbortSignals(signal, source.request?.signal);
  try {
    const response = await effectiveFetchHandler(source.url, {
      ...source.request,
      signal: linkedSignal.signal,
    });
    if (response.ok === false) {
      throw new RouteFeatureError(
        "route-source-unavailable",
        `RTZ route request failed with status ${response.status ?? "unknown"}.`,
        {
          url: source.url,
          status: response.status,
          statusText: response.statusText,
        },
      );
    }
    return response.text();
  } finally {
    linkedSignal.dispose();
  }
};

export const sourceIdFromRouteSource = (
  source: Exclude<RtzRouteSource, { kind: "route-plan" }>,
): string | undefined => {
  switch (source.kind) {
    case "url":
      return source.url;
    case "file":
      return source.name;
    case "xml":
      return source.sourceId;
  }
};

export const globalFetch = (): RouteFetchLike | undefined => {
  const candidate = globalThis as unknown as {
    fetch?: RouteFetchLike;
  };
  return typeof candidate.fetch === "function" ? candidate.fetch : undefined;
};
