import type { CommandContext } from "./terminal-context";

/** Splits arguments from single-letter options, `-la` being `-l -a`. `withValue` take a value. */
export function parseOptions(
  args: readonly string[],
  withValue = "",
): { options: Map<string, string | true>; operands: string[] } {
  const options = new Map<string, string | true>();
  const operands: string[] = [];
  let done = false;
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] as string;
    if (done || arg === "-" || !arg.startsWith("-")) {
      operands.push(arg);
    } else if (arg === "--") {
      done = true;
    } else {
      for (let letter = 1; letter < arg.length; letter += 1) {
        const name = arg[letter] as string;
        if (withValue.includes(name)) {
          const inline = arg.slice(letter + 1);
          options.set(name, inline || (args[at + 1] ?? ""));
          if (inline === "") at += 1;
          break;
        }
        options.set(name, true);
      }
    }
  }
  return { options, operands };
}

/** The first option in `args`, read as `parseOptions` reads them, that `supported` does not list. */
export function unsupportedOption(
  args: readonly string[],
  supported: string,
  withValue = "",
): string | null {
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] as string;
    if (arg === "--") return null;
    if (arg === "-" || !arg.startsWith("-")) continue;
    if (arg.startsWith("--")) return arg;
    for (let letter = 1; letter < arg.length; letter += 1) {
      const name = arg[letter] as string;
      if (!supported.includes(name)) return `-${name}`;
      if (withValue.includes(name)) {
        if (letter === arg.length - 1) at += 1;
        break;
      }
    }
  }
  return null;
}

/** How many times `args` give the option `letter`, its values, and whether the last lacks its value. */
export function optionUses(
  args: readonly string[],
  letter: string,
  withValue: string,
): { count: number; unfinished: boolean; values: string[] } {
  let count = 0;
  let unfinished = false;
  const values: string[] = [];
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] as string;
    if (arg === "--") break;
    if (arg === "-" || !arg.startsWith("-")) continue;
    for (let index = 1; index < arg.length; index += 1) {
      const name = arg[index] as string;
      if (name === letter) count += 1;
      if (withValue.includes(name)) {
        const inline = arg.slice(index + 1);
        if (index === arg.length - 1) {
          at += 1;
          if (name === letter && at >= args.length) unfinished = true;
        }
        if (name === letter) values.push(inline || (args[at] ?? ""));
        break;
      }
    }
  }
  return { count, unfinished, values };
}

/** Answers an option `context.name` does not know, before it does anything. */
export function refusedOption(
  context: Pick<CommandContext, "name" | "args" | "err">,
  supported: string,
  withValue = "",
): boolean {
  const option = unsupportedOption(context.args, supported, withValue);
  if (!option) return false;
  context.err(`${context.name}: illegal option -- ${option.replace(/^-+/, "")}\n`);
  return true;
}
