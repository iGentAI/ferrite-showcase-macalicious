import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import type { MusicAlbum, MusicCover, MusicTrack } from "./music-data";

/**
 * Music's documents and routes on the `macalicious-desktop` Ferrite application
 * (`ferrite-apps/desktop/src/apps/music`). The module keeps, for the person signed in, the
 * library (songs, playlists, Loved) and the playback (Up Next, shuffle, repeat, volume, Recently
 * Played, play counts), and covers read from uploaded songs. The sound is never kept there: an
 * uploaded song is a file of the person's drive, and an Internet Archive song is played from
 * archive.org.
 */
export const MUSIC_LIBRARY_URL = "/api/music/library";
export const MUSIC_PLAYBACK_URL = "/api/music/playback";
export const MUSIC_LYRICS_URL = "/api/music/lyrics";
export const MUSIC_ARTWORK_URL = "/api/music/artwork/";
export const MUSIC_ARCHIVE_SEARCH_URL = "/api/music/archive/search";
export const MUSIC_ARCHIVE_ITEM_URL = "/api/music/archive/item/";
export const MUSIC_RADIO_URL = "/api/music/radio/stations";

/** The module's limits (`MAX_SONGS`, `MAX_PLAYLISTS`, `MAX_QUEUE`, `MAX_RECENT`, ...). */
export const MUSIC_LIMITS = {
  songs: 500,
  playlists: 100,
  queue: 1000,
  recent: 50,
  text: 200,
  artworkBytes: 100_000,
  /** The largest library the module keeps, as JSON (`MAX_LIBRARY_BYTES`): under the store's
   * 200 KB value limit with the covers let go beside it. Measured with the save's envelope. */
  libraryBytes: 160_000,
  /** The largest playback the module keeps, as JSON (`MAX_PLAYBACK_BYTES`). */
  playbackBytes: 190_000,
  /** The longest lyrics of one song, in characters (`MAX_LYRICS_CHARS`). */
  lyricsChars: 10_000,
  /** The largest set of lyrics kept, as JSON (`MAX_LYRICS_BYTES`). */
  lyricsBytes: 190_000,
} as const;

/** Where a song's sound is. */
export type SongSource =
  | { kind: "file"; file: string; name: string; type: string; size: number }
  | {
      kind: "archive";
      item: string;
      files: Partial<Record<ArchiveFormat, string>>;
      license: string;
    }
  | { kind: "stream"; url: string };

/** The formats an Internet Archive song can be played in. */
export type ArchiveFormat = "mp3" | "ogg" | "flac";

/** One song of the library, as the module keeps it. */
export interface LibrarySong {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  composer?: string;
  year: number | null;
  track: number | null;
  /** Seconds. */
  duration: number;
  /** When it was added, epoch ms. */
  added: number;
  /** The SHA-256 of its cover, kept under `MUSIC_ARTWORK_URL`. */
  artwork: string | null;
  /** Stars, 1 to 5. */
  rating?: number | null;
  disliked?: boolean;
  /** Shuffle by Groupings keeps the songs of one grouping together. */
  grouping?: string;
  comments?: string;
  /** What the lists sort by in place of the title, artist and album. */
  sortName?: string;
  sortArtist?: string;
  sortAlbum?: string;
  sortAlbumArtist?: string;
  sortComposer?: string;
  /** Starts again from where it was last left, not from its start (`bookmarks` holds the place). */
  rememberPosition?: boolean;
  /** Where it starts and stops playing, in seconds. */
  start?: number | null;
  stop?: number | null;
  /** Percent added to the volume while it plays, -100 to 100. */
  volumeAdjust?: number | null;
  /** The Equalizer preset it plays through, whatever the Equalizer is set to. */
  eqPreset?: string;
  skipShuffle?: boolean;
  /** Its checkbox is cleared: playing on passes it by. */
  unchecked?: boolean;
  source: SongSource;
}

export interface SmartRule {
  field: "title" | "artist" | "album" | "genre" | "year" | "plays" | "loved" | "added";
  op:
    | "contains"
    | "not-contains"
    | "is"
    | "is-not"
    | "starts"
    | "ends"
    | "greater"
    | "less"
    | "in-last"
    | "not-in-last";
  value: string;
}

/** A smart playlist's rules: its songs are those of the library that match, worked out when read. */
export interface SmartPlaylist {
  /** Match all of the rules rather than any. */
  all: boolean;
  rules: SmartRule[];
  /** Keep this many of the most recently added. */
  limit?: number;
}

