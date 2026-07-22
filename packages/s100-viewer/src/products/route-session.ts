import type { SpatialExtent } from "../coordinates/types.js";
import { FeatureLifecycleScope } from "../features/index.js";
import type { S100Layer } from "../layers/types.js";
import type { S100Scene } from "../scene/types.js";
import {
  createRoutePlan,
} from "./route-builders.js";
import {
  buildRoutePlanLayout,
  type RouteLayoutOptions,
} from "./route-layout.js";
import {
  type RouteDiagnostic,
  type RouteFeatureStyle,
  type RoutePlan,
  type RoutePlanLayerSpec,
  type RoutePlanLayout,
} from "./route-plan.js";
import {
  parseRtzRoute,
  RtzParseError,
} from "./rtz-parser.js";

export type RoutePlanLayer = S100Layer<RoutePlanLayerSpec>;

export type RouteFetchRequest = {
  headers?: Record<string, string>;
  credentials?: "omit" | "same-origin" | "include";
  signal?: AbortSignal;
};

export type RouteFetchResponse = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  text(): Promise<string>;
};

export type RouteFetchLike = (
  url: string,
  request?: RouteFetchRequest,
) => Promise<RouteFetchResponse>;

export type RouteTextSource = {
  text(): Promise<string> | string;
};

export type RtzRouteSource =
  | {
      kind: "url";
      url: string;
      request?: RouteFetchRequest;
    }
  | {
      kind: "file";
      file: RouteTextSource;
      name?: string;
    }
  | {
      kind: "xml";
      xml: string;
      sourceId?: string;
    }
  | {
      kind: "route-plan";
      routePlan: RoutePlan;
    };

type RouteFeatureLayerOptions = {
  id?: string;
  title?: string;
  visible?: boolean;
  opacity?: number;
  zOrder?: number;
  style?: Partial<RouteFeatureStyle>;
  metadata?: RoutePlanLayerSpec["metadata"];
  spatialExtent?: SpatialExtent;
  extensions?: Record<string, unknown>;
  layoutOptions?: Omit<RouteLayoutOptions, "georeference">;
  signal?: AbortSignal;
};

export type AddRtzRouteOptions = RouteFeatureLayerOptions & {
  source: RtzRouteSource;
};

export type AddRoutePlanOptions = RouteFeatureLayerOptions & {
  routePlan: RoutePlan;
};

export type RouteFeatureSessionOptions = {
  scene: S100Scene;
  fetchHandler?: RouteFetchLike;
  defaults?: Partial<RouteFeatureStyle>;
  layoutOptions?: Omit<RouteLayoutOptions, "georeference">;
  onDiagnostics?: (diagnostics: readonly RouteDiagnostic[]) => void;
  onRouteAdded?: (route: RouteFeatureHandle) => void;
};

export type RouteFeatureHandle = {
  readonly id: string;
  readonly routePlan: RoutePlan;
  readonly layout: RoutePlanLayout;
  readonly diagnostics: readonly RouteDiagnostic[];
  readonly layer: RoutePlanLayer;
  setVisible(visible: boolean): Promise<void>;
  setOpacity(opacity: number): Promise<void>;
  setStyle(style: Partial<RouteFeatureStyle>): Promise<void>;
  remove(): Promise<void>;
};

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

export class RouteFeatureSession {
  private readonly lifecycle = new FeatureLifecycleScope();
  private readonly handles = new Map<string, CoreRouteFeatureHandle>();

  private constructor(private readonly options: RouteFeatureSessionOptions) {
    this.lifecycle.onDispose(async () => {
      const handles = [...this.handles.values()];
      this.handles.clear();
      await Promise.allSettled(handles.map((handle) => handle.removeLayer()));
    });
  }

  static create(options: RouteFeatureSessionOptions): RouteFeatureSession {
    return new RouteFeatureSession(options);
  }

  get routeHandles(): readonly RouteFeatureHandle[] {
    return [...this.handles.values()];
  }

  get layers(): readonly RoutePlanLayer[] {
    return [...this.handles.values()].map((handle) => handle.layer);
  }

  async addRtz(options: AddRtzRouteOptions): Promise<RouteFeatureHandle> {
    const run = this.lifecycle.beginAbortable();
    const linkedSignal = linkAbortSignals(run.signal, options.signal);
    try {
      const routePlan = await this.resolveRtzSource(options.source, {
        ...(options.id !== undefined ? { id: options.id } : {}),
        signal: linkedSignal.signal,
      });
      run.assertActive();
      return await this.addPreparedRoutePlan(routePlan, options, run.token);
    } catch (error) {
      if (error instanceof RtzParseError) {
        throw error;
      }
      if (error instanceof RouteFeatureError) {
        throw error;
      }
      throw new RouteFeatureError("route-load-failed", "Failed to load RTZ route.", {
        cause: error,
      });
    } finally {
      linkedSignal.dispose();
    }
  }

  async addRoutePlan(options: AddRoutePlanOptions): Promise<RouteFeatureHandle> {
    const token = this.lifecycle.begin();
    return this.addPreparedRoutePlan(options.routePlan, options, token);
  }

  async remove(idOrHandle: string | RouteFeatureHandle): Promise<boolean> {
    this.lifecycle.begin();
    const id = typeof idOrHandle === "string" ? idOrHandle : idOrHandle.id;
    const handle = this.handles.get(id);
    if (!handle) {
      return false;
    }
    this.handles.delete(id);
    await handle.removeLayer();
    return true;
  }

  async clear(): Promise<void> {
    this.lifecycle.begin();
    const handles = [...this.handles.values()];
    this.handles.clear();
    await Promise.allSettled(handles.map((handle) => handle.removeLayer()));
  }

