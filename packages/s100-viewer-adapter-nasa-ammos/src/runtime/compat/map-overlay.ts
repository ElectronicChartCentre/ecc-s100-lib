import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type Camera,
  type Material,
  type Scene,
} from "three";

export type MapOverlaySpecification = {
  id: string;
  type: number;
  corners: {
    upperLeft: [number, number];
    upperRight: [number, number];
    lowerLeft: [number, number];
    lowerRight: [number, number];
  };
  dataset: {
    mapSubset: {
      min: [number, number];
      max: [number, number];
    };
    extents: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
    minLevel: number;
    maxLevel: number;
  };
  urlTemplate: string;
};

export type MapOverlayTile = {
  column: number;
  row: number;
  level: number;
  bounds: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  corners: {
    upperLeft: [number, number];
    upperRight: [number, number];
    lowerLeft: [number, number];
    lowerRight: [number, number];
  };
  url: string;
};

export type MapOverlayGridOptions = {
  clipExtents?: MapOverlayExtents;
  level?: number;
  maxTilesPerAxis?: number;
  targetTileSizeMeters?: number;
};

export type MapOverlayExtents = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type MapTextureLoaderLike = {
  load(
    url: string,
    onLoad?: (texture: Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): Texture;
  setCrossOrigin?(crossOrigin: string): void;
};

export type FlatMapOverlayOptions = MapOverlayGridOptions & {
  camera?: Camera;
  logger?: {
    warn?: (...args: unknown[]) => void;
  };
  maxTextureAnisotropy?: number;
  textureLoader?: MapTextureLoaderLike;
};

type NormalizedExtents = MapOverlayExtents;

const MAP_OVERLAY_TILE_SIDE_LENGTH_SCALE = 2;
const DEFAULT_TARGET_TILE_SIZE_METERS = 4096 * MAP_OVERLAY_TILE_SIDE_LENGTH_SCALE;
const DEFAULT_MAX_TILES_PER_AXIS = 8 / MAP_OVERLAY_TILE_SIDE_LENGTH_SCALE;
const DETAIL_TARGET_TILE_SIZE_METERS = 96 * MAP_OVERLAY_TILE_SIDE_LENGTH_SCALE;
const DETAIL_MAX_TILES_PER_AXIS = 64 / MAP_OVERLAY_TILE_SIDE_LENGTH_SCALE;
const DETAIL_DISTANCE_FACTOR = 0.25 * MAP_OVERLAY_TILE_SIDE_LENGTH_SCALE;
const DETAIL_WMS_IMAGE_SIZE = 256;
const REFINEMENT_PARENT_REQUEST_BUDGET = 4;
const REFINEMENT_FOCUS_RADIUS_FACTOR = 4;
const MIN_OPACITY = 0;
const MAX_OPACITY = 1;
const BASE_LAYER_TYPE = 0;
const BASE_RENDER_ORDER = 1000;
const MAP_LAYER_Z_OFFSET = -0.1;

type TileResource = {
  readonly key: string;
  readonly tile: MapOverlayTile;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicMaterial;
  readonly mesh: Mesh;
  readonly texture: Texture;
  readonly generation: number;
  loaded: boolean;
};

type TileRequestPriorityContext = {
  camera: Camera | undefined;
  focus: [number, number];
  refinementRadius: number;
  zOffset: number;
};

export class FlatMapOverlay {
  readonly group = new Group();
  tiles: MapOverlayTile[] = [];

  private readonly camera: Camera | undefined;
  private readonly clipExtents: NormalizedExtents | null;
  private readonly origin: [number, number];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly textures: Texture[] = [];
  private readonly resources = new Map<string, TileResource>();
  private readonly activeTileKeys = new Set<string>();
  private readonly loadingParentKeys = new Set<string>();
  private readonly scene: Scene;
  private readonly textureLoader: MapTextureLoaderLike;
  private readonly maxTextureAnisotropy: number;
  private readonly logger: FlatMapOverlayOptions["logger"];
  private tileGridSignature = "";
  private tileGeneration = 0;
  private disposed = false;
  private loadingPaused = false;
  private currentOpacity = 1;
  private targetLevel: number;
  private readonly progressiveRefinement: boolean;

  constructor(
    readonly specification: MapOverlaySpecification,
    scene: Scene,
    options: FlatMapOverlayOptions = {},
  ) {
    this.scene = scene;
    this.camera = options.camera;
    this.clipExtents = options.clipExtents
      ? normalizeExtents(options.clipExtents)
      : null;
    this.textureLoader = options.textureLoader ?? createTextureLoader();
    this.maxTextureAnisotropy = normalizeTextureAnisotropy(
      options.maxTextureAnisotropy,
    );
    this.logger = options.logger;
    this.targetLevel = normalizeLevel(
      specification.dataset.minLevel,
      specification,
    );
    this.progressiveRefinement =
      Boolean(this.camera) && canRefineLayer(this.specification, this.clipExtents);
    this.group.name = `s100-map:${specification.id}`;
    this.group.userData.s100Unpickable = true;
    this.group.visible = false;
    this.group.renderOrder = getLayerRenderOrder(specification.type);

    this.origin = getOverlayOrigin(specification);
    this.group.position.set(this.origin[0], this.origin[1], 0);
    this.setTiles(buildMapTileGrid(specification, this.getInitialGridOptions(options)));

    this.scene.add(this.group);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (visible) {
      this.updateForCamera();
    }
  }

  setOpacity(opacity: number): void {
    this.currentOpacity = clamp(opacity, MIN_OPACITY, MAX_OPACITY);
    for (const material of this.materials) {
      material.opacity = this.currentOpacity;
      material.needsUpdate = true;
    }
    this.updateResourceVisibility();
    if (this.group.visible && this.currentOpacity > 0) {
      this.updateForCamera();
    }
  }

  setLoadingPaused(paused: boolean): void {
    const nextPaused = Boolean(paused);
    if (this.loadingPaused === nextPaused) {
      return;
    }

    this.loadingPaused = nextPaused;
    if (!this.loadingPaused && this.isRefinementVisible()) {
      this.tryPromoteLoadedChildren();
      this.requestNextLod();
    }
  }

  updateForCamera(): void {
    if (
      this.disposed ||
      this.loadingPaused ||
      !this.camera ||
      !this.isRefinementVisible() ||
      !canRefineLayer(this.specification, this.clipExtents)
    ) {
      return;
    }

    const gridOptions = this.getCameraGridOptions();
    const nextLevel = computeMapTileGridLevel(this.specification, gridOptions);

    if (!this.progressiveRefinement) {
      const nextTiles = buildMapTileGrid(this.specification, gridOptions);
      const nextSignature = getTileGridSignature(nextTiles);
      if (nextSignature !== this.tileGridSignature) {
        this.setTiles(nextTiles);
      }
      return;
    }

    if (nextLevel < this.getHighestActiveLevel()) {
      const resetOptions: MapOverlayGridOptions = {
        ...gridOptions,
        level: nextLevel,
      };
      if (this.clipExtents) {
        resetOptions.clipExtents = this.clipExtents;
      }
      this.setTiles(buildMapTileGrid(this.specification, resetOptions));
    }

    this.targetLevel = nextLevel;
    this.requestNextLod();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.scene.remove(this.group);
    this.clearTileResources();
  }

  private getCameraGridOptions(): MapOverlayGridOptions {
    const distance = this.cameraDistanceToOverlay();
    if (!Number.isFinite(distance)) {
      return {};
    }

    const targetTileSizeMeters = clamp(
      distance * DETAIL_DISTANCE_FACTOR,
      DETAIL_TARGET_TILE_SIZE_METERS,
      DEFAULT_TARGET_TILE_SIZE_METERS,
    );
    return {
      maxTilesPerAxis: DETAIL_MAX_TILES_PER_AXIS,
      targetTileSizeMeters,
    };
  }

  private getInitialGridOptions(
    options: MapOverlayGridOptions,
  ): MapOverlayGridOptions {
    if (
      !this.camera ||
      !canRefineLayer(this.specification, this.clipExtents)
    ) {
      return options;
    }

    if (this.progressiveRefinement) {
      return {
        ...options,
        level: this.specification.dataset.minLevel,
      };
    }

    return {
      ...options,
      ...this.getCameraGridOptions(),
    };
  }

  private cameraDistanceToOverlay(): number {
    if (!this.camera) {
      return Number.POSITIVE_INFINITY;
    }

    const verticalDistance = Math.abs(
      this.camera.position.z - getLayerZOffset(this.specification.type),
    );
    if (Number.isFinite(verticalDistance)) {
      return verticalDistance;
    }

    return this.camera.position.distanceTo(
      new Vector3(this.origin[0], this.origin[1], 0),
    );
  }

  private setTiles(tiles: MapOverlayTile[]): void {
    this.clearTileResources();
    this.tileGridSignature = getTileGridSignature(tiles);

    for (const tile of tiles) {
      const resource = this.addTile(tile, this.textureLoader);
      this.activeTileKeys.add(resource.key);
      this.updateResourceVisibility(resource);
    }

    this.tiles = this.getActiveTiles();
  }

  private clearTileResources(): void {
    this.tileGeneration += 1;
    this.group.clear();
    this.resources.clear();
    this.activeTileKeys.clear();
    this.loadingParentKeys.clear();

    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      disposeMaterial(material);
    }
    for (const texture of this.textures) {
      texture.dispose();
    }

    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
  }

  private disposeTileResource(key: string): void {
    const resource = this.resources.get(key);
    if (!resource) {
      return;
    }

    this.resources.delete(key);
    this.activeTileKeys.delete(key);
    this.loadingParentKeys.delete(key);
    resource.mesh.visible = false;
    resource.material.visible = false;
    resource.mesh.parent?.remove(resource.mesh);
    resource.geometry.dispose();
    disposeMaterial(resource.material);
    resource.texture.dispose();
    removeArrayItem(this.geometries, resource.geometry);
    removeArrayItem(this.materials, resource.material);
    removeArrayItem(this.textures, resource.texture);
  }

  private addTile(
    tile: MapOverlayTile,
    textureLoader: MapTextureLoaderLike,
  ): TileResource {
    const generation = this.tileGeneration;
    let resource: TileResource | undefined;
    let loadCompleted = false;
    const texture = textureLoader.load(
      tile.url,
      (loadedTexture) => {
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.needsUpdate = true;
        if (this.disposed || generation !== this.tileGeneration) {
          loadedTexture.dispose();
          return;
        }
        if (resource) {
          this.onTileLoaded(resource);
        } else {
          loadCompleted = true;
        }
      },
      undefined,
      (error) => {
        this.logger?.warn?.("Failed to load ENC WMS tile", tile.url, error);
      },
    );
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = this.maxTextureAnisotropy;
    this.textures.push(texture);

    const material = new MeshBasicMaterial({
      depthTest: true,
      depthWrite: false,
      map: texture,
      opacity: this.currentOpacity,
      side: DoubleSide,
      transparent: true,
    });
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;

    const geometry = createTileGeometry(
      tile.corners,
      getLayerZOffset(this.specification.type),
      this.origin,
    );
    const mesh = new Mesh(geometry, material);
    mesh.name = `s100-map-tile:${this.specification.id}:${tile.level}/${tile.column}/${tile.row}`;
    mesh.userData.s100Unpickable = true;
    mesh.renderOrder = this.group.renderOrder;
    mesh.visible = false;

    this.geometries.push(geometry);
    this.materials.push(material);
    this.group.add(mesh);
    resource = {
      key: getTileResourceKey(tile),
      tile,
      geometry,
      material,
      mesh,
      texture,
      generation,
      loaded: false,
    };
    this.resources.set(resource.key, resource);
    if (loadCompleted) {
      this.onTileLoaded(resource);
    } else {
      this.updateResourceVisibility(resource);
    }
    return resource;
  }

  private onTileLoaded(resource: TileResource): void {
    if (this.disposed || resource.generation !== this.tileGeneration) {
      resource.texture.dispose();
      return;
    }

    resource.loaded = true;
    this.updateResourceVisibility(resource);

    if (!this.loadingPaused) {
      const parentKey = getParentTileResourceKey(resource.tile);
      if (parentKey) {
        this.tryPromoteChildren(parentKey);
      }
      this.requestNextLod();
    }
  }

  private updateResourceVisibility(resource?: TileResource): void {
    if (resource) {
      const visible =
        resource.loaded &&
        this.activeTileKeys.has(resource.key) &&
        this.currentOpacity > 0;
      resource.mesh.visible = visible;
      resource.material.visible = visible;
      resource.material.opacity = this.currentOpacity;
      resource.material.needsUpdate = true;
      return;
    }

    for (const candidate of this.resources.values()) {
      this.updateResourceVisibility(candidate);
    }
  }

  private requestNextLod(): void {
    if (
      this.loadingPaused ||
      !this.progressiveRefinement ||
      !this.isRefinementVisible()
    ) {
      return;
    }

    const activeResources = [...this.activeTileKeys]
      .map((key) => this.resources.get(key))
      .filter((resource): resource is TileResource => Boolean(resource));
    if (
      activeResources.length === 0 ||
      activeResources.some((resource) => !resource.loaded)
    ) {
      return;
    }

    const requestContext = this.getRequestPriorityContext();
    const refinementCandidates = activeResources
      .filter((resource) =>
        shouldRefineTile(
          this.specification,
          resource.tile,
          requestContext,
          this.targetLevel,
        ),
      )
      .sort((a, b) =>
        compareTileRequestPriority(a.tile, b.tile, requestContext),
      );

    const remainingParentRequestBudget =
      REFINEMENT_PARENT_REQUEST_BUDGET - this.loadingParentKeys.size;
    if (
      refinementCandidates.length === 0 ||
      remainingParentRequestBudget <= 0
    ) {
      return;
    }

    let requestedParents = 0;
    for (const resource of refinementCandidates) {
      if (this.requestChildren(resource.tile)) {
        requestedParents += 1;
        if (requestedParents >= remainingParentRequestBudget) {
          break;
        }
      }
    }
  }

  private requestChildren(parent: MapOverlayTile): boolean {
    if (this.loadingPaused) {
      return false;
    }

    const parentKey = getTileResourceKey(parent);
    if (this.loadingParentKeys.has(parentKey)) {
      return false;
    }
    this.loadingParentKeys.add(parentKey);

    let requested = false;
    const children = buildMapTileChildren(this.specification, parent).sort(
      (a, b) => compareTileRequestPriority(a, b, this.getRequestPriorityContext()),
    );
    for (const child of children) {
      const childKey = getTileResourceKey(child);
      if (!this.resources.has(childKey)) {
        this.addTile(child, this.textureLoader);
        requested = true;
      }
    }

    this.tryPromoteChildren(parentKey);
    return requested;
  }

  private tryPromoteChildren(parentKey: string): void {
    if (this.loadingPaused) {
      return;
    }

    if (!this.activeTileKeys.has(parentKey)) {
      return;
    }

    const parent = this.resources.get(parentKey);
    if (!parent) {
      return;
    }

    const children = buildMapTileChildren(this.specification, parent.tile)
      .map((tile) => this.resources.get(getTileResourceKey(tile)))
      .filter((resource): resource is TileResource => Boolean(resource));
    if (children.length !== 4 || children.some((child) => !child.loaded)) {
      return;
    }

    this.activeTileKeys.delete(parentKey);
    for (const child of children) {
      this.activeTileKeys.add(child.key);
    }
    this.disposeTileResource(parentKey);
    this.tiles = this.getActiveTiles();
    this.updateResourceVisibility();
    this.requestNextLod();
  }

  private tryPromoteLoadedChildren(): void {
    for (const key of [...this.activeTileKeys]) {
      this.tryPromoteChildren(key);
    }
  }

  private isRefinementVisible(): boolean {
    return this.group.visible && this.currentOpacity > 0;
  }

  private getHighestActiveLevel(): number {
    let level = normalizeLevel(
      this.specification.dataset.minLevel,
      this.specification,
    );
    for (const key of this.activeTileKeys) {
      const resource = this.resources.get(key);
      if (resource) {
        level = Math.max(level, resource.tile.level);
      }
    }
    return level;
  }

  private getActiveTiles(): MapOverlayTile[] {
    return [...this.activeTileKeys]
      .map((key) => this.resources.get(key)?.tile)
      .filter((tile): tile is MapOverlayTile => Boolean(tile))
      .sort(compareMapOverlayTiles);
  }

  private getRequestPriorityContext(): TileRequestPriorityContext {
    return {
      camera: this.camera,
      focus: this.getRequestFocusPoint(),
      refinementRadius: this.getRequestFocusRadius(),
      zOffset: getLayerZOffset(this.specification.type),
    };
  }

  private getRequestFocusPoint(): [number, number] {
    if (!this.camera) {
      return this.origin;
    }

    const zOffset = getLayerZOffset(this.specification.type);
    const direction = new Vector3(0, 0, -1).applyQuaternion(
      this.camera.quaternion,
    );
    if (Math.abs(direction.z) > 1e-6) {
      const distanceToPlane = (zOffset - this.camera.position.z) / direction.z;
      if (Number.isFinite(distanceToPlane) && distanceToPlane > 0) {
        return [
          this.camera.position.x + direction.x * distanceToPlane,
          this.camera.position.y + direction.y * distanceToPlane,
        ];
      }
    }

    return [this.camera.position.x, this.camera.position.y];
  }

  private getRequestFocusRadius(): number {
    if (!this.camera) {
      return Number.POSITIVE_INFINITY;
    }

    const verticalDistance = Math.abs(
      this.camera.position.z - getLayerZOffset(this.specification.type),
    );
    const fov = getCameraVerticalFovRadians(this.camera);
    if (!Number.isFinite(verticalDistance) || !Number.isFinite(fov)) {
      return DETAIL_TARGET_TILE_SIZE_METERS;
    }

    return Math.max(
      DETAIL_TARGET_TILE_SIZE_METERS,
      verticalDistance * Math.tan(fov / 2) * REFINEMENT_FOCUS_RADIUS_FACTOR,
    );
  }
}

