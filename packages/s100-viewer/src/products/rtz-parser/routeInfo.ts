import type { RouteDiagnostic, RouteInfo } from "../route-plan.js";
import { routeDiagnostic } from "./diagnostics.js";
import type { XmlNode } from "./types.js";

export const parseRouteInfo = (node: XmlNode): RouteInfo => ({
  values: { ...node.attributes },
  ...(node.attributes.routeName !== undefined ? { name: node.attributes.routeName, routeName: node.attributes.routeName } : {}),
  ...(node.attributes.routeAuthor !== undefined ? { author: node.attributes.routeAuthor } : {}),
  ...(node.attributes.routeStatus !== undefined ? { status: node.attributes.routeStatus } : {}),
  ...(node.attributes.validityPeriodStart !== undefined ? { validFrom: node.attributes.validityPeriodStart } : {}),
  ...(node.attributes.validityPeriodStop !== undefined ? { validTo: node.attributes.validityPeriodStop } : {}),
  ...(node.attributes.vesselName !== undefined ? { vesselName: node.attributes.vesselName } : {}),
  ...(node.attributes.vesselMMSI !== undefined ? { vesselMmsi: node.attributes.vesselMMSI } : {}),
  ...(node.attributes.vesselIMO !== undefined ? { vesselImo: node.attributes.vesselIMO } : {}),
});

export const missingRouteInfo = (diagnostics: RouteDiagnostic[]): RouteInfo => {
  diagnostics.push(routeDiagnostic(
    "rtz-route-info-missing",
    "error",
    "RTZ route is missing the required routeInfo element.",
    "/route/routeInfo",
  ));
  return { values: {} };
};
