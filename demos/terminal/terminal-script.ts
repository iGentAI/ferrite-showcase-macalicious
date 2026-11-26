/**
 * The shell's structure above one line: what text holds as statements, here-documents and the
 * `if`, `for`, `while` and `until` around them. It knows nothing of what a command means; a plain
 * line stays whole for `stepsOf`, so a line with a mistake in it is refused before any of it runs.
 */

/** The text of a here-document, and whether its references are read. */
export interface HereDocument {
  body: string;
  expand: boolean;
}

export type Block =
  | { kind: "line"; text: string; documents: HereDocument[] }
  | {
      kind: "if";
      arms: { test: Block[]; body: Block[] }[];
      otherwise: Block[];
      redirects: string;
    }
  | { kind: "for"; name: string; words: string | null; body: Block[]; redirects: string }
  | { kind: "loop"; until: boolean; test: Block[]; body: Block[]; redirects: string };

/** Blocks to run; `more` names the prompt that asks for the next line; `problem` refuses the text. */
export type Parsed = { blocks: Block[] } | { more: string } | { problem: string };

const KEYWORDS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "for",
  "do",
  "done",
  "while",
  "until",
]);
const NOT_HERE = new Set(["case", "esac", "function", "select", "repeat"]);

/** Where the `)` closing the `(` at `open` is, past quotes and inner parentheses, or -1. */
export function closingParen(text: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let at = open; at < text.length; at += 1) {
    const ch = text[at];
    if (ch === "\\" && quote !== "'") at += 1;
    else if (quote) quote = ch === quote ? null : quote;
    else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}

/** Where the quote at `open` closes, past escapes and `$(...)` in a double quote, or -1. */
export function closingQuote(text: string, open: number): number {
  const quote = text[open];
  if (quote === "'") return text.indexOf("'", open + 1);
  for (let at = open + 1; at < text.length; at += 1) {
    const ch = text[at];
    if (ch === "\\") at += 1;
    else if (ch === quote) return at;
    else if (ch === "$" && text[at + 1] === "(") {
      const close = closingParen(text, at + 1);
      if (close < 0) return -1;
      at = close;
    }
  }
  return -1;
}

interface Segment {
  text: string;
  documents: HereDocument[];
}

interface Scanned {
  lines: Segment[][];
  more: string | null;
}

