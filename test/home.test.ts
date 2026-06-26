import { describe, it, expect } from "vitest";
import { homeCommand } from "../src/commands/home.js";

describe("homeCommand", () => {
  it("renders a scaffold dashboard with next-step hints", async () => {
    const out = await homeCommand([], { apiKeyPresent: false });

    expect(out).toContain("status: scaffold");
    expect(out).toContain("help[");
    expect(out).toContain("setup hooks");
    expect(out).toContain("Set LINEAR_API_KEY");
  });

  it("reflects a detected API key and drops the set-key hint", async () => {
    const out = await homeCommand([], { apiKeyPresent: true });

    expect(out).toContain("LINEAR_API_KEY detected");
    expect(out).not.toContain("Set LINEAR_API_KEY");
  });
});
