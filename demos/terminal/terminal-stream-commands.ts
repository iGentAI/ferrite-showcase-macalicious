import { commandNames } from "./terminal-commands";
import type { CommandContext, CommandRun } from "./terminal-context";
import { resolvePath } from "./terminal-files";
import { onlyRefuses } from "./terminal-mac-commands";
import { parseOptions, refusedOption } from "./terminal-options";
import {
  inputs,
  mayNeverEnd,
  readTextBounded,
  toRegExpSource,
  typedText,
  writeInPieces,
} from "./terminal-text-commands";

/**
 * `sed`, `tr` and `cut` on what files and pipes hold, and `which` and `env`, which say what this
 * shell has. `sed -i` writes back the files it is named, after their backup when one is asked for.
 */

interface SedAddress {
  line?: number;
  last?: boolean;
  /** Absent with neither of the others: `//`, the pattern used last. */
  regex?: RegExp;
}

interface SedCommand {
  from?: SedAddress;
  to?: SedAddress;
  negate: boolean;
  run: "s" | "d" | "p" | "q" | "=" | "y" | "a" | "i" | "c";
  /** What `a`, `i` and `c` write. */
  text?: string;
  /** Absent on `s`: `s//x/`, the pattern used last. */
  regex?: RegExp;
  /** `s/a/b/g`: every match. Not a flag of `regex`, which an address may use again. */
  global?: boolean;
  replacement?: string;
  /** `s/a/b/2`: leaves the matches before this one. */
  occurrence?: number;
  printSubstituted?: boolean;
  map?: Map<string, string>;
}

function pattern(source: string, extended: boolean, flags: string): RegExp | undefined {
  if (source === "") return undefined;
  const translated = toRegExpSource(source, extended);
  if (mayNeverEnd(translated)) throw new Error("this pattern could take too long to run here");
  return new RegExp(translated, flags);
}

/** A string of `y`, its `\\` and `\n` read as the one character each is. */
const yString = (text: string) =>
  text.replace(/\\([\\n])/g, (_, code: string) => (code === "n" ? "\n" : "\\"));

