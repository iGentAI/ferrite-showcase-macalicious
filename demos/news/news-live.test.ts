import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_EFFECTS_EVENT, type DesktopEffect } from "../desktop/desktop-effects";
import { takeOpenUrlRequests } from "../desktop/desktop-open-url";
import {
  ageOf,
  articleFromServer,
  catalogueFromServer,
  channelOf,
  clipText,
  feedFromServer,
  findParts,
  type LiveStory,
  libraryFromServer,
  libraryReadable,
  libraryToServer,
  MAX_HISTORY,
  MAX_SAVED,
  MAX_SAVED_SUMMARY,
  mastheadDate,
  mergeStories,
  OPEN_URL_EVENT,
  openStoryLink,
  savedIsFull,
  snapshot,
  storyArticleUrl,
  summaryParagraphs,
  toggle,
  toggleSaved,
  topStories,
  withoutStory,
  withVisit,
} from "./news-live";
import { DEFAULT_FOLLOWING, feedNeedsRead, RETRY_MS } from "./news-live-hooks";

describe("a story's article", () => {
  it("is read through Safari's route, kept out of Safari's History", () => {
    expect(storyArticleUrl("https://www.bbc.com/news/a b?x=1")).toBe(
      "/api/safari/page?url=https%3A%2F%2Fwww.bbc.com%2Fnews%2Fa%20b%3Fx%3D1&private=1&reader=1",
    );
  });

  it("is the page's readable blocks, and otherwise says why not", () => {
    expect(
      articleFromServer(
        {
          ok: true,
          status: 200,
          reader: [
            { kind: "h", text: "A heading" },
            { kind: "p", text: "A paragraph." },
          ],
        },
        "BBC News",
      ),
    ).toEqual({
      status: "ready",
      blocks: [
        { id: 0, kind: "h", text: "A heading" },
        { id: 1, kind: "p", text: "A paragraph." },
      ],
    });
    const noArticle = {
      status: "none",
      reason: "BBC News’s page has no article to read here. This is what its feed says.",
    };
    expect(articleFromServer({ ok: true, status: 200, reader: null }, "BBC News")).toEqual(
      noArticle,
    );
    expect(
      articleFromServer(
        { ok: true, status: 404, reader: [{ kind: "p", text: "Gone" }] },
        "BBC News",
      ),
    ).toEqual(noArticle);
    expect(
      articleFromServer({ ok: false, kind: "not-listed", host: "www.npr.org" }, "NPR"),
    ).toEqual({
      status: "none",
      reason:
        "This desktop’s server reads only the sites it lists, and www.npr.org is not one of them. This is what the feed says.",
    });
    expect(articleFromServer({ ok: false, kind: "timeout", message: "too slow." }, "NPR")).toEqual({
      status: "none",
      reason: "The story could not be read: too slow. This is what the feed says.",
    });
  });
});

describe("findParts", () => {
  it("cuts the text around each place that holds the query, ignoring case", () => {
    expect(findParts("Mars and the martian (mars)", "MARS")).toEqual([
      { text: "Mars", match: true },
      { text: " and the martian (", match: false },
      { text: "mars", match: true },
      { text: ")", match: false },
    ]);
  });

  it("takes the query literally, and an empty one finds nothing", () => {
    expect(findParts("a+b ab", "a+b")).toEqual([
      { text: "a+b", match: true },
      { text: " ab", match: false },
    ]);
    expect(findParts("a+b", "  ")).toEqual([{ text: "a+b", match: false }]);
  });
});

describe("withoutStory", () => {
  it("removes only the story with that key, whichever feed has the same id", () => {
    const bbc = { id: "1", source: "bbc", publisher: "BBC News", title: "A" };
    const npr = { id: "1", source: "npr", publisher: "NPR", title: "B" };
    expect(withoutStory([bbc, npr], "bbc.1")).toEqual([npr]);
  });
});

describe("channelOf", () => {
  const bbc = { id: "bbc", name: "BBC News", tint: "#b00", site: "https://bbc.test/" };
  const npr = { id: "npr", name: "NPR", tint: "#00b", site: "https://npr.test/" };

  it("finds the channel of the feed a story came from", () => {
    expect(channelOf({ source: "npr", publisher: "NPR" }, [bbc, npr])).toBe(npr);
  });

  it("finds a topic feed's story by its publisher", () => {
    expect(channelOf({ source: "bbc-science", publisher: "BBC News" }, [bbc, npr])).toBe(bbc);
  });

  it("has none for a publisher the catalogue does not list", () => {
    expect(channelOf({ source: "other", publisher: "Other" }, [bbc, npr])).toBeUndefined();
  });
});

const story = (over: Partial<LiveStory> & { id: string }): LiveStory => ({
  source: "bbc",
  publisher: "BBC News",
  title: `Headline ${over.id}`,
  ...over,
});

