import { describe, expect, it } from "vitest";
import { getNodeStyleSpec, QUIET_HEADER_CLASS } from "./node-style";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import { isNodeStyle } from "@/features/settings/services/settings-service";

describe("getNodeStyleSpec", () => {
  it("tinted mixes the object color into the header at every zoom", () => {
    for (const isCompact of [false, true]) {
      const spec = getNodeStyleSpec("tinted", "views", isCompact);
      expect(spec.headerClass).toBe("");
      expect(spec.headerStyle?.backgroundColor).toContain(OBJECT_COLORS.views);
      expect(spec.headerStyle?.backgroundColor).toContain("16%");
      expect(spec.shellStyle).toBeUndefined();
      expect(spec.bodyStyle).toBeUndefined();
      expect(spec.showKindLabel).toBe(true);
      expect(spec.showKindDot).toBe(true);
      expect(spec.nameClass).toBe("text-sm");
    }
  });

  it("surface tints the shell, border, and header", () => {
    const spec = getNodeStyleSpec("surface", "tables");
    expect(spec.shellStyle?.backgroundColor).toContain("12%");
    expect(spec.shellStyle?.borderColor).toContain("45%");
    expect(spec.shellStyle?.borderColor).toContain(OBJECT_COLORS.tables);
    expect(spec.headerStyle?.backgroundColor).toContain("18%");
    expect(spec.showKindLabel).toBe(true);
  });

  it("adaptive expanded is the quiet header with no inline color", () => {
    const spec = getNodeStyleSpec("adaptive", "storedProcedures", false);
    expect(spec.headerClass).toBe(QUIET_HEADER_CLASS);
    expect(spec.headerStyle).toBeUndefined();
    expect(spec.shellStyle).toBeUndefined();
    expect(spec.bodyStyle).toBeUndefined();
    expect(spec.showKindLabel).toBe(true);
    expect(spec.showKindDot).toBe(true);
    expect(spec.kindLabelClass).toBe("text-muted-foreground");
    expect(spec.nameClass).toBe("text-sm");
  });

  it("adaptive compact fills the header, hides the kind row, grows the name", () => {
    const spec = getNodeStyleSpec("adaptive", "triggers", true);
    expect(spec.headerStyle?.backgroundColor).toBe(OBJECT_COLORS.triggers);
    expect(spec.headerStyle?.color).toBe("var(--object-on-color)");
    expect(spec.bodyStyle?.backgroundColor).toContain("28%");
    expect(spec.showKindLabel).toBe(false);
    expect(spec.showKindDot).toBe(false);
    expect(spec.nameClass).toBe("text-base");
  });

  it("solid is a full-color band regardless of compactness", () => {
    for (const isCompact of [false, true]) {
      const spec = getNodeStyleSpec("solid", "scalarFunctions", isCompact);
      expect(spec.headerStyle?.backgroundColor).toBe(
        OBJECT_COLORS.scalarFunctions
      );
      expect(spec.headerStyle?.color).toBe("var(--object-on-color)");
      expect(spec.showKindLabel).toBe(true);
      expect(spec.showKindDot).toBe(false);
      expect(spec.kindLabelClass).toBe("opacity-75");
      expect(spec.bodyStyle).toBeUndefined();
      expect(spec.nameClass).toBe("text-sm");
    }
  });
});

describe("isNodeStyle", () => {
  it("accepts the four known ids", () => {
    for (const id of ["tinted", "surface", "adaptive", "solid"]) {
      expect(isNodeStyle(id)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isNodeStyle("neon")).toBe(false);
    expect(isNodeStyle(undefined)).toBe(false);
    expect(isNodeStyle(3)).toBe(false);
  });
});
