import { vi } from "vitest";
import type { LinearContext } from "../src/context.js";

/** A context with a fake API key, so commands pass the auth guard in tests. */
export const TEST_CTX: LinearContext = {
  apiKeyPresent: true,
  apiKey: "lin_api_test",
};

/**
 * Stub global `fetch` so `linearRequest` resolves canned GraphQL `data`
 * payloads — one per successive call, in order. Only the network boundary is
 * mocked; the command's real query construction and TOON rendering run.
 * Returns the mock so tests can assert on the requests made.
 */
export function stubGraphQL(...payloads: unknown[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const data of payloads) {
    fn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data }),
    });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}
