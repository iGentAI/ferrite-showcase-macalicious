/**
 * The screen layer of Terminal: a VT100 and xterm emulation with no DOM and no React. Bytes go in
 * through `write`, what a person sees comes out through `lineAt` and `cursor`. The sequences follow
 * Xterm Control Sequences (invisible-island.net/xterm/ctlseqs/ctlseqs.html); what the emulation
 * answers goes back through `onReply`, as a real terminal answers down its line.
 */

/** A colour: an index of the 256-colour palette, or `#rrggbb`; absent is the profile's. */
export type TerminalColor = number | string;

export interface CellStyle {
  readonly fg?: TerminalColor;
  readonly bg?: TerminalColor;
  readonly bold?: boolean;
  readonly faint?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly blink?: boolean;
  readonly inverse?: boolean;
  readonly hidden?: boolean;
  readonly strike?: boolean;
}

export interface Cell {
  /** The character with its combining marks; `""` for the right half of a wide character. */
  ch: string;
  style: CellStyle;
}

export interface TerminalLine {
  /** The cells written so far; a column past the end is blank. */
  cells: Cell[];
  /** Whether this line carries on the one before it because the text wrapped. */
  wrapped: boolean;
  /** Whether the line has a mark (Edit > Marks). */
  marked?: boolean;
}

export type CursorShape = "block" | "underline" | "bar";

/** A position in the whole buffer: `line` counts from the first line ever kept. */
export interface TerminalPosition {
  line: number;
  column: number;
}

const PLAIN: CellStyle = Object.freeze({});
const SCROLLBACK_LINES = 10_000;

const WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x231a, 0x231b],
  [0x2329, 0x232a],
  [0x23e9, 0x23ec],
  [0x2614, 0x2615],
  [0x2648, 0x2653],
  [0x26a1, 0x26a1],
  [0x2705, 0x2705],
  [0x270a, 0x270b],
  [0x2728, 0x2728],
  [0x274c, 0x274c],
  [0x2753, 0x2755],
  [0x2795, 0x2797],
  [0x2b50, 0x2b50],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd],
];

/** The columns a character takes: 0 for a combining mark, 2 for a wide one, otherwise 1. */
export function charWidth(ch: string): 0 | 1 | 2 {
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x300) return 1;
  if (code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f) || /^\p{Mn}/u.test(ch)) return 0;
  for (const [from, to] of WIDE) if (code >= from && code <= to) return 2;
  return 1;
}

/** The columns a string takes. */
export function textWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width;
}

/** The DEC Special Graphics set, for line drawing (`ESC ( 0`). */
const DEC_GRAPHICS: Readonly<Record<string, string>> = {
  "`": "◆",
  a: "▒",
  f: "°",
  g: "±",
  j: "┘",
  k: "┐",
  l: "┌",
  m: "└",
  n: "┼",
  o: "⎺",
  p: "⎻",
  q: "─",
  r: "⎼",
  s: "⎽",
  t: "├",
  u: "┤",
  v: "┴",
  w: "┬",
  x: "│",
  y: "≤",
  z: "≥",
  "{": "π",
  "|": "≠",
  "}": "£",
  "~": "·",
};

const blankLine = (): TerminalLine => ({ cells: [], wrapped: false });

const blankCell = (style: CellStyle): Cell => ({
  ch: " ",
  style:
    style.bg === undefined && !style.inverse ? PLAIN : { bg: style.bg, inverse: style.inverse },
});

interface SavedCursor {
  x: number;
  y: number;
  style: CellStyle;
  origin: boolean;
  g0: string;
  g1: string;
  shifted: boolean;
}

interface Buffer {
  lines: TerminalLine[];
  saved: SavedCursor | null;
}

type State = "ground" | "esc" | "charset" | "csi" | "osc" | "oscEsc" | "string" | "stringEsc";

export class TerminalEmulator {
  rows: number;
  cols: number;
  /** Lines scrolled off the top of the normal screen, the oldest first. */
  scrollback: TerminalLine[] = [];
  /** How many lines scrollback has dropped: `lineAt` numbers keep counting past them. */
  dropped = 0;
  title: string | null = null;
  cursorShape: CursorShape = "block";
  cursorBlink = false;
  cursorVisible = true;
  autoWrap = true;
  applicationCursor = false;
  bracketedPaste = false;
  reverseVideo = false;
  /** Bumped by every change of what is shown. */
  version = 0;

  onReply: (data: string) => void = () => {};
  onBell: () => void = () => {};
  onTitle: (title: string | null) => void = () => {};
  onChange: () => void = () => {};

  private normal: Buffer;
  private alternate: Buffer;
  /** Lines that a narrower or shorter window has no room for under the cursor, waiting to come back. */
  private underScreen: TerminalLine[] = [];
  /** The width the normal screen's lines are wrapped at, which the alternate screen leaves behind. */
  private normalCols: number;
  private buffer: Buffer;
  private x = 0;
  private y = 0;
  private wrapNext = false;
  private style: CellStyle = PLAIN;
  private top = 0;
  private bottom: number;
  private origin = false;
  private insert = false;
  private newlineMode = false;
  private g0 = "B";
  private g1 = "B";
  private shifted = false;
  private charsetSlot = 0;
  private tabStops = new Set<number>();
  private state: State = "ground";
  private params = "";
  private osc = "";
  private lastPrinted = "";

