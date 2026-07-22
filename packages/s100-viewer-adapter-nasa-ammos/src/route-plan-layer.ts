import type {
  ColorValue,
  LayerPatch,
  RouteFeatureStyle,
  RouteLayoutPosition,
  RouteLinePrimitive,
  RouteMeshPrimitive,
  RoutePlanLayerSpec,
  RoutePlanLayout,
  RoutePointPrimitive,
  RoutePolygonPrimitive,
  RoutePrimitiveMetadata,
} from "@ecc/s100-viewer";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
  type Scene,
} from "three";

export type NasaRoutePlanView = {
  readonly root: Group;
  readonly attached: boolean;
  setVisibility(visible: boolean): void;
  setOpacity(opacity: number): void;
  update(spec: RoutePlanLayerSpec, patch?: LayerPatch<RoutePlanLayerSpec>): void;
  dispose(): void;
};

const ROUTE_SURFACE_Z_OFFSET_METERS = 0.04;
const ROUTE_LINE_Z_OFFSET_METERS = 0.12;
const ROUTE_WAYPOINT_Z_OFFSET_METERS = 0.25;
const DEFAULT_WAYPOINT_RADIUS_METERS = 8;

export const createRoutePlanView = (
  spec: RoutePlanLayerSpec,
  scene: Scene | undefined,
): NasaRoutePlanView =>
  new CoreNasaRoutePlanView(spec, scene);

export const getRoutePickValues = (
  object: Object3D,
  stopAt: Object3D | null,
): Record<string, unknown> | undefined => {
  let current: Object3D | null = object;
  while (current) {
    const metadata = current.userData.s100PickMetadata;
    if (isPickMetadata(metadata)) {
      return metadata;
    }
    if (current === stopAt) {
      break;
    }
    current = current.parent;
  }
  return undefined;
};

class CoreNasaRoutePlanView implements NasaRoutePlanView {
  readonly root = new Group();
  readonly attached: boolean;
  private spec: RoutePlanLayerSpec;

  constructor(spec: RoutePlanLayerSpec, scene: Scene | undefined) {
    this.spec = spec;
    this.root.name = `s100-route-plan-layer:${spec.id}`;
    this.root.userData.s100Pickable = true;
    this.root.userData.s100PickMetadata = {
      layerId: spec.id,
      product: spec.product,
      routeId: spec.source.routePlan.id,
      sourceFormat: spec.source.routePlan.sourceFormat,
      primitiveKind: "route",
    };
    if (scene !== undefined) {
      scene.add(this.root);
      this.attached = true;
    } else {
      this.attached = false;
    }
    this.rebuild();
  }

  setVisibility(visible: boolean): void {
    this.root.visible = visible;
  }

  setOpacity(opacity: number): void {
    applyOpacity(this.root, this.spec.style, opacity);
  }

