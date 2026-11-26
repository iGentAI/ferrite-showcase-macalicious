/*
 * The demo's library and the two store pages. One book is the reference captures' (its title
 * and author are read from the cover and the book window's title, reference/spec/apps/books.md);
 * every other title, author and category is invented for the demo, and so is every number of
 * pages. Nothing is fetched and nothing depends on the clock: `added` is a plain rank.
 */

/** What an item of the library is: Books keeps books, audiobooks and PDF documents. */
export type BooksKind = "book" | "audiobook" | "pdf";

export interface BooksBook {
  /** Identifies the book. Unique within the library. */
  id: string;
  title: string;
  author: string;
  /** The category the Categories row groups it under. */
  category: string;
  kind: BooksKind;
  /** When it joined the library: a higher number is more recent. */
  added: number;
  /** How many pages the book window turns through; the demo's books are a few pages long. */
  pages: number;
}

/** The rows of the sidebar's Library section. */
export type BooksSection = "all" | "books" | "audiobooks" | "pdfs" | "authors" | "categories";

/** The three segments of the toolbar's control. */
export type BooksView = "library" | "book-store" | "audiobook-store";

/** The orders the Sort By menu offers. */
export type BooksSort = "recent" | "title" | "author" | "manual";

/** A collection the user made: a row under Collections. New collections are empty. */
export interface BooksCollection {
  id: string;
  name: string;
  /** The `id`s of the books in it. */
  books: readonly string[];
}

export const SECTIONS: readonly { id: BooksSection; name: string }[] = [
  { id: "all", name: "All Books" },
  { id: "books", name: "Books" },
  { id: "audiobooks", name: "Audiobooks" },
  { id: "pdfs", name: "PDFs" },
  { id: "authors", name: "Authors" },
  { id: "categories", name: "Categories" },
];

export const VIEWS: readonly { id: BooksView; name: string }[] = [
  { id: "library", name: "Library" },
  { id: "book-store", name: "Book Store" },
  { id: "audiobook-store", name: "Audiobook Store" },
];

export const SORTS: readonly { id: BooksSort; name: string }[] = [
  { id: "recent", name: "Most Recent" },
  { id: "title", name: "Title" },
  { id: "author", name: "Author" },
  { id: "manual", name: "Manually" },
];

/** The one book of the reference captures. Three pages: the captures show three thumbnails. */
export const capturedBook: BooksBook = {
  id: "aqua-and-bondi",
  title: "Aqua and Bondi",
  author: "Stephen Hackett",
  category: "Computers",
  kind: "book",
  added: 9,
  pages: 3,
};

/** The library of the captures: that one book. */
export const capturedBooks: readonly BooksBook[] = [capturedBook];

const invented = (
  id: string,
  title: string,
  author: string,
  category: string,
  kind: BooksKind,
  added: number,
  pages: number,
): BooksBook => ({ id, title, author, category, kind, added, pages });

/** The demo's library: the captures' book, then eight invented ones in a manual order. */
export const defaultBooks: readonly BooksBook[] = [
  capturedBook,
  invented("field-guide", "A Field Guide to Small Things", "Author One", "Nature", "book", 8, 4),
  invented("second-novel", "The Second Novel", "Author Two", "Fiction", "book", 3, 3),
  invented("long-walk", "Notes on a Long Walk", "Author Three", "Travel", "audiobook", 7, 2),
  invented("handbook", "The Handbook", "Author One", "Reference", "pdf", 6, 4),
  invented("first-novel", "The First Novel", "Author Two", "Fiction", "book", 1, 3),
  invented("short-stories", "Collected Short Stories", "Author Four", "Fiction", "audiobook", 5, 2),
  invented("quarterly-report", "Quarterly Report", "Author Five", "Reference", "pdf", 2, 2),
  invented("garden-year", "A Year in the Garden", "Author Three", "Nature", "book", 4, 4),
];

const KINDS: Partial<Record<BooksSection, BooksKind>> = {
  books: "book",
  audiobooks: "audiobook",
  pdfs: "pdf",
};

/** The reading lists of the served desktop's Library section, each kept as a collection. */
export const WANT_TO_READ = { id: "want-to-read", name: "Want to Read" } as const;
export const FINISHED = { id: "finished", name: "Finished" } as const;
export const READING_LISTS: readonly { id: string; name: string }[] = [WANT_TO_READ, FINISHED];
/** My Samples, a row of the sidebar, and the books the person hid, which have none. */
export const MY_SAMPLES = { id: "my-samples", name: "My Samples" } as const;
export const HIDDEN = { id: "hidden", name: "Hidden" } as const;
export const KEPT_LISTS: readonly { id: string; name: string }[] = [
  ...READING_LISTS,
  MY_SAMPLES,
  HIDDEN,
];
export const isReadingList = (id: string) => KEPT_LISTS.some((list) => list.id === id);
/** The Series row of the served desktop's Library section. */
export const SERIES = { id: "series", name: "Series" } as const;

/*
 * Neither source says which series a book belongs to. What they do say is in the title: the
 * volumes of a work name it and their number ("The Works of Lord Byron, Vol. 3", "Ruth Fielding,
 * Book 2"). A title that says neither is in no series.
 */
