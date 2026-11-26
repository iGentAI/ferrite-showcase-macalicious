"use client";

import { BookCover } from "macalicious/book-cover";
import { BorderlessButton } from "macalicious/borderless-button";
import { CardGrid, CardGridCard } from "macalicious/card-grid";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { RoundRectButton } from "macalicious/round-rect-button";
import { ScrollView } from "macalicious/scroll-view";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps, type WindowState } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type HTMLAttributes,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { filesOfDrag, useDesktopDrop } from "../desktop/desktop-drag";
import { EditRows } from "../desktop/desktop-edit-rows";
import { readFile } from "../desktop/desktop-files";
import { readShown, readString, useKeptValue } from "../desktop/desktop-kept-value";
import {
  CHANGED_ELSEWHERE,
  onSaveFailure,
  servedByDesktopApp,
  useServerState,
} from "../desktop/desktop-server";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { CollectionNameField } from "../font-book/font-book-collections";
import { whenMenusClosed } from "../notes/notes-menus";
import { type BooksPageLayout, type BooksZoom, useBooksAppearance } from "./books-appearance";
import {
  BooksGlyph,
  CoverArtwork,
  PageArtwork,
  RealCoverArtwork,
  SectionIcon,
} from "./books-artwork";
import { BooksAudiobookPlayer } from "./books-audiobook-player";
import {
  AUDIOBOOK_STORE,
  BOOK_STORE,
  type BooksBook,
  type BooksCollection,
  type BooksSection,
  type BooksSort,
  type BooksView,
  bookMatches,
  booksIn,
  collectionName,
  defaultBooks,
  groupBooks,
  groupSeries,
  HIDDEN,
  isReadingList,
  KEPT_LISTS,
  MY_SAMPLES,
  moveBooks,
  READING_LISTS,
  SECTIONS,
  SERIES,
  SORTS,
  seriesOf,
  sortBooks,
  VIEWS,
} from "./books-data";
import { BOOK_FILE_TYPES, BookFileError, bookFileKind, bookFromFile } from "./books-import";
import {
  BookContextItems,
  BookInfoSheet,
  BookShareMenu,
  DeleteBooksCollectionAlert,
  DimmedRow,
  RevealBookRow,
} from "./books-library-menus";
import { BooksPdfReader } from "./books-pdf-reader";
import { BooksTextReader } from "./books-reader";
import {
  BOOKS_LIBRARY_URL,
  BOOKS_LIMITS,
  booksLibraryFromServer,
  booksLibraryReadable,
  booksLibrarySize,
  booksLibraryToServer,
  type OwnedBook,
  ownedFromStore,
  SOURCE_NAMES,
  type StoreBook,
} from "./books-server";
import { type BooksStorePage, BooksStoreView, STORE_GENRES, STORE_HOME } from "./books-store-view";
import "./books.tokens.css";
import "./books.css";

/** The props a window manager supplies for the window controls and the drag region. */
interface HostingProps {
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /**
   * Further props for the `WindowControls`. Its `onClose`, `onMinimize` and `onZoom` are
   * called after the window's own, never in place of them.
   */
  controlsProps?: WindowControlsProps;
  /** Called when the bar itself is pressed, not a control in it: a window manager moves the window. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the bar itself is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/*
 * The book window's bar is 37 pt high where the title-hidden bar is 38 (36 pt of fill and the
 * two separator rows, reference/spec/apps/books.md), so the row is set on the part.
 */
const READER_BAR: CSSProperties = { gridTemplateRows: "minmax(37px, auto)" };
/** The glyphs are 10.5 pt apart and the first is 8 pt after the title bar's controls. */
/** The most collections the module keeps (`MAX_COLLECTIONS`, its `mod.rs`). */
const MAX_COLLECTIONS = 100;

const BAR_ITEM = { "--mac-image-button-padding": "5.25px" } as CSSProperties;
/** A page button's hit area: 16 pt around its 7 by 12 pt chevron. */
const TURN: CSSProperties = { padding: 16 };
/** Search ends 10 pt before the bookmark, which the pull-down button starts 4 pt into its box. */
const SEARCH_ITEM = { ...BAR_ITEM, marginInlineEnd: 6 } as CSSProperties;
/** Room kept beside the last thumbnail for its shadow: the scroller's padding, in points. */
const STRIP_ROOM = 8;
const NO_BOOKMARKS: readonly number[] = [];
const NO_OWNED: readonly OwnedBook[] = [];
const readView = (stored: unknown) => VIEWS.find((item) => item.id === stored)?.id;

/** Why View > Hide iCloud Books is dimmed. */
const NO_ICLOUD_REASON =
  "This library is kept by the desktop's server for your account: none of its books are in iCloud.";
/** Why the Store menu's account rows are dimmed. */
const NO_STORE_ACCOUNT_REASON =
  "Every book here is free from Project Gutenberg or Standard Ebooks: your desktop account is the only account, and the store has none of its own.";
const NO_BOOK_PICKED = "Click a book in the library, or open one, first.";
const NO_OPEN_BOOK = "Open a book first.";
const NOTHING_HIDDEN = "No book is hidden. Hide one from its cover's menu.";
const NO_BOOKS: readonly string[] = [];

/** The smallest a book window is made by its edges: its bar's items and a column of text fit. */
const BOOK_MIN = { width: 420, height: 420 };
/** How much of a moved book window stays on the screen, in points: it can always be taken again. */
const BOOK_KEPT = 80;
/** The book window's edges that resize it. The top is its bar, which moves it. */
const BOOK_EDGES = ["e", "w", "s", "se", "sw"] as const;
type BookEdge = (typeof BOOK_EDGES)[number];

/** Why a sidebar row with nothing in it is empty, on the served desktop. */
const EMPTY_ROWS: Record<string, string> = {
  audiobooks: "No Audiobooks: get one from LibriVox in the Audiobook Store.",
  pdfs: "No PDFs: choose File > Add to Library to add one from your computer.",
  series:
    "No Series: a book shows here when its title names a volume, such as “Book 2”. Neither source says which series a book belongs to.",
  [MY_SAMPLES.id]: "No Samples: choose Sample on a book's page in the Book Store.",
};

/** View > Grid and View > List: how the library shows its books. */
type BooksLayout = "grid" | "list";
const readLayout = (stored: unknown): BooksLayout | undefined =>
  stored === "grid" || stored === "list" ? stored : undefined;
/** The columns of View > List. A heading sorts by what Sort By offers, which has one direction. */
const LIST_COLUMNS: readonly TableViewColumn[] = [
  { id: "title", title: "Title", sortable: true },
  { id: "author", title: "Author", width: 220, sortable: true },
  { id: "recent", title: "Date Added", width: 130, sortable: true },
];
const LIST_ROW_HEIGHT = 22;
const readOpenBook = (stored: unknown): string | null | undefined => readString(stored);

/** A book of the person's library as the library window lists it: grouped under its source. */
const asBooksBook = (book: OwnedBook): BooksBook => ({
  id: book.id,
  title: book.title,
  author: book.author || "Unknown author",
  category: SOURCE_NAMES[book.source],
  kind: book.source === "pdf" ? "pdf" : book.source === "librivox" ? "audiobook" : "book",
  added: book.added,
  pages: 1,
});

/**
 * The book window's props for the reader of a real book: all that `readerProps` gives (its size,
 * window controls, title bar, style and the rest) but the page and the bookmarks of the demo's
 * numbered pages, which a real book keeps as places in its text.
 */
function textReaderProps(given: BooksProps["readerProps"]) {
  const { onPageChange: _page, onBookmarksChange: _bookmarks, ...props } = given ?? {};
  return props;
}

/** A store book of a generous size: whether one more fits tells the store to stop offering Get. */
const PROBE_BOOK: StoreBook = {
  id: "pg-999999",
  title: "x".repeat(120),
  author: "x".repeat(60),
  source: "gutenberg",
  cover: "https://www.gutenberg.org/cache/epub/999999/pg999999.cover.medium.jpg",
};

/** Whether a drag brings files from the person's computer. */
const takesFiles = (event: DragEvent) => event.dataTransfer.types?.includes("Files") === true;

/**
 * Both handlers, the first and then the second, or the one that is given. A window's own
 * window-control handler and the one in its `controlsProps` are chained this way, so that
 * neither replaces the other.
 */
function chain<A extends unknown[]>(
  first: ((...args: A) => void) | undefined,
  second: ((...args: A) => void) | undefined,
): ((...args: A) => void) | undefined {
  if (!first || !second) return first ?? second;
  return (...args) => {
    first(...args);
    second(...args);
  };
}

/**
 * A `zIndex` given in a style as a whole number, or as text that CSS takes as an integer: digits
 * with an optional sign. Anything else is none: a fraction such as 1.5, and text that a number
 * reads but CSS does not take as a `z-index` (`1e3`, `0x10`, `1.0`).
 */
function numberOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string" || !/^[\t\n\f\r ]*[+-]?\d+[\t\n\f\r ]*$/.test(value)) return null;
  const level = Number(value);
  return Number.isInteger(level) ? level : null;
}

/**
 * The level a `zIndex` given in a style comes to on `element`, as the browser works it out
 * there: `var(--layer)` with the element's own custom properties, `inherit` from its parent,
 * `calc()`. It is set on the element for the measurement and the element's own level is put
 * back. Nothing (`null`) for no value, `auto`, or one the browser does not take.
 */
function resolveLevel(element: HTMLElement | null, value: unknown): number | null {
  if (!element || value === undefined || value === null || value === "") return null;
  const view = element.ownerDocument.defaultView;
  if (!view) return null;
  const own = element.style.zIndex;
  element.style.zIndex = "";
  element.style.zIndex = String(value);
  const taken = element.style.zIndex !== "";
  const level = taken ? Number(view.getComputedStyle(element).zIndex) : NaN;
  element.style.zIndex = own;
  return Number.isInteger(level) ? level : null;
}

/** Whether `element`'s `z-index` applies: it is positioned, or a flex or grid item. */
function levelApplies(element: Element, view: Window, style: CSSStyleDeclaration): boolean {
  const parent = element.parentElement ? view.getComputedStyle(element.parentElement) : null;
  return style.position !== "static" || (parent !== null && /flex|grid/.test(parent.display));
}

/** The properties that start a stacking context, as `will-change` names them. */
const STACKING_CHANGES = new Set([
  "opacity",
  "transform",
  "translate",
  "rotate",
  "scale",
  "perspective",
  "filter",
  "backdrop-filter",
  "clip-path",
  "mask",
  "mask-image",
  "mask-border",
  "mask-border-source",
  "-webkit-mask",
  "-webkit-mask-image",
  "-webkit-mask-box-image",
  "-webkit-mask-box-image-source",
  "isolation",
  "mix-blend-mode",
  "z-index",
  "position",
  "contain",
  "offset-path",
  "view-transition-name",
]);

/** Whether `element` starts a stacking context of its own, by its computed style. */
function stacks(element: Element, view: Window): boolean {
  if (element === element.ownerDocument.documentElement) return true;
  const style = view.getComputedStyle(element);
  const has = (name: string, none = "none") => {
    const value = style.getPropertyValue(name);
    return value !== "" && value !== none;
  };
  return (
    (style.zIndex !== "auto" && levelApplies(element, view, style)) ||
    style.position === "fixed" ||
    style.position === "sticky" ||
    Number(style.opacity) < 1 ||
    ["transform", "translate", "rotate", "scale", "filter", "backdrop-filter"].some((name) =>
      has(name),
    ) ||
    [
      "perspective",
      "clip-path",
      "mask-image",
      "-webkit-mask-image",
      "mask-border-source",
      "-webkit-mask-box-image-source",
      "offset-path",
    ].some((name) => has(name)) ||
    has("view-transition-name") ||
    has("isolation", "auto") ||
    has("mix-blend-mode", "normal") ||
    /paint|layout|strict|content/.test(style.getPropertyValue("contain")) ||
    // Each name `will-change` lists, whole: `foo-transform` or `--transform` is not `transform`.
    style
      .getPropertyValue("will-change")
      .split(",")
      .some((name) => STACKING_CHANGES.has(name.trim()))
  );
}

