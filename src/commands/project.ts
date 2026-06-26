import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional, takeFlag, takeBoolFlag } from "../args.js";
import { truncateBody, takeBody } from "../body.js";
import { resolveTeamId } from "./team.js";
import {
  field,
  pluck,
  custom,
  mapEnum,
  percentField,
  renderDetail,
  renderList,
  renderHelp,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";

export const PROJECT_HELP = `usage: linear-axi project <subcommand> [args] [flags]
  list [--limit <n>]         list projects (name, state, health, progress)
  view <NAME|ID> [--full]    show a project with its milestones
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

const progressField = percentField("progress");

const DEFAULT_LIMIT = 50;

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
  const byId = data.projects.nodes.find((p) => p.id === query);
  if (byId) return byId;

  const byName = data.projects.nodes.filter(
    (p) => p.name.toLowerCase() === query.toLowerCase(),
  );
  if (byName.length === 0) {
    throw new AxiError(`No project matching "${query}"`, "NOT_FOUND", [
      "Run `linear-axi project list` to see available projects",
    ]);
  }
  if (byName.length > 1) {
    throw new AxiError(
      `Multiple projects named "${query}"`,
      "VALIDATION_ERROR",
      [
        "Re-run with one of these ids to disambiguate:",
        ...byName.map((p) => `  ${p.id}`),
      ],
    );
  }
  return byName[0];
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
    case "create":
      return createProject(args, ctx);
    case "update":
      return updateProject(args, ctx);
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
  const data = await linearRequest<{
    projects: {
      nodes: Array<Record<string, unknown>>;
      pageInfo: { hasNextPage: boolean };
    };
  }>(PROJECT_LIST_QUERY, { first: limit }, ctx);
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
  const full = takeBoolFlag(args, "--full");
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
      startDate: string | null;
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
      field("startDate", "start"),
      field("targetDate", "target"),
      pluck("lead", "displayName", "lead"),
      field("url"),
      custom("description", (it) =>
        full ? (it.description ?? "") : truncateBody(it.description),
      ),
    ]),
    p.projectMilestones.nodes.length
      ? renderList("milestones", p.projectMilestones.nodes, [
          field("name"),
          field("targetDate", "target"),
        ])
      : "milestones: 0",
  ]);
}

const PROJECT_CREATE_MUTATION = `
mutation ProjectCreate($input: ProjectCreateInput!) {
  projectCreate(input: $input) {
    success
    project { name url state }
  }
}`;

const PROJECT_UPDATE_MUTATION = `
mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
  projectUpdate(id: $id, input: $input) {
    success
    project { name url state health }
  }
}`;

const mutatedProjectSchema = [
  field("name"),
  field("state"),
  mapEnum("health", HEALTH_MAP, "unknown"),
  field("url"),
];

async function createProject(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const name = takeFlag(args, "--name");
  const description = takeBody(args, {
    inlineFlags: ["--description"],
    fileFlags: ["--description-file"],
  });
  const teamFlag = takeFlag(args, "--team");
  if (!name) {
    throw new AxiError("project create requires --name", "VALIDATION_ERROR", [
      'Run `linear-axi project create --name "..." --team <KEY>`',
    ]);
  }

  const team = await resolveTeamId(ctx, teamFlag);
  const input: Record<string, unknown> = { name, teamIds: [team.id] };
  if (description !== undefined) input.description = description;

  const data = await linearRequest<{
    projectCreate: { success: boolean; project: Record<string, unknown> };
  }>(PROJECT_CREATE_MUTATION, { input }, ctx);
  if (!data.projectCreate.success) {
    throw new AxiError("Failed to create project", "UNKNOWN");
  }

  return renderOutput([
    renderDetail("project", data.projectCreate.project, [
      field("name"),
      field("state"),
      field("url"),
    ]),
    renderHelp(["Run `linear-axi project view <NAME>` to see the new project"]),
  ]);
}

async function updateProject(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const name = takeFlag(args, "--name");
  const state = takeFlag(args, "--state");
  const targetDate = takeFlag(args, "--target-date");
  const description = takeBody(args, {
    inlineFlags: ["--description"],
    fileFlags: ["--description-file"],
  });
  const query = getPositional(args, 1);
  if (!query) {
    throw new AxiError(
      "project update requires a name or id",
      "VALIDATION_ERROR",
    );
  }

  const input: Record<string, unknown> = {};
  if (name !== undefined) input.name = name;
  if (state !== undefined) input.state = state;
  if (targetDate !== undefined) input.targetDate = targetDate;
  if (description !== undefined) input.description = description;

  if (Object.keys(input).length === 0) {
    throw new AxiError("Nothing to update", "VALIDATION_ERROR", [
      "Pass at least one of --name, --state, --description, --target-date",
    ]);
  }

  const ref = await resolveProject(ctx, query);
  const data = await linearRequest<{
    projectUpdate: { success: boolean; project: Record<string, unknown> };
  }>(PROJECT_UPDATE_MUTATION, { id: ref.id, input }, ctx);
  if (!data.projectUpdate.success) {
    throw new AxiError("Failed to update project", "UNKNOWN");
  }

  return renderOutput([
    renderDetail("project", data.projectUpdate.project, mutatedProjectSchema),
  ]);
}
