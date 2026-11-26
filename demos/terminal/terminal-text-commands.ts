import type { CommandContext, CommandRun } from "./terminal-context";
import {
  baseName,
  FileProblem,
  NO_SUCH_FILE,
  resolvePath,
  type TerminalFiles,
} from "./terminal-files";
import { Interrupted } from "./terminal-io";
import { optionUses, parseOptions, refusedOption } from "./terminal-options";

/**
 * The shell's tools on text: `grep`, `head`, `tail`, `wc`, `sort` and `uniq`. Each reads the files it
 * is named or what a pipe gives it, and takes the options it lists when it refuses another one.
 */

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const stopIfAsked = (context: CommandContext) => {
  if (context.signal.aborted) throw new Interrupted();
};

/** How much text goes on the screen at a time, so that Control-C can come in between. */
const PIECE = 64 * 1024;
/** The largest file read: the whole of it is held in the page. */
const MOST_FILE_BYTES = 16 * 1024 * 1024;

/** Writes `text` a piece at a time. */
export async function writeInPieces(context: CommandContext, text: string): Promise<void> {
  for (let at = 0; at < text.length; at += PIECE) {
    stopIfAsked(context);
    context.out(text.slice(at, at + PIECE));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function readFile(context: CommandContext, operand: string): Promise<string> {
  if (operand === "") throw new FileProblem(NO_SUCH_FILE);
  const text = await readTextBounded(
    context.session.files,
    resolvePath(operand, context.scope.cwd),
  );
  stopIfAsked(context);
  return text;
}

/** The text of the file at `path`, refused when it is too large to hold in the page. */
export async function readTextBounded(files: TerminalFiles, path: string): Promise<string> {
  const size = (await files.at(path))?.size ?? 0;
  if (size > MOST_FILE_BYTES) throw new Error("File too large to show here");
  return files.readText(path);
}

/** What the person types until Control-D. */
export async function typedText(context: CommandContext): Promise<string> {
  let text = "";
  for (let line = await context.readLine(); line !== null; line = await context.readLine()) {
    text += `${line}\n`;
  }
  return text;
}

export interface Input {
  name: string;
  text: string;
}

/**
 * The text of each file named, in turn, with `-` or no names at all meaning what the pipe gives. A
 * file not read is said on the error stream, and `problems.failed` records it.
 */
export async function* inputs(
  context: CommandContext,
  operands: readonly string[],
  problems: { failed: boolean },
): AsyncGenerator<Input> {
  let piped = context.stdin;
  for (const operand of operands.length > 0 ? operands : ["-"]) {
    stopIfAsked(context);
    if (operand === "-") {
      if (context.stdin === null) {
        if (context.background) {
          context.err(`${context.name}: the keyboard does not reach a command behind the prompt\n`);
          problems.failed = true;
          continue;
        }
        yield { name: "(standard input)", text: await typedText(context) };
        continue;
      }
      yield { name: "(standard input)", text: piped ?? "" };
      piped = "";
      continue;
    }
    let text: string;
    try {
      text = await readFile(context, operand);
    } catch (error) {
      if (error instanceof Interrupted) throw error;
      context.err(`${context.name}: ${operand}: ${message(error)}\n`);
      problems.failed = true;
      continue;
    }
    yield { name: operand, text };
  }
}

/** The lines of a text; a last line without an ending counts. */
function linesOf(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/** The lines of a text with their endings: a last line without one stays without one. */
const linesKeepingEnds = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

const CLASSES: Readonly<Record<string, string>> = {
  alpha: "a-zA-Z",
  digit: "0-9",
  alnum: "a-zA-Z0-9",
  upper: "A-Z",
  lower: "a-z",
  space: " \\t\\n\\r\\f\\v",
  blank: " \\t",
  punct: "!-\\/:-@\\[-`{-~",
  xdigit: "0-9a-fA-F",
};

/** A POSIX regular expression as JavaScript's. `extended` is `grep -E`. */
export function toRegExpSource(pattern: string, extended: boolean): string {
  let out = "";
  for (let at = 0; at < pattern.length; at += 1) {
    const ch = pattern[at] as string;
    if (ch === "[") {
      let close = at + 1;
      if (pattern[close] === "^") close += 1;
      if (pattern[close] === "]") close += 1;
      while (close < pattern.length) {
        if (pattern.startsWith("[:", close)) {
          const end = pattern.indexOf(":]", close);
          if (end < 0) break;
          close = end + 2;
        } else if (pattern[close] === "]") break;
        else close += 1;
      }
      if (close >= pattern.length || pattern[close] !== "]") {
        throw new Error("unterminated bracket expression");
      }
      const negated = pattern[at + 1] === "^";
      const body = pattern
        .slice(at + (negated ? 2 : 1), close)
        .split(/(\[:\w+:\])/)
        .map((part, index) =>
          index % 2 === 1 ? (CLASSES[part.slice(2, -2)] ?? "") : part.replace(/[\\[\]]/g, "\\$&"),
        )
        .join("");
      out += `[${negated ? "^" : ""}${body}]`;
      at = close;
    } else if (ch === "]") {
      out += "\\]";
    } else if (ch === "\\" && at + 1 < pattern.length) {
      const next = pattern[at + 1] as string;
      at += 1;
      if (!extended && /[(){}|+?]/.test(next)) out += next;
      // A letter with no meaning in POSIX or GNU patterns is that letter, not a JavaScript escape.
      else if (/[a-zA-Z]/.test(next) && !/[bBwWsS]/.test(next)) out += next;
      else out += `\\${next}`;
    } else if (!extended && (/[(){}|+?]/.test(ch) || (ch === "*" && out === ""))) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** More open-ended repeats than this in one pattern and `mayNeverEnd` refuses it. */
const MOST_OPEN_REPEATS = 4;

/**
 * Whether a JavaScript pattern repeats a group that itself repeats or has alternatives, as
 * `(a+)+` does, or has many open-ended repeats in a row, as `a*a*a*a*a*b` does: matching such a
 * pattern can take exponential or very long polynomial time on one line, and the page cannot be
 * interrupted while it does.
 */
export function mayNeverEnd(source: string): boolean {
  const open: boolean[] = [];
  let inClass = false;
  let varies = false;
  let openRepeats = 0;
  for (let at = 0; at < source.length; at += 1) {
    const ch = source[at] as string;
    if (ch === "\\") at += 1;
    else if (inClass) inClass = ch !== "]";
    else if (ch === "[") inClass = true;
    else if (ch === "(") {
      open.push(varies);
      varies = false;
    } else if ("+*?{|".includes(ch)) {
      varies = true;
      if (ch === "*" || ch === "+" || /^\{\d*,\}/.test(source.slice(at))) {
        openRepeats += 1;
        if (openRepeats > MOST_OPEN_REPEATS) return true;
      }
    } else if (ch === ")") {
      if (varies && "+*?{".includes(source[at + 1] ?? " ")) return true;
      varies = (open.pop() ?? false) || varies;
    }
  }
  return false;
}

/** The files in and under `operand`, named from it as `grep -r` names them; anything else is itself. */
async function filesUnder(context: CommandContext, operand: string): Promise<string[]> {
  stopIfAsked(context);
  const { files } = context.session;
  const path = resolvePath(operand, context.scope.cwd);
  if (operand === "" || !(await files.at(path))?.children) return [operand];
  const named: string[] = [];
  for (const entry of await files.list(path)) {
    const name = `${operand.replace(/\/+$/, "")}/${baseName(entry.path)}`;
    named.push(...(await filesUnder(context, name)));
  }
  return named;
}

/** What `grep -r` reads. With no file named it warns and reads what the pipe gives, as a Mac's does. */
async function* inputsUnder(
  context: CommandContext,
  operands: readonly string[],
  problems: { failed: boolean },
): AsyncGenerator<Input> {
  if (operands.length === 0) context.err("grep: warning: recursive search of stdin\n");
  if (operands.length === 0) yield* inputs(context, operands, problems);
  for (const operand of operands) {
    const named = operand === "-" ? [operand] : await filesUnder(context, operand);
    if (named.length > 0) yield* inputs(context, named, problems);
  }
}

const grep: CommandRun = async (context) => {
  if (refusedOption(context, "cEFHhilnoqRrvwxe", "e")) return 2;
  const { options, operands } = parseOptions(context.args, "e");
  const uses = optionUses(context.args, "e", "e");
  const first = uses.count > 0 ? undefined : operands.shift();
  const patterns = first === undefined ? uses.values : [first];
  if (patterns.length === 0 || uses.unfinished) {
    context.err("usage: grep [-cEFHhilnoqRrvwx] [-e pattern] ... [pattern] [file ...]\n");
    return 2;
  }
  const recursive = options.has("r") || options.has("R");
  let regex: RegExp;
  try {
    const sources = patterns.map((pattern) =>
      options.has("F") ? escapeForRegExp(pattern) : toRegExpSource(pattern, options.has("E")),
    );
    if (sources.some(mayNeverEnd)) {
      context.err("grep: this pattern could hang the page\n");
      return 2;
    }
    let source = sources.length === 1 ? (sources[0] as string) : `(?:${sources.join(")|(?:")})`;
    if (options.has("w")) source = `(?<!\\w)(?:${source})(?!\\w)`;
    if (options.has("x")) source = `^(?:${source})$`;
    regex = new RegExp(source, options.has("i") ? "iu" : "u");
  } catch {
    context.err("grep: invalid regular expression\n");
    return 2;
  }
  const invert = options.has("v");
  const quiet = options.has("q");
  const showNames =
    !options.has("h") &&
    (options.has("H") || operands.length > 1 || (recursive && operands.length > 0));
  const problems = { failed: false };
  let found = false;
  const reading = recursive
    ? inputsUnder(context, operands, problems)
    : inputs(context, operands, problems);
  for await (const file of reading) {
    let count = 0;
    const shown: string[] = [];
    const binary = file.text.includes("\0");
    for (const [at, line] of linesOf(file.text).entries()) {
      if (regex.test(line) === invert) continue;
      count += 1;
      if (binary) continue;
      const prefix = `${showNames ? `${file.name}:` : ""}${options.has("n") ? `${at + 1}:` : ""}`;
      if (!options.has("o")) shown.push(`${prefix}${line}`);
      else if (!invert) {
        const all = new RegExp(regex.source, `${regex.flags}g`);
        for (const [match] of line.matchAll(all)) {
          if (match !== "") shown.push(`${prefix}${match}`);
        }
      }
    }
    if (count > 0) found = true;
    if (quiet) continue;
    if (options.has("l")) {
      if (count > 0) context.out(`${file.name}\n`);
    } else if (options.has("c")) {
      context.out(`${showNames ? `${file.name}:` : ""}${count}\n`);
    } else if (binary) {
      if (count > 0) context.out(`Binary file ${file.name} matches\n`);
    } else if (shown.length > 0) {
      await writeInPieces(context, `${shown.join("\n")}\n`);
    }
  }
  if (quiet && found) return 0;
  return problems.failed ? 2 : found ? 0 : 1;
};

/** `-5` for `-n 5`, as `head` and `tail` have always taken it, where an option can stand. */
function lineCountArgs(args: readonly string[]): string[] {
  const out: string[] = [];
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] as string;
    if (arg === "--") return [...out, ...args.slice(at)];
    if (arg === "-n" && at + 1 < args.length) {
      out.push(arg, args[at + 1] as string);
      at += 1;
    } else out.push(/^-\d+$/.test(arg) ? `-n${arg.slice(1)}` : arg);
  }
  return out;
}

/** `-c` for `head` and `tail`: the bytes of a text, cut where the bytes say, as those tools do. */
const bytesOf = (text: string) => new TextEncoder().encode(text);
const textOf = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const head: CommandRun = async (context) => {
  const args = lineCountArgs(context.args);
  if (refusedOption({ ...context, args }, "cn", "cn")) return 1;
  const { options, operands } = parseOptions(args, "cn");
  const given = options.get("n");
  const bytes = options.get("c");
  if (typeof given === "string" && !/^\d+$/.test(given)) {
    context.err(`head: illegal line count -- ${given}\n`);
    return 1;
  }
  if (typeof bytes === "string" && !/^\d+$/.test(bytes)) {
    context.err(`head: illegal byte count -- ${bytes}\n`);
    return 1;
  }
  const count = Number(given ?? 10);
  const problems = { failed: false };
  let first = true;
  for await (const file of inputs(context, operands, problems)) {
    if (operands.length > 1) context.out(`${first ? "" : "\n"}==> ${file.name} <==\n`);
    first = false;
    await writeInPieces(
      context,
      typeof bytes === "string"
        ? textOf(bytesOf(file.text).slice(0, Number(bytes)))
        : linesKeepingEnds(file.text).slice(0, count).join(""),
    );
  }
  return problems.failed ? 1 : 0;
};

/** How often `tail -f` looks at its files. */
const FOLLOW_MS = 1000;

/** Writes what is added to files from now on, until Control-C: there is no end to wait for. */
async function follow(context: CommandContext, seen: Map<string, number>): Promise<never> {
  const { files } = context.session;
  for (;;) {
    await new Promise<void>((resolve, reject) => {
      const stop = () => {
        clearTimeout(timer);
        reject(new Interrupted());
      };
      const timer = setTimeout(() => {
        context.signal.removeEventListener("abort", stop);
        resolve();
      }, FOLLOW_MS);
      context.signal.addEventListener("abort", stop, { once: true });
    });
    files.refresh();
    for (const [operand, length] of seen) {
      const text = await readFile(context, operand).catch(() => null);
      if (text === null) continue;
      // A file that got shorter was cut: all of it is new, as `tail -f` says of a truncated file.
      const fresh = text.length < length ? text : text.slice(length);
      if (fresh !== "") context.out(fresh);
      seen.set(operand, text.length);
    }
  }
}

const tail: CommandRun = async (context) => {
  // `+3` in first place is `-n +3`, an old form; anywhere else it is a file's name.
  const [opening, ...rest] = context.args;
  const args = lineCountArgs(
    opening !== undefined && /^\+\d+$/.test(opening) ? ["-n", opening, ...rest] : context.args,
  );
  if (refusedOption({ ...context, args }, "cfn", "cn")) return 1;
  const { options, operands } = parseOptions(args, "cn");
  const given = options.get("n");
  const bytes = options.get("c");
  if (typeof given === "string" && !/^[-+]?\d+$/.test(given)) {
    context.err(`tail: illegal offset -- ${given}\n`);
    return 1;
  }
  if (typeof bytes === "string" && !/^[-+]?\d+$/.test(bytes)) {
    context.err(`tail: illegal offset -- ${bytes}\n`);
    return 1;
  }
  const fromStart = typeof given === "string" && given.startsWith("+");
  const count = Math.abs(Number(given ?? 10));
  const problems = { failed: false };
  const seen = new Map<string, number>();
  let first = true;
  for await (const file of inputs(context, operands, problems)) {
    if (operands.length > 1) context.out(`${first ? "" : "\n"}==> ${file.name} <==\n`);
    first = false;
    if (operands.includes(file.name)) seen.set(file.name, file.text.length);
    if (typeof bytes === "string") {
      const all = bytesOf(file.text);
      const size = Math.abs(Number(bytes));
      await writeInPieces(
        context,
        textOf(
          bytes.startsWith("+")
            ? all.slice(Math.max(0, size - 1))
            : size === 0
              ? all.slice(all.length)
              : all.slice(-size),
        ),
      );
      continue;
    }
    const lines = linesKeepingEnds(file.text);
    const shown = fromStart
      ? lines.slice(Math.max(0, count - 1))
      : count === 0
        ? []
        : lines.slice(-count);
    await writeInPieces(context, shown.join(""));
  }
  if (options.has("f") && seen.size > 0) await follow(context, seen);
  return problems.failed ? 1 : 0;
};

const wc: CommandRun = async (context) => {
  if (refusedOption(context, "clmw")) return 1;
  const { options, operands } = parseOptions(context.args);
  const all = !options.has("l") && !options.has("w") && !options.has("c") && !options.has("m");
  const row = (counts: readonly number[], name: string) => {
    const [lines, words, bytes, chars] = counts as [number, number, number, number];
    const cells = [
      all || options.has("l") ? lines : null,
      all || options.has("w") ? words : null,
      options.has("m") ? chars : all || options.has("c") ? bytes : null,
    ].flatMap((cell) => (cell === null ? [] : [String(cell).padStart(8)]));
    return `${cells.join("")}${name ? ` ${name}` : ""}\n`;
  };
  const totals = [0, 0, 0, 0];
  const problems = { failed: false };
  for await (const file of inputs(context, operands, problems)) {
    const counts = [
      (file.text.match(/\n/g) ?? []).length,
      file.text.split(/\s+/).filter((word) => word !== "").length,
      new TextEncoder().encode(file.text).length,
      [...file.text].length,
    ];
    for (const [at, count] of counts.entries()) totals[at] = (totals[at] as number) + count;
    context.out(row(counts, operands.length > 0 ? file.name : ""));
  }
  if (operands.length > 1) context.out(row(totals, "total"));
  return problems.failed ? 1 : 0;
};

/** The number a line starts with, as `sort -n` reads it: no exponent, and 0 when there is none. */
const leadingNumber = (text: string) => Number(/^\s*-?\d*(?:\.\d*)?/.exec(text)?.[0]) || 0;

const sort: CommandRun = async (context) => {
  if (refusedOption(context, "fknortu", "kot")) return 2;
  const { options, operands } = parseOptions(context.args, "kot");
  const keySpec = options.get("k");
  const keyRange =
    typeof keySpec === "string" ? /^([1-9]\d*)(?:,([1-9]\d*))?$/.exec(keySpec) : null;
  const firstField = Number(keyRange?.[1] ?? 0);
  const lastField = keyRange?.[2] === undefined ? undefined : Number(keyRange[2]);
  const keysGiven = optionUses(context.args, "k", "kot").count;
  if (optionUses(context.args, "t", "kot").unfinished) {
    context.err("sort: option requires an argument -- t\n");
    return 2;
  }
  if (
    keysGiven > 1 ||
    (keySpec !== undefined && !keyRange) ||
    (lastField !== undefined && lastField < firstField)
  ) {
    context.err("sort: this sort takes one key, -k M or -k M,N in whole fields\n");
    return 2;
  }
  const problems = { failed: false };
  const lines: string[] = [];
  for await (const file of inputs(context, operands, problems)) {
    for (const line of linesOf(file.text)) lines.push(line);
  }
  // A file that cannot be read ends sort before it writes anything, as on a Mac.
  if (problems.failed) return 2;
  const separator = options.get("t");
  const keyOf = (line: string) => {
    if (!firstField) return line;
    const parts =
      typeof separator === "string" ? line.split(separator) : (line.match(/\s*\S+/g) ?? []);
    return parts
      .slice(firstField - 1, lastField)
      .join(typeof separator === "string" ? separator : "");
  };
  const fold = options.has("f");
  const plain = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const byKey = (a: string, b: string) => {
    const left = keyOf(a);
    const right = keyOf(b);
    if (options.has("n")) return leadingNumber(left) - leadingNumber(right);
    return fold ? plain(left.toLowerCase(), right.toLowerCase()) : plain(left, right);
  };
  const order = options.has("r") ? -1 : 1;
  lines.sort((a, b) => order * (byKey(a, b) || plain(a, b)));
  const shown = options.has("u")
    ? lines.filter((line, at) => at === 0 || byKey(lines[at - 1] as string, line) !== 0)
    : lines;
  const sorted = shown.length > 0 ? `${shown.join("\n")}\n` : "";
  const outFile = options.get("o");
  if (typeof outFile === "string") {
    return (await writeToFile(context, outFile, sorted)) ? 0 : 2;
  }
  await writeInPieces(context, sorted);
  return 0;
};

/** Writes `text` over the file an option or operand names; `false` when it said why it could not. */
async function writeToFile(
  context: CommandContext,
  operand: string,
  text: string,
): Promise<boolean> {
  try {
    stopIfAsked(context);
    await context.session.files.writeText(
      resolvePath(operand, context.scope.cwd),
      text,
      false,
      context.signal,
    );
    return true;
  } catch (error) {
    if (error instanceof Interrupted) throw error;
    context.err(`${context.name}: ${operand}: ${message(error)}\n`);
    return false;
  }
}

const uniq: CommandRun = async (context) => {
  if (refusedOption(context, "cdiu")) return 1;
  const { options, operands } = parseOptions(context.args);
  const [input, output] = operands;
  const same = (a: string, b: string) =>
    options.has("i") ? a.toLowerCase() === b.toLowerCase() : a === b;
  const groups: { line: string; count: number }[] = [];
  const problems = { failed: false };
  for await (const file of inputs(context, input === undefined ? [] : [input], problems)) {
    for (const line of linesOf(file.text)) {
      const last = groups.at(-1);
      if (last && same(last.line, line)) last.count += 1;
      else groups.push({ line, count: 1 });
    }
  }
  const kept = groups.filter(
    ({ count }) => (!options.has("d") || count > 1) && (!options.has("u") || count === 1),
  );
  const counted = options.has("c");
  const text = kept
    .map(({ line, count }) => `${counted ? `${String(count).padStart(4)} ` : ""}${line}\n`)
    .join("");
  if (output !== undefined) {
    if (problems.failed) return 1;
    return (await writeToFile(context, output, text)) ? 0 : 1;
  }
  await writeInPieces(context, text);
  return problems.failed ? 1 : 0;
};

export const TEXT_TOOLS: Readonly<Record<string, CommandRun>> = {
  grep,
  head,
  sort,
  tail,
  uniq,
  wc,
};
