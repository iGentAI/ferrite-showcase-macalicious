"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { cn } from "macalicious/lib/cn";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { PathBar, PathBarItem } from "macalicious/path-bar";
import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
  ScopeBarLabel,
} from "macalicious/scope-bar";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Slider } from "macalicious/slider";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { StatusBar } from "macalicious/status-bar";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage, type SystemImageName } from "macalicious/system-image";
import { TagDot } from "macalicious/tag-dot";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarPullDown, type ToolbarPullDownProps } from "macalicious/toolbar-pop-up";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowBanner, WindowBannerAction } from "macalicious/window-banner";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";
import {
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  Fragment,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  quickActionsFor,
  runQuickActionOnFiles,
  useSavedWorkflows,
} from "../automator/automator-library";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import {
  clearCopiedDriveItems,
  copiedDriveItems,
  copyDriveItems,
  useCopiedDriveItems,
} from "../desktop/desktop-clipboard";
import {
  beginDesktopDrag,
  type DesktopDrag,
  type DesktopDragItem,
  type DropLanding,
  filesOfDrag,
  registerDropTarget,
} from "../desktop/desktop-drag";
import { requestDesktopEffects, tellFinderFolder } from "../desktop/desktop-effects";
import {
  currentDrive,
  type DriveOp,
  downloadFile,
  driveAvailable,
  entryOf,
  loadDrive,
  markOpened,
  readFile,
  runOps,
  SPECIAL_FOLDER_IDS,
  uploadFile,
  useDrive,
} from "../desktop/desktop-files";
import { LAUNCHPAD_APP_DRAG } from "../desktop/desktop-launchpad-folders";
import {
  changeDesktopValue,
  desktopValues,
  desktopValuesLoaded,
  keepInDock,
  readBoolean,
  readNumber,
  subscribeDesktopValues,
  useDesktopSetting,
  useDesktopValue,
} from "../desktop/desktop-personal";
import { currentDesktopSession } from "../desktop/desktop-server";
import { AIRDROP_REASON, FileShareItems } from "../desktop/desktop-share-link";
import { followDrag } from "../desktop/desktop-spaces-bar";
import { DesktopWindowHostContext, DesktopWindowName } from "../desktop/desktop-windows";
import { extensionOf } from "../preview/preview-export";
import { requestPane } from "../system-preferences/pane-request";
import {
  showDrivePicture,
  takePictureChoice,
} from "../system-preferences/panes/desktop-and-screen-saver/stored-picture";
import { type ArchiveFile, MOST_ARCHIVE_ENTRIES, zipBlob } from "./finder-archive";
import { ItemIcon, SidebarGlyph, type SidebarGlyphName } from "./finder-artwork";
import { FinderClipboard } from "./finder-clipboard";
import { carriesClipping, clippingFile } from "./finder-clipping";
import { useContentHits } from "./finder-content-search";
import {
  type FinderContextCommands,
  FinderContextRows,
  type FinderContextTarget,
  OpenWithRows,
} from "./finder-context-menu";
import { contentsWords, newCriterion } from "./finder-criteria";
import { FinderCriterionRow } from "./finder-criteria-rows";
import { removeCustomIcon, setCustomIcon } from "./finder-custom-icon";
import {
  AIRDROP,
  ALL_TAGS,
  addNode,
  ancestry,
  availableName,
  COMPUTER,
  COMPUTER_NAME,
  changeNode,
  columnPath,
  createFileSystem,
  createFolder,
  DEFAULT_SORT,
  duplicateName,
  expandPath,
  type FinderEntry,
  type FinderNode,
  type FinderSort,
  type FinderView,
  formatSize,
  gathers,
  HOME,
  isContainer,
  isVirtual,
  joinPath,
  listing,
  locationName,
  NETWORK,
  parentPath,
  RECENTS,
  removeNode,
  resolve,
  search,
  serverAddress,
  serverAt,
  sizeOf,
  sortDirection,
  sortEntries,
  statusText,
  TAGS,
  TRASH,
  tagLocation,
  withHiddenShown,
} from "./finder-data";
import {
  CONNECT_REASON,
  FinderConnectionFailed,
  FinderConnectToServer,
  FinderCopyProgress,
  FinderDeleteNow,
  FinderDriveAlert,
  FinderEjectWarning,
  FinderEmptyTrash,
  FinderExtensionWarning,
  FinderGoToFolder,
  FinderReplace,
  FinderSaveSearch,
} from "./finder-dialogs";
import { type DropTarget, refusalFor } from "./finder-drag";
import { driveTree, isInTrash, kindOf, pathOfEntry, useDriveFile } from "./finder-drive";
import { GROUPS, groupEntries, NO_GROUP } from "./finder-groups";
import {
  FINDER_INFO_HOST,
  FinderInfo,
  type FinderItemFlag,
  FinderSummaryInfo,
} from "./finder-info";
import { type Annotation, saveMarkedPicture } from "./finder-markup";
import { beginMarquee } from "./finder-marquee";
import {
  EJECT_REASON,
  type FinderMenuCommands,
  finderAppRows,
  finderEditRows,
  finderFileRows,
  finderGoRows,
  finderHelpRows,
  finderMenuKeys,
  finderViewRows,
  finderWindowRows,
  Row,
} from "./finder-menus";
import {
  appForFile,
  appsForFile,
  chooseOpenerFor,
  type OpenFileRequest,
  onOpenFileRequest,
  openerName,
  openFile,
  requestOpenFile,
  takeOpenFileRequests,
} from "./finder-open";
import { FinderQuickLook } from "./finder-quick-look";
import {
  type BatchItem,
  FinderRenameField,
  FinderRenameItems,
  isItemName,
  nameElementOf,
} from "./finder-rename";
import { saveTurnedLeft } from "./finder-rotate";
import {
  ALIAS_TYPE,
  claimExpired,
  claimWindowRestore,
  expiredTrash,
  FINDER_DEFAULTS,
  FINDER_FAVORITES,
  FINDER_FOLDERS,
  FINDER_FOLDERS_FIRST,
  FINDER_HIDDEN_MENU_TAGS,
  FINDER_HIDDEN_PLACES,
  FINDER_HIDDEN_SECTIONS,
  FINDER_HIDDEN_TAGS,
  FINDER_NEW_WINDOW,
  FINDER_PATH_BAR,
  FINDER_PREVIEW,
  FINDER_RECENT_FOLDERS,
  FINDER_SEARCH_SCOPE,
  FINDER_SEARCHES,
  FINDER_SERVERS,
  FINDER_SHOW_HIDDEN,
  FINDER_SHOWN_PLACES,
  FINDER_SIDEBAR_DISKS,
  FINDER_SIDEBAR_ORDER,
  FINDER_SIDEBAR_SHOWN,
  FINDER_SIDEBAR_WIDTH,
  FINDER_STATUS_BAR,
  FINDER_TAB_BAR,
  FINDER_TOOLBAR,
  FINDER_TOOLBAR_ITEMS,
  FINDER_TOOLBAR_MODE,
  FINDER_TRASH_AFTER_30,
  FINDER_WARN_EMPTY,
  FINDER_WARN_EXTENSION,
  FINDER_WINDOW,
  type FolderSettings,
  fitWindow,
  inSidebarOrder,
  NO_FAVORITES,
  NO_FOLDERS,
  NO_NAMES,
  NO_SEARCHES,
  NO_SETTINGS,
  RECENT_TAGS,
  readFavorites,
  readFolderSettings,
  readFolders,
  readNames,
  readScope,
  readSearches,
  readText,
  readWindow,
  releaseExpired,
  type SavedSearch,
  sidebarOrderFits,
  useFinderSetting,
  withChangedSearch,
  withFavoriteMoved,
  withFavorites,
  withFolder,
  withRecentFolder,
  withSearch,
} from "./finder-saved";
import {
  FinderSearchSuggestions,
  type SearchSuggestion,
  searchSuggestions,
} from "./finder-search-suggestions";
import { clearFinderSelection, publishFinderSelection } from "./finder-selection";
import { FinderSlideshow } from "./finder-slideshow";
import {
  activeTab,
  canGoBack,
  canGoForward,
  createState,
  type FinderScope,
  type FinderState,
  type FinderTab,
  isSearching,
  locationOf,
  reduce,
} from "./finder-state";
import {
  DEFAULT_TOOLBAR,
  FinderCustomizeToolbar,
  FinderToolbarMenuRows,
  readToolbarItems,
  readToolbarMode,
  TOOLBAR_GLYPHS,
  type ToolbarMode,
  toolbarDropProps,
  toolbarItems,
} from "./finder-toolbar-customize";
import {
  replayStep,
  runMaking,
  runNewFolderWithItems,
  runUndoable,
  type UndoName,
  useFinderUndo,
} from "./finder-undo";
import { FinderViewOptions } from "./finder-view-options";
import { ColumnsView, Gallery, IconsView, itemOfRow, ListingView } from "./finder-views";
import {
  type FinderWindowHandle,
  mergeFinderWindows,
  readWindowOpening,
  registerFinderWindow,
  tabContents,
  useFinderWindowCount,
} from "./finder-windows";
import "./finder.tokens.css";
import "./finder.css";

const FAVORITES: readonly { location: string; label: string; glyph: SidebarGlyphName }[] = [
  { location: AIRDROP, label: "AirDrop", glyph: "airdrop" },
  { location: RECENTS, label: "Recents", glyph: "recents" },
  { location: "/Applications", label: "Applications", glyph: "applications" },
  { location: `${HOME}/Desktop`, label: "Desktop", glyph: "desktop" },
  { location: `${HOME}/Documents`, label: "Documents", glyph: "documents" },
  { location: `${HOME}/Downloads`, label: "Downloads", glyph: "downloads" },
];

/** The rows Preferences' Sidebar pane adds, which a Mac leaves out at first. */
const OPTIONAL_FAVORITES: readonly { location: string; label: string; glyph: SidebarGlyphName }[] =
  [
    { location: `${HOME}/Movies`, label: "Movies", glyph: "movies" },
    { location: `${HOME}/Music`, label: "Music", glyph: "music" },
    { location: `${HOME}/Pictures`, label: "Pictures", glyph: "pictures" },
    { location: HOME, label: "Home", glyph: "home" },
  ];

const ICLOUD = `${HOME}/Library/iCloud Drive`;

/**
 * Finder's section titles sit 1 pt lower than the shared sidebar's: the Favorites cap top is
 * 10.5 pt under the toolbar (Light-Applications y=207), and every header measures 1 pt high with
 * the default 2 pt inset, while Mail's match it. The rows are unaffected. [measured]
 */
const SIDEBAR_STYLE = { "--mac-sidebar-header-inset": "3px" } as CSSProperties;

/** How near a row's edge a drag counts as between two rows, in points. */
const FAVORITE_GAP = 4;

const VIEWS: readonly { view: FinderView; label: string; image: SystemImageName }[] = [
  { view: "icons", label: "Icons", image: "icon-view" },
  { view: "list", label: "List", image: "list-view" },
  { view: "columns", label: "Columns", image: "column-view" },
  { view: "gallery", label: "Gallery", image: "gallery-view" },
];

const SORTS = [
  { column: "name", label: "Name" },
  { column: "kind", label: "Kind" },
  { column: "opened", label: "Date Last Opened" },
  { column: "modified", label: "Date Modified" },
  { column: "created", label: "Date Created" },
  { column: "size", label: "Size" },
  { column: "tags", label: "Tags" },
];

const SHARE_WITH = ["Mail", "Messages", "AirDrop", "Notes"];

/** How far from the tab bar a tab's drag becomes a window of its own, in points. */
const TAB_TEAR_DISTANCE = 40;

/** The paths the Go to Folder dialog offers before any was typed, the first in its field. */
const GO_FOLDERS = ["~/Documents/", "~/Downloads/", "~/Library/", "~/.Trash/"];

/** One item of a copy: what is copied, the name it gets and whether it takes an item's place. */
interface CopyItem {
  node: FinderNode;
  name: string;
  replaces: boolean;
}

/** A paste or a drag, from the command to the last item's arrival in the folder. */
interface CopyJob {
  /** The folder the items go to. */
  destination: string;
  /** The items leave where they were, as a drag between folders of the drive does. */
  moves: boolean;
  /** The items that are settled. */
  items: readonly CopyItem[];
  /** The items the folder already has one of: the Replace alert asks about each in turn. */
  conflicts: readonly FinderNode[];
  /** How far the copy is, of `COPY_STEPS`. It runs once no item is left to ask about. */
  step: number;
}

/**
 * A copy is played, not carried out: nothing is read or written, so every copy takes the same
 * two seconds, in twenty steps, and its items arrive together at the end.
 */
const COPY_STEPS = 20;
const COPY_STEP_MS = 100;

/** The windows beside the Finder window that are not its panels: one can have the keyboard. */
type Aside = "connect" | "copy";

/** One item of an archive before its bytes are read. */
interface ArchiveEntry {
  id?: string;
  path: string;
  modified: number;
  size: number;
}

/** The most Compress reads into memory at a time: the browser holds it all while it packs. */
const MOST_ARCHIVE_BYTES = 512 * 1024 * 1024;

const compressTitleOf = (names: readonly string[]) =>
  names.length === 1
    ? `Compress “${names[0]}”`
    : names.length > 1
      ? `Compress ${names.length} Items`
      : "Compress";

/** Whether a browser can print the file from a frame. */
const printable = (node: FinderNode) =>
  node.kind === "image" || node.kind === "pdf" || node.kind === "document";

/**
 * Prints `blob` from a frame of its own, which goes a minute later: the dialog holds it till then. What
 * the browser would run (a script in an SVG or an HTML file) stays in a frame that may run nothing.
 * A PDF is shown by the browser's own viewer, which such a frame refuses, under its media type alone.
 */
