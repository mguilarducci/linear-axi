import { AxiError } from "axi-sdk-js";
import type { LinearContext } from "../context.js";
import { linearRequest } from "../linear.js";
import { getPositional, takeBoolFlag } from "../args.js";
import { truncateBody } from "../body.js";
import {
  field,
  pluck,
  custom,
  relativeTime,
  renderDetail,
  renderList,
  renderOutput,
} from "../toon.js";
import { formatCountLine } from "../format.js";

export const DOCUMENT_HELP = `usage: linear-axi document <list|view> [args]
  list                       list documents (title, project, updated)
  view <ID> [--full]         show a document's content
`;

const DOCUMENTS_QUERY = `
query Documents {
  documents(first: 50, orderBy: updatedAt) {
    nodes { id title project { name } updatedAt }
    pageInfo { hasNextPage }
  }
}`;

const DOCUMENT_DETAIL_QUERY = `
query Document($id: String!) {
  document(id: $id) {
    title
    content
    url
    project { name }
  }
}`;

export async function documentCommand(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? "list" : first;
  if (sub === "view") return viewDocument(args, ctx);
  if (sub === "list") return listDocuments(ctx);
  throw new AxiError(
    `Unknown document subcommand: ${sub}`,
    "VALIDATION_ERROR",
    ["Run `linear-axi document --help` for usage"],
  );
}

async function listDocuments(ctx?: LinearContext): Promise<string> {
  const data = await linearRequest<{
    documents: {
      nodes: Array<Record<string, unknown>>;
      pageInfo: { hasNextPage: boolean };
    };
  }>(DOCUMENTS_QUERY, {}, ctx);
  const docs = data.documents.nodes;

  return renderOutput([
    docs.length
      ? renderList("documents", docs, [
          field("title"),
          pluck("project", "name", "project"),
          relativeTime("updatedAt", "updated"),
        ])
      : "documents: 0 found",
    formatCountLine({
      count: docs.length,
      hasMore: data.documents.pageInfo.hasNextPage,
    }),
  ]);
}

async function viewDocument(
  args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const full = takeBoolFlag(args, "--full");
  const id = getPositional(args, 1);
  if (!id) {
    throw new AxiError("document view requires an id", "VALIDATION_ERROR", [
      "Run `linear-axi document view <ID>`",
    ]);
  }
  const data = await linearRequest<{
    document: {
      title: string;
      content: string | null;
      url: string;
      project: { name: string } | null;
    };
  }>(DOCUMENT_DETAIL_QUERY, { id }, ctx);

  return renderDetail("document", data.document, [
    field("title"),
    pluck("project", "name", "project"),
    field("url"),
    custom("content", (it) =>
      full ? (it.content ?? "") : truncateBody(it.content),
    ),
  ]);
}
