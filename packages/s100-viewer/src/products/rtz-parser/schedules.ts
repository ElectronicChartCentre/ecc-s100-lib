import type { RouteSchedule, RouteScheduleElement } from "../route-plan.js";
import { parseExtensions } from "./extensions.js";
import type { XmlNode } from "./types.js";
import { childrenByLocalName, directChild } from "./xml.js";
import { finiteNumberOrUndefined } from "./validation.js";

export const parseSchedules = (routeNode: XmlNode): RouteSchedule[] => {
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
