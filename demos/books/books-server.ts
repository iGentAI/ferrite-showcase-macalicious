import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { type DocumentMerge, mergeDocuments } from "../desktop/document-merge";
import type { BooksCollection, BooksSort } from "./books-data";
import type { EpubPicture } from "./books-epub";
import { cut } from "./books-text";

/**
 * Books on its module of the `macalicious-desktop` Ferrite application
 * (`ferrite-apps/desktop/src/apps/books`). Per person: the library (`GET` and `PUT` of
 * `{ library }`: collections, the demo's page places, the Sort By choice and the books the person
 * got from the Book Store) and one reading document per book (`{ reading }`: the place, bookmarks and
 * highlights with notes). Shared by everyone: the Book Store's listings and each book's text,
 * fetched once from Project Gutenberg or Standard Ebooks and served in parts.
 */
export const BOOKS_LIBRARY_URL = "/api/books/library";
export const BOOKS_READING_URL = "/api/books/reading/";
export const BOOKS_STORE_URL = "/api/books/store";
export const BOOKS_TEXT_URL = "/api/books/text/";
export const BOOKS_PICTURES_URL = "/api/books/pictures/";
export const BOOKS_AUDIOBOOK_URL = "/api/books/audiobook/";

/** Where a book of the store comes from. */
export type BooksStoreSource = "gutenberg" | "standard-ebooks" | "librivox";
/** Where a book of the library comes from: the store, or a file of the person's drive. */
export type BooksSource = BooksStoreSource | "epub" | "pdf";

/** A book the person got from the Book Store, or added from a file of their drive. */
export interface OwnedBook {
  /** `pg-<n>`, `se.<author>.<title>[.<translator>[.<illustrator>]]`, `lv-<n>`, `epub-<hex>` or `pdf-<hex>`. */
  id: string;
  title: string;
  author: string;
  source: BooksSource;
  /** When it joined the library, epoch milliseconds. */
  added: number;
  cover?: string;
  /** The drive's id of the file a book added from one is read from. */
  file?: string;
}

/** Whether a book is read from a file of the person's drive: it has no page at a source. */
export const fromFile = (book: { id: string }) => /^(?:epub|pdf)-/.test(book.id);

/**
 * A book's page at its source: `https://…/ebooks/<n>`, or Standard Ebooks' path from its id. An
 * audiobook's id says only LibriVox's number, which names the book's feed there.
 */
export function bookWebAddress(id: string): string {
  if (id.startsWith("lv-")) return `https://librivox.org/rss/${id.slice(3)}`;
  return id.startsWith("se.")
    ? `https://standardebooks.org/ebooks/${id.slice(3).replaceAll(".", "/")}`
    : `https://www.gutenberg.org/ebooks/${id.replace(/^pg-/, "")}`;
}

/** What the module keeps. */
export interface BooksLibraryState {
  collections: readonly BooksCollection[];
  /**
   * The demo's page places. For a book of the person's library, how far they have read, 1 to 100:
   * a book with no entry has not been opened, and its cover says New.
   */
  pages: Readonly<Record<string, number>>;
  marks: Readonly<Record<string, readonly number[]>>;
  sort: BooksSort;
  /** The person's books; absent in a library saved before Books had a store. */
  books?: readonly OwnedBook[];
}

/** The module's limits (`MAX_BOOKS`, `reading.rs`), and what one save may send. */
export const BOOKS_LIMITS = {
  books: 500,
  title: 300,
  bookmarks: 500,
  highlights: 500,
  label: 200,
  excerpt: 300,
  note: 2_000,
  span: 50_000,
  /** The most bytes a stored library or reading document takes. */
  bytes: 200_000,
} as const;

