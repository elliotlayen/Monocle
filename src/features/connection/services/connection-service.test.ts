import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectionService } from "./connection-service";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("connectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes connection fields to save_connection", async () => {
    await connectionService.saveConnection({
      server: "localhost",
      database: "Monocle",
      username: "sa",
    });

    expect(invoke).toHaveBeenCalledWith("save_connection", {
      server: "localhost",
      database: "Monocle",
      username: "sa",
    });
  });
});
