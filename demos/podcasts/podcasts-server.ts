import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import {
  DEFAULT_SETTINGS,
  DOWNLOAD_CHOICES,
  type PodcastsSettings,
  REFRESH_CHOICES,
  SKIP_CHOICES,
} from "./podcasts-data";

/**
 * Podcasts' routes on the `macalicious-desktop` Ferrite application
 * (`ferrite-apps/desktop/src/apps/podcasts`). The module reads Apple's podcast directory and the
 * shows' own feeds through its declared egress, caching them for everyone, and keeps each
 * person's library: the shows followed, the episodes played, the place in each started episode,
 * Up Next, the episode loaded, the playback speed and the Preferences settings. It
 * never fetches, keeps or relays audio: the browser plays every episode from its publisher.
 */
export const PODCASTS_LIBRARY_URL = "/api/podcasts/library";
export const PODCASTS_SEARCH_URL = "/api/podcasts/search";
export const PODCASTS_LOOKUP_URL = "/api/podcasts/lookup";
export const PODCASTS_TOP_URL = "/api/podcasts/top";
export const PODCASTS_FEED_URL = "/api/podcasts/feed";
export const PODCASTS_HOSTS_URL = "/api/podcasts/hosts";
export const PODCASTS_WATCH_URL = "/api/podcasts/watch";

/** The speeds the player offers, as the module accepts them. */
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/**
 * The module's limits (`MAX_SHOWS`, `MAX_QUEUE`, `MAX_ITEMS`, `MAX_TEXT`, `MAX_POSITION`). `text`
 * counts characters as the module does: Rust `char`s, which are a string's code points (not its
 * UTF-16 units, which `length` and `slice` count, nor its bytes).
 */
export const PODCASTS_LIMITS = {
  shows: 100,
  queue: 50,
  items: 1000,
  text: 200,
  position: 86_400,
  /** The most bytes of JSON the module keeps of a library (`MAX_LIBRARY_BYTES`), less a margin
   * for what its own serializer writes differently. */
  bytes: 188_000,
} as const;

/** The longest picture address the module keeps, in bytes of UTF-8 (`hosts::MAX_FEED_URL`). */
const ARTWORK_BYTES = 1024;
/** The longest enclosure type the module keeps, in bytes of UTF-8. */
const KIND_BYTES = 100;

/** What an episode or a show without a title is called, as the module needs one. */
export const UNTITLED_EPISODE = "Untitled Episode";
export const UNTITLED_SHOW = "Untitled Show";

const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
/** Only what Rust's `str::trim` removes: the characters with Unicode's White_Space property. */
const BLANK = /^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/;
const UTF8 = new TextEncoder();
const bytesOf = (text: string) => UTF8.encode(text).length;

/** Whether the module reads `text` as empty: nothing is left of it once trimmed, as Rust trims. */
export const isBlank = (text: string) => BLANK.test(text);

/** How many characters the module counts in `text`: its code points, as Rust counts `char`s. */
export const textLength = (text: string) => Array.from(text).length;

/**
 * `text` as the module keeps it: at most `limit` characters, counted as the module counts them
 * (`textLength`). Longer text is cut on a character boundary and ends with an ellipsis, within
 * the limit, as the module's own `clip` does. A lone surrogate, which JSON can carry but the
 * module cannot read, becomes U+FFFD.
 */
export function limitText(text: string, limit: number = PODCASTS_LIMITS.text): string {
  const whole = text.replace(LONE_SURROGATES, "\uFFFD");
  const chars = Array.from(whole);
  if (chars.length <= limit) return whole;
  return `${chars
    .slice(0, Math.max(0, limit - 1))
    .join("")
    .trimEnd()}\u2026`;
}

/** A title the module requires: `fallback` when it is empty, else within the limit. */
const titleOf = (text: string, fallback: string) => (isBlank(text) ? fallback : limitText(text));

const UNSAFE_IN_ADDRESS = new Set(['"', "<", ">", "\\", "`"]);

