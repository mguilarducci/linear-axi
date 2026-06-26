import { describe, it, expect, afterEach, vi } from "vitest";
import { homeCommand } from "../src/commands/home.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("homeCommand", () => {
  it("shows setup guidance and makes no request when no API key is set", async () => {
    const fetchMock = stubGraphQL();
    const out = await homeCommand([], { apiKeyPresent: false });
    expect(out).toMatch(/LINEAR_API_KEY/);
    expect(out).toMatch(/setup hooks/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders a live dashboard when authenticated", async () => {
    stubGraphQL({
      viewer: {
        displayName: "mat",
        assignedIssues: {
          nodes: [
            {
              identifier: "ENG-1",
              title: "Fix auth",
              state: { name: "In Progress" },
            },
          ],
        },
      },
      teams: { nodes: [{ key: "ENG", name: "Engineering" }] },
    });
    const out = await homeCommand([], TEST_CTX);
    expect(out).toMatch(/mat/);
    expect(out).toMatch(/ENG-1/);
    expect(out).toMatch(/Engineering/);
    expect(out).toMatch(/help\[/);
  });

  it("degrades gracefully (no throw) when the API call fails", async () => {
    const fn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [
          { message: "Auth", extensions: { type: "authentication error" } },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fn);
    const out = await homeCommand([], TEST_CTX);
    expect(out).toMatch(/LINEAR_API_KEY/);
  });
});
