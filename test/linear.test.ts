import { describe, it, expect, vi, afterEach } from "vitest";
import type { AxiError } from "axi-sdk-js";
import { linearRequest, LINEAR_ENDPOINT } from "../src/linear.js";
import type { LinearContext } from "../src/context.js";

const CTX: LinearContext = { apiKeyPresent: true, apiKey: "lin_api_test" };

function stubFetch(response: {
  ok?: boolean;
  status?: number;
  body: unknown;
}): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("linearRequest", () => {
  it("returns the data payload on success", async () => {
    stubFetch({ body: { data: { viewer: { id: "u1" } } } });
    const data = await linearRequest<{ viewer: { id: string } }>(
      "query { viewer { id } }",
      {},
      CTX,
    );
    expect(data).toEqual({ viewer: { id: "u1" } });
  });

  it("POSTs to the Linear endpoint with the API key and no Bearer prefix", async () => {
    const fetchMock = stubFetch({ body: { data: {} } });
    await linearRequest("query { viewer { id } }", { x: 1 }, CTX);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(LINEAR_ENDPOINT);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("lin_api_test");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      query: "query { viewer { id } }",
      variables: { x: 1 },
    });
  });

  it("throws a mapped AxiError when the response carries GraphQL errors", async () => {
    stubFetch({
      body: {
        errors: [
          { message: "Auth", extensions: { type: "authentication error" } },
        ],
      },
    });
    await expect(linearRequest("query {}", {}, CTX)).rejects.toMatchObject({
      code: "AUTH_ERROR",
    });
  });

  it("throws AUTH_REQUIRED without calling fetch when no key is present", async () => {
    const fetchMock = stubFetch({ body: { data: {} } });
    await expect(
      linearRequest("query {}", {}, { apiKeyPresent: false }),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a non-ok HTTP response with no errors to SERVER_ERROR", async () => {
    stubFetch({ ok: false, status: 503, body: {} });
    let code: string | undefined;
    try {
      await linearRequest("query {}", {}, CTX);
    } catch (e) {
      code = (e as AxiError).code;
    }
    expect(code).toBe("SERVER_ERROR");
  });
});
