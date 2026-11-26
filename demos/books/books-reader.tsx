"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "macalicious/popover";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { openUrl } from "../desktop/desktop-open-url";
import { CHANGED_ELSEWHERE, onSaveFailure, useServerState } from "../desktop/desktop-server";
import { LinkShareItems } from "../desktop/desktop-share-link";
import { lookUp, lookUpWord } from "../dictionary/dictionary-desktop";
import type { EditMenuTarget } from "../notes/notes-edit-menu";
import { whenMenusClosed } from "../notes/notes-menus";
import { printDocument } from "../textedit/textedit-drive";
import { appearanceProps, BooksAppearanceButton, useBooksAppearance } from "./books-appearance";
import { BooksGlyph } from "./books-artwork";
import { sampleEnd } from "./books-data";
import type { EpubPicture } from "./books-epub";
import { epubOfBook } from "./books-import";
import { DimmedRow } from "./books-library-menus";
import { StudyCards } from "./books-reviews";
import {
  BOOKS_LIMITS,
  type BookHeading,
  type BooksHighlight,
  type BooksHighlightColor,
  type BooksReading,
  BooksRequestError,
  bookWebAddress,
  fetchIndex,
  fetchPart,
  fetchPictureFile,
  fetchPictures,
  fromFile,
  HIGHLIGHT_COLORS,
  mergeReadings,
  NO_READING,
  type OwnedBook,
  readingFromServer,
  readingReadable,
  readingSize,
  readingToServer,
  readingUrl,
} from "./books-server";
import {
  BookText,
  characterStart,
  cut,
  type EmphasisPiece,
  emphasisPieces,
  excerpt,
  findAll,
  findAllRead,
  pageEnd,
  pageNumbers,
  pageParts,
  pageStart,
  pictureSize,
  picturesIn,
  piecesIn,
  plainPiece,
  printedPage,
  readingPercent,
  runsOf,
  skipSpace,
  withoutMarks,
  wordStart,
} from "./books-text";

/** How many times opening a book asks again while another request is fetching it. */
const MAX_WAITS = 10;
/** What keeps its arrow keys: fields, and controls that move with them. */
const ARROW_CONTROLS =
  'input, textarea, select, [contenteditable], [role="menu"], [role="menuitem"], [role="listbox"], [role="slider"], [role="tablist"], [role="radiogroup"], [role="dialog"]';

/** What keeps the reader's key equivalents: where a person types. */
const TEXT_FIELDS = 'input, textarea, [contenteditable="true"], [role="textbox"]';

/** Once, when the menu a command was chosen from has closed and given the keyboard back. */
function afterMenu(then: () => void) {
  let done = false;
  whenMenusClosed(document, () => {
    if (done) return;
    done = true;
    then();
  });
}

type Turn = "next" | "previous";

/** The arrow keys that, with Shift, extend the selection on a page. */
const SELECTING: Record<string, { direction: "forward" | "backward"; across: boolean }> = {
  ArrowRight: { direction: "forward", across: true },
  ArrowLeft: { direction: "backward", across: true },
  ArrowDown: { direction: "forward", across: false },
  ArrowUp: { direction: "backward", across: false },
};

/** The page a key turns to: unmodified arrows and Page Up/Down, not from a control of its own. */
function pageTurn(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
  target: EventTarget | null;
}): Turn | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return null;
  }
  if (event.target instanceof Element && event.target.closest(ARROW_CONTROLS)) return null;
  if (event.key === "ArrowRight" || event.key === "PageDown") return "next";
  if (event.key === "ArrowLeft" || event.key === "PageUp") return "previous";
  return null;
}

/**
 * Whether `element` is in the key window: no ancestor (itself included) has a window state other
 * than key, for a state that is not key on any ancestor wins (`building-a-window.md`).
 */
const inKeyWindow = (element: Element) =>
  !element.closest('[data-window-state]:not([data-window-state="key"])');
/** How long it waits before asking again, in milliseconds. */
const WAIT_MS = 2_000;

/** The span of text the last paragraph is looked for in at a time, in characters. */
const PARAGRAPH_WINDOW = 20_000;

/**
 * Where the last paragraph of `text` begins: after the last blank line before its end, looked for
 * backwards a window at a time. A window not held yet is answered with its own start, so the page
 * shows there while its parts load, and the next look goes on from what has arrived.
 */
function lastParagraph(text: BookText): number {
  const total = text.length;
  let end = total;
  while (end > 0) {
    const from = Math.max(0, end - PARAGRAPH_WINDOW);
    // One character past the window, so a blank line across its edge is seen.
    const to = Math.min(total, end + 1);
    if (text.missing(from, to).length > 0) return from;
    const window = text.slice(from, to);
    // A blank line at the very end of the text starts no paragraph.
    const gap = window.lastIndexOf("\n\n", Math.min(window.length - 2, total - 3 - from));
    if (gap >= 0) return from + gap + 2;
    end = from;
  }
  return 0;
}

/** The book window's bar: as the demo's (`BooksReader`), measured there. */
const READER_BAR: CSSProperties = { gridTemplateRows: "minmax(37px, auto)" };
const BAR_ITEM = { "--mac-image-button-padding": "5.25px" } as CSSProperties;
const SEARCH_ITEM = { ...BAR_ITEM, marginInlineEnd: 6 } as CSSProperties;
const TURN: CSSProperties = { padding: 16 };
/** How much text around the place is held before a page is laid out, in characters. */
const AHEAD = 24_000;
/** The window of text a page is cut from, in characters: more than any page holds. */
const WINDOW = 40_000;
/** Characters per page where nothing is laid out (a test environment, a hidden window). */
export const UNMEASURED_PAGE = 1_500;
/** The most search results listed. */
const MAX_RESULTS = 100;
/** The most changes of highlights and bookmarks Undo goes back through. */
const MAX_UNDO = 100;
/** How long scrolling rests before the place it reached is kept, in milliseconds. */
const SCROLL_REST_MS = 300;
/** The most characters of a selection handed to a web search. */
const MAX_WEB_SEARCH = 200;

/** Why Cut, Paste and Delete are dimmed in a book. */
const NOT_EDITABLE_REASON = "A book's text cannot be changed.";
const PASTE_REFUSED = "This browser didn't let Books read the clipboard: press ⌘V in the field.";

/** A field in one of the reader's popovers: the note, the search, the page to go to. */
type ReaderField = HTMLInputElement | HTMLTextAreaElement;
const READER_FIELDS =
  ".mac-books-search input, .mac-books-go-to input, .mac-books-highlight-menu textarea";

/**
 * Whether a popover is asked to close by a press on, or the keyboard going to, the menu bar or one
 * of its menus: it stays open, and Edit's rows act on its field.
 */
const forTheMenus = (details?: { event?: Event }): boolean => {
  const event = details?.event as (Event & { relatedTarget?: EventTarget | null }) | undefined;
  const to = event?.relatedTarget ?? event?.target;
  return to instanceof Element && to.closest('[role="menubar"], [role="menu"]') !== null;
};
/** Why Controls > Play / Pause is dimmed. */
const NO_AUDIO_REASON =
  "This book has no recording. Play is for an audiobook from the Audiobook Store.";

/** Both handlers, the first and then the second, or the one that is given. */
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

/** A book's picture once read: where it can be shown from, and its size in pixels. */
interface ShownPicture {
  url: string;
  width: number;
  height: number;
}

/** Read the picture from its blob: `null` when this browser cannot show it. */
async function showable(file: Blob): Promise<ShownPicture | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    // An SVG may give no size of its own: it is drawn square.
    return { url, width: image.naturalWidth || 300, height: image.naturalHeight || 300 };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

const NO_PICTURES: readonly EpubPicture[] = [];

/**
 * The width and height a page gives a picture: one column of `element`, and its height, of which
 * `reserve` stays for two lines of words and the picture's margins.
 */
function pictureRoom(element: HTMLElement | null, twoPages: boolean) {
  if (!element) return { width: 0, height: 0, reserve: 0 };
  const style = getComputedStyle(element);
  const gap = twoPages ? Number.parseFloat(style.columnGap) || 0 : 0;
  const line =
    Number.parseFloat(style.lineHeight) || (Number.parseFloat(style.fontSize) || 0) * 1.4;
  const margin = Number.parseFloat(style.getPropertyValue("--mac-books-picture-margin")) || 0;
  return {
    width: twoPages ? (element.clientWidth - gap) / 2 : element.clientWidth,
    height: element.clientHeight,
    reserve: 2 * line + 2 * margin + 1,
  };
}

const dataAddress = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** The words of a page's `[from, to)`, with its emphasis and its hidden marks. */
function wordsOfPage(pieces: readonly EmphasisPiece[], from: number, to: number, text: string) {
  return piecesIn(pieces, from, to).map((piece) => {
    const words = text.slice(piece.from, piece.to);
    if (piece.kind === "plain") return words;
    return piece.kind === "em" ? (
      <em key={piece.from}>{words}</em>
    ) : (
      <span key={piece.from} className="mac-books-emphasis-mark">
        {words}
      </span>
    );
  });
}

