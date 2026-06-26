import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional } from "../args.js";
import { truncateBody } from "../body.js";
import {
  field,
  pluck,
  custom,
  mapEnum,
  renderDetail,
  renderList,
  renderHelp,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";

export const PROJECT_HELP = `usage: linear-axi project <subcommand> [args] [flags]
  list [--limit <n>]         list projects (name, state, health, progress)
  view <NAME|ID>             show a project with its milestones
  create --name "..."        create a project (--team <KEY>, --description "...")
  update <NAME|ID> [flags]   edit a project (--name, --state, --description, --target-date)
`;

const HEALTH_MAP = {
  onTrack: "on-track",
  atRisk: "at-risk",
  offTrack: "off-track",
};

const PROJECT_LIST_QUERY = `
query Projects($first: Int) {
  projects(first: $first, orderBy: updatedAt) {
    nodes { id name state health progress }
    pageInfo { hasNextPage }
  }
}`;

const PROJECT_RESOLVE_QUERY = `
query ProjectsResolve {
  projects(first: 250) { nodes { id name } }
}`;

const PROJECT_DETAIL_QUERY = `
query Project($id: String!) {
  project(id: $id) {
    name
    description
    state
    health
    progress
    startDate
    targetDate
    url
    lead { displayName }
    projectMilestones(first: 50) { nodes { name targetDate } }
  }
}`;

interface ProjectRef {
  id: string;
  name: string;
}

/** Percent label for a 0–1 progress float. */
const progressField = custom("progress", (it) =>
  typeof it.progress === "number" ? `${Math.round(it.progress * 100)}%` : "0%",
);

/** Resolve a project by exact id or case-insensitive name. */
export async function resolveProject(
  ctx: LinearContext | undefined,
  query: string,
): Promise<ProjectRef> {
  const data = await linearRequest<{ projects: { nodes: ProjectRef[] } }>(
    PROJECT_RESOLVE_QUERY,
    {},
    ctx,
  );
  const match = data.projects.nodes.find(
    (p) => p.id === query || p.name.toLowerCase() === query.toLowerCase(),
  );
  if (!match) {
    throw new AxiError(`No project matching "${query}"`, "NOT_FOUND", [
      "Run `linear-axi project list` to see available projects",
    ]);
  }
  return match;
}

export async function projectCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? "list" : first;
  switch (sub) {
    case "view":
      return viewProject(args, ctx);
    case "list":
      return listProjects(args, ctx);
    default:
      throw new AxiError(
        `Unknown project subcommand: ${sub}`,
        "VALIDATION_ERROR",
        ["Run `linear-axi project --help` for usage"],
      );
  }
}

async function listProjects(
  _args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const data = await linearRequest<{
    projects: {
      nodes: Array<Record<string, unknown>>;
      pageInfo: { hasNextPage: boolean };
    };
  }>(PROJECT_LIST_QUERY, { first: 50 }, ctx);
  const projects = data.projects.nodes;

  return renderOutput([
    projects.length
      ? renderList("projects", projects, [
          field("name"),
          field("state"),
          mapEnum("health", HEALTH_MAP, "unknown"),
          progressField,
        ])
      : "projects: 0 found",
    formatCountLine({
      count: projects.length,
      hasMore: data.projects.pageInfo.hasNextPage,
    }),
    renderHelp(["Run `linear-axi project view <NAME>` for details"]),
  ]);
}

async function viewProject(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const query = getPositional(args, 1);
  if (!query) {
    throw new AxiError(
      "project view requires a name or id",
      "VALIDATION_ERROR",
      ["Run `linear-axi project view <NAME>`"],
    );
  }
  const ref = await resolveProject(ctx, query);
  const data = await linearRequest<{
    project: {
      name: string;
      description: string | null;
      state: string;
      health: string | null;
      progress: number;
      targetDate: string | null;
      url: string;
      lead: { displayName: string } | null;
      projectMilestones: {
        nodes: Array<{ name: string; targetDate: string | null }>;
      };
    };
  }>(PROJECT_DETAIL_QUERY, { id: ref.id }, ctx);
  const p = data.project;

  return renderOutput([
    renderDetail("project", p, [
      field("name"),
      field("state"),
      mapEnum("health", HEALTH_MAP, "unknown"),
      progressField,
      field("targetDate", "target"),
      pluck("lead", "displayName", "lead"),
      field("url"),
      custom("description", (it) => truncateBody(it.description)),
    ]),
    p.projectMilestones.nodes.length
      ? renderList("milestones", p.projectMilestones.nodes, [
          field("name"),
          field("targetDate", "target"),
        ])
      : "milestones: 0",
  ]);
}
