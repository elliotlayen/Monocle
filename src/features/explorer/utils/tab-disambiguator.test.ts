import { describe, it, expect } from "vitest";
import { disambiguateTabNames } from "./tab-disambiguator";

describe("disambiguateTabNames", () => {
  it("returns filename unchanged when all filenames are unique", () => {
    const tabs = [
      { filePath: "/root/client1/20251223/file1.xml" },
      { filePath: "/root/client2/20251224/file2.xml" },
    ];
    const result = disambiguateTabNames(tabs);
    expect(result.get("/root/client1/20251223/file1.xml")).toBe("file1.xml");
    expect(result.get("/root/client2/20251224/file2.xml")).toBe("file2.xml");
  });

  it("appends parent folder for duplicate filenames", () => {
    const tabs = [
      { filePath: "/root/client1/20251223/file1.xml" },
      { filePath: "/root/client1/20251224/file1.xml" },
    ];
    const result = disambiguateTabNames(tabs);
    expect(result.get("/root/client1/20251223/file1.xml")).toBe(
      "file1.xml - 20251223"
    );
    expect(result.get("/root/client1/20251224/file1.xml")).toBe(
      "file1.xml - 20251224"
    );
  });

  it("returns just the filename for a single file", () => {
    const tabs = [{ filePath: "/root/client1/20251223/file1.xml" }];
    const result = disambiguateTabNames(tabs);
    expect(result.get("/root/client1/20251223/file1.xml")).toBe("file1.xml");
  });

  it("handles Windows-style backslash paths", () => {
    const tabs = [
      { filePath: "C:\\Data\\client1\\20251223\\file1.xml" },
      { filePath: "C:\\Data\\client1\\20251224\\file1.xml" },
    ];
    const result = disambiguateTabNames(tabs);
    expect(result.get("C:\\Data\\client1\\20251223\\file1.xml")).toBe(
      "file1.xml - 20251223"
    );
    expect(result.get("C:\\Data\\client1\\20251224\\file1.xml")).toBe(
      "file1.xml - 20251224"
    );
  });

  it("handles mixed unique and duplicate filenames", () => {
    const tabs = [
      { filePath: "/root/a/file1.xml" },
      { filePath: "/root/b/file1.xml" },
      { filePath: "/root/c/file2.xml" },
    ];
    const result = disambiguateTabNames(tabs);
    expect(result.get("/root/a/file1.xml")).toBe("file1.xml - a");
    expect(result.get("/root/b/file1.xml")).toBe("file1.xml - b");
    expect(result.get("/root/c/file2.xml")).toBe("file2.xml");
  });
});
