export function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
  return value;
}

export function requireNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function clampCenterInsideRange(
  center: number,
  min: number,
  max: number,
  sizeMeters: number,
): number {
  const halfSize = sizeMeters / 2;
  const centerMin = min + halfSize;
  const centerMax = max - halfSize;
  if (centerMin > centerMax) {
    return (min + max) / 2;
  }
  return clamp(center, centerMin, centerMax);
}

function clampContainerCenter(
  requestedCenter: number,
  containedCenter: number,
  min: number,
  max: number,
  containerSizeMeters: number,
  containedSizeMeters: number,
): number {
  const halfContainer = containerSizeMeters / 2;
  const halfContained = containedSizeMeters / 2;
  const centerMin = Math.max(
    min + halfContainer,
    containedCenter + halfContained - containerSizeMeters,
  );
  const centerMax = Math.min(
    max - halfContainer,
    containedCenter - halfContained + containerSizeMeters,
  );
  if (centerMin > centerMax) {
    return clampCenterInsideRange(containedCenter, min, max, containerSizeMeters);
  }
  return clamp(requestedCenter, centerMin, centerMax);
}

function safeScale(size: number, naturalSize: number): number {
  return naturalSize > 0 ? size / naturalSize : 1;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