/**
 * `url` when the module keeps it as a picture's address (`feed::web_url` gives it back as it is,
 * and it is at most `max` bytes), else `null`: a cover the module would refuse is not kept, so
 * that it cannot refuse the whole library.
 */
function pictureOf(url: string | null | undefined, max = ARTWORK_BYTES): string | null {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  const bytes = bytesOf(url);
  if (bytes <= "https://".length || bytes > max) return null;
  for (const char of url) {
    const code = char.codePointAt(0) ?? 0;
    const unsafe =
      code <= 0x20 ||
      code === 0x7f ||
      (code >= 0xd800 && code <= 0xdfff) ||
      UNSAFE_IN_ADDRESS.has(char) ||
      BLANK.test(char);
    if (unsafe) return null;
  }
  return url;
}

/** An enclosure's type when the module keeps it (audio or video, at most 100 bytes), else `null`. */
const kindOf = (kind: string | null | undefined): string | null =>
  typeof kind === "string" &&
  (kind.startsWith("audio/") || kind.startsWith("video/")) &&
  bytesOf(kind) <= KIND_BYTES &&
  kind.replace(LONE_SURROGATES, "") === kind
    ? kind
    : null;

/** A whole number from 0 to `max`; 0 for anything else. */
const wholeIn = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(0, Math.floor(value)))
    : 0;

/** Each entry once: the first with its id. */
const firstOfEach = <T extends { id: string }>(list: readonly T[]): T[] => {
  const seen = new Set<string>();
  return list.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
};

/** A show the person follows, with what the window shows of it. */
export interface FollowedShow {
  /** Apple's id of the show. */
  id: string;
  title: string;
  author: string;
  artwork: string | null;
  genre: string | null;
  /** The feed the server reads. */
  feed: string;
  /** The publication time (epoch ms) of the newest episode the person has looked at. */
  seen: number;
}

/** An episode in Up Next or in the player: what it takes to show and play it after a reload. */
export interface QueuedEpisode {
  /** `<show id>.<item id>`. */
  id: string;
  show: string;
  title: string;
  showTitle: string;
  artwork: string | null;
  /** The enclosure, played from its publisher. */
  audio: string;
  kind: string | null;
  /** Seconds, 0 when the feed does not say. */
  duration: number;
  /** Epoch ms, 0 when the feed does not say. */
  published: number;
  /** The show's feed. */
  feed: string | null;
}

/** What the module keeps for the person. */
export interface PodcastsLibraryState {
  subscribed: readonly string[];
  played: readonly string[];
  /** Whole seconds heard of each started episode. */
  positions: Readonly<Record<string, number>>;
  settings: PodcastsSettings;
  shows: readonly FollowedShow[];
  /** Up Next, in the order it plays. */
  queue: readonly QueuedEpisode[];
  /** The episode loaded in the player. */
  current: QueuedEpisode | null;
  speed: number;
}

export const EMPTY_LIBRARY: PodcastsLibraryState = {
  subscribed: [],
  played: [],
  positions: {},
  settings: DEFAULT_SETTINGS,
  shows: [],
  queue: [],
  current: null,
  speed: 1,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");
const isSeconds = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const isSkip = (value: unknown): value is number =>
  (SKIP_CHOICES as readonly unknown[]).includes(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isOptionalText = (value: unknown) =>
  value === undefined || value === null || typeof value === "string";

const isSettings = (value: unknown): value is PodcastsSettings =>
  isRecord(value) &&
  (REFRESH_CHOICES as readonly unknown[]).includes(value.refresh) &&
  (DOWNLOAD_CHOICES as readonly unknown[]).includes(value.download) &&
  isSkip(value.skipForward) &&
  isSkip(value.skipBack) &&
  typeof value.continuous === "boolean" &&
  typeof value.sync === "boolean";

const isFollowed = (value: unknown): value is FollowedShow =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.title) &&
  isText(value.author) &&
  isOptionalText(value.artwork) &&
  isOptionalText(value.genre) &&
  isText(value.feed) &&
  isSeconds(value.seen);

const isQueued = (value: unknown): value is QueuedEpisode =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.show) &&
  isText(value.title) &&
  isText(value.showTitle) &&
  isOptionalText(value.artwork) &&
  isText(value.audio) &&
  isOptionalText(value.kind) &&
  (value.duration === undefined || isSeconds(value.duration)) &&
  (value.published === undefined || isSeconds(value.published)) &&
  isOptionalText(value.feed);

