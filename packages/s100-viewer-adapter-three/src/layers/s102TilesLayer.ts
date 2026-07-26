/// <reference path="../types/3d-tiles-renderer-private.d.ts" />

import type {
  BaseLayerSpec,
  S102BathymetryLayerSpec,
  ThreeDTilesSource,
  WaterLevelFieldState,
} from "@ecc/s100-viewer";
import { TilesRenderer } from "3d-tiles-renderer";
import { ImplicitTilingPlugin } from "3d-tiles-renderer/core/plugins";
import { SUBTREELoader } from "3d-tiles-renderer/src/core/plugins/SUBTREELoader.js";
import * as THREE from "three";
import type { ThreeProjectedLocalReference } from "../coordinates/projectedLocal.js";
import { assertSourceKind } from "../shared/source.js";
import {
  ThreeS102TerrainMaterialController,
  applyThreeS102TerrainStyle,
} from "./s102TerrainMaterial.js";
import { createThreeWaterLevelTerrainGrid } from "./s104WaterLevelTerrainGrid.js";
import type { ThreeLayerNative } from "./types.js";
import { setObjectOpacity } from "./types.js";

type ImplicitTileLike = {
  implicitTilingData?: unknown;
  internal?: {
    basePath?: string;
  };
};

type RendererLike = {
  fetchOptions?: RequestInit;
};

type BaseImplicitTilingPlugin = {
  init?: (tiles: RendererLike) => void;
  parseTile?: (
    content: unknown,
    tile: ImplicitTileLike,
    extension: string,
  ) => Promise<void> | undefined;
};

export const createS102TilesLayer = (
  spec: BaseLayerSpec,
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  reference: ThreeProjectedLocalReference,
  getSeaLevel: () => number,
): ThreeLayerNative<S102BathymetryLayerSpec> => {
  assertSourceKind(spec, "3d-tiles");
  const s102Spec = spec as S102BathymetryLayerSpec;
  const tiles = new TilesRenderer(normalizeTilesetUrl(s102Spec.source.url));
  const terrainMaterialController = new ThreeS102TerrainMaterialController();
  let waterLevelGridKey: string | null = null;
  applyThreeS102TerrainStyle(terrainMaterialController, s102Spec);
  terrainMaterialController.setSeaLevel(getSeaLevel());
  const setWaterLevelField = (state: WaterLevelFieldState | null, time: Date): void => {
    const grid = createThreeWaterLevelTerrainGrid(state, time, reference);
    if (!grid) {
      waterLevelGridKey = null;
      terrainMaterialController.setWaterLevelGrid(null);
      return;
    }
    if (grid.key === waterLevelGridKey) {
      grid.texture.dispose();
      return;
    }
    waterLevelGridKey = grid.key;
    terrainMaterialController.setWaterLevelGrid(grid.uniforms);
  };
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);
  tiles.group.name = `three-s102-${spec.id}`;
  tiles.group.visible = spec.visible ?? true;
  configureTilesSource(tiles, s102Spec.source);
  alignTilesToProjectedLocalScene(tiles.group, s102Spec, reference);
  tiles.group.userData = {
    layerId: spec.id,
    product: spec.product,
    pickSource: "terrain",
  };
  const handleLoadModel = (event: { scene: THREE.Object3D }): void => {
    terrainMaterialController.applyToObject(event.scene);
  };
  tiles.addEventListener("load-model", handleLoadModel);
  scene.add(tiles.group);

  return {
    spec: s102Spec,
    root: tiles.group,
    update: () => {
      terrainMaterialController.setSeaLevel(getSeaLevel());
      tiles.setCamera(camera);
      tiles.setResolutionFromRenderer(camera, renderer);
      tiles.update();
    },
    setWaterLevelField,
    setVisible: (visible) => {
      tiles.group.visible = visible;
    },
    setOpacity: (opacity) => {
      setObjectOpacity(tiles.group, opacity);
    },
    patch: () => {
      applyThreeS102TerrainStyle(terrainMaterialController, s102Spec);
      terrainMaterialController.setSeaLevel(getSeaLevel());
      terrainMaterialController.applyToObject(tiles.group);
    },
    dispose: () => {
      tiles.removeEventListener("load-model", handleLoadModel);
      scene.remove(tiles.group);
      tiles.dispose();
      terrainMaterialController.dispose();
    },
  };
};

