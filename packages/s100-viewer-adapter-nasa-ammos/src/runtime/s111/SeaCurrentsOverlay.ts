import {
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Sphere,
  ShaderMaterial,
  StreamDrawUsage,
  Vector3,
  type Scene,
} from "three";
import {
  getS111RecordCount,
  getS111RecordIndexForTime,
  parseS111Time,
  resolveS111IntervalSeconds,
} from "@ecc/s100-viewer/internal/products/s111Time";
import {
  inferS111SpeedKnotsScale,
  resolveS111ArrowScaleMeters,
  resolveS111SpeedColor,
} from "@ecc/s100-viewer/internal/products/s111Style";
import {
  createS111ArrowFragmentShader,
  createS111ArrowVertexShader,
  getS111ArrowInstanceAngleRadians,
  setS111ArrowInstance,
  S111_ARROW_BOUNDING_RADIUS_PADDING_METERS,
  S111_ARROW_FILL_INDICES,
  S111_ARROW_FILL_VERTICAL_OFFSET_METERS,
  S111_ARROW_OUTLINE_POLYGON,
  S111_ARROW_POLYGON,
  type S111LocalPoint2D,
} from "@ecc/s100-viewer/internal/products/s111Glyph";

export type SurfaceCurrentDatasetLike = {
  id?: string;
  timeRecordInterval?: number;
  dateTimeOfFirstRecord?: string;
  dateTimeOfLastRecord?: string;
  numberOfTimes?: number;
  positions?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

export type ParsedSurfaceCurrentDataset = {
  readonly id: string;
  readonly positions: readonly SurfaceCurrentPosition[];
  readonly records: readonly SurfaceCurrentRecord[];
  readonly startTime: number;
  readonly endTime: number;
  readonly intervalSeconds: number;
  readonly gridSize: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly speedKnotsScale: number;
};

type SurfaceCurrentPosition = readonly [number, number];

type SurfaceCurrentRecord = {
  readonly speed: Float32Array;
  readonly direction: Float32Array;
};

type SeaCurrentsOverlayOptions = {
  currentTimeMs?: number;
  customScale?: number;
  autoScaling?: boolean;
  zOffset?: number;
  originOffset?: readonly [number, number, number] | undefined;
};

const DEFAULT_Z_OFFSET = 0.5;

export class SeaCurrentsOverlay {
  readonly group = new Group();
  readonly parsedDataset: ParsedSurfaceCurrentDataset;

  private readonly scene: Scene;
  private readonly fillGeometry: InstancedBufferGeometry;
  private readonly outlineGeometry: InstancedBufferGeometry;
  private readonly fillMaterial: ShaderMaterial;
  private readonly outlineMaterial: ShaderMaterial;
  private readonly fillMesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly outlineMesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly fillInstancePositionScaleAngle: InstancedBufferAttribute;
  private readonly outlineInstancePositionScaleAngle: InstancedBufferAttribute;
  private readonly fillInstanceColor: InstancedBufferAttribute;
  private readonly outlineInstanceColor: InstancedBufferAttribute;
  private readonly origin: SurfaceCurrentPosition;
  private currentTimeMs: number;
  private customScale: number;
  private autoScaling: boolean;
  private zOffset: number;
  private currentRecordIndex = -1;
  private disposed = false;

  constructor(
    dataset: SurfaceCurrentDatasetLike,
    scene: Scene,
    options: SeaCurrentsOverlayOptions = {},
  ) {
    this.scene = scene;
    this.parsedDataset = parseSurfaceCurrentDataset(dataset);
    this.currentTimeMs =
      normalizeFiniteNumber(options.currentTimeMs) ??
      this.parsedDataset.startTime;
    this.customScale = normalizePositiveScale(options.customScale);
    this.autoScaling = options.autoScaling ?? false;
    this.zOffset = normalizeFiniteNumber(options.zOffset) ?? DEFAULT_Z_OFFSET;
    this.group.name = `s100-s111:${this.parsedDataset.id}`;
    this.group.renderOrder = 1300;
    this.group.frustumCulled = false;
    this.origin = getSurfaceCurrentOrigin(this.parsedDataset.positions);
    const originOffset = options.originOffset ?? [0, 0, 0];
    this.group.position.set(
      this.origin[0] + originOffset[0],
      this.origin[1] + originOffset[1],
      originOffset[2],
    );

    this.outlineGeometry = createArrowGeometry(
      this.parsedDataset.positions.length,
      S111_ARROW_OUTLINE_POLYGON,
    );
    this.fillGeometry = createArrowGeometry(
      this.parsedDataset.positions.length,
      S111_ARROW_POLYGON,
    );
    this.outlineInstancePositionScaleAngle = this.outlineGeometry.getAttribute(
      "instancePosition",
    ) as InstancedBufferAttribute;
    this.fillInstancePositionScaleAngle = this.fillGeometry.getAttribute(
      "instancePosition",
    ) as InstancedBufferAttribute;
    this.outlineInstanceColor = this.outlineGeometry.getAttribute(
      "instanceColor",
    ) as InstancedBufferAttribute;
    this.fillInstanceColor = this.fillGeometry.getAttribute(
      "instanceColor",
    ) as InstancedBufferAttribute;
    this.outlineMaterial = createSeaCurrentsMaterial(this.zOffset, true);
    this.fillMaterial = createSeaCurrentsMaterial(
      this.zOffset + S111_ARROW_FILL_VERTICAL_OFFSET_METERS,
      false,
    );
    this.outlineMesh = new Mesh(this.outlineGeometry, this.outlineMaterial);
    this.outlineMesh.name = `s100-s111-arrow-outlines:${this.parsedDataset.id}`;
    this.outlineMesh.renderOrder = this.group.renderOrder;
    this.outlineMesh.frustumCulled = false;
    this.fillMesh = new Mesh(this.fillGeometry, this.fillMaterial);
    this.fillMesh.name = `s100-s111-arrows:${this.parsedDataset.id}`;
    this.fillMesh.renderOrder = this.group.renderOrder + 1;
    this.fillMesh.frustumCulled = false;
    const boundingSphere = createSurfaceCurrentBoundingSphere(
      this.parsedDataset.positions,
      this.origin,
    );
    this.outlineGeometry.boundingSphere = boundingSphere.clone();
    this.fillGeometry.boundingSphere = boundingSphere.clone();
    this.group.add(this.outlineMesh);
    this.group.add(this.fillMesh);
    this.scene.add(this.group);
    this.updateInstances(true);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (visible) {
      this.updateInstances(false);
    }
  }

  setCustomScale(scale: number): void {
    const nextScale = normalizePositiveScale(scale, this.customScale);
    if (nextScale === this.customScale) {
      return;
    }
    this.customScale = nextScale;
    this.updateInstances(true);
  }

  setAutoScaling(enabled: boolean): void {
    if (enabled === this.autoScaling) {
      return;
    }
    this.autoScaling = enabled;
    this.updateInstances(true);
  }

  setCurrentTime(currentTimeMs: number): void {
    const nextTime =
      normalizeFiniteNumber(currentTimeMs) ?? this.parsedDataset.startTime;
    if (nextTime === this.currentTimeMs) {
      return;
    }
    this.currentTimeMs = nextTime;
    if (!this.group.visible) {
      this.currentRecordIndex = -1;
      return;
    }
    this.updateInstances(false);
  }

  setZOffset(zOffset: number): void {
    const nextZOffset = normalizeFiniteNumber(zOffset) ?? DEFAULT_Z_OFFSET;
    if (nextZOffset === this.zOffset) {
      return;
    }
    this.zOffset = nextZOffset;
    const outlineUniform = this.outlineMaterial.uniforms.uZOffset;
    if (outlineUniform) {
      outlineUniform.value = nextZOffset;
    }
    const fillUniform = this.fillMaterial.uniforms.uZOffset;
    if (fillUniform) {
      fillUniform.value = nextZOffset + S111_ARROW_FILL_VERTICAL_OFFSET_METERS;
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.scene.remove(this.group);
    this.outlineGeometry.dispose();
    this.fillGeometry.dispose();
    this.outlineMaterial.dispose();
    this.fillMaterial.dispose();
  }

  private updateInstances(force: boolean): void {
    if (this.disposed) {
      return;
    }

    const recordIndex = getRecordIndex(
      this.parsedDataset,
      this.currentTimeMs,
    );
    if (!force && recordIndex === this.currentRecordIndex) {
      return;
    }

    this.currentRecordIndex = recordIndex;
    const record = this.parsedDataset.records[recordIndex];
    const positions = this.parsedDataset.positions;
    if (!record) {
      this.outlineGeometry.instanceCount = 0;
      this.fillGeometry.instanceCount = 0;
      return;
    }

    this.outlineGeometry.instanceCount = positions.length;
    this.fillGeometry.instanceCount = positions.length;
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      const speed = record.speed[index];
      const direction = record.direction[index];
      if (
        !position ||
        speed === undefined ||
        direction === undefined ||
        !isValidCurrentValue(speed, direction)
      ) {
        setS111ArrowInstance(
          this.outlineInstancePositionScaleAngle,
          this.outlineInstanceColor,
          index,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        );
        setS111ArrowInstance(
          this.fillInstancePositionScaleAngle,
          this.fillInstanceColor,
          index,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        );
        continue;
      }

      const speedKnots = speed * this.parsedDataset.speedKnotsScale;
      const scale =
        getArrowScale(
          speedKnots,
          this.customScale,
          this.autoScaling,
          this.parsedDataset,
        );
      const angle = getS111ArrowInstanceAngleRadians(direction);
      const color = resolveS111SpeedColor(speedKnots);
      setS111ArrowInstance(
        this.outlineInstancePositionScaleAngle,
        this.outlineInstanceColor,
        index,
        position[0] - this.origin[0],
        position[1] - this.origin[1],
        scale,
        angle,
        0,
        0,
        0,
        1,
      );
      setS111ArrowInstance(
        this.fillInstancePositionScaleAngle,
        this.fillInstanceColor,
        index,
        position[0] - this.origin[0],
        position[1] - this.origin[1],
        scale,
        angle,
        color[0],
        color[1],
        color[2],
        1,
      );
    }

    this.outlineInstancePositionScaleAngle.needsUpdate = true;
    this.outlineInstanceColor.needsUpdate = true;
    this.fillInstancePositionScaleAngle.needsUpdate = true;
    this.fillInstanceColor.needsUpdate = true;
  }
}

export function parseSurfaceCurrentDataset(
  dataset: SurfaceCurrentDatasetLike,
): ParsedSurfaceCurrentDataset {
  const positions = parsePositions(dataset.positions);
  const records = parseRecords(dataset.data, positions.length);
  const intervalSeconds = normalizeIntervalSeconds(dataset.timeRecordInterval);
  const startTime = parseSurfaceCurrentTime(dataset.dateTimeOfFirstRecord) ?? 0;
  const rawSpeedRange = getRawSpeedRange(records);
  const speedKnotsScale = inferS111SpeedKnotsScale(rawSpeedRange.max);
  const endTime =
    parseSurfaceCurrentTime(dataset.dateTimeOfLastRecord) ??
    startTime +
      intervalSeconds *
        1000 *
        Math.max(0, getSurfaceCurrentRecordCount(dataset) - 1);
  return {
    id: normalizeDatasetId(dataset.id),
    positions,
    records,
    startTime,
    endTime,
    intervalSeconds,
    gridSize: getGridSize(dataset, positions),
    minSpeed: rawSpeedRange.min * speedKnotsScale,
    maxSpeed: rawSpeedRange.max * speedKnotsScale,
    speedKnotsScale,
  };
}

export function parseSurfaceCurrentTime(value: unknown): number | undefined {
  return parseS111Time(value) ?? undefined;
}

export function getSurfaceCurrentRecordCount(
  dataset: SurfaceCurrentDatasetLike,
): number {
  return getS111RecordCount(dataset);
}

function createArrowGeometry(
  instanceCount: number,
  polygon: readonly S111LocalPoint2D[],
): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  const positions = polygon.flatMap(([x, y]) => [x, y, 0]);
  const instancePositionScaleAngle = new InstancedBufferAttribute(
    new Float32Array(Math.max(0, instanceCount) * 4),
    4,
  );
  const instanceColor = new InstancedBufferAttribute(
    new Float32Array(Math.max(0, instanceCount) * 4),
    4,
  );

  instancePositionScaleAngle.setUsage(StreamDrawUsage);
  instanceColor.setUsage(StreamDrawUsage);
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex([...S111_ARROW_FILL_INDICES]);
  geometry.setAttribute("instancePosition", instancePositionScaleAngle);
  geometry.setAttribute("instanceColor", instanceColor);
  geometry.instanceCount = instanceCount;
  geometry.computeBoundingSphere();
  return geometry;
}

