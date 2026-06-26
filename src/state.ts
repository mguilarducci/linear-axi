/**
 * Linear has no open/closed boolean. Every issue points at a per-team workflow
 * state whose `type` is one of: triage, backlog, unstarted, started, completed,
 * canceled. "Open" means "not in a terminal state". This module is the single
 * place that decision lives, so list filters, the home view, and close/reopen
 * idempotency all agree on what "open" means.
 */

/** Workflow-state types that mean the issue is done — completed or abandoned. */
export const CLOSED_STATE_TYPES = ["completed", "canceled"] as const;

/** Workflow-state types that mean the issue is still active. */
export const OPEN_STATE_TYPES = [
  "triage",
  "backlog",
  "unstarted",
  "started",
] as const;

/**
 * Whether a workflow-state `type` counts as open. Unknown types are treated as
 * open so that a future Linear state type is never silently filtered out.
 */
export function isOpenStateType(type: string): boolean {
  return !(CLOSED_STATE_TYPES as readonly string[]).includes(type);
}

/**
 * The GraphQL issue-connection filter that returns only open issues, by
 * excluding the terminal state types.
 */
export function openIssueFilter(): {
  state: { type: { nin: readonly string[] } };
} {
  return { state: { type: { nin: CLOSED_STATE_TYPES } } };
}
