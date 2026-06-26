import { describe, it, expect, afterEach, vi } from "vitest";
import { issueCommand } from "../src/commands/issue.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

function issuesPayload(
  nodes: Array<Record<string, unknown>>,
  hasNextPage = false,
) {
  return { issues: { nodes, pageInfo: { hasNextPage } } };
}

const ONE_ISSUE = {
  identifier: "ENG-1",
  title: "Fix auth",
  state: { name: "In Progress", type: "started" },
  assignee: { displayName: "mat" },
};

describe("issue list", () => {
  it("renders the default open-issue schema with a count", async () => {
    stubGraphQL(issuesPayload([ONE_ISSUE]));
    const out = await issueCommand(["list"], TEST_CTX);
    expect(out).toMatch(/ENG-1/);
    expect(out).toMatch(/Fix auth/);
    expect(out).toMatch(/In Progress/);
    expect(out).toMatch(/mat/);
    expect(out).toMatch(/count: 1/);
  });

  it("filters to open issues by default", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await issueCommand(["list"], TEST_CTX);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.filter).toEqual({
      state: { type: { nin: ["completed", "canceled"] } },
    });
  });

  it("drops the state filter for --state all", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await issueCommand(["list", "--state", "all"], TEST_CTX);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.filter.state).toBeUndefined();
  });

  it("scopes to a team key (upper-cased) via --team", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await issueCommand(["list", "--team", "eng"], TEST_CTX);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.filter.team).toEqual({ key: { eq: "ENG" } });
  });

  it("reports a definitive empty state", async () => {
    stubGraphQL(issuesPayload([]));
    const out = await issueCommand(["list"], TEST_CTX);
    expect(out).toMatch(/issues: 0/);
  });
});

describe("issue view", () => {
  const longBody = "x".repeat(1000);

  it("shows an issue with a truncated body and a --full hint", async () => {
    stubGraphQL({
      issue: {
        identifier: "ENG-1",
        title: "Fix auth",
        description: longBody,
        state: { name: "In Progress", type: "started" },
        assignee: { displayName: "mat" },
        url: "https://linear.app/x/issue/ENG-1",
      },
    });
    const out = await issueCommand(["view", "ENG-1"], TEST_CTX);
    expect(out).toMatch(/Fix auth/);
    expect(out).toMatch(/truncated/);
    expect(out).toMatch(/--full/);
  });

  it("shows the full body with --full", async () => {
    stubGraphQL({
      issue: {
        identifier: "ENG-1",
        title: "Fix auth",
        description: longBody,
        state: { name: "Done", type: "completed" },
        assignee: null,
        url: "https://linear.app/x/issue/ENG-1",
      },
    });
    const out = await issueCommand(["view", "ENG-1", "--full"], TEST_CTX);
    expect(out).not.toMatch(/truncated/);
    expect(out).toContain(longBody);
  });

  it("errors when view is missing an identifier", async () => {
    await expect(issueCommand(["view"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
