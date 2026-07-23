import {
  S100Error,
  type BaseLayerSpec,
  type MapOverlayLayerSpec,
  type EncLayerSpec,
  type WmsSource,
  type WmsTemplateSource,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import {
  projectedMetersToWorld,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";
import { disposeThreeObject } from "../shared/dispose.js";
import {
  setLayerUserData,
  setObjectOpacity,
  setObjectVisibility,
  type ThreeLayerNative,
} from "./types.js";

type MapLikeLayerSpec = MapOverlayLayerSpec | EncLayerSpec;

export const createMapLayer = (
  spec: BaseLayerSpec,
  scene: THREE.Scene,
  reference: ThreeProjectedLocalReference,
): ThreeLayerNative<MapLikeLayerSpec> => {
  const mapSpec = spec as MapLikeLayerSpec;
  const group = new THREE.Group();
  group.name = `three-map-${spec.id}`;
  const mesh = createMapMesh(mapSpec, reference);
  group.add(mesh);
  group.visible = spec.visible ?? true;
  setObjectOpacity(group, spec.opacity ?? mapSpec.style?.opacity ?? 1);
  scene.add(group);

  return {
    spec: mapSpec,
    root: group,
    setVisible: (visible) => {
      group.visible = visible;
    },
    setOpacity: (opacity) => {
      setObjectOpacity(group, opacity);
    },
    getPickableObjects: () => [mesh],
    dispose: () => {
      scene.remove(group);
      disposeThreeObject(group);
    },
    patch: (patch) => {
      setObjectVisibility(group, patch.visible);
      setObjectOpacity(group, patch.opacity ?? patch.style?.opacity);
    },
  };
};

const createMapMesh = (
  spec: MapLikeLayerSpec,
  reference: ThreeProjectedLocalReference,
): THREE.Mesh => {
  const extents = spec.projectedMap?.dataset.extents ?? extentFromLayer(spec);
  const width = Math.max(1, extents.maxX - extents.minX);
  const height = Math.max(1, extents.maxY - extents.minY);
  const center = projectedMetersToWorld(
    extents.minX + width / 2,
    extents.minY + height / 2,
    -0.5,
    reference,
  );
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: createTexture(spec, extents),
    transparent: true,
    opacity: spec.opacity ?? spec.style?.opacity ?? 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(center);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = spec.zOrder ?? 0;
  setLayerUserData(mesh, spec, "raster", spec.id);
  return mesh;
};

const createTexture = (
  spec: MapLikeLayerSpec,
  extents: { minX: number; minY: number; maxX: number; maxY: number },
): THREE.Texture => {
  const url = mapUrl(spec, extents);
  if (url) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const texture = loader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  return fallbackMapTexture(spec);
};

const mapUrl = (
  spec: MapLikeLayerSpec,
  extents: { minX: number; minY: number; maxX: number; maxY: number },
): string | null => {
  const source = spec.source;
  if (!source || typeof source !== "object" || !("kind" in source)) {
    return null;
  }

  if (source.kind === "wms-template") {
    return replaceTemplateValues(source.urlTemplate, extents);
  }

  if (source.kind === "wms") {
    return wmsUrl(source, extents);
  }

  return null;
};

const replaceTemplateValues = (
  template: string,
  extents: { minX: number; minY: number; maxX: number; maxY: number },
): string =>
  template
    .replaceAll("{xmin}", String(extents.minX))
    .replaceAll("{ymin}", String(extents.minY))
    .replaceAll("{xmax}", String(extents.maxX))
    .replaceAll("{ymax}", String(extents.maxY));

const wmsUrl = (
  source: WmsSource,
  extents: { minX: number; minY: number; maxX: number; maxY: number },
): string => {
  const url = new URL(source.url, globalThis.location?.href);
  const params = url.searchParams;
  params.set("SERVICE", "WMS");
  params.set("REQUEST", "GetMap");
  params.set("VERSION", source.version ?? "1.1.1");
  params.set("LAYERS", source.layers.join(","));
  params.set("STYLES", source.styles?.join(",") ?? "");
  params.set("FORMAT", source.format ?? "image/png");
  params.set("TRANSPARENT", String(source.transparent ?? true));
  params.set("WIDTH", String(source.parameters?.WIDTH ?? 1024));
  params.set("HEIGHT", String(source.parameters?.HEIGHT ?? 1024));
  params.set("BBOX", `${extents.minX},${extents.minY},${extents.maxX},${extents.maxY}`);
  params.set(source.version === "1.3.0" ? "CRS" : "SRS", source.crs ?? "EPSG:4326");
  for (const [key, value] of Object.entries(source.parameters ?? {})) {
    params.set(key, String(value));
  }
  return url.toString();
};

const extentFromLayer = (
  spec: MapLikeLayerSpec,
): { minX: number; minY: number; maxX: number; maxY: number } => {
  const extent = spec.spatialExtent;
  if (
    extent?.minX !== undefined &&
    extent.minY !== undefined &&
    extent.maxX !== undefined &&
    extent.maxY !== undefined
  ) {
    return {
      minX: extent.minX,
      minY: extent.minY,
      maxX: extent.maxX,
      maxY: extent.maxY,
    };
  }

  throw new S100Error(
    "invalid-layer-spec",
    `Layer '${spec.id}' needs projectedMap or spatialExtent for Three.js map rendering.`,
    spec,
  );
};

const fallbackMapTexture = (spec: BaseLayerSpec): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#123044";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#4f8cb4";
    context.lineWidth = 2;
    for (let x = 0; x <= canvas.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 64) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    context.fillStyle = "#ffffff";
    context.font = "28px monospace";
    context.fillText(spec.title ?? spec.id, 48, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};
