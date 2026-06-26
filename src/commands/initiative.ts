import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional, takeBoolFlag } from "../args.js";
import { truncateBody } from "../body.js";
import {
  field,
  custom,
  renderDetail,
  renderList,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";

export const INITIATIVE_HELP = `usage: linear-axi initiative <list|view> [args]
  list                       list initiatives (name, status)
  view <NAME|ID> [--full]    show an initiative and its projects
`;

interface InitiativeRef {
  id: string;
  name: string;
}

const INITIATIVES_QUERY = `
query Initiatives {
  initiatives(first: 50) {
    nodes { id name status }
    pageInfo { hasNextPage }
  }
}`;

const INITIATIVE_DETAIL_QUERY = `
query Initiative($id: String!) {
  initiative(id: $id) {
    name
    description
    status
    targetDate
    projects(first: 50) { nodes { name state } }
  }
}`;

export async function initiativeCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? "list" : first;
  if (sub === "view") return viewInitiative(args, ctx);
  if (sub === "list") return listInitiatives(ctx);
  throw new AxiError(
    `Unknown initiative subcommand: ${sub}`,
    "VALIDATION_ERROR",
    ["Run `linear-axi initiative --help` for usage"],
  );
}

async function listInitiatives(ctx?: LinearContext): Promise<string> {
  const data = await linearRequest<{
    initiatives: {
      nodes: Array<Record<string, unknown>>;
      pageInfo: { hasNextPage: boolean };
    };
  }>(INITIATIVES_QUERY, {}, ctx);
  const inits = data.initiatives.nodes;

  return renderOutput([
    inits.length
      ? renderList("initiatives", inits, [field("name"), field("status")])
      : "initiatives: 0 found",
    formatCountLine({
      count: inits.length,
      hasMore: data.initiatives.pageInfo.hasNextPage,
    }),
  ]);
}

async function viewInitiative(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const full = takeBoolFlag(args, "--full");
  const query = getPositional(args, 1);
  if (!query) {
    throw new AxiError(
      "initiative view requires a name or id",
      "VALIDATION_ERROR",
      ["Run `linear-axi initiative view <NAME>`"],
    );
  }

  const list = await linearRequest<{
    initiatives: { nodes: InitiativeRef[] };
  }>(INITIATIVES_QUERY, {}, ctx);
  const q = query.toLowerCase();
  const ref = list.initiatives.nodes.find(
    (i) => i.id === query || i.name.toLowerCase() === q,
  );
  if (!ref) {
    throw new AxiError(`No initiative matching "${query}"`, "NOT_FOUND", [
      "Run `linear-axi initiative list` to see initiatives",
    ]);
  }

  const data = await linearRequest<{
    initiative: {
      name: string;
      description: string | null;
      status: string;
      targetDate: string | null;
      projects: { nodes: Array<{ name: string; state: string }> };
    };
  }>(INITIATIVE_DETAIL_QUERY, { id: ref.id }, ctx);
  const init = data.initiative;

  return renderOutput([
    renderDetail("initiative", init, [
      field("name"),
      field("status"),
      field("targetDate", "target"),
      custom("description", (it) =>
        full ? (it.description ?? "") : truncateBody(it.description),
      ),
    ]),
    init.projects.nodes.length
      ? renderList("projects", init.projects.nodes, [
          field("name"),
          field("state"),
        ])
      : "projects: 0",
  ]);
}
