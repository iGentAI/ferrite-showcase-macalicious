import { openUrl } from "../desktop/desktop-open-url";
import type { NewsStory } from "./news-data";

/*
 * News with real stories, when the desktop is served by the `macalicious-desktop` Ferrite
 * application (`ferrite-apps/desktop/src/apps/news`): the server reads publishers' RSS and Atom
 * feeds through its declared egress and keeps each person's channels, saved stories and history.
 * Everything here is plain data and functions; `news.tsx` does the requests.
 */

export const NEWS_URLS = {
  catalogue: "/api/news/catalogue",
  library: "/api/news/library",
  source: (id: string, fresh = false) =>
    `/api/news/sources/${encodeURIComponent(id)}${fresh ? "?fresh=1" : ""}`,
} as const;

/** A publisher a person can follow or block. */
export interface LiveChannel {
  id: string;
  name: string;
  tint: string;
  site: string;
}

/** A topic: the topic feeds of a few publishers, merged. */
export interface LiveTopic {
  id: string;
  name: string;
  tint: string;
  sources: readonly string[];
}

export interface LiveCatalogue {
  channels: readonly LiveChannel[];
  topics: readonly LiveTopic[];
  /** The channels followed before the person changed anything. */
  following: readonly string[];
  /** How long the server keeps a feed before reading it again, in milliseconds. */
  freshMs: number;
}

/** A story as a feed lists it. */
export interface LiveStory {
  /** The feed's own id for it, plain. */
  id: string;
  /** The feed it came from. */
  source: string;
  publisher: string;
  title: string;
  link?: string;
  image?: string;
  summary?: string;
  /** Epoch milliseconds. */
  published?: number;
  author?: string;
}

/** One feed, as the server answered it. */
export interface LiveFeed {
  stories: readonly LiveStory[];
  /** When the server read it from the publisher. */
  fetched: number;
  /** The server answered its kept copy because a new read failed or is under way. */
  stale: boolean;
  /** Why the last read failed. */
  error?: string;
}

/** What a person keeps. */
export interface NewsLibrary {
  following: readonly string[];
  blocked: readonly string[];
  saved: readonly SavedStory[];
  history: readonly SavedStory[];
}

/**
 * A story kept in Saved Stories or History: what the window shows of it. A saved story keeps a
 * short summary too (at most `MAX_SAVED_SUMMARY` characters), so it still says what it is about
 * once its feed has moved on; History keeps none.
 */
export type SavedStory = Omit<LiveStory, "author">;

/** The longest summary a saved story keeps, in characters (the server's limit). */
export const MAX_SAVED_SUMMARY = 300;

export const MAX_SAVED = 150;
export const MAX_HISTORY = 60;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);
const optional = (value: unknown, test: (v: unknown) => boolean) =>
  value === undefined || value === null || test(value);
const isTime = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** The catalogue of a `GET /api/news/catalogue` reply, or `undefined`. */
export function catalogueFromServer(reply: unknown): LiveCatalogue | undefined {
  if (!isRecord(reply)) return undefined;
  const { channels, topics, following, freshMs } = reply;
  const channelOk = (c: unknown) =>
    isRecord(c) && isString(c.id) && isString(c.name) && isString(c.tint) && isString(c.site);
  const topicOk = (t: unknown) =>
    isRecord(t) && isString(t.id) && isString(t.name) && isString(t.tint) && isStrings(t.sources);
  if (
    !Array.isArray(channels) ||
    !channels.every(channelOk) ||
    !Array.isArray(topics) ||
    !topics.every(topicOk) ||
    !isStrings(following) ||
    !isTime(freshMs)
  ) {
    return undefined;
  }
  return { channels, topics, following, freshMs } as LiveCatalogue;
}

/** The feed of a `GET /api/news/sources/<id>` reply, or `undefined`. */
export function feedFromServer(reply: unknown, source: string): LiveFeed | undefined {
  if (!isRecord(reply) || !Array.isArray(reply.stories) || !isRecord(reply.source)) {
    return undefined;
  }
  const publisher = isString(reply.source.publisher) ? reply.source.publisher : source;
  const stories: LiveStory[] = [];
  for (const item of reply.stories) {
    if (!isRecord(item) || !isString(item.id) || !isString(item.title)) continue;
    stories.push({
      id: item.id,
      source,
      publisher,
      title: item.title,
      link: isString(item.link) ? item.link : undefined,
      image: isString(item.image) ? item.image : undefined,
      summary: isString(item.summary) ? item.summary : undefined,
      published: isTime(item.published) ? (item.published as number) : undefined,
      author: isString(item.author) ? item.author : undefined,
    });
  }
  return {
    stories,
    fetched: isTime(reply.fetched) ? (reply.fetched as number) : 0,
    stale: reply.stale === true,
    error: isString(reply.error) ? reply.error : undefined,
  };
}

