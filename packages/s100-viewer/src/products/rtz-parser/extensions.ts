import type { RouteExtension } from "../route-plan.js";
import type { XmlNode } from "./types.js";
import { childrenByLocalName, directChild, toRawXmlNode } from "./xml.js";

export const parseExtensions = (
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