const SORTS: readonly BooksSort[] = ["recent", "title", "author", "manual"];
const SOURCES: readonly BooksSource[] = ["gutenberg", "standard-ebooks", "librivox", "epub", "pdf"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isPage = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;
const isOffset = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const isOptional = (value: unknown, type: "string" | "number") =>
  value === undefined || typeof value === type;

const isCollection = (value: unknown): value is BooksCollection =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  Array.isArray(value.books) &&
  value.books.every((book) => typeof book === "string");

const isOwnedBook = (value: unknown): value is OwnedBook =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.author === "string" &&
  SOURCES.includes(value.source as BooksSource) &&
  typeof value.added === "number" &&
  isOptional(value.cover, "string") &&
  isOptional(value.file, "string");

const isLibrary = (value: unknown): value is BooksLibraryState =>
  isRecord(value) &&
  Array.isArray(value.collections) &&
  value.collections.every(isCollection) &&
  isRecord(value.pages) &&
  Object.values(value.pages).every(isPage) &&
  isRecord(value.marks) &&
  Object.values(value.marks).every((marks) => Array.isArray(marks) && marks.every(isPage)) &&
  SORTS.includes(value.sort as BooksSort) &&
  (value.books === undefined || (Array.isArray(value.books) && value.books.every(isOwnedBook)));

/**
 * Whether a `GET` reply is one Books can read: a library in the window's shape, or `null` before
 * the person has saved. Anything else is stored data that must not be saved over.
 */
export function booksLibraryReadable(reply: unknown): boolean {
  const library = isRecord(reply) ? reply.library : undefined;
  return library === null || isLibrary(library);
}

/** The library of a `GET` reply, or `undefined` when the person has none (or it is unreadable). */
export function booksLibraryFromServer(reply: unknown): BooksLibraryState | undefined {
  if (!booksLibraryReadable(reply)) return undefined;
  return (reply as { library: BooksLibraryState | null }).library ?? undefined;
}

/** One book of the library as the module keeps it: only its fields. */
const ownedToServer = (book: OwnedBook): OwnedBook => ({
  id: book.id,
  title: book.title,
  author: book.author,
  source: book.source,
  added: book.added,
  ...(book.cover ? { cover: book.cover } : {}),
  ...(book.file ? { file: book.file } : {}),
});

/** The `PUT` body: only the fields the module keeps (`books` only when there are any). */
export function booksLibraryToServer(state: BooksLibraryState) {
  const books = (state.books ?? []).map(ownedToServer);
  return {
    library: {
      collections: state.collections.map(({ id, name, books }) => ({
        id,
        name,
        books: [...books],
      })),
      pages: { ...state.pages },
      marks: Object.fromEntries(
        Object.entries(state.marks)
          // A book whose last bookmark was removed keeps none.
          .filter(([, marks]) => marks.length > 0)
          .map(([book, marks]) => [book, [...new Set(marks)].sort((a, b) => a - b)]),
      ),
      sort: state.sort,
      ...(books.length > 0 ? { books } : {}),
    },
  };
}

/** The size of the library's `PUT` body in bytes: over `BOOKS_LIMITS.bytes`, a save is refused. */
export function booksLibrarySize(state: BooksLibraryState): number {
  return new TextEncoder().encode(JSON.stringify(booksLibraryToServer(state).library)).length;
}

// ---------------------------------------------------------------------------
// The reading of one book
// ---------------------------------------------------------------------------

export interface BooksBookmark {
  /** The offset of the page start it marks, in UTF-16 units of the whole text. */
  at: number;
  /** The first words of that page. */
  label: string;
}

export type BooksHighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";
export const HIGHLIGHT_COLORS: readonly { id: BooksHighlightColor; name: string }[] = [
  { id: "yellow", name: "Yellow" },
  { id: "green", name: "Green" },
  { id: "blue", name: "Blue" },
  { id: "pink", name: "Pink" },
  { id: "purple", name: "Purple" },
];

export interface BooksHighlight {
  id: string;
  start: number;
  end: number;
  color: BooksHighlightColor;
  /** The highlighted words, cut to `BOOKS_LIMITS.excerpt`. */
  text: string;
  note: string;
}

/** What a person keeps of one book. */
export interface BooksReading {
  place: number;
  bookmarks: readonly BooksBookmark[];
  highlights: readonly BooksHighlight[];
}

export const NO_READING: BooksReading = { place: 0, bookmarks: [], highlights: [] };

/** The address of a book's reading document. */
export const readingUrl = (book: string) => `${BOOKS_READING_URL}${encodeURIComponent(book)}`;

const isBookmark = (value: unknown): value is BooksBookmark =>
  isRecord(value) && isOffset(value.at) && typeof value.label === "string";

const isHighlight = (value: unknown): value is BooksHighlight =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isOffset(value.start) &&
  isOffset(value.end) &&
  HIGHLIGHT_COLORS.some(({ id }) => id === value.color) &&
  typeof value.text === "string" &&
  isOptional(value.note, "string");

const isReading = (value: unknown): value is BooksReading =>
  isRecord(value) &&
  isOffset(value.place) &&
  (value.bookmarks === undefined ||
    (Array.isArray(value.bookmarks) && value.bookmarks.every(isBookmark))) &&
  (value.highlights === undefined ||
    (Array.isArray(value.highlights) && value.highlights.every(isHighlight)));

/** Whether a reading `GET` reply can be read: a reading, or `null` before the first save. */
export function readingReadable(reply: unknown): boolean {
  const reading = isRecord(reply) ? reply.reading : undefined;
  return reading === null || isReading(reading);
}

/** The reading of a reply, normalised; `NO_READING` before the first save. */
export function readingFromServer(reply: unknown): BooksReading | undefined {
  const reading = isRecord(reply) ? reply.reading : undefined;
  if (reading === null) return NO_READING;
  if (!isReading(reading)) return undefined;
  return {
    place: reading.place,
    bookmarks: [...(reading.bookmarks ?? [])],
    highlights: (reading.highlights ?? []).map((highlight) => ({
      ...highlight,
      note: highlight.note ?? "",
    })),
  };
}

/** The `PUT` body of a reading: bookmarks in order, each place once. */
export function readingToServer(reading: BooksReading) {
  const seen = new Set<number>();
  return {
    reading: {
      place: Math.max(0, Math.trunc(reading.place)),
      bookmarks: [...reading.bookmarks]
        .sort((a, b) => a.at - b.at)
        .filter(({ at }) => !seen.has(at) && seen.add(at) !== undefined)
        .map(({ at, label }) => ({ at, label: cut(label, BOOKS_LIMITS.label) })),
      highlights: reading.highlights.map(({ id, start, end, color, text, note }) => ({
        id,
        start,
        end,
        color,
        text: cut(text, BOOKS_LIMITS.excerpt),
        note: cut(note, BOOKS_LIMITS.note),
      })),
    },
  };
}

/**
 * How a change of a reading meets a newer one saved elsewhere (another window, another browser):
 * bookmarks are named by their place and highlights by their id, so each side's additions and
 * removals are kept, and the bookmarks stay in the order of their places, as the server keeps
 * them. The place is the one changed here.
 */
export const mergeReadings: DocumentMerge = (base, mine, theirs) => {
  const merged = mergeDocuments(base, mine, theirs, { keys: ["id", "at"] }) as {
    reading?: { bookmarks?: unknown } | null;
  };
  const reading = merged.reading;
  if (!reading || !Array.isArray(reading.bookmarks)) return merged;
  const bookmarks = [...(reading.bookmarks as BooksBookmark[])].sort((a, b) => a.at - b.at);
  return { ...merged, reading: { ...reading, bookmarks } };
};

/** The size of a reading's `PUT` body in bytes. */
export function readingSize(reading: BooksReading): number {
  return new TextEncoder().encode(JSON.stringify(readingToServer(reading).reading)).length;
}

// ---------------------------------------------------------------------------
// The store and the texts
// ---------------------------------------------------------------------------

/** One book of a store listing. */
export interface StoreBook {
  id: string;
  title: string;
  author: string;
  source: BooksStoreSource;
  cover?: string;
  summary?: string;
}

export interface StoreListing {
  books: StoreBook[];
  more: boolean;
}

/** One heading of a book's contents. */
export interface BookHeading {
  title: string;
  at: number;
}

/** A book's index: who to credit, its rights, and the lengths of its parts. */
export interface BookIndex {
  id: string;
  source: BooksStoreSource;
  credit: string;
  licence: string;
  link: string;
  title?: string;
  author?: string;
  language?: string;
  /** Each part's length in UTF-16 units. */
  parts: number[];
  complete: boolean;
  truncated: boolean;
  /** The source changed while the book was being fetched: the text ends with what was kept. */
  changed: boolean;
  /** Where the reading text begins. */
  start: number;
  toc: BookHeading[];
}

/** A failure the server explained, with its status. */
export class BooksRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BooksRequestError";
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How many times a request answered "still being fetched for another reader" is asked again. */
const BUSY_RETRIES = 3;
const BUSY_PAUSE_MS = 1_500;
/** How long a request the source did not answer waits before it is sent once more. */
const SOURCE_PAUSE_MS = 800;

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt += 1) {
    const { status, body } = await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      return {
        status: response.status,
        body: (await response.json().catch(() => null)) as unknown,
      };
    });
    if (status >= 200 && status < 300) return body;
    const message = isRecord(body) && typeof body.error === "string" ? body.error : "";
    // The book is being fetched by another request: it is kept in a moment.
    if (status === 503 && /still being fetched/.test(message) && attempt < BUSY_RETRIES) {
      await wait(BUSY_PAUSE_MS);
      continue;
    }
    // The source did not answer this time (a connection that took too long): once more.
    if ((status === 502 || status === 504) && attempt === 0) {
      await wait(SOURCE_PAUSE_MS);
      continue;
    }
    throw new BooksRequestError(message || `HTTP ${status}`, status);
  }
}