/** The same, for the hidden copy of a page: the marks take no room there and italics may. */
function measuredWords(
  doc: Document,
  words: string,
  marked: boolean,
): readonly (string | HTMLElement)[] {
  if (!marked || !words.includes("_")) return [words];
  return emphasisPieces(words).map((piece) => {
    const shown = words.slice(piece.from, piece.to);
    if (piece.kind === "plain") return shown;
    const element = doc.createElement(piece.kind === "em" ? "em" : "span");
    if (piece.kind === "mark") element.className = "mac-books-emphasis-mark";
    element.textContent = shown;
    return element;
  });
}

/** The offset of a point of the selection in `root`'s text. */
function offsetIn(root: Node, node: Node, offset: number): number {
  const total = root.textContent?.length ?? 0;
  if (!root.contains(node)) {
    return root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING ? 0 : total;
  }
  const range = root.ownerDocument?.createRange();
  if (!range) return 0;
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** A highlight id no other highlight of the book has. */
const highlightId = () =>
  `h-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e8).toString(36)}`;

/** What Undo and Redo of a book go back and forth through. */
type BooksMarks = Pick<BooksReading, "bookmarks" | "highlights">;

/** Where the top of a view that scrolls is in its text: by the caret there, or else by proportion. */
function topOffset(view: HTMLElement, length: number): number | null {
  const document = view.ownerDocument;
  const box = view.getBoundingClientRect();
  const [x, y] = [box.left + 8, box.top + 4];
  const point = document.caretPositionFromPoint?.(x, y);
  if (point) return offsetIn(view, point.offsetNode, point.offset);
  const range = document.caretRangeFromPoint?.(x, y);
  if (range) return offsetIn(view, range.startContainer, range.startOffset);
  return view.scrollHeight > 0 ? Math.round((view.scrollTop / view.scrollHeight) * length) : null;
}

export interface BooksTextReaderProps extends Omit<WindowProps, "children"> {
  /** The book of the person's library the window shows; its title is the window's. */
  book: OwnedBook;
  /** Whether this window is in front of the library window, so the Edit menu is the reader's. */
  inFront?: boolean;
  /** Called by the Library button of the bar. */
  onLibrary?: () => void;
  /** Called with how far the person has read, 1 to 100 (`readingPercent`), as it changes. */
  onReadPercent?: (percent: number) => void;
  /** Set to what File > Print does while the window is open. */
  printRef?: RefObject<(() => void) | null>;
  /** The book is only a sample: the window shows the start of its text. */
  sample?: boolean;
  /** Called by Get Book at the end of a sample. */
  onGetBook?: () => void;
  /** What else is drawn in the window: a window that moves on its own has its edges here. */
  overlay?: ReactNode;
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/** Where the text of the window comes from. */
type Source =
  | {
      status: "loading";
      /** How many parts of a book being fetched from its source are kept so far. */
      parts?: number;
    }
  | { status: "failed"; message: string }
  | {
      status: "ready";
      /** The whole text: every part is known, though not every part is held yet. */
      text: BookText;
      start: number;
      /** The book is longer than Books keeps, and its text stops early. */
      truncated: boolean;
      /** The source changed while Books was fetching the book, and its text stops early. */
      changed: boolean;
      toc: readonly BookHeading[];
      /** The pictures of the book, in the order of the text. */
      pictures: readonly EpubPicture[];
      pictureFile?: (picture: EpubPicture) => Promise<Blob>;
      credit: string;
      licence: string;
      link: string;
    };
type ReadySource = Extract<Source, { status: "ready" }>;

/** A highlight being made or looked at, and where its menu points. */
type Editing =
  | { kind: "new"; start: number; end: number; rect: DOMRect }
  | { kind: "existing"; id: string; rect: DOMRect };

/** Where the words selected on a page are in the book, and where they are on the screen. */
type Span = Omit<Extract<Editing, { kind: "new" }>, "kind">;

/** What the Edit menu of an open book acts on, as the reader is when a row is shown or chosen. */
interface ReaderEdit {
  target: () => EditMenuTarget | null;
  /** The field of a popover that had the keyboard, while its popover is open. */
  field: () => ReaderField | null;
  /** Says something to the person, in the window. */
  say: (words: string) => void;
  /** The words selected on the page. */
  selected: () => string;
  /** The whole page, when no words are selected: what Speech reads. */
  pageWords: () => string;
  find: () => void;
  /** Search in the Book for `words`, with the results open. */
  search: (words: string) => void;
  highlightSelection: (noting: boolean) => void;
  /** Undo and Redo of what the book keeps of the person: highlights, notes and bookmarks. */
  canStep: (way: "undo" | "redo") => boolean;
  step: (way: "undo" | "redo") => void;
  /** The book's page at its source, what a quote is shared with. */
  link: string;
  title: string;
}

/** The rows that search the web for the words selected on a page, in Safari. */
function WebSearchItems({ words }: { words: string }) {
  const asked = encodeURIComponent(cut(words, MAX_WEB_SEARCH));
  return (
    <>
      <MenuItem
        disabled={words === ""}
        onClick={() => openUrl(`https://www.google.com/search?q=${asked}`, "books")}
      >
        Search with Google
      </MenuItem>
      <MenuItem
        disabled={words === ""}
        onClick={() =>
          openUrl(`https://en.wikipedia.org/wiki/Special:Search?search=${asked}`, "books")
        }
      >
        Search Wikipedia
      </MenuItem>
    </>
  );
}

/** What a right click on the page offers, for the words selected there. */
function ReaderPageItems({ reader }: { reader: () => ReaderEdit }) {
  const [words] = useState(() => reader().selected());
  const speech = typeof speechSynthesis !== "undefined";
  const none = words === "";
  return (
    <>
      <MenuItem disabled={none} onClick={() => reader().highlightSelection(false)}>
        Add Highlight
      </MenuItem>
      <MenuItem disabled={none} onClick={() => reader().highlightSelection(true)}>
        Add Note
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={lookUpWord(words) === undefined} onClick={() => lookUp(words)}>
        Look Up
      </MenuItem>
      <MenuItem disabled={none} onClick={() => reader().search(words)}>
        Search
      </MenuItem>
      <WebSearchItems words={words} />
      <MenuSeparator />
      <MenuItem
        disabled={none}
        onClick={() => {
          const at = reader().target();
          at?.restore();
          at?.element.ownerDocument.execCommand("copy");
        }}
      >
        Copy
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={none || reader().link === ""}>Share</SubmenuTrigger>
        <SubmenuPopup>
          <LinkShareItems
            plain
            url={reader().link}
            title={`“${cut(words, BOOKS_LIMITS.excerpt)}”, ${reader().title}`}
            from="books"
          />
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Speech</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled={!speech}
            onClick={() => {
              speechSynthesis.cancel();
              speechSynthesis.speak(new SpeechSynthesisUtterance(words || reader().pageWords()));
            }}
          >
            Start Speaking
          </MenuItem>
          <MenuItem disabled={!speech} onClick={() => speechSynthesis.cancel()}>
            Stop Speaking
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
    </>
  );
}

/**
 * The Edit menu of an open book. Undo and Redo go through what the person changed of the book's
 * highlights, notes and bookmarks. The book's text cannot be changed, so Cut, Paste and Delete are
 * dimmed on the page; Copy and Select All act on it. While a field of the reader has the keyboard,
 * its popover stays open under the menu and the rows act on that field.
 */
function ReaderEditItems({ reader }: { reader: () => ReaderEdit }) {
  const edit = reader();
  const words = edit.selected();
  const field = edit.field();
  const speech = typeof speechSynthesis !== "undefined";
  /** Runs `act` on the field, which has the keyboard again now and once the menu has closed. */
  const inField = (act: (element: ReaderField) => void) => {
    const element = reader().field();
    if (!element) return;
    element.focus();
    act(element);
    whenMenusClosed(element.ownerDocument, () => element.focus());
  };
  const paste = () =>
    inField((element) => {
      navigator.clipboard.readText().then(
        (text) => {
          element.focus();
          element.ownerDocument.execCommand("insertText", false, text);
        },
        () => reader().say(PASTE_REFUSED),
      );
    });
  const selectAll = () => {
    if (reader().field()) {
      inField((element) => element.select());
      return;
    }
    const at = reader().target();
    if (!at) return;
    const select = () => at.element.ownerDocument.getSelection()?.selectAllChildren(at.element);
    select();
    whenMenusClosed(at.element.ownerDocument, select);
  };
  return (
    <>
      <MenuItem
        keyEquivalent="command+z"
        disabled={!edit.canStep("undo")}
        onClick={() => reader().step("undo")}
      >
        Undo
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+z"
        disabled={!edit.canStep("redo")}
        onClick={() => reader().step("redo")}
      >
        Redo
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+x"
        disabled={!field}
        title={field ? undefined : NOT_EDITABLE_REASON}
        data-reason={field ? undefined : NOT_EDITABLE_REASON}
        onClick={() => inField((element) => element.ownerDocument.execCommand("cut"))}
      >
        Cut
      </MenuItem>
      <MenuItem
        keyEquivalent="command+c"
        disabled={words === "" && !field}
        onClick={() => {
          if (reader().field()) {
            inField((element) => element.ownerDocument.execCommand("copy"));
            return;
          }
          const at = reader().target();
          at?.restore();
          at?.element.ownerDocument.execCommand("copy");
        }}
      >
        Copy
      </MenuItem>
      <MenuItem
        keyEquivalent="command+v"
        disabled={!field}
        title={field ? undefined : NOT_EDITABLE_REASON}
        data-reason={field ? undefined : NOT_EDITABLE_REASON}
        onClick={paste}
      >
        Paste
      </MenuItem>
      {field ? (
        <MenuItem onClick={() => inField((element) => element.ownerDocument.execCommand("delete"))}>
          Delete
        </MenuItem>
      ) : (
        <DimmedRow reason={NOT_EDITABLE_REASON}>Delete</DimmedRow>
      )}
      <MenuItem
        keyEquivalent="command+a"
        disabled={edit.target() === null && !field}
        onClick={selectAll}
      >
        Select All
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+f" onClick={() => reader().find()}>
        Find…
      </MenuItem>
      <MenuItem disabled={lookUpWord(words) === undefined} onClick={() => lookUp(words)}>
        Look Up
      </MenuItem>
      <WebSearchItems words={words} />
      <MenuSeparator />
      <MenuItem
        keyEquivalent="control+command+h"
        disabled={words === ""}
        onClick={() => reader().highlightSelection(false)}
      >
        Add Highlight
      </MenuItem>
      <MenuItem
        keyEquivalent="control+command+n"
        disabled={words === ""}
        onClick={() => reader().highlightSelection(true)}
      >
        Add Note
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Speech</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled={!speech}
            onClick={() => {
              speechSynthesis.cancel();
              speechSynthesis.speak(
                new SpeechSynthesisUtterance(reader().selected() || reader().pageWords()),
              );
            }}
          >
            Start Speaking
          </MenuItem>
          <MenuItem disabled={!speech} onClick={() => speechSynthesis.cancel()}>
            Stop Speaking
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
    </>
  );
}

/**
 * The book window of Books on the desktop's Ferrite application: the real text of a book of the
 * person's library, cut into pages that fit the window, with the place, bookmarks, highlights
 * and notes kept for the person (`/api/books/reading/<book>`). Its bar is the demo's: Library,
 * Table of Contents (the chapters found in the text), Notes (the highlights and their notes),
 * Search (in the book) and Bookmarks. Select words on the page to highlight them or add a note.
 */
/**
 * The reader's Edit menu in the menu bar, there only while the book window is in front: both
 * Books windows share one desktop window, so the registry cannot tell them apart. Mounting counts
 * as the latest use, so the reader's menu shows; unmounted, the library's shows again.
 */
function ReaderEditMenu({ reader }: { reader: () => ReaderEdit }) {
  const menu = useMemo(() => <ReaderEditItems reader={reader} />, [reader]);
  useDesktopAppMenu("books", "Edit", menu);
  return null;
}

export function BooksTextReader({
  book,
  inFront = true,
  onLibrary,
  onReadPercent,
  printRef,
  sample = false,
  onGetBook,
  overlay,
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
  "aria-busy": busy,
  inert,
  ...props
}: BooksTextReaderProps) {
  // The person's reading of this book. Until it has loaded the window is inert.
  const [reading, setReading] = useState<BooksReading>(NO_READING);
  // Whether the person has a place of their own in the book: a book never opened starts where its
  // text does, after Project Gutenberg's header.
  const [placed, setPlaced] = useState(false);
  const [readable, setReadable] = useState(true);
  const loading = useServerState({
    url: readingUrl(book.id),
    enabled: true,
    value: reading,
    onLoad: (stored) => {
      if (!readingReadable(stored)) {
        setReadable(false);
        return false;
      }
      const kept = readingFromServer(stored) ?? NO_READING;
      setReading(kept);
      setPlaced((stored as { reading: unknown }).reading !== null);
    },
    toBody: readingToServer,
    merge: mergeReadings,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const appearance = useBooksAppearance();
  const { pageLayout } = appearance;
  const scrolling = pageLayout === "scroll";
  // A save the server refused (a reading too large, or one more book than readings are kept for)
  // or could not take is told here: the page still shows what was not kept.
  useEffect(
    () =>
      onSaveFailure((failure) => {
        if (failure.url !== readingUrl(book.id)) return;
        setNotice(
          failure.reason === CHANGED_ELSEWHERE
            ? "Your place and notes in this book were changed in another window or browser first, so this change was not kept."
            : `Books could not keep your place and notes in this book (${failure.reason}). The next change sends them again.`,
        );
      }),
    [book.id],
  );

  // The text: the book's index and its parts. Each load of it (a book opened, Try Again) is a
  // generation of its own, with its own text and its own parts in
  // flight: a reply to an earlier generation changes nothing.
  const [source, setSource] = useState<Source>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const loads = useRef(new Set<number>());
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt loads again
  useEffect(() => {
    let live = true;
    generation.current += 1;
    loads.current = new Set();
    setSource({ status: "loading" });
    // A book is shown once the server keeps its whole text: each request for the part after
    // those kept fetches the next round of it from its source.
    const open = async (): Promise<ReadySource> => {
      if (book.source === "epub") {
        const read = await epubOfBook(book);
        const whole = new BookText([read.text.length]);
        whole.set(0, read.text);
        return {
          status: "ready",
          text: whole,
          start: 0,
          truncated: false,
          changed: false,
          toc: read.toc,
          pictures: read.pictures,
          pictureFile: read.pictureFile,
          credit: "Your EPUB, from your drive",
          licence: "",
          link: "",
        };
      }
      let index = await fetchIndex(book.id);
      let waits = 0;
      while (!index.complete && live) {
        setSource({ status: "loading", parts: index.parts.length });
        try {
          await fetchPart(book.id, index.parts.length);
          waits = 0;
        } catch (error) {
          // 404: no part past those kept, which only a complete book may answer. 503: another
          // reader's request is fetching it; ask again shortly.
          const status = error instanceof BooksRequestError ? error.status : 0;
          if (status === 404) {
            index = await fetchIndex(book.id);
            if (index.complete) break;
            throw error;
          }
          if (status !== 503 || ++waits > MAX_WAITS) throw error;
          await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
        }
        index = await fetchIndex(book.id);
      }
      return {
        status: "ready",
        text: new BookText(index.parts),
        start: index.start,
        truncated: index.truncated,
        changed: index.changed,
        toc: index.toc,
        pictures: NO_PICTURES,
        pictureFile: (picture) => fetchPictureFile(book.id, picture),
        credit: index.credit,
        licence: index.licence,
        link: index.link,
      };
    };
    open().then(
      (ready) => {
        if (!live) return;
        setSource(ready);
        // A store book's pictures come when its text is here: the text can be read meanwhile.
        if (book.source === "epub") return;
        void fetchPictures(book.id, () => live).then(
          (pictures) => {
            if (live && pictures.length > 0) {
              setSource((now) => (now.status === "ready" ? { ...now, pictures } : now));
            }
          },
          () => {
            if (live)
              setNotice("The pictures of this book could not be fetched; its text is here.");
          },
        );
      },
      (error: unknown) => {
        if (!live) return;
        setSource({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
    return () => {
      live = false;
    };
  }, [book.id, attempt]);

  const ready = source.status === "ready" ? source : null;
  const text = ready?.text ?? null;
  // Where the text ends for this window: a sample stops short of the book's end.
  const textEnd = !ready
    ? 0
    : sample
      ? sampleEnd(ready.start, ready.text.length)
      : ready.text.length;
  const pictures = ready?.pictures ?? NO_PICTURES;
  // The pictures read so far, by file: `null` for one that cannot be shown. A page is laid out once
  // those it may hold are here, since its length depends on their size.
  const shownPictures = useRef(new Map<string, ShownPicture | null>());
  const readingPictures = useRef(new Set<string>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt reads the file again
  useEffect(() => {
    const shown = shownPictures.current;
    return () => {
      for (const picture of shown.values()) if (picture) URL.revokeObjectURL(picture.url);
      shown.clear();
      readingPictures.current.clear();
    };
  }, [book.id, attempt]);
  /** Reads the pictures not yet read, one at a time; each one read lays the page out again. */
  const readPictures = useCallback(
    (wanted: readonly EpubPicture[]) => {
      const file = ready?.pictureFile;
      if (!file) return;
      const token = generation.current;
      for (const picture of wanted) {
        if (readingPictures.current.has(picture.path)) continue;
        readingPictures.current.add(picture.path);
        void file(picture)
          .then(showable)
          .catch(() => null)
          .then((shown) => {
            if (token !== generation.current) {
              if (shown) URL.revokeObjectURL(shown.url);
              return;
            }
            shownPictures.current.set(picture.path, shown);
            if (!shown) setNotice("A picture of this book could not be shown.");
            setVersion((count) => count + 1);
          });
      }
    },
    [ready],
  );
  /**
   * Fetch part `n` of the text, once at a time. The reply fills the text it was asked for only
   * while that text is still the window's: not after Try Again or another book.
   */
  const load = useCallback(
    (n: number) => {
      if (!ready) return;
      const pending = loads.current;
      if (pending.has(n)) return;
      pending.add(n);
      const token = generation.current;
      const requested = ready.text;
      const owns = (current: Source): current is ReadySource =>
        current.status === "ready" && current.text === requested;
      fetchPart(book.id, n).then(
        (part) => {
          pending.delete(n);
          if (token !== generation.current) return;
          // A part not as long as announced would move every later offset: it is refused.
          if (!requested.set(n, part.text)) {
            const message = "A part of the book arrived damaged; try again.";
            setSource((current) => (owns(current) ? { status: "failed", message } : current));
            return;
          }
          setVersion((count) => count + 1);
        },
        (error: unknown) => {
          pending.delete(n);
          if (token !== generation.current) return;
          const message = error instanceof Error ? error.message : String(error);
          setSource((current) => (owns(current) ? { status: "failed", message } : current));
        },
      );
    },
    [ready, book.id],
  );

  // The page: it starts at the place, and ends where the window is full. Every place, kept or
  // gone to, is clamped to the text: one past its end (a shortened book, a place kept from a
  // longer copy) opens its last paragraph, and one inside a character (between the two halves of
  // a surrogate pair) opens at that character.
  const clampPlace = (offset: number) => {
    if (!text || text.length === 0) return Math.max(0, offset);
    if (sample && offset >= textEnd) return ready?.start ?? 0;
    if (offset >= text.length) return lastParagraph(text);
    return characterStart(text, Math.max(0, offset));
  };
  const place = clampPlace(placed ? reading.place : (ready?.start ?? 0));
  // View > Scroll: the page shows the text from here (`at`) on, more of it as the person reaches
  // its ends, while the place follows the top of the view. Otherwise the page starts at the place.
  const [scrollFrom, setScrollFrom] = useState<number | null>(null);
  const [scrollSpan, setScrollSpan] = useState(WINDOW);
  const at = scrolling && scrollFrom !== null ? scrollFrom : place;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a view starts at the place it began at
  useLayoutEffect(() => {
    setScrollFrom((now) => (scrolling && text && !loading ? (now ?? place) : null));
    setScrollSpan(WINDOW);
  }, [scrolling, text, loading]);
  /**
   * Change the person's reading; `moved`: the change sets the place itself. A book with no place
   * yet shows the page where its text begins, so the first change of any kind (a bookmark, a
   * highlight) keeps that place too, and the book opens there again rather than at 0. Returns
   * whether the change was kept: one that would make the reading too large is refused, with a
   * notice, and whatever asked for it stays as it was (an open note keeps its draft).
   */
  const change = (next: BooksReading, moved = false): boolean => {
    if (loading || !readable) return false;
    const kept = moved || placed ? next : { ...next, place };
    if (readingSize(kept) > BOOKS_LIMITS.bytes) {
      setNotice("This book's notes are full: remove a highlight or a note first.");
      return false;
    }
    setNotice(null);
    setPlaced(true);
    setReading(kept);
    return true;
  };
  const [end, setEnd] = useState<number | null>(null);
  // The box the page fills, held as state: the box shown after a failure is a new element, and it
  // is the one observed.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const measure = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(0);
  // How many characters of the book's prose a page holds at this window size: what page numbers
  // count in. Measured once per layout, on the book's own text with its line breaks flattened, so
  // a short page (a title page, the end of a chapter) does not change the numbers.
  const capacity = useRef({ chars: 0, layout: -1 });
  useEffect(() => {
    if (!box || typeof ResizeObserver === "undefined") return;
    let live = true;
    let size = "";
    const observer = new ResizeObserver(() => {
      const next = `${box.clientWidth}x${box.clientHeight}`;
      if (next !== size) {
        size = next;
        setLayout((count) => count + 1);
      }
    });
    observer.observe(box);
    // Text laid out in a fallback face is measured again once the real one has loaded.
    void box.ownerDocument.fonts?.ready.then(() => {
      if (live) setLayout((count) => count + 1);
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [box]);

  /**
   * The pictures of `[start, end)` with the size each is drawn at, for the page they would fill: a
   * picture that cannot be shown has no size, and those at one offset share the room.
   */
  const sizedPictures = useCallback(
    (start: number, end: number) => {
      const within = picturesIn(pictures, start, end, textEnd);
      const room = pictureRoom(measure.current, pageLayout === "two");
      return within.flatMap((picture) => {
        const shown = shownPictures.current.get(picture.path);
        if (!shown) return [];
        const sharing = within.filter(({ at }) => at === picture.at).length;
        return [{ ...picture, shown, size: pictureSize(shown, room, sharing) }];
      });
    },
    [pictures, textEnd, pageLayout],
  );
  /** Project Gutenberg's texts set words off with underscores; a file's underscores are its own. */
  const underscored = book.source === "gutenberg";
  /**
   * Whether `slice` fits the page, measured in the hidden copy of it: in two pages, across too. With
   * `from`, its offset in the book, the pictures among its words take the room they take on a page.
   */
  const measured = useCallback(
    (slice: string, from?: number) => {
      const element = measure.current;
      if (!element || element.clientHeight === 0) return slice.length <= UNMEASURED_PAGE;
      const among = from === undefined ? [] : sizedPictures(from, from + slice.length);
      if (among.length === 0 || from === undefined) {
        element.replaceChildren(...measuredWords(element.ownerDocument, slice, underscored));
      } else {
        let done = from;
        const parts: (string | HTMLElement)[] = [];
        for (const { at, size } of among) {
          parts.push(
            ...measuredWords(
              element.ownerDocument,
              slice.slice(done - from, at - from),
              underscored,
            ),
          );
          done = at;
          const box = element.ownerDocument.createElement("span");
          box.className = "mac-books-picture";
          box.style.width = `${size.width}px`;
          box.style.height = `${size.height}px`;
          if (size.inline) box.dataset.inline = "";
          parts.push(box);
        }
        parts.push(...measuredWords(element.ownerDocument, slice.slice(done - from), underscored));
        element.replaceChildren(...parts);
      }
      return (
        element.scrollHeight <= element.clientHeight + 1 &&
        (pageLayout !== "two" || element.scrollWidth <= element.clientWidth + 1)
      );
    },
    [pageLayout, sizedPictures, underscored],
  );
  /** Text alone, as page numbers count it. */
  const fits = useCallback((slice: string) => measured(slice), [measured]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: parts arriving and the window's size
  useLayoutEffect(() => {
    if (!text || loading) return;
    const total = textEnd;
    const missing = text.missing(at, Math.min(total, at + (scrolling ? scrollSpan : AHEAD)));
    if (missing.length > 0) {
      // A view that scrolls keeps what it shows while the text after it arrives.
      if (!scrolling || end === null) setEnd(null);
      for (const n of missing) load(n);
      return;
    }
    const limit = Math.min(text.heldFrom(at), at + WINDOW, total);
    const reach = scrolling ? Math.min(text.heldFrom(at), at + scrollSpan, total) : limit;
    const unread = picturesIn(pictures, at, reach, total).filter(
      ({ path }) => !shownPictures.current.has(path),
    );
    if (unread.length > 0) {
      if (!scrolling || end === null) setEnd(null);
      readPictures(unread);
      return;
    }
    const slice = text.slice(at, limit);
    const next = scrolling
      ? reach
      : at + pageEnd(slice, 0, slice.length, (part) => measured(part, at));
    if (capacity.current.layout !== layout) {
      const prose = slice.replace(/\s+/g, " ");
      const chars = pageEnd(prose, 0, prose.length, fits);
      // A sample shorter than a page (the end of a book) says nothing yet.
      if (chars > 0 && chars < prose.length) capacity.current = { chars, layout };
    }
    setEnd(next);
  }, [text, textEnd, at, version, layout, loading, fits, measured, load, scrolling, scrollSpan]);

  // Turning the page.
  const history = useRef<number[]>([]);
  // A new size, face or layout moves every page after this one: the page starts where it did, and
  // turning back finds its page anew.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the size and the face change the layout
  useLayoutEffect(() => {
    history.current = [];
    setLayout((count) => count + 1);
  }, [appearance.size, appearance.face, pageLayout]);
  const total = textEnd;
  const atEnd = end !== null && end >= total && !scrolling;
  const goTo = (offset: number, remember = false) => {
    if (!text) return;
    const to = clampPlace(offset);
    if (scrolling) {
      if (to === at) {
        if (page.current) page.current.scrollTop = 0;
      } else {
        setEnd(null);
        setScrollFrom(to);
        setScrollSpan(WINDOW);
      }
    }
    if (remember) history.current.push(at);
    else history.current = [];
    change({ ...reading, place: to }, true);
  };
  /** Scrolls the view by most of its height: the page keys and Controls in View > Scroll. */
  const scrollPage = (way: 1 | -1) => {
    const view = page.current;
    if (view) view.scrollTop += way * Math.round(view.clientHeight * 0.9);
  };
  const next = () => {
    if (scrolling) {
      scrollPage(1);
      return;
    }
    if (!text || end === null || atEnd) return;
    const after = text.slice(end, end + 400);
    goTo(end + skipSpace(after, 0), true);
  };
  const [turningBack, setTurningBack] = useState(false);
  const previous = () => {
    if (scrolling) {
      scrollPage(-1);
      return;
    }
    if (!text || at <= 0) return;
    const back = history.current.pop();
    if (back !== undefined && back < at) {
      change({ ...reading, place: back }, true);
      return;
    }
    history.current = [];
    setTurningBack(true);
  };
  // Turning back without a history: the page that ends where this one starts.
  // biome-ignore lint/correctness/useExhaustiveDependencies: parts arriving
  useLayoutEffect(() => {
    if (!turningBack || !text) return;
    const floor = Math.max(0, at - WINDOW);
    const missing = text.missing(floor, at);
    if (missing.length > 0) {
      for (const n of missing) load(n);
      return;
    }
    const unread = picturesIn(pictures, floor, at, textEnd).filter(
      ({ path }) => !shownPictures.current.has(path),
    );
    if (unread.length > 0) {
      readPictures(unread);
      return;
    }
    const slice = text.slice(floor, at);
    const start =
      floor + pageStart(slice, slice.length, 0, (part) => measured(part, at - part.length));
    setTurningBack(false);
    change({ ...reading, place: Math.min(start, Math.max(0, at - 1)) }, true);
  }, [turningBack, text, at, version, measured, load]);

  // What the page shows.
  const pageText = text && end !== null ? text.slice(at, end) : "";
  const pagePieces = underscored ? emphasisPieces(pageText) : plainPiece(pageText);
  /** Words as they read, for what takes them off the page. */
  const read = (words: string) => (underscored ? withoutMarks(words) : words);
  const perPage =
    capacity.current.layout === layout && capacity.current.chars > 0
      ? capacity.current.chars
      : Math.max(1, pageText.length);
  const numbers = pageNumbers(place, total, perPage);
  const pageLabel = `Page ${numbers.page} of ${numbers.pages}`;
  const parts =
    end !== null ? pageParts(runsOf(at, end, reading.highlights), sizedPictures(at, end)) : [];
  // In View > Scroll the page's text runs on: what a bookmark or a print takes is a page's worth
  // from the place.
  const markEnd = end === null ? null : scrolling ? Math.min(end, place + perPage) : end;
  const shownWords = markEnd === null ? "" : pageText.slice(place - at, markEnd - at);
  const marked =
    markEnd !== null && reading.bookmarks.some((mark) => mark.at >= place && mark.at < markEnd);

  // Undo and Redo of the book's highlights, notes and bookmarks, for as long as the window is open.
  const marksHistory = useRef<{ undo: BooksMarks[]; redo: BooksMarks[] }>({ undo: [], redo: [] });
  const changeMarks = (next: BooksReading): boolean => {
    const { bookmarks, highlights } = reading;
    if (!change(next)) return false;
    const kept = marksHistory.current;
    kept.undo = [...kept.undo, { bookmarks, highlights }].slice(-MAX_UNDO);
    kept.redo = [];
    return true;
  };
  const stepMarks = (way: "undo" | "redo") => {
    const kept = marksHistory.current;
    const to = kept[way].at(-1);
    if (!to || !change({ ...reading, ...to })) return;
    const { bookmarks, highlights } = reading;
    kept[way] = kept[way].slice(0, -1);
    kept[way === "undo" ? "redo" : "undo"].push({ bookmarks, highlights });
    setEditing(null);
  };

  const toggleBookmark = () => {
    if (markEnd === null) return;
    if (marked) {
      changeMarks({
        ...reading,
        bookmarks: reading.bookmarks.filter((mark) => mark.at < place || mark.at >= markEnd),
      });
    } else if (reading.bookmarks.length < BOOKS_LIMITS.bookmarks) {
      const mark = { at: place, label: excerpt(read(shownWords), 80) || `Page ${numbers.page}` };
      changeMarks({
        ...reading,
        bookmarks: [...reading.bookmarks, mark].sort((a, b) => a.at - b.at),
      });
    } else setNotice(`A book keeps at most ${BOOKS_LIMITS.bookmarks} bookmarks.`);
  };

  // How far the person has read, for the cover in the library.
  const showing = end !== null && total > 0 && !loading;
  const percent = readingPercent(place, total, atEnd);
  useEffect(() => {
    if (showing) onReadPercent?.(percent);
  }, [showing, percent, onReadPercent]);

  // Highlights: a selection on the page opens their menu, and so does a highlight.
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState("");
  const editingHighlight =
    editing?.kind === "existing" ? reading.highlights.find((h) => h.id === editing.id) : undefined;
  // The words last selected on this page, for the Edit menu: a menu that takes the keyboard may
  // leave the document without a selection.
  const lastRange = useRef<Range | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: another page holds other words
  useEffect(() => {
    lastRange.current = null;
  }, [at]);
  const spanOf = (range: Range): Span | null => {
    const root = page.current;
    if (!root) return null;
    let from = offsetIn(root, range.startContainer, range.startOffset);
    let to = offsetIn(root, range.endContainer, range.endOffset);
    while (from < to && /\s/.test(pageText[from] ?? "")) from += 1;
    while (to > from && /\s/.test(pageText[to - 1] ?? "")) to -= 1;
    if (to <= from) return null;
    return {
      start: at + from,
      end: at + Math.min(to, from + BOOKS_LIMITS.span),
      // (A DOM without layout, as in the tests, has no rectangle of a range.)
      rect:
        typeof range.getBoundingClientRect === "function"
          ? range.getBoundingClientRect()
          : root.getBoundingClientRect(),
    };
  };
  /** The selection on the page, or the one it last had. */
  const pageRange = (): Range | null => {
    const root = page.current;
    const selection = root?.ownerDocument.getSelection();
    if (root && selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (root.contains(range.commonAncestorContainer)) return range;
    }
    return lastRange.current;
  };
  const readSelection = () => {
    const root = page.current;
    const selection = root?.ownerDocument.getSelection();
    if (
      !root ||
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0 ||
      end === null
    ) {
      lastRange.current = null;
      return;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer) && !range.intersectsNode(root)) return;
    const span = spanOf(range);
    if (!span) return;
    lastRange.current = range.cloneRange();
    setEditing({ kind: "new", ...span });
  };
  /** Highlight `span`. Refused (the reading is full), the selection and its menu stay. */
  const makeHighlight = (span: Span, color: BooksHighlightColor, noting: boolean) => {
    if (!text) return;
    if (reading.highlights.length >= BOOKS_LIMITS.highlights) {
      setNotice(`A book keeps at most ${BOOKS_LIMITS.highlights} highlights.`);
      return;
    }
    const made: BooksHighlight = {
      id: highlightId(),
      start: span.start,
      end: span.end,
      color,
      text: excerpt(read(text.slice(span.start, span.end)), BOOKS_LIMITS.excerpt),
      note: "",
    };
    if (!changeMarks({ ...reading, highlights: [...reading.highlights, made] })) return;
    page.current?.ownerDocument.getSelection()?.removeAllRanges();
    lastRange.current = null;
    if (noting) {
      setDraft("");
      setEditing({ kind: "existing", id: made.id, rect: span.rect });
    } else setEditing(null);
  };
  const highlight = (color: BooksHighlightColor, noting = false) => {
    if (!editing || !text) return;
    if (editing.kind === "new") {
      makeHighlight(editing, color, noting);
      return;
    }
    changeMarks({
      ...reading,
      highlights: reading.highlights.map((h) => (h.id === editing.id ? { ...h, color } : h)),
    });
  };
  /** Add Highlight and Add Note, from a key or a menu: yellow, as the highlight menu's first. */
  const highlightSelection = (noting: boolean) => {
    const range = pageRange();
    const span = range && spanOf(range);
    if (span) makeHighlight(span, "yellow", noting);
  };
  const saveNote = () => {
    if (editing?.kind !== "existing") return;
    if (editingHighlight?.note === cut(draft, BOOKS_LIMITS.note)) {
      setEditing(null);
      return;
    }
    const saved = changeMarks({
      ...reading,
      highlights: reading.highlights.map((h) =>
        h.id === editing.id ? { ...h, note: cut(draft, BOOKS_LIMITS.note) } : h,
      ),
    });
    // A note refused for size stays open with its draft, beside the notice that says why.
    if (saved) setEditing(null);
  };
  const removeHighlight = () => {
    if (editing?.kind !== "existing") return;
    changeMarks({
      ...reading,
      highlights: reading.highlights.filter((h) => h.id !== editing.id),
    });
    setEditing(null);
  };
  /** Open the menu of a highlight shown on the page, pointing at `element`. */
  const showHighlight = (shown: BooksHighlight | undefined, element: Element) => {
    if (!shown) return;
    setDraft(shown.note);
    setEditing({ kind: "existing", id: shown.id, rect: element.getBoundingClientRect() });
  };
  const anchor = useMemo(
    () => (editing ? { getBoundingClientRect: () => editing.rect } : null),
    [editing],
  );

  // Search in the book: the whole book, so every part is fetched before the results are given.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<number[] | null>(null);
  const [searching, setSearching] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: parts arriving
  useEffect(() => {
    if (!searching) return;
    if (!ready) {
      // The text could not be read: there is nothing to search. (Loading again: wait for it.)
      if (source.status !== "loading") setSearching(false);
      return;
    }
    const missing = ready.text.missing(0, textEnd);
    if (missing.length > 0) {
      for (const n of missing.slice(0, 2)) load(n);
      return;
    }
    setResults(
      (underscored ? findAllRead : findAll)(ready.text.slice(0, textEnd), query, MAX_RESULTS),
    );
    setSearching(false);
  }, [searching, ready, textEnd, source.status, version, query, load, underscored]);
  const searchProgress = !ready
    ? "Searching…"
    : `Searching… ${Math.floor((ready.text.heldParts / Math.max(1, ready.text.parts)) * 100)}% of the book read`;

  const statusId = useId();
  const [pageSpan, setPageSpan] = useState<HTMLSpanElement | null>(null);
  const [goToOpen, setGoToOpen] = useState(false);
  const [goToDraft, setGoToDraft] = useState("");
  /** The page numbered `wanted` of the pages at this size, from the first word starting in it. */
  const goToPage = (wanted: number) => {
    if (!text) return;
    const number = Math.min(numbers.pages, Math.max(1, wanted));
    if (number === 1) {
      goTo(0);
      return;
    }
    const offset = (number - 1) * perPage;
    const ahead = text.slice(offset, offset + 200);
    const gap = ahead.search(/\s/);
    goTo(offset + (gap < 0 ? 0 : skipSpace(ahead, gap)));
  };
  const toc = (ready?.toc ?? []).filter((heading) => heading.at < textEnd);
  const previousMark = reading.bookmarks.filter((mark) => mark.at < place).at(-1)?.at;
  const nextMark = reading.bookmarks.find((mark) => mark.at > place)?.at;
  const previousChapter = toc.filter((heading) => heading.at < place).at(-1)?.at;
  const nextChapter = toc.find((heading) => heading.at > place)?.at;
  /** Open the page that starts with the word holding `offset`. */
  const goToWord = (offset: number) => {
    if (!text) return;
    goTo(offset - wordStart(text.slice(Math.max(0, offset - 200), offset)));
  };

  // View > Scroll: more of the text as the view nears either end. Text put before what is shown
  // leaves the words on the screen where they were.
  const upAnchor = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: text put before the view moves it
  useLayoutEffect(() => {
    const view = page.current;
    if (view && upAnchor.current !== null) view.scrollTop += view.scrollHeight - upAnchor.current;
    upAnchor.current = null;
  }, [at]);
  const watchScroll = useRef(() => {});
  watchScroll.current = () => {
    const view = page.current;
    if (!scrolling || !view || !text || end === null || view.clientHeight === 0) return;
    const reach = view.clientHeight;
    if (end < total && view.scrollHeight - view.scrollTop - reach < reach) {
      setScrollSpan((span) => Math.max(span, end - at + WINDOW));
    }
    if (at > 0 && view.scrollTop < reach && upAnchor.current === null) {
      const from = Math.max(0, at - WINDOW);
      const missing = text.missing(from, at);
      if (missing.length > 0) {
        for (const n of missing) load(n);
        return;
      }
      // Read first: a picture that arrives after the text is put in would move what is on screen.
      const unread = picturesIn(pictures, from, at, textEnd).filter(
        ({ path }) => !shownPictures.current.has(path),
      );
      if (unread.length > 0) {
        readPictures(unread);
        return;
      }
      upAnchor.current = view.scrollHeight;
      setScrollSpan((span) => span + at - from);
      setScrollFrom(from);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: parts arriving, and the view growing
  useEffect(() => watchScroll.current(), [version, end]);
  // The place follows the top of the view, once scrolling rests.
  const keepScrolledPlace = useRef(() => {});
  keepScrolledPlace.current = () => {
    const view = page.current;
    if (!scrolling || !view || !text || end === null) return;
    const offset = topOffset(view, pageText.length);
    if (offset === null) return;
    const to = characterStart(text, at + offset);
    if (to !== place) change({ ...reading, place: to }, true);
  };
  const scrollRest = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(scrollRest.current), []);
  const onPageScroll = () => {
    watchScroll.current();
    clearTimeout(scrollRest.current);
    scrollRest.current = setTimeout(() => keepScrolledPlace.current(), SCROLL_REST_MS);
  };
  // File > Print: the page shown, and its pictures, in the print frame as data addresses because
  // that frame's page may load nothing else.
  useLayoutEffect(() => {
    if (!printRef) return;
    const lines = read(shownWords).split("\n");
    const file = ready?.pictureFile;
    const printed =
      file && markEnd !== null
        ? picturesIn(pictures, place, markEnd, textEnd).flatMap((picture) => {
            const shown = shownPictures.current.get(picture.path);
            return shown ? [{ picture, width: shown.width }] : [];
          })
        : [];
    printRef.current = () => {
      if (!file || printed.length === 0) {
        printDocument({ name: book.title, plain: true, lines });
        return;
      }
      void Promise.all(
        printed.map(async ({ picture, width }) => ({
          at: picture.at,
          width,
          src: await dataAddress(await file(picture)),
        })),
      ).then(
        (pictured) =>
          printDocument({
            name: book.title,
            plain: false,
            lines,
            html: printedPage(
              shownWords,
              place,
              pictured,
              underscored ? emphasisPieces(shownWords) : undefined,
            ),
          }),
        () => {
          setNotice("The pictures of this page could not be printed; the words were.");
          printDocument({ name: book.title, plain: true, lines });
        },
      );
    };
    return () => {
      printRef.current = null;
    };
  });
  let body: ReactNode;
  if (source.status === "failed") {
    body = (
      <div className="mac-books-text-status">
        <EmptyState role="status">Books could not open this book: {source.message}</EmptyState>
        <PushButton onClick={() => setAttempt((count) => count + 1)}>Try Again</PushButton>
      </div>
    );
  } else if (!readable) {
    body = (
      <div className="mac-books-text-status">
        <EmptyState role="status">Your notes for this book could not be read.</EmptyState>
      </div>
    );
  } else {
    body = (
      <div className="mac-books-text-sheet">
        <div ref={setBox} className="mac-books-text-box">
          <ContextualMenu>
            <ContextualMenuTrigger
              render={
                <div
                  ref={page}
                  className="mac-books-text"
                  role="document"
                  aria-label={end === null ? "Loading" : pageLabel}
                  aria-busy={end === null || undefined}
                  data-page-start={at}
                  data-page-end={end ?? undefined}
                  // In a view that scrolls the page takes the keyboard, for its own arrow keys.
                  tabIndex={scrolling ? 0 : -1}
                  onScroll={scrolling ? onPageScroll : undefined}
                  onPointerUp={(event) => {
                    // A secondary press has this page's own menu, not the highlight colours.
                    if (event.button === 0) readSelection();
                  }}
                  onContextMenu={() => setEditing(null)}
                  onKeyUp={(event) => {
                    if (event.shiftKey) readSelection();
                  }}
                  // A click on a highlight (not the end of a selection) opens its menu.
                  onClick={(event) => {
                    const mark = (event.target as Element).closest?.("[data-highlight]");
                    if (!mark) return;
                    const selection = mark.ownerDocument.getSelection();
                    if (selection && !selection.isCollapsed) return;
                    const id = mark.getAttribute("data-highlight");
                    showHighlight(
                      reading.highlights.find((h) => h.id === id),
                      mark,
                    );
                  }}
                >
                  {end === null
                    ? null
                    : parts.map((part) =>
                        part.picture ? (
                          // Its alt text is among the words of the page: no second reading of it.
                          <img
                            key={`picture-${part.from}-${part.picture.path}`}
                            className="mac-books-picture"
                            src={part.picture.shown.url}
                            alt=""
                            draggable={false}
                            data-book-picture={part.picture.path}
                            data-inline={part.picture.size.inline ? "" : undefined}
                            style={{
                              width: part.picture.size.width,
                              height: part.picture.size.height,
                            }}
                          />
                        ) : part.highlight ? (
                          <mark
                            key={part.from}
                            className="mac-books-highlight"
                            title={part.highlight.note || undefined}
                            data-color={part.highlight.color}
                            data-note={part.highlight.note ? "" : undefined}
                            data-highlight={part.highlight.id}
                          >
                            {wordsOfPage(pagePieces, part.from - at, part.to - at, pageText)}
                          </mark>
                        ) : (
                          <span key={part.from}>
                            {wordsOfPage(pagePieces, part.from - at, part.to - at, pageText)}
                          </span>
                        ),
                      )}
                </div>
              }
            />
            <ContextualMenuPopup aria-label="Page">
              <ReaderPageItems reader={() => readerCommands.current.edit} />
            </ContextualMenuPopup>
          </ContextualMenu>
          <div ref={measure} className="mac-books-text mac-books-text-measure" aria-hidden="true" />
          {end === null ? (
            <div className="mac-books-text-loading">
              <ProgressSpinner size="small" aria-labelledby={statusId} />
              <span id={statusId}>
                {source.status === "loading" && source.parts
                  ? `Getting the book from its source… ${source.parts} parts so far`
                  : "Loading the book…"}
              </span>
            </div>
          ) : null}
        </div>
        <p className="mac-books-text-footer">
          <span ref={setPageSpan} className="mac-books-text-page">
            {end === null ? "" : pageLabel}
          </span>
          <span className="mac-books-text-credit">
            {ready?.credit}
            {ready?.licence ? ` · ${ready.licence}` : ""}
            {ready?.changed
              ? " · Shortened: the book changed at its source while Books was getting it, so its text stops early"
              : ready?.truncated
                ? " · Shortened: this book is longer than Books keeps, so its text stops early"
                : ""}
            {ready?.link ? (
              <>
                {" · "}
                <a href={ready.link} target="_blank" rel="noopener noreferrer">
                  Book page
                </a>
              </>
            ) : null}
          </span>
        </p>
        {notice ? (
          <p className="mac-books-text-notice" role="alert">
            {notice}
          </p>
        ) : null}
        {sample && atEnd ? (
          <p className="mac-books-text-sample-end" role="status">
            This is the end of the sample.
            <PushButton onClick={onGetBook}>Get Book</PushButton>
          </p>
        ) : null}
      </div>
    );
  }

  const sortedHighlights = [...reading.highlights].sort((a, b) => a.start - b.start);
  const [notesOpen, setNotesOpenNow] = useState(false);
  const [studying, setStudying] = useState(false);
  const setNotesOpen = (next: boolean) => {
    setNotesOpenNow(next);
    if (!next) setStudying(false);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const usable = source.status === "ready" && readable;

  // The page-turn keys. Turning goes through a ref so the document's listener, added once,
  // always turns from the page shown now.
  const turn = useRef((_direction: Turn) => {});
  turn.current = (direction) => (direction === "next" ? next() : previous());
  /**
   * From inside the window, wherever the focus is: the page, the bar, the turn buttons, while
   * the window is the key window. Not from a menu or popover drawn outside the window, whose
   * events React passes up to it too, and not from a window that is not key: the key reader's
   * own listener takes those.
   */
  const turnKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (!inKeyWindow(event.currentTarget)) return;
    const direction = pageTurn(event);
    if (!direction) return;
    event.preventDefault();
    turn.current(direction);
  };
  // From the document, while this reader is the key window, can be used (not inert) and
  // nothing in a key window has the focus: a reader just opened (the browser may have left the
  // focus on the page's body), or the focus left behind in a window that is no longer key. The
  // focus is never moved.
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => {
      const frame = page.current?.closest(".mac-books-text-reader");
      if (!frame || !inKeyWindow(frame) || frame.closest("[inert]")) return;
      const active = frame.ownerDocument.activeElement;
      if (active && active !== frame.ownerDocument.body && inKeyWindow(active)) return;
      const direction = pageTurn(event);
      if (!direction) return;
      event.preventDefault();
      turn.current(direction);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  // The menu bar's Controls and Edit menus and their keys, as the reader's own buttons do
  // (desktop-app-menus.ts). The rows change only with what they show; the commands are read when
  // one is chosen. What needs the text appears once the text has arrived.
  const bar = useRef<HTMLDivElement>(null);
  const lastField = useRef<ReaderField | null>(null);
  useEffect(() => {
    const note = (event: FocusEvent) => {
      const at = event.target;
      if (at instanceof Element && at.matches(READER_FIELDS)) lastField.current = at as ReaderField;
    };
    document.addEventListener("focusin", note);
    return () => document.removeEventListener("focusin", note);
  }, []);
  const edit: ReaderEdit = {
    target: () =>
      page.current
        ? {
            element: page.current,
            restore: () => {
              const range = pageRange();
              const selection = page.current?.ownerDocument.getSelection();
              if (!range || !selection || !range.startContainer.isConnected) return;
              selection.removeAllRanges();
              selection.addRange(range);
            },
            editable: false,
            rich: false,
          }
        : null,
    field: () =>
      (searchOpen || goToOpen || editing !== null) && lastField.current?.isConnected
        ? lastField.current
        : null,
    say: setNotice,
    selected: () => read(pageRange()?.toString().trim() ?? ""),
    pageWords: () => read(shownWords),
    find: () => afterMenu(() => setSearchOpen(true)),
    search: (words) =>
      afterMenu(() => {
        setQuery(words);
        setResults(null);
        setSearchOpen(true);
        setSearching(true);
      }),
    highlightSelection: (noting) => afterMenu(() => highlightSelection(noting)),
    canStep: (way) => marksHistory.current[way].length > 0,
    step: stepMarks,
    link: fromFile(book) ? "" : bookWebAddress(book.id),
    title: book.title,
  };
  const readerCommands = useRef({ toggleBookmark, onLibrary, goTo, edit });
  readerCommands.current = { toggleBookmark, onLibrary, goTo, edit };
  const canMark = end !== null;
  const hasLibrary = onLibrary !== undefined;
  const controlsMenu = useMemo(
    () => (
      <>
        <MenuItem onClick={() => turn.current("previous")}>Previous Page</MenuItem>
        <MenuItem onClick={() => turn.current("next")}>Next Page</MenuItem>
        {usable ? (
          <MenuItem
            onClick={() =>
              afterMenu(() => {
                setGoToDraft("");
                setGoToOpen(true);
              })
            }
          >
            Go to Page…
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+d"
          disabled={!canMark}
          onClick={() => readerCommands.current.toggleBookmark()}
        >
          {marked ? "Remove Bookmark" : "Add Bookmark"}
        </MenuItem>
        {usable ? (
          <>
            <MenuItem
              disabled={previousMark === undefined}
              onClick={() => readerCommands.current.goTo(previousMark ?? 0)}
            >
              Previous Bookmark
            </MenuItem>
            <MenuItem
              disabled={nextMark === undefined}
              onClick={() => readerCommands.current.goTo(nextMark ?? 0)}
            >
              Next Bookmark
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => afterMenu(() => setTocOpen(true))}>Table of Contents</MenuItem>
            <MenuItem
              disabled={previousChapter === undefined}
              onClick={() => readerCommands.current.goTo(previousChapter ?? 0)}
            >
              Previous Chapter
            </MenuItem>
            <MenuItem
              disabled={nextChapter === undefined}
              onClick={() => readerCommands.current.goTo(nextChapter ?? 0)}
            >
              Next Chapter
            </MenuItem>
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem
          keyEquivalent="shift+command+l"
          disabled={!hasLibrary}
          onClick={() => readerCommands.current.onLibrary?.()}
        >
          Show Library
        </MenuItem>
        <MenuSeparator />
        <DimmedRow reason={NO_AUDIO_REASON}>Play</DimmedRow>
      </>
    ),
    [canMark, marked, hasLibrary, usable, previousMark, nextMark, previousChapter, nextChapter],
  );
  useDesktopAppMenu("books", "Controls", controlsMenu);
  const readerEdit = useCallback(() => readerCommands.current.edit, []);

  // The reader's key equivalents, while it is the key window and no field has the keyboard.
  const readerKeys = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  readerKeys.current = (event) => {
    const frame = bar.current;
    if (event.defaultPrevented || !frame || !inKeyWindow(frame) || frame.closest("[inert]")) return;
    if (event.target instanceof Element && event.target.closest(TEXT_FIELDS)) return;
    // Shift and an arrow select the page's words from the keyboard, from where the page begins when
    // nothing on it is selected yet: Option selects by the word.
    const way = SELECTING[event.key];
    if (way && event.shiftKey && !event.metaKey && !event.ctrlKey) {
      const root = page.current;
      const selection = root?.ownerDocument.getSelection();
      const first = root?.querySelector("span, mark")?.firstChild;
      if (!root || !selection || !first || typeof selection.modify !== "function") return;
      if (!selection.anchorNode || !root.contains(selection.anchorNode))
        selection.collapse(first, 0);
      event.preventDefault();
      selection.modify(
        "extend",
        way.direction,
        event.altKey ? (way.across ? "word" : "paragraph") : way.across ? "character" : "line",
      );
      lastRange.current =
        !selection.isCollapsed && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : null;
      return;
    }
    const bindings: [string, () => void][] = [
      ["command+d", toggleBookmark],
      ["shift+command+l", () => onLibrary?.()],
      ["command+f", () => setSearchOpen(true)],
      ["command+z", () => stepMarks("undo")],
      ["shift+command+z", () => stepMarks("redo")],
      ["control+command+h", () => highlightSelection(false)],
      ["control+command+n", () => highlightSelection(true)],
      [
        "command+a",
        () => {
          const root = page.current;
          const selection = root?.ownerDocument.getSelection();
          if (root && selection) selection.selectAllChildren(root);
        },
      ],
    ];
    for (const [equivalent, run] of bindings) {
      if (!matchesMenuKeyEquivalent(event, equivalent)) continue;
      event.preventDefault();
      run();
      return;
    }
  };
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => readerKeys.current(event);
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);
  return (
    <Window
      width={width}
      height={height}
      className={
        className
          ? `mac-books-reader mac-books-text-reader ${className}`
          : "mac-books-reader mac-books-text-reader"
      }
      {...props}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        turnKey(event);
      }}
      aria-busy={busy || loading || undefined}
      inert={inert || loading || undefined}
    >
      {inFront ? <ReaderEditMenu reader={readerEdit} /> : null}
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
        <div ref={bar} className="mac-books-reader-bar" role="group" aria-label="Book controls">
          <ImageButton aria-label="Library" style={BAR_ITEM} onClick={onLibrary}>
            <BooksGlyph name="library" />
          </ImageButton>
          <Menu open={tocOpen} onOpenChange={setTocOpen}>
            <MenuTrigger
              disabled={!usable}
              render={<ImageButton aria-label="Table of Contents" style={BAR_ITEM} />}
            >
              <BooksGlyph name="contents" />
            </MenuTrigger>
            <MenuPopup>
              <MenuItem onClick={() => goTo(ready?.start ?? 0)}>Beginning</MenuItem>
              {toc.length > 0 ? <MenuSeparator /> : null}
              {toc.map((heading) => (
                <MenuItem key={`${heading.at}`} onClick={() => goTo(heading.at)}>
                  {heading.title}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
          <Popover open={notesOpen} onOpenChange={setNotesOpen}>
            <PopoverTrigger
              disabled={!usable}
              render={<ImageButton aria-label="Notes" style={BAR_ITEM} />}
            >
              <BooksGlyph name="notes" />
            </PopoverTrigger>
            <PopoverPopup className="mac-books-notes" side="bottom">
              <PopoverTitle>{studying ? "Study Cards" : "Highlights and Notes"}</PopoverTitle>
              {studying ? (
                <StudyCards highlights={sortedHighlights} onDone={() => setStudying(false)} />
              ) : sortedHighlights.length === 0 ? (
                <EmptyState className="mac-books-notes-empty">
                  Select words on a page to highlight them or add a note.
                </EmptyState>
              ) : (
                <>
                  <ul className="mac-books-notes-list">
                    {sortedHighlights.map((h) => (
                      <li key={h.id} className="mac-books-notes-row">
                        <BorderlessButton
                          className="mac-books-notes-item"
                          data-color={h.color}
                          onClick={() => {
                            setNotesOpen(false);
                            goToWord(h.start);
                          }}
                        >
                          <span className="mac-books-notes-quote">{h.text}</span>
                          {h.note ? <span className="mac-books-notes-note">{h.note}</span> : null}
                        </BorderlessButton>
                        {/* The highlight's menu from the keyboard: its mark on the page is opened
                          with the pointer only. */}
                        <BorderlessButton
                          className="mac-books-notes-edit"
                          aria-label={`Edit the highlight “${h.text}”`}
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setNotesOpen(false);
                            setDraft(h.note);
                            setEditing({ kind: "existing", id: h.id, rect });
                          }}
                        >
                          Edit
                        </BorderlessButton>
                      </li>
                    ))}
                  </ul>
                  <PushButton onClick={() => setStudying(true)}>Study Cards</PushButton>
                </>
              )}
            </PopoverPopup>
          </Popover>
          <span className="mac-books-reader-bar-space" />
          <BooksAppearanceButton appearance={appearance} disabled={!usable} style={BAR_ITEM} />
          <Popover
            open={searchOpen}
            onOpenChange={(open, details) => {
              if (open || !forTheMenus(details)) setSearchOpen(open);
            }}
          >
            <PopoverTrigger
              disabled={!usable}
              render={<ImageButton aria-label="Search" style={SEARCH_ITEM} />}
            >
              <BooksGlyph name="search" />
            </PopoverTrigger>
            <PopoverPopup className="mac-books-search" side="bottom">
              <form
                className="mac-books-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (query.trim() === "") return;
                  setResults(null);
                  setSearching(true);
                }}
              >
                <SearchField
                  aria-label="Search in the book"
                  placeholder="Search in Book"
                  value={query}
                  onValueChange={(value: string) => setQuery(value)}
                />
              </form>
              {searching ? (
                <p className="mac-books-search-status" role="status">
                  {searchProgress}
                </p>
              ) : results === null ? null : results.length === 0 ? (
                <p className="mac-books-search-status" role="status">
                  No Results
                </p>
              ) : (
                <ul className="mac-books-notes-list" aria-label="Results">
                  {results.map((offset) => (
                    <li key={offset}>
                      <BorderlessButton
                        className="mac-books-notes-item"
                        onClick={() => {
                          setSearchOpen(false);
                          goToWord(offset);
                        }}
                      >
                        <span className="mac-books-notes-quote">
                          {text
                            ? excerpt(read(text.slice(Math.max(0, offset - 40), offset + 80)), 120)
                            : ""}
                        </span>
                      </BorderlessButton>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverPopup>
          </Popover>
          <PullDownButton
            bordered={false}
            aria-label="Bookmarks"
            disabled={!usable}
            data-marked={marked ? "" : undefined}
            className="mac-books-bookmarks"
            image={<BooksGlyph name="bookmark" />}
          >
            <MenuItem onClick={toggleBookmark}>
              {marked ? "Remove Bookmark" : "Add Bookmark"}
            </MenuItem>
            {reading.bookmarks.length > 0 ? <MenuSeparator /> : null}
            {reading.bookmarks.map((mark) => (
              <MenuItem key={mark.at} onClick={() => goTo(mark.at)}>
                {mark.label}
              </MenuItem>
            ))}
          </PullDownButton>
        </div>
      </TitleBar>
      <WindowBody
        className="mac-books-reader-body mac-books-text-body"
        {...appearanceProps(appearance)}
      >
        {body}
        {usable && !scrolling ? (
          <>
            <span className="mac-books-turn" data-direction="previous">
              <BorderlessButton
                aria-label="Previous Page"
                focusableWhenDisabled
                disabled={at <= 0 || end === null}
                style={TURN}
                onClick={previous}
              >
                <SystemImage name="go-back" />
              </BorderlessButton>
            </span>
            <span className="mac-books-turn" data-direction="next">
              <BorderlessButton
                aria-label="Next Page"
                focusableWhenDisabled
                disabled={end === null || atEnd}
                style={TURN}
                onClick={next}
              >
                <SystemImage name="go-forward" />
              </BorderlessButton>
            </span>
          </>
        ) : null}
      </WindowBody>
      <Popover
        open={goToOpen}
        onOpenChange={(open, details) => {
          if (open || !forTheMenus(details)) setGoToOpen(open);
        }}
      >
        {goToOpen && pageSpan ? (
          <PopoverPopup anchor={pageSpan} side="top">
            <form
              className="mac-books-go-to"
              onSubmit={(event) => {
                event.preventDefault();
                const wanted = Number.parseInt(goToDraft, 10);
                if (Number.isNaN(wanted)) return;
                setGoToOpen(false);
                goToPage(wanted);
              }}
            >
              <TextField
                aria-label="Page number"
                className="mac-books-go-to-field"
                inputMode="numeric"
                autoFocus
                value={goToDraft}
                onValueChange={setGoToDraft}
              />
              <span>of {numbers.pages}</span>
              <PushButton type="submit" variant="primary">
                Go
              </PushButton>
            </form>
          </PopoverPopup>
        ) : null}
      </Popover>
      <Popover
        open={editing !== null}
        onOpenChange={(open, details) => {
          if (open || forTheMenus(details)) return;
          // A note left open by a press elsewhere is kept, as Done keeps it.
          if (editingHighlight && draft !== editingHighlight.note) saveNote();
          else setEditing(null);
        }}
      >
        {anchor ? (
          <PopoverPopup anchor={anchor} side="top" className="mac-books-highlight-menu">
            <PopoverTitle className="mac-books-highlight-title">
              {editing?.kind === "new" ? "Highlight" : "Highlight and Note"}
            </PopoverTitle>
            {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
            <div className="mac-books-highlight-colors" role="group" aria-label="Colour">
              {HIGHLIGHT_COLORS.map((color) => (
                <BorderlessButton
                  key={color.id}
                  className="mac-books-highlight-swatch"
                  data-color={color.id}
                  aria-label={color.name}
                  aria-pressed={editingHighlight ? editingHighlight.color === color.id : undefined}
                  onClick={() => highlight(color.id)}
                />
              ))}
            </div>
            {editing?.kind === "new" ? (
              <PushButton onClick={() => highlight("yellow", true)}>Add Note</PushButton>
            ) : editing?.kind === "existing" ? (
              <div className="mac-books-highlight-note">
                <div className="mac-books-highlight-text">
                  <TextView
                    aria-label="Note"
                    placeholder="Add a note"
                    maxLength={BOOKS_LIMITS.note}
                    value={draft}
                    onValueChange={setDraft}
                  />
                </div>
                <div className="mac-books-highlight-actions">
                  <PushButton onClick={removeHighlight}>Remove Highlight</PushButton>
                  <PushButton variant="primary" onClick={saveNote}>
                    Done
                  </PushButton>
                </div>
              </div>
            ) : null}
          </PopoverPopup>
        ) : null}
      </Popover>
      {overlay}
    </Window>
  );
}
