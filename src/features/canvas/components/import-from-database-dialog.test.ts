import { describe, expect, it } from "vitest";
import {
  getImportSectionCounts,
  isImportSectionFullySelected,
} from "./import-from-database-dialog";
import {
  buildImportConnectionIdentity,
  getImportSessionStep,
  resolveSelectedDatabaseAfterConnect,
  shouldInvalidateImportSession,
} from "./import-from-database-dialog-state";

describe("import from database section count helpers", () => {
  it("updates selected/total counts as rows are selected", () => {
    const items = [{ id: "dbo.Users" }, { id: "dbo.Orders" }];

    const initial = getImportSectionCounts(items, new Set());
    expect(initial.totalCount).toBe(2);
    expect(initial.selectedCount).toBe(0);

    const afterOneSelection = getImportSectionCounts(
      items,
      new Set(["dbo.Users"])
    );
    expect(afterOneSelection.totalCount).toBe(2);
    expect(afterOneSelection.selectedCount).toBe(1);

    const afterTwoSelections = getImportSectionCounts(
      items,
      new Set(["dbo.Users", "dbo.Orders"])
    );
    expect(afterTwoSelections.totalCount).toBe(2);
    expect(afterTwoSelections.selectedCount).toBe(2);
  });

  it("keeps selected/total based on full section, independent of visible filtering", () => {
    const items = [
      { id: "dbo.Users" },
      { id: "dbo.Orders" },
      { id: "dbo.Products" },
    ];
    const selectedIds = new Set(["dbo.Products"]);

    const counts = getImportSectionCounts(items, selectedIds);
    expect(counts.totalCount).toBe(3);
    expect(counts.selectedCount).toBe(1);

    const visibleFilteredItems = [{ id: "dbo.Users" }, { id: "dbo.Orders" }];
    expect(isImportSectionFullySelected(visibleFilteredItems, selectedIds)).toBe(
      false
    );
  });

  it("treats section checkbox checked state as visible rows only", () => {
    const selectedIds = new Set(["dbo.Users", "dbo.Orders"]);

    const visibleRows = [{ id: "dbo.Users" }, { id: "dbo.Orders" }];
    expect(isImportSectionFullySelected(visibleRows, selectedIds)).toBe(true);

    const notFullySelectedVisibleRows = [
      { id: "dbo.Users" },
      { id: "dbo.Products" },
    ];
    expect(
      isImportSectionFullySelected(notFullySelectedVisibleRows, selectedIds)
    ).toBe(false);
  });

  it("returns safe 0/0 counts for empty sections", () => {
    const counts = getImportSectionCounts([], new Set(["dbo.Users"]));
    expect(counts.totalCount).toBe(0);
    expect(counts.selectedCount).toBe(0);
  });
});

describe("import from database session state helpers", () => {
  it("resolves close/open step based on cached databases", () => {
    expect(getImportSessionStep(true)).toBe("database");
    expect(getImportSessionStep(false)).toBe("connect");
  });

  it("invalidates cached session when connection identity changes", () => {
    const previous = buildImportConnectionIdentity({
      server: "localhost",
      authType: "sqlServer",
      username: "sa",
      trustServerCertificate: true,
    });

    const next = buildImportConnectionIdentity({
      server: "localhost,1433",
      authType: "sqlServer",
      username: "sa",
      trustServerCertificate: true,
    });

    expect(shouldInvalidateImportSession(previous, next)).toBe(true);
  });

  it("does not invalidate cached session when connection identity is unchanged", () => {
    const previous = buildImportConnectionIdentity({
      server: "localhost",
      authType: "sqlServer",
      username: "sa",
      trustServerCertificate: true,
    });

    const next = buildImportConnectionIdentity({
      server: "localhost",
      authType: "sqlServer",
      username: "sa",
      trustServerCertificate: true,
    });

    expect(shouldInvalidateImportSession(previous, next)).toBe(false);
  });

  it("keeps selected database after reconnect when still available", () => {
    const selected = resolveSelectedDatabaseAfterConnect(
      ["master", "appdb", "analytics"],
      "appdb"
    );

    expect(selected).toBe("appdb");
  });

  it("falls back to first database when previous selection is unavailable", () => {
    const selected = resolveSelectedDatabaseAfterConnect(
      ["master", "appdb"],
      "missingdb"
    );

    expect(selected).toBe("master");
  });
});
