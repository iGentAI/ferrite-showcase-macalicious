"use client";

import { DesktopIcon } from "macalicious/desktop-icon";
import { DesktopStack } from "macalicious/desktop-stack";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ItemIcon } from "../finder/finder-artwork";
import { carriesClipping, clippingFile } from "../finder/finder-clipping";
import { useCustomIcon } from "../finder/finder-custom-icon";
import {
  type FinderEntry,
  type FinderNode,
  formatSize,
  HOME,
  isContainer,
  listing,
  resolve,
  sortDirection,
} from "../finder/finder-data";
import { driveTree, pathOfEntry, stampOf } from "../finder/finder-drive";
import { beginMarquee } from "../finder/finder-marquee";
import { openFile, showInFinder } from "../finder/finder-open";
import { FinderRenameField } from "../finder/finder-rename";
import { runUndoable } from "../finder/finder-undo";
import { copiedDriveItems, copyDriveItems, useCopiedDriveItems } from "./desktop-clipboard";
import {
  APPLICATION_NOT_HERE,
  beginDesktopDrag,
  type DesktopDrag,
  type DesktopDragItem,
  draggingApplication,
  filesOfDrag,
  registerDropTarget,
} from "./desktop-drag";
import {
  type Drive,
  driveAvailable,
  entryOf,
  loadDrive,
  readFile,
  uploadFile,
  useDrive,
} from "./desktop-files";
import { quickLookAlone } from "./desktop-hidden";
import {
  cleanedUp,
  type IconGrid,
  type IconPlace,
  type IconPlaces,
  inOrder,
  movedPlaces,
  newestArrivalsFirst,
  placedAt,
  placesForItems,
  placesToShow,
  readIconPlaces,
  rescaledPlaces,
} from "./desktop-icon-places";
import {
  desktopValuesLoaded,
  readBoolean,
  subscribeDesktopValues,
  useDesktopSetting,
} from "./desktop-personal";
import { currentDesktopSession } from "./desktop-server";
import { DesktopViewOptions } from "./desktop-view-options";
import {
  cellOfView,
  DESKTOP_VIEW_DEFAULTS,
  type DesktopViewSettings,
  keepsDefaultLook,
  readDesktopView,
  showDesktopViewOptions,
  useDesktopViewOptionsShown,
} from "./desktop-view-settings";

/**
 * The Desktop folder of the person's drive, on the desktop itself: each item an icon that selects,
 * opens, renames, drags and has a menu, and a press on the picture that moves draws a rubber band.
 * Only the desktop that Ferrite serves has a drive; elsewhere nothing here is shown.
 */

const DESKTOP_FOLDER = "desktop";
const DESKTOP_PATH = `${HOME}/Desktop`;

const USE_STACKS = "desktop.useStacks";
const DESKTOP_SORT = "desktop.sortBy";
const DESKTOP_STACK_BY = "desktop.stackBy";
/** When each item of the Desktop folder got there, by its id, in epoch milliseconds. */
const DESKTOP_ADDED = "desktop.addedAt";
/** Where each icon stands while the desktop sorts by nothing or to the grid, by its id. */
const DESKTOP_PLACES = "desktop.iconPlaces";
const DESKTOP_VIEW = "desktop.viewOptions";
const DESKTOP_VIEW_WINDOW = "desktop.viewOptionsWindow";
const VIEW_WINDOW_DEFAULT: ViewWindow = { shown: false, x: 0, y: 0 };
/** Whether the View Options window is open and how far it stands from where it opens. */
interface ViewWindow {
  shown: boolean;
  x: number;
  y: number;
}
const readViewWindow = (stored: unknown): ViewWindow | undefined => {
  const kept = stored as Partial<ViewWindow> | null;
  return kept &&
    typeof kept.shown === "boolean" &&
    typeof kept.x === "number" &&
    typeof kept.y === "number"
    ? (kept as ViewWindow)
    : undefined;
};

const NO_PLACES: IconPlaces = Object.freeze({});

/** From the top and the trailing edge of the usable area to the first cell (`desktop.css`). */
const GRID_MARGIN = 7.5;

/** The largest picture read for Show icon preview: each one is held in memory while it shows. */
const PREVIEW_LIMIT = 8_000_000;

const ARRANGEMENTS = [
  { column: "none", label: "None" },
  { column: "grid", label: "Snap to Grid" },
] as const;

const SORTS = [
  { column: "name", label: "Name" },
  { column: "kind", label: "Kind" },
  { column: "opened", label: "Date Last Opened" },
  { column: "added", label: "Date Added" },
  { column: "modified", label: "Date Modified" },
  { column: "created", label: "Date Created" },
  { column: "size", label: "Size" },
  { column: "tags", label: "Tags" },
] as const;

const readSort = (stored: unknown): string | undefined =>
  [...ARRANGEMENTS, ...SORTS].some(({ column }) => column === stored)
    ? (stored as string)
    : undefined;

const isArranged = (sort: string) => ARRANGEMENTS.some(({ column }) => column === sort);

type Cell = ReturnType<typeof cellOfView>;