const isLibrary = (value: unknown): value is PodcastsLibraryState =>
  isRecord(value) &&
  isStrings(value.subscribed) &&
  isStrings(value.played) &&
  isRecord(value.positions) &&
  Object.values(value.positions).every(isSeconds) &&
  isSettings(value.settings) &&
  // A library saved before Podcasts read real feeds has none of these.
  (value.shows === undefined || (Array.isArray(value.shows) && value.shows.every(isFollowed))) &&
  (value.queue === undefined || (Array.isArray(value.queue) && value.queue.every(isQueued))) &&
  (value.current === undefined || value.current === null || isQueued(value.current)) &&
  (value.speed === undefined || (SPEEDS as readonly unknown[]).includes(value.speed));

/**
 * Whether a `GET` reply is one Podcasts can read: a library in the window's shape, or `null`
 * before the person has saved. Anything else is stored data that must not be saved over.
 */
export function podcastsLibraryReadable(reply: unknown): boolean {
  const library = isRecord(reply) ? reply.library : undefined;
  return library === null || isLibrary(library);
}

/**
 * An episode as the module keeps it: every field it limits within its limit, whatever the feed
 * gave (a title up to 300 characters, a picture up to 2,048 bytes, an enclosure type of any
 * length), so that one long field never makes it refuse the whole library.
 */
const queued = (episode: QueuedEpisode): QueuedEpisode => ({
  id: episode.id,
  show: episode.show,
  title: titleOf(episode.title, UNTITLED_EPISODE),
  showTitle: limitText(episode.showTitle),
  artwork: pictureOf(episode.artwork),
  audio: episode.audio,
  kind: kindOf(episode.kind),
  duration: wholeIn(episode.duration, PODCASTS_LIMITS.position),
  published: wholeIn(episode.published, Number.MAX_SAFE_INTEGER),
  feed: episode.feed ?? null,
});

/** A followed show as the module keeps it, every field it limits within its limit. */
const followedShow = (show: FollowedShow): FollowedShow => ({
  id: show.id,
  title: titleOf(show.title, UNTITLED_SHOW),
  author: limitText(show.author),
  artwork: pictureOf(show.artwork),
  genre: typeof show.genre === "string" ? limitText(show.genre) : null,
  feed: show.feed,
  seen: wholeIn(show.seen, Number.MAX_SAFE_INTEGER),
});

const speedOf = (speed: number) => ((SPEEDS as readonly number[]).includes(speed) ? speed : 1);

/**
 * The places kept: each a whole number of seconds within the module's limit, of at most
 * `PODCASTS_LIMITS.items` episodes (those set last, when there are more). An episode started and
 * not yet heard keeps 0:00, which is what lists it under Continue Listening.
 */
function keptPositions(positions: Readonly<Record<string, number>>): Record<string, number> {
  const entries = Object.entries(positions)
    .filter(([, seconds]) => typeof seconds === "number" && Number.isFinite(seconds))
    .map(([id, seconds]) => [id, wholeIn(seconds, PODCASTS_LIMITS.position)] as const);
  return Object.fromEntries(entries.slice(-PODCASTS_LIMITS.items));
}

/**
 * The library of a `GET` reply (or of a body another window gave), with every field the window
 * uses; the empty library before the person has saved; `undefined` when it is unreadable.
 */
