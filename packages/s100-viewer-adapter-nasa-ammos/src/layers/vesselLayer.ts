import {
  buildParametricVesselLayout,
  S100Error,
  type VesselLayerSpec,
  type ParametricVesselLayout,
} from "@ecc/s100-viewer";
import { createParametricVesselObject } from "../parametric-vessel-model.js";
import {
  SeaLevelIndicatorMode,
  type ModelAssetSpecification,
  type VesselDimensions,
  type VesselView,
} from "../runtime/compat/s100-viewer.js";
import {
  getBooleanExtension,
  getNasaAmmosExtension,
} from "../shared/extensions.js";

export const getVesselDimensions = (spec: VesselLayerSpec): VesselDimensions => {
  const semantic: Partial<VesselDimensions> = spec.dimensions ?? {};
  const extension = getNasaAmmosExtension<Partial<VesselDimensions>>(spec, "dimensions") ?? {};
  const draught = semantic.draught ?? extension.draught ?? spec.style?.draughtMeters ?? 7;

  return {
    draught,
    bow: semantic.bow ?? extension.bow ?? 100,
    stern: semantic.stern ?? extension.stern ?? 100,
    port: semantic.port ?? extension.port ?? 20,
    starboard: semantic.starboard ?? extension.starboard ?? 20,
  };
};

export const createVesselModelSpecification = (
  spec: VesselLayerSpec,
): ModelAssetSpecification => {
  const model = getVesselModel(spec);
  const name = spec.title ?? spec.id;
  if (spec.source.kind === "model") {
    return {
      path: spec.source.url,
      name,
      ...(model.boundingBox !== undefined ? { boundingBox: model.boundingBox } : {}),
      ...(model.orientation !== undefined ? { orientation: model.orientation } : {}),
    };
  }

  if (spec.source.kind === "parametric-vessel") {
    const layout = getParametricVesselLayout(spec);
    return {
      path: `parametric-vessel:${spec.id}`,
      name,
      object: () => createParametricVesselObject(layout),
      ...(model.orientation !== undefined ? { orientation: model.orientation } : {}),
    };
  }

  throw new S100Error(
    "invalid-layer-spec",
    `NASA-AMMOS vessel layer '${spec.id}' requires a model or parametric-vessel source.`,
    spec,
  );
};

export const getVesselTransformGizmoVerticalPositionLimits = (
  spec: VesselLayerSpec,
) => {
  const transformGizmo = spec.style?.transformGizmo;
  if (!transformGizmo || typeof transformGizmo !== "object") {
    return undefined;
  }
  return transformGizmo.verticalPositionLimits;
};

export const applyVesselPresentation = (
  view: VesselView,
  spec: VesselLayerSpec,
): void => {
  const seaLevelIndicator = spec.rendering?.seaLevelIndicator ?? spec.style?.showSeaLevelIndicator;
  view.seaLevelIndicator.mode = seaLevelIndicator !== false
    ? SeaLevelIndicatorMode.Circle
    : SeaLevelIndicatorMode.Off;
  view.seaLevelIndicator.seaSurfaceVisible = getVesselOceanSurfaceEnabled(spec);
  applyVesselShadowPresentation(view, spec);
};

const getParametricVesselLayout = (spec: VesselLayerSpec): ParametricVesselLayout => {
  if (spec.parametricVessel?.layout) {
    return spec.parametricVessel.layout;
  }
  if (spec.source.kind === "parametric-vessel") {
    return spec.source.layout ?? buildParametricVesselLayout(spec.source.spec);
  }
  throw new S100Error(
    "invalid-layer-spec",
    `NASA-AMMOS vessel layer '${spec.id}' does not include parametric vessel layout data.`,
    spec,
  );
};

const getVesselModel = (spec: VesselLayerSpec): Partial<ModelAssetSpecification> =>
  spec.model ?? getNasaAmmosExtension<Partial<ModelAssetSpecification>>(spec, "model") ?? {};

const getVesselOceanSurfaceEnabled = (spec: VesselLayerSpec): boolean => {
  if (typeof spec.rendering?.oceanSurfaceVisible === "boolean") {
    return spec.rendering.oceanSurfaceVisible;
  }
  if (typeof spec.style?.oceanSurface === "boolean") {
    return spec.style.oceanSurface;
  }
  if (typeof spec.style?.oceanSurface === "object") {
    return spec.style.oceanSurface.enabled ?? false;
  }
  if (typeof spec.style?.showOceanSurface === "boolean") {
    return spec.style.showOceanSurface;
  }
  return getBooleanExtension(spec, "seaSurfaceVisible", false);
};

const getVesselShadowEnabled = (spec: VesselLayerSpec): boolean => {
  if (typeof spec.rendering?.shadowVisible === "boolean") {
    return spec.rendering.shadowVisible;
  }
  if (typeof spec.style?.shadow === "boolean") {
    return spec.style.shadow;
  }
  if (typeof spec.style?.shadow === "object") {
    return spec.style.shadow.enabled ?? true;
  }
  return getBooleanExtension(spec, "verticalShadow", true);
};

const applyVesselShadowPresentation = (
  view: VesselView,
  spec: VesselLayerSpec,
): void => {
  const candidate = view as unknown as {
    setVerticalShadowVisible?: (visible: boolean) => void;
    verticalShadowControl?: { visible?: boolean; setVisible?: (visible: boolean) => void };
    verticalShadow?: { visible?: boolean; setVisible?: (visible: boolean) => void };
  };
  const visible = getVesselShadowEnabled(spec);
  if (typeof candidate.setVerticalShadowVisible === "function") {
    candidate.setVerticalShadowVisible(visible);
    return;
  }
  if (candidate.verticalShadowControl?.setVisible) {
    candidate.verticalShadowControl.setVisible(visible);
    return;
  }
  if (candidate.verticalShadowControl) {
    candidate.verticalShadowControl.visible = visible;
    return;
  }
  if (candidate.verticalShadow?.setVisible) {
    candidate.verticalShadow.setVisible(visible);
    return;
  }
  if (candidate.verticalShadow) {
    candidate.verticalShadow.visible = visible;
  }
};
