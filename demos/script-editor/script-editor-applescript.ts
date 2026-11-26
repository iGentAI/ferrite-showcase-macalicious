import { type ScriptLineState, styleLine, writtenOf } from "./script-editor-data";

/*
 * The subset of AppleScript that reaches the person's apps. A script with a `tell application` block
 * becomes the JavaScript the server runs, over the same actions a JavaScript script calls. Whatever
 * is not in the subset stops the translation with an error naming its line, so nothing runs in part.
 */

/** What translating gives: the JavaScript to run, or what stopped it and on which line (from 0). */
export type Translation = { ok: true; code: string } | { ok: false; error: string; line: number };

class Stop extends Error {}

/** The object a script calls for each application it can tell. */
const APPS: Readonly<Record<string, string>> = {
  notes: "Notes",
  reminders: "Reminders",
  calendar: "Calendar",
  contacts: "Contacts",
  stickies: "Stickies",
  messages: "Messages",
  finder: "Files",
  "system events": "Appearance",
};

/** What `make new <class>` calls in each application, and the properties it takes. */
const MAKERS: Readonly<
  Record<string, { kind: RegExp; call: string; properties: Readonly<Record<string, string>> }>
> = {
  Notes: {
    kind: /^note$/i,
    call: "Notes.make",
    properties: { name: "title", body: "text", title: "title", text: "text" },
  },
  Reminders: { kind: /^reminder$/i, call: "Reminders.add", properties: { name: "title" } },
  Calendar: {
    kind: /^event$/i,
    call: "Calendar.add",
    properties: { summary: "title", title: "title" },
  },
  Stickies: {
    kind: /^(note|sticky)$/i,
    call: "Stickies.add",
    properties: { text: "text", color: "color", colour: "color" },
  },
};

/** What `every <class>` lists in each application. */
const LISTS: Readonly<Record<string, { kind: RegExp; call: string }>> = {
  Notes: { kind: /^notes?$/i, call: "Notes.list()" },
  Reminders: { kind: /^reminders?$/i, call: "Reminders.list()" },
  Calendar: { kind: /^events?$/i, call: "Calendar.events()" },
  Contacts: { kind: /^(person|people)$/i, call: "Contacts.find()" },
  Stickies: { kind: /^(notes?|stick(y|ies))$/i, call: "Stickies.list()" },
};

const TOKEN =
  /\s*("(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|≠|≤|≥|<=|>=|[&+\-*/()<>=,{}:])/y;

function tokensOf(text: string): string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    if (text.slice(TOKEN.lastIndex).trim() === "") break;
    const found = TOKEN.exec(text);
    if (!found) throw new Stop(`Expected an expression but found “${text.trim()}”.`);
    tokens.push(found[1] as string);
  }
  return tokens;
}

const stringOf = (token: string) =>
  JSON.stringify(token.slice(1, -1).replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c)));

const variable = (name: string) => `v_${name.toLowerCase()}`;

const COMPARISONS: readonly (readonly [RegExp, string])[] = [
  [/\bis not\b|≠/i, "!=="],
  [/\bis greater than or equal to\b|≥|>=/i, ">="],
  [/\bis less than or equal to\b|≤|<=/i, "<="],
  [/\bis greater than\b|>/i, ">"],
  [/\bis less than\b|</i, "<"],
  [/\bis\b|=/i, "==="],
];

/** One translation: the variables set so far and the applications being told. */
class Translator {
  private readonly variables = new Set<string>();
  private readonly told: { object: string; name: string }[] = [];
  private readonly blocks: string[] = [];
  private readonly out: string[] = [];

  private get app() {
    return this.told.at(-1)?.object;
  }

  /** An expression of values and variables, with `&` as `+`. */
  private value(text: string): string {
    const query = this.query(text.trim());
    if (query) return query;
    return tokensOf(text)
      .map((token) => {
        if (token.startsWith('"')) return stringOf(token);
        if (/^\d/.test(token) || "+-*/(),".includes(token)) return token;
        if (token === "&") return "+";
        if (token === "{") return "[";
        if (token === "}") return "]";
        const lower = token.toLowerCase();
        if (lower === "true" || lower === "false") return lower;
        if (this.variables.has(lower)) return variable(lower);
        throw new Stop(`The variable “${token}” is not defined.`);
      })
      .join(" ");
  }

  /** `every note`, `name of every note`, `count of notes` and the like, in the application told. */
  private query(text: string): string | null {
    const asked = text.replace(/^get\s+/i, "");
    const counted = /^(?:count(?:\s+of)?|number of)\s+(.+)$/i.exec(asked);
    const listed = this.list((counted?.[1] ?? asked).trim());
    if (listed) return counted ? `${listed}.length` : listed;
    if (counted && this.variables.has((counted[1] as string).trim().toLowerCase())) {
      return `${variable((counted[1] as string).trim())}.length`;
    }
    const item = /^item\s+(\d+)\s+of\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(asked);
    if (item && this.variables.has((item[2] as string).toLowerCase())) {
      return `${variable(item[2] as string)}[${Number(item[1]) - 1}]`;
    }
    return null;
  }

