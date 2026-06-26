import { describe, it, expect, afterEach, vi } from "vitest";
import { milestoneCommand } from "../src/commands/milestone.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("milestone list", () => {
  it("lists a project's milestones", async () => {
    stubGraphQL(
      { projects: { nodes: [{ id: "p1", name: "Launch" }] } },
      {
        project: {
          name: "Launch",
          projectMilestones: {
            nodes: [
              { name: "Beta", targetDate: "2026-06-15", description: null },
            ],
          },
        },
      },
    );
    const out = await milestoneCommand(
      ["list", "--project", "Launch"],
      TEST_CTX,
    );
    expect(out).toMatch(/Beta/);
    expect(out).toMatch(/count: 1/);
  });

  it("requires --project and makes no request", async () => {
    const fetchMock = stubGraphQL({});
    await expect(milestoneCommand(["list"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
