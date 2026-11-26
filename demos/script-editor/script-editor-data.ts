/*
 * The script of the demo and what the demo does with a script: colour it, indent it, check
 * its blocks and work out the result of its simplest statements. None of this is AppleScript:
 * it is enough of the language's surface for the editor to behave like one.
 */

/** How a piece of a line is set, after AppleScript's formatting styles. */
export type ScriptStyle =
  /** Language keywords: bold. */
  | "keyword"
  /** Commands of an application or of the language: bold, in the term colour. */
  | "command"
  /** Classes: italic, in the term colour. */
  | "class"
  /** Parameter labels of a command: the term colour. */
  | "parameter"
  /** Variables and handler names. */
  | "variable"
  /** AppleScript's strings and numbers. */
  | "literal"
  /** JavaScript's strings. */
  | "string"
  /** JavaScript's numbers. */
  | "number"
  /** JavaScript's regular expressions. */
  | "pattern"
  /** JavaScript's template strings, whatever their substitutions hold. */
  | "template"
  | "comment"
  /** Operators, punctuation and white space. */
  | "plain";

/** A run of a line in one style. */
export interface ScriptRun {
  text: string;
  style: ScriptStyle;
}

/** The languages of the navigation bar's first pop-up button. */
export const LANGUAGES = ["AppleScript", "JavaScript"] as const;
export type ScriptLanguage = (typeof LANGUAGES)[number];

/**
 * The script of the reference screenshots: Script Editor's template for a Mail rule action,
 * as far as the captures show it. The lines after "PROCESS IMAGE ATTACHMENTS", which no
 * capture shows, are written for the demo and close the blocks. A tab is one level.
 */
export const defaultSource = [
  'using terms from application "Mail"',
  "\ton perform mail action with messages these_messages for rule this_rule",
  '\t\ttell application "Mail"',
  "\t\t\tset the message_count to the count of these_messages",
  "\t\t\trepeat with i from 1 to the message_count",
  "\t\t\t\tset this_message to item i of these_messages",
  "",
  "\t\t\t\t(*EXAMPLE: getting values of some properties of the message",
  "\t\t\t\t-- GET THE SENDER OF THIS MESSAGE",
  "\t\t\t\tset this_sender to the sender of this_message",
  "\t\t\t\t-- GET SUBJECT OF MESSAGE",
  "\t\t\t\ttry",
  "\t\t\t\t\tset this_subject to (subject of this_message) as Unicode text",
  '\t\t\t\t\tif this_subject is "" then error',
  "\t\t\t\ton error",
  '\t\t\t\t\tset this_subject to "NO SUBJECT"',
  "\t\t\t\tend try",
  "\t\t\t\t-- GET CONTENT OF MESSAGE",
  "\t\t\t\ttry",
  "\t\t\t\t\tset this_content to (every character of content of this_message) as Unicode text",
  '\t\t\t\t\tif this_content is in {"", "?"} then error',
  "\t\t\t\ton error error_message",
  '\t\t\t\t\tset this_content to "NO CONTENT"',
  "\t\t\t\tend try",
  "\t\t\t\t*)",
  "",
  "\t\t\t\t(* EXAMPLE: save images attached to the message, to the pictures folder",
  "\t\t\t\t-- PROCESS IMAGE ATTACHMENTS",
  "\t\t\t\tset the picture_count to 0",
  "\t\t\t\trepeat with this_attachment in the mail attachments of this_message",
  "\t\t\t\t\tset the picture_count to the picture_count + 1",
  "\t\t\t\tend repeat",
  "\t\t\t\t*)",
  "\t\t\tend repeat",
  "\t\tend tell",
  "\tend perform mail action with messages",
  "end using terms from",
].join("\n");

/** A script that has a result, for the examples and the tests. */
export const sampleSource = [
  "-- A script with a result",
  'set greeting to "Hello"',
  "set answer to 6 * 7",
  "log answer",
  'return greeting & ", " & answer',
].join("\n");

const KEYWORDS = [
  "using terms from",
  "about",
  "above",
  "after",
  "against",
  "and",
  "as",
  "at",
  "before",
  "but",
  "by",
  "considering",
  "contains",
  "copy",
  "div",
  "does",
  "else",
  "end",
  "error",
  "every",
  "exit",
  "false",
  "first",
  "for",
  "from",
  "get",
  "global",
  "if",
  "ignoring",
  "in",
  "into",
  "is",
  "it",
  "its",
  "last",
  "local",
  "me",
  "mod",
  "my",
  "not",
  "of",
  "on",
  "or",
  "property",
  "repeat",
  "return",
  "script",
  "set",
  "some",
  "tell",
  "that",
  "the",
  "then",
  "through",
  "thru",
  "timeout",
  "times",
  "to",
  "transaction",
  "true",
  "try",
  "until",
  "where",
  "while",
  "whose",
  "with",
  "without",
];

