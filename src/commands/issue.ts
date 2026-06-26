import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional, takeFlag, takeBoolFlag } from "../args.js";
import {
  openIssueFilter,
  isOpenStateType,
  CLOSED_STATE_TYPES,
} from "../state.js";
import { truncateBody } from "../body.js";
import {
  field,
  pluck,
  custom,
  renderDetail,
  renderList,
  renderHelp,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";
import { getSuggestions } from "../suggestions.js";

export const ISSUE_HELP = `usage: linear-axi issue <list|view> [args] [flags]
  list                       list issues (default: open)
    --state <open|closed|all>  filter by state bucket (default open)
    --team <KEY>               scope to a team
    --assignee me              only issues assigned to you
    --limit <n>                max issues (default 50)
  view <ID> [--full]         show one issue (e.g. ENG-123)
`;

const DEFAULT_LIMIT = 50;

const ISSUE_LIST_QUERY = `
query Issues($filter: IssueFilter, $first: Int) {
  issues(filter: $filter, first: $first, orderBy: updatedAt) {
    nodes {
      identifier
      title
      state { name type }
      assignee { displayName }
    }
    pageInfo { hasNextPage }
  }
}`;

const ISSUE_VIEW_QUERY = `
query Issue($id: String!) {
  issue(id: $id) {
    identifier
    title
    description
    url
    state { name type }
    assignee { displayName }
    team { key }
  }
}`;

interface IssueListNode {
  identifier: string;
  title: string;
  state: { name: string; type: string };
  assignee: { displayName: string } | null;
}

export async function issueCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const sub = getPositional(args, 0);
  switch (sub) {
    case "view":
      return viewIssue(args, ctx);
    case "list":
    case undefined:
      return listIssues(args, ctx);
    default:
      throw new AxiError(
        `Unknown issue subcommand: ${sub}`,
        "VALIDATION_ERROR",
        ["Run `linear-axi issue --help` for usage"],
      );
  }
}

/** Build the GraphQL issue filter from list flags (flags are spliced out). */
function buildIssueFilter(args: string[]): Record<string, unknown> {
  const state = takeFlag(args, "--state") ?? "open";
  const team = takeFlag(args, "--team");
  const assignee = takeFlag(args, "--assignee");

  const filter: Record<string, unknown> = {};
  if (state === "open") Object.assign(filter, openIssueFilter());
  else if (state === "closed")
    filter.state = { type: { in: [...CLOSED_STATE_TYPES] } };
  // state === "all" → no state constraint

  if (team) filter.team = { key: { eq: team.toUpperCase() } };
  if (assignee === "me") filter.assignee = { isMe: { eq: true } };
  else if (assignee) filter.assignee = { email: { eq: assignee } };

  return filter;
}

async function listIssues(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const limit = Number(takeFlag(args, "--limit") ?? DEFAULT_LIMIT);
  const filter = buildIssueFilter(args);

  const data = await linearRequest<{
    issues: { nodes: IssueListNode[]; pageInfo: { hasNextPage: boolean } };
  }>(ISSUE_LIST_QUERY, { filter, first: limit }, ctx);

  const issues = data.issues.nodes;
  const isEmpty = issues.length === 0;

  return renderOutput([
    isEmpty
      ? "issues: 0 found"
      : renderList("issues", issues, [
          field("identifier"),
          field("title"),
          pluck("state", "name", "state"),
          pluck("assignee", "displayName", "assignee"),
        ]),
    formatCountLine({
      count: issues.length,
      hasMore: data.issues.pageInfo.hasNextPage,
    }),
    renderHelp(getSuggestions({ domain: "issue", action: "list", isEmpty })),
  ]);
}

async function viewIssue(args: string[], ctx?: LinearContext): Promise<string> {
  const full = takeBoolFlag(args, "--full");
  const id = getPositional(args, 1);
  if (!id) {
    throw new AxiError(
      "issue view requires an identifier",
      "VALIDATION_ERROR",
      ["Run `linear-axi issue view <ID>` (e.g. ENG-123)"],
    );
  }

  const data = await linearRequest<{
    issue: {
      identifier: string;
      title: string;
      description: string | null;
      url: string;
      state: { name: string; type: string };
      assignee: { displayName: string } | null;
    };
  }>(ISSUE_VIEW_QUERY, { id }, ctx);
  const issue = data.issue;

  const detail = renderDetail("issue", issue, [
    field("identifier"),
    field("title"),
    pluck("state", "name", "state"),
    pluck("assignee", "displayName", "assignee"),
    field("url"),
    custom("description", (it) =>
      full ? (it.description ?? "") : truncateBody(it.description),
    ),
  ]);

  const stateBucket = isOpenStateType(issue.state.type) ? "open" : "closed";
  return renderOutput([
    detail,
    renderHelp(
      getSuggestions({
        domain: "issue",
        action: "view",
        state: stateBucket,
        id: issue.identifier,
      }),
    ),
  ]);
}
