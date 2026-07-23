import type {
  BaseLayerSpec,
  ColorValue,
  RouteLinePrimitive,
  RouteMeshPrimitive,
  RoutePlanLayerSpec,
  RoutePointPrimitive,
  RoutePolygonPrimitive,
  RoutePrimitiveMetadata,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import {
  projectedMetersToWorld,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";
import { disposeThreeObject } from "../shared/dispose.js";
import {
  setLayerUserData,
  setObjectVisibility,
  type ThreeLayerNative,
} from "./types.js";

const ROUTE_SURFACE_Z_OFFSET_METERS = 0.04;
const ROUTE_LINE_Z_OFFSET_METERS = 0.12;
const ROUTE_WAYPOINT_Z_OFFSET_METERS = 0.25;
const DEFAULT_WAYPOINT_RADIUS_METERS = 8;

export const createRoutePlanLayer = (
  spec: BaseLayerSpec,
  scene: THREE.Scene,
  reference: ThreeProjectedLocalReference,
): ThreeLayerNative<RoutePlanLayerSpec> => {
  const routeSpec = spec as RoutePlanLayerSpec;
  const group = new THREE.Group();
  group.name = `three-route-${spec.id}`;
  group.visible = spec.visible ?? routeSpec.style.visible ?? true;
  const rebuild = () => {
    disposeThreeObject(group);
    group.clear();
    const style = routeSpec.style;
    const layout = routeSpec.source.layout;
    if (!layout) {
      return;
    }

    if (style.showRouteVolume || style.showRouteSides) {
      for (const primitive of layout.routeVolumes) {
        if (!shouldRenderRouteVolumePrimitive(primitive, style)) {
          continue;
        }
        addRouteVolume(group, routeSpec, primitive, reference);
      }
    }

    if (style.showCorridor) {
      for (const primitive of layout.corridors) {
        addPolygon(
          group,
          routeSpec,
          primitive,
          reference,
          corridorColor(style, primitive),
          ROUTE_SURFACE_Z_OFFSET_METERS,
        );
      }
    }

    if (style.showXtdBoundaries) {
      for (const boundary of layout.legBoundaries) {
        addLine(
          group,
          routeSpec,
          boundary,
          reference,
          boundary.metadata.side === "starboard"
            ? style.starboardBoundaryColor
            : style.portsideBoundaryColor,
          ROUTE_LINE_Z_OFFSET_METERS,
        );
      }
    }

    if (style.showCenterline) {
      addLine(
        group,
        routeSpec,
        layout.centerline,
        reference,
        style.centerlineColor,
        ROUTE_LINE_Z_OFFSET_METERS * 1.5,
      );
    }

    if (style.showWaypoints) {
      const waypointRadius = routeWaypointRadius(routeSpec);
      for (const waypoint of layout.waypoints) {
        addWaypoint(group, routeSpec, waypoint, reference, waypointRadius);
      }
    }

    if (style.showTurnDebugGeometry) {
      for (const primitive of layout.debug) {
        if ("rings" in primitive) {
          addPolygon(
            group,
            routeSpec,
            primitive,
            reference,
            style.centerlineColor,
            ROUTE_SURFACE_Z_OFFSET_METERS * 2,
          );
        } else if ("indices" in primitive) {
          addRouteVolume(group, routeSpec, primitive, reference, style.centerlineColor);
        } else if ("position" in primitive) {
          addWaypoint(group, routeSpec, primitive, reference, routeWaypointRadius(routeSpec) * 0.5);
        } else {
          addLine(
            group,
            routeSpec,
            primitive,
            reference,
            style.centerlineColor,
            ROUTE_LINE_Z_OFFSET_METERS * 2,
          );
        }
      }
    }

    applyRouteOpacity(group, routeSpec);
  };
  rebuild();
  scene.add(group);

  return {
    spec: routeSpec,
    root: group,
    setVisible: (visible) => {
      group.visible = visible;
    },
    setOpacity: (opacity) => {
      applyRouteOpacity(group, routeSpec, opacity);
    },
    getPickableObjects: () => [group],
    patch: (patch) => {
      if (patch.source !== undefined || patch.style !== undefined) {
        rebuild();
        return;
      }
      setObjectVisibility(group, patch.visible);
      applyRouteOpacity(group, routeSpec, patch.opacity);
    },
    dispose: () => {
      scene.remove(group);
      disposeThreeObject(group);
    },
  };
};

const addLine = (
  group: THREE.Group,
  spec: RoutePlanLayerSpec,
  primitive: RouteLinePrimitive | undefined,
  reference: ThreeProjectedLocalReference,
  color: ColorValue | undefined,
  zOffset: number,
): void => {
  if (!primitive || primitive.positions.length < 2) {
    return;
  }
  const points = primitive.positions.map((position) =>
    projectedMetersToWorld(position.x, position.y, (position.z ?? 0) + zOffset, reference),
  );
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const colorAlpha = colorToThree(color, 1);
  const material = new THREE.LineBasicMaterial({
    color: colorAlpha.color,
    transparent: colorAlpha.alpha * routeOpacity(spec) < 1,
    opacity: colorAlpha.alpha * routeOpacity(spec),
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const line = new THREE.Line(geometry, material);
  applyRouteObjectMetadata(line, spec, primitive.metadata, primitive.id);
  group.add(line);
};

const addPolygon = (
  group: THREE.Group,
  spec: RoutePlanLayerSpec,
  primitive: RoutePolygonPrimitive,
  reference: ThreeProjectedLocalReference,
  color: ColorValue | undefined,
  zOffset: number,
): void => {
  const ring = removeClosingDuplicate(primitive.rings[0] ?? []);
  if (ring.length < 3) {
    return;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      ring.flatMap((position) => {
        const vector = projectedMetersToWorld(
          position.x,
          position.y,
          (position.z ?? 0) + zOffset,
          reference,
        );
        return [vector.x, vector.y, vector.z];
      }),
      3,
    ),
  );
  geometry.setIndex(polygonIndices(primitive, ring.length));
  geometry.computeVertexNormals();
  const colorAlpha = colorToThree(color, 0.2);
  const material = new THREE.MeshBasicMaterial({
    color: colorAlpha.color,
    transparent: true,
    opacity: colorAlpha.alpha * routeOpacity(spec),
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 5;
  applyRouteObjectMetadata(mesh, spec, primitive.metadata, primitive.id);
  group.add(mesh);
};

const addRouteVolume = (
  group: THREE.Group,
  spec: RoutePlanLayerSpec,
  primitive: RouteMeshPrimitive,
  reference: ThreeProjectedLocalReference,
  colorOverride?: ColorValue,
): void => {
  if (primitive.positions.length < 3 || primitive.indices.length < 3) {
    return;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      primitive.positions.flatMap((position) => {
        const vector = projectedMetersToWorld(
          position.x,
          position.y,
          position.z ?? 0,
          reference,
        );
        return [vector.x, vector.y, vector.z];
      }),
      3,
    ),
  );
  geometry.setIndex([...primitive.indices]);
  geometry.computeVertexNormals();
  const colorAlpha = colorToThree(
    colorOverride ?? routeVolumeColor(spec.style, primitive),
    0.22,
  );
  const material = new THREE.MeshBasicMaterial({
    color: colorAlpha.color,
    transparent: true,
    opacity: colorAlpha.alpha * routeOpacity(spec),
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  applyRouteObjectMetadata(mesh, spec, primitive.metadata, primitive.id);
  group.add(mesh);
};

const shouldRenderRouteVolumePrimitive = (
  primitive: RouteMeshPrimitive,
  style: RoutePlanLayerSpec["style"],
): boolean =>
  style.showRouteVolume ||
  (style.showRouteSides &&
    primitive.metadata.side !== undefined &&
    primitive.metadata.depthBand === "safety-depth");

const routeVolumeColor = (
  style: RoutePlanLayerSpec["style"],
  primitive: RouteMeshPrimitive,
): ColorValue | undefined => {
  if (primitive.metadata.depthBand === "below-safety-depth") {
    return style.routeVolumeFillColor;
  }
  if (primitive.metadata.side === "starboard") {
    return style.starboardBoundaryColor ?? style.routeVolumeFillColor;
  }
  if (primitive.metadata.side === "portside") {
    return style.portsideBoundaryColor ?? style.routeVolumeFillColor;
  }
  return style.routeVolumeFillColor;
};

const corridorColor = (
  style: RoutePlanLayerSpec["style"],
  primitive: RoutePolygonPrimitive,
): ColorValue | undefined => {
  if (primitive.metadata.side === "starboard") {
    return style.starboardBoundaryColor ?? style.corridorFillColor;
  }
  if (primitive.metadata.side === "portside") {
    return style.portsideBoundaryColor ?? style.corridorFillColor;
  }
  return style.corridorFillColor;
};

const addWaypoint = (
  group: THREE.Group,
  spec: RoutePlanLayerSpec,
  primitive: RoutePointPrimitive,
  reference: ThreeProjectedLocalReference,
  radiusMeters: number,
): void => {
  const geometry = new THREE.SphereGeometry(radiusMeters, 16, 8);
  const colorAlpha = colorToThree(spec.style.waypointColor, 1);
  const material = new THREE.MeshBasicMaterial({
    color: colorAlpha.color,
    transparent: colorAlpha.alpha * routeOpacity(spec) < 1,
    opacity: colorAlpha.alpha * routeOpacity(spec),
    depthWrite: false,
  });
  material.userData.s100RouteBaseAlpha = colorAlpha.alpha;
  const point = new THREE.Mesh(geometry, material);
  point.position.copy(
    projectedMetersToWorld(
      primitive.position.x,
      primitive.position.y,
      (primitive.position.z ?? 0) + ROUTE_WAYPOINT_Z_OFFSET_METERS,
      reference,
    ),
  );
  applyRouteObjectMetadata(point, spec, primitive.metadata, primitive.id);
  group.add(point);
};

const applyRouteObjectMetadata = (
  object: THREE.Object3D,
  spec: RoutePlanLayerSpec,
  metadata: RoutePrimitiveMetadata,
  featureId: string,
): void => {
  setLayerUserData(object, spec, "vector", featureId);
  object.userData.s100Pickable = true;
  object.userData.s100PickMetadata = {
    layerId: spec.id,
    product: spec.product,
    routeId: metadata.routeId,
    sourceFormat: metadata.sourceFormat,
    primitiveKind: metadata.primitiveKind,
    ...(metadata.waypointId !== undefined ? { waypointId: metadata.waypointId } : {}),
    ...(metadata.legId !== undefined ? { legId: metadata.legId } : {}),
    ...(metadata.side !== undefined ? { side: metadata.side } : {}),
    ...(metadata.depthBand !== undefined ? { depthBand: metadata.depthBand } : {}),
  };
};

const applyRouteOpacity = (
  root: THREE.Object3D,
  spec: RoutePlanLayerSpec,
  opacityOverride?: number,
): void => {
  const opacity = clamp01(opacityOverride ?? routeOpacity(spec));
  root.traverse((child) => {
    const material = (child as THREE.Mesh).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const item of materials) {
      const baseAlpha = typeof item.userData.s100RouteBaseAlpha === "number"
        ? item.userData.s100RouteBaseAlpha
        : 1;
      item.opacity = baseAlpha * opacity;
      item.transparent = item.opacity < 1 || spec.style.opacity !== undefined;
      item.needsUpdate = true;
    }
  });
};

const colorToThree = (
  color: ColorValue | undefined,
  fallbackAlpha: number,
): { color: THREE.Color; alpha: number } => {
  if (typeof color === "string") {
    return { color: new THREE.Color(color), alpha: fallbackAlpha };
  }
  if (color && typeof color === "object") {
    return {
      color: new THREE.Color(
        normalizeColorChannel(color.r),
        normalizeColorChannel(color.g),
        normalizeColorChannel(color.b),
      ),
      alpha: clamp01(color.a ?? fallbackAlpha),
    };
  }
  return { color: new THREE.Color(0xffffff), alpha: fallbackAlpha };
};

const routeOpacity = (spec: RoutePlanLayerSpec): number =>
  clamp01(spec.opacity ?? spec.style.opacity ?? 1);

const normalizeColorChannel = (value: number): number =>
  value > 1 ? clamp01(value / 255) : clamp01(value);

const removeClosingDuplicate = (
  positions: readonly { x: number; y: number; z?: number }[],
) => {
  if (positions.length < 2) {
    return positions;
  }
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (
    first &&
    last &&
    Math.abs(first.x - last.x) < 1e-6 &&
    Math.abs(first.y - last.y) < 1e-6 &&
    Math.abs((first.z ?? 0) - (last.z ?? 0)) < 1e-6
  ) {
    return positions.slice(0, -1);
  }
  return positions;
};

const polygonIndices = (
  primitive: RoutePolygonPrimitive,
  vertexCount: number,
): number[] =>
  isCorridorStrip(primitive, vertexCount)
    ? corridorStripIndices(vertexCount)
    : triangleFanIndices(vertexCount);

const isCorridorStrip = (
  primitive: RoutePolygonPrimitive,
  vertexCount: number,
): boolean =>
  primitive.metadata.primitiveKind === "corridor" &&
  primitive.metadata.side !== undefined &&
  vertexCount >= 4 &&
  vertexCount % 2 === 0;

const corridorStripIndices = (vertexCount: number): number[] => {
  const linePointCount = vertexCount / 2;
  const indices: number[] = [];
  for (let index = 0; index < linePointCount - 1; index += 1) {
    const near0 = index;
    const near1 = index + 1;
    const far0 = vertexCount - 1 - index;
    const far1 = vertexCount - 2 - index;
    indices.push(near0, near1, far1);
    indices.push(near0, far1, far0);
  }
  return indices;
};

const triangleFanIndices = (vertexCount: number): number[] => {
  const indices: number[] = [];
  for (let index = 1; index < vertexCount - 1; index += 1) {
    indices.push(0, index, index + 1);
  }
  return indices;
};

const routeWaypointRadius = (spec: RoutePlanLayerSpec): number => {
  const layout = spec.source.layout;
  const positions = [
    ...(layout?.centerline?.positions ?? []),
    ...(layout?.waypoints.map((waypoint) => waypoint.position) ?? []),
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

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