  constructor(rows = 24, cols = 80) {
    this.rows = rows;
    this.cols = cols;
    this.bottom = rows - 1;
    this.normalCols = cols;
    this.normal = { lines: this.freshLines(), saved: null };
    this.alternate = { lines: this.freshLines(), saved: null };
    this.buffer = this.normal;
    this.resetTabs();
  }

  /** Whether the alternate screen is showing. */
  get onAlternate(): boolean {
    return this.buffer === this.alternate;
  }

  /** Where the cursor is on the screen. */
  get cursor(): { row: number; column: number } {
    return { row: this.y, column: this.x };
  }

  /** The number of the first line kept. */
  get firstLine(): number {
    return this.onAlternate ? 0 : this.dropped;
  }

  /** The number after the last line. */
  get endLine(): number {
    return this.firstLine + this.history.length + this.rows;
  }

  /** The number of the top line of the screen. */
  get screenTop(): number {
    return this.firstLine + this.history.length;
  }

  private get history(): TerminalLine[] {
    return this.onAlternate ? [] : this.scrollback;
  }

  /** The line numbered `line`, or undefined outside the buffer. */
  lineAt(line: number): TerminalLine | undefined {
    const index = line - this.firstLine;
    if (index < 0) return undefined;
    const history = this.history;
    return index < history.length ? history[index] : this.buffer.lines[index - history.length];
  }

  /** The screen row's text, without trailing blanks. */
  rowText(row: number): string {
    return this.lineText(this.screenTop + row);
  }

  /** The text of a line, without trailing blanks. */
  lineText(line: number, from = 0, to = Number.POSITIVE_INFINITY): string {
    const cells = this.lineAt(line)?.cells ?? [];
    let text = "";
    for (let at = from; at < Math.min(to, cells.length); at += 1) text += cells[at]?.ch ?? " ";
    return text.replace(/ +$/, "");
  }

  /**
   * A line's text with the cell each code unit of it came from, and one entry more for the end: a
   * string offset is not a column where a wide character takes two cells or a mark shares one.
   */
  lineWithColumns(line: number, folded = false): { text: string; columns: number[] } {
    const cells = this.lineAt(line)?.cells ?? [];
    let text = "";
    const columns: number[] = [];
    cells.forEach((cell, column) => {
      const piece = folded ? cell.ch.toLowerCase() : cell.ch;
      text += piece;
      for (let unit = 0; unit < piece.length; unit += 1) columns.push(column);
    });
    columns.push(cells.length);
    return { text: text.replace(/ +$/, ""), columns };
  }

  /**
   * The next place `query` is, in either case, from `from` in `direction`, going round the buffer
   * once. `start` and `end` are cells, `end` being the one after the match.
   */
  find(
    query: string,
    from: TerminalPosition,
    direction: 1 | -1,
  ): { line: number; start: number; end: number } | null {
    const wanted = query.toLowerCase();
    const lineCount = this.endLine - this.firstLine;
    for (let step = 0; step <= lineCount; step += 1) {
      const base = from.line - this.firstLine + step * direction;
      const line = this.firstLine + (((base % lineCount) + lineCount) % lineCount);
      const { text, columns } = this.lineWithColumns(line, true);
      const reached = columns.findIndex((column) => column >= from.column);
      const offset = reached < 0 ? text.length : reached;
      let at: number;
      if (direction > 0) {
        at = text.indexOf(wanted, step === 0 ? offset : 0);
      } else {
        const before = step === 0 ? offset - wanted.length : text.length;
        at = before < 0 ? -1 : text.lastIndexOf(wanted, before);
      }
      if (at >= 0) {
        const last = at + wanted.length - 1;
        return {
          line,
          start: columns[at] as number,
          end: Math.max(columns[last + 1] as number, (columns[last] as number) + 1),
        };
      }
    }
    return null;
  }

  /** The text from one position to the other, a wrapped line joined to the one it carries on. */
  textBetween(start: TerminalPosition, end: TerminalPosition): string {
    let text = "";
    for (let line = start.line; line <= end.line; line += 1) {
      const from = line === start.line ? start.column : 0;
      const to = line === end.line ? end.column : Number.POSITIVE_INFINITY;
      const next = this.lineAt(line + 1);
      const continues = line < end.line && next?.wrapped === true;
      const cells = this.lineAt(line)?.cells ?? [];
      if (continues) {
        for (let at = from; at < cells.length; at += 1) text += cells[at]?.ch ?? " ";
      } else {
        text += this.lineText(line, from, to);
        if (line < end.line) text += "\n";
      }
    }
    return text;
  }

  /** Everything in the buffer as text, trailing blank lines left out. */
  allText(): string {
    let last = this.endLine - 1;
    while (last > this.firstLine && this.lineText(last) === "") last -= 1;
    return this.textBetween({ line: this.firstLine, column: 0 }, { line: last, column: this.cols });
  }

  /** Takes `data`, which may stop anywhere: the next write goes on from there. */
  write(data: string): void {
    for (const ch of data) this.feed(ch);
    this.changed();
  }

