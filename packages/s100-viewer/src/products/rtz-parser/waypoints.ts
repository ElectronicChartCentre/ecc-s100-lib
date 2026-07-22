import type {
  GeographicPosition,
  RouteDiagnostic,
  RouteExtension,
  RouteGeometryType,
  RouteWaypoint,
  RouteWaypointLeg,
} from "../route-plan.js";
import { nauticalMilesToMeters } from "../route-geodesy.js";
import { routeDiagnostic } from "./diagnostics.js";
import { parseExtensions } from "./extensions.js";
import type { WaypointDefaults, XmlNode } from "./types.js";
import { childrenByLocalName, directChild } from "./xml.js";
import {
  combineNumberValues,
  parseOptionalNumber,
} from "./validation.js";

export const parseWaypointDefaults = (
  waypointsNode: XmlNode,
  diagnostics: RouteDiagnostic[],
): WaypointDefaults => {
  const defaultWaypoint = directChild(waypointsNode, "defaultWaypoint");
  if (!defaultWaypoint) {
    return {
      legAttributes: {},
      legExtensions: [],
    };
  }

  const radiusNm = parseOptionalNumber(
    defaultWaypoint.attributes.radius,
    "/route/waypoints/defaultWaypoint/@radius",
    diagnostics,
    {
      minInclusive: 0,
      maxInclusive: 5,
      code: "rtz-radius-out-of-range",
      label: "Default waypoint radius",
    },
  );
  const defaultLeg = directChild(defaultWaypoint, "leg");
  return {
    ...(radiusNm !== undefined ? { radiusNm } : {}),
    legAttributes: defaultLeg ? { ...defaultLeg.attributes } : {},
    legExtensions: parseExtensions(directChild(defaultLeg, "extensions")),
  };
};

export const parseWaypoints = (
  waypointsNode: XmlNode,
  defaults: WaypointDefaults,
  diagnostics: RouteDiagnostic[],
): RouteWaypoint[] => {
  const waypointNodes = childrenByLocalName(waypointsNode, "waypoint");
  const waypoints: RouteWaypoint[] = [];

  waypointNodes.forEach((node, index) => {
    const path = `/route/waypoints/waypoint[${index + 1}]`;
    const id = node.attributes.id;
    const revision = node.attributes.revision;
    const positionNode = directChild(node, "position");

    if (!id) {
      diagnostics.push(routeDiagnostic(
        "rtz-waypoint-id-missing",
        "error",
        "RTZ waypoint is missing required id.",
        `${path}/@id`,
      ));
      return;
    }

    if (!revision) {
      diagnostics.push(routeDiagnostic(
        "rtz-waypoint-revision-missing",
        "error",
        `RTZ waypoint '${id}' is missing required revision.`,
        `${path}/@revision`,
        { waypointId: id },
      ));
    }

    if (!positionNode) {
      diagnostics.push(routeDiagnostic(
        "rtz-waypoint-position-missing",
        "error",
        `RTZ waypoint '${id}' is missing required position.`,
        `${path}/position`,
        { waypointId: id },
      ));
      return;
    }

    const position = parsePosition(positionNode, `${path}/position`, diagnostics);
    if (!position) {
      return;
    }

    const radiusNm = parseOptionalNumber(
      node.attributes.radius,
      `${path}/@radius`,
      diagnostics,
      {
        minInclusive: 0,
        maxInclusive: 5,
        code: "rtz-radius-out-of-range",
        label: `Waypoint '${id}' radius`,
      },
    ) ?? defaults.radiusNm;

    waypoints.push({
      id,
      ...(revision !== undefined ? { revision } : {}),
      ...(node.attributes.name !== undefined ? { name: node.attributes.name } : {}),
      position,
      ...(radiusNm !== undefined
        ? {
            sourceRadiusNm: radiusNm,
            radiusMeters: nauticalMilesToMeters(radiusNm),
          }
        : {}),
      extensions: parseExtensions(directChild(node, "extensions")),
    });
  });

  return waypoints;
};

const parsePosition = (
  node: XmlNode,
  path: string,
  diagnostics: RouteDiagnostic[],
): GeographicPosition | null => {
  const lat = parseOptionalNumber(node.attributes.lat, `${path}/@lat`, diagnostics, {
    minInclusive: -90,
    maxInclusive: 90,
    code: "rtz-latitude-out-of-range",
    label: "Waypoint latitude",
  });
  const lon = parseOptionalNumber(node.attributes.lon, `${path}/@lon`, diagnostics, {
    minInclusive: -180,
    maxExclusive: 180,
    code: "rtz-longitude-out-of-range",
    label: "Waypoint longitude",
  });

  if (lat === undefined || lon === undefined) {
    diagnostics.push(routeDiagnostic(
      "rtz-position-invalid",
      "error",
      "Waypoint position must include valid WGS84 lat and lon attributes.",
      path,
    ));
    return null;
  }

  return { lon, lat };
};

