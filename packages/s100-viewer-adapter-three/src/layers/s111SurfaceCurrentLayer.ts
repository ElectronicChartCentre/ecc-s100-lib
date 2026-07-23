import {
  type BaseLayerSpec,
  type S111SurfaceCurrentLayerSpec,
} from "@ecc/s100-viewer";
import {
  getS111RecordIndexForTime,
  parseS111Time,
  resolveS111IntervalSeconds,
} from "@ecc/s100-viewer/internal/products/s111Time";
import {
  inferS111SpeedKnotsScale,
  resolveS111ArrowScaleMeters,
  resolveS111Scale,
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
import * as THREE from "three";
import type { FetchLike } from "../options.js";
import {
  projectedMetersToWorld,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";
import { disposeThreeObject } from "../shared/dispose.js";
import {
  finiteNumber,
  loadJsonSource,
  recordFromUnknown,
} from "../shared/source.js";
import {
  setLayerUserData,
  setObjectVisibility,
  type ThreeLayerNative,
} from "./types.js";

type S111Position = readonly [number, number];

type S111Record = {
  readonly speed: Float32Array;
  readonly direction: Float32Array;
};

type ParsedS111Dataset = {
  readonly positions: readonly S111Position[];
  readonly records: readonly S111Record[];
  readonly startTime: number;
  readonly intervalSeconds: number;
  readonly gridSizeMeters: number;
  readonly minSpeedKnots: number;
  readonly maxSpeedKnots: number;
  readonly speedKnotsScale: number;
};

type S111Vector = {
  x: number;
  y: number;
  speedKnots: number;
  directionDegrees: number;
};

export const createS111SurfaceCurrentLayer = async (
  spec: BaseLayerSpec,
  scene: THREE.Scene,
  reference: ThreeProjectedLocalReference,
  fetchHandler: FetchLike | undefined,
  getSeaLevel: () => number,
): Promise<ThreeLayerNative<S111SurfaceCurrentLayerSpec>> => {
  const s111Spec = spec as S111SurfaceCurrentLayerSpec;
  const data = await loadJsonSource(s111Spec.source, fetchHandler);
  const dataset = parseS111Dataset(data, reference);
  const group = new THREE.Group();
  group.name = `three-s111-${spec.id}`;
  group.visible = spec.visible ?? true;
  group.renderOrder = spec.zOrder ?? 1400;
  group.frustumCulled = false;

  const currentOverlay = createCurrentOverlay(
    s111Spec,
    dataset,
    reference,
    getS111VerticalOffset(getSeaLevel()),
  );
  updateCurrentOverlay(currentOverlay, s111Spec, dataset, undefined, true);
  group.add(currentOverlay.outlineMesh);
  group.add(currentOverlay.fillMesh);
  setCurrentOverlayOpacity(currentOverlay, spec.opacity ?? s111Spec.style?.opacity ?? 1);
  scene.add(group);

  return {
    spec: s111Spec,
    root: group,
    update: (time) => {
      setCurrentOverlayVerticalOffset(
        currentOverlay,
        getS111VerticalOffset(getSeaLevel()),
      );
      updateCurrentOverlay(currentOverlay, s111Spec, dataset, time.getTime());
    },
    setVisible: (visible) => {
      group.visible = visible;
    },
    setOpacity: (opacity) => {
      setCurrentOverlayOpacity(currentOverlay, opacity);
    },
    getPickableObjects: () => [currentOverlay.fillMesh],
    patch: (patch) => {
      setObjectVisibility(group, patch.visible);
      const opacity = patch.opacity ?? patch.style?.opacity;
      if (opacity !== undefined) {
        setCurrentOverlayOpacity(currentOverlay, opacity);
      }
      setCurrentOverlayVerticalOffset(
        currentOverlay,
        getS111VerticalOffset(getSeaLevel()),
      );
      updateCurrentOverlay(currentOverlay, s111Spec, dataset, undefined, true);
    },
    dispose: () => {
      scene.remove(group);
      disposeThreeObject(group);
    },
  };
};

type CurrentOverlay = {
  readonly outlineGeometry: THREE.InstancedBufferGeometry;
  readonly fillGeometry: THREE.InstancedBufferGeometry;
  readonly outlineMaterial: THREE.ShaderMaterial;
  readonly fillMaterial: THREE.ShaderMaterial;
  readonly outlineMesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  readonly fillMesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  readonly outlineInstancePositionScaleAngle: THREE.InstancedBufferAttribute;
  readonly fillInstancePositionScaleAngle: THREE.InstancedBufferAttribute;
  readonly outlineInstanceColor: THREE.InstancedBufferAttribute;
  readonly fillInstanceColor: THREE.InstancedBufferAttribute;
  readonly origin: S111Position;
  currentRecordIndex: number;
};

const DEFAULT_S111_VERTICAL_OFFSET_METERS = 0.5;

const createCurrentOverlay = (
  spec: S111SurfaceCurrentLayerSpec,
  dataset: ParsedS111Dataset,
  reference: ThreeProjectedLocalReference,
  verticalOffsetMeters: number,
): CurrentOverlay => {
  const origin = getSurfaceCurrentOrigin(dataset.positions);
  const outlineGeometry = createArrowGeometry(
    dataset.positions.length,
    S111_ARROW_OUTLINE_POLYGON,
  );
  const fillGeometry = createArrowGeometry(
    dataset.positions.length,
    S111_ARROW_POLYGON,
  );
  const outlineMaterial = createCurrentMaterial(verticalOffsetMeters, true);
  const fillMaterial = createCurrentMaterial(
    verticalOffsetMeters + S111_ARROW_FILL_VERTICAL_OFFSET_METERS,
    false,
  );
  const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outlineMesh.name = `three-s111-arrow-outlines-${spec.id}`;
  outlineMesh.renderOrder = spec.zOrder ?? 1400;
  outlineMesh.frustumCulled = false;
  const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
  fillMesh.name = `three-s111-arrows-${spec.id}`;
  fillMesh.renderOrder = (spec.zOrder ?? 1400) + 1;
  fillMesh.frustumCulled = false;
  const groupPosition = projectedMetersToWorld(origin[0], origin[1], 0, reference);
  outlineMesh.position.copy(groupPosition);
  fillMesh.position.copy(groupPosition);
  setLayerUserData(outlineMesh, spec, "vector", spec.id);
  setLayerUserData(fillMesh, spec, "vector", spec.id);
  const boundingSphere = createSurfaceCurrentBoundingSphere(dataset.positions, origin);
  outlineGeometry.boundingSphere = boundingSphere.clone();
  fillGeometry.boundingSphere = boundingSphere.clone();
  return {
    outlineGeometry,
    fillGeometry,
    outlineMaterial,
    fillMaterial,
    outlineMesh,
    fillMesh,
    outlineInstancePositionScaleAngle: outlineGeometry.getAttribute(
      "instancePosition",
    ) as THREE.InstancedBufferAttribute,
    fillInstancePositionScaleAngle: fillGeometry.getAttribute(
      "instancePosition",
    ) as THREE.InstancedBufferAttribute,
    outlineInstanceColor: outlineGeometry.getAttribute(
      "instanceColor",
    ) as THREE.InstancedBufferAttribute,
    fillInstanceColor: fillGeometry.getAttribute(
      "instanceColor",
    ) as THREE.InstancedBufferAttribute,
    origin,
    currentRecordIndex: -1,
  };
};

const updateCurrentOverlay = (
  overlay: CurrentOverlay,
  spec: S111SurfaceCurrentLayerSpec,
  dataset: ParsedS111Dataset,
  timeMs: number | undefined,
  force = false,
): void => {
  const recordIndex = getRecordIndex(dataset, timeMs);
  if (!force && overlay.currentRecordIndex === recordIndex) {
    return;
  }
  overlay.currentRecordIndex = recordIndex;

  const record = dataset.records[recordIndex];
  if (!record) {
    overlay.outlineGeometry.instanceCount = 0;
    overlay.fillGeometry.instanceCount = 0;
    return;
  }

  const scale = resolveS111Scale(spec.style);
  const autoScaling = scale === "auto";
  const customScale = typeof scale === "number" ? scale : undefined;
  overlay.outlineGeometry.instanceCount = dataset.positions.length;
  overlay.fillGeometry.instanceCount = dataset.positions.length;

  dataset.positions.forEach((position, index) => {
    const rawSpeed = record.speed[index];
    const direction = record.direction[index];
    if (
      rawSpeed === undefined ||
      direction === undefined ||
      !isValidCurrentValue(rawSpeed) ||
      !isValidCurrentValue(direction)
    ) {
      setS111ArrowInstance(
        overlay.outlineInstancePositionScaleAngle,
        overlay.outlineInstanceColor,
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
        overlay.fillInstancePositionScaleAngle,
        overlay.fillInstanceColor,
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
      return;
    }

    const speedKnots = rawSpeed * dataset.speedKnotsScale;
    const scaleInput = {
      speedKnots,
      autoScaling,
      gridSizeMeters: dataset.gridSizeMeters,
      minSpeedKnots: dataset.minSpeedKnots,
      maxSpeedKnots: dataset.maxSpeedKnots,
    };
    const length = resolveS111ArrowScaleMeters(
      customScale === undefined
        ? scaleInput
        : { ...scaleInput, customScaleMeters: customScale },
    );
    const angle = getS111ArrowInstanceAngleRadians(direction);
    const [r, g, b] = resolveS111SpeedColor(speedKnots);
    setS111ArrowInstance(
      overlay.outlineInstancePositionScaleAngle,
      overlay.outlineInstanceColor,
      index,
      position[0] - overlay.origin[0],
      position[1] - overlay.origin[1],
      length,
      angle,
      0,
      0,
      0,
      1,
    );
    setS111ArrowInstance(
      overlay.fillInstancePositionScaleAngle,
      overlay.fillInstanceColor,
      index,
      position[0] - overlay.origin[0],
      position[1] - overlay.origin[1],
      length,
      angle,
      r,
      g,
      b,
      1,
    );
  });

  overlay.outlineInstancePositionScaleAngle.needsUpdate = true;
  overlay.outlineInstanceColor.needsUpdate = true;
  overlay.fillInstancePositionScaleAngle.needsUpdate = true;
  overlay.fillInstanceColor.needsUpdate = true;
};

const createArrowGeometry = (
  instanceCount: number,
  polygon: readonly S111LocalPoint2D[],
): THREE.InstancedBufferGeometry => {
  const geometry = new THREE.InstancedBufferGeometry();
  const positions = polygon.flatMap(([x, y]) => [x, y, 0]);
  const instancePositionScaleAngle = new THREE.InstancedBufferAttribute(
    new Float32Array(Math.max(0, instanceCount) * 4),
    4,
  );
  const instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(Math.max(0, instanceCount) * 4),
    4,
  );

  instancePositionScaleAngle.setUsage(THREE.StreamDrawUsage);
  instanceColor.setUsage(THREE.StreamDrawUsage);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([...S111_ARROW_FILL_INDICES]);
  geometry.setAttribute("instancePosition", instancePositionScaleAngle);
  geometry.setAttribute("instanceColor", instanceColor);
  geometry.instanceCount = instanceCount;
  geometry.computeBoundingSphere();
  return geometry;
};

const createCurrentMaterial = (
  verticalOffsetMeters: number,
  outline: boolean,
): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZOffset: { value: verticalOffsetMeters },
      uOpacity: { value: 1 },
    },
    vertexShader: createS111ArrowVertexShader("y-up-xz"),
    fragmentShader: createS111ArrowFragmentShader(outline),
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    transparent: true,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;
  return material;
};