  /** Changes the size. On the normal screen text wrapped by the old width is wrapped anew. */
  resize(rows: number, cols: number): void {
    const nextRows = Math.max(1, Math.floor(rows));
    const nextCols = Math.max(1, Math.floor(cols));
    if (nextRows === this.rows && nextCols === this.cols) return;
    const onNormal = !this.onAlternate;
    const cursorLine = onNormal ? this.scrollback.length + this.y : this.y;
    if (onNormal) this.alternate.lines = this.cropped(this.alternate.lines, nextRows, nextCols);
    else {
      this.keepNormalAbove(nextRows);
      this.settleUnderScreen(nextRows);
      // Its width stays, and is wrapped anew on the way back: narrowing here must not cut text.
      this.normal.lines = this.cropped(this.normal.lines, nextRows, Number.POSITIVE_INFINITY);
    }
    if (onNormal) {
      if (nextCols !== this.cols) this.reflow(nextRows, nextCols, cursorLine);
      else this.changeRows(nextRows);
    } else {
      this.alternate.lines = this.cropped(this.alternate.lines, nextRows, nextCols);
      this.y = Math.min(this.y, nextRows - 1);
      this.x = Math.min(this.x, nextCols - 1);
      if (nextCols !== this.cols) this.wrapNext = false;
    }
    this.rows = nextRows;
    this.cols = nextCols;
    this.top = 0;
    this.bottom = nextRows - 1;
    this.resetTabs();
    this.changed();
  }

  /** Send Hard Reset (RIS): everything back as it started, scrollback gone. */
  hardReset(): void {
    this.buffer = this.normal;
    this.normal.lines = this.freshLines();
    this.alternate.lines = this.freshLines();
    this.normal.saved = null;
    this.alternate.saved = null;
    this.scrollback = [];
    this.underScreen = [];
    this.normalCols = this.cols;
    this.softReset();
    this.x = 0;
    this.y = 0;
    this.title = null;
    this.onTitle(null);
    this.cursorShape = "block";
    this.cursorBlink = false;
    this.reverseVideo = false;
    this.resetTabs();
    this.changed();
  }

  /** Send Soft Reset (DECSTR): modes and scroll region as they started, the text stays. */
  softReset(): void {
    this.style = PLAIN;
    this.top = 0;
    this.bottom = this.rows - 1;
    this.origin = false;
    this.insert = false;
    this.autoWrap = true;
    this.newlineMode = false;
    this.applicationCursor = false;
    this.bracketedPaste = false;
    this.cursorVisible = true;
    this.wrapNext = false;
    this.g0 = "B";
    this.g1 = "B";
    this.shifted = false;
    this.state = "ground";
  }

  /** Edit > Clear Scrollback: the lines above the screen go. */
  clearScrollback(): void {
    this.dropped += this.scrollback.length;
    this.scrollback = [];
    this.changed();
  }

  /** Edit > Clear Screen: the lines above the cursor's scroll out of sight into the scrollback. */
  clearScreen(): void {
    if (this.onAlternate) return;
    this.pushLinesAboveCursor(true);
    this.changed();
  }

  /** Edit > Clear to Start: everything above the cursor's line goes, scrollback included. */
  clearToStart(): void {
    if (this.onAlternate) return;
    this.pushLinesAboveCursor(false);
    this.dropped += this.scrollback.length;
    this.scrollback = [];
    this.changed();
  }

  /** Edit > Clear to Previous Mark: the lines from the last mark above the cursor down to it go. */
  clearToPreviousMark(): void {
    if (this.onAlternate) return;
    const cursorLine = this.screenTop + this.y;
    const mark = this.markBefore(cursorLine);
    if (mark === undefined) {
      this.clearToStart();
      return;
    }
    const keepHistory = Math.max(0, mark - this.firstLine);
    const above = [...this.scrollback, ...this.normal.lines.slice(0, this.y)];
    const kept = above.slice(0, keepHistory);
    const below = this.normal.lines.slice(this.y);
    const fill = Array.from({ length: Math.max(0, this.rows - below.length) }, blankLine);
    const pulled = kept.splice(Math.max(0, kept.length - fill.length), fill.length);
    this.normal.lines = [...pulled, ...below];
    while (this.normal.lines.length < this.rows) this.normal.lines.push(blankLine());
    this.normal.lines.length = this.rows;
    this.y = pulled.length;
    this.scrollback = kept;
    this.changed();
  }

  /** Puts a mark on a line, or takes it off. */
  setMark(line: number, marked: boolean): void {
    const target = this.lineAt(line);
    if (target) {
      target.marked = marked || undefined;
      this.changed();
    }
  }

  /** The cursor's line as `lineAt` numbers it. */
  get cursorLine(): number {
    return this.screenTop + this.y;
  }

  /** The last marked line above `line`. */
  markBefore(line: number): number | undefined {
    for (let at = line - 1; at >= this.firstLine; at -= 1) {
      if (this.lineAt(at)?.marked) return at;
    }
    return undefined;
  }

  /** The first marked line below `line`. */
  markAfter(line: number): number | undefined {
    for (let at = line + 1; at < this.endLine; at += 1) {
      if (this.lineAt(at)?.marked) return at;
    }
    return undefined;
  }

  private changed(): void {
    this.version += 1;
    this.onChange();
  }

  private freshLines(): TerminalLine[] {
    return Array.from({ length: this.rows }, blankLine);
  }

  private resetTabs(): void {
    this.tabStops = new Set();
    for (let at = 8; at < this.cols; at += 8) this.tabStops.add(at);
  }

