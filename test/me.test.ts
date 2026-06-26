import { describe, it, expect, afterEach, vi } from "vitest";
import { meCommand } from "../src/commands/me.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("me", () => {
  it("renders the viewer and their open assigned issues", async () => {
    stubGraphQL({
      viewer: {
        id: "u1",
        name: "Mat G",
        displayName: "mat",
        email: "m@x.com",
        assignedIssues: {
          nodes: [
            {
              identifier: "ENG-1",
              title: "Fix auth",
              state: { name: "In Progress", type: "started" },
            },
          ],
        },
      },
    });
    const out = await meCommand([], TEST_CTX);
    expect(out).toMatch(/m@x\.com/);
    expect(out).toMatch(/ENG-1/);
    expect(out).toMatch(/In Progress/);
    expect(out).toMatch(/count: 1/);
  });

  it("states clearly when there are no assigned open issues", async () => {
    stubGraphQL({
      viewer: {
        id: "u1",
        name: "Mat",
        displayName: "mat",
        email: "m@x.com",
        assignedIssues: { nodes: [] },
      },
    });
    const out = await meCommand([], TEST_CTX);
    expect(out).toMatch(/assignedIssues: 0/);
  });

  it("requests only open issues via the state filter", async () => {
    const fetchMock = stubGraphQL({
      viewer: {
        id: "u1",
        name: "Mat",
        displayName: "mat",
        email: "m@x.com",
        assignedIssues: { nodes: [] },
      },
    });
    await meCommand([], TEST_CTX);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.variables.filter).toEqual({
      state: { type: { nin: ["completed", "canceled"] } },
    });
  });
});
