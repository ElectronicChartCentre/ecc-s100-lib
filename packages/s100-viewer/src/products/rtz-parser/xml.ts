import type { RouteDiagnostic, RouteRawXmlNode } from "../route-plan.js";
import { routeDiagnostic } from "./diagnostics.js";
import type { XmlNode } from "./types.js";
import { RtzParseError } from "./validation.js";

export const parseXmlDocument = (
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

export const localName = (name: string): string => {
  const colonIndex = name.indexOf(":");
  return colonIndex >= 0 ? name.slice(colonIndex + 1) : name;
};

export const directChild = (
  node: XmlNode | undefined,
  childName: string,
): XmlNode | undefined =>
  node?.children.find((child) => localName(child.name) === childName);

export const childrenByLocalName = (
  node: XmlNode,
  childName: string,
): XmlNode[] =>
  node.children.filter((child) => localName(child.name) === childName);

export const toRawXmlNode = (node: XmlNode): RouteRawXmlNode => ({
  name: node.name,
  attributes: { ...node.attributes },
  children: node.children.map(toRawXmlNode),
  ...(node.text.trim().length > 0 ? { text: node.text.trim() } : {}),
});