const COMMANDS = [
  "perform mail action with messages",
  "display notification",
  "display dialog",
  "current date",
  "activate",
  "count",
  "delay",
  "beep",
  "log",
  "say",
];

const PARAMETERS = ["for rule", "with title", "giving up after", "default button", "buttons"];

const CLASSES = [
  "Unicode text",
  "application",
  "character",
  "boolean",
  "integer",
  "message",
  "number",
  "record",
  "string",
  "date",
  "item",
  "list",
  "real",
  "text",
  "word",
];

// Every term with its style, the longest first, so that "perform mail action with messages"
// is found before "with" and "for rule" before "for".
const TERMS: readonly [RegExp, ScriptStyle][] = (
  [
    [COMMANDS, "command"],
    [PARAMETERS, "parameter"],
    [CLASSES, "class"],
    [KEYWORDS, "keyword"],
  ] as const
)
  .flatMap(([terms, style]) => terms.map((term) => [term, style] as const))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([term, style]) => [
    new RegExp(`^${term.replaceAll(" ", " +")}(?![A-Za-z0-9_])`, "i"),
    style,
  ]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/;
const NUMBER = /^\d+(\.\d+)?/;
const STRING = /^"(?:[^"\\]|\\.)*"?/;

/** What a line leaves open for the next one: a block comment. */
export interface ScriptLineState {
  comment: boolean;
}

/**
 * A line as runs of one style each. `state` carries a block comment from line to line and is
 * changed in place. Joined, the runs are the line.
 */
export function styleLine(line: string, state: ScriptLineState): ScriptRun[] {
  const runs: ScriptRun[] = [];
  const push = (text: string, style: ScriptStyle) => {
    if (text === "") return;
    const last = runs[runs.length - 1];
    if (last && last.style === style) last.text += text;
    else runs.push({ text, style });
  };
  let rest = line;
  const take = (length: number, style: ScriptStyle) => {
    push(rest.slice(0, length), style);
    rest = rest.slice(length);
  };
  // Whether the character before `rest` could be part of a word: a term starts a word.
  let inWord = false;
  while (rest !== "") {
    if (state.comment) {
      const end = rest.indexOf("*)");
      if (end < 0) take(rest.length, "comment");
      else {
        take(end + 2, "comment");
        state.comment = false;
      }
      inWord = false;
      continue;
    }
    if (rest.startsWith("(*")) {
      state.comment = true;
      continue;
    }
    if (rest.startsWith("--") || rest.startsWith("#")) {
      take(rest.length, "comment");
      continue;
    }
    const string = STRING.exec(rest);
    if (string) {
      take(string[0].length, "literal");
      inWord = false;
      continue;
    }
    if (!inWord) {
      const term = TERMS.find(([pattern]) => pattern.test(rest));
      if (term) {
        take(term[0].exec(rest)?.[0].length ?? 0, term[1]);
        inWord = true;
        continue;
      }
      const number = NUMBER.exec(rest);
      if (number) {
        take(number[0].length, "literal");
        inWord = true;
        continue;
      }
      const identifier = IDENTIFIER.exec(rest);
      if (identifier) {
        take(identifier[0].length, "variable");
        inWord = true;
        continue;
      }
    }
    inWord = /[A-Za-z0-9_]/.test(rest[0] as string);
    take(1, "plain");
  }
  return runs;
}

/** The words of JavaScript that are set as keywords. */
const JS_KEYWORDS =
  /^(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield)$/;
/** A word after which a slash divides rather than starts a regular expression. */
const JS_VALUES = /^(?:false|null|super|this|true|undefined)$/;

/** What a line of JavaScript leaves open for the next, and whether a slash may start a pattern. */
interface JavaScriptLineState {
  open: "comment" | "template" | "'" | '"' | null;
  patternMayStart: boolean;
  /** Whether the next parenthesis opens a condition, and for each one open, whether it does. */
  conditionNext: boolean;
  brackets: boolean[];
  /** For each brace open, whether it holds a block; and the code just read. */
  blocks: boolean[];
  last: string;
}

