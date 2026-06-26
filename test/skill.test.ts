import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { createSkillMarkdown } from "../src/skill.js";

describe("skills/linear-axi/SKILL.md", () => {
  it("matches the generated output (run `pnpm run build:skill` after CLI changes)", async () => {
    const committed = await readFile(
      new URL("../skills/linear-axi/SKILL.md", import.meta.url),
      "utf8",
    );
    expect(committed).toBe(createSkillMarkdown());
  });
});
