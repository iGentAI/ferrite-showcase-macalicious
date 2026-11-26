import { useState } from "react";
import { desktopPictureGeneration, useDesktopSetting } from "../desktop/desktop-personal";
import { type FinderCriterion, readCriterion } from "./finder-criteria";
import type { FinderSort, FinderView } from "./finder-data";
import type { FinderScope } from "./finder-state";

/**
 * What Finder keeps for the person on a served desktop: the desktop's settings (`desktop-personal.ts`)
 * under `finder.*`, per account. The server takes a setting of at most 4096 bytes and refuses the whole
 * save over that, so each list here stays under `MOST_BYTES`: windows and folders drop what was used
 * longest ago, which only costs how they look; a search that would not fit is refused.
 */

export const FINDER_WINDOW = "finder.window";
export const FINDER_FOLDERS = "finder.folders";
export const FINDER_SEARCHES = "finder.savedSearches";
export const FINDER_PATH_BAR = "finder.pathBar";
export const FINDER_STATUS_BAR = "finder.statusBar";
export const FINDER_SIDEBAR_SHOWN = "finder.sidebarShown";
export const FINDER_SIDEBAR_WIDTH = "finder.sidebarWidth";
export const FINDER_TOOLBAR = "finder.toolbar";
export const FINDER_TOOLBAR_ITEMS = "finder.toolbarItems";
export const FINDER_TOOLBAR_MODE = "finder.toolbarMode";
/** The rows of the sidebar's Favorites in the order the person dragged them to, by place or id. */
export const FINDER_SIDEBAR_ORDER = "finder.sidebarOrder";
export const FINDER_TAB_BAR = "finder.tabBar";
export const FINDER_PREVIEW = "finder.preview";
export const FINDER_DEFAULTS = "finder.defaults";
export const FINDER_FAVORITES = "finder.favorites";
export const FINDER_NEW_WINDOW = "finder.newWindow";
export const FINDER_HIDDEN_PLACES = "finder.hiddenPlaces";
/** Preferences' Sidebar pane: whether Locations lists the startup disk. A Mac leaves it out at first. */
export const FINDER_SIDEBAR_DISKS = "finder.sidebarDisks";
/** The row of Preferences' Sidebar pane that leaves out the whole Tags section. */
export const RECENT_TAGS = "Recent Tags";
/** The sidebar's sections hidden by the Hide that shows on their headings, by title. */
export const FINDER_HIDDEN_SECTIONS = "finder.hiddenSections";
export const FINDER_HIDDEN_TAGS = "finder.hiddenTags";
/** The tags left out of File's and the context menu's favourites, by name. */
export const FINDER_HIDDEN_MENU_TAGS = "finder.hiddenMenuTags";
export const FINDER_WARN_EMPTY = "finder.warnEmpty";
export const FINDER_WARN_EXTENSION = "finder.warnExtension";
export const FINDER_TRASH_AFTER_30 = "finder.trashAfter30";
export const FINDER_FOLDERS_FIRST = "finder.foldersFirst";
export const FINDER_SEARCH_SCOPE = "finder.searchScope";
export const FINDER_SHOW_HARD_DISKS = "finder.showHardDisks";
export const FINDER_SHOW_EXTERNAL = "finder.showExternal";
export const FINDER_RECENT_FOLDERS = "finder.recentFolders";
export const FINDER_SHOW_HIDDEN = "finder.showHidden";
/** The addresses of Connect to Server's Favorite Servers. */
export const FINDER_SERVERS = "finder.servers";
/** The rows of the sidebar a Mac leaves out at first, which Preferences' Sidebar pane adds, by label. */
export const FINDER_SHOWN_PLACES = "finder.shownPlaces";
export const OPTIONAL_PLACES: readonly string[] = ["Movies", "Music", "Pictures", "Home"];

/** How many folders Recent Folders keeps. */
const MOST_RECENT_FOLDERS = 10;

