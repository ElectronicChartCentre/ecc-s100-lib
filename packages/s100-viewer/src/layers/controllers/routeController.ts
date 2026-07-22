import {
  mergeRouteDiagnostics,
  setRouteDebugGeometryVisible,
  setRouteHybrid3d,
} from "../../internal/products/routeStyle.js";
import type {
  RouteDiagnostic,
  RouteFeatureStyle,
  RoutePlan,
  RoutePlanLayerSpec,
} from "../../products/route-plan.js";
import type { S100Layer } from "../types.js";
import type { RouteLayerController } from "./types.js";

export class CoreRouteLayerController implements RouteLayerController {
  readonly kind = "route" as const;

  constructor(private readonly layer: S100Layer<RoutePlanLayerSpec>) {}

  getRoutePlan(): RoutePlan {
    return this.layer.spec.source.routePlan;
  }

  getDiagnostics(): readonly RouteDiagnostic[] {
    return mergeRouteDiagnostics(
      this.layer.spec.source.routePlan,
      this.layer.spec.source.layout,
    );
  }

  async setStyle(style: Partial<RouteFeatureStyle>): Promise<void> {
    await this.layer.update({
      style: {
        ...this.layer.spec.style,
        ...style,
      },
    });
  }

  async setHybrid3d(enabled: boolean): Promise<void> {
    await this.layer.update({
      style: setRouteHybrid3d(this.layer.spec.style, enabled),
    });
  }

  async setDebugGeometryVisible(visible: boolean): Promise<void> {
    await this.layer.update({
      style: setRouteDebugGeometryVisible(this.layer.spec.style, visible),
    });
  }
}
