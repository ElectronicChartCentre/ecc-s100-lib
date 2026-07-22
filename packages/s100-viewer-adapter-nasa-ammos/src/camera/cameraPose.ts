import type { EngineCameraPose } from "@ecc/s100-viewer";

export const tupleCameraPoseToObjectPose = (pose: {
  position: [number, number, number];
  rotation: [number, number, number, number];
  focalDistance?: number;
}): EngineCameraPose => ({
  position: {
    x: pose.position[0],
    y: pose.position[1],
    z: pose.position[2],
  },
  rotation: {
    x: pose.rotation[0],
    y: pose.rotation[1],
    z: pose.rotation[2],
    w: pose.rotation[3],
  },
  ...(pose.focalDistance !== undefined ? { focalDistance: pose.focalDistance } : {}),
});