  private list(text: string): string | null {
    const lists = this.app ? LISTS[this.app] : undefined;
    if (!lists) return null;
    const word = /^(?:(?:name|text|title|summary)\s+of\s+)?(?:every\s+)?([A-Za-z]+)$/i.exec(
      text,
    )?.[1];
    if (!word || !lists.kind.test(word)) return null;
    if (!/\bevery\b/i.test(text) && !/s$|people|stickies/i.test(word)) return null;
    return `__text(await ${lists.call})`;
  }

  private condition(text: string): string {
    for (const [pattern, operator] of COMPARISONS) {
      const found = pattern.exec(text);
      if (!found) continue;
      const left = text.slice(0, found.index);
      const right = text.slice(found.index + found[0].length);
      return `${this.value(left)} ${operator} ${this.value(right)}`;
    }
    return this.value(text);
  }

  /** `{name:"A", body:"B"}` as the action's arguments. */
  private properties(text: string, known: Readonly<Record<string, string>>): string {
    const inner = /^\{(.*)\}$/s.exec(text.trim())?.[1];
    if (inner === undefined) throw new Stop(`Expected a record but found “${text.trim()}”.`);
    const parts: string[] = [];
    let depth = 0;
    let quoted = false;
    let piece = "";
    for (let at = 0; at < inner.length; at += 1) {
      const c = inner[at] as string;
      if (c === "\\" && quoted) {
        piece += c + (inner[at + 1] ?? "");
        at += 1;
        continue;
      }
      if (c === '"') quoted = !quoted;
      if (!quoted && (c === "{" || c === "(")) depth += 1;
      if (!quoted && (c === "}" || c === ")")) depth -= 1;
      if (c === "," && !quoted && depth === 0) {
        parts.push(piece);
        piece = "";
      } else piece += c;
    }
    if (piece.trim() !== "") parts.push(piece);
    return parts
      .map((part) => {
        const colon = part.indexOf(":");
        const label = part.slice(0, colon).trim().toLowerCase();
        const name = colon < 0 ? undefined : known[label];
        if (!name)
          throw new Stop(`This app’s scripts have no property “${part.split(":")[0]?.trim()}”.`);
        return `${name}: ${this.value(part.slice(colon + 1))}`;
      })
      .join(", ");
  }