function printBlob(blob: Blob, pdf: boolean) {
  const url = URL.createObjectURL(pdf ? new Blob([blob], { type: "application/pdf" }) : blob);
  const frame = document.createElement("iframe");
  frame.hidden = true;
  if (!pdf) frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.dataset.finderPrint = blob.type;
  frame.src = url;
  frame.onload = () => frame.contentWindow?.print();
  document.body.append(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/** An upload to the person's drive or a download from it, while it runs. */
interface Transfer {
  verb: "Uploading" | "Downloading" | "Compressing";
  items: readonly FinderNode[];
  destination: string;
  /** Bytes moved so far, of `total`. */
  done: number;
  total: number;
  /** When it began, to tell the time left. */
  started: number;
  controller: AbortController;
}

/** The ids of the six home folders of the drive, which cannot be renamed, moved or trashed. */
const HOME_FOLDER_IDS: ReadonlySet<string> = new Set(Object.values(SPECIAL_FOLDER_IDS));

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A copy of the tree in which a computer of the network is connected: it lists its folders. */
const connected = (tree: FinderNode, path: string) =>
  changeNode(tree, path, (node) => ({
    ...node,
    children: node.children ?? [createFolder("Public"), createFolder("Shared")],
  }));

/** The two windows Finder opens beside its own: Get Info and Quick Look. */
type Panel = "info" | "quick-look";

/** The frame of the Finder window in the panels' container when a panel opened. */
interface PanelFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

const NO_FRAME: PanelFrame = { left: 0, top: 0, width: 0, height: 0 };

/** The element the panels' group is put into, and the z-index the group has there. */
interface PanelStack {
  host: HTMLElement;
  level: number;
}

/**
 * Where a window's panels go so that they are ranked with it: the element that holds the
 * outermost element around the window (or the window itself) that sets a z-index, and that
 * z-index. There the panels' group, at the same level and later in the document, stands right
 * over the window and under everything a host ranks higher. A window that nothing ranks has
 * its panels in the document body. A given `layer` holds the panels itself.
 */
function stackOf(element: HTMLElement, layer: HTMLElement | null): PanelStack {
  if (layer && !layer.contains(element)) return { host: layer, level: 0 };
  let ranked: HTMLElement | null = null;
  let level = 0;
  for (
    let node: HTMLElement | null = element;
    node && node !== layer && node !== document.body;
    node = node.parentElement
  ) {
    const own = Number.parseInt(getComputedStyle(node).zIndex, 10);
    if (Number.isFinite(own)) {
      ranked = node;
      level = own;
    }
  }
  return { host: layer ?? ranked?.parentElement ?? document.body, level };
}

export interface FinderProps extends Omit<WindowProps, "children"> {
  /**
   * The file system the window opens with, held in memory: the root is the startup disk. The
   * window keeps its own copy, which New Folder, tags and rotation change, so a tree given
   * later is not taken up; give the window another `key` to start it on another tree.
   * @default the tree of `createFileSystem()`
   */
  fileSystem?: FinderNode;
  /**
   * Whether the window shows the person's drive (`demos/desktop/desktop-files.ts`) instead of a
   * tree held in memory: folders and files kept on the desktop's Ferrite application, which the
   * window creates, uploads, renames, moves, copies, trashes, puts back and downloads for real.
   * Only the desktop that Ferrite serves has a drive; elsewhere this changes nothing.
   * @default true there when no `fileSystem` is given
   */
  drive?: boolean;
  /**
   * The locations of the tabs the window opens with: paths such as `/Applications`, or one of
   * the places `RECENTS`, `AIRDROP`, `COMPUTER`. The tab bar shows with two tabs or more.
   * @default the home folder, in one tab
   */
  defaultTabs?: readonly string[];
  /** What another window asked this one to show: a tab moved out to a window of its own. */
  opening?: unknown;
  /**
   * Index of the tab shown at first.
   * @default 0
   */
  defaultActiveTab?: number;
  /**
   * How the tabs show their folder at first.
   * @default "icons"
   */
  defaultView?: FinderView;
  /** Paths of the items selected at first in the tab shown. */
  defaultSelection?: readonly string[];
  /** Column view: the path of the item selected in each column at first. */
  defaultColumns?: readonly string[];
  /** Text in the search field at first: the window opens on the results. */
  defaultQuery?: string;
  /**
   * Side of the icons of the icon view at first, in points. The slider in the status bar
   * changes it.
   * @default 64
   */
  defaultIconSize?: number;
  /**
   * Whether the path bar is shown at first. The Action menu shows and hides it.
   * @default true
   */
  defaultPathBar?: boolean;
  /**
   * Whether the status bar is shown at first. The Action menu shows and hides it.
   * @default true
   */
  defaultStatusBar?: boolean;
  /**
   * Width of the sidebar at first, in points. The divider resizes it.
   * @default 164
   */
  sidebarWidth?: number;
  /**
   * The sidebar's surface: the vibrant material, for a window over a desktop, or the same
   * surface as captured over a neutral window.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** Called when a file or an application is opened: a double click, or Return on it. */
  onOpen?: (path: string, node: FinderNode) => void;
  /** Called when a destination is chosen in the Share menu, with the selected paths. */
  onShare?: (destination: string, paths: readonly string[]) => void;
  /**
   * Called by Share Screen in a network computer's panel, with the computer's path. Without
   * it the button is disabled.
   */
  onShareScreen?: (path: string) => void;
  /**
   * Called by the help button of the Connect to Server dialog. Without it the button is
   * disabled.
   */
  onHelp?: () => void;
  /**
   * Paths of disks under `/Volumes` that were disconnected without being ejected, which is
   * something that happens to a Mac and not a command of Finder: each disk named here leaves
   * the sidebar and the tree, a tab that showed it shows the computer, and the window posts
   * the “Disk Not Ejected Properly” notification for it. A path taken out of the list later
   * does not bring its disk back.
   */
  disconnected?: readonly string[];
  /**
   * The element the Info window and Quick Look are put into. They are windows of their own,
   * not parts of this one, and stand over it where it was when they opened. Without it they
   * go beside the window where a host ranks it: into the element that holds the outermost
   * element around the window that sets a z-index, at that z-index, or else into the body.
   * @default beside the window, or `document.body`
   */
  panelContainer?: HTMLElement | null;
  /**
   * From a desktop that hosts an application's further windows (its descriptor says
   * `windows`): the Info window and Quick Look are then windows of that desktop, which places,
   * moves and orders them, instead of panels this window places over itself.
   */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  /** Called when the close button is activated. */
  onClose?: WindowControlsProps["onClose"];
  /** Called when the minimize button is activated. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** Called when the zoom button is activated. */
  onZoom?: WindowControlsProps["onZoom"];
  /** What the zoom button does, as on `WindowControls`. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** Disable the minimize button. */
  minimizeDisabled?: boolean;
  /** Disable the zoom button. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`: labels, a disabled close button. */
  controlsProps?: WindowControlsProps;
  /**
   * Called when the primary pointer button goes down on the title bar or the toolbar, not on
   * a control in them: a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/**
 * The column path a tab really has open: its stored path as far as each item is still listed
 * where the column before it shows it. An item that left the tree, or the listing of a place
 * such as a tag, ends the path there, so that nothing that is not shown is ever open.
 */
function openColumns(root: FinderNode, tab: FinderTab): string[] {
  const open: string[] = [];
  let column = listing(root, locationOf(tab));
  for (const path of tab.columns) {
    if (!column.some((entry) => entry.path === path)) break;
    open.push(path);
    column = listing(root, path);
  }
  return open;
}

/** The folder whose name a tab goes by: in column view, the deepest one selected. */
function placeOf(root: FinderNode, tab: FinderTab): string {
  const location = locationOf(tab);
  if (tab.view !== "columns") return location;
  const columns = openColumns(root, tab);
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const path = columns[index] as string;
    const node = resolve(root, path);
    if (node && (isContainer(node) || node.kind === "server")) return path;
  }
  return location;
}

/**
 * The folder a tab shows, in column view the deepest one selected: where a search that
 * begins now looks. A place such as Recents has no folder.
 */
function folderOf(root: FinderNode, tab: FinderTab): string | null {
  const location = locationOf(tab);
  const place = placeOf(root, tab);
  const node = resolve(root, place);
  return node && isContainer(node) ? place : isVirtual(location) ? null : location;
}

/**
 * Where the tab's search looks. A search of the tab's own scope looks in the folder that was
 * shown when the search began (`tab.origin`); a search begun in a place without a folder is
 * of the whole disk whatever the tab's scope says.
 */
function searchOrigin(tab: FinderTab): { scope: FinderScope; folder: string } {
  const scope = tab.origin === null ? "mac" : tab.scope;
  return { scope, folder: scope === "mac" || tab.origin === null ? "/" : tab.origin };
}

/** A tab's title, which is the window's while the tab is shown. */
function titleOf(root: FinderNode, tab: FinderTab): string {
  if (!isSearching(tab)) return locationName(root, placeOf(root, tab));
  if (tab.query === "") return "New Smart Folder";
  const { scope, folder } = searchOrigin(tab);
  return `Searching ${scope === "mac" ? "This Mac" : `“${locationName(root, folder)}”`}`;
}

/** The items a tab shows at the top level: a folder's, a place's, or a search's results. */
function contentsOf(
  root: FinderNode,
  tab: FinderTab,
  sort: FinderSort,
  contentHits?: ReadonlySet<string>,
  rowHits?: ReadonlySet<string>,
): FinderEntry[] {
  return isSearching(tab)
    ? sortEntries(
        search(root, searchOrigin(tab).folder, tab.query, tab.rows, contentHits, rowHits),
        sort,
      )
    : listing(root, locationOf(tab), sort);
}

/** Whether a tab's list is flat: search results and gathered places do not expand. */
const isFlat = (tab: FinderTab) => isSearching(tab) || gathers(locationOf(tab));

/**
 * The paths of the items a tab shows and that can therefore be selected: its top-level items;
 * in the list of a folder also the items of the expanded folders, as far as every folder
 * above them is expanded; in the columns also the items of each open column.
 */
function selectable(
  root: FinderNode,
  entries: readonly FinderEntry[],
  tab: FinderTab,
  sort: FinderSort,
): Set<string> {
  const paths = new Set(entries.map((entry) => entry.path));
  if (isFlat(tab)) return paths;
  if (tab.view === "list") {
    const open = new Set(tab.expanded);
    const walk = (entry: FinderEntry) => {
      if (!open.has(entry.path) || !isContainer(entry.node)) return;
      for (const child of listing(root, entry.path, sort)) {
        paths.add(child.path);
        walk(child);
      }
    };
    entries.forEach(walk);
  } else if (tab.view === "columns") {
    for (const path of openColumns(root, tab)) {
      for (const child of listing(root, path, sort)) paths.add(child.path);
    }
  }
  return paths;
}

/**
 * What is selected in a tab: in the columns the item of the last open column, or several of the column
 * it stands in; elsewhere the stored selection, as far as the tab shows it.
 */
function selectionOf(
  root: FinderNode,
  entries: readonly FinderEntry[],
  tab: FinderTab,
  sort: FinderSort,
): string[] {
  if (tab.view === "columns" && !isSearching(tab)) {
    if (tab.noneSelected && tab.selection.length === 0) return [];
    const open = openColumns(root, tab);
    const holder = open.at(-2);
    const beside = new Set(
      (holder === undefined ? entries : listing(root, holder, sort)).map(({ path }) => path),
    );
    const several = tab.selection.filter((path) => beside.has(path));
    return several.length > 1 && several.includes(open.at(-1) as string) ? several : open.slice(-1);
  }
  const paths = selectable(root, entries, tab, sort);
  return tab.selection.filter((path) => paths.has(path));
}

const isTextEntry = (target: EventTarget) =>
  target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]") !== null;

/** How long after a click a click on the same name starts renaming, not a double click. */
const SLOW_RENAME_MS = 600;

/** `arrivedAt` while the window's tabs are being put back. */
const RESTORING = "restoring";

/** Whether a key was pressed in one of the views of items, not on a control or in a field. */
const isInItems = (target: EventTarget) =>
  target instanceof HTMLElement &&
  !isTextEntry(target) &&
  target.closest('[role="listbox"], [role="treegrid"]') !== null;

/**
 * The Action pull-down, whose rows name the selection. Once it closes its rows stay as they were
 * until its fade ends: a command that changes the selection would otherwise resize the closing
 * menu, which WebKit reports as a ResizeObserver loop on its positioner.
 */
function ActionPullDown({ children, ...props }: ToolbarPullDownProps) {
  const [open, setOpen] = useState(false);
  const rows = useRef(children);
  if (open) rows.current = children;
  return (
    <ToolbarPullDown {...props} onOpenChange={setOpen}>
      {rows.current}
    </ToolbarPullDown>
  );
}

/**
 * Finder, as in macOS 10.15 Catalina, on a file system held in memory: a sidebar of places, a
 * toolbar with Back and Forward, the four views, the Group, Action, Share and Tags menus and
 * a search field, window tabs, the search scope bar, a path bar and a status bar. Get Info and
 * Quick Look open beside it as windows of their own, through a portal to where the host ranks
 * the window (see `panelContainer`). The Action menu also copies and pastes items, empties the
 * Trash and opens the Go to Folder and Connect to Server dialogs; those, the Copy window, the
 * alerts and the notification about a disconnected disk are in `finder-dialogs.tsx`.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its title bar through the callbacks.
 */
export function Finder({
  fileSystem,
  drive: driveProp,
  defaultTabs,
  defaultActiveTab = 0,
  defaultView = "icons",
  defaultSelection,
  defaultColumns,
  defaultQuery = "",
  defaultIconSize = 64,
  defaultPathBar = true,
  defaultStatusBar = true,
  sidebarWidth = 164,
  material = "translucent",
  onOpen,
  onShare,
  onShareScreen,
  onHelp,
  disconnected,
  panelContainer,
  DesktopWindow,
  state: windowState = "key",
  opening,
  ref,
  onFocusCapture,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  className,
  onKeyDown,
  ...windowProps
}: FinderProps) {
  const driveMode = (driveProp ?? fileSystem === undefined) && driveAvailable();
  // What the host knows, passed in by the Finder served by Ferrite only: Get Info on the person's drive names the
  // application and says why the name, the permissions and the comments cannot be changed or kept, and Connect to
  // Server says a web page cannot reach file servers. An example draws both windows as captured.
  const infoHost = driveMode ? FINDER_INFO_HOST : undefined;
  const unreachableReason = driveAvailable() ? CONNECT_REASON : undefined;
  const driveData = useDrive(driveMode);
  // Pictures turned and not yet saved, or of a kind that cannot be written back.
  const [turned, setTurned] = useState<Readonly<Record<string, number>>>({});
  const turnsSaving = useRef<Promise<void>>(Promise.resolve());
  const [showHidden, setShowHidden] = useDesktopSetting(FINDER_SHOW_HIDDEN, readBoolean, false);
  const driveRoot = useMemo(() => {
    if (!driveMode) return null;
    const tree = driveTree(driveData, turned);
    return showHidden ? withHiddenShown(tree) : tree;
  }, [driveMode, driveData, turned, showHidden]);
  const [localRoot, setRoot] = useState<FinderNode>(() => fileSystem ?? createFileSystem());
  const root = driveRoot ?? localRoot;
  // The tree as the last change left it. Two effects of one render can each change the tree
  // (a copy arrives while a disk goes): the second builds on what the first put in place.
  const latest = useRef(root);
  latest.current = root;
  const askedTab = readWindowOpening(opening);
  // A tab can move out to a window of its own only on a desktop, which opens that window.
  const desktopHost = use(DesktopWindowHostContext);
  const [state, dispatch] = useReducer(reduce, undefined, (): FinderState => {
    let start = createState(
      defaultTabs?.length ? defaultTabs : [HOME],
      defaultActiveTab,
      defaultView,
    );
    if (askedTab) {
      return { ...start, tabs: [{ ...askedTab, id: start.active }] };
    }
    if (defaultColumns) start = reduce(start, { type: "columns", columns: defaultColumns });
    else if (defaultView === "columns" && defaultSelection) {
      // The columns open on the item selected at first, as they do when the view is chosen.
      const columns = columnPath(root, locationOf(activeTab(start)), defaultSelection[0]);
      start = reduce(start, { type: "columns", columns });
    }
    if (defaultQuery) {
      const origin = folderOf(root, activeTab(start));
      start = reduce(start, { type: "query", query: defaultQuery, origin });
    }
    if (defaultSelection) start = reduce(start, { type: "select", selection: defaultSelection });
    return start;
  });
  // On the drive what the window shows is kept for the person; a folder keeps its own view, sort
  // and icon size, by its id, or by its path for the places that are not the drive's (the home
  // folder, Recents). A window on a tree in memory forgets them with itself.
  const shownAtFirst = locationOf(activeTab(state));
  const folderId =
    driveMode && driveData ? (resolve(root, shownAtFirst)?.id ?? shownAtFirst) : undefined;
  const [folderValues, setFolderValues] = useDesktopSetting(
    FINDER_FOLDERS,
    readFolders,
    NO_FOLDERS,
  );
  const folderOwn = folderId ? folderValues[folderId] : undefined;
  const [folderDefaults, setFolderDefaults] = useDesktopSetting(
    FINDER_DEFAULTS,
    readFolderSettings,
    NO_SETTINGS,
  );
  const viewOptions: FolderSettings = driveMode ? { ...folderDefaults, ...folderOwn } : NO_SETTINGS;
  const keptView = driveMode ? (folderOwn?.view ?? folderDefaults.view) : undefined;
  const keepForFolder = (change: FolderSettings) => {
    if (folderId) setFolderValues(withFolder(folderValues, folderId, change));
  };
  const [baseSort, setBaseSort] = useState<FinderSort>(DEFAULT_SORT);
  const keptSort = viewOptions.sort ?? baseSort;
  const [baseGroup, setBaseGroup] = useState(NO_GROUP);
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const [slides, setSlides] = useState<readonly FinderEntry[] | null>(null);
  const groupBy = viewOptions.group ?? baseGroup;
  const setGroupBy = (next: string) => {
    if (folderId) keepForFolder({ group: next });
    else setBaseGroup(next);
  };
  const allSizes = viewOptions.allSizes ?? false;
  const foldersFirst = useDesktopValue(FINDER_FOLDERS_FIRST, readBoolean, false) && driveMode;
  const sort = useMemo(
    () => ({ ...keptSort, allSizes, foldersFirst }),
    [keptSort, allSizes, foldersFirst],
  );
  const warnEmpty = useDesktopValue(FINDER_WARN_EMPTY, readBoolean, true) || !driveMode;
  const warnExtension = useDesktopValue(FINDER_WARN_EXTENSION, readBoolean, true) && driveMode;
  const searchScope = useDesktopValue(FINDER_SEARCH_SCOPE, readScope, "folder");
  const hiddenPlaces = useDesktopValue(FINDER_HIDDEN_PLACES, readNames, NO_NAMES);
  const shownPlaces = useDesktopValue(FINDER_SHOWN_PLACES, readNames, NO_NAMES);
  const disksInSidebar = useDesktopValue(FINDER_SIDEBAR_DISKS, readBoolean, false);
  const [hiddenSections, setHiddenSections] = useFinderSetting<readonly string[]>(
    driveMode,
    FINDER_HIDDEN_SECTIONS,
    readNames,
    NO_NAMES,
  );
  // The sidebar's section with its Hide or Show, on the drive: the heading names the group by itself.
  const sectionProps = (name: string) =>
    driveMode
      ? {
          "aria-label": name,
          "aria-labelledby": undefined,
          collapsed: hiddenSections.includes(name),
          title: (
            <span className="mac-finder-section-title">
              {name}
              <button
                type="button"
                className="mac-finder-section-toggle"
                aria-label={`${hiddenSections.includes(name) ? "Show" : "Hide"} ${name}`}
                onClick={() =>
                  setHiddenSections(
                    hiddenSections.includes(name)
                      ? hiddenSections.filter((each) => each !== name)
                      : [...hiddenSections, name],
                  )
                }
              >
                {hiddenSections.includes(name) ? "Show" : "Hide"}
              </button>
            </span>
          ),
        }
      : { title: name };
  const hiddenTags = useDesktopValue(FINDER_HIDDEN_TAGS, readNames, NO_NAMES);
  const hiddenMenuTags = useDesktopValue(FINDER_HIDDEN_MENU_TAGS, readNames, NO_NAMES);
  const shownPlace = (label: string) => !driveMode || !hiddenPlaces.includes(label);
  const setSort = (next: FinderSort) => {
    if (folderId) keepForFolder({ sort: next });
    else setBaseSort(next);
  };
  const [baseIconSize, setBaseIconSize] = useState(defaultIconSize);
  const iconSize = viewOptions.icon ?? baseIconSize;
  const setIconSize = (next: number) => {
    if (folderId) keepForFolder({ icon: next });
    else setBaseIconSize(next);
  };
  const [pathBar, setPathBar] = useFinderSetting(
    driveMode,
    FINDER_PATH_BAR,
    readBoolean,
    defaultPathBar,
  );
  const [statusBar, setStatusBar] = useFinderSetting(
    driveMode,
    FINDER_STATUS_BAR,
    readBoolean,
    defaultStatusBar,
  );
  const [sidebarSize, setSidebarSize] = useFinderSetting(
    driveMode,
    FINDER_SIDEBAR_WIDTH,
    readNumber,
    sidebarWidth,
  );
  const [sidebarShown, setSidebarShown] = useFinderSetting(
    driveMode,
    FINDER_SIDEBAR_SHOWN,
    readBoolean,
    true,
  );
  const [toolbarShown, setToolbarShown] = useFinderSetting(
    driveMode,
    FINDER_TOOLBAR,
    readBoolean,
    true,
  );
  const [tabBarWanted, setTabBarWanted] = useFinderSetting(
    driveMode,
    FINDER_TAB_BAR,
    readBoolean,
    false,
  );
  const [previewShown, setPreviewShown] = useFinderSetting(
    driveMode,
    FINDER_PREVIEW,
    readBoolean,
    true,
  );
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [menuWindow, setMenuWindow] = useState<HTMLDivElement | null>(null);
  const [saved, setSaved] = useFinderSetting<readonly SavedSearch[]>(
    driveMode,
    FINDER_SEARCHES,
    readSearches,
    NO_SEARCHES,
  );
  // The saved search each tab is running: its Save updates that one rather than making another.
  const [ranSearches, setRanSearches] = useState<ReadonlyMap<number, string>>(new Map());
  const [favoriteIds, setFavoriteIds] = useFinderSetting<readonly string[]>(
    driveMode,
    FINDER_FAVORITES,
    readFavorites,
    NO_FAVORITES,
  );
  // The items added to the sidebar that are still there and out of the Trash.
  const favoritePlaces = driveMode
    ? favoriteIds.flatMap((id) => {
        const path = pathOfEntry(root, id);
        const node = path ? resolve(root, path) : undefined;
        return path && node && !isInTrash(path) ? [{ id, path, node }] : [];
      })
    : [];
  const savedWindow = useDesktopValue(FINDER_WINDOW, readWindow, null);
  const searchInput = useRef<HTMLInputElement>(null);
  const uid = useId();

  // Get Info is a window about one item and stays with it; Quick Look shows the selected item.
  const [info, setInfo] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [infoMany, setInfoMany] = useState<readonly string[] | null>(null);
  const [allTabs, setAllTabs] = useState(false);
  const [looking, setLooking] = useState(false);
  // The panel that has the keyboard: the key window, which makes this one the main window.
  const [front, setFront] = useState<Panel | null>(null);
  // Where this window stood, from the origin of the panels' group, when each panel was last
  // opened.
  const [frames, setFrames] = useState<Record<Panel, PanelFrame>>({
    info: NO_FRAME,
    "quick-look": NO_FRAME,
  });
  const windowElement = useRef<HTMLDivElement | null>(null);
  const panelElements = useRef<Record<Panel, HTMLElement | null>>({
    info: null,
    "quick-look": null,
  });
  // The panels are a group of their own beside this window, ranked with it: see `stackOf`.
  const group = useRef<HTMLDivElement | null>(null);
  const [stack, setStack] = useState<PanelStack | null>(null);
  // The panel that was just asked for: placed once it is in the page, then given the keyboard.
  const asked = useRef<Panel | null>(null);
  const focusAsked = useRef<Panel | null>(null);
  const [, setAsked] = useState(0);
  // Panels that a desktop hosts are the desktop's to place, order and focus.
  const panelsOpen = !DesktopWindow && (info !== null || looking);
  // After every render while a panel is open, because the rank is the host's to change. The
  // group says where its origin is, whatever it is positioned against, so the place of a panel
  // is the distance from there to this window.
  useLayoutEffect(() => {
    const element = windowElement.current;
    if (!panelsOpen || !element) return;
    const next = stackOf(element, panelContainer ?? null);
    if (!stack || stack.host !== next.host || stack.level !== next.level) {
      setStack(next);
      return;
    }
    const panel = asked.current;
    const target = panel && panelElements.current[panel];
    if (!panel || !target || !group.current) return;
    asked.current = null;
    const own = element.getBoundingClientRect();
    const origin = group.current.getBoundingClientRect();
    const placed = {
      left: own.left - origin.left,
      top: own.top - origin.top,
      width: own.width,
      height: own.height,
    };
    setFrames((current) => ({ ...current, [panel]: placed }));
  });
  // The keyboard goes to the panel after the render that put it into the page, and after a
  // menu that asked for it has closed and given the focus back to its button.
  useEffect(() => {
    const panel = focusAsked.current;
    const target = panel && panelElements.current[panel];
    if (!target) return;
    focusAsked.current = null;
    target.focus({ preventScroll: true });
  });

  // The alerts and dialogs, each shown while its state says so.
  const [emptying, setEmptying] = useState(false);
  /** How many items Delete Immediately's alert is asking about. */
  const [deleting, setDeleting] = useState(0);
  const [contextTarget, setContextTarget] = useState<FinderContextTarget>({ kind: "background" });
  const [going, setGoing] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useFinderSetting<readonly string[]>(
    driveMode,
    FINDER_SIDEBAR_ORDER,
    readNames,
    NO_NAMES,
  );
  const [toolbarOrder, setToolbarOrder] = useFinderSetting(
    driveMode,
    FINDER_TOOLBAR_ITEMS,
    readToolbarItems,
    DEFAULT_TOOLBAR,
  );
  const [toolbarMode, setToolbarMode] = useFinderSetting<ToolbarMode>(
    driveMode,
    FINDER_TOOLBAR_MODE,
    readToolbarMode,
    "icon-only",
  );
  const [namingSearch, setNamingSearch] = useState(false);
  const [folders, setFolders] = useState<readonly string[]>(GO_FOLDERS);
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState(serverAddress("Castle"));
  const [favorites, setFavorites] = useFinderSetting<readonly string[]>(
    driveMode,
    FINDER_SERVERS,
    readNames,
    NO_NAMES,
  );
  const [unreachable, setUnreachable] = useState<string | null>(null);
  // Copy puts the selected paths here; Paste copies the items they still lead to.
  const [localClipboard, setLocalClipboard] = useState<readonly string[]>([]);
  // On the drive the clipboard is the desktop's, shared by every window: the items still there.
  const copiedItems = useCopiedDriveItems();
  const clipboard = driveMode
    ? copiedItems.flatMap((item) => pathOfEntry(root, item.id) ?? [])
    : localClipboard;
  function setClipboard(paths: readonly string[]) {
    if (driveMode) copyDriveItems(driveItemsAt(paths));
    else setLocalClipboard(paths);
  }
  const [copy, setCopy] = useState<CopyJob | null>(null);
  // The names of the disks whose notification is shown.
  const [notices, setNotices] = useState<readonly string[]>([]);
  // The Connect to Server dialog or the Copy window, while it has the keyboard.
  const [aside, setAside] = useState<Aside | null>(null);
  // The drive: what a change ran into, the item being renamed (by its drive id, so that it is
  // followed when another window moves it), and the upload or download running.
  const [failure, setFailure] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const renamingPath = renaming !== null ? pathOfEntry(root, renaming) : undefined;
  const renamingNode = renamingPath !== undefined ? resolve(root, renamingPath) : undefined;
  const [renamingMany, setRenamingMany] = useState<readonly BatchItem[]>([]);
  // A rename that changes the name's extension, while its warning waits for an answer.
  const [extensionChange, setExtensionChange] = useState<{
    id: string;
    path: string;
    name: string;
    keyboard: boolean;
    was: string;
    now: string;
  } | null>(null);
  // An item renamed in another window's turn may leave the drive, or go to the Trash: the field
  // goes with it.
  useEffect(() => {
    if (renaming !== null && (renamingPath === undefined || isInTrash(renamingPath))) {
      setRenaming(null);
    }
  }, [renaming, renamingPath]);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  // Whose drive this window shows: everything it changes is for them, whoever is signed in by then.
  const [session] = useState(currentDesktopSession);
  const changeDrive = (ops: readonly DriveOp[]) => runOps(ops, undefined, session);
  // A transfer under way stops when the window closes: no upload goes on filling the drive, and
  // no download hands the browser a file after its progress window is gone.
  const transferRef = useRef<Transfer | null>(null);
  transferRef.current = transfer;
  useEffect(() => () => transferRef.current?.controller.abort(), []);
  const uploadInput = useRef<HTMLInputElement>(null);
  const copying = copy !== null && copy.conflicts.length === 0;
  // An alert or a dialog that waits for an answer: the key window until it has one.
  const modal =
    emptying ||
    going ||
    unreachable !== null ||
    (copy !== null && !copying) ||
    renamingMany.length > 0 ||
    extensionChange !== null ||
    failure !== null;
  // The keyboard goes back to this window once an alert or a dialog closes, as it does from a
  // panel, unless another one is waiting for its answer by then. This is the library's focus
  // return (`finalFocus`), called as the window closes. Base UI hands a target that is not a
  // tab stop on to its first tab stop, the Back button here, so the callback focuses this
  // window itself, which is not a tab stop, and tells the library to move nothing. The library
  // asks while the render that closed the window is committed, before any effect of this
  // component has run, so the render itself notes whether one is waiting. The focus moves once
  // that commit is over, as the library moves its own: at the end of a commit React gives the
  // focus back to the element that had it before, when that is still in the page, and an alert
  // answered with Escape before it took the keyboard leaves it on the Action button.
  const waiting = useRef(false);
  waiting.current = modal;
  // A menu's closing can end after another window has become key: this one leaves it there.
  const stateNow = useRef(windowState);
  stateNow.current = windowState;
  const returnFocus = useCallback(() => {
    if (!waiting.current) {
      queueMicrotask(() => {
        if (stateNow.current !== "inactive") {
          windowElement.current?.focus({ preventScroll: true });
        }
      });
    }
    return false;
  }, []);
  useEffect(() => {
    if (!copying || driveMode) return;
    const timer = setInterval(
      () => setCopy((job) => job && { ...job, step: job.step + 1 }),
      COPY_STEP_MS,
    );
    return () => clearInterval(timer);
  }, [copying, driveMode]);
  // The copy is done: its items arrive in the folder, each under its name, and one that
  // replaces an item takes its place. A name the folder took while the copy ran (a new folder,
  // say) is not written over: the copy is kept beside it under the next free name, as Keep
  // Both names it.
  useEffect(() => {
    if (driveMode || !copy || !copying || copy.step < COPY_STEPS) return;
    let next = latest.current;
    for (const { node, name, replaces } of copy.items) {
      const folder = resolve(next, copy.destination);
      const taken = new Set(folder?.children?.map((child) => child.name));
      let arrives = name;
      if (taken.has(name)) {
        if (replaces) next = removeNode(next, joinPath(copy.destination, name));
        else arrives = duplicateName(taken, { ...node, name });
      }
      next = addNode(next, copy.destination, { ...node, name: arrives });
    }
    endCopy();
    commit(next);
  });
  // On the drive a copy is the drive's own: once no item is left to ask about, every item is
  // copied at once, by reference, so it takes no time and no space.
  useEffect(() => {
    if (!driveMode || !copy || !copying) return;
    const destination = resolve(latest.current, copy.destination)?.id;
    const { moves, destination: folder } = copy;
    const ops: DriveOp[] = copy.items.flatMap(({ node, name, replaces }) =>
      node.id && destination
        ? [
            {
              op: moves ? ("move" as const) : ("copy" as const),
              id: node.id,
              parent: destination,
              name,
              existing: replaces ? ("replace" as const) : ("rename" as const),
            },
          ]
        : [],
    );
    endCopy();
    if (ops.length === 0) return;
    const moved = copy.items.flatMap(({ node }) => node.id ?? []);
    const asked = askNow();
    void undoable(moves ? "Move" : "Copy", ops).then((drive) => {
      const made = moves ? moved : drive?.created;
      if (drive && made) selectMade(pathsIn(drive, made), folder, asked);
    });
  });
  // The drive as it is now, each time a window opens on it.
  useEffect(() => {
    if (driveMode) void loadDrive().catch((error) => setFailure(messageOf(error)));
  }, [driveMode]);
  // A drive that changed (in this window or another) keeps each tab to the items it still shows.
  const reconciled = useRef<FinderNode | null>(null);
  useEffect(() => {
    if (!driveRoot || reconciled.current === driveRoot) return;
    reconciled.current = driveRoot;
    reconcile(driveRoot);
  });
  // A disk that was disconnected goes from the tree, and the notification about it comes. A
  // copy into a folder of the disk ends with it.
  useEffect(() => {
    const tree = latest.current;
    const pulled = (disconnected ?? []).filter(
      (path) => parentPath(path) === "/Volumes" && resolve(tree, path)?.kind === "volume",
    );
    if (pulled.length === 0) return;
    const names = pulled.map((path) => locationName(tree, path));
    setNotices((shown) => [...shown, ...names.filter((name) => !shown.includes(name))]);
    for (const path of pulled) dispatch({ type: "evict", from: path, to: COMPUTER });
    const gone = (location: string) =>
      pulled.some((path) => location === path || location.startsWith(`${path}/`));
    if (copy && gone(copy.destination)) endCopy();
    commit(pulled.reduce(removeNode, tree));
  });

  const tab = activeTab(state);
  const location = locationOf(tab);
  const searching = isSearching(tab);
  const scope = searchOrigin(tab).scope;

  const contentHits = useContentHits(tab.query, driveMode);
  const rowHits = useContentHits(contentsWords(tab.rows), driveMode, true);
  const entries = useMemo(
    () => contentsOf(root, tab, sort, contentHits.ids, rowHits.ids),
    [root, tab, sort, contentHits.ids, rowHits.ids],
  );

  // The selection is what is selected among the items shown, so that nothing the window does
  // not show is ever acted on by the toolbar or the bars. In the columns it is the item of
  // the last open column. The gallery always shows one item: the selected one, or the first.
  const selection = useMemo(() => {
    // A grouped list's folders do not expand: what is inside them is not shown.
    const shown = selectionOf(
      root,
      entries,
      groupBy !== NO_GROUP && tab.view === "list" ? { ...tab, expanded: [] } : tab,
      sort,
    );
    if (tab.view === "gallery") {
      const first = shown[0] ?? entries[0]?.path;
      return first === undefined ? [] : [first];
    }
    return shown;
  }, [tab, entries, root, sort, groupBy]);

  const place = placeOf(root, tab);
  const placeNode = resolve(root, place);
  const title = titleOf(root, tab);
  const tabsShown = state.tabs.length > 1 || tabBarWanted;
  const tabId = (id: number) => `${uid}-tab-${id}`;

  // Remove items from the Trash after 30 days: what has been there longer goes when the drive loads
  // or the setting is turned on.
  const trashAfter30 = useDesktopValue(FINDER_TRASH_AFTER_30, readBoolean, false);
  const erasedAtLoad = useRef<unknown>(null);
  useEffect(() => {
    if (!driveMode || !driveData) return;
    // Each load brings a copy of its own: a failure is tried again by the next, not by a render.
    const asked = trashAfter30 ? driveData : null;
    if (asked === erasedAtLoad.current) return;
    erasedAtLoad.current = asked;
    if (!asked) return;
    const expired = claimExpired(expiredTrash(driveData.entries, Date.now()));
    if (expired.length === 0) return;
    void act(changeDrive(expired.map((id) => ({ op: "delete" as const, id })))).finally(() =>
      releaseExpired(expired),
    );
  });

  // The session's first window comes back as the last one was, once the settings have come and
  // unless it has already been taken elsewhere. Each window's tabs are kept while it is key, from
  // the first time they differ from how it opened, so a window nobody has touched writes over nothing.
  const windowRestored = useRef(false);
  const askedNewWindow = useDesktopValue(FINDER_NEW_WINDOW, readText, HOME);
  const settingsLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  // Once per window, when the settings have come: the session's first window comes back as the last
  // one was; any other opens where Preferences asks of a new window. Neither is a change of the
  // person's, and a setting changed later is for the windows that open after it.
  useEffect(() => {
    if (!driveMode || defaultTabs || askedTab || windowRestored.current || !settingsLoaded) return;
    windowRestored.current = true;
    const first = claimWindowRestore();
    if (windowPlaces !== windowAtFirst.current) return;
    if (first && savedWindow) {
      // The folder effect of this same render has the window as it was: it waits for the tabs.
      arrivedAt.current = RESTORING;
      dispatch({ type: "restore", tabs: savedWindow.tabs, active: savedWindow.active });
    } else if (askedNewWindow !== HOME) {
      windowAtFirst.current = JSON.stringify([1, [askedNewWindow]]);
      dispatch({
        type: "restore",
        tabs: [{ location: askedNewWindow, view: tab.view }],
        active: 0,
      });
    }
  });
  const windowNow = JSON.stringify(
    fitWindow({
      tabs: state.tabs.map((each) => ({ location: locationOf(each), view: each.view })),
      active: state.tabs.findIndex((each) => each.id === state.active),
    }),
  );
  // Where the tabs are, apart from their views: a folder's kept view that shows by itself is no
  // change of the person's, and `showView` says when they change one.
  const windowPlaces = JSON.stringify([state.active, state.tabs.map(locationOf)]);
  const windowAtFirst = useRef(windowPlaces);
  const windowChanged = useRef(false);
  useEffect(() => {
    if (windowPlaces !== windowAtFirst.current) windowChanged.current = true;
    if (!driveMode || windowState !== "key" || !windowChanged.current) return;
    if (JSON.stringify(savedWindow) !== windowNow) {
      changeDesktopValue(FINDER_WINDOW, JSON.parse(windowNow));
    }
  }, [driveMode, windowState, windowNow, windowPlaces, savedWindow]);
  // A tab whose folder has gone, kept or not, shows the home folder instead.
  useEffect(() => {
    if (!driveRoot || driveData === null) return;
    for (const each of state.tabs) {
      const shown = locationOf(each);
      if (!isVirtual(shown) && !resolve(driveRoot, shown)) {
        dispatch({ type: "evict", from: shown, to: HOME });
      }
    }
  }, [driveRoot, driveData, state.tabs]);
  // A folder shows in the view it keeps: on arriving, once the settings have come, and when another
  // window changes it.
  const arrivedAt = useRef("");
  useEffect(() => {
    if (arrivedAt.current === RESTORING) {
      arrivedAt.current = "";
      return;
    }
    const here = `${tab.id}:${location}:${folderId ?? ""}:${keptView ?? ""}:${searching}`;
    if (arrivedAt.current === here) return;
    arrivedAt.current = here;
    if (keptView && keptView !== tab.view && !searching) changeView(keptView);
  });

  const navigate = useCallback((to: string) => dispatch({ type: "navigate", location: to }), []);
  useEffect(() => {
    if (driveMode && !isVirtual(location)) tellFinderFolder(location);
  }, [driveMode, location]);
  const select = useCallback(
    (paths: string[]) => dispatch({ type: "select", selection: paths }),
    [],
  );
  // A drive file another app asks Finder to show (Show in Finder in Storage Management, a file
  // Spotlight found): the latest asked, shown in its folder and selected once the drive lists it.
  const [revealing, setRevealing] = useState<OpenFileRequest | null>(null);
  useEffect(() => {
    if (!driveMode) return;
    const latest = takeOpenFileRequests("finder").at(-1);
    if (latest) setRevealing(latest);
    return onOpenFileRequest("finder", setRevealing);
  }, [driveMode]);
  useEffect(() => {
    if (revealing === null) return;
    if (revealing.show === "find") {
      setRevealing(null);
      if (revealing.query) {
        dispatch({ type: "query", query: revealing.query, origin: folderOf(root, tab) });
      }
      searchInput.current?.focus();
      return;
    }
    if (revealing.show === "smart-folder") {
      setRevealing(null);
      dispatch({ type: "new-tab", location });
      dispatch({ type: "rows", rows: [newCriterion()], origin: folderOf(root, tab) });
      dispatch({ type: "scope", scope: "mac" });
      return;
    }
    if (revealing.show === "go-to-folder") {
      setRevealing(null);
      setGoing(true);
      return;
    }
    if (revealing.place) {
      setRevealing(null);
      navigate(revealing.place);
      return;
    }
    const path = pathOfEntry(root, revealing.id);
    // A file the drive no longer lists, once it has loaded, is not shown later.
    if (!path) {
      if (driveRoot) setRevealing(null);
      return;
    }
    setRevealing(null);
    navigate(parentPath(path));
    if (tab.view === "columns") dispatch({ type: "columns", columns: [path] });
    else select([path]);
    if (revealing.show === "info") {
      setInfo(path);
      openPanel("info");
    } else if (revealing.show === "quick-look") {
      // Asked again for the one it shows, as the space bar on a desktop icon does: it closes.
      if (looked === path) closePanel("quick-look");
      else {
        setLooking(true);
        openPanel("quick-look");
      }
    }
  });
  /** Opens an item: a folder shows, a file goes to `onOpen`; on the drive, without `onOpen`, a
   * file opens in the application that works with it (a text document in TextEdit), or else
   * shows in Quick Look. `through` holds the aliases followed to get here. */
  const open = (entry: FinderEntry, through: ReadonlySet<string> = new Set()) => {
    if (isContainer(entry.node)) {
      // A bundle opens as a document; Show Package Contents is what enters it.
      const { id, name, type } = entry.node;
      if (driveMode && id && /\.rtfd$/i.test(name) && openFile({ id, name, type })) return;
      navigate(entry.path);
    } else if (entry.node.kind === "server") return;
    else if (onOpen) onOpen(entry.path, entry.node);
    else if (driveMode && entry.node.type === ALIAS_TYPE) {
      const id = entry.node.id ?? "";
      if (through.has(id)) {
        setFailure(
          `The alias “${entry.node.name}” can’t be opened because it leads back to itself.`,
        );
        return;
      }
      void originalOf(entry.node).then((path) => {
        const node = path ? resolve(latest.current, path) : undefined;
        if (path && node) open({ path, node }, new Set([...through, id]));
      });
    } else if (driveMode && entry.node.id) {
      // Stationery: what opens is a copy, not a pad itself, and the pad stays as it is.
      if (entry.node.stationery) {
        const { id, name, type } = entry.node;
        const parent = idAt(parentPath(entry.path));
        if (parent) {
          void act(
            (async () => {
              const copied = await changeDrive([{ op: "copy", id, parent, existing: "rename" }]);
              const copy = copied.created?.[0];
              if (!copy) return copied;
              const drive = await changeDrive([{ op: "info", id: copy, stationery: false }]);
              const made = drive.entries.find((each) => each.id === copy);
              const opened = { id: copy, name: made?.name ?? name, type };
              if (!openFile(opened)) {
                setRevealing({ app: "finder", ...opened, show: "quick-look" });
              }
              return drive;
            })(),
          );
          return;
        }
      }
      if (openFile({ id: entry.node.id, name: entry.node.name, type: entry.node.type })) return;
      select([entry.path]);
      setLooking(true);
      openPanel("quick-look");
    }
  };

  /** The folder a new item goes into: none while searching or in a place such as Recents. */
  const folderShown = !searching && placeNode && isContainer(placeNode) ? place : undefined;

  /**
   * Puts a changed tree in place and keeps every tab's selection and column path to the items
   * the tab still shows: an item that lost the tag of the place shown leaves both with the
   * listing, also in a tab that is not the one shown. On the drive the tree is the drive's, and
   * changes go to it instead (`act`).
   */
  function commit(next: FinderNode) {
    if (driveMode) return;
    latest.current = next;
    setRoot(next);
    reconcile(next);
  }

  function reconcile(next: FinderNode) {
    dispatch({
      type: "reconcile",
      tabs: state.tabs.map((item) => {
        // A search's words are known only for the tab shown: another keeps what still exists.
        const hits = item.id === tab.id ? [contentHits.ids, rowHits.ids] : null;
        return {
          id: item.id,
          selection:
            !hits && isSearching(item)
              ? item.selection.filter((path) => resolve(next, path))
              : selectionOf(next, contentsOf(next, item, sort, hits?.[0], hits?.[1]), item, sort),
          columns: openColumns(next, item),
        };
      }),
    });
  }

  /** Runs a change of the drive; one it refuses, or that cannot reach it, is told in an alert. */
  async function act<T>(work: Promise<T>): Promise<T | undefined> {
    try {
      return await work;
    } catch (error) {
      setFailure(messageOf(error));
      return undefined;
    }
  }

  /** Runs a change of the drive that Edit's Undo takes back, under `name`. */
  function undoable(name: UndoName, ops: readonly DriveOp[]) {
    return act(runUndoable(name, ops, session));
  }

  const undoSteps = useFinderUndo();
  /** Undo or Redo; what it was about is selected, unless the person has since done anything. */
  function replay(direction: "undo" | "redo") {
    const asked = windowInputs.current;
    void act(replayStep(direction, session)).then((done) => {
      if (!done || windowInputs.current !== asked) return;
      select(pathsIn(done.drive, done.items).filter((path) => !isInTrash(path)));
    });
  }

  /** The drive id of the item at `path`, if it is one of the drive's. */
  const idAt = (path: string | undefined) =>
    path === undefined ? undefined : resolve(root, path)?.id;

  /** The drive items at `paths`, as the desktop's drags, clipboard and Share menus carry them. */
  function driveItemsAt(paths: readonly string[]): DesktopDragItem[] {
    const stored = currentDrive();
    return paths.flatMap((path) => {
      const id = idAt(path);
      const entry = id && stored ? entryOf(stored, id) : undefined;
      return entry
        ? [
            {
              id: entry.id,
              name: entry.name,
              kind: entry.kind,
              type: entry.type,
              size: entry.size,
            },
          ]
        : [];
    });
  }

  /** The tab shown now, for a reply that was asked for in an earlier render. */
  const tabShown = useRef(tab);
  tabShown.current = tab;
  /** When a change was asked for: the person's inputs so far, and the tab shown. */
  const askNow = () => ({ inputs: windowInputs.current, tab: tab.id, place: locationOf(tab) });

  /** Selects `path` in the tab shown: in the columns, in its own column. */
  function selectInView(paths: readonly string[], folder: string) {
    if (paths.length === 0) return;
    if (tab.view === "columns" && paths.length === 1) {
      const open = openColumns(root, tab);
      const at = open.indexOf(folder);
      const columns = at < 0 ? [] : open.slice(0, at + 1);
      dispatch({ type: "columns", columns: [...columns, paths[0] as string] });
    } else select([...paths]);
  }

  /**
   * What a reply made, selected as New Folder does, unless the person has pressed or typed anything
   * since `asked` or the tab shows something else: what they did stands.
   */
  function selectMade(paths: readonly string[], folder: string, asked: ReturnType<typeof askNow>) {
    const shown = tabShown.current;
    if (
      asked.inputs === windowInputs.current &&
      asked.tab === shown.id &&
      asked.place === locationOf(shown)
    ) {
      selectInView(paths, folder);
    }
  }

  /** The paths, in the tree of `drive`, of the entries `ids`. */
  const pathsIn = (drive: Parameters<typeof driveTree>[0], ids: readonly string[]) => {
    const tree = driveTree(drive, turned);
    return ids.flatMap((id) => pathOfEntry(tree, id) ?? []);
  };

  function newFolder() {
    if (!folderShown) return;
    if (driveMode) {
      const parent = idAt(folderShown);
      if (!parent) return;
      const folder = folderShown;
      const asked = askNow();
      void undoable("New Folder", [{ op: "mkdir", parent, name: "untitled folder" }]).then(
        (drive) => {
          if (drive?.created) selectMade(pathsIn(drive, drive.created), folder, asked);
        },
      );
      return;
    }
    const name = availableName(root, folderShown, "untitled folder");
    commit(addNode(root, folderShown, createFolder(name)));
    const path = joinPath(folderShown, name);
    if (tab.view === "columns") {
      // The new folder is selected in the column of the folder it went into.
      const open = openColumns(root, tab);
      const columns = open.slice(0, open.indexOf(folderShown) + 1);
      dispatch({ type: "columns", columns: [...columns, path] });
    } else select([path]);
  }

  /**
   * Shows another view, with the selection it still shows. The columns open on the item
   * selected in the view left behind; the other views keep what is among their own items.
   */
  function showView(view: FinderView) {
    if (view === tab.view) return;
    windowChanged.current = true;
    keepForFolder({ view });
    changeView(view);
  }

  function changeView(view: FinderView) {
    if (view === "columns" && !searching) {
      const columns = columnPath(root, location, selection[0]);
      dispatch({ type: "view", view, columns, selection: columns.slice(-1) });
    } else {
      const paths = selectable(root, entries, { ...tab, view }, sort);
      dispatch({ type: "view", view, selection: selection.filter((path) => paths.has(path)) });
    }
  }

  /** Expands or collapses folders of the list; a row that goes out of sight is deselected. */
  function expand(expanded: string[]) {
    const paths = selectable(root, entries, { ...tab, expanded }, sort);
    dispatch({
      type: "expanded",
      expanded,
      selection: selection.filter((path) => paths.has(path)),
    });
  }

  const retag = (path: string, tags: string[]) => {
    if (driveMode) {
      const id = idAt(path);
      if (id) void undoable("Tag", [{ op: "tag", id, tags }]);
      return;
    }
    commit(changeNode(root, path, (node) => ({ ...node, tags })));
  };

  // What Get Info changes on the drive; the demo's file system keeps none of it.
  const infoOnDrive = driveMode
    ? {
        onRename(path: string, name: string) {
          const id = idAt(path);
          if (!id) return;
          void undoable("Rename", [{ op: "rename", id, name }]).then((drive) => {
            if (drive) setInfo(joinPath(parentPath(path), name));
          });
        },
        onCommentChange(path: string, comment: string) {
          const id = idAt(path);
          if (id) void act(changeDrive([{ op: "info", id, comment }]));
        },
        onIconPaste(path: string, picture: File | undefined) {
          const id = idAt(path);
          if (!id) return;
          const copied = copiedDriveItems().filter((item) => item.type?.startsWith("image/"));
          const chosen = picture
            ? Promise.resolve<Blob | undefined>(picture)
            : filesOfDrag(copied.slice(0, 1)).then((files) => files[0]);
          void chosen
            .then((blob) => (blob ? setCustomIcon(id, blob, session) : undefined))
            .catch((error: unknown) => setFailure(messageOf(error)));
        },
        onIconRemove(path: string) {
          const id = idAt(path);
          if (id) {
            void removeCustomIcon(id, session).catch((error: unknown) =>
              setFailure(messageOf(error)),
            );
          }
        },
        onFlagChange(path: string, flag: FinderItemFlag, checked: boolean) {
          const id = idAt(path);
          if (!id) return;
          const change =
            flag === "hideExtension" ? { hide_extension: checked } : { [flag]: checked };
          void act(changeDrive([{ op: "info", id, ...change }]));
        },
      }
    : undefined;
  /** Open with for the file at `path`: the applications by name, the default first, and Change All. */
  const openersOf = (path: string | null) => {
    const node = path === null ? undefined : resolve(root, path);
    if (!driveMode || !node?.id || isContainer(node)) return undefined;
    const file = { name: node.name, type: node.type };
    const first = appForFile(file);
    const ids = [...appsForFile(file)].sort((a, b) => Number(b === first) - Number(a === first));
    return {
      openers: ids.map(openerName),
      onChangeOpener(name: string) {
        const chosen = ids.find((id) => openerName(id) === name);
        if (chosen) chooseOpenerFor(node.name, chosen);
      },
    };
  };

  /** How many items the Trash holds. A tree without a Trash has nothing to empty. */
  const trashed = resolve(root, TRASH)?.children?.length ?? 0;
  const emptyTrash = () => {
    if (driveMode) {
      void act(changeDrive([{ op: "empty-trash" }]));
      return;
    }
    commit(changeNode(root, TRASH, (node) => ({ ...node, children: [] })));
  };
  /** Empty Trash, by way of its alert unless Preferences turned that off. */
  const askEmptyTrash = () => {
    if (warnEmpty) setEmptying(true);
    else emptyTrash();
  };

  /**
   * Go to Folder: shows the folder a typed path leads to, or the folder of the file it leads
   * to with the file selected, and keeps the text for the dialog's list. A path that leads
   * nowhere is refused.
   */
  function goTo(text: string): boolean {
    const path = expandPath(text, isVirtual(place) ? HOME : place);
    const node = resolve(root, path);
    if (!node) return false;
    if (isContainer(node)) navigate(path);
    else {
      navigate(parentPath(path));
      if (tab.view === "columns") dispatch({ type: "columns", columns: [path] });
      else select([path]);
    }
    const typed = text.trim();
    setFolders((recent) => [typed, ...recent.filter((folder) => folder !== typed)]);
    return true;
  }

  /**
   * Connect to Server: connects the computer of the network the address names and shows its
   * shared folders. An address no computer has ends in the alert about the connection.
   */
  function connectTo(to: string) {
    setAddress(to);
    const server = serverAt(root, to);
    if (!server) return setUnreachable(to);
    commit(connected(root, server.path));
    navigate(server.path);
  }

  /** The items on the clipboard that are still in the tree. */
  const pasteable = clipboard.filter((path) => resolve(root, path));

  /**
   * Paste: copies the items on the clipboard into the folder shown. An item whose name the
   * folder has is asked about first, unless it is pasted where it came from: there the copy
   * is named after it, as Duplicate does. One copy runs at a time.
   */
  function paste() {
    if (folderShown) bringInto(pasteable, folderShown, false);
  }

  /** Copies or moves the items at `paths` into `destination`, asking about a name it has. */
  function bringInto(paths: readonly string[], destination: string, moves: boolean) {
    if (copy) return;
    const taken = new Set(resolve(root, destination)?.children?.map((child) => child.name));
    const items: CopyItem[] = [];
    const conflicts: FinderNode[] = [];
    for (const path of paths) {
      const node = resolve(root, path) as FinderNode;
      // Nothing goes into itself.
      if (path === "/" || destination === path || destination.startsWith(`${path}/`)) continue;
      const here = parentPath(path) === destination;
      if (moves && here) continue;
      if (taken.has(node.name) && !here) {
        conflicts.push(node);
        continue;
      }
      const name = taken.has(node.name) ? duplicateName(taken, node, " copy") : node.name;
      items.push({ node, name, replaces: false });
      taken.add(name);
    }
    if (items.length + conflicts.length > 0) {
      setCopy({ destination, moves, items, conflicts, step: 0 });
    }
  }

  /**
   * Takes the Copy window away, stopped or done. The keyboard goes back to this window when
   * the Copy window had it, as it does from a panel.
   */
  function endCopy() {
    setCopy(null);
    if (aside === "copy") windowElement.current?.focus({ preventScroll: true });
  }

  /** The Replace alert's answer for the item it asks about: replace it, or keep both. */
  function settle(replaces: boolean) {
    const [node, ...conflicts] = copy?.conflicts ?? [];
    if (!copy || !node) return;
    const taken = new Set([
      ...(resolve(root, copy.destination)?.children ?? []).map((child) => child.name),
      ...copy.items.map((item) => item.name),
    ]);
    const name = replaces ? node.name : duplicateName(taken, node);
    setCopy({ ...copy, items: [...copy.items, { node, name, replaces }], conflicts });
  }
  const turn = (path: string) => {
    const id = idAt(path);
    if (driveMode) {
      if (!id) return;
      const by = (step: number) =>
        setTurned((all) => ({ ...all, [id]: ((all[id] ?? 0) + step + 4) % 4 }));
      by(1);
      // One after another: each reads what the last wrote.
      turnsSaving.current = turnsSaving.current.then(async () => {
        const stored = currentDrive();
        const entry = stored ? entryOf(stored, id) : undefined;
        try {
          if (entry && (await saveTurnedLeft(entry, session))) by(-1);
        } catch (error) {
          by(-1);
          setFailure(messageOf(error));
        }
      });
      return;
    }
    commit(
      changeNode(root, path, (node) => ({ ...node, rotation: ((node.rotation ?? 0) + 1) % 4 })),
    );
  };

  /** Quick Look's Done on the drive: the marks go into the file, after any turn being saved. */
  const saveMarks = async (path: string, marks: readonly Annotation[], shownWidth: number) => {
    await turnsSaving.current;
    const id = idAt(path);
    const stored = currentDrive();
    const entry = id && stored ? entryOf(stored, id) : undefined;
    if (!entry) return false;
    try {
      if (await saveMarkedPicture(entry, marks, shownWidth, session)) return true;
      setFailure(
        `The marks on “${entry.name}” can’t be saved: a browser cannot write this kind of picture. They stay while Quick Look is open.`,
      );
    } catch (error) {
      setFailure(messageOf(error));
    }
    return false;
  };

  // The commands of the person's drive. Each acts on the items selected that are the drive's;
  // the six home folders are never renamed, moved or trashed.
  const driveSelection = driveMode
    ? selection.flatMap((path) => {
        const node = resolve(root, path);
        return node?.id ? [{ path, node, id: node.id }] : [];
      })
    : [];
  const allOnDrive = driveSelection.length > 0 && driveSelection.length === selection.length;
  const selectedIds = driveSelection.map(({ id }) => id).join("\n");
  const selectionHolder = useRef({}).current;
  useEffect(() => {
    if (windowState !== "key") return;
    publishFinderSelection(selectionHolder, selectedIds ? selectedIds.split("\n") : []);
  }, [selectedIds, windowState, selectionHolder]);
  useEffect(() => () => clearFinderSelection(selectionHolder), [selectionHolder]);
  const savedWorkflowsNow = useSavedWorkflows();
  const putBackable = allOnDrive && driveSelection.every((item) => parentPath(item.path) === TRASH);
  const trashable =
    allOnDrive &&
    driveSelection.every((item) => !HOME_FOLDER_IDS.has(item.id) && !isInTrash(item.path));
  const renamable = trashable && driveSelection.length === 1;
  const downloadable =
    driveSelection.length > 0 && driveSelection.every((item) => !isContainer(item.node));
  const movable =
    driveMode &&
    folderShown !== undefined &&
    idAt(folderShown) !== undefined &&
    pasteable.some((path) => {
      const id = idAt(path);
      return id !== undefined && !HOME_FOLDER_IDS.has(id) && !isInTrash(path);
    });

  function moveToTrash() {
    if (!trashable) return;
    void undoable(
      "Move",
      driveSelection.map(({ id }) => ({ op: "trash" as const, id })),
    );
  }

  function putBack() {
    if (!putBackable) return;
    void undoable(
      "Move",
      driveSelection.map(({ id }) => ({ op: "restore" as const, id })),
    );
  }

  /** Duplicate: a copy of each item beside it, named as Finder names one. */
  function duplicate() {
    if (!trashable) return;
    const ops: DriveOp[] = [];
    for (const { path, node, id } of driveSelection) {
      const folder = parentPath(path);
      const parent = idAt(folder);
      if (!parent) continue;
      const taken = new Set(resolve(root, folder)?.children?.map((child) => child.name));
      const name = duplicateName(taken, node, " copy");
      taken.add(name);
      ops.push({ op: "copy", id, parent, name });
    }
    const folder = parentPath(driveSelection[0]?.path ?? "/");
    const asked = askNow();
    void undoable("Duplicate", ops).then((drive) => {
      if (drive?.created) selectMade(pathsIn(drive, drive.created), folder, asked);
    });
  }

  /**
   * The files of the selection for an archive, with their folders: each path starts from the item
   * selected, as Compress names them. Files in a folder are read when the archive is made.
   */
  function archiveFiles(): ArchiveEntry[] {
    const stored = currentDrive();
    if (!stored) return [];
    const out: ArchiveEntry[] = [];
    const walk = (id: string, name: string, prefix: string) => {
      const entry = entryOf(stored, id);
      if (!entry) return;
      const path = `${prefix}${name}`;
      if (entry.kind === "folder") {
        out.push({ path: `${path}/`, modified: entry.modified_ms, size: 0 });
        for (const child of stored.entries) {
          if (child.parent === id && child.trashed_ms === undefined) {
            walk(child.id, child.name, `${path}/`);
          }
        }
      } else {
        out.push({ id, path, modified: entry.modified_ms, size: entry.size });
      }
    };
    for (const { id, node } of driveSelection) walk(id, node.name, "");
    return out;
  }

  /** Compress: a zip of the selection beside it, named after the one item, or Archive.zip. */
  function compress() {
    if (!selectionFolder || transfer) return;
    const parent = idAt(selectionFolder);
    if (!parent) return;
    const folder = selectionFolder;
    const files = archiveFiles();
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > MOST_ARCHIVE_BYTES) {
      setFailure(`Finder can compress at most ${formatSize(MOST_ARCHIVE_BYTES)} at a time.`);
      return;
    }
    if (files.length > MOST_ARCHIVE_ENTRIES) {
      setFailure(`Finder can compress at most ${MOST_ARCHIVE_ENTRIES} items at a time.`);
      return;
    }
    const name =
      driveSelection.length === 1 ? `${driveSelection[0]?.node.name}.zip` : "Archive.zip";
    const controller = new AbortController();
    setTransfer({
      verb: "Compressing",
      items: driveSelection.map(({ node }) => node),
      destination: locationName(root, folder),
      done: 0,
      total,
      started: Date.now(),
      controller,
    });
    const title = compressTitleOf(driveSelection.map(({ node }) => node.name));
    const asked = askNow();
    void act(
      runMaking(title, async () => {
        let read = 0;
        const blobs: ArchiveFile[] = [];
        for (const file of files) {
          const blob = file.id ? await readFile(file.id, { signal: controller.signal }) : undefined;
          blobs.push({ path: file.path, blob, modified: new Date(file.modified) });
          read += file.size;
          const done = read;
          setTransfer((job) => job && { ...job, done });
        }
        const zip = await zipBlob(blobs);
        const made = await uploadFile(zip, parent, { name, session, signal: controller.signal });
        await loadDrive();
        return made;
      }).catch((error) => {
        // The Stop button of the progress window: nothing to say about it.
        if (controller.signal.aborted) return undefined;
        throw error;
      }),
    )
      .then((made) => {
        const drive = currentDrive();
        if (made && drive) selectMade(pathsIn(drive, [made.id]), folder, asked);
      })
      .finally(() => setTransfer(null));
  }

  /** Make Alias: a small file beside each item that stands for it. */
  function makeAlias() {
    if (!selectionFolder) return;
    const parent = idAt(selectionFolder);
    if (!parent) return;
    const folder = selectionFolder;
    const asked = askNow();
    for (const { id, node } of driveSelection) {
      const blob = new Blob([JSON.stringify({ id })], { type: ALIAS_TYPE });
      void act(
        runMaking("Make Alias", async () => {
          const made = await uploadFile(blob, parent, { name: `${node.name} alias`, session });
          await loadDrive();
          return made;
        }),
      ).then((made) => {
        const drive = currentDrive();
        if (made && drive) selectMade(pathsIn(drive, [made.id]), folder, asked);
      });
    }
  }

  /** The item an alias stands for, or `undefined` once it has gone, which says so in an alert. */
  async function originalOf(node: FinderNode): Promise<string | undefined> {
    const gone = () =>
      setFailure(
        `The alias “${node.name}” can’t be opened because the original item can’t be found.`,
      );
    if (!node.id) return undefined;
    try {
      const blob = await readFile(node.id);
      const named = JSON.parse(await blob.text()) as { id?: unknown };
      const path = typeof named.id === "string" ? pathOfEntry(latest.current, named.id) : undefined;
      if (!path || isInTrash(path)) gone();
      return path && !isInTrash(path) ? path : undefined;
    } catch (error) {
      if (error instanceof SyntaxError) gone();
      else setFailure(messageOf(error));
      return undefined;
    }
  }

  /** Show Original: the folder of the item the one selected alias stands for, with it selected. */
  function showOriginal() {
    const alias = driveSelection[0]?.node;
    if (!alias) return;
    void originalOf(alias).then((path) => {
      if (!path) return;
      navigate(parentPath(path));
      if (tab.view === "columns") dispatch({ type: "columns", columns: [path] });
      else select([path]);
    });
  }

  /** Print: each selected file, in a frame the browser prints from. */
  function print() {
    for (const { id, node } of driveSelection) {
      void act(readFile(id)).then((blob) => {
        if (blob) printBlob(blob, node.kind === "pdf");
      });
    }
  }

  /** Move Item Here: the items on the clipboard move into the folder shown. */
  function moveHere() {
    if (!movable || !folderShown) return;
    const paths = pasteable.filter((path) => {
      const id = idAt(path);
      return id && !HOME_FOLDER_IDS.has(id) && !isInTrash(path);
    });
    if (driveMode) clearCopiedDriveItems();
    else setLocalClipboard([]);
    bringInto(paths, folderShown, true);
  }

  /**
   * Renames the item at `path`; what the drive refuses it says in the alert. Ended by a key, the
   * item stays selected under its new name, unless the person has done anything in the window
   * while the drive answered: what they selected since is theirs. Ended by leaving the field, what
   * was clicked decides.
   */
  function rename(id: string, path: string, name: string, keyboard: boolean) {
    const was = extensionOf(resolve(root, path)?.name ?? "");
    const now = extensionOf(name);
    if (warnExtension && was !== now && was !== "") {
      setExtensionChange({ id, path, name, keyboard, was, now });
      return;
    }
    applyRename(id, path, name, keyboard);
  }

  function applyRename(id: string, path: string, name: string, keyboard: boolean) {
    const asked = askNow();
    void undoable("Rename", [{ op: "rename", id, name }]).then((drive) => {
      if (drive && keyboard) selectMade(pathsIn(drive, [id]), parentPath(path), asked);
    });
  }

  /** The selected items, for Rename N Items. */
  function startRenamingMany() {
    setRenamingMany(
      driveSelection.map(({ id, node, path }) => ({
        id,
        name: node.name,
        parent: parentPath(path),
        folder: isContainer(node),
      })),
    );
  }

  /** Rename: one item in place, several in their dialog. */
  function startRename() {
    if (driveSelection.length > 1) startRenamingMany();
    else setRenaming(driveSelection[0]?.id ?? null);
  }

  // The press and the click that start a slow rename: a click on the name of the one item already
  // selected, longer after the last click than a double click.
  const slowPress = useRef<{ x: number; y: number; selected: readonly string[] } | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(slowTimer.current), []);
  // Anything the person does next, anywhere on the page, is not a slow rename.
  useEffect(() => {
    const cancel = () => clearTimeout(slowTimer.current);
    document.addEventListener("pointerdown", cancel, true);
    document.addEventListener("keydown", cancel, true);
    return () => {
      document.removeEventListener("pointerdown", cancel, true);
      document.removeEventListener("keydown", cancel, true);
    };
  }, []);
  const latestSelection = useRef(selection);
  latestSelection.current = selection;
  // Every press and key, in the window or its menus, counted as it starts: what a reply must not overrule.
  const windowInputs = useRef(0);
  useEffect(() => {
    if (!menuWindow) return;
    const counted = () => {
      windowInputs.current += 1;
    };
    document.addEventListener("pointerdown", counted, true);
    document.addEventListener("keydown", counted, true);
    return () => {
      document.removeEventListener("pointerdown", counted, true);
      document.removeEventListener("keydown", counted, true);
    };
  }, [menuWindow]);

  /** The time an upload or download still takes, from how fast it has gone. */
  const timeLeft = (job: Transfer) => {
    const seconds = (Date.now() - job.started) / 1000;
    const rate = seconds > 0 ? job.done / seconds : 0;
    return rate > 0 ? (job.total - job.done) / rate : 0;
  };

  /** Uploads files into the drive folder at `folder`, then selects them. */
  async function upload(files: readonly File[], folder: string) {
    const parent = idAt(folder);
    if (!parent || files.length === 0 || transfer) return;
    const controller = new AbortController();
    const total = files.reduce((sum, file) => sum + file.size, 0);
    setTransfer({
      verb: "Uploading",
      items: files.map((file) => ({
        name: file.name,
        kind: kindOf({ kind: "file", name: file.name, type: file.type }),
        size: file.size,
      })),
      destination: locationName(root, folder),
      done: 0,
      total,
      started: Date.now(),
      controller,
    });
    const made: string[] = [];
    const uploadAsked = askNow();
    let before = 0;
    try {
      for (const file of files) {
        const entry = await uploadFile(file, parent, {
          session,
          signal: controller.signal,
          onProgress: (sent) => setTransfer((job) => job && { ...job, done: before + sent }),
        });
        before += file.size;
        made.push(entry.id);
      }
    } catch (error) {
      if (!controller.signal.aborted) setFailure(messageOf(error));
    } finally {
      setTransfer(null);
    }
    const drive = await act(loadDrive());
    if (drive && made.length > 0) selectMade(pathsIn(drive, made), folder, uploadAsked);
  }

  /** Downloads the selected files to the computer, one after another. */
  async function download(paths: readonly string[] = selection) {
    const files = paths.flatMap((path) => {
      const node = resolve(root, path);
      return node?.id && !isContainer(node) ? [{ id: node.id, node }] : [];
    });
    if (files.length === 0 || transfer) return;
    const controller = new AbortController();
    setTransfer({
      verb: "Downloading",
      items: files.map(({ node }) => node),
      destination: "Downloads",
      done: 0,
      total: files.reduce((sum, { node }) => sum + (node.size ?? 0), 0),
      started: Date.now(),
      controller,
    });
    let before = 0;
    try {
      for (const { id, node } of files) {
        await downloadFile(id, {
          signal: controller.signal,
          onProgress: (received) =>
            setTransfer((job) => job && { ...job, done: before + received }),
        });
        before += node.size ?? 0;
      }
    } catch (error) {
      if (!controller.signal.aborted) setFailure(messageOf(error));
    } finally {
      setTransfer(null);
    }
  }

  // What the panels show. An item that left the tree takes its Info window with it; Quick
  // Look shows the first selected item and nothing while none is selected.
  const infoPath = inspecting
    ? selection.length > 1
      ? null
      : (selection[0] ?? (placeNode && !isVirtual(place) ? place : null))
    : info !== null && resolve(root, info)
      ? info
      : null;
  // Several items' Info: what the Inspector follows, and what Show Summary Info was asked about,
  // which stays as it was asked.
  const inspectedMany = inspecting && selection.length > 1 ? selection : [];
  const summaryPaths = (infoMany ?? []).filter((path) => resolve(root, path));
  // With every item it was asked about gone, the summary has closed for good.
  useEffect(() => {
    if (infoMany !== null && summaryPaths.length === 0) setInfoMany(null);
  }, [infoMany, summaryPaths.length]);
  const looked = looking ? selection[0] : undefined;
  // On the drive Quick Look shows the file's own bytes, and looking at a file counts as opening
  // it, for Recents.
  const lookedNode = looked !== undefined ? resolve(root, looked) : undefined;
  const lookedFileId =
    driveMode && lookedNode && !isContainer(lookedNode) ? lookedNode.id : undefined;
  /** Quick Look's Open button on the drive: the file opens in the application that works with it,
   * as a double-click opens it; with none (Quick Look is its only view) the button stays dimmed. */
  const lookedApp = lookedFileId && lookedNode ? appForFile(lookedNode) : undefined;
  const openLookedInApp =
    lookedApp && lookedFileId && lookedNode
      ? () => {
          openFile({ id: lookedFileId, name: lookedNode.name, type: lookedNode.type }, lookedApp);
        }
      : undefined;
  const lookedShareItems =
    driveMode && !onShare && looked !== undefined ? (
      <FileShareItems items={driveItemsAt([looked])} from="finder" />
    ) : undefined;
  const lookedFile = useDriveFile(
    lookedFileId,
    lookedNode?.kind,
    lookedFileId !== undefined,
    lookedNode?.revision === undefined ? undefined : String(lookedNode.revision),
  );
  useEffect(() => {
    if (lookedFileId) markOpened(lookedFileId);
  }, [lookedFileId]);
  const download1 = driveMode ? (path: string) => void download([path]) : undefined;
  /** The items selected, full screen: Quick Look closes for it, as on a Mac. */
  const startSlideshow = () => {
    const shown = selection.flatMap((path) => {
      const node = resolve(root, path);
      return node ? [{ path, node }] : [];
    });
    if (shown.length === 0) return;
    if (looked !== undefined) closePanel("quick-look");
    setSlides(shown);
  };
  const key =
    (front === "info" && infoPath !== null) || (front === "quick-look" && looked !== undefined)
      ? front
      : null;
  // An alert or a dialog that waits for an answer is the key window, and so is the Connect to
  // Server dialog or the Copy window while it has the keyboard: this window is then main.
  const keyAside = (aside === "connect" && connecting) || (aside === "copy" && copying);
  /** The item Get Info describes: the first selected one, or else the folder shown. */
  const infoTarget = selection[0] ?? (placeNode && !isVirtual(place) ? place : undefined);

  /** Shows a panel over this window, where the window now stands, with the keyboard in it. */
  function openPanel(panel: Panel) {
    if (DesktopWindow) return;
    asked.current = panel;
    focusAsked.current = panel;
    // Where the panels go is known at once, so that the panel is in the page with this render
    // and has the keyboard before a menu that asked for it gives the focus back to its button.
    const element = windowElement.current;
    if (element) setStack(stackOf(element, panelContainer ?? null));
    setAsked((count) => count + 1);
  }

  /** Closes a panel. The keyboard goes back to this window from the panel that had it. */
  function closePanel(panel: Panel) {
    if (panel === "info") {
      setInfo(null);
      setInspecting(false);
    } else setLooking(false);
    if (key === panel) windowElement.current?.focus({ preventScroll: true });
  }

  function showInfo() {
    if (infoTarget === undefined) return;
    setInfo(infoTarget);
    openPanel("info");
  }

  /** The space bar in Quick Look's panel closes it; on a control it is the control's own. */
  function closeLookOnSpace(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== " " || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (isTextEntry(target) || (target as Element).closest("button, a, [role='button']")) return;
    event.preventDefault();
    closePanel("quick-look");
  }

  /** Quick Look of the selected item; again, it closes the panel. */
  function toggleLook() {
    if (looked !== undefined) closePanel("quick-look");
    else if (selection.length > 0) {
      setLooking(true);
      openPanel("quick-look");
    }
  }

  const tagRows = TAGS.filter(({ name }) => !driveMode || !hiddenMenuTags.includes(name)).map(
    ({ name, color }) => (
      <MenuCheckboxItem
        key={name}
        image={<TagDot color={color} />}
        disabled={selection.length === 0}
        checked={
          selection.length > 0 &&
          selection.every((path) => resolve(root, path)?.tags?.includes(name))
        }
        onCheckedChange={(checked) => toggleTag(name, checked)}
      >
        {name}
      </MenuCheckboxItem>
    ),
  );

  function toggleTag(name: string, on: boolean) {
    if (driveMode) {
      const ops: DriveOp[] = selection.flatMap((path) => {
        const node = resolve(root, path);
        if (!node?.id) return [];
        const rest = (node.tags ?? []).filter((tag) => tag !== name);
        return [{ op: "tag" as const, id: node.id, tags: on ? [...rest, name] : rest }];
      });
      if (ops.length > 0) void undoable("Tag", ops);
      return;
    }
    commit(
      selection.reduce(
        (tree, path) =>
          changeNode(tree, path, (node) => {
            const rest = (node.tags ?? []).filter((tag) => tag !== name);
            return { ...node, tags: on ? [...rest, name] : rest };
          }),
        root,
      ),
    );
  }

  function runSaved(id: string) {
    const entry = saved.find((candidate) => candidate.id === id);
    if (!entry) return;
    navigate(entry.origin ?? entry.location);
    dispatch({ type: "query", query: entry.query, origin: entry.origin });
    dispatch({ type: "scope", scope: entry.scope });
    if (entry.rows.length > 0) dispatch({ type: "rows", rows: entry.rows, origin: entry.origin });
    setRanSearches((all) => new Map(all).set(tab.id, id));
  }

  const runningSearch = searching
    ? saved.find((item) => item.id === ranSearches.get(tab.id))
    : undefined;
  // A tab that stops searching is running nothing, whatever it searches for next.
  useEffect(() => {
    if (searching || !ranSearches.has(tab.id)) return;
    setRanSearches((all) => {
      const next = new Map(all);
      next.delete(tab.id);
      return next;
    });
  }, [searching, ranSearches, tab.id]);

  const searchAsIs = { location, origin: tab.origin, query: tab.query, scope, rows: tab.rows };
  const tooLongToKeep =
    "Finder can’t keep this search. Remove a saved search from the sidebar first, or shorten this one.";
  /** The scope bar's Save: a search that was saved is saved again, and a new one asks for a name. */
  function saveSearch() {
    if (!runningSearch) {
      setNamingSearch(true);
      return;
    }
    const kept = withChangedSearch(saved, runningSearch.id, searchAsIs);
    if (kept) setSaved(kept);
    else setFailure(tooLongToKeep);
  }

  const selectedNodes = selection.flatMap((path) => {
    const node = resolve(root, path);
    return node ? [{ path, node }] : [];
  });
  const onlySelected = selectedNodes.length === 1 ? selectedNodes[0]?.node : undefined;
  const onlyFile =
    driveMode && onlySelected?.id && !isContainer(onlySelected)
      ? { ...onlySelected, id: onlySelected.id }
      : undefined;
  const openers = onlyFile ? appsForFile(onlyFile) : [];
  const opener = onlyFile ? appForFile(onlyFile) : undefined;
  const noPlace = (label: string) => `The drive has no ${label}.`;
  /** The one folder that holds every selected item, when they are the person's to move. */
  const selectionFolder = (() => {
    if (!trashable || !driveMode) return undefined;
    const folders = new Set(driveSelection.map(({ path }) => parentPath(path)));
    const [folder] = folders;
    return folders.size === 1 && folder !== undefined && idAt(folder) ? folder : undefined;
  })();
  /** New Folder with Selection: the folder appears beside the items, and they go into it. */
  function newFolderWithSelection() {
    if (selectionFolder === undefined) return;
    const parent = idAt(selectionFolder) as string;
    const ids = driveSelection.map(({ id }) => id);
    const folder = selectionFolder;
    const asked = askNow();
    void act(runNewFolderWithItems(parent, "New Folder With Items", ids, session)).then((drive) => {
      if (drive?.created) selectMade(pathsIn(drive, drive.created), folder, asked);
    });
  }
  /** Delete Immediately, once the alert has been answered: the items in the Trash are erased. */
  function deleteSelection() {
    void act(changeDrive(driveSelection.map(({ id }) => ({ op: "delete" as const, id }))));
  }
  // The folders this person visits, newest first, for Recent Folders. Only the key window writes:
  // two windows showing different folders would otherwise each put theirs first, for ever.
  const recentFolders = useDesktopValue(FINDER_RECENT_FOLDERS, readNames, NO_NAMES);
  const shownFolder =
    driveMode && folderId !== undefined && windowState === "key" ? place : undefined;
  useEffect(() => {
    if (!shownFolder || !settingsLoaded) return;
    const recent = readNames(desktopValues()[FINDER_RECENT_FOLDERS]) ?? NO_NAMES;
    if (recent[0] !== shownFolder) {
      changeDesktopValue(FINDER_RECENT_FOLDERS, withRecentFolder(recent, shownFolder));
    }
  }, [shownFolder, settingsLoaded]);
  // The tabs: to the neighbour, out to a window of their own, and from every other window.
  function stepTab(step: number) {
    const at = state.tabs.findIndex((each) => each.id === tab.id);
    const next = state.tabs[(at + step + state.tabs.length) % state.tabs.length];
    if (next) dispatch({ type: "activate-tab", id: next.id });
  }
  function moveTabOut(id: number) {
    const moving = state.tabs.find((each) => each.id === id);
    if (!moving || state.tabs.length < 2 || !desktopHost) return;
    requestDesktopEffects([{ newWindow: "finder", opening: tabContents(moving) }]);
    dispatch({ type: "close-tab", id });
  }
  /** A press on a tab that moves: along the bar it takes a new place, away from the bar a window. */
  function dragTab(down: ReactPointerEvent<HTMLElement>, id: number) {
    if (down.button !== 0 || state.tabs.length < 2) return;
    const bar = down.currentTarget.closest(".mac-window-tab-bar");
    const { clientX: startX, clientY: startY, pointerId } = down;
    let moved = false;
    const follow = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 6) moved = true;
    };
    const finish = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerup", finish);
      if (!moved || !bar) return;
      const box = bar.getBoundingClientRect();
      if (
        event.clientY > box.bottom + TAB_TEAR_DISTANCE ||
        event.clientY < box.top - TAB_TEAR_DISTANCE
      ) {
        moveTabOut(id);
        return;
      }
      const others = [...bar.querySelectorAll<HTMLElement>("[data-tab-id]")].filter(
        (each) => each.dataset.tabId !== String(id),
      );
      const index = others.filter((each) => {
        const place = each.getBoundingClientRect();
        return place.left + place.width / 2 < event.clientX;
      }).length;
      dispatch({ type: "move-tab", id, index });
    };
    window.addEventListener("pointermove", follow);
    window.addEventListener("pointerup", finish);
  }
  // This window, for Merge All Windows in another: one a desktop hosts, which it can close once its
  // tabs have gone.
  const mergeable = driveMode && desktopHost !== null && onClose !== undefined;
  const windowHandle = useRef<FinderWindowHandle | null>(null);
  const windowNowForHandle = useRef({ state, onClose });
  windowNowForHandle.current = { state, onClose };
  useEffect(() => {
    if (!mergeable) return;
    const handle: FinderWindowHandle = {
      tabs: () => windowNowForHandle.current.state.tabs.map(tabContents),
      take: (tabs) => dispatch({ type: "add-tabs", tabs }),
      close: () => (windowNowForHandle.current.onClose as (() => void) | undefined)?.(),
    };
    windowHandle.current = handle;
    return registerFinderWindow(handle);
  }, [mergeable]);
  const [tabMenu, setTabMenu] = useState<number | null>(null);
  const finderWindows = useFinderWindowCount();

  const goPlace = (label: string, keyEquivalent: string, location: string, reason?: string) => ({
    label,
    keyEquivalent,
    reason,
    run: () => navigate(location),
  });
  const menuCommands: FinderMenuCommands = {
    drive: driveMode,
    newFolder: { enabled: Boolean(folderShown), run: newFolder },
    newSmartFolder: {
      enabled: true,
      run: () => {
        dispatch({ type: "new-tab", location });
        dispatch({ type: "rows", rows: [newCriterion()], origin: folderOf(root, tab) });
        dispatch({ type: "scope", scope: "mac" });
      },
    },
    newFolderWithSelection: {
      enabled: selectionFolder !== undefined,
      run: newFolderWithSelection,
    },
    upload: { enabled: Boolean(folderShown), run: () => uploadInput.current?.click() },
    newTab: { enabled: true, run: () => dispatch({ type: "new-tab", location: place }) },
    open: {
      enabled: selectedNodes.length > 0,
      run: () => {
        for (const entry of selectedNodes) open(entry);
      },
    },
    openWith: onlyFile
      ? [...openers]
          .sort((a, b) => Number(b === opener) - Number(a === opener))
          .map((id) => ({
            id,
            name: openerName(id),
            open: () => openFile(onlyFile, id),
            always: () => {
              chooseOpenerFor(onlyFile.name, id);
              openFile(onlyFile, id);
            },
          }))
      : [],
    getInfo: { enabled: infoTarget !== undefined, run: showInfo },
    quickLook: { enabled: looked !== undefined || selection.length > 0, run: toggleLook },
    quickLookTitle:
      looked !== undefined
        ? "Close Quick Look"
        : onlySelected
          ? `Quick Look “${onlySelected.name}”`
          : "Quick Look",
    duplicate: { enabled: trashable, run: duplicate },
    compress: { enabled: trashable && selectionFolder !== undefined, run: compress },
    compressTitle: compressTitleOf(driveSelection.map(({ node }) => node.name)),
    makeAlias: { enabled: trashable && selectionFolder !== undefined, run: makeAlias },
    showOriginal: { enabled: onlySelected?.type === ALIAS_TYPE, run: showOriginal },
    addToSidebar: {
      enabled:
        runningSearch?.sidebar === false ||
        (driveSelection.length > 0 && driveSelection.every(({ path }) => !isInTrash(path))),
      run: () => {
        if (runningSearch?.sidebar === false) {
          const shown = withChangedSearch(saved, runningSearch.id, { sidebar: undefined });
          if (shown) setSaved(shown);
          return;
        }
        const next = withFavorites(
          favoriteIds,
          driveSelection.map(({ id }) => id),
        );
        if (next) setFavoriteIds(next);
        else setFailure("The sidebar can’t hold more items. Remove one first.");
      },
    },
    addToDock: {
      enabled: driveSelection.length > 0,
      run: () => keepInDock(driveSelection.map(({ id }) => id)),
    },
    print: {
      enabled: downloadable && driveSelection.every(({ node }) => printable(node)),
      run: print,
    },
    rename: {
      enabled: trashable,
      run: startRename,
    },
    renameTitle: driveSelection.length > 1 ? `Rename ${driveSelection.length} Items…` : "Rename",
    download: { enabled: downloadable && transfer === null, run: () => void download() },
    trash: { enabled: trashable, run: moveToTrash },
    putBack: { enabled: putBackable, run: putBack },
    find: { enabled: true, run: () => requestAnimationFrame(() => searchInput.current?.focus()) },
    tagRows,
    copy: { enabled: selection.length > 0, run: () => setClipboard(selection) },
    copyTitle: onlySelected
      ? `Copy “${onlySelected.name}”`
      : selection.length > 1
        ? `Copy ${selection.length} Items`
        : "Copy",
    paste: { enabled: Boolean(folderShown) && pasteable.length > 0 && copy === null, run: paste },
    pasteTitle: pasteable.length > 1 ? `Paste ${pasteable.length} Items` : "Paste Item",
    moveHere: { enabled: movable, run: moveHere },
    moveHereTitle: pasteable.length > 1 ? `Move ${pasteable.length} Items Here` : "Move Item Here",
    selectAll: {
      enabled: entries.length > 0,
      run: () => {
        if (tab.view !== "columns" || searching) {
          select(entries.map((entry) => entry.path));
          return;
        }
        // In the columns, everything in the column of the item selected, or of the one left with none.
        const open = openColumns(root, tab);
        const cleared = selection.length === 0 && tab.noneSelected;
        const holder = cleared ? open.at(-1) : open.at(-2);
        const paths = (holder === undefined ? entries : listing(root, holder, sort)).map(
          ({ path }) => path,
        );
        const first = paths[0];
        if (first === undefined) return;
        dispatch({
          type: "columns",
          columns: cleared ? [...open, first] : open.length > 0 ? open : [first],
          selection: paths,
        });
      },
    },
    deselectAll: {
      enabled: selection.length > 0,
      run: () => {
        if (tab.view === "columns" && !searching) {
          dispatch({
            type: "columns",
            columns: openColumns(root, tab).slice(0, -1),
            selection: [],
          });
        } else select([]);
      },
    },
    slideshow: { enabled: selection.length > 0, run: () => startSlideshow() },
    slideshowTitle: selection.length > 1 ? `Slideshow ${selection.length} Items` : "Slideshow",
    showClipboard: {
      enabled: Boolean(DesktopWindow),
      run: () => setClipboardOpen(!clipboardOpen),
    },
    clipboardShown: clipboardOpen,
    undo: { enabled: driveMode && undoSteps.undo !== null, run: () => replay("undo") },
    undoTitle: undoSteps.undo ? `Undo ${undoSteps.undo.title}` : "Undo",
    redo: { enabled: driveMode && undoSteps.redo !== null, run: () => replay("redo") },
    redoTitle: undoSteps.redo ? `Redo ${undoSteps.redo.title}` : "Redo",
    view: tab.view,
    setView: showView,
    views: VIEWS,
    sort: sort.column,
    setSort: (column) => setSort({ column, direction: sortDirection(column) }),
    sorts: SORTS,
    group: groupBy,
    setGroup: setGroupBy,
    groups: GROUPS,
    toggleGroups: {
      enabled: tab.view === "icons" || tab.view === "list",
      run: () => setGroupBy(groupBy === NO_GROUP ? "kind" : NO_GROUP),
    },
    sidebarShown,
    toggleSidebar: { enabled: true, run: () => setSidebarShown(!sidebarShown) },
    iconsShown: tab.view === "icons",
    toolbarShown,
    toggleToolbar: { enabled: true, run: () => setToolbarShown(!toolbarShown) },
    customizeToolbar: { enabled: toolbarShown, run: () => setCustomizing(true) },
    tabBarShown: tabsShown,
    toggleTabBar: {
      enabled: state.tabs.length === 1,
      run: () => setTabBarWanted(!tabBarWanted),
    },
    previewShown,
    togglePreview: { enabled: tab.view === "gallery", run: () => setPreviewShown(!previewShown) },
    viewOptions: {
      enabled: Boolean(DesktopWindow) && folderId !== undefined,
      run: () => setViewOptionsOpen(!viewOptionsOpen),
    },
    viewOptionsShown: viewOptionsOpen,
    pathBarShown: pathBar,
    togglePathBar: { enabled: true, run: () => setPathBar(!pathBar) },
    statusBarShown: statusBar,
    toggleStatusBar: { enabled: true, run: () => setStatusBar(!statusBar) },
    back: { enabled: canGoBack(tab), run: () => dispatch({ type: "back" }) },
    forward: { enabled: canGoForward(tab), run: () => dispatch({ type: "forward" }) },
    enclosing: { enabled: !isVirtual(place), run: () => navigate(parentPath(place)) },
    places: [
      goPlace("Recents", "shift+command+f", RECENTS),
      goPlace("Documents", "shift+command+o", `${HOME}/Documents`),
      goPlace("Desktop", "shift+command+d", `${HOME}/Desktop`),
      goPlace("Downloads", "option+command+l", `${HOME}/Downloads`),
      goPlace("Home", "shift+command+h", HOME),
      goPlace("Computer", "shift+command+c", COMPUTER),
      goPlace("AirDrop", "shift+command+r", AIRDROP),
      goPlace("Network", "shift+command+k", NETWORK, driveMode ? noPlace("network") : undefined),
      goPlace(
        "iCloud Drive",
        "shift+command+i",
        ICLOUD,
        driveMode ? noPlace("iCloud Drive") : undefined,
      ),
      goPlace("Applications", "shift+command+a", "/Applications"),
      goPlace(
        "Utilities",
        "shift+command+u",
        "/Applications/Utilities",
        resolve(root, "/Applications/Utilities") ? undefined : "This Mac has no Utilities folder.",
      ),
    ],
    selectStartupDisk: {
      enabled: true,
      run: () => {
        navigate(COMPUTER);
        select(["/"]);
      },
    },
    library: {
      reason: resolve(root, `${HOME}/Library`) ? undefined : "The drive has no Library folder.",
      run: () => navigate(`${HOME}/Library`),
    },
    showHidden: { enabled: driveMode, run: () => setShowHidden(!showHidden) },
    inspector: {
      enabled: Boolean(DesktopWindow),
      run: () => {
        setInfo(null);
        setInspecting(!inspecting);
      },
    },
    inspectorShown: inspecting,
    summaryInfo: {
      enabled: selection.length > 1 && Boolean(DesktopWindow),
      run: () => setInfoMany(selection),
    },
    closeTab: {
      enabled: state.tabs.length > 1,
      run: () => dispatch({ type: "close-tab", id: tab.id }),
    },
    nextTab: {
      enabled: state.tabs.length > 1,
      run: () => stepTab(1),
    },
    previousTab: {
      enabled: state.tabs.length > 1,
      run: () => stepTab(-1),
    },
    moveTabToWindow: {
      enabled: state.tabs.length > 1 && desktopHost !== null,
      run: () => moveTabOut(tab.id),
    },
    mergeAllWindows: {
      enabled: mergeable && finderWindows > 1,
      run: () => {
        if (windowHandle.current) mergeFinderWindows(windowHandle.current);
      },
    },
    showAllTabs: { enabled: state.tabs.length > 1, run: () => setAllTabs(!allTabs) },
    allTabsShown: allTabs,
    goToFolder: { enabled: true, run: () => setGoing(true) },
    savedSearches: saved.map((item) => ({
      id: item.id,
      name: item.name ?? `Search for “${item.query}”`,
      run: () => runSaved(item.id),
    })),
    recentFolders: recentFolders.map((path) => ({
      path,
      name: locationName(root, path),
      go: () => navigate(path),
    })),
    clearRecentFolders: () => changeDesktopValue(FINDER_RECENT_FOLDERS, []),
    connect: { enabled: true, run: () => setConnecting(true) },
    emptyTrash: { enabled: trashed > 0, run: askEmptyTrash },
    emptyTrashNow: { enabled: trashed > 0, run: emptyTrash },
  };
  useDesktopAppMenu("finder", "Finder", finderAppRows(menuCommands), menuWindow);
  useDesktopAppMenu("finder", "File", finderFileRows(menuCommands), menuWindow);
  useDesktopAppMenu("finder", "Edit", finderEditRows(menuCommands), menuWindow);
  useDesktopAppMenu("finder", "View", finderViewRows(menuCommands), menuWindow);
  useDesktopAppMenu("finder", "Go", finderGoRows(menuCommands), menuWindow);
  useDesktopAppMenu("finder", "Window", finderWindowRows(menuCommands), menuWindow);
  useDesktopAppMenu("finder", "Help", finderHelpRows(), menuWindow);

  /** What a secondary click on `hit` is about: an item it also selects, as a Mac's does, or a place. */
  function contextTargetAt(hit: Element): FinderContextTarget {
    const crumb = hit.closest("[data-finder-path]")?.getAttribute("data-finder-path");
    if (crumb) return { kind: "place", path: crumb, from: "path" };
    const row = hit.closest('[role="treeitem"][data-value]');
    if (row && !mainRef.current?.contains(row)) {
      return { kind: "place", path: row.getAttribute("data-value") ?? "", from: "sidebar" };
    }
    const item = drag.itemAt(hit);
    if (item) {
      if (!selection.includes(item.path)) selectInView([item.path], parentPath(item.path));
      return { kind: "items" };
    }
    if (selection.length > 0) select([]);
    return { kind: "background" };
  }

  const pictureSelected =
    selectedNodes.length > 0 && selectedNodes.every(({ node }) => node.kind === "image");
  const opensInTextEdit = menuCommands.openWith.find(({ id }) => id === "textedit");
  const pictureFile = onlySelected?.kind === "image" && driveMode ? onlySelected.id : undefined;
  const contextCommands: FinderContextCommands = {
    commands: menuCommands,
    quickActions: [
      ...(allOnDrive
        ? quickActionsFor(savedWorkflowsNow, "files").map((workflow) => ({
            id: workflow.id,
            title: workflow.name,
            run: () =>
              runQuickActionOnFiles(
                workflow,
                driveSelection.map(({ id }) => id),
              ),
          }))
        : []),
      ...(pictureSelected
        ? [
            {
              title: "Rotate Left",
              run: () => {
                for (const path of selection) turn(path);
              },
            },
            {
              title: "Markup",
              // Quick Look is where Markup is: open already, it stays.
              run: () => {
                if (looked === undefined) toggleLook();
              },
            },
            {
              title: "Customize…",
              run: () => {
                requestPane("extensions");
                requestDesktopEffects([{ open: "system-preferences" }]);
              },
            },
          ]
        : []),
    ],
    services: [
      ...(pictureFile
        ? [
            {
              title: "Set Desktop Picture",
              run: () => {
                showDrivePicture(pictureFile, takePictureChoice()).catch((error: unknown) =>
                  setFailure(`The desktop picture could not be set: ${String(error)}`),
                );
              },
            },
          ]
        : []),
      ...(opensInTextEdit && selectedNodes.length === 1
        ? [{ title: "Open Selected File in TextEdit", run: opensInTextEdit.open }]
        : []),
      ...(driveSelection.length === 1 && onlySelected && isContainer(onlySelected)
        ? (["window", "tab"] as const).map((folder) => ({
            title: folder === "window" ? "New Terminal at Folder" : "New Terminal Tab at Folder",
            run: () => {
              requestOpenFile({
                app: "terminal",
                id: onlySelected.id ?? "",
                name: onlySelected.name,
                folder,
              });
              requestDesktopEffects([{ open: "terminal" }]);
            },
          }))
        : []),
    ],
    count: selectedNodes.length,
    inTrash: putBackable,
    openInTab:
      onlySelected && isContainer(onlySelected) && selection[0] !== undefined
        ? () => dispatch({ type: "new-tab", location: selection[0] as string })
        : undefined,
    newFolderWithSelection: menuCommands.newFolderWithSelection,
    deleteNow: { enabled: putBackable, run: () => setDeleting(driveSelection.length) },
    shareRows:
      driveMode && !onShare ? (
        <FileShareItems items={driveItemsAt(selection)} from="finder" />
      ) : (
        SHARE_WITH.map((destination) => (
          <MenuItem key={destination} onClick={() => onShare?.(destination, selection)}>
            {destination}
          </MenuItem>
        ))
      ),
    tagRows,
    place(path) {
      if (path.startsWith("saved:")) {
        return {
          open: () => runSaved(path),
          remove: () => setSaved(saved.filter((item) => item.id !== path)),
        };
      }
      const node = resolve(root, path);
      const file = node && !isContainer(node);
      const favorite = favoritePlaces.find((item) => item.path === path);
      return {
        open: () => (file ? open({ path, node }) : navigate(path)),
        openInTab: file ? undefined : () => dispatch({ type: "new-tab", location: path }),
        remove: favorite
          ? () => setFavoriteIds(favoriteIds.filter((id) => id !== favorite.id))
          : undefined,
        getInfo: node
          ? () => {
              setInfo(path);
              openPanel("info");
            }
          : undefined,
        ejectReason: driveMode && path === "/" ? EJECT_REASON : undefined,
      };
    },
  };

  /** The Info window for several items together. */
  const manyInfoWindow = (id: string, paths: readonly string[], onClosed: () => void) =>
    DesktopWindow && paths.length > 0 ? (
      <DesktopWindow
        id={id}
        title={`${paths.length === 1 ? "1 item" : `${paths.length} items`} Info`}
        panel
        defaultSize={{ width: 265, height: 240 }}
        resizable={false}
        fitsContent
        dragRegion="[data-window-drag-region]"
        onClose={onClosed}
        render={({
          onClose: close,
          onMinimize: _minimize,
          onZoom: _zoom,
          zoomRole: _role,
          minimizeDisabled: _noMinimize,
          zoomDisabled: _noZoom,
          onDragRegionPointerDown: _move,
          onDragRegionDoubleClick: _zoomFromBar,
          variant: _variant,
          fullScreen: _fullScreen,
          height: _height,
          ...panelProps
        }) => (
          <FinderSummaryInfo
            {...panelProps}
            root={root}
            paths={paths}
            onLockedChange={
              driveMode
                ? (locked) => {
                    const ops = paths.flatMap((path): DriveOp[] => {
                      const item = idAt(path);
                      return item ? [{ op: "info", id: item, locked }] : [];
                    });
                    void act(changeDrive(ops));
                  }
                : undefined
            }
            onTagsChange={
              driveMode
                ? (changes) => {
                    const ops = changes.flatMap(([path, tags]): DriveOp[] => {
                      const item = idAt(path);
                      return item ? [{ op: "tag", id: item, tags }] : [];
                    });
                    void undoable("Tag", ops);
                  }
                : undefined
            }
            onCommentChange={
              driveMode
                ? (comment) => {
                    const ops = paths.flatMap((path): DriveOp[] => {
                      const item = idAt(path);
                      return item ? [{ op: "info", id: item, comment }] : [];
                    });
                    void act(changeDrive(ops));
                  }
                : undefined
            }
            onClose={close}
          />
        )}
      />
    ) : null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (allTabs && event.key === "Escape") {
      event.preventDefault();
      setAllTabs(false);
      return;
    }
    if (event.key === " " && !(event.metaKey || event.ctrlKey || event.altKey)) {
      // The space bar on an item is Quick Look; on a control it is the control's own.
      if (!isInItems(event.target) || (selection.length === 0 && looked === undefined)) return;
      toggleLook();
      event.preventDefault();
      return;
    }
    if (!(event.metaKey || event.ctrlKey)) return;
    for (const [equivalent, command] of finderMenuKeys(menuCommands)) {
      if (!matchesMenuKeyEquivalent(event, equivalent)) continue;
      // Select All and Undo in a field are the text's own.
      if (
        (equivalent === "command+a" ||
          equivalent === "command+z" ||
          equivalent === "shift+command+z") &&
        isTextEntry(event.target)
      ) {
        return;
      }
      if (command.enabled) command.run();
      event.preventDefault();
      return;
    }
    if (event.altKey) {
      // Option-Command-V: Move Item Here.
      if (driveMode && event.key.toLowerCase() === "v" && !isTextEntry(event.target) && movable) {
        moveHere();
        event.preventDefault();
      }
      return;
    }
    const view = VIEWS[Number(event.key) - 1];
    const letter = event.key.toLowerCase();
    if (view) {
      showView(view.view);
      // The view that had the keyboard focus goes away; the window keeps it for the next key.
      event.currentTarget.focus();
    } else if (event.key === "[") dispatch({ type: "back" });
    else if (event.key === "]") dispatch({ type: "forward" });
    else if (event.key === "f") searchInput.current?.focus();
    else if (event.key === "i") showInfo();
    else if (event.shiftKey && letter === "g") setGoing(true);
    else if (!event.shiftKey && letter === "k") setConnecting(true);
    else if (event.shiftKey && (event.key === "Backspace" || event.key === "Delete")) {
      if (trashed === 0) return;
      askEmptyTrash();
    } else if (
      driveMode &&
      (event.key === "Backspace" || event.key === "Delete") &&
      !isTextEntry(event.target)
    ) {
      // Command-Delete: Move to Trash, or Put Back in the Trash.
      if (putBackable) putBack();
      else if (trashable) moveToTrash();
      else return;
    } else if (driveMode && letter === "d" && !event.shiftKey && !isTextEntry(event.target)) {
      if (!trashable) return;
      duplicate();
    } else if (letter === "c" || letter === "v") {
      // In a field the two keys are the text's own.
      if (event.shiftKey || isTextEntry(event.target)) return;
      if (letter === "v") paste();
      else if (selection.length > 0) setClipboard(selection);
    } else if (event.key === "ArrowUp" && !isTextEntry(event.target) && !isVirtual(place)) {
      navigate(parentPath(place));
    } else if (
      event.key === "ArrowDown" &&
      !isTextEntry(event.target) &&
      menuCommands.open.enabled
    ) {
      menuCommands.open.run();
    } else return;
    event.preventDefault();
  }

  const sidebarValue = searching
    ? null
    : ([
        ...FAVORITES.map((item) => item.location),
        ...favoritePlaces.map((item) => item.path),
        ...(disksInSidebar ? ["/"] : []),
        ICLOUD,
        COMPUTER,
        NETWORK,
        ALL_TAGS,
      ].find((value) => value === location) ??
      (location.startsWith("/Volumes/") || location.startsWith("tag:") ? location : null));

  const pathEntries = useMemo(() => {
    const focus = selection.length === 1 ? (selection[0] as string) : searching ? "" : place;
    return ancestry(root, focus);
  }, [root, selection, searching, place]);

  // Command-click on the title: the path menu opens as a secondary click on its anchor does.
  const pathAnchor = useRef<HTMLDivElement>(null);
  const openPathMenu = (bar: HTMLElement) => {
    // A place such as Recents is in no folder.
    if (ancestry(root, place).length === 0) return;
    const title = bar.querySelector(".mac-title-bar-title")?.getBoundingClientRect();
    pathAnchor.current?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: title?.left ?? 0,
        clientY: title?.bottom ?? 0,
      }),
    );
  };

  // The search field's suggestions: `null` while they do not show.
  const [suggesting, setSuggesting] = useState<number | null>(null);
  const suggestions = driveMode ? searchSuggestions(tab.query) : [];
  const suggestionsShown = searching && suggesting !== null && suggestions.length > 0;
  const suggestionsId = `${uid}-suggestions`;
  const pickSuggestion = ({ criterion }: SearchSuggestion) => {
    setSuggesting(null);
    dispatch({
      type: "rows",
      rows: [...tab.rows, criterion],
      origin: tab.origin ?? folderOf(root, tab),
    });
    dispatch({ type: "query", query: "", origin: tab.origin });
  };

  // Drag and drop on the drive (`desktop-drag.ts`, `finder-drag.ts`): a press on an item that moves
  // a few points drags the selection, and whatever is under the pointer when it is let go decides
  // where the items go.
  const mainRef = useRef<HTMLDivElement>(null);
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!dropNotice) return;
    const shown = setTimeout(() => setDropNotice(null), 5000);
    return () => clearTimeout(shown);
  }, [dropNotice]);
  /**
   * A row of the sidebar's Favorites dragged along the others. One the person added, `favorite`, also
   * comes off when let go out of the sidebar, as on a Mac; a built-in row goes by Preferences' Sidebar.
   */
  const dragSidebarRow =
    (key: string, favorite?: string) => (down: ReactPointerEvent<HTMLElement>) => {
      if (down.button !== 0) return;
      const over = (x: number, y: number) =>
        document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-sidebar-row]");
      let marked: Element | null | undefined;
      const mark = (row: Element | null | undefined) => {
        marked?.removeAttribute("data-desktop-drop");
        marked = row;
        row?.setAttribute("data-desktop-drop", "accept");
      };
      followDrag(
        down,
        (move) => mark(over(move.clientX, move.clientY)),
        (up, started) => {
          mark(null);
          if (!started) return;
          const to = up && over(up.clientX, up.clientY)?.dataset.sidebarRow;
          if (to) {
            const order = withFavoriteMoved(
              favoriteRows.map((row) => row.key),
              key,
              to,
            );
            if (sidebarOrderFits(order)) setSidebarOrder(order);
            else setFailure("The sidebar can’t hold more items. Remove one first.");
            if (favorite) setFavoriteIds(withFavoriteMoved(favoriteIds, favorite, to));
          }
          // Let go out of the sidebar, the row comes off it, as on a Mac.
          else if (
            favorite &&
            up &&
            !document.elementFromPoint(up.clientX, up.clientY)?.closest(".mac-finder-sidebar")
          ) {
            setFavoriteIds(favoriteIds.filter((each) => each !== favorite));
          }
        },
      );
    };
  const placeRow = (item: (typeof FAVORITES)[number]) => ({
    key: item.location,
    row: (
      <SidebarItem
        value={item.location}
        label={item.label}
        icon={<SidebarGlyph name={item.glyph} />}
        data-sidebar-row={item.location}
        onPointerDown={dragSidebarRow(item.location)}
      />
    ),
  });
  const favoriteRows = inSidebarOrder(
    [
      ...FAVORITES.filter((item) => shownPlace(item.label)).map(placeRow),
      ...OPTIONAL_FAVORITES.filter((item) => driveMode && shownPlaces.includes(item.label)).map(
        placeRow,
      ),
      ...favoritePlaces.map(({ id, path, node }) => ({
        key: id,
        row: (
          <SidebarItem
            value={path}
            label={node.name}
            icon={<SidebarGlyph name="documents" />}
            data-favorite-id={id}
            data-sidebar-row={id}
            onPointerDown={dragSidebarRow(id, id)}
          />
        ),
      })),
      ...saved
        .filter((item) => item.sidebar !== false)
        .map((item) => ({
          key: item.id,
          row: (
            <SidebarItem
              value={item.id}
              label={item.name ?? `Search for “${item.query}”`}
              icon={<SidebarGlyph name="documents" />}
              data-sidebar-row={item.id}
              onPointerDown={dragSidebarRow(item.id)}
            />
          ),
        })),
    ],
    sidebarOrder,
  );

  const drag = {
    /** The item of this window's views under `hit`, by the id of its row. */
    itemAt(hit: Element): { element: Element; path: string } | undefined {
      const element = hit.closest('[role="option"], [role="row"]');
      if (!element || !mainRef.current?.contains(element)) return undefined;
      const path = itemOfRow(element.getAttribute("data-item-id") ?? "");
      return path && resolve(root, path) ? { element, path } : undefined;
    },
    nameOf: (path: string) => resolve(root, path)?.name ?? path,
    selection,
    /** What a press on `pressed` drags: what was selected when it holds the item, else the item. */
    dragged(pressed: string, held: readonly string[]): DesktopDragItem[] {
      const paths = held.includes(pressed) ? held : [pressed];
      const applications = paths.flatMap((path) => {
        const node = resolve(root, path);
        return node?.kind === "application"
          ? [{ id: node.name, name: node.name, kind: "file" as const, type: LAUNCHPAD_APP_DRAG }]
          : [];
      });
      if (applications.length > 0) return applications;
      return driveItemsAt(paths.filter((path) => !isInTrash(path))).filter(
        (item) => !HOME_FOLDER_IDS.has(item.id),
      );
    },
    /** Press on one item of several selected: the library's views select it alone on the way. */
    reselect: select,
    /** Where a drop on `hit` lands in this window: a sidebar place, an item, or the folder shown. */
    targetAt(hit: Element): DropTarget | undefined {
      if (!driveMode) return undefined;
      const main = mainRef.current;
      const going = (path: string) => () => navigate(path);
      const crumb = hit.closest("[data-finder-path]");
      if (crumb) {
        const path = crumb.getAttribute("data-finder-path") ?? "";
        const node = resolve(root, path);
        if (!node) return undefined;
        const folder = isContainer(node) && !isInTrash(path);
        return {
          path,
          name: node.name,
          folder,
          element: crumb,
          spring: folder ? going(path) : undefined,
        };
      }
      const tabElement = hit.closest('[role="tab"]');
      const tabHit = tabElement && state.tabs.find((each) => tabId(each.id) === tabElement.id);
      if (tabElement && tabHit) {
        const path = folderOf(root, tabHit);
        const node = path === null ? undefined : resolve(root, path);
        if (path === null || !node || isInTrash(path)) return undefined;
        return {
          path,
          name: node.name,
          folder: true,
          element: tabElement,
          spring: () => dispatch({ type: "activate-tab", id: tabHit.id }),
        };
      }
      const place = hit.closest('[role="treeitem"][data-value]');
      if (place && !main?.contains(place)) {
        const path = place.getAttribute("data-value") ?? "";
        const node = resolve(root, path);
        return node && isContainer(node) && !isInTrash(path)
          ? { path, name: node.name, folder: true, element: place, spring: going(path) }
          : undefined;
      }
      const item = drag.itemAt(hit);
      const node = item && resolve(root, item.path);
      if (item && node) {
        const folder = isContainer(node) && !isInTrash(item.path);
        return {
          path: item.path,
          name: node.name,
          folder,
          element: item.element,
          spring: folder ? going(item.path) : undefined,
        };
      }
      if (main?.contains(hit) && folderShown && !isInTrash(folderShown)) {
        return { path: folderShown, name: drag.nameOf(folderShown), folder: true, element: main };
      }
      return undefined;
    },
    /**
     * A drop on the Favorites heading, or in the gap between two of its rows, adds to the sidebar; a
     * drop on a row itself goes into that place, as on a Mac.
     */
    favoritesGap(hit: Element, dragging: DesktopDrag): DropLanding | undefined {
      const section = hit.closest("[data-finder-favorites]");
      if (!driveMode || !section || !dragging.at) return undefined;
      const row = hit.closest('[role="treeitem"]')?.getBoundingClientRect();
      if (
        row &&
        dragging.at.y >= row.top + FAVORITE_GAP &&
        dragging.at.y <= row.bottom - FAVORITE_GAP
      ) {
        return undefined;
      }
      return {
        element: section,
        drop() {
          const next = withFavorites(
            favoriteIds,
            dragging.items.map(({ id }) => id),
          );
          if (next) setFavoriteIds(next);
          else setFailure("The sidebar can’t hold more items. Remove one first.");
        },
      };
    },
    /** What a drop on `hit` does: Option copies, and so does a drag from any other application. */
    landing(hit: Element, dragging: DesktopDrag): DropLanding | undefined {
      const favoritesAt = drag.favoritesGap(hit, dragging);
      if (favoritesAt) return favoritesAt;
      const target = drag.targetAt(hit);
      if (!target) return undefined;
      if (dragging.items.some((item) => item.type === LAUNCHPAD_APP_DRAG)) {
        return {
          element: target.element,
          refusal: "An application stays in Applications. Drag it to the Dock to keep it there.",
          sayRefusal: drag.refuse,
          drop() {},
        };
      }
      const outside = dragging.items.filter((item) => item.bytes);
      if (outside.length > 0) {
        return {
          element: target.element,
          refusal: refusalFor([], target),
          copies: true,
          sayRefusal: drag.refuse,
          springs: target.spring,
          drop() {
            void filesOfDrag(outside).then(
              (files) => upload(files, target.path),
              (error: unknown) => setFailure(messageOf(error)),
            );
          },
        };
      }
      const sources = dragging.items.flatMap((item) => {
        const path = pathOfEntry(root, item.id);
        return path ? [{ id: item.id, path, name: item.name }] : [];
      });
      const copies = dragging.copy || (dragging.from !== "finder" && dragging.from !== "desktop");
      return {
        element: target.element,
        refusal: refusalFor(sources, target),
        copies,
        sayRefusal: drag.refuse,
        springs: target.spring,
        drop() {
          bringInto(
            sources.map((source) => source.path),
            target.path,
            !copies,
          );
        },
      };
    },
    trash(ids: string[]) {
      if (ids.length > 0) {
        void undoable(
          "Move",
          ids.map((id) => ({ op: "trash" as const, id })),
        );
      }
    },
    refuse: (message: string) => setDropNotice(message),
  };
  const dragRef = useRef(drag);
  dragRef.current = drag;
  useEffect(() => {
    const main = mainRef.current;
    const element = main?.closest(".mac-window") ?? main?.parentElement;
    if (!driveMode || !main || !element) return;
    const unregister = registerDropTarget({
      element,
      landing: (hit, dragging) => dragRef.current.landing(hit, dragging),
    });
    const press = (down: PointerEvent) => {
      if (down.button !== 0 || !(down.target instanceof Element)) return;
      const pressed = dragRef.current.itemAt(down.target);
      if (!pressed) {
        // The background of a view, not its scroll bar: a rubber band.
        const view = down.target.closest('[role="listbox"], [role="treegrid"]');
        if (!view || isTextEntry(down.target) || down.target.closest('[role="row"]')) return;
        const from = view.getBoundingClientRect();
        if (down.clientX - from.left > view.clientWidth) return;
        if (down.clientY - from.top > view.clientHeight) return;
        beginMarquee(down, {
          container: main,
          kept: down.shiftKey || down.metaKey || down.ctrlKey ? dragRef.current.selection : [],
          before: dragRef.current.selection,
          items: () =>
            [...view.querySelectorAll('[role="option"], [role="row"]')].flatMap((element) => {
              const item = dragRef.current.itemAt(element);
              return item ? [item] : [];
            }),
          onChange: (paths) => dragRef.current.reselect(paths),
        });
        return;
      }
      const held = dragRef.current.selection;
      beginDesktopDrag(down, {
        from: "finder",
        icon: pressed.element.querySelector(
          ".mac-icon-view-icon > *, .mac-finder-name > :first-child, svg",
        ),
        items: () => dragRef.current.dragged(pressed.path, held),
        trash: (ids) => dragRef.current.trash(ids),
        onStart() {
          if (held.length > 1 && held.includes(pressed.path)) dragRef.current.reselect([...held]);
        },
        onNothing() {
          dragRef.current.refuse(`“${dragRef.current.nameOf(pressed.path)}” can’t be moved.`);
        },
      });
    };
    main.addEventListener("pointerdown", press, true);
    return () => {
      unregister();
      main.removeEventListener("pointerdown", press, true);
    };
  }, [driveMode]);

  const viewProps = {
    label: title,
    entries,
    selection,
    onSelectionChange: select,
    onOpen: open,
  };
  const viewGroups = useMemo(
    () => (groupBy === NO_GROUP ? undefined : groupEntries(entries, groupBy)),
    [entries, groupBy],
  );
  const listProps = {
    ...viewProps,
    groups: viewGroups,
    root,
    sort,
    onSortChange: setSort,
    expanded: tab.expanded,
    onExpandedChange: expand,
    flat: isFlat(tab),
    columns: viewOptions.columns,
    iconSize: viewOptions.listIcon,
    textSize: viewOptions.text,
    relativeDates: viewOptions.relativeDates,
    allSizes: viewOptions.allSizes,
  };

  // What the status bar counts: the rows of the list with those of its expanded folders, in
  // the columns the items of the column that holds the selection, otherwise the items shown.
  // The selected items are always among them.
  const population = useMemo(() => {
    if (tab.view === "list") {
      return viewGroups ? entries.length : selectable(root, entries, tab, sort).size;
    }
    if (tab.view === "columns" && !searching) {
      const holder = openColumns(root, tab).at(-2);
      return holder === undefined ? entries.length : listing(root, holder).length;
    }
    return entries.length;
  }, [root, entries, tab, sort, searching, viewGroups]);

  const main = (
    <Window
      className={cn("mac-finder", className)}
      tabIndex={-1}
      aria-busy={(driveMode && driveData === null) || transfer !== null || undefined}
      onKeyDown={handleKeyDown}
      {...windowProps}
      onKeyDownCapture={(event) => {
        windowProps.onKeyDownCapture?.(event);
        // Return renames on a Mac, from the view or the window around it; Command-O and
        // Command-Down open.
        if (
          event.key !== "Enter" ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey ||
          !driveMode ||
          !(event.target === event.currentTarget || isInItems(event.target))
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (trashable) startRename();
      }}
      ref={(element) => {
        windowElement.current = element;
        setMenuWindow(element);
        if (typeof ref === "function") return ref(element);
        if (ref) ref.current = element;
      }}
      state={(key !== null || keyAside || modal) && windowState === "key" ? "main" : windowState}
      onFocusCapture={(event) => {
        onFocusCapture?.(event);
        setFront(null);
        setAside(null);
      }}
    >
      <ContextualMenu>
        <ContextualMenuTrigger ref={pathAnchor} className="mac-finder-path-anchor" />
        <ContextualMenuPopup>
          {[...ancestry(root, place)].reverse().map(({ path, node }) => (
            <MenuItem key={path} onClick={() => navigate(path)}>
              {node.name}
            </MenuItem>
          ))}
        </ContextualMenuPopup>
      </ContextualMenu>
      {desktopHost && DesktopWindow ? <DesktopWindowName title={title} /> : null}
      <TitleBar
        variant={toolbarShown ? "unified" : "standard"}
        title={title}
        icon={<ItemIcon node={placeNode ?? FOLDER_NODE} size={16} />}
        onContextMenu={(event) => {
          if (!(event.target as Element).closest(".mac-title-bar-title")) return;
          event.preventDefault();
          openPathMenu(event.currentTarget);
        }}
        onPointerDown={(event) => {
          const hit = event.target as Element;
          if (event.button !== 0 || !hit.closest(".mac-title-bar-title")) return;
          // Command-click on the title: the folders it is in, without moving the window.
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            openPathMenu(event.currentTarget);
            return;
          }
          // The folder's icon in the title is the folder: it drags out as its icon does in a view.
          const proxy = hit.closest(".mac-title-bar-icon");
          if (!proxy || !driveMode || !folderShown || idAt(folderShown) === undefined) return;
          event.preventDefault();
          const shown = folderShown;
          beginDesktopDrag(event.nativeEvent, {
            from: "finder",
            icon: proxy,
            items: () => dragRef.current.dragged(shown, []),
            trash: (ids) => dragRef.current.trash(ids),
            onNothing() {
              dragRef.current.refuse(`“${dragRef.current.nameOf(shown)}” can’t be moved.`);
            },
          });
        }}
        divider={tabsShown ? "bar" : "content"}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
            {...controlsProps}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        {toolbarShown ? (
          <ContextualMenu>
            <ContextualMenuTrigger
              render={
                <Toolbar
                  aria-label="Finder toolbar"
                  displayMode={toolbarMode}
                  {...(customizing ? toolbarDropProps(toolbarOrder, setToolbarOrder) : undefined)}
                />
              }
              onContextMenuCapture={(event) => {
                // A text field keeps the browser's own menu.
                if (isTextEntry(event.target)) event.stopPropagation();
              }}
            >
              {toolbarItems(
                toolbarOrder,
                toolbarMode,
                {
                  back: (
                    <ToolbarSegmentedControl
                      variant="navigation"
                      tracking="momentary"
                      aria-label="History"
                    >
                      <ToolbarSegment
                        aria-label="Back"
                        disabled={!canGoBack(tab)}
                        onClick={() => dispatch({ type: "back" })}
                      >
                        <SystemImage name="go-back" />
                      </ToolbarSegment>
                      <ToolbarSegment
                        aria-label="Forward"
                        disabled={!canGoForward(tab)}
                        onClick={() => dispatch({ type: "forward" })}
                      >
                        <SystemImage name="go-forward" />
                      </ToolbarSegment>
                    </ToolbarSegmentedControl>
                  ),
                  views: (
                    <ToolbarSegmentedControl
                      className="mac-finder-views"
                      aria-label="View"
                      value={[tab.view]}
                      onValueChange={(value) => {
                        const view = value[0] as FinderView | undefined;
                        if (view) showView(view);
                      }}
                    >
                      {VIEWS.map(({ view, label, image }) => (
                        <ToolbarSegment
                          key={view}
                          value={view}
                          aria-label={label}
                          className={view === "columns" ? "mac-finder-view-columns" : undefined}
                        >
                          <SystemImage name={image} />
                        </ToolbarSegment>
                      ))}
                    </ToolbarSegmentedControl>
                  ),
                  // Finder's Group and Action buttons are the library's toolbar pull-down. Group shows
                  // the icon-view image as a stand-in for Finder's own group glyph.
                  group: (
                    <ToolbarPullDown
                      aria-label="Group"
                      className="mac-finder-menu-button"
                      image={<SystemImage name="icon-view" />}
                      disabled={tab.view !== "icons" && tab.view !== "list"}
                    >
                      <MenuRadioGroup
                        value={groupBy}
                        onValueChange={(column) => setGroupBy(String(column))}
                      >
                        <MenuRadioItem value={NO_GROUP}>None</MenuRadioItem>
                        {GROUPS.map(({ column, label }) => (
                          <MenuRadioItem key={column} value={column}>
                            {label}
                          </MenuRadioItem>
                        ))}
                      </MenuRadioGroup>
                    </ToolbarPullDown>
                  ),
                  action: (
                    <ActionPullDown
                      aria-label="Action"
                      className="mac-finder-menu-button"
                      image={<SystemImage name="action" scale={14 / 13} />}
                    >
                      <MenuItem disabled={!folderShown} onClick={newFolder}>
                        New Folder
                      </MenuItem>
                      {driveMode && (
                        <MenuItem
                          disabled={
                            !folderShown || idAt(folderShown) === undefined || transfer !== null
                          }
                          onClick={() => uploadInput.current?.click()}
                        >
                          Upload Files…
                        </MenuItem>
                      )}
                      <MenuItem onClick={() => dispatch({ type: "new-tab", location: place })}>
                        New Tab
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem disabled={infoTarget === undefined} onClick={showInfo}>
                        Get Info
                      </MenuItem>
                      <OpenWithRows commands={menuCommands} />
                      <MenuItem disabled={selection.length === 0} onClick={toggleLook}>
                        {looked !== undefined
                          ? "Close Quick Look"
                          : selection.length === 1
                            ? `Quick Look “${resolve(root, selection[0] as string)?.name}”`
                            : "Quick Look"}
                      </MenuItem>
                      {driveMode && (
                        <>
                          <MenuItem
                            disabled={!downloadable || transfer !== null}
                            onClick={() => void download()}
                          >
                            Download
                          </MenuItem>
                          <MenuItem disabled={!trashable} onClick={startRename}>
                            {menuCommands.renameTitle}
                          </MenuItem>
                          <MenuItem disabled={!trashable} onClick={duplicate}>
                            Duplicate
                          </MenuItem>
                          <Row command={menuCommands.compress}>{menuCommands.compressTitle}</Row>
                          <Row command={menuCommands.makeAlias}>Make Alias</Row>
                          {contextCommands.quickActions.length > 0 ? (
                            <Submenu>
                              <SubmenuTrigger>Quick Actions</SubmenuTrigger>
                              <SubmenuPopup>
                                {contextCommands.quickActions.map(({ title: action, run, id }) => (
                                  <MenuItem key={id ?? action} onClick={run}>
                                    {action}
                                  </MenuItem>
                                ))}
                              </SubmenuPopup>
                            </Submenu>
                          ) : null}
                          {contextCommands.services.length > 0 ? (
                            <Submenu>
                              <SubmenuTrigger>Services</SubmenuTrigger>
                              <SubmenuPopup>
                                {contextCommands.services.map(({ title: service, run }) => (
                                  <MenuItem key={service} onClick={run}>
                                    {service}
                                  </MenuItem>
                                ))}
                              </SubmenuPopup>
                            </Submenu>
                          ) : null}
                          {putBackable ? (
                            <MenuItem onClick={putBack}>Put Back</MenuItem>
                          ) : (
                            <MenuItem disabled={!trashable} onClick={moveToTrash}>
                              Move to Trash
                            </MenuItem>
                          )}
                        </>
                      )}
                      <MenuSeparator />
                      <MenuItem
                        disabled={selection.length === 0}
                        onClick={() => setClipboard(selection)}
                      >
                        {selection.length === 1
                          ? `Copy “${resolve(root, selection[0] as string)?.name}”`
                          : selection.length > 1
                            ? `Copy ${selection.length} Items`
                            : "Copy"}
                      </MenuItem>
                      <MenuItem
                        disabled={!folderShown || pasteable.length === 0 || copy !== null}
                        onClick={paste}
                      >
                        {pasteable.length > 1 ? `Paste ${pasteable.length} Items` : "Paste Item"}
                      </MenuItem>
                      {driveMode && (
                        <MenuItem disabled={!movable} onClick={moveHere}>
                          {pasteable.length > 1
                            ? `Move ${pasteable.length} Items Here`
                            : "Move Item Here"}
                        </MenuItem>
                      )}
                      <MenuSeparator />
                      <MenuItem onClick={() => setGoing(true)}>Go to Folder…</MenuItem>
                      <MenuItem onClick={() => setConnecting(true)}>Connect to Server…</MenuItem>
                      <MenuSeparator />
                      <MenuItem disabled={trashed === 0} onClick={askEmptyTrash}>
                        Empty Trash…
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem onClick={() => setPathBar(!pathBar)}>
                        {pathBar ? "Hide Path Bar" : "Show Path Bar"}
                      </MenuItem>
                      <MenuItem onClick={() => setStatusBar(!statusBar)}>
                        {statusBar ? "Hide Status Bar" : "Show Status Bar"}
                      </MenuItem>
                    </ActionPullDown>
                  ),
                  share: (
                    <Menu>
                      {/* Dimmed while nothing is selected, and where the host gives no share destination
                (`onShare`) and there is no drive to share from. */}
                      <MenuTrigger
                        disabled={selection.length === 0 || !(onShare || driveMode)}
                        render={
                          <ToolbarButton
                            aria-label="Share"
                            className="mac-finder-item-button"
                            title={
                              onShare || driveMode ? undefined : "Sharing is not available here."
                            }
                          />
                        }
                      >
                        <SystemImage name="share" />
                      </MenuTrigger>
                      <MenuPopup sideOffset={4}>
                        {driveMode && !onShare ? (
                          <FileShareItems items={driveItemsAt(selection)} from="finder" />
                        ) : (
                          SHARE_WITH.map((destination) => (
                            <MenuItem
                              key={destination}
                              onClick={() => onShare?.(destination, selection)}
                            >
                              {destination}
                            </MenuItem>
                          ))
                        )}
                      </MenuPopup>
                    </Menu>
                  ),
                  tags: (
                    <Menu>
                      <MenuTrigger
                        disabled={selection.length === 0}
                        render={
                          <ToolbarButton
                            aria-label="Edit Tags"
                            className="mac-finder-item-button"
                          />
                        }
                      >
                        <SystemImage name="tag" />
                      </MenuTrigger>
                      <MenuPopup sideOffset={4}>
                        {TAGS.map(({ name, color }) => (
                          <MenuCheckboxItem
                            key={name}
                            image={<TagDot color={color} />}
                            checked={
                              selection.length > 0 &&
                              selection.every((path) => resolve(root, path)?.tags?.includes(name))
                            }
                            onCheckedChange={(checked) => toggleTag(name, checked)}
                          >
                            {name}
                          </MenuCheckboxItem>
                        ))}
                      </MenuPopup>
                    </Menu>
                  ),
                  search: (
                    <ToolbarSearchField
                      aria-label="Search"
                      className="mac-finder-search"
                      inputRef={searchInput}
                      value={tab.query}
                      onValueChange={(query) => {
                        setSuggesting(0);
                        dispatch({ type: "query", query, origin: folderOf(root, tab) });
                        // A search that begins looks where Preferences says.
                        if (driveMode && !searching && query !== "") {
                          dispatch({ type: "scope", scope: searchScope });
                        }
                      }}
                      onBlur={() => setSuggesting(null)}
                      // A search field keeps its role, as every search of the window does: it names
                      // its list and the row the arrow keys are on, with the keyboard staying in it.
                      {...(driveMode
                        ? {
                            "aria-autocomplete": "list" as const,
                            "aria-controls": suggestionsShown ? suggestionsId : undefined,
                            "aria-activedescendant": suggestionsShown
                              ? `${suggestionsId}-${suggesting}`
                              : undefined,
                          }
                        : {})}
                      onKeyDown={(event) => {
                        if (suggesting === null || suggestions.length === 0) return;
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          const step = event.key === "ArrowDown" ? 1 : -1;
                          setSuggesting(
                            (suggesting + step + suggestions.length) % suggestions.length,
                          );
                        } else if (event.key === "Enter") {
                          const picked = suggestions[suggesting];
                          if (!picked) return;
                          event.preventDefault();
                          pickSuggestion(picked);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setSuggesting(null);
                        }
                      }}
                    />
                  ),
                  path: (
                    <ToolbarPullDown
                      aria-label="Path"
                      className="mac-finder-menu-button"
                      image={TOOLBAR_GLYPHS.path}
                    >
                      {[...pathEntries].reverse().map(({ path, node }) => (
                        <MenuItem
                          key={path}
                          disabled={!isContainer(node)}
                          onClick={() => navigate(path)}
                        >
                          {node.name}
                        </MenuItem>
                      ))}
                    </ToolbarPullDown>
                  ),
                  eject: (
                    <ToolbarButton
                      aria-label="Eject"
                      className="mac-finder-item-button"
                      disabled
                      title="This drive has no disks to eject."
                    >
                      {TOOLBAR_GLYPHS.eject}
                    </ToolbarButton>
                  ),
                  burn: (
                    <ToolbarButton
                      aria-label="Burn"
                      className="mac-finder-item-button"
                      disabled
                      title="A web page has no disc to burn."
                    >
                      {TOOLBAR_GLYPHS.burn}
                    </ToolbarButton>
                  ),
                  "new-folder": (
                    <ToolbarButton
                      aria-label="New Folder"
                      className="mac-finder-item-button"
                      disabled={!folderShown || (driveMode && idAt(folderShown) === undefined)}
                      onClick={newFolder}
                    >
                      {TOOLBAR_GLYPHS["new-folder"]}
                    </ToolbarButton>
                  ),
                  delete: (
                    <ToolbarButton
                      aria-label="Delete"
                      className="mac-finder-item-button"
                      disabled={!menuCommands.trash.enabled}
                      onClick={menuCommands.trash.run}
                    >
                      {TOOLBAR_GLYPHS.delete}
                    </ToolbarButton>
                  ),
                  connect: (
                    <ToolbarButton
                      aria-label="Connect"
                      className="mac-finder-item-button"
                      onClick={() => setConnecting(true)}
                    >
                      {TOOLBAR_GLYPHS.connect}
                    </ToolbarButton>
                  ),
                  "get-info": (
                    <ToolbarButton
                      aria-label="Get Info"
                      className="mac-finder-item-button"
                      disabled={!menuCommands.getInfo.enabled}
                      onClick={menuCommands.getInfo.run}
                    >
                      {TOOLBAR_GLYPHS["get-info"]}
                    </ToolbarButton>
                  ),
                  "quick-look": (
                    <ToolbarButton
                      aria-label="Quick Look"
                      className="mac-finder-item-button"
                      disabled={!menuCommands.quickLook.enabled}
                      onClick={menuCommands.quickLook.run}
                    >
                      {TOOLBAR_GLYPHS["quick-look"]}
                    </ToolbarButton>
                  ),
                },
                <ToolbarSpace width={sidebarShown ? Math.max(sidebarSize - 69, 0) : 0} />,
                customizing,
              )}
            </ContextualMenuTrigger>
            <ContextualMenuPopup>
              <FinderToolbarMenuRows
                mode={toolbarMode}
                onModeChange={setToolbarMode}
                onCustomize={() => setCustomizing(true)}
              />
            </ContextualMenuPopup>
          </ContextualMenu>
        ) : null}
      </TitleBar>
      {tabsShown && (
        <ContextualMenu>
          <ContextualMenuTrigger
            onContextMenuCapture={(event) => {
              const hit = (event.target as Element).closest<HTMLElement>("[data-tab-id]");
              setTabMenu(hit ? Number(hit.dataset.tabId) : null);
            }}
            render={
              <WindowTabBar
                aria-label="Tabs"
                value={String(tab.id)}
                onValueChange={(value) => dispatch({ type: "activate-tab", id: Number(value) })}
                onNewTab={() => dispatch({ type: "new-tab", location: place })}
              >
                {state.tabs.map((item) => (
                  <WindowTab
                    key={item.id}
                    id={tabId(item.id)}
                    value={String(item.id)}
                    data-tab-id={item.id}
                    onPointerDown={(event) => dragTab(event, item.id)}
                    onClose={() => dispatch({ type: "close-tab", id: item.id })}
                  >
                    {titleOf(root, item)}
                  </WindowTab>
                ))}
              </WindowTabBar>
            }
          />
          <ContextualMenuPopup>
            <MenuItem
              disabled={tabMenu === null || state.tabs.length < 2}
              onClick={() => {
                if (tabMenu !== null) dispatch({ type: "close-tab", id: tabMenu });
              }}
            >
              Close Tab
            </MenuItem>
            <MenuItem
              disabled={tabMenu === null || state.tabs.length < 2}
              onClick={() => {
                for (const each of state.tabs) {
                  if (each.id !== tabMenu) dispatch({ type: "close-tab", id: each.id });
                }
              }}
            >
              Close Other Tabs
            </MenuItem>
            <MenuItem
              disabled={tabMenu === null || state.tabs.length < 2 || !desktopHost}
              onClick={() => {
                if (tabMenu !== null) moveTabOut(tabMenu);
              }}
            >
              Move Tab to New Window
            </MenuItem>
          </ContextualMenuPopup>
        </ContextualMenu>
      )}
      <ContextualMenu>
        <ContextualMenuTrigger
          render={
            <WindowBody background="content" className="mac-finder-body" inert={customizing} />
          }
          onContextMenuCapture={(event) => {
            // A text field keeps the browser's own menu.
            if (isTextEntry(event.target)) {
              event.stopPropagation();
              return;
            }
            setContextTarget(contextTargetAt(event.target as Element));
          }}
        >
          <SplitView className="mac-finder-split">
            {allTabs ? (
              <div className="mac-finder-all-tabs">
                {state.tabs.map((item) => {
                  const shown = resolve(root, placeOf(root, item));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="mac-finder-all-tabs-tab"
                      data-active={item.id === tab.id ? "" : undefined}
                      onClick={() => {
                        dispatch({ type: "activate-tab", id: item.id });
                        setAllTabs(false);
                      }}
                    >
                      {shown ? <ItemIcon node={shown} size={64} /> : null}
                      {titleOf(root, item)}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {sidebarShown ? (
              <>
                <SplitViewPane
                  size={sidebarSize}
                  onSizeChange={setSidebarSize}
                  minSize={120}
                  maxSize={320}
                >
                  <Sidebar
                    aria-label="Sidebar"
                    className="mac-finder-sidebar"
                    style={SIDEBAR_STYLE}
                    material={material}
                    value={sidebarValue}
                    onValueChange={(value) => {
                      if (value.startsWith("saved:")) return runSaved(value);
                      const file = favoritePlaces.find(
                        ({ path, node }) => path === value && !isContainer(node),
                      );
                      if (file) open({ path: value, node: file.node });
                      else navigate(value);
                    }}
                  >
                    <SidebarSection data-finder-favorites="" {...sectionProps("Favorites")}>
                      {favoriteRows.map(({ key, row }) => (
                        <Fragment key={key}>{row}</Fragment>
                      ))}
                    </SidebarSection>
                    {resolve(root, ICLOUD) && (
                      <SidebarSection title="iCloud">
                        <SidebarItem
                          value={ICLOUD}
                          label="iCloud Drive"
                          icon={<SidebarGlyph name="cloud" />}
                        />
                      </SidebarSection>
                    )}
                    <SidebarSection {...sectionProps("Locations")}>
                      {listing(root, "/Volumes").map((volume) => (
                        <SidebarItem
                          key={volume.path}
                          value={volume.path}
                          label={volume.node.name}
                          icon={<SidebarGlyph name="disk" />}
                        />
                      ))}
                      {driveMode && disksInSidebar ? (
                        <SidebarItem
                          value="/"
                          label={root.name}
                          icon={<SidebarGlyph name="disk" />}
                        />
                      ) : null}
                      {shownPlace(COMPUTER_NAME) ? (
                        <SidebarItem
                          value={COMPUTER}
                          label={COMPUTER_NAME}
                          icon={<SidebarGlyph name="computer" />}
                        />
                      ) : null}
                      {resolve(root, NETWORK) && (
                        <SidebarItem
                          value={NETWORK}
                          label="Network"
                          icon={<SidebarGlyph name="network" />}
                        />
                      )}
                    </SidebarSection>
                    {shownPlace(RECENT_TAGS) ? (
                      <SidebarSection {...sectionProps("Tags")}>
                        {TAGS.filter(({ name }) => !driveMode || !hiddenTags.includes(name)).map(
                          ({ name, color }) => (
                            <SidebarItem
                              key={name}
                              value={tagLocation(name)}
                              label={name}
                              icon={<TagDot color={color} />}
                            />
                          ),
                        )}
                        <SidebarItem
                          value={ALL_TAGS}
                          label="All Tags…"
                          icon={<TagDot color="all" />}
                        />
                      </SidebarSection>
                    ) : null}
                  </Sidebar>
                </SplitViewPane>
                <SplitViewDivider aria-label="Resize sidebar" />
              </>
            ) : null}
            <SplitViewPane
              className="mac-finder-content"
              {...(tabsShown ? { role: "tabpanel", "aria-labelledby": tabId(tab.id) } : undefined)}
            >
              {suggestionsShown ? (
                <FinderSearchSuggestions
                  id={suggestionsId}
                  suggestions={suggestions}
                  active={suggesting}
                  onPick={pickSuggestion}
                />
              ) : null}
              {!searching && placeNode?.shared && <WindowBanner>Shared Folder</WindowBanner>}
              {!searching && location === TRASH && (
                <WindowBanner
                  trailing={
                    <WindowBannerAction disabled={trashed === 0} onClick={askEmptyTrash}>
                      Empty
                    </WindowBannerAction>
                  }
                >
                  Trash
                </WindowBanner>
              )}
              {searching && (contentHits.incomplete || rowHits.incomplete) && (
                <WindowBanner>
                  The file index is still reading: search again for text files it has not reached.
                </WindowBanner>
              )}
              {searching && (contentHits.failed || rowHits.failed) && (
                <WindowBanner>
                  The file index could not answer this search, so what depends on the words inside
                  files is not shown.
                </WindowBanner>
              )}
              {searching && Math.max(contentHits.unsearched, rowHits.unsearched) > 0 && (
                <WindowBanner>
                  {`The words of ${Math.max(contentHits.unsearched, rowHits.unsearched)} text files were not searched: the index reads a limited number. Their names were.`}
                </WindowBanner>
              )}
              {searching && (
                <ScopeBar>
                  <ScopeBarLabel>Search:</ScopeBarLabel>
                  <ScopeBarGroup
                    aria-label="Search"
                    value={scope}
                    onValueChange={(value) =>
                      dispatch({ type: "scope", scope: value as FinderScope })
                    }
                  >
                    <ScopeBarButton value="mac">This Mac</ScopeBarButton>
                    {tab.origin !== null && (
                      <ScopeBarButton value="folder">
                        “{locationName(root, tab.origin)}”
                      </ScopeBarButton>
                    )}
                  </ScopeBarGroup>
                  <ScopeBarActions>
                    <ScopeBarAction onClick={saveSearch}>Save</ScopeBarAction>
                    <ScopeBarAction
                      glyph="plus"
                      aria-label="Add search criterion"
                      onClick={() =>
                        dispatch({
                          type: "rows",
                          rows: [...tab.rows, newCriterion()],
                          origin: tab.origin,
                        })
                      }
                    />
                  </ScopeBarActions>
                </ScopeBar>
              )}
              {searching &&
                tab.rows.map((row, index) => (
                  <FinderCriterionRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: a row has no identity of its own
                    key={index}
                    row={row}
                    contentsOffered={
                      driveMode &&
                      (row.field === "contents" ||
                        !tab.rows.some((each) => each.field === "contents"))
                    }
                    onChange={(next) =>
                      dispatch({
                        type: "rows",
                        rows: tab.rows.map((each, at) => (at === index ? next : each)),
                        origin: tab.origin,
                      })
                    }
                    onRemove={() =>
                      dispatch({
                        type: "rows",
                        rows: tab.rows.filter((_, at) => at !== index),
                        origin: tab.origin,
                      })
                    }
                    onAdd={() =>
                      dispatch({
                        type: "rows",
                        rows: [
                          ...tab.rows.slice(0, index + 1),
                          newCriterion(),
                          ...tab.rows.slice(index + 1),
                        ],
                        origin: tab.origin,
                      })
                    }
                  />
                ))}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for files dragged in from the computer; from the keyboard, Upload Files… in the Action menu does the same. */}
              <div
                ref={mainRef}
                className="mac-finder-main"
                onPointerDownCapture={(event) => {
                  clearTimeout(slowTimer.current);
                  slowPress.current = { x: event.clientX, y: event.clientY, selected: selection };
                }}
                onDoubleClickCapture={() => clearTimeout(slowTimer.current)}
                onClickCapture={(event) => {
                  const press = slowPress.current;
                  const hit = event.target;
                  if (
                    !press ||
                    event.detail !== 1 ||
                    !renamable ||
                    !isItemName(hit) ||
                    Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4
                  ) {
                    return;
                  }
                  const pressed = hit instanceof Element ? drag.itemAt(hit)?.path : undefined;
                  if (pressed === undefined || press.selected.length !== 1) return;
                  if (press.selected[0] !== pressed) return;
                  const id = driveSelection[0]?.id ?? null;
                  slowTimer.current = setTimeout(() => {
                    const now = latestSelection.current;
                    if (now.length === 1 && now[0] === pressed) setRenaming(id);
                  }, SLOW_RENAME_MS);
                }}
                onDragOver={(event) => {
                  // Files dragged in from the computer upload into the folder shown, and words or a
                  // link dragged from a window leave a file there.
                  const { types } = event.dataTransfer;
                  if (
                    !driveMode ||
                    !folderShown ||
                    !(types.includes("Files") || carriesClipping(types))
                  ) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  if (!driveMode || !folderShown) return;
                  const { dataTransfer } = event;
                  const files = dataTransfer.files.length
                    ? [...dataTransfer.files]
                    : [clippingFile((type) => dataTransfer.getData(type))].flatMap((file) =>
                        file ? [file] : [],
                      );
                  if (files.length === 0) return;
                  event.preventDefault();
                  // Into the folder let go on, or else the folder shown.
                  const under = event.target instanceof Element && drag.itemAt(event.target);
                  const node = under ? resolve(root, under.path) : undefined;
                  void upload(files, under && node && isContainer(node) ? under.path : folderShown);
                }}
              >
                {dropNotice && (
                  <p role="status" className="mac-finder-drop-notice">
                    {dropNotice}
                  </p>
                )}
                {renaming !== null && renamingPath !== undefined && renamingNode ? (
                  <FinderRenameField
                    key={renaming}
                    name={renamingNode.name}
                    folder={isContainer(renamingNode)}
                    container={mainRef.current}
                    locate={() => {
                      const rows = mainRef.current?.querySelectorAll(
                        '[role="option"], [role="row"]',
                      );
                      const own = [...(rows ?? [])].filter(
                        (row) => drag.itemAt(row)?.path === renamingPath,
                      );
                      const row =
                        own.find((each) => each.getAttribute("aria-selected") === "true") ?? own[0];
                      return row ? nameElementOf(row) : null;
                    }}
                    onRename={(name, keyboard) => rename(renaming, renamingPath, name, keyboard)}
                    onClose={(keyboard) => {
                      setRenaming(null);
                      if (!keyboard) return;
                      // Back on the window, and then on the item if its view takes the keyboard,
                      // so that Return and the arrow keys go on working without a click.
                      windowElement.current?.focus({ preventScroll: true });
                      mainRef.current
                        ?.querySelector<HTMLElement>(
                          '[role="option"][aria-selected="true"], [role="row"][aria-selected="true"]',
                        )
                        ?.focus({ preventScroll: true });
                    }}
                  />
                ) : null}
                {driveMode && (
                  <input
                    ref={uploadInput}
                    type="file"
                    multiple
                    hidden
                    aria-label="Upload Files"
                    onChange={(event) => {
                      const files = [...(event.currentTarget.files ?? [])];
                      event.currentTarget.value = "";
                      if (folderShown) void upload(files, folderShown);
                    }}
                  />
                )}
                {location === AIRDROP && !searching ? (
                  <EmptyState>
                    <span>No People Found</span>
                    <br />
                    <span>{AIRDROP_REASON}</span>
                  </EmptyState>
                ) : tab.view === "icons" ? (
                  <IconsView
                    {...viewProps}
                    groups={viewGroups}
                    iconSize={iconSize}
                    grid={viewOptions.grid}
                    textSize={viewOptions.text}
                    background={viewOptions.background}
                    showInfo={viewOptions.itemInfo}
                    iconPreview={viewOptions.iconPreview}
                  />
                ) : tab.view === "list" ? (
                  <ListingView {...listProps} />
                ) : tab.view === "columns" && !searching ? (
                  <ColumnsView
                    label={title}
                    entries={entries}
                    onOpen={open}
                    root={root}
                    sort={sort}
                    columns={openColumns(root, tab)}
                    selection={selection}
                    onColumnsChange={(columns, several) =>
                      dispatch({
                        type: "columns",
                        columns,
                        ...(several ? { selection: several } : {}),
                      })
                    }
                    onConnect={(path) => commit(connected(root, path))}
                    onShareScreen={onShareScreen}
                    textSize={viewOptions.text}
                    showIcons={viewOptions.showIcons}
                    showPreview={viewOptions.previewColumn}
                  />
                ) : tab.view === "columns" ? (
                  // Finder lists search results in a flat list where column view has no columns.
                  <ListingView {...listProps} />
                ) : (
                  <Gallery
                    {...viewProps}
                    onTagsChange={retag}
                    onRotate={turn}
                    onMarkup={() => {
                      if (looked === undefined) toggleLook();
                    }}
                    showPreview={previewShown}
                    thumbnail={viewOptions.thumbnail}
                  />
                )}
              </div>
              {(pathBar || searching) && (
                <PathBar aria-label="Path">
                  {pathEntries.map(({ path, node }, index) => (
                    <PathBarItem
                      key={path}
                      data-finder-path={path}
                      icon={<ItemIcon node={node} size={16} />}
                      current={index === pathEntries.length - 1}
                      onActivate={isContainer(node) ? () => navigate(path) : undefined}
                    >
                      {node.name}
                    </PathBarItem>
                  ))}
                </PathBar>
              )}
              {statusBar && (
                <StatusBar
                  trailing={
                    tab.view === "icons" ? (
                      <Slider
                        aria-label="Icon size"
                        className="mac-finder-icon-size"
                        size="small"
                        min={32}
                        max={160}
                        step={16}
                        value={iconSize}
                        onValueChange={(value) => setIconSize(value as number)}
                      />
                    ) : undefined
                  }
                >
                  {statusText(population, selection.length, root.available)}
                </StatusBar>
              )}
            </SplitViewPane>
          </SplitView>
        </ContextualMenuTrigger>
        <ContextualMenuPopup finalFocus={returnFocus}>
          <FinderContextRows target={contextTarget} context={contextCommands} />
        </ContextualMenuPopup>
      </ContextualMenu>
    </Window>
  );

  // Quick Look is as large as fits over this window, up to 760 pt wide. A panel is the key
  // window only while this window's host has the Finder as the key application window: a host
  // that makes the window inactive takes the key state from its panels with it.
  const look = frames["quick-look"];
  const lookWidth = Math.min(Math.max(look.width - 96, 320), 760);
  const keyPanel = windowState === "key" && !modal ? key : null;
  /** The focus has come into a window beside this one: the host hears of it as of its own. */
  const focusAside = (to: Aside) => (event: FocusEvent<HTMLDivElement>) => {
    onFocusCapture?.(event);
    setFront(null);
    setAside(to);
  };
  const totalBytes = copy ? copy.items.reduce((sum, item) => sum + sizeOf(item.node), 0) : 0;
  return (
    <>
      {main}
      <FinderDeleteNow
        subject={
          deleting === 0
            ? null
            : deleting === 1
              ? `“${onlySelected?.name}”`
              : `these ${deleting} items`
        }
        onOpenChange={(open) => {
          if (!open) setDeleting(0);
        }}
        onDelete={deleteSelection}
        finalFocus={returnFocus}
      />
      <FinderEmptyTrash
        open={emptying}
        onOpenChange={setEmptying}
        onEmpty={emptyTrash}
        finalFocus={returnFocus}
      />
      <FinderSaveSearch
        open={namingSearch}
        onOpenChange={setNamingSearch}
        onSave={(name, addToSidebar) => {
          const kept = withSearch(saved, {
            name,
            ...searchAsIs,
            ...(addToSidebar ? null : { sidebar: false as const }),
          });
          if (kept) setSaved(kept);
          else setFailure(tooLongToKeep);
          return kept !== null;
        }}
      />
      <FinderCustomizeToolbar
        open={customizing}
        onOpenChange={setCustomizing}
        items={toolbarOrder}
        onItemsChange={setToolbarOrder}
        mode={toolbarMode}
        onModeChange={setToolbarMode}
        finalFocus={returnFocus}
      />
      <FinderGoToFolder
        open={going}
        onOpenChange={setGoing}
        folders={folders}
        onGo={goTo}
        finalFocus={returnFocus}
      />
      <FinderConnectToServer
        open={connecting}
        onOpenChange={setConnecting}
        servers={(resolve(root, NETWORK)?.children ?? []).map((node) => serverAddress(node.name))}
        defaultAddress={address}
        favorites={favorites}
        onFavoritesChange={setFavorites}
        onConnect={connectTo}
        onBrowse={() => navigate(resolve(root, NETWORK) ? NETWORK : COMPUTER)}
        onHelp={onHelp}
        unreachableReason={unreachableReason}
        onFocusCapture={focusAside("connect")}
        state={aside === "connect" && windowState === "key" && !modal ? "key" : "inactive"}
        finalFocus={returnFocus}
      />
      <FinderConnectionFailed
        address={unreachable}
        reason={unreachableReason}
        onClose={() => setUnreachable(null)}
        finalFocus={returnFocus}
      />
      <FinderReplace
        item={copy?.conflicts[0] ?? null}
        moving={copy?.moves}
        onKeepBoth={() => settle(false)}
        onStop={() => setCopy(null)}
        onReplace={() => settle(true)}
        finalFocus={returnFocus}
      />
      <FinderRenameItems
        items={renamingMany}
        onRename={(changes) => {
          void undoable(
            "Rename",
            changes.map(({ id, name }) => ({ op: "rename" as const, id, name })),
          );
        }}
        onClose={() => setRenamingMany([])}
        finalFocus={returnFocus}
      />
      <FinderExtensionWarning
        change={extensionChange}
        onKeep={() => setExtensionChange(null)}
        onUse={() => {
          if (extensionChange) {
            const { id, path, name, keyboard } = extensionChange;
            applyRename(id, path, name, keyboard);
          }
          setExtensionChange(null);
        }}
        finalFocus={returnFocus}
      />
      <FinderDriveAlert
        message={failure}
        onClose={() => setFailure(null)}
        finalFocus={returnFocus}
      />
      {(copy && copying && !driveMode) || notices.length > 0 || transfer
        ? createPortal(
            <div className="mac-finder-floating">
              {transfer && (
                <FinderCopyProgress
                  verb={transfer.verb}
                  items={transfer.items}
                  destination={transfer.destination}
                  copied={transfer.done}
                  total={transfer.total}
                  remaining={timeLeft(transfer)}
                  state={aside === "copy" && windowState === "key" && !modal ? "key" : "inactive"}
                  tabIndex={-1}
                  onFocusCapture={focusAside("copy")}
                  onStop={() => transfer.controller.abort()}
                />
              )}
              {copy && copying && !driveMode && (
                <FinderCopyProgress
                  items={copy.items.map((item) => item.node)}
                  destination={locationName(root, copy.destination)}
                  copied={(totalBytes * Math.min(copy.step, COPY_STEPS)) / COPY_STEPS}
                  total={totalBytes}
                  remaining={((COPY_STEPS - copy.step) * COPY_STEP_MS) / 1000}
                  state={aside === "copy" && windowState === "key" && !modal ? "key" : "inactive"}
                  tabIndex={-1}
                  onFocusCapture={focusAside("copy")}
                  onStop={endCopy}
                />
              )}
              {notices.length > 0 && (
                <div className="mac-finder-notices">
                  {notices.map((disk) => (
                    <FinderEjectWarning
                      key={disk}
                      disk={disk}
                      onDismiss={() => setNotices(notices.filter((name) => name !== disk))}
                    />
                  ))}
                </div>
              )}
            </div>,
            panelContainer ?? document.body,
          )
        : null}
      {slides ? (
        <FinderSlideshow
          entries={slides}
          container={
            windowElement.current?.closest<HTMLElement>(".mac-desktop-shell") ??
            panelContainer ??
            document.body
          }
          onClose={() => setSlides(null)}
        />
      ) : null}
      {DesktopWindow && clipboardOpen ? (
        <DesktopWindow
          id="clipboard"
          title="Clipboard"
          defaultSize={{ width: 360, height: 240 }}
          minSize={{ width: 240, height: 120 }}
          panel
          onClose={() => setClipboardOpen(false)}
          render={({
            onClose: close,
            onMinimize: _minimize,
            onZoom: _zoom,
            zoomRole: _role,
            minimizeDisabled: _noMinimize,
            zoomDisabled: _noZoom,
            onDragRegionPointerDown: _drag,
            onDragRegionDoubleClick: _zoomFromBar,
            ...panelProps
          }) => <FinderClipboard {...panelProps} onClose={close} />}
        />
      ) : null}
      {DesktopWindow && viewOptionsOpen ? (
        <DesktopWindow
          id="view-options"
          title="View Options"
          defaultSize={{ width: 260, height: 420 }}
          resizable={false}
          fitsContent
          panel
          onClose={() => {
            setViewOptionsOpen(false);
            windowElement.current?.focus({ preventScroll: true });
          }}
          render={({
            onClose: close,
            onMinimize: _minimize,
            onZoom: _zoom,
            zoomRole: _role,
            minimizeDisabled: _noMinimize,
            zoomDisabled: _noZoom,
            onDragRegionDoubleClick: _zoomFromBar,
            variant: _variant,
            fullScreen: _fullScreen,
            height: _height,
            ...panelProps
          }) => (
            <FinderViewOptions
              {...panelProps}
              folder={title}
              view={tab.view}
              sorts={SORTS}
              settings={viewOptions}
              alwaysOpens={folderOwn?.view === tab.view}
              iconSize={iconSize}
              sortColumn={sort.column}
              previewShown={previewShown}
              onPreviewChange={setPreviewShown}
              onKeep={keepForFolder}
              onUseAsDefaults={() =>
                setFolderDefaults({ ...viewOptions, view: tab.view, sort, icon: iconSize })
              }
              onClose={close}
            />
          )}
        />
      ) : null}
      {manyInfoWindow("inspector-many", inspectedMany, () => setInspecting(false))}
      {manyInfoWindow("info-many", summaryPaths, () => setInfoMany(null))}
      {DesktopWindow && infoPath !== null ? (
        <DesktopWindow
          key={inspecting ? "inspector" : infoPath}
          panel={inspecting}
          id="info"
          title={`${resolve(root, infoPath)?.name ?? ""} Info`}
          defaultSize={{ width: 265, height: 560 }}
          resizable={false}
          fitsContent
          dragRegion="[data-window-drag-region]"
          onClose={() => closePanel("info")}
          render={({
            onClose: close,
            onMinimize: _minimize,
            onZoom: _zoom,
            zoomRole: _role,
            minimizeDisabled: _noMinimize,
            zoomDisabled: _noZoom,
            onDragRegionPointerDown: _move,
            onDragRegionDoubleClick: _zoomFromBar,
            variant: _variant,
            fullScreen: _fullScreen,
            height: _height,
            ...panelProps
          }) => (
            <FinderInfo
              {...panelProps}
              key={infoPath}
              root={root}
              path={infoPath}
              host={infoHost}
              onTagsChange={retag}
              {...infoOnDrive}
              {...openersOf(infoPath)}
              onClose={close}
            />
          )}
        />
      ) : null}
      {DesktopWindow && looked !== undefined ? (
        <DesktopWindow
          id="quick-look"
          title="Quick Look"
          defaultSize={{ width: 760, height: 520 }}
          minSize={{ width: 320, height: 240 }}
          zoomButton="zoom"
          panel
          dragRegion=".mac-quick-look-panel-bar"
          onClose={() => closePanel("quick-look")}
          render={({
            onClose: close,
            onMinimize: _minimize,
            onZoom: _zoom,
            zoomRole: _role,
            minimizeDisabled: _noMinimize,
            zoomDisabled: _noZoom,
            onDragRegionPointerDown: _move,
            onDragRegionDoubleClick: _zoomFromBar,
            variant: _variant,
            fullScreen: _fullScreen,
            ...panelProps
          }) => (
            <FinderQuickLook
              {...panelProps}
              onKeyDown={closeLookOnSpace}
              root={root}
              path={looked}
              onRotate={turn}
              onOpen={onOpen ?? openLookedInApp}
              onShare={onShare}
              shareItems={lookedShareItems}
              file={driveMode ? lookedFile : undefined}
              onDownload={download1}
              onSaveMarks={driveMode ? saveMarks : undefined}
              onFullScreen={startSlideshow}
              onClose={close}
            />
          )}
        />
      ) : null}
      {!DesktopWindow && stack && (infoPath !== null || looked !== undefined)
        ? createPortal(
            <div ref={group} className="mac-finder-panels" style={{ zIndex: stack.level }}>
              {infoPath !== null && (
                <FinderInfo
                  key={infoPath}
                  ref={(element) => {
                    panelElements.current.info = element;
                  }}
                  root={root}
                  path={infoPath}
                  host={infoHost}
                  state={keyPanel === "info" ? "key" : "inactive"}
                  tabIndex={-1}
                  style={{
                    position: "absolute",
                    zIndex: key === "info" ? 2 : 1,
                    left: frames.info.left + 24,
                    top: frames.info.top + 24,
                  }}
                  onFocusCapture={(event) => {
                    // The host hears of the focus in a panel as of the focus in the window.
                    onFocusCapture?.(event);
                    setFront("info");
                  }}
                  onTagsChange={retag}
                  {...infoOnDrive}
                  {...openersOf(infoPath)}
                  onClose={() => closePanel("info")}
                />
              )}
              {looked !== undefined && (
                <FinderQuickLook
                  ref={(element) => {
                    panelElements.current["quick-look"] = element;
                  }}
                  root={root}
                  path={looked}
                  state={keyPanel === "quick-look" ? "key" : "inactive"}
                  tabIndex={-1}
                  onKeyDown={closeLookOnSpace}
                  width={lookWidth}
                  height={Math.max(look.height - 96, 240)}
                  style={{
                    position: "absolute",
                    zIndex: key === "quick-look" ? 2 : 1,
                    left: look.left + (look.width - lookWidth) / 2,
                    top: look.top + 48,
                  }}
                  onFocusCapture={(event) => {
                    onFocusCapture?.(event);
                    setFront("quick-look");
                  }}
                  onRotate={turn}
                  onOpen={onOpen ?? openLookedInApp}
                  onShare={onShare}
                  shareItems={lookedShareItems}
                  file={driveMode ? lookedFile : undefined}
                  onDownload={download1}
                  onSaveMarks={driveMode ? saveMarks : undefined}
                  onClose={() => closePanel("quick-look")}
                />
              )}
            </div>,
            stack.host,
          )
        : null}
    </>
  );
}

/** The icon of a place that is not an item of the tree, such as Recents. */
const FOLDER_NODE: FinderNode = { name: "", kind: "folder" };
