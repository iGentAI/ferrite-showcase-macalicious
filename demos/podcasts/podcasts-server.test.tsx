import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { openItem } from "../desktop/desktop-open-item";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { DEFAULT_SETTINGS } from "./podcasts-data";
import {
  DesktopPodcasts,
  DOWNLOADS_NOTE,
  ERROR_GRACE_MS,
  shortDay,
  speedLabel,
} from "./podcasts-desktop";
import {
  type CachedFeed,
  EMPTY_LIBRARY,
  libraryBytes,
  limitText,
  maxAgeOf,
  PODCASTS_LIBRARY_URL,
  PODCASTS_LIMITS,
  type PodcastsLibraryState,
  podcastsLibrary,
  podcastsLibraryFromServer,
  podcastsLibraryReadable,
  podcastsLibraryToServer,
  type QueuedEpisode,
  type ShowListing,
  showOfOpenItem,
  UNTITLED_EPISODE,
} from "./podcasts-server";

/*
 * Test doubles, named for what they stand in for:
 * - `fetch` is stubbed with the replies of the desktop's Podcasts module (its library document,
 *   Apple's directory and a show's feed as the module answers them), recorded in the module's
 *   shapes; no server, directory or feed is reached.
 * - jsdom has no media pipeline, so the audio element's `play`, `pause`, `load`, `paused`,
 *   `currentTime`, `duration` and `readyState` are faked on its prototype: `play` and `pause`
 *   fire the element's events as a browser would, and nothing is heard.
 */

const FEED = "https://feeds.npr.org/510318/podcast.xml";
const DAY = 86_400_000;
const NOW = Date.now();

const feed: CachedFeed = {
  url: FEED,
  fetched: NOW,
  cut: false,
  title: "Up First from NPR",
  author: "NPR",
  description: "The news you need to start your day.",
  image: "https://media.npr.org/up-first.jpg",
  episodes: [
    {
      id: "aaaaaaaaaaaaaaaa",
      title: "Tuesday's News",
      summary: "The stories of the day.\n\nAnd one more.",
      published: NOW - DAY,
      audio: { url: "https://play.podtrac.com/npr-510318/tuesday.mp3", kind: "audio/mpeg" },
      duration: 900,
    },
    {
      id: "bbbbbbbbbbbbbbbb",
      title: "Monday's News",
      summary: "Monday.",
      published: NOW - 2 * DAY,
      audio: { url: "https://play.podtrac.com/npr-510318/monday.mp3", kind: "audio/mpeg" },
      duration: 840,
    },
  ],
};

const UP_FIRST: ShowListing = {
  id: "510318",
  title: "Up First from NPR",
  author: "NPR",
  artwork: "https://is1-ssl.mzstatic.com/image/thumb/up-first/600x600bb.jpg",
  genre: "Daily News",
  feed: FEED,
  followable: true,
};
const ELSEWHERE: ShowListing = {
  id: "1234",
  title: "Elsewhere Weekly",
  author: "Somebody",
  genre: "Arts",
  feed: "https://feeds.example.org/elsewhere.xml",
  followable: false,
  reason:
    "Its feed is published from feeds.example.org, which is not one of the podcast hosts this desktop's server can reach.",
};

const followed = (seen: number) => ({
  id: "510318",
  title: "Up First from NPR",
  author: "NPR",
  artwork: UP_FIRST.artwork ?? null,
  genre: "Daily News",
  feed: FEED,
  seen,
});

const episode = (which: 0 | 1): QueuedEpisode => {
  const item = feed.episodes[which];
  if (!item?.audio) throw new Error("no such episode");
  return {
    id: `510318.${item.id}`,
    show: "510318",
    title: item.title,
    showTitle: "Up First from NPR",
    artwork: UP_FIRST.artwork ?? null,
    audio: item.audio.url,
    kind: "audio/mpeg",
    duration: item.duration ?? 0,
    published: item.published ?? 0,
    feed: FEED,
  };
};

const stored = (change: Partial<PodcastsLibraryState> = {}) =>
  podcastsLibraryToServer({ ...EMPTY_LIBRARY, ...change }).library;

/**
 * Stub `fetch` with the module's replies; `library` is what the server holds. `lookup`, when
 * given, holds Apple's lookup until it settles; `lookupFailures` lookups fail first;
 * `feedReply` replaces the feed's reply.
 */
function serve(
  library: unknown,
  {
    rev = 1,
    lookup,
    lookupFailures = 0,
    feedReply,
  }: { rev?: number; lookup?: Promise<void>; lookupFailures?: number; feedReply?: unknown } = {},
) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  let kept = library;
  let revision = rev;
  let failuresLeft = lookupFailures;
  const reply = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body,
  });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(url, "http://desktop.test");
    if (pathname === PODCASTS_LIBRARY_URL) {
      // The module keeps what it is sent: a load after a save reads the saved library.
      if (init?.method === "PUT") {
        kept = (JSON.parse(String(init.body)) as { library: unknown }).library;
        revision += 1;
        return reply({ library: kept, rev: revision });
      }
      return reply({ library: kept, rev: revision });
    }
    if (pathname === "/api/podcasts/feed") {
      return searchParams.get("url") === FEED
        ? reply(feedReply ?? { feed, stale: false, error: null })
        : reply({ error: "not followable" }, 400);
    }
    if (pathname === "/api/podcasts/search") return reply({ results: [UP_FIRST, ELSEWHERE] });
    if (pathname === "/api/podcasts/top") {
      return reply({
        shows: [UP_FIRST, ELSEWHERE].map(({ id, title, author, genre }) => ({
          id,
          title,
          author,
          genre,
        })),
        fetched: NOW,
      });
    }
    if (pathname === "/api/podcasts/lookup") {
      await lookup;
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        return reply({ error: "Apple's directory answered HTTP 503" }, 502);
      }
      return reply({ results: [UP_FIRST, ELSEWHERE] });
    }
    return reply({ error: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)).library as PodcastsLibraryState);
