# Phase 3 — Planning-surface commands (project / cycle / milestone)

Captured by driving the **real built CLI** (`dist/bin/linear-axi.js` / `main()`)
against a mocked Linear GraphQL endpoint. The query construction, team/project
resolution, structured-error handling, and TOON rendering are all the production
code paths — only the network boundary is stubbed. Output is the exact terminal
surface an agent/user sees.

## Command discovery (top-level help)

```
usage: linear-axi [command] [args] [flags]
commands[9]:
  (none)=dashboard, me, team, issue, project, cycle, milestone, api, setup
flags[2]:
  --help, -v/-V/--version
examples:
  linear-axi
  linear-axi issue list
  linear-axi issue view ENG-123
  linear-axi project list
  linear-axi setup hooks
```

## Per-command help

```
$ linear-axi project --help
usage: linear-axi project <subcommand> [args] [flags]
  list [--limit <n>]         list projects (name, state, health, progress)
  view <NAME|ID> [--full]    show a project with its milestones
  create --name "..."        create a project (--team <KEY>, --description "...")
  update <NAME|ID> [flags]   edit a project (--name, --state, --description, --target-date)

$ linear-axi cycle --help
usage: linear-axi cycle <list|view> [flags]
  list --team <KEY>          list a team's cycles
  view --team <KEY>          show the team's active cycle
If --team is omitted, LINEAR_TEAM (or the only team) is used.

$ linear-axi milestone --help
usage: linear-axi milestone list --project <NAME|ID>
List the milestones of a project (name, target date).
```

## Happy-path transcripts

```
$ linear-axi project list
projects[2]{name,state,health,progress}:
  Mobile Launch,started,on-track,62%
  Billing Revamp,planned,at-risk,10%
count: 2
help[1]:
  Run `linear-axi project view <NAME>` for details

$ linear-axi project view "Mobile Launch"
project:
  name: Mobile Launch
  state: started
  health: on-track
  progress: 62%
  start: 2026-05-01
  target: 2026-08-15
  lead: Ada Lovelace
  url: "https://linear.app/acme/project/mobile-launch"
  description: "Ship the redesigned mobile app to GA. Covers onboarding, push notifications, and the new offline mode."
milestones[2]{name,target}:
  Beta,2026-06-30
  GA,2026-08-15

$ linear-axi project create --name "API Platform" --team ENG --description "Public REST + GraphQL surface"
project:
  name: API Platform
  state: planned
  url: "https://linear.app/acme/project/api-platform"
help[1]:
  Run `linear-axi project view <NAME>` to see the new project

$ linear-axi project update "Mobile Launch" --state paused --target-date 2026-09-01
project:
  name: Mobile Launch
  state: paused
  health: at-risk
  url: "https://linear.app/acme/project/mobile-launch"

$ linear-axi cycle list --team ENG
cycles[2]{number,name,progress,ends}:
  11,Cycle 11,100%,2026-06-14
  12,Hardening,45%,2026-06-28
count: 2

$ linear-axi cycle view --team ENG
cycle:
  number: 12
  name: Hardening
  starts: 2026-06-15
  ends: 2026-06-28
  progress: 45%

$ linear-axi milestone list --project "Mobile Launch"
project: Mobile Launch
milestones[2]{name,target}:
  Beta,2026-06-30
  GA,2026-08-15
count: 2

```

## Guard / error / empty-state surfaces

```
$ linear-axi project view Launch
error: "Multiple projects named \"Launch\""
code: VALIDATION_ERROR
help[3]: "Re-run with one of these ids to disambiguate:","  p1","  p2"

$ linear-axi project list
projects: 0 found
count: 0
help[1]:
  Run `linear-axi project view <NAME>` for details

$ linear-axi milestone list
error: milestone list requires --project
code: VALIDATION_ERROR
help[1]: Run `linear-axi milestone list --project <NAME>`

```
