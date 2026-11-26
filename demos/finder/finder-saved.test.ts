import { describe, expect, it } from "vitest";
import {
  fitWindow,
  readFolders,
  readSearches,
  readWindow,
  withFolder,
  withRecentFolder,
  withSearch,
} from "./finder-saved";
import { activeTab, createState, locationOf, reduce } from "./finder-state";

describe("a window's tabs", () => {
  const three = () => createState(["/a", "/b", "/c"], 0, "icons");
  const places = (state: ReturnType<typeof three>) => state.tabs.map(locationOf);

  it("move to a new place, within the bar", () => {
    const tabs = three();
    const first = tabs.tabs[0]?.id as number;
    expect(places(reduce(tabs, { type: "move-tab", id: first, index: 2 }))).toEqual([
      "/b",
      "/c",
      "/a",
    ]);
    expect(places(reduce(tabs, { type: "move-tab", id: first, index: 99 }))).toEqual([
      "/b",
      "/c",
      "/a",
    ]);
    expect(reduce(tabs, { type: "move-tab", id: 999, index: 1 })).toBe(tabs);
  });

  it("take another window's tabs, with ids of their own and all they hold, and keep the one shown", () => {
    const tabs = three();
    const moved = reduce(createState(["/d"], 0, "list"), { type: "navigate", location: "/e" });
    const { id: _id, ...contents } = activeTab(
      reduce(moved, { type: "select", selection: ["/e/f"] }),
    );
    const next = reduce(tabs, { type: "add-tabs", tabs: [contents] });
    expect(places(next)).toEqual(["/a", "/b", "/c", "/e"]);
    expect(new Set(next.tabs.map(({ id }) => id)).size).toBe(4);
    expect(next.active).toBe(tabs.active);
    expect(next.tabs[3]?.view).toBe("list");
    expect(next.tabs[3]?.history).toEqual(["/d", "/e"]);
    expect(next.tabs[3]?.selection).toEqual(["/e/f"]);
  });
});

describe("Recent Folders", () => {
  it("puts the folder first, once, and keeps the ten newest", () => {
    const many = Array.from({ length: 10 }, (_, index) => `/f${index}`);
    expect(withRecentFolder(["/a", "/b"], "/b")).toEqual(["/b", "/a"]);
    const next = withRecentFolder(many, "/new");
    expect(next).toHaveLength(10);
    expect(next[0]).toBe("/new");
    expect(next).not.toContain("/f9");
  });
});

describe("Finder's saved window", () => {
  it("reads what was kept and refuses anything else", () => {
    expect(
      readWindow({ tabs: [{ location: "/a", view: "list" }, { location: 3 }], active: 5 }),
    ).toEqual({ tabs: [{ location: "/a", view: "list" }], active: 0 });
    expect(readWindow({ tabs: [] })).toBeUndefined();
    expect(readWindow("nope")).toBeUndefined();
    expect(readWindow({ tabs: [{ location: "/a", view: "wide" }] })).toBeUndefined();
  });

  it("keeps the tab shown when the tabs do not fit a setting", () => {
    const long = `/${"x".repeat(1500)}`;
    const fitted = fitWindow({
      tabs: [
        { location: `${long}a`, view: "icons" },
        { location: `${long}b`, view: "icons" },
        { location: `${long}c`, view: "icons" },
      ],
      active: 2,
    });
    expect(fitted.tabs.map((tab) => tab.location.at(-1))).toEqual(["b", "c"]);
    expect(fitted.active).toBe(1);
  });

  it("comes back as tabs with their folders and views", () => {
    const state = reduce(createState(["/home"], 0, "icons"), {
      type: "restore",
      tabs: [
        { location: "/a", view: "list" },
        { location: "/b", view: "columns" },
      ],
      active: 1,
    });
    expect(state.tabs.map((tab) => [locationOf(tab), tab.view])).toEqual([
      ["/a", "list"],
      ["/b", "columns"],
    ]);
    expect(locationOf(activeTab(state))).toBe("/b");
    expect(state.nextId).toBe(3);
  });
});

