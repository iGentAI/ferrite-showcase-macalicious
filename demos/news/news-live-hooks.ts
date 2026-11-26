import { useCallback, useEffect, useRef, useState } from "react";
import { sessionFetch, useServerState, withDeadline } from "../desktop/desktop-server";
import {
  articleFromServer,
  catalogueFromServer,
  feedFromServer,
  type LiveCatalogue,
  type LiveFeed,
  libraryFromServer,
  libraryReadable,
  libraryToServer,
  NEWS_URLS,
  type NewsLibrary,
  type StoryArticle,
  storyArticleUrl,
} from "./news-live";

/** The channels a person follows before changing anything: the server's catalogue says the same. */
export const DEFAULT_FOLLOWING: readonly string[] = ["bbc", "npr", "guardian", "ars"];

export const EMPTY_LIBRARY: NewsLibrary = {
  following: DEFAULT_FOLLOWING,
  blocked: [],
  saved: [],
  history: [],
};

/** The least time between two requests for one feed, in milliseconds. */
export const RETRY_MS = 60_000;

/**
 * Whether the window should ask for a feed now: it has none; or, a minute or more after its last
 * request, what it has is missing, stale, or read by the server (`fetched`) `freshMs` or more ago.
 */
export function feedNeedsRead(state: FeedState | undefined, now: number, freshMs: number): boolean {
  if (!state) return true;
  if (state.loading || now - state.asked < RETRY_MS) return false;
  const feed = state.feed;
  return !feed || feed.stale || now - feed.fetched >= freshMs;
}

/** One feed in the window: what was answered, and whether a read is under way. */
export interface FeedState {
  feed?: LiveFeed;
  loading: boolean;
  /** Why the last request failed, when nothing could be shown. */
  error?: string;
  /** When the window last asked (page clock), to space out requests. */
  asked: number;
}

export async function getJson(
  url: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    const body = await response.json().catch(() => undefined);
    return { ok: response.ok, status: response.status, body };
  });
}

let catalogueRequest: Promise<LiveCatalogue | undefined> | null = null;

/** How many times a page reads the catalogue before it says News is not available, and the
 * pause before each further try. */
export const CATALOGUE_ATTEMPTS = 3;
export const CATALOGUE_RETRY_MS = 1_500;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One read of the catalogue. */
const readCatalogue = () =>
  getJson(NEWS_URLS.catalogue)
    .then((reply) => (reply.ok ? catalogueFromServer(reply.body) : undefined))
    .catch(() => undefined);

/**
 * The catalogue, read once per page and tried up to `CATALOGUE_ATTEMPTS` times; when every try
 * failed, the next caller (Try Again) reads it afresh.
 */
function loadCatalogue(): Promise<LiveCatalogue | undefined> {
  if (!catalogueRequest) {
    const request = (async () => {
      for (let attempt = 1; attempt <= CATALOGUE_ATTEMPTS; attempt += 1) {
        const catalogue = await readCatalogue();
        if (catalogue) return catalogue;
        if (attempt < CATALOGUE_ATTEMPTS) await pause(CATALOGUE_RETRY_MS * attempt);
      }
      return undefined;
    })();
    catalogueRequest = request;
    void request.then((catalogue) => {
      if (!catalogue && catalogueRequest === request) catalogueRequest = null;
    });
  }
  return catalogueRequest;
}

const errorOf = (body: unknown, status: number) => {
  const error = (body as { error?: unknown } | undefined)?.error;
  return typeof error === "string" ? error : `The server answered ${status}.`;
};

/**
 * A story's article, read when the story is opened and kept only while it is. Every failure is an
 * answer the reader shows beside the feed's summary.
 */
