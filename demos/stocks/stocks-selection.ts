/**
 * Which watchlist rows are selected and which symbol the pane shows, as a Mac list does it: a click
 * selects one row, Command-click adds or takes away a row, Shift-click and Shift-arrow select the
 * rows from the anchor to the row reached. `order` is the rows listed.
 */
export interface WatchlistSelection {
  symbols: readonly string[];
  /** The row a range starts from. */
  anchor?: string;
  /** The symbol the pane shows; `undefined` shows the news. */
  shown?: string;
}

/** One symbol shown and selected, or none: the news. */
export function only(symbol: string | undefined): WatchlistSelection {
  return symbol === undefined
    ? { symbols: [] }
    : { symbols: [symbol], anchor: symbol, shown: symbol };
}

function between(order: readonly string[], from: string, to: string): string[] {
  const start = order.indexOf(from);
  const end = order.indexOf(to);
  if (start < 0 || end < 0) return [to];
  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/** The selection after a click on the row `target`. */
export function clicked(
  state: WatchlistSelection,
  target: string,
  order: readonly string[],
  held: { shift: boolean; command: boolean },
): WatchlistSelection {
  if (held.shift && state.anchor !== undefined && order.includes(state.anchor))
    return { ...state, symbols: between(order, state.anchor, target), shown: target };
  if (!held.command) return only(target);
  if (!state.symbols.includes(target))
    return { symbols: [...state.symbols, target], anchor: target, shown: target };
  const symbols = state.symbols.filter((symbol) => symbol !== target);
  const last = symbols.at(-1);
  return {
    symbols,
    anchor: state.anchor === target ? last : state.anchor,
    shown: state.shown === target ? last : state.shown,
  };
}

/**
 * The selection after an arrow key: the row `by` rows from `from` (the row that has the keyboard,
 * else the one shown), held within the list. With nothing to start from, Down takes the first row
 * and Up the last. With `extend`, the rows from the anchor to the row reached are selected.
 */
export function stepped(
  state: WatchlistSelection,
  order: readonly string[],
  by: number,
  from: string | undefined,
  extend: boolean,
): WatchlistSelection {
  if (order.length === 0) return state;
  const at = from === undefined ? -1 : order.indexOf(from);
  const place = at < 0 ? (by > 0 ? 0 : order.length - 1) : at + by;
  const target = order[Math.max(0, Math.min(order.length - 1, place))] as string;
  if (!extend || state.anchor === undefined) return only(target);
  return { ...state, symbols: between(order, state.anchor, target), shown: target };
}

/** Every row listed selected; the symbol shown stays, else the first is shown. */
export function allOf(state: WatchlistSelection, order: readonly string[]): WatchlistSelection {
  const shown = state.shown !== undefined && order.includes(state.shown) ? state.shown : order[0];
  return { symbols: [...order], anchor: order[0], shown };
}

/**
 * The selection once `removed` have left the list. Removing the row shown shows the row that follows
 * it, or else the last one left, so the keyboard stays in the list; other rows leave the rest alone.
 */
export function afterRemoving(
  state: WatchlistSelection,
  removed: readonly string[],
  order: readonly string[],
): WatchlistSelection {
  const gone = new Set(removed);
  if (state.shown === undefined || !gone.has(state.shown)) {
    return { ...state, symbols: state.symbols.filter((symbol) => !gone.has(symbol)) };
  }
  const after = order.slice(order.indexOf(state.shown) + 1).find((symbol) => !gone.has(symbol));
  return only(after ?? order.filter((symbol) => !gone.has(symbol)).at(-1));
}