/** Where the unescaped closer is in a line from an offset, or -1. */
function closerAt(line: string, from: number, closer: string): number {
  for (let at = from; at < line.length; at += 1) {
    if (line[at] === "\\") at += 1;
    else if (line[at] === closer) return at;
  }
  return -1;
}

/** Where a regular expression that starts at a slash ends, flags included, or -1. */
function patternEnd(line: string, start: number): number {
  let inClass = false;
  for (let at = start + 1; at < line.length; at += 1) {
    const character = line[at];
    if (character === "\\") at += 1;
    else if (character === "[") inClass = true;
    else if (character === "]") inClass = false;
    else if (character === "/" && !inClass) {
      return at + 1 + (/^[a-z]*/.exec(line.slice(at + 1))?.[0].length ?? 0);
    }
  }
  return -1;
}

/**
 * A line of JavaScript as styled runs. Comments, strings, template strings and regular expressions
 * are told from code, across lines where they run on. What a template string holds in its
 * substitutions counts as its text.
 */
function styleJavaScriptLine(line: string, state: JavaScriptLineState) {
  const runs: ScriptRun[] = [];
  const add = (text: string, style: ScriptStyle) => {
    if (text === "") return;
    const last = runs.at(-1);
    if (last?.style === style) last.text += text;
    else runs.push({ text, style });
  };
  let at = 0;
  while (at < line.length) {
    if (state.open === "comment") {
      const end = line.indexOf("*/", at);
      add(line.slice(at, end < 0 ? line.length : end + 2), "comment");
      at = end < 0 ? line.length : end + 2;
      if (end >= 0) state.open = null;
      continue;
    }
    if (state.open) {
      const closer = state.open === "template" ? "`" : state.open;
      const end = closerAt(line, at, closer);
      add(
        line.slice(at, end < 0 ? line.length : end + 1),
        state.open === "template" ? "template" : "string",
      );
      at = end < 0 ? line.length : end + 1;
      if (end >= 0) {
        state.open = null;
        state.patternMayStart = false;
        state.last = "value";
      }
      continue;
    }
    const character = line[at] as string;
    const rest = line.slice(at);
    if (rest.startsWith("//")) {
      add(rest, "comment");
      break;
    }
    if (rest.startsWith("/*")) {
      add("/*", "comment");
      at += 2;
      state.open = "comment";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      add(character, character === "`" ? "template" : "string");
      at += 1;
      state.open = character === "`" ? "template" : character;
      continue;
    }
    const pattern = character === "/" && state.patternMayStart ? patternEnd(line, at) : -1;
    if (pattern > 0) {
      add(line.slice(at, pattern), "pattern");
      at = pattern;
      state.patternMayStart = false;
      state.last = "value";
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest)?.[0];
    if (word) {
      const keyword = JS_KEYWORDS.test(word);
      add(word, keyword ? "keyword" : "plain");
      at += word.length;
      state.patternMayStart = keyword && !JS_VALUES.test(word);
      state.conditionNext =
        /^(?:if|while|for|with)$/.test(word) || (word === "await" && state.conditionNext);
      state.last = word;
      continue;
    }
    const number = /^\d[\w.]*/.exec(rest)?.[0];
    if (number) {
      add(number, "number");
      at += number.length;
      state.patternMayStart = false;
      state.last = "value";
      continue;
    }
    const others = /^[^A-Za-z_$\d"'`/]+|^\//.exec(rest)?.[0] ?? character;
    add(others, "plain");
    at += others.length;
    for (const mark of others) {
      if (mark.trim() === "") continue;
      if (mark === "{") {
        // A brace that starts a statement holds a block: a pattern may follow it, not a division.
        state.blocks.push(/^(?:|[);{}>]|else|try|finally|do)$/.test(state.last));
        state.patternMayStart = true;
      } else if (mark === "}") {
        state.patternMayStart = state.blocks.pop() === true;
      } else if (mark === "(") {
        state.brackets.push(state.conditionNext);
        state.patternMayStart = true;
      } else if (mark === ")") {
        // After the condition of `if` or `while` a statement starts; after a value, a slash divides.
        state.patternMayStart = state.brackets.pop() === true;
      } else state.patternMayStart = mark !== "]";
      state.conditionNext = false;
      state.last = mark;
    }
  }
  // A string that is not continued with a backslash ends with its line, which may end in CR LF.
  if ((state.open === "'" || state.open === '"') && !/\\\r?$/.test(line)) state.open = null;
  return runs;
}

