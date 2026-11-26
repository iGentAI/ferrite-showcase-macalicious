"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { observeResize } from "macalicious/lib/observe-resize";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
} from "macalicious/scope-bar";
import { Separator } from "macalicious/separator";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TableView, type TableViewColumn, type TableViewProps } from "macalicious/table-view";
import { TextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useDesktopDrop } from "../desktop/desktop-drag";
import { entryOf, inTrash, markOpened, readFile, runOps, useDrive } from "../desktop/desktop-files";
import { requestHelp } from "../desktop/desktop-help";
import { copyText } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { DriveOpenPanel, DriveSavePanel, saveToDrive } from "../finder/finder-file-dialogs";
import { onOpenFileRequest, showInFinder, takeOpenFileRequests } from "../finder/finder-open";
import {
  arrange,
  COLUMNS,
  type ConsoleColumnId,
  type ConsoleLogFile,
  type ConsoleMessage,
  type ConsoleReportId,
  type ConsoleScope,
  type ConsoleSearchComparison,
  type ConsoleSearchField,
  type ConsoleSourceId,
  type ConsoleState,
  categoryToken,
  clear,
  copyableMessages,
  createState,
  DEFAULT_COLUMNS,
  defaultMessages,
  defaultReports,
  isLogFile,
  listed,
  logFileOf,
  logFileSource,
  messagesOfLogFile,
  newest,
  parseQuery,
  processToken,
  receive,
  reload,
  SEARCH_COMPARISONS,
  SEARCH_FIELDS,
  SOURCES,
  timestamp,
  windowTitle,
  withLevels,
} from "./console-data";
import { ActivitiesGlyph, ClearGlyph, NowGlyph, SourceIcon, TypeMark } from "./console-icons";
import "./console.tokens.css";
import "./console.css";

type Sort = NonNullable<TableViewProps["sort"]>;

/**
 * Where the device's messages come from instead of the invented stream, such as a server's log.
 */
export interface ConsoleFeed {
  /**
   * Reads the messages the source holds now, in order of arrival, each with an identifier
   * that grows with arrival; `undefined` when the read failed. Messages the window already
   * lists are recognised by their identifiers and not listed twice.
   */
  read: () => Promise<readonly ConsoleMessage[] | undefined>;
  /** Milliseconds between two reads while the window is open; `0` reads only on open and Reload. */
  interval: number;
  /**
   * Messages the page holds itself. They reach the list as soon as they change, whether or not a
   * read is under way, and the list holds exactly this set of them: a message that leaves it leaves
   * the list. Their identifiers start at `firstId`, above any identifier `read` gives.
   */
  local?: {
    firstId: number;
    get: () => readonly ConsoleMessage[];
    subscribe: (listener: () => void) => () => void;
  };
}

/* The most messages the device's list keeps from a feed: the oldest go first. */
const FEED_LIMIT = 5000;

/* The largest log file Console reads whole in the page. */
const MAX_LOG_BYTES = 8_000_000;

const NO_LOG_FILES: readonly ConsoleLogFile[] = [];
const NO_SAVED_SEARCHES: readonly string[] = [];

export interface ConsoleProps extends Omit<WindowProps, "children"> {
  /**
   * The device's messages when the window opens, in order of arrival. The stream adds to them;
   * a later change of the prop is not followed.
   * @default defaultMessages
   */
  messages?: readonly ConsoleMessage[];
  /**
   * What each report source of the sidebar lists.
   * @default defaultReports
   */
  reports?: Readonly<Record<ConsoleReportId, readonly ConsoleMessage[]>>;
  /**
   * The source selected in the sidebar at first.
   * @default "device"
   */
  defaultSource?: ConsoleSourceId;
  /**
   * Why a report source lists nothing, shown in its empty table: a device that keeps no such
   * reports says so instead of looking broken.
   */
  noReportsNote?: string;
  /** Called with the source chosen in the sidebar. */
  onSourceChange?: (source: ConsoleSourceId) => void;
  /** Identifier of the message selected at first, in the source selected at first. */
  defaultSelectedId?: number;
  /**
   * Milliseconds between two messages the device logs while the window is open. `0` stops
   * the stream: the list then changes only through Clear and Reload.
   * @default 2000
   */
  streamInterval?: number;
  /**
   * A source of the device's messages, read when the window opens, every `feed.interval` and
   * when Reload is chosen. With a feed the device starts with no message, `messages` and
   * `streamInterval` are not used, and nothing is invented. The object should keep its
   * identity: a new one starts the reads again.
   */
  feed?: ConsoleFeed;
  /**
   * The device's name: its row in the sidebar.
   * @default "ismh15"
   */
  deviceName?: string;
  /**
   * Whether Now is on at first: the table then stays scrolled to the newest message.
   * @default true
   */
  defaultFollowing?: boolean;
  /**
   * The surface of the sidebar: vibrant over a desktop, or opaque on a plain page.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /**
   * Called with the selected message and the service chosen in the Share menu. A host hands
   * the message to that service.
   */
  onShare?: (message: ConsoleMessage, service: string) => void;
  /** The rows of the Share menu in place of the four services, given the selected messages. */
  shareItems?: (messages: readonly ConsoleMessage[]) => ReactNode;
  /**
   * Keeps the source, scope, layout and levels, and turns on the Include Info and Debug items, which
   * leave out those messages when turned off. Include Info starts on, as the application logs every
   * request that succeeds at that level. Without it the window keeps them for as long as it is open
   * and lists every message.
   */
  layout?: ConsoleLayoutStore;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

type Action =
  | { type: "receive" }
  | { type: "merge"; messages: readonly ConsoleMessage[] }
  | { type: "local"; firstId: number; messages: readonly ConsoleMessage[] }
  | { type: "file"; source: ConsoleSourceId; messages: readonly ConsoleMessage[] }
  | { type: "clear" | "reload"; source: ConsoleSourceId };

/**
 * The device's list with the feed's messages it does not hold yet, in id order, the newest kept.
 * Messages are told apart by id, not by a highest id seen: a source may publish an entry after
 * one with a higher id (a slow request logs late), and that entry still belongs in the list.
 */
function merge(state: ConsoleState, messages: readonly ConsoleMessage[]): ConsoleState {
  const device = state.messages.device;
  const held = new Set(device.map((message) => message.id));
  const fresh = messages.filter((message) => !held.has(message.id));
  if (fresh.length === 0) return state;
  const next = [...device, ...fresh].sort((a, b) => a.id - b.id).slice(-FEED_LIMIT);
  return { ...state, messages: { ...state.messages, device: next } };
}

function reduce(state: ConsoleState, action: Action): ConsoleState {
  if (action.type === "receive") return receive(state);
  if (action.type === "file") {
    return { ...state, messages: { ...state.messages, [action.source]: action.messages } };
  }
  if (action.type === "merge") return merge(state, action.messages);
  if (action.type === "local") {
    const read = state.messages.device.filter((message) => message.id < action.firstId);
    const device = [...read, ...action.messages].slice(-FEED_LIMIT);
    return { ...state, messages: { ...state.messages, device } };
  }
  return action.type === "clear" ? clear(state, action.source) : reload(state, action.source);
}

/* A menu holds the keyboard until it has faded: a field is focused after that. */
const AFTER_MENU_MS = 300;

/** Whether the keyboard is in a text field, whose own commands then stay its own. */
function inTextField(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
}

/** Whether text is selected in a field or on the page, which Copy then copies. */
function holdsSelectedText(): boolean {
  const active = document.activeElement;
  if (
    (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
    active.selectionStart !== active.selectionEnd
  )
    return true;
  return Boolean(document.getSelection()?.toString());
}

/* The table: 21 pt rows under the 24 pt header. */
const ROW_HEIGHT = 21;
const HEADER_HEIGHT = 24;

/* Where the Share menu sends a message. */
const SERVICES = ["Mail", "Messages", "AirDrop", "Notes"] as const;

/* Console's toolbar buttons are 44 pt wide, whatever their glyph. */
const BUTTON: CSSProperties = { width: 44, padding: 0 };
/* An item is as wide as its button, so that a longer label does not move its neighbours;
   "Activities" is wider than its button and its item takes the label's 48 pt. */
const ITEM: CSSProperties = { width: 44 };
const WIDE_ITEM: CSSProperties = { width: 48 };
/* Share sits 17 pt after Info, where the toolbar's gap is 8 pt (measured). */
const SHARE_ITEM: CSSProperties = { width: 44, marginInlineStart: 9 };
/* The image button's documented hook: the glyph sits 7.5 pt after the bar's 9 pt inset. */
const SIDEBAR_BUTTON = { "--mac-image-button-padding": "0 8.5px 0 7.5px" } as CSSProperties;
/* The split view's hook for the colour of its line, set to the colours measured beside
   Console's sidebar. */
const DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-console-sidebar-divider)",
} as CSSProperties;
/* The text view's hook for its fill: the detail pane's own background shows. */
const BODY = { "--mac-text-view-background": "transparent" } as CSSProperties;
/* The table header's hook for its titles: Console's start 2 pt from the column's edge. */
const TABLE = {
  "--mac-table-header-title-inset": "2px 6px",
} as CSSProperties;

