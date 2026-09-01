// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildVisibleTree,
  collectExpandableKeys,
  computeDefaultExpandedIds,
} from "./xml-tree-model";

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml");
}

const SAMPLE = `<order id="42">
  <customer vip="true">
    <name>Acme</name>
    <!-- audited -->
  </customer>
  <lines>
    <line sku="A1"/>
    <line sku="B2"/>
  </lines>
</order>`;

describe("buildVisibleTree", () => {
  it("assigns positional dotted-path ids over whitespace-filtered children", () => {
    const doc = parse(SAMPLE);
    const all = buildVisibleTree(
      doc,
      new Set(["0", "0.0", "0.1"])
    );
    const ids = all.map((n) => n.id);
    expect(ids).toEqual([
      "0",
      "0.0",
      "0.0.0",
      "0.0.1",
      "0.1",
      "0.1.0",
      "0.1.1",
    ]);
    expect(all[0].label).toBe("order");
    expect(all[0].attrs).toEqual([{ name: "id", value: "42" }]);
    expect(all[3].kind).toBe("comment");
    expect(all[3].label).toBe("audited");
  });

  it("excludes collapsed subtrees but keeps the collapsed node", () => {
    const doc = parse(SAMPLE);
    const visible = buildVisibleTree(doc, new Set(["0"]));
    expect(visible.map((n) => n.id)).toEqual(["0", "0.0", "0.1"]);
    const lines = visible[2];
    expect(lines.hasChildren).toBe(true);
    expect(lines.childCount).toBe(2);
    expect(lines.isExpanded).toBe(false);
  });

  it("inlines single-text-child elements into one node", () => {
    const doc = parse(SAMPLE);
    const visible = buildVisibleTree(doc, new Set(["0", "0.0"]));
    const name = visible.find((n) => n.id === "0.0.0");
    expect(name?.label).toBe("name");
    expect(name?.value).toBe("Acme");
    expect(name?.hasChildren).toBe(false);
    expect(visible.some((n) => n.id === "0.0.0.0")).toBe(false);
  });

  it("inlines the title example with attributes intact", () => {
    const doc = parse('<lib><title lang="en">The Great Gatsby</title></lib>');
    const visible = buildVisibleTree(doc, new Set(["0"]));
    expect(visible).toHaveLength(2);
    const title = visible[1];
    expect(title.label).toBe("title");
    expect(title.attrs).toEqual([{ name: "lang", value: "en" }]);
    expect(title.value).toBe("The Great Gatsby");
    expect(title.hasChildren).toBe(false);
  });
});

describe("collectExpandableKeys", () => {
  it("matches the legacy expand-all key set", () => {
    const doc = parse(SAMPLE);
    const keys: string[] = [];
    collectExpandableKeys(doc.documentElement, "0", keys);
    // name has a lone text child, so it renders inlined and is not expandable
    expect(keys).toEqual(["0", "0.0", "0.1"]);
  });
});

describe("computeDefaultExpandedIds", () => {
  it("expands to the depth limit for small documents", () => {
    const doc = parse(SAMPLE);
    const ids = computeDefaultExpandedIds(doc, 3, 400);
    expect([...ids].sort()).toEqual(["0", "0.0", "0.1"]);
  });

  it("backs off to shallower depth when the cap is exceeded", () => {
    const wide = `<root>${Array.from(
      { length: 50 },
      (_, i) => `<group><a>${i}</a><b>${i}</b><c>${i}</c></group>`
    ).join("")}</root>`;
    const doc = parse(wide);
    // depth 3 would show root + 50 groups + 150 children + 150 texts > 200
    const ids = computeDefaultExpandedIds(doc, 3, 200);
    expect(ids.has("0")).toBe(true);
    expect(ids.has("0.0")).toBe(false);
    const visibleCount = buildVisibleTree(doc, ids).length;
    expect(visibleCount).toBeLessThanOrEqual(200);
  });

  it("always accepts root-only expansion", () => {
    const wide = `<root>${Array.from(
      { length: 500 },
      (_, i) => `<item n="${i}"/>`
    ).join("")}</root>`;
    const doc = parse(wide);
    const ids = computeDefaultExpandedIds(doc, 3, 100);
    expect([...ids]).toEqual(["0"]);
  });
});