const lastSave = (fetch: ReturnType<typeof serve>) => saves(fetch).at(-1);
const asked = (fetch: ReturnType<typeof serve>, path: string) =>
  fetch.mock.calls.filter(([url]) => String(url).startsWith(path)).map(([url]) => String(url));

/**
 * What the module would refuse of a `PUT` body's library (`validate` in
 * `ferrite-apps/desktop/src/apps/podcasts/mod.rs`, which counts text in Rust `char`s and
 * addresses in bytes), or `null` when it would keep it.
 */
function refusal(library: ReturnType<typeof podcastsLibraryToServer>["library"]): string | null {
  const chars = (text: string) => Array.from(text).length;
  const bytes = (text: string) => new TextEncoder().encode(text).length;
  const text = (value: string, required: boolean) =>
    chars(value) <= 200 && !(required && value.trim() === "");
  const picture = (value: string | null) =>
    value === null || (bytes(value) <= 1024 && /^https?:\/\/[^\s"<>\\`]+$/.test(value));
  // JSON carries a lone surrogate as an escape, which the module's JSON reader refuses.
  if (/\\u[dD][89a-fA-F][0-9a-fA-F]{2}/.test(JSON.stringify(library))) return "a lone surrogate";
  for (const show of library.shows) {
    if (!text(show.title, true)) return `the show's title ${show.title}`;
    if (!text(show.author, false)) return `the show's publisher ${show.author}`;
    if (show.genre !== null && !text(show.genre, false)) return `the genre ${show.genre}`;
    if (!picture(show.artwork)) return `the show's artwork ${show.artwork}`;
  }
  for (const item of [...library.queue, ...(library.current ? [library.current] : [])]) {
    if (!text(item.title, true)) return `the episode's title ${item.title}`;
    if (!text(item.showTitle, false)) return `the episode's show ${item.showTitle}`;
    if (!picture(item.artwork)) return `the episode's artwork ${item.artwork}`;
    if (item.kind !== null && !(bytes(item.kind) <= 100 && /^(audio|video)\//.test(item.kind))) {
      return `the type ${item.kind}`;
    }
    if (item.duration > 86_400) return `the duration ${item.duration}`;
  }
  if (bytes(JSON.stringify(library)) > 190_000) return "the size";
  return null;
}

const frame = () => screen.getByRole("region", { name: "Podcasts" });
/** Every Podcasts window rendered, in order. */
const windows = () => {
  const [here, there] = screen.getAllByRole("region", { name: "Podcasts" });
  if (!here || !there) throw new Error("two Podcasts windows are expected");
  return [here, there] as const;
};
const audioOf = (window: HTMLElement) => window.querySelector("audio") as HTMLAudioElement;
const place = (name: RegExp | string) =>
  within(screen.getByRole("tree", { name: "Podcasts" })).getByRole("treeitem", { name });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const display = () => screen.getByRole("group", { name: "Now Playing" });
const audio = () => document.querySelector("audio") as HTMLAudioElement;
const loaded = () => waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
/** Whether a control is unavailable, however the component marks it. */
const unavailable = (element: HTMLElement) =>
  element.hasAttribute("disabled") ||
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled");

// The fake media element.
const media = new WeakMap<
  HTMLMediaElement,
  { paused: boolean; time: number; error?: { code: number }; ready?: number; length?: number }
>();
const of = (element: HTMLMediaElement) => {
  let state = media.get(element);
  if (!state) {
    state = { paused: true, time: 0 };
    media.set(element, state);
  }
  return state;
};
const faked = ["paused", "currentTime", "duration", "readyState", "error"] as const;
const originals = new Map<string, PropertyDescriptor | undefined>();
beforeAll(() => {
  const proto = HTMLMediaElement.prototype;
  for (const name of faked) originals.set(name, Object.getOwnPropertyDescriptor(proto, name));
  Object.defineProperty(proto, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return of(this).paused;
    },
  });
  Object.defineProperty(proto, "currentTime", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return of(this).time;
    },
    set(this: HTMLMediaElement, seconds: number) {
      of(this).time = seconds;
    },
  });
  Object.defineProperty(proto, "duration", {
    configurable: true,
    get(this: HTMLMediaElement) {
      const state = of(this);
      return state.length ?? (state.ready === 0 ? Number.NaN : 900);
    },
  });
  Object.defineProperty(proto, "readyState", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return of(this).ready ?? 1;
    },
  });
  Object.defineProperty(proto, "error", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return of(this).error ?? null;
    },
  });
});
afterAll(() => {
  const proto = HTMLMediaElement.prototype;
  for (const name of faked) {
    const original = originals.get(name);
    if (original) Object.defineProperty(proto, name, original);
  }
});

function fakePlayback() {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    of(this).paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (of(this).paused) return;
    of(this).paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  return { play, pause };
}

/** The element has played to `seconds`. */
const heard = (seconds: number) =>
  act(() => {
    audio().currentTime = seconds;
    audio().dispatchEvent(new Event("timeupdate"));
  });

afterEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Podcasts' library on the desktop's Ferrite application", () => {
  it("reads only a library in the module's shape, the one saved before real feeds included", () => {
    const old = {
      subscribed: ["signal-path"],
      played: [],
      positions: { "signal-path-12": 600 },
      settings: { ...DEFAULT_SETTINGS, skipForward: 45 },
    };
    expect(podcastsLibraryReadable({ library: null, rev: 0 })).toBe(true);
    expect(podcastsLibraryReadable({ library: old })).toBe(true);
    expect(podcastsLibraryFromServer({ library: old })).toMatchObject({
      shows: [],
      queue: [],
      current: null,
      speed: 1,
    });
    expect(podcastsLibraryFromServer({ library: null })).toEqual(EMPTY_LIBRARY);
    for (const wrong of [
      { ...old, settings: { ...old.settings, skipBack: 20 } },
      { ...old, positions: { a: -1 } },
      { ...old, speed: 3 },
      { ...old, queue: [{ id: "x" }] },
      { ...old, shows: "all" },
    ]) {
      expect(podcastsLibraryReadable({ library: wrong })).toBe(false);
      expect(podcastsLibraryFromServer({ library: wrong })).toBeUndefined();
    }
  });

  it("keeps every field the module keeps, the place in each started episode in whole seconds", () => {
    const state: PodcastsLibraryState = {
      ...EMPTY_LIBRARY,
      shows: [followed(1)],
      positions: { e1: 37.4, e2: 8.9 },
      played: ["b", "a", "a"],
      queue: [episode(1)],
      current: episode(0),
      speed: 1.5,
    };
    const kept = podcastsLibrary(state);
    expect(kept.positions).toEqual({ e1: 37, e2: 8 });
    expect(podcastsLibraryToServer(state).library.positions).toEqual({ e1: 37, e2: 8 });
    // A place stored is read back.
    expect(
      podcastsLibraryFromServer({ library: { ...stored(), positions: { e1: 95 } }, rev: 2 })
        ?.positions,
    ).toEqual({ e1: 95 });
    // At most the module's count of places, the ones set last; none past its longest episode.
    const many = Object.fromEntries(
      Array.from({ length: PODCASTS_LIMITS.items + 5 }, (_, n) => [`p${n}`, n]),
    );
    const bounded = podcastsLibraryToServer({
      ...state,
      positions: { ...many, late: 999_999 },
    }).library.positions;
    expect(Object.keys(bounded)).toHaveLength(PODCASTS_LIMITS.items);
    expect(bounded.p0).toBeUndefined();
    expect(bounded.late).toBe(PODCASTS_LIMITS.position);
    expect(kept.subscribed).toEqual(["510318"]);
    expect(kept.played).toEqual(["b", "a"]);
    expect(Object.keys(podcastsLibraryToServer(kept).library)).toEqual([
      "subscribed",
      "played",
      "positions",
      "settings",
      "shows",
      "queue",
      "current",
      "speed",
    ]);
    expect(maxAgeOf("Every 6 Hours")).toBe(21_600);
    expect(maxAgeOf("Manually")).toBe(30 * 86_400);
    expect(speedLabel(1.25)).toBe("1.25×");
    expect(shortDay(NOW - 40 * DAY, NOW)).toMatch(/^[A-Z][a-z]{2} \d/);
  });

  it("sends every title, publisher and picture within the module's limits, however long the feed's are", () => {
    // A UTF-16 cut at 200 units would end this in half a character.
    const long = `a${"\u{1F399}".repeat(300)}`;
    const state: PodcastsLibraryState = {
      ...EMPTY_LIBRARY,
      shows: [
        {
          ...followed(1),
          title: long,
          author: "N".repeat(400),
          genre: "G".repeat(250),
          artwork: `https://media.example.org/${"a".repeat(1100)}.jpg`,
        },
      ],
      queue: [
        { ...episode(1), title: " \u3000 ", showTitle: long, kind: `audio/${"x".repeat(200)}` },
      ],
      current: {
        ...episode(0),
        title: long.slice(0, 200),
        artwork: `https://media.example.org/${"b".repeat(1100)}.jpg`,
      },
    };
    expect(refusal(podcastsLibraryToServer(state).library)).toBeNull();
    expect(refusal(podcastsLibraryToServer(podcastsLibrary(state)).library)).toBeNull();

    // A library every field of which is within its limit can still be too large as a whole:
    // what matters least goes until it fits, and the episode loaded is kept.
    const address = (n: number) => `https://media.example.org/${String(n).padStart(900, "0")}.jpg`;
    const huge: PodcastsLibraryState = {
      ...EMPTY_LIBRARY,
      shows: Array.from({ length: 100 }, (_, n) => ({
        ...followed(1),
        id: String(1000 + n),
        title: "T".repeat(200),
        author: "A".repeat(200),
        artwork: address(n),
      })),
      subscribed: Array.from({ length: 100 }, (_, n) => String(1000 + n)),
      queue: Array.from({ length: 50 }, (_, n) => ({
        ...episode(1),
        id: `1000.${String(n).padStart(16, "0")}`,
        title: "E".repeat(200),
        artwork: address(n),
      })),
      played: Array.from({ length: 1000 }, (_, n) => `9${n}.${"f".repeat(16)}`),
      current: episode(0),
    };
    const whole = JSON.stringify({ ...huge, played: [] });
    expect(new TextEncoder().encode(whole).length).toBeGreaterThan(190_000);
    const fitted = podcastsLibraryToServer(huge).library;
    expect(refusal(fitted)).toBeNull();
    expect(fitted.current?.id).toBe(episode(0).id);
    expect(fitted.played).toEqual([]);
    expect(fitted.subscribed).toEqual(fitted.shows.map((show) => show.id));
    // A library within the limit is not trimmed at all.
    expect(
      podcastsLibraryToServer({ ...huge, shows: [], subscribed: [], queue: [] }).library.played,
    ).toHaveLength(1000);

    // The latest shows go last, and an id is followed exactly when its show is kept.
    const heavy = huge.shows.map((show) => ({
      ...show,
      title: "€".repeat(200),
      author: "€".repeat(200),
      genre: "€".repeat(200),
      feed: `https://feeds.npr.org/${"f".repeat(900)}.xml`,
      artwork: null,
    }));
    const trimmed = podcastsLibraryToServer({
      ...EMPTY_LIBRARY,
      shows: heavy,
      current: episode(0),
      subscribed: [...heavy.map((show) => show.id), "7001"],
    }).library;
    expect(refusal(trimmed)).toBeNull();
    expect(trimmed.shows.length).toBeGreaterThan(0);
    expect(trimmed.shows.length).toBeLessThan(heavy.length);
    expect(trimmed.shows.map((show) => show.id)).toEqual(
      heavy.slice(0, trimmed.shows.length).map((show) => show.id),
    );
    expect(trimmed.subscribed).toEqual(trimmed.shows.map((show) => show.id));

    // The oldest played episodes go first: what is left is the end of the list, in its order.
    // The library is made a little larger than the limit, so only some of them go.
    const played = Array.from({ length: 1000 }, (_, n) => `${n}.${"p".repeat(120)}`);
    let shows = huge.shows;
    const roomy = () => ({
      ...EMPTY_LIBRARY,
      shows,
      subscribed: shows.map((show) => show.id),
      queue: huge.queue,
      current: episode(0),
      played,
    });
    const sentOf = (library: PodcastsLibraryState) =>
      podcastsLibraryToServer(podcastsLibrary(library)).library;
    const over = () => libraryBytes(podcastsLibrary(roomy())) - PODCASTS_LIMITS.bytes;
    while (over() > 40_000 && shows.length > 0) shows = shows.slice(0, -1);
    expect(over()).toBeGreaterThan(0);
    const some = sentOf(roomy());
    expect(refusal(some)).toBeNull();
    expect(some.played.length).toBeGreaterThan(0);
    expect(some.played.length).toBeLessThan(played.length);
    expect(some.played).toEqual(played.slice(-some.played.length));

    const sent = podcastsLibraryToServer(state).library;
    const title = sent.shows[0]?.title ?? "";
    expect(Array.from(title)).toHaveLength(200);
    expect(title.endsWith("\u2026")).toBe(true);
    // Cut on a character boundary: what is kept is the start of the title.
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
    expect(sent.shows[0]?.author).toBe(`${"N".repeat(199)}\u2026`);
    expect(sent.shows[0]?.genre).toBe(`${"G".repeat(199)}\u2026`);
    expect(sent.shows[0]?.artwork).toBeNull();
    expect(sent.queue[0]?.title).toBe(UNTITLED_EPISODE);
    expect(sent.queue[0]?.kind).toBeNull();
    expect(sent.current?.title).toBe(`a${"\u{1F399}".repeat(99)}\uFFFD`);
    expect(sent.current?.artwork).toBeNull();
    // The module counts characters, not UTF-16 units: 200 of them are kept whole.
    expect(limitText("\u{1F399}".repeat(200))).toBe("\u{1F399}".repeat(200));

    // A library within the limits is sent as it is.
    const fine = podcastsLibrary({
      ...EMPTY_LIBRARY,
      shows: [followed(1)],
      queue: [episode(1)],
      current: episode(0),
    });
    expect(podcastsLibraryToServer(fine).library).toEqual(fine);
  });

  it("is the demo, asking no server, when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopPodcasts />);
    expect(fetch).not.toHaveBeenCalled();
    expect(frame()).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("heading", { name: "Up Next", level: 3 })).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
  });
});

