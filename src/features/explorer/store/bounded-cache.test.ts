import { describe, expect, it } from "vitest";
import { appendBounded } from "./bounded-cache";

describe("appendBounded", () => {
  it("appends entries without mutating the input map", () => {
    const cache = new Map([["a", 1]]);
    const next = appendBounded(cache, [["b", 2]], 10);

    expect(cache.size).toBe(1);
    expect(next.get("a")).toBe(1);
    expect(next.get("b")).toBe(2);
  });

  it("evicts the oldest entries beyond the cap", () => {
    const cache = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const next = appendBounded(
      cache,
      [
        ["c", 3],
        ["d", 4],
      ],
      3
    );

    expect(next.size).toBe(3);
    expect(next.has("a")).toBe(false);
    expect([...next.keys()]).toEqual(["b", "c", "d"]);
  });

  it("refreshes recency for re-inserted keys", () => {
    const cache = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const next = appendBounded(cache, [["a", 10]], 3);

    expect(next.size).toBe(3);
    expect([...next.keys()]).toEqual(["b", "c", "a"]);
    expect(next.get("a")).toBe(10);
  });

  it("handles bulk inserts larger than the cap", () => {
    const entries: Array<readonly [string, number]> = [];
    for (let i = 0; i < 10; i++) entries.push([`k${i}`, i]);
    const next = appendBounded(new Map<string, number>(), entries, 4);

    expect(next.size).toBe(4);
    expect([...next.keys()]).toEqual(["k6", "k7", "k8", "k9"]);
  });
});
