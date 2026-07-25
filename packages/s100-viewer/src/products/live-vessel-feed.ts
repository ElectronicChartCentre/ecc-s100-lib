import { Coordinates, type Coordinate } from "../coordinates/types.js";
import type { S100Scene } from "../scene/types.js";
import type {
  ParametricVesselColorScheme,
  ParametricVesselSpec,
} from "./parametric-vessel.js";
import type {
  VesselDimensions,
  VesselPose,
  VesselStyle,
} from "./viewer-features.js";
import {
  VesselFeatureSession,
  type ParametricVesselFeatureSessionOptions,
  type VesselVerticalConstraint,
} from "./vessel-session.js";
import { estimateParametricDraughtFromBeamMeters } from "./parametric-vessel/physical-defaults.js";

export type LiveAisVesselSource = "barentswatch-live-ais" | string;

export interface LiveAisVessel {
  source: LiveAisVesselSource;
  mmsi: number;
  name?: string;
  callSign?: string;
  imoNumber?: number;
  position: {
    kind: "geodetic";
    crs: "EPSG:4326" | "EPSG:4258" | string;
    longitude: number;
    latitude: number;
    heightMeters?: number;
  };
  previousPosition?: {
    longitude: number;
    latitude: number;
    messageTime: string;
  };
  headingDegrees?: number;
  courseOverGroundDegrees?: number;
  speedOverGroundKnots?: number;
  rateOfTurn?: number;
  shipType?: number;
  navigationalStatus?: number;
  dimensionsMeters?: LiveAisVesselDimensions;
  draughtMeters?: number;
  reportClass?: "A" | "B" | string;
  messageTime: string;
  stream?: "terra" | "satellite" | "offshore" | string;
}

export interface LiveAisVesselDimensions {
  bow?: number;
  stern?: number;
  port?: number;
  starboard?: number;
  length?: number;
  width?: number;
}

export interface LiveVesselFeedStalePolicy {
  maxAgeSeconds?: number;
  removeMissing?: boolean;
}

export interface LiveVesselFeedStyleOptions {
  style?: Partial<VesselStyle>;
  selectedStyle?: Partial<VesselStyle>;
  colors?: ParametricVesselColorScheme;
}

export interface LiveVesselFeedLayerSpec {
  id?: string;
  scene: S100Scene;
  stalePolicy?: LiveVesselFeedStalePolicy;
  style?: LiveVesselFeedStyleOptions;
  constraints?: {
    vertical?: VesselVerticalConstraint;
  };
  positionMapper?: (vessel: LiveAisVessel) => Coordinate;
  now?: () => Date;
}

export interface LiveVesselFeedVesselState {
  vessel: LiveAisVessel;
  pose: VesselPose;
  dimensions: VesselDimensions;
  selected: boolean;
}

export interface LiveVesselFeedController {
  updateVessels(vessels: readonly LiveAisVessel[]): Promise<void>;
  removeVessels(mmsis: readonly number[]): Promise<void>;
  clear(): Promise<void>;
  setStalePolicy(policy: LiveVesselFeedStalePolicy): Promise<void>;
  selectVessel(mmsi: number | null): Promise<void>;
  getVessel(mmsi: number): LiveVesselFeedVesselState | undefined;
  getVesselCount(): number;
  dispose(): Promise<void>;
}

type ManagedLiveVessel = {
  session: VesselFeatureSession;
  vessel: LiveAisVessel;
  pose: VesselPose;
  dimensions: VesselDimensions;
};

const DEFAULT_LENGTH_METERS = 60;
const DEFAULT_BEAM_METERS = 12;
const DEFAULT_DRAUGHT_METERS = 4;

export async function createLiveVesselFeedLayer(
  options: LiveVesselFeedLayerSpec,
): Promise<LiveVesselFeedController> {
  return new LiveVesselFeedSession(options);
}

