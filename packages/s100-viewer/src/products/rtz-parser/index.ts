import type {
  RouteDiagnostic,
  RoutePlan,
} from "../route-plan.js";
import { routeDiagnostic } from "./diagnostics.js";
import { parseExtensions } from "./extensions.js";
import { missingRouteInfo, parseRouteInfo } from "./routeInfo.js";
import { parseSchedules } from "./schedules.js";
import type { RtzParseOptions } from "./types.js";
import {
  directChild,
  localName,
  parseXmlDocument,
  toRawXmlNode,
} from "./xml.js";
import {
  parseLegs,
  parseWaypointDefaults,
  parseWaypoints,
} from "./waypoints.js";
import { RtzParseError } from "./validation.js";

export type { RtzParseOptions } from "./types.js";
export { RtzParseError } from "./validation.js";

export const parseRtzRoute = (
  xml: string,
  options: RtzParseOptions = {},
): RoutePlan => {
  const diagnostics: RouteDiagnostic[] = [];
  const root = parseXmlDocument(xml, diagnostics);

  if (localName(root.name) !== "route") {
    throw new RtzParseError("RTZ document root must be a route element.", [
      routeDiagnostic(
        "rtz-root-invalid",
        "error",
        `Expected RTZ root element 'route', received '${root.name}'.`,
        "/",
      ),
    ]);
  }

  const version = root.attributes.version;
  if (version === undefined) {
    diagnostics.push(routeDiagnostic(
      "rtz-version-missing",
      "warning",
      "RTZ route is missing the required version attribute.",
      "/route/@version",
    ));
  } else if (version !== "1.2") {
    diagnostics.push(routeDiagnostic(
      "rtz-version-unsupported",
      "warning",
      `RTZ version '${version}' is not the primary supported version. The parser will attempt a compatible parse.`,
      "/route/@version",
      { version },
    ));
  }

  const routeInfoNode = directChild(root, "routeInfo");
  const routeInfo = routeInfoNode
    ? parseRouteInfo(routeInfoNode)
    : missingRouteInfo(diagnostics);

  const waypointsNode = directChild(root, "waypoints");
  if (!waypointsNode) {
    throw new RtzParseError("RTZ route is missing required waypoints.", [
      ...diagnostics,
      routeDiagnostic(
        "rtz-waypoints-missing",
        "error",
        "RTZ route is missing the required waypoints element.",
        "/route/waypoints",
      ),
    ]);
  }

  const defaults = parseWaypointDefaults(waypointsNode, diagnostics);
  const waypoints = parseWaypoints(waypointsNode, defaults, diagnostics);
  if (waypoints.length < 2) {
    throw new RtzParseError("RTZ route must contain at least two valid waypoints.", [
      ...diagnostics,
      routeDiagnostic(
        "rtz-waypoints-too-few",
        "error",
        `RTZ route contains ${waypoints.length} valid waypoint(s); at least two are required.`,
        "/route/waypoints",
        { waypointCount: waypoints.length },
      ),
    ]);
  }

  const legs = parseLegs(waypointsNode, waypoints, defaults, diagnostics);
  const schedules = parseSchedules(root);
  const extensions = parseExtensions(directChild(root, "extensions"));

  const routePlan: RoutePlan = {
    id: options.id ?? options.sourceId ?? routeInfo.routeName ?? routeInfo.name ?? "rtz-route",
    sourceFormat: "rtz",
    ...(version !== undefined ? { sourceVersion: version } : {}),
    routeInfo,
    waypoints,
    legs,
    schedules,
    extensions,
    diagnostics,
    ...(options.includeRaw === true ? { raw: toRawXmlNode(root) } : {}),
  };

  if (options.strict === true && diagnostics.some((item) => item.severity === "error")) {
    throw new RtzParseError("RTZ route contains validation errors.", diagnostics);
  }

  return routePlan;
};