export const parseLegs = (
  waypointsNode: XmlNode,
  waypoints: readonly RouteWaypoint[],
  defaults: WaypointDefaults,
  diagnostics: RouteDiagnostic[],
): RouteWaypointLeg[] => {
  const waypointNodesById = new Map(
    childrenByLocalName(waypointsNode, "waypoint")
      .filter((node) => node.attributes.id !== undefined)
      .map((node) => [node.attributes.id as string, node]),
  );
  const legs: RouteWaypointLeg[] = [];

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const from = waypoints[index];
    const to = waypoints[index + 1];
    if (!from || !to) {
      continue;
    }
    const waypointNode = waypointNodesById.get(from.id);
    const legNode = waypointNode ? directChild(waypointNode, "leg") : undefined;
    const attributes = {
      ...defaults.legAttributes,
      ...(legNode ? legNode.attributes : {}),
    };
    const legExtensions = [
      ...defaults.legExtensions,
      ...parseExtensions(directChild(legNode, "extensions")),
    ];
    legs.push(parseLeg(
      `${from.id}:${to.id}`,
      from.id,
      to.id,
      attributes,
      legExtensions,
      `/route/waypoints/waypoint[@id='${from.id}']/leg`,
      diagnostics,
    ));
  }

  return legs;
};

const parseLeg = (
  id: string,
  fromWaypointId: string,
  toWaypointId: string,
  attributes: Record<string, string>,
  extensions: readonly RouteExtension[],
  path: string,
  diagnostics: RouteDiagnostic[],
): RouteWaypointLeg => {
  const geometryType = normalizeGeometryType(attributes.geometryType, path, diagnostics);
  const sourceStarboardXtdNm = parseOptionalNumber(
    attributes.starboardXTD,
    `${path}/@starboardXTD`,
    diagnostics,
    {
      minInclusive: 0,
      maxExclusive: 10,
      code: "rtz-xtd-out-of-range",
      label: "Starboard XTD",
    },
  );
  const sourcePortsideXtdNm = parseOptionalNumber(
    attributes.portsideXTD,
    `${path}/@portsideXTD`,
    diagnostics,
    {
      minInclusive: 0,
      maxExclusive: 10,
      code: "rtz-xtd-out-of-range",
      label: "Portside XTD",
    },
  );
  const safetyContourMeters = parseOptionalNumber(attributes.safetyContour, `${path}/@safetyContour`, diagnostics);
  const safetyDepthMeters = parseOptionalNumber(attributes.safetyDepth, `${path}/@safetyDepth`, diagnostics);
  const speedMinKnots = parseOptionalNumber(attributes.speedMin, `${path}/@speedMin`, diagnostics);
  const speedMaxKnots = parseOptionalNumber(attributes.speedMax, `${path}/@speedMax`, diagnostics);
  const draughtMeters = combineNumberValues([
    parseOptionalNumber(attributes.draughtForward, `${path}/@draughtForward`, diagnostics),
    parseOptionalNumber(attributes.draughtAft, `${path}/@draughtAft`, diagnostics),
  ], "max");
  const ukcMeters = combineNumberValues([
    parseOptionalNumber(attributes.staticUKC, `${path}/@staticUKC`, diagnostics),
    parseOptionalNumber(attributes.dynamicUKC, `${path}/@dynamicUKC`, diagnostics),
  ], "min");
  const mastheadMeters = parseOptionalNumber(attributes.masthead, `${path}/@masthead`, diagnostics);
  const notes = [attributes.legNote1, attributes.legNote2]
    .filter((item): item is string => item !== undefined && item.length > 0)
    .join("\n");

  return {
    id,
    fromWaypointId,
    toWaypointId,
    geometryType,
    ...(sourceStarboardXtdNm !== undefined
      ? {
          sourceStarboardXtdNm,
          starboardXtdMeters: nauticalMilesToMeters(sourceStarboardXtdNm),
        }
      : {}),
    ...(sourcePortsideXtdNm !== undefined
      ? {
          sourcePortsideXtdNm,
          portsideXtdMeters: nauticalMilesToMeters(sourcePortsideXtdNm),
        }
      : {}),
    ...(safetyDepthMeters !== undefined ? { safetyDepthMeters } : {}),
    ...(safetyContourMeters !== undefined ? { safetyContourMeters } : {}),
    ...(speedMinKnots !== undefined ? { speedMinKnots } : {}),
    ...(speedMaxKnots !== undefined ? { speedMaxKnots } : {}),
    ...(draughtMeters !== undefined ? { draughtMeters } : {}),
    ...(ukcMeters !== undefined ? { ukcMeters } : {}),
    ...(mastheadMeters !== undefined ? { mastheadMeters } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    ...(attributes.legReport !== undefined ? { report: attributes.legReport } : {}),
    ...(attributes.legInfo !== undefined ? { info: attributes.legInfo } : {}),
    extensions,
  };
};

const normalizeGeometryType = (
  value: string | undefined,
  path: string,
  diagnostics: RouteDiagnostic[],
): RouteGeometryType => {
  if (value === undefined || value.length === 0) {
    return "unknown";
  }
  const normalized = value.toLowerCase();
  if (normalized === "loxodrome") {
    return "loxodrome";
  }
  if (normalized === "orthodrome") {
    return "orthodrome";
  }
  diagnostics.push(routeDiagnostic(
    "rtz-geometry-type-unsupported",
    "warning",
    `Unsupported RTZ leg geometry type '${value}'.`,
    `${path}/@geometryType`,
    { geometryType: value },
  ));
  return "unknown";
};
