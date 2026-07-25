import {
  buildParametricVesselLayout,
  S100Error,
  type VesselLayerSpec,
  type ParametricVesselLayout,
} from "@ecc/s100-viewer";
import { resolveVesselDimensions } from "@ecc/s100-viewer/internal/products/vesselPose";
import { createParametricVesselObject } from "../parametric-vessel-model.js";
import {
  SeaLevelIndicatorMode,
  type ModelAssetSpecification,
  type VesselShadowSpecification,
  type VesselDimensions,
  type VesselView,
} from "../runtime/scene/NasaSceneRuntime.js";
import {
  getBooleanExtension,
  getNasaAmmosExtension,
} from "../shared/extensions.js";

export const getVesselDimensions = (spec: VesselLayerSpec): VesselDimensions => {
  const extensionDimensions = getNasaAmmosExtension<Partial<VesselDimensions>>(spec, "dimensions");
  return resolveVesselDimensions(
    {
      ...(spec.dimensions !== undefined ? { dimensions: spec.dimensions } : {}),
      ...(spec.style !== undefined ? { style: spec.style } : {}),
      ...(extensionDimensions !== undefined ? { extensionDimensions } : {}),
    },
    {
      draught: 7,
      bow: 100,
      stern: 100,
      port: 20,
      starboard: 20,
    },
  );
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

export const getVesselShadowSpecification = (
  spec: VesselLayerSpec,
): boolean | VesselShadowSpecification => {
  const enabled = getVesselShadowEnabled(spec);
  const shadow = spec.style?.shadow;
  if (typeof shadow === "object" && shadow !== null) {
    return {
      enabled,
      mode: shadow.mode === "shared-texture" ? "shared-texture" : "high-quality",
      ...(shadow.opacity !== undefined ? { opacity: shadow.opacity } : {}),
      ...(shadow.softness !== undefined ? { softness: shadow.softness } : {}),
      ...(shadow.color !== undefined ? { color: shadow.color } : {}),
      ...(shadow.radiusMeters !== undefined ? { radiusMeters: shadow.radiusMeters } : {}),
    };
  }
  return {
    enabled,
    mode: "high-quality",
  };
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
