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

  it("rejects an unknown --state bucket instead of silently returning all", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await expect(
      issueCommand(["list", "--state", "opened"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric --limit instead of sending first: null", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await expect(
      issueCommand(["list", "--limit", "abc"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-positive --limit", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await expect(
      issueCommand(["list", "--limit", "0"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a valid --limit through", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await issueCommand(["list", "--limit", "5"], TEST_CTX);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.first).toBe(5);
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

const TEAM_NODE = { id: "t-eng", key: "ENG", name: "Engineering" };

describe("issue create", () => {
  it("resolves the team and creates the issue", async () => {
    const fetchMock = stubGraphQL(
      { teams: { nodes: [TEAM_NODE] } },
      {
        issueCreate: {
          success: true,
          issue: {
            identifier: "ENG-7",
            title: "New thing",
            url: "https://linear.app/x/issue/ENG-7",
            state: { name: "Backlog" },
          },
        },
      },
    );
    const out = await issueCommand(
      ["create", "--team", "ENG", "--title", "New thing"],
      TEST_CTX,
    );
    expect(out).toMatch(/ENG-7/);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.teamId).toBe("t-eng");
    expect(input.title).toBe("New thing");
  });

  it("requires --title before making any request", async () => {
    const fetchMock = stubGraphQL({ teams: { nodes: [TEAM_NODE] } });
    await expect(
      issueCommand(["create", "--team", "ENG"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("issue update", () => {
  it("updates the title", async () => {
    const fetchMock = stubGraphQL({
      issueUpdate: {
        success: true,
        issue: {
          identifier: "ENG-1",
          title: "Renamed",
          state: { name: "In Progress" },
          assignee: { displayName: "mat" },
          url: "https://linear.app/x/issue/ENG-1",
        },
      },
    });
    const out = await issueCommand(
      ["update", "ENG-1", "--title", "Renamed"],
      TEST_CTX,
    );
    expect(out).toMatch(/Renamed/);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.input.title).toBe("Renamed");
  });

  it("assigns to me by resolving the viewer id", async () => {
    const fetchMock = stubGraphQL(
      { viewer: { id: "u1" } },
      {
        issueUpdate: {
          success: true,
          issue: {
            identifier: "ENG-1",
            title: "T",
            state: { name: "In Progress" },
            assignee: { displayName: "mat" },
            url: "https://linear.app/x/issue/ENG-1",
          },
        },
      },
    );
    await issueCommand(["update", "ENG-1", "--assignee", "me"], TEST_CTX);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.assigneeId).toBe("u1");
  });

  it("resolves the id even when a value flag precedes it", async () => {
    const fetchMock = stubGraphQL({
      issueUpdate: {
        success: true,
        issue: {
          identifier: "ENG-1",
          title: "Renamed",
          state: { name: "In Progress" },
          assignee: { displayName: "mat" },
          url: "https://linear.app/x/issue/ENG-1",
        },
      },
    });
    await issueCommand(["update", "--title", "Renamed", "ENG-1"], TEST_CTX);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.id).toBe("ENG-1");
    expect(body.variables.input.title).toBe("Renamed");
  });

  it("throws when the update mutation reports failure", async () => {
    stubGraphQL({ issueUpdate: { success: false, issue: null } });
    await expect(
      issueCommand(["update", "ENG-1", "--title", "Renamed"], TEST_CTX),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("errors when there is nothing to update", async () => {
    const fetchMock = stubGraphQL({});
    await expect(
      issueCommand(["update", "ENG-1"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an assignee other than me instead of silently dropping it", async () => {
    const fetchMock = stubGraphQL({});
    await expect(
      issueCommand(["update", "ENG-1", "--assignee", "bob@x.com"], TEST_CTX),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("--assignee"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("issue comment", () => {
  it("resolves the issue id and posts the comment", async () => {
    const fetchMock = stubGraphQL(
      { issue: { id: "i1", identifier: "ENG-1" } },
      {
        commentCreate: {
          success: true,
          comment: { id: "c1", url: "https://linear.app/x/comment/c1" },
        },
      },
    );
    const out = await issueCommand(
      ["comment", "ENG-1", "--body", "Looks good"],
      TEST_CTX,
    );
    expect(out).toMatch(/ENG-1/);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.issueId).toBe("i1");
    expect(input.body).toBe("Looks good");
  });

  it("resolves the id even when --body precedes it", async () => {
    const fetchMock = stubGraphQL(
      { issue: { id: "i1", identifier: "ENG-1" } },
      {
        commentCreate: {
          success: true,
          comment: { id: "c1", url: "https://linear.app/x/comment/c1" },
        },
      },
    );
    await issueCommand(["comment", "--body", "Looks good", "ENG-1"], TEST_CTX);
    const idBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(idBody.variables.id).toBe("ENG-1");
  });

  it("throws when the comment mutation reports failure", async () => {
    stubGraphQL(
      { issue: { id: "i1", identifier: "ENG-1" } },
      { commentCreate: { success: false, comment: null } },
    );
    await expect(
      issueCommand(["comment", "ENG-1", "--body", "x"], TEST_CTX),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("requires a body", async () => {
    await expect(
      issueCommand(["comment", "ENG-1"], TEST_CTX),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

const TEAM_STATES = {
  nodes: [
    { id: "s-todo", name: "Todo", type: "unstarted" },
    { id: "s-prog", name: "In Progress", type: "started" },
    { id: "s-done", name: "Done", type: "completed" },
  ],
};

function issueStatePayload(stateName: string, stateType: string) {
  return {
    issue: {
      id: "i1",
      identifier: "ENG-1",
      state: { name: stateName, type: stateType },
      team: { states: TEAM_STATES },
    },
  };
}

const UPDATE_OK = {
  issueUpdate: {
    success: true,
    issue: {
      identifier: "ENG-1",
      title: "X",
      url: "https://linear.app/x/issue/ENG-1",
      state: { name: "Done" },
      assignee: null,
    },
  },
};

describe("issue close", () => {
  it("moves an open issue to a completed-type state", async () => {
    const fetchMock = stubGraphQL(
      issueStatePayload("In Progress", "started"),
      UPDATE_OK,
    );
    await issueCommand(["close", "ENG-1"], TEST_CTX);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.stateId).toBe("s-done");
  });

  it("is a no-op when the issue is already closed", async () => {
    const fetchMock = stubGraphQL(issueStatePayload("Done", "completed"));
    const out = await issueCommand(["close", "ENG-1"], TEST_CTX);
    expect(out).toMatch(/already closed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the transition mutation reports failure", async () => {
    stubGraphQL(issueStatePayload("In Progress", "started"), {
      issueUpdate: { success: false, issue: null },
    });
    await expect(
      issueCommand(["close", "ENG-1"], TEST_CTX),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});

describe("issue dispatch", () => {
  it("defaults to list when a value flag leads without a subcommand", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await issueCommand(["--state", "closed"], TEST_CTX);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.filter).toEqual({
      state: { type: { in: ["completed", "canceled"] } },
    });
  });

  it("defaults to list when --limit leads without a subcommand", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await issueCommand(["--limit", "5"], TEST_CTX);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables.first).toBe(5);
  });

  it("rejects an unknown subcommand", async () => {
    const fetchMock = stubGraphQL(issuesPayload([]));
    await expect(issueCommand(["bogus"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("issue reopen", () => {
  it("moves a closed issue back to an unstarted-type state", async () => {
    const fetchMock = stubGraphQL(
      issueStatePayload("Done", "completed"),
      UPDATE_OK,
    );
    await issueCommand(["reopen", "ENG-1"], TEST_CTX);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.stateId).toBe("s-todo");
  });

  it("is a no-op when the issue is already open", async () => {
    const fetchMock = stubGraphQL(issueStatePayload("In Progress", "started"));
    const out = await issueCommand(["reopen", "ENG-1"], TEST_CTX);
    expect(out).toMatch(/already open/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
