import { describe, expect, it } from "vitest";
import {
  assertServiceReadyLayerSpec,
  depthFromElevation,
  elevationFromDepth,
  getS102SafetyDepthMeters,
  defineS100LayerSpec,
  getLayerDisplayTitle,
  isServiceReadySource,
  LayerBuilder,
  ProjectedMap,
  mapSpecificationToLayerSpec,
  ProjectedMapDiscardMode,
  ProjectedMapLayerType,
  S100DataCodingFormat,
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
        safetyDepthMeters: 7.5,
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

  it("uses positive nautical depth while preserving z-up elevation conversion helpers", () => {
    expect(depthFromElevation(-8, 1.5)).toBe(9.5);
    expect(elevationFromDepth(9.5, 1.5)).toBe(-8);
    expect(getS102SafetyDepthMeters({ safetyDepthMeters: 6 })).toBe(6);
    expect(getS102SafetyDepthMeters({ unsafeDepth: -6 })).toBe(6);
  });

  it("normalizes legacy S-102 builder unsafe depth into safety depth", () => {
    const spec = LayerBuilder.createS102({
      url: "/s102/tileset.json",
      style: {
        unsafeDepth: -7,
      },
    });

    expect(spec.style?.safetyDepthMeters).toBe(7);
    expect(spec.style?.unsafeDepth).toBeUndefined();
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
      rendering: {
        detailFactor: 250,
      },
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
      rendering: {
        detailFactor: 250,
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
        safetyDepthMeters: 12,
      },
    });

    expect(spec.id).toBe("s102-main");
    expect(spec.style?.safetyDepthMeters).toBe(12);
    expect(spec.style?.contours).toEqual({
      ...LayerBuilder.S102Styles.DEFAULT.contours,
      visible: false,
    });
    expect(spec.style?.depthColors).toBe("s102-depth-default");
  });

  it("builds projected map templates from center and extent", () => {
    const template = ProjectedMap.fromCenterExtent({
      center: {
        easting: 500000,
        northing: 7000000,
        epsgCrs: "EPSG:32633",
      },
      widthMeters: 1000,
      scale: 2,
      discardMode: ProjectedMap.DiscardMode.None,
    });

    expect(template).toMatchObject({
      crs: "EPSG:32633",
      mapSubset: {
        min: [0, 0],
        max: [1, 1],
      },
      extents: {
        minX: 499000,
        maxX: 501000,
        minY: 6999000,
        maxY: 7001000,
        crs: "EPSG:32633",
      },
      minLevel: 0,
      maxLevel: 10,
      discardMode: ProjectedMapDiscardMode.None,
    });
  });

  it("builds transparent and opaque ENC WMS-template layer pairs", () => {
    const pair = LayerBuilder.createEncWmsPair({
      standard: LayerBuilder.EncStandard.S101,
      center: {
        x: 500000,
        y: 7000000,
        crs: "EPSG:32633",
      },
      widthMeters: 1000,
      transparent: {
        id: "s101-transparent",
        urlTemplate: "https://example.test/s101-transparent/{z}/{x}/{y}.png",
        visible: false,
      },
      opaque: {
        id: "s101-opaque",
        urlTemplate: "https://example.test/s101-opaque/{z}/{x}/{y}.png",
        scale: 4,
      },
    });

    expect(pair.transparent).toMatchObject({
      id: "s101-transparent",
      product: "S-101",
      role: "overlay",
      visible: false,
      projectedMap: {
        dataset: {
          extents: {
            minX: 499500,
            maxX: 500500,
          },
        },
      },
    });
    expect(pair.opaque).toMatchObject({
      id: "s101-opaque",
      product: "S-101",
      role: "basemap",
      projectedMap: {
        dataset: {
          extents: {
            minX: 498000,
            maxX: 502000,
          },
        },
      },
    });
  });

  it("builds WMS URL templates while preserving projected-map bbox tokens", () => {
    const urlTemplate = LayerBuilder.buildWmsUrlTemplate({
      baseUrl: "https://example.test/wms?existing=true",
      parameters: [
        ["bbox", "{xmin},{ymin},{xmax},{ymax}"],
        ["FORMAT", "image/png"],
        ["SERVICE", "WMS"],
        ["SRS", "EPSG:32633"],
        ["WIDTH", 256],
        ["HEIGHT", 256],
        ["TRANSPARENT", true],
        ["SKIP", null],
      ],
    });

    expect(urlTemplate).toBe(
      "https://example.test/wms?existing=true" +
        "&bbox={xmin},{ymin},{xmax},{ymax}" +
        "&FORMAT=image/png" +
        "&SERVICE=WMS" +
        "&SRS=EPSG:32633" +
        "&WIDTH=256" +
        "&HEIGHT=256" +
        "&TRANSPARENT=true",
    );
  });

  it("prepares static S-111 layers with derived timeline metadata", () => {
    const prepared = LayerBuilder.prepareStaticS111({
      id: "s111-prepared",
      data: {
        dateTimeOfFirstRecord: "20260529T120000Z",
        timeRecordInterval: 1800,
        numberOfTimes: 3,
      },
      crs: "EPSG:32633",
    });

    expect(prepared.layer).toMatchObject({
      id: "s111-prepared",
      product: "S-111",
      source: {
        kind: "static-json",
        crs: "EPSG:32633",
      },
    });
    expect(prepared.timeline).toEqual({
      startTime: Date.UTC(2026, 4, 29, 12, 0, 0),
      endTime: Date.UTC(2026, 4, 29, 13, 0, 0),
      stepSeconds: 1800,
      recordCount: 3,
      times: [
        Date.UTC(2026, 4, 29, 12, 0, 0),
        Date.UTC(2026, 4, 29, 12, 30, 0),
        Date.UTC(2026, 4, 29, 13, 0, 0),
      ],
    });
  });

  it("assesses S-111 metadata with app-ready acceptance and rejection reasons", () => {
    const accepted = LayerBuilder.assessS111Metadata({
      datasetId: "s111-accepted",
      maxDataPoints: 500,
      projectedBounds: {
        west: 0,
        east: 1000,
        south: 0,
        north: 500,
      },
      metadata: {
        dataCodingFormat: { value: S100DataCodingFormat.RegularGrid },
        instanceAttributes: [
          {
            numberOfTimes: 2,
            numPointsLongitudinal: 20,
            numPointsLatitudinal: 10,
          },
        ],
      },
    });

    expect(accepted).toMatchObject({
      status: "accepted",
      datasetId: "s111-accepted",
      numberOfCells: 200,
      numberOfDataPoints: 400,
      observedGridMeters: 50,
    });

    expect(
      LayerBuilder.assessS111Metadata({
        datasetId: "s111-too-large",
        maxDataPoints: 399,
        metadata: {
          dataCodingFormat: S100DataCodingFormat.RegularGrid,
          instanceAttributes: [
            {
              numberOfTimes: 2,
              numPointsLongitudinal: 20,
              numPointsLatitudinal: 10,
            },
          ],
        },
      }),
    ).toMatchObject({
      status: "rejected",
      code: "too-large",
      numberOfDataPoints: 400,
    });

    expect(
      LayerBuilder.assessS111Metadata({
        datasetId: "s111-unsupported",
        metadata: {
          dataCodingFormat: 9,
          instanceAttributes: [{ numberOfTimes: 1 }],
        },
      }),
    ).toMatchObject({
      status: "rejected",
      code: "unsupported-dcf",
      dataCodingFormat: 9,
    });
  });

  it("prepares static S-111 datasets with workflow defaults and summary metadata", () => {
    const first = LayerBuilder.prepareStaticS111Dataset({
      datasetId: "s111-first",
      data: {
        dateTimeOfFirstRecord: "20260529T120000Z",
        timeRecordInterval: 1800,
        numberOfTimes: 2,
      },
      crs: "EPSG:32633",
      observedGridMeters: 125,
    });
    const second = LayerBuilder.prepareStaticS111Dataset({
      datasetId: "s111-second",
      data: {
        dateTimeOfFirstRecord: "20260529T123000Z",
        timeRecordInterval: 900,
        numberOfTimes: 2,
      },
      crs: "EPSG:32633",
      observedGridMeters: 250,
      scale: 42,
    });

    expect(first.layer).toMatchObject({
      id: "s111-first",
      time: {
        interpolation: "nearest",
      },
      style: {
        renderer: "arrows",
        scale: "auto",
      },
    });
    expect(second.layer.style?.scale).toBe(42);
    expect(LayerBuilder.summarizePreparedS111Datasets([first, second])).toEqual({
      timeline: {
        startTime: Date.UTC(2026, 4, 29, 12, 0, 0),
        endTime: Date.UTC(2026, 4, 29, 12, 45, 0),
        stepSeconds: 900,
        times: [
          Date.UTC(2026, 4, 29, 12, 0, 0),
          Date.UTC(2026, 4, 29, 12, 30, 0),
          Date.UTC(2026, 4, 29, 12, 45, 0),
        ],
        initialTime: Date.UTC(2026, 4, 29, 12, 0, 0),
      },
      observedGrid: {
        minMeters: 125,
        maxMeters: 250,
      },
    });
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
      style: {
        transformGizmo: {
          enabled: true,
          mode: "translate",
          verticalPositionLimits: {
            minMeters: -30,
            maxMeters: 8,
            reference: "sea-level",
          },
        },
      },
    });
    const mapOverlay = LayerBuilder.createMapOverlayWms({
      url: "https://example.test/map",
      layers: ["annotations"],
    });
    const s101Template = LayerBuilder.createS101WmsTemplate({
      id: "s101-template",
      urlTemplate:
        "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&SRS=EPSG:32633",
      crs: "EPSG:32633",
      extents: {
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10,
        crs: "EPSG:32633",
      },
      minLevel: 2,
      maxLevel: 12,
      discardMode: ProjectedMapDiscardMode.MaskLayerAlphaZero,
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
      style: {
        ...LayerBuilder.VesselStyles.DEFAULT,
        transformGizmo: {
          enabled: true,
          mode: "translate",
          verticalPositionLimits: {
            minMeters: -30,
            maxMeters: 8,
            reference: "sea-level",
          },
        },
      },
    });
    expect(mapOverlay).toMatchObject({
      id: "map-overlay",
      product: "map-overlay",
      role: "overlay",
      source: { kind: "wms", transparent: true },
      style: LayerBuilder.MapOverlayStyles.DEFAULT,
    });
    expect(s101Template).toMatchObject({
      id: "s101-template",
      product: "S-101",
      source: {
        kind: "wms-template",
        crs: "EPSG:32633",
      },
      spatialExtent: {
        crs: "EPSG:32633",
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10,
      },
      projectedMap: {
        id: "s101-template",
        dataset: {
          minLevel: 2,
          maxLevel: 12,
        },
      },
      mapRendering: {
        discardMode: ProjectedMapDiscardMode.MaskLayerAlphaZero,
      },
    });
    expect(s101Template.projectedMap?.urlTemplate).toContain("bbox={xmin},{ymin},{xmax},{ymax}");
  });

  it("converts runtime map specifications into canonical ENC WMS-template layers", () => {
    const spec = mapSpecificationToLayerSpec(
      {
        id: "s57WMS",
        type: ProjectedMapLayerType.Base,
        encStandard: "S-57",
        corners: {
          upperLeft: [0, 10],
          upperRight: [10, 10],
          lowerLeft: [0, 0],
          lowerRight: [10, 0],
        },
        dataset: {
          mapSubset: {
            min: [0, 0],
            max: [10, 10],
          },
          extents: {
            minX: 0,
            minY: 0,
            maxX: 10,
            maxY: 10,
          },
          minLevel: 2,
          maxLevel: 12,
        },
        urlTemplate:
          "https://example.test/wms?bbox={xmin},{ymin},{xmax},{ymax}&SRS=EPSG:32633",
      },
      ProjectedMapDiscardMode.MaskLayerAlphaZero,
    );

    expect(spec).toMatchObject({
      id: "s57WMS",
      product: "S-57",
      category: "enc",
      standard: "S-57",
      role: "basemap",
      source: {
        kind: "wms-template",
        crs: "EPSG:32633",
      },
      spatialExtent: {
        crs: "EPSG:32633",
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10,
      },
      projectedMap: {
        id: "s57WMS",
        dataset: {
          minLevel: 2,
          maxLevel: 12,
        },
      },
      mapRendering: {
        discardMode: ProjectedMapDiscardMode.MaskLayerAlphaZero,
      },
    });
    expect(spec.projectedMap?.urlTemplate).toContain("bbox={xmin},{ymin},{xmax},{ymax}");
  });
});