const isStoreBook = (value: unknown): value is StoreBook =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.author === "string" &&
  (value.source === "gutenberg" ||
    value.source === "standard-ebooks" ||
    value.source === "librivox") &&
  isOptional(value.cover, "string") &&
  isOptional(value.summary, "string");

/** What a store listing is asked for. */
export type StoreAsk =
  | { shelf: "popular" | "standard-ebooks" | "librivox"; page?: number }
  | { query: string; source: BooksStoreSource; page?: number };

/** One chapter of an audiobook; its sound is at the Internet Archive. */
export interface AudiobookChapter {
  title: string;
  url: string;
  seconds: number;
  reader: string;
}

/** An audiobook as LibriVox lists it. */
export interface Audiobook {
  id: string;
  title: string;
  author: string;
  /** The book's page at LibriVox. */
  page: string;
  seconds: number;
  chapters: readonly AudiobookChapter[];
}

const isChapter = (value: unknown): value is AudiobookChapter =>
  isRecord(value) &&
  typeof value.title === "string" &&
  typeof value.url === "string" &&
  isOffset(value.seconds) &&
  typeof value.reader === "string";

/** An audiobook's chapters, which the server asks LibriVox for the first time anyone opens it. */
export async function fetchAudiobook(id: string): Promise<Audiobook> {
  const body = await getJson(`${BOOKS_AUDIOBOOK_URL}${encodeURIComponent(id)}`);
  if (!isRecord(body) || !Array.isArray(body.chapters) || !body.chapters.every(isChapter)) {
    throw new Error("not an audiobook");
  }
  return body as unknown as Audiobook;
}

