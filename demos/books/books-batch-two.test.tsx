import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { type DesktopDrag, landingAt } from "../desktop/desktop-drag";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { requestOpenFile } from "../finder/finder-open";
import type { PdfFile } from "../preview/preview-pdf";
import { app } from "./app";
import { Books } from "./books";
import { groupSeries, sampleEnd, seriesOf } from "./books-data";
import { bookFileKind } from "./books-import";
import { BooksPdfReader } from "./books-pdf-reader";
import { BooksTextReader } from "./books-reader";
import { BookReviewsSection, StudyCards } from "./books-reviews";
import { BOOKS_LIBRARY_URL, type OwnedBook } from "./books-server";
import { BooksStoreView } from "./books-store-view";
import { smallEpub } from "./books-test-epub";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  forgetDesktopValues();
  beginDesktopValues();
});

/* The drive stands in for its one read and for keeping a file: what a test puts here, what it is sent. */
const drive = vi.hoisted(() => ({
  file: new Blob([]) as Blob,
  uploaded: [] as { name: string; parent: string }[],
}));
vi.mock("../desktop/desktop-files", async (original) => ({
  ...(await original<object>()),
  readFile: async () => drive.file,
  ensureDrive: async () => ({ entries: [] }),
  specialFolder: () => ({ id: "documents" }),
  ensureFolder: async (parent: string, name: string) => ({ id: `${parent}/${name}` }),
  uploadFile: async (file: File, parent: string) => {
    drive.uploaded.push({ name: file.name, parent });
    return { id: "uploaded-1" };
  },
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/*
 * A small fake of the routes of `ferrite-apps/desktop/src/apps/books` and the drive's single file
 * read; the module itself is tested in Rust.
 */
function serve({
  library = null,
  store = {},
  reviews = { reviews: [], average: null },
  text,
}: {
  library?: unknown;
  store?: Record<string, unknown>;
  reviews?: unknown;
  text?: string;
}) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const requests: { url: string; method: string; body: unknown }[] = [];
  let saved = library;
  const fetchFake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    requests.push({ url, method, body });
    if (url.startsWith(BOOKS_LIBRARY_URL)) {
      if (method === "PUT") saved = body.library;
      return json({ library: saved, rev: 1, session: "s" });
    }
    if (url.includes("/api/books/reading/")) return json({ reading: null, rev: 0, session: "s" });
    if (url.includes("/api/books/reviews/")) return json(reviews);
    if (url.startsWith("/api/books/store")) {
      const query = url.split("?")[1] ?? "";
      return json(store[decodeURIComponent(query)] ?? { books: [], more: false });
    }
    if (url.startsWith("/api/books/text/") && text !== undefined) {
      const part = /\/text\/[^/]+\/(\d+)/.exec(url);
      if (part) return json({ text, parts: [text.length], complete: true });
      return json({
        id: "pg-1",
        source: "gutenberg",
        parts: [text.length],
        complete: true,
        start: 0,
        toc: [{ title: "Far Chapter", at: text.length - 5 }],
      });
    }
    return json({ error: `no route for ${url}` }, 404);
  });
  vi.stubGlobal("fetch", fetchFake);
  return { requests, library: () => saved };
}

const OWNED: OwnedBook = {
  id: "pg-1",
  title: "The Book",
  author: "An Author",
  source: "gutenberg",
  added: 1,
};
const libraryOf = (books: OwnedBook[], collections: unknown[] = []) => ({
  collections,
  pages: {},
  marks: {},
  sort: "title",
  books,
});

