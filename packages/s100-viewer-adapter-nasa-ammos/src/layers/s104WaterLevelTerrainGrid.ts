import {
  createS104WaterLevelFieldGrid,
  projectS104WaterLevelFieldGrid,
  type WaterLevelFieldState,
} from "@ecc/s100-viewer";
import type { S100TerrainWaterLevelGridUniformState } from "@ecc/s100-viewer/internal/products/s102TerrainShading";
import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  NearestFilter,
  RedFormat,
} from "three";
import type { NasaSceneGeoreference } from "../adapter/layerNativeTypes.js";

export type NasaWaterLevelTerrainGrid = {
  key: string;
  texture: DataTexture;
  uniforms: S100TerrainWaterLevelGridUniformState;
};

export const createNasaWaterLevelTerrainGrid = (
  state: WaterLevelFieldState | null,
  time: Date,
  georeference: NasaSceneGeoreference,
): NasaWaterLevelTerrainGrid | null => {
  if (!state?.sampler || !georeference.crs) {
    return null;
  }

  const grid = createS104WaterLevelFieldGrid({
    sampler: state.sampler,
    time,
  });
  if (!grid) {
    return null;
  }

  const projected = projectS104WaterLevelFieldGrid(grid, georeference.crs);
  if (!projected) {
    return null;
  }

  const texture = new DataTexture(
    new Float32Array(projected.values),
    projected.width,
    projected.height,
    RedFormat,
    FloatType,
  );
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  const origin = georeference.origin ?? { x: 0, y: 0, z: 0 };
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
      originX: projected.origin.x - origin.x,
      originY: projected.origin.y - origin.y,
      longitudinalX: projected.offsetVectors.longitudinal[0],
      longitudinalY: projected.offsetVectors.longitudinal[1],
      latitudinalX: projected.offsetVectors.latitudinal[0],
      latitudinalY: projected.offsetVectors.latitudinal[1],
    },
  };
};
