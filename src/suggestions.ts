/**
 * Contextual next-step hints. After a command runs, a few logical follow-ups
 * are appended under `help:` so the agent discovers the CLI's surface by using
 * it. Suggestions are matched on (domain, action, state, isEmpty) and may
 * substitute a concrete id; unmatched contexts return nothing.
 */
export interface SuggestionContext {
  domain: string;
  action: string;
  /** "open" | "closed" — the issue's state bucket, for view suggestions. */
  state?: string;
  /** True when a list returned nothing. */
  isEmpty?: boolean;
  /** Concrete identifier (e.g. "ENG-12") to substitute into suggestions. */
  id?: string;
}

interface SuggestionEntry {
  match: (c: SuggestionContext) => boolean;
  lines: (c: SuggestionContext) => string[];
}

const TABLE: SuggestionEntry[] = [
  {
    match: (c) =>
      c.domain === "issue" && c.action === "list" && c.isEmpty === true,
    lines: () => [
      'Run `linear-axi issue create --team <KEY> --title "..."` to file the first issue',
    ],
  },
  {
    match: (c) => c.domain === "issue" && c.action === "list",
    lines: () => [
      "Run `linear-axi issue view <id>` to see full details",
      'Run `linear-axi issue create --team <KEY> --title "..."` to create an issue',
    ],
  },
  {
    match: (c) =>
      c.domain === "issue" && c.action === "view" && c.state === "open",
    lines: (c) => {
      const id = c.id ?? "<id>";
      return [
        `Run \`linear-axi issue comment ${id} --body "..."\` to comment`,
        `Run \`linear-axi issue close ${id}\` to close it`,
        `Run \`linear-axi issue update ${id} --assignee me\` to assign it to yourself`,
      ];
    },
  },
  {
    match: (c) =>
      c.domain === "issue" && c.action === "view" && c.state === "closed",
    lines: (c) => [
      `Run \`linear-axi issue reopen ${c.id ?? "<id>"}\` to reopen it`,
    ],
  },
  {
    match: (c) => c.domain === "team" && c.action === "list",
    lines: () => [
      "Run `linear-axi team view <KEY>` to see its states and labels",
    ],
  },
];

export function getSuggestions(ctx: SuggestionContext): string[] {
  for (const entry of TABLE) {
    if (entry.match(ctx)) return entry.lines(ctx);
  }
  return [];
}
