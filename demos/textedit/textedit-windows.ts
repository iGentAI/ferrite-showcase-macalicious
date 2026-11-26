import { forgetKeptText, keepText, readKeptText } from "../desktop/desktop-kept-text";
import { changeDesktopValue, desktopValues, readIds } from "../desktop/desktop-personal";
import { DESKTOP_QUIT_WINDOWS } from "../desktop/desktop-restore";
import type { DriveFileRef } from "./textedit-files";

/**
 * TextEdit's several document windows. The desktop brings its windows back after a reload by their
 * ids (`desktop.windows`), without what they were opened for. The first window keeps its document in
 * the server's draft (`textedit-server.ts`), of which an account has one; each further window keeps
 * its own among the person's desktop values (`desktop-kept-text.ts`) under its window's id, and finds
 * it there when it comes back. Those values are limited, so such a window keeps 32 KB and there are
 * at most eight of them: past that it shows a banner, and its file, if it has one, holds its text.
 *
 * A further window the application quit with comes back when TextEdit opens again, with its document
 * (`takeWindowsToReopen`): the one General's Close windows when quitting keeps, and any that was closed
 * without asking, with nothing of TextEdit left open, while it held text no file holds.
 */

/** Where a window stands on the desktop. */
export interface TextEditFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the desktop is asked to make a further window (`newWindow` of `desktop-effects.ts`). */
export type TextEditOpening =
  | { kind: "new" }
  | { kind: "file"; file: DriveFileRef; asCode?: boolean }
  | { kind: "kept"; body: object; frame?: TextEditFrame };

/** The window id of TextEdit's first window, whose document is the server's draft. */
export const FIRST_WINDOW = "textedit";

const KEPT_WINDOWS = "textedit.windows";
const DESKTOP_WINDOWS = "desktop.windows";
const MOST_KEPT_WINDOWS = 8;
const MOST_KEPT_LENGTH = 32_000;

/** A window's id as a key among the desktop values: `textedit:2` is `textedit-2`. */
const keyOf = (windowId: string) => windowId.replace(/[^a-z0-9-]/g, "-");
const textKey = (windowId: string) => `textedit.window.${keyOf(windowId)}`;

const keptKeys = () => readIds(desktopValues()[KEPT_WINDOWS]) ?? [];

/** The kept windows the desktop still has: a window gone without closing leaves its record behind. */
function prunedKeys(): readonly string[] {
  const keys = keptKeys();
  const windows = desktopValues()[DESKTOP_WINDOWS];
  if (!Array.isArray(windows)) return keys;
  const open = new Set(windows.map((window: { id?: unknown }) => keyOf(String(window?.id))));
  return keys.filter((key) => {
    if (open.has(key)) return true;
    forgetKeptText(`textedit.window.${key}`);
    return false;
  });
}

/** Keeps a window's draft body. False when it is not kept: too long, or too many windows. */
export function keepWindow(windowId: string, body: object): boolean {
  const text = JSON.stringify(body);
  const key = keyOf(windowId);
  let keys = keptKeys();
  if (text.length > MOST_KEPT_LENGTH) return false;
  if (!keys.includes(key) && keys.length >= MOST_KEPT_WINDOWS) keys = prunedKeys();
  if (!keys.includes(key) && keys.length >= MOST_KEPT_WINDOWS) return false;
  if (!keepText(textKey(windowId), text)) return false;
  const next = keys.includes(key) ? keys : [...keys, key];
  changeDesktopValue(KEPT_WINDOWS, next);
  return true;
}

