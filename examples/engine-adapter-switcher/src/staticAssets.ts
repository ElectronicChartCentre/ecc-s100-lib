import type { EnvironmentState } from "@ecc/s100-viewer";

export const demoVesselModelUrl =
  "/demo-assets/vessel/panama-tanker-origin-at-transponder.glb";
export const demoEnvironmentUrl = "/demo-assets/environment/demo-environment.json";
export const demoNasaAmmosEnvironmentMapUrl =
  "/demo-assets/environment/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr";

export const loadDemoEnvironment = async (engineId?: string): Promise<EnvironmentState> => {
  const response = await fetch(demoEnvironmentUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load ${demoEnvironmentUrl}`);
  }
  const environment = await response.json() as EnvironmentState;
  if (engineId !== "nasa-ammos") {
    return environment;
  }

  const nasaEnvironment: EnvironmentState = {
    ...environment,
    skyboxUrl: demoNasaAmmosEnvironmentMapUrl,
    lighting: {
      ...environment.lighting,
      environmentMapUrl: demoNasaAmmosEnvironmentMapUrl,
    },
    metadata: {
      ...environment.metadata,
      environmentMapSource: "s100-explorer-webapp kloofendal HDRI",
    },
  };
  delete nasaEnvironment.skyboxFaces;
  return nasaEnvironment;
};
