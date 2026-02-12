import { beforeEach, describe, expect, it } from "vitest";
import {
  loadConnectionSettings,
  saveConnectionSettings,
} from "./connection-settings";

const createLocalStorageMock = (): Storage => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
};

describe("connection settings persistence", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: createLocalStorageMock(),
    });
  });

  it("loads valid saved settings", () => {
    localStorage.setItem(
      "monocle-connection-settings",
      JSON.stringify({
        server: "localhost",
        authType: "sqlServer",
        username: "sa",
      })
    );

    expect(loadConnectionSettings()).toEqual({
      server: "localhost",
      authType: "sqlServer",
      username: "sa",
    });
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem("monocle-connection-settings", "{not-json");
    expect(loadConnectionSettings()).toBeNull();
  });

  it("saves without username for windows auth", () => {
    saveConnectionSettings({
      server: "db-host",
      authType: "windows",
      username: "ignored-user",
    });

    expect(
      JSON.parse(localStorage.getItem("monocle-connection-settings") ?? "{}")
    ).toEqual({
      server: "db-host",
      authType: "windows",
    });
  });

  it("saves username for sql server auth only", () => {
    saveConnectionSettings({
      server: "db-host",
      authType: "sqlServer",
      username: "sa",
    });

    expect(
      JSON.parse(localStorage.getItem("monocle-connection-settings") ?? "{}")
    ).toEqual({
      server: "db-host",
      authType: "sqlServer",
      username: "sa",
    });
  });
});
