import {
  type GeographicPosition,
  type RouteDiagnostic,
  type RouteExtension,
  type RouteGeometryType,
  type RouteInfo,
  type RoutePlan,
  type RouteRawXmlNode,
  type RouteSchedule,
  type RouteScheduleElement,
  type RouteWaypoint,
  type RouteWaypointLeg,
} from "./route-plan.js";

const NAUTICAL_MILE_METERS = 1852;

export type RtzParseOptions = {
  id?: string;
  sourceId?: string;
  strict?: boolean;
  includeRaw?: boolean;
};

export class RtzParseError extends Error {
  readonly diagnostics: readonly RouteDiagnostic[];

  constructor(message: string, diagnostics: readonly RouteDiagnostic[]) {
    super(message);
    this.name = "RtzParseError";
    this.diagnostics = diagnostics;
  }
}

type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

type WaypointDefaults = {
  radiusNm?: number;
  legAttributes: Record<string, string>;
  legExtensions: readonly RouteExtension[];
};

export const nauticalMilesToMeters = (value: number): number =>
  value * NAUTICAL_MILE_METERS;

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

const parseRouteInfo = (node: XmlNode): RouteInfo => ({
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

const missingRouteInfo = (diagnostics: RouteDiagnostic[]): RouteInfo => {
  diagnostics.push(routeDiagnostic(
    "rtz-route-info-missing",
    "error",
    "RTZ route is missing the required routeInfo element.",
    "/route/routeInfo",
  ));
  return { values: {} };
};

const parseWaypointDefaults = (
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

const parseWaypoints = (
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

const parseLegs = (
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

const parseSchedules = (routeNode: XmlNode): RouteSchedule[] => {
  const schedulesNode = directChild(routeNode, "schedules");
  if (!schedulesNode) {
    return [];
  }

  return childrenByLocalName(schedulesNode, "schedule").map((scheduleNode) => {
    const elements = [
      ...parseScheduleElements(directChild(scheduleNode, "manual")),
      ...parseScheduleElements(directChild(scheduleNode, "calculated")),
    ];
    return {
      ...(scheduleNode.attributes.id !== undefined ? { id: scheduleNode.attributes.id } : {}),
      ...(scheduleNode.attributes.name !== undefined ? { name: scheduleNode.attributes.name } : {}),
      values: { ...scheduleNode.attributes },
      elements,
      extensions: parseExtensions(directChild(scheduleNode, "extensions")),
    };
  });
};

const parseScheduleElements = (
  scheduleValuesNode: XmlNode | undefined,
): RouteScheduleElement[] => {
  if (!scheduleValuesNode) {
    return [];
  }

  return childrenByLocalName(scheduleValuesNode, "scheduleElement").map((node) => {
    const speedKnots = finiteNumberOrUndefined(node.attributes.speed);
    const speedWindowKnots = finiteNumberOrUndefined(node.attributes.speedWindow);
    return {
      ...(node.attributes.waypointId !== undefined ? { waypointId: node.attributes.waypointId } : {}),
      ...(node.attributes.etd !== undefined ? { etd: node.attributes.etd } : {}),
      ...(node.attributes.eta !== undefined ? { eta: node.attributes.eta } : {}),
      ...(node.attributes.etdWindowBefore !== undefined ? { etdWindowBefore: node.attributes.etdWindowBefore } : {}),
      ...(node.attributes.etdWindowAfter !== undefined ? { etdWindowAfter: node.attributes.etdWindowAfter } : {}),
      ...(node.attributes.etaWindowBefore !== undefined ? { etaWindowBefore: node.attributes.etaWindowBefore } : {}),
      ...(node.attributes.etaWindowAfter !== undefined ? { etaWindowAfter: node.attributes.etaWindowAfter } : {}),
      ...(speedKnots !== undefined ? { speedKnots } : {}),
      ...(speedWindowKnots !== undefined ? { speedWindowKnots } : {}),
      values: { ...node.attributes },
      extensions: parseExtensions(directChild(node, "extensions")),
    };
  });
};

const parseExtensions = (
  extensionsNode: XmlNode | undefined,
): readonly RouteExtension[] => {
  if (!extensionsNode) {
    return [];
  }

  return childrenByLocalName(extensionsNode, "extension").map((node) => ({
    ...(node.attributes.manufacturer !== undefined ? { manufacturer: node.attributes.manufacturer } : {}),
    ...(node.attributes.name !== undefined ? { name: node.attributes.name } : {}),
    ...(node.attributes.version !== undefined ? { version: node.attributes.version } : {}),
    attributes: { ...node.attributes },
    children: node.children.map(toRawXmlNode),
    ...(node.text.trim().length > 0 ? { text: node.text.trim() } : {}),
  }));
};

const toRawXmlNode = (node: XmlNode): RouteRawXmlNode => ({
  name: node.name,
  attributes: { ...node.attributes },
  children: node.children.map(toRawXmlNode),
  ...(node.text.trim().length > 0 ? { text: node.text.trim() } : {}),
});

const parseOptionalNumber = (
  value: string | undefined,
  path: string,
  diagnostics: RouteDiagnostic[],
  range?: {
    minInclusive?: number;
    maxInclusive?: number;
    maxExclusive?: number;
    code: string;
    label: string;
  },
): number | undefined => {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    diagnostics.push(routeDiagnostic(
      "rtz-number-invalid",
      "error",
      `Expected numeric RTZ value at ${path}.`,
      path,
      { value },
    ));
    return undefined;
  }
  if (range?.minInclusive !== undefined && parsed < range.minInclusive) {
    diagnostics.push(routeDiagnostic(
      range.code,
      "error",
      `${range.label} must be greater than or equal to ${range.minInclusive}.`,
      path,
      { value: parsed },
    ));
    return undefined;
  }
  if (range?.maxInclusive !== undefined && parsed > range.maxInclusive) {
    diagnostics.push(routeDiagnostic(
      range.code,
      "error",
      `${range.label} must be less than or equal to ${range.maxInclusive}.`,
      path,
      { value: parsed },
    ));
    return undefined;
  }
  if (range?.maxExclusive !== undefined && parsed >= range.maxExclusive) {
    diagnostics.push(routeDiagnostic(
      range.code,
      "error",
      `${range.label} must be less than ${range.maxExclusive}.`,
      path,
      { value: parsed },
    ));
    return undefined;
  }
  return parsed;
};

const finiteNumberOrUndefined = (value: string | undefined): number | undefined => {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const combineNumberValues = (
  values: readonly (number | undefined)[],
  mode: "min" | "max",
): number | undefined => {
  const finiteValues = values.filter((value): value is number => value !== undefined);
  if (finiteValues.length === 0) {
    return undefined;
  }
  return mode === "min" ? Math.min(...finiteValues) : Math.max(...finiteValues);
};

const routeDiagnostic = (
  code: string,
  severity: RouteDiagnostic["severity"],
  message: string,
  path?: string,
  values?: Record<string, unknown>,
): RouteDiagnostic => ({
  code,
  severity,
  message,
  ...(path !== undefined ? { path } : {}),
  ...(values !== undefined ? { values } : {}),
});

const parseXmlDocument = (
  xml: string,
  diagnostics: RouteDiagnostic[],
): XmlNode => {
  try {
    const documentNode = parseXml(xml);
    const root = documentNode.children.find((child) => child.name !== "#text");
    if (!root) {
      throw new Error("XML document does not contain a root element.");
    }
    return root;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RtzParseError("Failed to parse RTZ XML.", [
      ...diagnostics,
      routeDiagnostic("rtz-xml-parse-error", "error", message),
    ]);
  }
};

const parseXml = (xml: string): XmlNode => {
  const documentNode: XmlNode = {
    name: "#document",
    attributes: {},
    children: [],
    text: "",
  };
  const stack: XmlNode[] = [documentNode];
  const source = xml.replace(/^\uFEFF/, "");
  let index = 0;

  while (index < source.length) {
    const openIndex = source.indexOf("<", index);
    if (openIndex < 0) {
      appendText(stack, decodeXml(source.slice(index)));
      break;
    }

    if (openIndex > index) {
      appendText(stack, decodeXml(source.slice(index, openIndex)));
    }

    if (source.startsWith("<!--", openIndex)) {
      const endIndex = source.indexOf("-->", openIndex + 4);
      if (endIndex < 0) {
        throw new Error("Unterminated XML comment.");
      }
      index = endIndex + 3;
      continue;
    }

    if (source.startsWith("<![CDATA[", openIndex)) {
      const endIndex = source.indexOf("]]>", openIndex + 9);
      if (endIndex < 0) {
        throw new Error("Unterminated XML CDATA section.");
      }
      appendText(stack, source.slice(openIndex + 9, endIndex));
      index = endIndex + 3;
      continue;
    }

    if (source.startsWith("<?", openIndex)) {
      const endIndex = source.indexOf("?>", openIndex + 2);
      if (endIndex < 0) {
        throw new Error("Unterminated XML processing instruction.");
      }
      index = endIndex + 2;
      continue;
    }

    if (source.startsWith("<!", openIndex)) {
      const endIndex = source.indexOf(">", openIndex + 2);
      if (endIndex < 0) {
        throw new Error("Unterminated XML declaration.");
      }
      index = endIndex + 1;
      continue;
    }

    const tag = readTag(source, openIndex + 1);
    const trimmed = tag.content.trim();
    if (trimmed.startsWith("/")) {
      const closeName = trimmed.slice(1).trim();
      const current = stack.pop();
      if (!current || current === documentNode) {
        throw new Error(`Unexpected closing XML element '${closeName}'.`);
      }
      if (current.name !== closeName) {
        throw new Error(`Mismatched XML closing element '${closeName}' for '${current.name}'.`);
      }
      index = tag.nextIndex;
      continue;
    }

    const selfClosing = trimmed.endsWith("/");
    const node = parseStartTag(selfClosing ? trimmed.slice(0, -1).trim() : trimmed);
    stack[stack.length - 1]?.children.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
    index = tag.nextIndex;
  }

  if (stack.length !== 1) {
    const open = stack[stack.length - 1];
    throw new Error(`Unclosed XML element '${open?.name ?? "unknown"}'.`);
  }

  return documentNode;
};

const readTag = (
  source: string,
  startIndex: number,
): { content: string; nextIndex: number } => {
  let quote: '"' | "'" | null = null;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (char === ">" && quote === null) {
      return {
        content: source.slice(startIndex, index),
        nextIndex: index + 1,
      };
    }
  }
  throw new Error("Unterminated XML start tag.");
};

const parseStartTag = (content: string): XmlNode => {
  const nameMatch = /^([^\s/>]+)/.exec(content);
  if (!nameMatch) {
    throw new Error("XML element is missing a name.");
  }
  const name = nameMatch[1];
  if (name === undefined) {
    throw new Error("XML element is missing a name.");
  }
  const attributes: Record<string, string> = {};
  let index = name.length;

  while (index < content.length) {
    while (/\s/.test(content[index] ?? "")) {
      index += 1;
    }
    if (index >= content.length) {
      break;
    }

    const attrNameStart = index;
    while (index < content.length && !/[\s=]/.test(content[index] ?? "")) {
      index += 1;
    }
    const attrName = content.slice(attrNameStart, index);
    while (/\s/.test(content[index] ?? "")) {
      index += 1;
    }
    if (content[index] !== "=") {
      throw new Error(`XML attribute '${attrName}' is missing '='.`);
    }
    index += 1;
    while (/\s/.test(content[index] ?? "")) {
      index += 1;
    }
    const quote = content[index];
    if (quote !== '"' && quote !== "'") {
      throw new Error(`XML attribute '${attrName}' value must be quoted.`);
    }
    index += 1;
    const valueStart = index;
    while (index < content.length && content[index] !== quote) {
      index += 1;
    }
    if (index >= content.length) {
      throw new Error(`XML attribute '${attrName}' has an unterminated value.`);
    }
    attributes[attrName] = decodeXml(content.slice(valueStart, index));
    index += 1;
  }

  return {
    name,
    attributes,
    children: [],
    text: "",
  };
};

const appendText = (stack: XmlNode[], text: string): void => {
  if (text.length === 0) {
    return;
  }
  const node = stack[stack.length - 1];
  if (node) {
    node.text += text;
  }
};

const decodeXml = (value: string): string =>
  value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_match, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return "\"";
      case "apos":
        return "'";
      default:
        if (entity.startsWith("#x")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        if (entity.startsWith("#")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        }
        return `&${entity};`;
    }
  });

const localName = (name: string): string => {
  const colonIndex = name.indexOf(":");
  return colonIndex >= 0 ? name.slice(colonIndex + 1) : name;
};

const directChild = (
  node: XmlNode | undefined,
  childName: string,
): XmlNode | undefined =>
  node?.children.find((child) => localName(child.name) === childName);

const childrenByLocalName = (
  node: XmlNode,
  childName: string,
): XmlNode[] =>
  node.children.filter((child) => localName(child.name) === childName);

