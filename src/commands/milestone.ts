import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { takeFlag } from "../args.js";
import { field, renderList, renderOutput } from "../toon.js";
import { formatCountLine } from "../format.js";
import { resolveProject } from "./project.js";

export const MILESTONE_HELP = `usage: linear-axi milestone list --project <NAME|ID>
List the milestones of a project (name, target date).
`;

const MILESTONES_QUERY = `
query ProjectMilestones($id: String!) {
  project(id: $id) {
    name
    projectMilestones(first: 50) {
      nodes { name targetDate }
    }
  }
}`;

export async function milestoneCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? "list" : first;
  if (sub !== "list") {
    throw new AxiError(
      `Unknown milestone subcommand: ${sub}`,
      "VALIDATION_ERROR",
      ["Run `linear-axi milestone list --project <NAME>`"],
    );
  }

  const projectQuery = takeFlag(args, "--project");
  if (!projectQuery) {
    throw new AxiError(
      "milestone list requires --project",
      "VALIDATION_ERROR",
      ["Run `linear-axi milestone list --project <NAME>`"],
    );
  }

  const ref = await resolveProject(ctx, projectQuery);
  const data = await linearRequest<{
    project: {
      projectMilestones: {
        nodes: Array<{ name: string; targetDate: string | null }>;
      };
    };
  }>(MILESTONES_QUERY, { id: ref.id }, ctx);
  const milestones = data.project.projectMilestones.nodes;

  return renderOutput([
    milestones.length
      ? renderList("milestones", milestones, [
          field("name"),
          field("targetDate", "target"),
        ])
      : "milestones: 0 found",
    formatCountLine({ count: milestones.length }),
  ]);
}
