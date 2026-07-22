import type { NasaSceneRuntime } from "../runtime/scene/NasaSceneRuntime.js";
import type { NasaRenderContext } from "../adapter/layerNativeTypes.js";

export const getRenderContext = (scene: NasaSceneRuntime): NasaRenderContext | null =>
  scene.getRenderContext();
