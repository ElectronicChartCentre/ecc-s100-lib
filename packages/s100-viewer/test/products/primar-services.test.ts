import { describe, expect, it, vi } from "vitest";
import {
  PrimarServices,
  createPrimarEncAvailabilityService,
  createPrimarS101EncWmsOptions,
  createPrimarS102TilesSource,
  createPrimarS57EncWmsOptions,
} from "../../src/index.js";

describe("PrimarServices", () => {
  it("creates an S-102 terrain source with CRS query defaults", () => {
    const source = createPrimarS102TilesSource({
      endpoint: "https://tiles.example/s102/",
      apiKey: "api-key",
      extraQuery: {
        debug: true,
      },
    });

    expect(source.urlForDatasetIds(["s102-a", "s102-b"], { crs: "EPSG:32633" })).toBe(
      "https://tiles.example/s102/api-key/s102-a,s102-b",
    );
    expect(source.queryForDatasetIds?.(["s102-a"], { crs: "EPSG:32633" })).toEqual({
      crs: "EPSG:32633",
      debug: true,
    });
  });

  it("creates S-101 WMS pair options with PRIMAR query defaults", () => {
    const options = createPrimarS101EncWmsOptions({
      licenseeKey: "license-key",
      center: {
        easting: 500000,
        northing: 7000000,
        epsgCrs: "EPSG:32633",
      },
      widthMeters: 1000,
      wmsBaseUrl: "https://wms.example/s101",
      pixelRatio: 2,
    });

    expect(options.center).toEqual({
      easting: 500000,
      northing: 7000000,
      epsgCrs: "EPSG:32633",
    });
    expect(options.transparent.urlTemplate).toContain("CELLPICKER=vesselFolio,license-key");
    expect(options.transparent.urlTemplate).toContain("LAYERS=s100dataSets.101");
    expect(options.transparent.urlTemplate).toContain("DPI=192");
    expect(options.transparent.urlTemplate).toContain("IGNORE=DepthArea,DepthContour,DredgedArea");
    expect(options.opaque?.urlTemplate).toContain("HIDE=90010,90020");
  });

  it("creates S-57 WMS pair options from the PRIMAR URL template path", () => {
    const options = createPrimarS57EncWmsOptions({
      licenseeKey: "license-key",
      center: {
        easting: 500000,
        northing: 7000000,
        epsgCrs: "EPSG:32633",
      },
      widthMeters: 1000,
      wmsBaseUrl: "https://wms.example/s57",
      wmsTemplatePath:
        "?bbox={xmin},{ymin},{xmax},{ymax}&SRS={crsParam}&CELLPICKER=vesselFolio,{licenseeId}&WIDTH={width}&HEIGHT={height}&STYLES={customStyleId}",
      customStyleId: "transparent-style",
      opaqueStyleId: "opaque-style",
      includeOpaqueLayer: true,
    });

    expect(options.transparent.urlTemplate).toBe(
      "https://wms.example/s57?bbox={xmin},{ymin},{xmax},{ymax}&SRS=EPSG:32633&CELLPICKER=vesselFolio,license-key&WIDTH=256&HEIGHT=256&STYLES=transparent-style",
    );
    expect(options.opaque?.urlTemplate).toBe(
      "https://wms.example/s57?bbox={xmin},{ymin},{xmax},{ymax}&SRS=EPSG:32633&CELLPICKER=vesselFolio,license-key&WIDTH=256&HEIGHT=256&STYLES=opaque-style",
    );
  });

  it("exposes the same helpers through the PrimarServices namespace", () => {
    expect(PrimarServices.s102Tiles).toBe(createPrimarS102TilesSource);
    expect(PrimarServices.s101EncWms).toBe(createPrimarS101EncWmsOptions);
    expect(PrimarServices.s57EncWms).toBe(createPrimarS57EncWmsOptions);
    expect(PrimarServices.encAvailability).toBe(createPrimarEncAvailabilityService);
  });

  it("creates an ENC availability service with PRIMAR defaults", async () => {
    const bounds = { west: 1, south: 2, east: 3, north: 4 };
    const getLicensedProductsWithinBounds = vi.fn().mockResolvedValue([
      { datasetId: "s101-a" },
    ]);
    const getValidProductTypes = vi.fn().mockResolvedValue([
      { id: 1 },
      { id: 102 },
    ]);
    const getS57WithinBounds = vi.fn().mockResolvedValue({ total: 2 });

    const availability = createPrimarEncAvailabilityService({
      getLicensedProductsWithinBounds,
      getValidProductTypes,
      getS57WithinBounds,
    });

    await expect(availability.hasS101(bounds, "license-key")).resolves.toBe(true);
    await expect(availability.hasS57Access("license-key")).resolves.toBe(true);
    await expect(availability.hasS57(bounds)).resolves.toBe(true);
    expect(getLicensedProductsWithinBounds).toHaveBeenCalledWith(
      "license-key",
      [101],
      bounds,
    );
    expect(getValidProductTypes).toHaveBeenCalledWith("license-key");
    expect(getS57WithinBounds).toHaveBeenCalledWith(bounds);
  });

  it("returns unavailable and reports PRIMAR request failures", async () => {
    const onError = vi.fn();
    const s101Error = new Error("no S-101");
    const s57AccessError = new Error("no product types");
    const availability = createPrimarEncAvailabilityService({
      getLicensedProductsWithinBounds: vi.fn().mockResolvedValue(s101Error),
      getValidProductTypes: vi.fn().mockRejectedValue(s57AccessError),
      getS57WithinBounds: vi.fn().mockResolvedValue({ total: 0 }),
      onError,
    });

    await expect(availability.hasS101({}, "license-key")).resolves.toBe(false);
    await expect(availability.hasS57Access("license-key")).resolves.toBe(false);
    await expect(availability.hasS57({})).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith("no S-101", s101Error);
    expect(onError).toHaveBeenCalledWith(
      "Failed to determine if licensee has access to S-57 products",
      s57AccessError,
    );
  });
});
