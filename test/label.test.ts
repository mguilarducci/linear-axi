import { describe, it, expect, afterEach, vi } from "vitest";
import { labelCommand } from "../src/commands/label.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("label list", () => {
  it("lists labels with name and color", async () => {
    stubGraphQL({
      issueLabels: {
        nodes: [{ id: "l1", name: "bug", color: "#ff0000", team: null }],
      },
    });
    const out = await labelCommand(["list"], TEST_CTX);
    expect(out).toMatch(/bug/);
    expect(out).toMatch(/#ff0000/);
    expect(out).toMatch(/count: 1/);
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

  it("requires --name", async () => {
    await expect(labelCommand(["create"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
