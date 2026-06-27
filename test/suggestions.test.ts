import { describe, it, expect } from "vitest";
import { getSuggestions } from "../src/suggestions.js";

describe("getSuggestions", () => {
  it("suggests view and create after a non-empty issue list", () => {
    const lines = getSuggestions({ domain: "issue", action: "list" });
    expect(lines.join("\n")).toMatch(/issue view/);
    expect(lines.join("\n")).toMatch(/issue create/);
  });

  it("suggests creating the first issue after an empty list", () => {
    const lines = getSuggestions({
      domain: "issue",
      action: "list",
      isEmpty: true,
    });
    expect(lines.join("\n")).toMatch(/issue create/);
  });

  it("suggests close/comment for an open issue view, substituting the id", () => {
    const lines = getSuggestions({
      domain: "issue",
      action: "view",
      state: "open",
      id: "ENG-12",
    });
    const text = lines.join("\n");
    expect(text).toMatch(/issue close ENG-12/);
    expect(text).toMatch(/issue comment ENG-12/);
  });

  it("suggests reopen for a closed issue view", () => {
    const lines = getSuggestions({
      domain: "issue",
      action: "view",
      state: "closed",
      id: "ENG-12",
    });
    expect(lines.join("\n")).toMatch(/issue reopen ENG-12/);
  });

  it("suggests team view after a team list", () => {
    const lines = getSuggestions({ domain: "team", action: "list" });
    expect(lines.join("\n")).toMatch(/team view/);
  });

  it("suggests view/create follow-ups for the collaboration domains", () => {
    expect(
      getSuggestions({ domain: "document", action: "list" }).join("\n"),
    ).toMatch(/document view/);
    expect(
      getSuggestions({ domain: "user", action: "list" }).join("\n"),
    ).toMatch(/user view/);
    expect(
      getSuggestions({ domain: "label", action: "list" }).join("\n"),
    ).toMatch(/label create/);
    expect(
      getSuggestions({ domain: "label", action: "create" }).join("\n"),
    ).toMatch(/label list/);
    expect(
      getSuggestions({ domain: "initiative", action: "list" }).join("\n"),
    ).toMatch(/initiative view/);
  });

  it("stays silent on empty document/user/initiative lists", () => {
    expect(
      getSuggestions({ domain: "document", action: "list", isEmpty: true }),
    ).toEqual([]);
    expect(
      getSuggestions({ domain: "user", action: "list", isEmpty: true }),
    ).toEqual([]);
    expect(
      getSuggestions({ domain: "initiative", action: "list", isEmpty: true }),
    ).toEqual([]);
  });

  it("returns no suggestions for an unrecognized context", () => {
    expect(getSuggestions({ domain: "nope", action: "nope" })).toEqual([]);
  });
});