export function buildMapTileGrid(
  specification: MapOverlaySpecification,
  options: MapOverlayGridOptions = {},
): MapOverlayTile[] {
  const extents =
    normalizeExtents(specification.dataset.extents) ??
    extentsFromCorners(specification);
  const clipExtents = options.clipExtents
    ? normalizeExtents(options.clipExtents)
    : null;
  if (!extents) {
    return [];
  }

  const width = extents.maxX - extents.minX;
  const height = extents.maxY - extents.minY;
  if (width <= 0 || height <= 0) {
    return [];
  }

  const level = computeMapTileGridLevel(specification, options);
  const columns = 2 ** level;
  const rows = 2 ** level;

  const tiles: MapOverlayTile[] = [];
  const tileWidth = width / columns;
  const tileHeight = height / rows;

  for (let row = 0; row < rows; row += 1) {
    const ymax = row === 0 ? extents.maxY : extents.maxY - row * tileHeight;
    const ymin =
      row === rows - 1 ? extents.minY : extents.maxY - (row + 1) * tileHeight;

    for (let column = 0; column < columns; column += 1) {
      const xmin =
        column === 0 ? extents.minX : extents.minX + column * tileWidth;
      const xmax =
        column === columns - 1
          ? extents.maxX
          : extents.minX + (column + 1) * tileWidth;
      const bounds = { xmin, ymin, xmax, ymax };
      const visibleBounds = subtractClipExtents(bounds, clipExtents);

      for (const clippedBounds of visibleBounds) {
        const tileWithoutUrl = {
          column,
          row,
          level,
          bounds: clippedBounds,
          corners: cornersForBounds(specification, extents, clippedBounds),
        };

        tiles.push({
          ...tileWithoutUrl,
          url: formatMapTileURL(specification.urlTemplate, tileWithoutUrl),
        });
      }
    }
  }

  return tiles;
}

