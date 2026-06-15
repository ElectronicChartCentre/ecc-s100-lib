import {
  AmbientLight,
  AxesHelper,
  BackSide,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  GridHelper,
  MathUtils,
  Mesh,
  PMREMGenerator,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
  WebGLRenderer,
} from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { S100Scene } from "./S100Scene.js";
import type {
  S100NasaViewerConfig,
  S100RenderContext,
  S100SceneOptions,
} from "./types.js";

const DEFAULT_CANVAS_WIDTH = 300;
const DEFAULT_CANVAS_HEIGHT = 150;
const DEFAULT_FIELD_OF_VIEW_DEGREES = 45;
const MIN_FIELD_OF_VIEW_DEGREES = 5;
const MAX_FIELD_OF_VIEW_DEGREES = 120;
const DEFAULT_AMBIENT_LIGHT_INTENSITY = 0.042;
const DEFAULT_DIRECTIONAL_LIGHT_INTENSITY = 0.108;
const DEFAULT_ENVIRONMENT_INTENSITY = 0.2025;
const DEFAULT_BACKGROUND_INTENSITY = 1;
const SKYDOME_RADIUS_METERS = 50_000;
// Three negates scene background/environment Euler angles before sending them
// to the shader, so the configured rotation is the inverse of the sampled one.
const Z_UP_BACKGROUND_ROTATION_X = Math.PI / 2;
const Z_UP_BACKGROUND_ROTATION_Y = 0;
const Z_UP_BACKGROUND_ROTATION_Z = -MathUtils.degToRad(75);
const Z_UP_ENVIRONMENT_ROTATION_X = Z_UP_BACKGROUND_ROTATION_X;
const Z_UP_ENVIRONMENT_ROTATION_Y = Z_UP_BACKGROUND_ROTATION_Y;
const Z_UP_ENVIRONMENT_ROTATION_Z = Z_UP_BACKGROUND_ROTATION_Z;
const SKYDOME_VERTEX_SHADER = `
varying vec3 vWorldDirection;

void main() {
  vWorldDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKYDOME_FRAGMENT_SHADER = `
uniform sampler2D skyMap;
uniform float intensity;
uniform float azimuthRotation;

varying vec3 vWorldDirection;

const float RECIPROCAL_PI = 0.3183098861837907;
const float RECIPROCAL_PI2 = 0.15915494309189535;

