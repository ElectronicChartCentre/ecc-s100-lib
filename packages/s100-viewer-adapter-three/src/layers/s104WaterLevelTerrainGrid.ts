import {
  createS104WaterLevelFieldGrid,
  projectS104WaterLevelFieldGrid,
  type WaterLevelFieldState,
} from "@ecc/s100-viewer";
import type { S100TerrainWaterLevelGridUniformState } from "@ecc/s100-viewer/internal/products/s102TerrainShading";
import * as THREE from "three";
import type { ThreeProjectedLocalReference } from "../coordinates/projectedLocal.js";

export type ThreeWaterLevelTerrainGrid = {
  key: string;
  texture: THREE.DataTexture;
  uniforms: S100TerrainWaterLevelGridUniformState;
};

export const createThreeWaterLevelTerrainGrid = (
  state: WaterLevelFieldState | null,
  time: Date,
  reference: ThreeProjectedLocalReference,
): ThreeWaterLevelTerrainGrid | null => {
  if (!state?.sampler) {
    return null;
  }

  const grid = createS104WaterLevelFieldGrid({
    sampler: state.sampler,
    time,
  });
  if (!grid) {
    return null;
  }

  const projected = projectS104WaterLevelFieldGrid(grid, reference.crs);
  if (!projected) {
    return null;
  }

  const texture = new THREE.DataTexture(
    projected.values,
    projected.width,
    projected.height,
    THREE.RedFormat,
    THREE.FloatType,
  );
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  return {
    key: [
      projected.datasetId,
      projected.timeIndex,
      projected.sourceTime.getTime(),
      projected.crs,
      projected.width,
      projected.height,
    ].join(":"),
    texture,
    uniforms: {
      texture,
      width: projected.width,
      height: projected.height,
      noDataValue: projected.noDataValue,
      originX: projected.origin.x - reference.origin.x,
      originY: projected.origin.y - reference.origin.y,
      longitudinalX: projected.offsetVectors.longitudinal[0],
      longitudinalY: projected.offsetVectors.longitudinal[1],
      latitudinalX: projected.offsetVectors.latitudinal[0],
      latitudinalY: projected.offsetVectors.latitudinal[1],
    },
  };
};