  async dispose(): Promise<void> {
    await this.lifecycle.dispose();
  }

  private async addPreparedRoutePlan(
    routePlan: RoutePlan,
    options: RouteFeatureLayerOptions,
    token: number,
  ): Promise<RouteFeatureHandle> {
    this.lifecycle.assertActive(token);
    const layout = buildRoutePlanLayout(routePlan, {
      ...this.options.layoutOptions,
      ...options.layoutOptions,
      georeference: this.options.scene.georeference,
    });
    const id = options.id ?? routePlan.id;
    const existing = this.handles.get(id);
    if (existing) {
      this.handles.delete(id);
      await existing.removeLayer();
    }
    const title = routeTitle(options, routePlan);

    const layer = await this.options.scene.layers.add(
      createRoutePlan({
        id,
        ...(title !== undefined ? { title } : {}),
        ...(options.visible !== undefined ? { visible: options.visible } : {}),
        ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
        ...(options.zOrder !== undefined ? { zOrder: options.zOrder } : {}),
        ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
        ...(options.spatialExtent !== undefined ? { spatialExtent: options.spatialExtent } : {}),
        ...(options.extensions !== undefined ? { extensions: options.extensions } : {}),
        routePlan,
        layout,
        style: {
          ...this.options.defaults,
          ...options.style,
        },
      }),
    );

    if (!this.lifecycle.isActive(token)) {
      await layer.remove();
      this.lifecycle.assertActive(token);
    }

    const handle = new CoreRouteFeatureHandle(
      (routeHandle) => this.removeCoreHandle(routeHandle),
      id,
      routePlan,
      layout,
      layer,
    );
    this.handles.set(id, handle);
    this.options.onDiagnostics?.(handle.diagnostics);
    this.options.onRouteAdded?.(handle);
    return handle;
  }

  private async resolveRtzSource(
    source: RtzRouteSource,
    options: {
      id?: string;
      signal: AbortSignal;
    },
  ): Promise<RoutePlan> {
    assertNotAborted(options.signal);
    if (source.kind === "route-plan") {
      return source.routePlan;
    }

    const xml = await this.readRtzXml(source, options.signal);
    assertNotAborted(options.signal);
    const sourceId = sourceIdFromRouteSource(source);
    return parseRtzRoute(xml, {
      ...(options.id !== undefined ? { id: options.id } : {}),
      ...(sourceId !== undefined ? { sourceId } : {}),
    });
  }

  private async readRtzXml(
    source: Exclude<RtzRouteSource, { kind: "route-plan" }>,
    signal: AbortSignal,
  ): Promise<string> {
    switch (source.kind) {
      case "xml":
        return source.xml;
      case "file":
        return String(await source.file.text());
      case "url":
        return this.fetchRtzXml(source, signal);
    }
  }

  private async fetchRtzXml(
    source: Extract<RtzRouteSource, { kind: "url" }>,
    signal: AbortSignal,
  ): Promise<string> {
    const fetchHandler = this.options.fetchHandler ?? globalFetch();
    if (!fetchHandler) {
      throw new RouteFeatureError(
        "route-source-unavailable",
        "No fetch handler is available for RTZ route URL sources.",
      );
    }
    const linkedSignal = linkAbortSignals(signal, source.request?.signal);
    try {
      const response = await fetchHandler(source.url, {
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
  }

  private async removeCoreHandle(handle: CoreRouteFeatureHandle): Promise<void> {
    if (this.handles.get(handle.id) === handle) {
      this.handles.delete(handle.id);
    }
    await handle.removeLayer();
  }
}

class CoreRouteFeatureHandle implements RouteFeatureHandle {
  private removed = false;

  constructor(
    private readonly removeFromSession: (handle: CoreRouteFeatureHandle) => Promise<void>,
    readonly id: string,
    readonly routePlan: RoutePlan,
    readonly layout: RoutePlanLayout,
    readonly layer: RoutePlanLayer,
  ) {}

  get diagnostics(): readonly RouteDiagnostic[] {
    return [
      ...this.routePlan.diagnostics,
      ...this.layout.diagnostics,
    ];
  }

  async setVisible(visible: boolean): Promise<void> {
    await this.layer.update({
      visible,
      style: {
        ...this.layer.spec.style,
        visible,
      },
    });
  }

  async setOpacity(opacity: number): Promise<void> {
    await this.layer.update({
      opacity,
      style: {
        ...this.layer.spec.style,
        opacity,
      },
    });
  }

  async setStyle(style: Partial<RouteFeatureStyle>): Promise<void> {
    await this.layer.controllers.route.setStyle(style);
  }

  async remove(): Promise<void> {
    await this.removeFromSession(this);
  }

  async removeLayer(): Promise<void> {
    if (this.removed) {
      return;
    }
    this.removed = true;
    await this.layer.remove();
  }
}

type LinkedAbortSignal = {
  signal: AbortSignal;
  dispose(): void;
};

const linkAbortSignals = (
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

const assertNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new RouteFeatureError("route-load-aborted", "RTZ route loading was aborted.");
  }
};

const sourceIdFromRouteSource = (
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

const routeTitle = (
  options: RouteFeatureLayerOptions,
  routePlan: RoutePlan,
): string | undefined =>
  options.title ?? routePlan.routeInfo.name ?? routePlan.routeInfo.routeName;

const globalFetch = (): RouteFetchLike | undefined => {
  const candidate = globalThis as unknown as {
    fetch?: RouteFetchLike;
  };
  return typeof candidate.fetch === "function" ? candidate.fetch : undefined;
};