function buildMapTileChildren(
  specification: MapOverlaySpecification,
  parent: MapOverlayTile,
): MapOverlayTile[] {
  const extents =
    normalizeExtents(specification.dataset.extents) ??
    extentsFromCorners(specification);
  if (
    !extents ||
    parent.level >= normalizeLevel(specification.dataset.maxLevel, specification)
  ) {
    return [];
  }

  const midX = parent.bounds.xmin + (parent.bounds.xmax - parent.bounds.xmin) / 2;
  const midY = parent.bounds.ymin + (parent.bounds.ymax - parent.bounds.ymin) / 2;
  const level = parent.level + 1;
  const children: MapOverlayTile[] = [];

  for (let rowOffset = 0; rowOffset < 2; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
      const column = parent.column * 2 + columnOffset;
      const row = parent.row * 2 + rowOffset;
      const bounds = {
        xmin: columnOffset === 0 ? parent.bounds.xmin : midX,
        ymin: rowOffset === 0 ? midY : parent.bounds.ymin,
        xmax: columnOffset === 0 ? midX : parent.bounds.xmax,
        ymax: rowOffset === 0 ? parent.bounds.ymax : midY,
      };
      const tileWithoutUrl = {
        column,
        row,
        level,
        bounds,
        corners: cornersForBounds(specification, extents, bounds),
      };
      children.push({
        ...tileWithoutUrl,
        url: formatMapTileURL(specification.urlTemplate, tileWithoutUrl),
      });
    }
  }

  return children;
}

