import type {
  ParametricVesselColorScheme,
  ParametricVesselLayout,
  ParametricVesselLayoutPart,
  ParametricVesselLocalPoint,
  ParametricVesselPlanPoint,
} from "@ecc/s100-viewer";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Material,
  type Object3D,
} from "three";

type ParametricVesselMaterialRole =
  | "hull"
  | "deck"
  | "superstructure"
  | "mast"
  | "transponder";

const DEFAULT_COLORS = {
  hull: "#cc1400",
  deck: "#9ca3a8",
  superstructure: "#f2f2ee",
  mast: "#003fc8",
  transponder: "#18b600",
} satisfies Record<ParametricVesselMaterialRole, string>;

export function createParametricVesselObject(
  layout: ParametricVesselLayout,
): Object3D {
  const root = new Group();
  root.name = `s100-parametric-vessel:${layout.spec.template ?? "generic"}`;
  root.userData.s100ParametricVessel = {
    assemblyStyle: layout.assembly.style,
    partCount: layout.parts.length,
  };

  const materials = createParametricVesselMaterials(layout.spec.colors);
  for (const part of layout.parts) {
    const mesh = createPartMesh(part, materials);
    if (!mesh) {
      continue;
    }
    mesh.name = `s100-parametric-vessel-part:${part.id}`;
    mesh.userData.s100ParametricVesselPart = {
      id: part.id,
      role: part.role,
      geometry: part.geometry?.kind ?? "box",
    };
    const position = vesselLocalToGltfYUp(part.centerMeters);
    mesh.position.set(position.x, position.y, position.z);
    root.add(mesh);
  }

  return root;
}

function createParametricVesselMaterials(
  colors: ParametricVesselColorScheme | undefined,
): Record<ParametricVesselMaterialRole, Material> {
  return {
    hull: createMaterial("MainHull", colors?.hull, DEFAULT_COLORS.hull),
    deck: createMaterial("Deck", colors?.deck, DEFAULT_COLORS.deck),
    superstructure: createMaterial(
      "Bridge",
      colors?.superstructure,
      DEFAULT_COLORS.superstructure,
    ),
    mast: createMaterial("Mast", colors?.mast, DEFAULT_COLORS.mast),
    transponder: createMaterial(
      "Transponder",
      colors?.transponder,
      DEFAULT_COLORS.transponder,
    ),
  };
}

function createMaterial(
  name: string,
  color: string | undefined,
  fallbackColor: string,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: parseColor(color, fallbackColor),
    metalness: 0,
    roughness: 0.56,
  });
  material.name = name;
  return material;
}

function parseColor(color: string | undefined, fallbackColor: string): Color {
  try {
    return new Color(color ?? fallbackColor);
  } catch {
    return new Color(fallbackColor);
  }
}

function createPartMesh(
  part: ParametricVesselLayoutPart,
  materials: Record<ParametricVesselMaterialRole, Material>,
): Mesh | null {
  const material = materials[materialRoleForPart(part)];
  const kind = part.geometry?.kind ?? "box";
  if (kind === "wedge") {
    return new Mesh(createBowWedgeGeometry(part), material);
  }
  if (kind === "wedge-deck") {
    return new Mesh(createBowDeckGeometry(part), material);
  }
  if (kind === "deck-outline") {
    return new Mesh(createDeckOutlineGeometry(part), material);
  }
  if (kind === "cylinder") {
    const mesh = new Mesh(new CylinderGeometry(0.5, 0.5, 1, 32), material);
    mesh.scale.set(
      part.sizeMeters.beamMeters,
      part.sizeMeters.heightMeters,
      part.sizeMeters.lengthMeters,
    );
    return mesh;
  }
  if (kind === "disc") {
    const mesh = new Mesh(new SphereGeometry(0.5, 32, 16), material);
    mesh.scale.set(
      part.sizeMeters.beamMeters,
      part.sizeMeters.heightMeters,
      part.sizeMeters.lengthMeters,
    );
    return mesh;
  }

  const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
  mesh.scale.set(
    part.sizeMeters.beamMeters,
    part.sizeMeters.heightMeters,
    part.sizeMeters.lengthMeters,
  );
  return mesh;
}

function createDeckOutlineGeometry(part: ParametricVesselLayoutPart): BufferGeometry {
  const outline = readDeckOutline(part) ?? rectangleOutline(part);
  const halfHeight = part.sizeMeters.heightMeters / 2;
  const bottomY = -halfHeight;
  const topY = halfHeight;
  const positions: number[] = [];

  for (let index = 1; index < outline.length - 1; index += 1) {
    pushDeckVertex(positions, outline[0] as ParametricVesselPlanPoint, topY);
    pushDeckVertex(positions, outline[index] as ParametricVesselPlanPoint, topY);
    pushDeckVertex(positions, outline[index + 1] as ParametricVesselPlanPoint, topY);

    pushDeckVertex(positions, outline[0] as ParametricVesselPlanPoint, bottomY);
    pushDeckVertex(positions, outline[index + 1] as ParametricVesselPlanPoint, bottomY);
    pushDeckVertex(positions, outline[index] as ParametricVesselPlanPoint, bottomY);
  }

  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index] as ParametricVesselPlanPoint;
    const next = outline[(index + 1) % outline.length] as ParametricVesselPlanPoint;
    pushDeckVertex(positions, current, bottomY);
    pushDeckVertex(positions, next, bottomY);
    pushDeckVertex(positions, next, topY);
    pushDeckVertex(positions, current, bottomY);
    pushDeckVertex(positions, next, topY);
    pushDeckVertex(positions, current, topY);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function readDeckOutline(
  part: ParametricVesselLayoutPart,
): readonly ParametricVesselPlanPoint[] | undefined {
  const outline = part.geometry?.metadata?.outlineMeters;
  if (!Array.isArray(outline)) {
    return undefined;
  }
  const points = outline
    .map((point) => readDeckOutlinePoint(point))
    .filter((point): point is ParametricVesselPlanPoint => point !== undefined);
  return points.length >= 3 ? points : undefined;
}

