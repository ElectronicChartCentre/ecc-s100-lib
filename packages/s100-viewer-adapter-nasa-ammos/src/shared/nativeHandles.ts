import type { ViewerScene } from "../runtime/compat/s100-viewer.js";
import type { NasaRenderContext } from "../adapter/layerNativeTypes.js";

export const getRenderContext = (scene: ViewerScene): NasaRenderContext | null => {
  const fromCoreScene = (scene as unknown as { coreScene?: { renderContext?: NasaRenderContext | null } })
    .coreScene?.renderContext;
  if (fromCoreScene) {
    return fromCoreScene;
  }

  return (
    (scene as unknown as { renderContext?: NasaRenderContext | null }).renderContext ??
    null
  );
};
