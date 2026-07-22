export function createMockContainer(): HTMLElement {
  return {
    appendChild() {
      return undefined;
    },
  } as unknown as HTMLElement;
}

export function dispatchDocumentMouse(
  cesium: ReturnType<typeof createMockCesium>,
  type: string,
  event: Partial<MouseEvent>,
): void {
  const listeners = cesium.operations.documentListeners[type] ?? [];
  for (const listener of listeners) {
    listener({
      target: cesium.operations.canvas,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      preventDefault() {
        return undefined;
      },
      ...event,
    } as MouseEvent);
  }
}

export function dispatchScreenSpace(
  cesium: ReturnType<typeof createMockCesium>,
  type: string,
  movement: unknown,
  modifier?: unknown,
): void {
  for (const handler of cesium.operations.screenSpaceHandlers) {
    if (handler.destroyed) {
      continue;
    }
    for (const action of handler.actions) {
      if (action.type === type && action.modifier === modifier) {
        action.callback(movement);
      }
    }
  }
}

export function createMockCesium() {
  const operations = {
    canvasListeners: {} as Record<string, Array<(event: Event) => void>>,
    documentListeners: {} as Record<string, Array<(event: Event) => void>>,
    canvas: {} as Record<string, unknown>,
    screenSpaceHandlers: [] as Array<{
      destroyed: boolean;
      actions: Array<{ type: unknown; modifier: unknown; callback: (movement: unknown) => void }>;
    }>,
    primitivesAdded: [] as unknown[],
    imageryAdded: [] as unknown[],
    entitiesAdded: [] as unknown[],
    cameraMoves: [] as Array<{ direction: string; amount: number }>,
    cameraViews: [] as Array<{ destination?: unknown; orientation?: unknown }>,
    cameraLookAts: [] as Array<{ target?: unknown; range?: unknown }>,
    headingPitchRolls: [] as Array<{ heading: number; pitch: number; roll: number }>,
    primitiveDestroyCount: 0,
    shaderUniformUpdates: [] as Array<{ name: string; value: unknown }>,
    tilesetEventRemoveCount: 0,
    globe: {} as { show?: boolean; enableLighting?: boolean },
    fog: {
      enabled: true,
      renderable: true,
      density: 0.0006,
      screenSpaceErrorFactor: 2,
    } as Record<string, unknown>,
    cameraFrustum: {
      near: 1,
      far: 1000,
    } as Record<string, unknown>,
    screenSpaceCameraController: {} as Record<string, unknown>,
    skyAtmosphere: {} as { show?: boolean },
    skyBox: {
      show: true,
      destroyed: false,
      isDestroyed() {
        return this.destroyed;
      },
      destroy() {
        this.destroyed = true;
        return undefined;
      },
    } as {
      show?: boolean;
      destroyed: boolean;
      isDestroyed(): boolean;
      destroy(): undefined;
    },
    skyBoxes: [] as Array<{ sources?: unknown }>,
    equirectangularPanoramas: [] as Array<{
      image?: unknown;
      transform?: unknown;
      radius?: unknown;
      repeatHorizontal?: unknown;
      repeatVertical?: unknown;
    }>,
    equirectangularPanoramaInstances: [] as unknown[],
    sun: {} as { show?: boolean },
    moon: {} as { show?: boolean },
    requestRenderCount: 0,
    scene: {} as Record<string, unknown>,
    sceneLights: [] as unknown[],
    sceneMode: "SCENE3D" as unknown,
    sceneModeMorphDuration: undefined as number | undefined,
    pickResult: undefined as unknown,
    pickPositionResult: undefined as unknown,
    viewerDestroyed: false,
    viewerOptions: [] as unknown[],
  };

  const mockDocument = {
    addEventListener(type: string, listener: (event: Event) => void) {
      operations.documentListeners[type] = [
        ...(operations.documentListeners[type] ?? []),
        listener,
      ];
      return undefined;
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      operations.documentListeners[type] = (operations.documentListeners[type] ?? [])
        .filter((registered) => registered !== listener);
      return undefined;
    },
  };
  operations.canvas = {
    ownerDocument: mockDocument,
    contains(target: unknown) {
      return target === operations.canvas;
    },
    addEventListener(type: string, listener: (event: Event) => void) {
      operations.canvasListeners[type] = [
        ...(operations.canvasListeners[type] ?? []),
        listener,
      ];
      return undefined;
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      operations.canvasListeners[type] = (operations.canvasListeners[type] ?? [])
        .filter((registered) => registered !== listener);
      return undefined;
    },
  };

  class Viewer {
    scene = {
      canvas: operations.canvas,
      primitives: {
        add(value: unknown) {
          operations.primitivesAdded.push(value);
          return value;
        },
        remove(value: unknown) {
          const removed = operations.primitivesAdded.includes(value);
          operations.primitivesAdded = operations.primitivesAdded.filter((item) => item !== value);
          if (removed && value && typeof value === "object" && typeof (value as { destroy?: unknown }).destroy === "function") {
            (value as { destroy: () => void }).destroy();
          }
          return removed;
        },
      },
      pick() {
        return operations.pickResult;
      },
      pickPosition() {
        return operations.pickPositionResult;
      },
      mode: "SCENE3D",
      morphToColumbusView(duration: number) {
        this.mode = "COLUMBUS_VIEW";
        operations.sceneMode = this.mode;
        operations.sceneModeMorphDuration = duration;
        return undefined;
      },
      requestRender() {
        operations.requestRenderCount += 1;
        return undefined;
      },
      globe: operations.globe,
      fog: operations.fog,
      screenSpaceCameraController: operations.screenSpaceCameraController,
      skyAtmosphere: operations.skyAtmosphere,
      skyBox: operations.skyBox,
      sun: operations.sun,
      moon: operations.moon,
      get light() {
        return operations.sceneLights.at(-1);
      },
      set light(value: unknown) {
        operations.sceneLights.push(value);
      },
    };
    camera = {
      position: { x: 0, y: 0, z: 0 },
      positionWC: { x: 0, y: 0, z: 0 },
      positionCartographic: { height: 1000 },
      rightWC: { x: 1, y: 0, z: 0 },
      upWC: { x: 0, y: 1, z: 0 },
      directionWC: { x: 0, y: 0, z: -1 },
      frustum: operations.cameraFrustum,
      moveRight(amount: number) {
        operations.cameraMoves.push({ direction: "right", amount });
        this.position.x += amount;
        return undefined;
      },
      moveUp(amount: number) {
        operations.cameraMoves.push({ direction: "up", amount });
        this.position.y += amount;
        return undefined;
      },
      setView(value: { destination?: unknown; orientation?: unknown }) {
        operations.cameraViews.push(value);
        if (value.destination && typeof value.destination === "object") {
          this.position = value.destination as { x: number; y: number; z: number };
          this.positionWC = value.destination as { x: number; y: number; z: number };
        }
        const orientation = value.orientation as
          | { direction?: { x: number; y: number; z: number }; up?: { x: number; y: number; z: number } }
          | undefined;
        if (orientation?.direction) {
          this.directionWC = orientation.direction;
        }
        if (orientation?.up) {
          this.upWC = orientation.up;
        }
        return undefined;
      },
      lookAt(target: unknown, range: unknown) {
        operations.cameraLookAts.push({ target, range });
        return undefined;
      },
      pickEllipsoid() {
        return undefined;
      },
    };
    imageryLayers = {
      addImageryProvider(value: unknown) {
        const layer = { provider: value, alpha: 1, show: true };
        operations.imageryAdded.push(layer);
        return layer;
      },
      remove(value: unknown) {
        operations.imageryAdded = operations.imageryAdded.filter((item) => item !== value);
        return true;
      },
    };
    entities = {
      add(value: unknown) {
        operations.entitiesAdded.push(value);
        return value;
      },
      remove(value: unknown) {
        operations.entitiesAdded = operations.entitiesAdded.filter((item) => item !== value);
        return true;
      },
    };
    clock = {};

    constructor(_parent: unknown, options: unknown) {
      operations.viewerOptions.push(options);
      operations.scene = this.scene;
    }

    destroy() {
      operations.viewerDestroyed = true;
    }
  }

  class Color {
    constructor(
      readonly r: number,
      readonly g: number,
      readonly b: number,
      readonly a: number,
    ) {}
  }

  class SingleTileImageryProvider {
    constructor(readonly options: unknown) {}
  }

  class WebMapServiceImageryProvider {
    constructor(readonly options: unknown) {}
  }

  class WebMapTileServiceImageryProvider {
    constructor(readonly options: unknown) {}
  }

  class ImageMaterialProperty {
    constructor(readonly options: unknown) {}
  }

  class Material {
    static ImageType = "Image";
    static ColorType = "Color";

    constructor(readonly options?: unknown) {}

    static fromType(type: string, uniforms?: Record<string, unknown>) {
      return {
        type,
        uniforms,
        destroyed: false,
        destroy() {
          if (this.destroyed) {
            const error = new Error("This object was destroyed, i.e., destroy() was called.");
            error.name = "DeveloperError";
            throw error;
          }
          this.destroyed = true;
          return undefined;
        },
      };
    }
  }

  class MaterialAppearance {
    static MaterialSupport = {
      TEXTURED: { vertexFormat: "TEXTURED" },
    };

    constructor(readonly options: unknown) {}
  }

  class PerInstanceColorAppearance {
    constructor(readonly options: unknown) {}
  }

  class ColorGeometryInstanceAttribute {
    static fromColor(color: unknown) {
      return { color };
    }
  }

  class GeometryAttribute {
    constructor(readonly options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class GeometryAttributes {
    constructor(options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class Geometry {
    constructor(readonly options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class GeometryInstance {
    constructor(readonly options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  }

  class Primitive {
    destroyed = false;
    show: boolean;

    constructor(readonly options: Record<string, unknown>) {
      this.show = typeof options.show === "boolean" ? options.show : true;
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      if (this.destroyed) {
        const error = new Error("This object was destroyed, i.e., destroy() was called.");
        error.name = "DeveloperError";
        throw error;
      }
      this.destroyed = true;
      operations.primitiveDestroyCount += 1;
      return undefined;
    }
  }

  class PolylineCollection {
    destroyed = false;
    show: boolean;
    modelMatrix?: unknown;
    polylines: unknown[] = [];

    constructor(options: { show?: boolean; modelMatrix?: unknown } = {}) {
      this.show = options.show ?? true;
      this.modelMatrix = options.modelMatrix;
    }

    add(options: unknown) {
      this.polylines.push(options);
      return options;
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      if (this.destroyed) {
        const error = new Error("This object was destroyed, i.e., destroy() was called.");
        error.name = "DeveloperError";
        throw error;
      }
      this.destroyed = true;
      for (const polyline of this.polylines) {
        const typedPolyline = polyline as {
          material?: { destroy?: () => void };
          depthFailMaterial?: { destroy?: () => void };
        };
        typedPolyline.material?.destroy?.();
        typedPolyline.depthFailMaterial?.destroy?.();
      }
      operations.primitiveDestroyCount += 1;
      return undefined;
    }
  }

  class BoundingSphere {
    static fromPoints(positions: readonly unknown[]) {
      return { kind: "points", positions };
    }

    static fromVertices(vertices: Float64Array) {
      return { kind: "vertices", vertices };
    }
  }

  class PolygonHierarchy {
    constructor(readonly positions: unknown[]) {}
  }

  class ScreenSpaceEventHandler {
    destroyed = false;
    actions: Array<{ type: unknown; modifier: unknown; callback: (movement: unknown) => void }> = [];

    constructor(readonly canvas: unknown) {
      operations.screenSpaceHandlers.push(this);
    }

    setInputAction(callback: (movement: unknown) => void, type: unknown, modifier?: unknown) {
      this.actions.push({ type, modifier, callback });
    }

    destroy() {
      this.destroyed = true;
      this.actions = [];
      return undefined;
    }
  }

  class SkyBox {
    show = true;
    destroyed = false;

    constructor(readonly options: { sources?: unknown }) {
      operations.skyBoxes.push(options);
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      this.destroyed = true;
      return undefined;
    }
  }

  class EquirectangularPanorama {
    show = true;
    destroyed = false;

    constructor(readonly options: {
      image?: unknown;
      transform?: unknown;
      radius?: unknown;
      repeatHorizontal?: unknown;
      repeatVertical?: unknown;
    }) {
      operations.equirectangularPanoramas.push(options);
      operations.equirectangularPanoramaInstances.push(this);
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      this.destroyed = true;
      return undefined;
    }
  }

  class CustomShader {
    destroyed = false;

    constructor(readonly options: unknown) {}

    setUniform(name: string, value: unknown) {
      const uniforms = (this.options as { uniforms?: Record<string, { value?: unknown }> }).uniforms;
      if (!uniforms?.[name]) {
        throw new Error(`Missing uniform ${name}`);
      }
      uniforms[name].value = value;
      operations.shaderUniformUpdates.push({ name, value });
      return undefined;
    }

    destroy() {
      this.destroyed = true;
      return undefined;
    }
  }

  class HeadingPitchRange {
    constructor(
      readonly heading: number,
      readonly pitch: number,
      readonly range: number,
    ) {}
  }

  class HeadingPitchRoll {
    constructor(
      readonly heading: number,
      readonly pitch: number,
      readonly roll: number,
    ) {}

    static fromDegrees(heading: number, pitch: number, roll: number) {
      return new HeadingPitchRoll(heading, pitch, roll);
    }
  }

  class Matrix4 {
    static IDENTITY = { kind: "identity" };

    static clone(value: unknown) {
      return value;
    }

    static fromTranslation(translation: { x?: number; y?: number; z?: number }) {
      return { kind: "translation", translation };
    }

    static multiply(left: unknown, right: unknown) {
      return { kind: "multiply", left, right };
    }

    static inverseTransformation(matrix: unknown): unknown {
      const value = matrix as {
        kind?: string;
        left?: unknown;
        right?: unknown;
        origin?: unknown;
        translation?: { x?: number; y?: number; z?: number };
      };
      if (value.kind === "multiply") {
        return {
          kind: "multiply",
          left: Matrix4.inverseTransformation(value.right),
          right: Matrix4.inverseTransformation(value.left),
        };
      }
      if (value.kind === "translation") {
        return {
          kind: "translation",
          translation: {
            x: -(value.translation?.x ?? 0),
            y: -(value.translation?.y ?? 0),
            z: -(value.translation?.z ?? 0),
          },
        };
      }
      if (value.kind === "enu") {
        return { kind: "enu-inverse", origin: value.origin };
      }
      return { kind: "inverse", matrix };
    }

    static multiplyByPoint(
      matrix: unknown,
      point: { x?: number; y?: number; z?: number },
    ): { x?: number; y?: number; z?: number; frame?: string; origin?: unknown } {
      const value = matrix as {
        kind?: string;
        left?: unknown;
        right?: unknown;
        origin?: unknown;
        translation?: { x?: number; y?: number; z?: number };
      };
      if (value.kind === "multiply") {
        return Matrix4.multiplyByPoint(value.left, Matrix4.multiplyByPoint(value.right, point));
      }
      if (value.kind === "identity") {
        return point;
      }
      if (value.kind === "translation") {
        return {
          x: (point.x ?? 0) + (value.translation?.x ?? 0),
          y: (point.y ?? 0) + (value.translation?.y ?? 0),
          z: (point.z ?? 0) + (value.translation?.z ?? 0),
        };
      }
      if (value.kind === "enu") {
        return {
          frame: "enu",
          origin: value.origin,
          x: point.x ?? 0,
          y: point.y ?? 0,
          z: point.z ?? 0,
        };
      }
      if (value.kind === "enu-inverse") {
        return {
          x: point.x ?? 0,
          y: point.y ?? 0,
          z: point.z ?? 0,
        };
      }
      return point;
    }

    static multiplyByPointAsVector(
      matrix: unknown,
      point: { x?: number; y?: number; z?: number },
    ): { x?: number; y?: number; z?: number; frame?: string; origin?: unknown } {
      const value = matrix as {
        kind?: string;
        left?: unknown;
        right?: unknown;
      };
      if (value.kind === "multiply") {
        return Matrix4.multiplyByPointAsVector(value.left, Matrix4.multiplyByPointAsVector(value.right, point));
      }
      if (value.kind === "identity") {
        return point;
      }
      if (value.kind === "translation") {
        return {
          x: point.x ?? 0,
          y: point.y ?? 0,
          z: point.z ?? 0,
        };
      }
      return Matrix4.multiplyByPoint(matrix, point);
    }
  }

  function createTilesetEvent() {
    const listeners: Array<(tile?: unknown) => void> = [];
    return {
      listeners,
      addEventListener(listener: (tile?: unknown) => void) {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
          operations.tilesetEventRemoveCount += 1;
        };
      },
      raise(tile?: unknown) {
        for (const listener of [...listeners]) {
          listener(tile);
        }
      },
    };
  }

  return {
    operations,
    Viewer,
    Color,
    CustomShader,
    Material,
    MaterialAppearance,
    PerInstanceColorAppearance,
    ColorGeometryInstanceAttribute,
    Geometry,
    GeometryAttribute,
    GeometryAttributes,
    GeometryInstance,
    Primitive,
    PolylineCollection,
    BoundingSphere,
    ComponentDatatype: {
      DOUBLE: "DOUBLE",
      FLOAT: "FLOAT",
    },
    PrimitiveType: {
      TRIANGLES: "TRIANGLES",
      LINES: "LINES",
    },
    VaryingType: {
      FLOAT: "float",
    },
    UniformType: {
      FLOAT: "float",
      BOOL: "bool",
      MAT4: "mat4",
      VEC3: "vec3",
    },
    CustomShaderMode: {
      MODIFY_MATERIAL: "MODIFY_MATERIAL",
    },
    CustomShaderTranslucencyMode: {
      OPAQUE: 1,
      TRANSLUCENT: 2,
    },
    LightingModel: {
      PBR: 1,
    },
    ScreenSpaceEventHandler,
    SkyBox,
    EquirectangularPanorama,
    CameraEventType: {
      LEFT_DRAG: "LEFT_DRAG",
      MIDDLE_DRAG: "MIDDLE_DRAG",
      RIGHT_DRAG: "RIGHT_DRAG",
      WHEEL: "WHEEL",
      PINCH: "PINCH",
    },
    ScreenSpaceEventType: {
      LEFT_DOWN: "LEFT_DOWN",
      MIDDLE_DOWN: "MIDDLE_DOWN",
      RIGHT_DOWN: "RIGHT_DOWN",
      LEFT_UP: "LEFT_UP",
      MIDDLE_UP: "MIDDLE_UP",
      RIGHT_UP: "RIGHT_UP",
      MOUSE_MOVE: "MOUSE_MOVE",
      LEFT_DRAG: "SCREEN_LEFT_DRAG",
      MIDDLE_DRAG: "SCREEN_MIDDLE_DRAG",
      RIGHT_DRAG: "SCREEN_RIGHT_DRAG",
      WHEEL: "SCREEN_WHEEL",
      PINCH: "SCREEN_PINCH",
    },
    SceneMode: {
      SCENE3D: "SCENE3D",
      COLUMBUS_VIEW: "COLUMBUS_VIEW",
    },
    Cesium3DTileRefine: {
      ADD: 0,
      REPLACE: 1,
    },
    ArcType: {
      NONE: "NONE",
    },
    KeyboardEventModifier: {
      SHIFT: "SHIFT",
      CTRL: "CTRL",
      ALT: "ALT",
    },
    ImageMaterialProperty,
    PolygonHierarchy,
    HeadingPitchRange,
    HeadingPitchRoll,
    Matrix4,
    Transforms: {
      eastNorthUpToFixedFrame(origin: unknown) {
        return { kind: "enu", origin };
      },
      headingPitchRollQuaternion(_position: unknown, hpr: unknown) {
        const headingPitchRoll = hpr as { heading: number; pitch: number; roll: number };
        operations.headingPitchRolls.push(headingPitchRoll);
        return { kind: "orientation", hpr };
      },
    },
    SingleTileImageryProvider,
    WebMapServiceImageryProvider,
    WebMapTileServiceImageryProvider,
    Cesium3DTileset: {
      fromUrl(url: string, options: unknown) {
        const leaf = { refine: 0, children: [] as unknown[] };
        const root = { refine: 0, children: [leaf] };
        (leaf as { parent?: unknown }).parent = root;
        return Promise.resolve({
          url,
          options,
          root,
          getTraversal() {
            return {
              selectTiles() {
                return true;
              },
            };
          },
          tileLoad: createTilesetEvent(),
          tileVisible: createTilesetEvent(),
          initialTilesLoaded: createTilesetEvent(),
          allTilesLoaded: createTilesetEvent(),
          show: true,
          destroyed: false,
          isDestroyed() {
            return this.destroyed;
          },
          destroy() {
            if (this.destroyed) {
              const error = new Error("This object was destroyed, i.e., destroy() was called.");
              error.name = "DeveloperError";
              throw error;
            }
            this.destroyed = true;
            operations.primitiveDestroyCount += 1;
            return undefined;
          },
        });
      },
    },
    Cartesian2: class Cartesian2 {
      constructor(readonly x: number, readonly y: number) {}
    },
    Cartesian3: {
      fromDegrees(lon: number, lat: number, height = 0) {
        return { lon, lat, height };
      },
      fromElements(x: number, y: number, z: number) {
        return { x, y, z };
      },
    },
    Rectangle: {
      fromDegrees(west: number, south: number, east: number, north: number) {
        return { west, south, east, north };
      },
    },
    Math: {
      toRadians(value: number) {
        return (value * Math.PI) / 180;
      },
    },
    JulianDate: {
      fromDate(date: Date) {
        return date;
      },
    },
  };
}