export function mapLiveAisVesselToParametricVessel(
  vessel: LiveAisVessel,
): ParametricVesselSpec {
  return {
    kind: "parametric",
    template: templateForShipType(vessel.shipType),
    dimensions: dimensionsForLiveAisVessel(vessel),
    metadata: {
      source: vessel.source,
      mmsi: vessel.mmsi,
      name: vessel.name,
      shipType: vessel.shipType,
      reportClass: vessel.reportClass,
      stream: vessel.stream,
      draughtSource: vessel.draughtMeters !== undefined ? "ais" : "estimated",
      draughtEstimated: vessel.draughtMeters === undefined,
    },
  };
}

export function mapLiveAisVesselToPose(
  vessel: LiveAisVessel,
  positionMapper: (vessel: LiveAisVessel) => Coordinate = defaultLiveAisPositionMapper,
): VesselPose {
  const headingDegrees = headingForLiveAisVessel(vessel);
  const pose: VesselPose = {
    position: positionMapper(vessel),
  };
  if (headingDegrees !== undefined) {
    pose.headingDegrees = headingDegrees;
  }
  return pose;
}

export function defaultLiveAisPositionMapper(vessel: LiveAisVessel): Coordinate {
  return Coordinates.geodetic({
    lon: vessel.position.longitude,
    lat: vessel.position.latitude,
    height: vessel.position.heightMeters ?? 0,
    datum: vessel.position.crs,
  });
}

class LiveVesselFeedSession implements LiveVesselFeedController {
  private readonly vessels = new Map<number, ManagedLiveVessel>();
  private readonly now: () => Date;
  private stalePolicy: LiveVesselFeedStalePolicy;
  private selectedMmsi: number | null = null;
  private disposed = false;

  constructor(private readonly options: LiveVesselFeedLayerSpec) {
    this.now = options.now ?? (() => new Date());
    this.stalePolicy = {
      removeMissing: true,
      ...options.stalePolicy,
    };
  }

  async updateVessels(vessels: readonly LiveAisVessel[]): Promise<void> {
    this.assertActive();
    const seen = new Set<number>();
    for (const vessel of vessels) {
      if (!isFresh(vessel, this.now(), this.stalePolicy.maxAgeSeconds)) {
        continue;
      }
      seen.add(vessel.mmsi);
      await this.upsertVessel(vessel);
    }

    if (this.stalePolicy.removeMissing !== false) {
      const missing = [...this.vessels.keys()].filter((mmsi) => !seen.has(mmsi));
      await this.removeVessels(missing);
    }
  }

  async removeVessels(mmsis: readonly number[]): Promise<void> {
    for (const mmsi of mmsis) {
      const managed = this.vessels.get(mmsi);
      if (!managed) {
        continue;
      }
      await managed.session.dispose();
      this.vessels.delete(mmsi);
      if (this.selectedMmsi === mmsi) {
        this.selectedMmsi = null;
      }
    }
  }

  async clear(): Promise<void> {
    await this.removeVessels([...this.vessels.keys()]);
  }

  async setStalePolicy(policy: LiveVesselFeedStalePolicy): Promise<void> {
    this.stalePolicy = {
      ...this.stalePolicy,
      ...policy,
    };
    const stale = [...this.vessels.values()]
      .filter((managed) => !isFresh(managed.vessel, this.now(), this.stalePolicy.maxAgeSeconds))
      .map((managed) => managed.vessel.mmsi);
    await this.removeVessels(stale);
  }

  async selectVessel(mmsi: number | null): Promise<void> {
    this.selectedMmsi = mmsi;
    await Promise.all(
      [...this.vessels.values()].map((managed) => {
        const style = this.styleFor(managed.vessel.mmsi);
        return style !== undefined
          ? managed.session.vesselLayer.update({ style })
          : Promise.resolve();
      }),
    );
  }

  getVessel(mmsi: number): LiveVesselFeedVesselState | undefined {
    const managed = this.vessels.get(mmsi);
    if (!managed) {
      return undefined;
    }
    return {
      vessel: managed.vessel,
      pose: managed.pose,
      dimensions: managed.dimensions,
      selected: this.selectedMmsi === mmsi,
    };
  }

  getVesselCount(): number {
    return this.vessels.size;
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    await this.clear();
    this.disposed = true;
  }