const alignTilesToProjectedLocalScene = (
  group: THREE.Group,
  spec: S102BathymetryLayerSpec,
  reference: ThreeProjectedLocalReference,
): void => {
  if (spec.source.sourceFrame === "engine-local") {
    return;
  }

  group.position.set(
    -reference.origin.x,
    -reference.origin.y,
    -reference.origin.z,
  );
  group.updateMatrixWorld(true);
};

const configureTilesSource = (
  tiles: TilesRenderer,
  source: ThreeDTilesSource,
): void => {
  if (source.headers !== undefined) {
    tiles.fetchOptions.headers = {
      ...tiles.fetchOptions.headers,
      ...source.headers,
    };
  }

  tiles.registerPlugin(new ThreeS100ImplicitTilingPlugin());
  const additionalParameters = buildAdditionalUrlParameters(source);
  if (additionalParameters) {
    tiles.registerPlugin(createAdditionalUrlParametersPlugin(additionalParameters));
  }
};

class ThreeS100ImplicitTilingPlugin extends ImplicitTilingPlugin {
  readonly name = "s100-three-implicit-tiling";
  private tilesRenderer: RendererLike | null = null;

  init(tiles: RendererLike): void {
    this.tilesRenderer = tiles;
    const basePlugin = ImplicitTilingPlugin.prototype as BaseImplicitTilingPlugin;
    basePlugin.init?.call(this, tiles);
  }

  parseTile(
    content: unknown,
    tile: ImplicitTileLike,
    extension: string,
  ): Promise<void> | undefined {
    if (
      extension.toLowerCase() === "json" &&
      tile.implicitTilingData &&
      isSubtreeJson(content)
    ) {
      const loader = new SUBTREELoader(tile);
      loader.workingPath = tile.internal?.basePath ?? "";
      loader.fetchOptions = this.tilesRenderer?.fetchOptions ?? {};
      return loader.parse(createBinarySubtreeBuffer(content));
    }

    const basePlugin = ImplicitTilingPlugin.prototype as BaseImplicitTilingPlugin;
    return basePlugin.parseTile?.call(this, content, tile, extension);
  }
}

const buildAdditionalUrlParameters = (source: ThreeDTilesSource): string => {
  const params = new URLSearchParams();
  if (source.crs) {
    params.set("crs", source.crs);
  }
  if (source.verticalDatum) {
    params.set("verticalDatum", source.verticalDatum);
  }
  for (const [key, value] of Object.entries(source.query ?? {})) {
    params.set(key, String(value));
  }
  return params.toString();
};

const normalizeTilesetUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  const hashIndex = trimmed.indexOf("#");
  const withoutHash = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : trimmed.slice(hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex);

  if (/(^|\/)tileset\.json$/i.test(path)) {
    return `${path}${query}${hash}`;
  }

  const separator = path.endsWith("/") ? "" : "/";
  return `${path}${separator}tileset.json${query}${hash}`;
};

const createAdditionalUrlParametersPlugin = (
  additionalUrlParameters: string,
): {
  name: string;
  preprocessURL(url: string | URL): string;
} => ({
  name: "s100-three-additional-url-parameters",
  preprocessURL: (url: string | URL) =>
    appendAdditionalUrlParameters(url, additionalUrlParameters),
});

const appendAdditionalUrlParameters = (
  url: string | URL,
  additionalUrlParameters: string,
): string => {
  const urlString = String(url);
  if (!additionalUrlParameters || urlString.includes(additionalUrlParameters)) {
    return urlString;
  }

  const hashIndex = urlString.indexOf("#");
  const base = hashIndex === -1 ? urlString : urlString.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : urlString.slice(hashIndex);
  const separator =
    base.endsWith("?") || base.endsWith("&") ? "" : base.includes("?") ? "&" : "?";
  return `${base}${separator}${additionalUrlParameters}${hash}`;
};

const isSubtreeJson = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  ("tileAvailability" in value ||
    "contentAvailability" in value ||
    "childSubtreeAvailability" in value);

const createBinarySubtreeBuffer = (
  subtreeJson: Record<string, unknown>,
): ArrayBuffer => {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(subtreeJson));
  const buffer = new ArrayBuffer(24 + jsonBytes.length);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  bytes.set([0x73, 0x75, 0x62, 0x74], 0);
  view.setUint32(4, 1, true);
  view.setUint32(8, jsonBytes.length, true);
  view.setUint32(12, 0, true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  bytes.set(jsonBytes, 24);

  return buffer;
};
