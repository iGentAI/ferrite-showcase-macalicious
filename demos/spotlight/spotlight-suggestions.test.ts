import { describe, expect, it } from "vitest";
import { askedSymbol, isDeveloperFile, storiesMatching, topHitOf } from "./spotlight-suggestions";

const row = (title: string) => ({ value: title, title });

describe("Spotlight's Top Hit", () => {
  it("prefers the exact name, then the start of a name, then the start of a word", () => {
    expect(topHitOf("music", [row("My Music.txt"), row("Music Lessons"), row("Music")])).toBe(
      "Music",
    );
    expect(topHitOf("mus", [row("My Music.txt"), row("Music Lessons")])).toBe("Music Lessons");
    expect(topHitOf("mus", [row("Amuse.txt"), row("My Music.txt")])).toBe("My Music.txt");
  });

  it("keeps the earlier of two as good, and has none for text inside a word", () => {
    expect(topHitOf("no", [row("Notes"), row("Notebook")])).toBe("Notes");
    expect(topHitOf("use", [row("Amuse.txt")])).toBeUndefined();
    expect(topHitOf("", [row("Notes")])).toBeUndefined();
  });
});

describe("What Spotlight finds in the news", () => {
  const story = (id: string, title: string, summary?: string) => ({
    id,
    source: "bbc",
    publisher: "BBC News",
    title,
    summary,
  });
  const stories = [
    story("1", "Tide tables redrawn for the estuary"),
    story("2", "Ferry returns", "The estuary crossing runs again"),
    story("3", "Tide tables redrawn for the estuary"),
    story("4", "Elections"),
  ];

  it("looks in headlines and summaries, every word, each headline once", () => {
    expect(storiesMatching(stories, "estuary").map((each) => each.id)).toEqual(["1", "2"]);
    expect(storiesMatching(stories, "tide estuary").map((each) => each.id)).toEqual(["1"]);
    expect(storiesMatching(stories, "bbc")).toEqual([]);
  });

  it("asks nothing of a short query, and shows three at most", () => {
    expect(storiesMatching(stories, "ti")).toEqual([]);
    const many = [1, 2, 3, 4, 5].map((n) => story(`${n}`, `Budget ${n}`));
    expect(storiesMatching(many, "budget")).toHaveLength(3);
  });
});

describe("What Spotlight asks about as a stock", () => {
  it("takes capitals as typed and a word before stock, not an ordinary word", () => {
    expect(askedSymbol("AAPL")).toBe("AAPL");
    expect(askedSymbol("aapl stock")).toBe("AAPL");
    expect(askedSymbol("apple")).toBeUndefined();
    expect(askedSymbol("meeting notes")).toBeUndefined();
  });
});

describe("Developer files", () => {
  it("are source code, not documents", () => {
    expect(isDeveloperFile("main.rs")).toBe(true);
    expect(isDeveloperFile("App.TSX")).toBe(true);
    expect(isDeveloperFile("notes.txt")).toBe(false);
    expect(isDeveloperFile("page.html")).toBe(false);
  });
});
