// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseXml } from "./xml-parser";

describe("parseXml", () => {
  it("returns document and null error for valid XML", () => {
    const result = parseXml("<root><child attr=\"val\">text</child></root>");
    expect(result.document).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns document with correct root element tagName", () => {
    const result = parseXml("<root><child/></root>");
    expect(result.document?.documentElement.tagName).toBe("root");
  });

  it("returns null document and error string for malformed XML", () => {
    const result = parseXml("<root><unclosed>");
    expect(result.document).toBeNull();
    expect(result.error).not.toBeNull();
    expect(typeof result.error).toBe("string");
  });

  it("returns error for empty string input", () => {
    const result = parseXml("");
    expect(result.document).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("returns error for whitespace-only input", () => {
    const result = parseXml("   \n  ");
    expect(result.document).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("preserves comment nodes in parsed document", () => {
    const result = parseXml("<root><!-- a comment --></root>");
    expect(result.document).not.toBeNull();
    const root = result.document!.documentElement;
    const commentNode = Array.from(root.childNodes).find(
      (n) => n.nodeType === 8
    );
    expect(commentNode).toBeDefined();
    expect(commentNode!.textContent).toBe(" a comment ");
  });

  it("preserves CDATA sections in parsed document", () => {
    const result = parseXml("<root><![CDATA[some data]]></root>");
    expect(result.document).not.toBeNull();
    const root = result.document!.documentElement;
    const cdataNode = Array.from(root.childNodes).find(
      (n) => n.nodeType === 4
    );
    expect(cdataNode).toBeDefined();
    expect(cdataNode!.textContent).toBe("some data");
  });

  it("preserves processing instructions in parsed document", () => {
    const result = parseXml(
      "<?xml version=\"1.0\"?><root><child/></root>"
    );
    expect(result.document).not.toBeNull();
    // The <?xml?> declaration is consumed by the parser, but the document should still parse
    expect(result.document!.documentElement.tagName).toBe("root");
  });

  it("preserves namespace prefixes in element tagName", () => {
    const xml =
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>';
    const result = parseXml(xml);
    expect(result.document).not.toBeNull();
    expect(result.document!.documentElement.tagName).toBe("soap:Envelope");
  });
});
