import { charWidth } from "./terminal-emulator";

/**
 * The shell's line editor, after zsh's emacs keymap: the line being typed, its history and its
 * kill ring. It reads the bytes the keyboard sends and writes what the person sees back to the
 * terminal, knowing nothing of what the line means.
 */

export interface LineEditorHost {
  write: (data: string) => void;
  columns: () => number;
  rows: () => number;
  /** What Tab completes: the words that may replace the text from `start` to the cursor. */
  complete: (line: string, cursor: number) => Promise<Completion>;
  /** A line was entered. */
  onLine: (line: string) => void;
  /** Control-C at a prompt. */
  onInterrupt: () => void;
  /** Control-D on an empty line. */
  onEndOfFile: () => void;
  /** Control-L: the terminal is cleared and the prompt drawn again at the top. */
  clearScreen: () => void;
}

export interface Completion {
  /** Where in the line the word being completed starts. */
  start: number;
  /** The whole words it may become, already escaped for the shell. */
  candidates: readonly string[];
  /** Whether a single candidate is finished with a space (not a folder's `/`). */
  closes?: (candidate: string) => boolean;
}

const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}_]/u.test(ch);

/** What ends a bracketed paste. */
const PASTE_END = "\x1b[201~";

/** Lays names out in columns under the prompt, down then across as zsh does, or `across` then down; `paint` adds colours. */
export function columnize(
  names: readonly string[],
  width: number,
  paint: (name: string) => string = (name) => name,
  order: "down" | "across" = "down",
): string[] {
  if (names.length === 0) return [];
  const longest = Math.max(...names.map((name) => displayWidth(name))) + 2;
  const across = Math.max(1, Math.floor(width / longest));
  const down = Math.ceil(names.length / across);
  const rows: string[] = [];
  for (let row = 0; row < down; row += 1) {
    let line = "";
    for (let column = 0; column < across; column += 1) {
      const name = names[order === "down" ? row + column * down : row * across + column];
      if (name === undefined) break;
      line += paint(name) + " ".repeat(Math.max(0, longest - displayWidth(name)));
    }
    rows.push(line.replace(/ +$/, ""));
  }
  return rows;
}

const displayWidth = (text: string) => {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width;
};

/**
 * What a character of the line draws at `column`, as zsh draws a pasted one: a tab to the next stop,
 * a control character in caret or `<0080>` notation. It stays itself in the line, and nothing in it
 * reaches the screen as an instruction.
 */
const shownAt = (ch: string, column: number): string => {
  if (ch === "\t") return " ".repeat(8 - (column % 8));
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x20) return `^${String.fromCharCode(code + 0x40)}`;
  if (code === 0x7f) return "^?";
  if (code >= 0x80 && code < 0xa0) return `<${code.toString(16).padStart(4, "0")}>`;
  return ch;
};

export class LineEditor {
  /** The lines entered, the oldest first. */
  history: string[] = [];

  private host: LineEditorHost;
  private prompt = "";
  private text: string[] = [];
  private point = 0;
  /** Where the cursor stands below the line of the prompt's start. */
  private row = 0;
  /** How many rows the last drawing took. */
  private drawnRows = 1;
  /** Whether the line is too tall for the screen, which then holds only some of its rows. */
  private windowed = false;
  /** The first of the line's rows the screen holds while it is `windowed`. */
  private windowTop = 0;
  private active = false;
  private pending = "";
  private killed = "";
  private lastWasKill = false;
  private historyAt = -1;
  private unsent: string[] = [];
  private search: { query: string; match: number; failed: boolean } | null = null;
  private inPaste = false;
  private lastWasTab = false;
  /** Changes with every key and prompt: an answer to Tab for an older one is about another line. */
  private generation = 0;

  constructor(host: LineEditorHost) {
    this.host = host;
  }

  /** Whether a prompt is up and takes the keyboard. */
  get reading(): boolean {
    return this.active;
  }

  /** The line as it stands, for a test or a saved session. */
  get line(): string {
    return this.text.join("");
  }

  /** Shows `prompt` and takes the keyboard, with `initial` already typed. */
  start(prompt: string, initial = ""): void {
    this.generation += 1;
    this.prompt = prompt;
    this.text = [...initial];
    this.point = this.text.length;
    this.row = 0;
    this.windowed = false;
    this.windowTop = 0;
    this.active = true;
    this.historyAt = -1;
    this.search = null;
    this.lastWasKill = false;
    this.lastWasTab = false;
    this.draw();
  }