  /** The normal screen, out of sight, gets shorter: what no longer fits above its cursor scrolls. */
  private keepNormalAbove(rows: number): void {
    const { lines, saved } = this.normal;
    const cursor = saved?.y ?? lines.length - 1;
    while (lines.length > rows && lines.length - 1 > cursor && lines.at(-1)?.cells.length === 0) {
      lines.pop();
    }
    const moved = Math.min(Math.max(0, lines.length - rows), cursor);
    if (moved === 0) return;
    this.keepInScrollback(lines.splice(0, moved));
    if (saved) saved.y -= moved;
  }

  private cropped(lines: TerminalLine[], rows: number, cols: number): TerminalLine[] {
    const next = lines.slice(0, rows);
    for (const line of next) if (line.cells.length > cols) line.cells.length = cols;
    while (next.length < rows) next.push(blankLine());
    return next;
  }

  /** The rows change and the columns do not: lines go to or come back from the scrollback. */
  private changeRows(rows: number): void {
    const lines = this.normal.lines;
    if (rows < this.rows) {
      let extra = this.rows - rows;
      // Blank lines under the cursor go first, as in a real terminal: the text keeps its place.
      while (
        extra > 0 &&
        this.underScreen.length === 0 &&
        lines.length - 1 > this.y &&
        (lines.at(-1)?.cells.length ?? 0) === 0
      ) {
        lines.pop();
        extra -= 1;
      }
      const moved = lines.splice(0, Math.min(extra, this.y));
      this.keepInScrollback(moved);
      this.y -= moved.length;
      this.settleUnderScreen(rows);
    } else {
      this.settleUnderScreen(rows);
      const wanted = rows - lines.length;
      const pulled = this.scrollback.splice(Math.max(0, this.scrollback.length - wanted), wanted);
      lines.unshift(...pulled);
      this.y += pulled.length;
      while (lines.length < rows) lines.push(blankLine());
    }
  }

  /** The normal screen takes `rows` lines: those past it are kept under it, and it takes them back. */
  private settleUnderScreen(rows: number): void {
    const { lines } = this.normal;
    if (lines.length > rows) this.underScreen.unshift(...lines.splice(rows));
    else lines.push(...this.underScreen.splice(0, rows - lines.length));
  }

  /** Wraps every line of the normal screen and its scrollback anew at `cols`. */
  private reflow(rows: number, cols: number, cursorLine: number): void {
    const all = [...this.scrollback, ...this.normal.lines, ...this.underScreen];
    const out: TerminalLine[] = [];
    let cursorOut = 0;
    let cursorColumn = 0;
    // A cursor waiting to wrap is past the last cell it sits on: that is where the text goes on.
    const cursorAt = this.x + (this.wrapNext ? 1 : 0);
    let at = 0;
    while (at < all.length) {
      const cells: Cell[] = [...(all[at] as TerminalLine).cells];
      let marked = (all[at] as TerminalLine).marked;
      let cursorOffset = at === cursorLine ? cursorAt : -1;
      at += 1;
      while (at < all.length && all[at]?.wrapped) {
        const carried = all[at] as TerminalLine;
        if (at === cursorLine) cursorOffset = cells.length + cursorAt;
        cells.push(...carried.cells);
        marked = marked || carried.marked;
        at += 1;
      }
      let start = 0;
      let startOfLine = true;
      do {
        let end = Math.min(cells.length, start + cols);
        // A wide character is not cut in two: it starts the next line instead.
        if (end < cells.length && cells[end]?.ch === "" && end > start + 1) end -= 1;
        out.push({
          cells: cells.slice(start, end),
          wrapped: !startOfLine,
          ...(startOfLine && marked ? { marked } : {}),
        });
        if (cursorOffset >= start && (cursorOffset < end || end === cells.length)) {
          cursorOut = out.length - 1;
          cursorColumn = cursorOffset - start;
          cursorOffset = -1;
        }
        start = end;
        startOfLine = false;
      } while (start < cells.length);
    }
    // Blank lines under the cursor do not count: they would push text off the top.
    while (out.length > cursorOut + 1 && out.at(-1)?.cells.length === 0) out.pop();
    // A cursor above the last rows keeps the screen on it: the lines past the screen wait under it.
    const screenStart = Math.min(Math.max(0, out.length - rows), cursorOut);
    this.scrollback = [];
    this.keepInScrollback(out.slice(0, screenStart));
    this.normal.lines = out.slice(screenStart, screenStart + rows);
    this.underScreen = out.slice(screenStart + rows);
    while (this.normal.lines.length < rows) this.normal.lines.push(blankLine());
    this.y = cursorOut - screenStart;
    this.x = Math.min(cursorColumn, cols - 1);
    this.wrapNext = cursorColumn === cols;
    this.normalCols = cols;
  }

  private pushLinesAboveCursor(keep: boolean): void {
    const moved = this.normal.lines.splice(0, this.y);
    if (keep) this.keepInScrollback(moved);
    else this.dropped += moved.length;
    this.settleUnderScreen(this.rows);
    while (this.normal.lines.length < this.rows) this.normal.lines.push(blankLine());
    this.y = 0;
  }

  private keepInScrollback(lines: TerminalLine[]): void {
    if (lines.length === 0) return;
    this.scrollback.push(...lines);
    const over = this.scrollback.length - SCROLLBACK_LINES;
    if (over > 0) {
      this.scrollback.splice(0, over);
      this.dropped += over;
    }
  }

