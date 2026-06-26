import { describe, it, expect, afterEach, vi } from "vitest";
import { initiativeCommand } from "../src/commands/initiative.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("initiative list", () => {
  it("lists initiatives with status", async () => {
    stubGraphQL({
      initiatives: {
        nodes: [{ id: "i1", name: "Q3 Goals", status: "Active" }],
        pageInfo: { hasNextPage: false },
      },
    });
    const out = await initiativeCommand(["list"], TEST_CTX);
    expect(out).toMatch(/Q3 Goals/);
    expect(out).toMatch(/Active/);
    expect(out).toMatch(/count: 1/);
  });
});

describe("initiative view", () => {
  it("shows an initiative with its projects", async () => {
    stubGraphQL(
      { initiatives: { nodes: [{ id: "i1", name: "Q3 Goals" }] } },
      {
        initiative: {
          name: "Q3 Goals",
          description: "Big goals",
          status: "Active",
          targetDate: "2026-09-30",
          projects: { nodes: [{ name: "Launch", state: "started" }] },
        },
      },
    );
    const out = await initiativeCommand(["view", "Q3 Goals"], TEST_CTX);
    expect(out).toMatch(/Q3 Goals/);
    expect(out).toMatch(/Launch/);
  });

  it("renders the full description without a truncation hint under --full", async () => {
    stubGraphQL(
      { initiatives: { nodes: [{ id: "i1", name: "Q3 Goals" }] } },
      {
        initiative: {
          name: "Q3 Goals",
          description: "B".repeat(2000),
          status: "Active",
          targetDate: "2026-09-30",
          projects: { nodes: [] },
        },
      },
    );
    const out = await initiativeCommand(
      ["view", "Q3 Goals", "--full"],
      TEST_CTX,
    );
    expect(out).not.toMatch(/truncated/);
    expect(out).toMatch(/B{2000}/);
  });

  it("throws NOT_FOUND for an unknown initiative", async () => {
    stubGraphQL({ initiatives: { nodes: [] } });
    await expect(
      initiativeCommand(["view", "ghost"], TEST_CTX),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires a query for view", async () => {
    await expect(initiativeCommand(["view"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
