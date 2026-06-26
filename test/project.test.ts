import { describe, it, expect, afterEach, vi } from "vitest";
import { projectCommand, resolveProject } from "../src/commands/project.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

const LAUNCH = {
  id: "p1",
  name: "Launch",
  state: "started",
  health: "onTrack",
  progress: 0.5,
};

describe("project list", () => {
  it("renders projects with health and progress aggregates", async () => {
    stubGraphQL({
      projects: { nodes: [LAUNCH], pageInfo: { hasNextPage: false } },
    });
    const out = await projectCommand(["list"], TEST_CTX);
    expect(out).toMatch(/Launch/);
    expect(out).toMatch(/started/);
    expect(out).toMatch(/on-track/);
    expect(out).toMatch(/50%/);
    expect(out).toMatch(/count: 1/);
  });

  it("reports a definitive empty state", async () => {
    stubGraphQL({ projects: { nodes: [], pageInfo: { hasNextPage: false } } });
    const out = await projectCommand(["list"], TEST_CTX);
    expect(out).toMatch(/projects: 0/);
  });

  it("passes a validated --limit through to the query", async () => {
    const fetchMock = stubGraphQL({
      projects: { nodes: [], pageInfo: { hasNextPage: false } },
    });
    await projectCommand(["list", "--limit", "5"], TEST_CTX);
    const first = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ).variables.first;
    expect(first).toBe(5);
  });

  it("rejects a non-positive --limit before any request", async () => {
    const fetchMock = stubGraphQL({});
    await expect(
      projectCommand(["list", "--limit", "0"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resolveProject", () => {
  it("matches a project by name case-insensitively", async () => {
    stubGraphQL({ projects: { nodes: [{ id: "p1", name: "Launch" }] } });
    const p = await resolveProject(TEST_CTX, "launch");
    expect(p.id).toBe("p1");
  });

  it("throws NOT_FOUND when no project matches", async () => {
    stubGraphQL({ projects: { nodes: [{ id: "p1", name: "Launch" }] } });
    await expect(resolveProject(TEST_CTX, "ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("errors on an ambiguous name instead of mutating the wrong project", async () => {
    stubGraphQL({
      projects: {
        nodes: [
          { id: "p1", name: "Launch" },
          { id: "p2", name: "Launch" },
        ],
      },
    });
    await expect(resolveProject(TEST_CTX, "launch")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("resolves an exact id even when a same-named project exists", async () => {
    stubGraphQL({
      projects: {
        nodes: [
          { id: "p1", name: "Launch" },
          { id: "p2", name: "Launch" },
        ],
      },
    });
    const p = await resolveProject(TEST_CTX, "p2");
    expect(p.id).toBe("p2");
  });
});

describe("project view", () => {
  it("shows a project with its milestones and a truncated description", async () => {
    stubGraphQL(
      { projects: { nodes: [{ id: "p1", name: "Launch" }] } },
      {
        project: {
          name: "Launch",
          description: "A".repeat(1000),
          state: "started",
          health: "onTrack",
          progress: 0.5,
          startDate: null,
          targetDate: "2026-07-01",
          lead: { displayName: "mat" },
          url: "https://linear.app/x/project/launch",
          projectMilestones: {
            nodes: [{ name: "Beta", targetDate: "2026-06-15" }],
          },
        },
      },
    );
    const out = await projectCommand(["view", "Launch"], TEST_CTX);
    expect(out).toMatch(/Launch/);
    expect(out).toMatch(/Beta/);
    expect(out).toMatch(/mat/);
    expect(out).toMatch(/truncated/);
  });

  it("renders the full description when --full is passed", async () => {
    stubGraphQL(
      { projects: { nodes: [{ id: "p1", name: "Launch" }] } },
      {
        project: {
          name: "Launch",
          description: "A".repeat(1000),
          state: "started",
          health: "onTrack",
          progress: 0.5,
          startDate: null,
          targetDate: "2026-07-01",
          lead: { displayName: "mat" },
          url: "https://linear.app/x/project/launch",
          projectMilestones: { nodes: [] },
        },
      },
    );
    const out = await projectCommand(["view", "Launch", "--full"], TEST_CTX);
    expect(out).toMatch(/A{1000}/);
    expect(out).not.toMatch(/truncated/);
  });

  it("errors when view is missing a query", async () => {
    await expect(projectCommand(["view"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

const TEAM_NODE = { id: "t-eng", key: "ENG", name: "Engineering" };

describe("project create", () => {
  it("resolves the team and creates the project", async () => {
    const fetchMock = stubGraphQL(
      { teams: { nodes: [TEAM_NODE] } },
      {
        projectCreate: {
          success: true,
          project: {
            name: "Launch",
            url: "https://linear.app/x/project/launch",
            state: "planned",
          },
        },
      },
    );
    const out = await projectCommand(
      ["create", "--name", "Launch", "--team", "ENG"],
      TEST_CTX,
    );
    expect(out).toMatch(/Launch/);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.name).toBe("Launch");
    expect(input.teamIds).toEqual(["t-eng"]);
  });

  it("requires --name before any request", async () => {
    const fetchMock = stubGraphQL({ teams: { nodes: [TEAM_NODE] } });
    await expect(
      projectCommand(["create", "--team", "ENG"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when projectCreate reports failure", async () => {
    stubGraphQL(
      { teams: { nodes: [TEAM_NODE] } },
      { projectCreate: { success: false, project: null } },
    );
    await expect(
      projectCommand(["create", "--name", "Launch", "--team", "ENG"], TEST_CTX),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});

describe("project update", () => {
  it("updates the state of a resolved project", async () => {
    const fetchMock = stubGraphQL(
      { projects: { nodes: [{ id: "p1", name: "Launch" }] } },
      {
        projectUpdate: {
          success: true,
          project: {
            name: "Launch",
            url: "https://linear.app/x/project/launch",
            state: "paused",
            health: "atRisk",
          },
        },
      },
    );
    await projectCommand(["update", "Launch", "--state", "paused"], TEST_CTX);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.state).toBe("paused");
  });

  it("errors with nothing to update and makes no request", async () => {
    const fetchMock = stubGraphQL({});
    await expect(
      projectCommand(["update", "Launch"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves the positional name even when flags precede it", async () => {
    const fetchMock = stubGraphQL(
      { projects: { nodes: [{ id: "p1", name: "Launch" }] } },
      {
        projectUpdate: {
          success: true,
          project: {
            name: "New",
            url: "https://linear.app/x/project/launch",
            state: "paused",
            health: "atRisk",
          },
        },
      },
    );
    await projectCommand(["update", "--name", "New", "Launch"], TEST_CTX);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.name).toBe("New");
  });

  it("throws when projectUpdate reports failure", async () => {
    stubGraphQL(
      { projects: { nodes: [{ id: "p1", name: "Launch" }] } },
      { projectUpdate: { success: false, project: null } },
    );
    await expect(
      projectCommand(["update", "Launch", "--state", "paused"], TEST_CTX),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});
