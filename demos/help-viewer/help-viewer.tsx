"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { Label } from "macalicious/label";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { ScrollView } from "macalicious/scroll-view";
import { Separator } from "macalicious/separator";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { SystemImage } from "macalicious/system-image";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarPopUp } from "macalicious/toolbar-pop-up";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowBanner, WindowBannerAction } from "macalicious/window-banner";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { onHelpRequest, takeHelpRequest } from "../desktop/desktop-help";
import { readShown, readSize, useKeptValue } from "../desktop/desktop-kept-value";
import { openUrl } from "../desktop/desktop-open-url";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import {
  copyText,
  LinkShareItems,
  NO_ADDRESS_REASON,
  shareTargets,
} from "../desktop/desktop-share-link";
import { lookUp } from "../dictionary/dictionary-desktop";
import { EntryContextItems } from "../dictionary/dictionary-menus";
import { FindBar, useTextFind } from "../notes/notes-find";
import { helpLink, takeRequestedTopic, takeRequestedWords } from "./help-menu-search";
import {
  DeviceArtwork,
  HeroArtwork,
  PagePicture,
  ResultIcon,
  ServiceIcon,
} from "./help-viewer-artwork";
import {
  findSection,
  findTopic,
  GUIDE_TITLE,
  type HelpRanking,
  type HelpSection,
  type HelpTopic,
  isPage,
  lightRanking,
  RESULTS_SHOWN,
  searchHelp,
  sectionOf,
  sections,
  WELCOME,
  welcome,
} from "./help-viewer-data";
import { guideNamed, searchGuides, withDesktopBooks } from "./help-viewer-guides";
import {
  advance,
  type Entry,
  type History,
  historyToKeep,
  mergeHistory,
  readExpandedRows,
  readHistory,
  readingOf,
  useKeptState,
} from "./help-viewer-kept";
import {
  CustomizeToolbarSheet,
  DEFAULT_TEXT_SCALE,
  TEXT_SCALES,
  useHelpViewerMenus,
} from "./help-viewer-menus";
import { PageActions, PageFeedback } from "./help-viewer-page-parts";
import {
  booksFromServer,
  getJson,
  HELP_BOOKS_URL,
  HELP_PLACE_URL,
  HELP_SEARCH_URL,
  placeReadable,
  resultsFromServer,
  SEARCH_DELAY_MS,
  serverSearches,
} from "./help-viewer-server";
import "./help-viewer.tokens.css";
import "./help-viewer.css";

/** Measured: each of Back and Forward is 25 pt, and the two buttons after them 37 pt. */
const SEGMENT: CSSProperties = { flex: "none", width: 25 };
const BUTTON: CSSProperties = { width: 37 };
/** Measured: the search field is 323 pt wide and ends 8 pt before the window's edge. */
const SEARCH: CSSProperties = { width: 323 };
/** Wide enough for the longest book's title. */
const BOOKS: CSSProperties = { width: 190 };

const NO_ITEMS: readonly string[] = [];
const NO_DESKTOP_REASON = "Another window needs the desktop, and this page has none.";

/** The value of the book switcher's row for the guide, and of the results' row for every book. */
const GUIDE_BOOK = "guide";
const ALL_BOOKS = "all";

/** Measured: the table of contents is 203 pt wide, with 26 pt rows. */
const CONTENTS_WIDTH = 203;
const readTextScale = (stored: unknown) =>
  typeof stored === "number" && TEXT_SCALES[stored] !== undefined ? stored : undefined;
const ROW_HEIGHT = 26;

/**
 * The frame of this panel is rounded by 3 pt, where a document window's is by 5 pt: the
 * window's radius token, set for this window (measured on all four captures' corners).
 */
const FRAME = { "--mac-radius-window": "3px" } as CSSProperties;

/** The split view's hook for the colour of its line, set to the one measured beside the list. */
const DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-help-viewer-divider)",
} as CSSProperties;

/**
 * The welcome page's colours for the library's parts on it: its rule is darker than the
 * system's separator and its link brighter than the system's link.
 */
const WELCOME_COLORS = {
  "--mac-color-separator": "var(--mac-help-viewer-welcome-rule)",
  "--mac-color-link": "var(--mac-help-viewer-welcome-link)",
} as CSSProperties;

/**
 * The Share menu's rows off the desktop, where a page has no web address: each is dimmed and the menu says why, rather
 * than offering services that send nothing.
 */
