/**
 * Ambient context resolved once per invocation and handed to every command.
 *
 * For Linear the natural context is the workspace the agent is acting in: the
 * presence of a `LINEAR_API_KEY` and, optionally, a default team to scope
 * commands to. Commands receive this so they don't each re-read the environment.
 */
export interface LinearContext {
  /** Whether a `LINEAR_API_KEY` is present in the environment. */
  apiKeyPresent: boolean;
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

  return {
    apiKeyPresent: Boolean(apiKey && apiKey.length > 0),
    ...(teamKey ? { teamKey } : {}),
  };
}
