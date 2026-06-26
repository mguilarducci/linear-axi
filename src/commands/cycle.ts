import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { takeFlag } from "../args.js";
import {
  field,
  custom,
  percentField,
  renderDetail,
  renderList,
  renderHelp,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";
import { resolveTeamId } from "./team.js";

export const CYCLE_HELP = `usage: linear-axi cycle <list|view> [flags]
  list --team <KEY>          list a team's cycles
  view --team <KEY>          show the team's active cycle
If --team is omitted, LINEAR_TEAM (or the only team) is used.
`;

interface Cycle {
  number: number;
  name: string | null;
  startsAt: string;
  endsAt: string;
  progress: number;
}

const CYCLE_LIST_QUERY = `
query TeamCycles($id: String!) {
  team(id: $id) {
    cycles(first: 20) {
      nodes { number name startsAt endsAt progress }
    }
  }
}`;

const CYCLE_ACTIVE_QUERY = `
query TeamActiveCycle($id: String!) {
  team(id: $id) {
    activeCycle { number name startsAt endsAt progress }
  }
}`;

/** "Sprint 3" if named, else "Cycle 3". */
const nameField = custom("name", (it) =>
  it.name ? it.name : `Cycle ${it.number}`,
);
const progressField = percentField("progress");

export async function cycleCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? "list" : first;
  if (sub !== "list" && sub !== "view") {
    throw new AxiError(`Unknown cycle subcommand: ${sub}`, "VALIDATION_ERROR", [
      "Run `linear-axi cycle --help` for usage",
    ]);
  }

  const team = await resolveTeamId(ctx, takeFlag(args, "--team"));
  if (sub === "view") return viewActiveCycle(team.id, team.key, ctx);
  return listCycles(team.id, ctx);
}

async function listCycles(
  teamId: string,
  ctx?: LinearContext,
): Promise<string> {
  const data = await linearRequest<{ team: { cycles: { nodes: Cycle[] } } }>(
    CYCLE_LIST_QUERY,
    { id: teamId },
    ctx,
  );
  const cycles = data.team.cycles.nodes;

  return renderOutput([
    cycles.length
      ? renderList("cycles", cycles, [
          field("number"),
          nameField,
          progressField,
          field("endsAt", "ends"),
        ])
      : "cycles: 0 found",
    formatCountLine({ count: cycles.length }),
  ]);
}

async function viewActiveCycle(
  teamId: string,
  teamKey: string,
  ctx?: LinearContext,
): Promise<string> {
  const data = await linearRequest<{ team: { activeCycle: Cycle | null } }>(
    CYCLE_ACTIVE_QUERY,
    { id: teamId },
    ctx,
  );
  const cycle = data.team.activeCycle;
  if (!cycle) {
    return renderOutput([
      `cycle: no active cycle for team ${teamKey}`,
      renderHelp([
        "Run `linear-axi cycle list --team " + teamKey + "` to see all cycles",
      ]),
    ]);
  }

  return renderDetail("cycle", cycle, [
    field("number"),
    nameField,
    field("startsAt", "starts"),
    field("endsAt", "ends"),
    progressField,
  ]);
}
