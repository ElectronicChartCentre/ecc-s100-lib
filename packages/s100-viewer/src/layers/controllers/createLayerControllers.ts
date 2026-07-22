import { S100ProductType } from "../types.js";
import type { BaseLayerSpec, S100Layer } from "../types.js";
import type { EncLayerSpec } from "../../products/enc.js";
import type {
  S102BathymetryLayerSpec,
  S111SurfaceCurrentLayerSpec,
} from "../../products/iho-s100.js";
import {
  RoutePlanProductType,
  type RoutePlanLayerSpec,
} from "../../products/route-plan.js";
import type {
  MapOverlayLayerSpec,
  VesselLayerSpec,
} from "../../products/viewer-features.js";
import { CoreMapLayerController } from "./mapController.js";
import { CoreRouteLayerController } from "./routeController.js";
import { CoreSurfaceCurrentLayerController } from "./surfaceCurrentController.js";
import { CoreTerrainLayerController } from "./terrainController.js";
import { CoreVesselLayerController } from "./vesselController.js";
import type {
  BaseLayerControllers,
  LayerControllerContext,
  LayerControllers,
} from "./types.js";

export const createLayerControllers = <TSpec extends BaseLayerSpec>(
  layer: S100Layer<TSpec>,
  context: LayerControllerContext = {},
): LayerControllers<TSpec> => {
  const controllers: BaseLayerControllers = {};

  if (isS102LayerSpec(layer.spec)) {
    controllers.terrain = new CoreTerrainLayerController(
      layer as unknown as S100Layer<S102BathymetryLayerSpec>,
    );
  }

  if (isS111LayerSpec(layer.spec)) {
    controllers.surfaceCurrent = new CoreSurfaceCurrentLayerController(
      layer as unknown as S100Layer<S111SurfaceCurrentLayerSpec>,
      context,
    );
  }

  if (isMapLayerSpec(layer.spec)) {
    controllers.map = new CoreMapLayerController(
      layer as unknown as S100Layer<EncLayerSpec | MapOverlayLayerSpec>,
    );
  }

  if (isVesselLayerSpec(layer.spec)) {
    controllers.vessel = new CoreVesselLayerController(
      layer as unknown as S100Layer<VesselLayerSpec>,
    );
  }

  if (isRoutePlanLayerSpec(layer.spec)) {
    controllers.route = new CoreRouteLayerController(
      layer as unknown as S100Layer<RoutePlanLayerSpec>,
    );
  }

  return controllers as LayerControllers<TSpec>;
};

const isS102LayerSpec = (spec: BaseLayerSpec): spec is S102BathymetryLayerSpec =>
  spec.product === S100ProductType.S102;

const isS111LayerSpec = (spec: BaseLayerSpec): spec is S111SurfaceCurrentLayerSpec =>
  spec.product === S100ProductType.S111;

const isMapLayerSpec = (spec: BaseLayerSpec): spec is EncLayerSpec | MapOverlayLayerSpec =>
  spec.product === S100ProductType.S101 ||
  spec.product === "S-57" ||
  spec.product === "map-overlay";

const isVesselLayerSpec = (spec: BaseLayerSpec): spec is VesselLayerSpec =>
  spec.product === "vessel";

const isRoutePlanLayerSpec = (spec: BaseLayerSpec): spec is RoutePlanLayerSpec =>
  spec.product === RoutePlanProductType.RoutePlan;