function gridOf(root: HTMLElement, cell: Cell): IconGrid {
  const style = getComputedStyle(root);
  const inset = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
  return {
    cellWidth: cell.width,
    cellHeight: cell.height,
    startRight: GRID_MARGIN,
    startTop: inset("--mac-desktop-inset-top") + GRID_MARGIN,
    width: root.clientWidth,
    height: root.clientHeight - inset("--mac-desktop-inset-bottom"),
  };
}

/**
 * Where `ids` are shown now. A window smaller than when an icon was placed shows it at the edge, with
 * its place kept for a larger one; a drag starts from where the person sees it.
 */
function shownPlaces(root: HTMLElement, ids: readonly string[]): Record<string, IconPlace> {
  const { right, top } = root.getBoundingClientRect();
  return Object.fromEntries(
    ids.flatMap((id) => {
      const icon = root.querySelector(`:scope > .mac-desktop-icon[data-value="${CSS.escape(id)}"]`);
      if (!icon) return [];
      const box = icon.getBoundingClientRect();
      return [[id, { right: right - box.right, top: box.top - top }]];
    }),
  );
}

/** The cells the disks stand in, which are not the person's to move. */
function reservedOf(root: HTMLElement): IconPlace[] {
  const { right, top } = root.getBoundingClientRect();
  return [...root.querySelectorAll(":scope > .mac-desktop-icon:not([data-drive-item])")].map(
    (icon) => {
      const box = icon.getBoundingClientRect();
      return { right: right - box.right, top: box.top - top };
    },
  );
}

/** Group Stacks By. */
const STACK_BYS = [
  { by: "kind", label: "Kind" },
  { by: "opened", label: "Date Last Opened" },
  { by: "added", label: "Date Added" },
  { by: "modified", label: "Date Modified" },
  { by: "created", label: "Date Created" },
  { by: "tags", label: "Tags" },
] as const;

const readStackBy = (stored: unknown): string | undefined =>
  STACK_BYS.some(({ by }) => by === stored) ? (stored as string) : undefined;

/** The times an item got to the Desktop folder, as the setting holds them. */
export type DesktopArrivals = Readonly<Record<string, number>>;

const readArrivals = (stored: unknown): DesktopArrivals | undefined =>
  stored && typeof stored === "object" && !Array.isArray(stored)
    ? (stored as DesktopArrivals)
    : undefined;

/**
 * The arrival times for the items now in the folder. The drive does not record a move, so an item
 * not seen here before arrived now; the first time, with nothing kept, each has been here since it
 * was made. Answers `kept` itself when nothing changed.
 */
export function arrivals(
  kept: DesktopArrivals | undefined,
  entries: readonly FinderEntry[],
  now: number,
): DesktopArrivals {
  const next: Record<string, number> = {};
  for (const { node } of entries) {
    if (!node.id) continue;
    const made = node.created ? new Date(node.created.replace(" ", "T")).getTime() : Number.NaN;
    next[node.id] = kept?.[node.id] ?? (!kept && Number.isFinite(made) ? made : now);
  }
  const ids = Object.keys(next);
  return kept && ids.length === Object.keys(kept).length && ids.every((id) => id in kept)
    ? kept
    : next;
}

const DATE_STACKS = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Earlier"];

