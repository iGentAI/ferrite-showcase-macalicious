"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PictureInPicture } from "macalicious/picture-in-picture";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SafariNewTabButton, SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Sidebar, SidebarItem } from "macalicious/sidebar";
import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import {
  WebView,
  WebViewError,
  WebViewFavorite,
  WebViewFavorites,
  WebViewProgress,
  WebViewReader,
  WebViewReaderTitle,
  WebViewTabOverview,
  WebViewTabThumbnail,
} from "macalicious/web-view";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { type DesktopDragItem, useDesktopDrop } from "../desktop/desktop-drag";
import { EditRows } from "../desktop/desktop-edit-rows";
import { readFile, SPECIAL_FOLDER_IDS } from "../desktop/desktop-files";
import { requestHelp } from "../desktop/desktop-help";
import { onOpenUrlRequest, takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { readBoolean, readNumber, useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import { reportSelection } from "../desktop/desktop-services";
import {
  copyText,
  LinkShareItems,
  onSharedLink,
  type SharedLink,
  takeSharedLinks,
} from "../desktop/desktop-share-link";
import { lookUp } from "../dictionary/dictionary-desktop";
import {
  DriveOpenPanel,
  DriveSavePanel,
  type DriveSaveTarget,
  saveToDrive,
} from "../finder/finder-file-dialogs";
import { onOpenFileRequest, openFile, takeOpenFileRequests } from "../finder/finder-open";
import {
  freeFolderName,
  movedLink,
  SafariAddBookmarkSheet,
  type SafariBookmarkPlace,
  type SafariLinkList,
  type SafariLinkTarget,
  SafariRenameSheet,
} from "./safari-bookmarks";
import { linksAt, rowMovedTo } from "./safari-bookmarks-model";
import { SafariBookmarksPage } from "./safari-bookmarks-page";
import {
  readDownloads,
  type SafariDownloadEntry,
  SafariDownloadsButton,
  SafariDownloadsContext,
  withDownload,
} from "./safari-downloads";
import {
  acceptLinkDrag,
  acceptTextDrag,
  droppedLink,
  droppedText,
  LINK_TITLE_TYPE,
} from "./safari-drop";
import {
  addressOfLinkFile,
  bookmarksFromHtml,
  bookmarksToHtml,
  filePageAddress,
  filePageOf,
  filePageText,
  isFilePage,
  isLinkFile,
  isPageFile,
  localFilePage,
  pageFileName,
} from "./safari-files";
import {
  findRanges,
  lightMatches,
  nextMatch,
  type SafariFind,
  SafariFindBanner,
} from "./safari-find";
import {
  BookGlyph,
  ChevronGlyph,
  FolderGlyph,
  GlassesGlyph,
  GlobeGlyph,
  ServiceIcon,
  ShareRowGlyph,
  SidebarGlyph,
  StarGlyph,
  TabOverviewGlyph,
} from "./safari-glyphs";
import {
  copyImage,
  imageFile,
  readPageHit,
  type SafariPageHit,
  type SafariPageMenuActions,
  SafariPageMenuItems,
} from "./safari-page-menu";
import {
  addressFor,
  BOOKMARKS,
  DEFAULT_TABS,
  FAVORITES,
  pageAt,
  READING_LIST,
  type SafariBookmark,
  SafariFavoriteArtwork,
  SafariFolderArtwork,
  SafariMiniature,
  SafariPicture,
  SafariSearchPage,
  SafariSitePage,
  SafariVideoFrame,
  START_PAGE,
} from "./safari-pages";
import {
  READER_FONTS,
  READER_OPTIONS,
  readReaderOptions,
  SafariReaderOptions,
} from "./safari-reader";
import { pressedRows } from "./safari-rows";
import {
  AUTO_READER,
  COMMAND_CLICK,
  choiceOf,
  EMPTY_PAGE,
  ENGINE_SUGGESTIONS,
  FIELD_FAVORITES,
  FULL_ADDRESS,
  isSafeFile,
  keptDownloadRows,
  MAKE_ACTIVE,
  newPageAddress,
  optionOf,
  SAFE_FILES,
  safariSettingsNow,
  staleVisits,
  TAB_KEYS,
  useSafariSettings,
} from "./safari-settings";
import { SafariSuggestions, snapBackIndex, suggestionsFor } from "./safari-suggest";
import {
  adoptKeptTabs,
  asksForSuggestions,
  BOOKMARKS_PAGE,
  clearHistory,
  clearRangeStart,
  type DownloadResult,
  downloadToDownloads,
  forgetHistory,
  frequentlyVisited,
  HISTORY_PAGE,
  hostOf,
  isWebAddress,
  keptAddress,
  keptPages,
  loadHistory,
  loadSites,
  loadSuggestions,
  moveTab,
  openFilePage,
  openWebPage,
  readFolders,
  readKeptPages,
  readLinks,
  readSaved,
  rememberOutside,
  SafariClearHistorySheet,
  SafariFailurePage,
  SafariFavoritesBar,
  SafariFetchedPage,
  SafariHistoryPage,
  SafariOutsidePage,
  SafariWebReader,
  SafariWebStart,
  SEARCH,
  saveToDownloads,
  searchAddress,
  visitsByDay,
  type WebFolder,
  type WebLink,
  type WebSaved,
  type WebState,
  type WebVisit,
  webAddressFor,
  webTitle,
} from "./safari-web";
import {
  claimTabs,
  forgetPin,
  frontSafariPage,
  hasClosedWindow,
  hasLastSession,
  hasOpenWindow,
  type LiveSafariWindow,
  mergeWindows,
  newPinKey,
  noteFrontPage,
  openSafariWindow,
  otherWindows,
  type PinnedTab,
  readSafariOpening,
  reconcilePins,
  registerSafariWindow,
  reopenClosedWindow,
  reopenLastSession,
  safariWindowsVersion,
  subscribeSafariWindows,
  type TabSeed,
  tabsHaveKeeper,
} from "./safari-windows";
import "./safari.tokens.css";
import "./safari.css";

export interface SafariProps extends Omit<WindowProps, "children"> {
  /** What the desktop was asked this window should be: private, or holding tabs given up by another. */
  opening?: unknown;
  /**
   * The addresses of the tabs the window opens with; `""` is the start page. Without the
   * Ferrite desktop app only the demo's own pages open: any address under `.example`.
   * @default the three tabs of the Safari capture; on the Ferrite desktop app, the tabs the
   * person left open, or the start page
   */
  defaultTabs?: readonly string[];
  /**
   * Index of the tab in front at first.
   * @default 1 with the capture's three tabs, else 0
   */
  defaultActiveTab?: number;
  /**
   * Whether the Bookmarks sidebar is shown at first.
   * @default false
   */
  defaultSidebarOpen?: boolean;
  /**
   * Whether the front tab starts in Reader, if its page has an article.
   * @default false
   */
  defaultReader?: boolean;
  /**
   * Whether the window starts in the Tab Overview.
   * @default false
   */
  defaultTabOverview?: boolean;
  /**
   * Whether the front tab's video starts in the Picture in Picture window, if its page has one.
   * @default false
   */
  defaultPictureInPicture?: boolean;
  /**
   * The positioned element the Picture in Picture window floats in: the screen, for a desktop
   * page. `null` means the element is not there yet, and the window waits for it. Without the
   * prop the video floats over the page, inside the Safari window.
   */
  pictureInPictureContainer?: Element | null;
  /**
   * The width the Picture in Picture window opens with, in points.
   * @default 320
   */
  pictureInPictureWidth?: number;
  /**
   * Whether pages, favourites and the video show the demo's generated artwork. `false` shows
   * the placeholder drawings instead, whose colours are tokens: a visual check that samples a
   * picture uses it, so that no generated pixel is compared.
   * @default true
   */
  artwork?: boolean;
  /** Called when the close button is activated. */
  onClose?: (event: MouseEvent<HTMLElement>) => void;
  /** Called when the minimize button is activated. */
  onMinimize?: (event: MouseEvent<HTMLElement>) => void;
  /** Called when the zoom button is activated. */
  onZoom?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * What the zoom button does, which picks its hover glyph: a window manager says
   * `"exit-full-screen"` while the window is in full screen.
   * @default "full-screen"
   */
  zoomRole?: "full-screen" | "zoom" | "exit-full-screen";
  /**
   * Disable the minimize button, as in full screen.
   * @default false
   */
  minimizeDisabled?: boolean;
  /**
   * Disable the zoom button.
   * @default false
   */
  zoomDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the toolbar itself, not on a control
   * in it: a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  /** Called when the toolbar itself is double-clicked. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}

interface Tab {
  id: string;
  /** The addresses the tab has shown, oldest first. */
  history: readonly string[];
  /** Which of them it shows now. */
  index: number;
  reader: boolean;
  /** Whether the tab's page is still "loading": each tab loads on its own. */
  loading: boolean;
  /** Pinned tabs stand first in the bar, small, and stay when other tabs close. */
  pinned?: boolean;
  /** What every window that is not private calls this pinned tab. */
  pinKey?: string;
}

/** `tabs` with the pinned ones first, the same list when they already are. */
function pinnedFirst(tabs: readonly Tab[]): readonly Tab[] {
  const pinned = tabs.filter((tab) => tab.pinned);
  if (tabs.slice(0, pinned.length).every((tab) => tab.pinned)) return tabs;
  return [...pinned, ...tabs.filter((tab) => !tab.pinned)];
}

// The split view's hook for the line beside a sidebar, set to the colour of the captures.
const SIDEBAR_DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-safari-sidebar-divider)",
} as CSSProperties;

// A private window's address field is dark in both appearances.
const PRIVATE_FIELD_STYLE = {
  "--mac-smart-search-field-fill": "var(--mac-safari-private-fill)",
  "--mac-smart-search-field-text": "var(--mac-safari-private-text)",
  "--mac-smart-search-field-placeholder": "var(--mac-safari-private-text)",
} as CSSProperties;

const LOAD_TIME = 600;
const READER_SIZES = [20, 24, 17] as const;
/** The page's zooms, as Safari's steps go; the one chosen is kept with the person's desktop values. */
const PAGE_ZOOMS = [0.5, 0.75, 0.85, 1, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
const PAGE_ZOOM = "safari.pageZoom";
const ALWAYS_TAB_BAR = "safari.alwaysShowTabBar";
const FAVORITES_BAR = "safari.favoritesBarShown";
const STATUS_BAR = "safari.statusBarShown";
const SIDEBAR_SHOWN = "safari.sidebarShown";
const NO_DOWNLOADS: readonly SafariDownloadEntry[] = [];
/** The keys that move a page, as a Mac's do when nothing else has the keyboard. */
const PAGE_SCROLL_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);
/** How long typing rests before the search engine is asked, in milliseconds. */
const SUGGEST_REST_MS = 200;
const NO_SUGGESTIONS: readonly string[] = [];

const addressOfTab = (tab: Tab) => tab.history[tab.index] ?? START_PAGE;
/** How many listed sites a new person's Favorites hold. */
const DEFAULT_FAVORITES = 12;
/** How many opened pages a window keeps for Back and Forward. */
const OPENED_PAGES = 30;

/** The services of the Share menu after its first two rows, in Safari's order. */
const SERVICES = ["Email This Page", "Messages", "AirDrop", "Notes", "Reminders"] as const;
/** Their icons, for the shared link rows on the Ferrite desktop app. */
const SERVICE_IMAGES = {
  mail: <ServiceIcon tint={1} />,
  messages: <ServiceIcon tint={2} />,
  airdrop: <ServiceIcon tint={3} />,
  notes: <ServiceIcon tint={4} />,
  reminders: <ServiceIcon tint={5} />,
};

/** How many closed tabs Reopen Last Closed Tab remembers. */
const CLOSED_TABS = 10;
/** How many recent visits the History menu lists, and Favorites the Bookmarks menu. */
const MENU_VISITS = 10;
/** How long Back or Forward is held before its list opens, in milliseconds. */
const HOLD_MS = 500;
/** How many days of earlier visits the History menu lists, each as a submenu. */
const MENU_DAYS = 7;
const MENU_FAVORITES = 30;
const NO_RICH_PASTE = "Pages here are read-only and the address field takes plain text.";
const NO_PAGE_EDIT = "Safari has nothing selected that it can delete.";
const NO_AUTOFILL = "Safari on Ferrite keeps no contact or password to fill a form with.";
const BROWSER_TEXT = "A browser's own text menu does this in a text field.";
const NO_EDIT_FIELD = "No text field has the keyboard: click in the address field first.";
const NO_SOUND =
  "Pages here make no sound: the server removes their scripts and the addresses of their audio and video.";
const NO_MORE_EXTENSIONS =
  "More… opens the Extensions preferences, and Safari in a browser runs no extensions.";
const NO_WEB_ARCHIVE =
  "A web archive needs the page's own files, and Safari here holds only the page the server made safe.";
const NO_FIND_HERE = "The start page and the Tab Overview have no text to find in.";
const NO_PIN_MOVE = "A pinned tab shows in every window: unpin it to move it.";
const OTHER_BROWSER =
  "A web page cannot read another browser's data. Export its bookmarks as an HTML file and choose Bookmarks HTML File…";
/** The server's limit on bookmark folders (`MAX_FOLDERS`). */
const MAX_BOOKMARK_FOLDERS = 100;

/** Whether the page at an address has a video. */
const hasVideo = (url: string) => {
  const page = pageAt(url);
  return page.kind === "site" && page.site.video === true;
};

/** Whether two addresses are the same page: `https://a.example` and `https://a.example/` are. */
const samePage = (one: string | undefined, other: string) => {
  if (one === undefined) return false;
  try {
    return new URL(one).href === new URL(other).href;
  } catch {
    return one === other;
  }
};

/** A sidebar row's place in the person's library, from what it says of itself. */
const rowPlace = (row: HTMLElement) =>
  row.dataset.linkFolder !== undefined
    ? `folder:${row.dataset.linkFolder}`
    : row.dataset.linkList === "favorites"
      ? "favorites"
      : "bookmarks";

/** Whether a list of the sidebar holds a page, at any depth of its folders. */
const holds = (list: readonly SafariBookmark[], url: string): boolean =>
  list.some((item) => samePage(item.url, url) || (item.children && holds(item.children, url)));

/**
 * The rows of a sidebar list. A row's value is its path, which starts with the list's name,
 * then its address if it is a link.
 */
function bookmarkRows(
  items: readonly SafariBookmark[],
  path: string,
  chosen: readonly string[] = [],
): ReactNode {
  return items.map((item, index) => {
    const at = `${path}${index}`;
    return item.children ? (
      <SidebarItem
        key={at}
        value={at}
        label={item.label}
        icon={item.star ? <StarGlyph /> : <FolderGlyph />}
        defaultExpanded={item.expanded}
        data-drop-place={item.star ? "favorites" : `folder:${item.label}`}
      >
        {bookmarkRows(item.children, `${at}.`, chosen)}
      </SidebarItem>
    ) : (
      <SidebarItem
        key={at}
        value={`${at} ${item.url}`}
        label={item.label}
        icon={<GlobeGlyph />}
        data-link-url={item.url}
        data-link-title={item.label}
        data-link-list={item.list}
        data-link-folder={item.folder}
        data-chosen={item.url && chosen.includes(item.url) ? "" : undefined}
      />
    );
  });
}

/**
 * Catalina's Safari 13 as one window: toolbar with Back and Forward, the sidebar button, the
 * Smart Search field, Share and Tab Overview; a tab bar while more than one tab is open; and a
 * web view that shows the start page, the demo's own placeholder pages, their Reader form or
 * the Tab Overview. Share opens the Share menu, and a page with a video can send it to a
 * Picture in Picture window.
 *
 * The root is the library's `Window` and takes its props (`state`, `width`, `height`, `style`,
 * `ref`, pointer and focus handlers), so a window manager can host it; the window controls and
 * the toolbar, which is this window's drag region, report through the callbacks. The props are
 * the ones a `ManagedWindow` hands to its `render` function.
 */
