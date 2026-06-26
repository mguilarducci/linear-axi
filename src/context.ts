/**
 * Ambient context resolved once per invocation and handed to every command.
 *
 * For Linear the natural context is the workspace the agent is acting in: the
 * presence of a `LINEAR_API_KEY` and, optionally, a default team to scope
 * commands to. Commands receive this so they don't each re-read the environment.
 */
import { AxiError } from "axi-sdk-js";

export interface LinearContext {
  /** Whether a `LINEAR_API_KEY` is present in the environment. */
  apiKeyPresent: boolean;
  /** The `LINEAR_API_KEY` value, when present — used to authenticate requests. */
  apiKey?: string;
  /** Default team key (e.g. "ENG") from `LINEAR_TEAM`, when set. */
  teamKey?: string;
}

/**
 * Resolve the Linear context from the environment.
 *
 * Priority is environment-only for now: `LINEAR_API_KEY` authenticates and
 * `LINEAR_TEAM` scopes. This is intentionally side-effect free so it is cheap
 * to call on every command, including the no-arg dashboard.
 */
export function resolveLinearContext(): LinearContext {
  const apiKey = process.env["LINEAR_API_KEY"];
  const teamKey = process.env["LINEAR_TEAM"];

  const present = Boolean(apiKey && apiKey.length > 0);
  return {
    apiKeyPresent: present,
    ...(present ? { apiKey } : {}),
    ...(teamKey ? { teamKey } : {}),
  };
}

/**
 * Return the API key, or throw a structured error when it is missing. Commands
 * that hit the Linear API call this before doing any work, so a missing key
 * fails fast with an actionable message instead of a network error.
 */
export function requireApiKey(ctx: LinearContext | undefined): string {
  if (ctx?.apiKey) return ctx.apiKey;
  throw new AxiError("LINEAR_API_KEY is not set", "AUTH_REQUIRED", [
    "Set LINEAR_API_KEY to a Linear personal API key, then retry",
    "Create one at Linear → Settings → Security & access → Personal API keys",
  ]);
}