/** The here-document named at `<<` in `text`, or null: its end word and how much it takes. */
function documentAt(text: string, at: number) {
  const found = /^<<(-?)[ \t]*('[^'\n]*'|"[^"\n]*"|[^\s;|&<>()'"]+)/.exec(text.slice(at));
  if (!found) return null;
  const word = found[2] as string;
  const quoted = /^['"]/.test(word);
  return {
    word: quoted ? word.slice(1, -1) : word.replace(/\\/g, ""),
    strip: found[1] === "-",
    expand: !quoted && !word.includes("\\"),
    length: found[0].length,
  };
}

/**
 * Cuts text into physical lines of `;`-separated segments. A quote or a `$(` may run over a line
 * end; a backslash before one joins the lines, as does a line that ends in `|`, `&&` or `||` when
 * another line follows; a line with a here-document takes the lines up to its end word.
 */
function scan(text: string, comments: boolean): Scanned {
  const lines: Segment[][] = [];
  let segments: Segment[] = [];
  let current = "";
  let documents: HereDocument[] = [];
  let waiting: { word: string; strip: boolean; expand: boolean; into: HereDocument[] }[] = [];
  const endSegment = () => {
    segments.push({ text: current, documents });
    current = "";
    documents = [];
  };
  for (let at = 0; at < text.length; at += 1) {
    const ch = text[at] as string;
    if (ch === "\\") {
      if (at + 1 >= text.length) return { lines, more: "" };
      if (text[at + 1] !== "\n") current += text.slice(at, at + 2);
      at += 1;
    } else if (ch === "'" || ch === '"') {
      const close = closingQuote(text, at);
      if (close < 0) return { lines, more: ch === "'" ? "quote" : "dquote" };
      current += text.slice(at, close + 1);
      at = close;
    } else if (ch === "$" && text[at + 1] === "(") {
      const close = closingParen(text, at + 1);
      if (close < 0) return { lines, more: "cmdsubst" };
      current += text.slice(at, close + 1);
      at = close;
    } else if (ch === "#" && comments && (current === "" || /\s$/.test(current))) {
      const end = text.indexOf("\n", at);
      at = (end < 0 ? text.length : end) - 1;
    } else if (ch === "<" && text[at + 1] === "<" && text[at + 2] !== "<") {
      const document = documentAt(text, at);
      if (document) {
        const into: HereDocument[] = documents;
        waiting.push({ ...document, into });
        current += text.slice(at, at + document.length);
        at += document.length - 1;
      } else current += ch;
    } else if (ch === "<" && text.startsWith("<<<", at)) {
      current += "<<<";
      at += 2;
    } else if (ch === ";" && text[at + 1] !== ";" && text[at - 1] !== ";") {
      endSegment();
    } else if (ch === "\n") {
      if (/(\||&&)\s*$/.test(current) && text.slice(at + 1).trim() !== "" && !waiting.length) {
        current += " ";
        continue;
      }
      endSegment();
      lines.push(segments);
      segments = [];
      for (const document of waiting) {
        const kept: string[] = [];
        let closed = false;
        while (at + 1 < text.length) {
          const end = text.indexOf("\n", at + 1);
          const line = text.slice(at + 1, end < 0 ? text.length : end);
          at = end < 0 ? text.length : end;
          const shown = document.strip ? line.replace(/^\t+/, "") : line;
          if (shown === document.word) {
            closed = true;
            break;
          }
          kept.push(shown);
        }
        if (!closed) return { lines, more: "heredoc" };
        document.into.push({
          body: kept.map((line) => `${line}\n`).join(""),
          expand: document.expand,
        });
      }
      waiting = [];
    } else current += ch;
  }
  if (waiting.length > 0) return { lines, more: "heredoc" };
  endSegment();
  lines.push(segments);
  return { lines, more: null };
}

const firstWord = (text: string) => /^\s*([^\s;|&<>()]*)/.exec(text)?.[1] ?? "";

/** Parses text into blocks. `comments` reads `#` as in a script, which a prompt does not. */
export function parseScript(text: string, comments = false): Parsed {
  const { lines, more } = scan(text, comments);
  if (more !== null) return { more };
  const queue: Segment[] = [];
  let opened = 0;
  for (const segments of lines) {
    const compound = segments.some((each) => {
      const word = firstWord(each.text);
      return KEYWORDS.has(word) || NOT_HERE.has(word);
    });
    for (const each of segments) {
      const word = firstWord(each.text);
      if (word === "if" || word === "for" || word === "while" || word === "until") opened += 1;
      if (word === "fi" || word === "done") opened -= 1;
    }
    if (compound || opened > 0) queue.push(...segments);
    else {
      queue.push({
        text: segments.map((each) => each.text).join(";"),
        documents: segments.flatMap((each) => each.documents),
      });
    }
  }
  /** The word that opened what is still being read, for the prompt that asks for more of it. */
  const open: string[] = [];
  class Unfinished extends Error {}
  class Refused extends Error {}

  const next = () => {
    while (queue[0] && queue[0].text.trim() === "" && queue[0].documents.length === 0) {
      queue.shift();
    }
    return queue[0];
  };
  /** Takes the keyword off the front segment, and leaves what follows it to be read as a command. */
  const take = (word: string) => {
    const front = queue[0] as Segment;
    const rest = front.text.trimStart().slice(word.length);
    if (rest.trim() === "") queue.shift();
    else queue[0] = { text: rest, documents: front.documents };
  };
  const expect = (word: string) => {
    const front = next();
    if (!front) throw new Unfinished();
    if (firstWord(front.text) !== word)
      throw new Refused(`zsh: parse error near \`${firstWord(front.text)}'`);
    take(word);
  };
  /** What follows the keyword that closes a block: only redirections may. */
  const closing = (word: string) => {
    const front = next();
    if (!front) throw new Unfinished();
    if (firstWord(front.text) !== word)
      throw new Refused(`zsh: parse error near \`${firstWord(front.text)}'`);
    const rest = front.text.trimStart().slice(word.length).trim();
    queue.shift();
    if (rest !== "" && !/^\d?[<>]/.test(rest))
      throw new Refused(`zsh: parse error near \`${rest}'`);
    return rest;
  };
  const blocksUntil = (stops: ReadonlySet<string>): Block[] => {
    const blocks: Block[] = [];
    for (;;) {
      const front = next();
      if (!front) {
        if (stops.size > 0) throw new Unfinished();
        return blocks;
      }
      const word = firstWord(front.text);
      if (stops.has(word)) return blocks;
      if (NOT_HERE.has(word)) {
        throw new Refused(
          "zsh: this shell has if, for, while and until; case and functions are not here yet",
        );
      }
      if (word === "if") blocks.push(readIf());
      else if (word === "for") blocks.push(readFor());
      else if (word === "while" || word === "until") blocks.push(readLoop(word));
      else if (KEYWORDS.has(word)) throw new Refused(`zsh: parse error near \`${word}'`);
      else {
        queue.shift();
        blocks.push({ kind: "line", text: front.text, documents: front.documents });
      }
    }
  };
  const within = <T>(word: string, read: () => T): T => {
    open.push(word);
    const made = read();
    open.pop();
    return made;
  };
  const readIf = (): Block => {
    take("if");
    const arms: { test: Block[]; body: Block[] }[] = [];
    let otherwise: Block[] = [];
    const arm = () => {
      const test = within("if", () => blocksUntil(new Set(["then"])));
      expect("then");
      const body = within("then", () => blocksUntil(new Set(["elif", "else", "fi"])));
      arms.push({ test, body });
    };
    arm();
    while (firstWord(next()?.text ?? "") === "elif") {
      take("elif");
      arm();
    }
    if (firstWord(next()?.text ?? "") === "else") {
      take("else");
      otherwise = within("else", () => blocksUntil(new Set(["fi"])));
    }
    open.push("if");
    const redirects = closing("fi");
    open.pop();
    return { kind: "if", arms, otherwise, redirects };
  };
  const body = (word: string) => {
    const made = within(word, () => {
      expect("do");
      return blocksUntil(new Set(["done"]));
    });
    open.push(word);
    const redirects = closing("done");
    open.pop();
    return { body: made, redirects };
  };
  const readFor = (): Block => {
    const front = queue[0] as Segment;
    const found = /^\s*for\s+([A-Za-z_]\w*)(?:\s+in(?:\s+(.*))?)?\s*$/s.exec(front.text);
    if (!found) throw new Refused("zsh: parse error near `for'");
    queue.shift();
    const hasIn = /\s+in(\s|$)/.test(front.text);
    open.push("for");
    if (!next()) throw new Unfinished();
    open.pop();
    return {
      kind: "for",
      name: found[1] as string,
      words: hasIn ? (found[2] ?? "") : null,
      ...body("for"),
    };
  };
  const readLoop = (word: "while" | "until"): Block => {
    take(word);
    const test = within(word, () => blocksUntil(new Set(["do"])));
    return { kind: "loop", until: word === "until", test, ...body(word) };
  };
  try {
    return { blocks: blocksUntil(new Set()) };
  } catch (error) {
    if (error instanceof Unfinished) return { more: open.at(-1) ?? "" };
    if (error instanceof Refused) return { problem: error.message };
    throw error;
  }
}

/** `text` with its aliases in place at the head of each command. */
export function withAliases(text: string, aliases: ReadonlyMap<string, string>): string {
  if (aliases.size === 0) return text;
  const expandedAt = (word: string, seen: ReadonlySet<string>): string => {
    const value = aliases.get(word);
    if (value === undefined || seen.has(word)) return word;
    const head = firstWord(value);
    return `${expandedAt(head, new Set([...seen, word]))}${value.slice(value.indexOf(head) + head.length)}`;
  };
  let out = "";
  let atCommand = true;
  for (let at = 0; at < text.length; ) {
    const ch = text[at] as string;
    if (atCommand && /\s/.test(ch)) {
      out += ch;
      at += 1;
    } else if (atCommand) {
      const word = /^[^\s;|&<>()'"\\$`=]+/.exec(text.slice(at))?.[0] ?? "";
      const after = text[at + word.length];
      if (word !== "" && after !== "=" && after !== "'" && after !== '"' && after !== "\\") {
        out += expandedAt(word, new Set());
        at += word.length;
      }
      atCommand = false;
    } else if (ch === "\\") {
      out += text.slice(at, at + 2);
      at += 2;
    } else if (ch === "'" || ch === '"') {
      const close = closingQuote(text, at);
      const end = close < 0 ? text.length : close + 1;
      out += text.slice(at, end);
      at = end;
    } else if (ch === "$" && text[at + 1] === "(") {
      const close = closingParen(text, at + 1);
      const end = close < 0 ? text.length : close + 1;
      out += text.slice(at, end);
      at = end;
    } else {
      if (ch === ";" || ch === "|" || ch === "&") atCommand = true;
      out += ch;
      at += 1;
    }
  }
  return out;
}

/**
 * The value of `$((...))`: integers with `+ - * / %`, the comparisons, `&&`, `||`, `!`, parentheses
 * and names, a name reading as its variable's number. Throws on what it cannot read.
 */
export function arithmetic(source: string, value: (name: string) => string): number {
  const tokens =
    source.match(/\d+|[A-Za-z_]\w*|\$[A-Za-z_]\w*|&&|\|\||==|!=|<=|>=|[-+*/%()<>!]|\S/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const fail = (): never => {
    throw new Error(`bad math expression: ${source}`);
  };
  const primary = (): number => {
    const token = tokens[at];
    at += 1;
    if (token === undefined) return fail();
    if (token === "(") {
      const inner = or();
      if (tokens[at] !== ")") return fail();
      at += 1;
      return inner;
    }
    if (token === "-") return -primary();
    if (token === "+") return primary();
    if (token === "!") return primary() === 0 ? 1 : 0;
    if (/^\d+$/.test(token)) return Number(token);
    if (/^\$?[A-Za-z_]/.test(token)) {
      const number = Number(value(token.replace(/^\$/, "")) || "0");
      return Number.isFinite(number) ? Math.trunc(number) : 0;
    }
    return fail();
  };
  const level = (
    operators: Record<string, (a: number, b: number) => number>,
    below: () => number,
  ) => {
    return (): number => {
      let left = below();
      for (
        let operator = peek();
        operator && Object.hasOwn(operators, operator);
        operator = peek()
      ) {
        at += 1;
        left = (operators[operator] as (a: number, b: number) => number)(left, below());
      }
      return left;
    };
  };
  const divide = (a: number, b: number) => {
    if (b === 0) throw new Error("division by zero");
    return Math.trunc(a / b);
  };
  const remainder = (a: number, b: number) => {
    if (b === 0) throw new Error("division by zero");
    return a % b;
  };
  const times = level({ "*": (a, b) => a * b, "/": divide, "%": remainder }, primary);
  const plus = level({ "+": (a, b) => a + b, "-": (a, b) => a - b }, times);
  const compare = level(
    {
      "<": (a, b) => Number(a < b),
      "<=": (a, b) => Number(a <= b),
      ">": (a, b) => Number(a > b),
      ">=": (a, b) => Number(a >= b),
    },
    plus,
  );
  const equal = level(
    { "==": (a, b) => Number(a === b), "!=": (a, b) => Number(a !== b) },
    compare,
  );
  const and = level({ "&&": (a, b) => Number(a !== 0 && b !== 0) }, equal);
  const or: () => number = level({ "||": (a, b) => Number(a !== 0 || b !== 0) }, and);
  const made = or();
  if (at < tokens.length) fail();
  return made;
}