  private feed(ch: string): void {
    const code = ch.codePointAt(0) ?? 0;
    switch (this.state) {
      case "osc":
        if (code === 0x07) this.finishOsc();
        else if (code === 0x1b) this.state = "oscEsc";
        else if (this.osc.length < 4096) this.osc += ch;
        return;
      case "oscEsc":
        if (ch === "\\") this.finishOsc();
        else {
          this.state = "osc";
          if (this.osc.length < 4096) this.osc += ch;
        }
        return;
      case "string":
        if (code === 0x1b) this.state = "stringEsc";
        else if (code === 0x07) this.state = "ground";
        return;
      case "stringEsc":
        this.state = ch === "\\" ? "ground" : "string";
        return;
    }
    if (code < 0x20 || code === 0x7f) {
      if (code === 0x1b) {
        this.state = "esc";
        return;
      }
      if (code === 0x18 || code === 0x1a) {
        this.state = "ground";
        return;
      }
      this.control(code);
      return;
    }
    switch (this.state) {
      case "ground":
        this.print(ch);
        return;
      case "esc":
        this.escape(ch);
        return;
      case "charset":
        if (this.charsetSlot === 0) this.g0 = ch;
        else this.g1 = ch;
        this.state = "ground";
        return;
      case "csi":
        if (code >= 0x40 && code <= 0x7e) {
          const params = this.params;
          this.state = "ground";
          this.csi(ch, params);
        } else if (this.params.length < 256) {
          this.params += ch;
        }
        return;
    }
  }

  private control(code: number): void {
    switch (code) {
      case 0x07:
        this.onBell();
        return;
      case 0x08:
        this.x = Math.max(0, this.x - 1);
        this.wrapNext = false;
        return;
      case 0x09:
        this.x = this.nextTab(this.x);
        return;
      case 0x0a:
      case 0x0b:
      case 0x0c:
        this.lineFeed();
        if (this.newlineMode) this.x = 0;
        return;
      case 0x0d:
        this.x = 0;
        this.wrapNext = false;
        return;
      case 0x0e:
        this.shifted = true;
        return;
      case 0x0f:
        this.shifted = false;
        return;
    }
  }

  private nextTab(from: number): number {
    for (let at = from + 1; at < this.cols; at += 1) if (this.tabStops.has(at)) return at;
    return this.cols - 1;
  }

  private escape(ch: string): void {
    this.state = "ground";
    switch (ch) {
      case "[":
        this.state = "csi";
        this.params = "";
        return;
      case "]":
        this.state = "osc";
        this.osc = "";
        return;
      case "P":
      case "X":
      case "^":
      case "_":
        this.state = "string";
        return;
      case "(":
      case ")":
        this.charsetSlot = ch === "(" ? 0 : 1;
        this.state = "charset";
        return;
      case "7":
        this.saveCursor();
        return;
      case "8":
        this.restoreCursor();
        return;
      case "c":
        this.hardReset();
        return;
      case "D":
        this.lineFeed();
        return;
      case "E":
        this.lineFeed();
        this.x = 0;
        return;
      case "H":
        this.tabStops.add(this.x);
        return;
      case "M":
        this.reverseIndex();
        return;
      case "=":
      case ">":
        return;
    }
  }

  private finishOsc(): void {
    this.state = "ground";
    const split = this.osc.indexOf(";");
    if (split < 0) return;
    const command = this.osc.slice(0, split);
    if (command === "0" || command === "2") {
      this.title = this.osc.slice(split + 1) || null;
      this.onTitle(this.title);
    }
  }

  private print(raw: string): void {
    const graphics = (this.shifted ? this.g1 : this.g0) === "0";
    const ch = graphics ? (DEC_GRAPHICS[raw] ?? raw) : raw;
    const width = charWidth(ch);
    if (width === 0) {
      const previous = this.cellBefore();
      if (previous) previous.ch += ch;
      return;
    }
    if (this.wrapNext && this.autoWrap) {
      this.x = 0;
      this.lineFeed();
      this.line().wrapped = true;
    } else if (this.wrapNext) {
      this.x = this.cols - width;
    }
    this.wrapNext = false;
    if (width === 2 && this.x === this.cols - 1) {
      if (this.autoWrap) {
        this.x = 0;
        this.lineFeed();
        this.line().wrapped = true;
      } else {
        this.x = this.cols - 2;
      }
    }
    const cells = this.line().cells;
    this.fillTo(cells, this.x);
    if (this.insert) {
      cells.splice(this.x, 0, ...Array.from({ length: width }, () => blankCell(PLAIN)));
      cells.length = Math.min(cells.length, this.cols);
    }
    this.breakWide(cells, this.x);
    if (width === 2) this.breakWide(cells, this.x + 1);
    cells[this.x] = { ch, style: this.style };
    if (width === 2) cells[this.x + 1] = { ch: "", style: this.style };
    this.lastPrinted = ch;
    this.x += width;
    if (this.x >= this.cols) {
      this.x = this.cols - 1;
      this.wrapNext = true;
    }
  }

  private cellBefore(): Cell | undefined {
    const cells = this.line().cells;
    let at = this.wrapNext ? this.x : this.x - 1;
    if (cells[at]?.ch === "") at -= 1;
    return cells[at];
  }