function parseSed(script: string, extended: boolean): SedCommand[] {
  const commands: SedCommand[] = [];
  let at = 0;
  const delimited = (delimiter: string, regex = false, replacement = false): string => {
    let out = "";
    while (at < script.length && script[at] !== delimiter) {
      if (script[at] === "\\" && script[at + 1] === delimiter) {
        // In a pattern an escaped delimiter that is a metacharacter is that character, literally;
        // in a replacement so is an `&`, which alone means what matched.
        out +=
          (regex && /[.*+?$(){}|^[\]]/.test(delimiter)) || (replacement && delimiter === "&")
            ? `\\${delimiter}`
            : delimiter;
        at += 2;
      } else if (script[at] === "\\") {
        out += script.slice(at, at + 2);
        at += 2;
      } else {
        out += script[at];
        at += 1;
      }
    }
    if (at >= script.length) throw new Error("unterminated expression");
    at += 1;
    return out;
  };
  const address = (): SedAddress | undefined => {
    const ch = script[at];
    if (ch === "$") {
      at += 1;
      return { last: true };
    }
    if (ch !== undefined && /\d/.test(ch)) {
      const digits = /^\d+/.exec(script.slice(at))?.[0] ?? "";
      at += digits.length;
      return { line: Number(digits) };
    }
    if (ch === "/") {
      at += 1;
      return { regex: pattern(delimited("/", true), extended, "u") };
    }
    return undefined;
  };
  for (;;) {
    while (at < script.length && /[\s;]/.test(script[at] as string)) at += 1;
    if (at >= script.length) return commands;
    const from = address();
    let to: SedAddress | undefined;
    if (from && script[at] === ",") {
      at += 1;
      to = address();
    }
    while (script[at] === " ") at += 1;
    const negate = script[at] === "!";
    if (negate) at += 1;
    while (script[at] === " ") at += 1;
    const name = script[at];
    at += 1;
    const base = { from, to, negate };
    if (name === "s") {
      const delimiter = script[at] as string;
      at += 1;
      const source = delimited(delimiter, true);
      const replacement = delimited(delimiter, false, true);
      let flags = "u";
      let global = false;
      let printSubstituted = false;
      let occurrence: number | undefined;
      while (at < script.length && /[gipI0-9]/.test(script[at] as string)) {
        const flag = script[at] as string;
        if (flag === "g") global = true;
        else if (flag === "i" || flag === "I") flags += "i";
        else if (flag === "p") printSubstituted = true;
        else occurrence = (occurrence ?? 0) * 10 + Number(flag);
        at += 1;
      }
      if (occurrence === 0) throw new Error("the number after s/// may not be zero");
      commands.push({
        ...base,
        run: "s",
        regex: pattern(source, extended, flags),
        global,
        replacement,
        occurrence,
        printSubstituted,
      });
    } else if (name === "y") {
      const delimiter = script[at] as string;
      at += 1;
      const source = [...yString(delimited(delimiter))];
      const target = [...yString(delimited(delimiter))];
      if (source.length !== target.length) {
        throw new Error("transform strings are not the same length");
      }
      commands.push({
        ...base,
        run: "y",
        map: new Map(source.map((ch, index) => [ch, target[index] ?? ch])),
      });
    } else if (name === "d" || name === "p" || name === "q" || name === "=") {
      commands.push({ ...base, run: name });
    } else if (name === "a" || name === "i" || name === "c") {
      // `a\` and the text on the next line, or `a text` on the same one. A backslash keeps the
      // character after it, so `\` at a line's end goes on to the next line.
      if (script[at] === "\\") at += 1;
      while (script[at] === " " || script[at] === "\t") at += 1;
      if (script[at] === "\n") at += 1;
      let text = "";
      while (at < script.length && script[at] !== "\n") {
        if (script[at] === "\\" && at + 1 < script.length) at += 1;
        text += script[at];
        at += 1;
      }
      commands.push({ ...base, run: name, text });
    } else {
      throw new Error(`invalid command code ${name ?? ""}`);
    }
  }
}

const replacementFor = (template: string, match: RegExpExecArray | RegExpMatchArray) =>
  template.replace(/\\(\\|\d|n|t|&)|&/g, (whole, code: string | undefined) => {
    if (whole === "&") return match[0];
    if (code === "\\") return "\\";
    if (code === "n") return "\n";
    if (code === "t") return "\t";
    if (code === "&") return "&";
    return match[Number(code)] ?? "";
  });

