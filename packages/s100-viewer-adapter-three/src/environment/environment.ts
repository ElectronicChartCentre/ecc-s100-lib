import type { EnvironmentState } from "@ecc/s100-viewer";
import * as THREE from "three";

export class ThreeEnvironmentController {
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  private readonly directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  private environmentTexture: THREE.Texture | null = null;
  private loadSerial = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly fallbackColor: number,
  ) {
    this.directionalLight.position.set(1, 2, 1);
    this.scene.add(this.ambientLight);
    this.scene.add(this.directionalLight);
    this.scene.background = new THREE.Color(this.fallbackColor);
  }

  setEnvironment(state: EnvironmentState): void {
    this.ambientLight.intensity = state.lighting?.ambientIntensity ?? 0.35;
    this.directionalLight.intensity = state.lighting?.directionalIntensity ?? 0.7;
    if (state.lighting?.sunDirection) {
      this.directionalLight.position.set(
        state.lighting.sunDirection.x,
        state.lighting.sunDirection.z,
        -state.lighting.sunDirection.y,
      );
    }

    if (state.background === "transparent") {
      this.scene.background = null;
      this.clearEnvironmentTexture();
      return;
    }

    if (state.background === "solid") {
      this.scene.background = new THREE.Color(this.fallbackColor);
      this.clearEnvironmentTexture();
      return;
    }

    if (state.skyboxFaces) {
      this.loadCubeTexture(state.skyboxFaces);
      return;
    }

    const skyboxUrl = state.skyboxUrl ?? state.lighting?.environmentMapUrl;
    if (skyboxUrl) {
      this.loadEquirectangularTexture(skyboxUrl);
      return;
    }

    this.scene.background = new THREE.Color(this.fallbackColor);
    this.clearEnvironmentTexture();
  }

  dispose(): void {
    this.clearEnvironmentTexture();
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);
  }

  private loadCubeTexture(faces: NonNullable<EnvironmentState["skyboxFaces"]>): void {
    const serial = ++this.loadSerial;
    const loader = new THREE.CubeTextureLoader();
    loader.load(
      [
        faces.positiveX,
        faces.negativeX,
        faces.positiveY,
        faces.negativeY,
        faces.positiveZ,
        faces.negativeZ,
      ],
      (texture) => {
        if (serial !== this.loadSerial) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        this.replaceEnvironmentTexture(texture);
      },
    );
  }

  private loadEquirectangularTexture(url: string): void {
    const serial = ++this.loadSerial;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(url, (texture) => {
      if (serial !== this.loadSerial) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.replaceEnvironmentTexture(texture);
    });
  }

  private replaceEnvironmentTexture(texture: THREE.Texture): void {
    this.clearEnvironmentTexture();
    this.environmentTexture = texture;
    this.scene.background = texture;
    this.scene.environment = texture;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
  }

  private clearEnvironmentTexture(): void {
    this.loadSerial += 1;
    if (this.environmentTexture) {
      this.environmentTexture.dispose();
      this.environmentTexture = null;
    }
    this.scene.environment = null;
  }
}
