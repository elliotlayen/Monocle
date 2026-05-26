import { describe, it, expect } from "vitest";
import { formatFileSize } from "./file-size-format";

describe("formatFileSize", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("returns bytes for values below 1024", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("returns '1 KB' for exactly 1024 bytes", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("returns '1.5 KB' for 1536 bytes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("returns '1 MB' for exactly 1048576 bytes", () => {
    expect(formatFileSize(1048576)).toBe("1 MB");
  });

  it("returns '1 GB' for exactly 1073741824 bytes", () => {
    expect(formatFileSize(1073741824)).toBe("1 GB");
  });

  it("returns '2.5 MB' for 2621440 bytes", () => {
    expect(formatFileSize(2621440)).toBe("2.5 MB");
  });

  it("returns '1 B' for 1 byte", () => {
    expect(formatFileSize(1)).toBe("1 B");
  });
});