/** A script as lines of styled runs, in the styles of its language. */
export function styleScript(
  source: string,
  language: ScriptLanguage = "AppleScript",
): ScriptRun[][] {
  const state: ScriptLineState = { comment: false };
  const javaScript: JavaScriptLineState = {
    open: null,
    patternMayStart: true,
    conditionNext: false,
    brackets: [],
    blocks: [],
    last: "",
  };
  return source
    .split("\n")
    .map((line) =>
      language === "AppleScript" ? styleLine(line, state) : styleJavaScriptLine(line, javaScript),
    );
}

/** The code of a line: its text without comments and strings, trimmed and in lower case. */
function codeOf(runs: readonly ScriptRun[]): string {
  return runs
    .map((run) => (run.style === "comment" ? " " : run.style === "literal" ? "0" : run.text))
    .join("")
    .trim()
    .toLowerCase();
}

/**
 * A line as it is written, without its comments. A comment separates what is on either side
 * of it, as white space does, so it leaves a space: `return(* note *)42` is `return 42`.
 */
export function writtenOf(runs: readonly ScriptRun[]): string {
  return runs
    .map((run) => (run.style === "comment" ? " " : run.text))
    .join("")
    .trim();
}

const OPENERS =
  /^(tell|repeat|try|if|on|to|using terms from|considering|ignoring|with timeout|with transaction|script)\b/;

/** A block that is open: what its `end` may be followed by. */
interface Block {
  /** The word or words after `end`; for a handler, its line after `on` or `to`. */
  name: string;
  /** Whether the block is a handler, which its name ends: `on run` and `end run`. */
  handler: boolean;
}

/** The block a line of code opens, which a later `end` closes; null when it opens none. */
function opener(code: string): Block | null {
  const word = OPENERS.exec(code)?.[1];
  if (!word || /^on error\b/.test(code)) return null;
  // "tell x to y" and "if x then y" are whole statements.
  if (word === "tell" && /\sto\s/.test(code)) return null;
  if (word === "if" && !/\bthen$/.test(code)) return null;
  if (word === "on" || word === "to")
    return { name: code.replace(/^\S+\s*/, "").replace(/\s+/g, " "), handler: true };
  // "with timeout" is ended by "end timeout", "with transaction" by "end transaction".
  return { name: word.replace(/^with /, ""), handler: false };
}

/** What `end` is followed by when it closes a block in full. */
const endOf = (block: Block): string =>
  block.handler ? (/^[a-z0-9_]+/.exec(block.name)?.[0] ?? "") : block.name;

/**
 * Whether `end` followed by `rest` closes a block: a bare `end` closes any, a block's own
 * word closes it, and a handler is closed by its name, or by as many of its words as are
 * written: `end perform mail action with messages`.
 */
function closes(block: Block, rest: string): boolean {
  if (rest === "") return true;
  if (!block.handler) return rest === block.name;
  return block.name.startsWith(rest) && !/^[a-z0-9_]/.test(block.name.slice(rest.length));
}

/**
 * The handlers a script defines, for the navigation bar's second pop-up button: in JavaScript, the
 * functions declared at the start of a line.
 */
export function handlersOf(
  source: string,
  language: ScriptLanguage = "AppleScript",
): { name: string; line: number }[] {
  if (language === "JavaScript") {
    return source.split("\n").flatMap((line, index) => {
      const name = /^\s*(?:async\s+)?function\s*\*?\s*([\w$]+)/.exec(line)?.[1];
      return name ? [{ name, line: index }] : [];
    });
  }
  const state: ScriptLineState = { comment: false };
  const handlers: { name: string; line: number }[] = [];
  source.split("\n").forEach((line, index) => {
    const commented = state.comment;
    const runs = styleLine(line, state);
    const code = codeOf(runs);
    // A line inside a comment has no code, unless the comment closes on it and code follows.
    if (commented && code === "") return;
    if (!/^(?:on|to)\s+(.+)$/.test(code) || /^on error\b/.test(code)) return;
    // The name as it is written: the line's code after the first word.
    handlers.push({ name: writtenOf(runs).replace(/^\S+\s+/, ""), line: index });
  });
  return handlers;
}

/** What compiling gives: the script indented by its blocks, or what is wrong with it. */
export type CompileResult = { ok: true; source: string } | { ok: false; error: string };

const tabsOf = (line: string) => /^\t*/.exec(line)?.[0].length ?? 0;