const REPORTS = SOURCES.filter((entry) => entry.section === "Reports");
const DEVICES = SOURCES.filter((entry) => entry.section === "Devices");

function Detail({ message }: { message: ConsoleMessage }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="mac-console-detail-head">
        <Label textStyle="emphasized" truncate selectable>
          {message.process}
        </Label>
        <div className="mac-console-detail-meta">
          <Label textStyle="small" truncate selectable>
            Subsystem: {message.subsystem || "--"}
          </Label>
          <Label textStyle="small" truncate selectable>
            Category: {message.category || "--"}
          </Label>
          <Label
            textStyle="small"
            color="link"
            render={<button type="button" />}
            className="mac-console-detail-link"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide" : "Details"}
          </Label>
          <Label textStyle="small" selectable className="mac-console-detail-time">
            {timestamp(message)}
          </Label>
        </div>
        {expanded ? (
          <div className="mac-console-detail-meta">
            {message.pid === 0 && message.thread === 0 ? (
              <Label textStyle="small" selectable>
                This log records no process, thread or activity ID.
              </Label>
            ) : (
              <>
                <Label textStyle="small" selectable>
                  Activity ID: {message.activity}
                </Label>
                <Label textStyle="small" selectable>
                  Thread ID: 0x{message.thread.toString(16)}
                </Label>
                <Label textStyle="small" selectable>
                  PID: {message.pid}
                </Label>
              </>
            )}
          </div>
        ) : null}
      </div>
      <Separator aria-hidden="true" className="mac-console-detail-rule" />
      <TextView
        monospace
        readOnly
        aria-label="Message"
        className="mac-console-detail-body"
        style={BODY}
        value={message.message}
      />
    </>
  );
}

/** What the window can keep. */
export interface ConsoleLayout {
  source: ConsoleSourceId;
  scope: ConsoleScope;
  infoShown: boolean;
  sidebarSize: number;
  includeInfo: boolean;
  includeDebug: boolean;
  query: string;
  following: boolean;
  toolbarHidden: boolean;
  logFiles: readonly ConsoleLogFile[];
  columns: readonly ConsoleColumnId[];
  savedSearches: readonly string[];
  searchField: ConsoleSearchField;
  searchComparison: ConsoleSearchComparison;
}

export interface ConsoleLayoutStore {
  values: Partial<ConsoleLayout>;
  change: (patch: Partial<ConsoleLayout>) => void;
}

/** One kept value: the store's when there is one, the window's own otherwise. */
function useKept<K extends keyof ConsoleLayout>(
  layout: ConsoleLayoutStore | undefined,
  key: K,
  initial: ConsoleLayout[K],
): [ConsoleLayout[K], (next: ConsoleLayout[K]) => void] {
  const [own, setOwn] = useState(initial);
  const set = (next: ConsoleLayout[K]) => {
    if (layout) layout.change({ [key]: next });
    else setOwn(next);
  };
  return [layout?.values[key] ?? own, set];
}