/** `recent` with `path` first, and the oldest gone past the most it keeps. */
export const withRecentFolder = (recent: readonly string[], path: string): readonly string[] =>
  [path, ...recent.filter((each) => each !== path)].slice(0, MOST_RECENT_FOLDERS);

export const NO_NAMES: readonly string[] = Object.freeze([]);
export const readText = (stored: unknown): string | undefined =>
  typeof stored === "string" ? stored : undefined;
export const readScope = (stored: unknown): FinderScope | undefined =>
  stored === "mac" || stored === "folder" ? stored : undefined;
export const readNames = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) && stored.every((name) => typeof name === "string")
    ? (stored as string[])
    : undefined;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** The items at the top of the Trash that went there more than 30 days before `now`. */
export const expiredTrash = (
  entries: readonly { id: string; trashed_ms?: number }[],
  now: number,
): string[] =>
  entries
    .filter(({ trashed_ms }) => trashed_ms !== undefined && now - trashed_ms > THIRTY_DAYS_MS)
    .map(({ id }) => id);

// What a Finder window is erasing now, so that no other window asks for it as well.
const erasing = new Set<string>();

/** Of `ids`, those no window is erasing yet, which this window now is. */
export function claimExpired(ids: readonly string[]): string[] {
  const free = ids.filter((id) => !erasing.has(id));
  for (const id of free) erasing.add(id);
  return free;
}

/** The request for `ids` has ended, however it went. */
export function releaseExpired(ids: readonly string[]): void {
  for (const id of ids) erasing.delete(id);
}

/** The media type of an alias: a small file that names the item it stands for, as JSON. */
export const ALIAS_TYPE = "application/x-macalicious-alias";

/** The ids of the folders the person added to the sidebar. */
export function readFavorites(stored: unknown): readonly string[] | undefined {
  return Array.isArray(stored) && stored.every((id) => typeof id === "string")
    ? (stored as string[])
    : undefined;
}

export const NO_FAVORITES: readonly string[] = Object.freeze([]);

/** `favorites` with more, in order, or `null` when they would not all fit a setting. */
export function withFavorites(
  favorites: readonly string[],
  more: readonly string[],
): readonly string[] | null {
  const next = [...new Set([...favorites, ...more])];
  return bytes(next) > MOST_BYTES ? null : next;
}

const MOST_BYTES = 3800;

/** The sidebar's rows in `order`; one it does not name, such as one added since, follows the others. */
export function inSidebarOrder<T extends { key: string }>(
  rows: readonly T[],
  order: readonly string[],
): T[] {
  const named = order.flatMap((key) => rows.filter((row) => row.key === key));
  return [...named, ...rows.filter((row) => !order.includes(row.key))];
}

/** Whether the sidebar's order fits a setting. */
export const sidebarOrderFits = (order: readonly string[]) => bytes(order) <= MOST_BYTES;