function readDeckOutlinePoint(value: unknown): ParametricVesselPlanPoint | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const xMeters = candidate.xMeters;
  const yMeters = candidate.yMeters;
  if (typeof xMeters !== "number" || typeof yMeters !== "number") {
    return undefined;
  }
  if (!Number.isFinite(xMeters) || !Number.isFinite(yMeters)) {
    return undefined;
  }
  return { xMeters, yMeters };
}

function rectangleOutline(part: ParametricVesselLayoutPart): readonly ParametricVesselPlanPoint[] {
  const halfBeam = part.sizeMeters.beamMeters / 2;
  const halfLength = part.sizeMeters.lengthMeters / 2;
  return [
    { xMeters: -halfBeam, yMeters: -halfLength },
    { xMeters: halfBeam, yMeters: -halfLength },
    { xMeters: halfBeam, yMeters: halfLength },
    { xMeters: -halfBeam, yMeters: halfLength },
  ];
}

function pushDeckVertex(
  positions: number[],
  point: ParametricVesselPlanPoint,
  yMeters: number,
): void {
  positions.push(point.xMeters, yMeters, -point.yMeters);
}

function createBowDeckGeometry(part: ParametricVesselLayoutPart): BufferGeometry {
  const halfBeam = part.sizeMeters.beamMeters / 2;
  const halfHeight = part.sizeMeters.heightMeters / 2;
  const halfLength = part.sizeMeters.lengthMeters / 2;
  const aftZ = halfLength;
  const bowZ = -halfLength;
  const bottomY = -halfHeight;
  const topY = halfHeight;
  const portX = -halfBeam;
  const starboardX = halfBeam;
  const aftBottomPort = [portX, bottomY, aftZ];
  const aftBottomStarboard = [starboardX, bottomY, aftZ];
  const aftTopPort = [portX, topY, aftZ];
  const aftTopStarboard = [starboardX, topY, aftZ];
  const bowBottom = [0, bottomY, bowZ];
  const bowTop = [0, topY, bowZ];
  const positions = [
    ...aftBottomPort,
    ...bowBottom,
    ...aftBottomStarboard,
    ...aftTopPort,
    ...aftTopStarboard,
    ...bowTop,
    ...aftBottomPort,
    ...aftBottomStarboard,
    ...aftTopStarboard,
    ...aftBottomPort,
    ...aftTopStarboard,
    ...aftTopPort,
    ...aftBottomPort,
    ...aftTopPort,
    ...bowTop,
    ...aftBottomPort,
    ...bowTop,
    ...bowBottom,
    ...aftBottomStarboard,
    ...bowBottom,
    ...bowTop,
    ...aftBottomStarboard,
    ...bowTop,
    ...aftTopStarboard,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createBowWedgeGeometry(part: ParametricVesselLayoutPart): BufferGeometry {
  const halfBeam = part.sizeMeters.beamMeters / 2;
  const halfHeight = part.sizeMeters.heightMeters / 2;
  const halfLength = part.sizeMeters.lengthMeters / 2;
  const aftZ = halfLength;
  const bowZ = -halfLength;
  const bottomY = -halfHeight;
  const topY = halfHeight;
  const portX = -halfBeam;
  const starboardX = halfBeam;
  const aftBottomPort = [portX, bottomY, aftZ];
  const aftBottomStarboard = [starboardX, bottomY, aftZ];
  const aftTopPort = [portX, topY, aftZ];
  const aftTopStarboard = [starboardX, topY, aftZ];
  const bowTip = [0, topY, bowZ];
  const positions = [
    ...aftBottomPort,
    ...aftBottomStarboard,
    ...aftTopStarboard,
    ...aftBottomPort,
    ...aftTopStarboard,
    ...aftTopPort,
    ...aftBottomPort,
    ...aftTopPort,
    ...bowTip,
    ...aftBottomStarboard,
    ...bowTip,
    ...aftTopStarboard,
    ...aftBottomPort,
    ...bowTip,
    ...aftBottomStarboard,
    ...aftTopPort,
    ...aftTopStarboard,
    ...bowTip,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function materialRoleForPart(part: ParametricVesselLayoutPart): ParametricVesselMaterialRole {
  if (part.role === "main-deck" || part.tags?.includes("deck")) {
    return "deck";
  }
  if (part.role === "bridge" || part.tags?.includes("superstructure")) {
    return "superstructure";
  }
  if (part.role === "mast" || part.tags?.includes("mast")) {
    return "mast";
  }
  if (part.role === "transponder" || part.tags?.includes("transponder")) {
    return "transponder";
  }
  return "hull";
}

function vesselLocalToGltfYUp(point: ParametricVesselLocalPoint): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: point.xMeters,
    y: point.zMeters,
    z: -point.yMeters,
  };
}
