import { describe, it, expect } from "vitest";
import { exportScanToJson } from "./scan-json-export";
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

describe("exportScanToJson", () => {
  it("includes metadata wrapper", () => {
    const json = exportScanToJson(makeSummary());
    const parsed = JSON.parse(json);
    expect(parsed.metadata.folderPath).toBe("/data/clients/ABC");
    expect(parsed.metadata.filePattern).toBe("*.xml");
    expect(parsed.metadata.scanDate).toBeTruthy();
    expect(typeof parsed.metadata.totalFiles).toBe("number");
  });

  it("includes all files in files array", () => {
    const json = exportScanToJson(makeSummary());
    const parsed = JSON.parse(json);
    expect(parsed.files).toHaveLength(3);
  });

  it("is valid JSON", () => {
    const json = exportScanToJson(makeSummary());
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
