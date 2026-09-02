import { describe, expect, it } from "vitest";
import { depthAlpha, getXmlNodeStyleSpec } from "./xml-node-style";
import {
  EXPLORER_NODE_STYLES,
  isExplorerNodeStyle,
} from "@/features/settings/services/settings-service";

const COLOR = "var(--accent-blue)";

describe("getXmlNodeStyleSpec", () => {
  it("soft is a diagonal tint with no rail", () => {
    const spec = getXmlNodeStyleSpec("soft", COLOR, 0);
    expect(spec.shellClass).toContain("rounded-lg");
    expect(spec.shellStyle.background).toContain("linear-gradient(135deg");
    expect(spec.shellStyle.background).toContain(COLOR);
    expect(spec.shellStyle.borderColor).toContain("35%");
    expect(spec.shellStyle.boxShadow).toBeUndefined();
    expect(spec.iconWrapperClass).toBeUndefined();
  });

  it("capsule is pill-shaped with a tinted icon circle", () => {
    const spec = getXmlNodeStyleSpec("capsule", COLOR, 1);
    expect(spec.shellClass).toContain("rounded-full");
    expect(spec.shellClass).toContain("pl-1.5");
    expect(spec.shellStyle.backgroundColor).toContain("14%");
    expect(spec.shellStyle.borderColor).toContain("50%");
    expect(spec.iconWrapperClass).toContain("h-[22px]");
    expect(spec.iconWrapperStyle?.backgroundColor).toContain("25%");
  });

  it("outline is transparent with a heavier colored border", () => {
    const spec = getXmlNodeStyleSpec("outline", COLOR, 2);
    expect(spec.shellStyle.backgroundColor).toBe("transparent");
    expect(spec.shellStyle.borderColor).toContain("75%");
    expect(spec.shellStyle.borderWidth).toBe(1.5);
  });

  it("depth ramps the tint from root to leaves", () => {
    expect([0, 1, 2, 3, 4].map(depthAlpha)).toEqual([22, 14, 7, 4, 4]);
    expect(
      getXmlNodeStyleSpec("depth", COLOR, 0).shellStyle.backgroundColor
    ).toContain("22%");
    expect(
      getXmlNodeStyleSpec("depth", COLOR, 0).shellStyle.borderColor
    ).toContain("42%");
    expect(
      getXmlNodeStyleSpec("depth", COLOR, 1).shellStyle.borderColor
    ).toContain("34%");
    expect(
      getXmlNodeStyleSpec("depth", COLOR, 2).shellStyle.borderColor
    ).toContain("27%");
    expect(
      getXmlNodeStyleSpec("depth", COLOR, 5).shellStyle.borderColor
    ).toContain("24%");
  });

  it("never paints a solid fill or on-color text", () => {
    for (const style of EXPLORER_NODE_STYLES) {
      const spec = getXmlNodeStyleSpec(style, COLOR, 0);
      expect(spec.shellStyle.backgroundColor).not.toBe(COLOR);
      expect(spec.shellStyle.color).toBeUndefined();
      expect(spec.shellStyle.boxShadow).toBeUndefined();
    }
  });
});

describe("isExplorerNodeStyle", () => {
  it("accepts the four explorer ids and rejects graph ids", () => {
    for (const id of EXPLORER_NODE_STYLES) {
      expect(isExplorerNodeStyle(id)).toBe(true);
    }
    expect(isExplorerNodeStyle("solid")).toBe(false);
    expect(isExplorerNodeStyle("adaptive")).toBe(false);
    expect(isExplorerNodeStyle(undefined)).toBe(false);
  });
});
