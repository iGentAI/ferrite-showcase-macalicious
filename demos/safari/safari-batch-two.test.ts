import { afterEach, describe, expect, it } from "vitest";
import { rowMovedTo, type SafariLibrary } from "./safari-bookmarks-model";
import { droppedText } from "./safari-drop";
import {
  filePageAddress,
  filePageOf,
  filePageText,
  isFilePage,
  isPageFile,
  localFileOf,
  localFilePage,
} from "./safari-files";
import { findRanges, lightMatches } from "./safari-find";
import { asksForSuggestions, keptPages, readKeptPages } from "./safari-web";
import { forgetPin, type PinnedTab, reconcilePins, type TabSeed } from "./safari-windows";

const link = (title: string) => ({ title, url: `https://${title}.example/` });
const library: SafariLibrary = {
  favorites: [link("f")],
  bookmarks: [link("a"), link("b"), link("c")],
  folders: [{ title: "Work", links: [link("w")] }],
};
const titles = (links: readonly { title: string }[]) => links.map((one) => one.title);

describe("moving a row of the sidebar", () => {
  const from = (index: number) => ({ place: "bookmarks", index });

  it("stands before the row it is let go on, up or down its list", () => {
    expect(titles(rowMovedTo(library, from(2), "bookmarks", 0).bookmarks)).toEqual(["c", "a", "b"]);
    expect(titles(rowMovedTo(library, from(0), "bookmarks", 2).bookmarks)).toEqual(["b", "a", "c"]);
    expect(titles(rowMovedTo(library, from(0), "bookmarks", null).bookmarks)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("changes nothing let go on itself or where it already stands", () => {
    expect(rowMovedTo(library, from(1), "bookmarks", 1)).toBe(library);
    expect(rowMovedTo(library, from(1), "bookmarks", 2)).toBe(library);
    expect(rowMovedTo(library, { place: "bookmarks", index: 9 }, "favorites", 0)).toBe(library);
  });

  it("moves between lists and folders, and a list that holds it keeps its own", () => {
    const moved = rowMovedTo(library, from(0), "folder:Work", null);
    expect(titles(moved.bookmarks)).toEqual(["b", "c"]);
    expect(titles(moved.folders[0]?.links ?? [])).toEqual(["w", "a"]);
    const twice = rowMovedTo({ ...library, favorites: [link("a")] }, from(0), "favorites", 0);
    expect(titles(twice.favorites)).toEqual(["a"]);
    expect(titles(twice.bookmarks)).toEqual(["b", "c"]);
  });
});

describe("a tab's kept Back and Forward", () => {
  it("keeps its pages, Safari's own as the start page", () => {
    expect(keptPages(["", "safari:history", "https://a.example/"], 2)).toEqual({
      pages: ["", "", "https://a.example/"],
      index: 2,
    });
  });

  it("keeps the twenty pages nearest the one shown, without those too long", () => {
    const pages = Array.from({ length: 40 }, (_, at) => `https://a.example/${at}`);
    const kept = keptPages(pages, 30);
    expect(kept.pages).toHaveLength(20);
    expect(kept.pages[kept.index]).toBe(pages[30]);
    expect(kept.pages.at(-1)).toBe(pages[35]);
    const long = `https://a.example/${"x".repeat(600)}`;
    expect(keptPages(["https://a.example/1", long, "https://a.example/2"], 2)).toEqual({
      pages: ["https://a.example/1", "https://a.example/2"],
      index: 1,
    });
  });

  it("reads only what makes sense back", () => {
    expect(readKeptPages({ pages: ["", "https://a.example/"], index: 1 })).toEqual({
      pages: ["", "https://a.example/"],
      index: 1,
    });
    expect(readKeptPages({ pages: [""], index: 4 })).toBeNull();
    expect(readKeptPages({ pages: [1], index: 0 })).toBeNull();
    expect(readKeptPages(null)).toBeNull();
  });
});

describe("an HTML file's tab", () => {
  it("names the file in an address no server keeps", () => {
    const address = filePageAddress("id/1", "my notes.html");
    expect(isFilePage(address)).toBe(true);
    expect(isFilePage("https://a.example/")).toBe(false);
    expect(filePageOf(address)).toEqual({ id: "id/1", name: "my notes.html" });
    expect(filePageText(address)).toBe("file:///my%20notes.html");
  });

  it("holds a file from this computer for as long as the page is open", () => {
    const file = new File(["<p>x</p>"], "a.htm");
    const { id, name } = filePageOf(localFilePage(file));
    expect(name).toBe("a.htm");
    expect(localFileOf(id)).toBe(file);
    expect(isPageFile(file)).toBe(true);
    expect(isPageFile({ name: "a.webloc" })).toBe(false);
  });
});

describe("Find in Safari's own views", () => {
  it("finds every match across the text, whatever its case, and selects none for nothing", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Mac and mac</p><p>A <b>MAC</b></p>";
    const ranges = findRanges(root, "mac");
    expect(ranges.map(String)).toEqual(["Mac", "mac", "MAC"]);
    expect(findRanges(root, "")).toEqual([]);
    expect(findRanges(root, "zebra")).toEqual([]);
    expect(() => lightMatches(ranges, 1)).not.toThrow();
  });
});

describe("pins across windows", () => {
  const seed = (address: string): TabSeed => ({ history: [address], index: 0 });
  const pin = (key: string, address: string): PinnedTab => ({ key, ...seed(address) });

  afterEach(() => {
    forgetPin("p1");
  });

  it("publishes a window's new pin, adds it to another, follows it, and takes it away", () => {
    const one = new Map<string, TabSeed>();
    const two = new Map<string, TabSeed>();
    expect(reconcilePins([pin("p1", "a")], one)).toEqual({ add: [], remove: [], follow: [] });
    expect(reconcilePins([], two).add).toEqual([pin("p1", "a")]);
    expect(reconcilePins([pin("p1", "a")], two)).toEqual({ add: [], remove: [], follow: [] });

    const moved = { ...pin("p1", "b") };
    reconcilePins([moved], one);
    expect(reconcilePins([pin("p1", "a")], two).follow).toEqual([moved]);
    expect(reconcilePins([moved], one)).toEqual({ add: [], remove: [], follow: [] });

    forgetPin("p1");
    expect(reconcilePins([moved], two).remove).toEqual(["p1"]);
  });
});

describe("what is dropped or asked about", () => {
  it("takes no picture's bytes as an address", () => {
    const dropped = (uriList: string) => ({
      types: ["text/uri-list"],
      getData: (type: string) => (type === "text/uri-list" ? uriList : ""),
    });
    expect(droppedText(dropped("data:image/png;base64,AAAA"))).toBe("");
    expect(droppedText(dropped("https://a.example/"))).toBe("https://a.example/");
  });

  it("asks the search engine about words only", () => {
    expect(asksForSuggestions("macos catalina")).toBe(true);
    expect(asksForSuggestions("m")).toBe(false);
    expect(asksForSuggestions("en.wikipedia.org")).toBe(false);
    expect(asksForSuggestions("https://a")).toBe(false);
    expect(asksForSuggestions("me@home")).toBe(false);
    expect(asksForSuggestions("St. Louis")).toBe(true);
  });
});
