import { describe, it, expect } from "vitest";
import { AxiError } from "axi-sdk-js";
import { parseFields, type ExtraFieldSpec } from "../src/fields.js";
import { field, relativeTime } from "../src/toon.js";

const AVAILABLE: Record<string, ExtraFieldSpec> = {
  priority: { graphql: "priority", def: field("priority") },
  updated: { graphql: "updatedAt", def: relativeTime("updatedAt", "updated") },
};

describe("parseFields", () => {
  it("returns empty results when no --fields was given", () => {
    const result = parseFields(undefined, AVAILABLE);
    expect(result.extraDefs).toEqual([]);
    expect(result.extraGraphql).toEqual([]);
  });

  it("resolves known fields to their graphql selections and defs in order", () => {
    const result = parseFields("priority,updated", AVAILABLE);
    expect(result.extraGraphql).toEqual(["priority", "updatedAt"]);
    expect(result.extraDefs).toHaveLength(2);
  });

  it("trims whitespace and de-duplicates", () => {
    const result = parseFields(" priority , priority ", AVAILABLE);
    expect(result.extraGraphql).toEqual(["priority"]);
  });

  it("throws VALIDATION_ERROR listing available fields on an unknown field", () => {
    try {
      parseFields("priority,bogus", AVAILABLE);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AxiError);
      expect((e as AxiError).code).toBe("VALIDATION_ERROR");
      expect((e as AxiError).message).toMatch(/bogus/);
      expect((e as AxiError).message).toMatch(/priority/);
    }
  });
});
