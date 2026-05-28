/**
 * XML pretty-printing utility.
 *
 * Uses DOMParser to parse the input and recursively walks the DOM tree
 * to produce indented, human-readable XML output.  Returns the original
 * string unchanged when the input is malformed (graceful fallback).
 */

export function formatXml(xmlString: string, indentStr: string = "  "): string {
  if (!xmlString) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  // DOMParser signals errors by injecting a <parsererror> element
  if (doc.querySelector("parsererror")) {
    return xmlString;
  }

  const lines: string[] = [];

  // Process top-level child nodes of the document (PIs, comments, doctype,
  // and the document element).
  for (let i = 0; i < doc.childNodes.length; i++) {
    serializeNode(doc.childNodes[i], 0, indentStr, lines);
  }

  return lines.join("\n");
}

function serializeNode(
  node: Node,
  depth: number,
  indentStr: string,
  lines: string[]
): void {
  const indent = indentStr.repeat(depth);

  switch (node.nodeType) {
    case 1: // Element
      serializeElement(node as Element, depth, indentStr, lines);
      break;

    case 3: // Text
      {
        const text = node.textContent?.trim() ?? "";
        if (text) {
          lines.push(`${indent}${text}`);
        }
      }
      break;

    case 4: // CDATA Section
      lines.push(`${indent}<![CDATA[${node.textContent ?? ""}]]>`);
      break;

    case 7: // Processing Instruction
      {
        const pi = node as ProcessingInstruction;
        const value = pi.nodeValue ? ` ${pi.nodeValue}` : "";
        lines.push(`${indent}<?${pi.target}${value}?>`);
      }
      break;

    case 8: // Comment
      lines.push(`${indent}<!--${node.textContent ?? ""}-->`);
      break;

    default:
      break;
  }
}

function serializeElement(
  el: Element,
  depth: number,
  indentStr: string,
  lines: string[]
): void {
  const indent = indentStr.repeat(depth);
  const tagName = el.tagName;

  // Build attribute string
  let attrStr = "";
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    attrStr += ` ${attr.name}="${attr.value}"`;
  }

  const children = getSignificantChildren(el);

  // Self-closing element
  if (children.length === 0) {
    lines.push(`${indent}<${tagName}${attrStr}/>`);
    return;
  }

  // Single text child: keep inline  <tag>text</tag>
  if (
    children.length === 1 &&
    children[0].nodeType === 3 &&
    children[0].textContent?.trim()
  ) {
    const text = children[0].textContent!.trim();
    lines.push(`${indent}<${tagName}${attrStr}>${text}</${tagName}>`);
    return;
  }

  // Multi-child: open tag, children indented, close tag
  lines.push(`${indent}<${tagName}${attrStr}>`);

  for (const child of children) {
    serializeNode(child, depth + 1, indentStr, lines);
  }

  lines.push(`${indent}</${tagName}>`);
}

/** Returns child nodes excluding whitespace-only text nodes. */
function getSignificantChildren(node: Node): Node[] {
  const result: Node[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    // Skip whitespace-only text nodes
    if (child.nodeType === 3 && !child.textContent?.trim()) {
      continue;
    }
    result.push(child);
  }
  return result;
}
