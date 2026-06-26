import { describe, it, expect, afterEach, vi } from "vitest";
import { apiCommand } from "../src/commands/api.js";
import { stubGraphQL, TEST_CTX } from "./support.js";

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("runs a raw query and renders the data as TOON", async () => {
    stubGraphQL({ viewer: { id: "u1", name: "Mat" } });
    const out = await apiCommand(["{ viewer { id name } }"], TEST_CTX);
    expect(out).toMatch(/u1/);
    expect(out).toMatch(/Mat/);
  });

  it("parses --var pairs into typed GraphQL variables", async () => {
    const fetchMock = stubGraphQL({ issues: { nodes: [] } });
    await apiCommand(
      ["query($first:Int,$q:String){x}", "--var", "first=10", "--var", "q=abc"],
      TEST_CTX,
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.variables).toEqual({ first: 10, q: "abc" });
  });

  it("resolves the query even when --var precedes it", async () => {
    const fetchMock = stubGraphQL({ viewer: { id: "u1" } });
    await apiCommand(
      ["--var", "n=5", "query($n:Int){ viewer { id } }"],
      TEST_CTX,
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.query).toBe("query($n:Int){ viewer { id } }");
    expect(body.variables).toEqual({ n: 5 });
  });

  it("requires a query string", async () => {
    await expect(apiCommand([], TEST_CTX)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
