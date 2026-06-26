import { describe, it, expect, afterEach, vi } from "vitest";
import { cycleCommand } from "../src/commands/cycle.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

const TEAM_NODE = { id: "t-eng", key: "ENG", name: "Engineering" };
const SPRINT = {
  number: 3,
  name: "Sprint 3",
  startsAt: "2026-06-20",
  endsAt: "2026-07-01",
  progress: 0.4,
};

describe("cycle list", () => {
  it("lists a team's cycles with progress", async () => {
    stubGraphQL(
      { teams: { nodes: [TEAM_NODE] } },
      { team: { cycles: { nodes: [SPRINT] } } },
    );
    const out = await cycleCommand(["list", "--team", "ENG"], TEST_CTX);
    expect(out).toMatch(/Sprint 3/);
    expect(out).toMatch(/40%/);
    expect(out).toMatch(/count: 1/);
  });
});

describe("cycle view", () => {
  it("shows the team's active cycle", async () => {
    stubGraphQL(
      { teams: { nodes: [TEAM_NODE] } },
      { team: { activeCycle: SPRINT } },
    );
    const out = await cycleCommand(["view", "--team", "ENG"], TEST_CTX);
    expect(out).toMatch(/Sprint 3/);
    expect(out).toMatch(/40%/);
  });

  it("states clearly when there is no active cycle", async () => {
    stubGraphQL(
      { teams: { nodes: [TEAM_NODE] } },
      { team: { activeCycle: null } },
    );
    const out = await cycleCommand(["view", "--team", "ENG"], TEST_CTX);
    expect(out).toMatch(/no active cycle/i);
  });
});