export interface LibraryPlaylist {
  id: string;
  name: string;
  songs: string[];
  /** The folder it sits in; absent at the top of the list. */
  folder?: string | null;
  /** Rules make this a smart playlist; its `songs` stay empty. */
  smart?: SmartPlaylist | null;
  /** Home Sharing leaves it out of what other accounts see. */
  private?: boolean;
}

export interface LibraryFolder {
  id: string;
  name: string;
  /** The folder it sits in; absent at the top of the list. */
  parent?: string | null;
}

export interface MusicLibraryState {
  songs: LibrarySong[];
  playlists: LibraryPlaylist[];
  loved: string[];
  /** Playlist folders; absent when there are none. */
  folders?: LibraryFolder[];
}

export type RepeatMode = "off" | "all" | "one";

/** What stays together in a shuffled queue. */
export type ShuffleBy = "songs" | "albums" | "groupings";

export interface MusicPlaybackState {
  /** Song ids in the order they play: `queue[index]` is the song loaded. */
  queue: string[];
  /** The same songs in the order chosen, while shuffled; empty otherwise. */
  unshuffled: string[];
  index: number;
  /** Seconds into the song loaded. */
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** 0 to 100. */
  volume: number;
  /** Newest first. */
  recent: string[];
  /** Times each song was played to its end. */
  plays: Record<string, number>;
  /** Internet Archive songs and radio stations played without being added to the library, which the
   * queue or Recently Played names. */
  guests: LibrarySong[];
  /** While shuffled, where each entry of `queue` stands in `unshuffled`: a song queued twice
   * keeps both of its places across a reload. Absent or empty when not known. */
  order?: number[];
  /**
   * The playback's name since it was last empty or forgotten (`newEpoch`): a page whose copy
   * names an epoch it read from the server, and finds another stored, missed a forget there and
   * takes it up (`forgetHistory`) instead of bringing back what was forgotten. Absent in a
   * playback saved before epochs were kept.
   */
  epoch?: string;
  /** What Shuffle keeps together; absent means songs, none kept together. */
  shuffleBy?: ShuffleBy;
  /** Where each song set to remember its position was left, in seconds. */
  bookmarks?: Record<string, number>;
}

export const EMPTY_LIBRARY: MusicLibraryState = { songs: [], playlists: [], loved: [] };