const getSurfaceCurrentOrigin = (
  positions: readonly S111Position[],
): S111Position => {
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
};

const createSurfaceCurrentBoundingSphere = (
  positions: readonly S111Position[],
  origin: S111Position,
): THREE.Sphere => {
  let radius = 1;
  for (const position of positions) {
    radius = Math.max(
      radius,
      Math.hypot(position[0] - origin[0], position[1] - origin[1]) +
        S111_ARROW_BOUNDING_RADIUS_PADDING_METERS,
    );
  }

  return new THREE.Sphere(new THREE.Vector3(0, 0, 0), radius);
};

const setCurrentOverlayOpacity = (
  overlay: CurrentOverlay,
  opacity: number,
): void => {
  const normalized = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
  const outlineOpacity = overlay.outlineMaterial.uniforms.uOpacity;
  const fillOpacity = overlay.fillMaterial.uniforms.uOpacity;
  if (outlineOpacity) {
    outlineOpacity.value = normalized;
  }
  if (fillOpacity) {
    fillOpacity.value = normalized;
  }
};

const setCurrentOverlayVerticalOffset = (
  overlay: CurrentOverlay,
  verticalOffsetMeters: number,
): void => {
  const outlineOffset = overlay.outlineMaterial.uniforms.uZOffset;
  const fillOffset = overlay.fillMaterial.uniforms.uZOffset;
  if (outlineOffset) {
    outlineOffset.value = verticalOffsetMeters;
  }
  if (fillOffset) {
    fillOffset.value = verticalOffsetMeters + S111_ARROW_FILL_VERTICAL_OFFSET_METERS;
  }
};

