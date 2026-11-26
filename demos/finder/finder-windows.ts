import { useSyncExternalStore } from "react";
import type { FinderTab, FinderTabContents } from "./finder-state";

/**
 * The Finder windows on the page, so that Merge All Windows can gather their tabs. Each window
 * registers itself for as long as it is open.
 */

export interface FinderWindowHandle {
  /** The window's tabs, in order, all they hold but their ids. */
  tabs: () => readonly FinderTabContents[];
  /** Adds these tabs to the window. */
  take: (tabs: readonly FinderTabContents[]) => void;
  close: () => void;
}

const windows = new Set<FinderWindowHandle>();
const listeners = new Set<() => void>();

const changed = () => {
  for (const listener of listeners) listener();
};

export function registerFinderWindow(handle: FinderWindowHandle): () => void {
  windows.add(handle);
  changed();
  return () => {
    windows.delete(handle);
    changed();
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** How many Finder windows are open, which each of them hears as it changes. */
export const useFinderWindowCount = (): number =>
  useSyncExternalStore(
    subscribe,
    () => windows.size,
    () => 0,
  );

/** A tab's contents without its id, to go in another window. */
export const tabContents = ({ id: _id, ...contents }: FinderTab): FinderTabContents => contents;

const isTabContents = (value: object): value is FinderTabContents => {
  const { history, index, view, selection, columns, expanded } = value as Partial<FinderTab>;
  return (
    Array.isArray(history) &&
    history.length > 0 &&
    typeof index === "number" &&
    typeof view === "string" &&
    Array.isArray(selection) &&
    Array.isArray(columns) &&
    Array.isArray(expanded)
  );
};

/** The tab another window asked this one to show. */
export function readWindowOpening(opening: unknown): FinderTabContents | undefined {
  return typeof opening === "object" && opening !== null && isTabContents(opening)
    ? opening
    : undefined;
}

/** Every other window's tabs go to `into`, and those windows close. */
export function mergeFinderWindows(into: FinderWindowHandle): void {
  for (const other of [...windows]) {
    if (other === into) continue;
    into.take(other.tabs());
    other.close();
  }
}
