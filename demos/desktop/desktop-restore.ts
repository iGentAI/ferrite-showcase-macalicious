/**
 * What comes back with the desktop on a served page: the windows that were open, each where it was,
 * and the applications set to open at login. Kept with the person's settings, per account. Each
 * application brings back its own contents.
 */

import { CLOSE_WINDOWS_KEY } from "../system-preferences/panes/general/document-settings";
import { changeDesktopValue, desktopValues } from "./desktop-personal";

export const DESKTOP_WINDOWS = "desktop.windows";
export const DOCK_OPEN_AT_LOGIN = "dock.openAtLogin";
/** The windows of the applications that quit while Close windows when quitting was off, by application. */
export const DESKTOP_QUIT_WINDOWS = "desktop.quitWindows";

export interface SavedAppWindow {
  id: string;
  app: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized?: boolean;
}

/** The most windows kept, and the bytes they may take: a setting holds at most 4096. */
const MOST_WINDOWS = 30;
const MOST_BYTES = 4000;

const WINDOW_ID = /^[a-z0-9-]{1,64}(:(window-)?[0-9]{1,6})?$/;

const isSavedWindow = (each: unknown): each is SavedAppWindow => {
  if (typeof each !== "object" || each === null) return false;
  const { id, app, x, y, width, height } = each as Partial<SavedAppWindow>;
  return (
    typeof id === "string" &&
    WINDOW_ID.test(id) &&
    typeof app === "string" &&
    WINDOW_ID.test(app) &&
    [x, y, width, height].every((part) => typeof part === "number" && Number.isFinite(part))
  );
};

/** The windows kept, in the order they were last key. */
export const readSavedWindows = (stored: unknown): readonly SavedAppWindow[] | undefined =>
  Array.isArray(stored) ? stored.filter(isSavedWindow) : undefined;

/** What fits in a setting, the newest windows first to stay: the last in the list was key last. */
export function keptWindows(windows: readonly SavedAppWindow[]): readonly SavedAppWindow[] {
  let kept = windows.slice(-MOST_WINDOWS);
  while (kept.length > 0 && new TextEncoder().encode(JSON.stringify(kept)).length > MOST_BYTES) {
    kept = kept.slice(1);
  }
  return kept;
}

/** A frame kept on another screen, moved so that its title bar can be reached on this one. */
export function fitFrame(
  { x, y, width, height }: { x: number; y: number; width: number; height: number },
  room: { width: number; height: number; top: number },
) {
  const keep = 80;
  // A window saved on a wider screen is no wider than this one, as AppKit constrains a restored frame to the screen.
  const fitted = width > room.width ? Math.max(160, room.width - 16) : width;
  return {
    x: Math.min(Math.max(x, keep - fitted), Math.max(0, room.width - keep)),
    y: Math.min(Math.max(y, room.top), Math.max(room.top, room.height - keep)),
    width: fitted,
    height,
  };
}

const ranThisTab = "macalicious.loginItemsRan";

function quitWindows(): Readonly<Record<string, readonly SavedAppWindow[]>> {
  const stored = desktopValues()[DESKTOP_QUIT_WINDOWS];
  if (typeof stored !== "object" || stored === null) return {};
  return Object.fromEntries(
    Object.entries(stored).flatMap(([app, windows]) => {
      const read = readSavedWindows(windows);
      return read ? [[app, read]] : [];
    }),
  );
}

/**
 * An application quits by the person's command: with General's Close windows when quitting off, its
 * windows are kept for when it opens again, and with it on (the default) what was kept goes. The
 * newest application's stay when they do not all fit in a setting.
 */
export function rememberQuitWindows(
  app: string,
  windows: readonly {
    id: string;
    frame: { x: number; y: number; width: number; height: number };
    minimized?: boolean;
  }[],
): void {
  const { [app]: earlier, ...others } = quitWindows();
  const keep = desktopValues()[CLOSE_WINDOWS_KEY] === false && windows.length > 0;
  if (!keep && !earlier) return;
  const kept: Record<string, readonly SavedAppWindow[]> = { ...others };
  if (keep) {
    kept[app] = windows.map(({ id, frame: { x, y, width, height }, minimized }) => ({
      id,
      app,
      x,
      y,
      width,
      height,
      ...(minimized ? { minimized: true } : {}),
    }));
  }
  for (const oldest of Object.keys(kept)) {
    if (new TextEncoder().encode(JSON.stringify(kept)).length <= MOST_BYTES) break;
    delete kept[oldest];
  }
  changeDesktopValue(DESKTOP_QUIT_WINDOWS, kept);
}

/** The windows to bring back as `app` opens, and nothing is kept of them after. */
export function takeQuitWindows(app: string): readonly SavedAppWindow[] {
  const { [app]: kept, ...others } = quitWindows();
  if (!kept) return [];
  changeDesktopValue(DESKTOP_QUIT_WINDOWS, others);
  return desktopValues()[CLOSE_WINDOWS_KEY] === false ? kept : [];
}

const ownWindows = new Map<string, readonly SavedAppWindow[]>();

/** For the desktop: the windows of `app` it brought back that the application itself opens. */
export function holdOwnWindows(app: string, windows: readonly SavedAppWindow[]): void {
  ownWindows.set(app, windows);
}

/** For an application that opens its own further windows, as it starts: those to open again. */
export function takeOwnWindows(app: string): readonly SavedAppWindow[] {
  const windows = ownWindows.get(app) ?? [];
  ownWindows.delete(app);
  return windows;
}

/**
 * Whether the login items are yet to open for `account` in this tab: a reload is no new login, and
 * `forgetLoginItems` marks the end of one. Answers once per account per tab until then.
 */
export function claimLoginItems(account: string): boolean {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(ranThisTab) ?? "[]");
    const claimed: unknown[] = Array.isArray(stored) ? stored : [];
    if (claimed.includes(account)) return false;
    sessionStorage.setItem(ranThisTab, JSON.stringify([...claimed, account]));
  } catch {
    return false;
  }
  return true;
}

/** The login window shows, so whoever signs in next is logging in anew. */
export function forgetLoginItems(): void {
  try {
    sessionStorage.removeItem(ranThisTab);
  } catch {
    // A tab that cannot keep the note opens no login items either (`claimLoginItems`).
  }
}

const journalKey = (account: string) => `macalicious.windows.${account}`;

/**
 * Notes the windows in this tab at once: a reload right after a change can overtake its save, and the
 * settings send nothing as a page goes (`synced-document.ts`).
 */
export function journalWindows(account: string, windows: readonly SavedAppWindow[]): void {
  try {
    sessionStorage.setItem(journalKey(account), JSON.stringify(windows));
  } catch {
    // A tab that cannot keep it comes back as the server last heard.
  }
}

/** The windows this tab last noted for `account`; `undefined` in a tab that noted none. */
export function journaledWindows(account: string): readonly SavedAppWindow[] | undefined {
  try {
    const stored = sessionStorage.getItem(journalKey(account));
    return stored === null ? undefined : readSavedWindows(JSON.parse(stored));
  } catch {
    return undefined;
  }
}
