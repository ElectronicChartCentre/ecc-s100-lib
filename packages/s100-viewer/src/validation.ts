import type { AdapterCapabilities } from "./adapters/types.js";
import { defaultProjectedLocalGeoreference } from "./coordinates/types.js";
import type { BaseLayerSpec } from "./layers/types.js";
import type { SceneOptions } from "./scene/types.js";
import { S100Error } from "./errors/S100Error.js";

export const normalizeSceneOptions = (options: SceneOptions = {}): Required<Pick<SceneOptions, "georeference">> &
  SceneOptions => ({
  ...options,
  georeference: options.georeference ?? defaultProjectedLocalGeoreference(),
});

export const validateAdapterCapabilities = (capabilities: AdapterCapabilities): void => {
  if (capabilities.sceneGeoreferences.length === 0) {
    throw new S100Error(
      "adapter-capability",
      "Adapter must report at least one supported scene georeference mode.",
    );
  }

  for (const support of capabilities.supportedProductVersions ?? []) {
    if (!String(support.product).trim()) {
      throw new S100Error(
        "adapter-capability",
        "Adapter product-version support entries must report a non-empty product.",
        support,
      );
    }

    if (support.versions.length === 0) {
      throw new S100Error(
        "adapter-capability",
        `Adapter product '${support.product}' must report at least one supported product specification version.`,
        support,
      );
    }

    if (!support.versions.includes(support.defaultVersion)) {
      throw new S100Error(
        "adapter-capability",
        `Adapter product '${support.product}' default product specification version must be listed in supported versions.`,
        support,
      );
    }
  }
};

export const assertSceneGeoreferenceSupported = (
  capabilities: AdapterCapabilities,
  options: Required<Pick<SceneOptions, "georeference">> & SceneOptions,
): void => {
  if (!capabilities.sceneGeoreferences.includes(options.georeference.mode)) {
    throw new S100Error(
      "adapter-capability",
      `Adapter does not support scene georeference mode '${options.georeference.mode}'.`,
      { supported: capabilities.sceneGeoreferences },
    );
  }
};

export const validateLayerSpec = (spec: BaseLayerSpec): void => {
  if (!spec.id.trim()) {
    throw new S100Error("invalid-layer-spec", "Layer spec id must be a non-empty string.", spec);
  }

  if (!String(spec.product).trim()) {
    throw new S100Error("invalid-layer-spec", "Layer spec product must be a non-empty string.", spec);
  }

  if (spec.opacity !== undefined && (spec.opacity < 0 || spec.opacity > 1)) {
    throw new S100Error("invalid-layer-spec", "Layer opacity must be between 0 and 1.", spec);
  }
};