  /** Draws the prompt and the line again where the terminal's cursor is. */
  redraw(): void {
    if (!this.active) return;
    this.row = 0;
    this.draw();
  }

  /** The terminal changed width: it wrapped the line anew, so the line is drawn over itself. */
  resized(): void {
    if (!this.active) return;
    // A windowed line fills the screen and starts at its top, whatever its rows have become.
    this.row = this.windowed ? this.host.rows() : this.rowOf(this.point);
    this.draw();
  }

  /** Takes bytes from the keyboard. */
  feed(data: string): void {
    if (!this.active) return;
    this.pending += data;
    while (this.pending.length > 0 && this.active) {
      // Out of `pending` while it is read: a line ended here may start the next prompt at once,
      // which takes what is left of `pending`, and the key being read is not left.
      const reading = this.pending;
      this.pending = "";
      const used = this.step(reading);
      this.pending = reading.slice(used) + this.pending;
      if (used === 0) return;
    }
  }

  /** What did not get read when the line ended, for the next reader. */
  takeUnread(): string {
    const unread = this.pending;
    this.pending = "";
    return unread;
  }

  private step(data: string): number {
    this.generation += 1;
    const first = data[0] as string;
    if (this.inPaste) {
      const end = data.indexOf(PASTE_END);
      if (end < 0) {
        // The end marker may be cut in two: leave anything that could be its start.
        let held = Math.min(PASTE_END.length - 1, data.length);
        while (held > 0 && !data.endsWith(PASTE_END.slice(0, held))) held -= 1;
        if (held === data.length) return 0;
        this.insert(data.slice(0, data.length - held).replace(/\r\n?/g, "\n"));
        return data.length - held;
      }
      this.insert(data.slice(0, end).replace(/\r\n?/g, "\n"));
      this.inPaste = false;
      return end + PASTE_END.length;
    }
    if (first === "\x1b") {
      if (data.length === 1) return 0;
      const second = data[1] as string;
      if (second === "[" || second === "O") {
        const match = /^[[O][0-9;]*[ -/]*[@-~]/.exec(data.slice(1));
        if (!match) return data.length > 32 ? 1 : 0;
        this.sequence(`\x1b${match[0]}`);
        return match[0].length + 1;
      }
      this.meta(second);
      return 2;
    }
    const code = first.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      this.control(first);
      return 1;
    }
    const ch = String.fromCodePoint(data.codePointAt(0) ?? 0xfffd);
    if (this.search) this.searchType(ch);
    else this.insert(ch);
    return ch.length;
  }

  private insert(text: string): void {
    const chars = [...text];
    this.text = this.text.slice(0, this.point).concat(chars, this.text.slice(this.point));
    this.point += chars.length;
    this.lastWasKill = false;
    this.lastWasTab = false;
    this.draw();
  }

  private control(key: string): void {
    const wasKill = this.lastWasKill;
    const wasTab = this.lastWasTab;
    this.lastWasKill = false;
    this.lastWasTab = false;
    if (this.search) {
      this.searchControl(key);
      return;
    }
    switch (key) {
      case "\r":
      case "\n":
        this.accept();
        return;
      case "\x01":
        this.point = this.lineStart();
        break;
      case "\x05":
        this.point = this.lineEnd();
        break;
      case "\x02":
        this.point = Math.max(0, this.point - 1);
        break;
      case "\x06":
        this.point = Math.min(this.text.length, this.point + 1);
        break;
      case "\x03":
        this.interrupt();
        return;
      case "\x07":
        return;
      case "\x04":
        if (this.text.length === 0) {
          this.finish();
          this.host.onEndOfFile();
          return;
        }
        this.text.splice(this.point, 1);
        break;
      case "\x08":
      case "\x7f":
        if (this.point === 0) return;
        this.point -= 1;
        this.text.splice(this.point, 1);
        break;
      case "\x0b":
        this.kill(this.point, this.lineEnd(), wasKill, false);
        break;
      case "\x15":
        this.kill(0, this.text.length, false, false);
        break;
      case "\x17":
        this.kill(this.backWord(true), this.point, wasKill, true);
        break;
      case "\x19":
        this.insert(this.killed);
        return;
      case "\x14":
        this.transpose();
        break;
      case "\x0c":
        this.host.clearScreen();
        this.row = 0;
        break;
      case "\x10":
        this.historyStep(-1);
        return;
      case "\x0e":
        this.historyStep(1);
        return;
      case "\x12":
        this.search = { query: "", match: -1, failed: false };
        break;
      case "\t":
        void this.tab(wasTab);
        return;
      default:
        return;
    }
    this.draw();
  }