export function podcastsLibraryFromServer(reply: unknown): PodcastsLibraryState | undefined {
  if (!podcastsLibraryReadable(reply)) return undefined;
  const library = (reply as { library: PodcastsLibraryState | null }).library;
  if (!library) return EMPTY_LIBRARY;
  return {
    subscribed: [...library.subscribed],
    played: [...library.played],
    positions: keptPositions(library.positions),
    settings: { ...library.settings },
    shows: (library.shows ?? []).map(followedShow),
    queue: (library.queue ?? []).map(queued),
    current: library.current ? queued(library.current) : null,
    speed: library.speed ?? 1,
  };
}

/**
 * The state to keep, from the window's: the followed shows' ids in order; the lists within the
 * module's limits, each entry once; and every text, picture and number within the module's
 * limits (`PODCASTS_LIMITS`). The place in each started episode is kept in whole seconds; the
 * window moves it every ten seconds of listening and at every pause, skip and seek, so a save is
 * not made every second.
 */
export function podcastsLibrary(state: PodcastsLibraryState): PodcastsLibraryState {
  const shows = firstOfEach(state.shows).slice(0, PODCASTS_LIMITS.shows);
  return {
    subscribed: shows.map((show) => show.id).sort(),
    // In the order the episodes were finished, oldest first: the oldest go first when there are
    // too many, or the library is too large (withinBytes).
    played: [...new Set(state.played)].slice(-PODCASTS_LIMITS.items),
    positions: keptPositions(state.positions),
    settings: { ...state.settings },
    shows: shows.map(followedShow),
    queue: firstOfEach(state.queue).slice(0, PODCASTS_LIMITS.queue).map(queued),
    current: state.current ? queued(state.current) : null,
    speed: speedOf(state.speed),
  };
}

/**
 * The `PUT` body: only the fields the module keeps, every one of them, within the module's
 * limits however the state was made (each list's length, each text's characters, each picture's
 * bytes, and the whole library's bytes), so that the module never refuses it for one long title
 * or publisher, nor for a library that grew too large.
 */
export function podcastsLibraryToServer(state: PodcastsLibraryState) {
  const { refresh, download, skipForward, skipBack, continuous, sync } = state.settings;
  const shows = firstOfEach(state.shows).slice(0, PODCASTS_LIMITS.shows);
  return {
    library: withinBytes({
      // The shows followed: an id is followed exactly when its show is kept.
      subscribed: shows.map((show) => show.id),
      played: [...new Set(state.played)].slice(-PODCASTS_LIMITS.items),
      positions: keptPositions(state.positions),
      settings: { refresh, download, skipForward, skipBack, continuous, sync },
      shows: shows.map(followedShow),
      queue: firstOfEach(state.queue).slice(0, PODCASTS_LIMITS.queue).map(queued),
      current: state.current ? queued(state.current) : null,
      speed: speedOf(state.speed),
    }),
  };
}

/** The bytes of JSON a library takes. */
export const libraryBytes = (library: object) => bytesOf(JSON.stringify(library));

/**
 * `library` within the module's byte limit: when it is larger, what matters least goes first, a
 * piece at a time, until it fits. The oldest played episodes (the list is in the order they were
 * finished), then the places of the episodes started longest ago, then the end of Up Next, then
 * the shows' pictures, and last the shows followed latest. The episode loaded, and its place, are
 * always kept.
 */
