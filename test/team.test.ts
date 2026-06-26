import { describe, it, expect, afterEach, vi } from "vitest";
import { AxiError } from "axi-sdk-js";
import { teamCommand, resolveTeamId } from "../src/commands/team.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

const TEAMS = (...teams: Array<{ id: string; key: string; name: string }>) => ({
  teams: { nodes: teams },
});

describe("resolveTeamId", () => {
  it("resolves an explicit team key to its id", async () => {
    stubGraphQL(
      TEAMS(
        { id: "t-eng", key: "ENG", name: "Engineering" },
        { id: "t-ops", key: "OPS", name: "Operations" },
      ),
    );
    const team = await resolveTeamId(TEST_CTX, "ENG");
    expect(team.id).toBe("t-eng");
  });

  it("matches a team key case-insensitively", async () => {
    stubGraphQL(TEAMS({ id: "t-eng", key: "ENG", name: "Engineering" }));
    const team = await resolveTeamId(TEST_CTX, "eng");
    expect(team.id).toBe("t-eng");
  });

  it("auto-picks the only team when none is specified", async () => {
    stubGraphQL(TEAMS({ id: "t-eng", key: "ENG", name: "Engineering" }));
    const team = await resolveTeamId(TEST_CTX);
    expect(team.key).toBe("ENG");
  });

  it("throws VALIDATION_ERROR when multiple teams and none specified", async () => {
    stubGraphQL(
      TEAMS(
        { id: "t-eng", key: "ENG", name: "Engineering" },
        { id: "t-ops", key: "OPS", name: "Operations" },
      ),
    );
    await expect(resolveTeamId(TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("throws NOT_FOUND for an unknown key", async () => {
    stubGraphQL(TEAMS({ id: "t-eng", key: "ENG", name: "Engineering" }));
    await expect(resolveTeamId(TEST_CTX, "ZZZ")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("team command", () => {
  it("lists teams with a count", async () => {
    stubGraphQL(
      TEAMS(
        { id: "t-eng", key: "ENG", name: "Engineering" },
        { id: "t-ops", key: "OPS", name: "Operations" },
      ),
    );
    const out = await teamCommand(["list"], TEST_CTX);
    expect(out).toMatch(/ENG/);
    expect(out).toMatch(/Operations/);
    expect(out).toMatch(/count: 2/);
  });

  it("views a team with its states and labels", async () => {
    stubGraphQL(TEAMS({ id: "t-eng", key: "ENG", name: "Engineering" }), {
      team: {
        id: "t-eng",
        key: "ENG",
        name: "Engineering",
        states: { nodes: [{ name: "In Progress", type: "started" }] },
        labels: { nodes: [{ name: "bug" }] },
      },
    });
    const out = await teamCommand(["view", "ENG"], TEST_CTX);
    expect(out).toMatch(/In Progress/);
    expect(out).toMatch(/bug/);
  });

  it("errors when team view is missing a key", async () => {
    await expect(teamCommand(["view"], TEST_CTX)).rejects.toBeInstanceOf(
      AxiError,
    );
  });

  it("throws VALIDATION_ERROR on an unknown subcommand", async () => {
    await expect(teamCommand(["veiw", "ENG"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("defaults to list when a flag leads instead of a subcommand", async () => {
    stubGraphQL(TEAMS({ id: "t-eng", key: "ENG", name: "Engineering" }));
    const out = await teamCommand(["--foo"], TEST_CTX);
    expect(out).toMatch(/count: 1/);
  });
});
