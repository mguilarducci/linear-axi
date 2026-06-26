import { AxiError } from "axi-sdk-js";

/**
 * One entry in a GraphQL response's `errors` array, narrowed to the fields
 * Linear actually populates. `extensions.type` carries Linear's error
 * category; `userPresentableMessage` is a human-friendly string Linear
 * intends to be surfaced to the end user.
 */
export interface LinearGraphQLError {
  message: string;
  extensions?: {
    type?: string;
    code?: string;
    userPresentableMessage?: string;
  };
}

/**
 * Translate a failed Linear GraphQL response into a structured {@link AxiError}.
 *
 * Precedence: explicit GraphQL error categories first (auth, rate limit,
 * validation, not-found), then HTTP status as a fallback when the response
 * carried no `errors` array (a bare 401/429/5xx). The surfaced message
 * prefers Linear's own `userPresentableMessage` over the raw GraphQL message.
 */
export function mapLinearError(
  errors: LinearGraphQLError[] | undefined,
  status: number,
): AxiError {
  const first = errors?.[0];
  const type = first?.extensions?.type?.toLowerCase() ?? "";
  const message =
    first?.extensions?.userPresentableMessage ?? first?.message ?? "";

  // Authentication
  if (type.includes("authentication") || status === 401 || status === 403) {
    return new AxiError(
      message || "Linear authentication failed",
      "AUTH_ERROR",
      [
        "Check that LINEAR_API_KEY is set to a valid Linear personal API key",
        "Create a key at Linear → Settings → Security & access → Personal API keys",
      ],
    );
  }

  // Rate limiting
  if (type.includes("ratelimited") || type.includes("rate") || status === 429) {
    return new AxiError(
      message || "Linear rate limit reached",
      "RATE_LIMITED",
      [
        "Wait ~60s before retrying",
        "Narrow your query (fewer fields, smaller --limit) to lower its complexity cost",
      ],
    );
  }

  // Validation / invalid input
  if (type.includes("invalid") || type.includes("validation")) {
    return new AxiError(message || "Invalid input", "VALIDATION_ERROR");
  }

  // Not found
  if (
    type.includes("not found") ||
    /not\s+found|could not find|entity not found/i.test(first?.message ?? "")
  ) {
    return new AxiError(message || "Resource not found", "NOT_FOUND");
  }

  // HTTP-level server error with no actionable GraphQL error
  if (!first && status >= 500) {
    return new AxiError(
      `Linear API server error (HTTP ${status})`,
      "SERVER_ERROR",
      ["This is usually transient — retry in a moment"],
    );
  }

  return new AxiError(
    message || `Linear request failed (HTTP ${status})`,
    "UNKNOWN",
  );
}