const getS111VerticalOffset = (seaLevel: number): number =>
  (Number.isFinite(seaLevel) ? seaLevel : 0) + DEFAULT_S111_VERTICAL_OFFSET_METERS;

const parseS111Dataset = (
  data: unknown,
  reference: ThreeProjectedLocalReference,
): ParsedS111Dataset => {
  const datasetRecord = findStructuredDataset(data);
  if (datasetRecord) {
    const positions = parsePositions(datasetRecord.positions);
    const records = parseRecords(datasetRecord.data, positions.length);
    if (positions.length > 0 && records.length > 0) {
      return createParsedDataset(datasetRecord, positions, records);
    }
  }

  const looseVectors = extractLooseVectors(data);
  if (looseVectors.length > 0) {
    return datasetFromVectors(looseVectors);
  }

  return createFallbackDataset(reference);
};

const findStructuredDataset = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findStructuredDataset(item);
      if (result) {
        return result;
      }
    }
    return null;
  }

  const record = recordFromUnknown(value);
  const positions = parsePositions(record.positions);
  const records = parseRecords(record.data, positions.length);
  if (positions.length > 0 && records.length > 0) {
    return record;
  }

  for (const child of Object.values(record)) {
    if (typeof child === "object" && child !== null) {
      const result = findStructuredDataset(child);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

const createParsedDataset = (
  record: Record<string, unknown>,
  positions: readonly S111Position[],
  records: readonly S111Record[],
): ParsedS111Dataset => {
  const rawSpeedRange = getRawSpeedRange(records);
  const speedKnotsScale = inferS111SpeedKnotsScale(rawSpeedRange.max);
  return {
    positions,
    records,
    startTime: parseS111Time(record.dateTimeOfFirstRecord) ?? 0,
    intervalSeconds: resolveS111IntervalSeconds(record.timeRecordInterval),
    gridSizeMeters: getGridSize(record, positions),
    minSpeedKnots: rawSpeedRange.min * speedKnotsScale,
    maxSpeedKnots: rawSpeedRange.max * speedKnotsScale,
    speedKnotsScale,
  };
};

const datasetFromVectors = (
  vectors: readonly S111Vector[],
): ParsedS111Dataset => {
  const positions = vectors.map((vector): S111Position => [vector.x, vector.y]);
  const speed = new Float32Array(vectors.length);
  const direction = new Float32Array(vectors.length);
  vectors.forEach((vector, index) => {
    speed[index] = vector.speedKnots;
    direction[index] = vector.directionDegrees;
  });
  return createParsedDataset(
    { timeRecordInterval: 3600, data: [] },
    positions,
    [{ speed, direction }],
  );
};

const createFallbackDataset = (
  reference: ThreeProjectedLocalReference,
): ParsedS111Dataset => {
  const vectors: S111Vector[] = [];
  const spacing = 220;
  for (let x = -4; x <= 4; x += 1) {
    for (let y = -4; y <= 4; y += 1) {
      vectors.push({
        x: reference.origin.x + x * spacing,
        y: reference.origin.y + y * spacing,
        speedKnots: Math.hypot(x, y) * 0.25 + 0.5,
        directionDegrees: (x * 22 + y * 13 + 45) % 360,
      });
    }
  }
  return datasetFromVectors(vectors);
};

const parsePositions = (value: unknown): readonly S111Position[] => {
  const values = arrayLikeNumbers(value);
  if (values) {
    const positions: S111Position[] = [];
    for (let index = 0; index < values.length - 1; index += 2) {
      const x = normalizeFiniteNumber(values[index]);
      const y = normalizeFiniteNumber(values[index + 1]);
      if (x !== undefined && y !== undefined) {
        positions.push([x, y]);
      }
    }
    return positions;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const positions: S111Position[] = [];
  for (const entry of value) {
    const position = parsePosition(entry);
    if (position) {
      positions.push(position);
    }
  }
  return positions;
};

const parsePosition = (value: unknown): S111Position | null => {
  if (Array.isArray(value)) {
    const x = normalizeFiniteNumber(value[0]);
    const y = normalizeFiniteNumber(value[1]);
    return x !== undefined && y !== undefined ? [x, y] : null;
  }

  const record = recordFromUnknown(value);
  const x =
    normalizeFiniteNumber(record.x) ??
    normalizeFiniteNumber(record.easting) ??
    normalizeFiniteNumber(record.Easting);
  const y =
    normalizeFiniteNumber(record.y) ??
    normalizeFiniteNumber(record.northing) ??
    normalizeFiniteNumber(record.Northing);
  return x !== undefined && y !== undefined ? [x, y] : null;
};

const parseRecords = (
  value: unknown,
  positionCount: number,
): readonly S111Record[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: S111Record[] = [];
  for (const record of value) {
    const parsedRecord = parseRecord(record, positionCount);
    if (parsedRecord) {
      records.push(parsedRecord);
    }
  }
  return records;
};

const parseRecord = (
  value: unknown,
  positionCount: number,
): S111Record | null => {
  const record = recordFromUnknown(value);
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
};

const parseNumericArray = (
  value: unknown,
  count: number,
): Float32Array | null => {
  const values = arrayLikeNumbers(value);
  if (!values) {
    return null;
  }

  const output = new Float32Array(count);
  output.fill(Number.NaN);
  const limit = Math.min(count, values.length);
  for (let index = 0; index < limit; index += 1) {
    output[index] = normalizeFiniteNumber(values[index]) ?? Number.NaN;
  }
  return output;
};

const extractLooseVectors = (data: unknown): S111Vector[] => {
  const vectors: S111Vector[] = [];
  collectLooseVectors(data, vectors);
  return vectors.slice(0, 20_000);
};

const collectLooseVectors = (value: unknown, output: S111Vector[]): void => {
  if (output.length >= 20_000) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectLooseVectors(item, output);
    }
    return;
  }
  const record = recordFromUnknown(value);
  const x = firstNumber(record, ["x", "easting", "Easting"]);
  const y = firstNumber(record, ["y", "northing", "Northing"]);
  const speed = firstNumber(record, ["speedKnots", "speed", "surfaceCurrentSpeed"]);
  const direction = firstNumber(record, [
    "directionDegrees",
    "direction",
    "surfaceCurrentDirection",
  ]);
  if (x !== null && y !== null && speed !== null) {
    output.push({
      x,
      y,
      speedKnots: speed,
      directionDegrees: direction ?? 0,
    });
  }

  for (const child of Object.values(record)) {
    if (typeof child === "object" && child !== null) {
      collectLooseVectors(child, output);
    }
  }
};

const getRecordIndex = (
  dataset: ParsedS111Dataset,
  timeMs: number | undefined,
): number => {
  if (dataset.records.length <= 1) {
    return 0;
  }
  return getS111RecordIndexForTime(
    dataset.records.length,
    dataset.startTime,
    dataset.intervalSeconds,
    timeMs ?? dataset.startTime,
  );
};

const getRawSpeedRange = (
  records: readonly S111Record[],
): { min: number; max: number } => {
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
};

const getGridSize = (
  dataset: Record<string, unknown>,
  positions: readonly S111Position[],
): number => {
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
};

const arrayLikeNumbers = (value: unknown): readonly number[] | null => {
  if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
    return value;
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Array.from(value as unknown as ArrayLike<number>).filter(
      (entry) => typeof entry === "number",
    );
  }
  return null;
};

const firstNumber = (
  record: Record<string, unknown>,
  keys: readonly string[],
): number | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return finiteNumber(value);
    }
  }
  return null;
};

const isValidCurrentValue = (
  value: number,
): boolean =>
  Number.isFinite(value) &&
  value >= 0;

const normalizeFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