  update(spec: RoutePlanLayerSpec, patch: LayerPatch<RoutePlanLayerSpec> = {}): void {
    this.spec = spec;
    if (patch.source !== undefined || patch.style !== undefined) {
      this.rebuild();
      return;
    }
    if (patch.visible !== undefined) {
      this.setVisibility(patch.visible);
    }
    if (patch.opacity !== undefined) {
      this.setOpacity(patch.opacity);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    disposeObjectTree(this.root);
    this.root.clear();
  }

  private rebuild(): void {
    disposeObjectTree(this.root);
    this.root.clear();

    const style = this.spec.style;
    const layout = this.spec.source.layout;
    this.root.visible = this.spec.visible ?? style.visible ?? true;
    if (!layout) {
      return;
    }

    if (style.showRouteVolume || style.showRouteSides) {
      for (const primitive of layout.routeVolumes) {
        const mesh = createRouteVolumeMesh(this.spec, primitive, style);
        if (mesh) {
          this.root.add(mesh);
        }
      }
    }

    if (style.showCorridor) {
      for (const primitive of layout.corridors) {
        const mesh = createPolygonMesh(
          this.spec,
          primitive,
          style.corridorFillColor,
          this.layerOpacity,
          ROUTE_SURFACE_Z_OFFSET_METERS,
        );
        if (mesh) {
          this.root.add(mesh);
        }
      }
    }

    if (style.showXtdBoundaries) {
      for (const primitive of layout.legBoundaries) {
        this.root.add(createLineObject(
          this.spec,
          primitive,
          primitive.metadata.side === "starboard"
            ? style.starboardBoundaryColor
            : style.portsideBoundaryColor,
          this.layerOpacity,
          ROUTE_LINE_Z_OFFSET_METERS,
        ));
      }
    }

    if (style.showCenterline && layout.centerline) {
      this.root.add(createLineObject(
        this.spec,
        layout.centerline,
        style.centerlineColor,
        this.layerOpacity,
        ROUTE_LINE_Z_OFFSET_METERS * 1.5,
      ));
    }

    if (style.showWaypoints) {
      const waypointRadius = routeWaypointRadius(layout);
      for (const primitive of layout.waypoints) {
        this.root.add(createWaypointObject(
          this.spec,
          primitive,
          style.waypointColor,
          this.layerOpacity,
          waypointRadius,
        ));
      }
    }

    if (style.showTurnDebugGeometry) {
      for (const primitive of layout.debug) {
        if ("rings" in primitive) {
          const mesh = createPolygonMesh(
            this.spec,
            primitive,
            style.centerlineColor,
            this.layerOpacity * 0.35,
            ROUTE_SURFACE_Z_OFFSET_METERS * 2,
          );
          if (mesh) {
            this.root.add(mesh);
          }
        } else if ("indices" in primitive) {
          const mesh = createRouteVolumeMesh(this.spec, primitive, style, style.centerlineColor);
          if (mesh) {
            this.root.add(mesh);
          }
        } else if ("position" in primitive) {
          this.root.add(createWaypointObject(
            this.spec,
            primitive,
            style.centerlineColor,
            this.layerOpacity,
            routeWaypointRadius(layout) * 0.5,
          ));
        } else {
          this.root.add(createLineObject(
            this.spec,
            primitive,
            style.centerlineColor,
            this.layerOpacity,
            ROUTE_LINE_Z_OFFSET_METERS * 2,
          ));
        }
      }
    }
  }

  private get layerOpacity(): number {
    return clamp01(this.spec.opacity ?? this.spec.style.opacity ?? 1);
  }
}

const createLineObject = (
  spec: RoutePlanLayerSpec,
  primitive: RouteLinePrimitive,
  color: ColorValue | undefined,
  layerOpacity: number,
  zOffset: number,
): Line => {
  const geometry = new BufferGeometry().setFromPoints(
    primitive.positions.map((position) => {
      const vector = toVectorPosition(position, zOffset);
      return new Vector3(vector.x, vector.y, vector.z);
    }),
  );
  const colorAlpha = colorToThree(color, 1);
  const material = new LineBasicMaterial({
    color: colorAlpha.color,
    transparent: colorAlpha.alpha * layerOpacity < 1,
    opacity: colorAlpha.alpha * layerOpacity,
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const line = new Line(geometry, material);
  applyRouteObjectMetadata(line, spec, primitive.metadata);
  return line;
};

const createWaypointObject = (
  spec: RoutePlanLayerSpec,
  primitive: RoutePointPrimitive,
  color: ColorValue | undefined,
  layerOpacity: number,
  radiusMeters: number,
): Mesh => {
  const geometry = new SphereGeometry(radiusMeters, 16, 8);
  const colorAlpha = colorToThree(color, 1);
  const material = new MeshBasicMaterial({
    color: colorAlpha.color,
    transparent: colorAlpha.alpha * layerOpacity < 1,
    opacity: colorAlpha.alpha * layerOpacity,
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const mesh = new Mesh(geometry, material);
  const position = toVectorPosition(primitive.position, ROUTE_WAYPOINT_Z_OFFSET_METERS);
  mesh.position.set(position.x, position.y, position.z);
  applyRouteObjectMetadata(mesh, spec, primitive.metadata);
  return mesh;
};

const createPolygonMesh = (
  spec: RoutePlanLayerSpec,
  primitive: RoutePolygonPrimitive,
  color: ColorValue | undefined,
  layerOpacity: number,
  zOffset: number,
): Mesh | null => {
  const ring = primitive.rings[0];
  const positions = removeClosingDuplicate(ring ?? []);
  if (positions.length < 3) {
    return null;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      positions.flatMap((position) => {
        const vector = toVectorPosition(position, zOffset);
        return [vector.x, vector.y, vector.z];
      }),
      3,
    ),
  );
  geometry.setIndex(triangleFanIndices(positions.length));
  geometry.computeVertexNormals();

  const colorAlpha = colorToThree(color, 0.2);
  const material = new MeshBasicMaterial({
    color: colorAlpha.color,
    transparent: true,
    opacity: colorAlpha.alpha * layerOpacity,
    side: DoubleSide,
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 5;
  applyRouteObjectMetadata(mesh, spec, primitive.metadata);
  return mesh;
};

const createRouteVolumeMesh = (
  spec: RoutePlanLayerSpec,
  primitive: RouteMeshPrimitive,
  style: RouteFeatureStyle,
  colorOverride?: ColorValue,
): Mesh | null => {
  if (primitive.positions.length < 3 || primitive.indices.length < 3) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      primitive.positions.flatMap((position) => {
        const vector = toVectorPosition(position, 0);
        return [vector.x, vector.y, vector.z];
      }),
      3,
    ),
  );
  geometry.setIndex([...primitive.indices]);
  geometry.computeVertexNormals();

  const colorAlpha = colorToThree(colorOverride ?? style.routeVolumeFillColor, 0.22);
  const layerOpacity = clamp01(spec.opacity ?? style.opacity ?? 1);
  const material = new MeshBasicMaterial({
    color: colorAlpha.color,
    transparent: true,
    opacity: colorAlpha.alpha * layerOpacity,
    side: DoubleSide,
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 3;
  applyRouteObjectMetadata(mesh, spec, primitive.metadata);
  return mesh;
};

const applyRouteObjectMetadata = (
  object: Object3D,
  spec: RoutePlanLayerSpec,
  metadata: RoutePrimitiveMetadata,
): void => {
  const pickMetadata = {
    layerId: spec.id,
    product: spec.product,
    routeId: metadata.routeId,
    sourceFormat: metadata.sourceFormat,
    primitiveKind: metadata.primitiveKind,
    ...(metadata.waypointId !== undefined ? { waypointId: metadata.waypointId } : {}),
    ...(metadata.legId !== undefined ? { legId: metadata.legId } : {}),
    ...(metadata.side !== undefined ? { side: metadata.side } : {}),
  };
  object.name = `s100-route:${spec.id}:${metadata.primitiveKind}`;
  object.userData.s100Pickable = true;
  object.userData.s100PickMetadata = pickMetadata;
};

const applyOpacity = (
  root: Object3D,
  style: RouteFeatureStyle,
  opacity: number,
): void => {
  root.traverse((object) => {
    const material = (object as Object3D & { material?: Material | Material[] }).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const item of materials) {
      const originalAlpha = typeof item.userData.s100RouteBaseAlpha === "number"
        ? item.userData.s100RouteBaseAlpha
        : 1;
      item.opacity = originalAlpha * clamp01(opacity);
      item.transparent = item.opacity < 1 || style.opacity !== undefined;
      item.needsUpdate = true;
    }
  });
};

const colorToThree = (
  color: ColorValue | undefined,
  fallbackAlpha: number,
): { color: Color; alpha: number } => {
  if (typeof color === "string") {
    return { color: new Color(color), alpha: fallbackAlpha };
  }
  if (color && typeof color === "object") {
    return {
      color: new Color(
        normalizeColorChannel(color.r),
        normalizeColorChannel(color.g),
        normalizeColorChannel(color.b),
      ),
      alpha: clamp01(color.a ?? fallbackAlpha),
    };
  }
  return { color: new Color(0xffffff), alpha: fallbackAlpha };
};

const normalizeColorChannel = (value: number): number =>
  value > 1 ? clamp01(value / 255) : clamp01(value);

const toVectorPosition = (
  position: RouteLayoutPosition,
  zOffset: number,
): { x: number; y: number; z: number } => ({
  x: position.x,
  y: position.y,
  z: (position.z ?? 0) + zOffset,
});

const removeClosingDuplicate = (
  positions: readonly RouteLayoutPosition[],
): readonly RouteLayoutPosition[] => {
  if (positions.length < 2) {
    return positions;
  }
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (!first || !last) {
    return positions;
  }
  if (
    Math.abs(first.x - last.x) < 1e-6 &&
    Math.abs(first.y - last.y) < 1e-6 &&
    Math.abs((first.z ?? 0) - (last.z ?? 0)) < 1e-6
  ) {
    return positions.slice(0, -1);
  }
  return positions;
};

const triangleFanIndices = (vertexCount: number): number[] => {
  const indices: number[] = [];
  for (let index = 1; index < vertexCount - 1; index += 1) {
    indices.push(0, index, index + 1);
  }
  return indices;
};

const routeWaypointRadius = (layout: RoutePlanLayout): number => {
  const positions = [
    ...(layout.centerline?.positions ?? []),
    ...layout.waypoints.map((waypoint) => waypoint.position),
  ];
  if (positions.length === 0) {
    return DEFAULT_WAYPOINT_RADIUS_METERS;
  }
  const xs = positions.map((position) => position.x);
  const ys = positions.map((position) => position.y);
  const diagonal = Math.hypot(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  return Math.max(4, Math.min(60, diagonal * 0.01 || DEFAULT_WAYPOINT_RADIUS_METERS));
};

const disposeObjectTree = (root: Object3D): void => {
  const disposedMaterials = new Set<Material>();
  root.traverse((object) => {
    const maybeMesh = object as Object3D & {
      geometry?: { dispose?: () => void };
      material?: Material | Material[];
    };
    maybeMesh.geometry?.dispose?.();
    const material = maybeMesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        disposeMaterial(item, disposedMaterials);
      }
    } else if (material) {
      disposeMaterial(material, disposedMaterials);
    }
  });
};

const disposeMaterial = (
  material: Material,
  disposedMaterials: Set<Material>,
): void => {
  if (disposedMaterials.has(material)) {
    return;
  }
  disposedMaterials.add(material);
  material.dispose();
};

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));

const isPickMetadata = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");
