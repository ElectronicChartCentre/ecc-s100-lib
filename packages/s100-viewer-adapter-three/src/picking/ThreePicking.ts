import type { PickRequest, PickResult, LivePickingOptions } from "@ecc/s100-viewer";
import * as THREE from "three";
import type { LayerRegistry } from "../layers/LayerRegistry.js";
import {
  worldToProjectedCoordinate,
  type ThreeProjectedLocalReference,
} from "../coordinates/projectedLocal.js";

export class ThreePicking {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private liveMode: LivePickingOptions = { enabled: false };

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly layers: LayerRegistry,
    private readonly reference: ThreeProjectedLocalReference,
    private readonly getSeaLevel: () => number,
  ) {}

  setLiveMode(options: LivePickingOptions): void {
    this.liveMode = options;
  }

  getLiveMode(): LivePickingOptions {
    return this.liveMode;
  }

  pick(request: PickRequest): PickResult | null {
    this.setRay(request.screenX, request.screenY);
    const intersections = this.raycaster.intersectObjects(this.layers.getPickableObjects(), true);
    const hit = intersections[0];
    if (hit) {
      const metadata = this.pickMetadata(hit.object);
      return {
        screen: { x: request.screenX, y: request.screenY },
        world: worldToProjectedCoordinate(hit.point, this.reference),
        source: metadata.source ?? "geometry",
        ...(metadata.product !== undefined ? { product: metadata.product } : {}),
        ...(metadata.layerId !== undefined ? { layerId: metadata.layerId } : {}),
        ...(metadata.featureId !== undefined ? { featureId: metadata.featureId } : {}),
        ...(request.includeNative ? { native: hit } : {}),
      };
    }

    if (request.fallback === "sea-level-plane") {
      return this.pickSeaLevelPlane(request);
    }

    return null;
  }

  destroy(): void {
    // No persistent browser listeners are registered here.
  }

  private setRay(screenX: number, screenY: number): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((screenY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pickSeaLevelPlane(request: PickRequest): PickResult | null {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.getSeaLevel());
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, point)) {
      return null;
    }
    return {
      screen: { x: request.screenX, y: request.screenY },
      world: worldToProjectedCoordinate(point, this.reference),
      source: "sea-level-plane",
      depthMeters: 0,
    };
  }

  private pickMetadata(object: THREE.Object3D): {
    source?: PickResult["source"];
    product?: string;
    layerId?: string;
    featureId?: string;
  } {
    let cursor: THREE.Object3D | null = object;
    while (cursor) {
      const data = cursor.userData as Record<string, unknown>;
      if (data.layerId || data.featureId || data.product) {
        const metadata: {
          source?: PickResult["source"];
          product?: string;
          layerId?: string;
          featureId?: string;
        } = {
          source: typeof data.pickSource === "string"
            ? data.pickSource as PickResult["source"]
            : "geometry",
        };
        if (typeof data.product === "string") {
          metadata.product = data.product;
        }
        if (typeof data.layerId === "string") {
          metadata.layerId = data.layerId;
        }
        if (typeof data.featureId === "string") {
          metadata.featureId = data.featureId;
        }
        return metadata;
      }
      cursor = cursor.parent;
    }
    return {};
  }
}