function runSed(
  commands: readonly SedCommand[],
  text: string,
  quiet: boolean,
  moreToCome = false,
): { out: string; quit: boolean } {
  const lines = text === "" ? [] : text.replace(/\n$/, "").split("\n");
  const inRange = new Map<SedCommand, boolean>();
  // The pattern an empty one means: the last one used while running, as in `/a/s//b/`.
  let lastUsed: RegExp | undefined;
  const used = (regex: RegExp | undefined): RegExp => {
    const chosen = regex ?? lastUsed;
    if (!chosen) throw new Error("no previous regular expression");
    lastUsed = chosen;
    return chosen;
  };
  const applies = (command: SedCommand, line: string, at: number): boolean => {
    const hit = (spec: SedAddress) =>
      spec.last
        ? !moreToCome && at === lines.length
        : spec.line !== undefined
          ? spec.line === at
          : used(spec.regex).test(line);
    if (!command.from) return true;
    if (!command.to) return hit(command.from);
    if (inRange.get(command)) {
      if (hit(command.to) || (command.to.line !== undefined && at >= command.to.line)) {
        inRange.set(command, false);
      }
      return true;
    }
    if (hit(command.from)) {
      inRange.set(command, !(command.to.line !== undefined && command.to.line <= at));
      return true;
    }
    return false;
  };
  let out = "";
  for (const [index, original] of lines.entries()) {
    let line = original;
    let deleted = false;
    let stop = false;
    let appended = "";
    for (const command of commands) {
      if (applies(command, line, index + 1) === command.negate) continue;
      if (command.run === "s") {
        const regex = used(command.regex);
        const all = new RegExp(regex.source, `${regex.flags}g`);
        // Matched on the whole line, so `^` means its start and not that of what is left of it.
        let seen = 0;
        let lastEnd = -1;
        let kept = 0;
        let result = "";
        let changed = false;
        for (const match of line.matchAll(all)) {
          // An empty match right after a match is not one: `s/b*/x/g` on abc is xaxcx.
          if (match[0] === "" && match.index === lastEnd) continue;
          lastEnd = match.index + match[0].length;
          seen += 1;
          if (seen < (command.occurrence ?? 1)) continue;
          result +=
            line.slice(kept, match.index) + replacementFor(command.replacement ?? "", match);
          kept = lastEnd;
          changed = true;
          if (!command.global) break;
        }
        if (changed) line = result + line.slice(kept);
        if (changed && command.printSubstituted) out += `${line}\n`;
      } else if (command.run === "y" && command.map) {
        line = [...line].map((ch) => command.map?.get(ch) ?? ch).join("");
      } else if (command.run === "a") {
        appended += `${command.text}\n`;
      } else if (command.run === "i") {
        out += `${command.text}\n`;
      } else if (command.run === "c") {
        // Over a range the text comes once, at its end.
        if (!command.to || command.negate || !inRange.get(command)) out += `${command.text}\n`;
        deleted = true;
        break;
      } else if (command.run === "d") {
        deleted = true;
        break;
      } else if (command.run === "p") {
        out += `${line}\n`;
      } else if (command.run === "=") {
        out += `${index + 1}\n`;
      } else if (command.run === "q") {
        stop = true;
        break;
      }
    }
    if (!deleted && !quiet) out += `${line}\n`;
    out += appended;
    if (stop) return { out, quit: true };
  }
  return { out, quit: false };
}

const sedFailed = new WeakSet<CommandContext>();

/** What `sed` wrote, or nothing when its script cannot run: said on the error stream. */
function runSedSafely(
  context: CommandContext,
  commands: readonly SedCommand[],
  text: string,
  quiet: boolean,
  moreToCome: boolean,
): string {
  try {
    return runSed(commands, text, quiet, moreToCome).out;
  } catch (error) {
    context.err(`sed: ${(error as Error).message}\n`);
    sedFailed.add(context);
    return "";
  }
}

const sed: CommandRun = async (context) => {
  if (refusedOption(context, "Eine", "ei")) return 1;
  const scripts: string[] = [];
  const args: string[] = [];
  /** The ending of the backup `-i` asks for, as on a Mac it always takes one, which may be empty. */
  let inPlace: string | null = null;
  for (let at = 0; at < context.args.length; at += 1) {
    const arg = context.args[at] as string;
    const backup = /^-([En]*)i(.*)$/s.exec(arg);
    if (backup) {
      if (backup[1]) args.push(`-${backup[1]}`);
      if (backup[2]) inPlace = backup[2];
      else {
        at += 1;
        inPlace = context.args[at] ?? "";
      }
      continue;
    }
    const given = /^-([En]*)e(.*)$/s.exec(arg);
    if (given) {
      if (given[1]) args.push(`-${given[1]}`);
      if (given[2]) scripts.push(given[2]);
      else {
        at += 1;
        scripts.push(context.args[at] ?? "");
      }
    } else args.push(arg);
  }
  const { options, operands } = parseOptions(args);
  const script = scripts.length > 0 ? scripts.join("\n") : operands.shift();
  if (script === undefined) {
    context.err("usage: sed script [-En] [-e script] [file ...]\n");
    return 1;
  }
  let commands: SedCommand[];
  try {
    commands = parseSed(script, options.has("E"));
  } catch (error) {
    context.err(`sed: ${(error as Error).message}\n`);
    return 1;
  }
  if (inPlace !== null) {
    if (operands.length === 0) {
      context.err("sed: -i may not be used with stdin\n");
      return 1;
    }
    const { files } = context.session;
    let status = 0;
    for (const operand of operands) {
      const path = resolvePath(operand, context.scope.cwd);
      try {
        const before = await readTextBounded(files, path);
        const after = runSed(commands, before, options.has("n")).out;
        if (inPlace) await files.writeText(`${path}${inPlace}`, before, false, context.signal);
        await files.writeText(path, after, false, context.signal);
      } catch (error) {
        context.err(`sed: ${operand}: ${(error as Error).message}\n`);
        status = 1;
      }
    }
    return status;
  }
  const problems = { failed: false };
  // `q` ends the reading: the files after the line it stops at are not opened.
  const mayQuit = commands.some((command) => command.run === "q");
  const quitsIn = (read: string) => {
    try {
      return runSed(commands, read, true, true).quit;
    } catch {
      return false;
    }
  };
  let text = "";
  let stoppedEarly = false;
  for await (const { name, text: file } of inputs(context, operands, problems)) {
    text += file && !file.endsWith("\n") ? `${file}\n` : file;
    if (mayQuit && quitsIn(text)) {
      // Input not read is still input: the last line read is not `$`.
      stoppedEarly = operands.length > 1 && name !== operands.at(-1);
      break;
    }
  }
  await writeInPieces(
    context,
    runSedSafely(context, commands, text, options.has("n"), stoppedEarly),
  );
  return problems.failed || sedFailed.has(context) ? 1 : 0;
};

