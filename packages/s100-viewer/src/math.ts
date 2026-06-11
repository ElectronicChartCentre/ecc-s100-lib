export type Vec2Tuple = [number, number];
export type Vec3Tuple = [number, number, number];
export type DVec3Tuple = Vec3Tuple;
export type QuatTuple = [number, number, number, number];

export type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type RGBA = Rgba;

export type Corners2D = {
  topLeft: Vec2Tuple;
  topRight: Vec2Tuple;
  bottomLeft: Vec2Tuple;
  bottomRight: Vec2Tuple;
};

export type BoundingBoxTuple = {
  min: Vec3Tuple;
  max: Vec3Tuple;
};

export type PrismGeometryBuffers = {
  vertices: Vec3Tuple[];
  indices: number[];
  normals: Vec3Tuple[];
  texCoords: Vec2Tuple[];
};

export function createVec2(x = 0, y = 0): Vec2Tuple {
  return [x, y];
}

export function createVec3(x = 0, y = 0, z = 0): Vec3Tuple {
  return [x, y, z];
}

export function createQuatIdentity(): QuatTuple {
  return [0, 0, 0, 1];
}

export function createBoundingBox(min: Vec3Tuple, max: Vec3Tuple): BoundingBoxTuple {
  return {
    min: [...min],
    max: [...max],
  };
}

export function subtractVec3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ];
}

export function crossVec3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function normalizeVec3(value: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length === 0) {
    return [0, 0, 0];
  }
  return [
    value[0] / length,
    value[1] / length,
    value[2] / length,
  ];
}

export function createPrismGeometry(
  corners: Corners2D,
  zPos: number,
  height: number,
): PrismGeometryBuffers {
  const zBottom = zPos;
  const zTop = zPos + height;

  const bottomLeft = createVec3(corners.bottomLeft[0], corners.bottomLeft[1], zBottom);
  const bottomRight = createVec3(corners.bottomRight[0], corners.bottomRight[1], zBottom);
  const topRight = createVec3(corners.topRight[0], corners.topRight[1], zBottom);
  const topLeft = createVec3(corners.topLeft[0], corners.topLeft[1], zBottom);

  const upperBottomLeft = createVec3(corners.bottomLeft[0], corners.bottomLeft[1], zTop);
  const upperBottomRight = createVec3(corners.bottomRight[0], corners.bottomRight[1], zTop);
  const upperTopRight = createVec3(corners.topRight[0], corners.topRight[1], zTop);
  const upperTopLeft = createVec3(corners.topLeft[0], corners.topLeft[1], zTop);

  const faces: Array<[Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple]> = [
    [topLeft, topRight, bottomRight, bottomLeft],
    [upperBottomLeft, upperBottomRight, upperTopRight, upperTopLeft],
    [bottomLeft, bottomRight, upperBottomRight, upperBottomLeft],
    [bottomRight, topRight, upperTopRight, upperBottomRight],
    [topRight, topLeft, upperTopLeft, upperTopRight],
    [topLeft, bottomLeft, upperBottomLeft, upperTopLeft],
  ];

  const faceTexCoords: [Vec2Tuple, Vec2Tuple, Vec2Tuple, Vec2Tuple] = [
    createVec2(0, 0),
    createVec2(1, 0),
    createVec2(1, 1),
    createVec2(0, 1),
  ];
  const tri1UVs = [faceTexCoords[0], faceTexCoords[1], faceTexCoords[2]];
  const tri2UVs = [faceTexCoords[0], faceTexCoords[2], faceTexCoords[3]];

  const vertices: Vec3Tuple[] = [];
  const normals: Vec3Tuple[] = [];
  const texCoords: Vec2Tuple[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  for (const [a, b, c, d] of faces) {
    const normal = calculateFaceNormal(a, b, c);
    for (const triangle of [[a, b, c], [a, c, d]]) {
      for (const point of triangle) {
        vertices.push(point);
        normals.push(normal);
      }
    }
    texCoords.push(...tri1UVs, ...tri2UVs);
    indices.push(
      vertexIndex,
      vertexIndex + 1,
      vertexIndex + 2,
      vertexIndex + 3,
      vertexIndex + 4,
      vertexIndex + 5,
    );
    vertexIndex += 6;
  }

  return { vertices, indices, normals, texCoords };
}

function calculateFaceNormal(a: Vec3Tuple, b: Vec3Tuple, c: Vec3Tuple): Vec3Tuple {
  return normalizeVec3(crossVec3(subtractVec3(b, a), subtractVec3(c, a)));
}
