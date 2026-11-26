/** Where the window has been: pane ids, with `null` for the Show All grid. */
export interface PaneHistory {
  entries: readonly (string | null)[];
  /** The entry that is shown. */
  index: number;
}

export type PaneHistoryAction =
  | { type: "show"; pane: string | null }
  | { type: "restore"; pane: string }
  | { type: "back" }
  | { type: "forward" };

export function createHistory(pane: string | null): PaneHistory {
  return { entries: [pane], index: 0 };
}

/** The entry that is shown. */
export function currentPane(history: PaneHistory): string | null {
  return history.entries[history.index] ?? null;
}

/**
 * Browser-style history, as the Back and Forward buttons of System Preferences keep it:
 * showing a pane drops whatever lay ahead, and showing the pane that is already open does
 * nothing.
 */
export function historyReducer(history: PaneHistory, action: PaneHistoryAction): PaneHistory {
  switch (action.type) {
    case "show":
      if (currentPane(history) === action.pane) return history;
      return {
        entries: [...history.entries.slice(0, history.index + 1), action.pane],
        index: history.index + 1,
      };
    case "restore":
      return createHistory(action.pane);
    case "back":
      return history.index > 0 ? { ...history, index: history.index - 1 } : history;
    case "forward":
      return history.index < history.entries.length - 1
        ? { ...history, index: history.index + 1 }
        : history;
  }
}
