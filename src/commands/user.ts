import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional } from "../args.js";
import { openIssueFilter } from "../state.js";
import {
  field,
  pluck,
  boolYesNo,
  renderDetail,
  renderList,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";

export const USER_HELP = `usage: linear-axi user <list|view> [args]
  list                       list workspace members
  view <EMAIL|NAME|ID>       show a user and their open assigned issues
`;

interface User {
  id: string;
  name: string;
  displayName: string;
  email: string;
  active: boolean;
}

const USERS_QUERY = `
query Users {
  users(first: 250) {
    nodes { id name displayName email active }
    pageInfo { hasNextPage }
  }
}`;

const USER_ISSUES_QUERY = `
query UserIssues($id: String!, $filter: IssueFilter) {
  user(id: $id) {
    assignedIssues(first: 10, filter: $filter, orderBy: updatedAt) {
      nodes { identifier title state { name } }
    }
  }
}`;

export async function userCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? "list" : first;
  if (sub === "view") return viewUser(args, ctx);
  if (sub === "list") return listUsers(ctx);
  throw new AxiError(`Unknown user subcommand: ${sub}`, "VALIDATION_ERROR", [
    "Run `linear-axi user --help` for usage",
  ]);
}

async function fetchUsers(ctx?: LinearContext): Promise<User[]> {
  const data = await linearRequest<{ users: { nodes: User[] } }>(
    USERS_QUERY,
    {},
    ctx,
  );
  return data.users.nodes;
}

async function listUsers(ctx?: LinearContext): Promise<string> {
  const users = await fetchUsers(ctx);
  return renderOutput([
    users.length
      ? renderList("users", users, [
          field("displayName", "name"),
          field("email"),
          boolYesNo("active"),
        ])
      : "users: 0 found",
    formatCountLine({ count: users.length }),
  ]);
}

async function viewUser(args: string[], ctx?: LinearContext): Promise<string> {
  const query = getPositional(args, 1);
  if (!query) {
    throw new AxiError("user view requires a query", "VALIDATION_ERROR", [
      "Run `linear-axi user view <EMAIL|NAME>`",
    ]);
  }

  const users = await fetchUsers(ctx);
  const q = query.toLowerCase();
  const user = users.find(
    (u) =>
      u.id === query ||
      u.email.toLowerCase() === q ||
      u.displayName.toLowerCase() === q ||
      u.name.toLowerCase() === q,
  );
  if (!user) {
    throw new AxiError(`No user matching "${query}"`, "NOT_FOUND", [
      "Run `linear-axi user list` to see workspace members",
    ]);
  }

  const data = await linearRequest<{
    user: {
      assignedIssues: {
        nodes: Array<{
          identifier: string;
          title: string;
          state: { name: string };
        }>;
      };
    };
  }>(USER_ISSUES_QUERY, { id: user.id, filter: openIssueFilter() }, ctx);
  const issues = data.user.assignedIssues.nodes;

  return renderOutput([
    renderDetail("user", user, [
      field("displayName", "name"),
      field("email"),
      boolYesNo("active"),
    ]),
    issues.length
      ? renderList("assignedIssues", issues, [
          field("identifier"),
          field("title"),
          pluck("state", "name", "state"),
        ])
      : "assignedIssues: 0 open",
  ]);
}
