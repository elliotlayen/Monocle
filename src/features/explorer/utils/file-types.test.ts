import { describe, expect, it } from "vitest";
import {
  ALL_FILES_ID,
  fileTypeSummary,
  patternToTypeIds,
  typeIdsToPattern,
} from "./file-types";

describe("patternToTypeIds", () => {
  it("maps single known patterns", () => {
    expect(patternToTypeIds("*.xml")).toEqual(["xml"]);
  });

  it("maps comma-separated patterns with whitespace", () => {
    expect(patternToTypeIds("*.xml, *.json")).toEqual(["xml", "json"]);
  });

  it("maps wildcard and empty to all files", () => {
    expect(patternToTypeIds("*")).toEqual([ALL_FILES_ID]);
    expect(patternToTypeIds("*.*")).toEqual([ALL_FILES_ID]);
    expect(patternToTypeIds("")).toEqual([ALL_FILES_ID]);
  });

  it("returns null for custom globs", () => {
    expect(patternToTypeIds("ORD_*.xml")).toBeNull();
    expect(patternToTypeIds("*.xml,ORD_*")).toBeNull();
  });
});

describe("typeIdsToPattern", () => {
  it("composes comma-separated patterns", () => {
    expect(typeIdsToPattern(["xml"])).toBe("*.xml");
    expect(typeIdsToPattern(["xml", "json"])).toBe("*.xml,*.json");
  });

  it("all files wins and empty falls back to everything", () => {
    expect(typeIdsToPattern([ALL_FILES_ID])).toBe("*");
    expect(typeIdsToPattern(["xml", ALL_FILES_ID])).toBe("*");
    expect(typeIdsToPattern([])).toBe("*");
  });
});

describe("fileTypeSummary", () => {
  it("labels one or two types directly", () => {
    expect(fileTypeSummary("*.xml")).toBe("XML");
    expect(fileTypeSummary("*.xml,*.json")).toBe("XML, JSON");
  });

  it("collapses three or more types", () => {
    expect(fileTypeSummary("*.xml,*.json,*.csv")).toBe("XML +2");
  });

  it("labels all files and passes custom globs through", () => {
    expect(fileTypeSummary("*")).toBe("All files");
    expect(fileTypeSummary("ORD_*.xml")).toBe("ORD_*.xml");
  });
});
