import { describe, it, expect } from "vitest";
import {
  field,
  lower,
  pluck,
  renderError,
  renderHelp,
  renderList,
  renderOutput,
} from "../src/toon.js";

describe("renderList", () => {
  it("flattens items through a field schema into a TOON table", () => {
    const items = [
      { id: "1", title: "Fix auth", state: "OPEN", author: { login: "alice" } },
      {
        id: "2",
        title: "Add pages",
        state: "CLOSED",
        author: { login: "bob" },
      },
    ];
    const out = renderList("issues", items, [
      field("id"),
      field("title"),
      lower("state"),
      pluck("author", "login", "author"),
    ]);

    expect(out).toContain("issues[2]{id,title,state,author}:");
    expect(out).toContain("open");
    expect(out).toContain("alice");
  });
});

describe("renderHelp", () => {
  it("counts and indents suggestion lines", () => {
    expect(renderHelp(["a", "b"])).toBe("help[2]:\n  a\n  b");
  });

  it("is empty for no suggestions", () => {
    expect(renderHelp([])).toBe("");
  });
});

describe("renderError", () => {
  it("emits a structured error block with suggestions", () => {
    const out = renderError("--title is required", "VALIDATION_ERROR", [
      'linear-axi issue create --title "..."',
    ]);

    expect(out).toContain("--title is required");
    expect(out).toContain("code: VALIDATION_ERROR");
    expect(out).toContain("help[1]:");
  });
});

describe("renderOutput", () => {
  it("drops empty blocks when joining", () => {
    expect(renderOutput(["a", "", "b"])).toBe("a\nb");
  });
});