const VOLUME =
  /^(.+?)[\s,:;.\u2014-]+(?:\(?(?:vol(?:ume|\.)?|book|part|tome)\s+)(\d+|[ivxlc]+)\b.*$/i;
const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

const numberOfVolume = (text: string): number => {
  if (/^\d+$/.test(text)) return Number(text);
  const values = [...text.toLowerCase()].map((letter) => ROMAN[letter] ?? 0);
  return values.reduce(
    (sum, value, index) => sum + (value < (values[index + 1] ?? 0) ? -value : value),
    0,
  );
};

/** The series a title names, and which volume of it the book is. */
export function seriesOf(title: string): { series: string; volume: number } | null {
  const found = VOLUME.exec(title.trim());
  if (!found?.[1] || !found[2]) return null;
  return { series: found[1].trim(), volume: numberOfVolume(found[2]) };
}

/** The books under one heading per series, in the order of their volumes; others are left out. */
export function groupSeries(books: readonly BooksBook[]): { title: string; books: BooksBook[] }[] {
  const groups = new Map<string, { title: string; books: { book: BooksBook; volume: number }[] }>();
  for (const book of books) {
    const named = seriesOf(book.title);
    if (!named) continue;
    const key = named.series.toLowerCase();
    const group = groups.get(key) ?? { title: named.series, books: [] };
    group.books.push({ book, volume: named.volume });
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => byText(a.title, b.title))
    .map(({ title, books: list }) => ({
      title,
      books: list.sort((a, b) => a.volume - b.volume).map(({ book }) => book),
    }));
}

/** The books a sidebar row lists: a row of the Library section, or a collection's own. */
export function booksIn(
  books: readonly BooksBook[],
  section: string,
  collections: readonly BooksCollection[] = [],
): BooksBook[] {
  const collection = collections.find((candidate) => candidate.id === section);
  if (collection) return books.filter((book) => collection.books.includes(book.id));
  if (isReadingList(section)) return [];
  const kind = KINDS[section as BooksSection];
  return kind ? books.filter((book) => book.kind === kind) : [...books];
}

/**
 * Where a sample of a book's text ends: a tenth of the text after where it begins, and never less
 * than a few pages' worth or more than the text. Project Gutenberg and Standard Ebooks offer no
 * samples of their own, so a sample is the start of the book.
 */
export const SAMPLE_MIN = 20_000;
export function sampleEnd(start: number, length: number): number {
  return Math.min(length, start + Math.max(SAMPLE_MIN, Math.ceil((length - start) / 10)));
}

const byText = (a: string, b: string) => a.localeCompare(b, "en");

/** The books in the order of a Sort By choice. Manually is the order they were given in. */
export function sortBooks(books: readonly BooksBook[], sort: BooksSort): BooksBook[] {
  const sorted = [...books];
  if (sort === "recent") sorted.sort((a, b) => b.added - a.added);
  else if (sort === "title") sorted.sort((a, b) => byText(a.title, b.title));
  else if (sort === "author") {
    sorted.sort((a, b) => byText(a.author, b.author) || byText(a.title, b.title));
  }
  return sorted;
}

/**
 * The list with `moving` taken out and put back, in the list's order, before `before`. Sort By >
 * Manually shows the library in this order. Nothing changes when `before` is one of those moving.
 */
export function moveBooks<T extends { id: string }>(
  all: readonly T[],
  moving: readonly string[],
  before: string,
): readonly T[] {
  if (moving.includes(before) || !all.some((book) => book.id === before)) return all;
  const going = all.filter((book) => moving.includes(book.id));
  const staying = all.filter((book) => !moving.includes(book.id));
  const at = staying.findIndex((book) => book.id === before);
  return [...staying.slice(0, at), ...going, ...staying.slice(at)];
}

/** Whether a title or an author contains the search text, whatever its case. */
export function bookMatches(book: { title: string; author: string }, query: string): boolean {
  const text = query.trim().toLowerCase();
  return (
    text === "" ||
    book.title.toLowerCase().includes(text) ||
    book.author.toLowerCase().includes(text)
  );
}

/** The books under one heading per author or per category, the headings in alphabetical order. */
export function groupBooks(
  books: readonly BooksBook[],
  by: "author" | "category",
): { title: string; books: BooksBook[] }[] {
  const groups = new Map<string, BooksBook[]>();
  for (const book of books) groups.set(book[by], [...(groups.get(book[by]) ?? []), book]);
  return [...groups]
    .sort(([a], [b]) => byText(a, b))
    .map(([title, list]) => ({ title, books: list }));
}

/** The name a new collection gets: Untitled Collection, then Untitled Collection 2 and so on. */
export function collectionName(existing: readonly BooksCollection[]): string {
  const names = new Set(existing.map((collection) => collection.name));
  let name = "Untitled Collection";
  for (let count = 2; names.has(name); count++) name = `Untitled Collection ${count}`;
  return name;
}

/** One shelf of a store page: a heading and the cards under it. */
export interface BooksShelf {
  title: string;
  items: readonly { id: string; title: string; author: string }[];
}

const shelf = (title: string, prefix: string, authors: readonly string[]): BooksShelf => ({
  title,
  items: authors.map((author, index) => ({
    id: `${prefix}-${index + 1}`,
    title: `${title} ${index + 1}`,
    author,
  })),
});

const WRITERS = ["Author Six", "Author Seven", "Author Eight", "Author Nine", "Author Ten"];

/** The Book Store page. No capture shows a store: the shelves are placeholders. */
export const BOOK_STORE: readonly BooksShelf[] = [
  shelf("New Release", "new", WRITERS),
  shelf("Top Book", "top", [...WRITERS].reverse()),
];

/** The Audiobook Store page, as provisional as the Book Store. */
export const AUDIOBOOK_STORE: readonly BooksShelf[] = [
  shelf("New Audiobook", "heard", WRITERS.slice(1)),
  shelf("Popular Audiobook", "popular", WRITERS.slice(0, 4)),
];
