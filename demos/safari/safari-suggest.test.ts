import { describe, expect, it } from "vitest";
import { snapBackIndex, suggestionsFor } from "./safari-suggest";

const known = [
  { url: "https://www.apple.com/mac", title: "Mac", count: 2 },
  { url: "https://news.example/apple", title: "Apple news", count: 9 },
  { url: "https://other.example/", title: "Other", count: 1 },
  { url: "https://www.apple.com/mac", title: "Mac again", count: 1 },
];
const search = (words: string) => `search:${words}`;

describe("Safari's address field suggestions", () => {
  it("puts a page whose host starts with what was typed first, as Top Hit, and the search last", () => {
    expect(suggestionsFor("apple", known, search)).toEqual([
      { url: "https://www.apple.com/mac", title: "Mac", kind: "top" },
      { url: "https://news.example/apple", title: "Apple news", kind: "known" },
      { url: "search:apple", title: "Search for “apple”", kind: "search" },
    ]);
  });

  it("has no Top Hit when no host starts with it, and orders by visits", () => {
    expect(suggestionsFor("example", known, search).map((row) => [row.url, row.kind])).toEqual([
      ["https://news.example/apple", "known"],
      ["https://other.example/", "known"],
      ["search:example", "search"],
    ]);
  });

  it("lists what the search engine suggests after the search, without what was typed", () => {
    expect(suggestionsFor("zebra", known, search, ["Zebra", "Zebra crossing"])).toEqual([
      { url: "search:zebra", title: "Search for “zebra”", kind: "search" },
      { url: "search:Zebra crossing", title: "Zebra crossing", kind: "engine" },
    ]);
  });

  it("needs every word, and nothing typed suggests nothing", () => {
    expect(suggestionsFor("apple zebra", known, search)).toHaveLength(1);
    expect(suggestionsFor("  ", known, search)).toEqual([]);
  });
});

describe("Search Results SnapBack", () => {
  const isSearch = (address: string) => address.startsWith("search:");
  it("finds the latest search behind the page shown", () => {
    const history = ["search:a", "page", "search:b", "page2", "page3"];
    expect(snapBackIndex(history, 4, isSearch)).toBe(2);
    expect(snapBackIndex(history, 2, isSearch)).toBe(0);
    expect(snapBackIndex(history, 0, isSearch)).toBe(-1);
  });
});