function withinBytes(library: PodcastsLibraryState): PodcastsLibraryState {
  const fits = (candidate: PodcastsLibraryState) =>
    libraryBytes(candidate) <= PODCASTS_LIMITS.bytes;
  if (fits(library)) return library;
  let kept = { ...library };
  // Each step drops an eighth of what it trims at a time, so a large library fits in few passes.
  const fewer = (length: number) => Math.max(1, Math.ceil(length / 8));
  while (!fits(kept) && kept.played.length > 0) {
    kept = { ...kept, played: kept.played.slice(fewer(kept.played.length)) };
  }
  const loaded = kept.current?.id;
  let others = Object.keys(kept.positions).filter((id) => id !== loaded);
  while (!fits(kept) && others.length > 0) {
    others = others.slice(fewer(others.length));
    const keep = new Set(loaded === undefined ? others : [...others, loaded]);
    kept = {
      ...kept,
      positions: Object.fromEntries(Object.entries(kept.positions).filter(([id]) => keep.has(id))),
    };
  }
  while (!fits(kept) && kept.queue.length > 0) {
    kept = { ...kept, queue: kept.queue.slice(0, -fewer(kept.queue.length)) };
  }
  if (!fits(kept))
    kept = { ...kept, shows: kept.shows.map((show) => ({ ...show, artwork: null })) };
  while (!fits(kept) && kept.shows.length > 0) {
    const keep = kept.shows.length - fewer(kept.shows.length);
    const shows = kept.shows.slice(0, keep);
    kept = { ...kept, shows, subscribed: shows.map((show) => show.id) };
  }
  return kept;
}

/** A show as Apple's search or lookup lists it, with whether this desktop can follow it. */
export interface ShowListing {
  id: string;
  title: string;
  author: string;
  artwork?: string;
  genre?: string;
  feed?: string;
  followable: boolean;
  /** Why the show cannot be followed here. */
  reason?: string;
  episodes?: number;
}

/** A show of Apple's top chart: its feed comes from a lookup. */
export interface ChartedShow {
  id: string;
  title: string;
  author: string;
  artwork?: string;
  genre?: string;
}

/** An episode as the module reads it from a feed. */
export interface FeedEpisode {
  /** 16 hex digits, stable across reads. */
  id: string;
  title: string;
  link?: string;
  /** Plain text, paragraphs separated by a blank line. */
  summary?: string;
  /** Epoch ms. */
  published?: number;
  image?: string;
  author?: string;
  audio?: { url: string; kind: string; bytes?: number };
  /** Seconds. */
  duration?: number;
}

/** A feed as the module caches it: its newest episodes with audio. */
export interface CachedFeed {
  url: string;
  /** When the server read it, epoch ms. */
  fetched: number;
  /** Whether it was longer than what was read: its older episodes are not listed. */
  cut: boolean;
  title: string;
  author?: string;
  description?: string;
  image?: string;
  link?: string;
  episodes: FeedEpisode[];
}

export interface FeedReply {
  feed: CachedFeed;
  /** The feed could not be read again; this is the copy read before. */
  stale: boolean;
  error: string | null;
}

/** The refresh interval of each Refresh Podcasts choice, in seconds; `null` for Manually. */
export const REFRESH_SECONDS: Readonly<Record<string, number | null>> = {
  "Every Hour": 3_600,
  "Every 6 Hours": 21_600,
  "Every Day": 86_400,
  "Every Week": 604_800,
  Manually: null,
};

/** The `max_age` a refresh at `refresh` asks for: Manually takes any copy the server has. */
export function maxAgeOf(refresh: string): number {
  return REFRESH_SECONDS[refresh] ?? 30 * 86_400;
}

/** The window's id of an episode of a show: `<show id>.<item id>`, a plain id the module keeps. */
export const episodeKey = (show: string, item: string) => `${show}.${item}`;

/**
 * What a request to open an item of Podcasts names. Spotlight asks with a show's id or an episode's
 * key; a new episode's notification says `episode-<show>.<item>`
 * (ferrite-apps/desktop/src/apps/podcasts/mod.rs), which asks for its show.
 */
export const showOfOpenItem = (item: string) =>
  item.startsWith("episode-") ? (item.slice("episode-".length).split(".")[0] ?? item) : item;

async function getJson(url: string): Promise<unknown> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message = isRecord(body) && typeof body.error === "string" ? body.error : "";
      throw new Error(message || `HTTP ${response.status}`);
    }
    return body;
  });
}

