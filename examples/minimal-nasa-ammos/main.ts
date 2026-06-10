import {
  createS100Viewer,
  SceneBuilder,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

const container = document.getElementById("viewer");
if (!container) {
  throw new Error("Missing #viewer container.");
}

const viewer = await createS100Viewer({
  container,
  adapter: createNasaAmmosAdapter(),
});

const scene = await viewer.createScene({
  id: "minimal-nasa-ammos",
  georeference: SceneBuilder.projectedLocal({
    crs: "EPSG:32619",
    origin: {
      x: 331100,
      y: 5186420,
      z: 0,
    },
  }),
});

scene.environment.setState({
  background: "skybox",
  lighting: {
    ambientIntensity: 0.06,
    directionalIntensity: 0.108,
  },
});

window.addEventListener("beforeunload", () => {
  void viewer.destroy();
});