export const DEFAULT_PLAYBACK: MusicPlaybackState = {
  queue: [],
  unshuffled: [],
  index: 0,
  position: 0,
  shuffle: false,
  repeat: "off",
  volume: 100,
  recent: [],
  plays: {},
  guests: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");
const isNumberOrNull = (value: unknown) => value === null || typeof value === "number";

const isSource = (value: unknown): value is SongSource => {
  if (!isRecord(value)) return false;
  if (value.kind === "file") {
    return (
      typeof value.file === "string" &&
      typeof value.name === "string" &&
      typeof value.type === "string" &&
      typeof value.size === "number"
    );
  }
  if (value.kind === "stream") return typeof value.url === "string";
  return (
    value.kind === "archive" &&
    typeof value.item === "string" &&
    isRecord(value.files) &&
    Object.values(value.files).every((name) => typeof name === "string") &&
    typeof value.license === "string"
  );
};

const isSong = (value: unknown): value is LibrarySong =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.artist === "string" &&
  typeof value.album === "string" &&
  (value.genre === undefined || typeof value.genre === "string") &&
  (value.composer === undefined || typeof value.composer === "string") &&
  (value.year === undefined || isNumberOrNull(value.year)) &&
  (value.track === undefined || isNumberOrNull(value.track)) &&
  typeof value.duration === "number" &&
  typeof value.added === "number" &&
  (value.artwork === undefined || value.artwork === null || typeof value.artwork === "string") &&
  (value.rating === undefined || isNumberOrNull(value.rating)) &&
  (value.disliked === undefined || typeof value.disliked === "boolean") &&
  [
    "grouping",
    "comments",
    "sortName",
    "sortArtist",
    "sortAlbum",
    "sortAlbumArtist",
    "sortComposer",
    "eqPreset",
  ].every((key) => value[key] === undefined || typeof value[key] === "string") &&
  ["start", "stop", "volumeAdjust"].every(
    (key) => value[key] === undefined || isNumberOrNull(value[key]),
  ) &&
  (value.skipShuffle === undefined || typeof value.skipShuffle === "boolean") &&
  (value.rememberPosition === undefined || typeof value.rememberPosition === "boolean") &&
  (value.unchecked === undefined || typeof value.unchecked === "boolean") &&
  isSource(value.source);

const SMART_RULE_FIELDS: readonly unknown[] = [
  "title",
  "artist",
  "album",
  "genre",
  "year",
  "plays",
  "loved",
  "added",
] satisfies SmartRule["field"][];
const SMART_RULE_OPS: readonly unknown[] = [
  "contains",
  "not-contains",
  "is",
  "is-not",
  "starts",
  "ends",
  "greater",
  "less",
  "in-last",
  "not-in-last",
] satisfies SmartRule["op"][];

const isSmartPlaylist = (value: unknown): value is SmartPlaylist =>
  isRecord(value) &&
  typeof value.all === "boolean" &&
  (value.limit === undefined || typeof value.limit === "number") &&
  Array.isArray(value.rules) &&
  value.rules.every(
    (rule) =>
      isRecord(rule) &&
      SMART_RULE_FIELDS.includes(rule.field) &&
      SMART_RULE_OPS.includes(rule.op) &&
      typeof rule.value === "string",
  );

const isLibrary = (value: unknown): value is MusicLibraryState =>
  isRecord(value) &&
  Array.isArray(value.songs) &&
  value.songs.every(isSong) &&
  Array.isArray(value.playlists) &&
  value.playlists.every(
    (playlist) =>
      isRecord(playlist) &&
      typeof playlist.id === "string" &&
      typeof playlist.name === "string" &&
      isStrings(playlist.songs) &&
      (playlist.folder === undefined ||
        playlist.folder === null ||
        typeof playlist.folder === "string") &&
      (playlist.smart === undefined ||
        playlist.smart === null ||
        isSmartPlaylist(playlist.smart)) &&
      (playlist.private === undefined || typeof playlist.private === "boolean"),
  ) &&
  (value.folders === undefined ||
    (Array.isArray(value.folders) &&
      value.folders.every(
        (folder) =>
          isRecord(folder) &&
          typeof folder.id === "string" &&
          typeof folder.name === "string" &&
          (folder.parent === undefined ||
            folder.parent === null ||
            typeof folder.parent === "string"),
      ))) &&
  isStrings(value.loved);

const isPlayback = (value: unknown): value is MusicPlaybackState =>
  isRecord(value) &&
  isStrings(value.queue) &&
  isStrings(value.unshuffled) &&
  typeof value.index === "number" &&
  typeof value.position === "number" &&
  typeof value.shuffle === "boolean" &&
  (value.repeat === "off" || value.repeat === "all" || value.repeat === "one") &&
  typeof value.volume === "number" &&
  isStrings(value.recent) &&
  isRecord(value.plays) &&
  Object.values(value.plays).every((count) => typeof count === "number") &&
  (value.guests === undefined ||
    (Array.isArray(value.guests) &&
      value.guests.every((song) => isSong(song) && song.source.kind !== "file"))) &&
  (value.order === undefined ||
    (Array.isArray(value.order) &&
      value.order.every((place) => Number.isInteger(place) && place >= 0))) &&
  (value.epoch === undefined || typeof value.epoch === "string") &&
  (value.bookmarks === undefined ||
    (isRecord(value.bookmarks) &&
      Object.values(value.bookmarks).every((place) => typeof place === "number"))) &&
  (value.shuffleBy === undefined ||
    value.shuffleBy === "songs" ||
    value.shuffleBy === "albums" ||
    value.shuffleBy === "groupings");

/** A new name for a playback, given when it is first saved after it was empty or forgotten. */
export function newEpoch(): string {
  return `pb-${crypto.randomUUID()}`;
}

/**
 * `playback` with what a forget elsewhere took away left out, named `epoch`: only the song
 * loaded stays, at its place; Up Next, Recently Played, the play counts and the Internet Archive
 * songs kept for them go. Shuffle, repeat and volume are the page's own settings and stay.
 */
export function forgetHistory(playback: MusicPlaybackState, epoch: string): MusicPlaybackState {
  const id = playback.queue[playback.index];
  const queue = id === undefined ? [] : [id];
  return {
    ...playback,
    queue,
    unshuffled: playback.shuffle ? queue : [],
    index: 0,
    recent: [],
    plays: {},
    guests: (playback.guests ?? []).filter((song) => song.id === id),
    order: playback.shuffle && queue.length > 0 ? [0] : [],
    epoch,
  };
}

/**
 * Whether a library `GET` reply is one the window can read: a library, or `null` before the
 * person has saved one. Anything else is stored data that must not be saved over.
 */
export function libraryReadable(reply: unknown): boolean {
  const library = isRecord(reply) ? reply.library : undefined;
  return library === null || isLibrary(library);
}

/** The library of a `GET` reply (or a body another window gave), normalised. */
export function libraryFromServer(reply: unknown): MusicLibraryState | undefined {
  const library = isRecord(reply) ? reply.library : undefined;
  if (!isLibrary(library)) return library === null ? EMPTY_LIBRARY : undefined;
  return {
    songs: library.songs.map((song) => ({
      ...song,
      genre: song.genre ?? "",
      year: song.year ?? null,
      track: song.track ?? null,
      artwork: song.artwork ?? null,
    })),
    playlists: library.playlists.map((playlist) => ({ ...playlist, songs: [...playlist.songs] })),
    loved: [...library.loved],
    ...(library.folders?.length
      ? { folders: library.folders.map((folder) => ({ ...folder })) }
      : {}),
  };
}

/** The lyrics typed in Song Info, by song id. */
export type MusicLyrics = Readonly<Record<string, string>>;

/** The lyrics of a `GET` reply: none before the first save, `undefined` when it cannot be read. */
export function lyricsFromServer(reply: unknown): MusicLyrics | undefined {
  const lyrics = isRecord(reply) ? reply.lyrics : undefined;
  if (lyrics === null) return {};
  return isRecord(lyrics) && Object.values(lyrics).every((text) => typeof text === "string")
    ? (lyrics as MusicLyrics)
    : undefined;
}

/** Whether a playback `GET` reply is one the window can read. */
export function playbackReadable(reply: unknown): boolean {
  const playback = isRecord(reply) ? reply.playback : undefined;
  return playback === null || isPlayback(playback);
}

/** A body sent as the page went, kept in the tab until the next page has seen how it fared. */
export interface LeftPlayback {
  text: string;
  rev: number;
  at: number;
}

const LEFT_PLAYBACK_KEY = "macalicious.music.left-playback";
const LEFT_PLAYBACK_MS = 60_000;

export function keepLeftPlayback(left: LeftPlayback): void {
  try {
    globalThis.sessionStorage?.setItem(LEFT_PLAYBACK_KEY, JSON.stringify(left));
  } catch {
    // A browser that keeps nothing here leaves the save as it was: best effort.
  }
}

/** What the page before kept, once: it applies to this load and no other. */
export function takeLeftPlayback(): LeftPlayback | null {
  try {
    const text = globalThis.sessionStorage?.getItem(LEFT_PLAYBACK_KEY);
    if (!text) return null;
    globalThis.sessionStorage.removeItem(LEFT_PLAYBACK_KEY);
    return JSON.parse(text) as LeftPlayback;
  } catch {
    return null;
  }
}

/**
 * The body to send again when the save made as the page went was refused because the page's own
 * earlier save landed first: that save moved the revision by exactly one, and the playback the
 * server holds is still this one, not one forgotten or replaced elsewhere. `null` when it landed, or
 * when anything else moved the revision.
 */
export function leftPlaybackToSend(
  left: LeftPlayback | null,
  reply: unknown,
  revision: number,
  now: number,
): { playback: MusicPlaybackState } | null {
  if (!left || revision !== left.rev + 1 || now - left.at > LEFT_PLAYBACK_MS) return null;
  const stored = playbackFromServer(reply);
  const body: unknown = JSON.parse(left.text);
  if (!stored || !playbackReadable(body)) return null;
  if (JSON.stringify(playbackToServer(stored)) === left.text) return null;
  const { playback } = body as { playback: MusicPlaybackState };
  return playback.epoch === stored.epoch ? { playback } : null;
}

/** The playback of a `GET` reply, or the defaults before the first save. */
export function playbackFromServer(reply: unknown): MusicPlaybackState | undefined {
  const playback = isRecord(reply) ? reply.playback : undefined;
  if (playback === null) return DEFAULT_PLAYBACK;
  if (!isPlayback(playback)) return undefined;
  return {
    ...playback,
    guests: (playback.guests ?? []).map((song) => ({
      ...song,
      genre: song.genre ?? "",
      year: song.year ?? null,
      track: song.track ?? null,
      artwork: song.artwork ?? null,
    })),
  };
}

/** The `PUT` body of the library: only the fields the module keeps. */
export function libraryToServer(library: MusicLibraryState) {
  return {
    library: {
      songs: library.songs.map(songToServer),
      playlists: library.playlists.map(({ id, name, songs, folder, smart, private: hidden }) => ({
        id,
        name,
        songs,
        ...(folder ? { folder } : {}),
        ...(smart ? { smart } : {}),
        ...(hidden ? { private: true } : {}),
      })),
      loved: library.loved,
      ...(library.folders?.length
        ? {
            folders: library.folders.map(({ id, name, parent }) => ({
              id,
              name,
              ...(parent ? { parent } : {}),
            })),
          }
        : {}),
    },
  };
}

function songToServer(song: LibrarySong) {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    genre: song.genre,
    ...(song.composer ? { composer: song.composer } : {}),
    year: song.year,
    track: song.track,
    duration: song.duration,
    added: song.added,
    artwork: song.artwork,
    ...(song.rating ? { rating: song.rating } : {}),
    ...(song.disliked ? { disliked: true } : {}),
    ...(song.grouping ? { grouping: song.grouping } : {}),
    ...(song.comments ? { comments: song.comments } : {}),
    ...(song.sortName ? { sortName: song.sortName } : {}),
    ...(song.sortArtist ? { sortArtist: song.sortArtist } : {}),
    ...(song.sortAlbum ? { sortAlbum: song.sortAlbum } : {}),
    ...(song.sortAlbumArtist ? { sortAlbumArtist: song.sortAlbumArtist } : {}),
    ...(song.sortComposer ? { sortComposer: song.sortComposer } : {}),
    ...(song.rememberPosition ? { rememberPosition: true } : {}),
    ...(song.start ? { start: song.start } : {}),
    ...(song.stop ? { stop: song.stop } : {}),
    ...(song.volumeAdjust ? { volumeAdjust: song.volumeAdjust } : {}),
    ...(song.eqPreset ? { eqPreset: song.eqPreset } : {}),
    ...(song.skipShuffle ? { skipShuffle: true } : {}),
    ...(song.unchecked ? { unchecked: true } : {}),
    source: song.source,
  };
}

