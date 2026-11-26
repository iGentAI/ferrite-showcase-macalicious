import { currentDrive } from "../desktop/desktop-files";
import { keepText, readKeptText } from "../desktop/desktop-kept-text";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { driveTree, pathOfEntry } from "../finder/finder-drive";
import { CLOSE_WINDOWS_KEY } from "../system-preferences/panes/general/document-settings";
import type { CellStyle, TerminalColor } from "./terminal-emulator";
import { readProfileChanges, type TerminalProfile } from "./terminal-profiles";
import type { TerminalSession } from "./terminal-shell";

/**
 * What Terminal keeps with the person's settings: the windows that are open, each tab's folder, title,
 * profile and the end of its scrollback, and the lines typed, for every session of the account. The
 * stores hold 16 values of 4,000 bytes each (`keepText`): the oldest scrollback goes first.
 */

export const SESSION_KEY = "terminal.session";
export const HISTORY_KEY = "terminal.history";
export const SETTINGS_KEY = "terminal.settings";

const MOST_SESSION_BYTES = 60_000;
const MOST_HISTORY_BYTES = 30_000;
const MOST_HISTORY_LINES = 500;

const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

const colourCode = (colour: TerminalColor, base: 38 | 48) => {
  if (typeof colour === "number") return `${base};5;${colour}`;
  const value = Number.parseInt(colour.slice(1), 16);
  return `${base};2;${value >> 16};${(value >> 8) & 255};${value & 255}`;
};

function styleCode(style: CellStyle): string {
  const codes = ["0"];
  if (style.bold) codes.push("1");
  if (style.faint) codes.push("2");
  if (style.italic) codes.push("3");
  if (style.underline) codes.push("4");
  if (style.blink) codes.push("5");
  if (style.inverse) codes.push("7");
  if (style.hidden) codes.push("8");
  if (style.strike) codes.push("9");
  if (style.fg !== undefined) codes.push(colourCode(style.fg, 38));
  if (style.bg !== undefined) codes.push(colourCode(style.bg, 48));
  return `\x1b[${codes.join(";")}m`;
}

const plainStyle = (style: CellStyle) => Object.keys(style).length === 0;

/**
 * A session's lines above its prompt, each with what would draw it again. A line that wrapped is one
 * text, so it wraps anew in another window's width. The first character is `+` for a line with a mark.
 */
export function linesOfSession(session: TerminalSession): string[] {
  const { emulator } = session;
  let end = emulator.cursorLine;
  if (session.editor.reading) {
    while (end > emulator.firstLine && emulator.lineAt(end)?.wrapped) end -= 1;
  } else {
    end += 1;
  }
  const lines: string[] = [];
  for (let at = emulator.firstLine; at < end; at += 1) {
    const line = emulator.lineAt(at);
    if (!line) continue;
    let last = line.cells.length;
    while (last > 0) {
      const cell = line.cells[last - 1];
      if (!cell || (cell.ch !== " " && cell.ch !== "") || !plainStyle(cell.style)) break;
      last -= 1;
    }
    let text = "";
    let style: CellStyle | null = null;
    for (const cell of line.cells.slice(0, last)) {
      if (cell.ch === "") continue;
      if (cell.style !== style && !(style === null && plainStyle(cell.style))) {
        text += styleCode(cell.style);
        style = cell.style;
      }
      text += cell.ch;
    }
    if (style !== null && !plainStyle(style)) text += "\x1b[0m";
    const previous = lines.length - 1;
    if (line.wrapped && previous >= 0) lines[previous] += text;
    else lines.push(`${line.marked ? "+" : " "}${text}`);
  }
  while (lines.at(-1) === " ") lines.pop();
  return lines;
}

/** A fresh session takes the place of one that had these lines, and says so as a Mac does. */
export function restoreLines(
  session: TerminalSession,
  lines: readonly string[],
  when: Date = new Date(),
): void {
  const { emulator } = session;
  emulator.hardReset();
  emulator.write("\x1b[?2004h");
  for (const line of lines) {
    if (line.startsWith("+")) emulator.setMark(emulator.cursorLine, true);
    emulator.write(`${line.slice(1)}\r\n`);
  }
  emulator.write(`\r\nRestored session: ${when.toString().replace(/ \(.*\)$/, "")}\r\n`);
}

export interface SavedTab {
  cwd: string;
  oldCwd: string;
  /** The title the person gave, from the Inspector. */
  title: string;
  /** The title a program set. */
  programTitle: string | null;
  profile: string;
  changes: Partial<TerminalProfile>;
  split: boolean;
  lines: readonly string[];
}

