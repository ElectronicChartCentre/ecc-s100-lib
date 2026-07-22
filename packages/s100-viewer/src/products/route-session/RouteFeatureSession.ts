import { FeatureLifecycleScope } from "../../features/index.js";
import {
  createRoutePlan,
  mergeRouteStyle,
} from "../route-builders.js";
import { buildRoutePlanLayout } from "../route-layout.js";
import type { RoutePlan } from "../route-plan.js";
import { RtzParseError } from "../rtz-parser.js";
import { linkAbortSignals } from "./cancellation.js";
import { routeTitle } from "./diagnostics.js";
import { RouteFeatureError } from "./errors.js";
import { CoreRouteFeatureHandle } from "./RouteFeatureHandle.js";
import { resolveRtzRouteSource } from "./sourceResolver.js";
import type {
  AddRoutePlanOptions,
  AddRtzRouteOptions,
  RouteFeatureHandle,
  RouteFeatureLayerOptions,
  RouteFeatureSessionOptions,
  RoutePlanLayer,
} from "./types.js";

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
      const routePlan = await resolveRtzRouteSource(options.source, {
        ...(options.id !== undefined ? { id: options.id } : {}),
        signal: linkedSignal.signal,
        fetchHandler: this.options.fetchHandler,
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
    const style = mergeRouteStyle({
      ...this.options.defaults,
      ...options.style,
    });
    const layout = buildRoutePlanLayout(routePlan, {
      includeCorridor: style.showCorridor,
      includeXtdBoundaries: style.showXtdBoundaries,
      includeRouteVolume: style.showRouteVolume,
      includeRouteSides: style.showRouteSides,
      includeTurnDebugGeometry: style.showTurnDebugGeometry,
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
        style,
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
  }  private async removeCoreHandle(handle: CoreRouteFeatureHandle): Promise<void> {
    if (this.handles.get(handle.id) === handle) {
      this.handles.delete(handle.id);
    }
    await handle.removeLayer();
  }
}
