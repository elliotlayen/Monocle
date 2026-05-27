import { describe, it, expect } from "vitest";
import { exportScanToCsv, escapeCsv } from "./scan-csv-export";
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
    files: [],
    ...overrides,
  };
}

describe("exportScanToCsv", () => {
  it("includes metadata comments", () => {
    const result = exportScanToCsv(makeSummary());
    expect(result).toContain("# Scan Report");
    expect(result).toContain("# Folder: /data/clients/ABC");
    expect(result).toContain("# Pattern: *.xml");
    expect(result).toContain("# Date:");
    expect(result).toContain("# Total Files: 3");
  });

  it("produces one row per problem", () => {
    const summary = makeSummary({
      files: [
        {
          filePath: "/data/clients/ABC/20250101/a.xml",
          fileName: "a.xml",
          relativePath: "20250101/a.xml",
          status: "error",
          encoding: "UTF-8",
          hasBom: false,
          problems: [
            { line: 1, column: 5, endColumn: 6, message: "Bad char &", severity: "error", code: "ILLEGAL_CHAR" },
            { line: 3, column: 10, endColumn: 11, message: "Bad char <", severity: "error", code: "ILLEGAL_CHAR" },
            { line: 7, column: 1, endColumn: 2, message: "BOM detected", severity: "warning", code: "BOM" },
          ],
        },
      ],
    });

    const csv = exportScanToCsv(summary);
    const dataLines = csv
      .split("\n")
      .filter((line) => !line.startsWith("#") && line.trim() !== "" && !line.startsWith("File Path"));
    expect(dataLines).toHaveLength(3);
  });

  it("includes clean files with Clean severity", () => {
    const summary = makeSummary({
      files: [
        {
          filePath: "/data/clients/ABC/20250101/clean.xml",
          fileName: "clean.xml",
          relativePath: "20250101/clean.xml",
          status: "clean",
          encoding: "UTF-8",
          hasBom: false,
          problems: [],
        },
      ],
    });

    const csv = exportScanToCsv(summary);
    const dataLines = csv
      .split("\n")
      .filter((line) => !line.startsWith("#") && line.trim() !== "" && !line.startsWith("File Path"));
    expect(dataLines).toHaveLength(1);
    expect(dataLines[0]).toContain("Clean");
  });

  it("escapeCsv handles commas and quotes", () => {
    expect(escapeCsv("hello,world")).toBe('"hello,world"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsv("simple")).toBe("simple");
  });
});
