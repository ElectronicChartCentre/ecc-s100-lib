import {
  createS100Viewer,
  LayerBuilder,
  SceneBuilder,
} from "@ecc/s100-viewer";
import { createNasaAmmosAdapter } from "@ecc/s100-viewer-adapter-nasa-ammos";

const container = document.getElementById("viewer");
if (!container) {
  throw new Error("Missing #viewer container.");
}

const crs = "EPSG:32619";
const viewer = await createS100Viewer({
  container,
  adapter: createNasaAmmosAdapter(),
});

const scene = await viewer.createScene({
  georeference: SceneBuilder.projectedLocal({
    crs,
    origin: { x: 331100, y: 5186420, z: 0 },
  }),
});

await scene.layers.add(
  LayerBuilder.createS102({
    title: "S-102 bathymetry",
    url: "https://example.test/s102/tileset.json",
    crs,
    style: {
      unsafeDepth: 10,
      shading: "hypsometric",
    },
  }),
);

await scene.layers.add(
  LayerBuilder.createS101Wms({
    id: "s101-overlay",
    title: "S-101 ENC overlay",
    url: "https://example.test/wms",
    layers: ["s100dataSets.101"],
    crs,
  }),
);
