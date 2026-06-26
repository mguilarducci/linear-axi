import { AxiError } from "axi-sdk-js";
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

export const HOME_HELP = "";

const HOME_QUERY = `
query Home($filter: IssueFilter) {
  viewer {
    displayName
    assignedIssues(first: 5, filter: $filter, orderBy: updatedAt) {
      nodes { identifier title state { name } }
    }
  }
  teams(first: 10, orderBy: updatedAt) {
    nodes { key name }
  }
}`;

interface HomeResponse {
  viewer: {
    displayName: string;
    assignedIssues: {
      nodes: Array<{
        identifier: string;
        title: string;
        state: { name: string };
      }>;
    };
  };
  teams: { nodes: Array<{ key: string; name: string }> };
}

/**
 * No-arg dashboard (AXI principle #8, "content first"). When authenticated it
 * shows the viewer, their open assigned issues, and the workspace's teams so an
 * agent can act immediately. With no key, or on a failed request, it degrades
 * to actionable guidance instead of throwing — this runs on every session start.
 */
export async function homeCommand(
  _args: string[],
  ctx?: LinearContext,
): Promise<string> {
  if (!ctx?.apiKeyPresent) {
    return renderOutput([
      "linear: not connected",
      renderHelp([
        "Set LINEAR_API_KEY to connect linear-axi to your workspace",
        "Run `linear-axi setup hooks` to install agent session hooks",
      ]),
    ]);
  }

  try {
    const data = await linearRequest<HomeResponse>(
      HOME_QUERY,
      { filter: openIssueFilter() },
      ctx,
    );
    const issues = data.viewer.assignedIssues.nodes;
    const teams = data.teams.nodes;

    return renderOutput([
      renderDetail("me", data.viewer, [field("displayName", "name")]),
      issues.length
        ? renderList("myIssues", issues, [
            field("identifier"),
            field("title"),
            pluck("state", "name", "state"),
          ])
        : "myIssues: 0 open",
      teams.length
        ? renderList("teams", teams, [field("key"), field("name")])
        : "teams: 0",
      renderHelp([
        "Run `linear-axi issue list` to see open issues",
        "Run `linear-axi me` for your assigned work",
        'Run `linear-axi issue create --team <KEY> --title "..."` to file an issue',
      ]),
    ]);
  } catch (error) {
    const suggestions =
      error instanceof AxiError && error.suggestions.length > 0
        ? error.suggestions
        : ["Check LINEAR_API_KEY and your network connection, then retry"];
    return renderOutput([
      "linear: could not load workspace",
      renderHelp(suggestions),
    ]);
  }
}
