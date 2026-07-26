import type { LiveAisVessel } from "@ecc/s100-viewer/products/vessel";
import {
  stavangerDemoLonLatBbox,
  stavangerDemoSceneSettings,
  type DemoLiveAisConfig,
  type DemoSceneSettings,
  type LonLatBoundingBox,
} from "./demoConfig";

const WGS84_CRS = "EPSG:4326";

export type LiveAisProxyResponse = {
  generatedAt: string;
  upstreamFetchedAt: string | null;
  coveragePolicy: "barentswatch-open-ais-coverage";
  sceneIntersectsCoverage: boolean;
  servedFromWarmCache: boolean;
  sceneBbox: LonLatBoundingBox;
  queriedBbox?: LonLatBoundingBox;
  vessels: LiveAisVessel[];
  warnings: string[];
};

export type LiveAisDemoStatus =
  | {
      state: "inactive";
      configured: boolean;
      message: string;
    }
  | {
      state: "missing-config";
      configured: false;
      message: string;
    }
  | {
      state: "loading";
      configured: true;
      message: string;
    }
  | {
      state: "ready" | "outside-coverage";
      configured: true;
      message: string;
      vesselCount: number;
      latestFetchTime: string;
      upstreamFetchedAt: string | null;
      servedFromWarmCache: boolean;
      sceneIntersectsCoverage: boolean;
      warnings: readonly string[];
    }
  | {
      state: "error";
      configured: boolean;
      message: string;
    };

export const norwayLiveAisSceneSettings: DemoSceneSettings = stavangerDemoSceneSettings;

export const norwayLiveAisSceneBbox: LonLatBoundingBox = stavangerDemoLonLatBbox;

export const inactiveLiveAisStatus = (configured: boolean): LiveAisDemoStatus => ({
  state: "inactive",
  configured,
  message: "Live AIS scene not active.",
});

export const missingLiveAisConfigStatus = (): LiveAisDemoStatus => ({
  state: "missing-config",
  configured: false,
  message: "Configure VITE_AIS_PROXY_URL to load live AIS.",
});

export const loadingLiveAisStatus = (): LiveAisDemoStatus => ({
  state: "loading",
  configured: true,
  message: "Fetching live AIS vessels.",
});

export async function fetchLiveAisVessels(options: {
  config: DemoLiveAisConfig;
  bbox: LonLatBoundingBox;
  signal?: AbortSignal;
}): Promise<LiveAisProxyResponse> {
  if (!options.config.proxyUrl) {
    throw new LiveAisClientError("Live AIS proxy URL is not configured.", 0);
  }

  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(createLiveAisRequest(options)),
  };
  if (options.signal !== undefined) {
    requestInit.signal = options.signal;
  }

  const response = await fetch(liveAisEndpoint(options.config.proxyUrl), requestInit);

  const body = await parseJsonBody(response);
  if (!response.ok) {
    throw toLiveAisClientError(response.status, body);
  }
  return body as LiveAisProxyResponse;
}

export class LiveAisClientError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "LiveAisClientError";
  }
}

function createLiveAisRequest(options: {
  config: DemoLiveAisConfig;
  bbox: LonLatBoundingBox;
}): {
  sceneBbox: LonLatBoundingBox;
  bboxCrs: "EPSG:4326";
  maxAgeSeconds?: number;
  maxVessels?: number;
  includeStatic: boolean;
  includeSourceStream: boolean;
} {
  const request: {
    sceneBbox: LonLatBoundingBox;
    bboxCrs: "EPSG:4326";
    maxAgeSeconds?: number;
    maxVessels?: number;
    includeStatic: boolean;
    includeSourceStream: boolean;
  } = {
    sceneBbox: options.bbox,
    bboxCrs: WGS84_CRS,
    maxVessels: options.config.maxVessels,
    includeStatic: true,
    includeSourceStream: true,
  };
  if (options.config.maxAgeSeconds !== undefined) {
    request.maxAgeSeconds = options.config.maxAgeSeconds;
  }
  return request;
}

function liveAisEndpoint(proxyUrl: string): string {
  return `${proxyUrl.replace(/\/+$/, "")}/ais/live/vessels`;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toLiveAisClientError(
  statusCode: number,
  body: unknown,
): LiveAisClientError {
  if (isStructuredProxyError(body)) {
    return new LiveAisClientError(
      body.error.message,
      statusCode,
      body.error.code,
    );
  }
  return new LiveAisClientError(
    `Live AIS request failed with HTTP ${statusCode}.`,
    statusCode,
  );
}

function isStructuredProxyError(body: unknown): body is {
  error: {
    code: string;
    message: string;
  };
} {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return false;
  }
  const error = (body as { error?: unknown }).error;
  return (
    !!error &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}
