import type { FinderCriterion } from "./finder-criteria";
import type { FinderView } from "./finder-data";

/** Where a search looks: the whole startup disk, or the folder the tab was showing. */
export type FinderScope = "mac" | "folder";

/** One tab of a Finder window: a folder with its own history, view, selection and search. */
export interface FinderTab {
  id: number;
  /** The locations visited, oldest first; `index` is the one shown. */
  history: readonly string[];
  index: number;
  view: FinderView;
  /** Paths of the selected items. */
  selection: readonly string[];
  /** Column view: the path of the selected item of each column. */
  columns: readonly string[];
  /** Column view: the selection was cleared, and `columns` is only where the view stands, until something is selected. */
  noneSelected?: boolean;
  /** List view: the paths of the expanded folders. */
  expanded: readonly string[];
  /** The text of the search field; a search is running while it is not empty. */
  query: string;
  /**
   * The folder that was shown when the search began, which the tab's own scope searches;
   * `null` when the search began in a place without a folder, such as Recents.
   */
  origin: string | null;
  scope: FinderScope;
  /** The criterion rows under the scope bar. A tab with any is searching, with or without a query. */
  rows: readonly FinderCriterion[];
}

/** What a tab holds, apart from its id in its window: what moves when it goes to another window. */
export type FinderTabContents = Omit<FinderTab, "id">;

export interface FinderState {
  tabs: readonly FinderTab[];
  /** The `id` of the tab shown. */
  active: number;
  /** The `id` the next new tab gets. */
  nextId: number;
}

export type FinderAction =
  | { type: "navigate"; location: string }
  | { type: "back" }
  | { type: "forward" }
  | {
      type: "view";
      view: FinderView;
      selection: readonly string[];
      columns?: readonly string[];
    }
  | { type: "expanded"; expanded: readonly string[]; selection: readonly string[] }
  | { type: "select"; selection: readonly string[] }
  | { type: "columns"; columns: readonly string[]; selection?: readonly string[] }
  | { type: "query"; query: string; origin: string | null }
  | { type: "scope"; scope: FinderScope }
  | { type: "rows"; rows: readonly FinderCriterion[]; origin: string | null }
  | { type: "new-tab"; location: string }
  | { type: "move-tab"; id: number; index: number }
  | { type: "add-tabs"; tabs: readonly FinderTabContents[] }
  | {
      type: "restore";
      tabs: readonly { location: string; view: FinderView }[];
      active: number;
    }
  | { type: "close-tab"; id: number }
  | { type: "activate-tab"; id: number }
  | { type: "evict"; from: string; to: string }
  | {
      type: "reconcile";
      tabs: readonly { id: number; selection: readonly string[]; columns: readonly string[] }[];
    };

const NO_SEARCH = { query: "", origin: null, scope: "folder", rows: [] } as const;

/** Whether a tab shows a search's results rather than a place. */
export const isSearching = (tab: Pick<FinderTab, "query" | "rows">): boolean =>
  tab.query !== "" || tab.rows.length > 0;

function createTab(id: number, location: string, view: FinderView): FinderTab {
  return {
    id,
    history: [location],
    index: 0,
    view,
    selection: [],
    columns: [],
    expanded: [],
    ...NO_SEARCH,
  };
}

/** A window with one tab per location, showing the tab at `active`. */
export function createState(
  locations: readonly string[],
  active: number,
  view: FinderView,
): FinderState {
  const tabs = locations.map((location, index) => createTab(index + 1, location, view));
  const shown = tabs[Math.min(Math.max(active, 0), tabs.length - 1)];
  return { tabs, active: shown?.id ?? 1, nextId: tabs.length + 1 };
}

/** The tab shown. A window always has one. */
export function activeTab(state: FinderState): FinderTab {
  return state.tabs.find((tab) => tab.id === state.active) ?? (state.tabs[0] as FinderTab);
}

/** The location a tab shows. */
export const locationOf = (tab: FinderTab) => tab.history[tab.index] as string;

export const canGoBack = (tab: FinderTab) => tab.index > 0;
export const canGoForward = (tab: FinderTab) => tab.index < tab.history.length - 1;

/** Showing another place ends the search and drops the selection, as in Finder. */
const arrive = (tab: FinderTab, index: number): FinderTab => ({
  ...tab,
  index,
  selection: [],
  columns: [],
  expanded: [],
  ...NO_SEARCH,
});