/** The draft body a window kept, as a `GET /draft` reply holds it; `null` when it kept none. */
export function readKeptWindow(windowId: string): unknown {
  const text = readKeptText(textKey(windowId));
  if (text === undefined) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Forgets a window that has closed. */
export function forgetWindow(windowId: string): void {
  const key = keyOf(windowId);
  const keys = keptKeys();
  if (keys.includes(key)) {
    changeDesktopValue(
      KEPT_WINDOWS,
      keys.filter((each) => each !== key),
    );
  }
  forgetKeptText(textKey(windowId));
}

const REOPEN_WINDOWS = "textedit.reopen";

const isFrame = (value: unknown): value is TextEditFrame => {
  const frame = value as Partial<TextEditFrame> | null;
  return (
    typeof frame === "object" &&
    frame !== null &&
    [frame.x, frame.y, frame.width, frame.height].every((each) => typeof each === "number")
  );
};

const frameOf = ({ x, y, width, height }: TextEditFrame): TextEditFrame => ({
  x,
  y,
  width,
  height,
});

/** The frame the desktop keeps for the window as TextEdit quits, when it keeps it. */
function frameKeptByQuit(windowId: string): TextEditFrame | undefined {
  const record = desktopValues()[DESKTOP_QUIT_WINDOWS] as { textedit?: unknown } | undefined;
  const windows = record?.textedit;
  if (!Array.isArray(windows)) return undefined;
  const found: unknown = windows.find((window: { id?: unknown }) => window?.id === windowId);
  return isFrame(found) ? frameOf(found) : undefined;
}

const windowsToReopen = (): readonly { key: string; frame?: TextEditFrame }[] => {
  const stored = desktopValues()[REOPEN_WINDOWS];
  return Array.isArray(stored)
    ? stored.filter((each) => typeof each === "object" && typeof each?.key === "string")
    : [];
};

function noteToReopen(windowId: string, frame?: TextEditFrame): void {
  if (windowId === FIRST_WINDOW) return;
  const key = keyOf(windowId);
  changeDesktopValue(REOPEN_WINDOWS, [
    ...windowsToReopen().filter((each) => each.key !== key),
    { key, ...(frame ? { frame } : undefined) },
  ]);
}

/**
 * A window with its own document has closed. Forgets its document, or keeps it for when TextEdit opens
 * again. `asked` says the person came through the window's own close, which asks about changes;
 * `anyLeft` says whether a document window of TextEdit is still open, once all that are closing have.
 */
export function windowClosed(
  windowId: string,
  {
    body,
    unsaved,
    asked,
    anyLeft,
  }: { body: object; unsaved: boolean; asked: boolean; anyLeft: () => boolean },
): void {
  const frame = frameKeptByQuit(windowId);
  if (frame) {
    keepWindow(windowId, body);
    noteToReopen(windowId, frame);
    return;
  }
  if (asked || !unsaved || !keepWindow(windowId, body)) {
    forgetWindow(windowId);
    return;
  }
  queueMicrotask(() => {
    if (anyLeft()) forgetWindow(windowId);
    else noteToReopen(windowId);
  });
}

/** As TextEdit opens: the openings of the windows it closed with, whose records are then forgotten. */
export function takeWindowsToReopen(): readonly TextEditOpening[] {
  const windows = windowsToReopen();
  if (windows.length === 0) return [];
  changeDesktopValue(REOPEN_WINDOWS, []);
  return windows.flatMap(({ key, frame }) => {
    const body = readKeptWindow(key);
    forgetWindow(key);
    if (typeof body !== "object" || body === null) return [];
    return [{ kind: "kept" as const, body, ...(isFrame(frame) ? { frame } : undefined) }];
  });
}

const FILE_FRAMES = "textedit.frames";
const MOST_FILE_FRAMES = 16;

const fileFrames = (): readonly (TextEditFrame & { file: string })[] => {
  const stored = desktopValues()[FILE_FRAMES];
  return Array.isArray(stored)
    ? stored.filter(
        (each) => isFrame(each) && typeof (each as { file?: unknown }).file === "string",
      )
    : [];
};

/** Where the drive file `file` was last shown, if it was moved. */
export function frameOfFile(file: string): TextEditFrame | undefined {
  const found = fileFrames().find((each) => each.file === file);
  return found ? frameOf(found) : undefined;
}

/** Keeps where the drive file `file` is shown, for the newest files. */
export function keepFrameOfFile(file: string, frame: TextEditFrame): void {
  const others = fileFrames().filter((each) => each.file !== file);
  changeDesktopValue(FILE_FRAMES, [
    ...others.slice(1 - MOST_FILE_FRAMES),
    { file, ...frameOf(frame) },
  ]);
}

/** An open document window, for the others to find. */
export interface OpenTextEditWindow {
  /** The drive file it holds now. */
  fileId: () => string | undefined;
  /** Brings it to the front. */
  focus: () => void;
}

const openWindows = new Set<OpenTextEditWindow>();

/** Lists a window while it is open. Returns the cleanup. */
export function registerWindow(window: OpenTextEditWindow): () => void {
  openWindows.add(window);
  return () => {
    openWindows.delete(window);
  };
}

/** The open window that holds the drive file `id`: a file has one window. */
export const windowWithFile = (id: string) =>
  [...openWindows].find((window) => window.fileId() === id);
