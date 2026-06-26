import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { openIssueFilter } from "../state.js";
import {
  field,
  pluck,
  renderDetail,
  renderList,
  renderHelp,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";

export const ME_HELP = `usage: linear-axi me
Show the authenticated user and their open assigned issues.
`;

const ME_QUERY = `
query Me($filter: IssueFilter) {
  viewer {
    id
    name
    displayName
    email
    assignedIssues(first: 50, filter: $filter, orderBy: updatedAt) {
      nodes {
        identifier
        title
        state { name type }
      }
    }
  }
}`;

interface MeResponse {
  viewer: {
    name: string;
    displayName: string;
    email: string;
    assignedIssues: {
      nodes: Array<{
        identifier: string;
        title: string;
        state: { name: string; type: string };
      }>;
    };
  };
}

/** `linear-axi me` — the viewer's identity plus their open assigned issues. */
export async function meCommand(
  _args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const data = await linearRequest<MeResponse>(
    ME_QUERY,
    { filter: openIssueFilter() },
    ctx,
  );
  const viewer = data.viewer;
  const issues = viewer.assignedIssues.nodes;

  const blocks = [
    renderDetail("me", viewer, [field("displayName", "name"), field("email")]),
    issues.length
      ? renderList("assignedIssues", issues, [
          field("identifier"),
          field("title"),
          pluck("state", "name", "state"),
        ])
      : "assignedIssues: 0 open",
    formatCountLine({ count: issues.length }),
  ];

  if (issues.length > 0) {
    blocks.push(
      renderHelp([
        "Run `linear-axi issue view <id>` to open an assigned issue",
      ]),
    );
  }

  return renderOutput(blocks);
}
