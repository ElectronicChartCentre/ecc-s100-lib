import { describe, expect, it } from "vitest";
import { CameraControlPresets, createS100Viewer, LayerBuilder, SceneBuilder } from "@ecc/s100-viewer";
import {
  cesiumAdapterCapabilities,
  createCesiumAdapter,
} from "../src/index.js";
import {
  createMockCesium,
  createMockContainer,
  dispatchScreenSpace,
} from "./fixtures/mockCesium.js";

describe("@ecc/s100-viewer-adapter-cesium vessel layer", () => {
  it("converts true-north vessel headings to Cesium heading-pitch-roll", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });

    const vessel = await scene.layers.add(
      LayerBuilder.createVessel({
        url: "/assets/vessel.glb",
        pose: {
          position: {
            kind: "projected",
            crs: "EPSG:32619",
            x: 331100,
            y: 5186420,
            z: 0,
          },
          headingDegrees: 0,
        },
        dimensions: { draught: 12, bow: 195.2, stern: 30, port: 20.8, starboard: 11.2 },
        referencePoint: "transponder",
        extensions: {
          nasaAmmos: {
            model: {
              boundingBox: {
                min: [-20.8, -30, -40.2],
                max: [11.2, 195.2, 6.4],
              },
            },
          },
        },
      }),
    );

    expect(cesium.operations.headingPitchRolls[0]).toMatchObject({ heading: 90, pitch: 0, roll: 0 });
    const vesselPosition = (cesium.operations.entitiesAdded[0] as {
      position?: { frame?: unknown; x?: number; y?: number; z?: number };
    }).position;
    expect(vesselPosition).toMatchObject({
      frame: "enu",
      x: 0,
      y: 0,
    });
    expect(vesselPosition?.z).toBeCloseTo(28.2);

    await vessel.update({
      pose: {
        position: {
          kind: "projected",
          crs: "EPSG:32619",
          x: 331100,
          y: 5186420,
          z: 0,
        },
        headingDegrees: 90,
      },
    });

    expect(cesium.operations.headingPitchRolls[1]).toMatchObject({ heading: 180, pitch: 0, roll: 0 });
    await viewer.destroy();
  });

  it("creates and patches Cesium vessel visual feature drawables", async () => {
    const cesium = createMockCesium();
    const viewer = await createS100Viewer({
      container: createMockContainer(),
      adapter: createCesiumAdapter({ cesiumModule: cesium }),
    });
    const scene = await viewer.createScene({
      georeference: SceneBuilder.projectedLocal({
        crs: "EPSG:32619",
        origin: { x: 331100, y: 5186420 },
      }),
    });

    const vessel = await scene.layers.add(
      LayerBuilder.createVessel({
        url: "/assets/vessel.glb",
        pose: {
          position: {
            kind: "projected",
            crs: "EPSG:32619",
            x: 331100,
            y: 5186420,
            z: 0,
          },
          headingDegrees: 45,
        },
        style: {
          oceanSurface: { enabled: true, radiusMeters: 80, opacity: 0.5, reflectivity: 0.4, roughness: 0.096 },
          shadow: { enabled: true, opacity: 0.25 },
          transformGizmo: {
            enabled: true,
            sizeMeters: 25,
            verticalPositionLimits: { minMeters: -30, maxMeters: 8 },
          },
        },
        dimensions: { draught: 12, bow: 195.2, stern: 30, port: 20.8, starboard: 11.2 },
        referencePoint: "transponder",
      }),
    );

    expect(cesium.operations.entitiesAdded).toHaveLength(1);
    const oceanSurfacePrimitive = cesium.operations.primitivesAdded.find((primitive) =>
      (primitive as {
        options?: {
          appearance?: {
            options?: {
              material?: { options?: { fabric?: { type?: string } } };
            };
          };
        };
      }).options?.appearance?.options?.material?.options?.fabric?.type === "S100VesselOceanSurface",
    ) as {
      options?: {
        modelMatrix?: unknown;
        geometryInstances?: {
          geometry?: { attributes?: { position?: { values?: Float64Array } } };
        };
        appearance?: {
          options?: {
            material?: {
              options?: {
                fabric?: {
                  uniforms?: Record<string, unknown>;
                  source?: string;
                };
              };
            };
          };
        };
      };
    };
    expect(oceanSurfacePrimitive).toBeDefined();
    expect(oceanSurfacePrimitive.options?.modelMatrix).toMatchObject({ kind: "multiply" });
    const oceanSurfacePositions =
      oceanSurfacePrimitive.options?.geometryInstances?.geometry?.attributes?.position?.values ?? new Float64Array();
    expect(Array.from(oceanSurfacePositions.slice(0, 6))).toEqual([0, 0, 0, 80, 0, 0]);
    expect(Math.hypot(oceanSurfacePositions[3] ?? 0, oceanSurfacePositions[4] ?? 0)).toBeCloseTo(80);
    expect(oceanSurfacePrimitive.options?.appearance?.options?.material?.options?.fabric?.source)
      .toContain("s100WaterWaveHeight");
    expect(oceanSurfacePrimitive.options?.appearance?.options?.material?.options?.fabric?.source)
      .toContain("czm_frameNumber");
    expect(oceanSurfacePrimitive.options?.appearance?.options?.material?.options?.fabric?.uniforms)
      .toMatchObject({
        u_s100WaterOpacity: 0.5,
        u_s100WaterRadiusMeters: 80,
        u_s100WaterReflectivity: 0.4,
        u_s100WaterRoughness: 0.096,
      });
    const oceanSurfaceOutline = cesium.operations.primitivesAdded.find((primitive) =>
      Array.isArray((primitive as { polylines?: unknown[] }).polylines) &&
      Boolean((primitive as { modelMatrix?: unknown }).modelMatrix),
    ) as { polylines?: Array<{ positions?: Array<{ x?: number; y?: number; z?: number }> }>; modelMatrix?: unknown };
    expect(oceanSurfaceOutline?.modelMatrix).toMatchObject({ kind: "multiply" });
    expect(oceanSurfaceOutline?.polylines?.[0]?.positions?.[0]).toMatchObject({ x: 80, y: 0, z: 0 });
    expect(cesium.operations.primitivesAdded.some((primitive) =>
      Boolean((primitive as { options?: { geometryInstances?: { options?: { attributes?: { color?: unknown } } } } })
        .options?.geometryInstances?.options?.attributes?.color),
    )).toBe(true);
    expect(cesium.operations.primitivesAdded.some((primitive) =>
      Array.isArray((primitive as { polylines?: unknown[] }).polylines),
    )).toBe(true);
    const sceneLayerUpdates: unknown[] = [];
    const layerChanges: unknown[] = [];
    scene.events.on("layer.updated", (layer) => {
      sceneLayerUpdates.push(layer.spec);
    });
    vessel.onChanged((layer) => {
      layerChanges.push(layer.spec);
    });
    const nativeVessel = vessel.getNativeHandle<{
      view?: {
        getPosition?: () => [number, number, number];
        getHeading?: () => number;
        positionChanged?: { subscribe?: (listener: (position: [number, number, number]) => void) => { unsubscribe(): void } };
      };
    }>();
    const positions: Array<[number, number, number]> = [];
    nativeVessel?.view?.positionChanged?.subscribe?.((position) => {
      positions.push(position);
    });
    const xGizmo = cesium.operations.primitivesAdded.find((primitive) =>
      (primitive as { __s100VesselGizmo?: { axis?: string } }).__s100VesselGizmo?.axis === "x",
    );
    expect(xGizmo).toBeDefined();
    cesium.operations.pickResult = { primitive: xGizmo };
    dispatchScreenSpace(cesium, "LEFT_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 145, y: 100 },
    });
    dispatchScreenSpace(cesium, "LEFT_UP", {});
    expect(nativeVessel?.view?.getPosition?.()[0]).toBeCloseTo(331125);
    expect(positions.at(-1)?.[0]).toBeCloseTo(331125);
    expect(((vessel.spec as { pose: { position: { x: number } } }).pose.position.x)).toBeCloseTo(331125);
    expect(((sceneLayerUpdates.at(-1) as { pose: { position: { x: number } } }).pose.position.x)).toBeCloseTo(331125);
    expect(((layerChanges.at(-1) as { pose: { position: { x: number } } }).pose.position.x)).toBeCloseTo(331125);
    expect(cesium.operations.cameraViews).toHaveLength(0);

    const zGizmo = cesium.operations.primitivesAdded.find((primitive) =>
      (primitive as { __s100VesselGizmo?: { axis?: string } }).__s100VesselGizmo?.axis === "z",
    );
    expect(zGizmo).toBeDefined();
    cesium.operations.pickResult = { primitive: zGizmo };
    dispatchScreenSpace(cesium, "LEFT_DOWN", {
      position: { x: 100, y: 100 },
    });
    dispatchScreenSpace(cesium, "MOUSE_MOVE", {
      endPosition: { x: 100, y: 10 },
    });
    dispatchScreenSpace(cesium, "LEFT_UP", {});
    expect(nativeVessel?.view?.getPosition?.()[2]).toBeCloseTo(8);
    expect(((vessel.spec as { pose: { position: { z: number } } }).pose.position.z)).toBeCloseTo(8);

    await vessel.update({
      style: {
        oceanSurface: false,
        shadow: false,
        transformGizmo: false,
      },
    });

    expect(cesium.operations.primitivesAdded).toHaveLength(0);
    await viewer.destroy();
  });
});
