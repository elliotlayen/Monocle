import { describe, expect, it } from "vitest";
import {
  getFocusTransition,
  isFocusSessionActive,
  shouldForceEdgeFlush,
  type FocusSnapshot,
} from "./focus-transition";

describe("focus-transition helpers", () => {
  it("detects an enter transition", () => {
    const previous: FocusSnapshot = { focusedTableId: null };
    const next: FocusSnapshot = { focusedTableId: "dbo.orders" };
    expect(getFocusTransition(previous, next)).toBe("enter");
  });

  it("detects an exit transition", () => {
    const previous: FocusSnapshot = { focusedTableId: "dbo.orders" };
    const next: FocusSnapshot = { focusedTableId: null };
    expect(getFocusTransition(previous, next)).toBe("exit");
  });

  it("detects focus target changes", () => {
    const previous: FocusSnapshot = { focusedTableId: "dbo.orders" };
    const next: FocusSnapshot = { focusedTableId: "dbo.customers" };
    expect(getFocusTransition(previous, next)).toBe("target-change");
  });

  it("returns none for filter/zoom equivalent focus states", () => {
    const previous: FocusSnapshot = { focusedTableId: "dbo.orders" };
    const next: FocusSnapshot = { focusedTableId: "dbo.orders" };
    expect(getFocusTransition(previous, next)).toBe("none");
  });

  it("treats any focused table as active focus session", () => {
    expect(isFocusSessionActive(null)).toBe(false);
    expect(isFocusSessionActive("dbo.orders")).toBe(true);
  });

  it("forces flush only for enter/exit/target-change", () => {
    expect(shouldForceEdgeFlush("enter")).toBe(true);
    expect(shouldForceEdgeFlush("exit")).toBe(true);
    expect(shouldForceEdgeFlush("target-change")).toBe(true);
    expect(shouldForceEdgeFlush("none")).toBe(false);
  });
});
