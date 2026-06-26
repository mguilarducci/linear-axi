/**
 * Flag and positional argument parsing for linear-axi commands.
 *
 * Two families of accessors:
 * - `get*` / `has*` read without modifying the array.
 * - `take*` splice the flag (and its value) out, so a handler can pull every
 *   flag it knows and treat whatever remains as positionals.
 *
 * Both `--name value` and `--name=value` spellings are supported.
 */

/** Read a flag's value without mutating `args`. */
export function getFlag(args: string[], name: string): string | undefined {
  const equalsPrefix = `${name}=`;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === name) {
      return i + 1 < args.length ? args[i + 1] : undefined;
    }
    if (arg.startsWith(equalsPrefix)) {
      return arg.slice(equalsPrefix.length);
    }
  }
  return undefined;
}

/** Read a flag's value and splice the flag (and value) out of `args`. */
export function takeFlag(args: string[], name: string): string | undefined {
  const equalsPrefix = `${name}=`;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === name) {
      const value = i + 1 < args.length ? args[i + 1] : undefined;
      args.splice(i, value === undefined ? 1 : 2);
      return value;
    }
    if (arg.startsWith(equalsPrefix)) {
      args.splice(i, 1);
      return arg.slice(equalsPrefix.length);
    }
  }
  return undefined;
}

/** Whether a boolean flag is present (no mutation). */
export function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

/** Whether a boolean flag is present, splicing it out if so. */
export function takeBoolFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

/** Collect every occurrence of a repeatable flag, in both spellings. */
export function getAllFlags(args: string[], name: string): string[] {
  const equalsPrefix = `${name}=`;
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === name && i + 1 < args.length) {
      result.push(args[i + 1]);
      i++;
    } else if (arg.startsWith(equalsPrefix)) {
      result.push(arg.slice(equalsPrefix.length));
    }
  }
  return result;
}

/**
 * The n-th (0-based) positional argument — any token not starting with `-`.
 * Intended for use after flags have been removed with the `take*` helpers.
 */
export function getPositional(
  args: string[],
  index: number,
): string | undefined {
  const positionals = args.filter((a) => !a.startsWith("-"));
  return positionals[index];
}
