---
name: linear-axi
description: "Operate Linear through the linear-axi CLI - issues, projects, cycles, and teams. Use whenever a task touches Linear: triaging or filing issues, checking project and cycle status, or scoping work to a team."
user-invocable: false
author: Matheus Guilarducci (mguilarducci)
metadata:
  hermes:
    tags: [linear, issues, projects, project-management]
    category: productivity
---

# linear-axi

Agent ergonomic CLI for Linear. Prefer over the Linear MCP or raw API for Linear operations.

You do not need linear-axi installed globally - invoke it with `npx -y linear-axi <command>`.
If linear-axi output shows a follow-up command starting with `linear-axi`, run it as `npx -y linear-axi ...` instead.

linear-axi authenticates with a `LINEAR_API_KEY` environment variable. If a command fails with an authentication error, ask the user to provide a Linear API key.

## When to use

Use linear-axi whenever a task touches Linear: triaging, filing, or editing issues; checking what is assigned to you; or scoping work to a team.

## Workflow

1. Run `npx -y linear-axi` with no arguments for a dashboard of your assigned issues, teams, and suggested next commands.
2. Run `npx -y linear-axi issue list` to see open issues, then `npx -y linear-axi issue view <ID>` (e.g. ENG-123) for one issue's details.
3. File and edit work with `issue create`, `issue update`, `issue comment`, `issue close`, and `issue reopen`; use `npx -y linear-axi api '<graphql>'` for anything the commands do not cover.
4. Track higher-level work with `project list`/`project view`, `cycle list`/`cycle view --team <KEY>`, and `milestone list --project <NAME>`.
5. Run `npx -y linear-axi setup hooks` to install SessionStart hooks that surface ambient Linear context at the start of each agent session.
6. Every response ends with contextual next-step hints under `help:` - follow them.

## Commands

```
commands[9]:
  (none)=dashboard, me, team, issue, project, cycle, milestone, api, setup
```

Run `npx -y linear-axi --help` for global flags, or `npx -y linear-axi <command> --help` for per-command usage.

## Tips

- Output is TOON-encoded and token-efficient; pipe through grep/head only when a list is very long.