/** A field the module may leave out: absent, or of the type `test` accepts. */
const optional = (value: unknown, test: (value: unknown) => boolean) =>
  value === undefined || test(value);
const isCount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isListing = (value: unknown): value is ShowListing =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.title) &&
  isText(value.author) &&
  optional(value.artwork, isText) &&
  optional(value.genre, isText) &&
  optional(value.feed, isText) &&
  typeof value.followable === "boolean" &&
  // A show the module calls followable has the feed it reads.
  (value.followable === false || isText(value.feed)) &&
  optional(value.reason, isText) &&
  optional(value.episodes, isCount);

const isCharted = (value: unknown): value is ChartedShow =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.title) &&
  isText(value.author) &&
  optional(value.artwork, isText) &&
  optional(value.genre, isText);

const isEnclosure = (value: unknown) =>
  isRecord(value) && isText(value.url) && isText(value.kind) && optional(value.bytes, isCount);

const isFeedEpisode = (value: unknown): value is FeedEpisode =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.title) &&
  optional(value.link, isText) &&
  optional(value.summary, isText) &&
  optional(value.published, isCount) &&
  optional(value.image, isText) &&
  optional(value.author, isText) &&
  optional(value.audio, isEnclosure) &&
  optional(value.duration, isCount);

const isFeed = (value: unknown): value is CachedFeed =>
  isRecord(value) &&
  isText(value.url) &&
  isCount(value.fetched) &&
  typeof value.cut === "boolean" &&
  isText(value.title) &&
  optional(value.author, isText) &&
  optional(value.description, isText) &&
  optional(value.image, isText) &&
  optional(value.link, isText) &&
  Array.isArray(value.episodes) &&
  value.episodes.every(isFeedEpisode);

/**
 * Asks the server to look for new episodes of the followed shows and deliver their notifications.
 * A failure only means the next look finds them: nothing is shown here.
 */
export async function watchNewEpisodes(): Promise<void> {
  await getJson(PODCASTS_WATCH_URL).catch(() => {});
}

/** Shows whose name or publisher Apple's search matches. */
export async function searchShows(term: string): Promise<ShowListing[]> {
  const body = await getJson(`${PODCASTS_SEARCH_URL}?term=${encodeURIComponent(term.trim())}`);
  const results = isRecord(body) ? body.results : undefined;
  if (!Array.isArray(results)) throw new Error("not a search reply");
  return results.filter(isListing);
}

/** Shows by their ids, with their feeds. */
export async function lookupShows(ids: readonly string[]): Promise<ShowListing[]> {
  const body = await getJson(`${PODCASTS_LOOKUP_URL}?ids=${ids.join(",")}`);
  const results = isRecord(body) ? body.results : undefined;
  if (!Array.isArray(results)) throw new Error("not a lookup reply");
  return results.filter(isListing);
}

/** Apple's top chart. */
export async function topShows(): Promise<ChartedShow[]> {
  const body = await getJson(PODCASTS_TOP_URL);
  const shows = isRecord(body) ? body.shows : undefined;
  if (!Array.isArray(shows)) throw new Error("not a chart reply");
  return shows.filter(isCharted);
}

/** A show's episodes, read again by the server when its copy is older than `maxAge` seconds. */
export async function readFeed(feed: string, maxAge: number): Promise<FeedReply> {
  const body = await getJson(
    `${PODCASTS_FEED_URL}?url=${encodeURIComponent(feed)}&max_age=${Math.max(0, Math.round(maxAge))}`,
  );
  if (
    !isRecord(body) ||
    !isFeed(body.feed) ||
    typeof body.stale !== "boolean" ||
    !(body.error === undefined || body.error === null || typeof body.error === "string")
  ) {
    throw new Error("not a feed reply");
  }
  return {
    feed: body.feed,
    stale: body.stale,
    // A stale copy always says why it is stale.
    error: typeof body.error === "string" ? body.error : body.stale ? "not read again" : null,
  };
}
