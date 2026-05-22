import { describe, it, expect } from "vitest";
import { formatDateFolder } from "./date-format";

describe("formatDateFolder", () => {
  it("formats a valid YYYYMMDD date string", () => {
    const result = formatDateFolder("20251223");
    expect(result.raw).toBe("20251223");
    expect(result.formatted).toBe("Dec 23, 2025");
  });

  it("returns null for an invalid date (month 13)", () => {
    const result = formatDateFolder("20251332");
    expect(result.raw).toBe("20251332");
    expect(result.formatted).toBeNull();
  });

  it("returns null for a non-date string", () => {
    const result = formatDateFolder("archive");
    expect(result.raw).toBe("archive");
    expect(result.formatted).toBeNull();
  });

  it("returns null for a 7-digit string", () => {
    const result = formatDateFolder("2025123");
    expect(result.raw).toBe("2025123");
    expect(result.formatted).toBeNull();
  });

  it("returns null for a 9-digit string", () => {
    const result = formatDateFolder("202512231");
    expect(result.raw).toBe("202512231");
    expect(result.formatted).toBeNull();
  });

  it("formats a leap year date correctly", () => {
    const result = formatDateFolder("20240229");
    expect(result.raw).toBe("20240229");
    expect(result.formatted).toBe("Feb 29, 2024");
  });

  it("returns null for Feb 29 on a non-leap year", () => {
    const result = formatDateFolder("20250229");
    expect(result.raw).toBe("20250229");
    expect(result.formatted).toBeNull();
  });
});
