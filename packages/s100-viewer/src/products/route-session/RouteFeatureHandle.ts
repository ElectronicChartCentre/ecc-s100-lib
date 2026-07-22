import type {
  RouteDiagnostic,
  RouteFeatureStyle,
  RoutePlan,
  RoutePlanLayout,
} from "../route-plan.js";
import type {
  RouteFeatureHandle,
  RoutePlanLayer,
} from "./types.js";

export class CoreRouteFeatureHandle implements RouteFeatureHandle {
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