function computeMapTileGridLevel(
  specification: MapOverlaySpecification,
  options: MapOverlayGridOptions,
): number {
  if (typeof options.level === "number") {
    return normalizeLevel(options.level, specification);
  }

  const extents =
    normalizeExtents(specification.dataset.extents) ??
    extentsFromCorners(specification);
  if (!extents) {
    return normalizeLevel(specification.dataset.minLevel, specification);
  }

  const width = extents.maxX - extents.minX;
  const height = extents.maxY - extents.minY;
  const size = Math.max(width, height);
  const targetTileSize =
    Number.isFinite(options.targetTileSizeMeters) &&
    Number(options.targetTileSizeMeters) > 0
      ? Number(options.targetTileSizeMeters)
      : DEFAULT_TARGET_TILE_SIZE_METERS;
  const requestedLevel = Math.max(
    0,
    Math.ceil(Math.log2(size / targetTileSize)),
  );
  const maxTilesPerAxis =
    Number.isFinite(options.maxTilesPerAxis) &&
    Number(options.maxTilesPerAxis) > 0
      ? Number(options.maxTilesPerAxis)
      : DEFAULT_MAX_TILES_PER_AXIS;
  const maxAxisLevel = Math.max(0, Math.floor(Math.log2(maxTilesPerAxis)));

  return normalizeLevel(
    Math.min(requestedLevel, maxAxisLevel),
    specification,
  );
}

