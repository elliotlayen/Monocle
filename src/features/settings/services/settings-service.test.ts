import { beforeEach, describe, expect, it, vi } from "vitest";
import { settingsService } from "./settings-service";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("settingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests settings via get_settings", async () => {
    await settingsService.getSettings();
    expect(invoke).toHaveBeenCalledWith("get_settings");
  });

  it("sends partial updates to save_settings", async () => {
    await settingsService.saveSettings({ theme: "dark" });
    expect(invoke).toHaveBeenCalledWith("save_settings", {
      settings: { theme: "dark" },
    });
  });
});