function getSurfaceCurrentOrigin(
  positions: readonly SurfaceCurrentPosition[],
): SurfaceCurrentPosition {
  if (positions.length === 0) {
    return [0, 0];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const position of positions) {
    minX = Math.min(minX, position[0]);
    minY = Math.min(minY, position[1]);
    maxX = Math.max(maxX, position[0]);
    maxY = Math.max(maxY, position[1]);
  }

  return Number.isFinite(minX) &&
    Number.isFinite(minY) &&
    Number.isFinite(maxX) &&
    Number.isFinite(maxY)
    ? [(minX + maxX) / 2, (minY + maxY) / 2]
    : [0, 0];
}

function createSurfaceCurrentBoundingSphere(
  positions: readonly SurfaceCurrentPosition[],
  origin: SurfaceCurrentPosition,
): Sphere {
  let radius = 1;
  for (const position of positions) {
    radius = Math.max(
      radius,
      Math.hypot(position[0] - origin[0], position[1] - origin[1]) +
        S111_ARROW_BOUNDING_RADIUS_PADDING_METERS,
    );
  }

  return new Sphere(new Vector3(0, 0, DEFAULT_Z_OFFSET), radius);
}

function createSeaCurrentsMaterial(
  zOffset: number,
  outline: boolean,
): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: {
      uZOffset: { value: zOffset },
      uOpacity: { value: 1 },
    },
    vertexShader: createS111ArrowVertexShader("z-up-xy"),
    fragmentShader: createS111ArrowFragmentShader(outline),
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;
  return material;
}