function reduceTab(tab: FinderTab, action: FinderAction): FinderTab {
  switch (action.type) {
    case "navigate": {
      if (action.location === locationOf(tab)) return arrive(tab, tab.index);
      const history = [...tab.history.slice(0, tab.index + 1), action.location];
      return arrive({ ...tab, history }, history.length - 1);
    }
    case "back":
      return canGoBack(tab) ? arrive(tab, tab.index - 1) : tab;
    case "forward":
      return canGoForward(tab) ? arrive(tab, tab.index + 1) : tab;
    case "view":
      // The caller gives the selection that the new view still shows and, entering column
      // view, the column path that shows it. A search keeps the path it began with, to open
      // the columns on it again when it ends; otherwise the path goes with the columns.
      return {
        ...tab,
        view: action.view,
        selection: action.selection,
        columns: action.columns ?? (isSearching(tab) ? tab.columns : []),
      };
    case "expanded":
      return { ...tab, expanded: action.expanded, selection: action.selection };
    case "select":
      return { ...tab, selection: action.selection };
    case "columns":
      return {
        ...tab,
        columns: action.columns,
        selection: action.selection ?? action.columns.slice(-1),
        noneSelected: action.selection?.length === 0,
      };
    case "query":
      // Clearing the field ends the search unless criterion rows keep it going. The first character
      // starts one in the folder then shown, which stays the search's own scope whatever the view
      // shows later. A changed query has other results, so nothing of the old ones stays selected.
      // A search that ends in another view than the columns leaves no column path behind.
      return action.query === "" && tab.rows.length === 0
        ? {
            ...tab,
            selection: [],
            columns: tab.view === "columns" ? tab.columns : [],
            ...NO_SEARCH,
          }
        : {
            ...tab,
            query: action.query,
            origin: isSearching(tab) ? tab.origin : action.origin,
            selection: [],
          };
    case "scope":
      return { ...tab, scope: action.scope, selection: [] };
    case "rows":
      // Taking away the last row of a search with no query ends it, as clearing the field does.
      return action.rows.length === 0 && tab.query === ""
        ? {
            ...tab,
            selection: [],
            columns: tab.view === "columns" ? tab.columns : [],
            ...NO_SEARCH,
          }
        : {
            ...tab,
            rows: action.rows,
            origin: isSearching(tab) ? tab.origin : action.origin,
            selection: [],
          };
    default:
      return tab;
  }
}

export function reduce(state: FinderState, action: FinderAction): FinderState {
  switch (action.type) {
    case "new-tab": {
      const tab = createTab(state.nextId, action.location, activeTab(state).view);
      return { tabs: [...state.tabs, tab], active: tab.id, nextId: state.nextId + 1 };
    }
    case "move-tab": {
      const moving = state.tabs.find((tab) => tab.id === action.id);
      if (!moving) return state;
      const rest = state.tabs.filter((tab) => tab !== moving);
      const index = Math.max(0, Math.min(action.index, rest.length));
      return { ...state, tabs: [...rest.slice(0, index), moving, ...rest.slice(index)] };
    }
    case "add-tabs": {
      const added = action.tabs.map((contents, index) => ({
        ...contents,
        id: state.nextId + index,
      }));
      return { ...state, tabs: [...state.tabs, ...added], nextId: state.nextId + added.length };
    }
    case "restore": {
      const tabs = action.tabs.map(({ location, view }, index) =>
        createTab(index + 1, location, view),
      );
      if (tabs.length === 0) return state;
      return {
        tabs,
        active: tabs[Math.min(action.active, tabs.length - 1)]?.id ?? 1,
        nextId: tabs.length + 1,
      };
    }
    case "close-tab": {
      const index = state.tabs.findIndex((tab) => tab.id === action.id);
      if (index < 0 || state.tabs.length === 1) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== action.id);
      // Closing the tab shown shows its neighbour: the next one, or the last.
      const active =
        state.active === action.id
          ? (tabs[Math.min(index, tabs.length - 1)] as FinderTab).id
          : state.active;
      return { ...state, tabs, active };
    }
    case "reconcile":
      // After a change of the tree: what each tab still shows of its selection and columns.
      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          const kept = action.tabs.find((item) => item.id === tab.id);
          return kept ? { ...tab, selection: kept.selection, columns: kept.columns } : tab;
        }),
      };
    case "evict": {
      // A disk has gone. A tab that shows it, or a folder on it, shows `to` instead, and no
      // tab keeps a place on the disk in its history: Back and Forward pass over them.
      const inside = (location: string) =>
        location === action.from || location.startsWith(`${action.from}/`);
      return {
        ...state,
        tabs: state.tabs.map((tab) => {
          if (!tab.history.some(inside)) return tab;
          const history: string[] = [];
          let index = 0;
          for (const [at, location] of tab.history.entries()) {
            const shown = at === tab.index;
            if (inside(location) && !shown) continue;
            const next = inside(location) ? action.to : location;
            // Two visits of one place that the disk stood between are one visit now.
            if (history[history.length - 1] !== next) history.push(next);
            if (shown) index = history.length - 1;
          }
          return inside(locationOf(tab))
            ? arrive({ ...tab, history }, index)
            : { ...tab, history, index };
        }),
      };
    }
    case "activate-tab":
      return state.tabs.some((tab) => tab.id === action.id)
        ? { ...state, active: action.id }
        : state;
    default: {
      const current = activeTab(state);
      const next = reduceTab(current, action);
      return next === current
        ? state
        : { ...state, tabs: state.tabs.map((tab) => (tab === current ? next : tab)) };
    }
  }
}