/** The chapter a place across the whole recording falls in, and how far into it. */
export function chapterAt(
  chapters: readonly Pick<AudiobookChapter, "seconds">[],
  place: number,
): { index: number; offset: number } {
  let before = 0;
  for (const [index, chapter] of chapters.entries()) {
    if (place < before + chapter.seconds) return { index, offset: place - before };
    before += chapter.seconds;
  }
  return { index: Math.max(0, chapters.length - 1), offset: 0 };
}

/** The seconds of the recording before chapter `index`. */
export const secondsBefore = (
  chapters: readonly Pick<AudiobookChapter, "seconds">[],
  index: number,
) => chapters.slice(0, index).reduce((sum, chapter) => sum + chapter.seconds, 0);

/** The longest search the module takes, in characters. */
export const MAX_QUERY = 100;

/** The address of a store listing. */
export function storeUrl(ask: StoreAsk): string {
  const params = new URLSearchParams();
  if ("shelf" in ask) params.set("shelf", ask.shelf);
  else {
    params.set("q", [...ask.query.trim().replace(/\s+/g, " ")].slice(0, MAX_QUERY).join(""));
    params.set("source", ask.source);
  }
  if (ask.page && ask.page > 1) params.set("page", String(ask.page));
  return `${BOOKS_STORE_URL}?${params}`;
}