/** How many Internet Archive songs outside the library one playback keeps (`MAX_GUESTS`). */
const MAX_GUESTS = 200;

/**
 * The `PUT` body of the playback. Positions are kept to a tenth of a second.
 *
 * The body stays under `MUSIC_LIMITS.playbackBytes` whatever the queue holds, and names only
 * songs it can play after a reload: the Internet Archive songs outside the library it keeps
 * (at most `MAX_GUESTS`: the one loaded, then what comes next, then what came before, then
 * Recently Played) are the only ones its queue and history name. A queue too large to send is
 * cut to a window around the song loaded, mostly what comes next, until it fits. While
 * shuffled, each entry keeps its own place in the order chosen.
 */
export function playbackToServer(playback: MusicPlaybackState) {
  const length = playback.queue.length;
  const at = Math.min(Math.max(0, Math.floor(playback.index) || 0), length);
  const recent = [...new Set(playback.recent)].slice(0, MUSIC_LIMITS.recent);
  // The place of every entry in the order chosen, when the player knows it.
  const order = playback.order ?? [];
  const knownOrder =
    playback.shuffle &&
    order.length === length &&
    playback.unshuffled.length === length &&
    order.every((place, i) => playback.unshuffled[place] === playback.queue[i]);
  const guestById = new Map<string, LibrarySong>();
  for (const song of playback.guests ?? []) {
    if (song.source.kind !== "file" && !guestById.has(song.id)) guestById.set(song.id, song);
  }
  const fixed = {
    position: Math.round(Math.max(0, playback.position) * 10) / 10,
    shuffle: playback.shuffle,
    repeat: playback.repeat,
    ...(playback.shuffleBy && playback.shuffleBy !== "songs"
      ? { shuffleBy: playback.shuffleBy }
      : {}),
    ...(playback.bookmarks && Object.keys(playback.bookmarks).length > 0
      ? {
          bookmarks: Object.fromEntries(
            Object.entries(playback.bookmarks).slice(-MUSIC_LIMITS.songs),
          ),
        }
      : {}),
    volume: Math.round(Math.min(100, Math.max(0, playback.volume))),
    // More counts than are kept: the most played stay, newest first among equals, so a song
    // just played still counts and Top 25 Most Played keeps its leaders.
    plays: Object.fromEntries(
      Object.entries(playback.plays)
        .filter(([, count]) => Number.isInteger(count) && count > 0)
        .reverse()
        .sort(([, a], [, b]) => b - a)
        .slice(0, MUSIC_LIMITS.songs),
    ),
  };
  const build = (keep: number, withRecent: boolean, withPlays: boolean) => {
    // The window holds the song loaded (or the end, after the last song), a tenth of it before.
    const from = Math.max(0, Math.min(at - Math.min(at, Math.floor(keep / 10)), length - keep));
    const window = playback.queue.slice(from, from + keep).map((id, i) => ({
      id,
      place: knownOrder ? (order[from + i] as number) : -1,
      loaded: from + i === at,
    }));
    // The guests kept: the song loaded, then what plays next, then what played before, then
    // Recently Played; an entry or a history line naming a guest not kept goes with it.
    const loadedAt = window.findIndex((entry) => entry.loaded);
    // After the last song (nothing loaded) the window counts back from its end.
    const ranked = (
      loadedAt >= 0
        ? [...window.slice(loadedAt), ...window.slice(0, loadedAt).reverse()]
        : [...window].reverse()
    ).map((entry) => entry.id);
    const kept = new Set<string>();
    for (const id of [...ranked, ...(withRecent ? recent : [])]) {
      if (kept.size >= MAX_GUESTS) break;
      if (guestById.has(id)) kept.add(id);
    }
    const keeps = (id: string) => !guestById.has(id) || kept.has(id);
    const entries = window.filter((entry) => entry.loaded || keeps(entry.id));
    const queue = entries.map((entry) => entry.id);
    const loadedIndex = entries.findIndex((entry) => entry.loaded);
    const index = loadedIndex >= 0 ? loadedIndex : queue.length;
    let unshuffled: string[] = [];
    let places: number[] = [];
    if (playback.shuffle && knownOrder) {
      // The entries kept, in the order chosen, and each one's place among them.
      const sorted = entries.map((entry) => entry.place).sort((a, b) => a - b);
      const rank = new Map(sorted.map((place, i) => [place, i]));
      unshuffled = sorted.map((place) => playback.unshuffled[place] as string);
      places = entries.map((entry) => rank.get(entry.place) as number);
    } else if (playback.shuffle) {
      // Without the places: as many entries of each song as the queue keeps.
      const left = new Map<string, number>();
      for (const id of queue) left.set(id, (left.get(id) ?? 0) + 1);
      unshuffled = playback.unshuffled.filter((id) => {
        const n = left.get(id) ?? 0;
        if (n <= 0) return false;
        left.set(id, n - 1);
        return true;
      });
    }
    const recentKept = withRecent ? recent.filter(keeps) : [];
    const named = new Set([...queue, ...recentKept]);
    const guests = [...guestById.values()].filter(
      (song) => kept.has(song.id) && named.has(song.id),
    );
    return {
      playback: {
        queue,
        unshuffled,
        index,
        ...fixed,
        plays: withPlays ? fixed.plays : {},
        recent: recentKept,
        guests: guests.map(songToServer),
        order: places,
        ...(playback.epoch ? { epoch: playback.epoch } : {}),
      },
    };
  };
  let keep = Math.min(length, MUSIC_LIMITS.queue);
  let body = build(keep, true, true);
  while (bodySize(body) > MUSIC_LIMITS.playbackBytes && keep > 1) {
    keep = Math.max(1, Math.floor(keep * 0.75));
    body = build(keep, true, true);
  }
  // One song left and still too large: Recently Played goes, then the play counts, before the
  // song loaded does. What is left then (one song, its one guest) is far under the limit.
  if (bodySize(body) > MUSIC_LIMITS.playbackBytes) body = build(keep, false, true);
  if (bodySize(body) > MUSIC_LIMITS.playbackBytes) body = build(keep, false, false);
  return body;
}