/**
 * The level, in the stacking context that holds the library window, of the stacking context
 * the book window is drawn in when `container` (the element it is rendered into) is in one
 * that does not hold the library: a `windowsContainer` with `position: relative; z-index: 0`,
 * say. There the book window's level orders it only within that context, and it is the
 * context, at its level and its place in the document, that the library window is drawn over
 * or under. The level is the context's `z-index` where that applies (a positioned element, a
 * flex or grid item), and 0 where it does not (a transform, `isolation`, `will-change`).
 * `before` is whether the library comes first in the document, so that at the same level the
 * context is drawn over it. Nothing (`null`) when the two windows share a stacking context, or
 * when the library window is in one of its own below the shared one, which no level of its
 * can leave.
 */
function trapOf(
  library: HTMLElement | null,
  container: Element | null,
): { level: number; before: boolean } | null {
  const view = library?.ownerDocument.defaultView;
  if (!library || !container || !view) return null;
  let top: Element | null = null;
  let shared: Element | null = container;
  for (; shared && !shared.contains(library); shared = shared.parentElement) {
    if (stacks(shared, view)) top = shared;
  }
  if (!top || !shared) return null;
  for (let around = library.parentElement; around && around !== shared; ) {
    if (stacks(around, view)) return null;
    around = around.parentElement;
  }
  const style = view.getComputedStyle(top);
  const level = levelApplies(top, view, style) ? Number(style.zIndex) : 0;
  return {
    level: Number.isInteger(level) ? level : 0,
    before: Boolean(library.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING),
  };
}

/** The levels browsers keep apart: those of a 32-bit integer. */
const LOWEST_LEVEL = -2147483648;
const HIGHEST_LEVEL = 2147483647;

/**
 * The level `step` (1 or 2) above the higher of the levels given, or above 0 when none is. The
 * base is held within the browser's levels, two below the highest, so that the two windows'
 * levels are always two different levels the browser keeps apart.
 */
function levelAbove(levels: (number | null)[], step: number): number {
  const given = levels.filter((level): level is number => level !== null);
  const base = given.length === 0 ? 0 : Math.trunc(Math.max(...given));
  return Math.min(Math.max(base, LOWEST_LEVEL), HIGHEST_LEVEL - 2) + step;
}

/** Within the levels browsers keep apart. */
const inLevels = (level: number) => Math.min(Math.max(level, LOWEST_LEVEL), HIGHEST_LEVEL);

/** Whether two measurements are the same, short of the browser's rounding to its layout units. */
const near = (a: number, b: number) => Math.abs(a - b) < 0.05;

/** The side, in the book window's units, of the empty box that finds its containing block. */
const PROBE = 10;
const PROBE_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: PROBE,
  height: PROBE,
  visibility: "hidden",
  pointerEvents: "none",
};
/** Points at the probe's corner and one probe-side along each axis: the block's axes' ways. */
const PROBE_MARKS: readonly CSSProperties[] = [
  [0, 0],
  [PROBE, 0],
  [0, PROBE],
].map(([left, top]) => ({ position: "absolute", left, top, width: 0, height: 0 }));

/**
 * The scale of the probe's containing block along each of the screen's axes, signed: negative
 * where the block is mirrored along it. Nothing (`null`) where the block is turned, its axes
 * not along the screen's, or the marks are not drawn.
 */
function axesOf(
  probe: HTMLElement | null,
): { x: number; y: number; originX: number; originY: number } | null {
  const [origin, across, down] = [...(probe?.children ?? [])].map((mark) =>
    mark.getBoundingClientRect(),
  );
  if (!origin || !across || !down) return null;
  const alongX = across.left - origin.left;
  const alongY = down.top - origin.top;
  // Turned, or too small to tell: any movement across an axis beyond a hundredth of the
  // movement along it. Such a block is placed without the corrections that rely on the axes.
  const turned =
    Math.abs(across.top - origin.top) > Math.abs(alongX) / 100 ||
    Math.abs(down.left - origin.left) > Math.abs(alongY) / 100;
  if (turned || Math.abs(alongX) < 0.01 || Math.abs(alongY) < 0.01) return null;
  return { x: alongX / PROBE, y: alongY / PROBE, originX: origin.left, originY: origin.top };
}

/**
 * Scrolls the strip so that the current page's thumbnail is in view, with room for its shadow.
 * Only the strip moves, never the page around the window. The boxes are measured in the
 * screen's pixels and the scroll is in the strip's own, which differ in a scaled host.
 */
function revealCurrent(view: HTMLElement | null) {
  const thumbnail = view?.querySelector('[aria-current="page"]');
  if (!view || !thumbnail) return;
  const frame = view.getBoundingClientRect();
  const box = thumbnail.getBoundingClientRect();
  const scale = view.offsetWidth > 0 && frame.width > 0 ? frame.width / view.offsetWidth : 1;
  if (box.left < frame.left) view.scrollLeft += (box.left - frame.left) / scale;
  else if (box.right > frame.right - STRIP_ROOM * scale) {
    view.scrollLeft += (box.right - frame.right) / scale + STRIP_ROOM;
  }
}

export interface BooksReaderProps extends Omit<WindowProps, "children">, HostingProps {
  /** The book the window shows; its title is the window's. */
  book: BooksBook;
  /** The page shown, from 1, when the owner controls it. */
  page?: number;
  /**
   * The page shown at first.
   * @default 1
   */
  defaultPage?: number;
  /** Called with the page a thumbnail, a page button, a menu or an arrow key turns to. */
  onPageChange?: (page: number) => void;
  /** The bookmarked pages, in order, when the owner keeps them. */
  bookmarks?: readonly number[];
  /**
   * The pages bookmarked at first.
   * @default []
   */
  defaultBookmarks?: readonly number[];
  /** Called with the bookmarked pages, in order, when one is added or removed. */
  onBookmarksChange?: (bookmarks: readonly number[]) => void;
  /** Called by the Library button of the bar. */
  onLibrary?: () => void;
}

/**
 * The book window of Books: a title bar with the Library, Table of Contents and Notes buttons
 * before the centred title and Search and Bookmarks after it, the page, and the strip of page
 * thumbnails with their numbered badges. Its root is the library's `Window`, which takes every
 * other prop. The page and the thumbnails are placeholders: a book's pages are its artwork.
 */
