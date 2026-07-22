export const releaseTargets = [
  {
    name: "@ecc/s100-viewer",
    directory: "packages/s100-viewer",
  },
  {
    name: "@ecc/s100-viewer-adapter-nasa-ammos",
    directory: "packages/s100-viewer-adapter-nasa-ammos",
  },
  {
    name: "@ecc/s100-viewer-adapter-cesium",
    directory: "packages/s100-viewer-adapter-cesium",
  },
];

export const releaseTargetNames = releaseTargets.map((target) => target.name);

