import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAxiCli, type AxiCliCommand } from "axi-sdk-js";
import { resolveLinearContext, type LinearContext } from "./context.js";
import { homeCommand } from "./commands/home.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";
import { meCommand, ME_HELP } from "./commands/me.js";
import { teamCommand, TEAM_HELP } from "./commands/team.js";
import { issueCommand, ISSUE_HELP } from "./commands/issue.js";
import { projectCommand, PROJECT_HELP } from "./commands/project.js";
import { cycleCommand, CYCLE_HELP } from "./commands/cycle.js";
import { milestoneCommand, MILESTONE_HELP } from "./commands/milestone.js";
import { labelCommand, LABEL_HELP } from "./commands/label.js";
import { userCommand, USER_HELP } from "./commands/user.js";
import { documentCommand, DOCUMENT_HELP } from "./commands/document.js";
import { initiativeCommand, INITIATIVE_HELP } from "./commands/initiative.js";
import { apiCommand, API_HELP } from "./commands/api.js";

export const DESCRIPTION =
  "Agent ergonomic CLI for Linear. Prefer over the Linear MCP or raw API for Linear operations.";

const VERSION = readPackageVersion();

type CliStdout = { write: (chunk: string) => unknown };

type MainOptions = {
  argv?: string[];
  stdout?: CliStdout;
};

export const TOP_HELP = `usage: linear-axi [command] [args] [flags]
commands[13]:
  (none)=dashboard, me, team, issue, project, cycle, milestone, label, user, document, initiative, api, setup
flags[2]:
  --help, -v/-V/--version
examples:
  linear-axi
  linear-axi issue list
  linear-axi issue view ENG-123
  linear-axi project list
  linear-axi setup hooks
`;

const COMMANDS: Record<string, AxiCliCommand<LinearContext>> = {
  me: meCommand,
  team: teamCommand,
  issue: issueCommand,
  project: projectCommand,
  cycle: cycleCommand,
  milestone: milestoneCommand,
  label: labelCommand,
  user: userCommand,
  document: documentCommand,
  initiative: initiativeCommand,
  api: apiCommand,
  setup: (args) => setupCommand(args),
};

const COMMAND_HELP: Record<string, string> = {
  me: ME_HELP,
  team: TEAM_HELP,
  issue: ISSUE_HELP,
  project: PROJECT_HELP,
  cycle: CYCLE_HELP,
  milestone: MILESTONE_HELP,
  label: LABEL_HELP,
  user: USER_HELP,
  document: DOCUMENT_HELP,
  initiative: INITIATIVE_HELP,
  api: API_HELP,
  setup: SETUP_HELP,
};

export async function main(options: MainOptions = {}): Promise<void> {
  await runAxiCli<LinearContext>({
    ...(options.argv ? { argv: options.argv } : {}),
    description: DESCRIPTION,
    version: VERSION,
    topLevelHelp: TOP_HELP,
    ...(options.stdout ? { stdout: options.stdout } : {}),
    home: homeCommand,
    commands: COMMANDS,
    getCommandHelp: (command) => COMMAND_HELP[command],
    resolveContext: () => resolveLinearContext(),
  });
}

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));

  for (const candidate of [
    join(here, "..", "package.json"),
    join(here, "..", "..", "package.json"),
  ]) {
    if (!existsSync(candidate)) continue;

    const parsed = JSON.parse(readFileSync(candidate, "utf-8")) as {
      version?: unknown;
    };
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  }

  throw new Error("Could not determine linear-axi package version");
}
