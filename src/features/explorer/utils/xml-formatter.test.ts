// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { formatXml } from "./xml-formatter";

describe("formatXml", () => {
  it("formats minified XML into indented multi-line output", () => {
    const result = formatXml(
      '<root><child attr="val">text</child></root>'
    );
    expect(result).toContain("\n");
    expect(result).toContain("  <child");
    expect(result).toContain("text</child>");
  });

  it("preserves self-closing tags", () => {
    const result = formatXml("<root/>");
    expect(result).toBe("<root/>");
  });

  it("keeps text content inline with its element", () => {
    const result = formatXml("<root><a>text</a></root>");
    // The <a> tag, text, and closing tag should be on the same line
    const lines = result.split("\n");
    const aLine = lines.find((l) => l.includes("<a>"));
    expect(aLine).toBeDefined();
    expect(aLine).toContain("text</a>");
  });

  it("returns empty string for empty input", () => {
    expect(formatXml("")).toBe("");
  });

  it("returns original malformed string unchanged", () => {
    const malformed = "<root><unclosed>";
    expect(formatXml(malformed)).toBe(malformed);
  });

  it("preserves and indents comments", () => {
    const result = formatXml("<root><!-- comment --></root>");
    expect(result).toContain("<!-- comment -->");
    // Comment should be indented (child of root)
    const lines = result.split("\n");
    const commentLine = lines.find((l) => l.includes("<!--"));
    expect(commentLine).toMatch(/^\s+<!--/);
  });

  it("preserves and indents CDATA sections", () => {
    const result = formatXml("<root><![CDATA[some data]]></root>");
    expect(result).toContain("<![CDATA[some data]]>");
    const lines = result.split("\n");
    const cdataLine = lines.find((l) => l.includes("CDATA"));
    expect(cdataLine).toMatch(/^\s+<!\[CDATA\[/);
  });

  it("preserves processing instructions", () => {
    const result = formatXml(
      '<?xml version="1.0"?><root><child/></root>'
    );
    // The <?xml?> PI may be consumed by DOMParser; the document should
    // still format correctly.
    expect(result).toContain("<root>");
    expect(result).toContain("<child/>");
  });

  it("preserves namespaced element tag names", () => {
    const xml =
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>';
    const result = formatXml(xml);
    expect(result).toContain("soap:Envelope");
    expect(result).toContain("soap:Body");
  });

  it("uses custom indent when specified", () => {
    const result = formatXml(
      "<root><child>text</child></root>",
      "    "
    );
    const lines = result.split("\n");
    const childLine = lines.find((l) => l.includes("<child>"));
    expect(childLine).toMatch(/^    <child>/);
  });

  it("formats nested elements with correct indentation depth", () => {
    const result = formatXml(
      "<root><a><b><c>deep</c></b></a></root>"
    );
    const lines = result.split("\n");
    // c element should be at depth 3 (6 spaces with 2-space indent)
    const cLine = lines.find((l) => l.includes("<c>"));
    expect(cLine).toMatch(/^      <c>deep<\/c>/);
  });

  it("handles elements with multiple attributes", () => {
    const result = formatXml(
      '<root><item id="1" name="test" type="a"/></root>'
    );
    expect(result).toContain('id="1"');
    expect(result).toContain('name="test"');
    expect(result).toContain('type="a"');
  });

  it("handles mixed content (elements and text siblings)", () => {
    const result = formatXml(
      "<root><a>hello</a><b>world</b></root>"
    );
    expect(result).toContain("<a>hello</a>");
    expect(result).toContain("<b>world</b>");
  });
});
