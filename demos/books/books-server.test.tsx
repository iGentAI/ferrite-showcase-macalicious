import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { serverDocument } from "../desktop/desktop-server";
import { Books } from "./books";
import { BOOKS_SETTINGS } from "./books-appearance";
import { BooksTextReader } from "./books-reader";
import {
  BOOKS_LIBRARY_URL,
  type BooksHighlight,
  type BooksLibraryState,
  booksLibraryFromServer,
  booksLibraryReadable,
  booksLibrarySize,
  booksLibraryToServer,
  type OwnedBook,
  readingFromServer,
  readingReadable,
  readingSize,
  readingToServer,
  storeUrl,
} from "./books-server";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  forgetDesktopValues();
  beginDesktopValues();
});

/*
 * The tests stand a small fake of the Books module's routes (`ferrite-apps/desktop/src/apps/
 * books`) in for `fetch`: it keeps the library and the reading documents it is sent, and answers
 * the store and the texts from the fixtures below. The module itself is tested in Rust
 * (`tests/photo_booth_books_podcasts.rs`); these tests are about the window.
 */
interface BookFixture {
  /** The whole text, known from the start. */
  text?: string;
  /**
   * Or the text in parts, as a book still being fetched from its source: the index knows the
   * first part only, and each part asked for makes it known, with the ones before it, to the
   * index too.
   */
  parts?: string[];
  start?: number;
  /** The server kept only the start of a book longer than it keeps. */
  truncated?: boolean;
  /** Every part after the first is answered 404 although the index is not complete. */
  gone?: boolean;
  /** The part lengths the server announces, when they are not the parts' own. */
  announce?: number[];
  /** The part lengths a part's reply announces, when they are not the index's. */
  partLengths?: unknown[];
  toc?: { title: string; at: number }[];
}
interface Fixtures {
  library?: unknown;
  readings?: Record<string, unknown>;
  texts?: Record<string, BookFixture>;
  store?: Record<string, unknown>;
  /** How many times a store request, by its query ("shelf=popular&page=2"), fails first. */
  storeFailures?: Record<string, number>;
  /** Every reading save is refused, as when 500 other books already have a reading. */
  refuseReadings?: boolean;
}

function serve(fixtures: Fixtures) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  // How many parts of each book given in parts the fake has made known.
  const fetched: Record<string, number> = {};
  const kept = {
    library: fixtures.library ?? null,
    readings: { ...fixtures.readings } as Record<string, unknown>,
  };
  const reply = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const [path = "", query = ""] = url.split("?");
    const sent = init?.body ? JSON.parse(String(init.body)) : null;
    if (path === BOOKS_LIBRARY_URL) {
      if (method === "PUT") {
        kept.library = sent.library;
        return reply(200, { library: sent.library, rev: sent.rev + 1 });
      }
      return reply(200, { library: kept.library, rev: 1 });
    }
    if (path.startsWith("/api/books/reading/")) {
      const id = decodeURIComponent(path.slice("/api/books/reading/".length));
      if (method === "PUT") {
        if (fixtures.refuseReadings) {
          return reply(400, { error: "places and notes are kept for at most 500 books" });
        }
        kept.readings[id] = sent.reading;
        return reply(200, { reading: sent.reading, rev: sent.rev + 1 });
      }
      return reply(200, { reading: kept.readings[id] ?? null, rev: 1 });
    }
    if (path === "/api/books/store") {
      const failures = fixtures.storeFailures ?? {};
      if ((failures[query] ?? 0) > 0) {
        failures[query] = (failures[query] ?? 0) - 1;
        return reply(500, { error: "the catalogue did not answer" });
      }
      const params = new URLSearchParams(query);
      const page = params.get("page");
      const key = params.get("shelf") ?? `${params.get("source")}:${params.get("q")}`;
      const listing = (page && fixtures.store?.[`${key}#${page}`]) ?? fixtures.store?.[key];
      return reply(200, listing ?? { books: [], more: false });
    }
    if (path.startsWith("/api/books/text/")) {
      const [id = "", part] = path.slice("/api/books/text/".length).split("/");
      const book = fixtures.texts?.[decodeURIComponent(id)];
      if (!book) return reply(404, { error: "no such book" });
      const pieces = book.parts ?? [book.text ?? ""];
      const lengths = book.announce ?? pieces.map((piece) => piece.length);
      const bookId = decodeURIComponent(id);
      if (part === undefined) {
        const known = book.parts ? (fetched[bookId] ?? 1) : pieces.length;
        return reply(200, {
          id,
          source: "gutenberg",
          credit: "Project Gutenberg",
          licence: "Public domain in the USA.",
          link: "https://www.gutenberg.org/ebooks/11",
          parts: lengths.slice(0, known),
          complete: known === pieces.length,
          truncated: (book.truncated ?? false) && known === pieces.length,
          start: book.start ?? 0,
          toc: book.toc ?? [],
        });
      }
      const n = Number(part);
      if (n >= pieces.length || (book.gone && n > 0)) {
        return reply(404, { error: "the book has no such part" });
      }
      const known = book.parts ? Math.max(fetched[bookId] ?? 1, n + 1) : pieces.length;
      fetched[bookId] = known;
      return reply(200, {
        part: n,
        text: pieces[n],
        parts: book.partLengths ?? lengths.slice(0, known),
        complete: known === pieces.length,
        truncated: (book.truncated ?? false) && known === pieces.length,
      });
    }
    return reply(404, { error: "not found" });
  });
  vi.stubGlobal("fetch", fetch);
  const saves = (prefix: string) =>
    fetch.mock.calls
      .filter(([url, init]) => init?.method === "PUT" && String(url).startsWith(prefix))
      .map(([, init]) => JSON.parse(String(init?.body)));
  return { fetch, kept, saves };
}

const frame = () => screen.getByRole("region", { name: "Books" });
const covers = () =>
  within(frame())
    .queryAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "")
    .filter((label) => label.includes(", "));

const ALICE: OwnedBook = {
  id: "pg-11",
  title: "Alice's Adventures in Wonderland",
  author: "Lewis Carroll",
  source: "gutenberg",
  added: 1_760_000_000_000,
  cover: "https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg",
};
const HEADER =
  "The Project Gutenberg eBook of Alice's Adventures in Wonderland\n\n*** START OF THE PROJECT GUTENBERG EBOOK ALICE ***\n\n";
const WORDS = Array.from({ length: 700 }, (_, n) => `word${n}`).join(" ");
const ALICE_TEXT = `${HEADER}CHAPTER I.\n\n${WORDS}`;
const libraryWith = (...books: unknown[]) => ({
  collections: [],
  pages: {},
  marks: {},
  sort: "recent",
  books,
});