function parsePositions(value: unknown): readonly SurfaceCurrentPosition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.every((entry) => typeof entry === "number")) {
    const positions: SurfaceCurrentPosition[] = [];
    for (let index = 0; index < value.length - 1; index += 2) {
      const x = normalizeFiniteNumber(value[index]);
      const y = normalizeFiniteNumber(value[index + 1]);
      if (x !== undefined && y !== undefined) {
        positions.push([x, y]);
      }
    }
    return positions;
  }

  const positions: SurfaceCurrentPosition[] = [];
  for (const entry of value) {
    const position = parsePosition(entry);
    if (position) {
      positions.push(position);
    }
  }
  return positions;
}

function parsePosition(value: unknown): SurfaceCurrentPosition | null {
  if (Array.isArray(value)) {
    const x = normalizeFiniteNumber(value[0]);
    const y = normalizeFiniteNumber(value[1]);
    return x !== undefined && y !== undefined ? [x, y] : null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const x =
    normalizeFiniteNumber(record.x) ??
    normalizeFiniteNumber(record.easting) ??
    normalizeFiniteNumber(record.Easting);
  const y =
    normalizeFiniteNumber(record.y) ??
    normalizeFiniteNumber(record.northing) ??
    normalizeFiniteNumber(record.Northing);
  return x !== undefined && y !== undefined ? [x, y] : null;
}

function parseRecords(
  value: unknown,
  positionCount: number,
): readonly SurfaceCurrentRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: SurfaceCurrentRecord[] = [];
  for (const record of value) {
    const parsedRecord = parseRecord(record, positionCount);
    if (parsedRecord) {
      records.push(parsedRecord);
    }
  }
  return records;
}

