import { describe, expect, it } from "vitest";
import { type AppStorePlace, forgetAccount, move, startHistory, visit } from "./app-store-history";

const page = (change: Partial<AppStorePlace> = {}): AppStorePlace => ({
  section: "discover",
  query: "",
  category: null,
  account: false,
  ...change,
});
const sections = (history: ReturnType<typeof startHistory>) =>
  history.entries.map((entry) => entry.query || entry.section);

describe("the store's page history", () => {
  it("goes back and forward, each page at the place it was left", () => {
    let history = startHistory(page());
    history = visit(history, page({ section: "work" }), 120);
    history = visit(history, page({ section: "play" }), 40);
    expect(sections(history)).toEqual(["discover", "work", "play"]);
    history = move(history, -1, 7);
    expect(history.at).toBe(1);
    expect(history.entries[1]?.scrollTop).toBe(40);
    history = move(history, 1, 0);
    expect(history.at).toBe(2);
    expect(history.entries[2]?.scrollTop).toBe(7);
  });

  it("stops at both ends", () => {
    const history = startHistory(page());
    expect(move(history, -1, 0)).toBe(history);
    expect(move(history, 1, 0)).toBe(history);
  });

  it("drops what is ahead when a new page is shown, and adds nothing for the same page", () => {
    let history = visit(startHistory(page()), page({ section: "work" }), 0);
    history = move(history, -1, 0);
    history = visit(history, page({ section: "play" }), 0);
    expect(sections(history)).toEqual(["discover", "play"]);
    expect(visit(history, page({ section: "play" }), 90)).toBe(history);
  });

  it("keeps a search as it is typed as one page, and clearing it goes back", () => {
    let history = visit(startHistory(page()), page({ query: "b" }), 30);
    history = visit(history, page({ query: "bo" }), 0);
    expect(sections(history)).toEqual(["discover", "bo"]);
    history = visit(history, page(), 0);
    expect(sections(history)).toEqual(["discover"]);
    expect(history.entries[0]?.scrollTop).toBe(30);
  });

  it("keeps a category's results apart from the typed search after it", () => {
    let history = visit(startHistory(page()), page({ query: "Games", category: "Games" }), 0);
    history = visit(history, page({ query: "Game" }), 0);
    expect(sections(history)).toEqual(["discover", "Games", "Game"]);
  });

  it("forgets the account page on signing out", () => {
    let history = visit(startHistory(page()), page({ account: true }), 0);
    history = visit(history, page({ section: "work" }), 0);
    history = forgetAccount(move(history, -1, 0));
    expect(history.entries.map((entry) => [entry.section, entry.account])).toEqual([
      ["discover", false],
      ["work", false],
    ]);
    expect(history.at).toBe(0);
  });

  it("signing out shows the page before the account, with nothing added", () => {
    let history = visit(startHistory(page()), page({ query: "Books" }), 0);
    history = visit(history, page({ account: true }), 25);
    history = forgetAccount(history);
    expect(sections(history)).toEqual(["discover", "Books"]);
    expect(history.at).toBe(1);
    expect(history.entries[1]?.scrollTop).toBe(25);
  });

  it("signing out with only the account page left shows its section", () => {
    const history = forgetAccount(startHistory(page({ section: "work", account: true })));
    expect(history.entries.map((entry) => [entry.section, entry.account])).toEqual([
      ["work", false],
    ]);
  });
});
