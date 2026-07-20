import {
  EncStandard,
  EncWmsSession,
  PrimarServices,
  S102TerrainSession,
  S111SurfaceCurrentSession,
  VesselFeatureSession,
  resolveEncWmsAvailability,
  type Coordinate,
  type EncWmsAvailability,
  type PrimarEncAvailabilityRequests,
  type ProjectedMapCenter,
  type S100Scene,
  type S111WorkflowDataset,
  type S111WorkflowStatus,
  type VesselDimensions,
} from "@ecc/s100-viewer";

export type LatLonBounds = {
  north: number;
  east: number;
  south: number;
  west: number;
};

export type ProjectedBounds = {
  north: number;
  east: number;
  south: number;
  west: number;
};

export type FeatureSessionWorkflowOptions = {
  scene: S100Scene;
  crs: string;
  licenseeKey: string;
  sceneBounds: LatLonBounds;
  mapCenter: ProjectedMapCenter;
  mapWidthMeters: number;
  endpoints: {
    s102Tiles: string;
    s111: string;
    encWmsBaseUrl: string;
    s57WmsTemplatePath: string;
  };
  apiKeys: {
    s102Tiles: string;
  };
  encAvailabilityRequests: PrimarEncAvailabilityRequests<LatLonBounds>;
  datasets: {
    visibleS102Ids: readonly string[];
    s111: readonly S111WorkflowDataset<unknown, LatLonBounds>[];
    visibleS111Ids: readonly string[];
  };
  projectBounds(
    bounds: LatLonBounds,
    crs: string,
    dataset: S111WorkflowDataset<unknown, LatLonBounds>,
  ): ProjectedBounds;
  vessel?: {
    modelUrl: string;
    position: Coordinate;
    headingDegrees?: number;
    dimensions: VesselDimensions;
  };
  onS111Status?: (statuses: readonly S111WorkflowStatus[]) => void;
  onS111Timeline?: (
    timeline: Awaited<
      ReturnType<typeof S111SurfaceCurrentSession.load>
    >["timeline"],
  ) => void;
  signal?: AbortSignal;
};

export type FeatureSessions = {
  terrain: S102TerrainSession;
  currents: S111SurfaceCurrentSession;
  enc: EncWmsSession;
  vessel: VesselFeatureSession | null;
  setCurrentTime(time: number | Date): void;
  setVisibleS111(ids: readonly string[]): Promise<void>;
  setVisibleS102(ids: readonly string[]): Promise<void>;
  setEncVisible(visible: boolean): Promise<void>;
  setEncPreference(preference: readonly EncStandard[]): Promise<void>;
  dispose(): Promise<void>;
};

export async function createFeatureSessions(
  options: FeatureSessionWorkflowOptions,
): Promise<FeatureSessions> {
  const terrain = S102TerrainSession.create({
    scene: options.scene,
    crs: options.crs,
    source: PrimarServices.s102Tiles({
      endpoint: options.endpoints.s102Tiles,
      apiKey: options.apiKeys.s102Tiles,
    }),
    rendering: {
      detailFactor: 500,
    },
    style: {
      safetyDepthMeters: 10,
      contours: {
        visible: true,
        intervalMeters: 5,
      },
    },
    replacement: {
      oldLayerRemovalDelayMs: 500,
    },
  });
  await terrain.setDatasetIds(options.datasets.visibleS102Ids);

  const currents = await S111SurfaceCurrentSession.load({
    scene: options.scene,
    datasets: options.datasets.s111,
    crs: options.crs,
    service: PrimarServices.s111({
      endpoint: options.endpoints.s111,
      licenseeKey: options.licenseeKey,
    }),
    projection: {
      projectBounds: options.projectBounds,
    },
    limits: {
      maxDataPoints: 100000,
      dataFetchConcurrency: 2,
    },
    style: {
      renderer: "arrows",
      scale: "auto",
    },
    ...(options.onS111Status !== undefined
      ? { onStatus: options.onS111Status }
      : {}),
    ...(options.onS111Timeline !== undefined
      ? { onTimeline: options.onS111Timeline }
      : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
  await currents.setVisibleDatasetIds(options.datasets.visibleS111Ids);

  const availability = await resolveEncWmsAvailability({
    bounds: options.sceneBounds,
    licenseeKey: options.licenseeKey,
    service: PrimarServices.encAvailability(options.encAvailabilityRequests),
  });
  const enc = await createEncSession(options, availability);

  const vessel = options.vessel
    ? await VesselFeatureSession.add({
        scene: options.scene,
        url: options.vessel.modelUrl,
        pose: {
          position: options.vessel.position,
          headingDegrees: options.vessel.headingDegrees ?? 0,
        },
        dimensions: options.vessel.dimensions,
        constraints: {
          vertical: {
            minMeters: -75,
            maxMeters: "draught",
            reference: "sea-level",
          },
        },
        style: {
          transformControls: "translate",
          transformGizmo: {
            enabled: true,
            mode: "translate",
          },
          showOceanSurface: true,
          oceanSurface: true,
        },
      })
    : null;

  return {
    terrain,
    currents,
    enc,
    vessel,
    setCurrentTime(time) {
      currents.setCurrentTime(time);
    },
    setVisibleS111(ids) {
      return currents.setVisibleDatasetIds(ids);
    },
    setVisibleS102(ids) {
      return terrain.setDatasetIds(ids).then(() => undefined);
    },
    setEncVisible(visible) {
      return enc.setVisible(visible);
    },
    setEncPreference(preference) {
      return enc.setPreference(preference);
    },
    async dispose() {
      await Promise.allSettled([
        vessel?.dispose(),
        enc.dispose(),
        currents.dispose(),
        terrain.dispose(),
      ]);
    },
  };
}

async function createEncSession(
  options: FeatureSessionWorkflowOptions,
  availability: EncWmsAvailability,
): Promise<EncWmsSession> {
  return EncWmsSession.create({
    scene: options.scene,
    standards: {
      [EncStandard.S101]: PrimarServices.s101EncWms({
        licenseeKey: options.licenseeKey,
        center: options.mapCenter,
        widthMeters: options.mapWidthMeters,
        wmsBaseUrl: options.endpoints.encWmsBaseUrl,
        pixelRatio: globalThis.devicePixelRatio,
      }),
      [EncStandard.S57]: PrimarServices.s57EncWms({
        licenseeKey: options.licenseeKey,
        center: options.mapCenter,
        widthMeters: options.mapWidthMeters,
        wmsBaseUrl: options.endpoints.encWmsBaseUrl,
        wmsTemplatePath: options.endpoints.s57WmsTemplatePath,
        includeOpaqueLayer: true,
      }),
    },
    availability,
    preference: [EncStandard.S101, EncStandard.S57],
    visible: false,
    opacity: 0.85,
  });
}