  private meta(key: string): void {
    this.lastWasTab = false;
    if (this.search) {
      this.endSearch();
    }
    switch (key) {
      case "b":
        this.point = this.backWord(false);
        break;
      case "f":
        this.point = this.forwardWord();
        break;
      case "d":
        this.kill(this.point, this.forwardWord(), false, false);
        break;
      case "\x7f":
      case "\x08":
        this.kill(this.backWord(false), this.point, false, true);
        break;
      case "<":
        this.historyAt = -1;
        this.historyStep(-this.history.length);
        return;
      case ">":
        this.historyStep(this.history.length);
        return;
      default:
        return;
    }
    this.draw();
  }

  private sequence(sequence: string): void {
    this.lastWasTab = false;
    if (sequence === "\x1b[200~") {
      this.inPaste = true;
      return;
    }
    if (this.search) this.endSearch();
    const final = sequence.at(-1);
    const modified = /;(\d+)/.exec(sequence)?.[1];
    const wordWise = modified === "3" || modified === "5";
    switch (final) {
      case "A":
        this.historyStep(-1);
        return;
      case "B":
        this.historyStep(1);
        return;
      case "C":
        this.point = wordWise ? this.forwardWord() : Math.min(this.text.length, this.point + 1);
        break;
      case "D":
        this.point = wordWise ? this.backWord(false) : Math.max(0, this.point - 1);
        break;
      case "H":
        this.point = this.lineStart();
        break;
      case "F":
        this.point = this.lineEnd();
        break;
      case "~": {
        const code = /\[(\d+)/.exec(sequence)?.[1];
        if (code === "3") this.text.splice(this.point, 1);
        else if (code === "1") this.point = this.lineStart();
        else if (code === "4") this.point = this.lineEnd();
        else return;
        break;
      }
      default:
        return;
    }
    this.draw();
  }

  private lineStart(): number {
    const at = this.text.lastIndexOf("\n", this.point - 1);
    return this.point === 0 || at < 0 ? 0 : at + 1;
  }

  private lineEnd(): number {
    const at = this.text.indexOf("\n", this.point);
    return at < 0 ? this.text.length : at;
  }

  private backWord(spacesOnly: boolean): number {
    const inWord = (ch: string | undefined) =>
      spacesOnly ? ch !== undefined && !/\s/.test(ch) : isWordChar(ch);
    let at = this.point;
    while (at > 0 && !inWord(this.text[at - 1])) at -= 1;
    while (at > 0 && inWord(this.text[at - 1])) at -= 1;
    return at;
  }

  private forwardWord(): number {
    let at = this.point;
    while (at < this.text.length && !isWordChar(this.text[at])) at += 1;
    while (at < this.text.length && isWordChar(this.text[at])) at += 1;
    return at;
  }

  private kill(from: number, to: number, append: boolean, before: boolean): void {
    if (to <= from) return;
    const removed = this.text.splice(from, to - from).join("");
    if (append) this.killed = before ? removed + this.killed : this.killed + removed;
    else this.killed = removed;
    if (this.point > from) this.point = Math.max(from, this.point - (to - from));
    this.lastWasKill = true;
  }

  private transpose(): void {
    if (this.text.length < 2 || this.point === 0) return;
    const at = this.point === this.text.length ? this.point - 1 : this.point;
    const before = this.text[at - 1] as string;
    this.text[at - 1] = this.text[at] as string;
    this.text[at] = before;
    this.point = at + 1;
  }

  private historyStep(direction: number): void {
    const count = this.history.length;
    if (count === 0) return;
    if (this.historyAt < 0) {
      if (direction > 0) return;
      this.unsent = this.text;
      this.historyAt = count;
    }
    const next = Math.min(count, Math.max(0, this.historyAt + direction));
    if (next === this.historyAt) return;
    if (next === count) {
      this.historyAt = -1;
      this.text = this.unsent;
    } else {
      this.historyAt = next;
      this.text = [...(this.history[next] as string)];
    }
    this.point = this.text.length;
    this.draw();
  }

  private searchFrom(from: number, query: string): number {
    for (let at = from; at >= 0; at -= 1) {
      if (this.history[at]?.includes(query)) return at;
    }
    return -1;
  }

  private searchType(ch: string): void {
    if (!this.search) return;
    const query = this.search.query + ch;
    const from = this.search.match >= 0 ? this.search.match : this.history.length - 1;
    this.applySearch(query, this.searchFrom(from, query));
  }

  private applySearch(query: string, match: number): void {
    if (!this.search) return;
    this.search = {
      query,
      match: match >= 0 ? match : this.search.match,
      failed: match < 0 && query !== "",
    };
    if (match >= 0) {
      const line = this.history[match] as string;
      this.text = [...line];
      this.point = [...line.slice(0, line.indexOf(query) + query.length)].length;
    }
    this.draw();
  }

  private searchControl(key: string): void {
    const search = this.search;
    if (!search) return;
    switch (key) {
      case "\x12": {
        const from = (search.match >= 0 ? search.match : this.history.length) - 1;
        this.applySearch(search.query, search.query ? this.searchFrom(from, search.query) : -1);
        return;
      }
      case "\x7f":
      case "\x08": {
        const shorter = [...search.query].slice(0, -1).join("");
        this.applySearch(shorter, shorter ? this.searchFrom(this.history.length - 1, shorter) : -1);
        return;
      }
      case "\x07":
      case "\x03":
        this.search = null;
        this.text = [];
        this.point = 0;
        this.draw();
        return;
      default:
        this.endSearch();
        this.control(key);
    }
  }

  private endSearch(): void {
    this.search = null;
    this.draw();
  }

  private async tab(again: boolean): Promise<void> {
    const asked = this.generation;
    const line = this.text.join("");
    const cursor = this.text.slice(0, this.point).join("").length;
    const done = await this.host.complete(line, cursor).catch(() => null);
    if (asked !== this.generation) return;
    if (!done) {
      this.host.write("\x07");
      return;
    }
    const { start, candidates, closes } = done;
    if (candidates.length === 0) {
      this.host.write("\x07");
      return;
    }
    const startChars = [...line.slice(0, start)].length;
    const typed = this.text.slice(startChars, this.point).join("");
    if (candidates.length === 1) {
      const only = candidates[0] as string;
      const tail = closes?.(only) === false ? "" : " ";
      this.replaceWord(startChars, `${only}${tail}`);
      return;
    }
    const common = commonPrefix(candidates);
    if (common.length > typed.length) {
      this.replaceWord(startChars, common);
      this.lastWasTab = true;
      return;
    }
    this.lastWasTab = true;
    if (!again && candidates.length > 200) {
      this.host.write("\x07");
      return;
    }
    this.listBelow(candidates);
  }

  private replaceWord(start: number, word: string): void {
    const chars = [...word];
    this.text = this.text.slice(0, start).concat(chars, this.text.slice(this.point));
    this.point = start + chars.length;
    this.draw();
  }

  /** Writes the candidates under the line, with the prompt drawn again below them. */
  private listBelow(candidates: readonly string[]): void {
    const below = this.drawnRows - 1 - this.row;
    if (below > 0) this.host.write(`\x1b[${below}B`);
    const shown = candidates.map((candidate) => candidate.replace(/.*[^\\]\/(?=.)/, ""));
    this.host.write("\r\n");
    for (const line of columnize(shown, this.host.columns())) this.host.write(`${line}\r\n`);
    this.row = 0;
    this.draw();
  }

  private interrupt(): void {
    this.finish();
    this.host.write("^C\r\n");
    this.active = false;
    this.host.onInterrupt();
  }

  private accept(): void {
    this.finish();
    this.host.write("\r\n");
    const line = this.text.join("");
    this.active = false;
    this.host.onLine(line);
  }

  /** Puts the cursor after the line and leaves no search under it. */
  private finish(): void {
    this.search = null;
    const end = this.text.length;
    this.point = end;
    this.draw(true);
  }

  /** Where on the screen the character at `index` falls, in rows below the prompt's start. */
  private place(index: number): { row: number; column: number } {
    const width = this.host.columns();
    let row = 0;
    let column = 0;
    const advance = (ch: string) => {
      if (ch === "\n") {
        row += 1;
        column = 0;
        return;
      }
      for (const cell of shownAt(ch, column)) {
        const size = charWidth(cell);
        if (column + size > width) {
          row += 1;
          column = 0;
        }
        column += size;
      }
    };
    for (const ch of this.prompt) advance(ch);
    for (let at = 0; at < index; at += 1) advance(this.text[at] as string);
    if (column >= width) {
      row += Math.floor(column / width);
      column %= width;
    }
    return { row, column };
  }

  private rowOf(index: number): number {
    return this.place(index).row;
  }

  /** The rows of the prompt and the line as the terminal wraps them, one more when they end at the edge. */
  private laidOut(): string[] {
    const width = this.host.columns();
    const rows = [""];
    let column = 0;
    for (const ch of [...this.prompt, ...this.text]) {
      if (ch === "\n") {
        rows.push("");
        column = 0;
        continue;
      }
      for (const cell of shownAt(ch, column)) {
        const size = charWidth(cell);
        if (column + size > width) {
          rows.push("");
          column = 0;
        }
        rows[rows.length - 1] += cell;
        column += size;
      }
    }
    if (column >= width) rows.push("");
    return rows;
  }

  /**
   * Draws what the screen holds of a line taller than the screen, around the cursor. Moving up stops at
   * the top of the screen and text written past its end scrolls, so a line drawn whole could not be
   * drawn over itself; each row here is written apart and nothing scrolls once it starts at the top.
   */
  private drawWindow(
    up: string,
    status: string,
    target: { row: number; column: number },
    height: number,
  ): void {
    const laid = status ? [...this.laidOut(), status] : this.laidOut();
    if (target.row < this.windowTop) this.windowTop = target.row;
    else if (target.row >= this.windowTop + height) this.windowTop = target.row - height + 1;
    this.windowTop = Math.max(0, Math.min(this.windowTop, laid.length - height));
    const shown = laid.slice(this.windowTop, this.windowTop + height);
    const row = target.row - this.windowTop;
    const moveUp = shown.length - 1 > row ? `\x1b[${shown.length - 1 - row}A` : "";
    const column = target.column > 0 ? `\x1b[${target.column}C` : "";
    this.host.write(`${up}\r\x1b[J${shown.join("\r\n")}${moveUp}\r${column}`);
    this.row = row;
    this.drawnRows = shown.length;
    this.windowed = true;
  }

  /** The line as it goes to the screen after the prompt. */
  private drawnBody(): string {
    const width = this.host.columns();
    let column = this.place(0).column;
    let body = "";
    for (const ch of this.text) {
      if (ch === "\n") {
        body += "\r\n";
        column = 0;
        continue;
      }
      const shown = shownAt(ch, column);
      body += shown;
      for (const cell of shown) {
        const size = charWidth(cell);
        column = column + size > width ? size : column + size;
      }
    }
    return body;
  }

  /** Draws the line over its last drawing; `whole` lets it scroll, to leave all of it behind. */
  private draw(whole = false): void {
    const up = this.row > 0 ? `\x1b[${this.row}A` : "";
    const body = this.drawnBody();
    const end = this.place(this.text.length);
    // Exactly at the edge a terminal waits to wrap: a space and a return bring the cursor down.
    const atEdge = end.column === 0 && end.row > 0 && this.text.at(-1) !== "\n";
    const status = this.search
      ? (() => {
          // One row, whatever the query: the end of it, where the cursor is, stays in view.
          const room = Math.max(1, this.host.columns() - 1);
          const shown = [
            ...`${this.search.failed ? "failing " : ""}bck-i-search: ${this.search.query}_`,
          ];
          while (displayWidth(shown.join("")) > room) shown.shift();
          return shown.join("");
        })()
      : "";
    const target = this.search ? { row: end.row + 1, column: 0 } : this.place(this.point);
    const statusWidth = displayWidth(status);
    const from = this.search ? end.row + 1 : end.row;
    const toRow = target.row;
    const moveUp = from > toRow ? `\x1b[${from - toRow}A` : "";
    const column = this.search ? statusWidth : target.column;
    const height = Math.max(1, this.host.rows());
    if (!whole && from + 1 > height) {
      this.drawWindow(up, status, { row: toRow, column }, height);
      return;
    }
    this.windowed = false;
    this.drawnRows = from + 1;
    this.host.write(
      `${up}\r\x1b[J${this.prompt}${body}${atEdge ? " \r\x1b[K" : ""}${status ? `\r\n${status}` : ""}${moveUp}\r${column > 0 ? `\x1b[${column}C` : ""}`,
    );
    this.row = toRow;
  }
}

function commonPrefix(words: readonly string[]): string {
  let prefix = [...(words[0] ?? "")];
  for (const word of words) {
    const chars = [...word];
    let same = 0;
    while (same < prefix.length && prefix[same] === chars[same]) same += 1;
    prefix = prefix.slice(0, same);
  }
  return prefix.join("");
}
