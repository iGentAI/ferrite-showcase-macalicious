import { COMPUTER_NAME, HOME } from "../finder/finder-data";
import { commandFor, commandNames } from "./terminal-commands";
import {
  type CommandContext,
  copiedScope,
  type ShellJob,
  type ShellScope,
  type ShellSession,
  type ShellVariable,
  setVariable,
} from "./terminal-context";
import { TerminalEmulator } from "./terminal-emulator";
import {
  baseName,
  NO_SUCH_FILE,
  resolvePath,
  startupScript,
  TerminalFiles,
} from "./terminal-files";
import { Interrupted, ShellExit } from "./terminal-io";
import { type Completion, LineEditor } from "./terminal-line-editor";
import { modeOf } from "./terminal-modes";
import {
  ANY,
  CLASS,
  CLASS_END,
  hasPattern,
  matchingPaths,
  ONE,
  patternText,
} from "./terminal-patterns";
import {
  arithmetic,
  type Block,
  closingParen,
  closingQuote,
  type HereDocument,
  parseScript,
  withAliases,
} from "./terminal-script";
import { runProgram } from "./terminal-script-commands";
import { readTextBounded } from "./terminal-text-commands";

/**
 * The simulated shell: a prompt in the page that runs one plain command at a time on the person's
 * drive. It reads what the emulator's keyboard sends, as a real shell reads its
 * terminal, and writes back through the emulator.
 */

export const USER_NAME = HOME.slice(HOME.lastIndexOf("/") + 1);
export const HOST_NAME = COMPUTER_NAME;

export interface TerminalSessionOptions {
  rows?: number;
  cols?: number;
  files?: TerminalFiles;
  /** Starts in this folder rather than the home folder. */
  cwd?: string;
}

/** The first lines of a session, which say what this is. */
export function sessionBanner(hasDrive: boolean): string[] {
  return [
    hasDrive
      ? "This is a simulated shell in the page. It works on the files of this desktop."
      : "This is a simulated shell in the page. This build has no drive.",
    "help lists its commands, and man intro says what it is. rm erases for real.",
  ];
}

const NOT_HERE_YET =
  "zsh: this shell runs commands with variables, braces, patterns, $(...), |, <, >, >>, 2>, <<, <<<, ; && || and &: this is not here yet";

/** Characters that ask for shell grammar this version does not have, outside quotes. */
const GRAMMAR = new Set([..."&()`{}#"]);

/*
 * A variable stays a reference in its word until the command runs, since an earlier command of the
 * line can change it: `false; echo $?`. Its name stands between two private-use characters, which
 * the shell refuses in what is typed. KEEP starts a word that had a quote or a backslash in it, and
 * so stays a word when its references come out empty. OPERATOR parts a reference's name from its
 * modifier and that modifier's text. `terminal-patterns` has more marks.
 */
const REFERENCE = "\uE000";
const REFERENCE_END = "\uE001";
const KEEP = "\uE002";
const OPERATOR = "\uE007";
const MARKS = /[\uE000-\uE007]/;
const REFERENCES = /\uE000([^\uE001]*)\uE001/g;

/** The most words one line's braces may make: more would be a typing slip, not a command. */
const MOST_BRACE_WORDS = 4096;

/**
 * What a word's first brace expansion makes of it: `{a,b}` and `{1..3}` or `{a..c}`, outside quotes
 * and not `${`. `null` when it has none.
 */
function braceWords(word: string): string[] | null {
  let quote: string | null = null;
  for (let at = 0; at < word.length; at += 1) {
    const ch = word[at];
    if (ch === "\\") at += 1;
    else if (quote) quote = ch === quote ? null : quote;
    else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "$" && word[at + 1] === "(") {
      const shut = closingParen(word, at + 1);
      if (shut > 0) at = shut;
    } else if (ch === "{" && word[at - 1] !== "$") {
      const commas: number[] = [];
      let depth = 1;
      let inner: string | null = null;
      let close = at + 1;
      for (; close < word.length && depth > 0; close += 1) {
        const each = word[close];
        if (each === "\\") close += 1;
        else if (inner) inner = each === inner ? null : inner;
        else if (each === "'" || each === '"') inner = each;
        else if (each === "{") depth += 1;
        else if (each === "}") depth -= 1;
        else if (each === "," && depth === 1) commas.push(close);
      }
      if (depth > 0) continue;
      const body = word.slice(at + 1, close - 1);
      const before = word.slice(0, at);
      const after = word.slice(close);
      if (commas.length > 0) {
        const starts = [at, ...commas];
        return starts.map((start, index) => {
          const end = commas[index] ?? close - 1;
          return `${before}${word.slice(start + 1, end)}${after}`;
        });
      }
      const numbers = /^(-?\d+)\.\.(-?\d+)$/.exec(body);
      const letters = /^([A-Za-z])\.\.([A-Za-z])$/.exec(body);
      if (numbers || letters) {
        const code = (text: string) => (numbers ? Number(text) : text.charCodeAt(0));
        const [from, to] = [
          code((numbers ?? letters)?.[1] ?? ""),
          code((numbers ?? letters)?.[2] ?? ""),
        ];
        const count = Math.abs(to - from) + 1;
        if (count > MOST_BRACE_WORDS) continue;
        return Array.from({ length: count }, (_, index) => {
          const now = from + (to >= from ? index : -index);
          return `${before}${numbers ? now : String.fromCharCode(now)}${after}`;
        });
      }
    }
  }
  return null;
}

/** `line`, with the brace expansions of its words made into words. Quotes stay for `stepsOf`. */
function withBracesExpanded(line: string): string {
  let out = "";
  let word = "";
  let quote: string | null = null;
  const flush = () => {
    let words = [word];
    for (let more = true; more && words.length <= MOST_BRACE_WORDS; ) {
      more = false;
      words = words.flatMap((each) => {
        const made = braceWords(each);
        if (made) more = true;
        return made ?? [each];
      });
    }
    // Past the limit the word stays as written, and its brace is refused as any other.
    out += words.length > MOST_BRACE_WORDS ? word : words.join(" ");
    word = "";
  };
  for (let at = 0; at < line.length; at += 1) {
    const ch = line[at] as string;
    if (ch === "\\") {
      word += line.slice(at, at + 2);
      at += 1;
    } else if (quote) {
      word += ch;
      if (ch === quote) quote = null;
    } else if (ch === "$" && line[at + 1] === "(" && closingParen(line, at + 1) > 0) {
      const shut = closingParen(line, at + 1);
      word += line.slice(at, shut + 1);
      at = shut;
    } else if (ch === "'" || ch === '"') {
      word += ch;
      quote = ch;
    } else if (/[\s;|&<>]/.test(ch)) {
      flush();
      out += ch;
    } else word += ch;
  }
  flush();
  return out;
}

