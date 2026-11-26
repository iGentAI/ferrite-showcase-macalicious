import { sessionFetch } from "../desktop/desktop-server";
import type { HelpSection, HelpTopic } from "./help-viewer-data";

/**
 * Help Viewer's half on the `macalicious-desktop` Ferrite application
 * (`ferrite-apps/desktop/src/apps/help_viewer`): the help books the server holds, its search of
 * them, and the page the session last read.
 */
export const HELP_BOOKS_URL = "/api/help-viewer/books";
export const HELP_SEARCH_URL = "/api/help-viewer/search";
export const HELP_PLACE_URL = "/api/help-viewer/place";

/** How long a search field waits after the last key before it asks the server. */
export const SEARCH_DELAY_MS = 150;

/** Prefixed to the id of every book and topic from the server, so none meets one of the guide's. */
export const SERVER_PREFIX = "server:";

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((text) => typeof text === "string");

/** A topic of a reply as the viewer shows one, or `undefined` when it is not in that shape. */
function topicFromServer(value: unknown): HelpTopic | undefined {
  const topic = value as Record<string, unknown> | null;
  if (
    typeof topic !== "object" ||
    topic === null ||
    typeof topic.id !== "string" ||
    typeof topic.title !== "string" ||
    typeof topic.summary !== "string" ||
    typeof topic.source !== "string" ||
    !isStrings(topic.body)
  ) {
    return undefined;
  }
  return {
    id: `${SERVER_PREFIX}${topic.id}`,
    title: topic.title,
    summary: topic.summary,
    body: topic.body,
    source: topic.source,
  };
}

const topicsFromServer = (value: unknown): HelpTopic[] =>
  Array.isArray(value)
    ? value.map(topicFromServer).filter((topic): topic is HelpTopic => topic !== undefined)
    : [];

/**
 * The books of a `GET /books` reply, each as an entry of the table of contents with its topics.
 * A book or topic in another shape is left out; a reply that is not the module's gives none.
 */
export function booksFromServer(reply: unknown): HelpSection[] {
  const books = (reply as { books?: unknown } | null)?.books;
  if (!Array.isArray(books)) return [];
  return books.flatMap((value) => {
    const book = value as Record<string, unknown> | null;
    if (
      typeof book !== "object" ||
      book === null ||
      typeof book.id !== "string" ||
      typeof book.title !== "string" ||
      typeof book.summary !== "string"
    ) {
      return [];
    }
    return [
      {
        id: `${SERVER_PREFIX}${book.id}`,
        title: book.title,
        summary: book.summary,
        topics: topicsFromServer(book.topics),
      },
    ];
  });
}

/**
 * The topics a `GET /search` reply found for `query`, or `undefined` when the reply answers
 * another query or is not the module's.
 */
export function resultsFromServer(reply: unknown, query: string): HelpTopic[] | undefined {
  const answer = reply as { query?: unknown; results?: unknown } | null;
  if (answer?.query !== query || !Array.isArray(answer.results)) return undefined;
  return topicsFromServer(answer.results);
}

/**
 * Whether a `GET /place` reply is one the viewer can read: a page id, or `null` before the
 * session has read any. Anything else is stored data that must not be saved over.
 */
export function placeReadable(reply: unknown): boolean {
  const page = (reply as { page?: unknown } | null)?.page;
  return page === null || (typeof page === "string" && page.length > 0);
}

/** The longest search the module answers, in characters, and the most words it may hold. */
const MAX_QUERY_CHARS = 200;
const MAX_QUERY_WORDS = 8;

/**
 * Whether the module answers a search for `query`: at most 200 characters and 8 words, a word
 * being a run of letters and digits as the server counts them. A longer search is not sent,
 * since the server would refuse it; the demo's own results are still shown.
 */
export function serverSearches(query: string): boolean {
  return (
    [...query].length <= MAX_QUERY_CHARS &&
    (query.match(/[\p{Alphabetic}\p{N}]+/gu)?.length ?? 0) <= MAX_QUERY_WORDS
  );
}

/** `GET` a JSON reply, or `undefined` when the request or its body fails. */
export async function getJson(url: string): Promise<unknown> {
  try {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
}
