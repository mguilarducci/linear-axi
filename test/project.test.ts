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

  it("errors when view is missing a query", async () => {
    await expect(projectCommand(["view"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