void main() {
  vec3 worldDirection = normalize(vWorldDirection);
  float c = cos(azimuthRotation);
  float s = sin(azimuthRotation);
  vec2 horizontalDirection = vec2(
    c * worldDirection.x - s * worldDirection.y,
    s * worldDirection.x + c * worldDirection.y
  );
  vec3 textureDirection = normalize(vec3(
    horizontalDirection.x,
    worldDirection.z,
    -horizontalDirection.y
  ));
  vec2 sampleUV = vec2(
    atan(textureDirection.z, textureDirection.x) * RECIPROCAL_PI2 + 0.5,
    asin(clamp(textureDirection.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5
  );
  vec4 texColor = texture2D(skyMap, sampleUV);
  gl_FragColor = vec4(texColor.rgb * intensity, texColor.a);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class S100NasaViewer {
  readonly parent: HTMLElement | null;
  readonly config: S100NasaViewerConfig;

  private readonly scenes = new Set<S100Scene>();
  private readonly canvas: HTMLCanvasElement | null;
  private readonly renderContext: S100RenderContext | null;
  private readonly resizeObserver: ResizeObserver | null;
  private animationFrame: number | null = null;
  private destroyed = false;

  private constructor(
    parent: HTMLElement | null,
    config: S100NasaViewerConfig,
    canvas: HTMLCanvasElement | null,
    renderContext: S100RenderContext | null,
    resizeObserver: ResizeObserver | null,
  ) {
    this.parent = parent;
    this.config = config;
    this.canvas = canvas;
    this.renderContext = renderContext;
    this.resizeObserver = resizeObserver;
  }

  static async create(
    parent: HTMLElement | null,
    config: S100NasaViewerConfig = {},
  ): Promise<S100NasaViewer> {
    const canvas = createCanvas(parent);
    const renderContext = await createRenderContext(parent, canvas, config);
    const viewer = new S100NasaViewer(
      parent,
      config,
      canvas,
      renderContext.renderContext,
      renderContext.resizeObserver,
    );
    viewer.startRendering();
    return viewer;
  }

  initialized(): Promise<boolean> {
    return Promise.resolve(!this.destroyed);
  }

  createScene(options: S100SceneOptions = {}): Promise<S100Scene> {
    this.assertActive();

    const scene = new S100Scene(options, this.renderContext);
    this.scenes.add(scene);
    return Promise.resolve(scene);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    for (const scene of this.scenes) {
      scene.destroy();
    }

    this.scenes.clear();
    if (this.animationFrame !== null) {
      globalThis.cancelAnimationFrame?.(this.animationFrame);
      this.animationFrame = null;
    }
    this.resizeObserver?.disconnect();
    if (this.renderContext?.renderer) {
      this.renderContext.renderer.dispose();
      this.renderContext.renderer.forceContextLoss();
    }
    this.renderContext?.skyDome?.geometry.dispose();
    const skyDomeMaterial = this.renderContext?.skyDome?.material;
    if (Array.isArray(skyDomeMaterial)) {
      for (const material of skyDomeMaterial) {
        material.dispose();
      }
    } else {
      skyDomeMaterial?.dispose();
    }
    this.renderContext?.environmentMap?.dispose();
    this.renderContext?.backgroundMap?.dispose();
    this.canvas?.remove();
    this.destroyed = true;
  }

  get element(): HTMLCanvasElement | null {
    return this.canvas;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new Error("Cannot use a destroyed S100NasaViewer.");
    }
  }

  private startRendering(): void {
    if (!this.renderContext) {
      return;
    }

    const render = () => {
      if (this.destroyed || !this.renderContext) {
        return;
      }

      for (const scene of this.scenes) {
        scene.updateBeforeRender();
      }

      this.renderContext.skyDome?.position.copy(this.renderContext.camera.position);
      this.renderContext.renderer.render(
        this.renderContext.scene,
        this.renderContext.camera,
      );
      this.animationFrame = globalThis.requestAnimationFrame?.(render) ?? null;
    };

    render();
  }
}

function createCanvas(parent: HTMLElement | null): HTMLCanvasElement | null {
  const doc = parent?.ownerDocument ?? globalThis.document;
  if (!parent || !doc?.createElement) {
    return null;
  }

  const canvas = doc.createElement("canvas");
  canvas.dataset.s100NasaViewer = "true";
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.minWidth = "1px";
  canvas.style.minHeight = "1px";
  canvas.style.touchAction = "none";
  parent.appendChild(canvas);
  return canvas;
}

async function createRenderContext(
  parent: HTMLElement | null,
  canvas: HTMLCanvasElement | null,
  config: S100NasaViewerConfig,
): Promise<{
  renderContext: S100RenderContext | null;
  resizeObserver: ResizeObserver | null;
}> {
  if (!parent || !canvas) {
    return {
      renderContext: null,
      resizeObserver: null,
    };
  }

  try {
    const renderer = new WebGLRenderer({
      antialias: true,
      canvas,
      alpha: false,
    });
    renderer.setClearColor(new Color(0x102033), 1);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;

    const scene = new Scene();
    scene.background = new Color(0x102033);
    scene.backgroundIntensity = normalizePositiveNumber(
      config.backgroundIntensity,
      DEFAULT_BACKGROUND_INTENSITY,
    );
    scene.environmentIntensity = normalizePositiveNumber(
      config.environmentIntensity,
      DEFAULT_ENVIRONMENT_INTENSITY,
    );
    const backgroundRotationX = normalizeFiniteNumber(
      config.backgroundRotationX,
      Z_UP_BACKGROUND_ROTATION_X,
    );
    const backgroundRotationY = normalizeFiniteNumber(
      config.backgroundRotationY,
      Z_UP_BACKGROUND_ROTATION_Y,
    );
    const backgroundRotationZ = normalizeFiniteNumber(
      config.backgroundRotationZ,
      Z_UP_BACKGROUND_ROTATION_Z,
    );
    const environmentRotationX = normalizeFiniteNumber(
      config.environmentRotationX,
      Z_UP_ENVIRONMENT_ROTATION_X,
    );
    const environmentRotationY = normalizeFiniteNumber(
      config.environmentRotationY,
      Z_UP_ENVIRONMENT_ROTATION_Y,
    );
    const environmentRotationZ = normalizeFiniteNumber(
      config.environmentRotationZ,
      Z_UP_ENVIRONMENT_ROTATION_Z,
    );
    scene.backgroundRotation.set(
      backgroundRotationX,
      backgroundRotationY,
      backgroundRotationZ,
    );
    scene.environmentRotation.set(
      environmentRotationX,
      environmentRotationY,
      environmentRotationZ,
    );
    scene.add(
      new AmbientLight(
        0xffffff,
        normalizePositiveNumber(
          config.ambientLightIntensity,
          DEFAULT_AMBIENT_LIGHT_INTENSITY,
        ),
      ),
    );

    const directionalLight = new DirectionalLight(
      0xffffff,
      normalizePositiveNumber(
        config.directionalLightIntensity,
        DEFAULT_DIRECTIONAL_LIGHT_INTENSITY,
      ),
    );
    directionalLight.position.set(150, -200, 300);
    scene.add(directionalLight);

    const grid = new GridHelper(2000, 40, 0x6fb4ff, 0x274e66);
    grid.rotateX(Math.PI / 2);
    scene.add(grid);
    scene.add(new AxesHelper(350));

    const camera = new PerspectiveCamera(
      normalizeFieldOfViewDegrees(config.fieldOfViewDegrees),
      1,
      0.1,
      100_000,
    );
    camera.up.set(0, 0, 1);
    camera.position.set(700, -900, 550);
    camera.lookAt(0, 0, 0);

    const resize = () => {
      const { width, height } = getCanvasSize(parent, canvas);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(parent);

    const environmentMaps = await loadEnvironmentMap(renderer, scene, config);

    return {
      renderContext: {
        backgroundMap: environmentMaps.backgroundMap,
        canvas,
        camera,
        environmentMap: environmentMaps.environmentMap,
        renderer,
        scene,
        skyDome: environmentMaps.skyDome,
      },
      resizeObserver,
    };
  } catch (error) {
    config.logger?.error?.("Failed to initialize NASA-AMMOS WebGL renderer", error);
    return {
      renderContext: null,
      resizeObserver: null,
    };
  }
}

async function loadEnvironmentMap(
  renderer: WebGLRenderer,
  scene: Scene,
  config: S100NasaViewerConfig,
): Promise<{
  environmentMap: Texture | null;
  backgroundMap: Texture | null;
  skyDome: Mesh | null;
}> {
  if (!config.environmentMapURL) {
    return {
      environmentMap: null,
      backgroundMap: null,
      skyDome: null,
    };
  }

  const pmremGenerator = new PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  try {
    const sourceTexture = await new RGBELoader().loadAsync(
      config.environmentMapURL,
    );
    sourceTexture.mapping = EquirectangularReflectionMapping;
    const environmentMap = pmremGenerator.fromEquirectangular(sourceTexture)
      .texture;
    scene.environment = environmentMap;
    if (config.showEnvironmentBackground !== false) {
      const skyDome = createSkyDome(sourceTexture, scene, config);
      return {
        environmentMap,
        backgroundMap: sourceTexture,
        skyDome,
      };
    }

    sourceTexture.dispose();
    return {
      environmentMap,
      backgroundMap: null,
      skyDome: null,
    };
  } catch (error) {
    config.logger?.warn?.(
      "Failed to load NASA-AMMOS HDR environment map",
      config.environmentMapURL,
      error,
    );
    return {
      environmentMap: null,
      backgroundMap: null,
      skyDome: null,
    };
  } finally {
    pmremGenerator.dispose();
  }
}

function createSkyDome(
  texture: Texture,
  scene: Scene,
  config: S100NasaViewerConfig,
): Mesh {
  const geometry = new SphereGeometry(SKYDOME_RADIUS_METERS, 64, 32);
  const material = new ShaderMaterial({
    name: "S100ZUpSkyDomeMaterial",
    uniforms: {
      skyMap: { value: texture },
      intensity: {
        value: normalizePositiveNumber(
          config.backgroundIntensity,
          DEFAULT_BACKGROUND_INTENSITY,
        ),
      },
      azimuthRotation: {
        value: normalizeFiniteNumber(
          config.backgroundRotationZ,
          Z_UP_BACKGROUND_ROTATION_Z,
        ),
      },
    },
    vertexShader: SKYDOME_VERTEX_SHADER,
    fragmentShader: SKYDOME_FRAGMENT_SHADER,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });

  const skyDome = new Mesh(geometry, material);
  skyDome.name = "s100-environment-skydome";
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -10_000;
  scene.add(skyDome);

  return skyDome;
}

function getCanvasSize(
  parent: HTMLElement,
  canvas: HTMLCanvasElement,
): { width: number; height: number } {
  const parentRect = parent.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const width =
    Math.floor(parentRect.width || canvasRect.width || parent.clientWidth) ||
    DEFAULT_CANVAS_WIDTH;
  const height =
    Math.floor(parentRect.height || canvasRect.height || parent.clientHeight) ||
    DEFAULT_CANVAS_HEIGHT;

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function normalizeFieldOfViewDegrees(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_FIELD_OF_VIEW_DEGREES;
  }

  return Math.min(
    MAX_FIELD_OF_VIEW_DEGREES,
    Math.max(MIN_FIELD_OF_VIEW_DEGREES, value),
  );
}

function normalizePositiveNumber(
  value: number | undefined,
  fallback: number,
): number {
  return value === undefined || !Number.isFinite(value) || value < 0
    ? fallback
    : value;
}

function normalizeFiniteNumber(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : value;
}
