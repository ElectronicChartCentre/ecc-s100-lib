# Parametric Vessel Workflow

Use parametric vessels when an application knows vessel dimensions and wants a
procedural vessel representation instead of a GLB/GLTF model.

The runnable tuning app is [`examples/parametric-vessel`](../../examples/parametric-vessel).

## Import Path

```ts
import {
  VesselFeatureSession,
  normalizeParametricVesselSpec,
  vesselDimensionsFromParametricVessel,
} from "@ecc/s100-viewer/products/vessel";
```

## Dimension Model

Vessels use the AIS-style distance model:

```ts
const dimensions = {
  draught: 8,
  bow: 90,
  stern: 20,
  port: 12,
  starboard: 12,
};
```

Overall length is `bow + stern`. Overall beam is `port + starboard`. The vessel
reference point is commonly the transponder or another operational reference.

## Minimal Parametric Vessel

```ts
const vessel = await VesselFeatureSession.add({
  scene,
  id: "pilot-vessel",
  parametric: {
    kind: "parametric",
    template: "cargo",
    dimensions,
  },
  pose: {
    position: {
      kind: "projected",
      crs: "EPSG:32633",
      x: 331100,
      y: 5186420,
      z: 0,
    },
    headingDegrees: 35,
  },
  referencePoint: "transponder",
  constraints: {
    vertical: {
      minMeters: -30,
      maxMeters: "draught",
      reference: "sea-level",
    },
  },
});

await vessel.setHeading(90);
await vessel.setOceanSurfaceVisible(true);
await vessel.dispose();
```

## When To Normalize First

Use normalization when UI controls or live data can produce partial or invalid
parametric specs:

```ts
const normalized = normalizeParametricVesselSpec(input);
const dimensions = vesselDimensionsFromParametricVessel(normalized);
```

The tuning app demonstrates this pattern by accepting control input, deriving
physical values, rebuilding the parametric vessel, and preserving pose.

## Failure Modes

- Negative or impossible dimensions should be normalized or rejected before
  adding the vessel.
- If a renderer cannot support parametric vessels, the adapter should report the
  missing source/product capability.
- Vertical constraints should be explicit for operational workflows where
  draught or sea level matters.

## Validation

```sh
npm run check:demo:parametric-vessel
npm run build:demo:parametric-vessel
```

