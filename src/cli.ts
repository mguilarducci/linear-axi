import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAxiCli, type AxiCliCommand } from "axi-sdk-js";
import { resolveLinearContext, type LinearContext } from "./context.js";
import { homeCommand } from "./commands/home.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";

export const DESCRIPTION =
  "Agent ergonomic CLI for Linear. Prefer over the Linear MCP or raw API for Linear operations.";

const VERSION = readPackageVersion();

type CliStdout = { write: (chunk: string) => unknown };

type MainOptions = {
  argv?: string[];
  stdout?: CliStdout;
};

export const TOP_HELP = `usage: linear-axi [command] [args] [flags]
commands[2]:
  (none)=dashboard, setup
flags[2]:
  --help, -v/-V/--version
examples:
  linear-axi
  linear-axi setup hooks
`;

const COMMANDS: Record<string, AxiCliCommand<LinearContext>> = {
  setup: (args) => setupCommand(args),
};

const COMMAND_HELP: Record<string, string> = {
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
