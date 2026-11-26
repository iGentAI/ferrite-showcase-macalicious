import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serverDocument } from "../desktop/desktop-server";
import { Books } from "./books";
import { BOOKS_LIBRARY_URL, mergeReadings, type OwnedBook } from "./books-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/*
 * A Books window left open in one browser while the person changes their library in another.
 * The fake keeps the library as `ferrite-apps/desktop/src/apps/document.rs` does: a save is
 * stored only on the stored revision, and any other is answered 409 with the current library.
 * Revisions start high, since the page's one channel to the library outlives each test.
 */
let revision = 1_000;

function serve(library: unknown) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  revision += 100;
  const kept = { library, rev: revision };
  const reply = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.split("?")[0] !== BOOKS_LIBRARY_URL) return reply(404, { error: "not found" });
    if (init?.method !== "PUT") return reply(200, { library: kept.library, rev: kept.rev });
    const sent = JSON.parse(String(init.body));
    if (sent.rev !== kept.rev) {
      return reply(409, { library: kept.library, rev: kept.rev, error: "changed" });
    }
    kept.library = sent.library;
    kept.rev += 1;
    return reply(200, { library: kept.library, rev: kept.rev });
  });
  vi.stubGlobal("fetch", fetch);
  /** What another browser does: the library it saves (or forgets, `null`) under the next revision. */
  const elsewhere = (next: unknown) => {
    kept.library = next;
    kept.rev += 1;
  };
  return { kept, fetch, elsewhere };
}

const ALICE: OwnedBook = {
  id: "pg-11",
  title: "Alice's Adventures in Wonderland",
  author: "Lewis Carroll",
  source: "gutenberg",
  added: 1_760_000_000_000,
};
const MOBY: OwnedBook = {
  id: "pg-2701",
  title: "Moby Dick",
  author: "Herman Melville",
  source: "gutenberg",
  added: 1_760_000_100_000,
};
const libraryWith = (...books: OwnedBook[]) => ({
  collections: [],
  pages: {},
  marks: {},
  sort: "recent",
  books,
});

const frame = () => screen.getByRole("region", { name: "Books" });
const covers = () =>
  within(frame())
    .queryAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "")
    .filter((label) => label.includes(", "));

async function open() {
  const view = render(<Books />);
  await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
  return view;
}

describe("a reading changed in two windows at once", () => {
  it("keeps both sides' bookmarks and highlights, in order, and the place changed here", () => {
    const mark = (at: number) => ({ at, label: `page at ${at}` });
    const note = (id: string) => ({
      id,
      start: 1,
      end: 5,
      color: "yellow",
      text: "Alice",
      note: "",
    });
    const base = {
      reading: { place: 10, bookmarks: [mark(10), mark(50)], highlights: [note("h1")] },
    };
    const mine = {
      reading: { place: 80, bookmarks: [mark(10), mark(50), mark(80)], highlights: [] },
    };
    const theirs = {
      reading: {
        place: 30,
        bookmarks: [mark(10), mark(30), mark(50)],
        highlights: [note("h1"), note("h2")],
      },
    };
    expect(mergeReadings(base, mine, theirs)).toEqual({
      reading: {
        place: 80,
        bookmarks: [mark(10), mark(30), mark(50), mark(80)],
        highlights: [note("h2")],
      },
    });
    // A reading forgotten elsewhere stays forgotten.
    expect(mergeReadings(base, mine, { reading: null })).toEqual({ reading: null });
  });
});

describe("a Books window left open while the library changes in another browser", () => {
  it("never brings back a library forgotten in the other browser", async () => {
    const { kept, elsewhere } = serve(libraryWith(ALICE));
    const view = await open();
    expect(covers()).toEqual(["Alice's Adventures in Wonderland, Lewis Carroll"]);

    elsewhere(null);
    // The stale window makes a change of its own.
    await userEvent.setup().click(within(frame()).getByRole("button", { name: "New Collection" }));
    await act(() => serverDocument(BOOKS_LIBRARY_URL).idle());

    expect(kept.library).toBeNull();
    // The window shows the forgotten library, and says its change was not kept.
    await waitFor(() => expect(covers()).toEqual([]));
    expect(within(frame()).getByRole("alert")).toHaveTextContent(
      /changed in another window or browser first, so this change was not kept/,
    );
    view.unmount();
  });

  it("keeps a book got in the other browser beside the change made here", async () => {
    const { kept, elsewhere } = serve(libraryWith(ALICE));
    const view = await open();

    elsewhere(libraryWith(ALICE, MOBY));
    await userEvent.setup().click(within(frame()).getByRole("button", { name: "New Collection" }));
    await act(() => serverDocument(BOOKS_LIBRARY_URL).idle());

    const library = kept.library as { books: OwnedBook[]; collections: { name: string }[] };
    expect(library.books.map((book) => book.id)).toEqual([ALICE.id, MOBY.id]);
    expect(library.collections.map((collection) => collection.name)).toEqual([
      "Untitled Collection",
    ]);
    // Both show in the window that made the collection.
    expect(within(frame()).getByRole("treeitem", { name: "Untitled Collection" })).toBeVisible();
    await userEvent.setup().click(within(frame()).getByRole("treeitem", { name: "All Books" }));
    await waitFor(() => expect(covers()).toHaveLength(2));
    view.unmount();
  });
});
