/**
 * Render the `count:` line that precedes a list, giving the agent a definitive
 * answer to "how many are there?" so it does not re-run the command to check.
 *
 * Precedence:
 * - exact `totalCount` when the API gave us one → "count: N of TOTAL total"
 * - otherwise, if another page exists → "count: N+ (more available)"
 * - otherwise → "count: N"
 *
 * Linear connections paginate by cursor and do not always expose a cheap
 * `totalCount`, hence the soft-total ("N+") fallback.
 */
export interface CountLineOptions {
  count: number;
  totalCount?: number;
  hasMore?: boolean;
}

export function formatCountLine(opts: CountLineOptions): string {
  const { count, totalCount, hasMore } = opts;
  if (totalCount !== undefined) {
    return `count: ${count} of ${totalCount} total`;
  }
  if (hasMore) {
    return `count: ${count}+ (more available)`;
  }
  return `count: ${count}`;
}
