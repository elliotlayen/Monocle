import { describe, expect, it } from "vitest";
import {
  FILE_TYPE_OPTIONS,
  coversAllTypes,
  fileTypeSummary,
  patternToTypeIds,
  typeIdsToPattern,
} from "./file-types";

const allIds = FILE_TYPE_OPTIONS.map((o) => o.id);

describe("patternToTypeIds", () => {
  it("maps single known patterns", () => {
    expect(patternToTypeIds("*.xml")).toEqual(["xml"]);
  });

  it("maps comma-separated patterns with whitespace", () => {
    expect(patternToTypeIds("*.xml, *.json")).toEqual(["xml", "json"]);
  });

  it("maps wildcard and empty to every type checked", () => {
    expect(patternToTypeIds("*")).toEqual(allIds);
    expect(patternToTypeIds("*.*")).toEqual(allIds);
    expect(patternToTypeIds("")).toEqual(allIds);
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

  it("collapses a full set of types to the wildcard", () => {
    expect(typeIdsToPattern(allIds)).toBe("*");
    expect(typeIdsToPattern([])).toBe("*");
  });

  it("round-trips manually checking every type back to all files", () => {
    const ids = patternToTypeIds(typeIdsToPattern(allIds));
    expect(ids).toEqual(allIds);
    expect(coversAllTypes(ids ?? [])).toBe(true);
  });
});

describe("coversAllTypes", () => {
  it("is true only when every type is present", () => {
    expect(coversAllTypes(allIds)).toBe(true);
    expect(coversAllTypes(allIds.slice(1))).toBe(false);
    expect(coversAllTypes([])).toBe(false);
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

  it("labels all types and passes custom globs through", () => {
    expect(fileTypeSummary("*")).toBe("All types");
    expect(fileTypeSummary("ORD_*.xml")).toBe("ORD_*.xml");
  });
});