describe("several covers", () => {
  const book = (id: string, title: string, added: number) => ({
    ...ALICE,
    id,
    title,
    added,
    cover: undefined,
  });
  const pressed = () =>
    within(frame())
      .queryAllByRole("button")
      .filter((button) => button.dataset.book && button.getAttribute("aria-pressed") === "true")
      .map((button) => button.dataset.book);

  it("selects with Command and a range with Shift, from the last cover clicked without it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ library: libraryWith(book("a", "A", 3), book("b", "B", 2), book("c", "C", 1)) });
    render(<Books />);
    const cover = async (id: string) => {
      await waitFor(() => expect(covers()).toHaveLength(3));
      return within(frame())
        .getAllByRole("button")
        .find((button) => button.dataset.book === id) as HTMLElement;
    };
    fireEvent.click(await cover("a"), { detail: 1 });
    expect(pressed()).toEqual(["a"]);
    fireEvent.click(await cover("c"), { detail: 1, metaKey: true });
    expect(pressed()).toEqual(["a", "c"]);
    fireEvent.click(await cover("b"), { detail: 1, shiftKey: true });
    expect(pressed()).toEqual(["b", "c"]);
    fireEvent.click(await cover("a"), { detail: 1, shiftKey: true });
    expect(pressed()).toEqual(["a", "b", "c"]);
    fireEvent.click(await cover("b"), { detail: 1 });
    expect(pressed()).toEqual(["b"]);
  });
  it("a Shift-click follows the order of the covers as they are grouped", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({
      library: {
        ...libraryWith(
          { ...book("a", "A", 3), author: "Zed" },
          { ...book("b", "B", 2), author: "Amy" },
          { ...book("c", "C", 1), author: "Zed" },
        ),
      },
    });
    render(<Books defaultSection="authors" />);
    await waitFor(() => expect(covers()).toHaveLength(3));
    const cover = (id: string) =>
      within(frame())
        .getAllByRole("button")
        .find((button) => button.dataset.book === id) as HTMLElement;
    const order = within(frame())
      .getAllByRole("button")
      .map((button) => button.dataset.book)
      .filter(Boolean);
    fireEvent.click(cover(order[0] as string), { detail: 1 });
    fireEvent.click(cover(order[1] as string), { detail: 1, shiftKey: true });
    expect(pressed()).toEqual(order.slice(0, 2));
  });

  it("goes with the row it was made on, and a name's Command-Delete leaves the books", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({
      library: {
        ...libraryWith(book("a", "A", 3), book("b", "B", 2)),
        collections: [{ id: "collection-1", name: "Mine", books: [] }],
      },
    });
    render(<Books />);
    await waitFor(() => expect(covers()).toHaveLength(2));
    const first = within(frame())
      .getAllByRole("button")
      .find((button) => button.dataset.book === "a") as HTMLElement;
    fireEvent.click(first, { detail: 1 });
    expect(pressed()).toEqual(["a"]);
    const row = within(frame()).getByRole("treeitem", { name: "Mine" });
    fireEvent.doubleClick(row);
    const name = await within(frame()).findByRole("textbox", { name: "Collection name" });
    name.focus();
    fireEvent.keyDown(name, { key: "Backspace", code: "Backspace", metaKey: true });
    fireEvent.keyDown(name, { key: "Escape" });
    await waitFor(() => expect(covers().length).toBeGreaterThan(0));
    expect(covers()).toHaveLength(2);
    await userEvent
      .setup({ pointerEventsCheck: 0 })
      .click(within(frame()).getByRole("treeitem", { name: /^Finished/ }));
    await waitFor(() => expect(pressed()).toEqual([]));
    expect(covers()).toEqual([]);
  });
});

const reader = (title: string) => screen.getByRole("region", { name: title });
const pageOf = (title: string) => within(reader(title)).getByRole("document");

/** Closes the window and opens it again, so what it shows comes from what the server kept. */
async function reopen() {
  cleanup();
  render(<Books />);
  await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
}

async function openAlice(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
  await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
  await waitFor(() => expect(reader(ALICE.title)).not.toHaveAttribute("aria-busy"));
  await waitFor(() => expect(pageOf(ALICE.title).getAttribute("aria-label")).toMatch(/^Page 1 of/));
}