/** The size of a `PUT` body as the document helper sends it, with the largest revision and a
 * session id as long as it sends. */
function bodySize(body: object): number {
  const envelope = { ...body, rev: Number.MAX_SAFE_INTEGER, session: "0".repeat(128) };
  return new TextEncoder().encode(JSON.stringify(envelope)).length;
}

/** Whether a request body is small enough for `keepalive`: browsers refuse one over 64 KiB, counted
 * in bytes, with room left for the session id `sessionFetch` may add. */
export const fitsKeepalive = (body: string) => new TextEncoder().encode(body).length < 60_000;

/** The text the window shows for a song without an artist or album. */
export const UNKNOWN_ARTIST = "Unknown Artist";
export const UNKNOWN_ALBUM = "Unknown Album";

const NEUTRAL_COVERS: readonly MusicCover[] = [
  { ground: "#5a5f66", ink: "#8a9099", motif: "rings" },
  { ground: "#6b5d55", ink: "#a08f84", motif: "wave" },
  { ground: "#4f5d58", ink: "#80918a", motif: "grid" },
  { ground: "#5d566b", ink: "#8f88a0", motif: "bars" },
];

/** A stable placeholder cover for an album without one. */
function placeholderCover(key: string): MusicCover {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return NEUTRAL_COVERS[hash % NEUTRAL_COVERS.length] as MusicCover;
}

