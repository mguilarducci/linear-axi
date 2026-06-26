import { encode } from "@toon-format/toon";
import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional, takeAllFlags } from "../args.js";

export const API_HELP = `usage: linear-axi api '<graphql>' [--var key=value ...]
Run a raw GraphQL operation against the Linear API. The escape hatch for
anything the dedicated commands do not cover.

  --var key=value   a GraphQL variable; values are parsed as JSON when possible,
                    otherwise kept as a string (repeatable)

examples:
  linear-axi api '{ viewer { id name } }'
  linear-axi api 'query($n:Int){ issues(first:$n){ nodes { identifier } } }' --var n=5
`;

/** Parse a `--var` value as JSON (number/bool/object), falling back to string. */
function parseVarValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** `linear-axi api` — run an arbitrary GraphQL operation and print its data. */
export async function apiCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const variables: Record<string, unknown> = {};
  for (const pair of takeAllFlags(args, "--var")) {
    const eq = pair.indexOf("=");
    if (eq === -1) {
      throw new AxiError(
        `--var must be key=value (got "${pair}")`,
        "VALIDATION_ERROR",
      );
    }
    variables[pair.slice(0, eq)] = parseVarValue(pair.slice(eq + 1));
  }

  const query = getPositional(args, 0);
  if (!query) {
    throw new AxiError(
      "api requires a GraphQL query string",
      "VALIDATION_ERROR",
      ["Run `linear-axi api '{ viewer { id name } }'`"],
    );
  }

  const data = await linearRequest<unknown>(query, variables, ctx);
  return encode({ data });
}