/**
 * The Console window of macOS 10.15: an icon-and-label toolbar, a scope bar, the sidebar of
 * the device and the report sources, the message table and the detail pane of the selected
 * message. The messages are invented; a timer adds one to the device's list every two seconds.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function Console({
  messages = defaultMessages,
  reports = defaultReports,
  noReportsNote,
  defaultSource = "device",
  onSourceChange,
  defaultSelectedId,
  streamInterval = 2000,
  feed,
  deviceName = "ismh15",
  defaultFollowing = true,
  material = "translucent",
  onShare,
  shareItems,
  layout,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state: windowState,
  width = 1000,
  height = 500,
  className,
  ...windowProps
}: ConsoleProps) {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    createState(feed ? [] : messages, reports),
  );
  const [source, setSource] = useKept(layout, "source", defaultSource);
  // Each source keeps its own selection, by message identifier.
  const [selection, setSelection] = useState<Partial<Record<ConsoleSourceId, readonly number[]>>>(
    () => (defaultSelectedId === undefined ? {} : { [defaultSource]: [defaultSelectedId] }),
  );
  const [scope, setScope] = useKept<"scope">(layout, "scope", "all");
  const [activities, setActivities] = useState(false);
  // What is typed this visit, whole: a store may keep less of it.
  const [typedQuery, setTypedQuery] = useState<string | null>(null);
  const query = typedQuery ?? layout?.values.query ?? "";
  // A search set from outside, as Activity Monitor's Show in Console does, takes over from what
  // was typed: the kept search changes with no typing in the same render.
  const keptQuery = layout?.values.query;
  const lastQueries = useRef({ typed: typedQuery, kept: keptQuery });
  useEffect(() => {
    const last = lastQueries.current;
    lastQueries.current = { typed: typedQuery, kept: keptQuery };
    if (keptQuery !== last.kept && typedQuery === last.typed) setTypedQuery(null);
  }, [typedQuery, keptQuery]);
  const setQuery = (next: string) => {
    setTypedQuery(next);
    layout?.change({ query: next });
  };
  const [sort, setSort] = useState<Sort>();
  const [following, setFollowing] = useKept(layout, "following", defaultFollowing);
  const [infoShown, setInfoShown] = useKept(layout, "infoShown", true);
  const [sidebarSize, setSidebarSize] = useKept(layout, "sidebarSize", 180);
  const [includeInfo, setIncludeInfo] = useKept(layout, "includeInfo", true);
  const [includeDebug, setIncludeDebug] = useKept(layout, "includeDebug", false);
  const [toolbarHidden, setToolbarHidden] = useKept(layout, "toolbarHidden", false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail: string }>();
  const failed = (title: string) => (error: unknown) =>
    setFailure({ title, detail: error instanceof Error ? error.message : String(error) });
  const [opening, setOpening] = useState(false);
  const [menuFile, setMenuFile] = useState<string>();
  const logFiles = layout?.values.logFiles ?? NO_LOG_FILES;
  const drive = useDrive(logFiles.length > 0);
  // What was opened since the last render counts: two requests can arrive before the next one.
  const openedLogFiles = useRef(logFiles);
  openedLogFiles.current = logFiles;
  const openLogFiles = (opened: readonly ConsoleLogFile[]) => {
    const last = opened.at(-1);
    if (!layout || !last) return;
    const known = new Set(openedLogFiles.current.map((file) => file.id));
    const next = [...openedLogFiles.current, ...opened.filter((file) => !known.has(file.id))];
    openedLogFiles.current = next;
    layout.change({ logFiles: next, source: logFileSource(last.id) });
    for (const file of opened) markOpened(file.id);
  };
  const forgetLogFile = (id: string) => {
    layout?.change({
      logFiles: logFiles.filter((file) => file.id !== id),
      ...(source === logFileSource(id) ? { source: "device" as const } : {}),
    });
  };
  const fileShown = logFileOf(source);
  const sidebarRestore = useRef(180);
  const viewport = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const launch = use(DesktopWindowHostContext)?.launch;

  useEffect(() => {
    if (feed || !(streamInterval > 0)) return;
    const timer = setInterval(() => dispatch({ type: "receive" }), streamInterval);
    return () => clearInterval(timer);
  }, [streamInterval, feed]);

  // The feed: read on open, every interval, and again on Reload (`reads` counts those). One
  // read at a time; a read that answers after the window has gone is dropped.
  const [reads, readAgain] = useReducer((count: number) => count + 1, 0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload reads again by moving `reads`
  useEffect(() => {
    if (!feed) return;
    let live = true;
    let busy = false;
    const read = async () => {
      if (busy) return;
      busy = true;
      try {
        const got = await feed.read();
        if (live && got) dispatch({ type: "merge", messages: got });
      } catch {
        // A failed read leaves the list as it is; the next one tries again.
      } finally {
        busy = false;
      }
    };
    void read();
    const timer = feed.interval > 0 ? setInterval(read, feed.interval) : undefined;
    return () => {
      live = false;
      if (timer !== undefined) clearInterval(timer);
    };
  }, [feed, reads]);

  useEffect(() => {
    const local = feed?.local;
    if (!local) return;
    const publish = () =>
      dispatch({ type: "local", firstId: local.firstId, messages: local.get() });
    publish();
    return local.subscribe(publish);
  }, [feed]);

  // A log file: read when it is shown and on Reload. One read that answers after another source was chosen is dropped.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload reads again by moving `reads`
  useEffect(() => {
    if (fileShown === undefined) return;
    let live = true;
    readFile(fileShown)
      .then(async (blob) => {
        if (blob.size > MAX_LOG_BYTES) {
          throw new Error(`Console reads log files of up to ${MAX_LOG_BYTES / 1_000_000} MB.`);
        }
        const messages = messagesOfLogFile(await blob.text());
        if (live) dispatch({ type: "file", source: logFileSource(fileShown), messages });
      })
      .catch((error: unknown) => {
        if (live) failed("The log file could not be read.")(error);
      });
    return () => {
      live = false;
    };
  }, [fileShown, reads]);

  // A file that went to the Trash or away leaves the sidebar, and one that was renamed follows.
  useEffect(() => {
    if (!drive || !layout || logFiles.length === 0) return;
    const live = logFiles.flatMap((file) => {
      const entry = entryOf(drive, file.id);
      return entry && !inTrash(drive, file.id) ? [{ id: file.id, name: entry.name }] : [];
    });
    if (
      live.every((file, at) => file.name === logFiles[at]?.name) &&
      live.length === logFiles.length
    )
      return;
    const shown = fileShown === undefined || live.some((file) => file.id === fileShown);
    layout.change({ logFiles: live, ...(shown ? {} : { source: "device" as const }) });
  }, [drive, layout, logFiles, fileShown]);

  // Finder opens a file here, in a window that opens now or that is open already.
  const openLogFilesRef = useRef(openLogFiles);
  openLogFilesRef.current = openLogFiles;
  const servedFiles = layout !== undefined;
  useEffect(() => {
    if (!servedFiles) return;
    const waiting = takeOpenFileRequests("console");
    if (waiting.length > 0) {
      openLogFilesRef.current(waiting.map(({ id, name }) => ({ id, name })));
    }
    return onOpenFileRequest("console", ({ id, name }) => openLogFilesRef.current([{ id, name }]));
  }, [servedFiles]);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    enabled: servedFiles,
    accepts: (item) => item.kind === "file" && isLogFile(item),
    refusal: () => "Console opens log and text files.",
    onDrop: (items) => openLogFiles(items.map(({ id, name }) => ({ id, name }))),
  });

  const [shownColumns, setShownColumns] = useKept(layout, "columns", DEFAULT_COLUMNS);
  const [savedSearches, setSavedSearches] = useKept(layout, "savedSearches", NO_SAVED_SEARCHES);
  const [searchField, setSearchField] = useKept<"searchField">(layout, "searchField", "any");
  const [searchComparison, setSearchComparison] = useKept<"searchComparison">(
    layout,
    "searchComparison",
    "contains",
  );
  const [menuSearch, setMenuSearch] = useState<string>();
  const columns = useMemo(
    () =>
      COLUMNS.filter((column) => shownColumns.includes(column.id)).map(
        (column): TableViewColumn => ({
          id: column.id,
          title: column.title,
          width: column.width,
          minWidth: column.width === undefined ? 200 : undefined,
          sortable: true,
        }),
      ),
    [shownColumns],
  );
  const all = useMemo(() => {
    const every = listed(state, source);
    return layout ? withLevels(every, includeInfo, includeDebug) : every;
  }, [state, source, layout, includeInfo, includeDebug]);
  const rows = useMemo(
    () => arrange(all, { scope, activities, query, searchField, searchComparison, sort }),
    [all, scope, activities, query, searchField, searchComparison, sort],
  );
  const selectedIds = useMemo(() => selection[source] ?? [], [selection, source]);
  // Among the listed rows: while a search, the scope or Clear hides a selected message it is not
  // copied or shown, and the selection is back when the message is listed again.
  const selectedRows = useMemo(() => {
    const ids = new Set(selectedIds);
    return rows.filter((row) => ids.has(row.id));
  }, [rows, selectedIds]);
  const selected = selectedRows.length === 1 ? selectedRows[0] : undefined;
  const latest = useMemo(() => newest(rows), [rows]);
  const latestRow = useMemo(() => (latest ? rows.lastIndexOf(latest) : -1), [rows, latest]);

  // Now: the newest message is kept in view, under the header. The table's height changes
  // with the detail pane (`infoShown`), with the divider over the detail pane and with the
  // window, so the newest message is brought back into view whenever the table's scrolling
  // element is resized, too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again when the table's height changes with the detail pane
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!following || !view || latestRow < 0) return;
    const follow = () => {
      const top = latestRow * ROW_HEIGHT;
      view.scrollTop = Math.min(
        top,
        Math.max(view.scrollTop, top + ROW_HEIGHT + HEADER_HEIGHT - view.clientHeight),
      );
    };
    follow();
    return observeResize(view, follow);
  }, [following, latestRow, infoShown]);

  // Now lets go of the table when the newest message is scrolled out of view by any means: the
  // scroll bar's knob or track, a touch, the keyboard or a wheel. A scroll that leaves it in
  // view, and the scrolling Now does itself, keep it on. Subscribed in the commit, so a scroll
  // that follows a new message is never judged against the message before it.
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!following || !view || latestRow < 0) return;
    const top = latestRow * ROW_HEIGHT;
    const letGo = () => {
      // The least scrolled position that shows the row whole under the header; a table too
      // short for a row shows its top.
      const least = Math.min(top, top + ROW_HEIGHT + HEADER_HEIGHT - view.clientHeight);
      if (view.scrollTop > top + 1 || view.scrollTop < least - 1) setFollowing(false);
    };
    view.addEventListener("scroll", letGo, { passive: true });
    return () => view.removeEventListener("scroll", letGo);
  }, [following, latestRow, setFollowing]);

  const select = (ids: readonly number[]) =>
    setSelection((current) => ({ ...current, [source]: ids }));
  // What Edit acts on, kept while a menu holds the keyboard: the text field that had the keyboard,
  // the search or the message's text, or the text selected in the window, before the messages.
  const [editField, setEditField] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // A field that went with its pane sends no focus event: it is simply no longer there.
  const connectedField = () => (editField?.isConnected ? editField : null);
  const [pickedText, setPickedText] = useState("");
  useEffect(() => {
    const inMenu = (target: EventTarget | Element | null) =>
      target instanceof Element && target.closest("[role='menu'], [role='menubar']") !== null;
    let holdingMenu = false;
    const fieldIn = (target: EventTarget | null) =>
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      titleBar?.parentElement?.contains(target)
        ? target
        : null;
    const pressed = (event: PointerEvent) => {
      holdingMenu = inMenu(event.target);
      if (holdingMenu) return;
      // A press says what Edit is for, whether or not the keyboard moves: the table takes no focus
      // from a press on a row, and a field that already has the keyboard gets no focus event.
      setEditField(fieldIn(event.target));
      if (!fieldIn(event.target)) setPickedText("");
    };
    const focused = (event: FocusEvent) => {
      if (!inMenu(event.target)) setEditField(fieldIn(event.target));
    };
    const selected = () => {
      if (holdingMenu || inMenu(document.activeElement)) return;
      // A field's own selection is the field's: the document reports it too.
      if (inTextField()) {
        setPickedText("");
        return;
      }
      const chosen = document.getSelection();
      const inside = chosen?.anchorNode && titleBar?.parentElement?.contains(chosen.anchorNode);
      setPickedText(inside ? (chosen?.toString() ?? "") : "");
    };
    document.addEventListener("pointerdown", pressed, true);
    document.addEventListener("focusin", focused);
    document.addEventListener("selectionchange", selected);
    return () => {
      document.removeEventListener("pointerdown", pressed, true);
      document.removeEventListener("focusin", focused);
      document.removeEventListener("selectionchange", selected);
    };
  }, [titleBar]);
  const sidebarShown = sidebarSize > 0;
  const toggleSidebar = () => {
    if (sidebarShown) sidebarRestore.current = sidebarSize;
    setSidebarSize(sidebarShown ? 0 : sidebarRestore.current);
  };

  // The menu bar's menus: the toolbar's Clear, Reload and Info (desktop-app-menus.ts), and the
  // window's Copy, Select All and Find. The rows change only with what they show; the commands
  // are read when one is chosen.
  const makeCommands = () => ({
    clear: () => dispatch({ type: "clear", source }),
    reload: () => {
      dispatch({ type: "reload", source });
      if (feed && source === "device") readAgain();
      if (fileShown !== undefined) readAgain();
    },
    showInfo: (on: boolean) => setInfoShown(on),
    toggleInfo: () => setInfoShown(!infoShown),
    includeInfo: (on: boolean) => setIncludeInfo(on),
    includeDebug: (on: boolean) => setIncludeDebug(on),
    copy: () => {
      const field = connectedField();
      if (field) {
        const words = field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
        if (words) void copyText(words);
      } else if (pickedText) void copyText(pickedText);
      else if (selectedRows.length > 0) void copyText(copyableMessages(selectedRows));
    },
    selectAll: () => {
      const field = connectedField();
      if (field)
        // The menu holds the keyboard until it has faded: the field takes it back after that.
        setTimeout(() => {
          field.focus();
          field.select();
        }, AFTER_MENU_MS);
      else select(rows.map((row) => row.id));
    },
    toggleSidebar,
    toggleToolbar: () => setToolbarHidden(!toolbarHidden),
    find: () => {
      if (toolbarHidden) setToolbarHidden(false);
      setTimeout(() => {
        searchRef.current?.focus();
        searchRef.current?.select();
      }, AFTER_MENU_MS);
    },
    // A search filters the list, so every row is a match: the next one after the selection.
    findNext: (step: number) => {
      if (rows.length === 0) return;
      const at = rows.findIndex((row) => row.id === selectedRows.at(-1)?.id);
      const next = at < 0 ? (step > 0 ? 0 : rows.length - 1) : at + step;
      const row = rows[(next + rows.length) % rows.length];
      if (row) select([row.id]);
    },
    findSelection: () => {
      const text = document.getSelection()?.toString().trim();
      const first = selectedRows[0];
      if (text) setQuery(text);
      else if (first) setQuery(processToken(first.process));
    },
    showProcess: () => {
      if (selected) setQuery(processToken(selected.process));
    },
    hideProcess: () => {
      if (selected) setQuery(`${query} ${processToken(selected.process, true)}`.trim());
    },
    showCategory: () => {
      if (selected?.category) setQuery(categoryToken(selected.category));
    },
    toggleColumn: (id: ConsoleColumnId) =>
      setShownColumns(
        shownColumns.includes(id)
          ? shownColumns.filter((column) => column !== id)
          : [...shownColumns, id],
      ),
    save: () => setSaving(true),
    open: () => setOpening(true),
    revealFile: (id = fileShown) => {
      if (id !== undefined) showInFinder({ id });
    },
    trashFile: (id = fileShown) => {
      if (id === undefined) return;
      runOps([{ op: "trash", id }]).catch(failed("The log file could not be moved to the Trash."));
    },
    forgetFile: (id: string) => forgetLogFile(id),
  });
  const consoleCommands = useRef(makeCommands());
  consoleCommands.current = makeCommands();
  const isKey = windowState === "key";
  const keepsLayout = layout !== undefined;
  useEffect(() => {
    if (!isKey) return;
    return onMenuKeyEquivalents(window, {
      "command+k": () => consoleCommands.current.clear(),
      "command+r": () => consoleCommands.current.reload(),
      "command+i": () => consoleCommands.current.toggleInfo(),
      "command+f": () => consoleCommands.current.find(),
      "command+g": () => consoleCommands.current.findNext(1),
      "shift+command+g": () => consoleCommands.current.findNext(-1),
      "command+e": () => consoleCommands.current.findSelection(),
      ...(keepsLayout
        ? {
            "shift+command+s": () => consoleCommands.current.save(),
            "command+o": () => consoleCommands.current.open(),
          }
        : {}),
      // Selected text and a text field keep Copy and Select All: the messages take them otherwise.
      "command+c": () => {
        if (holdsSelectedText()) document.execCommand("copy");
        else consoleCommands.current.copy();
      },
      "command+a": () => {
        if (inTextField()) document.execCommand("selectAll");
        else consoleCommands.current.selectAll();
      },
    });
  }, [isKey, keepsLayout]);
  const actionMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="command+k" onClick={() => consoleCommands.current.clear()}>
          Clear
        </MenuItem>
        <MenuItem keyEquivalent="command+r" onClick={() => consoleCommands.current.reload()}>
          Reload
        </MenuItem>
        <MenuSeparator />
        <MenuCheckboxItem
          checked={infoShown}
          keyEquivalent="command+i"
          onCheckedChange={(on) => consoleCommands.current.showInfo(on)}
        >
          Get Info
        </MenuCheckboxItem>
        {keepsLayout ? (
          <>
            <MenuSeparator />
            <MenuCheckboxItem
              checked={includeInfo}
              onCheckedChange={(on) => consoleCommands.current.includeInfo(on)}
            >
              Include Info Messages
            </MenuCheckboxItem>
            <MenuCheckboxItem
              checked={includeDebug}
              onCheckedChange={(on) => consoleCommands.current.includeDebug(on)}
            >
              Include Debug Messages
            </MenuCheckboxItem>
          </>
        ) : null}
      </>
    ),
    [infoShown, keepsLayout, includeInfo, includeDebug],
  );
  useDesktopAppMenu("console", "Action", actionMenu, titleBar);
  const hasSelection = selectedRows.length > 0;
  const canCopy = hasSelection || connectedField() !== null || pickedText !== "";
  const hasRows = rows.length > 0;
  const showsFile = fileShown !== undefined;
  const editMenu = useMemo(
    () => (
      <>
        <MenuItem disabled title="Nothing in Console can be undone.">
          Undo
        </MenuItem>
        <MenuItem disabled title="Nothing in Console can be undone.">
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled title="The log is read-only.">
          Cut
        </MenuItem>
        <MenuItem
          keyEquivalent="command+c"
          disabled={!canCopy}
          onClick={() => consoleCommands.current.copy()}
        >
          Copy
        </MenuItem>
        <MenuItem disabled title="The log is read-only.">
          Paste
        </MenuItem>
        <MenuItem keyEquivalent="command+a" onClick={() => consoleCommands.current.selectAll()}>
          Select All
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+f" onClick={() => consoleCommands.current.find()}>
          Find
        </MenuItem>
        <MenuItem
          keyEquivalent="command+g"
          disabled={!hasRows}
          onClick={() => consoleCommands.current.findNext(1)}
        >
          Find Next
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+g"
          disabled={!hasRows}
          onClick={() => consoleCommands.current.findNext(-1)}
        >
          Find Previous
        </MenuItem>
        <MenuItem
          keyEquivalent="command+e"
          disabled={!hasSelection}
          onClick={() => consoleCommands.current.findSelection()}
        >
          Use Selection for Find
        </MenuItem>
      </>
    ),
    [hasSelection, hasRows, canCopy],
  );
  useDesktopAppMenu("console", "Edit", editMenu, titleBar);
  const fileMenu = useMemo(
    () =>
      keepsLayout ? (
        <>
          <MenuItem keyEquivalent="command+o" onClick={() => consoleCommands.current.open()}>
            Open…
          </MenuItem>
          <MenuItem
            keyEquivalent="shift+command+s"
            disabled={!hasRows}
            onClick={() => consoleCommands.current.save()}
          >
            Save a Copy As…
          </MenuItem>
          <MenuItem disabled={!showsFile} onClick={() => consoleCommands.current.revealFile()}>
            Reveal in Finder
          </MenuItem>
          <MenuItem disabled={!showsFile} onClick={() => consoleCommands.current.trashFile()}>
            Move to Trash
          </MenuItem>
          <MenuSeparator />
        </>
      ) : null,
    [keepsLayout, hasRows, showsFile],
  );
  useDesktopAppMenu("console", "File", fileMenu, titleBar);
  const columnsMenu = useMemo(
    () => (
      <Submenu>
        <SubmenuTrigger>Columns</SubmenuTrigger>
        <SubmenuPopup>
          {COLUMNS.filter((column) => column.id !== "message").map((column) => (
            <MenuCheckboxItem
              key={column.id}
              checked={shownColumns.includes(column.id)}
              onCheckedChange={() => consoleCommands.current.toggleColumn(column.id)}
            >
              {column.title}
            </MenuCheckboxItem>
          ))}
        </SubmenuPopup>
      </Submenu>
    ),
    [shownColumns],
  );
  const viewMenu = useMemo(
    () => (
      <>
        {keepsLayout ? (
          <>
            {columnsMenu}
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem onClick={() => consoleCommands.current.toggleSidebar()}>
          {sidebarShown ? "Hide Sidebar" : "Show Sidebar"}
        </MenuItem>
        <MenuItem onClick={() => consoleCommands.current.toggleToolbar()}>
          {toolbarHidden ? "Show Toolbar" : "Hide Toolbar"}
        </MenuItem>
      </>
    ),
    [sidebarShown, toolbarHidden, keepsLayout, columnsMenu],
  );
  useDesktopAppMenu("console", "View", viewMenu, titleBar);
  const helpMenu = useMemo(
    () =>
      launch ? <MenuItem onClick={() => requestHelp("Console")}>Console Help</MenuItem> : null,
    [launch],
  );
  useDesktopAppMenu("console", "Help", helpMenu, titleBar);
  return (
    <Window
      width={width}
      height={height}
      state={windowState}
      className={cn("mac-console", className)}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        variant="unified"
        divider="bar"
        title={windowTitle(rows.length)}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        {/* 22 pt of title strip and 46 pt of toolbar: Console's 68 pt chrome. */}
        <Toolbar
          displayMode="icon-and-label"
          aria-label="Toolbar"
          hidden={toolbarHidden}
          style={toolbarHidden ? { display: "none" } : { height: 46 }}
        >
          {/* Console's toggles keep the plain bezel and tint their glyph while they are on. */}
          <ToolbarLabelledItem label="Now" style={ITEM}>
            <ToolbarButton
              pressedStyle="tint"
              pressed={following}
              onPressedChange={(on) => {
                setFollowing(on);
                if (on && latest) select([latest.id]);
              }}
              style={BUTTON}
            >
              <NowGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarLabelledItem label="Activities" style={WIDE_ITEM}>
            <ToolbarButton
              pressedStyle="tint"
              pressed={activities}
              onPressedChange={setActivities}
              style={BUTTON}
            >
              <ActivitiesGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarSpace width={32} />
          <ToolbarLabelledItem label="Clear" style={ITEM}>
            <ToolbarButton style={BUTTON} onClick={() => dispatch({ type: "clear", source })}>
              <ClearGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarLabelledItem label="Reload" style={ITEM}>
            <ToolbarButton style={BUTTON} onClick={() => consoleCommands.current.reload()}>
              <SystemImage name="refresh" />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarSpace width={32} />
          <ToolbarLabelledItem label="Info" style={ITEM}>
            <ToolbarButton
              pressedStyle="tint"
              pressed={infoShown}
              onPressedChange={setInfoShown}
              style={BUTTON}
            >
              <SystemImage name="info" />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <Menu>
            <ToolbarLabelledItem label="Share" style={SHARE_ITEM}>
              <MenuTrigger disabled={!hasSelection} render={<ToolbarButton style={BUTTON} />}>
                <SystemImage name="share" />
              </MenuTrigger>
            </ToolbarLabelledItem>
            <MenuPopup sideOffset={4}>
              {shareItems
                ? shareItems(selectedRows)
                : SERVICES.map((service) => (
                    <MenuItem
                      key={service}
                      onClick={() => {
                        const first = selectedRows[0];
                        if (first) onShare?.(first, service);
                      }}
                    >
                      {service}
                    </MenuItem>
                  ))}
            </MenuPopup>
          </Menu>
          <ToolbarSearchField
            variant="bright"
            clearLabel="Clear Search"
            inputRef={searchRef}
            value={query}
            onValueChange={setQuery}
            style={{ flex: "1 1 0", width: "auto" }}
          />
        </Toolbar>
      </TitleBar>
      <ScopeBar surface="toolbar" size="small">
        <ImageButton
          aria-label={sidebarShown ? "Hide Sidebar" : "Show Sidebar"}
          className="mac-console-sidebar-button"
          style={SIDEBAR_BUTTON}
          onClick={toggleSidebar}
        >
          <SystemImage name="sidebar" />
        </ImageButton>
        <ScopeBarGroup
          aria-label="Show"
          value={scope}
          onValueChange={(value) => setScope(value === "errors" ? "errors" : "all")}
        >
          <ScopeBarButton value="all">All Messages</ScopeBarButton>
          <ScopeBarButton value="errors">Errors and Faults</ScopeBarButton>
        </ScopeBarGroup>
        {keepsLayout && parseQuery(query).text !== "" ? (
          <>
            <PopUpButton
              aria-label="Search in"
              size="small"
              value={searchField}
              onValueChange={(value) => setSearchField(value as ConsoleSearchField)}
            >
              {SEARCH_FIELDS.map(([id, title]) => (
                <PopUpButtonItem key={id} value={id}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
            <PopUpButton
              aria-label="Compare by"
              size="small"
              value={searchComparison}
              onValueChange={(value) => setSearchComparison(value as ConsoleSearchComparison)}
            >
              {SEARCH_COMPARISONS.map(([id, title]) => (
                <PopUpButtonItem key={id} value={id}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </>
        ) : null}
        {keepsLayout ? (
          <ContextualMenu>
            <ContextualMenuTrigger
              render={<ScopeBarActions />}
              onContextMenuCapture={(event: MouseEvent<HTMLElement>) =>
                setMenuSearch(
                  (event.target as Element)
                    .closest("[data-saved-search]")
                    ?.getAttribute("data-saved-search") ?? undefined,
                )
              }
            >
              {savedSearches.map((saved) => (
                <ScopeBarAction
                  key={saved}
                  data-saved-search={saved}
                  aria-pressed={saved === query.trim()}
                  onClick={() => setQuery(saved)}
                >
                  {saved}
                </ScopeBarAction>
              ))}
              {query.trim() !== "" && !savedSearches.includes(query.trim()) ? (
                <ScopeBarAction onClick={() => setSavedSearches([...savedSearches, query.trim()])}>
                  Save
                </ScopeBarAction>
              ) : null}
            </ContextualMenuTrigger>
            <ContextualMenuPopup>
              <MenuItem
                disabled={menuSearch === undefined}
                onClick={() =>
                  setSavedSearches(savedSearches.filter((saved) => saved !== menuSearch))
                }
              >
                Remove Saved Search
              </MenuItem>
            </ContextualMenuPopup>
          </ContextualMenu>
        ) : null}
      </ScopeBar>
      <WindowBody ref={dropRef} background="content" className="mac-console-body">
        <SplitView className="mac-console-split">
          <SplitViewPane
            size={sidebarSize}
            onSizeChange={setSidebarSize}
            minSize={120}
            maxSize={320}
            collapsible
          >
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-console-sidebar-frame"
                onContextMenuCapture={(event: MouseEvent<HTMLElement>) =>
                  setMenuFile(
                    (event.target as Element)
                      .closest("[data-log-file]")
                      ?.getAttribute("data-log-file") ?? undefined,
                  )
                }
              >
                <Sidebar
                  aria-label="Sources"
                  material={material}
                  className="mac-console-sidebar"
                  value={source}
                  onValueChange={(value) => {
                    const file = logFiles.find((entry) => logFileSource(entry.id) === value);
                    if (file) {
                      setSource(logFileSource(file.id));
                      onSourceChange?.(logFileSource(file.id));
                      return;
                    }
                    const next = SOURCES.find((entry) => entry.id === value);
                    if (!next) return;
                    setSource(next.id);
                    onSourceChange?.(next.id);
                  }}
                >
                  <SidebarSection title="Devices">
                    {DEVICES.map((entry) => (
                      <SidebarItem
                        key={entry.id}
                        value={entry.id}
                        label={entry.id === "device" ? deviceName : entry.title}
                        icon={<SourceIcon kind={entry.icon} />}
                      />
                    ))}
                  </SidebarSection>
                  <SidebarSection title="Reports">
                    {REPORTS.map((entry) => (
                      <SidebarItem
                        key={entry.id}
                        value={entry.id}
                        label={entry.title}
                        icon={<SourceIcon kind={entry.icon} />}
                      />
                    ))}
                  </SidebarSection>
                  {logFiles.length > 0 ? (
                    <SidebarSection title="Log Files">
                      {logFiles.map((file) => (
                        <SidebarItem
                          key={file.id}
                          value={logFileSource(file.id)}
                          label={file.name}
                          icon={<SourceIcon kind="file" />}
                          data-log-file={file.id}
                        />
                      ))}
                    </SidebarSection>
                  ) : null}
                </Sidebar>
              </ContextualMenuTrigger>
              <ContextualMenuPopup>
                <MenuItem
                  disabled={menuFile === undefined}
                  onClick={() => consoleCommands.current.revealFile(menuFile)}
                >
                  Reveal in Finder
                </MenuItem>
                <MenuItem
                  disabled={menuFile === undefined}
                  onClick={() => consoleCommands.current.trashFile(menuFile)}
                >
                  Move to Trash
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  disabled={menuFile === undefined}
                  onClick={() => {
                    if (menuFile !== undefined) consoleCommands.current.forgetFile(menuFile);
                  }}
                >
                  Remove from Sidebar
                </MenuItem>
              </ContextualMenuPopup>
            </ContextualMenu>
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize sidebar" style={DIVIDER} />
          <SplitViewPane minSize={320}>
            <SplitView orientation="vertical" className="mac-console-content">
              <SplitViewPane minSize={67} className="mac-console-messages">
                <ContextualMenu>
                  <ContextualMenuTrigger
                    className="mac-console-table-frame"
                    onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
                      const id = (event.target as Element)
                        .closest("[role='row']")
                        ?.querySelector("[data-console-message]")
                        ?.getAttribute("data-console-message");
                      if (id && !selectedIds.includes(Number(id))) select([Number(id)]);
                    }}
                  >
                    <TableView
                      viewportRef={viewport}
                      aria-label="Messages"
                      className="mac-console-table"
                      style={TABLE}
                      columns={columns}
                      rowCount={rows.length}
                      rowHeight={ROW_HEIGHT}
                      size="mini"
                      header="translucent"
                      alternatingRows
                      getRowId={(row) => rows[row]?.id ?? -1}
                      getRowLabel={(row) => rows[row]?.process ?? ""}
                      selectionMode="multiple"
                      value={selectedIds}
                      onValueChange={(next) => {
                        select(next.filter((id): id is number => typeof id === "number"));
                        // A message chosen by hand stays where it is: Now lets go of the table.
                        setFollowing(false);
                      }}
                      sort={sort}
                      onSortChange={setSort}
                      onWheel={(event) => {
                        if (event.deltaY < 0) setFollowing(false);
                      }}
                      renderCell={(row, column) => {
                        const message = rows[row];
                        if (!message) return null;
                        if (column.id === "type") return <TypeMark type={message.type} />;
                        return (
                          <span className="mac-console-cell" data-console-message={message.id}>
                            {column.id === "time"
                              ? message.time
                              : column.id === "process"
                                ? message.process
                                : column.id === "subsystem"
                                  ? message.subsystem
                                  : column.id === "category"
                                    ? message.category
                                    : message.message}
                          </span>
                        );
                      }}
                    />
                    {feed && source === "device" && activities && rows.length === 0 ? (
                      <EmptyState className="mac-console-no-reports">
                        This desktop’s log records no activities.
                      </EmptyState>
                    ) : null}
                    {source !== "device" &&
                    fileShown === undefined &&
                    noReportsNote &&
                    all.length === 0 ? (
                      <EmptyState className="mac-console-no-reports">{noReportsNote}</EmptyState>
                    ) : null}
                  </ContextualMenuTrigger>
                  <ContextualMenuPopup>
                    <MenuItem
                      disabled={!hasSelection}
                      onClick={() => consoleCommands.current.copy()}
                    >
                      Copy
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      disabled={!selected}
                      onClick={() => consoleCommands.current.showProcess()}
                    >
                      {selected ? `Show Process “${selected.process}”` : "Show Process"}
                    </MenuItem>
                    <MenuItem
                      disabled={!selected}
                      onClick={() => consoleCommands.current.hideProcess()}
                    >
                      {selected ? `Hide Process “${selected.process}”` : "Hide Process"}
                    </MenuItem>
                    {keepsLayout ? (
                      <>
                        <MenuItem
                          disabled={!selected?.category}
                          onClick={() => consoleCommands.current.showCategory()}
                        >
                          {selected?.category
                            ? `Show Category “${selected.category}”`
                            : "Show Category"}
                        </MenuItem>
                        <MenuSeparator />
                        {columnsMenu}
                      </>
                    ) : null}
                  </ContextualMenuPopup>
                </ContextualMenu>
              </SplitViewPane>
              {infoShown ? (
                <>
                  <SplitViewDivider aria-label="Resize message details" />
                  <SplitViewPane defaultSize={272} minSize={90}>
                    <section aria-label="Message details" className="mac-console-detail">
                      {selected ? (
                        // A new message starts with its extra details folded away.
                        <Detail key={selected.id} message={selected} />
                      ) : (
                        <EmptyState>
                          {selectedRows.length > 1
                            ? `${selectedRows.length} Messages Selected`
                            : "No Message Selected"}
                        </EmptyState>
                      )}
                    </section>
                  </SplitViewPane>
                </>
              ) : null}
            </SplitView>
          </SplitViewPane>
        </SplitView>
      </WindowBody>
      {keepsLayout ? (
        <>
          <Sheet open={opening} onOpenChange={setOpening}>
            <SheetPopup anchor={titleBar} width={760} aria-label="Open a Log File">
              {opening ? (
                <DriveOpenPanel
                  accept={isLogFile}
                  onOpen={(entry) => {
                    setOpening(false);
                    openLogFiles([{ id: entry.id, name: entry.name }]);
                  }}
                  onCancel={() => setOpening(false)}
                />
              ) : null}
            </SheetPopup>
          </Sheet>
          <Sheet open={saving} onOpenChange={setSaving}>
            <SheetPopup anchor={titleBar} width={640} aria-label="Save a Copy As">
              {saving ? (
                <DriveSavePanel
                  defaultName="Console.log"
                  defaultFolder="documents"
                  defaultExpanded
                  onSave={(target) => {
                    setSaving(false);
                    const shown = selectedRows.length > 0 ? selectedRows : rows;
                    saveToDrive(
                      target,
                      new Blob([copyableMessages(shown)], { type: "text/plain" }),
                    ).catch(failed("The log could not be saved."));
                  }}
                  onCancel={() => setSaving(false)}
                />
              ) : null}
            </SheetPopup>
          </Sheet>
          <Sheet
            open={failure !== undefined}
            onOpenChange={(open) => {
              if (!open) setFailure(undefined);
            }}
          >
            <SheetPopup anchor={titleBar} width={420}>
              <SheetTitle>{failure?.title}</SheetTitle>
              <SheetDescription>{failure?.detail}</SheetDescription>
              <SheetActions>
                <SheetClose render={<DefaultButton />}>OK</SheetClose>
              </SheetActions>
            </SheetPopup>
          </Sheet>
        </>
      ) : null}
    </Window>
  );
}
