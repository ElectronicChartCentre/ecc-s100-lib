import { describe, expect, it } from "vitest";
import {
  PerspectiveCamera,
  Scene,
  Texture,
} from "three";
import {
  FlatMapOverlay,
  type MapTextureLoaderLike,
  type MapOverlaySpecification,
} from "../src/runtime/map/FlatMapOverlay.js";

describe("FlatMapOverlay", () => {
  it("refines projected-local overlays using local scene coordinates", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(60, 1, 0.1, 10000);
    camera.position.set(0, 0, 1000);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const overlay = new FlatMapOverlay(
      createProjectedLocalMapSpecification(),
      scene,
      {
        camera,
        textureLoader: createImmediateTextureLoader(),
      },
    );

    expect(overlay.tiles).toHaveLength(1);
    expect(overlay.tiles[0]?.level).toBe(0);

    overlay.setVisible(true);

    expect(Math.max(...overlay.tiles.map((tile) => tile.level))).toBeGreaterThan(0);

    overlay.dispose();
  });
});

function createProjectedLocalMapSpecification(): MapOverlaySpecification {
  return {
    id: "s101",
    type: 2,
    corners: {
      upperLeft: [499500, 6500500],
      upperRight: [500500, 6500500],
      lowerLeft: [499500, 6499500],
      lowerRight: [500500, 6499500],
    },
    dataset: {
      mapSubset: {
        min: [0, 0],
        max: [1, 1],
      },
      extents: {
        minX: 499500,
        maxX: 500500,
        minY: 6499500,
        maxY: 6500500,
      },
      minLevel: 0,
      maxLevel: 3,
    },
    originOffset: [-500000, -6500000, 0],
    urlTemplate: "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&WIDTH=256&HEIGHT=256",
  };
}

function createImmediateTextureLoader(): MapTextureLoaderLike {
  return {
    load(_url, onLoad) {
      const texture = new Texture();
      onLoad?.(texture);
      return texture;
    },
  };
}
