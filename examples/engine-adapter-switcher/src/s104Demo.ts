import type {
  Coordinate,
  S100Scene,
} from "@ecc/s100-viewer";
import type {
  S104ObservedGrid,
  S104WaterLevelSampler,
  S104WorkflowTimeline,
} from "@ecc/s100-viewer/products/s104";

export type S104DemoSamplePoint = {
  id: string;
  label: string;
  coordinate: Coordinate;
};

export type S104DemoBinding = {
  datasetId: string;
  datasetTitle?: string;
  sampler: S104WaterLevelSampler;
  timeline: S104WorkflowTimeline | null;
  observedGrid: S104ObservedGrid | null;
  samplePoints: readonly S104DemoSamplePoint[];
  getVesselCoordinate?: () => Coordinate | null;
};

const bindings = new WeakMap<S100Scene, S104DemoBinding>();

export const registerS104DemoBinding = (
  scene: S100Scene,
  binding: S104DemoBinding,
): void => {
  bindings.set(scene, binding);
};

export const getS104DemoBinding = (
  scene: S100Scene,
): S104DemoBinding | null => bindings.get(scene) ?? null;

export const unregisterS104DemoBinding = (scene: S100Scene): void => {
  bindings.delete(scene);
};
