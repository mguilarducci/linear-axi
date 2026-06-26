import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional } from "../args.js";
import {
  field,
  renderDetail,
  renderList,
  renderHelp,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";
import { getSuggestions } from "../suggestions.js";

export const TEAM_HELP = `usage: linear-axi team <list|view> [KEY]
  team list          list all teams (key, name)
  team view <KEY>    show a team's workflow states and labels
`;

interface Team {
  id: string;
  key: string;
  name: string;
}

const TEAMS_QUERY = `
query Teams {
  teams(first: 250, orderBy: updatedAt) {
    nodes { id key name }
  }
}`;

const TEAM_DETAIL_QUERY = `
query TeamDetail($id: String!) {
  team(id: $id) {
    id
    key
    name
    states(first: 50) { nodes { name type } }
    labels(first: 50) { nodes { name } }
  }
}`;

/**
 * Resolve a team to its UUID. Precedence: explicit key argument, then the
 * `LINEAR_TEAM` default, then — only when neither is given — auto-pick the sole
 * team if the workspace has exactly one. Ambiguity and misses fail loudly.
 */
export async function resolveTeamId(
  ctx: LinearContext | undefined,
  teamKey?: string,
): Promise<Team> {
  const data = await linearRequest<{ teams: { nodes: Team[] } }>(
    TEAMS_QUERY,
    {},
    ctx,
  );
  const teams = data.teams.nodes;
  const wanted = teamKey ?? ctx?.teamKey;

  if (wanted) {
    const match = teams.find(
      (t) => t.key.toLowerCase() === wanted.toLowerCase(),
    );
    if (!match) {
      throw new AxiError(`No team with key "${wanted}"`, "NOT_FOUND", [
        "Run `linear-axi team list` to see available teams",
      ]);
    }
    return match;
  }

  if (teams.length === 1) return teams[0];
  if (teams.length === 0) {
    throw new AxiError("No teams found in this workspace", "NOT_FOUND");
  }
  throw new AxiError(
    "Multiple teams exist — specify which one",
    "VALIDATION_ERROR",
    [
      "Pass --team <KEY>, or set LINEAR_TEAM",
      "Run `linear-axi team list` to see available teams",
    ],
  );
}

export async function teamCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? undefined : first;
  switch (sub) {
    case "view":
      return viewTeam(args, ctx);
    case "list":
    case undefined:
      return listTeams(ctx);
    default:
      throw new AxiError(`Unknown team subcommand: ${sub}`, "VALIDATION_ERROR", [
        "Run `linear-axi team --help` for usage",
      ]);
  }
}

async function listTeams(ctx?: LinearContext): Promise<string> {
  const data = await linearRequest<{ teams: { nodes: Team[] } }>(
    TEAMS_QUERY,
    {},
    ctx,
  );
  const teams = data.teams.nodes;
  return renderOutput([
    teams.length
      ? renderList("teams", teams, [field("key"), field("name")])
      : "teams: 0 found",
    formatCountLine({ count: teams.length }),
    renderHelp(getSuggestions({ domain: "team", action: "list" })),
  ]);
}

async function viewTeam(args: string[], ctx?: LinearContext): Promise<string> {
  const key = getPositional(args, 1);
  if (!key) {
    throw new AxiError("team view requires a team key", "VALIDATION_ERROR", [
      "Run `linear-axi team view <KEY>`",
    ]);
  }
  const team = await resolveTeamId(ctx, key);
  const data = await linearRequest<{
    team: {
      key: string;
      name: string;
      states: { nodes: Array<{ name: string; type: string }> };
      labels: { nodes: Array<{ name: string }> };
    };
  }>(TEAM_DETAIL_QUERY, { id: team.id }, ctx);
  const t = data.team;

  return renderOutput([
    renderDetail("team", t, [field("key"), field("name")]),
    renderList("states", t.states.nodes, [field("name"), field("type")]),
    renderList("labels", t.labels.nodes, [field("name")]),
  ]);
}