  /** Overwriting either half of a wide character leaves the other half blank. */
  private breakWide(cells: Cell[], at: number): void {
    const cell = cells[at];
    if (!cell) return;
    if (cell.ch === "") {
      if (cells[at - 1]) (cells[at - 1] as Cell).ch = " ";
      cell.ch = " ";
    } else if (cells[at + 1]?.ch === "") (cells[at + 1] as Cell).ch = " ";
  }

  private line(): TerminalLine {
    let line = this.buffer.lines[this.y];
    if (!line) {
      line = blankLine();
      this.buffer.lines[this.y] = line;
    }
    return line;
  }

  private fillTo(cells: Cell[], at: number): void {
    while (cells.length < at) cells.push(blankCell(PLAIN));
  }

  private lineFeed(): void {
    this.wrapNext = false;
    if (this.y === this.bottom) this.scrollUp(1);
    else if (this.y < this.rows - 1) this.y += 1;
  }

  private reverseIndex(): void {
    this.wrapNext = false;
    if (this.y === this.top) this.scrollDown(1);
    else if (this.y > 0) this.y -= 1;
  }

  private scrollUp(count: number): void {
    const lines = this.buffer.lines;
    for (let n = 0; n < count; n += 1) {
      const gone = lines.splice(this.top, 1);
      const fromUnder =
        !this.onAlternate && this.bottom === this.rows - 1 ? this.underScreen.shift() : undefined;
      lines.splice(this.bottom, 0, fromUnder ?? this.styledBlankLine());
      if (!this.onAlternate && this.top === 0) this.keepInScrollback(gone);
    }
  }

  private scrollDown(count: number): void {
    const lines = this.buffer.lines;
    for (let n = 0; n < count; n += 1) {
      lines.splice(this.bottom, 1);
      lines.splice(this.top, 0, this.styledBlankLine());
    }
  }

  private styledBlankLine(): TerminalLine {
    const line = blankLine();
    if (this.style.bg !== undefined) {
      line.cells = Array.from({ length: this.cols }, () => blankCell(this.style));
    }
    return line;
  }

  private saveCursor(): void {
    this.buffer.saved = {
      x: this.x,
      y: this.y,
      style: this.style,
      origin: this.origin,
      g0: this.g0,
      g1: this.g1,
      shifted: this.shifted,
    };
  }

  private restoreCursor(): void {
    const saved = this.buffer.saved;
    this.wrapNext = false;
    if (!saved) {
      this.x = 0;
      this.y = 0;
      this.style = PLAIN;
      return;
    }
    this.x = Math.min(saved.x, this.cols - 1);
    this.y = Math.min(saved.y, this.rows - 1);
    this.style = saved.style;
    this.origin = saved.origin;
    this.g0 = saved.g0;
    this.g1 = saved.g1;
    this.shifted = saved.shifted;
  }

  private moveTo(column: number, row: number): void {
    const least = this.origin ? this.top : 0;
    const most = this.origin ? this.bottom : this.rows - 1;
    this.y = Math.min(most, Math.max(least, row + least));
    this.x = Math.min(this.cols - 1, Math.max(0, column));
    this.wrapNext = false;
  }

