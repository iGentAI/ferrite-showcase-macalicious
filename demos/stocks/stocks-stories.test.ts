import { describe, expect, it } from "vitest";
import { type StockStory, storiesFor, storyNames } from "./stocks-data";

const story = (id: string, headline: string, summary?: string): StockStory => ({
  id,
  publisher: "CNBC",
  headline,
  summary,
  age: "1h ago",
});

describe("the stories of a symbol", () => {
  const feed = [
    story("fed", "Fed holds rates steady"),
    story("pineapple", "Pineapple prices jump"),
    story("apple", "Apple to open a new campus"),
    story("tim", "Chip makers rally", "AAPL rose 2% as suppliers gained."),
    story("jobs", "Payrolls beat estimates"),
    story("oil", "Oil slips"),
  ];

  it("names the symbol or its company as whole words", () => {
    expect(storyNames(story("a", "Apple falls"), "AAPL", "Apple Inc.")).toBe(true);
    expect(storyNames(story("a", "APPLE falls"), "AAPL", "Apple Inc.")).toBe(true);
    expect(storyNames(story("a", "Pineapple falls"), "AAPL", "Apple Inc.")).toBe(false);
    expect(storyNames(story("a", "Shares of F fell"), "F", "Ford Motor Company")).toBe(true);
    expect(storyNames(story("a", "Disney reopens"), "DIS", "The Walt Disney Company")).toBe(false);
    expect(storyNames(story("a", "Walt Disney reopens"), "DIS", "The Walt Disney Company")).toBe(
      true,
    );
  });

  it("leads with the ones about it, then the feed in its order, four in all", () => {
    expect(storiesFor("AAPL", feed, "Apple Inc.").map(({ id }) => id)).toEqual([
      "apple",
      "tim",
      "fed",
      "pineapple",
    ]);
  });

  it("is the feed's order when none is about it", () => {
    expect(storiesFor("TSLA", feed, "Tesla, Inc.").map(({ id }) => id)).toEqual([
      "fed",
      "pineapple",
      "apple",
      "tim",
    ]);
  });
});
