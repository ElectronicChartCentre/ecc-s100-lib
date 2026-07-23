import {
  type EngineHandleBundle,
  type EngineScene,
  type EngineViewerHost,
  type ViewerHostOptions,
  type SceneOptions,
} from "@ecc/s100-viewer";
import * as THREE from "three";
import type { ThreeAdapterOptions } from "../options.js";
import { getHtmlElement } from "../coordinates/projectedLocal.js";

export class ThreeViewerHost implements EngineViewerHost {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private activeScene: EngineScene | null = null;
  private animationFrameId: number | null = null;
  private destroyed = false;

  constructor(
    hostOptions: ViewerHostOptions,
    private readonly options: ThreeAdapterOptions,
  ) {
    this.container = getHtmlElement(hostOptions.container);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      ...options.rendererParameters,
    });
    this.renderer.setPixelRatio(options.pixelRatio ?? window.devicePixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.container.appendChild(this.renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.render = this.render.bind(this);
    this.animationFrameId = requestAnimationFrame(this.render);
  }

  getEngineHandles(): EngineHandleBundle {
    return {
      adapterId: "three",
      engineName: "Three.js Reference",
      engineVersion: `three r${THREE.REVISION}`,
      engineInstance: this.renderer,
      instances: {
        renderer: this.renderer,
        canvas: this.renderer.domElement,
      },
      staticObjects: {
        THREE,
      },
      resources: {
        threeDocs: "https://threejs.org/docs/",
        tilesRendererDocs: "https://github.com/NASA-AMMOS/3DTilesRendererJS",
      },
    };
  }

  async createScene(options: SceneOptions): Promise<EngineScene> {
    if (this.destroyed) {
      throw new Error("ThreeViewerHost is destroyed.");
    }
    if (this.activeScene) {
      await this.activeScene.dispose();
    }
    const { ThreeEngineScene } = await import("./ThreeEngineScene.js");
    const scene = new ThreeEngineScene(this.renderer, options, this.options);
    this.activeScene = scene;
    this.resize();
    return scene;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.resizeObserver.disconnect();
    if (this.activeScene) {
      await this.activeScene.dispose();
      this.activeScene = null;
    }
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }

  private resize(): void {
    if (this.destroyed) {
      return;
    }
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    const resizable = this.activeScene as { resize?: (width: number, height: number) => void } | null;
    resizable?.resize?.(width, height);
  }

  private render(): void {
    if (this.destroyed) {
      return;
    }
    this.animationFrameId = requestAnimationFrame(this.render);
    const renderable = this.activeScene as { render?: () => void } | null;
    renderable?.render?.();
  }
}
