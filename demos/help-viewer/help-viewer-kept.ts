import { type SetStateAction, useEffect, useRef, useState } from "react";
import { fitsDesktopValue } from "../desktop/desktop-kept-value";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { WELCOME } from "./help-viewer-data";

/*
 * What Help Viewer keeps among the person's desktop values beside the server's page last read: its
 * history and the rows open in its table of contents.
 */

/** One step of the history: a page of the guide, or the results of a search. */
export type Entry = { kind: "page"; id: string } | { kind: "search"; query: string };

export interface History {
  entries: readonly Entry[];
  index: number;
}

/** The history after going on to an entry: what lay ahead is dropped. */
export const advance = ({ entries, index }: History, entry: Entry): History => ({
  entries: [...entries.slice(0, index + 1), entry],
  index: index + 1,
});

/** The page last read: the shown page, or the one a search shown was started from. */
export function readingOf({ entries, index }: History): string {
  for (let at = index; at >= 0; at -= 1) {
    const visited = entries[at];
    if (visited?.kind === "page") return visited.id;
  }
  return WELCOME;
}

const isEntry = (value: unknown): value is Entry => {
  const entry = value as Partial<Record<"kind" | "id" | "query", unknown>> | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    ((entry.kind === "page" && typeof entry.id === "string") ||
      (entry.kind === "search" && typeof entry.query === "string"))
  );
};

// `useDesktopValue` reads on every render and an effect compares the result: one stored value has
// to read as one object.
const readHistories = new WeakMap<object, History>();
const readRows = new WeakMap<object, readonly string[]>();

/** A kept history, or `undefined` when any part of it cannot be read. */
export function readHistory(stored: unknown): History | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const known = readHistories.get(stored);
  if (known) return known;
  const { entries, index } = stored as Partial<History>;
  if (!Array.isArray(entries) || entries.length === 0 || !entries.every(isEntry)) return undefined;
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= entries.length) {
    return undefined;
  }
  const history = { entries, index: index as number };
  readHistories.set(stored, history);
  return history;
}

/** The rows kept open; anything that is not a row's id is left out. */
export function readExpandedRows(stored: unknown): readonly string[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  const known = readRows.get(stored);
  if (known) return known;
  const rows = stored.filter((row): row is string => typeof row === "string");
  readRows.set(stored, rows);
  return rows;
}

/**
 * The kept history with what the window opened on since: the same page keeps it as it stands, and
 * another page (read in another browser, or asked for by the Help menu) is a step after it. A
 * welcome page the window merely started on gives way to the kept history; `placeKnown` says the
 * server named the page shown, even if it is the welcome page.
 */
export function mergeHistory(kept: History, current: History, placeKnown = false): History {
  const shown = current.entries[current.index];
  const untouched =
    !placeKnown && current.index === 0 && shown?.kind === "page" && shown.id === WELCOME;
  if (!shown || untouched || (shown.kind === "page" && shown.id === readingOf(kept))) return kept;
  return advance(kept, shown);
}

/** The most recent part of a history that one desktop value holds, or `undefined` if none does. */
export function historyToKeep(history: History): History | undefined {
  let { entries, index } = history;
  while (!fitsDesktopValue({ entries, index })) {
    // What lies ahead goes before what lies behind, and the entry shown goes last.
    if (index < entries.length - 1) entries = entries.slice(0, -1);
    else if (index > 0) {
      entries = entries.slice(1);
      index -= 1;
    } else return undefined;
  }
  return { entries, index };
}

/**
 * State kept under `key` when the desktop serves the window. `change` is the person's: it is saved,
 * and a stored value that arrives later no longer takes its place. `set` is the window's own (what
 * it restores on opening), and is not saved until the person changes something. A stored value is
 * combined with the state by `merge`, because either can arrive first.
 */
export function useKeptState<T>(
  key: string,
  read: (stored: unknown) => T | undefined,
  initial: T | (() => T),
  merge: (kept: T, current: T) => T,
  toKeep: (value: T) => T | undefined = (value) => value,
) {
  const [value, set] = useState(initial);
  const stored = useDesktopValue<T | undefined>(key, read, undefined);
  const changed = useRef(false);
  // Taken once: another window of the app saves its own steps here, which this window does not follow.
  const adopted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a value that arrives is merged
  useEffect(() => {
    if (stored !== undefined && !changed.current && !adopted.current && servedByDesktopApp()) {
      adopted.current = true;
      set((current) => merge(stored, current));
    }
  }, [stored]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a change of the value is what is saved
  useEffect(() => {
    if (!changed.current || !servedByDesktopApp()) return;
    const kept = toKeep(value);
    if (kept !== undefined && fitsDesktopValue(kept)) changeDesktopValue(key, kept);
  }, [value]);
  const change = (next: SetStateAction<T>) => {
    changed.current = true;
    set(next);
  };
  return [value, change, set] as const;
}
