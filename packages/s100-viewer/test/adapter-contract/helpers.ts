import {
  Coordinates,
  createInMemoryAdapter,
  createS100Viewer,
  type InMemoryAdapterOptions,
  type ProjectedMapExtents,
  type ProjectedCoordinate,
  type RouteDiagnostic,
  type RoutePlan,
  type RoutePlanLayout,
  type S100Scene,
  type SceneOptions,
} from "../../src/index.js";

export type InMemoryContractSceneOptions = {
  adapter?: InMemoryAdapterOptions;
  scene?: SceneOptions;
};

export const withInMemoryScene = async <T>(
  run: (scene: S100Scene) => Promise<T>,
  options: InMemoryContractSceneOptions = {},
): Promise<T> => {
  const viewer = await createS100Viewer({
    adapter: createInMemoryAdapter(options.adapter ?? {}),
  });

  try {
    const scene = await viewer.createScene(options.scene);
    return await run(scene);
  } finally {
    await viewer.destroy();
  }
};

export const projectedPosition = (
  x: number,
  y: number,
  z: number,
  crs = "EPSG:32633",
): ProjectedCoordinate =>
  Coordinates.projected({
    crs,
    x,
    y,
    z,
  });

export const projectedExtent = (): ProjectedMapExtents => ({
  minX: 0,
  minY: 0,
  maxX: 10,
  maxY: 10,
});

export const sampleS111Data = () => ({
  dateTimeOfFirstRecord: "20260529T120000Z",
  timeRecordInterval: 3600,
  numberOfTimes: 3,
});

export const sampleRouteDiagnostic = (
  code: string,
  severity: RouteDiagnostic["severity"] = "warning",
): RouteDiagnostic => ({
  code,
  severity,
  message: `Diagnostic ${code}`,
});

export const sampleRoutePlan = (
  diagnostics: readonly RouteDiagnostic[] = [],
): RoutePlan => ({
  id: "contract-route",
  sourceFormat: "route-plan",
  routeInfo: {
    name: "Contract route",
    values: {},
  },
  waypoints: [
    {
      id: "wp-1",
      position: { lon: 5, lat: 60 },
      extensions: [],
    },
    {
      id: "wp-2",
      position: { lon: 5.1, lat: 60.1 },
      extensions: [],
    },
  ],
  legs: [
    {
      id: "wp-1:wp-2",
      fromWaypointId: "wp-1",
      toWaypointId: "wp-2",
      geometryType: "loxodrome",
      safetyDepthMeters: 12,
      extensions: [],
    },
  ],
  schedules: [],
  extensions: [],
  diagnostics,
});

export const sampleRouteLayout = (
  routePlan: RoutePlan,
  diagnostics: readonly RouteDiagnostic[] = [],
): RoutePlanLayout => ({
  routeId: routePlan.id,
  sourceFormat: routePlan.sourceFormat,
  centerline: {
    id: "contract-route-centerline",
    positions: [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
    ],
    metadata: {
      routeId: routePlan.id,
      sourceFormat: routePlan.sourceFormat,
      primitiveKind: "centerline",
    },
  },
  waypoints: [],
  legBoundaries: [],
  corridors: [],
  routeVolumes: [],
  debug: [],
  diagnostics,
});