  private async upsertVessel(vessel: LiveAisVessel): Promise<void> {
    const pose = mapLiveAisVesselToPose(vessel, this.options.positionMapper);
    const dimensions = dimensionsForLiveAisVessel(vessel);
    const existing = this.vessels.get(vessel.mmsi);
    if (existing) {
      existing.vessel = vessel;
      existing.pose = pose;
      existing.dimensions = dimensions;
      await existing.session.setDimensions(dimensions);
      await existing.session.setPose(pose);
      return;
    }

    const parametric = mapLiveAisVesselToParametricVessel(vessel);
    if (this.options.style?.colors !== undefined) {
      parametric.colors = this.options.style.colors;
    }
    const sessionOptions: ParametricVesselFeatureSessionOptions = {
      scene: this.options.scene,
      id: `${this.options.id ?? "live-vessel"}-${vessel.mmsi}`,
      parametric,
      pose,
    };
    if (this.options.constraints !== undefined) {
      sessionOptions.constraints = this.options.constraints;
    }
    const style = this.styleFor(vessel.mmsi);
    if (style !== undefined) {
      sessionOptions.style = style;
    }
    const session = await VesselFeatureSession.add(sessionOptions);
    this.vessels.set(vessel.mmsi, {
      session,
      vessel,
      pose,
      dimensions,
    });
  }

  private styleFor(mmsi: number): Partial<VesselStyle> | undefined {
    return {
      ...this.options.style?.style,
      ...(this.selectedMmsi === mmsi ? this.options.style?.selectedStyle : {}),
    };
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error("Live vessel feed has been disposed.");
    }
  }
}

function dimensionsForLiveAisVessel(vessel: LiveAisVessel): VesselDimensions {
  const source = vessel.dimensionsMeters;
  const sourceBow = nonNegative(source?.bow);
  const sourceStern = nonNegative(source?.stern);
  const sourcePort = nonNegative(source?.port);
  const sourceStarboard = nonNegative(source?.starboard);
  const length = positive(source?.length) ?? sumNonNegative(sourceBow, sourceStern) ?? DEFAULT_LENGTH_METERS;
  const width = positive(source?.width) ?? sumNonNegative(sourcePort, sourceStarboard) ?? DEFAULT_BEAM_METERS;
  const bow = sourceBow ?? length / 2;
  const stern = sourceStern ?? length - bow;
  const port = sourcePort ?? width / 2;
  const starboard = sourceStarboard ?? width - port;
  return {
    draught: positive(vessel.draughtMeters) ?? estimateDraughtMeters(width),
    bow,
    stern,
    port,
    starboard,
  };
}

function headingForLiveAisVessel(vessel: LiveAisVessel): number | undefined {
  return normalizeDegrees(vessel.headingDegrees) ?? normalizeDegrees(vessel.courseOverGroundDegrees);
}

function templateForShipType(shipType: number | undefined): string {
  if (shipType === undefined) {
    return "generic-service";
  }
  if (shipType >= 80 && shipType < 90) {
    return "generic-tanker";
  }
  if (shipType >= 70 && shipType < 80) {
    return "generic-cargo";
  }
  return "generic-service";
}

function isFresh(
  vessel: LiveAisVessel,
  now: Date,
  maxAgeSeconds: number | undefined,
): boolean {
  if (maxAgeSeconds === undefined) {
    return true;
  }
  const timestamp = Date.parse(vessel.messageTime);
  return Number.isFinite(timestamp) && now.getTime() - timestamp <= maxAgeSeconds * 1000;
}

function normalizeDegrees(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return ((value % 360) + 360) % 360;
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegative(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function sumNonNegative(left: number | undefined, right: number | undefined): number | undefined {
  const sum = left !== undefined && right !== undefined ? left + right : undefined;
  return sum !== undefined && sum > 0 ? sum : undefined;
}

function estimateDraughtMeters(width: number): number {
  return estimateParametricDraughtFromBeamMeters(width, DEFAULT_DRAUGHT_METERS);
}
