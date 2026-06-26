import { describe, expect, it } from "vitest";
import {
  assertServiceReadyLayerSpec,
  defineS100LayerSpec,
  getLayerDisplayTitle,
  isServiceReadySource,
  LayerBuilder,
  S100SupportedProductVersions,
  S100ProductSpecificationVersions,
  S100ProductType,
  type S102LayerSpec,
  type S100ProductLayerSpec,
} from "../src/index.js";

describe("@ecc/s100-viewer product specs", () => {
  it("publishes the library-supported S-100 product specification versions", () => {
    expect(S100SupportedProductVersions).toEqual([
      {
        product: S100ProductType.S101,
        versions: [S100ProductSpecificationVersions.S101.LATEST_CONFIRMED_SUPPORTED],
        defaultVersion: S100ProductSpecificationVersions.S101.LATEST_CONFIRMED_SUPPORTED,
      },
      {
        product: S100ProductType.S102,
        versions: [S100ProductSpecificationVersions.S102.LATEST_CONFIRMED_SUPPORTED],
        defaultVersion: S100ProductSpecificationVersions.S102.LATEST_CONFIRMED_SUPPORTED,
      },
      {
        product: S100ProductType.S111,
        versions: [S100ProductSpecificationVersions.S111.LATEST_CONFIRMED_SUPPORTED],
        defaultVersion: S100ProductSpecificationVersions.S111.LATEST_CONFIRMED_SUPPORTED,
      },
    ]);
  });

  it("expresses S-102 bathymetry as 3D Tiles with depth styling", () => {
    const spec = defineS100LayerSpec({
      id: "s102-main",
      product: S100ProductType.S102,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
        crs: "EPSG:32633",
        verticalDatum: "LAT",
      },
      style: {
        unsafeDepth: -7.5,
        contours: { visible: true, intervalMeters: 5 },
        depthColors: "s102-depth-default",
        shading: "lit",
      },
    });

    assertServiceReadyLayerSpec(spec);

    expect(spec.product).toBe("S-102");
    expect(spec.source.kind).toBe("3d-tiles");
    expect(spec.style?.contours?.intervalMeters).toBe(5);
  });

  it("expresses S-111 currents as adapted REST JSON with temporal styling", () => {
    const spec = defineS100LayerSpec({
      id: "s111-currents",
      product: S100ProductType.S111,
      source: {
        kind: "rest-json",
        url: "/S111/stavanger.json",
        crs: "EPSG:32633",
      },
      time: {
        interpolation: "linear",
      },
      style: {
        renderer: "arrows",
        glyph: "arrow",
        speedScale: "auto",
        colorRamp: "s111-default",
      },
      metadata: {
        title: "Surface currents",
      },
    });

    expect(isServiceReadySource(spec.source)).toBe(true);
    expect(getLayerDisplayTitle(spec)).toBe("Surface currents");
  });

  it("keeps layer specs discriminated by product", () => {
    const specs: S100ProductLayerSpec[] = [
      {
        id: "s101-overlay",
        product: S100ProductType.S101,
        category: "enc",
        standard: S100ProductType.S101,
        source: {
          kind: "wms",
          url: "https://example.test/wms",
          layers: ["s101"],
          transparent: true,
        },
        role: "overlay",
      },
      {
        id: "s57-basemap",
        product: "S-57",
        category: "enc",
        standard: "S-57",
        source: {
          kind: "wms",
          url: "https://example.test/s57/wms",
          layers: ["s57"],
          transparent: true,
        },
        role: "basemap",
      },
      {
        id: "vessel",
        product: "vessel",
        source: {
          kind: "model",
          url: "/assets/vessel.glb",
          format: "glb",
        },
        pose: {
          position: {
            kind: "projected",
            x: 500000,
            y: 7000000,
            z: 0,
            crs: "EPSG:32633",
          },
          headingDegrees: 12,
        },
      },
    ];

    const products = specs.map((spec) => {
      switch (spec.product) {
        case S100ProductType.S101:
        case "S-57":
          return `${spec.standard}:${spec.source.kind}:${spec.role}`;
        case "vessel":
          return `${spec.product}:${spec.source.format}:${spec.pose.headingDegrees}`;
        default:
          return spec.product;
      }
    });

    expect(products).toEqual(["S-101:wms:overlay", "S-57:wms:basemap", "vessel:glb:12"]);
  });

  it("builds S-102 layers without product, source kind, or style boilerplate", () => {
    const spec: S102LayerSpec = LayerBuilder.createS102({
      url: "https://example.test/s102/tileset.json",
      crs: "EPSG:32633",
    });

    expect(spec).toMatchObject({
      id: "s102-bathymetry",
      product: "S-102",
      productSpecificationVersion:
        S100ProductSpecificationVersions.S102.LATEST_CONFIRMED_SUPPORTED,
      source: {
        kind: "3d-tiles",
        url: "https://example.test/s102/tileset.json",
        crs: "EPSG:32633",
      },
      style: LayerBuilder.S102Styles.DEFAULT,
    });
  });

  it("allows explicit product specification versions for future edition-specific rendering", () => {
    const spec = LayerBuilder.createS111({
      url: "/currents.json",
      productSpecificationVersion: "INT.IHO.S-111.1.0",
    });

    expect(spec.product).toBe(S100ProductType.S111);
    expect(spec.productSpecificationVersion).toBe("INT.IHO.S-111.1.0");
  });

  it("merges S-102 builder style overrides with nested defaults", () => {
    const spec = LayerBuilder.createS102({
      id: "s102-main",
      url: "/tileset.json",
      style: {
        contours: {
          visible: false,
        },
        unsafeDepth: 12,
      },
    });

    expect(spec.id).toBe("s102-main");
    expect(spec.style?.unsafeDepth).toBe(12);
    expect(spec.style?.contours).toEqual({
      ...LayerBuilder.S102Styles.DEFAULT.contours,
      visible: false,
    });
    expect(spec.style?.depthColors).toBe("s102-depth-default");
  });

  it("builds common ENC, IHO, simulated water-level, vessel, and map overlay layers", () => {
    const s101 = LayerBuilder.createS101Wms({
      url: "https://example.test/wms",
      layers: ["s100dataSets.101"],
      crs: "EPSG:32633",
    });
    const s57 = LayerBuilder.createS57Wms({
      url: "https://example.test/s57/wms",
      layers: ["enc_cells"],
      crs: "EPSG:32633",
      role: "basemap",
      style: {
        legacyDisplayMode: "custom",
      },
    });
    const s111 = LayerBuilder.createS111({
      url: "/currents.json",
      crs: "EPSG:32633",
      time: {
        interpolation: "nearest",
      },
    });
    const simulatedWaterLevel = LayerBuilder.createStaticSimulatedWaterLevel({
      data: { waterLevels: [] },
      crs: "EPSG:32633",
    });
    const vessel = LayerBuilder.createVessel({
      url: "/assets/vessel.glb",
      pose: {
        position: {
          kind: "projected",
          x: 500000,
          y: 7000000,
          z: 0,
          crs: "EPSG:32633",
        },
      },
      dimensions: {
        draught: 8,
        bow: 40,
        stern: 30,
        port: 10,
        starboard: 12,
      },
      referencePoint: "transponder",
    });
    const mapOverlay = LayerBuilder.createMapOverlayWms({
      url: "https://example.test/map",
      layers: ["annotations"],
    });

    expect(s101).toMatchObject({
      id: "s101-enc",
      product: "S-101",
      category: "enc",
      standard: "S-101",
      productSpecificationVersion:
        S100ProductSpecificationVersions.S101.LATEST_CONFIRMED_SUPPORTED,
      role: "overlay",
      source: { kind: "wms", transparent: true },
      style: LayerBuilder.S101Styles.DEFAULT,
    });
    expect(s57).toMatchObject({
      id: "s57-enc",
      product: "S-57",
      category: "enc",
      standard: "S-57",
      role: "basemap",
      source: { kind: "wms", transparent: true },
      style: {
        ...LayerBuilder.S57Styles.DEFAULT,
        legacyDisplayMode: "custom",
      },
    });
    expect(s111).toMatchObject({
      id: "s111-currents",
      product: "S-111",
      productSpecificationVersion:
        S100ProductSpecificationVersions.S111.LATEST_CONFIRMED_SUPPORTED,
      source: { kind: "rest-json" },
      style: LayerBuilder.S111Styles.DEFAULT,
    });
    expect(simulatedWaterLevel).toMatchObject({
      id: "simulated-water-level",
      product: "simulated-water-level",
      source: { kind: "static-json" },
      style: LayerBuilder.SimulatedWaterLevelStyles.DEFAULT,
    });
    expect(vessel).toMatchObject({
      id: "vessel",
      product: "vessel",
      source: { kind: "model", format: "glb" },
      dimensions: {
        draught: 8,
        bow: 40,
        stern: 30,
        port: 10,
        starboard: 12,
      },
      referencePoint: "transponder",
      style: LayerBuilder.VesselStyles.DEFAULT,
    });
    expect(mapOverlay).toMatchObject({
      id: "map-overlay",
      product: "map-overlay",
      role: "overlay",
      source: { kind: "wms", transparent: true },
      style: LayerBuilder.MapOverlayStyles.DEFAULT,
    });
  });
});