describe("Finder's folder settings", () => {
  it("merges a change into what the folder has", () => {
    expect(withFolder({ a: { view: "list" } }, "a", { icon: 96 })).toEqual({
      a: { view: "list", icon: 96 },
    });
  });

  it("drops the oldest folder to stay within a setting", () => {
    let folders = {};
    for (let index = 0; index < 400; index += 1) {
      folders = withFolder(folders, `folder-${index}`, { view: "list" });
    }
    const ids = Object.keys(folders);
    expect(JSON.stringify(folders).length).toBeLessThanOrEqual(3800);
    expect(ids.at(-1)).toBe("folder-399");
    expect(ids).not.toContain("folder-0");
  });

  it("reads only the settings it knows", () => {
    expect(
      readFolders({
        a: { view: "list", icon: 48, sort: { column: "kind", direction: "descending" }, x: 1 },
        b: { view: "wide", sort: { column: "kind", direction: "sideways" } },
        c: 7,
      }),
    ).toEqual({
      a: { view: "list", icon: 48, sort: { column: "kind", direction: "descending" } },
      b: {},
    });
  });
});

describe("Finder's saved searches", () => {
  const search = { location: "/a", origin: null, query: "q", scope: "mac" as const, rows: [] };

  it("gives each its own id, also after one is removed", () => {
    const one = withSearch([], search) ?? [];
    const two = withSearch(one, search) ?? [];
    expect(two.map((item) => item.id)).toEqual(["saved:1", "saved:2"]);
    expect(withSearch(two.slice(1), search)?.map((item) => item.id)).toEqual([
      "saved:2",
      "saved:3",
    ]);
  });

  it("reads back what it wrote, and skips what it did not", () => {
    const kept =
      withSearch([], {
        ...search,
        name: "Big PDFs",
        rows: [{ field: "size", op: "greater", value: "5", unit: "MB" }],
      }) ?? [];
    expect(readSearches(JSON.parse(JSON.stringify([...kept, { id: 1 }])))).toEqual(kept);
    expect(readSearches({})).toBeUndefined();
  });

  it("reads an earlier search's words as Name rows, and drops a row it does not know", () => {
    const { rows: _rows, ...earlier } = search;
    expect(readSearches([{ ...earlier, id: "saved:1", terms: ["t"] }])).toEqual([
      { ...search, id: "saved:1", rows: [{ field: "name", op: "contains", value: "t" }] },
    ]);
    expect(
      readSearches([
        {
          ...search,
          id: "saved:2",
          rows: [
            { field: "size", op: "contains", value: "1" },
            { field: "name", op: "is", value: "a" },
          ],
        },
      ]),
    ).toEqual([{ ...search, id: "saved:2", rows: [{ field: "name", op: "is", value: "a" }] }]);
  });

  it("refuses one that would not fit, and keeps those it has", () => {
    let searches = withSearch([], search) ?? [];
    let refused = false;
    for (let index = 0; index < 100 && !refused; index += 1) {
      const next = withSearch(searches, { ...search, query: "q".repeat(200) });
      if (next) searches = next;
      else refused = true;
    }
    expect(refused).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(searches)).length).toBeLessThanOrEqual(3800);
    expect(searches[0]?.id).toBe("saved:1");
  });

  it("refuses a search that alone is over the limit, counted in bytes", () => {
    expect(withSearch([], { ...search, query: "é".repeat(1800) })).toHaveLength(1);
    // 1900 characters, but 3800 bytes before the rest of the record.
    expect(withSearch([], { ...search, query: "é".repeat(1900) })).toBeNull();
  });
});

describe("Finder's folder settings, at the limit", () => {
  it("leaves the folders as they were when one alone is over the limit", () => {
    const folders = { a: { view: "list" as const } };
    const sort = { column: "é".repeat(1900), direction: "ascending" as const };
    expect(withFolder(folders, "b", { sort })).toBe(folders);
  });
});