const isSaved = (value: unknown): value is SavedStory =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.source) &&
  isString(value.publisher) &&
  isString(value.title) &&
  optional(value.link, isString) &&
  optional(value.image, isString) &&
  optional(value.published, isTime) &&
  optional(value.summary, isString);

const isLibrary = (value: unknown): value is NewsLibrary =>
  isRecord(value) &&
  isStrings(value.following) &&
  isStrings(value.blocked) &&
  Array.isArray(value.saved) &&
  value.saved.every(isSaved) &&
  Array.isArray(value.history) &&
  value.history.every(isSaved);

/**
 * Whether a library `GET` reply is one News can read: a library, or `null` before the person has
 * saved one. Anything else is stored data that must not be saved over.
 */
export function libraryReadable(reply: unknown): boolean {
  const library = isRecord(reply) ? reply.library : undefined;
  return library === null || isLibrary(library);
}

/** The library of a `GET` reply, or `undefined` before the person saved one. */
export function libraryFromServer(reply: unknown): NewsLibrary | undefined {
  if (!libraryReadable(reply)) return undefined;
  return (reply as { library: NewsLibrary | null }).library ?? undefined;
}

/** `text` cut to at most `max` characters (code points), ending with an ellipsis when cut. */
export function clipText(text: string, max: number): string {
  const characters = Array.from(text);
  if (characters.length <= max) return text;
  return `${characters
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`;
}

/**
 * A story's snapshot for Saved Stories and History: only the fields the server keeps, each within
 * the server's limits. `withSummary` keeps a short summary (Saved Stories).
 */
export function snapshot(story: LiveStory | SavedStory, withSummary = false): SavedStory {
  const kept: SavedStory = {
    id: story.id,
    source: story.source,
    publisher: clipText(story.publisher, 100),
    title: clipText(story.title, 300),
  };
  if (story.link) kept.link = story.link;
  if (story.image) kept.image = story.image;
  if (story.published !== undefined) kept.published = story.published;
  if (withSummary && story.summary) kept.summary = clipText(story.summary, MAX_SAVED_SUMMARY);
  return kept;
}

/** The `PUT` body. */
export function libraryToServer(library: NewsLibrary) {
  return {
    library: {
      following: [...new Set(library.following)],
      blocked: [...new Set(library.blocked)],
      saved: library.saved.slice(0, MAX_SAVED).map((story) => snapshot(story, true)),
      history: library.history.slice(0, MAX_HISTORY).map((story) => snapshot(story)),
    },
  };
}

/** The two keys of a story: its feed and its id there. */
export const liveKey = (story: { source: string; id: string }) => `${story.source}.${story.id}`;

