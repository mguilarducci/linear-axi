import { describe, it, expect, afterEach, vi } from "vitest";
import { userCommand } from "../src/commands/user.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

const MAT = {
  id: "u1",
  name: "Mat G",
  displayName: "mat",
  email: "m@x.com",
  active: true,
};

describe("user list", () => {
  it("lists users with display name and email", async () => {
    stubGraphQL({
      users: { nodes: [MAT], pageInfo: { hasNextPage: false } },
    });
    const out = await userCommand(["list"], TEST_CTX);
    expect(out).toMatch(/mat/);
    expect(out).toMatch(/m@x\.com/);
    expect(out).toMatch(/count: 1/);
  });
});

describe("user view", () => {
  it("resolves a user by email and shows their open issues", async () => {
    stubGraphQL(
      { users: { nodes: [MAT] } },
      {
        user: {
          assignedIssues: {
            nodes: [
              {
                identifier: "ENG-1",
                title: "Fix",
                state: { name: "In Progress" },
              },
            ],
          },
        },
      },
    );
    const out = await userCommand(["view", "m@x.com"], TEST_CTX);
    expect(out).toMatch(/m@x\.com/);
    expect(out).toMatch(/ENG-1/);
  });

  it("throws NOT_FOUND for an unknown user", async () => {
    stubGraphQL({ users: { nodes: [] } });
    await expect(
      userCommand(["view", "ghost"], TEST_CTX),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires a query for view", async () => {
    await expect(userCommand(["view"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
