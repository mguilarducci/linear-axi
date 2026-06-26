import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AxiError } from "axi-sdk-js";
import { takeBody, cleanBody, truncateBody } from "../src/body.js";

const tmpDirs: string[] = [];
function tmpFile(name: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "linear-axi-"));
  tmpDirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, contents, "utf8");
  return path;
}

afterEach(() => {
  while (tmpDirs.length)
    rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("takeBody", () => {
  it("returns an inline body and removes the flag from args", () => {
    const args = ["create", "--body", "Hello", "--title", "X"];
    expect(takeBody(args)).toBe("Hello");
    expect(args).toEqual(["create", "--title", "X"]);
  });

  it("reads a body from a file via --body-file", () => {
    const path = tmpFile("body.md", "From a file");
    expect(takeBody(["create", "--body-file", path])).toBe("From a file");
  });

  it("supports custom flag names", () => {
    const args = ["create", "--description", "Desc"];
    expect(
      takeBody(args, {
        inlineFlags: ["--description"],
        fileFlags: ["--description-file"],
      }),
    ).toBe("Desc");
  });

  it("returns undefined when no body is given and it is optional", () => {
    expect(takeBody(["create"])).toBeUndefined();
  });

  it("throws VALIDATION_ERROR when required and missing", () => {
    try {
      takeBody(["create"], { required: true });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AxiError);
      expect((e as AxiError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("throws when both inline and file sources are provided", () => {
    const path = tmpFile("b.md", "x");
    expect(() =>
      takeBody(["create", "--body", "inline", "--body-file", path]),
    ).toThrow(AxiError);
  });
});

describe("cleanBody", () => {
  it("replaces markdown image embeds with a placeholder", () => {
    expect(cleanBody("see ![diagram](https://x.com/a.png) here")).toBe(
      "see [image: diagram] here",
    );
  });
});

describe("truncateBody", () => {
  it("returns a short body unchanged", () => {
    expect(truncateBody("short", 800)).toBe("short");
  });

  it("truncates a long body and points at --full", () => {
    const long = "a".repeat(1000);
    const out = truncateBody(long, 800);
    expect(out.length).toBeLessThan(long.length);
    expect(out).toMatch(/truncated/);
    expect(out).toMatch(/--full/);
    expect(out).toMatch(/1000/);
  });

  it("returns an empty string for non-string input", () => {
    expect(truncateBody(undefined, 800)).toBe("");
  });
});