  private csi(final: string, raw: string): void {
    const prefix = /^[?>=<!]/.test(raw) ? (raw[0] as string) : "";
    const middle = /[ -/]+$/.exec(raw)?.[0] ?? "";
    const body = raw.slice(prefix.length, raw.length - middle.length);
    const parts = body === "" ? [] : body.split(";");
    const params = parts.map((part) => (part === "" ? 0 : Number.parseInt(part, 10) || 0));
    const one = (fallback = 1) => (params[0] ? params[0] : fallback);
    if (prefix === "?") {
      if (final === "h" || final === "l") {
        for (const mode of params) this.privateMode(mode, final === "h");
      } else if (final === "J" || final === "K") {
        if (final === "J") this.eraseDisplay(params[0] ?? 0);
        else this.eraseLine(params[0] ?? 0);
      } else if (final === "n" && params[0] === 6) {
        this.onReply(`\x1b[?${this.y + 1};${this.x + 1}R`);
      }
      return;
    }
    if (prefix === ">") {
      if (final === "c") this.onReply("\x1b[>0;95;0c");
      return;
    }
    if (prefix === "!") {
      if (final === "p") this.softReset();
      return;
    }
    if (middle === " ") {
      if (final === "q") this.setCursorStyle(params[0] ?? 0);
      return;
    }
    if (middle !== "") return;
    switch (final) {
      case "@":
        this.insertCells(one());
        return;
      case "A":
        this.y = Math.max(this.y >= this.top ? this.top : 0, this.y - one());
        this.wrapNext = false;
        return;
      case "B":
      case "e":
        this.y = Math.min(this.y <= this.bottom ? this.bottom : this.rows - 1, this.y + one());
        this.wrapNext = false;
        return;
      case "C":
      case "a":
        this.x = Math.min(this.cols - 1, this.x + one());
        this.wrapNext = false;
        return;
      case "D":
        this.x = Math.max(0, this.x - one());
        this.wrapNext = false;
        return;
      case "E":
        this.y = Math.min(this.y <= this.bottom ? this.bottom : this.rows - 1, this.y + one());
        this.x = 0;
        this.wrapNext = false;
        return;
      case "F":
        this.y = Math.max(this.y >= this.top ? this.top : 0, this.y - one());
        this.x = 0;
        this.wrapNext = false;
        return;
      case "G":
      case "`":
        this.x = Math.min(this.cols - 1, one() - 1);
        this.wrapNext = false;
        return;
      case "H":
      case "f":
        this.moveTo((params[1] || 1) - 1, (params[0] || 1) - 1);
        return;
      case "I": {
        const count = Math.min(one(), this.cols);
        for (let n = 0; n < count; n += 1) this.x = this.nextTab(this.x);
        return;
      }
      case "J":
        this.eraseDisplay(params[0] ?? 0);
        return;
      case "K":
        this.eraseLine(params[0] ?? 0);
        return;
      case "L":
        this.insertLines(one());
        return;
      case "M":
        this.deleteLines(one());
        return;
      case "P":
        this.deleteCells(one());
        return;
      case "S":
        this.scrollUp(Math.min(one(), this.bottom - this.top + 1));
        return;
      case "T":
        this.scrollDown(Math.min(one(), this.bottom - this.top + 1));
        return;
      case "X":
        this.eraseCells(this.x, this.x + one());
        return;
      case "Z": {
        const count = Math.min(one(), this.cols);
        let at = this.x;
        for (let n = 0; n < count; n += 1) {
          at -= 1;
          while (at > 0 && !this.tabStops.has(at)) at -= 1;
        }
        this.x = Math.max(0, at);
        return;
      }
      case "b":
        for (let n = 0; n < Math.min(one(), this.cols * this.rows); n += 1) {
          if (this.lastPrinted) this.print(this.lastPrinted);
        }
        return;
      case "c":
        if (!params[0]) this.onReply("\x1b[?1;2c");
        return;
      case "d":
        this.moveTo(this.x, one() - 1);
        return;
      case "g":
        if (!params[0]) this.tabStops.delete(this.x);
        else if (params[0] === 3) this.tabStops.clear();
        return;
      case "h":
      case "l":
        for (const mode of params) {
          if (mode === 4) this.insert = final === "h";
          else if (mode === 20) this.newlineMode = final === "h";
        }
        return;
      case "m":
        this.sgr(parts);
        return;
      case "n":
        if (params[0] === 5) this.onReply("\x1b[0n");
        else if (params[0] === 6) this.onReply(`\x1b[${this.y + 1};${this.x + 1}R`);
        return;
      case "r": {
        const top = (params[0] || 1) - 1;
        const bottom = (params[1] || this.rows) - 1;
        if (top < bottom && bottom < this.rows) {
          this.top = top;
          this.bottom = bottom;
          this.moveTo(0, 0);
        }
        return;
      }
      case "s":
        this.saveCursor();
        return;
      case "t":
        if (params[0] === 18) this.onReply(`\x1b[8;${this.rows};${this.cols}t`);
        return;
      case "u":
        this.restoreCursor();
        return;
    }
  }

  private setCursorStyle(code: number): void {
    this.cursorBlink = code === 1 || code === 3 || code === 5;
    this.cursorShape =
      code === 3 || code === 4 ? "underline" : code === 5 || code === 6 ? "bar" : "block";
  }

  private privateMode(mode: number, on: boolean): void {
    switch (mode) {
      case 1:
        this.applicationCursor = on;
        return;
      case 5:
        this.reverseVideo = on;
        return;
      case 6:
        this.origin = on;
        this.moveTo(0, 0);
        return;
      case 7:
        this.autoWrap = on;
        if (!on) this.wrapNext = false;
        return;
      case 12:
        this.cursorBlink = on;
        return;
      case 25:
        this.cursorVisible = on;
        return;
      case 47:
      case 1047:
        this.switchScreen(on, false);
        return;
      case 1048:
        if (on) this.saveCursor();
        else this.restoreCursor();
        return;
      case 1049:
        this.switchScreen(on, true);
        return;
      case 2004:
        this.bracketedPaste = on;
        return;
    }
  }

  private switchScreen(on: boolean, moveCursor: boolean): void {
    if (on === this.onAlternate) return;
    if (on) {
      if (moveCursor) this.saveCursor();
      this.alternate.lines = this.freshLines();
      this.buffer = this.alternate;
    } else {
      this.buffer = this.normal;
      if (moveCursor) this.restoreCursor();
    }
    this.top = 0;
    this.bottom = this.rows - 1;
    this.wrapNext = false;
    if (!on && this.normalCols !== this.cols) {
      // The saved column is on the old width: the reflow finds its character before narrowing it.
      if (moveCursor && this.normal.saved) this.x = this.normal.saved.x;
      this.reflow(this.rows, this.cols, this.scrollback.length + this.y);
    }
  }

  private insertCells(count: number): void {
    const cells = this.line().cells;
    this.fillTo(cells, this.x);
    this.breakWide(cells, this.x);
    const room = Math.min(count, this.cols - this.x);
    cells.splice(this.x, 0, ...Array.from({ length: room }, () => blankCell(this.style)));
    cells.length = Math.min(cells.length, this.cols);
    this.wrapNext = false;
  }

  private deleteCells(count: number): void {
    const cells = this.line().cells;
    this.breakWide(cells, this.x);
    this.breakWide(cells, this.x + count - 1);
    cells.splice(this.x, count);
    this.wrapNext = false;
  }

  private eraseCells(from: number, to: number): void {
    const cells = this.line().cells;
    const end = Math.min(this.cols, to);
    this.breakWide(cells, from);
    this.breakWide(cells, end - 1);
    if (this.style.bg === undefined && end >= cells.length) {
      if (from < cells.length) cells.length = from;
      return;
    }
    this.fillTo(cells, end);
    for (let at = from; at < end; at += 1) cells[at] = blankCell(this.style);
  }