/**
 * Checks that a JavaScript script parses, as the body of the function the server runs it in. It is
 * only parsed here, never run. A page whose policy keeps the browser from parsing text leaves the
 * check to the run.
 */
function checkJavaScript(source: string): CompileResult {
  const AsyncFunction = (async () => {}).constructor as new (body: string) => unknown;
  try {
    new AsyncFunction(source);
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, error: `Syntax Error: ${error.message}` };
  }
  return { ok: true, source };
}

/**
 * Checks that the script's blocks, comments and strings are closed, each block by an `end`
 * of its own kind, and indents every line
 * by the blocks around it, one tab a level, as Script Editor does when it compiles. The lines
 * of a block comment keep their indentation relative to the comment's first line. JavaScript is
 * checked and returned as it is.
 */
export function compile(source: string, language: ScriptLanguage = "AppleScript"): CompileResult {
  if (language !== "AppleScript") return checkJavaScript(source);
  const state: ScriptLineState = { comment: false };
  const out: string[] = [];
  // The blocks that are open, the innermost last.
  const blocks: Block[] = [];
  // The indentation of the line that began the open comment: as written, and as printed.
  let commentWritten = 0;
  let commentPrinted = 0;
  for (const raw of source.split("\n")) {
    const line = raw.replace(/^[ \t]+|[ \t]+$/g, "");
    const commented = state.comment;
    const runs = styleLine(line, state);
    if (line === "") {
      out.push("");
      continue;
    }
    const code = codeOf(runs);
    // A line inside a comment keeps its place in it, unless the comment closes on the line
    // and code follows: that line is a statement like any other.
    if (commented && code === "") {
      const relative = Math.max(0, tabsOf(raw) - commentWritten);
      out.push("\t".repeat(commentPrinted + relative) + line);
      continue;
    }
    if (runs.some((run) => run.style === "literal" && /^"(?:[^"\\]|\\.)*$/.test(run.text)))
      return { ok: false, error: 'Syntax Error: Expected “"” but found end of line.' };
    let printed = blocks.length;
    const opened = opener(code);
    if (/^end\b/.test(code)) {
      const block = blocks.pop();
      if (!block)
        return { ok: false, error: "Syntax Error: Expected end of line, etc. but found “end”." };
      const rest = code.replace(/^end\s*/, "").replace(/\s+/g, " ");
      if (!closes(block, rest))
        return {
          ok: false,
          error: `Syntax Error: Expected “end ${endOf(block)}” but found “end ${rest}”.`,
        };
      printed = blocks.length;
    } else if (/^(on error|else)\b/.test(code)) printed = Math.max(0, blocks.length - 1);
    else if (opened) blocks.push(opened);
    out.push("\t".repeat(printed) + line);
    if (state.comment) {
      commentWritten = tabsOf(raw);
      commentPrinted = printed;
    }
  }
  if (state.comment)
    return { ok: false, error: "Syntax Error: Expected “*)” but found end of script." };
  if (blocks.length > 0)
    return { ok: false, error: "Syntax Error: Expected “end” but found end of script." };
  return { ok: true, source: out.join("\n") };
}

/** The most lines `errorLine` looks through: it compiles the script once for each line it passes. */
const MOST_ERROR_LINES = 3000;

/**
 * The line, from 0, where compiling `source` first gives `error`: the shortest run of its first lines
 * that gives the same error. An engine's parser says what is wrong and not where, so this finds the
 * place from the parser's answers. A block never closed is reported at the line that opens it.
 */
export function errorLine(source: string, language: ScriptLanguage, error: string): number | null {
  const lines = source.split("\n");
  for (let last = 0; last < Math.min(lines.length, MOST_ERROR_LINES); last += 1) {
    const compiled = compile(lines.slice(0, last + 1).join("\n"), language);
    if (!compiled.ok && compiled.error === error) return last;
  }
  return null;
}

/** What running gives: the result as Script Editor writes it, and what the script logged. */
export interface RunResult {
  /** The result, `""` when the script has none, or the error. */
  result: string;
  /** Whether `result` is an error. */
  failed: boolean;
  /** The lines for the log. */
  log: string[];
}

type Value = string | number | boolean;

// A string is written as its literal: its quotes and backslashes escaped, as in the script.
const write = (value: Value): string =>
  typeof value === "string" ? `"${value.replace(/[\\"]/g, "\\$&")}"` : String(value);
const text = (value: Value): string => (typeof value === "string" ? value : String(value));