/** The cover of a song: its uploaded artwork, or its Internet Archive item's picture. */
export function artworkUrl(song: LibrarySong): string | undefined {
  if (song.artwork) return `${MUSIC_ARTWORK_URL}${song.artwork}`;
  if (song.source.kind === "archive") {
    return `https://archive.org/services/img/${encodeURIComponent(song.source.item)}`;
  }
  return undefined;
}

/** The id of a song's album in the window: its album and artist. */
export const albumKey = (song: Pick<LibrarySong, "album" | "artist">) =>
  `${song.artist || UNKNOWN_ARTIST}\u0000${song.album || UNKNOWN_ALBUM}`;

/**
 * The library as the window's albums: songs grouped by album and artist, each album's songs in
 * track order, albums by title. `added` is in days before `now`, as Recently Added sorts it.
 */
export function albumsOf(library: MusicLibraryState, now: number): MusicAlbum[] {
  const groups = new Map<string, LibrarySong[]>();
  for (const song of library.songs) {
    const key = albumKey(song);
    const list = groups.get(key);
    if (list) list.push(song);
    else groups.set(key, [song]);
  }
  return [...groups.entries()]
    .map(([key, songs]) => {
      const sorted = [...songs].sort(
        (a, b) =>
          (a.track ?? Number.MAX_SAFE_INTEGER) - (b.track ?? Number.MAX_SAFE_INTEGER) ||
          a.title.localeCompare(b.title),
      );
      const first = sorted[0] as LibrarySong;
      const latest = Math.max(...songs.map((song) => song.added));
      return {
        id: key,
        title: first.album || UNKNOWN_ALBUM,
        artist: first.artist || UNKNOWN_ARTIST,
        genre: sorted.find((song) => song.genre)?.genre ?? "",
        year: sorted.find((song) => song.year)?.year ?? 0,
        added: Math.max(0, (now - latest) / 86_400_000),
        cover: placeholderCover(key),
        artwork: sorted.map(artworkUrl).find(Boolean),
        songs: sorted.map((song) => ({ id: song.id, title: song.title, duration: song.duration })),
      } satisfies MusicAlbum;
    })
    .sort(
      (a, b) =>
        a.title.localeCompare(b.title) ||
        albumArtistOrder(a.songs[0]?.id, library).localeCompare(
          albumArtistOrder(b.songs[0]?.id, library),
        ),
    );
}

