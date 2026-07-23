import { describe, expect, it } from "vitest";
import { createThreeAdapter, threeAdapterCapabilities } from "../src/index.js";

describe("@ecc/s100-viewer-adapter-three capabilities", () => {
  it("exposes the reference adapter identity and capabilities from the package root", () => {
    const adapter = createThreeAdapter();

    expect(adapter.id).toBe("three");
    expect(adapter.displayName).toBe("Three.js Reference");
    expect(adapter.capabilities).toBe(threeAdapterCapabilities);
    expect(adapter.capabilities.sceneGeoreferences).toContain("projected-local");
    expect(adapter.capabilities.layerProducts).toEqual(
      expect.arrayContaining(["S-101", "S-102", "S-111", "vessel", "route-plan"]),
    );
    expect(adapter.capabilities.dataSources).toEqual(
      expect.arrayContaining(["wms-template", "3d-tiles", "static-json", "model"]),
    );
  });
});
