import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AxiError } from "axi-sdk-js";
import { resolveLinearContext, requireApiKey } from "../src/context.js";

const ENV_KEYS = ["LINEAR_API_KEY", "LINEAR_TEAM"] as const;

describe("resolveLinearContext", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("exposes the API key value and presence when set", () => {
    process.env["LINEAR_API_KEY"] = "lin_api_abc";
    const ctx = resolveLinearContext();
    expect(ctx.apiKey).toBe("lin_api_abc");
    expect(ctx.apiKeyPresent).toBe(true);
  });

  it("reports no key when unset", () => {
    const ctx = resolveLinearContext();
    expect(ctx.apiKey).toBeUndefined();
    expect(ctx.apiKeyPresent).toBe(false);
  });

  it("reads the default team from LINEAR_TEAM", () => {
    process.env["LINEAR_TEAM"] = "ENG";
    expect(resolveLinearContext().teamKey).toBe("ENG");
  });
});

describe("requireApiKey", () => {
  it("returns the key when present", () => {
    expect(requireApiKey({ apiKeyPresent: true, apiKey: "lin_api_x" })).toBe(
      "lin_api_x",
    );
  });

  it("throws AUTH_REQUIRED when the key is missing", () => {
    expect(() => requireApiKey({ apiKeyPresent: false })).toThrow(AxiError);
    try {
      requireApiKey(undefined);
    } catch (e) {
      expect((e as AxiError).code).toBe("AUTH_REQUIRED");
    }
  });
});