function getTileGridSignature(tiles: MapOverlayTile[]): string {
  const firstTile = tiles[0];
  const lastTile = tiles.at(-1);
  return [
    tiles.length,
    firstTile?.level,
    firstTile?.bounds.xmin,
    firstTile?.bounds.ymin,
    firstTile?.bounds.xmax,
    firstTile?.bounds.ymax,
    lastTile?.column,
    lastTile?.row,
    lastTile?.level,
  ].join(":");
}

export function formatMapTileURL(
  template: string,
  tile: Pick<MapOverlayTile, "bounds" | "column" | "level" | "row">,
): string {
  const url = template
    .replace(/\{x\}/g, String(tile.column))
    .replace(/\{y\}/g, String(tile.row))
    .replace(/\{z\}/g, String(tile.level))
    .replace(/\{xmin\}/g, formatCoordinate(tile.bounds.xmin))
    .replace(/\{ymin\}/g, formatCoordinate(tile.bounds.ymin))
    .replace(/\{xmax\}/g, formatCoordinate(tile.bounds.xmax))
    .replace(/\{ymax\}/g, formatCoordinate(tile.bounds.ymax));
  return setWmsImageSize(url, DETAIL_WMS_IMAGE_SIZE);
}

function createTextureLoader(): TextureLoader {
  const loader = new TextureLoader();
  loader.setCrossOrigin("anonymous");
  return loader;
}

