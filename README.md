<h1 align="center">linear-axi</h1>

<p align="center">
  <a href="https://github.com/mguilarducci/linear-axi/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/mguilarducci/linear-axi/ci.yml?style=flat-square&label=ci" /></a>
  <a href="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square"><img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=flat-square" /></a>
  <a href="https://opensource.org/licenses/MIT"><img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" /></a>
</p>

Linear CLI for agents — designed with [AXI](https://github.com/kunchenguid/axi) (Agent eXperience Interface).

Talks to Linear with token-efficient [TOON](https://toonformat.dev/) output, contextual next-step suggestions, and structured error handling.
Built for autonomous agents that interact with Linear via shell execution.

> **Status: in progress.** This repository ships the AXI plumbing — the SKILL.md generation pipeline and CI — alongside a live no-arg dashboard and the core Linear commands: `issue` (list/view/create/update/comment/close/reopen), `me`, `team`, the planning surface — `project` (list/view/create/update), `cycle` (list/view), and `milestone` (list) — and a raw `api` escape hatch, plus `setup hooks`.

## Quick Start

Install the linear-axi skill in the [Agent Skills](https://agentskills.io) format with [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add mguilarducci/linear-axi --skill linear-axi -g
```

That is the entire setup — no npm install needed.
The skill teaches your agent to run linear-axi through `npx -y linear-axi`, so the CLI comes along on demand.
You provide Linear credentials via the `LINEAR_API_KEY` environment variable (Node 20+ required).

`-g` installs the skill for all projects (`~/.claude/skills/`); drop it to install for the current project only (`.claude/skills/`).

## Other Ways to Install

### Zero setup

linear-axi is an AXI, so any capable agent can run the CLI directly with nothing installed at all:

```
Execute `npx -y linear-axi` to get Linear tools.
```

### Session hook

Want ambient Linear context fed into every agent session instead of loading on demand?
Install the CLI globally and opt into the hook:

```sh
npm install -g linear-axi
linear-axi setup hooks
```

This installs a `SessionStart` hook for **Claude Code**, **Codex**, and **OpenCode**.
**Restart your agent session after running this** so the new hook takes effect.

## Usage

```bash
linear-axi                          # dashboard — your assigned issues and teams, no args needed
linear-axi me                       # show the authenticated user and their open issues
linear-axi issue list               # list open issues (--state, --team, --assignee me, --limit)
linear-axi issue view ENG-123       # show one issue (add --full for the complete body)
linear-axi issue create --title "..."  # file an issue (--team, --description)
linear-axi issue update ENG-123 --title "..."  # edit title, description, or assignee
linear-axi issue comment ENG-123 --body "..."  # comment (or --body-file <path>)
linear-axi issue close ENG-123      # move to a completed state (idempotent)
linear-axi issue reopen ENG-123     # move back to an open state (idempotent)
linear-axi team list                # list teams (team view <KEY> for states and labels)
linear-axi project list             # list projects (name, state, health, progress)
linear-axi project view "Roadmap"   # show one project and its milestones (add --full)
linear-axi project create --name "..."  # create a project (--team, --description)
linear-axi project update "Roadmap" --state completed  # edit name, state, description, or --target-date
linear-axi cycle list --team ENG    # list a team's cycles (--team, else LINEAR_TEAM)
linear-axi cycle view --team ENG    # show the team's active cycle
linear-axi milestone list --project "Roadmap"  # list a project's milestones
linear-axi api '{ viewer { id } }'  # raw GraphQL escape hatch (--var key=value)
linear-axi setup hooks              # install optional agent session hooks
```

Run `linear-axi <command> --help` for full per-command usage.

### Configuration

| Variable         | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| `LINEAR_API_KEY` | Linear personal API key used to authenticate   |
| `LINEAR_TEAM`    | Optional default team key to scope commands to |

### Global flags

- `--help` — show help for any command
- `-v`, `-V`, `--version` — show the installed `linear-axi` version

## Development

```sh
pnpm install         # Install dependencies
pnpm run build       # Compile TypeScript to dist/
pnpm run build:skill # Regenerate skills/linear-axi/SKILL.md from shared skill source
pnpm run dev         # Run the CLI directly with tsx
pnpm run lint        # Lint with eslint
pnpm run format      # Format with prettier
pnpm test            # Run tests with vitest
```

The committed `skills/linear-axi/SKILL.md` is generated by `pnpm run build:skill`; `pnpm test` fails if it drifts from the shared CLI guidance.
The npm package includes `skills/linear-axi/`, so published releases ship the same installable Agent Skill documented in Quick Start.

### Adding a command

1. Create `src/commands/<name>.ts` exporting a `<name>Command(args, ctx)` handler and a `<NAME>_HELP` string.
2. Register it in the `COMMANDS` and `COMMAND_HELP` maps in `src/cli.ts`, and add it to the `commands[N]` block in `TOP_HELP`.
3. Run `pnpm run build:skill` to refresh the generated skill, then `pnpm test`.

## License

MIT