const OFF_DESKTOP_SERVICES = [...shareTargets().map((target) => target.title), "AirDrop"] as const;

/** The Share menu's stand-in icon for each of its rows. */
const SHARE_IMAGES = Object.fromEntries(
  ["copy", "mail", "messages", "airdrop", "notes", "reminders", "safari"].map((key) => [
    key,
    <ServiceIcon key={key} app={key} />,
  ]),
);

/** The page a window opens on when File's row is not what asked for it. */
const openingPage = (opening: unknown) => {
  const page = (opening as { page?: unknown } | null | undefined)?.page;
  return typeof page === "string" ? page : undefined;
};

const readHistoryOf = (opened: boolean) => (opened ? () => undefined : readHistory);

const COPY_REFUSED = "The browser refused the clipboard: the link was not copied.";

/** A row of the table of contents: Welcome, an entry, or a topic inside one. */
interface ContentsItem extends OutlineViewItem {
  id: string;
  title: string;
}

const CONTENTS: readonly ContentsItem[] = [
  { id: WELCOME, title: "Welcome" },
  ...sections.map(contentsItem),
];

/** A row of the table of contents for an entry, with its topics inside it. */
function contentsItem({ id, title, topics }: HelpSection): ContentsItem {
  return { id, title, children: topics?.map((topic) => ({ id: topic.id, title: topic.title })) };
}

/** The rows open now with those a stored list adds. */
const mergeRows = (kept: readonly (string | number)[], current: readonly (string | number)[]) => [
  ...new Set([...kept, ...current]),
];

export interface HelpViewerProps extends Omit<WindowProps, "children"> {
  /**
   * Whether the table of contents is shown beside the page at first. The sidebar button shows
   * and hides it afterwards.
   * @default true
   */
  defaultSidebarOpen?: boolean;
  /**
   * Text the search field holds at first: the viewer then opens on the results for it, one
   * step after the welcome page in its history. An empty text opens the welcome page.
   * @default ""
   */
  defaultQuery?: string;
  /**
   * The topics a search lists first, by id and in order. The default is the order of the Aqua
   * search capture; `darkRanking` in `help-viewer-data.ts` is that of the Dark Aqua one.
   * @default lightRanking
   */
  searchRanking?: HelpRanking;
  /** What the desktop was asked to open this window on: `{ page }`, a page of the guide. */
  opening?: unknown;
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
  /**
   * For the title bar, which with its toolbar is this window's drag region: called when the
   * primary pointer button goes down on the bar itself, not on a control in it. A window
   * manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: called when the bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

interface PageLinkProps extends Omit<ComponentProps<"a">, "href"> {
  /** The page the link opens. */
  to: string;
  onOpen: (id: string) => void;
}

/**
 * A link to a page of the guide. It is an anchor, so it is reached and followed as a link is;
 * the viewer opens the page itself and the address of the document stays as it was. Dragged out, it
 * carries the page's address.
 */
function PageLink({ to, onOpen, onClick, ...props }: PageLinkProps) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    event.preventDefault();
    onOpen(to);
  };
  return (
    <a
      {...props}
      href={`#${to}`}
      data-help-link={to}
      onClick={follow}
      onDragStart={(event) => {
        if (!servedByDesktopApp()) return;
        const address = helpLink(to);
        const named = document.createElement("a");
        named.href = address;
        named.textContent = event.currentTarget.textContent;
        event.dataTransfer.setData("text/uri-list", address);
        event.dataTransfer.setData("text/plain", address);
        event.dataTransfer.setData("text/html", named.outerHTML);
      }}
    />
  );
}

/** A summary as a paragraph of a page: one that the index cuts short ends in an ellipsis. */
const lead = (summary: string) => (/[.?!]$/.test(summary) ? summary : `${summary}…`);

/**
 * Help Viewer, as in macOS 10.15 Catalina: the macOS User Guide in a floating panel, with its
 * table of contents in an outline beside the page, a history that Back and Forward walk, and a
 * search of every guide's topics from the toolbar.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the title bar's callbacks, the eight props a managed
 * window's `render` supplies beside the window's, are handed to those parts.
 *
 * Nothing is fetched: the guide's text is the demo's own, and its pictures are of this desktop.
 * The history and the search live in the component's state for as long as it is mounted.
 * Served by the desktop's Ferrite application, the viewer adds the server's help books to its
 * table of contents with a switcher in the toolbar and a filter on the results, lists the server's
 * search results first, and opens on the page the session last read, with its history and open
 * rows as they were.
 */
