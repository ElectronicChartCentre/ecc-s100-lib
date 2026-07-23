export type S111LocalPoint2D = readonly [number, number];

export type S111InstancedAttributeLike = {
  setXYZW(
    index: number,
    x: number,
    y: number,
    z: number,
    w: number,
  ): void;
};

export type S111ArrowVertexFrame = "z-up-xy" | "y-up-xz";

export const S111_ARROW_BOUNDING_RADIUS_PADDING_METERS = 1;
export const S111_ARROW_OUTLINE_WIDTH = 0.0105;
export const S111_ARROW_FILL_VERTICAL_OFFSET_METERS = 0.02;
export const S111_ARROW_POLYGON: readonly S111LocalPoint2D[] = [
  [0.5, 0],
  [0.15, 0.2],
  [0.15, 0.1],
  [-0.5, 0.05],
  [-0.5, -0.05],
  [0.15, -0.1],
  [0.15, -0.2],
];
export const S111_ARROW_FILL_INDICES = [0, 1, 6, 2, 3, 4, 2, 4, 5] as const;
export const S111_ARROW_OUTLINE_POLYGON = offsetS111ClosedPolygon(
  S111_ARROW_POLYGON,
  S111_ARROW_OUTLINE_WIDTH,
);

export const getS111ArrowInstanceAngleRadians = (directionDegrees: number): number =>
  ((90 - directionDegrees) * Math.PI) / 180;

export const setS111ArrowInstance = (
  positionAttribute: S111InstancedAttributeLike,
  colorAttribute: S111InstancedAttributeLike,
  index: number,
  x: number,
  y: number,
  scale: number,
  angle: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void => {
  positionAttribute.setXYZW(index, x, y, scale, angle);
  colorAttribute.setXYZW(index, red, green, blue, alpha);
};

export const createS111ArrowVertexShader = (
  frame: S111ArrowVertexFrame,
): string => {
  const localPositionExpression = frame === "z-up-xy"
    ? "vec3(rotatedPosition + instancePosition.xy, position.z + uZOffset)"
    : "vec3(rotatedPosition.x + instancePosition.x, position.z + uZOffset, -(rotatedPosition.y + instancePosition.y))";
  return `
    uniform float uZOffset;

    attribute vec4 instancePosition;
    attribute vec4 instanceColor;

    varying vec4 vColor;

    void main() {
      vec2 localPosition = position.xy * instancePosition.z;
      float angle = instancePosition.w;
      float s = sin(angle);
      float c = cos(angle);
      vec2 rotatedPosition = vec2(
        localPosition.x * c - localPosition.y * s,
        localPosition.x * s + localPosition.y * c
      );
      vec3 localPosition3 = ${localPositionExpression};

      vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(localPosition3, 1.0);
    }
  `;
};

export const createS111ArrowFragmentShader = (outline: boolean): string => `
  uniform float uOpacity;

  varying vec4 vColor;

  void main() {
    if (vColor.a <= 0.0 || uOpacity <= 0.0) {
      discard;
    }

    gl_FragColor = vec4(${outline ? "vec3(0.0)" : "vColor.rgb"}, vColor.a * uOpacity);
  }
`;

export function offsetS111ClosedPolygon(
  points: readonly S111LocalPoint2D[],
  distance: number,
): S111LocalPoint2D[] {
  if (points.length < 3 || !Number.isFinite(distance) || distance <= 0) {
    return [...points];
  }

  const orientation = signedPolygonArea(points) >= 0 ? 1 : -1;
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length] ?? point;
    const next = points[(index + 1) % points.length] ?? point;
    const previousEdge = subtractLocalPoint(point, previous);
    const nextEdge = subtractLocalPoint(next, point);
    const previousNormal = outwardEdgeNormal(previousEdge, orientation);
    const nextNormal = outwardEdgeNormal(nextEdge, orientation);
    const previousOffsetStart = addScaledLocalPoint(previous, previousNormal, distance);
    const nextOffsetStart = addScaledLocalPoint(point, nextNormal, distance);
    const intersection = intersectLocalLines(
      previousOffsetStart,
      previousEdge,
      nextOffsetStart,
      nextEdge,
    );
    if (intersection) {
      return intersection;
    }

    const averageNormal = normalizeLocalPoint([
      previousNormal[0] + nextNormal[0],
      previousNormal[1] + nextNormal[1],
    ]);
    return addScaledLocalPoint(point, averageNormal, distance);
  });
}

function signedPolygonArea(points: readonly S111LocalPoint2D[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index] ?? [0, 0];
    const next = points[(index + 1) % points.length] ?? current;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function subtractLocalPoint(
  left: S111LocalPoint2D,
  right: S111LocalPoint2D,
): S111LocalPoint2D {
  return [left[0] - right[0], left[1] - right[1]];
}

function addScaledLocalPoint(
  point: S111LocalPoint2D,
  vector: S111LocalPoint2D,
  scale: number,
): S111LocalPoint2D {
  return [point[0] + vector[0] * scale, point[1] + vector[1] * scale];
}

function outwardEdgeNormal(
  edge: S111LocalPoint2D,
  orientation: 1 | -1,
): S111LocalPoint2D {
  const length = Math.hypot(edge[0], edge[1]) || 1;
  return orientation > 0
    ? [edge[1] / length, -edge[0] / length]
    : [-edge[1] / length, edge[0] / length];
}

function normalizeLocalPoint(point: S111LocalPoint2D): S111LocalPoint2D {
  const length = Math.hypot(point[0], point[1]);
  return length > 1e-9 ? [point[0] / length, point[1] / length] : [0, 0];
}

function intersectLocalLines(
  firstPoint: S111LocalPoint2D,
  firstDirection: S111LocalPoint2D,
  secondPoint: S111LocalPoint2D,
  secondDirection: S111LocalPoint2D,
): S111LocalPoint2D | null {
  const cross =
    firstDirection[0] * secondDirection[1] -
    firstDirection[1] * secondDirection[0];
  if (Math.abs(cross) < 1e-9) {
    return null;
  }
  const delta = subtractLocalPoint(secondPoint, firstPoint);
  const t =
    (delta[0] * secondDirection[1] - delta[1] * secondDirection[0]) /
    cross;
  return [
    firstPoint[0] + firstDirection[0] * t,
    firstPoint[1] + firstDirection[1] * t,
  ];
}
