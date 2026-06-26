import { describe, it, expect } from "vitest";
import {
  getFlag,
  takeFlag,
  hasFlag,
  takeBoolFlag,
  getAllFlags,
  getPositional,
} from "../src/args.js";

describe("getFlag", () => {
  it("reads a flag in `--name value` form", () => {
    expect(getFlag(["--team", "ENG"], "--team")).toBe("ENG");
  });

  it("reads a flag in `--name=value` form", () => {
    expect(getFlag(["--team=ENG"], "--team")).toBe("ENG");
  });

  it("returns undefined when the flag is absent", () => {
    expect(getFlag(["--other", "x"], "--team")).toBeUndefined();
  });

  it("does not mutate the args array", () => {
    const args = ["--team", "ENG"];
    getFlag(args, "--team");
    expect(args).toEqual(["--team", "ENG"]);
  });
});

describe("takeFlag", () => {
  it("returns the value and removes `--name value` from args", () => {
    const args = ["list", "--team", "ENG", "--state", "open"];
    const value = takeFlag(args, "--team");
    expect(value).toBe("ENG");
    expect(args).toEqual(["list", "--state", "open"]);
  });

  it("returns the value and removes `--name=value` from args", () => {
    const args = ["list", "--team=ENG"];
    const value = takeFlag(args, "--team");
    expect(value).toBe("ENG");
    expect(args).toEqual(["list"]);
  });

  it("returns undefined and leaves args unchanged when absent", () => {
    const args = ["list"];
    expect(takeFlag(args, "--team")).toBeUndefined();
    expect(args).toEqual(["list"]);
  });
});

describe("hasFlag", () => {
  it("is true when the flag is present", () => {
    expect(hasFlag(["view", "--full"], "--full")).toBe(true);
  });

  it("is false when the flag is absent", () => {
    expect(hasFlag(["view"], "--full")).toBe(false);
  });
});

describe("takeBoolFlag", () => {
  it("returns true and removes the flag", () => {
    const args = ["view", "--full"];
    expect(takeBoolFlag(args, "--full")).toBe(true);
    expect(args).toEqual(["view"]);
  });

  it("returns false and leaves args unchanged when absent", () => {
    const args = ["view"];
    expect(takeBoolFlag(args, "--full")).toBe(false);
    expect(args).toEqual(["view"]);
  });
});

describe("getAllFlags", () => {
  it("collects repeated flags in both forms", () => {
    const args = ["--label", "bug", "--label=urgent", "--other", "x"];
    expect(getAllFlags(args, "--label")).toEqual(["bug", "urgent"]);
  });

  it("returns an empty array when none are present", () => {
    expect(getAllFlags(["--other", "x"], "--label")).toEqual([]);
  });
});

describe("getPositional", () => {
  it("returns the n-th non-flag argument", () => {
    const args = ["view", "ENG-123"];
    expect(getPositional(args, 0)).toBe("view");
    expect(getPositional(args, 1)).toBe("ENG-123");
  });

  it("skips flags when indexing positionals", () => {
    const args = ["view", "--full", "ENG-123"];
    expect(getPositional(args, 1)).toBe("ENG-123");
  });

  it("returns undefined when the index is out of range", () => {
    expect(getPositional(["view"], 2)).toBeUndefined();
  });
});
