import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { takeFlag } from "../args.js";
import {
  field,
  custom,
  renderDetail,
  renderList,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";
import { resolveTeamId } from "./team.js";

export const LABEL_HELP = `usage: linear-axi label <list|create> [flags]
  list [--team <KEY>]               list labels (name, color, scope)
  create --name "..." [flags]       create a label
    --color <hex>                     label color, e.g. #ff8800
    --team <KEY>                      team-scope the label (else workspace)
`;

interface Label {
  id: string;
  name: string;
  color: string;
  team?: { key: string } | null;
}

const LABELS_QUERY = `
query Labels($filter: IssueLabelFilter) {
  issueLabels(first: 250, filter: $filter) {
    nodes { id name color team { key } }
  }
}`;

const LABEL_CREATE_MUTATION = `
mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
  issueLabelCreate(input: $input) {
    success
    issueLabel { name color }
  }
}`;

const scopeField = custom("scope", (it) =>
  it.team ? (it.team as { key: string }).key : "workspace",
);

export async function labelCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? "list" : first;
  switch (sub) {
    case "create":
      return createLabel(args, ctx);
    case "list":
      return listLabels(args, ctx);
    default:
      throw new AxiError(
        `Unknown label subcommand: ${sub}`,
        "VALIDATION_ERROR",
        ["Run `linear-axi label --help` for usage"],
      );
  }
}

async function listLabels(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const team = takeFlag(args, "--team");
  const filter = team ? { team: { key: { eq: team.toUpperCase() } } } : {};
  const data = await linearRequest<{ issueLabels: { nodes: Label[] } }>(
    LABELS_QUERY,
    { filter },
    ctx,
  );
  const labels = data.issueLabels.nodes;

  return renderOutput([
    labels.length
      ? renderList("labels", labels, [
          field("name"),
          field("color"),
          scopeField,
        ])
      : "labels: 0 found",
    formatCountLine({ count: labels.length }),
  ]);
}

async function createLabel(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const name = takeFlag(args, "--name");
  const color = takeFlag(args, "--color");
  const teamFlag = takeFlag(args, "--team");
  if (!name) {
    throw new AxiError("label create requires --name", "VALIDATION_ERROR", [
      'Run `linear-axi label create --name "..."`',
    ]);
  }

  // Idempotent: if a label with this name already exists, acknowledge it.
  const existing = await linearRequest<{ issueLabels: { nodes: Label[] } }>(
    LABELS_QUERY,
    {},
    ctx,
  );
  const found = existing.issueLabels.nodes.find(
    (l) => l.name.toLowerCase() === name.toLowerCase(),
  );
  if (found) {
    return renderDetail(
      "label",
      { name: found.name, message: "already exists (no-op)" },
      [field("name"), field("message")],
    );
  }

  const input: Record<string, unknown> = { name };
  if (color) input.color = color;
  if (teamFlag) input.teamId = (await resolveTeamId(ctx, teamFlag)).id;

  const data = await linearRequest<{
    issueLabelCreate: { success: boolean; issueLabel: Record<string, unknown> };
  }>(LABEL_CREATE_MUTATION, { input }, ctx);

  return renderDetail("label", data.issueLabelCreate.issueLabel, [
    field("name"),
    field("color"),
  ]);
}
