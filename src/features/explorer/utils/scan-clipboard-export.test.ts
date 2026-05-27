import { describe, it, expect } from "vitest";
import { formatScanAsText, formatScanAsMarkdown } from "./scan-clipboard-export";
import type { ScanSummary } from "../types";

function makeSummary(
  overrides: Partial<ScanSummary> = {}
): ScanSummary {
  return {
    folderPath: "/data/clients/ABC",
    filePattern: "*.xml",
    totalFiles: 3,
    errorFiles: 1,
    warningFiles: 1,
    cleanFiles: 1,
    totalErrors: 2,
    totalWarnings: 1,
    cancelled: false,
    files: [
      {
        filePath: "/data/clients/ABC/20250101/a.xml",
        fileName: "a.xml",
        relativePath: "20250101/a.xml",
        status: "error",
        encoding: "UTF-8",
        hasBom: false,
        problems: [
          { line: 1, column: 5, endColumn: 6, message: "Bad char", severity: "error", code: "ILLEGAL_CHAR" },
          { line: 3, column: 10, endColumn: 11, message: "Bad char 2", severity: "error", code: "ILLEGAL_CHAR" },
        ],
      },
      {
        filePath: "/data/clients/ABC/20250101/b.xml",
        fileName: "b.xml",
        relativePath: "20250101/b.xml",
        status: "warning",
        encoding: "UTF-8",
        hasBom: true,
        problems: [
          { line: 1, column: 1, endColumn: 4, message: "BOM detected", severity: "warning", code: "BOM" },
        ],
      },
      {
        filePath: "/data/clients/ABC/20250101/c.xml",
        fileName: "c.xml",
        relativePath: "20250101/c.xml",
        status: "clean",
        encoding: "UTF-8",
        hasBom: false,
        problems: [],
      },
    ],
    ...overrides,
  };
}

describe("formatScanAsText", () => {
  it("includes header and summary", () => {
    const text = formatScanAsText(makeSummary());
    expect(text).toContain("Scan Report -");
    expect(text).toContain("Summary:");
  });

  it("lists only files with problems", () => {
    const text = formatScanAsText(makeSummary());
    const detailLines = text
      .split("\n")
      .filter((line) => line.trimStart().startsWith("[ERROR]") || line.trimStart().startsWith("[WARN]"));
    // 2 files with issues (a.xml = error, b.xml = warning), c.xml is clean and excluded
    expect(detailLines).toHaveLength(2);
  });
});

describe("formatScanAsMarkdown", () => {
  it("produces valid markdown table", () => {
    const md = formatScanAsMarkdown(makeSummary());
    expect(md).toContain("| File | Status |");
    expect(md).toContain("| --- |");
  });

  it("includes metadata bullets", () => {
    const md = formatScanAsMarkdown(makeSummary());
    expect(md).toContain("- **Folder:**");
    expect(md).toContain("- **Pattern:**");
  });
});