describe("live News data", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads the server's catalogue and refuses anything else", () => {
    const reply = {
      channels: [{ id: "bbc", name: "BBC News", tint: "#bb1919", site: "https://www.bbc.co.uk/" }],
      topics: [{ id: "science", name: "Science", tint: "#5f7fa6", sources: ["bbc-science"] }],
      following: ["bbc"],
      freshMs: 900_000,
    };
    expect(catalogueFromServer(reply)?.topics[0]?.sources).toEqual(["bbc-science"]);
    expect(catalogueFromServer({ ...reply, freshMs: "soon" })).toBeUndefined();
    expect(catalogueFromServer({ ...reply, channels: [{ id: 1 }] })).toBeUndefined();
    expect(catalogueFromServer(null)).toBeUndefined();
  });

  it("follows the same channels by default as the server", () => {
    expect(DEFAULT_FOLLOWING).toEqual(["bbc", "npr", "guardian", "ars"]);
  });

  it("reads a feed again by when the server read it, not when the window asked", () => {
    const fresh = 15 * 60_000;
    const now = 10_000_000;
    const feed = (fetched: number, stale = false) => ({ stories: [], fetched, stale });
    expect(feedNeedsRead(undefined, now, fresh)).toBe(true);
    // Asked just now, but the server's copy is almost 15 minutes old: in a minute it is due.
    const asked = { feed: feed(now - fresh + 30_000), loading: false, asked: now };
    expect(feedNeedsRead(asked, now, fresh)).toBe(false);
    expect(feedNeedsRead(asked, now + RETRY_MS, fresh)).toBe(true);
    // A fresh copy is not asked again however long ago the window asked.
    expect(
      feedNeedsRead(
        { feed: feed(now - 1_000), loading: false, asked: now - fresh * 2 },
        now,
        fresh,
      ),
    ).toBe(false);
    // A stale answer, or a failed request, is asked again a minute later, not before.
    const stale = { feed: feed(now, true), loading: false, asked: now };
    expect(feedNeedsRead(stale, now + RETRY_MS - 1, fresh)).toBe(false);
    expect(feedNeedsRead(stale, now + RETRY_MS, fresh)).toBe(true);
    const failed = { loading: false, asked: now, error: "x" };
    expect(feedNeedsRead(failed, now + RETRY_MS, fresh)).toBe(true);
    expect(feedNeedsRead({ ...failed, loading: true }, now + RETRY_MS, fresh)).toBe(false);
  });

  it("reads a feed reply, keeping only well-formed stories", () => {
    const feed = feedFromServer(
      {
        source: { id: "bbc", publisher: "BBC News" },
        fetched: 10,
        stale: true,
        error: "BBC News could not be read: timeout",
        stories: [
          { id: "a", title: "One", link: "https://b/1", published: 5, summary: "S" },
          { id: 2, title: "Bad" },
          { id: "c", title: "Two", published: "yesterday" },
        ],
      },
      "bbc",
    );
    expect(feed?.stale).toBe(true);
    expect(feed?.error).toContain("timeout");
    expect(feed?.stories.map((s) => s.id)).toEqual(["a", "c"]);
    expect(feed?.stories[0]).toMatchObject({ source: "bbc", publisher: "BBC News", published: 5 });
    expect(feed?.stories[1]?.published).toBeUndefined();
    expect(feedFromServer({ error: "x" }, "bbc")).toBeUndefined();
  });

  it("merges feeds newest first, once each, without blocked publishers", () => {
    const merged = mergeStories(
      [
        [story({ id: "1", published: 100, link: "https://x/1" }), story({ id: "2" })],
        [
          story({ id: "3", source: "npr", publisher: "NPR", published: 300 }),
          story({ id: "4", source: "npr", publisher: "NPR", published: 50, link: "https://x/1" }),
          story({ id: "5", source: "cbs", publisher: "CBS News", published: 400 }),
        ],
      ],
      new Set(["CBS News"]),
    );
    expect(merged.map((s) => s.id)).toEqual(["3", "1", "2"]);
  });

  it("leads Today with two publishers and at most two stories of one", () => {
    const merged = [
      story({ id: "1" }),
      story({ id: "2" }),
      story({ id: "3" }),
      story({ id: "4", publisher: "NPR" }),
      story({ id: "5", publisher: "NPR" }),
      story({ id: "6", publisher: "NPR" }),
      story({ id: "7", publisher: "Ars" }),
    ];
    expect(topStories(merged, 5).map((s) => s.id)).toEqual(["1", "4", "2", "5", "7"]);
  });

  it("says how old a story is as News does", () => {
    const now = Date.UTC(2026, 9, 14, 12);
    expect(ageOf(undefined, now)).toBe("");
    expect(ageOf(now - 10_000, now)).toBe("Just now");
    expect(ageOf(now - 5 * 60_000, now)).toBe("5m ago");
    expect(ageOf(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(ageOf(now - 30 * 3_600_000, now)).toBe("Yesterday");
    expect(ageOf(now + 60_000, now)).toBe("Just now");
    expect(ageOf(Date.UTC(2026, 9, 9, 12), now)).toMatch(/^Oct \d+$/);
    expect(mastheadDate(Date.UTC(2026, 9, 14, 12))).toMatch(/^October 1[345]$/);
  });

  it("keeps History and Saved Stories as the server takes them", () => {
    const a = story({ id: "a", summary: "Long text", author: "Jane" });
    const history = withVisit([], a);
    expect(history[0]).toEqual({
      id: "a",
      source: "bbc",
      publisher: "BBC News",
      title: "Headline a",
    });
    expect(withVisit(history, a)).toHaveLength(1);
    const long = Array.from({ length: MAX_HISTORY + 5 }, (_, n) => story({ id: `s${n}` }));
    expect(long.reduce(withVisit, [] as ReturnType<typeof withVisit>)).toHaveLength(MAX_HISTORY);
    const saved = toggleSaved([], a);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.summary).toBe("Long text");
    expect(toggleSaved(saved, a)).toEqual([]);
    const full = Array.from({ length: MAX_SAVED }, (_, at) =>
      snapshot(story({ id: `kept${at}` }), true),
    );
    expect(savedIsFull(full, a)).toBe(true);
    expect(toggleSaved(full, a)).toEqual(full);
    expect(savedIsFull(full, full[3] as never)).toBe(false);
    expect(toggle(["bbc"], "npr")).toEqual(["bbc", "npr"]);
    expect(toggle(["bbc", "npr"], "bbc")).toEqual(["npr"]);
  });

  it("reads and writes the library document", () => {
    const library = {
      following: ["bbc", "bbc"],
      blocked: [],
      saved: [story({ id: "a", summary: "kept", published: 1, link: "https://b/a" })],
      history: [story({ id: "h", summary: "not kept in History" })],
    };
    const body = libraryToServer(library).library;
    expect(body.following).toEqual(["bbc"]);
    expect(body.saved[0]).toEqual({
      id: "a",
      source: "bbc",
      publisher: "BBC News",
      title: "Headline a",
      link: "https://b/a",
      published: 1,
      summary: "kept",
    });
    expect(body.history[0]?.summary).toBeUndefined();
    expect(libraryReadable({ library: null })).toBe(true);
    expect(libraryFromServer({ library: null })).toBeUndefined();
    expect(libraryFromServer({ library: body })?.saved).toHaveLength(1);
    expect(libraryReadable({ library: { following: "bbc" } })).toBe(false);
  });

  it("clips saved text to the server's limits in characters, not UTF-16 units", () => {
    expect(clipText("abcdef", 4)).toBe("abc…");
    expect(clipText("abc", 4)).toBe("abc");
    const emoji = "😀".repeat(MAX_SAVED_SUMMARY + 10);
    const kept = snapshot(story({ id: "e", summary: emoji, title: "é".repeat(400) }), true);
    expect(Array.from(kept.summary ?? "")).toHaveLength(MAX_SAVED_SUMMARY);
    expect(Array.from(kept.title)).toHaveLength(300);
    expect(kept.summary?.endsWith("…")).toBe(true);
  });

  it("splits a summary into paragraphs", () => {
    expect(summaryParagraphs(story({ id: "a", summary: "One.\n\nTwo.\n\n\n" }))).toEqual([
      "One.",
      "Two.",
    ]);
    expect(summaryParagraphs(story({ id: "b" }))).toEqual([]);
  });

  it("opens a story in Safari through openUrl, which opens Safari when no window is open", () => {
    takeOpenUrlRequests();
    const effects: DesktopEffect[] = [];
    const hear = (event: Event) => effects.push(...(event as CustomEvent<DesktopEffect[]>).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    try {
      expect(openStoryLink("javascript:alert(1)")).toBe("none");
      // No Safari window: the link is kept for Safari, and Safari is opened to take it.
      expect(openStoryLink("https://www.bbc.co.uk/news/1")).toBe("safari");
      expect(takeOpenUrlRequests()).toEqual([
        { url: "https://www.bbc.co.uk/news/1", from: "news" },
      ]);
      expect(effects).toContainEqual({ open: "safari" });
      // An open Safari window takes it at once.
      let asked: unknown;
      const take = (event: Event) => {
        asked = (event as CustomEvent<{ url: string }>).detail.url;
        event.preventDefault();
      };
      window.addEventListener(OPEN_URL_EVENT, take);
      expect(openStoryLink("https://www.npr.org/2")).toBe("safari");
      window.removeEventListener(OPEN_URL_EVENT, take);
      expect(asked).toBe("https://www.npr.org/2");
      // Never a bare browser tab: Safari itself says when a page opens outside it.
      expect(open).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
      takeOpenUrlRequests();
    }
  });
});