export function Safari({
  opening: openingProp,
  defaultTabs,
  defaultActiveTab,
  defaultSidebarOpen = false,
  defaultReader = false,
  defaultTabOverview = false,
  defaultPictureInPicture = false,
  pictureInPictureContainer,
  pictureInPictureWidth = 320,
  artwork = true,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1254,
  height = 903,
  className,
  style,
  ...props
}: SafariProps) {
  // Served by the Ferrite desktop app: real pages, and the person's bookmarks, Reading List,
  // history and tabs on the server (safari-web.tsx). Every other build keeps the demo's pages.
  const online = servedByDesktopApp();
  const settings = useSafariSettings();
  const option = (title: string) => optionOf(settings, title, online);
  // Home, and a new tab or window set to Homepage: an unset homepage is the start page.
  const typedHome = typeof settings.homepage === "string" ? settings.homepage.trim() : "";
  const homeAddress = !typedHome
    ? START_PAGE
    : online
      ? webAddressFor(typedHome)
      : addressFor(typedHome);
  // A window opened as private, or holding tabs another window gave up; the first plain window
  // keeps the person's tabs on the server, the others are their own.
  const [opening] = useState(() => readSafariOpening(openingProp));
  // Safari opens with a new private window: the first window, when nothing else was asked of it.
  const [opensPrivate] = useState(
    () =>
      online &&
      !opening &&
      !hasOpenWindow() &&
      choiceOf(safariSettingsNow(), "opens") === "A new private window",
  );
  const isPrivate = opening?.isPrivate ?? opensPrivate;
  // Whether this window keeps the person's tabs: `null` until it has asked, once it is on the list
  // of windows. A window opened with nothing asked of it, while no window keeps them, starts from
  // the kept tabs if it becomes the keeper; a window taking over later keeps the tabs it has.
  const [keepsTabs, setKeepsTabs] = useState<boolean | null>(null);
  const [startsFromKept] = useState(() => !opening && !tabsHaveKeeper());
  const openingTabs =
    defaultTabs ??
    (online
      ? [newPageAddress(choiceOf(settings, "windows"), homeAddress, frontSafariPage(), START_PAGE)]
      : DEFAULT_TABS);
  const frontTab = defaultActiveTab ?? (openingTabs === DEFAULT_TABS ? 1 : 0);
  const [tabs, setTabsAsGiven] = useState<readonly Tab[]>(() =>
    opening?.seeds.length
      ? opening.seeds.map((seed, index) => ({
          id: `tab-${index}`,
          history: seed.history,
          index: seed.index,
          reader: false,
          loading: false,
        }))
      : (openingTabs.length > 0 ? openingTabs : [START_PAGE]).map((url, index) => ({
          id: `tab-${index}`,
          history: [url],
          index: 0,
          reader: defaultReader && index === frontTab && pageAt(url).kind === "site",
          loading: false,
        })),
  );
  // Every change to the tabs goes through here: a new tab or a drag cannot land among the pinned.
  const setTabs = (next: readonly Tab[] | ((all: readonly Tab[]) => readonly Tab[])) =>
    setTabsAsGiven((all) => pinnedFirst(typeof next === "function" ? next(all) : next));
  const nextId = useRef(tabs.length);
  // This window as the others see it, for Merge All Windows and Reopen Last Closed Window.
  const latest = useRef({ tabs, closeWindow: () => {} });
  latest.current.tabs = tabs;
  const [thisWindow] = useState<LiveSafariWindow>(() => ({
    isPrivate,
    keepsTabs: false,
    // A pinned tab is every window's: it does not go along with one.
    seeds: () =>
      latest.current.tabs
        .filter((tab) => !tab.pinKey)
        .map((tab) => ({ history: tab.history, index: tab.index })),
    adopt: (seeds: readonly TabSeed[]) =>
      setTabs((all) => [
        ...all,
        ...seeds.map((seed) => ({
          id: `tab-${nextId.current++}`,
          history: seed.history,
          index: seed.index,
          reader: false,
          loading: false,
        })),
      ]),
    close: () => latest.current.closeWindow(),
  }));
  useEffect(() => registerSafariWindow(thisWindow), [thisWindow]);
  useSyncExternalStore(subscribeSafariWindows, safariWindowsVersion, safariWindowsVersion);
  const [activeId, setActiveId] = useState(() => (tabs[frontTab] ?? tabs[0])?.id ?? "");
  const [ownSidebarOpen, setOwnSidebarOpen] = useState(defaultSidebarOpen);
  const [keptSidebarOpen, setKeptSidebarOpen] = useDesktopSetting(
    SIDEBAR_SHOWN,
    readBoolean,
    defaultSidebarOpen,
  );
  const sidebarOpen = online ? keptSidebarOpen : ownSidebarOpen;
  const setSidebarOpen = online ? setKeptSidebarOpen : setOwnSidebarOpen;
  // The title bar: the window's own menu commands are registered against it, and its root (the
  // window) takes the keyboard back when the element that had it goes away (a closed tab).
  const [titleBar, setTitleBar] = useState<HTMLElement | null>(null);
  const takeKeyboardBack = () => {
    const root = titleBar?.closest<HTMLElement>(".mac-safari");
    setTimeout(() => {
      if (root?.isConnected && !root.contains(document.activeElement)) {
        root.focus({ preventScroll: true });
      }
    });
  };
  // The window's close button, for a close that comes from no click of its own.
  latest.current.closeWindow = () =>
    titleBar
      ?.querySelector<HTMLElement>('.mac-window-control[data-kind="close"], [data-kind="close"]')
      ?.click();
  const [sidebarList, setSidebarList] = useState<"bookmarks" | "reading-list">("bookmarks");
  // The row last chosen in the sidebar. It stays selected while its page is in front.
  const [chosenRow, setChosenRow] = useState<string | null>(null);
  const [overview, setOverview] = useState(defaultTabOverview);
  // The text being edited in the address field; null while it shows the page's address.
  const [draft, setDraft] = useState<string | null>(null);
  const [readerSize, setReaderSize] = useState(0);
  const [readerOptions, setReaderOptions] = useDesktopSetting(
    "safari.reader",
    readReaderOptions,
    READER_OPTIONS,
  );
  const [bookmarks, setBookmarks] = useState(BOOKMARKS);
  const [readingList, setReadingList] = useState(READING_LIST);
  // The tab whose video is in the Picture in Picture window.
  const [floatingId, setFloatingId] = useState<string | null>(() => {
    const front = tabs[frontTab] ?? tabs[0];
    return defaultPictureInPicture && front && hasVideo(front.history[0] ?? "") ? front.id : null;
  });
  // The timer of each tab that is loading.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of running.values()) clearTimeout(timer);
    };
  }, []);

  // ── The web, on the Ferrite desktop app ──
  // What each tab holds for the address it shows, and the request each tab waits on.
  const [web, setWeb] = useState<ReadonlyMap<string, WebState>>(() => new Map());
  const requests = useRef(new Map<string, AbortController>());
  // Pages this window opened, by address, so that Back and Forward show them again at once.
  const opened = useRef(new Map<string, WebState>());
  useEffect(() => {
    const waiting = requests.current;
    return () => {
      for (const request of waiting.values()) request.abort();
    };
  }, []);
  // The frame of the server-fetched page in front: the one whose messages are taken.
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [find, setFind] = useState<SafariFind | null>(null);
  const findField = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useDesktopSetting(PAGE_ZOOM, readNumber, 1);
  const [alwaysTabBar, setAlwaysTabBar] = useDesktopSetting(ALWAYS_TAB_BAR, readBoolean, false);
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [pageHit, setPageHit] = useState<SafariPageHit | null>(null);
  const linkPicker = useRef<HTMLInputElement>(null);
  const bookmarksPicker = useRef<HTMLInputElement>(null);
  const [openingFile, setOpeningFile] = useState(false);
  /** The address of a saved link, opened in a new tab; one that holds none says so. */
  const openLinkFile = (name: string, text: string) => {
    const address = addressOfLinkFile(text);
    if (address) handlers.current.openInNewTab(address);
    else setSaveProblem(`“${name}” does not hold a web address.`);
  };
  /** A file of the drive, from Finder or the Open dialog: a page shows, a saved link goes there. */
  const openDriveFile = (id: string, name: string) => {
    if (isPageFile({ name })) {
      handlers.current.openInNewTab(filePageAddress(id, name));
      return;
    }
    void readFile(id)
      .then((file) => file.text())
      .then(
        (text) => openLinkFile(name, text),
        () => setSaveProblem(`“${name}” could not be read.`),
      );
  };
  /** A file from this computer, chosen or dropped. */
  const openLocalFile = (file: File) => {
    if (isPageFile(file)) handlers.current.openInNewTab(localFilePage(file));
    else void file.text().then((text) => openLinkFile(file.name, text));
  };
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item: DesktopDragItem) =>
      item.kind === "file" && (isPageFile(item) || isLinkFile(item)),
    onDrop: (items) => {
      for (const item of items) openDriveFile(item.id, item.name);
    },
    refusal: () => "Safari shows web pages: an HTML file or a saved link.",
    sayRefusal: (refusal) => setEditProblem({ title: "Safari can’t open this", message: refusal }),
    enabled: online,
  });
  // The address field's list, and Back's and Forward's when held.
  const [fieldFocused, setFieldFocused] = useState(false);
  const [chosenSuggestion, setChosenSuggestion] = useState(-1);
  const [historyMenu, setHistoryMenu] = useState<-1 | 1>(-1);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The field at rest is the page, to drag; once a press has ended or the keyboard came to it, it edits.
  const fieldPressed = useRef(false);
  const [fieldEditing, setFieldEditing] = useState(false);
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  // What a menu row could not do, for the person to read.
  const [editProblem, setEditProblem] = useState<{ title: string; message: string } | null>(null);
  const [savingAs, setSavingAs] = useState(false);
  // Whether a text field of this window last had the keyboard: the Edit menu's rows act on it.
  const [fieldHeld, setFieldHeld] = useState(false);
  // A click in the page's frame fires nothing in this document, and in Firefox 157 not even the field's
  // blur, but the frame is the active element when the person next presses anything here, such as a menu.
  useEffect(() => {
    const press = () => {
      if (document.activeElement instanceof HTMLIFrameElement) setFieldHeld(false);
    };
    document.addEventListener("pointerdown", press, true);
    return () => document.removeEventListener("pointerdown", press, true);
  }, []);
  const [clearingHistory, setClearingHistory] = useState(false);
  // Tells a History page shown to read the history again: it has changed under it.
  const [historyRead, setHistoryRead] = useState(0);
  // What this window downloaded: a private window's list goes with it, the others' is kept.
  const [keptDownloads, setKeptDownloads] = useDesktopSetting(
    "safari.downloads",
    readDownloads,
    NO_DOWNLOADS,
  );
  const [privateDownloads, setPrivateDownloads] =
    useState<readonly SafariDownloadEntry[]>(NO_DOWNLOADS);
  const downloads = isPrivate ? privateDownloads : keptDownloads;
  const setDownloads = isPrivate ? setPrivateDownloads : setKeptDownloads;
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  // A download ends long after it began: what it joins is the list as it stands by then.
  const latestDownloads = useRef(downloads);
  latestDownloads.current = downloads;
  const downloadRemoval = choiceOf(settings, "downloadList");
  const noteDownload = (entry: SafariDownloadEntry) => {
    if (downloadRemoval === "Upon successful download") return;
    const next = withDownload(latestDownloads.current, entry);
    latestDownloads.current = next;
    setDownloads(next);
    setDownloadsOpen(true);
  };
  // The list as "Remove download list items" leaves it, when the window opens or the choice changes.
  const latestSetDownloads = useRef(setDownloads);
  latestSetDownloads.current = setDownloads;
  useEffect(() => {
    const kept = keptDownloadRows(latestDownloads.current, downloadRemoval, Date.now());
    if (kept === latestDownloads.current) return;
    latestDownloads.current = kept;
    latestSetDownloads.current(kept);
  }, [downloadRemoval]);
  // Safari quits with its last window. React runs a cleanup and the effect again when it checks a
  // component, so the list is taken only once that window has really stayed gone.
  const quitRemoves = useRef(false);
  quitRemoves.current = downloadRemoval === "When Safari quits";
  useEffect(
    () => () => {
      queueMicrotask(() => {
        if (quitRemoves.current && !hasOpenWindow() && !isPrivate) latestSetDownloads.current([]);
      });
    },
    [isPrivate],
  );
  const [linkMenu, setLinkMenu] = useState<SafariLinkTarget | null>(null);
  const [renaming, setRenaming] = useState<SafariLinkTarget | null>(null);
  const [sites, setSites] = useState<readonly WebLink[]>([]);
  const [visits, setVisits] = useState<readonly WebVisit[]>([]);
  const refreshVisits = () => {
    void loadHistory().then((found) => {
      if (found) setVisits(found);
    });
  };
  useEffect(() => {
    if (!online) return;
    let live = true;
    void loadSites().then((found) => {
      if (live && found) setSites(found);
    });
    void loadHistory().then((found) => {
      if (live && found) setVisits(found);
    });
    return () => {
      live = false;
    };
  }, [online]);
  // "Remove history items": what has grown too old leaves the history, on the server too.
  const historyRemoval = choiceOf(settings, "history");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `refreshVisits` is this render's, and reads the same.
  useEffect(() => {
    if (!online || isPrivate) return;
    const urls = staleVisits(visits, historyRemoval, Date.now());
    if (urls.length > 0) void forgetHistory({ urls }).then((done) => done && refreshVisits());
  }, [online, isPrivate, visits, historyRemoval]);
  // Safari opens with all windows from last session: the first window brings them back.
  const opensLastSession =
    online && !opening && choiceOf(settings, "opens") === "All windows from last session";
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once, as the window opens.
  useEffect(() => {
    if (opensLastSession && hasLastSession()) reopenLastSession();
  }, []);

  // Favorites (the bar and the start page) and other bookmarks; `null` Favorites are the
  // listed sites, until the person changes them.
  const [favorites, setFavorites] = useState<readonly WebLink[] | null>(null);
  const [savedBookmarks, setSavedBookmarks] = useState<readonly WebLink[]>([]);
  const [savedFolders, setSavedFolders] = useState<readonly WebFolder[]>([]);
  /** The Reading List rows selected together, by address: the list holds an address once. */
  const [readingChosen, setReadingChosen] = useState<readonly string[]>([]);
  const readingAnchor = useRef<string | null>(null);
  const shownFavorites = favorites ?? sites.slice(0, DEFAULT_FAVORITES);
  const library = useMemo(
    () => ({ favorites, bookmarks: savedBookmarks, folders: savedFolders }),
    [favorites, savedBookmarks, savedFolders],
  );
  useServerState({
    url: "/api/safari/bookmarks",
    enabled: online,
    value: library,
    onLoad: (stored) => {
      const doc = stored as { favorites?: unknown; bookmarks?: unknown; folders?: unknown } | null;
      setFavorites(Array.isArray(doc?.favorites) ? readLinks(doc.favorites) : null);
      setSavedBookmarks(Array.isArray(doc?.bookmarks) ? readLinks(doc.bookmarks) : []);
      setSavedFolders(Array.isArray(doc?.folders) ? readFolders(doc.folders) : []);
    },
    toBody: (value) => ({
      favorites: value.favorites ?? sites.slice(0, DEFAULT_FAVORITES),
      bookmarks: value.bookmarks,
      folders: value.folders,
    }),
  });
  const [saved, setSaved] = useState<readonly WebSaved[]>([]);
  const readingDoc = useMemo(() => ({ items: saved }), [saved]);
  const readingLoading = useServerState({
    url: "/api/safari/reading-list",
    enabled: online,
    value: readingDoc,
    onLoad: (stored) => {
      const doc = stored as { items?: unknown } | null;
      setSaved(Array.isArray(doc?.items) ? readSaved(doc.items) : []);
    },
    toBody: (value) => value,
  });
  // The kept tabs initialize a window once, when Safari opens; an open window keeps its own tabs
  // when the desktop reloads Safari's documents in the background.
  const tabsInitialized = useRef(false);
  const tabsAtOpening = useRef(new Set(tabs.map((tab) => tab.id)));
  const keptTabsToSave = useRef(false);
  // Ask once this window is on the list (the effect above), then whenever the windows change.
  useEffect(() => {
    const claimed = claimTabs(thisWindow);
    if (claimed && (keepsTabs !== null || !startsFromKept)) tabsInitialized.current = true;
    if (claimed || keepsTabs === null) setKeepsTabs(thisWindow.keepsTabs);
  });
  const openTabs = useMemo(
    () => ({
      tabs: tabs.map((tab) => keptAddress(tab.history[tab.index] ?? START_PAGE)),
      pinned: tabs.filter((tab) => tab.pinned).length,
      // Only when a tab has somewhere to go back to: the document stays what it was otherwise.
      ...(tabs.some((tab) => tab.history.length > 1)
        ? { histories: tabs.map((tab) => keptPages(tab.history, tab.index)) }
        : null),
      active: Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeId),
      ),
    }),
    [tabs, activeId],
  );
  const tabsLoading = useServerState({
    url: "/api/safari/tabs",
    enabled: online && defaultTabs === undefined && keepsTabs === true,
    value: openTabs,
    onLoad: (stored) => {
      if (tabsInitialized.current) return;
      tabsInitialized.current = true;
      const doc = stored as {
        tabs?: unknown;
        active?: unknown;
        pinned?: unknown;
        histories?: unknown;
      } | null;
      const addresses = Array.isArray(doc?.tabs)
        ? doc.tabs.filter((address): address is string => typeof address === "string")
        : [];
      if (addresses.length === 0) return;
      const front = typeof doc?.active === "number" ? doc.active : 0;
      const pins = typeof doc?.pinned === "number" ? doc.pinned : 0;
      const withPins = (all: readonly Tab[]) =>
        all.map((tab, at) =>
          at < pins ? { ...tab, pinned: true, pinKey: tab.pinKey ?? newPinKey() } : tab,
        );
      // Each tab's Back and Forward, when what was kept holds the page the tab shows.
      const kept = Array.isArray(doc?.histories) ? doc.histories.map(readKeptPages) : [];
      const withBack = (all: readonly Tab[]) =>
        all.map((tab, at) => {
          const pages = kept[at];
          return pages && pages.pages[pages.index] === keptAddress(addressOfTab(tab))
            ? { ...tab, history: pages.pages, index: pages.index }
            : tab;
        });
      // The window answers while this is read: a tab opened, or an address gone to, since it opened
      // is newer than what was kept, and stays after the kept tabs.
      const waiting = tabs.filter(
        (tab) => tabsAtOpening.current.has(tab.id) && tab.history.length === 1,
      );
      const newer = tabs.filter((tab) => !waiting.includes(tab));
      const adopted = adoptKeptTabs(waiting, activeId, addresses, front, (address) => ({
        id: `tab-${nextId.current++}`,
        history: [address],
        index: 0,
        reader: false,
        loading: false,
      }));
      if (!adopted) {
        if (pins > 0 || kept.length > 0) setTabs((all) => withPins(withBack(all)));
        return;
      }
      setTabs(withPins([...withBack(adopted.tabs), ...newer]));
      setActiveId(newer.some((tab) => tab.id === activeId) ? activeId : adopted.activeId);
      keptTabsToSave.current = newer.length > 0;
    },
    toBody: (value) => value,
  });
  // `useServerState` takes the first render after a load for what the server holds. With tabs of the
  // person's in it, it does not, so they are given again once the load has ended, which saves them.
  useEffect(() => {
    if (tabsLoading || !keptTabsToSave.current) return;
    keptTabsToSave.current = false;
    setTabsAsGiven((all) => [...all]);
  }, [tabsLoading]);
  const setWebFor = (id: string, state: WebState | null) =>
    setWeb((all) => {
      const next = new Map(all);
      if (state) next.set(id, state);
      else next.delete(id);
      return next;
    });

  const active = tabs.find((tab) => tab.id === activeId) ?? (tabs[0] as Tab);
  const url = active.history[active.index] ?? START_PAGE;
  const page = pageAt(url);
  // Set to Current Page and Same Page read the key window's page; a private one tells nobody.
  const frontAddress = online && isWebAddress(url) ? url : "";
  const windowInFront = props.state === undefined || props.state === "key";
  useEffect(() => {
    if (online && !isPrivate && windowInFront) noteFrontPage(thisWindow, frontAddress);
  }, [online, isPrivate, windowInFront, thisWindow, frontAddress]);
  const isFile = online && isFilePage(url);
  const isWeb = isFile || (online && isWebAddress(url));
  const held = web.get(active.id);
  const webState = isWeb && held?.address === url ? held : undefined;
  const webReadable =
    webState?.status === "ready" && (webState.page.reader?.length ?? 0) > 0 ? webState.page : null;
  const canRead = page.kind === "site" || webReadable !== null;
  const reading = canRead && active.reader;
  const loading = active.loading && !overview;
  // What the search engine suggests for the text being typed; a private window asks nobody.
  const [engine, setEngine] = useState<{ typed: string; titles: readonly string[] } | null>(null);
  const asking =
    online &&
    !isPrivate &&
    fieldFocused &&
    draft !== null &&
    option(ENGINE_SUGGESTIONS) &&
    asksForSuggestions(draft)
      ? draft
      : null;
  useEffect(() => {
    if (asking === null) return;
    const controller = new AbortController();
    const rest = setTimeout(() => {
      void loadSuggestions(asking, controller.signal).then((titles) => {
        if (!controller.signal.aborted) setEngine({ typed: asking, titles });
      });
    }, SUGGEST_REST_MS);
    return () => {
      clearTimeout(rest);
      controller.abort();
    };
  }, [asking]);
  const suggestions =
    online && fieldFocused && draft !== null
      ? suggestionsFor(
          draft,
          [
            ...visits,
            ...(option(FIELD_FAVORITES) ? (favorites ?? []) : []),
            ...savedBookmarks,
            ...savedFolders.flatMap((folder) => folder.links),
            ...saved,
          ],
          searchAddress,
          engine?.typed === asking ? engine?.titles : NO_SUGGESTIONS,
        )
      : [];
  const snapBackAt = snapBackIndex(active.history, active.index, (address) =>
    address.startsWith(SEARCH),
  );
  const historyMenuRows =
    historyMenu < 0
      ? active.history.map((_, at) => active.index - 1 - at).filter((at) => at >= 0)
      : active.history
          .map((_, at) => active.index + 1 + at)
          .filter((at) => at < active.history.length);

  const update = (id: string, change: (tab: Tab) => Tab) =>
    setTabs((all) => all.map((tab) => (tab.id === id ? change(tab) : tab)));

  // A page "loads" for a moment, so that Reload, Stop and the loading line have something to
  // do. The load belongs to its tab: it goes on while another tab is in front.
  const stop = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    const request = requests.current.get(id);
    if (request) {
      requests.current.delete(id);
      request.abort();
      setWeb((all) => {
        const waiting = all.get(id);
        if (waiting?.status !== "loading") return all;
        const next = new Map(all);
        next.set(id, { status: "stopped", address: waiting.address });
        return next;
      });
    }
    update(id, (tab) => (tab.loading ? { ...tab, loading: false } : tab));
  };
  // A web page is asked of the server (safari-web.tsx); `fresh` asks again for one this window
  // already opened, as Reload does.
  // Show a page in a tab at the address it ended at (a site's home page for its bare address, a
  // redirect's target), whether it was just fetched or opened before.
  const showWeb = (id: string, address: string, state: WebState) => {
    const final =
      state.status === "ready" ? state.page.url : state.status === "outside" ? state.url : address;
    const articled = state.status === "ready" && (state.page.reader?.length ?? 0) > 0;
    update(id, (tab) => ({
      ...tab,
      loading: false,
      reader: tab.reader || (articled && option(AUTO_READER)),
      history:
        final !== address && tab.history[tab.index] === address
          ? tab.history.map((entry, at) => (at === tab.index ? final : entry))
          : tab.history,
    }));
    const settled = { ...state, address: final } as WebState;
    setWebFor(id, settled);
    return settled;
  };
  const openWeb = (id: string, address: string, fresh: boolean) => {
    const kept = fresh ? undefined : opened.current.get(address);
    if (kept) {
      showWeb(id, address, kept);
      return;
    }
    const controller = new AbortController();
    requests.current.set(id, controller);
    setWebFor(id, { status: "loading", address });
    update(id, (tab) => ({ ...tab, loading: true }));
    void (
      isFilePage(address)
        ? openFilePage(address, controller.signal)
        : openWebPage(address, controller.signal, isPrivate)
    ).then((state) => {
      if (requests.current.get(id) !== controller) return;
      requests.current.delete(id);
      const settled = showWeb(id, address, state);
      if (settled.status === "ready" || settled.status === "outside") {
        opened.current.set(address, settled);
        opened.current.set(settled.address, settled);
        while (opened.current.size > OPENED_PAGES) {
          const oldest = opened.current.keys().next().value;
          if (oldest === undefined) break;
          opened.current.delete(oldest);
        }
        // The server adds the pages it fetched to the history; a page opened in a browser tab
        // is added when its button is pressed.
        if (settled.status === "ready") refreshVisits();
      }
    });
  };
  const load = (id: string, next: string, fresh = false) => {
    stop(id);
    if (next === START_PAGE || next === EMPTY_PAGE) return;
    if (online && (next === HISTORY_PAGE || next === BOOKMARKS_PAGE)) return;
    if (online && (isWebAddress(next) || isFilePage(next))) {
      openWeb(id, next, fresh);
      return;
    }
    update(id, (tab) => ({ ...tab, loading: true }));
    timers.current.set(
      id,
      setTimeout(() => stop(id), LOAD_TIME),
    );
  };

  const show = (id: string) => {
    setDraft(null);
    setOverview(false);
    setActiveId(id);
  };

  const navigate = (next: string) => {
    // A tab that leaves its page takes the page's video out of Picture in Picture.
    if (active.id === floatingId) setFloatingId(null);
    update(active.id, (tab) => ({
      ...tab,
      history: [...tab.history.slice(0, tab.index + 1), next],
      index: tab.index + 1,
      reader: false,
    }));
    setDraft(null);
    setOverview(false);
    load(active.id, next);
  };

  const step = (by: number) => {
    if (active.id === floatingId) setFloatingId(null);
    update(active.id, (tab) => ({ ...tab, index: tab.index + by, reader: false }));
    setDraft(null);
    load(active.id, active.history[active.index + by] ?? START_PAGE);
  };

  const newTab = () => {
    const id = `tab-${nextId.current++}`;
    const address = newPageAddress(choiceOf(settings, "tabs"), homeAddress, url, START_PAGE);
    setTabs((all) => [...all, { id, history: [address], index: 0, reader: false, loading: false }]);
    show(id);
    load(id, address);
  };

  /** Open an address in a new tab, in front unless asked otherwise: a link clicked with Command, or another app's. */
  const openInNewTab = (address: string, inFront = true) => {
    const id = `tab-${nextId.current++}`;
    setTabs((all) => [...all, { id, history: [address], index: 0, reader: false, loading: false }]);
    if (inFront) show(id);
    load(id, address);
  };

  /**
   * A link followed in the tab in front. With Command it takes a new tab, if Preferences say so, in
   * front if they say that too. A pinned tab keeps its site: a link to another one takes a new tab.
   */
  const followLink = (address: string, commanded: boolean) => {
    if (commanded && option(COMMAND_CLICK)) openInNewTab(address, option(MAKE_ACTIVE));
    else if (active.pinned && hostOf(address) !== hostOf(url)) {
      openInNewTab(address, option(MAKE_ACTIVE));
    } else navigate(address);
  };

  // The tabs closed in this window, newest last, for Reopen Last Closed Tab.
  const closedTabs = useRef<{ history: readonly string[]; index: number }[]>([]);
  const reopenClosedTab = () => {
    const last = closedTabs.current.at(-1);
    if (!last) return;
    closedTabs.current = closedTabs.current.slice(0, -1);
    const id = `tab-${nextId.current++}`;
    setTabs((all) => [
      ...all,
      { id, history: last.history, index: last.index, reader: false, loading: false },
    ]);
    show(id);
    load(id, last.history[last.index] ?? START_PAGE);
  };

  // A link or a form in a fetched page arrives as a message; the handlers are the latest
  // render's.
  const frameReplies = useRef<(data: unknown) => void>(() => {});
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  // The link under the pointer was on the page that has just gone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the page changes, and only then.
  useEffect(() => setHoveredLink(null), [url]);
  const handlers = useRef({ navigate, openInNewTab, followLink });
  useEffect(() => {
    handlers.current = { navigate, openInNewTab, followLink };
  });
  useEffect(() => {
    if (!online) return;
    const onMessage = (event: MessageEvent) => {
      // Only the page in front may steer the window, and only to an address.
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data as {
        safari?: unknown;
        type?: unknown;
        url?: unknown;
        newTab?: unknown;
      };
      if (data?.safari !== 1) return;
      if (data.type === "hover") {
        setHoveredLink(typeof data.url === "string" ? data.url.slice(0, 2048) : null);
        return;
      }
      if (data.type !== "navigate") {
        frameReplies.current(event.data);
        return;
      }
      if (typeof data.url !== "string" || data.url.length > 4096) return;
      handlers.current.followLink(data.url, data.newTab === true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [online]);
  // Another app's "open this in Safari" (`desktop-open-url.ts`: a link in Mail, Messages or
  // Notes, a story in News): each address opens in a new tab in front. The requests made before
  // this window was ready wait in a queue until its kept tabs have loaded (or failed to), so that
  // the tabs Safari reopens never replace the new one; the tab is then kept like any other.
  const linksReady = online && keepsTabs !== null && !tabsLoading;
  useEffect(() => {
    if (!linksReady) return;
    for (const request of takeOpenUrlRequests()) handlers.current.openInNewTab(request.url);
    return onOpenUrlRequest((request) => handlers.current.openInNewTab(request.url));
  }, [linksReady]);

  // A link another app's Share menu adds to the Reading List, here or in a window that opens only
  // now, once the saved pages are loaded, so that it joins them.
  useEffect(() => {
    if (!linksReady || readingLoading) return;
    const add = ({ url, title }: SharedLink) =>
      setSaved((list) =>
        list.some((item) => item.url === url)
          ? list
          : [...list, { title: title || url, url, added: Date.now(), read: false }],
      );
    for (const link of takeSharedLinks("safari")) add(link);
    return onSharedLink("safari", add);
  }, [linksReady, readingLoading]);

  // A saved link opened from Finder, here or in a window that opens only now.
  // biome-ignore lint/correctness/useExhaustiveDependencies: what it calls opens through refs.
  useEffect(() => {
    if (!linksReady) return;
    const take = (request: { id: string; name: string }) => openDriveFile(request.id, request.name);
    for (const request of takeOpenFileRequests("safari")) take(request);
    return onOpenFileRequest("safari", take);
  }, [linksReady]);

  // A tab brought to the front whose web page has not been opened yet (a tab kept from last
  // time) opens it now.
  const unopened = isWeb && !overview && webState === undefined && !requests.current.has(active.id);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    if (unopened) loadRef.current(active.id, url);
  }, [unopened, active.id, url]);

  /**
   * Dragging a tab along the tab bar reorders the tabs, as in Safari: once the pointer has moved a
   * few points the tab takes the place among the others that the pointer is over. The new order is
   * kept with the tabs document, like any other change to the tabs. The close button starts no
   * drag.
   */
  const tabDrag = useRef<{ id: string; x: number; moved: boolean } | null>(null);
  const startTabDrag = (id: string, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as Element).closest(".mac-safari-tab-bar-close"))
      return;
    tabDrag.current = { id, x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  /** How far past the bar, above or below it, a tab has to be let go to leave its window. */
  const TAB_OUT_MARGIN = 24;
  const outsideTabBar = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.closest('[role="tablist"]')?.getBoundingClientRect();
    return (
      box !== undefined &&
      (event.clientY < box.top - TAB_OUT_MARGIN || event.clientY > box.bottom + TAB_OUT_MARGIN)
    );
  };
  const moveTabDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = tabDrag.current;
    if (!drag || (!drag.moved && Math.abs(event.clientX - drag.x) < 6) || outsideTabBar(event))
      return;
    drag.moved = true;
    const list = event.currentTarget.closest('[role="tablist"]');
    if (!list) return;
    const others = [...list.querySelectorAll<HTMLElement>('[role="tab"]')].filter(
      (element) => element !== event.currentTarget,
    );
    const to = others.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.left + box.width / 2 < event.clientX;
    }).length;
    setTabs((all) => moveTab(all, drag.id, to));
  };
  const endTabDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = tabDrag.current;
    if (!drag) return;
    tabDrag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    // Let go away from the bar: the tab goes to a window of its own, as in Safari.
    if (event.type !== "pointerup" || !online || !outsideTabBar(event) || tabs.length < 2) return;
    const tab = tabs.find((each) => each.id === drag.id);
    if (tab && !tab.pinKey) moveToNewWindow(tab);
  };

  /** What closing a tab leaves behind: Reopen Last Closed Tab remembers it, and its loads stop. */
  const forgetTab = (closing: Tab) => {
    closedTabs.current = [
      ...closedTabs.current.slice(1 - CLOSED_TABS),
      { history: closing.history, index: closing.index },
    ];
    clearTimeout(timers.current.get(closing.id));
    timers.current.delete(closing.id);
    requests.current.get(closing.id)?.abort();
    requests.current.delete(closing.id);
    setWebFor(closing.id, null);
    if (closing.id === floatingId) setFloatingId(null);
  };
  /** Close Other Tabs and Close Tabs to the Right: `keep` stays and comes to the front. */
  const closeTabsBut = (keep: readonly string[], front: string) => {
    const closing = tabs.filter((tab) => !keep.includes(tab.id) && !tab.pinned);
    if (closing.length === 0) return;
    for (const tab of closing) forgetTab(tab);
    setTabs(tabs.filter((tab) => keep.includes(tab.id) || tab.pinned));
    if (!keep.includes(activeId) && closing.some((tab) => tab.id === activeId)) show(front);
  };
  const togglePin = (id: string) => {
    const key = tabs.find((each) => each.id === id)?.pinKey;
    if (key) forgetPin(key);
    setTabs((all) => {
      const tab = all.find((each) => each.id === id);
      if (!tab) return all;
      const rest = all.filter((each) => each !== tab);
      const at = rest.filter((each) => each.pinned).length;
      const pinned = !tab.pinned;
      const pinKey = pinned && !isPrivate ? newPinKey() : undefined;
      return [...rest.slice(0, at), { ...tab, pinned, pinKey }, ...rest.slice(at)];
    });
  };
  // A pinned tab shows in every window that is not private, on the same page. A window's first
  // pins come from its kept tabs, so it waits for those.
  const seenPins = useRef(new Map<string, TabSeed>());
  useEffect(() => {
    if (!online || isPrivate || keepsTabs === null || (keepsTabs && tabsLoading)) return;
    const local = tabs.flatMap((tab): PinnedTab[] =>
      tab.pinKey ? [{ key: tab.pinKey, history: tab.history, index: tab.index }] : [],
    );
    const { add, remove, follow } = reconcilePins(local, seenPins.current);
    if (add.length === 0 && remove.length === 0 && follow.length === 0) return;
    setTabs((all) => {
      const kept = all
        .filter((tab) => !tab.pinKey || !remove.includes(tab.pinKey))
        .map((tab) => {
          const moved = follow.find((pin) => pin.key === tab.pinKey);
          return moved ? { ...tab, history: moved.history, index: moved.index } : tab;
        });
      const added = add
        .filter((pin) => !all.some((tab) => tab.pinKey === pin.key))
        .map((pin) => ({
          id: `tab-${nextId.current++}`,
          history: pin.history,
          index: pin.index,
          reader: false,
          loading: false,
          pinned: true,
          pinKey: pin.key,
        }));
      const next = [...kept, ...added];
      // A window holding nothing else keeps its last tab, no longer pinned.
      return next.length > 0
        ? next
        : all.map((tab) => ({ ...tab, pinned: false, pinKey: undefined }));
    });
  });
  const moveToNewWindow = (tab: Tab) => {
    openSafariWindow({ isPrivate, seeds: [{ history: tab.history, index: tab.index }] });
    removeTab(tab.id);
    closedTabs.current = closedTabs.current.slice(0, -1);
  };
  const removeTab = (id: string) => {
    const at = tabs.findIndex((tab) => tab.id === id);
    const rest = tabs.filter((tab) => tab.id !== id);
    if (at < 0 || rest.length === 0) return;
    forgetTab(tabs[at] as Tab);
    setTabs(rest);
    if (id === activeId) show((rest[at] ?? rest[at - 1] ?? (rest[0] as Tab)).id);
  };
  const closeTab = (id: string) => {
    removeTab(id);
    // The closed tab may have had the keyboard: give it back to the window, so that the next key
    // equivalent (Reopen Last Closed Tab, say) still reaches Safari.
    takeKeyboardBack();
  };

  // Safari's thumbnails follow the shape of the window: in both captures the miniature under
  // the 26 pt title band is 1.029 times as wide for its height as the area under the toolbar.
  // Four thumbnails share the window's width less 152 pt of margins and gaps.
  let thumbnailAspect: CSSProperties | undefined;
  if (typeof width === "number" && typeof height === "number" && width > 152 && height > 38) {
    const tile = (width - 152) / 4;
    const miniature = tile / ((1.029 * width) / (height - 38));
    thumbnailAspect = {
      "--mac-web-view-thumbnail-aspect": `${tile} / ${miniature + 26}`,
    } as CSSProperties;
  }

  const titleOf = (tab: Tab) => {
    const address = tab.history[tab.index] ?? START_PAGE;
    if (online && address === HISTORY_PAGE) return "History";
    if (online && address === BOOKMARKS_PAGE) return "Bookmarks";
    if (address === EMPTY_PAGE) return "Untitled";
    if (online && isFilePage(address)) {
      const state = web.get(tab.id);
      return state?.address === address && state.status === "ready"
        ? state.page.title
        : filePageOf(address).name;
    }
    if (online && isWebAddress(address)) {
      const state = web.get(tab.id);
      return webTitle(state?.address === address ? state : undefined, address);
    }
    return pageAt(address).title;
  };
  const showTabBar = (tabs.length > 1 || alwaysTabBar) && !overview;
  const menuTab = tabs.find((tab) => tab.id === menuTabId);
  // A page that loaded can be shared; the start page, an error page and the overview cannot.
  const sharable =
    !overview &&
    !isFile &&
    (page.kind === "site" ||
      page.kind === "search" ||
      webState?.status === "ready" ||
      webState?.status === "outside");

  /** Add the page in front to a list of the sidebar, unless a folder of it holds the page. */
  const keep = (list: readonly SafariBookmark[]) =>
    holds(list, url) ? list : [...list, { label: page.title, url }];
  /** Add the web page in front to the Reading List, once. */
  const readLater = () =>
    setSaved((list) =>
      list.some((item) => item.url === url)
        ? list
        : [...list, { title: titleOf(active), url, added: Date.now(), read: false }],
    );
  const [addingBookmark, setAddingBookmark] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [addingTabs, setAddingTabs] = useState(false);
  /** The open tabs that show web pages, as links for a folder. */
  const webTabLinks = (): readonly WebLink[] =>
    tabs.flatMap((tab) => {
      const address = addressOfTab(tab);
      return isWebAddress(address) ? [{ title: titleOf(tab), url: address }] : [];
    });
  // A sheet that closes leaves the keyboard nowhere: the next key equivalent must still reach Safari.
  const sheetOpen =
    addingBookmark ||
    addingFolder ||
    addingTabs ||
    savingAs ||
    openingFile ||
    renaming !== null ||
    clearingHistory;
  const sheetWasOpen = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a sheet closes, and only then.
  useEffect(() => {
    if (sheetWasOpen.current && !sheetOpen) takeKeyboardBack();
    sheetWasOpen.current = sheetOpen;
  }, [sheetOpen]);
  const addPageTo = (place: SafariBookmarkPlace, title: string) => {
    const added = (list: readonly WebLink[]) =>
      list.some((link) => link.url === url && link.title === title)
        ? list
        : [...list, { title, url }];
    if (place.kind === "favorites") setFavorites(added(shownFavorites));
    else if (place.kind === "bookmarks") setSavedBookmarks(added);
    else {
      setSavedFolders((now) =>
        now.map((folder) =>
          folder.title === place.title ? { ...folder, links: added(folder.links) } : folder,
        ),
      );
    }
  };
  const addBookmark = () => (isWeb ? setAddingBookmark(true) : setBookmarks((list) => keep(list)));
  const addToReadingList = () => (isWeb ? readLater() : setReadingList((list) => keep(list)));

  // ── Safari's own commands in the desktop's menu bar (File, View, History, Bookmarks), and
  // their key equivalents while the window has the keyboard ──
  const [favoritesBarShown, setFavoritesBarShown] = useDesktopSetting(
    FAVORITES_BAR,
    readBoolean,
    true,
  );
  const [statusBarShown, setStatusBarShown] = useDesktopSetting(STATUS_BAR, readBoolean, false);

  /** What Safari's page menu does; its pictures and links go through the same paths as a click. */
  const afterSave =
    (address: string, mayOpen = false) =>
    (result: DownloadResult) => {
      if (result.ok) {
        noteDownload({
          id: result.entry.id,
          name: result.entry.name,
          url: address,
          at: Date.now(),
        });
        if (mayOpen && option(SAFE_FILES) && isSafeFile(result.entry.name)) {
          openFile({ id: result.entry.id, name: result.entry.name });
        }
      } else {
        setSaveProblem(result.message);
      }
    };
  /** Writes the page where the Save dialog chose: only what lands in Downloads joins its list. */
  const savePageTo = (target: DriveSaveTarget, html: string, address: string) => {
    void saveToDrive(target, new Blob([html], { type: "text/html" })).then(
      (entry) => {
        if (entry.parent === SPECIAL_FOLDER_IDS.Downloads) {
          afterSave(address)({ ok: true, entry });
        }
      },
      (error: unknown) =>
        setSaveProblem(error instanceof Error ? error.message : "The page could not be saved."),
    );
  };
  const pageMenu: SafariPageMenuActions = {
    open: navigate,
    openInNewTab: (address) => openInNewTab(address, option(MAKE_ACTIVE)),
    openInNewWindow: (address) =>
      openSafariWindow({ isPrivate, seeds: [{ history: [address], index: 0 }] }),
    downloadLink: (address) => void downloadToDownloads(address).then(afterSave(address, true)),
    addBookmark: (address, title) =>
      setSavedBookmarks((list) =>
        list.some((link) => link.url === address)
          ? list
          : [...list, { title: title || address, url: address }],
      ),
    addToReadingList: (address, title) =>
      setSaved((list) =>
        list.some((item) => item.url === address)
          ? list
          : [...list, { title: title || address, url: address, added: Date.now(), read: false }],
      ),
    copy: (text) => void copyText(text),
    lookUp: (text) => lookUp(text),
    copyImage: (address) =>
      void copyImage(address).then((done) => {
        if (!done) {
          setEditProblem({
            title: "Safari could not copy the picture",
            message: "This browser did not let Safari put the picture on the clipboard.",
          });
        }
      }),
    saveImage: (address) => {
      const file = imageFile(address);
      if (!file) {
        setSaveProblem("This picture could not be read.");
        return;
      }
      void saveToDownloads(file.blob, file.name).then(afterSave(url));
    },
    search: (text) => openInNewTab(searchAddress(text)),
    back: { enabled: active.index > 0, run: () => step(-1) },
    forward: {
      enabled: active.index < active.history.length - 1,
      run: () => step(1),
    },
    reload: () => load(active.id, url, true),
    reader: {
      title: reading ? "Hide Reader" : "Show Reader",
      enabled: canRead,
      run: () => toggleReader(),
    },
    addPage: { enabled: !isFile, run: addBookmark },
  };
  // ---- A link's menu, in the sidebar and on the Favorites bar ---------------------------------

  /** Whether a stored link is the one a menu was opened on: two may share an address. */
  const isLink = (each: WebLink, target: SafariLinkTarget) =>
    each.url === target.url && (each.title || each.url) === target.title;
  /** A list without the first link that is the target, so its twin stays. */
  const withoutLink = <T extends WebLink>(list: readonly T[], target: SafariLinkTarget) => {
    const at = list.findIndex((each) => isLink(each, target));
    return at < 0 ? [...list] : [...list.slice(0, at), ...list.slice(at + 1)];
  };
  /** A list with the first link that is the target changed, so its twin stays as it is. */
  const changedLink = <T extends WebLink>(
    list: readonly T[],
    target: SafariLinkTarget,
    change: (link: T) => T,
  ) => {
    const at = list.findIndex((each) => isLink(each, target));
    return list.map((each, index) => (index === at ? change(each) : each));
  };
  /** Changes the bookmarks list or the folder a target is in. */
  const changeBookmarks = (
    target: SafariLinkTarget,
    change: (list: readonly WebLink[]) => readonly WebLink[],
  ) => {
    if (target.folder === undefined) setSavedBookmarks(change);
    else {
      setSavedFolders((now) =>
        now.map((folder) =>
          folder.title === target.folder ? { ...folder, links: change(folder.links) } : folder,
        ),
      );
    }
  };
  const removeLink = (target: SafariLinkTarget) => {
    if (target.list === "favorites") setFavorites(withoutLink(shownFavorites, target));
    else if (target.list === "bookmarks") {
      changeBookmarks(target, (now) => withoutLink(now, target));
    } else setSaved((now) => withoutLink(now, target));
  };
  const moveLink = (target: SafariLinkTarget) => {
    const source =
      target.list === "favorites"
        ? shownFavorites
        : target.folder === undefined
          ? savedBookmarks
          : (savedFolders.find((folder) => folder.title === target.folder)?.links ?? []);
    const moved = source.find((each) => isLink(each, target));
    if (!moved) return;
    const joined = (now: readonly WebLink[]) => [...now, moved];
    if (target.list === "favorites") {
      setFavorites(withoutLink(shownFavorites, target));
      setSavedBookmarks(joined);
    } else {
      changeBookmarks(target, (now) => withoutLink(now, target));
      setFavorites(joined(shownFavorites));
    }
  };
  const renameLink = (target: SafariLinkTarget, title: string) => {
    const renamed = (list: readonly WebLink[]) => {
      const at = list.findIndex((each) => isLink(each, target));
      return list.map((each, index) => (index === at ? { ...each, title } : each));
    };
    if (target.list === "favorites") setFavorites(renamed(shownFavorites));
    else changeBookmarks(target, renamed);
  };
  /** Opening a Reading List item marks it read, whichever way it is opened. */
  const openLink = (target: SafariLinkTarget, newTab: boolean) => {
    if (newTab) openInNewTab(target.url);
    else navigate(target.url);
    if (target.list === "reading-list") {
      setSaved((now) => changedLink(now, target, (each) => ({ ...each, read: true })));
    }
  };
  const onLinkMenu = (event: MouseEvent<HTMLElement>) => {
    const row = (event.target as Element).closest<HTMLElement>("[data-link-url]");
    const address = row?.dataset.linkUrl;
    if (!row || !address) {
      setLinkMenu(null);
      return;
    }
    const list = row.closest(".mac-safari-favorites-bar")
      ? "favorites"
      : ((row.dataset.linkList as SafariLinkList | undefined) ??
        (sidebarList === "reading-list" ? "reading-list" : "bookmarks"));
    setLinkMenu({
      list,
      url: address,
      title: row.dataset.linkTitle ?? address,
      folder: row.dataset.linkFolder,
    });
  };
  /**
   * Dragging a row of the Bookmarks list: onto a row it stands before it, onto Favorites or a folder
   * it joins it, anywhere else it follows the bookmarks. A press there opens the row when it is let go,
   * not as it goes down, as a press that may become a drag has to.
   */
  const sidebarDrag = useRef<{
    row: HTMLElement;
    x: number;
    y: number;
    moved: boolean;
    over: HTMLElement | null;
  } | null>(null);
  const draggableRow = (target: EventTarget) => {
    if (!online || sidebarList !== "bookmarks") return null;
    const row = (target as Element).closest<HTMLElement>("[data-link-url]");
    return row && row.dataset.linkUrl !== HISTORY_PAGE ? row : null;
  };
  const dropRowAt = (target: EventTarget) =>
    (target as Element).closest<HTMLElement>("[data-link-url], [data-drop-place]");
  const markSidebarDrop = (row: HTMLElement | null) => {
    const drag = sidebarDrag.current;
    if (!drag || drag.over === row) return;
    drag.over?.removeAttribute("data-safari-drop");
    drag.over = row;
    row?.setAttribute("data-safari-drop", row.dataset.dropPlace ? "into" : "before");
  };
  const moveSidebarDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = sidebarDrag.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    drag.moved = true;
    markSidebarDrop(dropRowAt(event.target));
  };
  const linkPlaces = {
    favorites: shownFavorites,
    bookmarks: savedBookmarks,
    folders: savedFolders,
  };
  /** The position in its place of a row of the sidebar. */
  const rowIndex = (row: HTMLElement) =>
    linksAt(linkPlaces, rowPlace(row)).findIndex(
      (each) =>
        each.url === row.dataset.linkUrl && (each.title || each.url) === row.dataset.linkTitle,
    );
  const wasDragged = useRef(false);
  const endSidebarDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = sidebarDrag.current;
    if (!drag?.moved) {
      sidebarDrag.current = null;
      return;
    }
    markSidebarDrop(null);
    // The click that ends the drag opens nothing.
    wasDragged.current = true;
    sidebarDrag.current = null;
    const on = dropRowAt(event.target);
    if (on === drag.row) return;
    const plainRow = on && !on.dataset.dropPlace && on.dataset.linkUrl !== HISTORY_PAGE;
    const to = on?.dataset.dropPlace ?? (plainRow ? rowPlace(on) : "bookmarks");
    const next = rowMovedTo(
      linkPlaces,
      { place: rowPlace(drag.row), index: rowIndex(drag.row) },
      to,
      plainRow ? rowIndex(on) : null,
    );
    if (next === linkPlaces) return;
    setFavorites(next.favorites);
    setSavedBookmarks(next.bookmarks);
    setSavedFolders(next.folders);
  };
  const openSidebarRow = (value: string) => {
    setChosenRow(value);
    // A link's value ends in its address; a folder's is its path alone.
    const address = value.split(" ")[1];
    if (!address) return;
    navigate(address);
    if (online && sidebarList === "reading-list") {
      setSaved((list) =>
        list.map((item) => (item.url === address ? { ...item, read: true } : item)),
      );
    }
  };
  const removeFromReadingList = (urls: readonly string[]) => {
    setSaved((now) => now.filter((each) => !urls.includes(each.url)));
    setReadingChosen([]);
  };
  /** Command and Shift select Reading List rows; a plain press opens one and leaves it chosen. */
  const onSidebarPress = (event: MouseEvent<HTMLElement>) => {
    const pressed = draggableRow(event.target);
    if (pressed) {
      if (wasDragged.current) wasDragged.current = false;
      else if (pressed.dataset.value !== selectedRow) {
        openSidebarRow(pressed.dataset.value ?? "");
      }
      return;
    }
    if (!online || sidebarList !== "reading-list") return;
    const row = (event.target as Element).closest<HTMLElement>("[data-link-url]");
    const address = row?.dataset.linkUrl;
    if (!address) return;
    const press = { command: event.metaKey || event.ctrlKey, shift: event.shiftKey };
    if (press.command || press.shift) {
      event.preventDefault();
      event.stopPropagation();
    }
    setReadingChosen((now) =>
      pressedRows(
        now,
        saved.map((each) => each.url),
        readingAnchor.current,
        address,
        press,
      ),
    );
    if (!press.shift) readingAnchor.current = address;
  };
  const readingTargets = (target: SafariLinkTarget) =>
    target.list === "reading-list" && readingChosen.includes(target.url)
      ? readingChosen
      : [target.url];
  const linkMenuPopup = (
    <ContextualMenuPopup aria-label="Link">
      {linkMenu ? (
        <>
          <MenuItem
            disabled={readingTargets(linkMenu).length > 1}
            onClick={() => openLink(linkMenu, false)}
          >
            Open
          </MenuItem>
          <MenuItem
            onClick={() => {
              const urls = readingTargets(linkMenu);
              if (urls.length === 1) {
                openLink(linkMenu, true);
                return;
              }
              for (const address of urls) openInNewTab(address);
              setSaved((now) =>
                now.map((each) => (urls.includes(each.url) ? { ...each, read: true } : each)),
              );
            }}
          >
            {readingTargets(linkMenu).length > 1
              ? `Open ${readingTargets(linkMenu).length} Pages in New Tabs`
              : "Open in New Tab"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => void copyText(linkMenu.url)}>Copy Link</MenuItem>
          {linkMenu.list === "reading-list" ? (
            readingTargets(linkMenu).length > 1 ? (
              <MenuItem
                onClick={() =>
                  setSaved((now) =>
                    now.map((each) =>
                      readingChosen.includes(each.url) ? { ...each, read: true } : each,
                    ),
                  )
                }
              >
                {`Mark ${readingChosen.length} as Read`}
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() =>
                  setSaved((now) =>
                    changedLink(now, linkMenu, (each) => ({ ...each, read: !each.read })),
                  )
                }
              >
                {saved.find((each) => isLink(each, linkMenu))?.read
                  ? "Mark as Unread"
                  : "Mark as Read"}
              </MenuItem>
            )
          ) : (
            <>
              <MenuItem onClick={() => setRenaming(linkMenu)}>Rename…</MenuItem>
              <MenuItem onClick={() => moveLink(linkMenu)}>
                {linkMenu.list === "favorites" ? "Move to Bookmarks" : "Move to Favorites"}
              </MenuItem>
            </>
          )}
          <MenuSeparator />
          <MenuItem
            onClick={() =>
              linkMenu.list === "reading-list"
                ? removeFromReadingList(readingTargets(linkMenu))
                : removeLink(linkMenu)
            }
          >
            {linkMenu.list !== "reading-list"
              ? "Delete"
              : readingTargets(linkMenu).length > 1
                ? `Remove ${readingTargets(linkMenu).length} Items`
                : "Remove Item"}
          </MenuItem>
        </>
      ) : (
        <MenuItem disabled>No Bookmark</MenuItem>
      )}
    </ContextualMenuPopup>
  );
  const canBack = !overview && active.index > 0;
  const canForward = !overview && active.index < active.history.length - 1;
  const canReload =
    !overview &&
    page.kind !== "start" &&
    url !== HISTORY_PAGE &&
    url !== BOOKMARKS_PAGE &&
    url !== EMPTY_PAGE;
  const showList = (list: "bookmarks" | "reading-list") => {
    setOverview(false);
    setSidebarList(list);
    setSidebarOpen(true);
  };
  const openLocation = () => {
    setOverview(false);
    const field = () =>
      titleBar?.querySelector<HTMLInputElement>('input[aria-label="Search or enter website name"]');
    const take = () => {
      const input = field();
      input?.focus();
      input?.select();
      return input != null && document.activeElement === input;
    };
    // From the keyboard the field takes it at once. Chosen in the menu bar, the open menu still holds the
    // keyboard (the rest of the page is inert under it) and hands it back when it closes: the field takes it
    // once no menu is open, for a few frames at most.
    const menuOpen = () => document.querySelector('[role="menu"][data-open]') !== null;
    if (!menuOpen() && take()) return;
    let frames = 0;
    const again = () => {
      if (!menuOpen() && take()) return;
      if (++frames < 30) requestAnimationFrame(again);
    };
    requestAnimationFrame(again);
  };
  const toggleReader = () => update(active.id, (tab) => ({ ...tab, reader: !tab.reader }));
  const toggleOverview = () => {
    setDraft(null);
    setOverview(!overview);
  };

  // ---- The page in its frame: Find, zoom, the selection ------------------------------------

  const pageShown = online && !overview && webState?.status === "ready" && !reading;
  // Safari's own views hold their text in this document, so Find reads it from here.
  const findsHere =
    online && !overview && (reading || url === HISTORY_PAGE || url === BOOKMARKS_PAGE);
  const foundHere = useRef<readonly Range[]>([]);
  const viewRoot = () => titleBar?.closest(".mac-safari")?.querySelector(".mac-safari-page-pane");
  const postToPage = (message: Record<string, unknown>) =>
    // The frame's origin is opaque, so no narrower target can name it.
    frameRef.current?.contentWindow?.postMessage({ safari: 1, ...message }, "*");
  const takeFindKeyboard = () => {
    // A menu holds the keyboard until it closes: the field takes it after, within a few frames.
    let frames = 0;
    const take = () => {
      const input = findField.current?.querySelector("input");
      const menu = document.querySelector('[role="menu"][data-open]');
      if (input && !menu) {
        input.focus();
        input.select();
      }
      if ((!input || document.activeElement !== input) && ++frames < 30)
        requestAnimationFrame(take);
    };
    take();
  };
  const searchPage = (query: string) => {
    if (findsHere) {
      const root = viewRoot();
      foundHere.current = root ? findRanges(root, query) : [];
      lightMatches(foundHere.current, 0);
      setFind({ query, count: foundHere.current.length, at: foundHere.current.length > 0 ? 1 : 0 });
      return;
    }
    setFind({ query, count: 0, at: 0 });
    postToPage({ type: "find", query, fresh: true });
  };
  const stepFind = (back: boolean) => {
    if (!find || find.query === "") return;
    if (findsHere) {
      const at = nextMatch(find, back);
      lightMatches(foundHere.current, at - 1);
      setFind({ ...find, at });
      return;
    }
    postToPage({ type: "find", query: find.query, back });
  };
  const closeFind = () => {
    setFind(null);
    if (findsHere) lightMatches([], 0);
    else postToPage({ type: "find", query: "", fresh: true });
    (frameRef.current?.closest(".mac-safari") as HTMLElement | null)?.focus({
      preventScroll: true,
    });
  };
  const setPageZoom = (scale: number) => {
    setZoom(scale);
    postToPage({ type: "zoom", scale });
  };
  const zoomIndex = PAGE_ZOOMS.indexOf(zoom as (typeof PAGE_ZOOMS)[number]);
  // The banner belongs to the page it searched.
  const findPage = `${active.id} ${url}`;
  const lastFindPage = useRef(findPage);
  useEffect(() => {
    if (lastFindPage.current === findPage) return;
    lastFindPage.current = findPage;
    setFind(null);
    foundHere.current = [];
    lightMatches([], 0);
  }, [findPage]);

  /** A link joins the Favorites before the favourite under `hit`, or after them all. */
  const addFavoriteAt = (hit: Element, link: WebLink) => {
    const over = hit.closest<HTMLElement>("[data-favorite-at]");
    const at = over ? Number(over.dataset.favoriteAt) : shownFavorites.length;
    setFavorites([...shownFavorites.slice(0, at), link, ...shownFavorites.slice(at)]);
  };
  // A browser lets no drag leave a frame of another origin, so the page's script reports a link
  // dragged out of it, and the window draws it and takes the drop.
  const carried = useRef<{ link: WebLink; image: HTMLElement } | null>(null);
  useEffect(() => () => carried.current?.image.remove(), []);
  const carryLink = (reply: {
    phase?: unknown;
    url?: unknown;
    title?: unknown;
    x?: unknown;
    y?: unknown;
  }) => {
    const frame = frameRef.current;
    if (!frame || typeof reply.x !== "number" || typeof reply.y !== "number") return;
    const { left, top } = frame.getBoundingClientRect();
    const [x, y] = [left + reply.x, top + reply.y];
    if (reply.phase === "start") {
      const { link: address } = readPageHit({ link: reply.url });
      if (!address) return;
      const title = typeof reply.title === "string" ? reply.title.slice(0, 200) : "";
      const image = document.createElement("div");
      image.className = "mac-desktop-drag";
      image.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "mac-desktop-drag-name";
      name.textContent = title || address;
      image.append(name);
      document.body.append(image);
      carried.current = { link: { title: title || address, url: address }, image };
    }
    const carrying = carried.current;
    if (!carrying) return;
    carrying.image.style.setProperty("translate", `${x + 8}px ${y}px`);
    if (reply.phase !== "end") return;
    carrying.image.remove();
    carried.current = null;
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit.closest(".mac-safari") !== titleBar?.closest(".mac-safari")) return;
    if (hit.closest('[role="tablist"]')) openInNewTab(carrying.link.url);
    else if (hit.closest(".mac-smart-search-field")) navigate(carrying.link.url);
    else if (
      hit.closest(".mac-safari-favorites-bar") &&
      !shownFavorites.some((one) => one.url === carrying.link.url)
    ) {
      addFavoriteAt(hit, carrying.link);
    }
  };

  frameReplies.current = (data) => {
    const reply = data as {
      type?: unknown;
      query?: unknown;
      count?: unknown;
      hit?: unknown;
      fresh?: unknown;
      back?: unknown;
      text?: unknown;
      purpose?: unknown;
      key?: unknown;
      shift?: unknown;
      alt?: unknown;
      ctrl?: unknown;
      meta?: unknown;
      x?: unknown;
      y?: unknown;
      link?: unknown;
      linkText?: unknown;
      image?: unknown;
      phase?: unknown;
      url?: unknown;
      title?: unknown;
    };
    if (reply.type === "link-drag") {
      carryLink(reply);
      return;
    }
    if (reply.type === "selected") {
      reportSelection(typeof reply.text === "string" ? reply.text : "");
      return;
    }
    if (reply.type === "menu") {
      const frame = frameRef.current;
      if (!frame || typeof reply.x !== "number" || typeof reply.y !== "number") return;
      setPageHit(readPageHit(reply));
      const { left, top } = frame.getBoundingClientRect();
      frame.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: left + reply.x,
          clientY: top + reply.y,
        }),
      );
      return;
    }
    if (reply.type === "found" && typeof reply.count === "number") {
      const count = reply.count;
      setFind((now) => {
        if (!now || now.query !== reply.query) return now;
        // Only a new search counts: stepping keeps the number it found.
        if (reply.fresh) return { ...now, count, at: reply.hit ? 1 : 0 };
        return reply.hit ? { ...now, at: nextMatch(now, reply.back === true) } : now;
      });
    } else if (reply.type === "selection" && typeof reply.text === "string") {
      if (reply.purpose === "find" && reply.text !== "") {
        searchPage(reply.text);
        takeFindKeyboard();
      } else if (reply.purpose === "copy" && reply.text !== "") {
        void copyText(reply.text);
      }
    } else if (reply.type === "key" && typeof reply.key === "string" && reply.key.length < 20) {
      runKey(
        new globalThis.KeyboardEvent("keydown", {
          key: reply.key,
          shiftKey: reply.shift === true,
          altKey: reply.alt === true,
          ctrlKey: reply.ctrl === true,
          metaKey: reply.meta === true,
        }),
      );
    }
  };

  const nextTab = (step: number) => {
    const at = tabs.findIndex((tab) => tab.id === active.id);
    const next = tabs[(at + step + tabs.length) % tabs.length];
    if (next) show(next.id);
  };
  /** Each command: its title, key equivalent, whether it can run now, and what it does. */
  type Command = {
    title: string;
    key?: string;
    enabled: boolean;
    run: () => void;
    /** Why it is dimmed, when that is not plain from the window. */
    reason?: string;
    /** Its key stays with whatever has the keyboard, a text field's or the page's own. */
    menuOnly?: boolean;
  };
  const commands = {
    openFile: {
      title: "Open File…",
      key: "command+o",
      enabled: online,
      run: () => setOpeningFile(true),
    },
    savePage: {
      title: "Save As…",
      key: "command+s",
      enabled: pageShown,
      run: () => setSavingAs(true),
    },
    exportPdf: {
      title: "Export as PDF…",
      enabled: pageShown,
      run: () => postToPage({ type: "print" }),
    },
    print: {
      title: "Print…",
      key: "command+p",
      enabled: pageShown,
      run: () => postToPage({ type: "print" }),
    },
    importBookmarks: {
      title: "Bookmarks HTML File…",
      enabled: online,
      run: () => bookmarksPicker.current?.click(),
    },
    exportBookmarks: {
      title: "Export Bookmarks…",
      enabled: online,
      run: () => {
        const html = bookmarksToHtml([
          { title: "Favorites", links: shownFavorites },
          { title: "Bookmarks", links: savedBookmarks },
          ...savedFolders,
        ]);
        void saveToDownloads(new Blob([html], { type: "text/html" }), "Safari Bookmarks.html").then(
          afterSave(""),
        );
      },
    },
    newPrivate: {
      title: "New Private Window",
      key: "shift+command+n",
      enabled: online,
      run: () => openSafariWindow({ isPrivate: true }),
    },
    closeWindow: {
      title: "Close Window",
      key: "shift+command+w",
      enabled: onClose !== undefined,
      run: () => latest.current.closeWindow(),
    },
    moveTab: {
      title: "Move Tab to New Window",
      enabled: online && tabs.length > 1 && !active.pinKey,
      reason: active.pinKey ? NO_PIN_MOVE : undefined,
      run: () => moveToNewWindow(active),
    },
    pinTab: {
      title: active.pinned ? "Unpin Tab" : "Pin Tab",
      enabled: online,
      run: () => togglePin(active.id),
    },
    downloads: {
      title: "Downloads",
      key: "option+command+l",
      enabled: online && downloads.length > 0,
      run: () => setDownloadsOpen((now) => !now),
    },
    snapBack: {
      title: "Search Results SnapBack",
      key: "option+command+s",
      enabled: snapBackAt >= 0,
      run: () => step(snapBackAt - active.index),
    },
    clearHistory: {
      title: "Clear History…",
      enabled: online,
      run: () => setClearingHistory(true),
    },
    mergeWindows: {
      title: "Merge All Windows",
      enabled: online && otherWindows(thisWindow).length > 0,
      run: () => mergeWindows(thisWindow),
    },
    reopenWindow: {
      title: "Reopen Last Closed Window",
      enabled: online && hasClosedWindow(),
      run: reopenClosedWindow,
    },
    reopenSession: {
      title: "Reopen All Windows from Last Session",
      enabled: online && hasLastSession(),
      run: reopenLastSession,
    },
    copy: {
      title: "Copy",
      key: "command+c",
      enabled: pageShown,
      reason: "No page is shown to copy from.",
      menuOnly: true,
      run: () => postToPage({ type: "selection", purpose: "copy" }),
    },
    selectAll: {
      title: "Select All",
      key: "command+a",
      enabled: pageShown,
      reason: "No page is shown to select.",
      menuOnly: true,
      run: () => postToPage({ type: "select-all" }),
    },
    find: {
      title: "Find…",
      key: "command+f",
      enabled: pageShown || findsHere,
      reason: NO_FIND_HERE,
      run: () => {
        setFind((now) => now ?? { query: "", count: 0, at: 0 });
        takeFindKeyboard();
      },
    },
    findNext: {
      title: "Find Next",
      key: "command+g",
      enabled: (pageShown || findsHere) && Boolean(find?.query),
      run: () => stepFind(false),
    },
    findPrevious: {
      title: "Find Previous",
      key: "shift+command+g",
      enabled: (pageShown || findsHere) && Boolean(find?.query),
      run: () => stepFind(true),
    },
    useSelection: {
      title: "Use Selection for Find",
      key: "command+e",
      enabled: pageShown || findsHere,
      run: () => {
        if (pageShown) {
          postToPage({ type: "selection", purpose: "find" });
          return;
        }
        const text = String(window.getSelection() ?? "");
        if (text !== "") {
          searchPage(text);
          takeFindKeyboard();
        }
      },
    },
    jump: {
      title: "Jump to Selection",
      key: "command+j",
      enabled: pageShown || findsHere,
      run: () => {
        if (pageShown) {
          postToPage({ type: "jump" });
          return;
        }
        window.getSelection()?.anchorNode?.parentElement?.scrollIntoView?.({ block: "center" });
      },
    },
    actualSize: {
      title: "Actual Size",
      key: "command+0",
      enabled: pageShown && zoom !== 1,
      run: () => setPageZoom(1),
    },
    zoomIn: {
      title: "Zoom In",
      key: "command+=",
      enabled: pageShown && zoom < (PAGE_ZOOMS.at(-1) ?? 1),
      run: () => setPageZoom(PAGE_ZOOMS[zoomIndex + 1] ?? zoom),
    },
    zoomOut: {
      title: "Zoom Out",
      key: "command+-",
      enabled: pageShown && zoom > (PAGE_ZOOMS[0] ?? 1),
      run: () => setPageZoom(PAGE_ZOOMS[zoomIndex - 1] ?? zoom),
    },
    previousTab: {
      title: "Show Previous Tab",
      key: "shift+control+tab",
      enabled: tabs.length > 1 && !overview,
      run: () => nextTab(-1),
    },
    nextTab: {
      title: "Show Next Tab",
      key: "control+tab",
      enabled: tabs.length > 1 && !overview,
      run: () => nextTab(1),
    },
    newTab: { title: "New Tab", key: "command+t", enabled: true, run: newTab },
    reopen: {
      title: "Reopen Last Closed Tab",
      key: "shift+command+t",
      enabled: closedTabs.current.length > 0,
      run: reopenClosedTab,
    },
    location: { title: "Open Location…", key: "command+l", enabled: true, run: openLocation },
    closeTab: {
      title: "Close Tab",
      key: "command+w",
      // The last tab goes with its window, as on a Mac: the key closes it, and the row stays dimmed
      // since File > Close Window is there for it.
      enabled: tabs.length <= 1 ? onClose !== undefined : tabs.some((tab) => !tab.pinned),
      // A pinned tab stays: the key shows the first tab that can close, as on a Mac.
      run: () => {
        if (tabs.length <= 1) latest.current.closeWindow();
        else if (active.pinned) show((tabs.find((tab) => !tab.pinned) as Tab).id);
        else closeTab(active.id);
      },
    },
    closeOthers: {
      title: "Close Other Tabs",
      key: "option+command+w",
      enabled: tabs.length > 1,
      run: () => closeTabsBut([active.id], active.id),
    },
    tabBar: {
      title: showTabBar ? "Hide Tab Bar" : "Show Tab Bar",
      enabled: tabs.length <= 1 && !overview,
      run: () => setAlwaysTabBar(!alwaysTabBar),
    },
    favoritesBar: {
      title: favoritesBarShown ? "Hide Favorites Bar" : "Show Favorites Bar",
      key: "shift+command+b",
      enabled: online,
      run: () => setFavoritesBarShown(!favoritesBarShown),
    },
    statusBar: {
      title: statusBarShown ? "Hide Status Bar" : "Show Status Bar",
      key: "command+/",
      enabled: online,
      run: () => setStatusBarShown(!statusBarShown),
    },
    sidebar: {
      title: sidebarOpen ? "Hide Sidebar" : "Show Sidebar",
      key: "shift+command+l",
      enabled: !overview,
      run: () => setSidebarOpen(!sidebarOpen),
    },
    overview: {
      title: overview ? "Exit Tab Overview" : "Show Tab Overview",
      key: "shift+command+\\",
      enabled: true,
      run: toggleOverview,
    },
    stop: { title: "Stop", key: "command+.", enabled: loading, run: () => stop(active.id) },
    reload: {
      title: "Reload Page",
      key: "command+r",
      enabled: canReload && !loading,
      run: () => load(active.id, url, true),
    },
    reader: {
      title: reading ? "Hide Reader" : "Show Reader",
      key: "shift+command+r",
      enabled: canRead && !overview,
      run: toggleReader,
    },
    history: {
      title: "Show All History",
      key: "command+y",
      enabled: online,
      run: () => navigate(HISTORY_PAGE),
    },
    back: { title: "Back", key: "command+[", enabled: canBack, run: () => step(-1) },
    forward: { title: "Forward", key: "command+]", enabled: canForward, run: () => step(1) },
    home: {
      title: "Home",
      key: "shift+command+h",
      enabled: true,
      run: () => navigate(homeAddress),
    },
    bookmarks: {
      title: "Show Bookmarks",
      key: "control+command+1",
      enabled: true,
      run: () => showList("bookmarks"),
    },
    editBookmarks: {
      title: "Edit Bookmarks",
      key: "option+command+b",
      enabled: online,
      run: () => navigate(BOOKMARKS_PAGE),
    },
    addTabs: {
      title: "Add Bookmarks for These Tabs…",
      enabled: online && savedFolders.length < MAX_BOOKMARK_FOLDERS && webTabLinks().length > 0,
      run: () => setAddingTabs(true),
    },
    readingList: {
      title: "Show Reading List",
      key: "control+command+2",
      enabled: true,
      run: () => showList("reading-list"),
    },
    addBookmark: { title: "Add Bookmark…", key: "command+d", enabled: sharable, run: addBookmark },
    addFolder: {
      title: "Add Bookmark Folder…",
      enabled: online && savedFolders.length < MAX_BOOKMARK_FOLDERS,
      reason: `Safari keeps at most ${MAX_BOOKMARK_FOLDERS} bookmark folders.`,
      run: () => setAddingFolder(true),
    },
    addToReadingList: {
      title: "Add to Reading List",
      key: "shift+command+d",
      enabled: sharable,
      run: addToReadingList,
    },
  } satisfies Record<string, Command>;
  const row = (command: Command) => (
    <MenuItem
      key={command.title}
      keyEquivalent={command.key}
      disabled={!command.enabled}
      title={command.enabled ? undefined : command.reason}
      onClick={command.run}
    >
      {command.title}
    </MenuItem>
  );
  /** A row of a text field's own editing, dimmed while no field has the keyboard. */
  const dimmedRow = (title: string, key: string) => (
    <MenuItem key={title} keyEquivalent={key} disabled title={NO_EDIT_FIELD}>
      {title}
    </MenuItem>
  );
  /** A link in a menu: a recent visit or a favourite, opened in the tab in front. */
  const linkRow = (link: WebLink, index: number) => (
    <MenuItem key={`${index} ${link.url}`} onClick={() => navigate(link.url)}>
      {link.title || link.url}
    </MenuItem>
  );
  const recent = online ? visits.slice(0, MENU_VISITS) : [];
  const earlierDays = online
    ? visitsByDay(visits.slice(MENU_VISITS), Date.now()).slice(0, MENU_DAYS)
    : [];
  const menuFavorites = online ? shownFavorites.slice(0, MENU_FAVORITES) : [];
  useDesktopAppMenu(
    "safari",
    "Dock",
    <>
      <MenuItem onClick={commands.newTab.run}>{commands.newTab.title}</MenuItem>
      <MenuSeparator />
      {tabs.map((tab) => (
        <MenuItem key={tab.id} onClick={() => show(tab.id)}>
          {titleOf(tab)}
        </MenuItem>
      ))}
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "safari",
    "File",
    <>
      {online ? row(commands.newPrivate) : null}
      {row(commands.newTab)}
      {row(commands.reopen)}
      {row(commands.location)}
      {online ? row(commands.openFile) : null}
      <MenuSeparator />
      {row(tabs.length > 1 ? commands.closeTab : { ...commands.closeTab, enabled: false })}
      {row(commands.closeOthers)}
      {online ? (
        <>
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger disabled={!sharable}>Share</SubmenuTrigger>
            <SubmenuPopup>
              <LinkShareItems plain url={url} title={titleOf(active)} from="safari" />
              <MenuSeparator />
              <MenuItem disabled title={NO_MORE_EXTENSIONS}>
                More…
              </MenuItem>
            </SubmenuPopup>
          </Submenu>
          {row(commands.savePage)}
          {row(commands.exportPdf)}
          {row(commands.print)}
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Import From</SubmenuTrigger>
            <SubmenuPopup>
              <MenuItem disabled title={OTHER_BROWSER}>
                Google Chrome…
              </MenuItem>
              <MenuItem disabled title={OTHER_BROWSER}>
                Firefox…
              </MenuItem>
              {row(commands.importBookmarks)}
            </SubmenuPopup>
          </Submenu>
          {row(commands.exportBookmarks)}
        </>
      ) : null}
    </>,
    titleBar,
  );
  const editAfterPaste = online ? (
    <>
      <MenuItem disabled title={NO_RICH_PASTE}>
        Paste and Match Style
      </MenuItem>
      <MenuItem disabled title={NO_PAGE_EDIT}>
        Delete
      </MenuItem>
    </>
  ) : null;
  useDesktopAppMenu(
    "safari",
    "Edit",
    <>
      {/* The page's frame keeps its selection to itself, so while it is in front Copy and Select All
          go to it; with a text field in hand they are that field's, as all the rows are. */}
      {pageShown && !fieldHeld ? (
        <>
          {dimmedRow("Undo", "command+z")}
          {dimmedRow("Redo", "shift+command+z")}
          <MenuSeparator />
          {dimmedRow("Cut", "command+x")}
          {row(commands.copy)}
          {dimmedRow("Paste", "command+v")}
          {editAfterPaste}
          {row(commands.selectAll)}
        </>
      ) : (
        <EditRows
          nothing={NO_EDIT_FIELD}
          selectAll={{
            enabled: commands.selectAll.enabled,
            title: commands.selectAll.reason,
            run: commands.selectAll.run,
          }}
          say={(message) => setEditProblem({ title: "Safari could not paste", message })}
          afterPaste={editAfterPaste}
        />
      )}
      {online ? (
        <MenuItem disabled keyEquivalent="shift+command+a" title={NO_AUTOFILL}>
          AutoFill Form
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Find</SubmenuTrigger>
        <SubmenuPopup>
          {row(commands.find)}
          {row(commands.findNext)}
          {row(commands.findPrevious)}
          {row(commands.useSelection)}
          {row(commands.jump)}
        </SubmenuPopup>
      </Submenu>
      {online ? (
        <>
          <MenuItem disabled title={BROWSER_TEXT}>
            Spelling and Grammar
          </MenuItem>
          <MenuItem disabled title={BROWSER_TEXT}>
            Substitutions
          </MenuItem>
          <MenuItem disabled title={BROWSER_TEXT}>
            Transformations
          </MenuItem>
          <MenuItem disabled title={BROWSER_TEXT}>
            Speech
          </MenuItem>
        </>
      ) : null}
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "safari",
    "Window",
    <>
      {row(commands.previousTab)}
      {row(commands.nextTab)}
      {online ? row(commands.moveTab) : null}
      {online ? row(commands.pinTab) : null}
      {online ? row(commands.mergeWindows) : null}
      {online ? row(commands.downloads) : null}
      <MenuSeparator />
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "safari",
    "View",
    <>
      {row(commands.tabBar)}
      {online ? row(commands.favoritesBar) : null}
      {online ? row(commands.statusBar) : null}
      {row(commands.sidebar)}
      {row(commands.overview)}
      <MenuSeparator />
      {row(commands.stop)}
      {row(commands.reload)}
      <MenuSeparator />
      {row(commands.actualSize)}
      {row(commands.zoomIn)}
      {row(commands.zoomOut)}
      <MenuSeparator />
      {row(commands.reader)}
      {online ? (
        <>
          <MenuItem disabled title={NO_SOUND}>
            Mute Tab
          </MenuItem>
          <MenuSeparator />
          <MenuItem disabled title="Safari's toolbar here has its one arrangement.">
            Customize Toolbar…
          </MenuItem>
          <MenuItem disabled title="The server reads each page in the encoding the page names.">
            Text Encoding
          </MenuItem>
        </>
      ) : null}
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "safari",
    "Help",
    online ? (
      <>
        <MenuItem onClick={() => requestHelp("Safari")}>Safari Help</MenuItem>
        <MenuItem disabled title="Safari in a browser runs no plug-ins.">
          Installed Plug-ins
        </MenuItem>
      </>
    ) : null,
    titleBar,
  );
  useDesktopAppMenu(
    "safari",
    "History",
    <>
      {online ? row(commands.history) : null}
      {row(commands.back)}
      {row(commands.forward)}
      {row(commands.home)}
      {online ? row(commands.snapBack) : null}
      {online ? row(commands.reopenWindow) : null}
      {online ? row(commands.reopenSession) : null}
      {recent.length > 0 ? <MenuSeparator /> : null}
      {recent.map(linkRow)}
      {earlierDays.length > 0 ? <MenuSeparator /> : null}
      {earlierDays.map(({ day, visits: ofDay }) => (
        <Submenu key={day}>
          <SubmenuTrigger>{day === "Today" ? "Earlier Today" : day}</SubmenuTrigger>
          <SubmenuPopup>{ofDay.map(linkRow)}</SubmenuPopup>
        </Submenu>
      ))}
      {online ? <MenuSeparator /> : null}
      {online ? row(commands.clearHistory) : null}
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "safari",
    "Safari",
    online ? (
      <>
        <MenuItem disabled title="Safari in a browser runs no extensions.">
          Safari Extensions…
        </MenuItem>
        {row(commands.clearHistory)}
      </>
    ) : null,
    titleBar,
  );
  useDesktopAppMenu(
    "safari",
    "Bookmarks",
    <>
      {row(commands.bookmarks)}
      {row(commands.editBookmarks)}
      {row(commands.readingList)}
      <MenuSeparator />
      {row(commands.addBookmark)}
      {row(commands.addTabs)}
      {row(commands.addToReadingList)}
      {row(commands.addFolder)}
      {menuFavorites.length > 0 ? <MenuSeparator /> : null}
      {menuFavorites.map(linkRow)}
    </>,
    titleBar,
  );
  /** Whether a key is a command's, run if it can be: from the window, or sent up by the page. */
  const runKey = (event: globalThis.KeyboardEvent): boolean => {
    const command = Object.values(commands).find(
      (each: Command) => each.key && !each.menuOnly && matchesMenuKeyEquivalent(event, each.key),
    );
    if (command) {
      // The key is the command's even while it is dimmed, as in a Mac's menu bar.
      if (command.enabled) command.run();
      return true;
    }
    // Command-1 to Command-9 show the tabs when Preferences say so, or else open the Favorites
    // bar's bookmarks, as in Safari.
    const digit =
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      !event.altKey &&
      /^[1-9]$/.test(event.key)
        ? Number(event.key) - 1
        : -1;
    if (digit >= 0 && option(TAB_KEYS)) {
      const tab = tabs[digit];
      if (tab) show(tab.id);
      return tab !== undefined;
    }
    const favorite = online && digit >= 0 ? shownFavorites[digit] : undefined;
    if (favorite) {
      navigate(favorite.url);
      return true;
    }
    return false;
  };
  // A key that scrolls, while nothing else has the keyboard: the window, or nothing after Return in
  // the address field. In the frame the browser scrolls the page by itself.
  const scrollKey = useRef((_event: globalThis.KeyboardEvent) => {});
  scrollKey.current = (event) => {
    if (!pageShown || !windowInFront || event.defaultPrevented) return;
    const target = event.target;
    const root = titleBar?.closest(".mac-safari");
    if (target !== document.body && target !== document.documentElement && target !== root) return;
    if (event.altKey || !PAGE_SCROLL_KEYS.has(event.key)) return;
    const commanded = event.metaKey || event.ctrlKey;
    if (commanded && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    postToPage({
      type: "scroll",
      key: commanded ? (event.key === "ArrowUp" ? "Home" : "End") : event.key,
      shift: event.shiftKey,
    });
  };
  useEffect(() => {
    const hear = (event: globalThis.KeyboardEvent) => scrollKey.current(event);
    document.addEventListener("keydown", hear);
    return () => document.removeEventListener("keydown", hear);
  }, []);
  const onWindowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (runKey(event.nativeEvent)) event.preventDefault();
  };
  // The sidebar's lists: on the Ferrite desktop app, the person's own.
  const link = (item: WebLink): SafariBookmark => ({
    label: item.title || item.url,
    url: item.url,
  });
  const sidebarBookmarks: readonly SafariBookmark[] = online
    ? [
        {
          label: "Favorites",
          star: true,
          expanded: true,
          children: shownFavorites.map((each) => ({ ...link(each), list: "favorites" as const })),
        },
        { label: "History", url: HISTORY_PAGE },
        ...savedBookmarks.map(link),
        ...savedFolders.map((folder) => ({
          label: folder.title,
          children: folder.links.map((each) => ({
            ...link(each),
            list: "bookmarks" as const,
            folder: folder.title,
          })),
        })),
      ]
    : bookmarks;
  const sidebarReadingList: readonly SafariBookmark[] = online ? saved.map(link) : readingList;

  // A web page: loading, fetched by the server (or its Reader), one that opens outside, or a
  // failure.
  let webView: ReactNode = null;
  if (isWeb) {
    const key = `${active.id} ${url}`;
    if (!webState || webState.status === "loading") {
      webView = (
        <WebView key={key} title="Loading" className="mac-safari-view">
          <WebViewProgress value={null} aria-label="Loading page" />
        </WebView>
      );
    } else if (webState.status === "ready") {
      webView =
        reading && webReadable ? (
          <SafariWebReader
            key={`${key} reader`}
            page={webReadable}
            fontSize={readerOptions.size}
            fontFamily={READER_FONTS[readerOptions.font]?.family}
            theme={readerOptions.theme}
          />
        ) : (
          <ContextualMenu open={pageMenuOpen} onOpenChange={setPageMenuOpen}>
            <ContextualMenuTrigger className="mac-safari-tab-menu">
              <SafariFetchedPage
                key={key}
                page={webState.page}
                loading={loading}
                frameRef={frameRef}
                onFrameLoad={() => postToPage({ type: "zoom", scale: zoom })}
              />
            </ContextualMenuTrigger>
            <ContextualMenuPopup aria-label="Page">
              {pageHit ? <SafariPageMenuItems hit={pageHit} actions={pageMenu} /> : null}
            </ContextualMenuPopup>
          </ContextualMenu>
        );
    } else if (webState.status === "outside") {
      const outside = webState.url;
      webView = (
        <SafariOutsidePage
          key={key}
          url={outside}
          checked={webState.checked}
          onOpened={() => {
            if (!isPrivate) void rememberOutside(outside, "").then(refreshVisits);
          }}
        />
      );
    } else if (webState.status === "failed") {
      webView = <SafariFailurePage key={key} failure={webState.failure} />;
    } else {
      webView = <WebView key={key} title={titleOf(active)} className="mac-safari-view" />;
    }
  }

  // A link's row stays selected while its page is in front. Once the tab shows another page
  // the row is free again, so choosing it once more loads its page once more.
  const chosenAddress = chosenRow?.split(" ")[1];
  const selectedRow = chosenAddress && !samePage(chosenAddress, url) ? null : chosenRow;

  // The Picture in Picture window, while a tab's video is in it. It floats in the element it
  // is given, or else over the page: it stays while another tab is in front.
  const floatingTab = tabs.find((tab) => tab.id === floatingId);
  const floatingPage = floatingTab ? pageAt(floatingTab.history[floatingTab.index] ?? "") : null;
  const floating =
    floatingTab && floatingPage?.kind === "site" ? (
      <PictureInPicture
        open
        onOpenChange={(open) => {
          if (!open) setFloatingId(null);
        }}
        onReturn={() => show(floatingTab.id)}
        defaultWidth={pictureInPictureWidth}
      >
        <SafariVideoFrame
          tint={floatingPage.site.tint}
          host={artwork ? floatingPage.site.host : undefined}
          floating
        />
      </PictureInPicture>
    ) : null;
  const floatingInWindow = pictureInPictureContainer === undefined ? floating : null;

  const startShowsBookmarks = choiceOf(settings, "favorites") === "Bookmarks Menu";
  const view = overview ? (
    <WebView surface="overview" title="Tab Overview" className="mac-safari-view">
      <WebViewTabOverview aria-label="Open tabs">
        {tabs.map((tab) => (
          <WebViewTabThumbnail
            key={tab.id}
            title={titleOf(tab)}
            aria-current={tab.id === activeId ? "true" : undefined}
            onClick={() => show(tab.id)}
          >
            <SafariMiniature page={pageAt(tab.history[tab.index] ?? START_PAGE)} />
          </WebViewTabThumbnail>
        ))}
        <WebViewTabThumbnail variant="new-tab" aria-label="New Tab" onClick={newTab} />
      </WebViewTabOverview>
    </WebView>
  ) : url === EMPTY_PAGE ? (
    <WebView key={`${active.id} empty`} title="Untitled" className="mac-safari-view" />
  ) : online && url === BOOKMARKS_PAGE ? (
    <SafariBookmarksPage
      key={active.id}
      library={{ favorites: shownFavorites, bookmarks: savedBookmarks, folders: savedFolders }}
      anchor={titleBar}
      onChange={(next) => {
        setFavorites(next.favorites);
        setSavedBookmarks(next.bookmarks);
        setSavedFolders(next.folders);
      }}
      onOpen={navigate}
      onOpenInNewTab={openInNewTab}
    />
  ) : online && url === HISTORY_PAGE ? (
    <SafariHistoryPage
      key={active.id}
      reading={historyRead}
      onOpen={navigate}
      onOpenInNewTab={openInNewTab}
      onClear={() => setClearingHistory(true)}
      onForgotten={refreshVisits}
    />
  ) : online && page.kind === "start" ? (
    <ContextualMenu key={`start ${active.id}`}>
      <ContextualMenuTrigger className="mac-safari-tab-menu" onContextMenu={onLinkMenu}>
        <SafariWebStart
          favorites={startShowsBookmarks ? savedBookmarks : shownFavorites}
          favoritesList={startShowsBookmarks ? "bookmarks" : "favorites"}
          frequent={frequentlyVisited(visits, Number.parseInt(choiceOf(settings, "topSites"), 10))}
          readingList={saved}
          onOpen={navigate}
          onShowHistory={() => navigate(HISTORY_PAGE)}
        />
      </ContextualMenuTrigger>
      {linkMenuPopup}
    </ContextualMenu>
  ) : isWeb ? (
    webView
  ) : page.kind === "start" ? (
    <WebView key={active.id} surface="start" title="Start Page" className="mac-safari-view">
      <WebViewFavorites heading="Favorites">
        {FAVORITES.map((item, index) => {
          const site = item.site;
          return site ? (
            <WebViewFavorite
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list; two entries share a label.
              key={index}
              href={`https://${site.host}/`}
              label={item.label}
              onClick={(event) => {
                event.preventDefault();
                navigate(`https://${site.host}/`);
              }}
            >
              <SafariFavoriteArtwork site={site} artwork={artwork} />
            </WebViewFavorite>
          ) : (
            <WebViewFavorite
              // biome-ignore lint/suspicious/noArrayIndexKey: as above.
              key={index}
              label={item.label}
              detail={item.detail}
              render={<button type="button" />}
              onClick={() => {
                setSidebarList("bookmarks");
                setSidebarOpen(true);
              }}
            >
              <SafariFolderArtwork
                offset={index}
                count={item.detail?.startsWith("4") ? 4 : 6}
                artwork={artwork}
              />
            </WebViewFavorite>
          );
        })}
      </WebViewFavorites>
    </WebView>
  ) : page.kind === "error" ? (
    <WebView key={`${active.id} ${url}`} title={page.title} className="mac-safari-view">
      <WebViewError title="Safari Can’t Open the Page">
        Safari can’t open “{page.host}” because this demo has no network. Only its own placeholder
        pages open: any address that ends in .example.
      </WebViewError>
    </WebView>
  ) : reading && page.kind === "site" ? (
    <WebView
      key={`${active.id} ${url} reader`}
      surface="reader"
      title={`Reader: ${page.title}`}
      className="mac-safari-view"
    >
      <WebViewReader style={{ fontSize: READER_SIZES[readerSize] }}>
        <WebViewReaderTitle>{page.site.heading}</WebViewReaderTitle>
        {page.site.paragraphs.slice(0, 2).map((paragraph) => (
          <p key={paragraph} className="mac-safari-reader-paragraph">
            {paragraph}
          </p>
        ))}
        <SafariPicture tint={page.site.tint} host={artwork ? page.site.host : undefined} reader />
        {page.site.paragraphs.slice(2).map((paragraph) => (
          <p key={paragraph} className="mac-safari-reader-paragraph">
            {paragraph}
          </p>
        ))}
      </WebViewReader>
    </WebView>
  ) : (
    <WebView key={`${active.id} ${url}`} title={page.title} className="mac-safari-view">
      {loading ? <WebViewProgress value={null} aria-label="Loading page" /> : null}
      {page.kind === "search" ? (
        <SafariSearchPage query={page.query} results={page.results} onNavigate={navigate} />
      ) : (
        <SafariSitePage
          site={page.site}
          onNavigate={navigate}
          pictureInPicture={active.id === floatingId}
          onPictureInPicture={() => setFloatingId(active.id)}
          artwork={artwork}
        />
      )}
    </WebView>
  );

  return (
    <SafariDownloadsContext value={noteDownload}>
      <Window
        aria-label="Safari"
        width={width}
        height={height}
        className={className ? `mac-safari ${className}` : "mac-safari"}
        data-private={isPrivate ? "" : undefined}
        style={thumbnailAspect ? { ...thumbnailAspect, ...style } : style}
        {...props}
        // Focusable from script only: it takes the keyboard back when a closed tab had it.
        tabIndex={-1}
        onDragOver={(event) => {
          if (online && event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDrop={(event) => {
          const files = [...event.dataTransfer.files].filter(
            (file) => isPageFile(file) || isLinkFile(file),
          );
          if (!online || files.length === 0) return;
          event.preventDefault();
          for (const file of files) openLocalFile(file);
        }}
        onKeyDown={onWindowKeyDown}
        onFocusCapture={(event) => {
          props.onFocusCapture?.(event);
          const target = event.target as Element;
          setFieldHeld(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement);
        }}
      >
        {online ? (
          <>
            <input
              ref={linkPicker}
              type="file"
              hidden
              aria-label="Open File"
              accept=".webloc,.url,.html,.htm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                setOpeningFile(false);
                if (file) openLocalFile(file);
              }}
            />
            <input
              ref={bookmarksPicker}
              type="file"
              hidden
              aria-label="Import Bookmarks"
              accept=".html,.htm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void file.text().then((text) => {
                  const found = bookmarksFromHtml(text);
                  if (found.length === 0) {
                    setSaveProblem(`“${file.name}” holds no bookmarks.`);
                    return;
                  }
                  setSavedBookmarks((list) => [
                    ...list,
                    ...found.filter((link) => !list.some((other) => other.url === link.url)),
                  ]);
                });
              }}
            />
          </>
        ) : null}
        {saveProblem ? (
          <Sheet
            open
            onOpenChange={(open) => {
              if (!open) setSaveProblem(null);
            }}
          >
            <SheetPopup anchor={titleBar} width={420}>
              <SheetTitle>Safari could not save the file</SheetTitle>
              <SheetDescription>{saveProblem}</SheetDescription>
              <SheetActions>
                <SheetClose render={<DefaultButton />}>OK</SheetClose>
              </SheetActions>
            </SheetPopup>
          </Sheet>
        ) : null}
        {editProblem ? (
          <Sheet
            open
            onOpenChange={(open) => {
              if (!open) setEditProblem(null);
            }}
          >
            <SheetPopup anchor={titleBar} width={420}>
              <SheetTitle>{editProblem.title}</SheetTitle>
              <SheetDescription>{editProblem.message}</SheetDescription>
              <SheetActions>
                <SheetClose render={<DefaultButton />}>OK</SheetClose>
              </SheetActions>
            </SheetPopup>
          </Sheet>
        ) : null}
        {savingAs && webState?.status === "ready" ? (
          <Sheet
            open
            onOpenChange={(open) => {
              if (!open) setSavingAs(false);
            }}
          >
            <SheetPopup anchor={titleBar} width={640} aria-label="Save As">
              <DriveSavePanel
                defaultName={pageFileName(webState.page.title, "html")}
                defaultFolder={SPECIAL_FOLDER_IDS.Downloads}
                accessory={
                  <div className="mac-safari-save-format">
                    <Label>Format:</Label>
                    <PopUpButton aria-label="Format" defaultValue="source">
                      <PopUpButtonItem value="source">Page Source</PopUpButtonItem>
                      <PopUpButtonItem value="archive" disabled title={NO_WEB_ARCHIVE}>
                        Web Archive
                      </PopUpButtonItem>
                    </PopUpButton>
                  </div>
                }
                nameToSave={(name) => (/\.html?$/i.test(name) ? name : `${name}.html`)}
                onCancel={() => setSavingAs(false)}
                onSave={(target) => {
                  setSavingAs(false);
                  savePageTo(target, webState.page.html, webState.page.url);
                }}
              />
            </SheetPopup>
          </Sheet>
        ) : null}
        {openingFile ? (
          <Sheet
            open
            onOpenChange={(open) => {
              if (!open) setOpeningFile(false);
            }}
          >
            <SheetPopup anchor={titleBar} width={660} aria-label="Open File">
              <DriveOpenPanel
                accept={(entry) => isPageFile(entry) || isLinkFile(entry)}
                defaultFolder={SPECIAL_FOLDER_IDS.Downloads}
                width={660}
                height={400}
                leading={
                  <PushButton onClick={() => linkPicker.current?.click()}>
                    From This Computer…
                  </PushButton>
                }
                onCancel={() => setOpeningFile(false)}
                onOpen={(entry) => {
                  setOpeningFile(false);
                  openDriveFile(entry.id, entry.name);
                }}
              />
            </SheetPopup>
          </Sheet>
        ) : null}
        {clearingHistory ? (
          <SafariClearHistorySheet
            anchor={titleBar}
            onCancel={() => setClearingHistory(false)}
            onClear={(range) => {
              setClearingHistory(false);
              // Back and Forward are history too: each tab keeps only the page it shows.
              setTabs((all) =>
                all.map((tab) => ({ ...tab, history: [addressOfTab(tab)], index: 0 })),
              );
              const since = clearRangeStart(range, Date.now());
              void (since === null ? clearHistory() : forgetHistory({ since })).then((done) => {
                if (!done) return;
                refreshVisits();
                setHistoryRead((now) => now + 1);
              });
            }}
          />
        ) : null}
        <TitleBar
          ref={setTitleBar}
          variant="title-hidden"
          divider={showTabBar ? "bar" : "content"}
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
          <Toolbar aria-label="Safari toolbar">
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-safari-tab-menu"
                onContextMenu={(event) => {
                  const pressed = (event.target as Element).closest("button");
                  setHistoryMenu(pressed?.getAttribute("aria-label") === "Forward" ? 1 : -1);
                }}
                onPointerDownCapture={(event) => {
                  const pressed = (event.target as Element).closest("button");
                  if (!pressed || event.button !== 0) return;
                  const { clientX, clientY } = event;
                  clearTimeout(holdTimer.current);
                  holdTimer.current = setTimeout(() => {
                    pressed.dispatchEvent(
                      new MouseEvent("contextmenu", { bubbles: true, clientX, clientY }),
                    );
                  }, HOLD_MS);
                }}
                onPointerUpCapture={() => clearTimeout(holdTimer.current)}
                onPointerLeave={() => clearTimeout(holdTimer.current)}
              >
                <ToolbarSegmentedControl
                  variant="navigation"
                  tracking="momentary"
                  aria-label="History"
                >
                  <ToolbarSegment
                    aria-label="Back"
                    disabled={overview || active.index === 0}
                    onClick={() => step(-1)}
                  >
                    <ChevronGlyph />
                  </ToolbarSegment>
                  <ToolbarSegment
                    aria-label="Forward"
                    disabled={overview || active.index >= active.history.length - 1}
                    onClick={() => step(1)}
                  >
                    <ChevronGlyph forward />
                  </ToolbarSegment>
                </ToolbarSegmentedControl>
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label={historyMenu < 0 ? "Back" : "Forward"}>
                {historyMenuRows.length === 0 ? <MenuItem disabled>No Pages</MenuItem> : null}
                {historyMenuRows.map((at) => {
                  const address = active.history[at] ?? START_PAGE;
                  return (
                    <MenuItem key={at} onClick={() => step(at - active.index)}>
                      {address === START_PAGE
                        ? "Start Page"
                        : visits.find((visit) => visit.url === address)?.title || address}
                    </MenuItem>
                  );
                })}
              </ContextualMenuPopup>
            </ContextualMenu>
            <ToolbarButton
              aria-label={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
              disabled={overview}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              // 38 pt with its edge; the captures have 9 pt, not 8, after Back and Forward.
              style={{ width: 37, marginInlineStart: 2 }}
            >
              <SidebarGlyph />
            </ToolbarButton>
            <ToolbarSpace className="mac-safari-toolbar-lead" />
            <SmartSearchField
              className="mac-safari-field"
              style={isPrivate ? PRIVATE_FIELD_STYLE : undefined}
              onDragOver={acceptTextDrag}
              onDrop={(event) => {
                const text = droppedText(event.dataTransfer);
                if (!text) return;
                event.preventDefault();
                setDraft(null);
                navigate(online ? webAddressFor(text) : addressFor(text));
              }}
              // At rest the field is the page itself, to drag to the Favorites bar or a tab bar. The
              // field's own press would keep the drag from starting, so it is passed over, and the
              // whole text is selected when the press ends instead.
              draggable={sharable && !fieldEditing && draft === null}
              onMouseDownCapture={(event) => {
                if (!sharable || fieldEditing || draft !== null) return;
                event.stopPropagation();
                fieldPressed.current = true;
              }}
              onMouseUp={(event) => {
                if (!fieldPressed.current) return;
                fieldPressed.current = false;
                setFieldEditing(true);
                event.preventDefault();
                event.currentTarget.select();
              }}
              onDragStart={(event) => {
                fieldPressed.current = false;
                event.dataTransfer.setData("text/uri-list", url);
                event.dataTransfer.setData("text/plain", url);
                event.dataTransfer.setData(LINK_TITLE_TYPE, titleOf(active));
              }}
              onDragEnd={(event) => event.currentTarget.blur()}
              onFocus={() => {
                setFieldFocused(true);
                if (!fieldPressed.current) setFieldEditing(true);
              }}
              onBlur={() => {
                setFieldFocused(false);
                setFieldEditing(false);
              }}
              onKeyDown={(event) => {
                // Escape gives up the keyboard: the window takes it, for its keys.
                if (event.key === "Escape") takeKeyboardBack();
                if (suggestions.length === 0) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const by = event.key === "ArrowDown" ? 1 : -1;
                  const rows = suggestions.length + 1;
                  setChosenSuggestion((now) => ((now + by + 1 + rows) % rows) - 1);
                }
              }}
              value={
                overview
                  ? (draft ?? "")
                  : (draft ??
                    (url === HISTORY_PAGE || url === BOOKMARKS_PAGE || url === EMPTY_PAGE
                      ? ""
                      : isFile
                        ? filePageText(url)
                        : url))
              }
              onValueChange={(next) => {
                setDraft(next);
                setChosenSuggestion(-1);
              }}
              onSubmit={(text) => {
                const row = suggestions[chosenSuggestion];
                setChosenSuggestion(-1);
                if (!row && isFile && text === filePageText(url)) {
                  setDraft(null);
                  return;
                }
                navigate(row ? row.url : online ? webAddressFor(text) : addressFor(text));
                // The field gives up the keyboard after this: the window takes it, for its keys.
                takeKeyboardBack();
              }}
              secure={
                isWeb
                  ? webState?.status === "ready" && url.startsWith("https:")
                  : page.kind !== "error" && url.startsWith("https:")
              }
              displayValue={
                isFile && !overview
                  ? filePageOf(url).name
                  : option(FULL_ADDRESS) && !overview
                    ? url
                    : undefined
              }
              leading={
                canRead && !overview ? (
                  <SmartSearchFieldButton
                    glyph="reader"
                    pressed={reading}
                    aria-label={reading ? "Hide Reader View" : "Show Reader View"}
                    onClick={toggleReader}
                  />
                ) : undefined
              }
              trailing={
                overview || page.kind === "start" ? undefined : reading && webReadable ? (
                  <SafariReaderOptions value={readerOptions} onChange={setReaderOptions} />
                ) : reading ? (
                  <SmartSearchFieldButton
                    glyph="text-size"
                    aria-label="Change Reader text size"
                    onClick={() => setReaderSize((readerSize + 1) % READER_SIZES.length)}
                  />
                ) : loading ? (
                  <SmartSearchFieldButton
                    glyph="stop"
                    aria-label="Stop loading this page"
                    onClick={() => stop(active.id)}
                  />
                ) : (
                  <SmartSearchFieldButton
                    glyph="reload"
                    aria-label="Reload this page"
                    onClick={() => load(active.id, url, true)}
                  />
                )
              }
            />
            <ToolbarSpace />
            <ShareMenu
              style={{ width: 37 }}
              disabled={!sharable}
              // Safari's menu is 182 pt wide, whatever the font sets its titles in.
              popupProps={{ style: { width: 182 } }}
              // In Catalina More… opens the Extensions preferences, which this Safari has no use
              // for: on the Ferrite desktop app the row is dimmed, saying so.
              onMore={online ? undefined : () => {}}
            >
              <ShareMenuItem
                image={<ShareRowGlyph kind="reading-list" />}
                onClick={addToReadingList}
              >
                Add to Reading List
              </ShareMenuItem>
              <ShareMenuItem image={<ShareRowGlyph kind="bookmark" />} onClick={addBookmark}>
                Add Bookmark
              </ShareMenuItem>
              {/* On the Ferrite desktop app the page's link is shared (desktop-share-link.tsx):
                Copy Link copies it, and each service that cannot take it is dimmed, saying why. */}
              {online ? (
                <>
                  <LinkShareItems
                    url={url}
                    title={titleOf(active)}
                    from="safari"
                    titles={{ mail: "Email This Page" }}
                    images={SERVICE_IMAGES}
                  />
                  <MenuSeparator />
                  <ShareMenuItem
                    disabled
                    title={NO_MORE_EXTENSIONS}
                    image={<ShareRowGlyph kind="more" />}
                  >
                    More…
                  </ShareMenuItem>
                </>
              ) : (
                SERVICES.map((service, index) => (
                  <ShareMenuItem key={service} image={<ServiceIcon tint={index + 1} />}>
                    {service}
                  </ShareMenuItem>
                ))
              )}
            </ShareMenu>
            {downloads.length > 0 ? (
              <SafariDownloadsButton
                downloads={downloads}
                open={downloadsOpen}
                onOpenChange={setDownloadsOpen}
                onChange={setDownloads}
              />
            ) : null}
            <ToolbarButton
              aria-label={overview ? "Hide Tab Overview" : "Show Tab Overview"}
              onClick={toggleOverview}
              style={{ width: 37 }}
            >
              <TabOverviewGlyph />
            </ToolbarButton>
            {/* A window with one tab has no tab bar: its new-tab cell is in the toolbar. */}
            {tabs.length === 1 && !overview ? <SafariNewTabButton onClick={newTab} /> : null}
          </Toolbar>
        </TitleBar>
        {online && favoritesBarShown ? (
          <ContextualMenu>
            <ContextualMenuTrigger
              className="mac-safari-tab-menu"
              onContextMenu={onLinkMenu}
              onDragOver={acceptLinkDrag}
              onDrop={(event) => {
                const link = droppedLink(event.dataTransfer);
                if (!link) return;
                event.preventDefault();
                if (shownFavorites.some((one) => one.url === link.url)) return;
                addFavoriteAt(event.target as Element, link);
              }}
            >
              <SafariFavoritesBar
                favorites={shownFavorites}
                onOpen={(address, inNewTab) => followLink(address, inNewTab === true)}
                onMove={(from, to) => setFavorites(movedLink(shownFavorites, from, to))}
              />
            </ContextualMenuTrigger>
            {linkMenuPopup}
          </ContextualMenu>
        ) : null}
        {addingBookmark ? (
          <SafariAddBookmarkSheet
            anchor={titleBar}
            name={titleOf(active)}
            folders={savedFolders.map((folder) => folder.title)}
            onCancel={() => setAddingBookmark(false)}
            onAdd={(place, title) => {
              addPageTo(place, title);
              setAddingBookmark(false);
            }}
          />
        ) : null}
        {addingTabs ? (
          <SafariRenameSheet
            anchor={titleBar}
            name={new Date().toLocaleDateString()}
            heading="Add Bookmarks for These Tabs"
            label="Folder name"
            action="Add"
            onCancel={() => setAddingTabs(false)}
            onRename={(title) => {
              const links = webTabLinks();
              setSavedFolders((now) => [
                ...now,
                {
                  title: freeFolderName(
                    title,
                    now.map((folder) => folder.title),
                  ),
                  links,
                },
              ]);
              setAddingTabs(false);
            }}
          />
        ) : null}
        {addingFolder ? (
          <SafariRenameSheet
            anchor={titleBar}
            name="Untitled Folder"
            heading="New Bookmark Folder"
            label="Folder name"
            action="Add"
            onCancel={() => setAddingFolder(false)}
            onRename={(title) => {
              setSavedFolders((now) => [
                ...now,
                {
                  title: freeFolderName(
                    title,
                    now.map((folder) => folder.title),
                  ),
                  links: [],
                },
              ]);
              setAddingFolder(false);
            }}
          />
        ) : null}
        {renaming ? (
          <SafariRenameSheet
            anchor={titleBar}
            name={renaming.title}
            onCancel={() => setRenaming(null)}
            onRename={(title) => {
              renameLink(renaming, title);
              setRenaming(null);
            }}
          />
        ) : null}
        {showTabBar ? (
          <ContextualMenu>
            <ContextualMenuTrigger
              className="mac-safari-tab-menu"
              onDragOver={acceptLinkDrag}
              onDrop={(event) => {
                const link = droppedLink(event.dataTransfer);
                if (!link) return;
                event.preventDefault();
                openInNewTab(link.url);
              }}
              onContextMenu={(event) => {
                const tab = (event.target as Element).closest<HTMLElement>("[data-tab-id]");
                setMenuTabId(tab?.dataset.tabId ?? null);
              }}
            >
              <SafariTabBar
                aria-label="Tabs"
                value={active.id}
                onValueChange={show}
                onNewTab={newTab}
              >
                {tabs.map((tab) => (
                  <SafariTab
                    key={tab.id}
                    value={tab.id}
                    data-tab-id={tab.id}
                    className={tab.pinned ? "mac-safari-tab-pinned" : undefined}
                    aria-label={tab.pinned ? `${titleOf(tab)}, pinned` : undefined}
                    title={tab.pinned ? titleOf(tab) : undefined}
                    onClose={tab.pinned ? undefined : () => closeTab(tab.id)}
                    onPointerDown={(event) => startTabDrag(tab.id, event)}
                    onPointerMove={moveTabDrag}
                    onPointerUp={endTabDrag}
                    onPointerCancel={endTabDrag}
                  >
                    {tab.pinned ? titleOf(tab).slice(0, 1).toUpperCase() : titleOf(tab)}
                  </SafariTab>
                ))}
              </SafariTabBar>
            </ContextualMenuTrigger>
            <ContextualMenuPopup aria-label="Tab">
              {menuTab ? (
                <>
                  <MenuItem onClick={() => load(menuTab.id, addressOfTab(menuTab), true)}>
                    Reload Tab
                  </MenuItem>
                  <MenuItem onClick={() => openInNewTab(addressOfTab(menuTab))}>
                    Duplicate Tab
                  </MenuItem>
                  <MenuSeparator />
                  {online ? (
                    <>
                      {row(commands.addTabs)}
                      <MenuItem disabled title={NO_SOUND}>
                        Mute Tab
                      </MenuItem>
                      <MenuItem onClick={() => togglePin(menuTab.id)}>
                        {menuTab.pinned ? "Unpin Tab" : "Pin Tab"}
                      </MenuItem>
                      <MenuItem
                        disabled={tabs.length < 2 || menuTab.pinKey !== undefined}
                        title={menuTab.pinKey ? NO_PIN_MOVE : undefined}
                        onClick={() => moveToNewWindow(menuTab)}
                      >
                        Move Tab to New Window
                      </MenuItem>
                      <MenuSeparator />
                    </>
                  ) : null}
                  <MenuItem
                    disabled={tabs.length < 2 || menuTab.pinned}
                    title={menuTab.pinned ? "Unpin this tab to close it." : undefined}
                    onClick={() => closeTab(menuTab.id)}
                  >
                    Close Tab
                  </MenuItem>
                  <MenuItem
                    disabled={tabs.length < 2}
                    onClick={() => closeTabsBut([menuTab.id], menuTab.id)}
                  >
                    Close Other Tabs
                  </MenuItem>
                  <MenuItem
                    disabled={tabs.at(-1)?.id === menuTab.id}
                    onClick={() =>
                      closeTabsBut(
                        tabs.slice(0, tabs.indexOf(menuTab) + 1).map((tab) => tab.id),
                        menuTab.id,
                      )
                    }
                  >
                    Close Tabs to the Right
                  </MenuItem>
                </>
              ) : (
                <MenuItem onClick={newTab}>New Tab</MenuItem>
              )}
            </ContextualMenuPopup>
          </ContextualMenu>
        ) : null}
        {find && (pageShown || findsHere) ? (
          <SafariFindBanner
            find={find}
            fieldRef={findField}
            onQueryChange={searchPage}
            onStep={stepFind}
            onDone={closeFind}
          />
        ) : null}
        {isPrivate && page.kind === "start" && !overview ? (
          <p className="mac-safari-private-note">
            Private Browsing is on. Safari keeps no history of this window, and its tabs are not
            kept when it closes.
          </p>
        ) : null}
        <div ref={dropRef} className="mac-safari-content">
          {suggestions.length > 0 ? (
            <SafariSuggestions rows={suggestions} chosen={chosenSuggestion} onOpen={navigate} />
          ) : null}
          {overview ? (
            view
          ) : (
            <SplitView className="mac-safari-split" style={SIDEBAR_DIVIDER}>
              {sidebarOpen ? (
                <SplitViewPane
                  defaultSize={325}
                  minSize={200}
                  maxSize={480}
                  className="mac-safari-sidebar"
                >
                  <ContextualMenu>
                    <ContextualMenuTrigger
                      className="mac-safari-tab-menu"
                      onContextMenu={onLinkMenu}
                      onClickCapture={onSidebarPress}
                      onPointerDown={(event) => {
                        markSidebarDrop(null);
                        const row = event.button === 0 ? draggableRow(event.target) : null;
                        wasDragged.current = false;
                        sidebarDrag.current = row
                          ? { row, x: event.clientX, y: event.clientY, moved: false, over: null }
                          : null;
                      }}
                      onPointerMove={moveSidebarDrag}
                      onPointerUp={endSidebarDrag}
                      onKeyDown={(event) => {
                        if (
                          sidebarList === "reading-list" &&
                          readingChosen.length > 0 &&
                          (event.key === "Backspace" || event.key === "Delete")
                        ) {
                          event.preventDefault();
                          removeFromReadingList(readingChosen);
                        }
                      }}
                    >
                      <Sidebar
                        material="opaque"
                        aria-label={sidebarList === "bookmarks" ? "Bookmarks" : "Reading List"}
                        className="mac-safari-sidebar-list"
                        header={
                          <div className="mac-safari-sidebar-switch">
                            <SegmentedControl
                              aria-label="Sidebar"
                              value={[sidebarList]}
                              onValueChange={([next]) => {
                                if (!next) return;
                                setSidebarList(next);
                                setChosenRow(null);
                              }}
                            >
                              <Segment value="bookmarks" aria-label="Bookmarks">
                                <BookGlyph />
                              </Segment>
                              <Segment value="reading-list" aria-label="Reading List">
                                <GlassesGlyph />
                              </Segment>
                            </SegmentedControl>
                          </div>
                        }
                        value={selectedRow}
                        onMouseDown={(event) => {
                          // A press that may become a drag opens its row only when let go.
                          if (event.button === 0 && draggableRow(event.target)) {
                            event.preventDefault();
                            event.currentTarget.focus({ preventScroll: true });
                            return;
                          }
                          // Command and Shift choose Reading List rows rather than open one.
                          if (
                            online &&
                            sidebarList === "reading-list" &&
                            (event.metaKey || event.ctrlKey || event.shiftKey)
                          ) {
                            event.preventDefault();
                            // Cancelling the press also keeps the keyboard from the tree, which Delete needs.
                            event.currentTarget.focus({ preventScroll: true });
                          }
                        }}
                        onValueChange={openSidebarRow}
                      >
                        {bookmarkRows(
                          sidebarList === "bookmarks" ? sidebarBookmarks : sidebarReadingList,
                          `${sidebarList}/`,
                          sidebarList === "reading-list" ? readingChosen : [],
                        )}
                      </Sidebar>
                    </ContextualMenuTrigger>
                    {online ? linkMenuPopup : null}
                  </ContextualMenu>
                </SplitViewPane>
              ) : null}
              {sidebarOpen ? <SplitViewDivider aria-label="Resize sidebar" /> : null}
              <SplitViewPane className="mac-safari-page-pane">{view}</SplitViewPane>
            </SplitView>
          )}
          {floatingInWindow}
          {online && statusBarShown ? (
            <div className="mac-safari-status-bar" role="status">
              {hoveredLink ? `Open “${hoveredLink}”` : ""}
            </div>
          ) : null}
        </div>
        {floating && pictureInPictureContainer
          ? createPortal(floating, pictureInPictureContainer)
          : null}
      </Window>
    </SafariDownloadsContext>
  );
}
