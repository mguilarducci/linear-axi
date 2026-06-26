import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional, takeFlag, takeBoolFlag } from "../args.js";
import {
  openIssueFilter,
  isOpenStateType,
  CLOSED_STATE_TYPES,
} from "../state.js";
import { truncateBody, takeBody } from "../body.js";
import { resolveTeamId } from "./team.js";
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

export const ISSUE_HELP = `usage: linear-axi issue <subcommand> [args] [flags]
  list                       list issues (default: open)
    --state <open|closed|all>  filter by state bucket (default open)
    --team <KEY>               scope to a team
    --assignee me              only issues assigned to you
    --limit <n>                max issues (default 50)
  view <ID> [--full]         show one issue (e.g. ENG-123)
  create --title "..."       create an issue (--team <KEY>, --description "...")
  update <ID> [flags]        edit an issue (--title, --description, --assignee me)
  comment <ID> --body "..."  add a comment (or --body-file <path>)
  close <ID>                 move to a completed state (idempotent)
  reopen <ID>                move back to an open state (idempotent)
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
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? undefined : first;
  switch (sub) {
    case "view":
      return viewIssue(args, ctx);
    case "create":
      return createIssue(args, ctx);
    case "update":
      return updateIssue(args, ctx);
    case "comment":
      return commentIssue(args, ctx);
    case "close":
      return transitionIssue(args, ctx, "close");
    case "reopen":
      return transitionIssue(args, ctx, "reopen");
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

  if (state !== "open" && state !== "closed" && state !== "all") {
    throw new AxiError(`Invalid --state "${state}"`, "VALIDATION_ERROR", [
      "Use one of: open, closed, all",
    ]);
  }

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
  const limitRaw = takeFlag(args, "--limit");
  const limit = limitRaw === undefined ? DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new AxiError(`Invalid --limit "${limitRaw}"`, "VALIDATION_ERROR", [
      "--limit must be a positive integer",
    ]);
  }
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

const ISSUE_CREATE_MUTATION = `
mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { identifier title url state { name } }
  }
}`;

const ISSUE_UPDATE_MUTATION = `
mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue {
      identifier
      title
      url
      state { name }
      assignee { displayName }
    }
  }
}`;

const VIEWER_ID_QUERY = `query { viewer { id } }`;

const ISSUE_ID_QUERY = `
query IssueId($id: String!) {
  issue(id: $id) { id identifier }
}`;

const COMMENT_CREATE_MUTATION = `
mutation CommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) {
    success
    comment { id url }
  }
}`;

const mutatedIssueSchema = [
  field("identifier"),
  field("title"),
  pluck("state", "name", "state"),
  field("url"),
];

async function createIssue(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const title = takeFlag(args, "--title");
  const description = takeBody(args, {
    inlineFlags: ["--description"],
    fileFlags: ["--description-file"],
  });
  const teamFlag = takeFlag(args, "--team");
  if (!title) {
    throw new AxiError("issue create requires --title", "VALIDATION_ERROR", [
      'Run `linear-axi issue create --team <KEY> --title "..."`',
    ]);
  }

  const team = await resolveTeamId(ctx, teamFlag);
  const input: Record<string, unknown> = { teamId: team.id, title };
  if (description !== undefined) input.description = description;

  const data = await linearRequest<{
    issueCreate: { success: boolean; issue: Record<string, unknown> };
  }>(ISSUE_CREATE_MUTATION, { input }, ctx);
  if (!data.issueCreate.success) {
    throw new AxiError("Failed to create issue", "UNKNOWN");
  }

  return renderOutput([
    renderDetail("issue", data.issueCreate.issue, mutatedIssueSchema),
    renderHelp(["Run `linear-axi issue view <id>` to see the new issue"]),
  ]);
}

async function updateIssue(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const title = takeFlag(args, "--title");
  const description = takeBody(args, {
    inlineFlags: ["--description"],
    fileFlags: ["--description-file"],
  });
  const assignee = takeFlag(args, "--assignee");
  const id = getPositional(args, 1);
  if (!id) {
    throw new AxiError(
      "issue update requires an identifier",
      "VALIDATION_ERROR",
    );
  }

  const input: Record<string, unknown> = {};
  if (title !== undefined) input.title = title;
  if (description !== undefined) input.description = description;
  if (assignee === "me") {
    const viewer = await linearRequest<{ viewer: { id: string } }>(
      VIEWER_ID_QUERY,
      {},
      ctx,
    );
    input.assigneeId = viewer.viewer.id;
  }

  if (Object.keys(input).length === 0) {
    throw new AxiError("Nothing to update", "VALIDATION_ERROR", [
      "Pass at least one of --title, --description, or --assignee me",
    ]);
  }

  const data = await linearRequest<{
    issueUpdate: { success: boolean; issue: Record<string, unknown> };
  }>(ISSUE_UPDATE_MUTATION, { id, input }, ctx);
  if (!data.issueUpdate.success) {
    throw new AxiError("Failed to update issue", "UNKNOWN");
  }

  return renderOutput([
    renderDetail("issue", data.issueUpdate.issue, [
      ...mutatedIssueSchema,
      pluck("assignee", "displayName", "assignee"),
    ]),
  ]);
}

async function commentIssue(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const body = takeBody(args, { required: true });
  const id = getPositional(args, 1);
  if (!id) {
    throw new AxiError(
      "issue comment requires an identifier",
      "VALIDATION_ERROR",
    );
  }

  const issueData = await linearRequest<{
    issue: { id: string; identifier: string };
  }>(ISSUE_ID_QUERY, { id }, ctx);

  const data = await linearRequest<{
    commentCreate: { success: boolean; comment: { url: string } };
  }>(
    COMMENT_CREATE_MUTATION,
    { input: { issueId: issueData.issue.id, body } },
    ctx,
  );
  if (!data.commentCreate.success) {
    throw new AxiError("Failed to add comment", "UNKNOWN");
  }

  return renderOutput([
    renderDetail(
      "comment",
      {
        issue: issueData.issue.identifier,
        url: data.commentCreate.comment.url,
      },
      [field("issue"), field("url")],
    ),
  ]);
}

const ISSUE_STATES_QUERY = `
query IssueStates($id: String!) {
  issue(id: $id) {
    id
    identifier
    state { name type }
    team {
      states(first: 50) { nodes { id name type } }
    }
  }
}`;

interface WorkflowState {
  id: string;
  name: string;
  type: string;
}

/**
 * Close or reopen an issue. Linear has no close action — both move the issue to
 * a workflow state of the appropriate type within its team. Idempotent: if the
 * issue is already in the target bucket, this is a no-op with exit code 0.
 */
async function transitionIssue(
  args: string[],
  ctx: LinearContext | undefined,
  direction: "close" | "reopen",
): Promise<string> {
  const id = getPositional(args, 1);
  if (!id) {
    throw new AxiError(
      `issue ${direction} requires an identifier`,
      "VALIDATION_ERROR",
    );
  }

  const data = await linearRequest<{
    issue: {
      identifier: string;
      state: { name: string; type: string };
      team: { states: { nodes: WorkflowState[] } };
    };
  }>(ISSUE_STATES_QUERY, { id }, ctx);
  const issue = data.issue;
  const open = isOpenStateType(issue.state.type);

  // Idempotent no-ops.
  if (direction === "close" && !open) {
    return noOp(issue.identifier, issue.state.name, "already closed");
  }
  if (direction === "reopen" && open) {
    return noOp(issue.identifier, issue.state.name, "already open");
  }

  const states = issue.team.states.nodes;
  const target =
    direction === "close"
      ? states.find((s) => s.type === "completed")
      : (states.find((s) => s.type === "unstarted") ??
        states.find((s) => s.type === "backlog"));

  if (!target) {
    throw new AxiError(
      `This team has no ${direction === "close" ? "completed" : "unstarted"} workflow state`,
      "NOT_FOUND",
    );
  }

  const result = await linearRequest<{
    issueUpdate: { success: boolean; issue: Record<string, unknown> };
  }>(ISSUE_UPDATE_MUTATION, { id, input: { stateId: target.id } }, ctx);
  if (!result.issueUpdate.success) {
    throw new AxiError(`Failed to ${direction} issue`, "UNKNOWN");
  }

  return renderOutput([
    renderDetail("issue", result.issueUpdate.issue, mutatedIssueSchema),
  ]);
}

function noOp(identifier: string, stateName: string, message: string): string {
  return renderDetail(
    "issue",
    { identifier, state: stateName, message: `${message} (no-op)` },
    [field("identifier"), field("state"), field("message")],
  );
}