/** The stack of a date in the tree's `YYYY-MM-DD HH:MM` form, seen from `now`. */
function dateStack(stamp: string | undefined, now: Date): string {
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const when = stamp ? new Date(stamp.replace(" ", "T")) : null;
  if (!when || Number.isNaN(when.getTime())) return "Earlier";
  const days = Math.round((day(now).getTime() - day(when).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 Days";
  return days < 30 ? "Previous 30 Days" : "Earlier";
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** What Show item info says of an item, if it has anything to say. */
export function itemInfo(node: FinderEntry["node"]): string | undefined {
  if (node.children) {
    const count = node.children.filter((child) => !child.hidden).length;
    return `${count} ${count === 1 ? "item" : "items"}`;
  }
  return node.dimensions ?? (node.size === undefined ? undefined : formatSize(node.size));
}

/** An item's icon: under Show icon preview, a picture is its own. */
export function DriveItemIcon({
  node,
  size,
  preview,
}: {
  node: FinderEntry["node"];
  size: number;
  preview: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const custom = useCustomIcon(node.id);
  const reads =
    preview && !custom && node.kind === "image" && node.id && (node.size ?? 0) <= PREVIEW_LIMIT
      ? node.id
      : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a file saved over keeps its id.
  useEffect(() => {
    if (!reads) return;
    const reading = new AbortController();
    let made: string | null = null;
    // A picture that cannot be read keeps the drawn icon: the desktop has nothing else to say about it.
    void readFile(reads, { signal: reading.signal })
      .then((blob) => {
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => undefined);
    return () => {
      reading.abort();
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [reads, node.modified, node.size]);
  return url ? (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  ) : (
    <ItemIcon node={node} size={size} />
  );
}

/** The stack an item goes in, by what it is. */
function kindStack(entry: FinderEntry): string {
  switch (entry.node.kind) {
    case "folder":
      return "Folders";
    case "image":
      return "Images";
    case "pdf":
      return "PDF Documents";
    case "movie":
      return "Movies";
    case "audio":
      return "Music";
    case "document":
      return "Documents";
    default:
      return "Other";
  }
}

/** The stack an item goes in under Group Stacks By `by`. */
export function stackOf(
  entry: FinderEntry,
  by: string,
  now: Date,
  added: DesktopArrivals = {},
): string {
  const { node } = entry;
  switch (by) {
    case "opened":
      return dateStack(node.opened, now);
    case "modified":
      return dateStack(node.modified, now);
    case "added":
      return dateStack(stampOf(added[node.id ?? ""]) ?? node.created, now);
    case "created":
      return dateStack(node.created, now);
    case "tags":
      return node.tags?.[0] ?? "No Tags";
    default:
      return kindStack(entry);
  }
}

/** The stacks of `entries`, in the order they show: dates in time, and items with no tag last. */
export function stacksOf(
  entries: readonly FinderEntry[],
  by: string,
  now: Date,
  added: DesktopArrivals = {},
) {
  const named = new Map<string, FinderEntry[]>();
  for (const entry of entries) {
    const name = stackOf(entry, by, now, added);
    named.set(name, [...(named.get(name) ?? []), entry]);
  }
  const rank = (name: string) => {
    if (by === "tags") return name === "No Tags" ? 1 : 0;
    return by === "kind" ? 0 : DATE_STACKS.indexOf(name);
  };
  return [...named].sort(([a], [b]) => rank(a) - rank(b));
}

const asDragItem = (drive: Drive | null, id: string): DesktopDragItem[] => {
  const entry = drive ? entryOf(drive, id) : undefined;
  return entry
    ? [{ id: entry.id, name: entry.name, kind: entry.kind, type: entry.type, size: entry.size }]
    : [];
};

export interface DesktopDriveItems {
  /** Whether the desktop shows the person's drive. */
  shown: boolean;
  /** The icons, for the `Desktop`'s children. */
  icons: ReactNode;
  /** What the `Desktop` takes: its selection. */
  value: readonly string[];
  onValueChange: (value: readonly string[]) => void;
  /** Rows of the menu a secondary click on the desktop shows. */
  menu: ReactNode;
  /** What a secondary click is on: to be called before the menu opens. */
  onContextMenu: (target: EventTarget) => void;
  /** Why a change of the drive failed, for an alert; `null` when nothing did. */
  failure: string | null;
  clearFailure: () => void;
  /** The Replace alert's question about a drop, while it waits for an answer. */
  replacing: DropQuestion | null;
  /** The rename field, while one is open. */
  overlay: ReactNode;
  /** The attributes View Options puts on the `Desktop`, and its custom properties. */
  surface: { attributes: Record<string, string>; style: CSSProperties };
  /** The View Options window, while it is open. */
  viewOptions: ReactNode;
}

/** A dropped item the folder already has one of its name, and what to do about it. */
export interface DropQuestion {
  node: FinderNode;
  moving: boolean;
  answer: (choice: "replace" | "keep" | "stop") => void;
}

/** The person's Desktop folder, for the `Desktop` element at `element`. */
export function useDesktopDriveItems(
  element: RefObject<HTMLElement | null>,
  onChangePicture: () => void,
): DesktopDriveItems {
  const shown = driveAvailable();
  const drive = useDrive(shown);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<DropQuestion | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [useStacks, setUseStacks] = useDesktopSetting(USE_STACKS, readBoolean, false);
  const [sortColumn, setSortColumn] = useDesktopSetting(DESKTOP_SORT, readSort, "none");
  const [places, setPlaces] = useDesktopSetting<IconPlaces>(
    DESKTOP_PLACES,
    readIconPlaces,
    NO_PLACES,
  );
  const arranged = isArranged(sortColumn);
  const placing = arranged && !useStacks;
  const [view, setView] = useDesktopSetting<DesktopViewSettings>(
    DESKTOP_VIEW,
    readDesktopView,
    DESKTOP_VIEW_DEFAULTS,
  );
  const viewOptionsShown = useDesktopViewOptionsShown();
  const [viewWindow, setViewWindow] = useDesktopSetting(
    DESKTOP_VIEW_WINDOW,
    readViewWindow,
    VIEW_WINDOW_DEFAULT,
  );
  useEffect(() => {
    if (viewWindow.shown) showDesktopViewOptions(true);
  }, [viewWindow.shown]);
  const viewShownBefore = useRef(viewOptionsShown);
  // biome-ignore lint/correctness/useExhaustiveDependencies: written when the window is shown or hidden, not when it moves.
  useEffect(() => {
    if (viewShownBefore.current === viewOptionsShown) return;
    viewShownBefore.current = viewOptionsShown;
    setViewWindow({ ...viewWindow, shown: viewOptionsShown });
  }, [viewOptionsShown]);
  const { width: cellWidth, height: cellHeight } = cellOfView(view);
  const cell = useMemo(() => ({ width: cellWidth, height: cellHeight }), [cellWidth, cellHeight]);
  const pressedAt = useRef({ x: 0, y: 0 });
  // A drag let go over the icon it started on ends in a click, which is not a choice of that icon.
  const dragged = useRef(false);
  // The desktop as it is now, which says where an icon past the window shows. Its children change when
  // the disks come and go.
  const [desk, setDesk] = useState<{ grid: IconGrid; reserved: IconPlace[] } | null>(null);
  useEffect(() => {
    const root = element.current;
    if (!shown || !root) return;
    const measure = () => {
      const now = { grid: gridOf(root, cell), reserved: reservedOf(root) };
      setDesk((was) => (JSON.stringify(was) === JSON.stringify(now) ? was : now));
    };
    measure();
    const children = new MutationObserver(measure);
    children.observe(root, { childList: true });
    const size = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    size?.observe(root);
    return () => {
      children.disconnect();
      size?.disconnect();
    };
  }, [shown, element, cell]);
  const [stackBy, setStackBy] = useDesktopSetting(DESKTOP_STACK_BY, readStackBy, "kind");
  const copied = useCopiedDriveItems();
  const [onItem, setOnItem] = useState(false);

  const act = useCallback(<T,>(work: Promise<T>) => {
    return work.catch((error) => {
      setFailure(messageOf(error));
      return undefined;
    });
  }, []);

  // Reading the drive is nobody's request: its failure shows no alert, and the Desktop folder's items stay away.
  useEffect(() => {
    if (shown) void loadDrive().catch(() => undefined);
  }, [shown]);

  const tree = useMemo(() => (shown ? driveTree(drive, {}) : null), [shown, drive]);
  const [added, setAdded] = useDesktopSetting<DesktopArrivals | undefined>(
    DESKTOP_ADDED,
    readArrivals,
    undefined,
  );
  const sorted = useCallback(
    (column: string) => {
      if (!tree) return [];
      const by = isArranged(column) || column === "added" ? "name" : column;
      const listed = listing(tree, DESKTOP_PATH, { column: by, direction: sortDirection(by) });
      if (column !== "added") return listed;
      const ids = listed.flatMap(({ node }) => node.id ?? []);
      const order = new Map(newestArrivalsFirst(ids, added ?? {}).map((id, at) => [id, at]));
      return [...listed].sort(
        (a, b) => (order.get(a.node.id ?? "") ?? 0) - (order.get(b.node.id ?? "") ?? 0),
      );
    },
    [tree, added],
  );
  const entries = useMemo(() => sorted(sortColumn), [sorted, sortColumn]);
  const showing = useMemo(
    () =>
      desk
        ? placesToShow(
            places,
            entries.flatMap(({ node }) => node.id ?? []),
            desk.grid,
            desk.reserved,
          )
        : places,
    [places, entries, desk],
  );
  // What the drive no longer has is not selected.
  const present = useMemo(() => new Set(entries.flatMap(({ node }) => node.id ?? [])), [entries]);

  // The settings say what arrived before: nothing is noted until they have loaded.
  const settingsLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  useEffect(() => {
    if (!drive || !settingsLoaded) return;
    const next = arrivals(added, entries, Date.now());
    if (next !== added) setAdded(next);
  }, [drive, settingsLoaded, entries, added, setAdded]);
  // Each item has a place while the desktop keeps places: a new one the first free cell.
  useEffect(() => {
    const root = element.current;
    if (!placing || !drive || !settingsLoaded || !root) return;
    const ids = entries.flatMap(({ node }) => node.id ?? []);
    const next = placesForItems(places, ids, gridOf(root, cell), reservedOf(root));
    if (next !== places) setPlaces(next);
  }, [placing, drive, settingsLoaded, element, entries, places, setPlaces, cell]);
  const selected = useMemo(() => selection.filter((id) => present.has(id)), [selection, present]);

  const open = useCallback((entry: FinderEntry) => {
    const { id, name, type } = entry.node;
    if (!id) return;
    if (isContainer(entry.node)) {
      showInFinder({ place: entry.path });
      return;
    }
    if (!openFile({ id, name, type })) quickLookAlone(id);
  }, []);

  const current = useRef({
    selected,
    entries,
    drive,
    open,
    useStacks,
    placing,
    sortColumn,
    places,
    cell,
    viewOptionsShown,
  });
  current.current = {
    selected,
    entries,
    drive,
    open,
    useStacks,
    placing,
    sortColumn,
    places,
    cell,
    viewOptionsShown,
  };

  const trash = useCallback(
    (ids: readonly string[]) => {
      if (ids.length === 0) return;
      void act(
        runUndoable(
          "Move",
          ids.map((id) => ({ op: "trash" as const, id })),
        ),
      );
    },
    [act],
  );

  const paste = useCallback(() => {
    const items = copiedDriveItems();
    if (items.length === 0) return;
    void act(
      runUndoable(
        "Copy",
        items.map((item) => ({
          op: "copy" as const,
          id: item.id,
          parent: DESKTOP_FOLDER,
          existing: "rename" as const,
        })),
      ),
    ).then((made) => {
      if (made?.created) setSelection(made.created);
    });
  }, [act]);

  const duplicate = useCallback(
    (ids: readonly string[]) => {
      void act(
        runUndoable(
          "Duplicate",
          ids.map((id) => ({
            op: "copy" as const,
            id,
            parent: DESKTOP_FOLDER,
            existing: "rename" as const,
          })),
        ),
      ).then((made) => {
        if (made?.created) setSelection(made.created);
      });
    },
    [act],
  );

  // A press on an icon that moves drags what is selected; on the picture it draws a band.
  useEffect(() => {
    const root = element.current;
    if (!shown || !root) return;
    const press = (down: PointerEvent) => {
      if (down.button !== 0 || !(down.target instanceof Element)) return;
      dragged.current = false;
      const icon = down.target.closest<HTMLElement>(".mac-desktop-icon[data-drive-item]");
      if (icon) {
        pressedAt.current = { x: down.clientX, y: down.clientY };
        const pressed = icon.dataset.value ?? "";
        const held = current.current.selected;
        const ids = held.includes(pressed) ? held : [pressed];
        beginDesktopDrag(down, {
          from: "desktop",
          icon: icon.querySelector(".mac-desktop-icon-image > *"),
          items: () => ids.flatMap((id) => asDragItem(current.current.drive, id)),
          trash: (dragged) => trash(dragged),
          onStart() {
            dragged.current = true;
            setSelection(ids);
          },
        });
        return;
      }
      if (down.target !== root) return;
      const kept =
        down.shiftKey || down.metaKey || down.ctrlKey ? [...current.current.selected] : [];
      beginMarquee(down, {
        container: root,
        kept,
        before: [...current.current.selected],
        items: () =>
          [...root.querySelectorAll<HTMLElement>(".mac-desktop-icon[data-drive-item]")].map(
            (each) => ({ path: each.dataset.value ?? "", element: each }),
          ),
        onChange: (ids) => setSelection(ids),
      });
    };
    root.addEventListener("pointerdown", press, true);
    return () => root.removeEventListener("pointerdown", press, true);
  }, [shown, element, trash]);

  // A drop on the desktop goes in the Desktop folder, or in the folder icon it landed on.
  useEffect(() => {
    const root = element.current;
    if (!shown || !root) return;
    return registerDropTarget({
      element: root,
      landing(hit, dragging: DesktopDrag) {
        if (draggingApplication(dragging.items)) {
          return {
            element: root,
            refusal: APPLICATION_NOT_HERE,
            sayRefusal: setFailure,
            drop: () => {},
          };
        }
        const icon = hit.closest<HTMLElement>(".mac-desktop-icon[data-drive-item]");
        const on = icon?.dataset.value;
        // A folder among what is dragged is no place to drop: the drag repositions the selection.
        const folder =
          on &&
          icon &&
          !dragging.items.some((item) => item.id === on) &&
          current.current.entries.some(({ node }) => node.id === on && isContainer(node))
            ? on
            : DESKTOP_FOLDER;
        const outside = dragging.items.filter((item) => item.bytes);
        if (outside.length > 0) {
          return {
            element: folder === DESKTOP_FOLDER ? root : (icon ?? root),
            copies: true,
            drop() {
              const at = dragging.at;
              const box = root.getBoundingClientRect();
              const { cell: room } = current.current;
              // The account that took the drop keeps the copy, whoever signs in during the read.
              const session = currentDesktopSession();
              void act(
                filesOfDrag(outside).then((files) =>
                  Promise.all(files.map((file) => uploadFile(file, folder, { session }))),
                ),
              ).then((made) => {
                const { placing: keeps, sortColumn: sort, places: stood } = current.current;
                if (!made || !keeps || folder !== DESKTOP_FOLDER || !at) return;
                setPlaces(
                  placedAt(
                    stood,
                    made.map((entry) => entry.id),
                    {
                      right: box.right - at.x - room.width / 2,
                      top: at.y - box.top - room.height / 2,
                    },
                    gridOf(root, room),
                    sort === "grid",
                    reservedOf(root),
                  ),
                );
              });
            },
          };
        }
        const moved = dragging.items.filter((item) => item.id !== folder);
        const copies = dragging.copy || (dragging.from !== "finder" && dragging.from !== "desktop");
        const stored = current.current.drive;
        // Already there and not copied: nothing to do.
        const moving = moved.filter(
          (item) => copies || (stored && entryOf(stored, item.id)?.parent !== folder),
        );
        return {
          element: folder === DESKTOP_FOLDER ? root : (icon ?? root),
          copies,
          refusal: moved.length === 0 ? "A folder can’t go inside itself." : undefined,
          drop() {
            const { placing: keeps, sortColumn: sort, places: stood, cell: room } = current.current;
            const snap = sort === "grid";
            if (keeps && dragging.from === "desktop" && !copies && folder === DESKTOP_FOLDER) {
              if (!dragging.at) return;
              const ids = moved.map((item) => item.id);
              setPlaces(
                movedPlaces(
                  { ...stood, ...shownPlaces(root, ids) },
                  ids,
                  dragging.at.x - pressedAt.current.x,
                  dragging.at.y - pressedAt.current.y,
                  gridOf(root, room),
                  snap,
                  reservedOf(root),
                ),
              );
              return;
            }
            if (moving.length === 0) return;
            const inFolder = new Set(
              stored?.entries
                .filter((entry) => entry.parent === folder && entry.trashed_ms === undefined)
                .map((entry) => entry.name),
            );
            const nodes = stored ? driveTree(stored, {}) : null;
            // An item already in the folder is copied beside itself, under the next free name.
            const clashing = (item: DesktopDragItem) => {
              const entry = stored ? entryOf(stored, item.id) : undefined;
              return entry !== undefined && entry.parent !== folder && inFolder.has(entry.name);
            };
            const ask = (item: DesktopDragItem) =>
              new Promise<"replace" | "keep" | "stop">((settle) => {
                const path = nodes && pathOfEntry(nodes, item.id);
                const node = nodes && path ? resolve(nodes, path) : undefined;
                if (!node) {
                  settle("keep");
                  return;
                }
                setReplacing({
                  node,
                  moving: !copies,
                  answer(choice) {
                    setReplacing(null);
                    settle(choice);
                  },
                });
              });
            const settled = async () => {
              const answers: { id: string; existing: "rename" | "replace" }[] = [];
              for (const item of moving) {
                const choice = clashing(item) ? await ask(item) : "keep";
                if (choice === "stop") return null;
                answers.push({
                  id: item.id,
                  existing: choice === "replace" ? "replace" : "rename",
                });
              }
              return answers;
            };
            void act(
              settled().then((answers) => {
                if (!answers) return null;
                const ops = answers.map(({ id, existing }) => ({
                  op: copies ? ("copy" as const) : ("move" as const),
                  id,
                  parent: folder,
                  existing,
                }));
                return runUndoable(copies ? "Copy" : "Move", ops);
              }),
            ).then((made) => {
              if (!made || !keeps || folder !== DESKTOP_FOLDER || !dragging.at) return;
              const box = root.getBoundingClientRect();
              setPlaces(
                placedAt(
                  current.current.places,
                  copies ? (made.created ?? []) : moving.map((item) => item.id),
                  {
                    right: box.right - dragging.at.x - room.width / 2,
                    top: dragging.at.y - box.top - room.height / 2,
                  },
                  gridOf(root, room),
                  snap,
                  reservedOf(root),
                ),
              );
            });
          },
        };
      },
    });
  }, [shown, element, act, setPlaces]);

  // Files from the computer, and words or a link dragged from a window, go in the Desktop folder,
  // where they were let go, or in the folder they were let go on.
  useEffect(() => {
    const root = element.current;
    if (!shown || !root) return;
    const folderUnder = (target: EventTarget | null) => {
      const on = (target as Element | null)?.closest?.<HTMLElement>(
        ".mac-desktop-icon[data-drive-item]",
      )?.dataset.value;
      return current.current.entries.some(({ node }) => node.id === on && isContainer(node))
        ? on
        : undefined;
    };
    const takes = (event: DragEvent) => {
      const types = [...(event.dataTransfer?.types ?? [])];
      return types.includes("Files") || carriesClipping(types);
    };
    const over = (event: DragEvent) => {
      if (!takes(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const drop = (event: DragEvent) => {
      const data = event.dataTransfer;
      if (!data || !takes(event)) return;
      const files = data.files.length
        ? [...data.files]
        : [clippingFile((type) => data.getData(type))].flatMap((file) => (file ? [file] : []));
      if (files.length === 0) return;
      event.preventDefault();
      const box = root.getBoundingClientRect();
      const { cell: room } = current.current;
      const place = {
        right: box.right - event.clientX - room.width / 2,
        top: event.clientY - box.top - room.height / 2,
      };
      const folder = folderUnder(event.target);
      void Promise.allSettled(files.map((file) => uploadFile(file, folder ?? DESKTOP_FOLDER))).then(
        (results) => {
          const refused = results.find((result) => result.status === "rejected");
          if (refused) setFailure(messageOf(refused.reason));
          const made = results.flatMap((result) =>
            result.status === "fulfilled" ? [result.value.id] : [],
          );
          const { placing: keeps, sortColumn: sort, places: stood, cell: at } = current.current;
          if (folder || made.length === 0 || !keeps) return;
          setPlaces(
            placedAt(stood, made, place, gridOf(root, at), sort === "grid", reservedOf(root)),
          );
        },
      );
    };
    root.addEventListener("dragover", over);
    root.addEventListener("drop", drop);
    return () => {
      root.removeEventListener("dragover", over);
      root.removeEventListener("drop", drop);
    };
  }, [shown, element, setPlaces]);

  // Keys on the desktop, which has the keyboard when no window does: on an icon, what acts on the
  // selection, and with focus nowhere, Select All, Paste and Use Stacks. A key pressed in a window or
  // a field stays theirs. Control-Option-0 stands in for Control-Command-0 where Command is Control.
  useEffect(() => {
    const root = element.current;
    if (!shown || !root) return;
    const key = (event: KeyboardEvent) => {
      const { target } = event;
      if (!(target instanceof HTMLElement)) return;
      const onIcon = target.matches("[data-drive-item]");
      if (!onIcon && target !== document.body && target !== root) return;
      const take = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      const is = (equivalent: string) => matchesMenuKeyEquivalent(event, equivalent);
      const { selected: held, entries: all, drive, open: openEntry } = current.current;
      if (is("command+a")) {
        take();
        setSelection(all.flatMap(({ node }) => node.id ?? []));
        return;
      }
      if (is("command+v")) {
        if (copiedDriveItems().length === 0) return;
        take();
        paste();
        return;
      }
      if (is("command+j")) {
        take();
        showDesktopViewOptions(!current.current.viewOptionsShown);
        return;
      }
      if (is("control+command+0") || is("control+option+0")) {
        take();
        setUseStacks(!current.current.useStacks);
        return;
      }
      if (!onIcon) return;
      const id = target.dataset.value ?? "";
      const ids = held.includes(id) ? held : [id];
      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
        take();
        setRenaming(id);
      } else if (is("command+c")) {
        // The default would fire a copy event, which empties the desktop's clipboard.
        take();
        copyDriveItems(ids.flatMap((each) => asDragItem(drive, each)));
      } else if (is("command+d")) {
        take();
        duplicate(ids);
      } else if (is("command+i") && ids.length === 1) {
        take();
        showInFinder({ id, show: "info" });
      } else if (is("command+o") || is("command+down")) {
        take();
        for (const entry of all) {
          if (entry.node.id && ids.includes(entry.node.id)) openEntry(entry);
        }
      } else if (event.key === " " && ids.length === 1) {
        take();
        quickLookAlone(id);
      } else if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "Backspace" || event.key === "Delete")
      ) {
        take();
        trash(ids);
      }
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [shown, element, trash, paste, duplicate, setUseStacks]);

  const iconOf = (entry: FinderEntry, placed = false) => {
    const id = entry.node.id ?? "";
    const place = placed ? showing[id] : undefined;
    const info = view.info ? itemInfo(entry.node) : undefined;
    return (
      <DesktopIcon
        key={id}
        value={id}
        data-drive-item=""
        icon={<DriveItemIcon node={entry.node} size={view.icon} preview={view.preview} />}
        onOpen={() => open(entry)}
        onClick={(event) => {
          // A click from the keyboard has no click count, and is the person's choice.
          if (dragged.current && event.detail > 0) event.preventDefault();
          dragged.current = false;
        }}
        style={
          place
            ? { position: "absolute", right: `${place.right}px`, top: `${place.top}px` }
            : undefined
        }
      >
        {view.info ? (
          <>
            <span className="mac-desktop-shell-item-name">{entry.node.name}</span>
            {info ? <span className="mac-desktop-shell-item-info">{info}</span> : null}
          </>
        ) : (
          entry.node.name
        )}
      </DesktopIcon>
    );
  };

  const icons = useStacks
    ? stacksOf(entries, stackBy, new Date(), added).map(([name, inStack]) => {
        const first = inStack[0];
        return (
          <DesktopStack
            key={name}
            label={name}
            thumbnail={first ? <ItemIcon node={first.node} size={64} /> : null}
          >
            {inStack.map((entry) => iconOf(entry))}
          </DesktopStack>
        );
      })
    : entries.map((entry) => iconOf(entry, arranged));

  const only =
    selected.length === 1 ? entries.find(({ node }) => node.id === selected[0]) : undefined;

  const newFolder = () => {
    void act(
      runUndoable("New Folder", [{ op: "mkdir", parent: DESKTOP_FOLDER, name: "untitled folder" }]),
    ).then((made) => {
      const id = made?.created?.[0];
      if (id) {
        setSelection([id]);
        setRenaming(id);
      }
    });
  };

  const cleanUp = () => {
    const root = element.current;
    if (root) setPlaces(cleanedUp(places, gridOf(root, cell), reservedOf(root)));
  };
  const cleanUpBy = (column: string) => {
    const root = element.current;
    if (!root || !tree) return;
    const ids = sorted(column).flatMap(({ node }) => node.id ?? []);
    setPlaces(inOrder(ids, gridOf(root, cell), reservedOf(root)));
  };
  const chooseSort = (column: string) => {
    setSortColumn(column);
    if (column === "grid") cleanUp();
  };
  const changeView = (change: Partial<DesktopViewSettings>) => {
    const next = { ...view, ...change };
    const root = element.current;
    const room = cellOfView(next);
    if (root && (room.width !== cell.width || room.height !== cell.height)) {
      setPlaces(rescaledPlaces(places, gridOf(root, cell), gridOf(root, room)));
    }
    setView(next);
  };

  const menu = onItem ? (
    <>
      <MenuItem
        onClick={() => {
          for (const entry of entries) {
            if (entry.node.id && selected.includes(entry.node.id)) open(entry);
          }
        }}
      >
        Open
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => trash(selected)}>Move to Trash</MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!only}
        onClick={() => only?.node.id && showInFinder({ id: only.node.id, show: "info" })}
      >
        Get Info
      </MenuItem>
      <MenuItem disabled={!only} onClick={() => only?.node.id && setRenaming(only.node.id)}>
        Rename
      </MenuItem>
      <MenuItem onClick={() => duplicate(selected)}>Duplicate</MenuItem>
      <MenuItem disabled={!only} onClick={() => only?.node.id && quickLookAlone(only.node.id)}>
        Quick Look
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        onClick={() =>
          copyDriveItems(selected.flatMap((id) => asDragItem(current.current.drive, id)))
        }
      >
        Copy
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => showInFinder({ place: DESKTOP_PATH })}>Show in Finder</MenuItem>
    </>
  ) : (
    <>
      <MenuItem onClick={newFolder}>New Folder</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => showInFinder({ id: DESKTOP_FOLDER, show: "info" })}>
        Get Info
      </MenuItem>
      <MenuItem disabled={copied.length === 0} onClick={paste}>
        {copied.length > 1 ? `Paste ${copied.length} Items` : "Paste Item"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => showInFinder({ place: DESKTOP_PATH })}>Open in Finder</MenuItem>
      <MenuItem onClick={onChangePicture}>Change Desktop Background…</MenuItem>
      <MenuSeparator />
      <MenuCheckboxItem
        keyEquivalent="control+command+0"
        checked={useStacks}
        onCheckedChange={setUseStacks}
      >
        Use Stacks
      </MenuCheckboxItem>
      <Submenu>
        <SubmenuTrigger disabled={!useStacks}>Group Stacks By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={stackBy} onValueChange={(by) => setStackBy(String(by))}>
            {STACK_BYS.map(({ by, label }) => (
              <MenuRadioItem key={by} value={by}>
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Sort By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={sortColumn} onValueChange={(column) => chooseSort(String(column))}>
            {ARRANGEMENTS.map(({ column, label }) => (
              <MenuRadioItem key={column} value={column}>
                {label}
              </MenuRadioItem>
            ))}
            <MenuSeparator />
            {SORTS.map(({ column, label }) => (
              <MenuRadioItem key={column} value={column}>
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuItem disabled={!placing} onClick={cleanUp}>
        Clean Up
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!placing}>Clean Up By</SubmenuTrigger>
        <SubmenuPopup>
          {SORTS.map(({ column, label }) => (
            <MenuItem key={column} onClick={() => cleanUpBy(column)}>
              {label}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+j" onClick={() => showDesktopViewOptions(!viewOptionsShown)}>
        {viewOptionsShown ? "Hide View Options" : "Show View Options"}
      </MenuItem>
    </>
  );

  const onContextMenu = (target: EventTarget) => {
    const icon =
      target instanceof Element
        ? target.closest<HTMLElement>(".mac-desktop-icon[data-drive-item]")
        : null;
    setOnItem(Boolean(icon));
    const id = icon?.dataset.value;
    if (id && !selected.includes(id)) setSelection([id]);
    if (!icon && selected.length > 0) setSelection([]);
  };

  const renamed = renaming === null ? undefined : entries.find(({ node }) => node.id === renaming);
  const overlay =
    renaming !== null && renamed ? (
      <FinderRenameField
        key={renaming}
        name={renamed.node.name}
        folder={isContainer(renamed.node)}
        container={element.current}
        locate={() =>
          element.current?.querySelector(
            `.mac-desktop-icon[data-value="${CSS.escape(renaming)}"] .mac-desktop-icon-text`,
          ) ?? null
        }
        onRename={(name) => {
          void act(runUndoable("Rename", [{ op: "rename", id: renaming, name }]));
        }}
        onClose={() => setRenaming(null)}
      />
    ) : null;

  return {
    shown,
    icons,
    value: selected,
    onValueChange: setSelection,
    menu,
    onContextMenu,
    failure,
    clearFailure: () => setFailure(null),
    replacing,
    overlay,
    surface: keepsDefaultLook(view)
      ? { attributes: {}, style: {} }
      : {
          attributes: {
            "data-view-options": "",
            "data-label-position": view.label,
            ...(view.info ? { "data-item-info": "" } : {}),
          },
          style: {
            "--mac-desktop-shell-cell-width": `${cell.width}px`,
            "--mac-desktop-shell-cell-height": `${cell.height}px`,
            "--mac-desktop-shell-icon-size": `${view.icon}px`,
            "--mac-desktop-shell-icon-scale": view.icon / DESKTOP_VIEW_DEFAULTS.icon,
            "--mac-desktop-shell-icon-text": `${view.text}px`,
          } as CSSProperties,
        },
    viewOptions:
      shown && viewOptionsShown ? (
        <DesktopViewOptions
          view={view}
          at={viewWindow}
          onMoved={(at) => setViewWindow({ ...at, shown: true })}
          onChange={changeView}
          stackBy={useStacks ? stackBy : undefined}
          stackChoices={STACK_BYS.map(({ by, label }) => ({ value: by, label }))}
          onStackByChange={(by) => {
            setUseStacks(by !== undefined);
            if (by) setStackBy(by);
          }}
          sortBy={sortColumn}
          sortChoices={[...ARRANGEMENTS, ...SORTS].map(({ column, label }) => ({
            value: column,
            label,
          }))}
          onSortByChange={chooseSort}
          onClose={() => showDesktopViewOptions(false)}
        />
      ) : null,
  };
}
