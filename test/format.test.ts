import { describe, it, expect } from "vitest";
import { formatCountLine } from "../src/format.js";

describe("formatCountLine", () => {
  it("renders a plain count", () => {
    expect(formatCountLine({ count: 3 })).toBe("count: 3");
  });

  it("renders an exact total when known", () => {
    expect(formatCountLine({ count: 3, totalCount: 42 })).toBe(
      "count: 3 of 42 total",
    );
  });

  it("renders a soft total when more pages exist but the total is unknown", () => {
    expect(formatCountLine({ count: 30, hasMore: true })).toBe(
      "count: 30+ (more available)",
    );
  });

  it("renders a plain count when there are no more pages", () => {
    expect(formatCountLine({ count: 5, hasMore: false })).toBe("count: 5");
  });

  it("prefers an exact total over the soft-total hint", () => {
    expect(formatCountLine({ count: 30, totalCount: 30, hasMore: true })).toBe(
      "count: 30 of 30 total",
    );
  });

  it("renders zero plainly", () => {
    expect(formatCountLine({ count: 0 })).toBe("count: 0");
  });
});
