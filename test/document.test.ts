import { describe, it, expect, afterEach, vi } from "vitest";
import { documentCommand } from "../src/commands/document.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("document list", () => {
  it("lists documents with title and project", async () => {
    stubGraphQL({
      documents: {
        nodes: [
          {
            id: "d1",
            title: "Spec",
            project: { name: "Launch" },
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
        pageInfo: { hasNextPage: false },
      },
    });
    const out = await documentCommand(["list"], TEST_CTX);
    expect(out).toMatch(/Spec/);
    expect(out).toMatch(/Launch/);
    expect(out).toMatch(/count: 1/);
  });
});

describe("document view", () => {
  it("shows a document with truncated content", async () => {
    stubGraphQL({
      document: {
        title: "Spec",
        content: "A".repeat(2000),
        url: "https://linear.app/x/document/d1",
        project: { name: "Launch" },
      },
    });
    const out = await documentCommand(["view", "d1"], TEST_CTX);
    expect(out).toMatch(/Spec/);
    expect(out).toMatch(/truncated/);
  });

  it("requires an id for view", async () => {
    await expect(documentCommand(["view"], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