function createTileGeometry(
  corners: MapOverlayTile["corners"],
  zOffset: number,
  origin: [number, number],
): BufferGeometry {
  const geometry = new BufferGeometry();
  const { upperLeft, upperRight, lowerLeft, lowerRight } = corners;
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        upperLeft[0] - origin[0],
        upperLeft[1] - origin[1],
        zOffset,
        lowerLeft[0] - origin[0],
        lowerLeft[1] - origin[1],
        zOffset,
        upperRight[0] - origin[0],
        upperRight[1] - origin[1],
        zOffset,
        lowerRight[0] - origin[0],
        lowerRight[1] - origin[1],
        zOffset,
      ],
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute([0, 1, 0, 0, 1, 1, 1, 0], 2),
  );
  geometry.computeBoundingSphere();
  return geometry;
}

function getOverlayOrigin(
  specification: MapOverlaySpecification,
): [number, number] {
  const extents =
    normalizeExtents(specification.dataset.extents) ??
    extentsFromCorners(specification);
  if (!extents) {
    return [0, 0];
  }
  return [
    extents.minX + (extents.maxX - extents.minX) / 2,
    extents.minY + (extents.maxY - extents.minY) / 2,
  ];
}

function cornersForBounds(
  specification: MapOverlaySpecification,
  extents: NormalizedExtents,
  bounds: MapOverlayTile["bounds"],
): MapOverlayTile["corners"] {
  const umin = normalizeRange(bounds.xmin, extents.minX, extents.maxX);
  const umax = normalizeRange(bounds.xmax, extents.minX, extents.maxX);
  const vmin = normalizeRange(bounds.ymin, extents.minY, extents.maxY);
  const vmax = normalizeRange(bounds.ymax, extents.minY, extents.maxY);

  return {
    upperLeft: interpolateCorner(specification, umin, vmax),
    upperRight: interpolateCorner(specification, umax, vmax),
    lowerLeft: interpolateCorner(specification, umin, vmin),
    lowerRight: interpolateCorner(specification, umax, vmin),
  };
}

function interpolateCorner(
  specification: MapOverlaySpecification,
  u: number,
  v: number,
): [number, number] {
  const lower = interpolatePoint(
    specification.corners.lowerLeft,
    specification.corners.lowerRight,
    u,
  );
  const upper = interpolatePoint(
    specification.corners.upperLeft,
    specification.corners.upperRight,
    u,
  );
  return interpolatePoint(lower, upper, v);
}

function interpolatePoint(
  a: [number, number],
  b: [number, number],
  amount: number,
): [number, number] {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
  ];
}

function normalizeRange(value: number, min: number, max: number): number {
  if (max === min) {
    return 0;
  }
  return clamp((value - min) / (max - min), 0, 1);
}

function normalizeExtents(
  extents: MapOverlaySpecification["dataset"]["extents"],
): NormalizedExtents | null {
  const minX = Math.min(extents.minX, extents.maxX);
  const maxX = Math.max(extents.minX, extents.maxX);
  const minY = Math.min(extents.minY, extents.maxY);
  const maxY = Math.max(extents.minY, extents.maxY);
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
    return null;
  }
  return { minX, maxX, minY, maxY };
}