describe("Books on the desktop's Ferrite application", () => {
  it("reads only documents in the module's shape, and sends only what it keeps", () => {
    const old: BooksLibraryState = {
      collections: [],
      pages: { "aqua-and-bondi": 2 },
      marks: {},
      sort: "title",
    };
    expect(booksLibraryReadable({ library: null, rev: 0 })).toBe(true);
    expect(booksLibraryReadable({ library: old })).toBe(true);
    expect(booksLibraryReadable({ library: libraryWith(ALICE) })).toBe(true);
    expect(booksLibraryReadable({ library: libraryWith({ ...ALICE, source: "amazon" }) })).toBe(
      false,
    );
    expect(booksLibraryReadable({ library: { ...old, sort: "colour" } })).toBe(false);
    expect(booksLibraryFromServer({ library: old })).toEqual(old);
    // A library with no books is sent as a library saved before the store was.
    expect(booksLibraryToServer({ ...old, books: [] }).library).toEqual(old);
    expect(
      booksLibraryToServer({ ...old, books: [{ ...ALICE, extra: 1 } as OwnedBook] }).library.books,
    ).toEqual([ALICE]);

    expect(readingReadable({ reading: null })).toBe(true);
    expect(readingFromServer({ reading: null })).toEqual({
      place: 0,
      bookmarks: [],
      highlights: [],
    });
    expect(readingReadable({ reading: { place: -1 } })).toBe(false);
    expect(
      readingToServer({
        place: 12.7,
        bookmarks: [
          { at: 30, label: "b" },
          { at: 10, label: "a" },
          { at: 30, label: "again" },
        ],
        highlights: [],
      }).reading,
    ).toEqual({
      place: 12,
      bookmarks: [
        { at: 10, label: "a" },
        { at: 30, label: "b" },
      ],
      highlights: [],
    });
    expect(storeUrl({ query: "  moby   dick ", source: "gutenberg", page: 2 })).toBe(
      "/api/books/store?q=moby+dick&source=gutenberg&page=2",
    );
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Books />);
    expect(fetch).not.toHaveBeenCalled();
    expect(frame()).not.toHaveAttribute("aria-busy");
    // The demo's own books.
    expect(covers()).toContain("Aqua and Bondi, Stephen Hackett");
  });

  it("lists the person's own books, not the demo's, once the library has loaded", async () => {
    serve({ library: libraryWith(ALICE) });
    render(<Books />);
    expect(frame()).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(covers()).toEqual(["Alice's Adventures in Wonderland, Lewis Carroll"]);
    // The cover is the book's own picture, which the browser loads from Project Gutenberg.
    const picture = within(frame())
      .getByRole("button", { name: /^Alice/ })
      .querySelector("img");
    expect(picture?.getAttribute("src")).toBe(ALICE.cover);
  });

  it("offers the Book Store to an empty library, and Get keeps a book in it", async () => {
    const user = userEvent.setup();
    const pride = {
      id: "pg-1342",
      title: "Pride and Prejudice",
      author: "Jane Austen",
      source: "gutenberg",
      cover: "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
    };
    const sowers = {
      id: "se.henry-seton-merriman.the-sowers",
      title: "The Sowers",
      author: "Henry Seton Merriman",
      source: "standard-ebooks",
    };
    const moby = {
      id: "pg-2701",
      title: "Moby Dick",
      author: "Herman Melville",
      source: "gutenberg",
    };
    const { saves, fetch } = serve({
      store: {
        popular: { books: [pride], more: false },
        "standard-ebooks": { books: [sowers], more: false },
        "gutenberg:moby": { books: [moby], more: false },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(within(frame()).getByRole("status")).toHaveTextContent("No Books");
    await user.click(within(frame()).getByRole("button", { name: "Open the Book Store" }));

    const get = await within(frame()).findByRole("button", { name: "Get Pride and Prejudice" });
    expect(within(frame()).getByRole("button", { name: "Get The Sowers" })).toBeVisible();
    await user.click(get);
    await waitFor(() => expect(saves(BOOKS_LIBRARY_URL).at(-1)?.library.books).toHaveLength(1));
    const kept = saves(BOOKS_LIBRARY_URL).at(-1)?.library.books[0];
    expect(kept).toMatchObject({ ...pride });
    expect(typeof kept.added).toBe("number");
    expect(within(frame()).getByRole("button", { name: "Read Pride and Prejudice" })).toBeVisible();
    await reopen();
    // The window comes back on the store it was left on.
    expect(
      await within(frame()).findByRole("button", { name: "Read Pride and Prejudice" }),
    ).toBeVisible();
    await user.click(within(frame()).getByRole("button", { name: "Library", pressed: false }));
    expect(covers()).toEqual(["Pride and Prejudice, Jane Austen"]);
    await user.click(within(frame()).getByRole("button", { name: "Book Store", pressed: false }));
    expect(
      await within(frame()).findByRole("button", { name: "Read Pride and Prejudice" }),
    ).toBeVisible();

    // The toolbar's field searches both catalogues once typing rests.
    await user.type(screen.getByRole("searchbox"), "moby");
    expect(
      await within(frame()).findByRole("button", { name: "Get Moby Dick" }, { timeout: 3000 }),
    ).toBeVisible();
    const asked = fetch.mock.calls.map(([url]) => String(url));
    expect(asked).toContain("/api/books/store?q=moby&source=gutenberg");
    expect(asked).toContain("/api/books/store?q=moby&source=standard-ebooks");
    expect(asked.filter((url) => url.includes("q=m&"))).toEqual([]);
  });

  it("reads the real text a page at a time from where it begins, and keeps the place", async () => {
    const user = userEvent.setup();
    const { saves } = serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
    });
    render(<Books />);
    await openAlice(user);
    const first = pageOf(ALICE.title);
    // The page starts after Project Gutenberg's header, and its credit and licence are shown.
    expect(first.textContent?.startsWith("CHAPTER I.")).toBe(true);
    expect(first.textContent?.length).toBeLessThanOrEqual(1500);
    expect(reader(ALICE.title)).toHaveTextContent("Project Gutenberg · Public domain in the USA.");

    const end = Number(first.dataset.pageEnd);
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Next Page" }));
    await waitFor(() => expect(saves("/api/books/reading/pg-11").at(-1)?.reading.place).toBe(end));
    expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(end));
    expect(pageOf(ALICE.title).getAttribute("aria-label")).toMatch(/^Page 2 of \d+$/);

    // Back, then the arrow keys.
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Previous Page" }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(HEADER.length)));
    fireEvent.keyDown(pageOf(ALICE.title), { key: "ArrowRight" });
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(end)));
    // Shift and an arrow extend a selection; they do not turn the page.
    fireEvent.keyDown(pageOf(ALICE.title), { key: "ArrowLeft", shiftKey: true });
    expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(end));

    await reopen();
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(end)));
  });

  it("tells the reader when the server kept only the start of a very long book", async () => {
    const user = userEvent.setup();
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
    });
    render(<Books />);
    await openAlice(user);
    expect(reader(ALICE.title)).not.toHaveTextContent(/Shortened/);

    cleanup();
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length, truncated: true } },
    });
    render(<Books />);
    await openAlice(user);
    expect(reader(ALICE.title)).toHaveTextContent(
      "Shortened: this book is longer than Books keeps, so its text stops early",
    );
  });

  it("turns the page with the arrow keys from wherever the focus is in the reader", async () => {
    const user = userEvent.setup();
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
    });
    render(<Books />);
    await openAlice(user);
    const first = pageOf(ALICE.title).dataset.pageStart;
    const second = pageOf(ALICE.title).dataset.pageEnd;

    // Just opened, with nothing focused (as WebKit leaves it after a click): the keys turn the
    // page of the key window.
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).not.toBe(first));
    expect(Number(pageOf(ALICE.title).dataset.pageStart)).toBeGreaterThanOrEqual(Number(second));

    // From a button of the bar.
    within(reader(ALICE.title)).getByRole("button", { name: "Bookmarks" }).focus();
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(first));

    // Not from the search field, where the arrows move the caret.
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Search" }));
    const field = await screen.findByRole("searchbox", { name: "Search in the book" });
    await user.type(field, "word{ArrowLeft}");
    expect(pageOf(ALICE.title).dataset.pageStart).toBe(first);
  });

  it("opens a book again at the place, bookmarks and highlights the person keeps", async () => {
    const user = userEvent.setup();
    const place = ALICE_TEXT.indexOf("word300");
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
      readings: {
        "pg-11": {
          place,
          bookmarks: [{ at: place, label: "word300 word301" }],
          highlights: [
            {
              id: "h-1",
              start: place,
              end: place + 7,
              color: "green",
              text: "word300",
              note: "Here",
            },
          ],
        },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(place)));
    const mark = pageOf(ALICE.title).querySelector('[data-highlight="h-1"]');
    expect(mark).toHaveTextContent("word300");
    expect(mark).toHaveAttribute("data-color", "green");
    expect(within(reader(ALICE.title)).getByRole("button", { name: "Bookmarks" })).toHaveAttribute(
      "data-marked",
    );
  });

  it("opens a highlight's menu from the Notes list with the keyboard alone", async () => {
    const user = userEvent.setup();
    const place = ALICE_TEXT.indexOf("word300");
    const { saves } = serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
      readings: {
        "pg-11": {
          place,
          bookmarks: [],
          highlights: [
            { id: "h-1", start: place, end: place + 7, color: "green", text: "word300", note: "" },
          ],
        },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(place)));

    within(reader(ALICE.title)).getByRole("button", { name: "Notes" }).focus();
    await user.keyboard("{Enter}");
    const edit = await screen.findByRole("button", { name: "Edit the highlight “word300”" });
    edit.focus();
    await user.keyboard("{Enter}");

    // The highlight's own menu: its colours, its note, Remove Highlight and Done.
    const blue = await screen.findByRole("button", { name: "Blue" });
    blue.focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(saves("/api/books/reading/pg-11").at(-1)?.reading.highlights[0]?.color).toBe("blue"),
    );
    screen.getByRole("textbox", { name: "Note" }).focus();
    await user.keyboard("Typed{Tab}{Tab}{Enter}");
    await waitFor(() =>
      expect(saves("/api/books/reading/pg-11").at(-1)?.reading.highlights[0]?.note).toBe("Typed"),
    );
    expect(screen.queryByRole("textbox", { name: "Note" })).not.toBeInTheDocument();

    await reopen();
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(place)));
    expect(pageOf(ALICE.title).querySelector('[data-highlight="h-1"]')).toHaveAttribute(
      "data-color",
      "blue",
    );
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Notes" }));
    await user.click(await screen.findByRole("button", { name: "Edit the highlight “word300”" }));
    expect(await screen.findByRole("textbox", { name: "Note" })).toHaveValue("Typed");
    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a bookmark, and a highlight with a note made from a selection", async () => {
    const user = userEvent.setup();
    const { saves } = serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
    });
    render(<Books />);
    await openAlice(user);

    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Bookmarks" }));
    await user.click(await screen.findByRole("menuitem", { name: "Add Bookmark" }));
    await waitFor(() =>
      expect(saves("/api/books/reading/pg-11").at(-1)?.reading.bookmarks).toEqual([
        { at: HEADER.length, label: expect.stringMatching(/^CHAPTER I\. word0 word1/) },
      ]),
    );
    // No page was turned: the place kept is the page shown, where the text begins, so the book
    // opens there again and not at Project Gutenberg's header.
    expect(saves("/api/books/reading/pg-11").at(-1)?.reading.place).toBe(HEADER.length);

    // Select "CHAPTER I." on the page, as a drag of the pointer would.
    const page = pageOf(ALICE.title);
    const words = page.querySelector("span")?.firstChild as Text;
    act(() => {
      const range = document.createRange();
      range.setStart(words, 0);
      range.setEnd(words, "CHAPTER I.".length);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    fireEvent.pointerUp(page);
    await user.click(await screen.findByRole("button", { name: "Add Note" }));
    await user.type(await screen.findByRole("textbox", { name: "Note" }), "The first chapter");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(saves("/api/books/reading/pg-11").at(-1)?.reading.highlights).toEqual([
        {
          id: expect.stringMatching(/^h-/),
          start: HEADER.length,
          end: HEADER.length + "CHAPTER I.".length,
          color: "yellow",
          text: "CHAPTER I.",
          note: "The first chapter",
        },
      ]),
    );
    expect(pageOf(ALICE.title).querySelector("mark")).toHaveTextContent("CHAPTER I.");

    await reopen();
    await openAlice(user);
    expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(HEADER.length));
    expect(pageOf(ALICE.title).querySelector("mark")).toHaveTextContent("CHAPTER I.");
    expect(pageOf(ALICE.title).querySelector("mark")).toHaveAttribute("data-color", "yellow");
    expect(within(reader(ALICE.title)).getByRole("button", { name: "Bookmarks" })).toHaveAttribute(
      "data-marked",
    );
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Notes" }));
    await user.click(
      await screen.findByRole("button", { name: "Edit the highlight “CHAPTER I.”" }),
    );
    expect(await screen.findByRole("textbox", { name: "Note" })).toHaveValue("The first chapter");
    expect(screen.getByRole("button", { name: "Yellow" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a note open with its draft when the reading is too full to save it", async () => {
    const user = userEvent.setup();
    const place = ALICE_TEXT.indexOf("word300");
    const later = ALICE_TEXT.indexOf("word600");
    const mine = { id: "h-1", start: place, end: place + 7, color: "green", text: "word300" };
    // Highlights further on, with long notes, until the reading is a few hundred bytes short of
    // the most one save may send.
    const filler = (n: number, note: string): BooksHighlight => ({
      id: `f-${n}`,
      start: later,
      end: later + 7,
      color: "yellow",
      text: "word600",
      note,
    });
    const highlights: BooksHighlight[] = [{ ...mine, color: "green", note: "Here" }];
    const size = (extra: BooksHighlight[]) =>
      readingSize({ place, bookmarks: [], highlights: [...highlights, ...extra] });
    while (size([filler(highlights.length, "n".repeat(2_000))]) <= 199_500) {
      highlights.push(filler(highlights.length, "n".repeat(2_000)));
    }
    const room = 199_600 - size([filler(highlights.length, "")]);
    highlights.push(filler(highlights.length, "n".repeat(room)));
    expect(200_000 - size([])).toBeGreaterThan(0);
    expect(200_000 - size([])).toBeLessThan(1_000);

    const { saves } = serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
      readings: { "pg-11": { place, bookmarks: [], highlights } },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(place)));
    const mark = pageOf(ALICE.title).querySelector('[data-highlight="h-1"]') as HTMLElement;
    await user.click(mark);
    const note = await screen.findByRole("textbox", { name: "Note" });
    await user.clear(note);
    await user.click(note);
    const draft = "A note longer than the room left. ".repeat(30);
    await user.paste(draft);
    await user.click(screen.getByRole("button", { name: "Done" }));

    // Refused: the notice says why, and the note is still open with everything typed.
    expect(within(reader(ALICE.title)).getByRole("alert")).toHaveTextContent(
      "This book's notes are full",
    );
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue(draft);
    expect(
      saves("/api/books/reading/pg-11").some(
        ({ reading }) => reading.highlights[0]?.note !== "Here",
      ),
    ).toBe(false);

    // A note that fits is kept, and closes.
    await user.clear(screen.getByRole("textbox", { name: "Note" }));
    await user.type(screen.getByRole("textbox", { name: "Note" }), "Short");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(saves("/api/books/reading/pg-11").at(-1)?.reading.highlights[0]?.note).toBe("Short"),
    );
    expect(screen.queryByRole("textbox", { name: "Note" })).not.toBeInTheDocument();
    await reopen();
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(place)));
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Notes" }));
    await user.click(await screen.findByRole("button", { name: "Edit the highlight “word300”" }));
    expect(await screen.findByRole("textbox", { name: "Note" })).toHaveValue("Short");
    expect(screen.getByRole("button", { name: "Green" })).toHaveAttribute("aria-pressed", "true");
  });

  it("refuses a part that does not arrive as long as announced, and offers to try again", async () => {
    const user = userEvent.setup();
    serve({
      library: libraryWith(ALICE),
      texts: {
        "pg-11": { text: ALICE_TEXT, start: HEADER.length, announce: [ALICE_TEXT.length + 3] },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    expect(
      await within(reader(ALICE.title)).findByText(/A part of the book arrived damaged/),
    ).toBeVisible();
    expect(within(reader(ALICE.title)).getByRole("button", { name: "Try Again" })).toBeVisible();
    expect(within(reader(ALICE.title)).queryByRole("document")).toBeNull();
  });

  it("refuses a part whose reply announces a length that is not one, and offers to try again", async () => {
    const user = userEvent.setup();
    const first = `${HEADER}CHAPTER I.\n\n`;
    const second = `CHAPTER II.\n\n${WORDS}`;
    serve({
      library: libraryWith(ALICE),
      texts: {
        "pg-11": {
          parts: [first, second],
          start: HEADER.length,
          partLengths: [first.length, "many", second.length],
        },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    expect(await within(reader(ALICE.title)).findByText(/not a part of a book/)).toBeVisible();
    expect(within(reader(ALICE.title)).getByRole("button", { name: "Try Again" })).toBeVisible();
    expect(within(reader(ALICE.title)).queryByRole("document")).toBeNull();
  });

  it("keeps More Books after a failed page, says why, and gets that page on the next try", async () => {
    const user = userEvent.setup();
    const book = (n: number) => ({
      id: `pg-${n}`,
      title: `Book ${n}`,
      author: "An Author",
      source: "gutenberg",
    });
    const { fetch } = serve({
      store: {
        popular: { books: [book(1)], more: true },
        "popular#2": { books: [book(2)], more: false },
        "standard-ebooks": { books: [], more: false },
      },
      storeFailures: { "shelf=popular&page=2": 1 },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.click(within(frame()).getByRole("button", { name: "Open the Book Store" }));
    await within(frame()).findByRole("button", { name: "Get Book 1" });

    await user.click(within(frame()).getByRole("button", { name: "More Books" }));
    expect(
      await within(frame()).findByText(
        "More books could not be loaded: the catalogue did not answer",
      ),
    ).toBeVisible();
    expect(within(frame()).queryByRole("button", { name: "Get Book 2" })).toBeNull();

    await user.click(within(frame()).getByRole("button", { name: "More Books" }));
    expect(await within(frame()).findByRole("button", { name: "Get Book 2" })).toBeVisible();
    expect(within(frame()).queryByRole("button", { name: "More Books" })).toBeNull();
    expect(within(frame()).queryByText(/could not be loaded/)).toBeNull();
    const pages = fetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith("/api/books/store?shelf=popular"));
    expect(pages).toEqual([
      "/api/books/store?shelf=popular",
      "/api/books/store?shelf=popular&page=2",
      "/api/books/store?shelf=popular&page=2",
    ]);
  });

  it.each([
    { name: "empty", books: [] },
    { name: "filtered", books: [{ id: "pg-1", title: "Missing the author and source" }] },
  ])("keeps pagination through $name catalogue pages until books arrive", async ({ books }) => {
    const user = userEvent.setup();
    const { fetch } = serve({
      store: {
        popular: { books, more: true },
        "popular#2": { books: [], more: true },
        "popular#3": {
          books: [{ id: "pg-11", title: "Alice", author: "Lewis Carroll", source: "gutenberg" }],
          more: false,
        },
        "standard-ebooks": { books: [], more: false },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.click(within(frame()).getByRole("button", { name: "Open the Book Store" }));
    const more = await within(frame()).findByRole("button", { name: "More Books" });
    await user.click(more);
    await waitFor(() => expect(more).toBeEnabled());
    await user.click(more);
    expect(await within(frame()).findByRole("button", { name: "Get Alice" })).toBeVisible();
    expect(within(frame()).queryByRole("button", { name: "More Books" })).toBeNull();
    expect(
      fetch.mock.calls.map(([url]) => url).filter((url) => url.includes("shelf=popular")),
    ).toEqual([
      "/api/books/store?shelf=popular",
      "/api/books/store?shelf=popular&page=2",
      "/api/books/store?shelf=popular&page=3",
    ]);
  });

  it("opens a saved place or a bookmark inside a character at that character", async () => {
    const user = userEvent.setup();
    const text = `${HEADER}CHAPTER I.\n\n\u{1F600} ${WORDS}`;
    const face = text.indexOf("\u{1F600}");
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text, start: HEADER.length } },
      readings: {
        "pg-11": {
          place: face + 1,
          bookmarks: [{ at: face + 1, label: "Inside the face" }],
          highlights: [],
        },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(face)));
    expect(pageOf(ALICE.title).textContent?.startsWith("\u{1F600} word0")).toBe(true);

    // Away, then back through the bookmark.
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Next Page" }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).not.toBe(String(face)));
    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Bookmarks" }));
    await user.click(await screen.findByRole("menuitem", { name: "Inside the face" }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(face)));
    expect(pageOf(ALICE.title).textContent?.startsWith("\u{1F600}")).toBe(true);
  });

  it("opens the last paragraph when the place kept is past the end of the book", async () => {
    const user = userEvent.setup();
    // A last paragraph longer than one look back (20,000 characters).
    const long = Array.from({ length: 4_000 }, (_, n) => `word${n}`).join(" ");
    const text = `${HEADER}CHAPTER I.\n\n${long}`;
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text, start: HEADER.length } },
      readings: { "pg-11": { place: text.length + 500, bookmarks: [], highlights: [] } },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() =>
      expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(text.indexOf("word0"))),
    );
    expect(pageOf(ALICE.title).textContent?.startsWith("word0 word1")).toBe(true);
  });

  it("says the book could not be opened when its source stops before its end", async () => {
    const user = userEvent.setup();
    serve({
      library: libraryWith(ALICE),
      texts: {
        "pg-11": {
          parts: [`${HEADER}CHAPTER I.\n\n`, "CHAPTER II."],
          start: HEADER.length,
          gone: true,
        },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    expect(
      await within(reader(ALICE.title)).findByText(/Books could not open this book/),
    ).toBeVisible();
    expect(within(reader(ALICE.title)).queryByRole("document")).toBeNull();
  });

  it("goes to a bookmark in the last part of a shortened book", async () => {
    const user = userEvent.setup();
    // A first part longer than the window reads ahead; the server keeps no more of this book
    // than these two parts.
    const many = Array.from({ length: 5_000 }, (_, n) => `word${n}`).join(" ");
    const first = `${HEADER}CHAPTER I.\n\n${many}\n\n`;
    const pool = first.length + "CHAPTER II.\n\n".length;
    serve({
      library: libraryWith(ALICE),
      texts: {
        "pg-11": {
          parts: [first, "CHAPTER II.\n\nThe Pool of Tears.\n\n"],
          start: HEADER.length,
          truncated: true,
        },
      },
      readings: {
        "pg-11": {
          place: HEADER.length,
          bookmarks: [{ at: pool, label: "The Pool of Tears." }],
          highlights: [],
        },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(HEADER.length)));
    // The whole text was got before the book was shown, so it is known to be shortened.
    expect(reader(ALICE.title)).toHaveTextContent(
      "Shortened: this book is longer than Books keeps, so its text stops early",
    );

    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Bookmarks" }));
    await user.click(await screen.findByRole("menuitem", { name: "The Pool of Tears." }));
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).toBe(String(pool)));
    expect(pageOf(ALICE.title).textContent?.startsWith("The Pool of Tears.")).toBe(true);
  });

  it("gets the whole book from its source before showing it, and searches all of it", async () => {
    const user = userEvent.setup();
    // The server keeps only the first part until the next ones are asked for.
    const many = Array.from({ length: 5_000 }, (_, n) => `word${n}`).join(" ");
    const { fetch } = serve({
      library: libraryWith(ALICE),
      texts: {
        "pg-11": {
          parts: [
            `${HEADER}CHAPTER I.\n\n${many}\n\n`,
            "CHAPTER II.\n\nThe Pool of Tears.\n\n",
            "CHAPTER III.\n\nThey all crowded round the pool.",
          ],
          start: HEADER.length,
        },
      },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    // Shown once complete, with its page count.
    await waitFor(() =>
      expect(pageOf(ALICE.title).getAttribute("aria-label")).toMatch(/^Page 1 of \d+$/),
    );
    const asked = () => fetch.mock.calls.map(([url]) => String(url));
    expect(asked()).toEqual(
      expect.arrayContaining(["/api/books/text/pg-11/1", "/api/books/text/pg-11/2"]),
    );

    await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Search" }));
    await user.type(screen.getByRole("searchbox", { name: "Search in the book" }), "pool{Enter}");
    const results = await screen.findByRole("list", { name: "Results" });
    expect(
      within(results)
        .getAllByRole("button")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("The Pool of Tears."),
      expect.stringContaining("crowded round the pool."),
    ]);
  });

  it("gives a real book's window the window props the page gives the book window", async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
    });
    render(
      <Books
        readerProps={{
          onMinimize,
          onDragRegionPointerDown,
          onDragRegionDoubleClick,
          zoomDisabled: true,
          className: "hosted",
        }}
      />,
    );
    await openAlice(user);
    const window = reader(ALICE.title);
    expect(window).toHaveClass("hosted");
    expect(within(window).getByRole("button", { name: "Enter Full Screen" })).toBeDisabled();
    await user.click(within(window).getByRole("button", { name: "Minimize" }));
    expect(onMinimize).toHaveBeenCalledTimes(1);

    // The window manager that hosts it moves it from its title bar, and zooms it on a double-click
    // there; a press on a button of the bar is not a drag.
    const bar = window.querySelector("[data-title-bar]") as HTMLElement;
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(within(window).getByRole("button", { name: "Library" }), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });

  it("says so when the server refuses to keep the place and notes", async () => {
    const user = userEvent.setup();
    // A book of its own: the page's channel to a document outlives a test, and the refused body
    // stays its newest unsaved one.
    const refused: OwnedBook = { ...ALICE, id: "pg-13", title: "The Refused Book" };
    serve({
      library: libraryWith(refused),
      texts: { "pg-13": { text: ALICE_TEXT, start: HEADER.length } },
      refuseReadings: true,
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.dblClick(within(frame()).getByRole("button", { name: /^The Refused Book/ }));
    await waitFor(() =>
      expect(pageOf(refused.title).dataset.pageStart).toBe(String(HEADER.length)),
    );
    await user.click(within(reader(refused.title)).getByRole("button", { name: "Next Page" }));
    expect(await within(reader(refused.title)).findByRole("alert")).toHaveTextContent(
      "Books could not keep your place and notes in this book (HTTP 400)",
    );
  });

  describe("New Collection and what the module keeps", () => {
    /** A library with one book and a collection whose long name leaves `room` bytes. */
    const leaving = (room: number) => {
      const library = (length: number) => ({
        ...libraryWith(ALICE),
        collections: [{ id: "collection-1", name: "n".repeat(length), books: [] }],
      });
      const others = booksLibrarySize(library(0) as BooksLibraryState);
      return library(200_000 - others - room);
    };
    const add = async (user: ReturnType<typeof userEvent.setup>) => {
      await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
      await user.click(within(frame()).getByRole("button", { name: "New Collection" }));
    };
    /** Longer than a save of the library waits after a change. */
    const pastSave = () => new Promise((resolve) => setTimeout(resolve, 1_200));

    it("refuses a collection past the library's byte limit, and sends nothing", async () => {
      const user = userEvent.setup();
      const { saves, kept } = serve({ library: leaving(30) });
      const before = kept.library;
      render(<Books />);
      await add(user);
      expect(within(frame()).getByRole("alert")).toHaveTextContent(
        "Your library is full: remove a book or a collection to add another.",
      );
      expect(within(frame()).queryByText("Untitled Collection")).toBeNull();
      await pastSave();
      expect(saves(BOOKS_LIBRARY_URL)).toEqual([]);
      expect(kept.library).toBe(before);
    });

    it("keeps a collection that still fits", async () => {
      const user = userEvent.setup();
      const { saves } = serve({ library: leaving(300) });
      render(<Books />);
      await add(user);
      expect(within(frame()).queryByRole("alert")).toBeNull();
      await waitFor(() =>
        expect(saves(BOOKS_LIBRARY_URL).at(-1)?.library.collections.at(-1)).toEqual({
          id: "collection-2",
          name: "Untitled Collection",
          books: [],
        }),
      );
    });

    it("refuses the collection after the hundredth the module keeps", async () => {
      const user = userEvent.setup();
      const collections = Array.from({ length: 100 }, (_, n) => ({
        id: `collection-${n + 1}`,
        name: `Shelf ${n + 1}`,
        books: [],
      }));
      const { saves } = serve({ library: { ...libraryWith(ALICE), collections } });
      render(<Books />);
      await add(user);
      expect(within(frame()).getByRole("alert")).toHaveTextContent("Your library is full");
      await pastSave();
      expect(saves(BOOKS_LIBRARY_URL)).toEqual([]);
    });
  });

  describe("the book's look, keys and menus", () => {
    const WITH_CHAPTERS = {
      text: ALICE_TEXT,
      start: HEADER.length,
      toc: [
        { title: "CHAPTER I.", at: HEADER.length },
        { title: "CHAPTER II.", at: HEADER.length + 3_000 },
      ],
    };
    const body = () => pageOf(ALICE.title).closest(".mac-books-text-body") as HTMLElement;
    const reset = () => {
      for (const key of Object.values(BOOKS_SETTINGS)) changeDesktopValue(key, undefined);
    };
    /** The menu bar's menu `title` of the application, as the desktop shows it. */
    function BarMenu({ title }: { title: string }) {
      const items = useDesktopAppMenuItems("books", title);
      return (
        <Menu>
          <MenuTrigger>{`Bar ${title}`}</MenuTrigger>
          <MenuPopup>{items}</MenuPopup>
        </Menu>
      );
    }
    const showBar = () =>
      render(
        <>
          <Books />
          <BarMenu title="Controls" />
          <BarMenu title="View" />
          <BarMenu title="File" />
        </>,
      );
    const choose = async (
      user: ReturnType<typeof userEvent.setup>,
      title: string,
      item: string,
    ) => {
      await user.click(screen.getByRole("button", { name: `Bar ${title}` }));
      await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${item}`) }));
    };
    afterEach(reset);

    it("keeps the theme, the face and the size as the person's values, and shows them", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_CHAPTERS } });
      render(<Books />);
      await openAlice(user);
      expect(body().hasAttribute("data-books-theme")).toBe(false);
      expect(body().getAttribute("data-books-face")).toBe("original");
      await user.click(within(reader(ALICE.title)).getByRole("button", { name: "Appearance" }));
      await user.click(await screen.findByRole("button", { name: "Sepia" }));
      await user.click(screen.getByRole("button", { name: "Georgia" }));
      await user.click(screen.getByRole("button", { name: "Larger Text" }));
      expect(body().getAttribute("data-books-theme")).toBe("sepia");
      expect(body().getAttribute("data-books-face")).toBe("georgia");
      expect(body().style.getPropertyValue("--mac-books-text-size")).toBe("19px");
      expect(screen.getByRole("button", { name: "Sepia" })).toHaveAttribute("aria-pressed", "true");
      expect(desktopValues()).toMatchObject({
        "books.theme": "sepia",
        "books.textFace": "georgia",
        "books.textSize": 19,
      });
    });

    it("ignores a stored look it does not know", async () => {
      const user = userEvent.setup();
      changeDesktopValue(BOOKS_SETTINGS.theme, "neon");
      changeDesktopValue(BOOKS_SETTINGS.size, 400);
      serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_CHAPTERS } });
      render(<Books />);
      await openAlice(user);
      expect(body().hasAttribute("data-books-theme")).toBe(false);
      expect(body().style.getPropertyValue("--mac-books-text-size")).toBe("17px");
    });

    it("steps the size from the keys, stops at the ends, and goes back to the usual size", async () => {
      const user = userEvent.setup();
      serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_CHAPTERS } });
      render(<Books />);
      await openAlice(user);
      const size = () => body().style.getPropertyValue("--mac-books-text-size");
      fireEvent.keyDown(document.body, { key: "=", ctrlKey: true });
      expect(size()).toBe("19px");
      fireEvent.keyDown(document.body, { key: "0", ctrlKey: true });
      expect(size()).toBe("17px");
      for (let n = 0; n < 5; n += 1) fireEvent.keyDown(document.body, { key: "-", ctrlKey: true });
      expect(size()).toBe("13px");
    });

    it("bookmarks and goes to the library from their keys, not while a field has the keyboard", async () => {
      const user = userEvent.setup();
      const { saves } = serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_CHAPTERS } });
      render(<Books />);
      await openAlice(user);
      fireEvent.keyDown(document.body, { key: "d", ctrlKey: true });
      await waitFor(() =>
        expect(saves("/api/books/reading/pg-11").at(-1)?.reading.bookmarks).toHaveLength(1),
      );
      expect(saves("/api/books/reading/pg-11").at(-1)?.reading.bookmarks[0].at).toBe(HEADER.length);

      const search = within(reader(ALICE.title)).getByRole("button", { name: "Search" });
      await user.click(search);
      const field = await screen.findByRole("searchbox", { name: "Search in the book" });
      fireEvent.keyDown(field, { key: "l", ctrlKey: true, shiftKey: true });
      expect(reader(ALICE.title)).toBeInTheDocument();
      await user.keyboard("{Escape}");
      fireEvent.keyDown(document.body, { key: "L", ctrlKey: true, shiftKey: true });
      await waitFor(() => expect(screen.queryByRole("region", { name: ALICE.title })).toBeNull());
    });

    it("goes by chapter and by bookmark from the Controls menu, and to a numbered page", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      serve({
        library: libraryWith(ALICE),
        readings: {
          "pg-11": { place: HEADER.length, bookmarks: [{ at: 2_000, label: "a mark" }] },
        },
        texts: { "pg-11": WITH_CHAPTERS },
      });
      showBar();
      await openAlice(user);
      const start = () => pageOf(ALICE.title).dataset.pageStart;
      await choose(user, "Controls", "Next Chapter");
      await waitFor(() => expect(start()).toBe(String(HEADER.length + 3_000)));
      await choose(user, "Controls", "Previous Chapter");
      await waitFor(() => expect(start()).toBe(String(HEADER.length)));
      await choose(user, "Controls", "Next Bookmark");
      await waitFor(() => expect(start()).toBe("2000"));
      await choose(user, "Controls", "Previous Chapter");
      await waitFor(() => expect(start()).toBe(String(HEADER.length)));

      await choose(user, "Controls", "Go to Page");
      const number = await screen.findByRole("textbox", { name: "Page number" });
      await user.type(number, "2{Enter}");
      await waitFor(() =>
        expect(pageOf(ALICE.title).getAttribute("aria-label")).toMatch(/^Page 2 of /),
      );
    });

    it("makes a highlight from the selection with its key, on a Mac", async () => {
      const user = userEvent.setup();
      const apple = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
      try {
        const { saves } = serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_CHAPTERS } });
        render(<Books />);
        await openAlice(user);
        const words = pageOf(ALICE.title).querySelector("span")?.firstChild as Text;
        const range = document.createRange();
        range.setStart(words, 0);
        range.setEnd(words, 7);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        fireEvent.keyDown(document.body, { key: "h", ctrlKey: true, metaKey: true });
        await waitFor(() =>
          expect(saves("/api/books/reading/pg-11").at(-1)?.reading.highlights).toEqual([
            expect.objectContaining({
              start: HEADER.length,
              end: HEADER.length + 7,
              color: "yellow",
              text: "CHAPTER",
            }),
          ]),
        );
      } finally {
        apple.mockRestore();
      }
    });

    it("makes a collection and opens the cover last chosen from the File menu", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const { saves } = serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_CHAPTERS } });
      showBar();
      await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
      await choose(user, "File", "New Collection");
      await waitFor(() =>
        expect(saves(BOOKS_LIBRARY_URL).at(-1)?.library.collections[0].name).toBe(
          "Untitled Collection",
        ),
      );
      await user.click(within(frame()).getByRole("treeitem", { name: /^All Books/ }));
      await user.click(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
      await choose(user, "File", "Open Book");
      await waitFor(() => expect(reader(ALICE.title)).toBeInTheDocument());
    });

    it("hides the sidebar and sets the sort from the View menu, and saves the sort", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const { saves } = serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_CHAPTERS } });
      showBar();
      await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
      await choose(user, "View", "Hide Sidebar");
      await waitFor(() =>
        expect(within(frame()).queryByRole("tree", { name: "Library" })).toBeNull(),
      );
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Bar View" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Sort By" }));
      fireEvent.click(await screen.findByRole("menuitemradio", { name: "Author" }));
      await waitFor(() => expect(saves(BOOKS_LIBRARY_URL).at(-1)?.library.sort).toBe("author"));
    });
  });

  it("offers no way to add an EPUB file", async () => {
    serve({ library: libraryWith(ALICE) });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(within(frame()).queryByLabelText(/EPUB/)).toBeNull();
    expect(within(frame()).queryByRole("button", { name: /EPUB/ })).toBeNull();
    expect(within(frame()).queryByRole("menuitem", { name: /EPUB/ })).toBeNull();
  });

  it("turns only the key reader's page, wherever the focus was left", async () => {
    const user = userEvent.setup();
    const other: OwnedBook = { ...ALICE, id: "pg-12", title: "Through the Looking-Glass" };
    serve({
      library: libraryWith(ALICE, other),
      texts: {
        "pg-11": { text: ALICE_TEXT, start: HEADER.length },
        "pg-12": { text: ALICE_TEXT, start: HEADER.length },
      },
    });
    render(
      <>
        <div data-window-state="inactive">
          <BooksTextReader book={other} />
        </div>
        <BooksTextReader book={ALICE} />
      </>,
    );
    for (const title of [ALICE.title, other.title]) {
      await waitFor(() => expect(pageOf(title).getAttribute("aria-label")).toMatch(/^Page 1 of/));
    }
    const key = pageOf(ALICE.title).dataset.pageStart;
    const behind = pageOf(other.title).dataset.pageStart;
    // The focus is left on a button of the reader that is no longer the key window.
    within(reader(other.title)).getByRole("button", { name: "Bookmarks" }).focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(pageOf(ALICE.title).dataset.pageStart).not.toBe(key));
    expect(pageOf(other.title).dataset.pageStart).toBe(behind);
  });

  it("turns no page of a reader that is inert", async () => {
    const user = userEvent.setup();
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: ALICE_TEXT, start: HEADER.length } },
    });
    render(<BooksTextReader book={ALICE} inert />);
    await waitFor(() =>
      expect(pageOf(ALICE.title).getAttribute("aria-label")).toMatch(/^Page 1 of/),
    );
    const start = pageOf(ALICE.title).dataset.pageStart;
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard("{ArrowRight}");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pageOf(ALICE.title).dataset.pageStart).toBe(start);
  });

  it("preserves an unreadable library after save scheduling and reopening, but saves a readable one", async () => {
    const { kept, saves } = serve({ library: { pages: "many" } });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(within(frame()).getByRole("button", { name: "New Collection" }));
    expect(within(frame()).getByRole("treeitem", { name: "Untitled Collection" })).toBeVisible();
    await act(async () => {
      await vi.runAllTimersAsync();
      await serverDocument(BOOKS_LIBRARY_URL).idle();
    });
    vi.useRealTimers();
    await reopen();
    expect(kept.library).toEqual({ pages: "many" });
    expect(within(frame()).queryByRole("treeitem", { name: "Untitled Collection" })).toBeNull();
    expect(saves(BOOKS_LIBRARY_URL)).toEqual([]);

    kept.library = libraryWith();
    await reopen();
    await userEvent.setup().click(within(frame()).getByRole("button", { name: "New Collection" }));
    await act(() => serverDocument(BOOKS_LIBRARY_URL).idle());
    await reopen();
    expect(within(frame()).getByRole("treeitem", { name: "Untitled Collection" })).toBeVisible();
    expect(saves(BOOKS_LIBRARY_URL).at(-1)?.library.collections).toEqual([
      { id: "collection-1", name: "Untitled Collection", books: [] },
    ]);
  });
});

describe("the rows of the served desktop's menus", () => {
  const STORE_ALICE = {
    id: "pg-11",
    title: ALICE.title,
    author: "Lewis Carroll",
    source: "gutenberg",
    summary: "A girl follows a rabbit.",
  };
  const STORE_EMMA = {
    id: "se.jane-austen.emma",
    title: "Emma",
    author: "Jane Austen",
    source: "standard-ebooks",
  };
  function BarMenu({ title }: { title: string }) {
    const items = useDesktopAppMenuItems("books", title);
    return (
      <Menu>
        <MenuTrigger>{`Bar ${title}`}</MenuTrigger>
        <MenuPopup>{items}</MenuPopup>
      </Menu>
    );
  }
  const showBar = () =>
    render(
      <>
        <Books />
        {["File", "Edit", "View", "Controls", "Store"].map((title) => (
          <BarMenu key={title} title={title} />
        ))}
      </>,
    );
  const openBar = async (user: ReturnType<typeof userEvent.setup>, title: string) =>
    user.click(screen.getByRole("button", { name: `Bar ${title}` }));
  const row = (name: string) => screen.findByRole("menuitem", { name: new RegExp(`^${name}`) });
  const radio = (name: string) =>
    screen.findByRole("menuitemradio", { name: new RegExp(`^${name}`) });
  const body = () => pageOf(ALICE.title).closest(".mac-books-text-body") as HTMLElement;
  const selectWords = (count: number) => {
    const leaf = pageOf(ALICE.title).querySelector("span")?.firstChild as Text;
    const start = leaf.data.indexOf("word0");
    const range = document.createRange();
    range.setStart(leaf, start);
    range.setEnd(leaf, start + count);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.pointerUp(pageOf(ALICE.title), { button: 0 });
  };
  const WITH_START = { text: ALICE_TEXT, start: HEADER.length };
  const LONG_TEXT = `${HEADER}${Array.from({ length: 12_000 }, (_, n) => `word${n}`).join(" ")}`;
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.getSelection()?.removeAllRanges();
    changeDesktopValue(BOOKS_SETTINGS.pageLayout, undefined);
    document.querySelector("iframe[data-textedit-print]")?.remove();
  });

  it("lays a book out on one page, two pages or a view that scrolls, and keeps the choice", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: LONG_TEXT, start: HEADER.length } },
    });
    showBar();
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await openBar(user, "View");
    expect(await radio("Two Pages")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await openAlice(user);
    expect(body().getAttribute("data-books-layout")).toBe("single");
    const onePage = pageOf(ALICE.title).textContent?.length ?? 0;
    expect(onePage).toBeLessThanOrEqual(1_500);

    await openBar(user, "View");
    await user.click(await radio("Two Pages"));
    expect(body().getAttribute("data-books-layout")).toBe("two");
    expect(desktopValues()).toMatchObject({ "books.pageLayout": "two" });

    await openBar(user, "View");
    await user.click(await radio("Scroll"));
    expect(body().getAttribute("data-books-layout")).toBe("scroll");
    // The view holds far more than a page, and has no page buttons.
    await waitFor(() =>
      expect(pageOf(ALICE.title).textContent?.length ?? 0).toBeGreaterThan(10 * 1_500),
    );
    expect(pageOf(ALICE.title).textContent).toMatch(/^word0 word1 /);
    expect(within(reader(ALICE.title)).queryByRole("button", { name: "Next Page" })).toBeNull();

    await openBar(user, "View");
    await user.click(await radio("Single Page"));
    expect(body().getAttribute("data-books-layout")).toBe("single");
    await waitFor(() =>
      expect(pageOf(ALICE.title).textContent?.length ?? 0).toBeLessThanOrEqual(1_500),
    );
    expect(within(reader(ALICE.title)).getByRole("button", { name: "Next Page" })).toBeVisible();
  });

  it("keeps the place a view that scrolls has reached", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { kept } = serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: LONG_TEXT, start: HEADER.length } },
    });
    changeDesktopValue(BOOKS_SETTINGS.pageLayout, "scroll");
    render(<Books />);
    await openAlice(user);
    const view = pageOf(ALICE.title);
    const shown = view.textContent ?? "";
    Object.defineProperty(view, "scrollHeight", { configurable: true, value: 10_000 });
    view.scrollTop = 5_000;
    fireEvent.scroll(view);
    await waitFor(() => {
      const place = (kept.readings["pg-11"] as { place: number } | undefined)?.place;
      expect(place).toBe(HEADER.length + Math.round(0.5 * shown.length));
    });
  });

  it("undoes and redoes highlights and bookmarks, with Cut, Paste and Delete dimmed for a reason", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const { kept } = serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_START } });
    showBar();
    await openAlice(user);
    const highlights = () =>
      (kept.readings["pg-11"] as { highlights: { text: string }[] } | undefined)?.highlights.map(
        (highlight) => highlight.text,
      );
    await openBar(user, "Edit");
    expect(await row("Undo")).toHaveAttribute("aria-disabled", "true");
    for (const name of ["Cut", "Paste", "Delete"]) {
      expect(await row(name)).toHaveAttribute("aria-disabled", "true");
      expect(await row(name)).toHaveAttribute("data-reason", "A book's text cannot be changed.");
    }
    await user.keyboard("{Escape}");

    selectWords(5);
    fireEvent.keyDown(document.body, { key: "h", ctrlKey: true, metaKey: true });
    await waitFor(() => expect(highlights()).toEqual(["word0"]));

    await openBar(user, "Edit");
    await user.click(await row("Undo"));
    await waitFor(() => expect(highlights()).toEqual([]));
    await openBar(user, "Edit");
    expect(await row("Redo")).not.toHaveAttribute("aria-disabled", "true");
    await user.click(await row("Redo"));
    await waitFor(() => expect(highlights()).toEqual(["word0"]));
  });

  it("shares a book's page with Mail, Messages and Notes, and says why Reveal in Finder cannot", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_START } });
    showBar();
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await openBar(user, "File");
    expect(await row("Share Book")).toHaveAttribute("aria-disabled", "true");
    expect(await row("Reveal in Finder")).toHaveAttribute(
      "data-reason",
      expect.stringContaining("not on your drive"),
    );
    expect(await row("Print")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");

    await user.click(within(frame()).getByRole("button", { name: /^Alice's Adventures/ }));
    const heard: unknown[] = [];
    const hear = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener("macalicious:share-link", hear);
    await openBar(user, "File");
    await user.click(await row("Share Book"));
    const notes = await row("Notes");
    expect(notes).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(notes);
    await waitFor(() =>
      expect(heard).toEqual([
        {
          url: "https://www.gutenberg.org/ebooks/11",
          title: ALICE.title,
          from: "books",
          to: "notes",
        },
      ]),
    );
    window.removeEventListener("macalicious:share-link", hear);
  });

  it("prints the page shown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_START } });
    showBar();
    await openAlice(user);
    await openBar(user, "File");
    await user.click(await row("Print"));
    const frameOfPrint = document.querySelector<HTMLIFrameElement>("iframe[data-textedit-print]");
    expect(frameOfPrint?.srcdoc).toContain("word0 word1");
    expect(frameOfPrint?.srcdoc).toContain(ALICE.title);
  });

  it("searches the web for the words selected, and shares them as a quote", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve({ library: libraryWith(ALICE), texts: { "pg-11": WITH_START } });
    showBar();
    await openAlice(user);
    selectWords(5);
    const opened: { url: string }[] = [];
    const shared: { title: string; url: string; to: string }[] = [];
    const hearOpen = (event: Event) => opened.push((event as CustomEvent).detail);
    const hearShare = (event: Event) => shared.push((event as CustomEvent).detail);
    window.addEventListener("macalicious:open-url", hearOpen);
    window.addEventListener("macalicious:share-link", hearShare);
    await openBar(user, "Edit");
    await user.click(await row("Search with Google"));
    await openBar(user, "Edit");
    await user.click(await row("Search Wikipedia"));
    expect(opened.map(({ url }) => url)).toEqual([
      "https://www.google.com/search?q=word0",
      "https://en.wikipedia.org/wiki/Special:Search?search=word0",
    ]);
    fireEvent.contextMenu(pageOf(ALICE.title));
    const menu = await screen.findByRole("menu", { name: "Page" });
    await user.click(within(menu).getByRole("menuitem", { name: /^Share/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mail" }));
    await waitFor(() =>
      expect(shared).toMatchObject([
        {
          to: "mail",
          url: "https://www.gutenberg.org/ebooks/11",
          title: `“word0”, ${ALICE.title}`,
        },
      ]),
    );
    window.removeEventListener("macalicious:open-url", hearOpen);
    window.removeEventListener("macalicious:share-link", hearShare);
  });

  it("says New on a cover until it is opened, then how far it is read", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { kept, saves } = serve({
      library: libraryWith(ALICE),
      texts: { "pg-11": { text: LONG_TEXT, start: HEADER.length } },
    });
    render(<Books />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    const coverOf = () => within(frame()).getByRole("button", { name: /^Alice's Adventures/ });
    expect(coverOf().textContent).toContain("New");
    await openAlice(user);
    expect(coverOf().textContent).not.toContain("New");
    expect(coverOf().textContent).toContain("1%");
    const next = within(reader(ALICE.title)).getByRole("button", { name: "Next Page" });
    for (let turn = 0; turn < 12; turn += 1) await user.click(next);
    await waitFor(() =>
      expect((kept.readings["pg-11"] as { place: number }).place).toBeGreaterThan(12_000),
    );
    const percent = Math.floor(
      ((kept.readings["pg-11"] as { place: number }).place / LONG_TEXT.length) * 100,
    );
    await act(() => serverDocument(BOOKS_LIBRARY_URL).idle());
    expect(saves(BOOKS_LIBRARY_URL).at(-1)?.library.pages).toEqual({ "pg-11": percent });
    await reopen();
    expect(coverOf().textContent).toContain(`${percent}%`);
  });

  it("orders the library by dragging a cover under Sort By > Manually", async () => {
    const named = (id: string, title: string, added: number) => ({
      ...ALICE,
      id,
      title,
      added,
      cover: undefined,
    });
    const { saves } = serve({
      library: {
        ...libraryWith(
          named("pg-1", "A, one", 3),
          named("pg-2", "B, two", 2),
          named("pg-3", "C", 1),
        ),
        sort: "manual",
      },
    });
    render(<Books />);
    await waitFor(() => expect(covers()).toHaveLength(3));
    const cover = (id: string) =>
      within(frame())
        .getAllByRole("button")
        .find((button) => button.dataset.book === id) as HTMLElement;
    const dataTransfer = { setData: () => {}, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(cover("pg-3"), { dataTransfer });
    fireEvent.dragOver(cover("pg-1"), { dataTransfer });
    expect(cover("pg-1")).toHaveAttribute("data-books-drop");
    fireEvent.drop(cover("pg-1"), { dataTransfer });
    await waitFor(() =>
      expect(
        within(frame())
          .getAllByRole("button")
          .flatMap((button) => button.dataset.book ?? []),
      ).toEqual(["pg-3", "pg-1", "pg-2"]),
    );
    await act(() => serverDocument(BOOKS_LIBRARY_URL).idle());
    expect(
      saves(BOOKS_LIBRARY_URL)
        .at(-1)
        ?.library.books.map((book: OwnedBook) => book.id),
    ).toEqual(["pg-3", "pg-1", "pg-2"]);
  });

  it("opens Top Charts, Featured, a book's page and its author's from the Store", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { fetch } = serve({
      library: libraryWith(),
      store: {
        popular: { books: [STORE_ALICE], more: false },
        "standard-ebooks": { books: [STORE_EMMA], more: false },
        "gutenberg:Lewis Carroll": { books: [STORE_ALICE], more: false },
      },
    });
    showBar();
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await openBar(user, "Store");
    for (const name of ["Sign In", "View My Account"]) {
      expect(await row(name)).toHaveAttribute(
        "data-reason",
        expect.stringContaining("your desktop account"),
      );
    }
    await user.click(await row("Top Charts"));
    expect(
      await within(frame()).findByRole("button", { name: `Get ${ALICE.title}` }),
    ).toBeVisible();
    expect(within(frame()).getByText("Top Charts: Most Downloaded")).toBeVisible();
    expect(within(frame()).queryByRole("button", { name: "Get Emma" })).toBeNull();

    await openBar(user, "Store");
    await user.click(await row("Featured"));
    expect(await within(frame()).findByRole("button", { name: "Get Emma" })).toBeVisible();
    expect(within(frame()).queryByRole("button", { name: `Get ${ALICE.title}` })).toBeNull();

    await user.click(within(frame()).getByRole("button", { name: "‹ Book Store" }));
    await user.click(await within(frame()).findByRole("button", { name: `Show ${ALICE.title}` }));
    const page = await within(frame()).findByRole("article", { name: ALICE.title });
    expect(within(page).getByText("A girl follows a rabbit.")).toBeVisible();
    expect(within(page).getByText("From Project Gutenberg")).toBeVisible();
    await user.click(within(page).getByRole("button", { name: `Get ${ALICE.title}` }));
    expect(await within(page).findByRole("button", { name: `Read ${ALICE.title}` })).toBeVisible();

    await user.click(within(page).getByRole("button", { name: "Lewis Carroll" }));
    expect(await within(frame()).findByText("Lewis Carroll at Project Gutenberg")).toBeVisible();
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes("q=Lewis+Carroll&source=gutenberg")),
    ).toBe(true);

    await openBar(user, "Store");
    await user.click(await row("Authors"));
    expect(within(frame()).getByRole("treeitem", { name: "Authors" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("offers Get, Copy Link and Share on a store item's menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    serve({
      library: libraryWith(),
      store: { popular: { books: [STORE_ALICE], more: false } },
    });
    showBar();
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await openBar(user, "Store");
    await user.click(await row("Book Store"));
    const get = await within(frame()).findByRole("button", { name: `Get ${ALICE.title}` });
    fireEvent.contextMenu(get);
    const menu = await screen.findByRole("menu", { name: ALICE.title });
    expect(within(menu).getByRole("menuitem", { name: /^Share/ })).toBeVisible();
    await user.click(within(menu).getByRole("menuitem", { name: "Copy Link" }));
    expect(writeText).toHaveBeenCalledWith("https://www.gutenberg.org/ebooks/11");
    fireEvent.contextMenu(get);
    await user.click(
      within(await screen.findByRole("menu", { name: ALICE.title })).getByRole("menuitem", {
        name: "Get",
      }),
    );
    expect(
      await within(frame()).findByRole("button", { name: `Read ${ALICE.title}` }),
    ).toBeVisible();
  });
});