export function BooksReader({
  book,
  page,
  defaultPage = 1,
  onPageChange,
  bookmarks,
  defaultBookmarks = NO_BOOKMARKS,
  onBookmarksChange,
  onLibrary,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 786,
  height = 785,
  className,
  ...props
}: BooksReaderProps) {
  const [own, setOwn] = useState(defaultPage);
  const [ownMarks, setOwnMarks] = useState(defaultBookmarks);
  const marks = bookmarks ?? ownMarks;
  const setMarks = (next: readonly number[]) => {
    setOwnMarks(next);
    onBookmarksChange?.(next);
  };
  const scroller = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const count = Math.max(1, Math.trunc(book.pages));
  const clamp = (value: number) => Math.min(Math.max(Math.trunc(value) || 1, 1), count);
  const current = clamp(page ?? own);
  const numbers = Array.from({ length: count }, (_, index) => index + 1);
  const marked = marks.includes(current);

  // A strip that is wider than the window scrolls: the current page's thumbnail is kept in
  // view when the page changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the page is what moves the strip
  useLayoutEffect(() => revealCurrent(scroller.current), [current, count]);
  // And when the strip changes size: a window made narrower would otherwise hide it.
  useEffect(() => {
    const view = scroller.current;
    if (!view || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => revealCurrent(view));
    observer.observe(view);
    return () => observer.disconnect();
  }, []);

  const goTo = (next: number) => {
    const to = clamp(next);
    if (to === current) return;
    setOwn(to);
    onPageChange?.(to);
    // A thumbnail that held the focus hands it to the one of the new page.
    if (strip.current?.contains(strip.current.ownerDocument.activeElement)) {
      strip.current
        .querySelector<HTMLElement>(`[data-page="${to}"]`)
        ?.focus({ preventScroll: true });
    }
  };

  return (
    <Window
      width={width}
      height={height}
      className={className ? `mac-books-reader ${className}` : "mac-books-reader"}
      {...props}
    >
      <TitleBar
        variant="title-hidden"
        title={book.title}
        style={READER_BAR}
        controls={
          <WindowControls
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
            zoomRole={zoomRole}
            {...controlsProps}
            onClose={chain(onClose, controlsProps?.onClose)}
            onMinimize={chain(onMinimize, controlsProps?.onMinimize)}
            onZoom={chain(onZoom, controlsProps?.onZoom)}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
        <div className="mac-books-reader-bar" role="group" aria-label="Book controls">
          <ImageButton aria-label="Library" style={BAR_ITEM} onClick={onLibrary}>
            <BooksGlyph name="library" />
          </ImageButton>
          <Menu>
            <MenuTrigger render={<ImageButton aria-label="Table of Contents" style={BAR_ITEM} />}>
              <BooksGlyph name="contents" />
            </MenuTrigger>
            <MenuPopup>
              {numbers.map((number) => (
                <MenuItem key={number} onClick={() => goTo(number)}>
                  Page {number}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
          {/* Notes and Search are not built: the buttons are there, unavailable. */}
          <ImageButton aria-label="Notes" style={BAR_ITEM} disabled>
            <BooksGlyph name="notes" />
          </ImageButton>
          <span className="mac-books-reader-bar-space" />
          <ImageButton aria-label="Search" style={SEARCH_ITEM} disabled>
            <BooksGlyph name="search" />
          </ImageButton>
          <PullDownButton
            bordered={false}
            aria-label="Bookmarks"
            data-marked={marked ? "" : undefined}
            className="mac-books-bookmarks"
            image={<BooksGlyph name="bookmark" />}
          >
            <MenuItem
              onClick={() =>
                setMarks(
                  marked
                    ? marks.filter((number) => number !== current)
                    : [...marks, current].sort((a, b) => a - b),
                )
              }
            >
              {marked ? "Remove Bookmark" : "Add Bookmark"}
            </MenuItem>
            {marks.length > 0 ? <MenuSeparator /> : null}
            {marks.map((number) => (
              <MenuItem key={number} onClick={() => goTo(number)}>
                Page {number}
              </MenuItem>
            ))}
          </PullDownButton>
        </div>
      </TitleBar>
      <WindowBody
        className="mac-books-reader-body"
        onKeyDown={(event) => {
          if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          goTo(current + (event.key === "ArrowRight" ? 1 : -1));
        }}
      >
        <div className="mac-books-spread" role="img" aria-label={`Page ${current} of ${count}`}>
          <PageArtwork title={book.title} page={current} />
        </div>
        {/* The page buttons. Their place and their fading are the wrappers'; the buttons are
            the library's, with room around the chevron to hit. */}
        <span className="mac-books-turn" data-direction="previous">
          <BorderlessButton
            aria-label="Previous Page"
            // At either end the button stays where the keyboard is, unavailable.
            focusableWhenDisabled
            disabled={current === 1}
            style={TURN}
            onClick={() => goTo(current - 1)}
          >
            <SystemImage name="go-back" />
          </BorderlessButton>
        </span>
        <span className="mac-books-turn" data-direction="next">
          <BorderlessButton
            aria-label="Next Page"
            focusableWhenDisabled
            disabled={current === count}
            style={TURN}
            onClick={() => goTo(current + 1)}
          >
            <SystemImage name="go-forward" />
          </BorderlessButton>
        </span>
        {/* The strip of thumbnails, in a box that scrolls it when the window is narrower. A
            thumbnail is the library's borderless button around the page's picture. */}
        <div ref={scroller} className="mac-books-strip-scroller">
          {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
          <div ref={strip} className="mac-books-strip" role="group" aria-label="Pages">
            {numbers.map((number) => (
              <BorderlessButton
                key={number}
                className="mac-books-thumbnail"
                data-page={number}
                aria-label={`Page ${number}`}
                aria-current={number === current ? "page" : undefined}
                onClick={() => goTo(number)}
              >
                <PageArtwork title={book.title} page={number} small />
                <span className="mac-books-badge" aria-hidden="true">
                  <span className="mac-books-badge-number">{number}</span>
                </span>
              </BorderlessButton>
            ))}
          </div>
        </div>
      </WindowBody>
    </Window>
  );
}

/*
 * Books' source list departs from the standard one (reference/spec/apps/books.md): 24 pt rows
 * with nothing between them, the label 10.5 pt after the icon, the first row 22 pt under the
 * toolbar, the second header 9.5 pt under the last row and each header's baseline 16 pt under
 * its top. The sidebar's hooks hold these; the list is as high as its rows, so that the add
 * button follows it.
 */
const SIDEBAR = {
  flex: "0 1 auto",
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-label-gap": "10.5px",
  "--mac-sidebar-section-gap": "9.5px",
  "--mac-sidebar-header-inset": "5px",
} as CSSProperties;
const FIRST_SECTION: CSSProperties = { marginBlockStart: -3 };
/** The add button is the capture's 18 pt square: the round-rect button's height, and as wide. */
const ADD: CSSProperties = { width: 18, padding: 0 };
/** A cover fills its cell of the grid, which is 145.5 pt wide in the capture. */
const COVER = { "--mac-book-cover-width": "100%" } as CSSProperties;
/** The split view's hook for the colour of its line, set to the one measured beside the sidebar. */
const DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-books-sidebar-divider)",
} as CSSProperties;
/*
 * Measured, bezels included: the sidebar button is 39 by 23 pt, the segmented control 383 pt
 * wide with its second divider 255 pt in, and the search field 158 by 22 pt. A toolbar
 * control's box is its fill and its bezel is half a point larger on every side, so the boxes
 * are a point smaller: 38 pt, segments of 127, 128 and 127 pt, and a 157 by 21 pt field.
 */
const SIDEBAR_BUTTON: CSSProperties = { width: 38 };
const SEGMENTS: readonly CSSProperties[] = [127, 128, 127].map((width) => ({
  flex: "none",
  width,
}));
const SEARCH: CSSProperties = { width: 157, height: 21, marginBlock: 0.5, marginInlineEnd: 0.5 };
/*
 * The covers: 145.5 pt wide in the capture's 963 pt pane, 42 pt from its edge, which five
 * columns 37.875 pt apart give; the smallest width is half a point under that, so that five
 * fit whatever the rounding. The card grid's variables hold the margin and the header's
 * type, 13 pt Semibold for the names of authors and categories.
 */
const SHELF = {
  "--mac-card-grid-margin": "42px",
  "--mac-card-grid-title-font":
    "var(--mac-font-weight-semibold) 13px / 16px var(--mac-font-family-system)",
  "--mac-card-grid-header-padding": "0 0 10px",
} as CSSProperties;

export interface BooksProps extends Omit<WindowProps, "children">, HostingProps {
  /**
   * The library. Every book of the default library but the captures' one is invented.
   * @default the nine books of `defaultBooks`
   */
  books?: readonly BooksBook[];
  /**
   * The segment of the toolbar's control selected at first.
   * @default "library"
   */
  defaultView?: BooksView;
  /**
   * The sidebar row selected at first.
   * @default "all"
   */
  defaultSection?: BooksSection;
  /** Called with the sidebar row the user selects: a `BooksSection` or a collection's `id`. */
  onSectionChange?: (section: string) => void;
  /**
   * The order of the covers at first.
   * @default "recent"
   */
  defaultSort?: BooksSort;
  /** The `id` of a book whose window is open at first, as in the reference captures. */
  defaultOpenBook?: string;
  /** Called with the `id` of the book that is opened, and with `null` when its window closes. */
  onOpenBookChange?: (id: string | null) => void;
  /**
   * Where the book window opens, in points from the library window's top left corner: where
   * its box is drawn, with any margin or transform it is given.
   * @default { x: 96, y: 48 }
   */
  bookOffset?: { x: number; y: number };
  /**
   * Further props for the book window: its `width` and `height`, 786 by 785 by default. Its
   * callbacks (`onPageChange`, `onBookmarksChange`, `onLibrary`, `onClose`, the pointer-down
   * and focus captures) are called after the app's own; the page and the bookmarks are the
   * app's, kept for each book, so `page`, `defaultPage`, `bookmarks` and `defaultBookmarks`
   * are not taken.
   */
  readerProps?: Partial<
    Omit<BooksReaderProps, "book" | "page" | "defaultPage" | "bookmarks" | "defaultBookmarks">
  >;
  /**
   * The element the book window is rendered into, over the library window. It need not be
   * positioned: the book window is kept at `bookOffset` from the library window in whatever
   * element it is placed against, and at that element's scale.
   * @default the library window's offset parent, or the document's body
   */
  windowsContainer?: HTMLElement | null;
}

/**
 * Books, as in macOS 10.15 Catalina: the library window, with a unified toolbar whose centred
 * segmented control switches between the library and the two stores, a sidebar of the
 * library's sections and collections, and the covers; and the book window that a double click
 * on a cover opens in front of it.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its drag region through the callbacks. The book window is
 * a second `Window`, rendered beside this one. Every cover and page is a placeholder.
 */
export function Books({
  books = defaultBooks,
  defaultView = "library",
  defaultSection = "all",
  onSectionChange,
  defaultSort = "recent",
  defaultOpenBook,
  onOpenBookChange,
  bookOffset = { x: 96, y: 48 },
  readerProps,
  windowsContainer,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state = "key",
  width = 1184,
  height = 784,
  className,
  style,
  ref,
  onPointerDownCapture,
  onFocusCapture,
  ...props
}: BooksProps) {
  const [view, setView] = useKeptValue<BooksView>("books.view", readView, defaultView);
  const [section, setSection] = useKeptValue<string>("books.section", readString, defaultSection);
  const [sort, setSort] = useState<BooksSort>(defaultSort);
  const [query, setQuery] = useState("");
  const [sidebar, setSidebar] = useKeptValue("books.sidebar", readShown, true);
  const [layout, setLayout] = useKeptValue<BooksLayout>("books.layout", readLayout, "grid");
  const [showHidden, setShowHidden] = useKeptValue("books.showHidden", readShown, false);
  const [collections, setCollections] = useState<readonly BooksCollection[]>([]);
  // The collections the person made, under Collections; the reading lists are kept among them.
  const ownCollections = useMemo(
    () => collections.filter((item) => !isReadingList(item.id)),
    [collections],
  );
  const [openId, setOpenId] = useKeptValue<string | null>(
    "books.openBook",
    readOpenBook,
    defaultOpenBook ?? null,
  );
  // The covers selected, in the order they were; a plain click selects one alone.
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [menuCollection, setMenuCollection] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BooksCollection | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const draggedBooks = useRef<readonly string[]>([]);
  const [dropOn, setDropOn] = useState<string | null>(null);
  // The cover last clicked or given the keyboard: what File > Open Book opens.
  const [picked, setPicked] = useState<string | null>(null);
  const appearance = useBooksAppearance();
  const [storePage, setStorePage] = useState<BooksStorePage>(STORE_HOME);
  const [audiobookPage, setAudiobookPage] = useState<BooksStorePage>(STORE_HOME);
  const printBook = useRef<(() => void) | null>(null);
  // The page each book was left at: a book opens again where it was closed.
  const [pages, setPages] = useState<Readonly<Record<string, number>>>({});
  // The bookmarks of each book: they outlive its window, which closes and opens again.
  const [marks, setMarks] = useState<Readonly<Record<string, readonly number[]>>>({});
  // Served by the desktop's Ferrite application, Books is a real one: the library is the books
  // the person got from the Book Store (Project Gutenberg and Standard Ebooks), the store is those
  // two catalogues, and a book opens in the reader of its real text.
  const real = servedByDesktopApp();
  const [owned, setOwned] = useState<readonly OwnedBook[]>(NO_OWNED);
  // The person's books as the last change left them, ahead of the render that shows it: every
  // change of the books starts from this, so changes that finish in the same moment (a book got
  // while another is removed) all count, and none brings back a book removed.
  const latestOwned = useRef<readonly OwnedBook[]>(NO_OWNED);
  const keepOwned = (next: readonly OwnedBook[]) => {
    latestOwned.current = next;
    setOwned(next);
  };
  const [notice, setNotice] = useState<string | null>(null);
  // A save of the library the server refused or could not take is told in the window.
  useEffect(() => {
    if (!real) return;
    return onSaveFailure((failure) => {
      if (failure.url !== BOOKS_LIBRARY_URL) return;
      setNotice(
        failure.reason === CHANGED_ELSEWHERE
          ? "Your library was changed in another window or browser first, so this change was not kept."
          : `Your library could not be saved (${failure.reason}). The next change sends it again.`,
      );
    });
  }, [real]);
  // Served by the desktop's Ferrite application: the person's collections, pages, bookmarks,
  // Sort By choice and books replace the demo's starting ones, and every change is saved. Until
  // the first load settles the library is inert, so no change is made that the load would replace.
  const library = useMemo(
    () => ({ collections, pages, marks, sort, books: owned }),
    [collections, pages, marks, sort, owned],
  );
  const loading = useServerState({
    url: BOOKS_LIBRARY_URL,
    enabled: real,
    value: library,
    onLoad: (stored) => {
      if (!booksLibraryReadable(stored)) return false;
      // Nothing saved yet, or the library forgotten elsewhere: the demo's starting state.
      const kept = booksLibraryFromServer(stored);
      setCollections(kept?.collections ?? []);
      setPages(kept?.pages ?? {});
      setMarks(kept?.marks ?? {});
      setSort(kept?.sort ?? defaultSort);
      keepOwned(kept?.books ?? NO_OWNED);
    },
    toBody: booksLibraryToServer,
  });
  const shelved = useMemo(() => (real ? owned.map(asBooksBook) : books), [real, owned, books]);
  // Which of the two windows is in front. A book comes to the front when it opens.
  const [wanted, setWanted] = useState<"library" | "book">("book");
  const open = shelved.find((book) => book.id === openId) ?? null;
  const openOwned = real && open ? (owned.find((book) => book.id === open.id) ?? null) : null;
  // A selection is of the covers shown: it goes with them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when what is shown changes
  useEffect(() => {
    setSelected([]);
  }, [view, section, query]);
  // A book that appears comes to the front, also one kept open across a reload, whose library
  // window has the keyboard by the time the library has loaded.
  const openBookId = open?.id;
  useEffect(() => {
    if (openBookId) setWanted("book");
  }, [openBookId]);
  const front = open ? wanted : "library";
  // The front window has the state the page gives the app; the other one is behind it.
  const stateOf = (window: "library" | "book"): WindowState =>
    front === window || state === "inactive" ? state : "inactive";

  // The keyboard goes with the window that is in front: to the book window when a book is
  // opened, and back to the book's cover when its window, which had the keyboard, closes.
  const reader = useRef<HTMLDivElement | null>(null);
  const takeFocus = useRef(false);
  const giveBack = useRef<string | null>(null);

  const openBook = (book: BooksBook | null) => {
    if (book) {
      takeFocus.current = true;
      giveBack.current = null;
    } else {
      const window = reader.current;
      const held = window?.contains(window.ownerDocument.activeElement) ?? false;
      takeFocus.current = false;
      giveBack.current = held ? openId : null;
    }
    setOpenId(book ? book.id : null);
    if (book) setWanted("book");
    onOpenBookChange?.(book ? book.id : null);
  };
  // After every render: the book window is there a render after the book is opened.
  useEffect(() => {
    if (takeFocus.current) {
      // The page's thumbnail; in the reader of a real book, which has none, its Next Page button.
      const thumbnail =
        reader.current?.querySelector<HTMLElement>('.mac-books-thumbnail[aria-current="page"]') ??
        reader.current?.querySelector<HTMLElement>(
          '.mac-books-text-body .mac-books-turn[data-direction="next"] button',
        ) ??
        // View > Scroll has no page buttons: the page that scrolls.
        reader.current?.querySelector<HTMLElement>('.mac-books-text-body [role="document"]');
      if (!thumbnail) return;
      takeFocus.current = false;
      thumbnail.focus({ preventScroll: true });
    } else if (giveBack.current !== null && !open) {
      const id = giveBack.current;
      giveBack.current = null;
      const covers = root.current?.querySelectorAll<HTMLElement>("[data-book]") ?? [];
      [...covers].find((cover) => cover.dataset.book === id)?.focus({ preventScroll: true });
    }
  });
  const choose = (next: string) => {
    setSection(next);
    onSectionChange?.(next);
  };
  const addCollection = (holding: readonly string[] = []) => {
    if (loading) return;
    const number = ownCollections.reduce((most, { id }) => Math.max(most, Number(id.slice(11))), 0);
    const added = {
      id: `collection-${number + 1}`,
      name: collectionName(ownCollections),
      books: holding,
    };
    const next = [...collections, added];
    if (
      real &&
      (next.length > MAX_COLLECTIONS ||
        booksLibrarySize({ ...library, collections: next }) > BOOKS_LIMITS.bytes)
    ) {
      setNotice("Your library is full: remove a book or a collection to add another.");
      return;
    }
    setNotice(null);
    setCollections(next);
    choose(added.id);
    return added.id;
  };
  /** Whether a collection or reading list holds a book. */
  const inList = (list: string, id: string) =>
    collections.some((item) => item.id === list && item.books.includes(id));
  /** Puts books in a collection or reading list, or takes them out. A reading list starts here. */
  const setInList = (list: string, ids: readonly string[], member: boolean) => {
    if (loading) return;
    setCollections((all) => {
      const name = KEPT_LISTS.find((each) => each.id === list)?.name;
      const there = all.find((item) => item.id === list);
      if (!there && (!member || !name)) return all;
      const books = member
        ? [...new Set([...(there?.books ?? []), ...ids])]
        : (there?.books ?? []).filter((id) => !ids.includes(id));
      return there
        ? all.map((item) => (item.id === list ? { ...item, books } : item))
        : [...all, { id: list, name: name ?? list, books }];
    });
  };
  const renameCollection = (id: string, name: string) => {
    setRenaming(null);
    const named = name.trim();
    if (loading || named === "") return;
    setCollections((all) => all.map((item) => (item.id === id ? { ...item, name: named } : item)));
  };
  const deleteCollection = (collection: BooksCollection) => {
    if (loading) return;
    setCollections((all) => all.filter((item) => item.id !== collection.id));
    if (section === collection.id) choose("all");
  };
  const beginRename = (id: string) => whenMenusClosed(document, () => setRenaming(id));

  // The person's books (the desktop app only). A book joins the library once; one that would
  // take the library past what the module keeps is refused here, before anything changes. Both
  // are judged against the books as the last change left them (`latestOwned`).
  const tooMany = (next: readonly OwnedBook[]) =>
    next.length > BOOKS_LIMITS.books ||
    booksLibrarySize({ ...library, books: next }) > BOOKS_LIMITS.bytes;
  const full = real && tooMany([...owned, ownedFromStore(PROBE_BOOK, 0)]);
  /** Add `book`, or find it there already: the book the library holds, or `null` when full. */
  const addOwned = (book: OwnedBook): OwnedBook | null => {
    const current = latestOwned.current;
    const there = current.find((item) => item.id === book.id);
    if (there) return there;
    const next = [...current, book];
    if (tooMany(next)) {
      setNotice("Your library is full: remove a book to add another.");
      return null;
    }
    setNotice(null);
    keepOwned(next);
    return book;
  };
  const getBook = (book: StoreBook) => {
    if (loading) return;
    addOwned(ownedFromStore(book, Date.now()));
    if (samples.includes(book.id)) setInList(MY_SAMPLES.id, [book.id], false);
  };
  const sampleBook = (book: StoreBook) => {
    if (loading) return;
    if (addOwned(ownedFromStore(book, Date.now()))) setInList(MY_SAMPLES.id, [book.id], true);
  };
  // Books of the person's own: read here in the browser, and kept as files of their drive.
  const fileInput = useRef<HTMLInputElement>(null);
  const addFiles = async (files: readonly { file: File; driveId?: string }[], open = false) => {
    if (loading) return;
    setView("library");
    let last: string | null = null;
    for (const { file, driveId } of files) {
      setNotice(`Adding “${file.name}”…`);
      try {
        let already = false;
        const book = await bookFromFile(file, {
          driveId,
          now: Date.now(),
          known: (id) => {
            already = latestOwned.current.some((item) => item.id === id);
            return already;
          },
        });
        if (already) {
          last = book.id;
          setNotice(`“${book.title}” is already in your library.`);
          continue;
        }
        if (addOwned(book)) {
          last = book.id;
          setPicked(book.id);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setNotice(
          error instanceof BookFileError ? reason : `“${file.name}” could not be added: ${reason}`,
        );
      }
    }
    if (open && last) {
      setOpenId(last);
      setWanted("book");
    }
  };
  // A file Finder opens with Books: it joins the library from where it is, and opens.
  const openFileRequest = useRef<(request: OpenFileRequest) => void>(() => undefined);
  openFileRequest.current = (request) => {
    void readFile(request.id).then(
      (blob) =>
        addFiles(
          [
            {
              file: new File([blob], request.name, { type: blob.type }),
              driveId: request.id,
            },
          ],
          true,
        ),
      (error: unknown) =>
        setNotice(
          `“${request.name}” could not be read: ${error instanceof Error ? error.message : String(error)}`,
        ),
    );
  };
  useEffect(() => {
    if (!real || loading) return;
    for (const request of takeOpenFileRequests("books")) openFileRequest.current(request);
    return onOpenFileRequest("books", (request) => openFileRequest.current(request));
  }, [real, loading]);
  const dropFiles = useDesktopDrop<HTMLDivElement>({
    enabled: real && !loading,
    accepts: (item) => item.kind === "file" && bookFileKind(item) !== null,
    onDrop: (items) => {
      void (async () => {
        for (const item of items) {
          const [file] = await filesOfDrag([item]);
          if (file) await addFiles([{ file, driveId: item.bytes ? undefined : item.id }]);
        }
      })();
    },
    sayRefusal: setNotice,
    refusal: () => "Books takes EPUB and PDF files.",
  });
  const readBook = (id: string) => {
    const book = shelved.find((item) => item.id === id);
    if (book) openBook(book);
  };
  const removeBooks = (ids: readonly string[]) => {
    if (loading) return;
    keepOwned(latestOwned.current.filter((book) => !ids.includes(book.id)));
    setCollections(
      collections.map((collection) =>
        collection.books.some((book) => ids.includes(book))
          ? { ...collection, books: collection.books.filter((book) => !ids.includes(book)) }
          : collection,
      ),
    );
    setSelected((now) => now.filter((id) => !ids.includes(id)));
    setPages((now) => Object.fromEntries(Object.entries(now).filter(([id]) => !ids.includes(id))));
    if (openId !== null && ids.includes(openId)) openBook(null);
  };
  const keepProgress = useCallback((id: string, percent: number) => {
    setPages((now) => (now[id] === percent ? now : { ...now, [id]: percent }));
  }, []);
  const openBookProgress = useCallback(
    (percent: number) => {
      if (openId !== null) keepProgress(openId, percent);
    },
    [openId, keepProgress],
  );
  const samples = useMemo(
    () => collections.find((item) => item.id === MY_SAMPLES.id)?.books ?? NO_BOOKS,
    [collections],
  );
  const hiddenBooks = useMemo(
    () => collections.find((item) => item.id === HIDDEN.id)?.books ?? NO_BOOKS,
    [collections],
  );

  // On the desktop the book window moves and resizes on its own, inside the desktop window that
  // holds both. A book window keeps its frame until the app is closed.
  const [bookFrame, setBookFrame] = useState<{
    x: number;
    y: number;
    width?: number;
    height?: number;
  } | null>(null);
  const libraryFullScreen = props.fullScreen === true;
  const gesture = useRef<(() => void) | null>(null);
  useEffect(() => () => gesture.current?.(), []);
  const follow = (event: ReactPointerEvent<HTMLElement>, move: (x: number, y: number) => void) => {
    const [fromX, fromY] = [event.clientX, event.clientY];
    const page = event.currentTarget.ownerDocument;
    event.preventDefault();
    const onMove = (next: PointerEvent) => move(next.clientX - fromX, next.clientY - fromY);
    const stop = () => {
      page.removeEventListener("pointermove", onMove);
      page.removeEventListener("pointerup", stop);
      page.removeEventListener("pointercancel", stop);
      gesture.current = null;
    };
    page.addEventListener("pointermove", onMove);
    page.addEventListener("pointerup", stop);
    page.addEventListener("pointercancel", stop);
    gesture.current = stop;
  };
  /** The book window's frame now: what a gesture starts from. */
  const bookFrameNow = () => ({
    x: bookFrame?.x ?? bookOffset.x,
    y: bookFrame?.y ?? bookOffset.y,
    width: reader.current?.offsetWidth ?? 786,
    height: reader.current?.offsetHeight ?? 785,
  });
  const moveBookWindow = (event: ReactPointerEvent<HTMLElement>) => {
    const window = reader.current;
    if (!window || event.button !== 0 || libraryFullScreen) return;
    const start = bookFrameNow();
    const box = window.getBoundingClientRect();
    const view = window.ownerDocument.documentElement;
    follow(event, (dx, dy) =>
      setBookFrame((now) => ({
        ...now,
        x:
          start.x +
          Math.min(view.clientWidth - BOOK_KEPT - box.left, Math.max(BOOK_KEPT - box.right, dx)),
        y: start.y + Math.min(view.clientHeight - BOOK_KEPT - box.top, Math.max(-box.top, dy)),
      })),
    );
  };
  const resizeBookWindow = (edge: BookEdge, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const start = bookFrameNow();
    event.stopPropagation();
    follow(event, (dx, dy) => {
      const west = edge === "w" || edge === "sw";
      const east = edge === "e" || edge === "se";
      const south = edge !== "e" && edge !== "w";
      const width = Math.max(BOOK_MIN.width, start.width + (east ? dx : west ? -dx : 0));
      setBookFrame({
        x: west ? start.x + start.width - width : start.x,
        y: start.y,
        width,
        height: Math.max(BOOK_MIN.height, start.height + (south ? dy : 0)),
      });
    });
  };
  const bookEdges = real
    ? BOOK_EDGES.map((edge) => (
        <span
          key={edge}
          aria-hidden="true"
          className="mac-books-reader-edge"
          data-edge={edge}
          onPointerDown={(event) => resizeBookWindow(edge, event)}
        />
      ))
    : null;

  // The book window is a window of its own, so it is rendered outside this one, in the element
  // that positions it: a managed window's own element when the app is hosted, so that the book
  // moves, stacks and minimizes with the library. Its size is set on it, so a host that sizes
  // its children leaves it alone. After every render while it is open, so that it follows a
  // library window that its owner moves; nothing is set while nothing changed.
  const root = useRef<HTMLDivElement | null>(null);
  const probe = useRef<HTMLSpanElement | null>(null);
  const [host, setHost] = useState<{
    element: HTMLElement;
    left: number;
    top: number;
    shiftX: number;
    shiftY: number;
    trap: { level: number; before: boolean } | null;
  } | null>(null);
  // What a measurement of the drawn order found (the layout effect after `levelFor`): the
  // library window's level that puts the window in front over the other, or that no level
  // does ("beside"), and the book window is then rendered beside the library window, in its
  // parent. Kept until the book closes, or until what it was measured for changes: the
  // container the book window is rendered into, or a level the caller gives either window, as
  // given or as it resolves (cleared after the levels are resolved, below).
  const [fix, setFix] = useState<{
    front: "library" | "book";
    level: number | "beside";
  } | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!open || !element) return;
    const page = element.ownerDocument;
    const view = page.defaultView;
    const frame = element.getBoundingClientRect();
    const offsetParent = element.offsetParent instanceof HTMLElement ? element.offsetParent : null;
    const intended = windowsContainer ?? offsetParent;
    // A container in a stacking context that does not hold the library window is drawn over or
    // under it with that context (see `levelFor`). When the context is at the highest level and
    // later in the document, no level of the library's is over it. And when the library would
    // have to go below 0 to be under it, it would also go under the backgrounds of the
    // elements around it and could not be seen. In both cases the book window is rendered
    // beside the library window instead, in its parent, where the two windows' own levels
    // order them.
    let trap = trapOf(element, intended ?? page.body);
    const unorderable =
      fix?.level === "beside" ||
      (trap !== null &&
        ((trap.before && trap.level >= HIGHEST_LEVEL) || trap.level - (trap.before ? 0 : 1) < 0));
    if (unorderable) trap = null;
    const parent = unorderable ? element.parentElement : intended;
    const box = parent && parent !== page.body ? parent.getBoundingClientRect() : null;
    // The measurements are in the screen's pixels and the offsets in the container's own: a
    // container that is scaled (a CSS transform) differs by its scale, its rendered size over
    // its layout size.
    const scaleX = parent && box && parent.offsetWidth > 0 ? box.width / parent.offsetWidth : 1;
    const scaleY = parent && box && parent.offsetHeight > 0 ? box.height / parent.offsetHeight : 1;
    const next = {
      element: parent && box ? parent : page.body,
      left:
        parent && box
          ? (frame.left - box.left) / (scaleX || 1) - parent.clientLeft + parent.scrollLeft
          : frame.left + (view?.scrollX ?? 0),
      top:
        parent && box
          ? (frame.top - box.top) / (scaleY || 1) - parent.clientTop + parent.scrollTop
          : frame.top + (view?.scrollY ?? 0),
      shiftX: 0,
      shiftY: 0,
      trap,
    };
    // That is right only when the element is the book window's containing block. It is not
    // when the element is not positioned, for the window is then placed against the nearest
    // positioned ancestor, nor when it is the document's body and the body is scaled. So an
    // empty, hidden box, placed as the window is but at 0, 0, is rendered beside it and
    // measured: where it is drawn is the corner of the window's containing block, and its size
    // over its own the scale of that block's units. The window's own margin and transform are
    // measured apart, from where the window itself is drawn.
    const mark =
      host && host.element === next.element ? probe.current?.getBoundingClientRect() : null;
    if (mark && mark.width > 0 && mark.height > 0) {
      const scaleX = mark.width / PROBE;
      const scaleY = mark.height / PROBE;
      next.left = (frame.left - mark.left) / scaleX;
      next.top = (frame.top - mark.top) / scaleY;
      // A block that is mirrored (a negative scale) is measured by its own axes: the library
      // window's corner is the one at the block's origin side, and the book window is placed
      // `bookOffset` from it in the block's own coordinates, mirrored with it on the screen.
      const axes = axesOf(probe.current);
      if (axes) {
        next.left = ((axes.x > 0 ? frame.left : frame.right) - axes.originX) / axes.x;
        next.top = ((axes.y > 0 ? frame.top : frame.bottom) - axes.originY) / axes.y;
      }
      // And where the book window itself is drawn, against the same corner: a margin or a
      // transform of its own (in `readerProps.style`, or from a style sheet) moves it from its
      // `left` and `top`. That shift, which does not depend on `left` and `top`, is taken off
      // them, so that the window is drawn `bookOffset` from the library window's corner. Each
      // axis is measured in the block's own direction, as the library window's corner is: the
      // window's corner on the block's origin side, against the block's origin, in its signed
      // units. So in a mirrored block a larger `left` moves the window the block's way and the
      // shift is taken off the same way. In a turned block (no axes) the window's own margin
      // and transform are not allowed for, and its place depends on the library window alone.
      const book = reader.current;
      const drawn =
        book?.parentElement === next.element && axes ? book.getBoundingClientRect() : null;
      const used = book && view && drawn ? view.getComputedStyle(book) : null;
      const left = used ? Number.parseFloat(used.left) : NaN;
      const top = used ? Number.parseFloat(used.top) : NaN;
      if (axes && drawn && (drawn.width > 0 || drawn.height > 0) && Number.isFinite(left + top)) {
        next.shiftX = ((axes.x > 0 ? drawn.left : drawn.right) - axes.originX) / axes.x - left;
        next.shiftY = ((axes.y > 0 ? drawn.top : drawn.bottom) - axes.originY) / axes.y - top;
      }
    }
    setHost((now) =>
      now &&
      now.element === next.element &&
      near(now.left, next.left) &&
      near(now.top, next.top) &&
      near(now.shiftX, next.shiftX) &&
      near(now.shiftY, next.shiftY) &&
      now.trap?.level === next.trap?.level &&
      now.trap?.before === next.trap?.before
        ? now
        : next,
    );
  });

  // The library window can move against the book window without a render: a container or the
  // page scrolls, or a box is resized. While a book is open those ask for one measurement in
  // the next frame, which the layout effect above then makes.
  const [, setRemeasure] = useState(0);
  useEffect(() => {
    const element = root.current;
    if (!open || !element) return;
    const page = element.ownerDocument;
    const view = page.defaultView;
    if (!view) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        setRemeasure((count) => count + 1);
      });
    };
    page.addEventListener("scroll", schedule, { capture: true, passive: true });
    view.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(element);
    if (element.parentElement) observer?.observe(element.parentElement, { box: "border-box" });
    return () => {
      page.removeEventListener("scroll", schedule, { capture: true });
      view.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame) view.cancelAnimationFrame(frame);
    };
  }, [open]);

  // While a book is open the two windows are stacked, the front one over the other, on the
  // level a caller gives either of them (a `zIndex` in `style` or in `readerProps.style`): that
  // level lifts both, and never puts the one behind in front. A level that is not a number
  // (`var(--layer)`, `calc()`, `inherit`) is worked out where the caller gave it, on that
  // window, and the number it comes to is the one both windows stand on.
  // A book window in a stacking context of its own (a `windowsContainer` with a `zIndex`, a
  // transform, `isolation`) is drawn over or under the library with that context: the library
  // window's level is then set against the context's, one above it or one below (`host.trap`).
  const [resolved, setResolved] = useState<{ library: number | null; book: number | null }>({
    library: null,
    book: null,
  });
  useLayoutEffect(() => {
    const element = root.current;
    const library = open ? resolveLevel(element, style?.zIndex) : null;
    // The book window's level may come from the library window's (`inherit`, when it is
    // rendered inside it): that is resolved against the level the caller gave the library,
    // never the one set here, which would otherwise lift itself on every render.
    let book: number | null = null;
    if (open && element) {
      const own = element.style.zIndex;
      // Cleared first: a value the browser does not take (`1.5`, a typo) would otherwise leave
      // the generated level in place for the book window to inherit.
      element.style.zIndex = "";
      element.style.zIndex = style?.zIndex == null ? "" : String(style.zIndex);
      book = resolveLevel(reader.current, readerProps?.style?.zIndex);
      element.style.zIndex = own;
    }
    setResolved((now) => (now.library === library && now.book === book ? now : { library, book }));
  });
  // A measured level is cleared when what it was measured for changes. The resolved levels are
  // among those: a caller can keep the same `zIndex` text (`var(--layer)`, `inherit`) while the
  // number it comes to changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are what a fix was measured for
  useLayoutEffect(() => {
    setFix(null);
  }, [
    open,
    windowsContainer,
    style?.zIndex,
    readerProps?.style?.zIndex,
    resolved.library,
    resolved.book,
  ]);
  // The levels above come from the computed style of the elements around the windows, which
  // cannot tell every stacking context (one an animation keeps, `content-visibility`,
  // `transform-style: preserve-3d`, and whatever CSS adds). So the order is also measured
  // where it shows: at points of the part the two windows share, the list of what is drawn
  // there, front first, with both windows taking the pointer for the measurement. When the
  // window behind is drawn in front, the library window's level is searched for, among the
  // levels from 0 up (below 0 it would go under the backgrounds around it), that draws the
  // right one in front: the highest that keeps the library behind, or the lowest that brings
  // it forward. When none does, the book window is rendered beside the library window
  // instead. Nothing is measured while the windows do not overlap where they are seen, nor
  // where the browser has no `elementsFromPoint`; an observer of what of each window is seen
  // measures again when that changes (a scroll that brings them into view, say).
  const [, setSeen] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new book window is observed anew
  useEffect(() => {
    const library = root.current;
    const book = reader.current;
    if (!open || !library || !book || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(() => setSeen((count) => count + 1), {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });
    observer.observe(library);
    observer.observe(book);
    return () => observer.disconnect();
  }, [open, host?.element]);
  useLayoutEffect(() => {
    const library = root.current;
    const book = reader.current;
    const page = library?.ownerDocument;
    if (!open || !library || !book || !page || typeof page.elementsFromPoint !== "function") {
      return;
    }
    const a = library.getBoundingClientRect();
    const b = book.getBoundingClientRect();
    // The part the two windows share that is in view: points out of view are not drawn.
    const view = page.defaultView;
    const left = Math.max(a.left, b.left, 0);
    const right = Math.min(a.right, b.right, view?.innerWidth ?? Number.POSITIVE_INFINITY);
    const top = Math.max(a.top, b.top, 0);
    const bottom = Math.min(a.bottom, b.bottom, view?.innerHeight ?? Number.POSITIVE_INFINITY);
    if (right - left < 1 || bottom - top < 1) return;
    const pointer = [library.style.pointerEvents, book.style.pointerEvents];
    library.style.pointerEvents = "auto";
    book.style.pointerEvents = "auto";
    const orderAt = (x: number, y: number) => {
      const drawn = page.elementsFromPoint(x, y);
      const atBook = drawn.findIndex((element) => book.contains(element));
      const atLibrary = drawn.findIndex((element) => library.contains(element));
      if (atBook < 0 || atLibrary < 0) return null;
      return atBook < atLibrary ? "book" : "library";
    };
    // The middle of the shared part and four points around it: one that is clipped, or out
    // of view, is passed over for the next.
    const width = right - left;
    const height = bottom - top;
    const point = (
      [
        [0.5, 0.5],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ] as const
    )
      .map(([u, v]) => [left + u * width, top + v * height] as const)
      .find(([x, y]) => orderAt(x, y) !== null);
    const drawn = point ? orderAt(...point) : null;
    let level: number | "beside" | null = null;
    if (point && drawn !== null && drawn !== front) {
      const own = library.style.zIndex;
      const libraryOver = (at: number) => {
        library.style.zIndex = String(at);
        return orderAt(...point) === "library";
      };
      level = "beside";
      if (front === "library" ? libraryOver(HIGHEST_LEVEL) : !libraryOver(0)) {
        let low = 0;
        let high = HIGHEST_LEVEL;
        while (low < high) {
          if (front === "library") {
            const middle = Math.floor((low + high) / 2);
            if (libraryOver(middle)) high = middle;
            else low = middle + 1;
          } else {
            const middle = Math.ceil((low + high) / 2);
            if (libraryOver(middle)) high = middle - 1;
            else low = middle;
          }
        }
        level = low;
      }
      library.style.zIndex = own;
    }
    library.style.pointerEvents = pointer[0] ?? "";
    book.style.pointerEvents = pointer[1] ?? "";
    if (level === null) return;
    const found = level;
    setFix((now) =>
      now && now.front === front && now.level === found ? now : { front, level: found },
    );
  });
  const levelFor = (window: "library" | "book") => {
    if (open && window === "library" && fix?.front === front && typeof fix.level === "number") {
      return fix.level;
    }
    const trap = open ? host?.trap : null;
    if (trap && window === "library") {
      // At the same level the one later in the document is drawn over the other. The level
      // asked for is always one the browser keeps: a context at the end of the levels in the
      // way is never a trap (the book window is rendered beside the library instead).
      return inLevels(
        front === "library"
          ? trap.level + (trap.before ? 1 : 0)
          : trap.level - (trap.before ? 0 : 1),
      );
    }
    return levelAbove(
      [
        resolved.library ?? numberOf(style?.zIndex),
        resolved.book ?? numberOf(readerProps?.style?.zIndex),
      ],
      front === window ? 2 : 1,
    );
  };

  // A cover is the library's book cover, made a button; the picture on it is a placeholder, or
  // on the desktop app the book's own cover, with a menu. In the app a click selects it, Command
  // and Shift select more, and a selected cover can be dragged to a row of the sidebar.
  const shownCovers = useRef<readonly string[]>([]);
  // A cover that leaves the row, by a change of its lists, leaves the selection.
  useEffect(() => {
    setSelected((now) =>
      now.every((id) => shownCovers.current.includes(id))
        ? now
        : now.filter((id) => shownCovers.current.includes(id)),
    );
  });
  // The cover a Shift-click selects from: the last one clicked without Shift.
  const anchor = useRef<string | null>(null);
  const pick = (id: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => {
    setPicked(id);
    if (!real) return;
    const covers = shownCovers.current;
    if (event.shiftKey && anchor.current && covers.includes(anchor.current)) {
      const [from = 0, to = 0] = [covers.indexOf(anchor.current), covers.indexOf(id)].sort(
        (a, b) => a - b,
      );
      setSelected(covers.slice(from, to + 1));
      return;
    }
    anchor.current = id;
    if (event.metaKey || event.ctrlKey) {
      setSelected((now) => (now.includes(id) ? now.filter((each) => each !== id) : [...now, id]));
    } else {
      setSelected([id]);
    }
  };
  /** What a book's row or cover offers when dragged to a collection, for `covers`. */
  const dragFrom = (book: BooksBook, covers: readonly string[]) => ({
    onDragStart: (event: DragEvent<HTMLElement>) => {
      draggedBooks.current = covers;
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("text/plain", book.title);
    },
    onDragEnd: () => {
      draggedBooks.current = [];
      setDropOn(null);
    },
  });
  /** Under Sort By > Manually, what a cover or a row needs to take covers dragged before it. */
  const dropBefore = (id: string) =>
    sort === "manual" && section !== "authors" && section !== "categories"
      ? {
          "data-books-drop": dropOn === `before:${id}` ? "" : undefined,
          onDragOver: (event: DragEvent<HTMLElement>) => {
            if (draggedBooks.current.length === 0 || draggedBooks.current.includes(id)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropOn(`before:${id}`);
          },
          onDragLeave: () => setDropOn((now) => (now === `before:${id}` ? null : now)),
          onDrop: (event: DragEvent<HTMLElement>) => {
            event.preventDefault();
            if (!loading) keepOwned(moveBooks(latestOwned.current, draggedBooks.current, id));
            draggedBooks.current = [];
            setDropOn(null);
          },
        }
      : {};
  /** A secondary press: the book it is on, with the others when it is one of those selected. */
  const pressForMenu = (id: string) => {
    setPicked(id);
    if (!selected.includes(id)) setSelected([id]);
  };
  const bookItems = (book: BooksBook, covers: readonly string[]) => (
    <BookContextItems
      target={{
        ids: covers,
        collection: ownCollections.find((item) => item.id === section),
      }}
      book={book}
      collections={ownCollections}
      inList={inList}
      onOpen={() => openBook(book)}
      onSetList={setInList}
      onNewCollectionWith={(ids) => addCollection(ids)}
      onInfo={() => setInfoId(book.id)}
      onRemove={() => removeBooks(covers)}
    />
  );
  const cover = (book: BooksBook) => {
    const mine = real ? owned.find((item) => item.id === book.id) : undefined;
    const covers = selected.includes(book.id) ? selected : [book.id];
    const drag = dragFrom(book, covers);
    const read = pages[book.id];
    const element = (
      <BookCover
        key={book.id}
        render={<button type="button" />}
        className="mac-books-cover"
        style={COVER}
        data-book={book.id}
        data-selected={selected.includes(book.id) ? "" : undefined}
        data-hidden={hiddenBooks.includes(book.id) ? "" : undefined}
        data-drag={mine ? "" : undefined}
        draggable={mine ? true : undefined}
        onDragStart={mine ? drag.onDragStart : undefined}
        onDragEnd={drag.onDragEnd}
        {...(mine ? dropBefore(book.id) : {})}
        aria-label={`${book.title}, ${book.author}`}
        aria-pressed={mine ? selected.includes(book.id) : undefined}
        onDoubleClick={() => openBook(book)}
        onFocus={() => setPicked(book.id)}
        // Return and Space on the cover arrive as a click that no pointer made.
        onClick={(event) => {
          pick(book.id, event);
          if (event.detail === 0) openBook(book);
        }}
        onContextMenu={() => pressForMenu(book.id)}
      >
        {mine ? (
          <RealCoverArtwork cover={mine.cover} title={book.title} author={book.author} />
        ) : (
          <CoverArtwork id={book.id} title={book.title} author={book.author} />
        )}
        {mine ? (
          <span
            className="mac-books-cover-status"
            data-status={samples.includes(book.id) ? "new" : read ? "read" : "new"}
          >
            {samples.includes(book.id) ? "Sample" : read ? `${read}%` : "New"}
          </span>
        ) : null}
      </BookCover>
    );
    if (!mine) return element;
    return (
      <ContextualMenu key={book.id}>
        <ContextualMenuTrigger render={element} />
        <ContextualMenuPopup>{bookItems(book, covers)}</ContextualMenuPopup>
      </ContextualMenu>
    );
  };
  const shelf = (title: string | undefined, name: string, cells: ReactNode[]) => (
    <CardGrid
      key={name}
      title={title}
      aria-label={title ? undefined : name}
      minCardWidth={145}
      gap={37.875}
      style={SHELF}
      className="mac-books-shelf"
    >
      {cells}
    </CardGrid>
  );
  const none = (text: string) => (
    <EmptyState role="status" className="mac-books-empty">
      {text}
    </EmptyState>
  );

  const searching = query.trim() !== "";
  let content: ReactNode;
  if (view === "library") {
    const here =
      SECTIONS.find((item) => item.id === section)?.name ??
      READING_LISTS.find((item) => item.id === section)?.name ??
      (real && section === SERIES.id ? SERIES.name : undefined) ??
      collections.find((item) => item.id === section)?.name ??
      (section === MY_SAMPLES.id ? MY_SAMPLES.name : undefined) ??
      "Library";
    const series = real && section === SERIES.id;
    const listed = sortBooks(
      booksIn(shelved, section, collections).filter(
        (book) =>
          bookMatches(book, query) &&
          (!series || seriesOf(book.title) !== null) &&
          (showHidden || !hiddenBooks.includes(book.id)),
      ),
      sort,
    );
    const grouped = series || section === "authors" || section === "categories";
    const groups = series
      ? groupSeries(listed)
      : grouped
        ? groupBooks(listed, section === "authors" ? "author" : "category")
        : [];
    shownCovers.current = (grouped ? groups.flatMap((group) => group.books) : listed).map(
      (book) => book.id,
    );
    const pickedBook = listed.find((book) => book.id === picked);
    const asList = (
      <ContextualMenu>
        <ContextualMenuTrigger
          className="mac-books-list-area"
          onContextMenu={(event) => {
            const row = (event.target as Element).closest<HTMLElement>("[data-book]");
            if (row?.dataset.book && real) pressForMenu(row.dataset.book);
            else event.preventBaseUIHandler();
          }}
        >
          <TableView
            aria-label={`${here} list`}
            className="mac-books-list"
            columns={LIST_COLUMNS}
            rowCount={listed.length}
            rowHeight={LIST_ROW_HEIGHT}
            alternatingRows
            selectionMode="multiple"
            value={selected}
            onValueChange={(next) => {
              const ids = next.map(String);
              setSelected(ids);
              setPicked(ids.at(-1) ?? null);
            }}
            sort={
              sort === "manual"
                ? undefined
                : { column: sort, direction: sort === "recent" ? "descending" : "ascending" }
            }
            onSortChange={({ column }) => setSort(column as BooksSort)}
            getRowId={(row) => listed[row]?.id ?? row}
            getRowLabel={(row) => listed[row]?.title ?? ""}
            getRowProps={(row) => {
              const book = listed[row];
              if (!book) return undefined;
              const props = {
                "data-book": book.id,
                draggable: real,
                ...dragFrom(book, selected.includes(book.id) ? selected : [book.id]),
                ...(real ? dropBefore(book.id) : {}),
              };
              return props as HTMLAttributes<HTMLDivElement>;
            }}
            onRowAction={(row) => {
              const book = listed[row];
              if (book) openBook(book);
            }}
            renderCell={(row, column) => {
              const book = listed[row];
              if (!book) return null;
              if (column.id === "title") return book.title;
              if (column.id === "author") return book.author;
              return real ? new Date(book.added).toLocaleDateString() : "";
            }}
          />
        </ContextualMenuTrigger>
        <ContextualMenuPopup aria-label="Book">
          {pickedBook
            ? bookItems(pickedBook, selected.includes(pickedBook.id) ? selected : [pickedBook.id])
            : null}
        </ContextualMenuPopup>
      </ContextualMenu>
    );
    content = (
      <>
        <div className="mac-books-sort" data-real={real ? "" : undefined}>
          {real && notice ? (
            <div className="mac-books-sort-actions">
              <span className="mac-books-notice" role="alert">
                {notice}
              </span>
            </div>
          ) : null}
          <PullDownButton bordered={false} title="Sort By">
            <MenuRadioGroup value={sort} onValueChange={(next) => setSort(next as BooksSort)}>
              {SORTS.map((item) => (
                <MenuRadioItem key={item.id} value={item.id}>
                  {item.name}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </PullDownButton>
        </div>
        {real && owned.length === 0 && !searching && !EMPTY_ROWS[section] ? (
          <div className="mac-books-welcome">
            <EmptyState role="status">No Books</EmptyState>
            <p className="mac-books-welcome-text">
              Get public-domain books from Project Gutenberg and Standard Ebooks in the Book Store.
            </p>
            <PushButton onClick={() => setView("book-store")}>Open the Book Store</PushButton>
          </div>
        ) : listed.length === 0 ? (
          none(searching ? "No Results" : (real && EMPTY_ROWS[section]) || "No Books")
        ) : layout === "list" ? (
          asList
        ) : grouped ? (
          groups.map((group) => shelf(group.title, group.title, group.books.map(cover)))
        ) : (
          // The window is the region named "Books", and so is a row: the grid says what it is.
          shelf(undefined, `${here} covers`, listed.map(cover))
        )}
      </>
    );
  } else if (real) {
    // The desktop app's stores: the two public-domain catalogues of text, and LibriVox's recordings.
    content =
      view === "book-store" ? (
        <BooksStoreView
          query={query}
          owned={owned}
          onGet={getBook}
          samples={samples}
          onSample={sampleBook}
          onRead={readBook}
          refusal={full ? "Your library is full" : null}
          page={storePage}
          onPage={setStorePage}
        />
      ) : (
        <BooksStoreView
          audiobooks
          query={query}
          owned={owned}
          onGet={getBook}
          onRead={readBook}
          refusal={full ? "Your library is full" : null}
          page={audiobookPage}
          onPage={setAudiobookPage}
        />
      );
  } else {
    // The stores: no capture shows one, so their shelves are placeholder cards.
    const shelves = (view === "book-store" ? BOOK_STORE : AUDIOBOOK_STORE)
      .map((item) => ({ ...item, items: item.items.filter((card) => bookMatches(card, query)) }))
      .filter((item) => item.items.length > 0);
    content =
      shelves.length === 0
        ? none("No Results")
        : shelves.map((item) =>
            shelf(
              item.title,
              item.title,
              item.items.map((card) => (
                <CardGridCard
                  key={card.id}
                  variant="square"
                  artwork={<CoverArtwork id={card.id} title={card.title} author={card.author} />}
                  title={card.title}
                  subtitle={card.author}
                />
              )),
            ),
          );
  }
  const pane = (
    <ScrollView
      className="mac-books-content"
      data-view={view}
      onClick={(event) => {
        if (event.target instanceof Element && !event.target.closest("[data-book]")) {
          setSelected([]);
        }
      }}
    >
      {content}
    </ScrollView>
  );

  // The menu bar's Store menu: the Book Store and its pages, the Audiobook Store, and the library's
  // own rows for what a person got.
  const keptSetView = useRef(setView);
  keptSetView.current = setView;
  const keptStoreRow = useRef({ setStorePage, choose, setQuery });
  keptStoreRow.current = { setStorePage, choose, setQuery };
  const storeMenu = useMemo(() => {
    const showStore = (page: BooksStorePage) => {
      keptStoreRow.current.setQuery("");
      keptStoreRow.current.setStorePage(page);
      keptSetView.current("book-store");
    };
    const showLibrary = (row: string) => {
      keptStoreRow.current.setQuery("");
      keptStoreRow.current.choose(row);
      keptSetView.current("library");
    };
    return (
      <>
        <MenuItem
          onClick={() => (real ? showStore(STORE_HOME) : keptSetView.current("book-store"))}
        >
          Book Store
        </MenuItem>
        <MenuItem onClick={() => keptSetView.current("audiobook-store")}>Audiobook Store</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => keptSetView.current("library")}>Library</MenuItem>
        {real ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => showStore({ kind: "featured" })}>Featured</MenuItem>
            <MenuItem onClick={() => showStore({ kind: "charts" })}>Top Charts</MenuItem>
            <Submenu>
              <SubmenuTrigger>Genres</SubmenuTrigger>
              <SubmenuPopup>
                {STORE_GENRES.map((genre) => (
                  <MenuItem key={genre} onClick={() => showStore({ kind: "genre", genre })}>
                    {genre}
                  </MenuItem>
                ))}
              </SubmenuPopup>
            </Submenu>
            <MenuItem onClick={() => showLibrary("all")}>Purchased</MenuItem>
            <MenuItem onClick={() => showLibrary("authors")}>Authors</MenuItem>
            <MenuSeparator />
            <DimmedRow reason={NO_STORE_ACCOUNT_REASON}>Sign In</DimmedRow>
            <DimmedRow reason={NO_STORE_ACCOUNT_REASON}>View My Account</DimmedRow>
          </>
        ) : null}
      </>
    );
  }, [real]);
  useDesktopAppMenu("books", "Store", storeMenu);

  // The Window menu: the book's window and the library's, which share one window of the desktop.
  const openTitle = open?.title ?? null;
  const windowMenu = useMemo(
    () =>
      openTitle === null ? null : (
        <>
          <MenuCheckboxItem
            checked={front === "library"}
            onCheckedChange={() => setWanted("library")}
          >
            Library
          </MenuCheckboxItem>
          <MenuCheckboxItem checked={front === "book"} onCheckedChange={() => setWanted("book")}>
            {openTitle}
          </MenuCheckboxItem>
          <MenuSeparator />
        </>
      ),
    [openTitle, front],
  );
  useDesktopAppMenu("books", "Window", windowMenu);

  // The menu bar's File, View and Edit menus and their keys. An open book registers an Edit menu
  // of its own, which is shown instead (books-reader.tsx).
  const showSearch = () =>
    root.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  const appCommands = {
    newCollection: () => {
      setView("library");
      setSidebar(true);
      setWanted("library");
      addCollection();
    },
    openPicked: () => {
      const book = shelved.find((item) => item.id === picked);
      if (book) openBook(book);
    },
    info: () => {
      if (selected.length === 1) setInfoId(selected[0] ?? null);
    },
    removeSelected: () => removeBooks(selected),
    selectAll: () => setSelected(shownCovers.current),
    toggleSidebar: () => setSidebar(!sidebar),
    setLayout,
    setSort,
    zoom: appearance.zoom,
    setPageLayout: appearance.setPageLayout,
    print: () => printBook.current?.(),
    showSearch,
    addToLibrary: () => fileInput.current?.click(),
    toggleHidden: () => setShowHidden(!showHidden),
  };
  const latestApp = useRef(appCommands);
  latestApp.current = appCommands;
  const canOpen = shelved.some((book) => book.id === picked);
  const inLibrary = view === "library";
  const canInfo = real && inLibrary && selected.length === 1;
  const canRemove = real && inLibrary && selected.length > 0;
  const reading = openOwned !== null;
  const anyHidden = hiddenBooks.length > 0;
  const { canZoomIn, canZoomOut, pageLayout } = appearance;
  // What File > Share Book acts on: the book open in front, or the cover last clicked.
  const pickedOwned = owned.find((item) => item.id === picked) ?? null;
  const sharing = (front === "book" ? openOwned : null) ?? pickedOwned;
  const fileMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="shift+command+n" onClick={() => latestApp.current.newCollection()}>
          New Collection
        </MenuItem>
        {real ? (
          <MenuItem keyEquivalent="command+o" onClick={() => latestApp.current.addToLibrary()}>
            Add to Library…
          </MenuItem>
        ) : null}
        <MenuItem disabled={!canOpen} onClick={() => latestApp.current.openPicked()}>
          Open Book
        </MenuItem>
        {real ? (
          <>
            <MenuItem
              keyEquivalent="command+i"
              disabled={!canInfo}
              onClick={() => latestApp.current.info()}
            >
              Get Info
            </MenuItem>
            <MenuItem
              keyEquivalent="command+delete"
              disabled={!canRemove}
              onClick={() => latestApp.current.removeSelected()}
            >
              Remove from Library
            </MenuItem>
            <MenuSeparator />
            <RevealBookRow book={sharing} />
            {sharing ? (
              <BookShareMenu title="Share Book" book={sharing} />
            ) : (
              <DimmedRow reason={NO_BOOK_PICKED}>Share Book</DimmedRow>
            )}
            <MenuSeparator />
            <MenuItem
              keyEquivalent="command+p"
              disabled={!reading}
              title={reading ? undefined : NO_OPEN_BOOK}
              data-reason={reading ? undefined : NO_OPEN_BOOK}
              onClick={() => latestApp.current.print()}
            >
              Print…
            </MenuItem>
          </>
        ) : null}
      </>
    ),
    [canOpen, canInfo, canRemove, real, sharing, reading],
  );
  const viewMenu = useMemo(
    () => (
      <>
        <MenuItem
          keyEquivalent="control+command+s"
          disabled={!inLibrary}
          onClick={() => latestApp.current.toggleSidebar()}
        >
          {sidebar ? "Hide Sidebar" : "Show Sidebar"}
        </MenuItem>
        <MenuSeparator />
        <MenuRadioGroup
          value={layout}
          onValueChange={(next) => latestApp.current.setLayout(next as BooksLayout)}
        >
          <MenuRadioItem value="grid" disabled={!inLibrary}>
            Grid
          </MenuRadioItem>
          <MenuRadioItem value="list" disabled={!inLibrary}>
            List
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Sort By</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={sort}
              onValueChange={(next) => latestApp.current.setSort(next as BooksSort)}
            >
              {SORTS.map((item) => (
                <MenuRadioItem key={item.id} value={item.id}>
                  {item.name}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        {real ? (
          <>
            <MenuRadioGroup
              value={pageLayout}
              onValueChange={(next) => latestApp.current.setPageLayout(next as BooksPageLayout)}
            >
              <MenuRadioItem value="single" keyEquivalent="command+1" disabled={!reading}>
                Single Page
              </MenuRadioItem>
              <MenuRadioItem value="two" keyEquivalent="command+2" disabled={!reading}>
                Two Pages
              </MenuRadioItem>
              <MenuRadioItem value="scroll" keyEquivalent="command+3" disabled={!reading}>
                Scroll
              </MenuRadioItem>
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuCheckboxItem
              checked={showHidden}
              disabled={!anyHidden && !showHidden}
              title={!anyHidden && !showHidden ? NOTHING_HIDDEN : undefined}
              data-reason={!anyHidden && !showHidden ? NOTHING_HIDDEN : undefined}
              onCheckedChange={() => latestApp.current.toggleHidden()}
            >
              Show Hidden Books
            </MenuCheckboxItem>
            <DimmedRow reason={NO_ICLOUD_REASON}>Hide iCloud Books</DimmedRow>
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem
          keyEquivalent="command++"
          disabled={!reading || !canZoomIn}
          onClick={() => latestApp.current.zoom("in")}
        >
          Zoom In
        </MenuItem>
        <MenuItem
          keyEquivalent="command+-"
          disabled={!reading || !canZoomOut}
          onClick={() => latestApp.current.zoom("out")}
        >
          Zoom Out
        </MenuItem>
        <MenuItem
          keyEquivalent="command+0"
          disabled={!reading}
          onClick={() => latestApp.current.zoom("actual")}
        >
          Actual Size
        </MenuItem>
      </>
    ),
    [
      inLibrary,
      sidebar,
      sort,
      layout,
      reading,
      canZoomIn,
      canZoomOut,
      real,
      pageLayout,
      showHidden,
      anyHidden,
    ],
  );
  const editMenu = useMemo(
    () => (
      <>
        <EditRows
          nothing="Click in the search field, or select text, first."
          say={(message) => setNotice(message)}
          selectAll={
            real
              ? {
                  enabled: inLibrary,
                  title: "Show the library to select its books.",
                  run: () => latestApp.current.selectAll(),
                }
              : undefined
          }
        />
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+f"
          onClick={() => whenMenusClosed(document, () => latestApp.current.showSearch())}
        >
          Find…
        </MenuItem>
      </>
    ),
    [real, inLibrary],
  );
  useDesktopAppMenu("books", "File", fileMenu);
  useDesktopAppMenu("books", "View", viewMenu);
  useDesktopAppMenu("books", "Edit", editMenu);
  const appKeys = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  appKeys.current = (event) => {
    const window = front === "book" ? reader.current : root.current;
    if (
      event.defaultPrevented ||
      loading ||
      !window ||
      window.closest('[data-window-state]:not([data-window-state="key"])')
    ) {
      return;
    }
    const zooms: [string, BooksZoom][] = [
      ["command+=", "in"],
      ["shift+command+=", "in"],
      ["command+-", "out"],
      ["command+0", "actual"],
    ];
    // The covers' keys leave a field its own keys: Command-A, and Command-Delete in a name.
    const { activeElement } = document;
    const typing =
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
    const bindings: [string, () => void][] = [
      ["shift+command+n", appCommands.newCollection],
      ...(inLibrary
        ? ([["control+command+s", appCommands.toggleSidebar]] as [string, () => void][])
        : []),
      ...(reading
        ? [
            ...zooms.map(([key, change]): [string, () => void] => [
              key,
              () => appearance.zoom(change),
            ]),
            ["command+1", () => appearance.setPageLayout("single")] as [string, () => void],
            ["command+2", () => appearance.setPageLayout("two")] as [string, () => void],
            ["command+3", () => appearance.setPageLayout("scroll")] as [string, () => void],
            ["command+p", appCommands.print] as [string, () => void],
          ]
        : []),
      ...(front === "library"
        ? ([
            ["command+f", appCommands.showSearch],
            ...(real ? [["command+o", appCommands.addToLibrary]] : []),
            ...(real && view === "library" && !typing
              ? [
                  ["command+i", appCommands.info],
                  ["command+delete", appCommands.removeSelected],
                ]
              : []),
          ] as [string, () => void][])
        : []),
    ];
    // Command-A selects the covers unless the keyboard is in a field, whose text it selects.
    if (
      real &&
      front === "library" &&
      view === "library" &&
      !typing &&
      matchesMenuKeyEquivalent(event, "command+a")
    ) {
      event.preventDefault();
      appCommands.selectAll();
      return;
    }
    for (const [equivalent, run] of bindings) {
      if (!matchesMenuKeyEquivalent(event, equivalent)) continue;
      event.preventDefault();
      run();
      return;
    }
  };
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => appKeys.current(event);
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);
  /** What a row of the sidebar needs to take covers dragged onto it. */
  const dropRow = (id: string) => ({
    "data-books-drop": dropOn === id ? "" : undefined,
    onDragOver: (event: DragEvent) => {
      if (draggedBooks.current.length === 0) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropOn(id);
    },
    onDragLeave: () => setDropOn((now) => (now === id ? null : now)),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setInList(id, draggedBooks.current, true);
      draggedBooks.current = [];
      setDropOn(null);
    },
  });
  const librarySidebar = (
    <Sidebar
      aria-label="Library"
      material="opaque"
      value={section}
      onValueChange={choose}
      style={SIDEBAR}
    >
      <SidebarSection title="Library" style={FIRST_SECTION}>
        {SECTIONS.map((item) => (
          <SidebarItem
            key={item.id}
            value={item.id}
            label={item.name}
            icon={<SectionIcon section={item.id} />}
          />
        ))}
        {real
          ? [
              <SidebarItem
                key={SERIES.id}
                value={SERIES.id}
                label={SERIES.name}
                icon={<SectionIcon section="categories" />}
              />,
              ...READING_LISTS.map((item) => (
                <SidebarItem
                  key={item.id}
                  value={item.id}
                  label={item.name}
                  icon={<SectionIcon section="collection" />}
                  {...dropRow(item.id)}
                />
              )),
              <SidebarItem
                key={MY_SAMPLES.id}
                value={MY_SAMPLES.id}
                label={MY_SAMPLES.name}
                icon={<SectionIcon section="collection" />}
              />,
            ]
          : null}
      </SidebarSection>
      <SidebarSection title="Collections">
        {ownCollections.map((item) => (
          <SidebarItem
            key={item.id}
            value={item.id}
            data-books-collection={item.id}
            onDoubleClick={real ? () => setRenaming(item.id) : undefined}
            label={
              renaming === item.id ? (
                <CollectionNameField
                  name={item.name}
                  inputRef={nameInput}
                  className="mac-books-rename"
                  onCommit={(next) => renameCollection(item.id, next)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                item.name
              )
            }
            icon={<SectionIcon section="collection" />}
            {...(real ? dropRow(item.id) : {})}
          />
        ))}
      </SidebarSection>
    </Sidebar>
  );
  const infoBook = owned.find((book) => book.id === infoId) ?? null;
  return (
    <>
      <BookInfoSheet
        book={infoBook}
        anchor={titleBar}
        lists={collections
          .filter((item) => infoId !== null && item.books.includes(infoId))
          .map((item) => item.name)}
        onClose={() => setInfoId(null)}
      />
      <DeleteBooksCollectionAlert
        collection={deleting}
        onCancel={() => setDeleting(null)}
        onDelete={(collection) => {
          setDeleting(null);
          deleteCollection(collection);
        }}
      />
      <Window
        aria-label="Books"
        state={stateOf("library")}
        width={width}
        height={height}
        className={className ? `mac-books ${className}` : "mac-books"}
        style={open ? { ...style, zIndex: levelFor("library") } : style}
        ref={(element) => {
          root.current = element;
          if (typeof ref === "function") return ref(element);
          if (ref) ref.current = element;
        }}
        onPointerDownCapture={(event) => {
          setWanted("library");
          onPointerDownCapture?.(event);
        }}
        // The keyboard brings a window forward too: Tab into the one behind and it is in front.
        onFocusCapture={(event) => {
          setWanted("library");
          onFocusCapture?.(event);
        }}
        {...props}
        aria-busy={loading || undefined}
        // Until the first load settles nothing in the window can be used, title bar included.
        inert={loading || undefined}
      >
        <TitleBar
          ref={setTitleBar}
          variant="title-hidden"
          controls={
            <WindowControls
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
              zoomRole={zoomRole}
              {...controlsProps}
              onClose={chain(onClose, controlsProps?.onClose)}
              onMinimize={chain(onMinimize, controlsProps?.onMinimize)}
              onZoom={chain(onZoom, controlsProps?.onZoom)}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        >
          <Toolbar aria-label="Books toolbar">
            <ToolbarButton
              aria-label={sidebar ? "Hide Sidebar" : "Show Sidebar"}
              // The sidebar belongs to the library; the stores have none.
              disabled={view !== "library"}
              style={SIDEBAR_BUTTON}
              onClick={() => setSidebar(!sidebar)}
            >
              <BooksGlyph name="list" />
            </ToolbarButton>
            {/* Fixed space that evens the two sides, so that the control is centred: with it
                the button's side is as wide as the search field's. */}
            <ToolbarSpace width={41.5} />
            <ToolbarSpace />
            <ToolbarSegmentedControl
              aria-label="View"
              value={[view]}
              onValueChange={(next) => {
                if (next[0]) setView(next[0] as BooksView);
              }}
            >
              {VIEWS.map((item, index) => (
                <ToolbarSegment key={item.id} value={item.id} style={SEGMENTS[index]}>
                  {item.name}
                </ToolbarSegment>
              ))}
            </ToolbarSegmentedControl>
            <ToolbarSpace />
            <ToolbarSearchField value={query} onValueChange={setQuery} style={SEARCH} />
          </Toolbar>
        </TitleBar>
        <WindowBody
          ref={real ? dropFiles : undefined}
          className="mac-books-body"
          onDragOver={(event) => {
            if (real && takesFiles(event)) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!real || !takesFiles(event)) return;
            event.preventDefault();
            void addFiles([...event.dataTransfer.files].map((file) => ({ file })));
          }}
        >
          {real ? (
            <input
              ref={fileInput}
              type="file"
              accept={BOOK_FILE_TYPES}
              multiple
              hidden
              aria-label="Add to Library"
              onChange={(event) => {
                const files = [...(event.currentTarget.files ?? [])];
                event.currentTarget.value = "";
                void addFiles(files.map((file) => ({ file })));
              }}
            />
          ) : null}
          {view === "library" && sidebar ? (
            <SplitView className="mac-books-split">
              <SplitViewPane size={220} className="mac-books-sidebar">
                {real ? (
                  <ContextualMenu>
                    <ContextualMenuTrigger
                      className="mac-books-menu-area"
                      onContextMenu={(event) => {
                        const target = event.target instanceof Element ? event.target : null;
                        if (target?.closest("input")) {
                          event.preventBaseUIHandler();
                          return;
                        }
                        setMenuCollection(
                          target?.closest<HTMLElement>("[data-books-collection]")?.dataset
                            .booksCollection ?? null,
                        );
                      }}
                    >
                      {librarySidebar}
                    </ContextualMenuTrigger>
                    <ContextualMenuPopup aria-label="Collection commands">
                      <MenuItem
                        disabled={menuCollection === null}
                        onClick={() => {
                          if (menuCollection) beginRename(menuCollection);
                        }}
                      >
                        Rename
                      </MenuItem>
                      <MenuItem
                        disabled={menuCollection === null}
                        onClick={() =>
                          setDeleting(
                            ownCollections.find((item) => item.id === menuCollection) ?? null,
                          )
                        }
                      >
                        Delete
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem onClick={() => addCollection()}>New Collection</MenuItem>
                    </ContextualMenuPopup>
                  </ContextualMenu>
                ) : (
                  librarySidebar
                )}
                <RoundRectButton
                  aria-label="New Collection"
                  className="mac-books-add"
                  style={ADD}
                  onClick={() => addCollection()}
                >
                  <SystemImage name="add" width={10} height={10} />
                </RoundRectButton>
              </SplitViewPane>
              <SplitViewDivider disabled style={DIVIDER} />
              <SplitViewPane>{pane}</SplitViewPane>
            </SplitView>
          ) : (
            pane
          )}
        </WindowBody>
      </Window>
      {host && open
        ? createPortal(
            <>
              <span ref={probe} aria-hidden className="mac-books-probe" style={PROBE_STYLE}>
                {PROBE_MARKS.map((style, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: three fixed marks
                  <span key={index} style={style} />
                ))}
              </span>
              {openOwned ? (
                (() => {
                  const moved = {
                    x: bookFrame?.x ?? bookOffset.x,
                    y: bookFrame?.y ?? bookOffset.y,
                  };
                  const fills = libraryFullScreen ? root.current : null;
                  const common = {
                    book: openOwned,
                    ...textReaderProps(readerProps),
                    width: fills?.offsetWidth ?? bookFrame?.width ?? readerProps?.width,
                    height: fills?.offsetHeight ?? bookFrame?.height ?? readerProps?.height,
                    fullScreen: libraryFullScreen || undefined,
                    overlay: libraryFullScreen ? null : bookEdges,
                    // Which window is key is the app's to decide, whatever `readerProps` says.
                    state: stateOf("book"),
                    onReadPercent: openBookProgress,
                    // The app's own callbacks first, then the ones the caller gave.
                    onLibrary: () => {
                      openBook(null);
                      readerProps?.onLibrary?.();
                    },
                    onClose: (event: Parameters<NonNullable<typeof onClose>>[0]) => {
                      openBook(null);
                      readerProps?.onClose?.(event);
                    },
                    // The two windows are one window of the desktop: its green button and its
                    // yellow one act on both.
                    onMinimize: chain(onMinimize, readerProps?.onMinimize),
                    onZoom: chain(onZoom, readerProps?.onZoom),
                    zoomRole: readerProps?.zoomRole ?? zoomRole,
                    minimizeDisabled: readerProps?.minimizeDisabled ?? minimizeDisabled,
                    zoomDisabled: readerProps?.zoomDisabled ?? zoomDisabled,
                    onDragRegionPointerDown: chain(
                      moveBookWindow,
                      readerProps?.onDragRegionPointerDown,
                    ),
                    ref: (element: HTMLDivElement | null) => {
                      reader.current = element;
                      const given = readerProps?.ref;
                      if (typeof given === "function") return given(element);
                      if (given) given.current = element;
                    },
                    style: {
                      position: "absolute" as const,
                      left: host.left + (libraryFullScreen ? 0 : moved.x) - host.shiftX,
                      top: host.top + (libraryFullScreen ? 0 : moved.y) - host.shiftY,
                      ...readerProps?.style,
                      zIndex: levelFor("book"),
                    },
                    onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
                      setWanted("book");
                      readerProps?.onPointerDownCapture?.(event);
                    },
                    onFocusCapture: (event: FocusEvent<HTMLDivElement>) => {
                      setWanted("book");
                      readerProps?.onFocusCapture?.(event);
                    },
                    // Like the library window, the book window cannot be used until the first
                    // load settles, whatever `readerProps` says.
                    "aria-busy": loading || undefined,
                    inert: loading || undefined,
                  };
                  return openOwned.source === "pdf" ? (
                    <BooksPdfReader key={open.id} {...common} />
                  ) : openOwned.source === "librivox" ? (
                    <BooksAudiobookPlayer key={open.id} {...common} />
                  ) : (
                    <BooksTextReader
                      key={open.id}
                      {...common}
                      inFront={front === "book"}
                      printRef={printBook}
                      sample={samples.includes(open.id)}
                      onGetBook={() => setInList(MY_SAMPLES.id, [open.id], false)}
                    />
                  );
                })()
              ) : (
                <BooksReader
                  key={open.id}
                  book={open}
                  {...readerProps}
                  // Which window is key is the app's to decide, whatever `readerProps` says.
                  state={stateOf("book")}
                  // The app's own callbacks first, then the ones the caller gave.
                  page={pages[open.id] ?? 1}
                  onPageChange={(page) => {
                    // Nothing is changed that the first load would replace.
                    if (loading) return;
                    setPages({ ...pages, [open.id]: page });
                    readerProps?.onPageChange?.(page);
                  }}
                  bookmarks={marks[open.id] ?? NO_BOOKMARKS}
                  onBookmarksChange={(next) => {
                    if (loading) return;
                    setMarks({ ...marks, [open.id]: next });
                    readerProps?.onBookmarksChange?.(next);
                  }}
                  onLibrary={() => {
                    openBook(null);
                    readerProps?.onLibrary?.();
                  }}
                  onClose={(event) => {
                    openBook(null);
                    readerProps?.onClose?.(event);
                  }}
                  ref={(element: HTMLDivElement | null) => {
                    reader.current = element;
                    const given = readerProps?.ref;
                    if (typeof given === "function") return given(element);
                    if (given) given.current = element;
                  }}
                  style={{
                    position: "absolute",
                    left: host.left + bookOffset.x - host.shiftX,
                    top: host.top + bookOffset.y - host.shiftY,
                    ...readerProps?.style,
                    zIndex: levelFor("book"),
                  }}
                  onPointerDownCapture={(event) => {
                    setWanted("book");
                    readerProps?.onPointerDownCapture?.(event);
                  }}
                  onFocusCapture={(event) => {
                    setWanted("book");
                    readerProps?.onFocusCapture?.(event);
                  }}
                  // Like the library window, the book window cannot be used until the first load
                  // settles, whatever `readerProps` says.
                  aria-busy={loading || undefined}
                  inert={loading || undefined}
                />
              )}
            </>,
            host.element,
          )
        : null}
    </>
  );
}