/** The value of an expression of numbers, strings, variables, `+ - * / &` and brackets. */
function evaluate(expression: string, variables: Map<string, Value>): Value {
  const TOKEN = /"(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/&()]/g;
  const tokens = expression.match(TOKEN) ?? [];
  // Whatever is left between the tokens must be white space.
  if (expression.replace(TOKEN, "").trim() !== "")
    throw new Error("Can’t make sense of this expression.");
  let at = 0;
  const number = (value: Value): number => {
    const made = typeof value === "number" ? value : Number(value);
    if (typeof value === "boolean" || Number.isNaN(made))
      throw new Error(`Can’t make ${write(value)} into type number.`);
    return made;
  };
  const primary = (): Value => {
    const token = tokens[at++];
    if (token === undefined) throw new Error("Expected expression but found end of script.");
    if (token === "(") {
      const value = concatenation();
      if (tokens[at++] !== ")") throw new Error("Expected “)”.");
      return value;
    }
    if (token === "-") return -number(primary());
    if (token.startsWith('"')) return token.slice(1, -1).replace(/\\(.)/g, "$1");
    if (/^\d/.test(token)) return Number(token);
    const word = token.toLowerCase();
    if (word === "true" || word === "false") return word === "true";
    if (/^[A-Za-z_]/.test(token)) {
      const value = variables.get(word);
      if (value === undefined) throw new Error(`The variable ${token} is not defined.`);
      return value;
    }
    throw new Error(`Expected expression but found “${token}”.`);
  };
  const product = (): Value => {
    let value = primary();
    while (tokens[at] === "*" || tokens[at] === "/") {
      const operator = tokens[at++];
      const other = number(primary());
      if (operator === "/" && other === 0) throw new Error("Can’t divide by zero.");
      value = operator === "*" ? number(value) * other : number(value) / other;
    }
    return value;
  };
  const sum = (): Value => {
    let value = product();
    while (tokens[at] === "+" || tokens[at] === "-") {
      const operator = tokens[at++];
      const other = number(product());
      value = operator === "+" ? number(value) + other : number(value) - other;
    }
    return value;
  };
  function concatenation(): Value {
    let value = sum();
    while (tokens[at] === "&") {
      at += 1;
      value = text(value) + text(sum());
    }
    return value;
  }
  const value = concatenation();
  if (at < tokens.length) throw new Error(`Expected end of line but found “${tokens[at]}”.`);
  return value;
}

/**
 * "Runs" a compiled script: the statements at the top level that set a variable, log, return
 * or are an expression are worked out, in order, and the last value is the result. Blocks,
 * and so handlers and everything addressed to an application, are passed over: a page has no
 * applications to tell. An error stops the run and is the result.
 */
export function run(source: string): RunResult {
  const state: ScriptLineState = { comment: false };
  const variables = new Map<string, Value>();
  const log: string[] = [];
  let result = "";
  let depth = 0;
  try {
    for (const raw of source.split("\n")) {
      const runs = styleLine(raw.trim(), state);
      // What is left of a line without its comments; nothing, inside a block comment.
      const code = codeOf(runs);
      if (code === "") continue;
      if (/^end\b/.test(code)) {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (opener(code)) {
        depth += 1;
        continue;
      }
      if (depth > 0) continue;
      // The statement as written, without its comments.
      const statement = writtenOf(runs);
      const set = /^set\s+(?:the\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+to\s+(.+)$/i.exec(statement);
      const returned = /^return(?:\s+(.+))?$/i.exec(statement);
      const logged = /^log\s+(.+)$/i.exec(statement);
      const dialog = /^display dialog\s+(.+)$/i.exec(statement);
      if (set) {
        const value = evaluate(set[2] as string, variables);
        variables.set((set[1] as string).toLowerCase(), value);
        result = write(value);
      } else if (returned) {
        result = returned[1] ? write(evaluate(returned[1], variables)) : "";
        break;
      } else if (logged) log.push(`(*${text(evaluate(logged[1] as string, variables))}*)`);
      else if (dialog) {
        log.push(`display dialog ${write(evaluate(dialog[1] as string, variables))}`);
        result = '{button returned:"OK"}';
      } else if (/^(say|beep|delay|activate)\b/i.test(statement)) result = "";
      else result = write(evaluate(statement, variables));
    }
  } catch (error) {
    return { result: `Error: ${(error as Error).message}`, failed: true, log };
  }
  return { result, failed: false, log };
}