describe("Podcasts served by the desktop's Ferrite application", () => {
  it("opens the show of a new episode's notification, and leaves Spotlight's ids alone", async () => {
    expect(showOfOpenItem("episode-510318.aaaa.bbbb")).toBe("510318");
    expect(showOfOpenItem("510318.aaaa")).toBe("510318.aaaa");
    expect(showOfOpenItem("510318")).toBe("510318");

    serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }));
    render(<DesktopPodcasts defaultSection="episodes" />);
    await loaded();
    act(() => openItem({ app: "podcasts", id: "episode-510318.aaaa", title: "Up First" }));
    expect(await screen.findByRole("button", { name: /Subscribed|Unsubscribe/ })).toBeVisible();
  });

  it("finds a show with Apple's search, follows it, and says why another cannot be followed", async () => {
    const user = userEvent.setup();
    const fetch = serve(null, { rev: 0 });
    render(<DesktopPodcasts />);
    expect(frame()).toHaveAttribute("aria-busy", "true");
    await loaded();
    expect(saves(fetch)).toEqual([]);

    await user.type(screen.getByRole("searchbox"), "up first");
    const results = await screen.findByRole("region", { name: "Shows" });
    expect(asked(fetch, "/api/podcasts/search")).toEqual(["/api/podcasts/search?term=up%20first"]);

    // A show on a host this desktop cannot reach: its page says why, and nothing is asked of it.
    await user.click(within(results).getByRole("button", { name: /Elsewhere Weekly/ }));
    expect(screen.getByText(/feeds\.example\.org, which is not one of/)).toBeInTheDocument();
    expect(unavailable(button("Unavailable"))).toBe(true);
    expect(asked(fetch, "/api/podcasts/feed")).toEqual([]);
    await user.click(button("Back to Search"));

    await user.click(
      within(await screen.findByRole("region", { name: "Shows" })).getByRole("button", {
        name: /Up First from NPR/,
      }),
    );
    expect(await screen.findByRole("button", { name: "Play Tuesday's News" })).toBeInTheDocument();
    expect(asked(fetch, "/api/podcasts/feed")[0]).toBe(
      `/api/podcasts/feed?url=${encodeURIComponent(FEED)}&max_age=3600`,
    );
    await user.click(button("Subscribe"));
    await waitFor(() => expect(lastSave(fetch)?.shows).toHaveLength(1));
    expect(lastSave(fetch)?.shows[0]).toEqual({
      ...followed(feed.episodes[0]?.published ?? 0),
      // What the feed holds when the show is followed is not new.
    });
    expect(lastSave(fetch)?.subscribed).toEqual(["510318"]);

    await user.clear(screen.getByRole("searchbox"));
    await user.click(place("Shows"));
    expect(
      [
        ...screen
          .getByRole("region", { name: "1 Show" })
          .querySelectorAll(".mac-card-grid-card-title"),
      ].map((title) => title.textContent),
    ).toEqual(["Up First from NPR"]);
  });

  it("plays an episode from its publisher, and keeps its place every ten seconds and at a pause and a skip", async () => {
    const user = userEvent.setup();
    const { play } = fakePlayback();
    const fetch = serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }));
    render(<DesktopPodcasts defaultSection="episodes" />);
    await loaded();
    await user.click(await screen.findByRole("button", { name: "Play Tuesday's News" }));
    expect(audio().src).toBe("https://play.podtrac.com/npr-510318/tuesday.mp3");
    expect(play).toHaveBeenCalled();
    expect(display()).toHaveTextContent("Tuesday's News");
    expect(button("Pause")).toBeInTheDocument();
    const id = "510318.aaaaaaaaaaaaaaaa";
    await waitFor(() => expect(lastSave(fetch)?.current?.id).toBe(id));

    // Ten seconds and more heard: the place is saved.
    heard(37);
    expect(within(display()).getByText("0:37")).toBeInTheDocument();
    await waitFor(() => expect(lastSave(fetch)?.positions[id]).toBe(37));
    // Less than ten more: shown, and not saved.
    heard(41);
    heard(44);
    heard(46);
    expect(within(display()).getByText("0:46")).toBeInTheDocument();
    await act(() => new Promise((done) => setTimeout(done, 100)));
    expect(saves(fetch).some((library) => [41, 44, 46].includes(library.positions[id] ?? -1))).toBe(
      false,
    );
    // A pause saves the place to the second.
    await user.click(button("Pause"));
    await waitFor(() => expect(lastSave(fetch)?.positions[id]).toBe(46));

    // Skipping moves the element and the display, and is saved.
    await user.click(button("Forward 30 seconds"));
    expect(audio().currentTime).toBe(76);
    expect(within(display()).getByText("1:16")).toBeInTheDocument();
    await waitFor(() => expect(lastSave(fetch)?.positions[id]).toBe(76));

    // Heard to its end: played, and its place is forgotten.
    act(() => {
      audio().dispatchEvent(new Event("ended"));
    });
    await waitFor(() => expect(lastSave(fetch)?.played).toEqual([id]));
    expect(lastSave(fetch)?.current).toBeNull();
    expect(lastSave(fetch)?.positions[id]).toBeUndefined();
  });

  it("puts Play, Pause, the skips and Up Next in the desktop's Controls menu, each acting on the audio element", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    fakePlayback();
    serve(
      stored({
        shows: [followed(NOW)],
        subscribed: ["510318"],
        current: episode(0),
        queue: [episode(1)],
      }),
    );
    function ControlsMenu() {
      const items = useDesktopAppMenuItems("podcasts", "Controls");
      return (
        <MenuBar aria-label="Menus">
          <MenuBarMenu title="Controls">{items}</MenuBarMenu>
        </MenuBar>
      );
    }
    render(
      <>
        <ControlsMenu />
        <DesktopPodcasts />
      </>,
    );
    await loaded();
    fireEvent(audio(), new Event("loadedmetadata"));
    const choose = async (name: string) => {
      await user.click(screen.getByRole("menuitem", { name: "Controls" }));
      await user.click(await screen.findByRole("menuitem", { name }));
    };
    const { skipForward, skipBack } = DEFAULT_SETTINGS;
    await choose("Play");
    expect(audio().paused).toBe(false);
    await choose("Pause");
    expect(audio().paused).toBe(true);
    await choose(`Skip Forward ${skipForward} Seconds`);
    expect(audio().currentTime).toBe(skipForward);
    await choose(`Skip Back ${skipBack} Seconds`);
    expect(audio().currentTime).toBe(Math.max(0, skipForward - skipBack));
    await choose("Play Next in Up Next");
    expect(audio().src).toBe(episode(1).audio);
    expect(display()).toHaveTextContent("Monday's News");
    // Nothing left in Up Next: that command is dimmed.
    await user.click(screen.getByRole("menuitem", { name: "Controls" }));
    expect(unavailable(await screen.findByRole("menuitem", { name: "Play Next in Up Next" }))).toBe(
      true,
    );
  });

  it("tells of an episode that cannot be played, and not of an error the browser plays on through", async () => {
    const user = userEvent.setup();
    fakePlayback();
    serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }));
    render(<DesktopPodcasts defaultSection="episodes" />);
    await loaded();
    await user.click(await screen.findByRole("button", { name: "Play Tuesday's News" }));
    const moment = () => act(() => new Promise((done) => setTimeout(done, ERROR_GRACE_MS + 100)));
    // Firefox without a sound device reports an output error and carries on playing: its time
    // moves on, so nothing is said.
    act(() => {
      of(audio()).ready = 4;
      of(audio()).error = { code: 3 };
      audio().dispatchEvent(new Event("error"));
      of(audio()).time = 2;
    });
    await moment();
    expect(button("Pause")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    // An error after which the time stands still, though the element still says it plays and
    // holds data, is a failure: the window says so and stops the episode.
    act(() => {
      of(audio()).error = { code: 2 };
      audio().dispatchEvent(new Event("error"));
    });
    expect(screen.queryByRole("alert")).toBeNull();
    await moment();
    expect(button("Play")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded from its publisher/);

    // An element that stopped has failed at once.
    await user.click(button("Play"));
    act(() => {
      of(audio()).paused = true;
      of(audio()).ready = 0;
      of(audio()).error = { code: 4 };
      audio().dispatchEvent(new Event("error"));
    });
    expect(button("Play")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot play the episode's audio/);
  });

  it("no longer counts an episode as played once Continuous Playback starts it again", async () => {
    const user = userEvent.setup();
    fakePlayback();
    const fetch = serve(
      stored({
        shows: [followed(NOW)],
        subscribed: ["510318"],
        current: episode(0),
        queue: [episode(1)],
        played: [episode(1).id],
      }),
    );
    render(<DesktopPodcasts />);
    await loaded();
    await user.click(button("Play"));
    act(() => {
      audio().dispatchEvent(new Event("ended"));
    });
    expect(display()).toHaveTextContent("Monday's News");
    await waitFor(() => expect(lastSave(fetch)?.current?.id).toBe(episode(1).id));
    expect(lastSave(fetch)?.played).toEqual([episode(0).id]);
  });

  it("queues episodes in Up Next, plays them in turn, and sets the speed", async () => {
    const user = userEvent.setup();
    fakePlayback();
    const fetch = serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }));
    render(<DesktopPodcasts defaultSection="episodes" />);
    await loaded();
    await user.click(await screen.findByRole("button", { name: "Add Monday's News to Up Next" }));
    await user.click(button("Add Tuesday's News to Up Next"));
    await waitFor(() =>
      expect(lastSave(fetch)?.queue.map((item) => item.title)).toEqual([
        "Monday's News",
        "Tuesday's News",
      ]),
    );
    expect(lastSave(fetch)?.queue[0]).toEqual(episode(1));

    await user.click(button("Up Next"));
    const queue = screen.getByRole("region", { name: "Queue" });
    await user.click(
      within(queue).getByRole("button", { name: "Change Tuesday's News in Up Next" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Move Up" }));
    await waitFor(() =>
      expect(lastSave(fetch)?.queue.map((item) => item.title)).toEqual([
        "Tuesday's News",
        "Monday's News",
      ]),
    );

    // Play with nothing loaded starts Up Next; the episode leaves it.
    await user.click(button("Play"));
    expect(display()).toHaveTextContent("Tuesday's News");
    await waitFor(() =>
      expect(lastSave(fetch)?.queue.map((item) => item.title)).toEqual(["Monday's News"]),
    );

    await user.click(button(`Playback speed ${speedLabel(1)}`));
    expect(button(`Playback speed ${speedLabel(1.25)}`)).toBeInTheDocument();
    expect(audio().playbackRate).toBe(1.25);
    await waitFor(() => expect(lastSave(fetch)?.speed).toBe(1.25));

    // Continuous Playback goes on to what Up Next holds.
    act(() => {
      audio().dispatchEvent(new Event("ended"));
    });
    expect(display()).toHaveTextContent("Monday's News");
    expect(audio().src).toBe("https://play.podtrac.com/npr-510318/monday.mp3");
    await waitFor(() => expect(lastSave(fetch)?.queue).toEqual([]));
  });

  it("comes back after a reload with the episode loaded at its place, Up Next and the speed", async () => {
    const user = userEvent.setup();
    fakePlayback();
    const current = episode(0);
    serve(
      stored({
        shows: [followed(NOW)],
        subscribed: ["510318"],
        current,
        queue: [episode(1)],
        speed: 1.5,
        positions: { [current.id]: 95 },
      }),
    );
    render(<DesktopPodcasts />);
    await loaded();
    expect(display()).toHaveTextContent("Tuesday's News");
    expect(within(display()).getByText("1:35")).toBeInTheDocument();
    expect(button("Play")).toBeInTheDocument();
    expect(audio().src).toBe(current.audio);
    expect(audio().playbackRate).toBe(1.5);
    expect(button(`Playback speed ${speedLabel(1.5)}`)).toBeInTheDocument();
    // Once the element has loaded the episode's metadata, it is put at the place kept.
    fireEvent(audio(), new Event("loadedmetadata"));
    expect(audio().currentTime).toBe(95);

    // Listen Now's Up Next shelf, and the queue panel, list what was queued.
    expect(button("Monday's News, Up First from NPR")).toBeInTheDocument();
    await user.click(button("Up Next"));
    expect(screen.getByRole("region", { name: "Queue" })).toHaveTextContent("Monday's News");
    // The loaded episode's notes come from its feed.
    await user.click(button("Episode Notes"));
    expect(await screen.findByText("And one more.")).toBeInTheDocument();
  });

  it("loads the episode and Up Next another window chose, and stops this window's", async () => {
    const user = userEvent.setup();
    fakePlayback();
    serve(
      stored({
        shows: [followed(NOW)],
        subscribed: ["510318"],
        current: episode(0),
        queue: [episode(1)],
      }),
    );
    render(
      <>
        <DesktopPodcasts />
        <DesktopPodcasts />
      </>,
    );
    const [here, there] = windows();
    await waitFor(() => {
      expect(here).not.toHaveAttribute("aria-busy");
      expect(there).not.toHaveAttribute("aria-busy");
    });
    await user.click(within(here).getByRole("button", { name: "Play" }));
    expect(audioOf(here).src).toBe(episode(0).audio);
    // The other window plays Monday's News from Up Next.
    await user.click(
      within(there).getByRole("button", { name: "Monday's News, Up First from NPR" }),
    );
    await waitFor(() => expect(audioOf(here).src).toBe(episode(1).audio));
    expect(audioOf(here).paused).toBe(true);
    expect(within(here).getByRole("group", { name: "Now Playing" })).toHaveTextContent(
      "Monday's News",
    );
    expect(
      within(here).queryByRole("button", { name: "Monday's News, Up First from NPR" }),
    ).toBeNull();
  });

  it("plays on at a speed set in another window, without restarting the episode", async () => {
    const user = userEvent.setup();
    fakePlayback();
    const current = episode(0);
    serve(
      stored({
        shows: [followed(NOW)],
        subscribed: ["510318"],
        current,
        queue: [],
      }),
    );
    render(
      <>
        <DesktopPodcasts />
        <DesktopPodcasts />
      </>,
    );
    const [here, there] = windows();
    await waitFor(() => {
      expect(here).not.toHaveAttribute("aria-busy");
      expect(there).not.toHaveAttribute("aria-busy");
    });
    fireEvent(audioOf(here), new Event("loadedmetadata"));
    await user.click(within(here).getByRole("button", { name: "Play" }));
    expect(audioOf(here).playbackRate).toBe(1);
    act(() => {
      of(audioOf(here)).time = 33;
    });

    // The other window's speed button, while this one keeps playing.
    await user.click(
      within(there).getByRole("button", { name: `Playback speed ${speedLabel(1)}` }),
    );
    await waitFor(() =>
      expect(
        within(here).getByRole("button", { name: `Playback speed ${speedLabel(1.25)}` }),
      ).toBeInTheDocument(),
    );
    expect(audioOf(here).playbackRate).toBe(1.25);
    expect(audioOf(here).defaultPlaybackRate).toBe(1.25);
    // The same episode plays on, where it was.
    expect(audioOf(here).src).toBe(current.audio);
    expect(audioOf(here).currentTime).toBe(33);
    expect(within(here).getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("opens again with what it saved: the episode at its place, and the speed", async () => {
    const user = userEvent.setup();
    fakePlayback();
    const fetch = serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }));
    const first = render(<DesktopPodcasts defaultSection="episodes" />);
    await loaded();
    await user.click(await screen.findByRole("button", { name: "Play Tuesday's News" }));
    heard(45);
    await user.click(button("Pause"));
    await user.click(button(`Playback speed ${speedLabel(1)}`));
    await waitFor(() => expect(lastSave(fetch)?.speed).toBe(1.25));
    expect(lastSave(fetch)?.positions["510318.aaaaaaaaaaaaaaaa"]).toBe(45);
    first.unmount();

    // A new window reads the library from the server, as a reload does: nothing is seeded.
    render(<DesktopPodcasts />);
    // The element loads nothing before Play.
    of(audio()).ready = 0;
    await loaded();
    expect(display()).toHaveTextContent("Tuesday's News");
    expect(within(display()).getByText("0:45")).toBeInTheDocument();
    expect(button(`Playback speed ${speedLabel(1.25)}`)).toBeInTheDocument();
    // The episode loads at the normal speed, and takes the person's with its metadata.
    expect(audio().playbackRate).toBe(1);
    of(audio()).ready = 1;
    fireEvent(audio(), new Event("loadedmetadata"));
    expect(audio().currentTime).toBe(45);
    expect(audio().playbackRate).toBe(1.25);
  });

  describe("when the element reports a length of no use yet, as WebKit does for a redirected episode", () => {
    const reopened = async () => {
      const user = userEvent.setup();
      fakePlayback();
      const fetch = serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }));
      const first = render(<DesktopPodcasts defaultSection="episodes" />);
      await loaded();
      await user.click(await screen.findByRole("button", { name: "Play Tuesday's News" }));
      heard(45);
      await user.click(button("Pause"));
      await user.click(button(`Playback speed ${speedLabel(1)}`));
      await waitFor(() => expect(lastSave(fetch)?.speed).toBe(1.25));
      first.unmount();
      render(<DesktopPodcasts />);
      of(audio()).ready = 0;
      await loaded();
      of(audio()).ready = 1;
    };

    it("goes to the place kept once the length is real, at the normal speed until then", async () => {
      await reopened();
      of(audio()).length = 0;
      fireEvent(audio(), new Event("loadedmetadata"));
      expect(audio().currentTime).toBe(0);
      expect(audio().playbackRate).toBe(1);
      of(audio()).length = 925;
      fireEvent(audio(), new Event("durationchange"));
      expect(audio().currentTime).toBe(45);
      expect(audio().playbackRate).toBe(1.25);
    });

    it("goes there once its time moves, when the length stays too short to reach it", async () => {
      await reopened();
      of(audio()).length = 10;
      fireEvent(audio(), new Event("loadedmetadata"));
      fireEvent(audio(), new Event("timeupdate"));
      expect(audio().currentTime).toBe(0);
      of(audio()).time = 1;
      fireEvent(audio(), new Event("timeupdate"));
      expect(audio().currentTime).toBe(45);
    });
  });

  it("stops the episode when the window closes", async () => {
    const user = userEvent.setup();
    const { pause } = fakePlayback();
    serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }));
    const view = render(<DesktopPodcasts defaultSection="episodes" />);
    await loaded();
    await user.click(await screen.findByRole("button", { name: "Play Tuesday's News" }));
    const element = audio();
    expect(element.paused).toBe(false);
    view.unmount();
    expect(pause).toHaveBeenCalled();
    expect(element.paused).toBe(true);
    expect(element.hasAttribute("src")).toBe(false);
  });

  it("marks and announces the episodes published since the person last looked", async () => {
    const user = userEvent.setup();
    const fetch = serve(stored({ shows: [followed(NOW - 1.5 * DAY)], subscribed: ["510318"] }));
    render(<DesktopPodcasts />);
    await loaded();
    const notice = await screen.findByText("1 new episode since you last looked");
    expect(notice.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(place(/^Listen Now/)).toHaveTextContent("1");
    const list = screen.getByRole("region", { name: "New Episodes" });
    expect(within(list).getByText("Tuesday's News")).toBeInTheDocument();
    // The feed was asked for with the Refresh interval: the server reads it again when older.
    expect(asked(fetch, "/api/podcasts/feed")).toEqual([
      `/api/podcasts/feed?url=${encodeURIComponent(FEED)}&max_age=3600`,
    ]);

    await user.click(
      within(notice.closest("[role]") as HTMLElement).getByRole("button", { name: "Mark as Seen" }),
    );
    await waitFor(() => expect(lastSave(fetch)?.shows[0]?.seen).toBe(feed.episodes[0]?.published));
    expect(screen.queryByText(/new episode/)).toBeNull();

    // Command-R reads every followed feed again.
    fireEvent.keyDown(frame(), { key: "r", ctrlKey: true });
    await waitFor(() => expect(asked(fetch, "/api/podcasts/feed")).toHaveLength(2));
    expect(asked(fetch, "/api/podcasts/feed")[1]).toMatch(/max_age=0$/);
  });

  it("looks the chart's shows up again after a failed lookup, when Browse or Top Charts is chosen", async () => {
    const user = userEvent.setup();
    const fetch = serve(null, { rev: 0, lookupFailures: 1 });
    render(<DesktopPodcasts defaultSection="top-charts" />);
    await loaded();
    const refused = await screen.findByRole("button", {
      name: /^Up First from NPR cannot be followed here: Its feed could not be looked up/,
    });
    expect(unavailable(refused)).toBe(true);
    // Choosing Browse, the other place that lists the chart, asks again.
    await user.click(place("Browse"));
    await waitFor(() => expect(asked(fetch, "/api/podcasts/lookup")).toHaveLength(2));
    await user.click(place("Top Charts"));
    await user.click(await screen.findByRole("button", { name: "Subscribe to Up First from NPR" }));
    await waitFor(() => expect(lastSave(fetch)?.shows[0]?.feed).toBe(FEED));
    expect(asked(fetch, "/api/podcasts/lookup")).toHaveLength(2);
  });

  it("lists Apple's chart and follows only the shows it can read", async () => {
    const user = userEvent.setup();
    const fetch = serve(null, { rev: 0 });
    render(<DesktopPodcasts defaultSection="top-charts" />);
    await loaded();
    await screen.findByRole("region", { name: "Top Shows" });
    const blocked = await screen.findByRole("button", {
      name: /^Elsewhere Weekly cannot be followed here: Its feed is published from feeds\.example\.org/,
    });
    expect(unavailable(blocked)).toBe(true);
    expect(asked(fetch, "/api/podcasts/lookup")).toEqual(["/api/podcasts/lookup?ids=510318,1234"]);
    await user.click(button("Subscribe to Up First from NPR"));
    await waitFor(() => expect(lastSave(fetch)?.shows[0]?.feed).toBe(FEED));
    expect(button("Unsubscribe from Up First from NPR")).toBeInTheDocument();
  });

  it("reads a chart show's episodes once its feed is looked up, though its page opened first", async () => {
    const user = userEvent.setup();
    let answerLookup = () => {};
    const lookup = new Promise<void>((resolve) => {
      answerLookup = resolve;
    });
    const fetch = serve(null, { rev: 0, lookup });
    render(<DesktopPodcasts defaultSection="top-charts" />);
    await loaded();
    await user.click(await screen.findByRole("button", { name: "Open Up First from NPR" }));
    expect(screen.getByText("Its feed is still being looked up.")).toBeInTheDocument();
    expect(asked(fetch, "/api/podcasts/feed")).toEqual([]);

    await act(async () => answerLookup());
    expect(await screen.findByRole("button", { name: "Play Tuesday's News" })).toBeInTheDocument();
    expect(screen.queryByText("Reading the show's episodes…")).toBeNull();
    const once = [`/api/podcasts/feed?url=${encodeURIComponent(FEED)}&max_age=3600`];
    expect(asked(fetch, "/api/podcasts/feed")).toEqual(once);
    // Following it asks for nothing more: the feed is read.
    await user.click(button("Subscribe"));
    await waitFor(() => expect(lastSave(fetch)?.shows).toHaveLength(1));
    expect(asked(fetch, "/api/podcasts/feed")).toEqual(once);
  });

  it("keeps open Preferences busy and inert until the library is loaded, then shows its settings", async () => {
    serve(stored({ settings: { ...DEFAULT_SETTINGS, skipForward: 45 } }));
    render(<DesktopPodcasts defaultPreferencesOpen />);
    const preferences = () => document.querySelector(".mac-podcasts-preferences");
    expect(preferences()).toHaveAttribute("aria-busy", "true");
    expect(preferences()).toHaveAttribute("inert");
    await loaded();
    expect(preferences()).not.toHaveAttribute("aria-busy");
    expect(preferences()).not.toHaveAttribute("inert");
    expect(button("Forward 45 seconds")).toBeInTheDocument();
  });

  it("does not list a feed reply that is not in the module's shape", async () => {
    const user = userEvent.setup();
    const malformed = {
      feed: { ...feed, episodes: [{ ...feed.episodes[0], audio: "https://example.org/a.mp3" }] },
      stale: false,
      error: null,
    };
    serve(stored({ shows: [followed(NOW)], subscribed: ["510318"] }), { feedReply: malformed });
    render(<DesktopPodcasts defaultSection="shows" />);
    await loaded();
    await user.click(
      within(screen.getByRole("region", { name: "1 Show" })).getByRole("button", {
        name: /Up First from NPR/,
      }),
    );
    expect(
      await screen.findByText("The episodes could not be read: not a feed reply"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Play / })).toBeNull();
  });

  it("says that episodes are never downloaded, where Podcasts offers downloads", async () => {
    const user = userEvent.setup();
    serve(null, { rev: 0 });
    render(<DesktopPodcasts defaultSection="downloaded" />);
    await loaded();
    expect(screen.getByText(DOWNLOADS_NOTE)).toBeInTheDocument();
    fireEvent.keyDown(frame(), { key: ",", metaKey: true });
    const general = await screen.findByRole("region", { name: "General" });
    expect(within(general).getByText(DOWNLOADS_NOTE)).toBeInTheDocument();
    expect(
      unavailable(
        within(general).getByRole("combobox", { name: "Automatically Download Episodes:" }),
      ),
    ).toBe(true);
    await user.click(within(general).getByRole("button", { name: "Close" }));
  });

  it("saves nothing over a stored library it cannot read, and says so", async () => {
    const user = userEvent.setup();
    const fetch = serve({ subscribed: "all" });
    render(<DesktopPodcasts defaultSection="top-charts" />);
    await loaded();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be read/);
    await user.click(await screen.findByRole("button", { name: "Subscribe to Up First from NPR" }));
    expect(button("Unsubscribe from Up First from NPR")).toBeInTheDocument();
    expect(saves(fetch)).toEqual([]);
  });
});
