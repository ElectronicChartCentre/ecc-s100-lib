import type { RouteExtension } from "../route-plan.js";

export type RtzParseOptions = {
  id?: string;
  sourceId?: string;
  strict?: boolean;
  includeRaw?: boolean;
};

export type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

export type WaypointDefaults = {
  radiusNm?: number;
  legAttributes: Record<string, string>;
  legExtensions: readonly RouteExtension[];
};
