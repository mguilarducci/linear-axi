import { AxiError, installSessionStartHooks } from "axi-sdk-js";
import { renderHelp, renderOutput } from "../toon.js";

export const SETUP_HELP = `usage: linear-axi setup hooks
Install or repair agent SessionStart hooks for linear-axi ambient context.

examples:
  linear-axi setup hooks
`;

export async function setupCommand(args: string[]): Promise<string> {
  if (args.length !== 1 || args[0] !== "hooks") {
    throw new AxiError("Unknown setup action", "VALIDATION_ERROR", [
      "Run `linear-axi setup hooks`",
    ]);
  }

  const errors: string[] = [];
  installSessionStartHooks({ onError: (message) => errors.push(message) });

  if (errors.length > 0) {
    const detail = errors.map((message) => `    - ${message}`).join("\n");
    return renderOutput([
      `hooks:\n  status: incomplete\n  errors[${errors.length}]:\n${detail}`,
      renderHelp([
        "Resolve the errors above (usually a file permission issue), then re-run `linear-axi setup hooks`",
      ]),
    ]);
  }

  return renderOutput([
    "hooks:\n  status: installed\n  integrations: Claude Code, Codex, OpenCode",
    renderHelp([
      "Restart your agent session to receive linear-axi ambient context",
    ]),
  ]);
}