export function HelpViewer({
  defaultSidebarOpen = true,
  defaultQuery = "",
  searchRanking = lightRanking,
  opening,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 877,
  height = 722,
  className,
  style,
  ...windowProps
}: HelpViewerProps) {
  const [sidebarOpen, setSidebarOpen] = useKeptValue(
    "helpViewer.sidebar",
    readShown,
    defaultSidebarOpen,
  );
  const [contentsWidth, setContentsWidth] = useKeptValue(
    "helpViewer.contentsWidth",
    readSize,
    CONTENTS_WIDTH,
  );
  const [textScale, setTextScale] = useKeptValue(
    "helpViewer.textScale",
    readTextScale,
    DEFAULT_TEXT_SCALE,
  );
  const [toolbarShown, setToolbarShown] = useKeptValue("helpViewer.toolbarShown", readShown, true);
  const [hiddenItems, setHiddenItems] = useKeptValue<readonly string[]>(
    "helpViewer.toolbarHidden",
    readExpandedRows,
    NO_ITEMS,
  );
  const [customizing, setCustomizing] = useState(false);
  const shows = (item: string) => toolbarShown && !hiddenItems.includes(item);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const pageHolder = useRef<HTMLDivElement>(null);
  const searchHolder = useRef<HTMLInputElement>(null);
  // Whether the server has named a page: from then on that page is not one to replace.
  const placeKnown = useRef(false);
  // A window asked for on one page stays on it, whatever was read last.
  const openedOn = openingPage(opening);
  const [history, changeHistory, setHistory] = useKeptState<History>(
    "helpViewer.history",
    readHistoryOf(openedOn !== undefined),
    () => {
      if (openedOn !== undefined) return { entries: [{ kind: "page", id: openedOn }], index: 0 };
      const first: Entry = { kind: "page", id: WELCOME };
      return defaultQuery.trim() === ""
        ? { entries: [first], index: 0 }
        : { entries: [first, { kind: "search", query: defaultQuery }], index: 1 };
    },
    (kept, current) => mergeHistory(kept, current, placeKnown.current),
    historyToKeep,
  );
  const [expanded, changeExpanded, setExpanded] = useKeptState<readonly (string | number)[]>(
    "helpViewer.expanded",
    readExpandedRows,
    [],
    mergeRows,
  );
  // The book the results are limited to, the row of the contents a menu was opened on, and the link
  // the page's menu was opened on.
  const [resultBook, setResultBook] = useState(ALL_BOOKS);
  const [menuRow, setMenuRow] = useState<string | null>(null);
  const [menuLink, setMenuLink] = useState<string | null>(null);
  // The search whose results are all listed, after "Show all".
  const [listed, setListed] = useState<string | null>(null);
  const headingId = useId();
  // What takes the focus once the view has changed, because what had it is gone with the old
  // view: a followed link's page, or the first of the results that Show all adds.
  const focusNext = useRef<"page" | "more" | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const wanted = focusNext.current;
    focusNext.current = null;
    if (wanted === "page") heading.current?.focus();
    // Show all adds to the list that is being read: the focus moves and the list stays put.
    else if (wanted === "more") {
      resultList.current?.querySelectorAll("a")[RESULTS_SHOWN]?.focus({ preventScroll: true });
    }
  });

  const entry = history.entries[history.index] ?? { kind: "page", id: WELCOME };
  const searching = entry.kind === "search";
  const query = searching ? entry.query : "";
  const pageId = searching ? undefined : entry.id;

  // Served by the desktop's Ferrite application: the server's books and the app guides, and the
  // server's results for the search that is shown. Nothing is asked of a server otherwise.
  const served = servedByDesktopApp();
  const [fetchedBooks, setFetchedBooks] = useState<readonly HelpSection[]>([]);
  const serverBooks = useMemo(
    () => (served ? withDesktopBooks(fetchedBooks) : fetchedBooks),
    [served, fetchedBooks],
  );
  const [serverResults, setServerResults] = useState<{
    query: string;
    topics: readonly HelpTopic[];
  } | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(served);
  useEffect(() => {
    if (!served) return;
    let live = true;
    void getJson(HELP_BOOKS_URL).then((reply) => {
      if (!live) return;
      const books = booksFromServer(reply);
      if (books.length > 0) setFetchedBooks(books);
      setLoadingBooks(false);
    });
    return () => {
      live = false;
    };
  }, [served]);
  const wanted = query.trim();
  useEffect(() => {
    if (!served || wanted === "" || !serverSearches(wanted)) return;
    let live = true;
    // A request is made once the typing pauses, and an answer to text since changed is dropped.
    const timer = setTimeout(() => {
      void getJson(`${HELP_SEARCH_URL}?q=${encodeURIComponent(wanted)}`).then((reply) => {
        const found = resultsFromServer(reply, wanted);
        if (live && found) setServerResults({ query: wanted, topics: found });
      });
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [served, wanted]);
  const contents = useMemo(
    () => (serverBooks.length === 0 ? CONTENTS : [...CONTENTS, ...serverBooks.map(contentsItem)]),
    [serverBooks],
  );
  // The pages from the server: its books' topics and the topics its search found.
  const serverTopics = useMemo(() => {
    const found = new Map<string, HelpTopic>();
    for (const book of serverBooks)
      for (const topic of book.topics ?? []) found.set(topic.id, topic);
    for (const topic of serverResults?.topics ?? []) found.set(topic.id, topic);
    return found;
  }, [serverBooks, serverResults]);
  const serverBook = (id: string) => serverBooks.find((book) => book.id === id);
  const isAnyPage = (id: string) => isPage(id) || serverTopics.has(id) || !!serverBook(id);
  const bookOf = (id: string) =>
    sectionOf(id) ?? serverBooks.find((book) => book.topics?.some((topic) => topic.id === id));

  // Served by the application the page last read is kept for the session, and the viewer opens on
  // it again.
  const reading = useMemo(() => readingOf(history), [history]);
  // Whether a load of the place has been read: the first that finds none keeps the viewer's own
  // opening page, and a later one (the place was forgotten elsewhere) returns to the welcome.
  const placeLoaded = useRef(false);
  const loadingPlace = useServerState({
    url: HELP_PLACE_URL,
    enabled: served,
    value: reading,
    onLoad: (stored) => {
      if (openedOn !== undefined || !placeReadable(stored)) return false;
      const first = !placeLoaded.current;
      placeLoaded.current = true;
      const named = (stored as { page: string | null }).page;
      if (first && named === null) return;
      if (named !== null) placeKnown.current = true;
      const page = named ?? WELCOME;
      setHistory((current) =>
        readingOf(current) === page ? current : advance(current, { kind: "page", id: page }),
      );
    },
    toBody: (page) => ({ page }),
  });
  // The window is inert until both the page last read and the server's books are known, so a
  // restored server topic has its text when the window first takes input.
  const loading = loadingPlace || loadingBooks;
  // Once they are, the contents open the book of the restored page, as opening it would.
  const restored = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the reads settle
  useEffect(() => {
    if (!served || loading || restored.current) return;
    restored.current = true;
    const parent = pageId === undefined ? undefined : bookOf(pageId);
    if (parent) setExpanded((current) => [...new Set([...current, parent.id])]);
  }, [served, loading]);

  const open = (id: string) => {
    if (!isAnyPage(id) || id === pageId) return;
    changeHistory((current) => advance(current, { kind: "page", id }));
    // A topic's row is in view in the table of contents once its section is expanded.
    const parent = bookOf(id);
    if (parent) changeExpanded((current) => [...new Set([...current, parent.id])]);
  };
  // The book that holds the page last read, for the switcher and the window's title.
  const readingBook = serverBooks.find(
    (book) => book.id === reading || book.topics?.some((topic) => topic.id === reading),
  );
  const shownBook = readingBook?.id ?? GUIDE_BOOK;
  const switchBook = (id: string) => {
    if (id === GUIDE_BOOK) {
      open(WELCOME);
      return;
    }
    open(id);
    changeExpanded((current) => [...new Set([...current, id])]);
  };
  // A link is gone with the page it was on: the page it leads to takes the focus.
  const follow = (id: string) => {
    if (isAnyPage(id) && id !== pageId) focusNext.current = "page";
    open(id);
  };

  const step = (by: number) =>
    changeHistory(({ entries, index }) => ({
      entries,
      index: Math.min(entries.length - 1, Math.max(0, index + by)),
    }));

  // Back, Forward and the rest of the menu bar's rows (help-viewer-menus.tsx).
  const pageTitle = () => {
    const id = pageId;
    if (id === undefined) return GUIDE_TITLE;
    return (
      (findTopic(id) ?? serverTopics.get(id) ?? findSection(id) ?? serverBook(id))?.title ??
      GUIDE_TITLE
    );
  };
  const find = useTextFind(
    () => pageHolder.current?.querySelector<HTMLElement>("article, .mac-help-viewer-results"),
    searching ? `search ${query}` : `page ${pageId}`,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const menus = useHelpViewerMenus({
    isKey: windowProps.state === "key",
    within: titleBar,
    page: pageHolder,
    title: pageTitle(),
    onPage: !searching,
    canGoBack: history.index > 0,
    canGoForward: history.index < history.entries.length - 1,
    sidebarOpen,
    textScale,
    step,
    home: () => changeHistory((current) => advance(current, { kind: "page", id: WELCOME })),
    toggleSidebar: () => setSidebarOpen(!sidebarOpen),
    setTextScale,
    toolbarShown,
    showToolbar: setToolbarShown,
    customizeToolbar: () => setCustomizing(true),
    focusSearch: () => {
      setToolbarShown(true);
      if (hiddenItems.includes("Search"))
        setHiddenItems(hiddenItems.filter((item) => item !== "Search"));
      requestAnimationFrame(() => {
        searchHolder.current?.focus();
        searchHolder.current?.select();
      });
    },
    find,
    say: setNotice,
  });

  // A search or topic the Help menu asked for, once the page last read is known: that reading
  // would otherwise take its place.
  const takeHelp = useRef(() => {});
  useEffect(() => {
    if (loading) return;
    takeHelp.current();
    return onHelpRequest(() => takeHelp.current());
  }, [loading]);

  // The field holds the text of the search that is shown. Text on a page starts a search, as a
  // new step; more text changes that step; no text takes the step away again, which returns
  // to the page the search started from.
  const search = (text: string) =>
    changeHistory((current) => {
      const { entries, index } = current;
      const empty = text.trim() === "";
      if (entries[index]?.kind !== "search")
        return empty ? current : advance(current, { kind: "search", query: text });
      if (empty) return { entries: entries.slice(0, index), index: index - 1 };
      return {
        entries: [...entries.slice(0, index), { kind: "search", query: text }],
        index,
      };
    });
  takeHelp.current = () => {
    const asked = takeHelpRequest();
    const requested = takeRequestedTopic();
    // An application's Help row names the application: its guide, where it has one. Words typed in
    // the Help menu are a search.
    const words = takeRequestedWords();
    const guide = served && asked && !words ? guideNamed(asked) : undefined;
    if (requested) follow(requested);
    else if (guide) {
      focusNext.current = "page";
      // By title: a guide joined to the server's book of its title has that book's id.
      const shown = serverBooks.find((book) => book.title === guide.title);
      switchBook((shown ?? guide).id);
    } else if (asked) search(asked);
  };

  const topic = pageId === undefined ? undefined : (findTopic(pageId) ?? serverTopics.get(pageId));
  const section = pageId === undefined ? undefined : (findSection(pageId) ?? serverBook(pageId));
  // The server's results for the text shown come first, then the guide's own.
  const found = searching
    ? [
        ...(serverResults?.query === wanted ? serverResults.topics : []),
        ...(served ? searchGuides(query) : []),
        ...searchHelp(query, searchRanking),
      ]
    : [];
  // Served, the results can be limited to the book each came from. A book the search no longer
  // finds anything in stops limiting them.
  const resultBooks = served ? [...new Set(found.map((result) => result.source))] : [];
  const limitedTo = resultBooks.includes(resultBook) ? resultBook : undefined;
  const results = limitedTo ? found.filter((result) => result.source === limitedTo) : found;
  const all = listed === query.trim();
  const shown = all ? results : results.slice(0, RESULTS_SHOWN);

  const menuRowItem = contents.find((item) => item.id === menuRow && item.children);
  const parentRows = contents.filter((item) => item.children).map((item) => item.id);

  let kind: "welcome" | "results" | "topic";
  let page: ReactNode;
  if (searching) {
    kind = "results";
    page = (
      <section className="mac-help-viewer-results" aria-labelledby={headingId}>
        <header className="mac-help-viewer-results-header">
          <h1 id={headingId} className="mac-help-viewer-results-heading">
            {limitedTo ?? "All Help"}
          </h1>
          <Label textStyle="small" className="mac-help-viewer-results-count" role="status">
            ({results.length} {results.length === 1 ? "result" : "results"})
          </Label>
          {resultBooks.length > 1 ? (
            <PopUpButton
              aria-label="Show results from"
              size="small"
              className="mac-help-viewer-results-book"
              value={limitedTo ?? ALL_BOOKS}
              onValueChange={(book) => setResultBook(book ?? ALL_BOOKS)}
            >
              <PopUpButtonItem value={ALL_BOOKS}>All Help</PopUpButtonItem>
              {resultBooks.map((book) => (
                <PopUpButtonItem key={book} value={book}>
                  {book}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          ) : null}
        </header>
        {results.length === 0 ? (
          <EmptyState className="mac-help-viewer-no-results">No Results</EmptyState>
        ) : (
          <>
            <ul ref={resultList} className="mac-help-viewer-result-list">
              {shown.map((result: HelpTopic) => (
                <li key={result.id}>
                  <PageLink to={result.id} onOpen={follow} className="mac-help-viewer-result">
                    <ResultIcon />
                    <Label textStyle="emphasized" className="mac-help-viewer-result-title">
                      {result.title}
                    </Label>
                    <Label className="mac-help-viewer-result-summary">{result.summary}</Label>
                  </PageLink>
                </li>
              ))}
            </ul>
            {results.length > RESULTS_SHOWN && !all ? (
              <Label
                render={<button type="button" />}
                textStyle="emphasized"
                color="link"
                className="mac-help-viewer-show-all"
                onClick={() => {
                  // The button goes: the first result it adds takes the focus.
                  focusNext.current = "more";
                  setListed(query.trim());
                }}
              >
                Show all
                <SystemImage name="chevron-down" />
              </Label>
            ) : null}
            <Separator className="mac-help-viewer-results-rule" aria-hidden="true" />
            <Label
              render={<button type="button" />}
              textStyle="emphasized"
              color="link"
              className="mac-help-viewer-web"
              onClick={() =>
                openUrl(
                  `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`,
                  "help-viewer",
                )
              }
            >
              See more results on the web
              <svg
                className="mac-help-viewer-web-arrow"
                width="8"
                height="8"
                viewBox="0 0 8 8"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M1.5 1H7v5.5M7 1 1 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            </Label>
          </>
        )}
      </section>
    );
  } else if (topic || section) {
    kind = "topic";
    page = (
      <>
        <article className="mac-help-viewer-topic" aria-labelledby={headingId}>
          <Label textStyle="small" color="secondary" className="mac-help-viewer-topic-source">
            {topic ? topic.source : GUIDE_TITLE}
          </Label>
          <h1 ref={heading} id={headingId} tabIndex={-1} className="mac-help-viewer-topic-title">
            {(topic ?? section)?.title}
          </h1>
          <Label render={<p />} selectable className="mac-help-viewer-topic-text">
            {lead((topic ?? section)?.summary ?? "")}
          </Label>
          <PagePicture page={(topic ?? section)?.id ?? ""} />
          {topic?.body.map((text) => (
            <Label key={text} render={<p />} selectable className="mac-help-viewer-topic-text">
              {text}
            </Label>
          ))}
          {section?.topics ? (
            <ul className="mac-help-viewer-topic-list">
              {section.topics.map((inside) => (
                <li key={inside.id}>
                  <Label color="link" render={<PageLink to={inside.id} onOpen={follow} />}>
                    {inside.title}
                  </Label>
                </li>
              ))}
            </ul>
          ) : null}
          {topic && served ? <PageActions topicId={topic.id} /> : null}
        </article>
        {topic ? <PageFeedback key={topic.id} page={topic.id} /> : null}
      </>
    );
  } else {
    kind = "welcome";
    page = (
      // The welcome page has no dark style: it is white in Dark Aqua too, as captured.
      <article
        className="mac-help-viewer-welcome"
        aria-labelledby={headingId}
        data-appearance="light"
        style={WELCOME_COLORS}
      >
        <header className="mac-help-viewer-hero">
          <HeroArtwork />
          <h1 id={headingId} className="mac-help-viewer-hero-title">
            {welcome.title}
          </h1>
          <p className="mac-help-viewer-hero-subtitle">{welcome.subtitle}</p>
        </header>
        <div className="mac-help-viewer-welcome-body">
          <Label
            render={<button type="button" />}
            textStyle="title-3"
            color="link"
            className="mac-help-viewer-contents-link"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <SystemImage
              name="sidebar"
              scale={17 / 15}
              className="mac-help-viewer-contents-glyph"
            />
            {welcome.contents}
          </Label>
          <Separator className="mac-help-viewer-welcome-rule" aria-hidden="true" />
          <DeviceArtwork />
          <h2 className="mac-help-viewer-welcome-heading">{welcome.heading}</h2>
          <p className="mac-help-viewer-welcome-text">{welcome.text}</p>
        </div>
      </article>
    );
  }

  return (
    <Window
      variant="panel"
      {...windowProps}
      width={width}
      height={height}
      className={className ? `mac-help-viewer ${className}` : "mac-help-viewer"}
      style={{ ...FRAME, ...style }}
    >
      <TitleBar
        ref={setTitleBar}
        variant="utility"
        title={readingBook?.title ?? GUIDE_TITLE}
        controls={
          <WindowControls
            size="small"
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
        {toolbarShown ? (
          <Toolbar aria-label="Help Viewer toolbar" inert={loading || undefined}>
            {shows("Back and Forward") ? (
              <ToolbarSegmentedControl
                variant="navigation"
                tracking="momentary"
                aria-label="History"
              >
                <ToolbarSegment
                  aria-label="Back"
                  disabled={history.index === 0}
                  style={SEGMENT}
                  onClick={() => step(-1)}
                >
                  <SystemImage name="go-back" />
                </ToolbarSegment>
                <ToolbarSegment
                  aria-label="Forward"
                  disabled={history.index >= history.entries.length - 1}
                  style={SEGMENT}
                  onClick={() => step(1)}
                >
                  <SystemImage name="go-forward" />
                </ToolbarSegment>
              </ToolbarSegmentedControl>
            ) : null}
            {shows("Table of Contents") ? (
              <ToolbarButton
                aria-label={sidebarOpen ? "Hide Table of Contents" : "Show Table of Contents"}
                // The results of a search take the whole window.
                disabled={searching}
                style={BUTTON}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <SystemImage name="sidebar" />
              </ToolbarButton>
            ) : null}
            {shows("Share") ? (
              <ShareMenu
                trigger={
                  <ToolbarButton aria-label="Share" style={BUTTON}>
                    <SystemImage name="share" />
                  </ToolbarButton>
                }
                // A list of results is not a page to share.
                disabled={searching}
              >
                {served ? (
                  <LinkShareItems
                    url={helpLink(reading)}
                    title={pageTitle()}
                    from="help-viewer"
                    images={SHARE_IMAGES}
                    onCopied={(copied) => {
                      if (!copied) setNotice(COPY_REFUSED);
                    }}
                  />
                ) : (
                  <>
                    {OFF_DESKTOP_SERVICES.map((service) => (
                      <ShareMenuItem
                        key={service}
                        image={<ServiceIcon app={service.toLowerCase()} />}
                        disabled
                      >
                        {service}
                      </ShareMenuItem>
                    ))}
                    <ShareMenuItem disabled>{NO_ADDRESS_REASON}</ShareMenuItem>
                  </>
                )}
              </ShareMenu>
            ) : null}
            {serverBooks.length > 0 && shows("Book") ? (
              <ToolbarPopUp
                aria-label="Book"
                style={BOOKS}
                value={shownBook}
                onValueChange={(book) => book && switchBook(book)}
              >
                <PopUpButtonItem value={GUIDE_BOOK}>{GUIDE_TITLE}</PopUpButtonItem>
                {serverBooks.map((book) => (
                  <PopUpButtonItem key={book.id} value={book.id}>
                    {book.title}
                  </PopUpButtonItem>
                ))}
              </ToolbarPopUp>
            ) : null}
            <ToolbarSpace />
            {shows("Search") ? (
              <ToolbarSearchField
                inputRef={searchHolder}
                value={query}
                onValueChange={search}
                style={SEARCH}
              />
            ) : null}
          </Toolbar>
        ) : null}
      </TitleBar>
      <CustomizeToolbarSheet
        open={customizing}
        anchor={titleBar}
        hidden={hiddenItems}
        onChange={setHiddenItems}
        onDone={() => setCustomizing(false)}
      />
      <WindowBody
        background="content"
        className="mac-help-viewer-body"
        inert={loading || undefined}
        aria-busy={loading || undefined}
      >
        <SplitView className="mac-help-viewer-split">
          {/* The results of a search take the whole window. A page has the table of contents
              beside it; hidden, it is a collapsed pane, which leaves its divider at the edge. */}
          {searching ? null : (
            <SplitViewPane
              size={sidebarOpen ? contentsWidth : 0}
              onSizeChange={(size) => {
                // Opened again from its divider, the list takes the width it had.
                if (size > 0 && sidebarOpen) setContentsWidth(size);
                setSidebarOpen(size > 0);
              }}
              minSize={140}
              maxSize={320}
              collapsible
            >
              {sidebarOpen ? (
                <ContextualMenu>
                  <ContextualMenuTrigger
                    className="mac-help-viewer-menu-area"
                    onContextMenu={(event) => {
                      const row = (event.target as Element)
                        .closest("[data-row]")
                        ?.querySelector("[data-contents-row]");
                      setMenuRow(row?.getAttribute("data-contents-row") ?? null);
                    }}
                  >
                    <OutlineView<ContentsItem>
                      aria-label="Table of Contents"
                      className="mac-help-viewer-contents"
                      items={contents}
                      renderCell={(item) => <span data-contents-row={item.id}>{item.title}</span>}
                      getItemLabel={(item) => item.title}
                      expanded={expanded}
                      onExpandedChange={changeExpanded}
                      value={pageId === undefined ? [] : [pageId]}
                      onValueChange={(next) => {
                        const [id] = next;
                        if (typeof id === "string") open(id);
                      }}
                      rowHeight={ROW_HEIGHT}
                    />
                  </ContextualMenuTrigger>
                  <ContextualMenuPopup aria-label="Table of Contents commands">
                    <MenuItem
                      disabled={!menuRowItem}
                      onClick={() =>
                        changeExpanded((current) =>
                          menuRow === null || current.includes(menuRow)
                            ? current.filter((row) => row !== menuRow)
                            : [...current, menuRow],
                        )
                      }
                    >
                      {menuRowItem && expanded.includes(menuRowItem.id) ? "Collapse" : "Expand"}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem onClick={() => changeExpanded(parentRows)}>Expand All</MenuItem>
                    <MenuItem onClick={() => changeExpanded([])}>Collapse All</MenuItem>
                  </ContextualMenuPopup>
                </ContextualMenu>
              ) : null}
            </SplitViewPane>
          )}
          {searching ? null : (
            <SplitViewDivider aria-label="Resize the table of contents" style={DIVIDER} />
          )}
          <SplitViewPane minSize={320} className="mac-help-viewer-pane" data-page={kind}>
            <div ref={pageHolder} className="mac-help-viewer-page">
              {notice ? (
                <WindowBanner
                  role="alert"
                  title={notice}
                  trailing={
                    <WindowBannerAction onClick={() => setNotice(null)}>OK</WindowBannerAction>
                  }
                >
                  {notice}
                </WindowBanner>
              ) : null}
              <FindBar find={find} />
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-help-viewer-menu-area"
                  onContextMenu={(event) =>
                    setMenuLink(
                      (event.target as Element)
                        .closest("[data-help-link]")
                        ?.getAttribute("data-help-link") ?? null,
                    )
                  }
                >
                  <ScrollView
                    // A new page starts at its top, and so do the results of another search; Show
                    // all adds to the list that is being read and leaves it where it is.
                    key={searching ? `results ${query.trim()}` : pageId}
                    className="mac-help-viewer-scroll"
                    knobStyle={kind === "welcome" ? "dark" : "default"}
                  >
                    {textScale === DEFAULT_TEXT_SCALE ? (
                      page
                    ) : (
                      <div style={{ zoom: TEXT_SCALES[textScale] }}>{page}</div>
                    )}
                  </ScrollView>
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Page commands">
                  {menuLink ? (
                    <>
                      <MenuItem
                        disabled={!served}
                        title={served ? undefined : NO_DESKTOP_REASON}
                        onClick={() =>
                          requestDesktopEffects([
                            { newWindow: "help-viewer", opening: { page: menuLink } },
                          ])
                        }
                      >
                        Open in New Window
                      </MenuItem>
                      <MenuItem
                        disabled={!served}
                        title={served ? undefined : NO_ADDRESS_REASON}
                        onClick={() =>
                          void copyText(helpLink(menuLink)).then((copied) => {
                            if (!copied) setNotice(COPY_REFUSED);
                          })
                        }
                      >
                        Copy Link
                      </MenuItem>
                      <MenuSeparator />
                    </>
                  ) : null}
                  <EntryContextItems
                    page={pageHolder}
                    from="help-viewer"
                    onLookUp={lookUp}
                    onCopy={menus.copy}
                  />
                </ContextualMenuPopup>
              </ContextualMenu>
            </div>
          </SplitViewPane>
        </SplitView>
      </WindowBody>
    </Window>
  );
}