export function useStoryArticle(link: string | undefined, publisher: string): StoryArticle {
  const [article, setArticle] = useState<StoryArticle>(
    link ? { status: "reading" } : { status: "none", reason: "" },
  );
  useEffect(() => {
    if (!link) return;
    let shown = true;
    void getJson(storyArticleUrl(link))
      .then((reply) =>
        reply.ok
          ? articleFromServer(reply.body, publisher)
          : articleFromServer({ message: errorOf(reply.body, reply.status) }, publisher),
      )
      .catch(() => articleFromServer({ message: "the server could not be reached" }, publisher))
      .then((read) => {
        if (shown) setArticle(read);
      });
    return () => {
      shown = false;
    };
  }, [link, publisher]);
  return article;
}

/**
 * News's live state when the desktop app serves it: the catalogue, the person's library (kept
 * on the server, saved on every change once it has loaded), and the feeds the window asked for.
 * `want` asks for feeds: each is read when the window has none of it, or when what it has is
 * older than the server keeps a feed (so a window left open is refreshed whenever it shows a
 * feed again, and by `refreshShown` on a timer).
 */
export function useLiveNews(enabled: boolean) {
  const [catalogue, setCatalogue] = useState<LiveCatalogue>();
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [library, setLibrary] = useState<NewsLibrary>(EMPTY_LIBRARY);
  const [feeds, setFeeds] = useState<Readonly<Record<string, FeedState>>>({});
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const loading = useServerState({
    url: NEWS_URLS.library,
    enabled,
    value: library,
    onLoad: (stored) => {
      if (!libraryReadable(stored)) return false;
      setLibrary(libraryFromServer(stored) ?? EMPTY_LIBRARY);
    },
    toBody: libraryToServer,
  });

  // A new try of the catalogue (Try Again) reruns its load.
  const [catalogueTry, setCatalogueTry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setCatalogueFailed(false);
    void catalogueTry;
    void loadCatalogue().then((answer) => {
      if (!current) return;
      if (answer) {
        setCatalogue(answer);
        setCatalogueFailed(false);
      } else setCatalogueFailed(true);
    });
    return () => {
      current = false;
    };
  }, [enabled, catalogueTry]);
  const retryCatalogue = useCallback(() => setCatalogueTry((count) => count + 1), []);

  const read = useCallback((source: string, fresh = false) => {
    setFeeds((before) => ({
      ...before,
      [source]: { ...before[source], loading: true, asked: Date.now() },
    }));
    void getJson(NEWS_URLS.source(source, fresh))
      .then((reply) => {
        if (!live.current) return;
        const feed = reply.ok ? feedFromServer(reply.body, source) : undefined;
        setFeeds((before) => ({
          ...before,
          [source]: {
            feed: feed ?? before[source]?.feed,
            loading: false,
            error: feed ? undefined : errorOf(reply.body, reply.status),
            asked: Date.now(),
          },
        }));
      })
      .catch(() => {
        if (!live.current) return;
        setFeeds((before) => ({
          ...before,
          [source]: {
            feed: before[source]?.feed,
            loading: false,
            error: "The server could not be reached.",
            asked: Date.now(),
          },
        }));
      });
  }, []);

  const freshMs = catalogue?.freshMs ?? 15 * 60_000;

  /**
   * Read each of `sources` the window has none of, or whose copy the server read longer ago than
   * it keeps a feed (`fetched`, the server's clock). A copy the server answered as stale (its
   * refresh failed or was under way) and a failed request are asked again a minute after the
   * last request (`asked`), not on every render.
   */
  const want = useCallback(
    (sources: readonly string[]) => {
      if (!enabled) return;
      const now = Date.now();
      for (const source of sources) {
        if (feedNeedsRead(feedsRef.current[source], now, freshMs)) read(source);
      }
    },
    [enabled, freshMs, read],
  );

  /** Ask the publisher for each of `sources` now (the server's floor apart), unless a read is under way. */
  const reload = useCallback(
    (sources: readonly string[]) => {
      if (!enabled) return;
      for (const source of sources) {
        if (!feedsRef.current[source]?.loading) read(source, true);
      }
    },
    [enabled, read],
  );

  return {
    catalogue,
    catalogueFailed,
    retryCatalogue,
    library,
    setLibrary,
    loading,
    feeds,
    want,
    reload,
    freshMs,
  };
}
