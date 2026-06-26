import { encode } from "@toon-format/toon";
import type { LinearContext } from "../context.js";
import { renderHelp, renderOutput } from "../toon.js";

export const HOME_HELP = "";

/**
 * No-arg dashboard. Following AXI principle #8 ("content first"), running the
 * bare CLI shows actionable state rather than a usage manual.
 *
 * This is still a scaffold: there are no Linear queries yet, so the dashboard
 * reports setup state (is the API key present?) and points at the next steps.
 * When Linear commands land, this is where their live summaries go.
 */
export async function homeCommand(
  _args: string[],
  ctx?: LinearContext,
): Promise<string> {
  const blocks: string[] = [];

  blocks.push(
    encode({
      status: "scaffold",
      note: "Linear commands are not implemented yet",
      auth: ctx?.apiKeyPresent
        ? "LINEAR_API_KEY detected"
        : "LINEAR_API_KEY not set",
    }),
  );

  const hints: string[] = [];
  if (!ctx?.apiKeyPresent) {
    hints.push("Set LINEAR_API_KEY to connect linear-axi to your workspace");
  }
  hints.push("Run `linear-axi setup hooks` to install agent session hooks");
  hints.push("Run `linear-axi --help` to see available commands");

  blocks.push(renderHelp(hints));

  return renderOutput(blocks);
}
