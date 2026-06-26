import { requireApiKey, type LinearContext } from "./context.js";
import { mapLinearError, type LinearGraphQLError } from "./errors.js";

/** Linear's single GraphQL endpoint. */
export const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

interface GraphQLResponse<T> {
  data?: T;
  errors?: LinearGraphQLError[];
}

/**
 * Execute a GraphQL operation against the Linear API and return its `data`
 * payload. This is linear-axi's backend boundary — the moral equivalent of
 * gh-axi's `ghJson`, but speaking HTTP+GraphQL instead of shelling out.
 *
 * Authentication uses a personal API key passed verbatim in the `Authorization`
 * header — Linear personal keys take NO `Bearer ` prefix (only OAuth tokens do).
 *
 * A GraphQL response can return HTTP 200 while still carrying an `errors`
 * array, so we always inspect `errors` before trusting `data`.
 *
 * @throws {AxiError} mapped from the GraphQL errors or HTTP status on failure.
 */
export async function linearRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  ctx: LinearContext | undefined,
): Promise<T> {
  const apiKey = requireApiKey(ctx);

  const res = await fetch(LINEAR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await res.json().catch(() => ({}))) as GraphQLResponse<T>;

  if (payload.errors?.length) {
    throw mapLinearError(payload.errors, res.status);
  }
  if (!res.ok || payload.data === undefined) {
    throw mapLinearError(undefined, res.status);
  }

  return payload.data;
}