export interface SavedWindow {
  /** The window's id when it was saved: the desktop kept its frame under it. */
  id: number;
  active: number;
  tabs: readonly SavedTab[];
}

export interface SavedSession {
  /** Kept after quitting the app, rather than while its windows were still open. */
  quit?: true;
  windows: readonly SavedWindow[];
}

const isTab = (tab: unknown): tab is SavedTab => {
  const each = tab as Partial<SavedTab> | null;
  return (
    typeof each?.cwd === "string" &&
    typeof each.oldCwd === "string" &&
    typeof each.title === "string" &&
    typeof each.profile === "string" &&
    (each.programTitle === null || typeof each.programTitle === "string") &&
    typeof each.split === "boolean" &&
    Array.isArray(each.lines) &&
    each.lines.every((line) => typeof line === "string")
  );
};

/** The session in `text`; `null` for what is not one. */
export function readSession(text: string | undefined): SavedSession | null {
  if (!text) return null;
  try {
    const stored = JSON.parse(text) as Partial<SavedSession> | null;
    if (!Array.isArray(stored?.windows)) return null;
    const windows = stored.windows.flatMap((each) => {
      if (typeof each?.id !== "number" || typeof each.active !== "number") return [];
      if (!Array.isArray(each.tabs)) return [];
      const tabs = (each.tabs as unknown[])
        .filter(isTab)
        .map((tab) => ({ ...tab, changes: readProfileChanges(tab.changes) }));
      return tabs.length > 0 ? [{ id: each.id, active: Math.max(0, each.active), tabs }] : [];
    });
    return windows.length > 0 ? { ...(stored.quit === true ? { quit: true } : {}), windows } : null;
  } catch {
    return null;
  }
}

/** `session` with the oldest lines of its longest tabs gone, until all of it fits in the store. */
export function fitSession(session: SavedSession, most = MOST_SESSION_BYTES): SavedSession {
  let current = session;
  while (bytesOf(current) > most) {
    let longest: SavedTab | null = null;
    for (const window of current.windows) {
      for (const tab of window.tabs) {
        if (!longest || tab.lines.length > longest.lines.length) longest = tab;
      }
    }
    if (!longest || longest.lines.length === 0) break;
    const shortened = longest;
    const drop = Math.max(1, Math.ceil(shortened.lines.length / 4));
    current = {
      ...current,
      windows: current.windows.map((window) => ({
        ...window,
        tabs: window.tabs.map((tab) =>
          tab === shortened ? { ...tab, lines: tab.lines.slice(drop) } : tab,
        ),
      })),
    };
  }
  return current;
}

/** The windows kept, on a served desktop. */
export function savedSession(): SavedSession | null {
  const session = servedByDesktopApp() ? readSession(readKeptText(SESSION_KEY)) : null;
  return session?.quit && desktopValues()[CLOSE_WINDOWS_KEY] !== false ? null : session;
}

/** Keeps `session`, or that nothing is open with `null`. Answers whether it was kept. */
export function keepSession(session: SavedSession | null): boolean {
  if (!servedByDesktopApp()) return false;
  if (!session) {
    if (readKeptText(SESSION_KEY) !== undefined) changeDesktopValue(SESSION_KEY, null);
    return true;
  }
  const text = JSON.stringify(fitSession(session));
  return readKeptText(SESSION_KEY) === text || keepText(SESSION_KEY, text);
}

/** The lines typed in this account's sessions, the oldest first. */
export function savedHistory(): string[] {
  if (!servedByDesktopApp()) return [];
  try {
    const stored: unknown = JSON.parse(readKeptText(HISTORY_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((line) => typeof line === "string") : [];
  } catch {
    return [];
  }
}

/** The history after `lines`, as much of the newest as the store holds. */
export function historyWith(history: readonly string[], lines: readonly string[]): string[] {
  let kept = [...history, ...lines].slice(-MOST_HISTORY_LINES);
  while (kept.length > 0 && bytesOf(kept) > MOST_HISTORY_BYTES) kept = kept.slice(1);
  return kept;
}

/** Adds lines typed just now to the account's history. */
export function keepHistory(lines: readonly string[]): void {
  if (lines.length === 0 || !servedByDesktopApp()) return;
  keepText(HISTORY_KEY, JSON.stringify(historyWith(savedHistory(), lines)));
}

/** Where a drive item is, as the shell names it, the Trash included; `undefined` when it is not there. */
export function shellPathOfItem(id: string): string | undefined {
  const drive = currentDrive();
  return drive ? pathOfEntry(driveTree(drive), id) : undefined;
}