function parseRecord(
  value: unknown,
  positionCount: number,
): SurfaceCurrentRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const speed = parseNumericArray(
    record.speed ??
      record.surfaceCurrentSpeed ??
      record.surface_current_speed ??
      record.surfaceCurrentSpeedValues,
    positionCount,
  );
  const direction = parseNumericArray(
    record.direction ??
      record.surfaceCurrentDirection ??
      record.surface_current_direction ??
      record.surfaceCurrentDirectionValues,
    positionCount,
  );
  return speed && direction ? { speed, direction } : null;
}

function parseNumericArray(
  value: unknown,
  count: number,
): Float32Array | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const output = new Float32Array(count);
  output.fill(Number.NaN);
  const limit = Math.min(count, value.length);
  for (let index = 0; index < limit; index += 1) {
    const parsed = normalizeFiniteNumber(value[index]);
    output[index] = parsed ?? Number.NaN;
  }
  return output;
}

function getRecordIndex(
  dataset: ParsedSurfaceCurrentDataset,
  currentTimeMs: number,
): number {
  return getS111RecordIndexForTime(
    dataset.records.length,
    dataset.startTime,
    dataset.intervalSeconds,
    currentTimeMs,
  );
}

function getRawSpeedRange(records: readonly SurfaceCurrentRecord[]): {
  min: number;
  max: number;
} {
  let minSpeed = Number.POSITIVE_INFINITY;
  let maxSpeed = 0;
  for (const record of records) {
    for (const speed of record.speed) {
      if (!Number.isFinite(speed) || speed < 0) {
        continue;
      }
      minSpeed = Math.min(minSpeed, speed);
      maxSpeed = Math.max(maxSpeed, speed);
    }
  }

  return {
    min: Number.isFinite(minSpeed) ? minSpeed : 0,
    max: maxSpeed,
  };
}