/** `text` cut around each place that holds `query`, ignoring case; no query, no match. */
export function findParts(text: string, query: string): { text: string; match: boolean }[] {
  const wanted = query.trim();
  if (wanted === "") return [{ text, match: false }];
  const pattern = new RegExp(wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  for (const found of text.matchAll(pattern)) {
    if (found.index > from) parts.push({ text: text.slice(from, found.index), match: false });
    parts.push({ text: found[0], match: true });
    from = found.index + found[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}

/** History with `story` first, each story once, at most `MAX_HISTORY`. */
export function withVisit(
  history: readonly SavedStory[],
  story: LiveStory | SavedStory,
): SavedStory[] {
  const key = liveKey(story);
  return [snapshot(story), ...history.filter((other) => liveKey(other) !== key)].slice(
    0,
    MAX_HISTORY,
  );
}

/** Saved Stories with `story` added first, or removed when it was saved. A full list stays as it is:
 * nothing a person kept goes to make room, so the caller says so (`savedIsFull`). */
export function toggleSaved(
  saved: readonly SavedStory[],
  story: LiveStory | SavedStory,
): SavedStory[] {
  const key = liveKey(story);
  if (saved.some((other) => liveKey(other) === key)) {
    return saved.filter((other) => liveKey(other) !== key);
  }
  if (saved.length >= MAX_SAVED) return [...saved];
  return [snapshot(story, true), ...saved];
}

/** Whether Saved Stories has no room for `story`. */
export const savedIsFull = (saved: readonly SavedStory[], story: LiveStory | SavedStory) =>
  saved.length >= MAX_SAVED && !saved.some((other) => liveKey(other) === liveKey(story));

/** `list` without the story whose key is `key`. */
export function withoutStory(list: readonly SavedStory[], key: string): SavedStory[] {
  return list.filter((other) => liveKey(other) !== key);
}

/**
 * The channel a story belongs to: the one whose feed it came from, or, for a topic feed's story,
 * the one of its publisher.
 */
export function channelOf(
  story: { source: string; publisher: string },
  channels: readonly LiveChannel[],
): LiveChannel | undefined {
  return (
    channels.find((channel) => channel.id === story.source) ??
    channels.find((channel) => channel.name === story.publisher)
  );
}

/** Stories chosen in a list, by their keys, and the one a Shift-click reaches from. */
export interface StoryChoice {
  ids: readonly string[];
  anchor: string;
}

/** The choice after a Command-click on `id`, or a Shift-click with `range`; `order` is the list. */
export function choiceAfter(
  choice: StoryChoice | null,
  order: readonly string[],
  id: string,
  range: boolean,
): StoryChoice {
  if (range && choice) {
    const from = order.indexOf(choice.anchor);
    const to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      return {
        ids: order.slice(Math.min(from, to), Math.max(from, to) + 1),
        anchor: choice.anchor,
      };
    }
  }
  const held = choice?.ids ?? [];
  return {
    ids: held.includes(id) ? held.filter((other) => other !== id) : [...held, id],
    anchor: id,
  };
}

/** `list` with `id` just before `before`, or last when `before` is `null` or not in it, once. */
export function movedBefore(list: readonly string[], id: string, before: string | null): string[] {
  const rest = list.filter((other) => other !== id);
  const at = before === null ? -1 : rest.indexOf(before);
  return at < 0 ? [...rest, id] : [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** The host of a web address, without `www.`; a bare `npr.org` counts as an address. */
function hostOf(address: string): string | undefined {
  try {
    const { hostname } = new URL(address.includes("://") ? address : `https://${address}`);
    return hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return undefined;
  }
}

/** The channel that publishes from a web address: its site's host, or a host under it. */
export function channelOfAddress(
  address: string,
  channels: readonly LiveChannel[],
): LiveChannel | undefined {
  const host = hostOf(address.trim());
  if (!host) return undefined;
  return channels.find((channel) => {
    const site = hostOf(channel.site);
    return site !== undefined && (host === site || host.endsWith(`.${site}`));
  });
}

/** `list` with `id` added at the end, or removed when it is there. */
export function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((other) => other !== id) : [...list, id];
}

/**
 * What makes two listed stories one: the same link, compared after URL parsing (so only spelling
 * the URL standard treats as equal, such as the host's case, merges; paths and queries stay
 * case-sensitive). A story without a link, or with one that does not parse, is never merged.
 */
const sameness = (story: LiveStory) => {
  if (story.link) {
    try {
      return `link:${new URL(story.link).href}`;
    } catch {
      // An unparseable link merges with nothing.
    }
  }
  return `story:${story.source}.${story.id}`;
};

/**
 * Stories of several feeds as one list: newest first (a story without a date after those with
 * one, in feed order), each story once (by its exact link), none from a blocked channel.
 */
export function mergeStories(
  lists: readonly (readonly LiveStory[])[],
  blockedPublishers: ReadonlySet<string> = new Set(),
): LiveStory[] {
  const seen = new Set<string>();
  const all: { story: LiveStory; order: number }[] = [];
  let order = 0;
  for (const list of lists) {
    for (const story of list) {
      order += 1;
      if (blockedPublishers.has(story.publisher)) continue;
      const key = sameness(story);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ story, order });
    }
  }
  all.sort(
    (a, b) =>
      (b.story.published ?? -1) - (a.story.published ?? -1) ||
      // Undated stories keep their feeds' order.
      a.order - b.order,
  );
  return all.map(({ story }) => story);
}

/**
 * Today's top stories: the newest of the followed channels, at most two from one publisher
 * among the first `count`, so the leads come from different newsrooms.
 */
export function topStories(merged: readonly LiveStory[], count = 6): LiveStory[] {
  const first = merged[0];
  if (!first) return [];
  const second = merged.find((story) => story.publisher !== first.publisher);
  const top: LiveStory[] = second ? [first, second] : [first];
  const per = new Map<string, number>();
  for (const story of top) per.set(story.publisher, (per.get(story.publisher) ?? 0) + 1);
  for (const story of merged) {
    if (top.length >= count) break;
    if (top.includes(story)) continue;
    const used = per.get(story.publisher) ?? 0;
    if (used >= 2) continue;
    per.set(story.publisher, used + 1);
    top.push(story);
  }
  return top.slice(0, count);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** How old a story is, as News says it: "Just now", "5m ago", "3h ago", "Yesterday", "Oct 9". */
export function ageOf(published: number | undefined, now: number): string {
  if (published === undefined) return "";
  const minutes = Math.floor(Math.max(0, now - published) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  const date = new Date(published);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** The date under the masthead: "October 14". */
export function mastheadDate(now: number): string {
  const date = new Date(now);
  return `${LONG_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** A live story in the shape the window's story cards take. */
export function toNewsStory(story: LiveStory | SavedStory, now: number): NewsStory {
  return {
    id: liveKey(story),
    publisher: story.publisher,
    headline: story.title,
    age: ageOf(story.published, now),
    image: story.image,
  };
}

/** What can be read of a story's page. */
export type StoryArticle =
  | { status: "reading" }
  | { status: "ready"; blocks: readonly { id: number; kind: string; text: string }[] }
  | { status: "none"; reason: string };

/**
 * Safari's server route reads a page of the sites it lists and finds its article. `private` keeps
 * the page out of Safari's History, as News read it, not Safari; `reader` leaves out the page
 * itself, of which News uses only the article.
 */
export const storyArticleUrl = (link: string) =>
  `/api/safari/page?url=${encodeURIComponent(link)}&private=1&reader=1`;

/** Safari's reply as a story's article, or why there is none to show. */
export function articleFromServer(reply: unknown, publisher: string): StoryArticle {
  const page = reply as
    | {
        ok?: unknown;
        kind?: unknown;
        host?: unknown;
        message?: unknown;
        status?: unknown;
        reader?: unknown;
      }
    | null
    | undefined;
  if (page?.ok === true) {
    const blocks = Array.isArray(page.reader)
      ? page.reader.flatMap((block, id) =>
          typeof block?.text === "string" && typeof block?.kind === "string"
            ? [{ id, kind: block.kind, text: block.text }]
            : [],
        )
      : [];
    return typeof page.status === "number" && page.status < 400 && blocks.length > 0
      ? { status: "ready", blocks }
      : {
          status: "none",
          reason: `${publisher}’s page has no article to read here. This is what its feed says.`,
        };
  }
  if (page?.kind === "not-listed") {
    const host = typeof page.host === "string" && page.host ? page.host : "its site";
    return {
      status: "none",
      reason: `This desktop’s server reads only the sites it lists, and ${host} is not one of them. This is what the feed says.`,
    };
  }
  const why = typeof page?.message === "string" ? `: ${page.message.replace(/\.$/, "")}` : "";
  return {
    status: "none",
    reason: `The story could not be read${why}. This is what the feed says.`,
  };
}

/** The paragraphs of a story's summary. */
export function summaryParagraphs(story: LiveStory | SavedStory): string[] {
  const summary = "summary" in story ? story.summary : undefined;
  return (summary ?? "")
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter((text) => text !== "");
}

/** Whether a story's headline, publisher or summary contains the text, whatever its case. */
export function liveMatches(story: LiveStory | SavedStory, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (text === "") return true;
  const summary = "summary" in story ? (story.summary ?? "") : "";
  return [story.title, story.publisher, summary].some((field) =>
    field.toLowerCase().includes(text),
  );
}

/** The event an open Safari window takes a web address from (`desktop-open-url.ts`). */
export { OPEN_URL_EVENT } from "../desktop/desktop-open-url";

/**
 * Opens a story's page at its publisher in Safari, through `openUrl`: an open Safari window takes
 * it in a new tab in front; with none open, the link is kept and Safari is opened, and takes it
 * once its own tabs are back. Safari then shows the page, or says it opens outside Safari and
 * offers a browser tab. Only web addresses are opened: `"none"` for anything else.
 */
export function openStoryLink(url: string): "safari" | "none" {
  return openUrl(url, "news") === null ? "none" : "safari";
}
