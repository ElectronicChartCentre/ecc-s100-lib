import type { Object3D } from "three";

export type RouteNativeHandle = {
  kind: string;
  view: {
    attached: boolean;
    root: Object3D;
  };
};

export const routePrimitiveKinds = (root: Object3D | undefined): string[] => {
  if (!root) {
    return [];
  }
  return root.children
    .map((child) => child.userData.s100PickMetadata?.primitiveKind)
    .filter((value): value is string => typeof value === "string");
};

export const sampleRtz = `<?xml version="1.0" encoding="utf-8"?>
<route version="1.2" xmlns="http://www.cirm.org/RTZ/1/2">
  <routeInfo routeName="Pilot Route" />
  <waypoints>
    <defaultWaypoint radius="0.1">
      <leg starboardXTD="0.1" portsideXTD="0.1" safetyDepth="12" geometryType="Loxodrome" />
    </defaultWaypoint>
    <waypoint id="1" revision="1">
      <position lat="60" lon="5" />
    </waypoint>
    <waypoint id="2" revision="1">
      <position lat="60.1" lon="5" />
    </waypoint>
  </waypoints>
</route>`;
