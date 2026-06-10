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

const firstStep = new Date("2026-05-19T14:15:00Z");
const lastStep = new Date("2026-05-20T14:15:00Z");

await scene.layers.add(
  LayerBuilder.createS111({
    title: "S-111 surface currents",
    url: "https://example.test/s111/currents.json",
    crs,
    productSpecificationVersion: "INT.IHO.S-111.1.0",
    time: {
      availability: [{ start: firstStep, end: lastStep }],
      interpolation: "nearest",
    },
  }),
);

scene.time.setCurrent(firstStep);

scene.events.on("time.changed", (time) => {
  console.info("S-111 time changed", time.toISOString());
});
