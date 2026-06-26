import { AxiError } from "axi-sdk-js";
import type { FieldDef } from "./toon.js";

/**
 * One opt-in extra field a command exposes through `--fields`: the GraphQL
 * selection to add to the query, plus the {@link FieldDef} to render it.
 */
export interface ExtraFieldSpec {
  graphql: string;
  def: FieldDef;
}

export interface ParseFieldsResult {
  extraDefs: FieldDef[];
  extraGraphql: string[];
}

/**
 * Validate a comma-separated `--fields` value against a command's available
 * extra fields. Unknown names fail loudly with the valid set, so the agent can
 * correct itself in one step instead of guessing.
 */
export function parseFields(
  fieldsArg: string | undefined,
  available: Record<string, ExtraFieldSpec>,
): ParseFieldsResult {
  if (fieldsArg === undefined) {
    return { extraDefs: [], extraGraphql: [] };
  }

  const requested = [
    ...new Set(
      fieldsArg
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
    ),
  ];

  const unknown = requested.filter((f) => !(f in available));
  if (unknown.length > 0) {
    const availableNames = Object.keys(available).sort().join(", ");
    throw new AxiError(
      `Unknown field(s): ${unknown.join(", ")}. Available: ${availableNames}`,
      "VALIDATION_ERROR",
    );
  }

  const extraDefs: FieldDef[] = [];
  const extraGraphql: string[] = [];
  for (const name of requested) {
    extraDefs.push(available[name].def);
    extraGraphql.push(available[name].graphql);
  }
  return { extraDefs, extraGraphql };
}
