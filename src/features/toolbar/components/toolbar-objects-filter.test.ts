import { describe, expect, it, vi } from "vitest";
import {
  createDefaultExpandedFocusSections,
  createDefaultExpandedObjectSections,
  filterRowsBySearch,
  formatSectionCountLabel,
  getTypeOffSelectionToggleIds,
  getSectionSelectionState,
  isObjectSectionExpanded,
  mergeRowsById,
  shouldRenderObjectSection,
  sortRowsById,
  shouldToggleSectionFromKey,
  stopSectionHeaderToggle,
} from "./toolbar";

describe("toolbar objects filter helpers", () => {
  it("starts with all sections collapsed", () => {
    expect(createDefaultExpandedObjectSections()).toEqual({
      tables: false,
      views: false,
      triggers: false,
      storedProcedures: false,
      scalarFunctions: false,
    });
  });

  it("starts focus sections expanded", () => {
    expect(createDefaultExpandedFocusSections()).toEqual({
      tables: true,
      views: true,
      triggers: true,
      storedProcedures: true,
      scalarFunctions: true,
    });
  });

  it("auto-expands only sections with matches when searching", () => {
    expect(isObjectSectionExpanded(false, "orders", 1)).toBe(true);
    expect(isObjectSectionExpanded(true, "orders", 0)).toBe(false);
    expect(isObjectSectionExpanded(true, "", 0)).toBe(true);
  });

  it("renders object sections only when there are visible rows", () => {
    expect(shouldRenderObjectSection(0)).toBe(false);
    expect(shouldRenderObjectSection(1)).toBe(true);
  });

  it("filters focus rows by case-insensitive id match", () => {
    const rows = [
      { id: "dbo.Customers" },
      { id: "dbo.orders" },
      { id: "dbo.Products" },
    ];
    expect(filterRowsBySearch(rows, "CUSTOMERS")).toEqual([
      { id: "dbo.Customers" },
    ]);
    expect(filterRowsBySearch(rows, "   ")).toEqual(rows);
  });

  it("sorts rows alphabetically by id with case-insensitive comparison", () => {
    const rows = [
      { id: "dbo.orders" },
      { id: "dbo.Customers" },
      { id: "dbo.audit" },
    ];

    expect(sortRowsById(rows).map((item) => item.id)).toEqual([
      "dbo.audit",
      "dbo.Customers",
      "dbo.orders",
    ]);
  });

  it("keeps focus search results sorted alphabetically within a section", () => {
    const rows = [
      { id: "dbo.Products" },
      { id: "dbo.customers" },
      { id: "dbo.Orders" },
    ];

    expect(sortRowsById(filterRowsBySearch(rows, "dbo")).map((item) => item.id))
      .toEqual(["dbo.customers", "dbo.Orders", "dbo.Products"]);
  });

  it("keeps object filter rows sorted with and without local filter text", () => {
    const rows = mergeRowsById(
      [{ id: "dbo.orders" }, { id: "dbo.Customers" }, { id: "dbo.audit" }],
      []
    );

    const sortedAll = sortRowsById(rows);
    expect(sortedAll.map((item) => item.id)).toEqual([
      "dbo.audit",
      "dbo.Customers",
      "dbo.orders",
    ]);

    const filtered = sortedAll.filter((item) =>
      item.id.toLowerCase().includes("s")
    );
    expect(filtered.map((item) => item.id)).toEqual([
      "dbo.Customers",
      "dbo.orders",
    ]);
  });

  it("keeps excluded rows available without duplicates", () => {
    const merged = mergeRowsById(
      [{ id: "dbo.orders" }, { id: "dbo.customers" }],
      [{ id: "dbo.customers" }, { id: "dbo.orders" }]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.id).sort()).toEqual([
      "dbo.customers",
      "dbo.orders",
    ]);
  });

  it("derives selected counts and checked state from exclusions", () => {
    const state = getSectionSelectionState(
      [{ id: "dbo.view_1" }, { id: "dbo.view_2" }, { id: "dbo.view_3" }],
      new Set(["dbo.view_2"]),
      true
    );

    expect(state.totalCount).toBe(3);
    expect(state.selectedCount).toBe(2);
    expect(state.sectionChecked).toBe(true);
  });

  it("marks section unchecked when selected count reaches zero", () => {
    const state = getSectionSelectionState(
      [{ id: "dbo.view_1" }, { id: "dbo.view_2" }],
      new Set(["dbo.view_1", "dbo.view_2"]),
      true
    );

    expect(state.selectedCount).toBe(0);
    expect(state.sectionChecked).toBe(false);
  });

  it("keeps section unchecked with zero selected when type is disabled", () => {
    const state = getSectionSelectionState(
      [{ id: "dbo.view_1" }, { id: "dbo.view_2" }, { id: "dbo.view_3" }],
      new Set(),
      false
    );

    expect(state.totalCount).toBe(3);
    expect(state.selectedCount).toBe(0);
    expect(state.sectionChecked).toBe(false);
  });

  it("derives type-off reselection toggles for rows that need state changes", () => {
    const idsToToggle = getTypeOffSelectionToggleIds(
      [{ id: "dbo.view_1" }, { id: "dbo.view_2" }, { id: "dbo.view_3" }],
      new Set(["dbo.view_2"]),
      "dbo.view_1"
    );

    expect(idsToToggle).toEqual(["dbo.view_3"]);
  });

  it("shows expected selected count after picking two rows", () => {
    const state = getSectionSelectionState(
      [{ id: "dbo.view_1" }, { id: "dbo.view_2" }, { id: "dbo.view_3" }],
      new Set(["dbo.view_3"]),
      true
    );

    expect(state.selectedCount).toBe(2);
    expect(state.totalCount).toBe(3);
    expect(state.sectionChecked).toBe(true);
  });

  it("formats section count label next to name", () => {
    expect(formatSectionCountLabel("Views", 2, 3)).toBe("Views (2/3)");
    expect(formatSectionCountLabel("Views", 0, 0)).toBe("Views (0/0)");
  });

  it("supports keyboard header toggles and checkbox click guard", () => {
    expect(shouldToggleSectionFromKey("Enter")).toBe(true);
    expect(shouldToggleSectionFromKey(" ")).toBe(true);
    expect(shouldToggleSectionFromKey("Escape")).toBe(false);

    const stopPropagation = vi.fn();
    stopSectionHeaderToggle({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
  });
});