/** A shelf or a search of the Book Store. */
export async function fetchStore(ask: StoreAsk): Promise<StoreListing> {
  const body = await getJson(storeUrl(ask));
  if (!isRecord(body) || !Array.isArray(body.books)) throw new Error("not a store listing");
  return { books: body.books.filter(isStoreBook), more: body.more === true };
}

const isIndex = (value: unknown): value is BookIndex =>
  isRecord(value) &&
  typeof value.id === "string" &&
  Array.isArray(value.parts) &&
  value.parts.every(isOffset) &&
  typeof value.complete === "boolean" &&
  isOffset(value.start);

const textUrl = (book: string, part?: number) =>
  `${BOOKS_TEXT_URL}${encodeURIComponent(book)}${part === undefined ? "" : `/${part}`}`;

/** A book's index, which fetches the book from its source the first time anyone opens it. */
export async function fetchIndex(book: string): Promise<BookIndex> {
  const body = await getJson(textUrl(book));
  if (!isIndex(body)) throw new Error("not a book's index");
  return {
    ...body,
    source: (body.source ?? "gutenberg") as BooksStoreSource,
    credit: typeof body.credit === "string" ? body.credit : "",
    licence: typeof body.licence === "string" ? body.licence : "",
    link: typeof body.link === "string" ? body.link : "",
    truncated: body.truncated === true,
    changed: body.changed === true,
    toc: Array.isArray(body.toc)
      ? body.toc.filter(
          (heading): heading is BookHeading =>
            isRecord(heading) && typeof heading.title === "string" && isOffset(heading.at),
        )
      : [],
  };
}

/** One part of a book's text, with the lengths of the parts known now. */
export async function fetchPart(
  book: string,
  part: number,
): Promise<{ text: string; parts: number[]; complete: boolean; truncated: boolean }> {
  const body = await getJson(textUrl(book, part));
  // A length that is not an offset would move every later part's offsets if it were dropped.
  if (
    !isRecord(body) ||
    typeof body.text !== "string" ||
    !Array.isArray(body.parts) ||
    !body.parts.every(isOffset)
  ) {
    throw new Error("not a part of a book");
  }
  return {
    text: body.text,
    parts: body.parts,
    complete: body.complete === true,
    truncated: body.truncated === true,
  };
}

const picturesUrl = (book: string) => `${BOOKS_PICTURES_URL}${encodeURIComponent(book)}`;

const isPictureEntry = (value: unknown): value is Omit<EpubPicture, "n"> =>
  isRecord(value) &&
  isOffset(value.at) &&
  typeof value.path === "string" &&
  typeof value.type === "string";