function getGridSize(
  dataset: SurfaceCurrentDatasetLike,
  positions: readonly SurfaceCurrentPosition[],
): number {
  const explicitGridSize = normalizeFiniteNumber(dataset.gridSize);
  if (explicitGridSize !== undefined && explicitGridSize > 0) {
    return explicitGridSize;
  }

  if (positions.length < 2) {
    return 0;
  }

  const nearestDistances: number[] = [];
  const sampledCount = Math.min(positions.length, 128);
  const stride = Math.max(1, Math.floor(positions.length / sampledCount));
  for (
    let positionIndex = 0;
    positionIndex < positions.length && nearestDistances.length < sampledCount;
    positionIndex += stride
  ) {
    const position = positions[positionIndex];
    if (!position) {
      continue;
    }
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let candidateIndex = 0; candidateIndex < positions.length; candidateIndex += 1) {
      if (candidateIndex === positionIndex) {
        continue;
      }
      const candidate = positions[candidateIndex];
      if (!candidate) {
        continue;
      }
      const distance = Math.hypot(
        position[0] - candidate[0],
        position[1] - candidate[1],
      );
      if (distance > 0 && distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
    if (Number.isFinite(nearestDistance)) {
      nearestDistances.push(nearestDistance);
    }
  }

  if (nearestDistances.length === 0) {
    const first = positions[0];
    const second = positions[1];
    return first && second
      ? Math.hypot(first[0] - second[0], first[1] - second[1])
      : 0;
  }

  nearestDistances.sort((a, b) => a - b);
  return nearestDistances[Math.floor(nearestDistances.length / 2)] ?? 0;
}

function getArrowScale(
  speedKnots: number,
  customScale: number,
  autoScaling: boolean,
  dataset: ParsedSurfaceCurrentDataset,
): number {
  return resolveS111ArrowScaleMeters(
    {
      speedKnots,
      customScaleMeters: customScale,
      autoScaling,
      gridSizeMeters: dataset.gridSize,
      minSpeedKnots: dataset.minSpeed,
      maxSpeedKnots: dataset.maxSpeed,
    },
  );
}

function isValidCurrentValue(
  speed: number | undefined,
  direction: number | undefined,
): speed is number {
  return (
    speed !== undefined &&
    direction !== undefined &&
    Number.isFinite(speed) &&
    Number.isFinite(direction) &&
    speed >= 0 &&
    direction >= 0
  );
}

function normalizeDatasetId(id: unknown): string {
  if (typeof id === "string" && id.trim()) {
    return id.trim();
  }
  return "surface-currents";
}

function normalizeIntervalSeconds(value: unknown): number {
  return resolveS111IntervalSeconds(value);
}

function normalizePositiveScale(value: unknown, fallback = 1): number {
  const scale = normalizeFiniteNumber(value);
  return scale !== undefined && scale > 0 ? scale : fallback;
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
