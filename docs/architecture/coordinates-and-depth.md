# Coordinates And Depth

This document defines coordinate and depth conventions for `ecc-s100-lib`.

## Coordinate Rule

Public controller APIs should use CRS-aware coordinates when values cross the
library boundary.

Good:

```ts
const position = vessel.getPosition();
```

where `position` includes coordinate mode and CRS metadata.

Avoid exposing raw engine-local tuples from public controller APIs unless the
method name explicitly states that it is returning engine-native data.

## Supported Coordinate Shapes

The core package owns these coordinate concepts:

- projected local
- geodetic
- ECEF
- engine local

Adapters may convert these into native engine coordinates internally, but that
conversion should remain behind adapter boundaries.

## Positive Depth Convention

Nautical charting convention treats increasing depth as increasing positive
meters below the water surface or datum. Public S-100 product APIs should follow
that convention.

Use:

```ts
safetyDepthMeters: 6
draughtMeters: 4.5
```

Avoid new public API fields that require callers to pass negative depths
because a rendering engine uses z-up coordinates.

## Engine Z-Up Conversion

Most local 3D rendering uses z-up coordinates. That is an engine concern.

The conversion should be named and centralized:

```ts
safetyDepthMeters -> zUpThresholdMeters
draughtMeters -> vessel vertical offset
seaLevelMeters -> render-space z offset
```

Do not duplicate sign conversions in UI code, product sessions, and adapter
renderers.

## Legacy Depth Fields

`unsafeDepth` exists only as compatibility-shaped input. New code should prefer
`safetyDepthMeters`.

Rules:

- builders may normalize legacy `unsafeDepth`
- controllers should patch `safetyDepthMeters`
- adapters should consume normalized safety-depth semantics
- tests should cover positive depth values

## Vessel And Sea Level

Vessel placement needs to keep these separate:

- chart depth
- vessel draught
- scene coordinate position
- sea level
- rendered engine z

The public vessel controller should expose CRS-aware position and nautical
parameters. The adapter should own final engine-space transform math.

## Route Volumes

Route volume and route safety-depth visualization should also use positive
nautical depth values at the public API boundary. Any 3D mesh extrusion into
z-up rendering space should be an internal conversion.

