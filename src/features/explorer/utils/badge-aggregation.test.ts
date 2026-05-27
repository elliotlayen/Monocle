import { describe, it, expect } from "vitest";
import { computeAggregateBadges, computeAggregateBadge } from "./badge-aggregation";
import type { ScanFileResult, ValidationProblem } from "../types";

function makeFile(
  filePath: string,
  status: "clean" | "error" | "warning"
): ScanFileResult {
  const problems: ValidationProblem[] = [];
  if (status === "error") {
    problems.push({
      line: 1,
      column: 1,
      endColumn: 2,
      message: "Test error",
      severity: "error",
      code: "test-error",
    });
  } else if (status === "warning") {
    problems.push({
      line: 1,
      column: 1,
      endColumn: 2,
      message: "Test warning",
      severity: "warning",
      code: "test-warning",
    });
  }

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
  return {
    filePath,
    fileName,
    relativePath: filePath,
    status,
    problems,
    encoding: "UTF-8",
    hasBom: false,
  };
}

describe("computeAggregateBadges", () => {
  it("returns error for folder containing error file", () => {
    const files = [makeFile("/root/a/file.xml", "error")];
    const result = computeAggregateBadges(files, "/root");

    expect(result.get("/root/a")).toBe("error");
    expect(result.get("/root")).toBe("error");
  });

  it("returns warning when worst is warning", () => {
    const files = [
      makeFile("/root/a/file1.xml", "warning"),
      makeFile("/root/a/file2.xml", "clean"),
    ];
    const result = computeAggregateBadges(files, "/root");

    expect(result.get("/root/a")).toBe("warning");
    expect(result.get("/root")).toBe("warning");
  });

  it("returns clean when all files clean", () => {
    const files = [
      makeFile("/root/a/file1.xml", "clean"),
      makeFile("/root/a/file2.xml", "clean"),
    ];
    const result = computeAggregateBadges(files, "/root");

    expect(result.get("/root/a")).toBe("clean");
    expect(result.get("/root")).toBe("clean");
  });

  it("propagates worst severity upward", () => {
    const files = [makeFile("/root/a/b/c/deep.xml", "error")];
    const result = computeAggregateBadges(files, "/root");

    expect(result.get("/root/a/b/c")).toBe("error");
    expect(result.get("/root/a/b")).toBe("error");
    expect(result.get("/root/a")).toBe("error");
    expect(result.get("/root")).toBe("error");
  });

  it("handles mixed separators", () => {
    const files = [makeFile("C:\\root\\a\\file.xml", "warning")];
    const result = computeAggregateBadges(files, "C:\\root");

    expect(result.get("C:\\root\\a")).toBe("warning");
    expect(result.get("C:\\root")).toBe("warning");
  });
});

describe("computeAggregateBadge", () => {
  it("returns undefined for folder with no cached files", () => {
    const cache = new Map<string, { problems: ValidationProblem[] }>();
    cache.set("/other/file.xml", { problems: [] });

    const result = computeAggregateBadge("/root", cache);
    expect(result).toBeUndefined();
  });
});
