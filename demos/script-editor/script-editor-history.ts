import { useMemo } from "react";
import { keepText, readKeptText, useKeptTextValue } from "../desktop/desktop-kept-text";
import { desktopValues } from "../desktop/desktop-personal";

/** Log History: what each run gave, kept among the person's desktop values. */

const KEY = "scriptEditor.history";
const MOST_RESULT = 1000;
const MOST_LINES = 40;
const MOST_LINE = 200;

/** Preferences > History: whether runs are kept, and how many. */
export const HISTORY_ENABLED = "scriptEditor.historyEnabled";
export const HISTORY_MOST = "scriptEditor.historyMost";
export const HISTORY_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_HISTORY_SIZE = 25;
export const readHistorySize = (stored: unknown): number | undefined =>
  HISTORY_SIZES.find((size) => size === stored);

/** One run. */
export interface HistoryEntry {
  id: string;
  /** When it ran, in milliseconds since the epoch. */
  at: number;
  script: string;
  language: string;
  result: string;
  failed: boolean;
  log: readonly string[];
}

function parseEntries(text: string | undefined): readonly HistoryEntry[] {
  if (text === undefined) return [];
  try {
    const list: unknown = JSON.parse(text);
    return Array.isArray(list)
      ? list.filter(
          (entry): entry is HistoryEntry =>
            typeof entry?.id === "string" &&
            typeof entry.at === "number" &&
            typeof entry.script === "string" &&
            typeof entry.result === "string" &&
            Array.isArray(entry.log),
        )
      : [];
  } catch {
    return [];
  }
}

const entriesNow = () => parseEntries(readKeptText(KEY));

/** Writes `entries`, the oldest going first until they fit. */
function keep(entries: readonly HistoryEntry[]): void {
  let list = entries;
  while (!keepText(KEY, JSON.stringify(list)) && list.length > 0) {
    list = list.slice(0, Math.floor(list.length / 2));
  }
}

/** A run goes first in the history, unless Preferences turned the history off. */
export function noteRun(run: Omit<HistoryEntry, "id" | "at">): void {
  const values = desktopValues();
  if (values[HISTORY_ENABLED] === false) return;
  const most = readHistorySize(values[HISTORY_MOST]) ?? DEFAULT_HISTORY_SIZE;
  const at = Date.now();
  keep(
    [
      {
        ...run,
        id: `${at}-${Math.random().toString(36).slice(2, 8)}`,
        at,
        result: run.result.slice(0, MOST_RESULT),
        log: run.log.slice(-MOST_LINES).map((line) => line.slice(0, MOST_LINE)),
      },
      ...entriesNow(),
    ].slice(0, most),
  );
}

export const removeHistoryEntries = (ids: readonly string[]): void =>
  keep(entriesNow().filter((entry) => !ids.includes(entry.id)));

export const clearHistory = (): void => keep([]);

/** The runs kept, newest first. */
export function useLogHistory(): readonly HistoryEntry[] {
  const text = useKeptTextValue(KEY);
  return useMemo(() => parseEntries(text), [text]);
}
