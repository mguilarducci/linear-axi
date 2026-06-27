import { describe, it, expect, afterEach, vi } from "vitest";
import { labelCommand } from "../src/commands/label.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("label list", () => {
  it("lists labels with name and color", async () => {
    stubGraphQL({
      issueLabels: {
        nodes: [{ id: "l1", name: "bug", color: "#ff0000", team: null }],
        pageInfo: { hasNextPage: false },
      },
    });
    const out = await labelCommand(["list"], TEST_CTX);
    expect(out).toMatch(/bug/);
    expect(out).toMatch(/#ff0000/);
    expect(out).toMatch(/count: 1/);
  });

  it("scopes the listing to a team when --team is given", async () => {
    const fetchMock = stubGraphQL({
      issueLabels: { nodes: [], pageInfo: { hasNextPage: false } },
    });
    await labelCommand(["list", "--team", "eng"], TEST_CTX);
    const vars = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ).variables;
    expect(vars.filter).toEqual({ team: { key: { eq: "ENG" } } });
  });
});

describe("label create", () => {
  it("creates a new label when none exists with that name", async () => {
    const fetchMock = stubGraphQL(
      { issueLabels: { nodes: [] } },
      {
        issueLabelCreate: {
          success: true,
          issueLabel: { name: "urgent", color: "#ff8800" },
        },
      },
    );
    const out = await labelCommand(
      ["create", "--name", "urgent", "--color", "#ff8800"],
      TEST_CTX,
    );
    expect(out).toMatch(/urgent/);
    const input = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.name).toBe("urgent");
    expect(input.color).toBe("#ff8800");
  });

  it("is an idempotent no-op when the label already exists", async () => {
    const fetchMock = stubGraphQL({
      issueLabels: { nodes: [{ id: "l1", name: "bug", color: "#ff0000" }] },
    });
    const out = await labelCommand(["create", "--name", "bug"], TEST_CTX);
    expect(out).toMatch(/already exists/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("scopes the idempotency check to the workspace when --team is omitted", async () => {
    const fetchMock = stubGraphQL(
      { issueLabels: { nodes: [], pageInfo: { hasNextPage: false } } },
      {
        issueLabelCreate: {
          success: true,
          issueLabel: { name: "bug", color: "#ff0000" },
        },
      },
    );
    await labelCommand(["create", "--name", "bug"], TEST_CTX);
    const existenceVars = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ).variables;
    expect(existenceVars.filter).toEqual({ team: { null: true } });
  });

  it("scopes the idempotency check to the team when --team is given", async () => {
    const fetchMock = stubGraphQL(
      { issueLabels: { nodes: [], pageInfo: { hasNextPage: false } } },
      { teams: { nodes: [{ id: "t1", key: "ENG", name: "Eng" }] } },
      {
        issueLabelCreate: {
          success: true,
          issueLabel: { name: "bug", color: "#ff0000" },
        },
      },
    );
    await labelCommand(["create", "--name", "bug", "--team", "eng"], TEST_CTX);
    const existenceVars = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ).variables;
    expect(existenceVars.filter).toEqual({ team: { key: { eq: "ENG" } } });
    const input = JSON.parse(
      (fetchMock.mock.calls[2][1] as RequestInit).body as string,
    ).variables.input;
    expect(input.teamId).toBe("t1");
  });

  it("throws when the create mutation reports success: false", async () => {
    stubGraphQL(
      { issueLabels: { nodes: [], pageInfo: { hasNextPage: false } } },
      { issueLabelCreate: { success: false, issueLabel: null } },
    );
    await expect(
      labelCommand(["create", "--name", "urgent"], TEST_CTX),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("requires --name", async () => {
    await expect(labelCommand(["create"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