  /** A statement addressed to the application told; null when it is not one this subset knows. */
  private command(statement: string): string | null {
    const app = this.told.at(-1);
    if (!app) return null;
    if (/^(activate|launch|open)$/i.test(statement)) {
      return `Application(${JSON.stringify(app.name)}).activate()`;
    }
    const folder = /^open\s+folder\s+("(?:[^"\\]|\\.)*")$/i.exec(statement);
    if (app.object === "Files" && folder) {
      return `Application("Finder").open(${stringOf(folder[1] as string)})`;
    }
    const make =
      /^make\s+new\s+([A-Za-z]+)(?:\s+at\s+(folder|list)\s+("(?:[^"\\]|\\.)*"))?(?:\s+with\s+properties\s+(\{.*\}))?$/i.exec(
        statement,
      );
    const maker = MAKERS[app.object];
    if (make && maker?.kind.test(make[1] as string)) {
      const args = make[4] ? [this.properties(make[4], maker.properties)] : [];
      if (make[3]) args.push(`${(make[2] as string).toLowerCase()}: ${stringOf(make[3])}`);
      return `__text(await ${maker.call}({ ${args.join(", ")} }))`;
    }
    const send = /^send\s+(.+?)(?:\s+to\s+(?:chat\s+)?("(?:[^"\\]|\\.)*"))?$/i.exec(statement);
    if (app.object === "Messages" && send) {
      const room = send[2] ? `, room: ${stringOf(send[2])}` : "";
      return `__text(await Messages.send({ text: ${this.value(send[1] as string)}${room} }))`;
    }
    const dark =
      /^set\s+dark\s+mode(?:\s+of\s+appearance\s+preferences)?\s+to\s+(true|false)$/i.exec(
        statement,
      );
    if (app.object === "Appearance" && dark) {
      const mode = (dark[1] as string).toLowerCase() === "true" ? "dark" : "light";
      return `__text(await Appearance.set({ mode: "${mode}" }))`;
    }
    return this.query(statement);
  }

  /** A `tell application "X"` target: the application, or a stop naming those it can tell. */
  private tell(name: string) {
    this.told.push({ name, object: APPS[name.toLowerCase()] ?? "" });
  }

  private statement(text: string): void {
    const inline = /^tell\s+application\s+"([^"]*)"\s+to\s+(.+)$/i.exec(text);
    if (inline) {
      this.tell(inline[1] as string);
      this.statement(inline[2] as string);
      this.told.pop();
      return;
    }
    const preferences = /^tell\s+appearance\s+preferences\s+to\s+(.+)$/i.exec(text);
    if (preferences && this.app === "Appearance") {
      this.statement(preferences[1] as string);
      return;
    }
    const opened = /^tell\s+application\s+"([^"]*)"$/i.exec(text);
    if (opened) {
      this.tell(opened[1] as string);
      this.blocks.push("tell");
      return;
    }
    if (/^tell\s+appearance\s+preferences$/i.test(text) && this.app === "Appearance") {
      this.told.push(this.told.at(-1) as { object: string; name: string });
      this.blocks.push("tell");
      return;
    }
    const repeat = /^repeat\s+with\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+)$/i.exec(text);
    const times = /^repeat\s+(.+?)\s+times$/i.exec(text);
    const branch = /^(else\s+)?if\s+(.+?)\s+then$/i.exec(text);
    if (repeat) {
      const name = (repeat[1] as string).toLowerCase();
      const list = this.value(repeat[2] as string);
      this.variables.add(name);
      this.out.push(`for (const ${variable(name)} of ${list}) {`);
      this.blocks.push("repeat");
    } else if (times) {
      this.out.push(`for (let __i = 0; __i < ${this.value(times[1] as string)}; __i += 1) {`);
      this.blocks.push("repeat");
    } else if (branch) {
      const condition = this.condition(branch[2] as string);
      if (branch[1]) this.out.push(`} else if (${condition}) {`);
      else {
        this.out.push(`if (${condition}) {`);
        this.blocks.push("if");
      }
    } else if (/^else$/i.test(text)) this.out.push("} else {");
    else if (/^end\b/i.test(text)) {
      const block = this.blocks.pop();
      if (block === "tell") this.told.pop();
      else this.out.push("}");
    } else this.simple(text);
  }

  private simple(text: string): void {
    const set = /^set\s+(?:the\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+to\s+(.+)$/i.exec(text);
    const returned = /^return(?:\s+(.+))?$/i.exec(text);
    const logged = /^log\s+(.+)$/i.exec(text);
    const told = this.told.at(-1);
    if (told && !told.object && !/^(activate|launch|open)$/i.test(text)) {
      const known = Object.keys(APPS).map((name) => name.replace(/^./, (c) => c.toUpperCase()));
      throw new Stop(
        `A script here can only activate “${told.name}”. It can tell ${known.join(", ")}.`,
      );
    }
    const command = this.command(text);
    if (command) this.out.push(`__result = ${command};`);
    else if (set) {
      const value = this.value(set[2] as string);
      const name = (set[1] as string).toLowerCase();
      this.variables.add(name);
      this.out.push(`${variable(name)} = ${value};`, `__result = ${variable(name)};`);
    } else if (returned) this.out.push(`return ${returned[1] ? this.value(returned[1]) : ""};`);
    else if (logged) this.out.push(`console.log(${this.value(logged[1] as string)});`);
    else if (told) {
      throw new Stop(`“${told.name}” got a statement this desktop can’t carry out: ${text}`);
    } else {
      throw new Stop(`A script with a tell block can’t run this statement here: ${text}`);
    }
  }

  translate(source: string): Translation {
    const state: ScriptLineState = { comment: false };
    for (const [line, raw] of source.split("\n").entries()) {
      const text = writtenOf(styleLine(raw.trim(), state)).trim();
      if (text === "") continue;
      try {
        this.statement(text);
      } catch (error) {
        if (error instanceof Stop) return { ok: false, error: error.message, line };
        throw error;
      }
    }
    const declared = [...this.variables].map(variable);
    const code = [
      "const __text = (items) => (Array.isArray(items) ? items.map((item) => item?.text ?? item) : items);",
      "let __result;",
      ...(declared.length > 0 ? [`let ${declared.join(", ")};`] : []),
      ...this.out,
      "return __result;",
    ].join("\n");
    return { ok: true, code };
  }
}

/** Whether a compiled AppleScript addresses an application: the server then runs it. */
export const tellsApplication = (source: string): boolean => {
  const state: ScriptLineState = { comment: false };
  return source
    .split("\n")
    .some((raw) => /^tell\s+application\b/i.test(writtenOf(styleLine(raw.trim(), state)).trim()));
};

/** The JavaScript a compiled AppleScript runs as, or why it can't. */
export const translateAppleScript = (source: string): Translation =>
  new Translator().translate(source);
