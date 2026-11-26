import type { DesktopDragItem } from "../desktop/desktop-drag";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import type { Place } from "./preview-places";

/**
 * Preview's windows, one per file, as on a Mac. A further window is the application's component
 * again (`newWindow` of `desktop-effects.ts`), given what it was opened for as `opening`. The desktop
 * brings windows back after a reload by their ids alone, so each keeps which file it shows among the
 * person's desktop values, under its window's id.
 */

export interface PreviewFileRef {
  id: string;
  name: string;
}

/** What the desktop is asked to make a further window. */
export type PreviewOpening =
  | { kind: "file"; file: PreviewFileRef; place?: Place }
  | { kind: "pictures"; files: readonly PreviewFileRef[] };

/** An open window, for the others to find. */
export interface OpenPreviewWindow {
  id: string;
  /** The drive file it holds, or is opening. */
  file?: string;
  /** Brings it to the front. */
  focus: () => void;
}

const openWindows = new Set<OpenPreviewWindow>();

/** Lists a window while it is open. Returns the cleanup. */
export function registerPreviewWindow(window: OpenPreviewWindow): () => void {
  openWindows.add(window);
  return () => {
    openWindows.delete(window);
  };
}

/** The window that takes the files sent to Preview: the one open longest. */
export const isFirstPreviewWindow = (window: OpenPreviewWindow) =>
  openWindows.values().next().value === window;

/** The other open window that holds the drive file `id`: a file has one window. */
export const otherWindowWithFile = (id: string, self: OpenPreviewWindow) =>
  [...openWindows].find((window) => window !== self && window.file === id);

const KEPT_FILES = "preview.windows";

const keptFiles = (): Readonly<Record<string, string>> => {
  const stored = desktopValues()[KEPT_FILES];
  return typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? (stored as Record<string, string>)
    : {};
};

/** The drive file the window `id` showed when the page was last here. */
export function keptFileOf(id: string): string | undefined {
  const file = keptFiles()[id];
  return typeof file === "string" ? file : undefined;
}

/** Notes which drive file the window `id` shows. */
export function keepFileOf(id: string, file: string): void {
  const files = keptFiles();
  if (files[id] !== file) changeDesktopValue(KEPT_FILES, { ...files, [id]: file });
}

/** Forgets a window that has closed. */
export function forgetFileOf(id: string): void {
  const { [id]: gone, ...rest } = keptFiles();
  if (gone !== undefined) changeDesktopValue(KEPT_FILES, rest);
}

/** Pages on their way out of a window's thumbnails: the browser's drag carries only text. */
export interface PagesOnTheWay {
  from: OpenPreviewWindow;
  item: () => DesktopDragItem | null;
  taken: boolean;
}

let pagesOnTheWay: PagesOnTheWay | null = null;

export const pagesDragged = () => pagesOnTheWay;
export const notePagesDragged = (drag: PagesOnTheWay | null) => {
  pagesOnTheWay = drag;
};