/**
 * The pictures of a book of the store, placed in its text. The server reads a round of the source
 * at a time, so this asks until the list is complete, or until `live()` says nobody is waiting. A
 * book the server cannot read has none.
 */
export async function fetchPictures(book: string, live: () => boolean): Promise<EpubPicture[]> {
  while (live()) {
    let body: unknown;
    try {
      body = await getJson(picturesUrl(book));
    } catch (error) {
      if (error instanceof BooksRequestError && error.status === 404) return [];
      throw error;
    }
    if (!isRecord(body) || !Array.isArray(body.pictures) || !body.pictures.every(isPictureEntry)) {
      throw new Error("not a list of a book's pictures");
    }
    if (body.complete === true) {
      return body.pictures.map((picture: EpubPicture, n: number) => ({ ...picture, n }));
    }
  }
  return [];
}

/** The file of a picture `fetchPictures` listed. */
export async function fetchPictureFile(book: string, picture: EpubPicture): Promise<Blob> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(`${picturesUrl(book)}/${picture.n}`, {
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) {
      throw new BooksRequestError(`Picture ${picture.path} is not available`, response.status);
    }
    return response.blob();
  });
}

/** A library book for a book of the store. */
export function ownedFromStore(book: StoreBook, now: number): OwnedBook {
  return {
    id: book.id,
    title: cut(book.title, BOOKS_LIMITS.title) || "Untitled",
    author: cut(book.author, BOOKS_LIMITS.title),
    source: book.source,
    added: now,
    ...(book.cover ? { cover: book.cover } : {}),
  };
}

/** The name a source goes by in the window (the Categories row groups books by it). */
export const SOURCE_NAMES: Record<BooksSource, string> = {
  gutenberg: "Project Gutenberg",
  "standard-ebooks": "Standard Ebooks",
  librivox: "LibriVox",
  epub: "Your EPUB files",
  pdf: "Your PDF files",
};

// ---------------------------------------------------------------------------
// The ratings and reviews of this desktop
// ---------------------------------------------------------------------------

/** One review of a book, written by someone of this desktop; only `mine` says whose. */
export interface BookReview {
  stars: number;
  text: string;
  at: number;
  mine: boolean;
}

/** What this desktop's people think of a book. `average` is `null` before anyone has rated it. */
export interface BookReviews {
  reviews: BookReview[];
  average: number | null;
}

const isReview = (value: unknown): value is BookReview =>
  isRecord(value) &&
  typeof value.stars === "number" &&
  typeof value.text === "string" &&
  typeof value.at === "number" &&
  typeof value.mine === "boolean";

function reviewsFromReply(body: unknown): BookReviews {
  if (!isRecord(body) || !Array.isArray(body.reviews)) throw new Error("not a book's reviews");
  return {
    reviews: body.reviews.filter(isReview),
    average: typeof body.average === "number" ? body.average : null,
  };
}

const reviewsUrl = (book: string) => `/api/books/reviews/${encodeURIComponent(book)}`;

export const fetchReviews = async (book: string): Promise<BookReviews> =>
  reviewsFromReply(await getJson(reviewsUrl(book)));

async function changeReviews(book: string, init: RequestInit): Promise<BookReviews> {
  const { status, body } = await withDeadline(async (signal) => {
    const response = await sessionFetch(reviewsUrl(book), {
      credentials: "same-origin",
      ...init,
      signal,
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  });
  if (status < 200 || status >= 300) {
    const message = isRecord(body) && typeof body.error === "string" ? body.error : "";
    throw new BooksRequestError(message || `HTTP ${status}`, status);
  }
  return reviewsFromReply(body);
}

/** Writes the person's own review of a book, over the one they wrote before. */
export const saveReview = (book: string, stars: number, text: string) =>
  changeReviews(book, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stars, text: cut(text, BOOKS_LIMITS.note) }),
  });

/** Removes the person's own review of a book. */
export const removeReview = (book: string) => changeReviews(book, { method: "DELETE" });
