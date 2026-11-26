import { describe, expect, it } from "vitest";
import {
  keepPageCopy,
  keepServerCopy,
  mergeByKeys,
  mergeDocuments,
  sameDocument,
} from "./document-merge";

const book = (id: string, title = id) => ({ id, title });

describe("sameDocument", () => {
  it("compares fields in any order, and an absent field as null", () => {
    expect(sameDocument({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(sameDocument({ a: 1, b: null }, { a: 1 })).toBe(true);
    expect(sameDocument({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameDocument({ a: 1 }, { a: "1" })).toBe(false);
    expect(sameDocument([], {})).toBe(false);
  });
});

describe("mergeDocuments", () => {
  it("takes the server's copy of everything the person did not change", () => {
    const base = { sort: "recent", name: "Library" };
    const mine = { sort: "title", name: "Library" };
    const theirs = { sort: "recent", name: "Books" };
    expect(mergeDocuments(base, mine, theirs)).toEqual({ sort: "title", name: "Books" });
  });

  it("keeps the person's change of a value the server changed too", () => {
    expect(mergeDocuments({ sort: "recent" }, { sort: "title" }, { sort: "author" })).toEqual({
      sort: "title",
    });
  });

  it("never brings back a document forgotten elsewhere", () => {
    const base = { library: { books: [book("a")], sort: "recent" } };
    const mine = { library: { books: [book("a")], sort: "title" } };
    expect(mergeDocuments(base, mine, { library: null })).toEqual({ library: null });
    // A field the server's copy lacks altogether is forgotten too.
    expect(mergeDocuments(base, mine, {})).toEqual({});
  });

  it("keeps a document the person deleted deleted, whatever changed it elsewhere", () => {
    const base = { library: { sort: "recent" } };
    expect(mergeDocuments(base, { library: null }, { library: { sort: "title" } })).toEqual({
      library: null,
    });
  });

  it("merges a map field by field", () => {
    const base = { pages: { a: 1, b: 2, c: 3 } };
    const mine = { pages: { a: 5, b: 2, c: 3, d: 1 } };
    const theirs = { pages: { b: 2, c: 9 } };
    // a was forgotten elsewhere though turned here; c was turned elsewhere; d is new here.
    expect(mergeDocuments(base, mine, theirs)).toEqual({ pages: { b: 2, c: 9, d: 1 } });
  });

  it("merges lists of items by id: additions stay, removals on either side go", () => {
    const base = { books: [book("a"), book("b"), book("c")] };
    const mine = { books: [book("a", "A, edited"), book("c"), book("d")] };
    const theirs = { books: [book("a"), book("b"), book("e")] };
    expect(mergeDocuments(base, mine, theirs)).toEqual({
      // b removed here, c removed there, d added here, e added there; a edited here.
      books: [book("a", "A, edited"), book("d"), book("e")],
    });
  });

  it("drops an edit to an item removed elsewhere, and keeps the edit of one kept", () => {
    const base = { books: [book("a"), book("b")] };
    const mine = { books: [book("a", "A2"), book("b", "B2")] };
    const theirs = { books: [book("b")] };
    expect(mergeDocuments(base, mine, theirs)).toEqual({ books: [book("b", "B2")] });
  });

  it("keeps an item both sides changed whole, as the person left it", () => {
    const base = { events: [{ id: "e", start: 9, end: 10, title: "Talk" }] };
    const mine = { events: [{ id: "e", start: 14, end: 15, title: "Talk" }] };
    const theirs = { events: [{ id: "e", start: 9, end: 10, title: "Keynote" }] };
    expect(mergeDocuments(base, mine, theirs)).toEqual(mine);
  });

  it("merges an item's lists of members, so a member removed elsewhere stays removed", () => {
    const mark = (id: string, x = 0) => ({ id, x, points: [{ x, y: 0 }] });
    const base = { markup: { pages: [{ page: 1, items: [mark("m")] }] } };
    // Here a mark is added to page 1; there mark m is deleted and another one added.
    const mine = { markup: { pages: [{ page: 1, items: [mark("m"), mark("n")] }] } };
    const theirs = { markup: { pages: [{ page: 1, items: [mark("o")] }] } };
    expect(mergeByKeys("id", "page")(base, mine, theirs)).toEqual({
      markup: { pages: [{ page: 1, items: [mark("n"), mark("o")] }] },
    });
    // A collection renamed here keeps the book added to it there.
    const shelf = (name: string, ...books: string[]) => ({ id: "c", name, books });
    expect(
      mergeDocuments(
        { collections: [shelf("Shelf", "a")] },
        { collections: [shelf("Favourites", "a")] },
        { collections: [shelf("Shelf", "a", "b")] },
      ),
    ).toEqual({ collections: [shelf("Favourites", "a", "b")] });
  });

  it("keeps an item's other fields together, the person's when they changed one", () => {
    const mark = (x: number, color: string) => ({ id: "m", x, color, points: [{ x, y: 0 }] });
    // Moved there (its place and its points), recoloured here: the mark as the person left it.
    expect(
      mergeDocuments(
        { marks: [mark(0, "red")] },
        { marks: [mark(0, "blue")] },
        { marks: [mark(9, "red")] },
      ),
    ).toEqual({ marks: [mark(0, "blue")] });
  });

  it("applies a change of something forgotten elsewhere to nothing, when asked to", () => {
    const base = { values: { "dock.size": 1, "dock.magnify": true }, theme: { a: 1 } };
    const mine = { values: { "dock.size": 2, "dock.magnify": true }, theme: { a: 1 } };
    const forgotten = { values: null, theme: null };
    expect(mergeDocuments(base, mine, forgotten, { reapply: true })).toEqual({
      values: { "dock.size": 2 },
      theme: null,
    });
    // A list it changed is kept whole.
    expect(
      mergeDocuments(
        { order: ["a", "b"] },
        { order: ["b", "a"] },
        { order: null },
        { reapply: true },
      ),
    ).toEqual({ order: ["b", "a"] });
    // Without the option the forget wins, and nothing of it comes back either.
    expect(mergeDocuments(base, mine, forgotten)).toEqual(forgotten);
  });

  it("keeps the person's order when they reordered, and the server's otherwise", () => {
    const base = { order: ["a", "b", "c"] };
    // d, new elsewhere after c, stays after c in the person's order.
    expect(
      mergeDocuments(base, { order: ["c", "a", "b"] }, { order: ["a", "b", "c", "d"] }),
    ).toEqual({ order: ["c", "d", "a", "b"] });
    expect(
      mergeDocuments(base, { order: ["a", "b", "c", "x"] }, { order: ["b", "a", "c"] }),
    ).toEqual({ order: ["b", "a", "c", "x"] });
  });

  it("places a new item after the one that precedes it on its side", () => {
    const base = { recents: ["b", "c"] };
    // Newest first: the person's new item goes to the front, as they put it.
    expect(
      mergeDocuments(base, { recents: ["n", "b", "c"] }, { recents: ["b", "c", "z"] }),
    ).toEqual({ recents: ["n", "b", "c", "z"] });
  });

  it("merges sets of strings and of numbers", () => {
    const base = { disabled: ["a", "b"], marks: [1, 2] };
    const mine = { disabled: ["a", "b", "c"], marks: [2] };
    const theirs = { disabled: ["b"], marks: [1, 2, 3] };
    expect(mergeDocuments(base, mine, theirs)).toEqual({ disabled: ["b", "c"], marks: [2, 3] });
  });

  it("keeps the person's list whole when it is not a set of items", () => {
    // A queue may name a song twice; items without ids have nothing to match them by.
    const base = { queue: ["a", "b"], visits: [{ url: "x" }] };
    const mine = { queue: ["a", "a", "b"], visits: [{ url: "y" }] };
    const theirs = { queue: ["b"], visits: [{ url: "z" }] };
    expect(mergeDocuments(base, mine, theirs)).toEqual(mine);
    // Unless the server's copy removed it.
    expect(mergeDocuments(base, mine, { queue: null, visits: [] })).toEqual({
      queue: null,
      visits: [{ url: "y" }],
    });
  });

  it("merges nested lists inside records", () => {
    const base = { library: { collections: [{ id: "c", books: ["a"] }], books: [book("a")] } };
    const mine = {
      library: {
        collections: [
          { id: "c", books: ["a"] },
          { id: "d", books: [] },
        ],
        books: [book("a")],
      },
    };
    const theirs = {
      library: { collections: [{ id: "c", books: ["a"] }], books: [book("a"), book("m")] },
    };
    expect(mergeDocuments(base, mine, theirs)).toEqual({
      library: {
        collections: [
          { id: "c", books: ["a"] },
          { id: "d", books: [] },
        ],
        books: [book("a"), book("m")],
      },
    });
  });

  it("merges onto a server copy when the page never had one", () => {
    expect(mergeDocuments(null, { cards: [book("a")] }, { cards: [book("b")] })).toEqual({
      cards: [book("a"), book("b")],
    });
  });

  it("names items by other fields when told to", () => {
    const base = { recents: [{ file: "f1", position: 10 }] };
    const mine = {
      recents: [
        { file: "f2", position: 0 },
        { file: "f1", position: 10 },
      ],
    };
    const theirs = { recents: [{ file: "f1", position: 40 }] };
    expect(mergeByKeys("file")(base, mine, theirs)).toEqual({
      recents: [
        { file: "f2", position: 0 },
        { file: "f1", position: 40 },
      ],
    });
    // By `id` alone the movies cannot be told apart, and the person's list is kept whole.
    expect(mergeDocuments(base, mine, theirs)).toEqual(mine);
  });
});

describe("the other merges", () => {
  it("keepServerCopy keeps the server's copy", () => {
    expect(keepServerCopy({ vault: 1 }, { vault: 2 }, { vault: 3 })).toEqual({ vault: 3 });
  });

  it("keepPageCopy keeps the page's copy, unless a field was forgotten elsewhere", () => {
    const base = { playback: { index: 0 }, other: 1 };
    expect(keepPageCopy(base, { playback: { index: 2 } }, { playback: { index: 5 } })).toEqual({
      playback: { index: 2 },
    });
    expect(keepPageCopy(base, { playback: { index: 2 } }, { playback: null })).toEqual({
      playback: null,
    });
    expect(keepPageCopy(null, { playback: { index: 2 } }, { playback: null })).toEqual({
      playback: { index: 2 },
    });
  });
});
