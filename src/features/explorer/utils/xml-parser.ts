export interface ParseResult {
  document: Document | null;
  error: string | null;
}

export function parseXml(content: string): ParseResult {
  if (!content || !content.trim()) {
    return { document: null, error: "Empty content" };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/xml");

  const errorNode = doc.querySelector("parsererror");
  if (errorNode) {
    return { document: null, error: errorNode.textContent ?? "Parse error" };
  }

  return { document: doc, error: null };
}