  private eraseLine(mode: number): void {
    if (mode === 0) this.eraseCells(this.x, this.cols);
    else if (mode === 1) this.eraseCells(0, this.x + 1);
    else if (mode === 2) this.eraseCells(0, this.cols);
    this.wrapNext = false;
  }

  private clearRow(row: number): void {
    const line = this.styledBlankLine();
    this.buffer.lines[row] = line;
  }

  private eraseDisplay(mode: number): void {
    if (mode === 0) {
      this.eraseCells(this.x, this.cols);
      for (let row = this.y + 1; row < this.rows; row += 1) this.clearRow(row);
      if (!this.onAlternate) this.underScreen = [];
    } else if (mode === 1) {
      for (let row = 0; row < this.y; row += 1) this.clearRow(row);
      this.eraseCells(0, this.x + 1);
    } else if (mode === 2) {
      for (let row = 0; row < this.rows; row += 1) this.clearRow(row);
      if (!this.onAlternate) this.underScreen = [];
    } else if (mode === 3 && !this.onAlternate) {
      this.dropped += this.scrollback.length;
      this.scrollback = [];
    }
    this.wrapNext = false;
  }

  private insertLines(count: number): void {
    if (this.y < this.top || this.y > this.bottom) return;
    const lines = this.buffer.lines;
    for (let n = 0; n < Math.min(count, this.bottom - this.y + 1); n += 1) {
      lines.splice(this.bottom, 1);
      lines.splice(this.y, 0, this.styledBlankLine());
    }
    this.x = 0;
    this.wrapNext = false;
  }

  private deleteLines(count: number): void {
    if (this.y < this.top || this.y > this.bottom) return;
    const lines = this.buffer.lines;
    for (let n = 0; n < Math.min(count, this.bottom - this.y + 1); n += 1) {
      lines.splice(this.y, 1);
      lines.splice(this.bottom, 0, this.styledBlankLine());
    }
    this.x = 0;
    this.wrapNext = false;
  }

  private sgr(parts: readonly string[]): void {
    let style: { -readonly [K in keyof CellStyle]: CellStyle[K] } = { ...this.style };
    const codes = parts.length === 0 ? ["0"] : parts;
    for (let at = 0; at < codes.length; at += 1) {
      const part = codes[at] ?? "0";
      const colon = part.includes(":")
        ? part.split(":").map((n) => Number.parseInt(n, 10) || 0)
        : null;
      const code = colon ? (colon[0] ?? 0) : Number.parseInt(part, 10) || 0;
      if (code === 38 || code === 48) {
        const key = code === 38 ? "fg" : "bg";
        if (colon) {
          if (colon[1] === 5) style[key] = colon[2] ?? 0;
          else if (colon[1] === 2) {
            const rgb = colon.length >= 6 ? colon.slice(3, 6) : colon.slice(2, 5);
            style[key] = hex(rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0);
          }
        } else if (codes[at + 1] === "5") {
          style[key] = Number.parseInt(codes[at + 2] ?? "0", 10) & 255;
          at += 2;
        } else if (codes[at + 1] === "2") {
          style[key] = hex(
            Number.parseInt(codes[at + 2] ?? "0", 10),
            Number.parseInt(codes[at + 3] ?? "0", 10),
            Number.parseInt(codes[at + 4] ?? "0", 10),
          );
          at += 4;
        }
        continue;
      }
      if (code === 0) style = {};
      else if (code === 1) style.bold = true;
      else if (code === 2) style.faint = true;
      else if (code === 3) style.italic = true;
      else if (code === 4) style.underline = !(colon && colon[1] === 0);
      else if (code === 5 || code === 6) style.blink = true;
      else if (code === 7) style.inverse = true;
      else if (code === 8) style.hidden = true;
      else if (code === 9) style.strike = true;
      else if (code === 22) {
        delete style.bold;
        delete style.faint;
      } else if (code === 23) delete style.italic;
      else if (code === 24) delete style.underline;
      else if (code === 25) delete style.blink;
      else if (code === 27) delete style.inverse;
      else if (code === 28) delete style.hidden;
      else if (code === 29) delete style.strike;
      else if (code === 39) delete style.fg;
      else if (code === 49) delete style.bg;
      else if (code >= 30 && code <= 37) style.fg = code - 30;
      else if (code >= 40 && code <= 47) style.bg = code - 40;
      else if (code >= 90 && code <= 97) style.fg = code - 90 + 8;
      else if (code >= 100 && code <= 107) style.bg = code - 100 + 8;
    }
    this.style = Object.keys(style).length === 0 ? PLAIN : Object.freeze(style);
  }
}

const toHex = (value: number) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, "0");
const hex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

/** A palette index past the sixteen a profile holds, as a colour: xterm's cube and grey ramp. */
export function paletteColor(index: number): string {
  if (index >= 232) {
    const level = 8 + (index - 232) * 10;
    return hex(level, level, level);
  }
  const cube = index - 16;
  const level = (step: number) => (step === 0 ? 0 : 55 + step * 40);
  return hex(level(Math.floor(cube / 36) % 6), level(Math.floor(cube / 6) % 6), level(cube % 6));
}
