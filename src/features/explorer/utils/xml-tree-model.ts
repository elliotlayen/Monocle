export type XmlNodeKind =
  | "element"
  | "text"
  | "cdata"
  | "pi"
  | "comment"
  | "other";

export interface XmlAttr {
  name: string;
  value: string;
}

export interface VisibleXmlNode {
  id: string;
  parentId: string | null;
  depth: number;
  kind: XmlNodeKind;
  label: string;
  attrs: XmlAttr[];
  /** Inlined text for elements whose only child is a text node. */
  value?: string;
  childCount: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

// Node ids are positional dotted paths over the whitespace-filtered child
// list ("0", "0.2.1"), matching the scheme the previous tree view persisted
// in FileTab.treeExpandedIds — saved expansion state stays valid.

function isWhitespaceText(node: Node): boolean {
  return node.nodeType === 3 && !node.textContent?.trim();
}

function filteredChildren(node: Node): Node[] {
  const children: Node[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (isWhitespaceText(child)) continue;
    children.push(child);
  }
  return children;
}

function kindOf(node: Node): XmlNodeKind {
  switch (node.nodeType) {
    case 1:
      return "element";
    case 3:
      return "text";
    case 4:
      return "cdata";
    case 7:
      return "pi";
    case 8:
      return "comment";
    default:
      return "other";
  }
}

function labelOf(node: Node, kind: XmlNodeKind): string {
  switch (kind) {
    case "element":
      return (node as Element).tagName;
    case "pi":
      return `<?${node.nodeName} ${node.nodeValue ?? ""}?>`;
    default:
      return node.textContent?.trim() ?? "";
  }
}

/**
 * Elements like <title lang="en">The Great Gatsby</title> collapse into a
 * single node carrying the text as its value instead of a two-node chain.
 */
function inlineTextValue(kind: XmlNodeKind, children: Node[]): string | null {
  if (kind !== "element") return null;
  if (children.length !== 1) return null;
  const only = children[0];
  if (only.nodeType !== 3) return null;
  return only.textContent?.trim() ?? "";
}

function attrsOf(node: Node, kind: XmlNodeKind): XmlAttr[] {
  if (kind !== "element") return [];
  const el = node as Element;
  const attrs: XmlAttr[] = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    attrs.push({ name: attr.name, value: attr.value });
  }
  return attrs;
}

/**
 * Flattens the expansion-visible part of the document into document order.
 * Children are traversed only under expanded nodes.
 */
export function buildVisibleTree(
  doc: Document,
  expandedIds: Set<string>
): VisibleXmlNode[] {
  const result: VisibleXmlNode[] = [];
  const root = doc.documentElement;
  if (!root) return result;

  const visit = (
    node: Node,
    id: string,
    parentId: string | null,
    depth: number
  ) => {
    const kind = kindOf(node);
    const children = filteredChildren(node);
    const isExpanded = expandedIds.has(id);
    const value = inlineTextValue(kind, children);
    if (value !== null) {
      result.push({
        id,
        parentId,
        depth,
        kind,
        label: labelOf(node, kind),
        attrs: attrsOf(node, kind),
        value,
        childCount: 0,
        hasChildren: false,
        isExpanded: false,
      });
      return;
    }
    result.push({
      id,
      parentId,
      depth,
      kind,
      label: labelOf(node, kind),
      attrs: attrsOf(node, kind),
      childCount: children.length,
      hasChildren: children.length > 0,
      isExpanded,
    });
    if (!isExpanded) return;
    children.forEach((child, index) => {
      visit(child, `${id}.${index}`, id, depth + 1);
    });
  };

  visit(root, "0", null, 0);
  return result;
}

/** Every key with at least one visible child (the expand-all set). */
export function collectExpandableKeys(
  node: Node,
  key: string,
  keys: string[]
): void {
  const children = filteredChildren(node);
  // Single-text elements render inlined, so they are not expandable.
  if (inlineTextValue(kindOf(node), children) !== null) return;
  if (children.length > 0) keys.push(key);
  children.forEach((child, index) => {
    collectExpandableKeys(child, `${key}.${index}`, keys);
  });
}

function countVisible(doc: Document, expandedIds: Set<string>): number {
  return buildVisibleTree(doc, expandedIds).length;
}

function expandableKeysAboveDepth(doc: Document, maxDepth: number): string[] {
  const keys: string[] = [];
  const visit = (node: Node, key: string, depth: number) => {
    const children = filteredChildren(node);
    if (inlineTextValue(kindOf(node), children) !== null) return;
    if (children.length > 0 && depth < maxDepth) keys.push(key);
    children.forEach((child, index) => {
      visit(child, `${key}.${index}`, depth + 1);
    });
  };
  const root = doc.documentElement;
  if (root) visit(root, "0", 0);
  return keys;
}

/**
 * Bounded default expansion: expand nodes shallower than maxDepth, backing
 * off one level at a time while the visible node count exceeds the cap.
 * Depth 1 (root only) is always accepted.
 */
export function computeDefaultExpandedIds(
  doc: Document,
  maxDepth = 3,
  cap = 400
): Set<string> {
  for (let depth = maxDepth; depth >= 1; depth--) {
    const ids = new Set(expandableKeysAboveDepth(doc, depth));
    if (depth === 1 || countVisible(doc, ids) <= cap) {
      return ids;
    }
  }
  return new Set();
}