/** `favorites` with `id` put where `to` stands. */
export function withFavoriteMoved(favorites: readonly string[], id: string, to: string) {
  const from = favorites.indexOf(id);
  const at = favorites.indexOf(to);
  if (id === to || from < 0 || at < 0) return favorites;
  const rest = favorites.filter((each) => each !== id);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
const VIEWS: readonly FinderView[] = ["icons", "list", "columns", "gallery"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const readView = (value: unknown): FinderView | undefined =>
  VIEWS.includes(value as FinderView) ? (value as FinderView) : undefined;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** A setting a Finder window keeps on the drive, and only in the window elsewhere. */
export function useFinderSetting<T>(
  kept: boolean,
  key: string,
  read: (stored: unknown) => T | undefined,
  initial: T,
): [T, (next: T) => void] {
  const stored = useDesktopSetting(key, read, initial);
  const local = useState(initial);
  return kept ? stored : local;
}

/** The tabs of the window last used. */
export interface SavedWindow {
  tabs: readonly { location: string; view: FinderView }[];
  active: number;
}

export function readWindow(stored: unknown): SavedWindow | undefined {
  if (!isRecord(stored) || !Array.isArray(stored.tabs) || stored.tabs.length === 0)
    return undefined;
  const tabs = stored.tabs.flatMap((tab: unknown) => {
    if (!isRecord(tab) || typeof tab.location !== "string") return [];
    const view = readView(tab.view);
    return view ? [{ location: tab.location, view }] : [];
  });
  if (tabs.length === 0) return undefined;
  const active = typeof stored.active === "number" ? stored.active : 0;
  return { tabs, active: Math.min(Math.max(Math.trunc(active), 0), tabs.length - 1) };
}

/** The window's tabs as they can be kept: the tab shown stays, the last others go first. */
export function fitWindow(window: SavedWindow): SavedWindow {
  let { tabs, active } = window;
  while (bytes({ tabs, active }) > MOST_BYTES && tabs.length > 1) {
    const drop = active === tabs.length - 1 ? 0 : tabs.length - 1;
    tabs = tabs.filter((_, index) => index !== drop);
    if (drop < active) active -= 1;
  }
  return bytes({ tabs, active }) > MOST_BYTES ? { tabs: [], active: 0 } : { tabs, active };
}

// The session whose first Finder window took the saved tabs. The count of ended sessions tells a new
// person on the same page from the same one.
let restoredIn: number | null = null;

/** Whether this window is the session's first, which comes back as the last one was. */
export function claimWindowRestore(): boolean {
  const session = desktopPictureGeneration();
  if (restoredIn === session) return false;
  restoredIn = session;
  return true;
}

/** What a folder keeps for itself, by its id on the drive; also what Use as Defaults keeps. */
export interface FolderSettings {
  view?: FinderView;
  sort?: FinderSort;
  /** The items' sections: a column of `GROUPS`, or `none`. */
  group?: string;
  icon?: number;
  /** Icon view: points added to the width of a cell. */
  grid?: number;
  /** The size of the text of the items, in points. */
  text?: number;
  /** Icon view: a colour for the background, or `white` where a default has a colour. */
  background?: string;
  /** List view: the size of the icons, 16 or 32. */
  listIcon?: number;
  /** List view: the columns shown after Name. */
  columns?: readonly string[];
  relativeDates?: boolean;
  allSizes?: boolean;
  /** Column view: whether items show their icons. */
  showIcons?: boolean;
  /** Column view: whether the last column is the preview. */
  previewColumn?: boolean;
  /** Icon view: a line under each name that says what the item holds, or its picture's size. */
  itemInfo?: boolean;
  /** Icon view: whether a picture shows itself; without it, the document icon. */
  iconPreview?: boolean;
  /** Gallery view: the side of a thumbnail, in points. */
  thumbnail?: number;
}

export type FolderValues = Readonly<Record<string, FolderSettings>>;

export const NO_FOLDERS: FolderValues = Object.freeze({});

export const NO_SETTINGS: FolderSettings = Object.freeze({});

const BACKGROUND = /^#[0-9a-f]{6}$/i;

/** The settings of one folder: those it can read, without what it cannot. */
export function readFolderSettings(value: unknown): FolderSettings | undefined {
  if (!isRecord(value)) return undefined;
  const settings: FolderSettings = {};
  const view = readView(value.view);
  if (view) settings.view = view;
  const sort = value.sort;
  if (
    isRecord(sort) &&
    typeof sort.column === "string" &&
    (sort.direction === "ascending" || sort.direction === "descending")
  ) {
    settings.sort = { column: sort.column, direction: sort.direction };
  }
  if (typeof value.group === "string" && value.group.length <= 16) settings.group = value.group;
  for (const key of ["icon", "grid", "text", "listIcon", "thumbnail"] as const) {
    const number = value[key];
    if (typeof number === "number" && Number.isFinite(number)) settings[key] = number;
  }
  for (const key of [
    "relativeDates",
    "allSizes",
    "showIcons",
    "previewColumn",
    "itemInfo",
    "iconPreview",
  ] as const) {
    const flag = value[key];
    if (typeof flag === "boolean") settings[key] = flag;
  }
  if (
    typeof value.background === "string" &&
    (value.background === "white" || BACKGROUND.test(value.background))
  ) {
    settings.background = value.background;
  }
  if (Array.isArray(value.columns) && value.columns.every((each) => typeof each === "string")) {
    settings.columns = value.columns;
  }
  return settings;
}

export function readFolders(stored: unknown): FolderValues | undefined {
  if (!isRecord(stored)) return undefined;
  const folders: Record<string, FolderSettings> = {};
  for (const [id, value] of Object.entries(stored)) {
    const settings = readFolderSettings(value);
    if (settings) folders[id] = settings;
  }
  return folders;
}

/** `folders` with a change to one folder, which becomes the newest; the oldest go to make room. */
export function withFolder(
  folders: FolderValues,
  id: string,
  change: FolderSettings,
): FolderValues {
  const { [id]: current, ...others } = folders;
  const entries = [...Object.entries(others), [id, { ...current, ...change }] as const];
  while (entries.length > 1 && bytes(Object.fromEntries(entries)) > MOST_BYTES) entries.shift();
  const next = Object.fromEntries(entries);
  return bytes(next) > MOST_BYTES ? folders : next;
}

/** A search kept by the scope bar's Save button: a row of the sidebar that runs it again. */
export interface SavedSearch {
  id: string;
  /** The name the sidebar shows; none on one saved before Save asked for a name. */
  name?: string;
  /** The place the tab was showing, and the folder the search began in, if it had one. */
  location: string;
  origin: string | null;
  query: string;
  scope: FinderScope;
  rows: readonly FinderCriterion[];
  /** `false` when the person chose not to add it to the sidebar: Go's Saved Searches still lists it. */
  sidebar?: false;
}

export const NO_SEARCHES: readonly SavedSearch[] = Object.freeze([]);

/** The rows kept with a search: earlier searches kept words the name must hold as `terms`. */
function readRows(item: Record<string, unknown>): readonly FinderCriterion[] | null {
  if (Array.isArray(item.rows)) return item.rows.flatMap((row) => readCriterion(row) ?? []);
  if (!Array.isArray(item.terms)) return null;
  return item.terms.flatMap((term) =>
    typeof term === "string" ? [{ field: "name" as const, op: "contains", value: term }] : [],
  );
}

export function readSearches(stored: unknown): readonly SavedSearch[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((item: unknown): SavedSearch[] => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.location !== "string" ||
      typeof item.query !== "string" ||
      !(item.origin === null || typeof item.origin === "string") ||
      !(item.scope === "mac" || item.scope === "folder")
    ) {
      return [];
    }
    const rows = readRows(item);
    if (!rows) return [];
    return [
      {
        id: item.id,
        ...(typeof item.name === "string" ? { name: item.name } : null),
        location: item.location,
        origin: item.origin,
        query: item.query,
        scope: item.scope,
        rows,
        ...(item.sidebar === false ? { sidebar: false as const } : null),
      },
    ];
  });
}

/**
 * `searches` with one more, under an id no other has. `null` when they would not all fit a setting: a
 * saved search is the person's own, and no other is dropped to make room.
 */
export function withSearch(
  searches: readonly SavedSearch[],
  search: Omit<SavedSearch, "id">,
): readonly SavedSearch[] | null {
  const taken = searches.map((item) => Number(item.id.slice("saved:".length)) || 0);
  const next = [...searches, { ...search, id: `saved:${Math.max(0, ...taken) + 1}` }];
  return bytes(next) > MOST_BYTES ? null : next;
}

/** `searches` with the one of `id` changed. `null` when they would no longer fit a setting. */
export function withChangedSearch(
  searches: readonly SavedSearch[],
  id: string,
  change: Partial<Omit<SavedSearch, "id" | "sidebar">> & { sidebar?: false | undefined },
): readonly SavedSearch[] | null {
  const next = searches.map((item) => {
    if (item.id !== id) return item;
    const { sidebar, ...rest } = { ...item, ...change };
    return sidebar === false ? { ...rest, sidebar } : rest;
  });
  return bytes(next) > MOST_BYTES ? null : next;
}