const NAMED_SETS: Readonly<Record<string, string>> = {
  upper: "A-Z",
  lower: "a-z",
  digit: "0-9",
  alpha: "a-zA-Z",
  alnum: "a-zA-Z0-9",
  space: " \t\n\r\f\v",
  blank: " \t",
  punct: "!-/:-@[-`{-~",
};

const ESCAPES: Readonly<Record<string, string>> = {
  a: "\x07",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

function setOf(spec: string): string[] {
  // A character, and whether it was written so that it cannot be a range's hyphen.
  const tokens: { ch: string; plain: boolean }[] = [];
  const written = [...spec];
  for (let at = 0; at < written.length; at += 1) {
    const ch = written[at] as string;
    if (ch === "[" && written[at + 1] === ":") {
      const rest = written.slice(at).join("");
      const named = /^\[:(\w+):\]/.exec(rest);
      if (named) {
        for (const each of setOf(NAMED_SETS[named[1] as string] ?? "")) {
          tokens.push({ ch: each, plain: false });
        }
        at += named[0].length - 1;
        continue;
      }
    }
    if (ch !== "\\" || at + 1 >= written.length) {
      tokens.push({ ch, plain: true });
      continue;
    }
    const octal = /^[0-7]{1,3}/.exec(written.slice(at + 1, at + 4).join(""));
    if (octal) {
      tokens.push({ ch: String.fromCharCode(Number.parseInt(octal[0], 8)), plain: false });
      at += octal[0].length;
      continue;
    }
    at += 1;
    const code = written[at] as string;
    tokens.push({ ch: ESCAPES[code] ?? code, plain: false });
  }
  const out: string[] = [];
  for (let at = 0; at < tokens.length; at += 1) {
    const dash = tokens[at + 1];
    const end = tokens[at + 2];
    if (dash?.plain && dash.ch === "-" && end) {
      const from = (tokens[at] as { ch: string }).ch.codePointAt(0) ?? 0;
      const to = end.ch.codePointAt(0) ?? 0;
      for (let code = from; code <= to; code += 1) out.push(String.fromCodePoint(code));
      at += 2;
    } else out.push((tokens[at] as { ch: string }).ch);
  }
  return out;
}

const tr: CommandRun = async (context) => {
  if (refusedOption(context, "Ccds")) return 1;
  const { options, operands } = parseOptions(context.args);
  const [first, second] = operands;
  const deleting = options.has("d");
  const squeeze = options.has("s");
  const needed = deleting && squeeze ? [2] : deleting ? [1] : squeeze ? [1, 2] : [2];
  if (first === undefined || !needed.includes(operands.length)) {
    context.err(
      "usage: tr [-Ccs] string1 string2\n       tr [-Cc] -d string1\n       tr [-Cc] -s string1\n       tr [-Cc] -ds string1 string2\n",
    );
    return 1;
  }
  const translating = !deleting && second !== undefined;
  if (translating && setOf(second).length === 0) {
    context.err("tr: empty string2\n");
    return 1;
  }
  if (context.stdin === null && context.background) {
    context.err("tr: the keyboard does not reach a command behind the prompt\n");
    return 1;
  }
  const text = context.stdin ?? (await typedText(context));
  const from = setOf(first);
  const to = setOf(second ?? "");
  const complement = options.has("c") || options.has("C");
  const inSet = (ch: string) => from.includes(ch) !== complement;
  // A character named twice in the first set takes the place of the later one.
  const places = new Map(from.map((ch, at) => [ch, at]));
  let out = "";
  let last = "";
  for (const ch of text) {
    let next: string | null = ch;
    if (deleting) {
      if (inSet(ch)) next = null;
    } else if (second !== undefined && inSet(ch)) {
      next =
        to[
          Math.min(
            complement
              ? // The complement in order: where this character falls among those not in the set.
                (ch.codePointAt(0) ?? 0) -
                  [...places.keys()].filter(
                    (each) => (each.codePointAt(0) ?? 0) < (ch.codePointAt(0) ?? 0),
                  ).length
              : (places.get(ch) ?? 0),
            to.length - 1,
          )
        ] ?? ch;
    }
    if (next === null) continue;
    if (squeeze && next === last && (second !== undefined ? to.includes(next) : inSet(next))) {
      continue;
    }
    out += next;
    last = next;
  }
  await writeInPieces(context, out);
  return 0;
};

const cut: CommandRun = async (context) => {
  if (refusedOption(context, "cdf", "cdf")) return 1;
  const { options, operands } = parseOptions(context.args, "cdf");
  const fields = options.get("f");
  const chars = options.get("c");
  const spec = typeof fields === "string" ? fields : typeof chars === "string" ? chars : null;
  const isList = (list: string) =>
    list.split(",").every((range) => {
      const parts = /^(\d*)(-?)(\d*)$/.exec(range);
      if (!parts || (!parts[1] && !parts[3])) return false;
      const [, low, , high] = parts;
      return (!low || Number(low) >= 1) && (!high || Number(high) >= Math.max(1, Number(low)));
    });
  if (spec === null || (fields !== undefined && chars !== undefined) || !isList(spec)) {
    context.err("usage: cut -c list [file ...]\n       cut -f list [-d delim] [file ...]\n");
    return 1;
  }
  const wanted = (index: number) =>
    spec.split(",").some((range) => {
      const [low, high] = range.split("-");
      const from = low ? Number(low) : 1;
      const to = range.includes("-") ? (high ? Number(high) : Number.POSITIVE_INFINITY) : from;
      return index >= from && index <= to;
    });
  const delimiter = typeof options.get("d") === "string" ? (options.get("d") as string) : "\t";
  if ([...delimiter].length !== 1) {
    context.err("cut: bad delimiter\n");
    return 1;
  }
  const problems = { failed: false };
  let out = "";
  for await (const { text } of inputs(context, operands, problems)) {
    const lines = text === "" ? [] : text.replace(/\n$/, "").split("\n");
    for (const line of lines) {
      if (typeof fields === "string") {
        const parts = line.split(delimiter);
        out +=
          parts.length === 1
            ? `${line}\n`
            : `${parts.filter((_, at) => wanted(at + 1)).join(delimiter)}\n`;
      } else out += `${[...line].filter((_, at) => wanted(at + 1)).join("")}\n`;
    }
  }
  await writeInPieces(context, out);
  return problems.failed ? 1 : 0;
};

/** The commands that are zsh's own, which `which` and `type` say so of. */
const SHELL_BUILT_INS: ReadonlySet<string> = new Set([
  "[",
  ":",
  "alias",
  "bg",
  "cd",
  "echo",
  "exit",
  "export",
  "false",
  "fg",
  "history",
  "jobs",
  "kill",
  "printf",
  "pwd",
  "read",
  "set",
  "shift",
  "source",
  "test",
  "true",
  "type",
  "unalias",
  "unset",
  "wait",
  "which",
]);

/**
 * What runs under `name` in this shell: whether it is zsh's own, and the program's path, `/bin/name`,
 * which runs it too. A command that only says why it cannot run here is none of these.
 */
export function commandPlace(name: string): { builtIn: boolean; path: string } | null {
  if (!commandNames().includes(name) || onlyRefuses(name)) return null;
  return { builtIn: SHELL_BUILT_INS.has(name), path: `/bin/${name}` };
}

const which: CommandRun = async (context: CommandContext) => {
  if (refusedOption(context, "as")) return 1;
  const { options, operands } = parseOptions(context.args);
  if (operands.length === 0) {
    context.err("usage: which [-as] program ...\n");
    return 1;
  }
  let status = 0;
  for (const name of operands) {
    const alias = context.scope.aliases.get(name);
    const place = commandPlace(name);
    const found = [
      ...(alias === undefined ? [] : [`${name}: aliased to ${alias}`]),
      ...(place?.builtIn ? [`${name}: shell built-in command`] : []),
      ...(place ? [place.path] : []),
    ];
    if (found.length === 0) {
      if (!options.has("s")) context.out(`${name} not found\n`);
      status = 1;
    } else if (!options.has("s")) {
      context.out(`${(options.has("a") ? found : found.slice(0, 1)).join("\n")}\n`);
    }
  }
  return status;
};

/** A word as the shell reads it back whatever it holds. */
const quotedForShell = (word: string) => `'${word.replaceAll("'", `'\\''`)}'`;

/** `env`: lists what is exported, or runs a command with `NAME=value`s added, for it alone. */
const env: CommandRun = async (context) => {
  const { args, scope, out, err } = context;
  let first = 0;
  while (first < args.length && /^[A-Za-z_]\w*=/s.test(args[first] as string)) first += 1;
  if (args[first]?.startsWith("-")) {
    err(`env: illegal option -- ${args[first]?.slice(1)}\n`);
    return 1;
  }
  const added = args.slice(0, first);
  const command = args.slice(first);
  if (command.length === 0) {
    const named = new Map(added.map((each) => [each.slice(0, each.indexOf("=")), each]));
    for (const [name, { value, exported }] of scope.variables) {
      if (exported && !named.has(name)) out(`${name}=${value}\n`);
    }
    for (const each of named.values()) out(`${each}\n`);
    return 0;
  }
  const exports = added.map((each) => `export ${quotedForShell(each)}\n`).join("");
  return context.session.runScript(
    `${exports}${command.map(quotedForShell).join(" ")}\n`,
    context,
    {
      name: "env",
      subshell: true,
    },
  );
};

const VARIABLE_NAME = /^[A-Za-z_]\w*$/;

/** `export NAME` and `export NAME=value`; alone, what is exported. */
const exportVariables: CommandRun = async ({ args, scope, out, err }) => {
  if (args.length === 0) {
    for (const [name, { value, exported }] of scope.variables) {
      if (exported) out(`export ${name}=${value}\n`);
    }
    return 0;
  }
  let status = 0;
  for (const arg of args) {
    const equals = arg.indexOf("=");
    const name = equals < 0 ? arg : arg.slice(0, equals);
    if (!VARIABLE_NAME.test(name)) {
      err(`export: not an identifier: ${name}\n`);
      status = 1;
      continue;
    }
    const value = equals < 0 ? (scope.variables.get(name)?.value ?? "") : arg.slice(equals + 1);
    scope.variables.set(name, { value, exported: true });
  }
  return status;
};

const unset: CommandRun = async ({ args, scope, err }) => {
  let status = 0;
  for (const name of args) {
    if (VARIABLE_NAME.test(name)) scope.variables.delete(name);
    else {
      err(`unset: ${name}: invalid parameter name\n`);
      status = 1;
    }
  }
  return status;
};

export const STREAM_COMMANDS: Readonly<Record<string, CommandRun>> = {
  cut,
  env,
  export: exportVariables,
  sed,
  tr,
  unset,
  which,
};