/** What an album sorts under among those of its name: Sort Album Artist, else its artist. */
function albumArtistOrder(firstSong: string | undefined, library: MusicLibraryState): string {
  const song = library.songs.find((each) => each.id === firstSong);
  return song?.sortAlbumArtist || song?.artist || "";
}

/** Every song of the library as tracks with their albums, by song id. */
export function tracksById(albums: readonly MusicAlbum[]): Map<string, MusicTrack> {
  const map = new Map<string, MusicTrack>();
  for (const album of albums) for (const song of album.songs) map.set(song.id, { song, album });
  return map;
}

/** The tracks of `ids` that are still in the library, in order. */
export function tracksOfIds(ids: readonly string[], tracks: ReadonlyMap<string, MusicTrack>) {
  return ids.flatMap((id) => {
    const track = tracks.get(id);
    return track ? [track] : [];
  });
}

/**
 * The file of an Internet Archive song this browser plays: MP3 where it can, else Ogg Vorbis,
 * else FLAC. `canPlay` is `HTMLMediaElement.canPlayType`.
 */
export function archiveFile(
  source: Extract<SongSource, { kind: "archive" }>,
  canPlay: (type: string) => string,
): string | undefined {
  const order: [ArchiveFormat, string][] = [
    ["mp3", "audio/mpeg"],
    ["ogg", 'audio/ogg; codecs="vorbis"'],
    ["flac", "audio/flac"],
  ];
  for (const [format, type] of order) {
    const name = source.files[format];
    if (name && canPlay(type) !== "") return name;
  }
  return undefined;
}

