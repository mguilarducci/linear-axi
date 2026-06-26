import { readFileSync } from "node:fs";
import { AxiError } from "axi-sdk-js";
import { takeFlag } from "./args.js";

export interface TakeBodyOptions {
  /** Throw if no body is supplied. Default false. */
  required?: boolean;
  /** Inline-text flags. Default `["--body"]`. */
  inlineFlags?: string[];
  /** File-path flags. Default `["--body-file"]`. */
  fileFlags?: string[];
}

/**
 * Pull a long-text body from args, accepting either an inline flag
 * (`--body "..."`) or a file flag (`--body-file path`). Exactly one source is
 * allowed. The matched flags are spliced out of `args`.
 */
export function takeBody(
  args: string[],
  options: TakeBodyOptions = {},
): string | undefined {
  const inlineFlags = options.inlineFlags ?? ["--body"];
  const fileFlags = options.fileFlags ?? ["--body-file"];

  let inline: string | undefined;
  for (const flag of inlineFlags) {
    const value = takeFlag(args, flag);
    if (value !== undefined) inline = value;
  }

  let filePath: string | undefined;
  for (const flag of fileFlags) {
    const value = takeFlag(args, flag);
    if (value !== undefined) filePath = value;
  }

  if (inline !== undefined && filePath !== undefined) {
    throw new AxiError(
      `Use only one body source: ${inlineFlags[0]} or ${fileFlags[0]}, not both`,
      "VALIDATION_ERROR",
    );
  }

  if (filePath !== undefined) return readBodyFile(filePath, fileFlags[0]);
  if (inline !== undefined) return inline;

  if (options.required) {
    throw new AxiError(
      `${inlineFlags[0]} or ${fileFlags[0]} is required`,
      "VALIDATION_ERROR",
    );
  }
  return undefined;
}

function readBodyFile(path: string, flag: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new AxiError(
      `Could not read ${flag} file: ${path}`,
      "VALIDATION_ERROR",
    );
  }
}

/**
 * Strip token-wasting noise from body text before it is shown to an agent:
 * image embeds become a placeholder and very long bare URLs are removed.
 */
export function cleanBody(text: string): string {
  let s = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, alt: string) =>
    alt ? `[image: ${alt}]` : "[image]",
  );
  s = s.replace(/(?<!\()https?:\/\/\S{100,}/g, "[long URL removed]");
  return s;
}

/**
 * Truncate a body for a detail view, cleaning noise first and appending a hint
 * pointing at `--full` when content was cut.
 */
export function truncateBody(body: unknown, maxLen = 800): string {
  if (typeof body !== "string" || body.length === 0) return "";
  if (body.length <= maxLen) return body;
  const cleaned = cleanBody(body);
  return (
    cleaned.slice(0, maxLen) +
    `\n... (truncated, ${cleaned.length} chars total — use --full to see the complete body)`
  );
}
