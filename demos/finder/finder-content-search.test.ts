import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readContentHits, useContentHits } from "./finder-content-search";
import { type FinderNode, search, TRASH } from "./finder-data";

const root: FinderNode = {
  name: "",
  kind: "folder",
  children: [
    { name: "Apple notes.txt", kind: "document", id: "a" },
    { name: "Plain.txt", kind: "document", id: "b" },
    { name: "Other.txt", kind: "document", id: "c" },
  ],
};
const names = (found: ReturnType<typeof search>) => found.map(({ node }) => node.name);

describe("Finder's search with the server's hits", () => {
  it("leaves the Trash out unless the search is in it", () => {
    const trashed: FinderNode = TRASH.split("/")
      .filter(Boolean)
      .reduceRight<FinderNode[]>(
        (inner, name) => [{ name, kind: "folder", children: inner }],
        [{ name: "Apple peel.txt", kind: "document" }],
      )[0] as FinderNode;
    const tree: FinderNode = {
      name: "",
      kind: "folder",
      children: [trashed, { name: "Apple notes.txt", kind: "document" }],
    };
    expect(names(search(tree, "/", "apple"))).toEqual(["Apple notes.txt"]);
    expect(names(search(tree, TRASH, "apple"))).toEqual(["Apple peel.txt"]);
  });
  it("finds by name, and by a hit on what the name does not hold", () => {
    expect(names(search(root, "/", "apple"))).toEqual(["Apple notes.txt"]);
    expect(names(search(root, "/", "apple", [], new Set(["b"])))).toEqual([
      "Apple notes.txt",
      "Plain.txt",
    ]);
  });

  it("keeps a row to its attribute, hit or not", () => {
    expect(
      names(
        search(
          root,
          "/",
          "apple",
          [{ field: "name", op: "begins", value: "plain" }],
          new Set(["b", "c"]),
        ),
      ),
    ).toEqual(["Plain.txt"]);
  });

  it("finds nothing for an empty query, whatever the hits", () => {
    expect(search(root, "/", "  ", [], new Set(["b"]))).toEqual([]);
  });
});

describe("asking the server", () => {
  const answer = (ids: readonly string[], indexing = false) =>
    new Response(JSON.stringify({ results: ids.map((id) => ({ kind: "files", id })), indexing }));
  const passes = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("drops one query's hits as soon as the query changes, until its own answer comes", async () => {
    let second: (response: Response) => void = () => {};
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(answer(["first"]))
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          second = resolve;
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(({ query }) => useContentHits(query, true), {
      initialProps: { query: "one" },
    });
    await passes(250);
    expect([...result.current.ids]).toEqual(["first"]);

    rerender({ query: "two" });
    expect([...result.current.ids]).toEqual([]);
    await passes(250);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect([...result.current.ids]).toEqual([]);

    second(answer(["second"]));
    await passes(0);
    expect([...result.current.ids]).toEqual(["second"]);
  });

  it("does not ask for more than the route takes, and says names alone were searched", async () => {
    const fetch = vi.fn(async () => answer([]));
    vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(({ query }) => useContentHits(query, true), {
      initialProps: { query: "x".repeat(201) },
    });
    await passes(500);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.failed).toBe(true);
    rerender({ query: "one two three four five six seven eight nine" });
    await passes(500);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.failed).toBe(true);
  });

  it("keeps asking while the index reads, as far as all its text files", async () => {
    const fetch = vi.fn(async () => answer([], true));
    for (let ask = 0; ask < 9; ask += 1) fetch.mockImplementationOnce(async () => answer([], true));
    fetch.mockImplementationOnce(async () => answer(["last"]));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useContentHits("word", true));
    await passes(200 + 9 * 800 + 10);
    expect(fetch).toHaveBeenCalledTimes(10);
    expect([...result.current.ids]).toEqual(["last"]);
    expect(result.current.incomplete).toBe(false);
  });

  it("says so when it stops with the index still reading", async () => {
    const fetch = vi.fn(async () => answer([], true));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useContentHits("word", true));
    await passes(200 + 20 * 800);
    expect(fetch).toHaveBeenCalledTimes(12);
    expect(result.current.incomplete).toBe(true);
  });

  it("does not ask while it is not on the drive", async () => {
    const fetch = vi.fn(async () => answer([]));
    vi.stubGlobal("fetch", fetch);
    renderHook(() => useContentHits("word", false));
    await passes(500);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the search route's answer", () => {
  it("keeps the drive's ids and says what is left", () => {
    const read = readContentHits("q", {
      results: [{ kind: "files", id: "f1" }, { kind: "mail", id: "m1" }, { kind: "files" }],
      indexing: true,
      unsearched_files: 3,
    });
    expect(read && [...read.ids]).toEqual(["f1"]);
    expect(read?.indexing).toBe(true);
    expect(read?.unsearched).toBe(3);
  });

  it("refuses what is not one", () => {
    expect(readContentHits("q", { results: "none" })).toBeNull();
    expect(readContentHits("q", null)).toBeNull();
  });
});