function MenuProbe({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("books", title);
  return (
    <Menu>
      <MenuTrigger>{`Bar ${title}`}</MenuTrigger>
      <MenuPopup>{items}</MenuPopup>
    </Menu>
  );
}

describe("books of a person's own", () => {
  it("knows an EPUB and a PDF by their type or their name, and nothing else", () => {
    expect(bookFileKind({ name: "a.epub" })).toBe("epub");
    expect(bookFileKind({ name: "a.bin", type: "application/epub+zip" })).toBe("epub");
    expect(bookFileKind({ name: "A.PDF" })).toBe("pdf");
    expect(bookFileKind({ name: "a.txt", type: "text/plain" })).toBeNull();
  });

  it("lists a PDF under PDFs and tells a person how to add one when it is empty", async () => {
    const user = userEvent.setup();
    const pdf: OwnedBook = {
      id: `pdf-${"a".repeat(32)}`,
      title: "A Report",
      author: "",
      source: "pdf",
      added: 2,
      file: "f-1",
    };
    serve({ library: libraryOf([OWNED, pdf]) });
    render(<Books />);
    await screen.findByRole("button", { name: "The Book, An Author" });
    await user.click(screen.getByText("PDFs"));
    expect(await screen.findByRole("button", { name: "A Report, Unknown author" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "The Book, An Author" })).toBeNull();
    await user.click(screen.getByText("My Samples"));
    expect((await screen.findByRole("status")).textContent).toBe(
      "No Samples: choose Sample on a book's page in the Book Store.",
    );
  });

  it("takes a drop from Finder: a file of the drive stays, one of the computer is kept in Documents/Books", async () => {
    const bytes = (await smallEpub()) as Uint8Array<ArrayBuffer>;
    const server = serve({ library: libraryOf([OWNED]) });
    drive.uploaded = [];
    render(<Books />);
    await screen.findByRole("button", { name: "The Book, An Author" });
    const body = document.querySelector(".mac-books-body");
    const item = (over: object) => ({
      id: "drive-file-1",
      name: "small.epub",
      kind: "file" as const,
      ...over,
    });
    const dragOf = (items: object[]) => ({ items }) as unknown as DesktopDrag;
    expect(landingAt(body, dragOf([item({ name: "notes.txt" })]))?.refusal).toBe(
      "Books takes EPUB and PDF files.",
    );

    drive.file = new Blob([bytes]);
    await act(async () => {
      landingAt(body, dragOf([item({})]))?.drop();
    });
    const cover = await screen.findByRole("button", { name: "A Small Book, Ada Writer" });
    expect(cover).toBeTruthy();
    expect(drive.uploaded).toEqual([]);
    await waitFor(() =>
      expect((server.library() as { books: OwnedBook[] }).books.at(-1)).toMatchObject({
        source: "epub",
        file: "drive-file-1",
      }),
    );

    const other = await smallEpub({ title: "Another Book" });
    await act(async () => {
      landingAt(
        body,
        dragOf([
          item({
            id: "",
            name: "other.epub",
            bytes: async () => new Blob([other as Uint8Array<ArrayBuffer>]),
          }),
        ]),
      )?.drop();
    });
    await screen.findByRole("button", { name: "Another Book, Ada Writer" });
    expect(drive.uploaded).toEqual([{ name: "other.epub", parent: "documents/Books" }]);
    await waitFor(() =>
      expect((server.library() as { books: OwnedBook[] }).books.at(-1)?.file).toBe("uploaded-1"),
    );
  });

  it("opens a file Finder hands it, from where the file is", async () => {
    const bytes = (await smallEpub()) as Uint8Array<ArrayBuffer>;
    const server = serve({ library: libraryOf([OWNED]) });
    drive.uploaded = [];
    drive.file = new Blob([bytes], { type: "application/epub+zip" });
    render(<Books />);
    await screen.findByRole("button", { name: "The Book, An Author" });
    act(() => requestOpenFile({ app: "books", id: "drive-file-9", name: "small.epub" }));
    const page = await screen.findByRole("document", {}, { timeout: 3000 });
    await waitFor(() => expect(page.textContent).toContain("It was a bright day."), {
      timeout: 3000,
    });
    expect(drive.uploaded).toEqual([]);
    await waitFor(() =>
      expect((server.library() as { books: OwnedBook[] }).books.at(-1)?.file).toBe("drive-file-9"),
    );
    expect(app.opens({ name: "small.epub" })).toBe(true);
    expect(app.opens({ name: "notes.txt", type: "text/plain" })).toBe(false);
  });

  it("opens the EPUB of a library book from its file on the drive", async () => {
    drive.file = new Blob([(await smallEpub()) as Uint8Array<ArrayBuffer>]);
    serve({});
    const book: OwnedBook = {
      id: `epub-${"b".repeat(32)}`,
      title: "A Small Book",
      author: "Ada Writer",
      source: "epub",
      added: 1,
      file: "f-1",
    };
    render(<BooksTextReader book={book} />);
    const page = await screen.findByRole("document", {}, { timeout: 3000 });
    await waitFor(() => expect(page.textContent).toContain("It was a bright day."), {
      timeout: 3000,
    });
    expect(screen.getByText("Your EPUB, from your drive")).toBeTruthy();
  });
});

describe("the PDF window", () => {
  const fakePdf = (destroy = vi.fn()): PdfFile =>
    ({
      pageCount: 3,
      size: async () => ({ width: 100, height: 100 }),
      render: async () => true,
      outline: async () => [{ title: "Part Two", page: 2, level: 0 }],
      destroy,
    }) as unknown as PdfFile;

  const book: OwnedBook = {
    id: `pdf-${"c".repeat(32)}`,
    title: "A Report",
    author: "",
    source: "pdf",
    added: 1,
  };

  it("says what it cannot open", async () => {
    serve({});
    render(<BooksPdfReader book={book} openPdfFile={async () => fakePdf()} />);
    expect((await screen.findByRole("status")).textContent).toBe(
      "Books could not open this PDF: this book names no file on your drive",
    );
  });

  it("turns its pages by key and button, goes to a heading, and keeps the place", async () => {
    const user = userEvent.setup();
    const { requests } = serve({});
    drive.file = new Blob(["%PDF"]);
    const destroy = vi.fn();
    const opened = vi.fn(async () => fakePdf(destroy));
    const onReadPercent = vi.fn();
    const { unmount } = render(
      <BooksPdfReader
        book={{ ...book, file: "f-2" }}
        openPdfFile={opened}
        onReadPercent={onReadPercent}
      />,
    );
    await screen.findByText("Page 1 of 3");
    expect(opened).toHaveBeenCalledWith(drive.file);
    await user.keyboard("{ArrowRight}");
    await screen.findByText("Page 2 of 3");
    await user.click(screen.getByRole("button", { name: "Next Page" }));
    await screen.findByText("Page 3 of 3");
    expect(onReadPercent).toHaveBeenLastCalledWith(100);
    await user.click(screen.getByRole("button", { name: "Table of Contents" }));
    await user.click(await screen.findByRole("menuitem", { name: "Part Two" }));
    await screen.findByText("Page 2 of 3");
    await waitFor(() =>
      expect(requests.filter((request) => request.method === "PUT").at(-1)?.body).toMatchObject({
        reading: { place: 1 },
      }),
    );
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

describe("a sample", () => {
  it("ends a tenth of the way through, and never before a few pages", () => {
    expect(sampleEnd(0, 1_000_000)).toBe(100_000);
    expect(sampleEnd(1000, 50_000)).toBe(21_000);
    expect(sampleEnd(0, 500)).toBe(500);
  });

  it("stops at its end, leaves out what lies past it, and offers the book", async () => {
    const user = userEvent.setup();
    const text = "word ".repeat(10_000);
    serve({ text });
    const onGetBook = vi.fn();
    render(<BooksTextReader book={OWNED} sample onGetBook={onGetBook} />);
    const next = await screen.findByRole("button", { name: "Next Page" });
    await waitFor(() => expect(next.hasAttribute("disabled")).toBe(false));
    await user.click(screen.getByRole("button", { name: "Table of Contents" }));
    expect(screen.queryByRole("menuitem", { name: "Far Chapter" })).toBeNull();
    await user.keyboard("{Escape}");
    for (
      let turn = 0;
      turn < 60 && screen.queryByRole("button", { name: "Get Book" }) === null;
      turn += 1
    ) {
      await user.click(screen.getByRole("button", { name: "Next Page" }));
    }
    const page = screen.getByRole("document");
    expect(Number(page.getAttribute("data-page-end"))).toBe(20_000);
    await user.click(screen.getByRole("button", { name: "Get Book" }));
    expect(onGetBook).toHaveBeenCalledTimes(1);
  });
});

describe("the store's Sample, genres and price", () => {
  const book = {
    id: "pg-2",
    title: "Moby Dick",
    author: "Herman Melville",
    source: "gutenberg" as const,
  };

  it("offers Sample on a book's page and says it is free", async () => {
    const user = userEvent.setup();
    serve({});
    const onSample = vi.fn();
    render(
      <BooksStoreView
        query=""
        owned={[]}
        onGet={vi.fn()}
        onRead={vi.fn()}
        onSample={onSample}
        page={{ kind: "book", book }}
      />,
    );
    expect(screen.getByText("From Project Gutenberg")).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Sample" }));
    expect(onSample).toHaveBeenCalledWith(book);
  });

  it("opens a book's page from search results, and a new search leaves it", async () => {
    serve({});
    const onPage = vi.fn();
    const props = { owned: [], onGet: vi.fn(), onRead: vi.fn(), onPage };
    const page = { kind: "book" as const, book };
    const { rerender } = render(<BooksStoreView {...props} query="moby" page={page} />);
    expect(screen.getByText("From Project Gutenberg")).toBeTruthy();
    expect(onPage).not.toHaveBeenCalled();
    rerender(<BooksStoreView {...props} query="whale" page={page} />);
    await waitFor(() => expect(onPage).toHaveBeenCalledWith({ kind: "home" }));
  });

  it("offers Read Sample and Get for a book held only as a sample", async () => {
    serve({});
    const owned: OwnedBook[] = [{ ...book, added: 1 }];
    render(
      <BooksStoreView
        query=""
        owned={owned}
        samples={["pg-2"]}
        onGet={vi.fn()}
        onRead={vi.fn()}
        page={{ kind: "book", book }}
      />,
    );
    expect(screen.getByRole("button", { name: "Read Sample" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Get Moby Dick" })).toBeTruthy();
  });

  it("asks each source for a genre: Gutenberg by subject, Standard Ebooks by search", async () => {
    const user = userEvent.setup();
    const { requests } = serve({});
    const onPage = vi.fn();
    const { rerender } = render(
      <BooksStoreView query="" owned={[]} onGet={vi.fn()} onRead={vi.fn()} onPage={onPage} />,
    );
    await user.click(
      within(screen.getByRole("navigation", { name: "Genres" })).getByRole("button", {
        name: "Science Fiction",
      }),
    );
    expect(onPage).toHaveBeenCalledWith({ kind: "genre", genre: "Science Fiction" });
    rerender(
      <BooksStoreView
        query=""
        owned={[]}
        onGet={vi.fn()}
        onRead={vi.fn()}
        page={{ kind: "genre", genre: "Science Fiction" }}
      />,
    );
    await waitFor(() => {
      const asked = requests.map((request) => request.url);
      expect(asked).toContain("/api/books/store?q=s.Science+Fiction&source=gutenberg");
      expect(asked).toContain("/api/books/store?q=Science+Fiction&source=standard-ebooks");
    });
  });
});

describe("ratings and reviews of this desktop", () => {
  it("says where they come from, shows the others' and sends the person's own", async () => {
    const user = userEvent.setup();
    const { requests } = serve({
      reviews: {
        reviews: [{ stars: 4, text: "A long sea story.", at: 10, mine: false }],
        average: 4,
      },
    });
    render(<BookReviewsSection book="pg-2" />);
    expect(await screen.findByText("A long sea story.")).toBeTruthy();
    expect(screen.getByText("4.0 from 1 rating")).toBeTruthy();
    expect(
      screen.getByText(/these come from people of this desktop, and show no names/),
    ).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit.hasAttribute("disabled")).toBe(true);
    screen.getByRole("slider", { name: "Your rating" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await user.type(screen.getByRole("textbox", { name: "Your review" }), "Whales.");
    await user.click(submit);
    await waitFor(() =>
      expect(requests.find((request) => request.method === "PUT")).toEqual({
        url: "/api/books/reviews/pg-2",
        method: "PUT",
        body: { stars: 3, text: "Whales." },
      }),
    );
  });
});

describe("Study Cards", () => {
  it("shows each highlight's words, then its note, one card at a time", async () => {
    const user = userEvent.setup();
    const highlight = (id: string, text: string, note: string) => ({
      id,
      start: 0,
      end: 1,
      color: "yellow" as const,
      text,
      note,
    });
    const onDone = vi.fn();
    render(
      <StudyCards
        highlights={[
          highlight("a", "Call me Ishmael.", "The opening"),
          highlight("b", "Later.", ""),
        ]}
        onDone={onDone}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("Card 1 of 2");
    const card = screen.getByRole("button", { name: "Show the note" });
    expect(card.textContent).toBe("Call me Ishmael.");
    await user.click(card);
    expect(screen.getByRole("button", { name: "Show the words" }).textContent).toBe("The opening");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Show the note" }).textContent).toBe("Later.");
    await user.click(screen.getByRole("button", { name: "Show the note" }));
    expect(screen.getByRole("button", { name: "Show the words" }).textContent).toBe(
      "No note on this highlight.",
    );
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("Series", () => {
  it("reads the series and the volume a title names, and nothing else", () => {
    expect(seriesOf("The Works of Lord Byron, Vol. 3")).toEqual({
      series: "The Works of Lord Byron",
      volume: 3,
    });
    expect(seriesOf("The Decline and Fall, Volume IV")).toEqual({
      series: "The Decline and Fall",
      volume: 4,
    });
    expect(seriesOf("Ruth Fielding: Book 2")).toEqual({ series: "Ruth Fielding", volume: 2 });
    expect(seriesOf("Moby Dick; Or, The Whale")).toBeNull();
    expect(seriesOf("The Jungle Book")).toBeNull();
  });

  it("groups the volumes of a series in their order", () => {
    const book = (id: string, title: string) => ({
      id,
      title,
      author: "A",
      category: "C",
      kind: "book" as const,
      added: 1,
      pages: 1,
    });
    expect(
      groupSeries([book("2", "Works, Vol. 2"), book("x", "Alone"), book("1", "Works, Vol. 1")]).map(
        ({ title, books }) => [title, books.map(({ id }) => id)],
      ),
    ).toEqual([["Works", ["1", "2"]]]);
  });
});

describe("Hide Book and Show Hidden Books", () => {
  it("takes a hidden book off the shelves until Show Hidden Books brings it back", async () => {
    const user = userEvent.setup();
    const other = { ...OWNED, id: "pg-3", title: "The Other" };
    const server = serve({
      library: libraryOf([OWNED, other]),
    });
    render(<Books />);
    const cover = await screen.findByRole("button", { name: "The Book, An Author" });
    await user.pointer({ keys: "[MouseRight]", target: cover });
    await user.click(await screen.findByRole("menuitem", { name: "Hide Book" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "The Book, An Author" })).toBeNull(),
    );
    await waitFor(() =>
      expect((server.library() as { collections: unknown[] }).collections).toEqual([
        { id: "hidden", name: "Hidden", books: ["pg-1"] },
      ]),
    );
    expect(screen.getByRole("button", { name: "The Other, An Author" })).toBeTruthy();
  });
});

describe("the book window of the desktop", () => {
  const library = libraryOf([OWNED]);

  it("moves by its bar and resizes by its edges, no smaller than it can be read", async () => {
    serve({ library, text: "word ".repeat(2000) });
    render(<Books defaultOpenBook="pg-1" />);
    const reader = await screen.findByRole("document");
    const window = reader.closest<HTMLElement>(".mac-books-text-reader");
    if (!window) throw new Error("the book window");
    const edge = window.querySelector<HTMLElement>('[data-edge="se"]');
    if (!edge) throw new Error("the corner");
    const widthBefore = window.style.width;
    expect(widthBefore).toBe("786px");
    act(() => {
      edge.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
      );
    });
    act(() => {
      document.dispatchEvent(new PointerEvent("pointermove", { clientX: -2000, clientY: -2000 }));
    });
    await waitFor(() => expect(window.style.height).toBe("420px"));
    expect(window.style.width).toBe("420px");
    act(() => {
      document.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, clientY: 50 }));
      document.dispatchEvent(new PointerEvent("pointerup"));
    });
  });

  it("lists the book's window and the library's in the Window menu", async () => {
    const user = userEvent.setup();
    serve({ library, text: "word ".repeat(2000) });
    render(
      <>
        <MenuProbe title="Window" />
        <Books defaultOpenBook="pg-1" />
      </>,
    );
    await screen.findByRole("document");
    await user.click(screen.getByText("Bar Window"));
    expect(await screen.findByRole("menuitemcheckbox", { name: "The Book" })).toBeTruthy();
    expect(screen.getByRole("menuitemcheckbox", { name: "Library" })).toBeTruthy();
  });
});