function extentsFromCorners(
  specification: MapOverlaySpecification,
): NormalizedExtents | null {
  const points = [
    specification.corners.upperLeft,
    specification.corners.upperRight,
    specification.corners.lowerLeft,
    specification.corners.lowerRight,
  ];
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  if (![...xs, ...ys].every(Number.isFinite)) {
    return null;
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function clampInteger(value: number, min: number, max: number): number {
  const normalizedMin = Number.isFinite(min) ? Math.floor(min) : 0;
  const normalizedMax = Number.isFinite(max)
    ? Math.max(normalizedMin, Math.floor(max))
    : normalizedMin;
  if (!Number.isFinite(value)) {
    return normalizedMin;
  }
  return Math.min(normalizedMax, Math.max(normalizedMin, Math.floor(value)));
}

function normalizeLevel(
  value: number,
  specification: MapOverlaySpecification,
): number {
  return clampInteger(
    value,
    specification.dataset.minLevel,
    specification.dataset.maxLevel,
  );
}

function formatCoordinate(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(6).replace(/\.?0+$/u, "");
}

function getTileResourceKey(tile: MapOverlayTile): string {
  return [
    tile.level,
    tile.column,
    tile.row,
    formatCoordinate(tile.bounds.xmin),
    formatCoordinate(tile.bounds.ymin),
    formatCoordinate(tile.bounds.xmax),
    formatCoordinate(tile.bounds.ymax),
  ].join("/");
}

function getParentTileResourceKey(tile: MapOverlayTile): string | null {
  if (tile.level <= 0) {
    return null;
  }

  const width = tile.bounds.xmax - tile.bounds.xmin;
  const height = tile.bounds.ymax - tile.bounds.ymin;
  const parentBounds = {
    xmin: tile.column % 2 === 0 ? tile.bounds.xmin : tile.bounds.xmin - width,
    ymin: tile.row % 2 === 0 ? tile.bounds.ymin - height : tile.bounds.ymin,
    xmax: tile.column % 2 === 0 ? tile.bounds.xmax + width : tile.bounds.xmax,
    ymax: tile.row % 2 === 0 ? tile.bounds.ymax : tile.bounds.ymax + height,
  };

  return getTileResourceKey({
    ...tile,
    column: Math.floor(tile.column / 2),
    row: Math.floor(tile.row / 2),
    level: tile.level - 1,
    bounds: parentBounds,
  });
}

function compareMapOverlayTiles(
  a: MapOverlayTile,
  b: MapOverlayTile,
): number {
  return (
    a.level - b.level ||
    a.row - b.row ||
    a.column - b.column ||
    a.bounds.ymin - b.bounds.ymin ||
    a.bounds.xmin - b.bounds.xmin
  );
}

function compareTileRequestPriority(
  a: MapOverlayTile,
  b: MapOverlayTile,
  context: TileRequestPriorityContext,
): number {
  const aVisibility = getTileVisibilityRank(a, context);
  const bVisibility = getTileVisibilityRank(b, context);
  return (
    aVisibility - bVisibility ||
    getTileDistanceToFocus(a, context.focus) -
      getTileDistanceToFocus(b, context.focus) ||
    compareMapOverlayTiles(a, b)
  );
}

function shouldRefineTile(
  specification: MapOverlaySpecification,
  tile: MapOverlayTile,
  context: TileRequestPriorityContext,
  globalTargetLevel: number,
): boolean {
  if (tile.level >= globalTargetLevel) {
    return false;
  }

  if (tile.level >= getTileTargetLevel(specification, tile, context)) {
    return false;
  }

  if (getTileVisibilityRank(tile, context) === 0) {
    return true;
  }

  return (
    getTileDistanceToFocusBounds(tile, context.focus) <=
    context.refinementRadius
  );
}

function getTileTargetLevel(
  specification: MapOverlaySpecification,
  tile: MapOverlayTile,
  context: TileRequestPriorityContext,
): number {
  if (!context.camera) {
    return normalizeLevel(specification.dataset.maxLevel, specification);
  }

  const distance = getTileDistanceToCameraBounds(tile, context);
  const targetTileSizeMeters = clamp(
    distance * DETAIL_DISTANCE_FACTOR,
    DETAIL_TARGET_TILE_SIZE_METERS,
    DEFAULT_TARGET_TILE_SIZE_METERS,
  );
  return computeMapTileGridLevel(specification, {
    maxTilesPerAxis: DETAIL_MAX_TILES_PER_AXIS,
    targetTileSizeMeters,
  });
}

function getTileVisibilityRank(
  tile: MapOverlayTile,
  context: TileRequestPriorityContext,
): number {
  if (!context.camera) {
    return 1;
  }

  context.camera.updateMatrixWorld();
  const projectedBounds = getProjectedTileBounds(tile, context);
  if (!projectedBounds.inFront) {
    return 2;
  }

  const viewMargin = 0.25;
  const inView =
    projectedBounds.maxZ >= -1 &&
    projectedBounds.minZ <= 1 &&
    projectedBounds.maxX >= -1 - viewMargin &&
    projectedBounds.minX <= 1 + viewMargin &&
    projectedBounds.maxY >= -1 - viewMargin &&
    projectedBounds.minY <= 1 + viewMargin;

  return inView ? 0 : 1;
}

function getProjectedTileBounds(
  tile: MapOverlayTile,
  context: TileRequestPriorityContext,
): {
  inFront: boolean;
  maxX: number;
  maxY: number;
  maxZ: number;
  minX: number;
  minY: number;
  minZ: number;
} {
  let inFront = false;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of getTileSamplePoints(tile, context.zOffset)) {
    const cameraSpacePoint = point
      .clone()
      .applyMatrix4(context.camera!.matrixWorldInverse);
    if (cameraSpacePoint.z >= 0) {
      continue;
    }

    inFront = true;
    const projectedPoint = point.project(context.camera!);
    minX = Math.min(minX, projectedPoint.x);
    minY = Math.min(minY, projectedPoint.y);
    minZ = Math.min(minZ, projectedPoint.z);
    maxX = Math.max(maxX, projectedPoint.x);
    maxY = Math.max(maxY, projectedPoint.y);
    maxZ = Math.max(maxZ, projectedPoint.z);
  }

  return { inFront, maxX, maxY, maxZ, minX, minY, minZ };
}

function getTileSamplePoints(tile: MapOverlayTile, zOffset: number): Vector3[] {
  return [
    getTileCenter(tile, zOffset),
    new Vector3(tile.bounds.xmin, tile.bounds.ymin, zOffset),
    new Vector3(tile.bounds.xmin, tile.bounds.ymax, zOffset),
    new Vector3(tile.bounds.xmax, tile.bounds.ymin, zOffset),
    new Vector3(tile.bounds.xmax, tile.bounds.ymax, zOffset),
  ];
}

function getTileDistanceToFocus(
  tile: MapOverlayTile,
  focus: [number, number],
): number {
  const centerX = tile.bounds.xmin + (tile.bounds.xmax - tile.bounds.xmin) / 2;
  const centerY = tile.bounds.ymin + (tile.bounds.ymax - tile.bounds.ymin) / 2;
  return Math.hypot(centerX - focus[0], centerY - focus[1]);
}

function getTileDistanceToFocusBounds(
  tile: MapOverlayTile,
  focus: [number, number],
): number {
  const x = clamp(focus[0], tile.bounds.xmin, tile.bounds.xmax);
  const y = clamp(focus[1], tile.bounds.ymin, tile.bounds.ymax);
  return Math.hypot(x - focus[0], y - focus[1]);
}

function getTileDistanceToCameraBounds(
  tile: MapOverlayTile,
  context: TileRequestPriorityContext,
): number {
  if (!context.camera) {
    return Number.POSITIVE_INFINITY;
  }

  const x = clamp(
    context.camera.position.x,
    tile.bounds.xmin,
    tile.bounds.xmax,
  );
  const y = clamp(
    context.camera.position.y,
    tile.bounds.ymin,
    tile.bounds.ymax,
  );
  return context.camera.position.distanceTo(
    new Vector3(x, y, context.zOffset),
  );
}

function getTileCenter(tile: MapOverlayTile, zOffset: number): Vector3 {
  return new Vector3(
    tile.bounds.xmin + (tile.bounds.xmax - tile.bounds.xmin) / 2,
    tile.bounds.ymin + (tile.bounds.ymax - tile.bounds.ymin) / 2,
    zOffset,
  );
}

function getLayerRenderOrder(type: number): number {
  return BASE_RENDER_ORDER + type * 10;
}

function getLayerZOffset(type: number): number {
  void type;
  return MAP_LAYER_Z_OFFSET;
}

function getCameraVerticalFovRadians(camera: Camera): number {
  const fov = (camera as { fov?: unknown }).fov;
  return typeof fov === "number" && Number.isFinite(fov)
    ? (fov * Math.PI) / 180
    : Math.PI / 4;
}

function canRefineLayer(
  specification: MapOverlaySpecification,
  clipExtents?: NormalizedExtents | null,
): boolean {
  return specification.type !== BASE_LAYER_TYPE || Boolean(clipExtents);
}

function normalizeTextureAnisotropy(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

function setWmsImageSize(url: string, size: number): string {
  const widthPattern = /([?&]WIDTH=)\d+/iu;
  const heightPattern = /([?&]HEIGHT=)\d+/iu;
  const normalizedSize = String(size);

  return url
    .replace(widthPattern, `$1${normalizedSize}`)
    .replace(heightPattern, `$1${normalizedSize}`);
}

function subtractClipExtents(
  bounds: MapOverlayTile["bounds"],
  clipExtents: NormalizedExtents | null,
): MapOverlayTile["bounds"][] {
  if (!clipExtents) {
    return [bounds];
  }

  const overlap = {
    xmin: Math.max(bounds.xmin, clipExtents.minX),
    ymin: Math.max(bounds.ymin, clipExtents.minY),
    xmax: Math.min(bounds.xmax, clipExtents.maxX),
    ymax: Math.min(bounds.ymax, clipExtents.maxY),
  };

  if (overlap.xmin >= overlap.xmax || overlap.ymin >= overlap.ymax) {
    return [bounds];
  }

  const visibleBounds: MapOverlayTile["bounds"][] = [];
  pushPositiveBounds(visibleBounds, {
    xmin: bounds.xmin,
    ymin: bounds.ymin,
    xmax: bounds.xmax,
    ymax: overlap.ymin,
  });
  pushPositiveBounds(visibleBounds, {
    xmin: bounds.xmin,
    ymin: overlap.ymax,
    xmax: bounds.xmax,
    ymax: bounds.ymax,
  });
  pushPositiveBounds(visibleBounds, {
    xmin: bounds.xmin,
    ymin: overlap.ymin,
    xmax: overlap.xmin,
    ymax: overlap.ymax,
  });
  pushPositiveBounds(visibleBounds, {
    xmin: overlap.xmax,
    ymin: overlap.ymin,
    xmax: bounds.xmax,
    ymax: overlap.ymax,
  });

  return visibleBounds;
}

function pushPositiveBounds(
  target: MapOverlayTile["bounds"][],
  bounds: MapOverlayTile["bounds"],
): void {
  if (bounds.xmin < bounds.xmax && bounds.ymin < bounds.ymax) {
    target.push(bounds);
  }
}

function disposeMaterial(material: Material): void {
  material.dispose();
}

function removeArrayItem<T>(items: T[], item: T): void {
  const index = items.indexOf(item);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return max;
  }
  return Math.min(max, Math.max(min, value));
}
