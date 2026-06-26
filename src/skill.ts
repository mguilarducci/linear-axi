import { DESCRIPTION, TOP_HELP } from "./cli.js";

// Trigger string Claude Code (and other agents) match against to auto-load the
// skill. Kept terse and outcome-focused so it fires on "needs Linear" intents.
export const SKILL_DESCRIPTION =
  "Operate Linear through the linear-axi CLI - issues, projects, cycles, and teams. " +
  "Use whenever a task touches Linear: triaging or filing issues, checking project " +
  "and cycle status, or scoping work to a team.";

export const SKILL_AUTHOR = "Matheus Guilarducci (mguilarducci)";

// Extended frontmatter read by Nous Research's Hermes Agent harness
// (https://hermes-agent.nousresearch.com/docs/user-guide/features/skills).
// Harnesses that don't know these fields (e.g. Claude Code) ignore them.
export const HERMES_TAGS = [
  "linear",
  "issues",
  "projects",
  "project-management",
];
export const HERMES_CATEGORY = "productivity";

function yamlDoubleQuote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Extract the `commands[N]:` block from the top-level help so the skill's
 * command list can never drift from what `linear-axi --help` prints.
 */
export function extractCommandsBlock(): string {
  const match = TOP_HELP.match(/^(commands\[\d+\]:\n(?: {2}.*\n)+)/m);
  if (!match) {
    throw new Error("Could not find commands block in TOP_HELP");
  }
  return match[1].trimEnd();
}

/**
 * Render the installable SKILL.md for the linear-axi skill. The body is built
 * from the same shared guidance the CLI prints (description and top-level
 * help), rewriting invocations to non-interactive `npx -y linear-axi ...` so
 * the CLI comes along on demand.
 *
 * @returns full SKILL.md contents including YAML frontmatter
 */
export function createSkillMarkdown(): string {
  return `---
name: linear-axi
description: ${yamlDoubleQuote(SKILL_DESCRIPTION)}
user-invocable: false
author: ${SKILL_AUTHOR}
metadata:
  hermes:
    tags: [${HERMES_TAGS.join(", ")}]
    category: ${HERMES_CATEGORY}
---

# linear-axi

${DESCRIPTION}

You do not need linear-axi installed globally - invoke it with \`npx -y linear-axi <command>\`.
If linear-axi output shows a follow-up command starting with \`linear-axi\`, run it as \`npx -y linear-axi ...\` instead.

linear-axi authenticates with a \`LINEAR_API_KEY\` environment variable. If a command fails with an authentication error, ask the user to provide a Linear API key.

## When to use

Use linear-axi whenever a task touches Linear: triaging, filing, or editing issues; checking what is assigned to you; or scoping work to a team.

## Workflow

1. Run \`npx -y linear-axi\` with no arguments for a dashboard of your assigned issues, teams, and suggested next commands.
2. Run \`npx -y linear-axi issue list\` to see open issues, then \`npx -y linear-axi issue view <ID>\` (e.g. ENG-123) for one issue's details.
3. File and edit work with \`issue create\`, \`issue update\`, \`issue comment\`, \`issue close\`, and \`issue reopen\`; use \`npx -y linear-axi api '<graphql>'\` for anything the commands do not cover.
4. Run \`npx -y linear-axi setup hooks\` to install SessionStart hooks that surface ambient Linear context at the start of each agent session.
5. Every response ends with contextual next-step hints under \`help:\` - follow them.

## Commands

\`\`\`
${extractCommandsBlock()}
\`\`\`

Run \`npx -y linear-axi --help\` for global flags, or \`npx -y linear-axi <command> --help\` for per-command usage.

## Tips

- Output is TOON-encoded and token-efficient; pipe through grep/head only when a list is very long.
`;
}
