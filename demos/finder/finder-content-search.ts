import { useEffect, useState } from "react";
import { sessionFetch } from "../desktop/desktop-server";

/**
 * What the server's index finds for a Finder search: the drive's items whose words or tags hold the
 * query, as well as those whose names do, which the tree in the page can answer alone.
 */
export interface FinderContentHits {
  /** The drive ids found for `query`. */
  ids: ReadonlySet<string>;
  query: string;
  /** Text files past the index's limit, whose words were not searched. */
  unsearched: number;
  /** The server gave no answer, so only names were searched. */
  failed: boolean;
  /** Finder stopped asking while the index still had text files to read. */
  incomplete: boolean;
}

const NONE: FinderContentHits = {
  ids: new Set(),
  query: "",
  unsearched: 0,
  failed: false,
  incomplete: false,
};
const PAUSE_MS = 200;
const ASK_AGAIN_MS = 800;
/** Enough for the index to read all its 100 text files, at a dozen per request. */
const MOST_ASKS = 12;

/** The longest query the route takes (`MAX_QUERY_CHARS` and `MAX_WORDS` in its module). */
const MOST_CHARS = 200;
const MOST_WORDS = 8;
const tooLong = (text: string) => text.length > MOST_CHARS || text.split(/\s+/).length > MOST_WORDS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Reads the search route's answer; `null` when it is not one. */
export function readContentHits(
  query: string,
  value: unknown,
): (FinderContentHits & { indexing: boolean }) | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null;
  const ids = value.results.flatMap((result) =>
    isRecord(result) && result.kind === "files" && typeof result.id === "string" ? [result.id] : [],
  );
  return {
    ids: new Set(ids),
    query,
    unsearched: typeof value.unsearched_files === "number" ? value.unsearched_files : 0,
    failed: false,
    incomplete: false,
    indexing: value.indexing === true,
  };
}

/**
 * Asks the server for `query` while it is not empty, and again while its index is still reading:
 * for items by their words, names or tags, or with `wordsOnly` by their words alone.
 * An answer holds only for the query it was given for: until the next arrives there are no hits.
 */
export function useContentHits(
  query: string,
  enabled: boolean,
  wordsOnly = false,
): FinderContentHits {
  const [hits, setHits] = useState(NONE);
  const text = enabled ? query.trim() : "";
  useEffect(() => {
    if (text === "") return;
    if (tooLong(text)) {
      setHits({ ...NONE, query: text, failed: true });
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const ask = async (asked: number) => {
      try {
        const response = await sessionFetch(
          `/api/spotlight/search?q=${encodeURIComponent(text)}&only=${wordsOnly ? "contents" : "files"}`,
          { credentials: "same-origin" },
        );
        const read = response.ok ? readContentHits(text, await response.json()) : null;
        if (!live) return;
        if (!read) {
          setHits({ ...NONE, query: text, failed: true });
          return;
        }
        const more = read.indexing && asked + 1 < MOST_ASKS;
        setHits({ ...read, incomplete: read.indexing && !more });
        if (more) timer = setTimeout(() => void ask(asked + 1), ASK_AGAIN_MS);
      } catch {
        if (live) setHits({ ...NONE, query: text, failed: true });
      }
    };
    timer = setTimeout(() => void ask(0), PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, wordsOnly]);
  return hits.query === text ? hits : NONE;
}