/** The archive.org address of a file of an item, which answers range requests. */
export function archiveDownloadUrl(item: string, file: string): string {
  return `https://archive.org/download/${encodeURIComponent(item)}/${file
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** One search result of the Internet Archive. */
export interface ArchiveResult {
  identifier: string;
  title: string;
  creator: string | null;
  year: number | null;
  license: string;
}

export interface ArchiveSearchPage {
  results: ArchiveResult[];
  total: number;
  page: number;
  rows: number;
}

/** One track of an Internet Archive item. */
export interface ArchiveTrack {
  id: string;
  title: string;
  artist: string | null;
  album: string;
  track: number | null;
  duration: number | null;
  files: Partial<Record<ArchiveFormat, string>>;
}

export interface ArchiveItem {
  identifier: string;
  title: string;
  creator: string | null;
  year: number | null;
  license: string;
  tracks: ArchiveTrack[];
}

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

/** Searches the Internet Archive's openly licensed music (`query` empty: the most played). */
export async function searchArchive(query: string, page = 1): Promise<ArchiveSearchPage> {
  const body = await getJson(
    `${MUSIC_ARCHIVE_SEARCH_URL}?q=${encodeURIComponent(query.slice(0, 100))}&page=${page}`,
  );
  if (!isRecord(body) || !Array.isArray(body.results)) throw new Error("not a search reply");
  return body as unknown as ArchiveSearchPage;
}

/** One Internet Archive item and its tracks. */
export async function readArchiveItem(identifier: string): Promise<ArchiveItem> {
  const body = await getJson(`${MUSIC_ARCHIVE_ITEM_URL}${encodeURIComponent(identifier)}`);
  if (!isRecord(body) || !Array.isArray(body.tracks)) throw new Error("not an item reply");
  return body as unknown as ArchiveItem;
}

/** The genres Radio offers, as the directory's tags (`radio::GENRES`). */
export const RADIO_GENRES = ["pop", "rock", "jazz", "classical", "dance", "news"] as const;
export type RadioGenre = (typeof RADIO_GENRES)[number];

/** A station of the Radio Browser directory. */
export interface RadioStation {
  id: string;
  name: string;
  /** An https address the browser plays from. */
  url: string;
  country: string;
  genre: string;
  /** In kbps; 0 when the directory does not know it. */
  bitrate: number;
}

/** A page of stations, most listened first; `more` when a further page may hold some. */
export async function searchRadio(
  name: string,
  genre: RadioGenre | "",
  page: number,
): Promise<{ stations: RadioStation[]; more: boolean }> {
  const body = await getJson(
    `${MUSIC_RADIO_URL}?name=${encodeURIComponent(name.slice(0, 100))}&genre=${genre}&page=${page}`,
  );
  if (!isRecord(body) || !Array.isArray(body.stations)) throw new Error("not a stations reply");
  return body as unknown as { stations: RadioStation[]; more: boolean };
}

/** The song of a station: a stream of no fixed length, the same song each time it is asked for. */
export function songFromStation(station: RadioStation, now: number): LibrarySong {
  return {
    id: `radio-${station.id}`,
    title: station.name.slice(0, MUSIC_LIMITS.text),
    artist: station.country.slice(0, MUSIC_LIMITS.text),
    album: "Internet Radio",
    genre: station.genre.slice(0, MUSIC_LIMITS.text),
    year: null,
    track: null,
    duration: 0,
    added: now,
    artwork: null,
    source: { kind: "stream", url: station.url },
  };
}

/** A library song for a track of an Internet Archive item. */
export function songFromArchive(item: ArchiveItem, track: ArchiveTrack, now: number): LibrarySong {
  // The same track is the same song: adding it again finds it in the library.
  const id = archiveSongId(item.identifier, track.id);
  return {
    id,
    title: (track.title || track.id).slice(0, MUSIC_LIMITS.text),
    artist: (track.artist ?? item.creator ?? "").slice(0, MUSIC_LIMITS.text),
    album: (track.album || item.title).slice(0, MUSIC_LIMITS.text),
    genre: "",
    year: item.year,
    track: track.track,
    duration: track.duration ?? 0,
    added: now,
    artwork: null,
    source: {
      kind: "archive",
      item: item.identifier,
      files: { ...track.files },
      license: item.license,
    },
  };
}

/** A plain id (letters, digits, `-`, `_`, `.`; at most 128) for a track of an item. */
export function archiveSongId(item: string, track: string): string {
  let hash = 0x811c9dc5;
  for (const char of `${item}/${track}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `ia-${item.slice(0, 100)}-${hash.toString(16).padStart(8, "0")}`;
}

/** The SHA-256 of `bytes` in lowercase hex. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Keeps a cover on the server under its digest; resolves with the digest. */
export async function uploadArtwork(bytes: Uint8Array): Promise<string> {
  const digest = await sha256Hex(bytes);
  await withDeadline(async (signal) => {
    const response = await sessionFetch(`${MUSIC_ARTWORK_URL}${digest}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/octet-stream" },
      body: bytes as Uint8Array<ArrayBuffer>,
      signal,
    });
    if (!response.ok) throw new Error(`the cover was not kept (HTTP ${response.status})`);
  });
  return digest;
}

/** The size of the library's `PUT` body, in bytes: a library over `MUSIC_LIMITS.libraryBytes`
 * is not kept. Measured with the largest revision and a session id as long as the document
 * helper sends, which is more than the library alone takes. */
export function librarySize(library: MusicLibraryState): number {
  return bodySize(libraryToServer(library));
}