/**
 * What a `$` starts: a reference's text and how much of the line it takes; `null` for what this
 * version does not have, as `` ` `` and `${a:?b}`. A `$` before anything else is itself. A `$(...)`
 * stays a reference named with its whole text, and runs when its command does.
 */
function referenceAt(line: string, at: number): { text: string; length: number } | null {
  const rest = line.slice(at + 1);
  if (rest.startsWith("(")) {
    const shut = closingParen(line, at + 1);
    if (shut < 0) return null;
    return {
      text: `${REFERENCE}${line.slice(at, shut + 1)}${REFERENCE_END}`,
      length: shut - at + 1,
    };
  }
  const modified =
    /^\{(#)([A-Za-z_]\w*)()\}/.exec(rest) ??
    /^\{()([A-Za-z_]\w*)(:-|:=|:\+|##|#|%%|%|\/\/|\/)([^}$`\\'"]*)\}/.exec(rest);
  if (modified) {
    const [whole, length, name, operator, argument = ""] = modified;
    return {
      text: `${REFERENCE}${name}${OPERATOR}${length || operator}${OPERATOR}${argument}${REFERENCE_END}`,
      length: 1 + whole.length,
    };
  }
  const braced = /^\{([A-Za-z_]\w*|\?|\d+)\}/.exec(rest);
  const name = braced?.[1] ?? /^(?:[A-Za-z_]\w*|[?#@*\d])/.exec(rest)?.[0];
  if (name) {
    return {
      text: `${REFERENCE}${name}${REFERENCE_END}`,
      length: 1 + (braced?.[0] ?? name).length,
    };
  }
  return /^[{$!-]/.test(rest) ? null : { text: "$", length: 1 };
}
/** The inside of a double quote or a here-document with its references marked; null when refused. */
function marked(inner: string, quoted: boolean): string | null {
  let text = "";
  for (let inside = 0; inside < inner.length; inside += 1) {
    const ch = inner[inside] as string;
    if (ch === "`") return null;
    if (ch === "\\" && /[$\\`]/.test(inner[inside + 1] ?? "")) {
      text += inner[inside + 1];
      inside += 1;
    } else if (ch === "\\" && quoted && inner[inside + 1] === '"') {
      text += '"';
      inside += 1;
    } else if (ch === "$") {
      const found = referenceAt(inner, inside);
      if (found === null) return null;
      text += found.text;
      inside += found.length - 1;
    } else text += ch;
  }
  return text;
}

/** The value of `$((...))`'s name, when it is one: `$(` opened on a parenthesis it closes on. */
const arithmeticIn = (name: string): string | null => {
  const body = name.slice(2, -1);
  return body.startsWith("(") && closingParen(body, 0) === body.length - 1
    ? body.slice(1, -1)
    : null;
};

/** A word that is nothing but one reference, and whether a quote holds it. */
const wholeReference = (word: string) => {
  const found = /^(\uE002?)\uE000([^\uE001]*)\uE001$/.exec(word);
  return found ? { name: found[2] as string, quoted: found[1] !== "" } : null;
};

/** A word with its references' values in place. */
const expanded = (word: string, value: (name: string) => string) =>
  word.replace(REFERENCES, (_, name: string) => value(name)).replace(KEEP, "");

/** A `*` and `?` pattern as a regular expression's source; the rest of it stands for itself. */
const patternSource = (pattern: string) =>
  pattern.replace(/[.+^${}()|[\]\\/*?-]/g, (ch) =>
    ch === "*" ? "[\\s\\S]*" : ch === "?" ? "[\\s\\S]" : `\\${ch}`,
  );

/** `${a#p}` and its like: `text` without the shortest or longest match at its start or end. */
function without(text: string, pattern: string, fromStart: boolean, longest: boolean): string {
  const match = new RegExp(`^${patternSource(pattern)}$`);
  const lengths = Array.from({ length: text.length + 1 }, (_, length) => length);
  for (const length of longest ? lengths.reverse() : lengths) {
    const part = fromStart ? text.slice(0, length) : text.slice(text.length - length);
    if (match.test(part))
      return fromStart ? text.slice(length) : text.slice(0, text.length - length);
  }
  return text;
}

/** A reference's value, its modifier applied. `assign` keeps what `${a:=b}` sets. */
function referenceValue(
  reference: string,
  value: (name: string) => string,
  assign: (name: string, to: string) => void,
): string {
  const [name = "", operator, argument = ""] = reference.split(OPERATOR);
  const now = value(name);
  switch (operator) {
    case undefined:
      return now;
    case "#":
      if (argument === "") return String([...now].length);
      return without(now, argument, true, false);
    case "##":
      return without(now, argument, true, true);
    case "%":
      return without(now, argument, false, false);
    case "%%":
      return without(now, argument, false, true);
    case ":-":
      return now === "" ? argument : now;
    case ":+":
      return now === "" ? "" : argument;
    case ":=":
      if (now === "") assign(name, argument);
      return now === "" ? argument : now;
    default: {
      const cut = argument.indexOf("/");
      const pattern = cut < 0 ? argument : argument.slice(0, cut);
      const to = cut < 0 ? "" : argument.slice(cut + 1);
      if (pattern === "") return now;
      const flags = operator === "//" ? "g" : "";
      return now.replace(new RegExp(patternSource(pattern), flags), () => to);
    }
  }
}

/** The variables a shell starts with; `PWD` and `OLDPWD` follow `cd`. */
const inheritedVariables = (cwd: string): Map<string, ShellVariable> =>
  new Map(
    Object.entries({
      HOME,
      LOGNAME: USER_NAME,
      OLDPWD: cwd,
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      PWD: cwd,
      SHELL: "/bin/zsh",
      TERM: "xterm-256color",
      TERM_PROGRAM: "Apple_Terminal",
      USER: USER_NAME,
    }).map(([name, value]) => [name, { value, exported: true }]),
  );

/** How a pipeline leads to the next on its line; `&` runs it behind the prompt. */
type Connector = ";" | "&&" | "||" | "&";

/** One of a command's redirections, in the order written; `2>&1` has no target. */
export type Redirect =
  | { op: "<"; target: string }
  | { op: "<<<"; target: string }
  | { op: "<<"; text: string }
  | { op: ">" | ">>"; fd: 1 | 2; target: string }
  | { op: "2>&1" };

/** One command of a pipeline. */
export interface LineCommand {
  /** `NAME=value` words. A command that has them has nothing else: `stepsOf` refuses the rest. */
  assignments: string[];
  words: string[];
  redirects: Redirect[];
}

/** One pipeline of a line (commands joined by `|`, usually one), with what comes after it. */
export interface LineStep {
  commands: LineCommand[];
  after?: Connector;
}

/** The most a pipe or a redirected stream holds, in characters: it is kept in the page until used. */
const MOST_HELD_CHARS = 16 * 1024 * 1024;

const ONE_REDIRECTION =
  "zsh: this first version takes one redirection of each stream, and none where a pipe already has it";

/** What is wrong with these redirections at this place in a pipeline, or null. */
function redirectionProblem(commands: readonly LineCommand[]): string | null {
  for (const [at, { redirects }] of commands.entries()) {
    const inputs = redirects.filter(({ op }) => op === "<" || op === "<<" || op === "<<<").length;
    const outputs = (fd: 1 | 2) =>
      redirects.filter(
        (each) =>
          ((each.op === ">" || each.op === ">>") && each.fd === fd) ||
          (each.op === "2>&1" && fd === 2),
      ).length;
    if (inputs > 1 || outputs(1) > 1 || outputs(2) > 1) return ONE_REDIRECTION;
    if (at > 0 && inputs > 0) return ONE_REDIRECTION;
    if (at < commands.length - 1 && outputs(1) > 0) return ONE_REDIRECTION;
  }
  return null;
}

/**
 * The commands of `line`, with quotes and backslashes taken off their words, or the message that
 * refuses it. A character of the grammar this version does not have is refused rather than read as
 * text, so nothing runs other than what was asked for. `documents` are the bodies of its `<<`, in
 * order.
 */
export function stepsOf(
  typed: string,
  documents: readonly HereDocument[] = [],
): LineStep[] | { problem: string } {
  const steps: LineStep[] = [];
  if (MARKS.test(typed) || documents.some(({ body }) => MARKS.test(body))) {
    return { problem: NOT_HERE_YET };
  }
  const line = withBracesExpanded(typed);
  const bodies = [...documents];
  let commands: LineCommand[] = [];
  let assignments: string[] = [];
  let words: string[] = [];
  let redirects: Redirect[] = [];
  let pending: { op: "<" | "<<<" } | { op: ">" | ">>"; fd: 1 | 2 } | null = null;
  let word: string | null = null;
  let tilde = false;
  let literal = false;
  let assigning = false;
  const end = () => {
    if (word !== null) {
      const text = tilde ? `${HOME}${word.slice(1)}` : word;
      const value = literal && MARKS.test(text) ? `${KEEP}${text}` : text;
      if (pending) {
        redirects.push({ ...pending, target: value } as Redirect);
        pending = null;
      } else if (assigning) assignments.push(value);
      else words.push(value);
    }
    word = null;
    tilde = false;
    literal = false;
    assigning = false;
  };
  /** Why the command so far cannot end before `near`, or null. */
  const unfinished = (near: string) => {
    if (pending) return `zsh: parse error near \`${near}'`;
    if (words.length > 0 || assignments.length > 0) return null;
    return redirects.length > 0
      ? "zsh: this first version needs a command before a redirection"
      : `zsh: parse error near \`${near}'`;
  };
  const takeCommand = (): LineCommand => {
    const command = { assignments, words, redirects };
    assignments = [];
    words = [];
    redirects = [];
    return command;
  };
  for (let at = 0; at < line.length; at += 1) {
    const ch = line[at] as string;
    const pair = line.slice(at, at + 2);
    if (ch === "\n") return { problem: NOT_HERE_YET };
    if (ch === " " || ch === "\t") end();
    else if (ch === ";" || pair === "&&" || pair === "||" || (ch === "&" && line[at + 1] !== ">")) {
      end();
      const after: Connector = ch === ";" ? ";" : pair === "&&" || pair === "||" ? pair : "&";
      const problem = unfinished(after);
      if (problem) return { problem };
      steps.push({ commands: [...commands, takeCommand()], after });
      commands = [];
      at += after.length - 1;
    } else if (ch === "|") {
      end();
      const problem = unfinished("|");
      if (problem) return { problem };
      commands.push(takeCommand());
    } else if (ch === "<" || ch === ">") {
      const taken = word ?? "";
      const number =
        /^\d+$/.test(taken) &&
        line.slice(at - taken.length, at) === taken &&
        /[\s;|&]/.test(line[at - taken.length - 1] ?? " ")
          ? taken
          : null;
      if (number !== null && !(ch === ">" && (number === "1" || number === "2"))) {
        return { problem: NOT_HERE_YET };
      }
      const toErrors = number === "2";
      if (pair === "<>" || pair === ">|") return { problem: NOT_HERE_YET };
      if (pair === "<<" && line[at + 2] !== "<") {
        const written = /^<<-?[ \t]*('[^'\n]*'|"[^"\n]*"|[^\s;|&<>()'"]+)/.exec(line.slice(at));
        const document = bodies.shift();
        if (!written || !document) return { problem: "zsh: parse error near `<<'" };
        end();
        if (pending) return { problem: "zsh: parse error near `<<'" };
        const text = document.expand ? marked(document.body, false) : document.body;
        if (text === null) return { problem: NOT_HERE_YET };
        redirects.push({ op: "<<", text });
        at += written[0].length - 1;
        continue;
      }
      if (pair === "<<") {
        end();
        if (pending) return { problem: "zsh: parse error near `<<<'" };
        pending = { op: "<<<" };
        at += 2;
        continue;
      }
      if (
        pair === ">&" &&
        !(toErrors && line.startsWith(">&1", at) && /[\s;|&<>]/.test(line[at + 3] ?? " "))
      ) {
        return { problem: NOT_HERE_YET };
      }
      if (number !== null) {
        word = null;
        if (line.startsWith(">&1", at)) {
          if (pending) return { problem: "zsh: parse error near `2'" };
          redirects.push({ op: "2>&1" });
          at += 2;
          continue;
        }
      } else end();
      if (pending) return { problem: `zsh: parse error near \`${ch}'` };
      if (ch === "<") pending = { op: "<" };
      else {
        pending = { op: pair === ">>" ? ">>" : ">", fd: toErrors ? 2 : 1 };
        if (pair === ">>") at += 1;
      }
    } else if (ch === "\\") {
      at += 1;
      if (at >= line.length) return { problem: "zsh: a backslash ends the line" };
      word = `${word ?? ""}${line[at]}`;
      literal = true;
    } else if (ch === "'" || ch === '"') {
      const close = closingQuote(line, at);
      if (close < 0) return { problem: `zsh: unmatched ${ch}` };
      let inner = line.slice(at + 1, close);
      if (ch === '"') {
        const text = marked(inner, true);
        if (text === null) return { problem: NOT_HERE_YET };
        inner = text;
      }
      word = `${word ?? ""}${inner}`;
      literal = true;
      at = close;
    } else if (ch === "$") {
      const found = referenceAt(line, at);
      if (!found) return { problem: NOT_HERE_YET };
      word = `${word ?? ""}${found.text}`;
      at += found.length - 1;
    } else if (ch === "*" || ch === "?") {
      word = `${word ?? ""}${ch === "*" ? ANY : ONE}`;
    } else if (ch === "[" && word === null && /^\[\[?(\s|$)/.test(line.slice(at))) {
      const opening = line[at + 1] === "[" ? "[[" : "[";
      word = opening;
      at += opening.length - 1;
    } else if (ch === "[") {
      const first = at + (/[!^]/.test(line[at + 1] ?? "") ? 2 : 1);
      const close = line.indexOf("]", line[first] === "]" ? first + 1 : first);
      const members = close < 0 ? "" : line.slice(at + 1, close);
      if (close < 0 || /[\s'"\\$`]/.test(members)) return { problem: NOT_HERE_YET };
      word = `${word ?? ""}${CLASS}${members}${CLASS_END}`;
      at = close;
    } else if (GRAMMAR.has(ch)) return { problem: NOT_HERE_YET };
    else {
      if (word === null && ch === "~") {
        const next = line[at + 1];
        tilde = next === undefined || next === " " || next === "\t" || next === "/";
      }
      if (
        ch === "=" &&
        !pending &&
        !literal &&
        words.length === 0 &&
        /^[A-Za-z_]\w*$/.test(word ?? "")
      ) {
        assigning = true;
      }
      word = `${word ?? ""}${ch}`;
    }
  }
  end();
  if (words.length > 0 || assignments.length > 0 || redirects.length > 0 || pending) {
    const problem = unfinished("\\n");
    if (problem) return { problem };
    steps.push({ commands: [...commands, takeCommand()] });
  } else if (commands.length > 0 || steps.at(-1)?.after === "&&" || steps.at(-1)?.after === "||") {
    return { problem: "zsh: parse error near `\\n'" };
  }
  for (const step of steps) {
    // `A=1 pwd` needs an environment to run with, and a pattern in a redirection could name several
    // files; refused whole, so nothing before it on the line runs.
    if (
      step.commands.some(
        ({ assignments: set, words: rest, redirects: to }) =>
          (set.length > 0 && (rest.length > 0 || to.length > 0)) ||
          to.some((redirect) => "target" in redirect && hasPattern(redirect.target)),
      )
    ) {
      return { problem: NOT_HERE_YET };
    }
    const problem = redirectionProblem(step.commands);
    if (problem) return { problem };
  }
  return steps;
}

/** A file a stream of a running command is going to. */
interface RedirectedFile {
  target: string;
  path: string;
  append: boolean;
  parts: string[];
  held: number;
  /** It overflowed: the file stays as it was. */
  tooMuch: boolean;
}

type Writer = (text: string) => void;

/**
 * What a line runs in. At the prompt its streams are the screen; a script, a `$(...)` or a job has
 * its own scope or streams, and may run alongside the prompt, so none of this is the session's.
 */
interface Execution {
  scope: ShellScope;
  /** Where standard output goes when it is not the screen. */
  out: Writer | null;
  err: Writer | null;
  /** What a `while read` loop reads, shared by every command in it. */
  input: { rest: string } | null;
  /** A script's `exit` ends the script, not this shell. */
  nested: boolean;
  background: boolean;
  signal: AbortSignal;
  /** A pattern matched nothing or a script's line was refused: nothing more of it runs. */
  abandoned: boolean;
}

/** A name written so that `stepsOf` reads it back as one word. */
export const escapeForShell = (name: string) =>
  name.replace(/([\s\\'"`$&|;<>()*?[\]{}#!~])/g, "\\$1");

/** A job's words as `jobs` shows them. */
const jobText = ({ words }: LineCommand) =>
  words.map((word) => patternText(word).replace(REFERENCES, "").replace(KEEP, "")).join(" ");

/** The keys in what the keyboard sent: a character, or an escape sequence whole. */
function keysOf(text: string): string[] {
  const keys: string[] = [];
  for (let at = 0; at < text.length; at += 1) {
    let end = at;
    if (text[at] === "\x1b" && (text[at + 1] === "[" || text[at + 1] === "O")) {
      end = at + 2;
      while (end < text.length - 1 && !/[A-Za-z~]/.test(text[end] as string)) end += 1;
    }
    keys.push(text.slice(at, end + 1));
    at = end;
  }
  return keys;
}

/** A shell, its terminal and its line editor: one tab of the window. */
export class TerminalSession implements ShellSession {
  readonly emulator: TerminalEmulator;
  readonly editor: LineEditor;
  readonly files: TerminalFiles;
  readonly scope: ShellScope;
  readonly userName = USER_NAME;
  readonly hostName = HOST_NAME;
  /** The name in the title bar: `zsh`, or what is running. */
  processName = "zsh";
  /** Whether the shell has exited. */
  ended = false;
  rawReader: ((data: string) => void) | null = null;
  onResize: (() => void) | null = null;

  private listeners = new Set<() => void>();
  private foreground: AbortController | null = null;
  private held = "";
  private started: Promise<void> | null = null;
  /** The lines so far of what asks for more: a loop, a quote or a here-document. */
  private continued: string[] = [];
  readonly jobs: ShellJob[] = [];
  private nextPid = 4021;

  constructor(options: TerminalSessionOptions = {}) {
    this.emulator = new TerminalEmulator(options.rows ?? 24, options.cols ?? 80);
    this.files = options.files ?? new TerminalFiles();
    const cwd = options.cwd ?? HOME;
    this.scope = {
      cwd,
      oldCwd: cwd,
      status: 0,
      variables: inheritedVariables(cwd),
      aliases: new Map(),
      positional: [],
      scriptName: "zsh",
    };
    this.editor = new LineEditor({
      write: (data) => this.emulator.write(data),
      columns: () => this.emulator.cols,
      rows: () => this.emulator.rows,
      complete: (line, cursor) => this.complete(line, cursor),
      onLine: (line) => void this.enter(line),
      onInterrupt: () => {
        this.continued = [];
        this.scope.status = 130;
        this.prompt();
      },
      onEndOfFile: () => this.finish(0),
      clearScreen: () => this.emulator.write("\x1b[H\x1b[2J"),
    });
    this.emulator.onChange = () => this.tell();
    this.emulator.onTitle = () => this.tell();
    for (const line of sessionBanner(this.files.available)) {
      this.emulator.write(`${line}\r\n`);
    }
    this.emulator.write("\x1b[?2004h");
  }

  /** Reads `~/.zshrc`, then puts up the first prompt, once however often it is called. */
  start(): Promise<void> {
    this.started ??= Promise.resolve().then(async () => {
      if (await this.runStartup()) return;
      this.prompt();
    });
    return this.started;
  }

  /** Runs `~/.zshrc` in this shell. Answers whether it ended the shell. */
  private async runStartup(): Promise<boolean> {
    const text = startupScript();
    if (!text) return false;
    const parsed = parseScript(text, true);
    if (!("blocks" in parsed)) {
      this.write(`.zshrc: ${"problem" in parsed ? parsed.problem : "parse error"}\n`);
      return false;
    }
    const control = new AbortController();
    this.foreground = control;
    try {
      await this.runBlocks(parsed.blocks, {
        scope: this.scope,
        out: null,
        err: null,
        input: { rest: "" },
        nested: true,
        background: false,
        signal: control.signal,
        abandoned: false,
      });
    } catch (error) {
      if (!(error instanceof ShellExit)) throw error;
      this.finish(error.status);
      return true;
    } finally {
      this.foreground = null;
    }
    this.scope.status = 0;
    return false;
  }

  /** Hears every change of what the session shows. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private tell(): void {
    for (const listener of this.listeners) listener();
  }

  /** Whether a command runs, in front of the prompt or behind it. */
  get busy(): boolean {
    return this.foreground !== null || this.jobs.some(({ running }) => running);
  }

  /** Bytes from the keyboard, or an answer from the terminal. */
  input(data: string): void {
    if (this.ended) return;
    if (this.rawReader) {
      this.feedProgram(data);
      return;
    }
    if (this.foreground || !this.editor.reading) {
      if (data.includes("\x03")) this.interrupt();
      else this.held += data;
      return;
    }
    this.editor.feed(data);
    // Keys past the end of a line belong after the command that line started.
    if (!this.editor.reading) this.held += this.editor.takeUnread();
  }

  /** Keys for the program in front; any past the one that ends it wait for the prompt. */
  private feedProgram(data: string): void {
    for (const key of keysOf(data)) {
      if (this.rawReader) this.rawReader(key);
      else this.held += key;
    }
  }

  takeKeyboard(reader: ((key: string) => void) | null): void {
    this.rawReader = reader;
    if (!reader) return;
    const held = this.held;
    this.held = "";
    this.feedProgram(held);
  }

  /** The terminal's size changed. */
  resize(rows: number, cols: number): void {
    const widthChanged = cols !== this.emulator.cols;
    this.emulator.resize(rows, cols);
    if (widthChanged) this.editor.resized();
    this.onResize?.();
    this.tell();
  }

  /** Shell > Send Signal, and Control-C while something runs. */
  interrupt(): void {
    if (!this.foreground) return;
    this.emulator.write("^C\r\n");
    this.foreground.abort(new Interrupted());
    this.held = "";
  }

  /** Ends what runs here: its tab or window has closed. */
  stop(): void {
    this.interrupt();
    for (const job of this.jobs) job.stop();
  }

  private promptText(): string {
    const { cwd } = this.scope;
    const where = cwd === HOME ? "~" : cwd === "/" ? "/" : baseName(cwd);
    return `${USER_NAME}@${HOST_NAME} ${where} % `;
  }

  private prompt(): void {
    if (this.ended) return;
    // Output that did not end its line: zsh marks the end and starts afresh (PROMPT_SP).
    if (this.emulator.cursor.column !== 0) this.emulator.write("\x1b[7m%\x1b[27m\r\n");
    this.processName = "zsh";
    this.tellEndedJobs();
    this.emulator.setMark(this.emulator.cursorLine, true);
    this.readLine(this.promptText());
  }

  private readLine(prompt: string): void {
    this.editor.start(prompt);
    const held = this.held;
    this.held = "";
    if (held) this.input(held);
    this.tell();
  }

  /** Says which jobs have ended since the last prompt, and forgets them, as zsh does. */
  private tellEndedJobs(): void {
    for (const job of this.jobs.filter(({ running }) => !running)) {
      const word = job.status === 0 ? "done" : `exit ${job.status}`;
      this.emulator.write(`[${job.number}]  + ${word}    ${job.text}\r\n`);
      this.jobs.splice(this.jobs.indexOf(job), 1);
    }
  }

  private finish(status: number): void {
    this.scope.status = status;
    this.ended = true;
    this.emulator.write("\r\n[Process completed]\r\n");
    this.tell();
  }

  private write(text: string): void {
    this.emulator.write(text.replace(/\r?\n/g, "\r\n"));
  }

  private async enter(line: string): Promise<void> {
    if (line.trim() !== "" && this.editor.history.at(-1) !== line) this.editor.history.push(line);
    const parsed = parseScript([...this.continued, line].join("\n"));
    if ("more" in parsed) {
      this.continued.push(line);
      this.readLine(`${parsed.more}> `);
      return;
    }
    this.continued = [];
    if ("problem" in parsed) {
      this.write(`${parsed.problem}\n`);
      this.scope.status = 1;
      this.prompt();
      return;
    }
    const control = new AbortController();
    this.foreground = control;
    const execution: Execution = {
      scope: this.scope,
      out: null,
      err: null,
      input: null,
      nested: false,
      background: false,
      signal: control.signal,
      abandoned: false,
    };
    const stopped = await this.runBlocks(parsed.blocks, execution);
    this.foreground = null;
    if (!stopped) this.prompt();
  }

  /** What a script says when it cannot go on: where its errors go, or on the screen. */
  private say(execution: Execution, text: string): void {
    if (execution.err) execution.err(text);
    else this.write(text);
  }

  /** Runs blocks in turn until one is interrupted or refused. Answers whether the shell ended. */
  private async runBlocks(blocks: readonly Block[], execution: Execution): Promise<boolean> {
    for (const block of blocks) {
      if (await this.runBlock(block, execution)) return true;
      if (this.stoppedIn(execution)) break;
    }
    return false;
  }

  /** Control-C ends the whole of what runs, not only the command it stopped. */
  private stoppedIn(execution: Execution): boolean {
    if (execution.signal.aborted) execution.scope.status = 130;
    return execution.scope.status === 130 || execution.abandoned;
  }

  private async runBlock(block: Block, execution: Execution): Promise<boolean> {
    if (block.kind === "line") return this.runLine(block.text, block.documents, execution);
    if (block.redirects === "") return this.runCompound(block, execution);
    // `done < file`: the loop's commands read and write there, and a file is written at its end.
    const steps = stepsOf(`: ${block.redirects}`);
    if (!Array.isArray(steps)) {
      this.say(execution, `${steps.problem}\n`);
      execution.scope.status = 1;
      return false;
    }
    const written = steps[0]?.commands[0]?.redirects ?? [];
    const streams = await this.openStreams(written, null, null, execution);
    if (!streams) {
      execution.scope.status = 1;
      return false;
    }
    const stopped = await this.runCompound(block, {
      ...execution,
      out: streams.toScreen ? execution.out : streams.out,
      err: streams.err,
      input: streams.stdin === null ? execution.input : { rest: streams.stdin },
    });
    if (!stopped) await this.closeStreams(streams.files, execution, new AbortController());
    return stopped;
  }

  /** A browser turn between a loop's rounds, so that Control-C reaches one that never ends. */
  private readonly turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  private async runCompound(
    block: Exclude<Block, { kind: "line" }>,
    execution: Execution,
  ): Promise<boolean> {
    const { scope } = execution;
    if (block.kind === "if") {
      for (const { test, body } of block.arms) {
        if (await this.runBlocks(test, execution)) return true;
        if (this.stoppedIn(execution)) return false;
        if (scope.status === 0) return this.runBlocks(body, execution);
      }
      scope.status = 0;
      return this.runBlocks(block.otherwise, execution);
    }
    let last = 0;
    if (block.kind === "for") {
      const words =
        block.words === null ? scope.positional : await this.forWords(block.words, execution);
      if (!words) return false;
      for (const word of words) {
        setVariable(scope, block.name, word);
        if (await this.runBlocks(block.body, execution)) return true;
        if (this.stoppedIn(execution)) return false;
        last = scope.status;
        await this.turn();
      }
      scope.status = last;
      return false;
    }
    for (;;) {
      if (await this.runBlocks(block.test, execution)) return true;
      if (this.stoppedIn(execution)) return false;
      if ((scope.status === 0) === block.until) break;
      if (await this.runBlocks(block.body, execution)) return true;
      if (this.stoppedIn(execution)) return false;
      last = scope.status;
      await this.turn();
    }
    scope.status = last;
    return false;
  }

  /** The list after a `for`'s `in`, expanded as a command's words are. */
  private async forWords(text: string, execution: Execution): Promise<string[] | null> {
    if (text.trim() === "") return [];
    const steps = stepsOf(text);
    if (!Array.isArray(steps)) {
      this.say(execution, `${steps.problem}\n`);
      execution.scope.status = 1;
      execution.abandoned = true;
      return null;
    }
    const written = steps[0]?.commands[0];
    if (!written) return [];
    const found = await this.substituted(written.words, execution);
    if (!found) return null;
    return this.pathsOfPatterns(this.wordsOf(written.words, found, execution), execution);
  }

  private async runLine(
    text: string,
    documents: readonly HereDocument[],
    execution: Execution,
  ): Promise<boolean> {
    const steps = stepsOf(withAliases(text, execution.scope.aliases), documents);
    if (!Array.isArray(steps)) {
      this.say(execution, `${steps.problem}\n`);
      execution.scope.status = 1;
      if (execution.nested) execution.abandoned = true;
      return false;
    }
    for (const [at, { commands, after }] of steps.entries()) {
      const before = steps[at - 1]?.after;
      if (after === "&") {
        if (before === "&&" && execution.scope.status !== 0) continue;
        if (before === "||" && execution.scope.status === 0) continue;
        this.startJob(commands, execution);
        continue;
      }
      if (before === "&&" && execution.scope.status !== 0) continue;
      if (before === "||" && execution.scope.status === 0) continue;
      const stopped = await this.runPipeline(commands, execution);
      if (stopped) return true;
      if (this.stoppedIn(execution)) break;
    }
    return false;
  }

  /** Starts a pipeline behind the prompt, in a scope of its own, writing to the same screen. */
  private startJob(commands: readonly LineCommand[], execution: Execution): void {
    const control = new AbortController();
    const job: ShellJob = {
      number: (this.jobs.at(-1)?.number ?? 0) + 1,
      pid: this.nextPid,
      text: commands.map(jobText).join(" | "),
      running: true,
      status: 0,
      stop: () => control.abort(new Interrupted()),
      ended: Promise.resolve(),
    };
    this.nextPid += 1;
    this.jobs.push(job);
    this.say(execution, `[${job.number}] ${job.pid}\n`);
    const scope = copiedScope(execution.scope);
    job.ended = this.runPipeline(commands, {
      ...execution,
      scope,
      input: { rest: "" },
      nested: true,
      background: true,
      signal: control.signal,
      abandoned: false,
    })
      .catch(() => false)
      .then(() => {
        job.running = false;
        job.status = scope.status;
        this.tell();
      });
    execution.scope.status = 0;
  }

  /** Runs what `$(...)` holds, keeping what it writes: a shell of its own, as in zsh. */
  private async capture(text: string, execution: Execution): Promise<string | null> {
    const parsed = parseScript(text, true);
    if (!("blocks" in parsed)) {
      this.say(execution, `${"problem" in parsed ? parsed.problem : "zsh: parse error"}\n`);
      execution.scope.status = 1;
      execution.abandoned = true;
      return null;
    }
    const parts: string[] = [];
    let held = 0;
    const scope = copiedScope(execution.scope);
    try {
      await this.runBlocks(parsed.blocks, {
        ...execution,
        scope,
        out: (each) => {
          held += each.length;
          if (held > MOST_HELD_CHARS) throw new Error("too much for a command substitution here");
          parts.push(each);
        },
        nested: true,
        abandoned: false,
      });
    } catch (error) {
      if (error instanceof ShellExit) scope.status = error.status;
      else throw error;
    }
    execution.scope.status = scope.status;
    return parts.join("").replace(/\n+$/, "");
  }

  /**
   * Runs each `$(...)` and works out each `$((...))` in `marked`, once and in order. Null once one
   * has said why it cannot, or Control-C stopped it.
   */
  private async substituted(
    words: readonly string[],
    execution: Execution,
  ): Promise<Map<string, string> | null> {
    const found = new Map<string, string>();
    for (const word of words) {
      for (const [, name = ""] of word.matchAll(REFERENCES)) {
        if (!name.startsWith("$(") || found.has(name)) continue;
        const sum = arithmeticIn(name);
        if (sum !== null) {
          try {
            const { scope } = execution;
            found.set(name, String(arithmetic(sum, (each) => this.plainValue(scope, each))));
          } catch (error) {
            this.say(execution, `zsh: ${(error as Error).message}\n`);
            execution.scope.status = 1;
            execution.abandoned = true;
            return null;
          }
        } else {
          const output = await this.capture(name.slice(2, -1), execution);
          if (output === null || execution.signal.aborted) return null;
          found.set(name, output);
        }
      }
    }
    return found;
  }

  private plainValue(scope: ShellScope, name: string): string {
    if (name === "?") return String(scope.status);
    if (name === "#") return String(scope.positional.length);
    if (name === "@" || name === "*") return scope.positional.join(" ");
    if (name === "0") return scope.scriptName;
    if (/^\d+$/.test(name)) return scope.positional[Number(name) - 1] ?? "";
    return scope.variables.get(name)?.value ?? "";
  }

  private valueIn(found: ReadonlyMap<string, string>, scope: ShellScope) {
    return (name: string) =>
      found.get(name) ??
      referenceValue(
        name,
        (each) => this.plainValue(scope, each),
        (each, to) => setVariable(scope, each, to),
      );
  }

  /** Words with their references' values in place, split where zsh splits them. */
  private wordsOf(
    words: readonly string[],
    found: ReadonlyMap<string, string>,
    execution: Execution,
  ): string[] {
    const { scope } = execution;
    const value = this.valueIn(found, scope);
    return words.flatMap((word) => {
      const whole = wholeReference(word);
      if (whole?.name === "@" || (whole?.name === "*" && !whole.quoted)) return scope.positional;
      if (whole && !whole.quoted && whole.name.startsWith("$(") && !arithmeticIn(whole.name)) {
        return value(whole.name)
          .split(/\s+/)
          .filter((part) => part !== "");
      }
      const text = expanded(word, value);
      return text === "" && MARKS.test(word) && !word.startsWith(KEEP) ? [] : [text];
    });
  }

  /**
   * Runs a pipeline's commands in turn, each given all that the one before wrote. Only the last
   * touches the shell, as in zsh: a `cd` or an `exit` before a `|` has no effect on it. Answers
   * whether the shell ended.
   */
  private async runPipeline(
    commands: readonly LineCommand[],
    execution: Execution,
  ): Promise<boolean> {
    let stdin: string | null = null;
    for (const [at, command] of commands.entries()) {
      if (at === commands.length - 1) return this.run(command, stdin, null, execution);
      const piped: string[] = [];
      let held = 0;
      await this.run(
        command,
        stdin,
        (text) => {
          held += text.length;
          if (held > MOST_HELD_CHARS) throw new Error("too much for a pipe here");
          piped.push(text);
        },
        execution,
      );
      if (this.stoppedIn(execution)) return false;
      stdin = piped.join("");
    }
    return false;
  }

  /**
   * What a command's redirections make of its streams: what `<` reads, and a place in the page for
   * what `>` and `2>` will write once it has ended. A target that cannot be used is said, and answers
   * `null`: the command does not run.
   */
  private async openStreams(
    redirects: readonly Redirect[],
    piped: string | null,
    pipe: ((text: string) => void) | null,
    execution: Execution,
  ): Promise<{
    stdin: string | null;
    out: (text: string) => void;
    err: (text: string) => void;
    toScreen: boolean;
    files: RedirectedFile[];
  } | null> {
    const screen = (text: string) => this.write(text);
    const streams = {
      stdin: piped,
      out: pipe ?? execution.out ?? screen,
      err: execution.err ?? (screen as (text: string) => void),
      toScreen: pipe === null && execution.out === null,
      files: [] as RedirectedFile[],
    };
    const said = (target: string, why: string) => {
      this.say(execution, `zsh: ${why.charAt(0).toLowerCase()}${why.slice(1)}: ${target}\n`);
      return null;
    };
    for (const redirect of redirects) {
      if (redirect.op === "2>&1") {
        streams.err = streams.out;
        continue;
      }
      if (redirect.op === "<<") {
        streams.stdin = redirect.text;
        continue;
      }
      if (redirect.op === "<<<") {
        streams.stdin = `${redirect.target}\n`;
        continue;
      }
      const { target } = redirect;
      if (target === "") return said(target, NO_SUCH_FILE);
      const path = resolvePath(target, execution.scope.cwd);
      try {
        if (redirect.op === "<") {
          streams.stdin = await readTextBounded(this.files, path);
          continue;
        }
        const { node } = await this.files.checkWritable(path);
        if (node && (modeOf(node) & 0o200) === 0) return said(target, "Permission denied");
      } catch (error) {
        return said(target, (error as Error).message);
      }
      const file: RedirectedFile = streams.files.find((each) => each.path === path) ?? {
        target,
        path,
        append: redirect.op === ">>",
        parts: [],
        held: 0,
        tooMuch: false,
      };
      if (redirect.op === ">") file.append = false;
      const toFile = (text: string) => {
        file.held += text.length;
        if (file.held > MOST_HELD_CHARS) {
          file.tooMuch = true;
          throw new Error("too much for a redirection here");
        }
        file.parts.push(text);
      };
      if (!streams.files.includes(file)) streams.files.push(file);
      if (redirect.fd === 2) streams.err = toFile;
      else {
        streams.out = toFile;
        streams.toScreen = false;
      }
    }
    return streams;
  }

  /**
   * Words with their patterns replaced by the paths they match. A pattern that matches nothing is
   * said, and answers `null`: as in zsh, nothing of the line runs from there on.
   */
  private async pathsOfPatterns(
    words: readonly string[],
    execution: Execution,
  ): Promise<string[] | null> {
    const paths: string[] = [];
    for (const word of words) {
      if (!hasPattern(word)) {
        paths.push(word);
        continue;
      }
      let matches: string[];
      try {
        matches = await matchingPaths(word, execution.scope.cwd, this.files);
      } catch (error) {
        this.say(execution, `zsh: ${(error as Error).message}\n`);
        execution.abandoned = true;
        return null;
      }
      if (matches.length === 0) {
        this.say(execution, `zsh: no matches found: ${patternText(word)}\n`);
        execution.abandoned = true;
        return null;
      }
      paths.push(...matches);
    }
    return paths;
  }

  /** Writes what a command's redirections held, once it has ended and if it was not stopped. */
  private async closeStreams(
    files: readonly RedirectedFile[],
    execution: Execution,
    control: AbortController,
  ): Promise<void> {
    for (const file of files) {
      if (file.tooMuch) continue;
      if (control.signal.aborted) break;
      try {
        await this.files.writeText(file.path, file.parts.join(""), file.append, control.signal);
      } catch (error) {
        const why = (error as Error).message;
        this.say(execution, `zsh: ${why.charAt(0).toLowerCase()}${why.slice(1)}: ${file.target}\n`);
        execution.scope.status = 1;
      }
    }
  }

  /** The next line of `input`, or of the keyboard: Return ends it, Control-D with nothing ends all. */
  private lineFrom(input: { rest: string } | null, signal: AbortSignal): Promise<string | null> {
    if (input) {
      if (input.rest === "") return Promise.resolve(null);
      const end = input.rest.indexOf("\n");
      const line = end < 0 ? input.rest : input.rest.slice(0, end);
      input.rest = end < 0 ? "" : input.rest.slice(end + 1);
      return Promise.resolve(line);
    }
    return new Promise((resolve, reject) => {
      let line = "";
      const done = (answer: string | null) => {
        this.takeKeyboard(null);
        resolve(answer);
      };
      signal.addEventListener(
        "abort",
        () => {
          this.takeKeyboard(null);
          reject(new Interrupted());
        },
        { once: true },
      );
      this.takeKeyboard((key) => {
        if (key === "\r" || key === "\n") {
          this.emulator.write("\r\n");
          done(line);
        } else if (key === "\x04" && line === "") done(null);
        else if (key === "\x03") this.interrupt();
        else if (key === "\x7f") {
          if (line !== "") this.emulator.write("\b \b");
          line = line.slice(0, -1);
        } else if (key >= " " && !key.startsWith("\x1b")) {
          line += key;
          this.emulator.write(key);
        }
      });
    });
  }

  /**
   * Runs one command, writing to `pipe` or, without one, where `execution` says, unless it redirects
   * them. What goes to a file is written when the command has ended, so one stopped with Control-C, or
   * one that wrote too much, leaves the file as it was. Answers whether the shell ended.
   */
  private async run(
    written: LineCommand,
    piped: string | null,
    pipe: ((text: string) => void) | null,
    execution: Execution,
  ): Promise<boolean> {
    const { scope } = execution;
    const targets = written.redirects.flatMap((redirect) =>
      "target" in redirect ? [redirect.target] : "text" in redirect ? [redirect.text] : [],
    );
    const found = await this.substituted(
      [...written.assignments, ...written.words, ...targets],
      execution,
    );
    if (!found) return false;
    const value = this.valueIn(found, scope);
    if (written.assignments.length > 0) {
      // One at a time, as `A=1 B=$A` reads what the one before set.
      if (!pipe) {
        for (const assignment of written.assignments) {
          const text = patternText(expanded(assignment, value));
          const equals = text.indexOf("=");
          setVariable(scope, text.slice(0, equals), text.slice(equals + 1));
        }
      }
      // `A=$(false)` keeps the substitution's status, as in zsh.
      if (found.size === 0) scope.status = 0;
      return false;
    }
    const words = this.wordsOf(written.words, found, execution);
    if (words.length === 0) {
      if (written.redirects.length > 0) {
        this.say(execution, "zsh: this first version needs a command before a redirection\n");
      }
      scope.status = written.redirects.length > 0 ? 1 : 0;
      return false;
    }
    const redirects = written.redirects.map((redirect): Redirect => {
      if ("target" in redirect) return { ...redirect, target: expanded(redirect.target, value) };
      return "text" in redirect ? { ...redirect, text: expanded(redirect.text, value) } : redirect;
    });
    this.files.refresh();
    const control = new AbortController();
    const outer = this.foreground;
    if (!execution.background) this.foreground = control;
    const stopWith = () => control.abort(new Interrupted());
    execution.signal.addEventListener("abort", stopWith, { once: true });
    const finished = () => {
      execution.signal.removeEventListener("abort", stopWith);
      if (!execution.background) this.foreground = outer;
    };
    if (!execution.background) {
      this.processName = patternText(words[0] as string);
      this.tell();
    }
    const paths = await this.pathsOfPatterns(words, execution);
    if (!paths || control.signal.aborted) {
      scope.status = paths ? 130 : 1;
      finished();
      return false;
    }
    const [name, ...args] = paths as [string, ...string[]];
    if (!execution.background) {
      this.processName = name;
      this.tell();
    }
    const streams = await this.openStreams(redirects, piped, pipe, execution);
    if (control.signal.aborted) {
      scope.status = 130;
      finished();
      return false;
    }
    if (!streams) {
      scope.status = 1;
      finished();
      return false;
    }
    let exitStatus: number | null = null;
    const command = name.includes("/") ? runProgram : commandFor(name);
    const input = streams.stdin === null ? execution.input : { rest: streams.stdin };
    try {
      if (command) {
        scope.status = await command({
          name,
          args,
          session: this,
          scope: pipe ? copiedScope(scope) : scope,
          signal: control.signal,
          stdin: input?.rest ?? null,
          outIsPipe: !streams.toScreen,
          out: streams.out,
          err: streams.err,
          readLine: () => this.lineFrom(input, control.signal),
          background: execution.background,
        });
      } else {
        scope.status = 127;
        streams.err(`zsh: command not found: ${name}\n`);
      }
    } catch (error) {
      if (error instanceof ShellExit) {
        if (pipe) scope.status = error.status;
        else exitStatus = error.status;
      } else if (error instanceof Interrupted) {
        scope.status = 130;
      } else {
        // Not `streams.err`: it may be the very place that has just refused any more.
        this.say(execution, `zsh: ${(error as Error).message}\n`);
        scope.status = 1;
      }
    }
    if (control.signal.aborted) scope.status = 130;
    else {
      await this.closeStreams(streams.files, execution, control);
      if (control.signal.aborted) scope.status = 130;
    }
    finished();
    if (exitStatus === null) return false;
    if (execution.nested) throw new ShellExit(exitStatus);
    this.finish(exitStatus);
    return true;
  }

  /** Runs a script's text for `sh` and `source`: see `ShellSession`. */
  async runScript(
    text: string,
    context: CommandContext,
    options: { name: string; args?: readonly string[]; subshell: boolean },
  ): Promise<number> {
    const parsed = parseScript(text, true);
    if (!("blocks" in parsed)) {
      const why = "problem" in parsed ? parsed.problem : "parse error: the file ends too soon";
      context.err(`${options.name}: ${why.replace(/^zsh: /, "")}\n`);
      return 1;
    }
    const scope = options.subshell ? copiedScope(context.scope) : context.scope;
    const saved = { positional: scope.positional, scriptName: scope.scriptName };
    if (options.args) scope.positional = [...options.args];
    scope.scriptName = options.name;
    try {
      await this.runBlocks(parsed.blocks, {
        scope,
        out: context.outIsPipe ? context.out : null,
        err: context.err,
        input: context.stdin === null ? null : { rest: context.stdin },
        nested: true,
        background: context.background,
        signal: context.signal,
        abandoned: false,
      });
    } catch (error) {
      if (error instanceof ShellExit && options.subshell) return error.status;
      throw error;
    } finally {
      scope.positional = saved.positional;
      scope.scriptName = saved.scriptName;
    }
    return scope.status;
  }

  /** What Tab offers at `cursor` in `line`. */
  private async complete(line: string, cursor: number): Promise<Completion> {
    const before = line.slice(0, cursor);
    let start = before.length;
    while (start > 0) {
      if (/[\s;&|<>]/.test(before[start - 1] as string) && before[start - 2] !== "\\") break;
      start -= 1;
    }
    const typed = before.slice(start).replace(/\\(.)/g, "$1");
    const head = before.slice(0, start);
    if (/(^|(^|[^\\])(;|&&|\|))\s*$/.test(head) && !typed.includes("/")) {
      return {
        start,
        candidates: commandNames()
          .filter((name) => name.startsWith(typed))
          .sort(),
      };
    }
    const slash = typed.lastIndexOf("/");
    const dir = slash >= 0 ? typed.slice(0, slash + 1) : "";
    const prefix = typed.slice(slash + 1);
    // The folders stay as the person typed them: `~/` is not to be escaped into a name.
    const written = before.slice(start);
    const writtenDir = written.slice(0, written.lastIndexOf("/") + 1);
    const foldersOnly = /^\s*cd\s+$/.test(head);
    this.files.refresh();
    const listed = await this.files
      .list(dir === "" ? this.scope.cwd : resolvePath(dir, this.scope.cwd))
      .catch(() => []);
    const candidates = listed
      .filter(({ node }) => node.name.startsWith(prefix))
      .filter(({ node }) => prefix.startsWith(".") || !node.name.startsWith("."))
      .filter(({ node }) => !foldersOnly || node.children !== undefined)
      // A name with a newline in it cannot be typed on one line, so is not offered.
      .filter(({ node }) => !node.name.includes("\n"))
      .map(({ node }) => `${writtenDir}${escapeForShell(node.name)}${node.children ? "/" : ""}`);
    return { start, candidates, closes: (candidate) => !candidate.endsWith("/") };
  }
}
