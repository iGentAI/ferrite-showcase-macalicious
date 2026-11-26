import { crossfadeLevels } from "./music-audio";
import {
  albumKey,
  archiveDownloadUrl,
  archiveFile,
  artworkUrl,
  DEFAULT_PLAYBACK,
  forgetHistory,
  type LibrarySong,
  MUSIC_LIMITS,
  type MusicPlaybackState,
  newEpoch,
  type RepeatMode,
  type ShuffleBy,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
} from "./music-server";
import { ownerOfBorrowed } from "./music-sharing";

/**
 * Music's player on the Ferrite desktop: one audio element for the page, and a second for the song a
 * crossfade brings in; the queue it plays
 * (Up Next), shuffle, repeat, volume, Recently Played and play counts. The Music window and its
 * MiniPlayer both show it and drive it, so switching between them, or between the window's
 * views, never interrupts a song. It stops when the last of them closes, as quitting Music does.
 *
 * Seeking: an uploaded song is read from the drive in pieces and joined into one `Blob`, whose
 * object URL the audio element plays, so a seek is answered from memory. An Internet Archive
 * song is played from archive.org, which answers range requests, so the browser fetches only
 * the part it seeks to.
 */
export interface PlayerState extends MusicPlaybackState {
  playing: boolean;
  /** The length of the song loaded, once the browser knows it; else its library length. */
  duration: number;
  /** True while the song's sound is being fetched. */
  loading: boolean;
  /** Why the song loaded cannot be played, if it cannot. */
  error: string | null;
  /** True once the stored playback has been read (or found absent). */
  restored: boolean;
  /** Counts the changes of the library the queue is looked up in, so that a window showing
   * `current()` or `upNext()` renders again when it changes. */
  songs: number;
}

/** The subset of `HTMLAudioElement` the player uses (a test gives a fake). */
export interface AudioLike {
  src: string;
  currentTime: number;
  duration: number;
  volume: number;
  paused: boolean;
  /** Why the media failed, as the browser's `MediaError` says (`code` 2: network, 3: decode,
   * 4: source not supported); `null` while it has not. */
  readonly error?: { readonly code: number } | null;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
  canPlayType(type: string): string;
  addEventListener(type: string, listener: () => void): void;
}

/** Where the player keeps playback: the module's `playback` document. */
export interface PlaybackStore {
  load(): Promise<MusicPlaybackState | undefined>;
  save(playback: MusicPlaybackState): void;
  /**
   * Save as the page goes away (a reload, a closed tab, a page left): a request that outlives
   * the page, since one a page sends as it goes is cancelled by some browsers (WebKit refuses a
   * fetch begun while the page unloads). Without it, `save` is used.
   */
  saveOnLeave?(playback: MusicPlaybackState): void;
}

export interface PlayerOptions {
  createAudio?: () => AudioLike;
  /** The bytes of a drive file, joined from its pieces. */
  readFile?: (fileId: string) => Promise<Blob>;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  /** Orders a shuffled queue (a test gives a fixed one). */
  random?: () => number;
  /** How long changes wait before they are saved together, in ms. */
  saveDelayMs?: number;
  /**
   * Whether the address of an Internet Archive song answers at all: asked when one of its songs
   * fails to load, so the window says whether the Archive could not be reached or answered with
   * something the browser could not play.
   */
  reachable?: (url: string) => Promise<boolean>;
  /** How long an Internet Archive song may stay loading before it is taken as stalled, in ms. */
  stallMs?: number;
}

/** Back to the start of a song rather than to the song before, after this many seconds. */
export const PREVIOUS_RESTARTS_AFTER = 3;
/** What the Media Session's seek-backward and -forward keys move by, in seconds. */
export const MEDIA_KEY_SEEK = 10;
/** How many joined uploaded songs stay in memory, for a quick previous or next. */
const CACHED_FILES = 3;
/** While a song plays, its place is saved each time it has moved this many seconds. */
export const POSITION_SAVE_STEP = 10;
/** A restored song saved this close to its end had finished, and starts again from 0:00. */
export const RESUME_END_MARGIN = 1;
/** The most Internet Archive songs kept outside the library (the module's `MAX_GUESTS`). */
const MAX_GUESTS = 200;
/** How often the levels of a crossfade move, in ms. */
const CROSSFADE_TICK_MS = 50;
/** How long before a crossfade an uploaded next song starts being read, in seconds. */
const CROSSFADE_READ_AHEAD = 15;
/** How long a song's sound waits for its Sound Check level, in ms; then it starts without it. */
const LEVEL_WAIT_MS = 1_500;

/** What the window says when a song cannot play, by cause. Each says what happened and what to
 * do; none claims the browser cannot play what it could. */
export const PLAYBACK_ERRORS = {
  /** A stream whose address sent nothing a page may play. */
  stream:
    "This stream can’t play here: its address didn’t answer, or doesn’t let a web page play its sound.",
  /** The browser could not decode the song's file. */
  damaged:
    "This song’s file can’t be decoded: it is damaged, or in a format this browser doesn’t play.",
  /** An Internet Archive song whose address did not answer. */
  unreachable:
    "The Internet Archive can’t be reached, so this song can’t play. Press Play to try again.",
  /** An Internet Archive song whose address answered, but not with sound the browser plays (an
   * error page of the Archive's, a file gone there, or one in another format). */
  refused:
    "The Internet Archive didn’t give this song’s file in a form this browser plays; it may be unavailable there for now. Press Play to try again.",
  /** An Internet Archive song that stopped arriving. */
  stalled: "The Internet Archive stopped answering, so this song stopped. Press Play to try again.",
  /** An Internet Archive song that failed, while its address is asked again. */
  checking: "This song didn’t load. Checking whether the Internet Archive can be reached…",
  /** An uploaded song whose drive file is gone. */
  missing: "This song’s file is no longer in your drive. Delete the song, or add its file again.",
  /** An uploaded song whose drive file could not be read. */
  unread: "This song couldn’t be read from your drive. Press Play to try again.",
  /** The browser wants a press of Play before it plays sound. */
  notAllowed: "Click Play to start the song.",
} as const;

/** How long an Internet Archive song may stay loading before it is taken as stalled, in ms. */
export const STALL_MS = 15_000;
/** How long the check that the Internet Archive answers may take, in ms. */
const REACHABLE_MS = 5_000;
/** `MediaError` codes (jsdom and some hosts have no `MediaError`). */
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;

/**
 * Whether `url` answers at all: a `HEAD` request without CORS, whose opaque answer says only
 * that something answered. A network failure, or no answer within `REACHABLE_MS`, is no.
 */
async function answers(url: string): Promise<boolean> {
  if (typeof fetch !== "function") return false;
  // Only the Internet Archive is probed: a no-cors request elsewhere is never made.
  if (!url.startsWith("https://archive.org/")) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REACHABLE_MS);
  try {
    await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Where each entry of a shuffled `queue` stands in `unshuffled`, matching the n-th time a song
 * appears in one to the n-th time it appears in the other. Empty when the two do not hold the
 * same entries.
 */
export function orderOf(queue: readonly string[], unshuffled: readonly string[]): number[] {
  if (queue.length !== unshuffled.length) return [];
  const places = new Map<string, number[]>();
  for (const [i, id] of unshuffled.entries()) places.set(id, [...(places.get(id) ?? []), i]);
  const order: number[] = [];
  for (const id of queue) {
    const place = places.get(id)?.shift();
    if (place === undefined) return [];
    order.push(place);
  }
  return order;
}

/** Whether a place `at` seconds into a song `length` seconds long is at its end. */
function finished(at: number, length: number): boolean {
  return at >= length - RESUME_END_MARGIN;
}

type Listener = () => void;

/** What is playing now, from where. */
export interface LoadedSound {
  media: HTMLMediaElement;
  song: LibrarySong;
  url: string;
}

export class MusicPlayer {
  private state: PlayerState = {
    ...DEFAULT_PLAYBACK,
    playing: false,
    duration: 0,
    loading: false,
    error: null,
    restored: false,
    songs: 0,
  };
  private readonly listeners = new Set<Listener>();
  private audio: AudioLike | null = null;
  /** The other element: free, or the song a crossfade is leaving. */
  private spare: AudioLike | null = null;
  /** How long a crossfade lasts, in seconds; 0 when songs do not crossfade. */
  private crossfadeSeconds = 0;
  /** The song a crossfade is leaving: its element, its full level, and the fade's start and length
   * in ms. */
  private leaving: { audio: AudioLike; level: number; from: number; length: number } | null = null;
  /** The share of its level the song a crossfade brings in has reached: 1 when it is not fading. */
  private comingLevel = 1;
  /** When that song began to sound; `null` until it has. */
  private comingFrom: number | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  /** The next song already asked for, once per song loaded. */
  private readAhead: string | null = null;
  /** The song being left was played to its end, so it has no place to keep. */
  private endedSong = false;
  /** Asked before a song's sound starts: Sound Check's measuring. */
  private beforeSound: ((sound: LoadedSound) => Promise<void>) | null = null;
  private songs = new Map<string, LibrarySong>();
  /** The songs of the libraries others share now (`setBorrowed`). */
  private borrowed = new Map<string, LibrarySong>();
  private store: PlaybackStore | null = null;
  /** The page's one read of the stored playback: made by the first window that connects, and
   * never made again. */
  private restoring: Promise<void> | null = null;
  /** Whether that read succeeded: only then is playback saved, so a document that could not be
   * read is never saved over. */
  private canSave = false;
  private loadedId: string | null = null;
  /** The song whose sound is being fetched, before it is loaded. */
  private loadingId: string | null = null;
  private loadToken = 0;
  private pendingSeek: number | null = null;
  /**
   * The place saved with the restored playback, kept until the song is played from it, sought
   * or changed. The library's length may arrive after it, and the media's own length only once
   * the song loads, so it is checked against both.
   */
  private resumeAt: number | null = null;
  /** Whether the seek waiting for the media's metadata is that saved place. */
  private resumingSeek = false;
  private savedPosition = 0;
  private lifecycle = false;
  private readonly files = new Map<string, string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Ends the load of an Internet Archive song that never starts or stops arriving. */
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private attached = 0;
  /**
   * While shuffled, where each queue entry stands in `unshuffled`: `order[i]` is the place of
   * `queue[i]` there. Entries are told apart by place, not by song, so a song queued twice
   * keeps both of its places when shuffle ends or one of them is removed.
   */
  private order: number[] = [];
  private readonly options: Required<PlayerOptions>;
  /** Each open window's song-change notification (Music's "song changes" banner). */
  private readonly songStartListeners = new Set<(song: LibrarySong) => void>();
  /** Each open window's note that the stored playback was forgotten elsewhere. */
  private readonly forgottenListeners = new Set<() => void>();
  /** The epoch of the playback as this page read it from the server (or took up after a forget),
   * as opposed to one it gave a playback it found empty: only a change from this one is a forget
   * this page missed. */
  private seenEpoch: string | null = null;

  constructor(options: PlayerOptions = {}) {
    this.options = {
      createAudio:
        options.createAudio ??
        (() => {
          const audio = new Audio();
          // The Internet Archive answers with CORS headers, which lets its sound reach Web Audio
          // (the Equalizer and Visualizer); without this the browser would silence it there.
          audio.crossOrigin = "anonymous";
          return audio;
        }),
      readFile:
        options.readFile ??
        (async () => {
          throw new Error("the drive is not available");
        }),
      createObjectURL: options.createObjectURL ?? ((blob) => URL.createObjectURL(blob)),
      revokeObjectURL: options.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url)),
      random: options.random ?? Math.random,
      saveDelayMs: options.saveDelayMs ?? 400,
      reachable: options.reachable ?? answers,
      stallMs: options.stallMs ?? STALL_MS,
    };
  }

  // ---- Reading -------------------------------------------------------------------------

  getState = (): PlayerState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A song of the library, an Internet Archive song played without being added, or a song of
   * another account's shared library. */
  lookup(id: string): LibrarySong | undefined {
    return (
      this.songs.get(id) ??
      this.state.guests.find((song) => song.id === id) ??
      this.borrowed.get(id)
    );
  }

  /** Whether `id` is a song of another account's shared library. */
  isBorrowed(id: string): boolean {
    return this.borrowed.has(id);
  }

  /**
   * The songs of the libraries others share now. They are held only in this page: the playback
   * saved names none of them. A song no longer here stops if it is loaded, and what was read of
   * its sound goes, so that a library turned off plays no further.
   */
  setBorrowed(songs: readonly LibrarySong[]): void {
    const gone = [...this.borrowed.keys()].filter((id) => !songs.some((song) => song.id === id));
    this.borrowed = new Map(songs.map((song) => [song.id, song]));
    if (gone.length === 0) return;
    const active = this.loadedId ?? this.loadingId;
    if (active && gone.includes(active)) this.stop();
    for (const id of gone) {
      const read = this.files.get(id);
      if (read !== undefined) {
        this.files.delete(id);
        this.options.revokeObjectURL(read);
      }
    }
    this.notify();
  }

  /** The song loaded, if it can still be found. */
  current(): LibrarySong | undefined {
    const id = this.state.queue[this.state.index];
    return id === undefined ? undefined : this.lookup(id);
  }

  /** The songs after the one loaded, in the order they will play, each with its place in the
   * queue (for `jump`). Ids that can no longer be found are left out. */
  upNext(): { song: LibrarySong; index: number }[] {
    return this.state.queue.flatMap((id, index) => {
      if (index <= this.state.index) return [];
      const song = this.lookup(id);
      return song ? [{ song, index }] : [];
    });
  }

  // ---- Wiring --------------------------------------------------------------------------

  /** The library the queue's ids are looked up in; called whenever it changes. */
  setLibrary(songs: readonly LibrarySong[]): void {
    this.songs = new Map(songs.map((song) => [song.id, song]));
    // A song deleted from the library while loaded, or while its sound is still being fetched,
    // stops; ids that can no longer be found are skipped when they come up.
    const active = this.loadedId ?? this.loadingId;
    if (active && !this.lookup(active)) this.stop();
    // Songs played from the Internet Archive and now added are the library's: the playback no
    // longer keeps a copy, so one deleted later is gone, and the playback saved changes.
    this.set({
      songs: this.state.songs + 1,
      guests: this.state.guests.filter((guest) => !this.songs.has(guest.id)),
      // Nothing loaded: the song selected shows its library length, now that it can be found,
      // and the place it resumes from, measured against that length.
      ...(this.loadedId === null ? { duration: this.current()?.duration ?? 0 } : {}),
      ...(this.loadedId === null && this.loadingId === null && this.resumeAt !== null
        ? { position: this.resumePosition() }
        : {}),
    });
    this.save();
  }

  /** Hear each new song that starts; returns the window's own unsubscribe. */
  onSongStart(listener: (song: LibrarySong) => void): () => void {
    this.songStartListeners.add(listener);
    return () => this.songStartListeners.delete(listener);
  }

  /** Hear that the stored playback was forgotten elsewhere (`forgotten`); returns the
   * window's own unsubscribe. */
  onForgotten(listener: () => void): () => void {
    this.forgottenListeners.add(listener);
    return () => this.forgottenListeners.delete(listener);
  }

  /**
   * The stored playback was forgotten elsewhere (another window or browser of the person, or a
   * forget of the document), and is now named `epoch`: what it held stays forgotten. Up Next,
   * Recently Played, the play counts and the Internet Archive songs kept for them go; only the
   * song loaded stays, at its place, playing or not, since it is what this page is doing now
   * (`forgetHistory`). That is saved at once, so the page goes on saving from there rather than
   * bringing back what was forgotten.
   */
  forgotten(epoch: string): void {
    const next = forgetHistory(this.state, epoch);
    this.order = next.order ?? [];
    this.seenEpoch = epoch;
    this.set({
      queue: next.queue,
      unshuffled: next.unshuffled,
      index: next.index,
      recent: next.recent,
      plays: next.plays,
      guests: next.guests,
      epoch,
    });
    for (const listener of this.forgottenListeners) {
      try {
        listener();
      } catch (error) {
        console.error(error);
      }
    }
    this.save();
  }

  /** Whether `epoch` is the playback's epoch as this page read it from the server. */
  knowsEpoch(epoch: string | undefined): boolean {
    return epoch !== undefined && epoch === this.seenEpoch;
  }

  /** The playback this page started empty and named itself is stored under `epoch`: that is its
   * name from now on. */
  adoptEpoch(epoch: string): void {
    this.seenEpoch = epoch;
    this.set({ epoch });
  }

  /** Whether commands run: at once for a player kept nowhere, and for one connected to a store
   * only once the stored playback has been read, so nothing chosen before it has to be merged
   * with what it holds. */
  private ready(): boolean {
    return this.store === null || this.state.restored;
  }

  /** Internet Archive songs and radio stations to play without adding them to the library: kept
   * with the playback, so that Up Next and Recently Played can name them after a reload. */
  addGuests(songs: readonly LibrarySong[]): void {
    if (!this.ready()) return;
    const fresh = songs
      .filter(
        (song, at) =>
          song.source.kind !== "file" &&
          !this.songs.has(song.id) &&
          songs.findIndex((other) => other.id === song.id) === at,
      )
      .slice(0, MAX_GUESTS);
    if (fresh.length === 0) return;
    // The song playing stays findable whatever is added: it is kept, and the songs added are
    // limited to the room left beside it.
    const playingId = this.state.queue[this.state.index];
    const playing = this.state.guests.find(
      (guest) => guest.id === playingId && !fresh.some((song) => song.id === guest.id),
    );
    const adding = fresh.slice(0, MAX_GUESTS - (playing ? 1 : 0));
    const incoming = new Set(adding.map((song) => song.id));
    const kept = this.state.guests.filter((guest) => !incoming.has(guest.id));
    // Over the limit, the oldest guests go first that nothing still names, then the oldest of
    // the rest; the song playing and the songs being added stay.
    const named = new Set([...this.state.queue, ...this.state.unshuffled, ...this.state.recent]);
    const rank = (guest: LibrarySong) => (guest.id === playingId ? 2 : named.has(guest.id) ? 1 : 0);
    const ranked = [...kept].reverse().sort((a, b) => rank(b) - rank(a));
    const keep = new Set(ranked.slice(0, MAX_GUESTS - adding.length).map((guest) => guest.id));
    this.set({ guests: [...kept.filter((guest) => keep.has(guest.id)), ...adding] });
  }

  setReadFile(readFile: (fileId: string) => Promise<Blob>): void {
    this.options.readFile = readFile;
  }

  /**
   * Keep playback in `store`. The first call reads what it holds, once for the page; every
   * later call (another window, Music opened again) gets that same read. The stored playback is
   * taken as it is (its counts are absolute), because no command runs before it is read. A read
   * that fails leaves Music playing but saving no playback on this page.
   */
  connect(store: PlaybackStore): Promise<void> {
    this.watchLifecycle();
    if (this.restoring) return this.restoring;
    this.store = store;
    this.restoring = store.load().then(
      (stored) => {
        if (stored) this.restore(stored);
        this.canSave = true;
        this.set({ restored: true });
      },
      () => {
        this.canSave = false;
        this.set({ restored: true });
      },
    );
    return this.restoring;
  }

  private restore(stored: MusicPlaybackState) {
    // The end of the queue, `index === queue.length`, is kept: nothing is loaded.
    const index = Math.min(Math.max(0, stored.index), stored.queue.length);
    const unshuffled = stored.shuffle ? stored.unshuffled : [];
    // The places saved with the playback, when they match it; else matched song by song.
    const saved = stored.order ?? [];
    const exact =
      stored.shuffle &&
      saved.length === stored.queue.length &&
      unshuffled.length === stored.queue.length &&
      new Set(saved).size === saved.length &&
      saved.every((place, i) => unshuffled[place] === stored.queue[i]);
    this.order = !stored.shuffle ? [] : exact ? [...saved] : orderOf(stored.queue, unshuffled);
    // A stored shuffle whose two orders do not hold the same entries keeps the queue.
    const fallback = stored.shuffle && this.order.length === 0 && stored.queue.length > 0;
    if (fallback) this.order = stored.queue.map((_, i) => i);
    this.set({
      queue: stored.queue,
      unshuffled: fallback ? stored.queue : unshuffled,
      index,
      shuffle: stored.shuffle,
      repeat: stored.repeat,
      shuffleBy: stored.shuffleBy,
      volume: stored.volume,
      recent: stored.recent,
      plays: stored.plays,
      bookmarks: stored.bookmarks,
      // A guest the library holds by now is the library's song.
      guests: (stored.guests ?? []).filter((guest) => !this.songs.has(guest.id)),
      // The stored name, which this page has now read; a playback found empty (or saved before
      // epochs) gets a name of this page's own, which it has not read from anyone.
      epoch: stored.epoch ?? newEpoch(),
    });
    this.seenEpoch = stored.epoch ?? null;
    // A restored song resumes where it was, unless it had finished; past the end of the queue
    // nothing is loaded.
    const place = stored.position;
    this.resumeAt =
      index < stored.queue.length && Number.isFinite(place) && place > 0 ? place : null;
    const position = this.resumePosition();
    this.savedPosition = position;
    this.set({ duration: this.current()?.duration ?? 0, position });
    this.audioVolume();
  }

  /** Where the restored song starts: its saved place, or 0:00 when that is at its end. */
  private resumePosition(): number {
    if (this.resumeAt === null) return 0;
    const length = this.current()?.duration ?? 0;
    if (length > 0 && finished(this.resumeAt, length)) {
      this.resumeAt = null;
      return 0;
    }
    return this.resumeAt;
  }

  /** Save what is waiting as the page goes away (`pagehide`: a reload, a closed tab): a reload
   * keeps the place in the song. Only then: a page merely hidden (another tab in front) goes on
   * running and saves as usual, and a save sent as a page unloads would be cancelled. */
  private watchLifecycle() {
    if (this.lifecycle || typeof window === "undefined") return;
    this.lifecycle = true;
    window.addEventListener("pagehide", () => this.leave());
  }

  /** The page is going: what is waiting goes to the store's save for leaving. */
  private leave() {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.canSave || !this.store) return;
    const playback = this.playback();
    if (this.store.saveOnLeave) this.store.saveOnLeave(playback);
    else this.store.save(playback);
  }

  /** A window showing the player opened; returns its closing. The last one to close stops it. */
  attach(): () => void {
    this.attached += 1;
    // Back from closed: the media keys reach the player again.
    if (this.attached === 1 && this.audio) this.mediaHandlers();
    let open = true;
    return () => {
      if (!open) return;
      open = false;
      this.attached -= 1;
      if (this.attached === 0) {
        // Deferred: a window that closes and opens again in one step (a re-render) keeps playing.
        // Closed for good, the player lets go of the sound it holds, as quitting Music does.
        setTimeout(() => {
          if (this.attached !== 0) return;
          if (this.state.playing) this.pause();
          this.flush();
          this.endCrossfade();
          this.audio?.pause();
          this.unload();
          for (const url of this.files.values()) this.options.revokeObjectURL(url);
          this.files.clear();
          // A fetch cut short by closing leaves nothing loading.
          this.set({ loading: false });
          this.clearMediaSession();
        }, 0);
      }
    };
  }

  // ---- Commands ------------------------------------------------------------------------

  /** Play `ids` from `start`: the queue becomes them (shuffled after the first, if on). */
  playQueue(ids: readonly string[], start = 0): void {
    if (!this.ready()) return;
    // The entry chosen keeps its place through the filtering: a song listed twice starts at the
    // occurrence chosen, and a song that cannot be found starts the next one that can.
    const found: string[] = [];
    let chosen = -1;
    ids.forEach((id, i) => {
      if (!this.lookup(id)) return;
      if (chosen < 0 && i >= start) chosen = found.length;
      found.push(id);
    });
    if (found.length === 0) return;
    const from = Math.max(0, chosen) < MUSIC_LIMITS.queue ? 0 : Math.max(0, chosen);
    const list = found.slice(from, from + MUSIC_LIMITS.queue);
    const at = Math.max(0, chosen) - from;
    if (this.state.shuffle) {
      this.order = this.shuffledOrder(list, at);
      this.set({
        unshuffled: list,
        queue: this.order.map((i) => list[i] as string),
        index: 0,
      });
    } else {
      this.order = [];
      this.set({ queue: list, unshuffled: [], index: at });
    }
    void this.start(0);
  }

  /** Play, or pause, the song loaded; with nothing loaded, nothing happens. */
  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  play(): void {
    if (!this.ready() || !this.current()) return;
    if (this.loadedId !== this.current()?.id) {
      void this.start(this.state.position, this.resumeAt !== null);
      return;
    }
    this.set({ playing: true, error: null });
    this.playAudio();
    this.save();
  }

  pause(): void {
    this.endCrossfade();
    this.keepPlace();
    this.audio?.pause();
    // Paused while the sound was fetched or buffered: nothing is shown loading any more.
    this.set({ playing: false, loading: false });
    this.mediaState();
    this.save();
  }

  /** The next song of the queue; after the last, the first again under Repeat All. */
  next(): void {
    if (!this.ready()) return;
    this.advance(false);
  }

  /** The start of the song, or the song before when it has just begun. */
  previous(): void {
    if (!this.ready()) return;
    const { index, position, queue, repeat } = this.state;
    if (position > PREVIOUS_RESTARTS_AFTER || queue.length === 0) {
      this.seek(0);
      return;
    }
    if (index > 0 || repeat === "all") {
      // The song before that can still be found, wrapping round only under Repeat All.
      const before = this.findPlayable(index - 1, -1, repeat === "all");
      if (before !== null && before !== index) {
        this.jump(before, this.state.playing);
        return;
      }
    }
    this.seek(0);
  }

  seek(seconds: number): void {
    if (!this.ready()) return;
    const duration = this.state.duration || this.current()?.duration || 0;
    const position = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
    // A place chosen replaces the one saved, wherever it is.
    this.resumeAt = null;
    this.resumingSeek = false;
    if (this.audio && this.loadedId === this.current()?.id && this.pendingSeek === null) {
      this.audio.currentTime = position;
    } else {
      this.pendingSeek = position;
    }
    this.set({ position });
    this.mediaPosition();
    this.save();
  }

  setVolume(volume: number): void {
    if (!this.ready()) return;
    this.set({ volume: Math.round(Math.min(100, Math.max(0, volume))) });
    this.audioVolume();
    this.save();
  }

  setShuffle(shuffle: boolean): void {
    if (!this.ready() || shuffle === this.state.shuffle) return;
    const { queue, index } = this.state;
    // Past the end of the queue nothing is loaded, shuffled or not.
    const ended = index >= queue.length;
    if (shuffle) {
      this.order = this.shuffledOrder(queue, index);
      this.set({
        shuffle,
        unshuffled: queue,
        queue: this.order.map((i) => queue[i] as string),
        index: ended ? queue.length : 0,
      });
    } else {
      const order = this.state.unshuffled.length > 0 ? this.state.unshuffled : queue;
      // The entry playing goes back to its own place, even when its song is queued twice.
      const place = this.order.length === queue.length ? this.order[index] : undefined;
      this.order = [];
      this.set({
        shuffle,
        unshuffled: [],
        queue: order,
        index: ended ? order.length : (place ?? Math.min(index, Math.max(0, order.length - 1))),
      });
    }
    this.save();
  }

  /** What a shuffled queue keeps together; a queue shuffled now is shuffled again by it. */
  setShuffleBy(by: ShuffleBy): void {
    if (!this.ready() || by === (this.state.shuffleBy ?? "songs")) return;
    const shuffled = this.state.shuffle;
    if (shuffled) this.setShuffle(false);
    this.set({ shuffleBy: by });
    if (shuffled) this.setShuffle(true);
    this.save();
  }

  /** Off, all, one, off: the order the Repeat button steps through. */
  cycleRepeat(): void {
    const next: Record<RepeatMode, RepeatMode> = { off: "all", all: "one", one: "off" };
    this.setRepeat(next[this.state.repeat]);
  }

  setRepeat(repeat: RepeatMode): void {
    if (!this.ready()) return;
    this.set({ repeat });
    this.save();
  }

  /** Play the song at `index` of the queue. */
  jump(index: number, autoplay = true): void {
    if (!this.ready() || index < 0 || index >= this.state.queue.length) return;
    // A song that can no longer be found is passed over for the next one that can.
    const target = this.findPlayable(index, 1, false) ?? index;
    this.resumeAt = null;
    this.set({ index: target, position: 0 });
    if (autoplay) void this.start(0);
    else {
      this.audio?.pause();
      this.unload();
      const id = this.state.queue[target];
      const song = id === undefined ? undefined : this.lookup(id);
      this.set({ playing: false, loading: false, error: null, duration: song?.duration ?? 0 });
      // The system's controls name the song that Play now starts.
      if (song) this.mediaMetadata(song);
      this.mediaState();
      this.save();
    }
  }

  /** Put a song right after the one loaded (Play Next). */
  playNext(id: string): void {
    this.insert(id, this.state.index + 1);
  }

  /** Put a song at the end of Up Next (Play Later). */
  playLater(id: string): void {
    this.insert(id, this.state.queue.length);
  }

  /** Remove the song at `index` of the queue (not the one loaded). */
  removeFromQueue(index: number): void {
    if (!this.ready() || index <= this.state.index || index >= this.state.queue.length) return;
    // That entry goes, by its place: the same song may be in the queue more than once.
    if (this.state.shuffle && this.order.length === this.state.queue.length) {
      const place = this.order[index] as number;
      this.order = this.order.filter((_, i) => i !== index).map((at) => (at > place ? at - 1 : at));
      this.set({
        queue: this.state.queue.filter((_, i) => i !== index),
        unshuffled: this.state.unshuffled.filter((_, i) => i !== place),
      });
    } else {
      this.set({ queue: this.state.queue.filter((_, i) => i !== index) });
    }
    this.save();
  }

  /**
   * Move the entry at place `from` of Up Next to before place `to` (`to` may be the queue's length).
   * The song loaded and those played before it stay. Shuffle's order goes with the entry, so turning
   * Shuffle off gives back the order it was turned on from.
   */
  moveInQueue(from: number, to: number): void {
    const { queue, index } = this.state;
    if (!this.ready() || from <= index || from >= queue.length) return;
    if (to <= index || to > queue.length || to === from || to === from + 1) return;
    const moved = <T>(list: readonly T[]) => {
      const rest = list.filter((_, at) => at !== from);
      rest.splice(to > from ? to - 1 : to, 0, list[from] as T);
      return rest;
    };
    if (this.state.shuffle && this.order.length === queue.length) this.order = moved(this.order);
    this.set({ queue: moved(queue) });
    this.save();
  }

  /** Up Next emptied: only the song loaded stays. */
  clearUpNext(): void {
    if (!this.ready()) return;
    const current = this.state.queue[this.state.index];
    const only = current === undefined ? [] : [current];
    this.order = this.state.shuffle ? only.map(() => 0) : [];
    this.set({ queue: only, unshuffled: this.state.shuffle ? only : [], index: 0 });
    this.save();
  }

  /** Forget Recently Played and the play counts. */
  clearHistory(): void {
    if (!this.ready()) return;
    this.set({ recent: [], plays: {} });
    this.save();
  }

  /** Save now what is waiting to be saved. */
  flush(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.canSave) this.store?.save(this.playback());
  }

  // ---- Inside --------------------------------------------------------------------------

  private insert(id: string, at: number): void {
    if (!this.ready() || !this.lookup(id)) return;
    const queue = [...this.state.queue];
    const place = Math.min(at, queue.length);
    queue.splice(place, 0, id);
    if (queue.length > MUSIC_LIMITS.queue) return;
    if (this.state.shuffle) {
      // Added at the end of the order chosen, in its place in the order played.
      const unshuffled = [...this.state.unshuffled, id];
      this.order.splice(place, 0, unshuffled.length - 1);
      this.set({ queue, unshuffled });
    } else {
      this.set({ queue, unshuffled: [] });
    }
    this.save();
  }

  /** Whether playing on passes the song by: its checkbox is cleared, or it is skipped when shuffling. */
  private passedBy(song: LibrarySong): boolean {
    return song.unchecked === true || (this.state.shuffle && song.skipShuffle === true);
  }

  /** The first entry of the queue from `from`, stepping by `step`, whose song can still be
   * found; wrapping round past either end when `wrap`. With `onward`, one that playing on passes
   * by does not count. `null` when there is none. */
  private findPlayable(from: number, step: 1 | -1, wrap: boolean, onward = false): number | null {
    const { queue } = this.state;
    const count = queue.length;
    for (let n = 0; n < count; n += 1) {
      let at = from + step * n;
      if (wrap) at = ((at % count) + count) % count;
      else if (at < 0 || at >= count) return null;
      const id = queue[at];
      const song = id === undefined ? undefined : this.lookup(id);
      if (song && !(onward && this.passedBy(song))) return at;
    }
    return null;
  }

  /** The place in the queue playing on goes to: songs deleted meanwhile are passed over. */
  private onward(): number | null {
    const after = this.findPlayable(this.state.index + 1, 1, false, true);
    return after === null && this.state.repeat === "all"
      ? this.findPlayable(0, 1, false, true)
      : after;
  }

  private advance(ended: boolean): void {
    const { queue, repeat } = this.state;
    if (ended && repeat === "one") {
      void this.start(0);
      return;
    }
    const next = this.onward();
    if (next !== null && queue.length > 0) {
      this.jump(next, ended || this.state.playing);
    } else {
      // The end of the queue: stopped at the start of its last song.
      this.stop();
      this.save();
    }
  }

  /** Stop: no sound, nothing loading, at 0:00. A read still under way is let go, so neither its
   * sound nor a seek waiting for it applies; Play loads the song again. */
  private stop(): void {
    this.resumeAt = null;
    this.endCrossfade();
    this.audio?.pause();
    this.unload();
    this.set({ playing: false, loading: false, position: 0 });
    this.mediaState();
  }

  /**
   * A shuffled order of `list`, by place, with the entry at `at` first when there is one. Shuffling
   * by albums or groupings keeps theirs together and in order, from `at` round to the song before.
   */
  private shuffledOrder(list: readonly string[], at: number): number[] {
    const places = list.map((_, i) => i);
    const first = list[at] === undefined ? [] : [at];
    const by = this.state.shuffleBy ?? "songs";
    if (by === "songs") return [...first, ...this.shuffled(places.filter((i) => i !== at))];
    const keyOf = (place: number) => {
      const song = this.lookup(list[place] as string);
      if (song && by === "albums") return albumKey(song);
      return song?.grouping || `place:${place}`;
    };
    const groups = new Map<string, number[]>();
    for (const place of places) {
      const key = keyOf(place);
      groups.set(key, [...(groups.get(key) ?? []), place]);
    }
    const own = first.length > 0 ? keyOf(at) : null;
    const held = own === null ? [] : (groups.get(own) ?? []);
    const from = held.indexOf(at);
    const others = [...groups.entries()].filter(([key]) => key !== own).map(([, each]) => each);
    return [...held.slice(from), ...held.slice(0, from), ...this.shuffled(others).flat()];
  }

  private shuffled<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.options.random() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Both media elements, made now if nothing has played yet, for Web Audio. */
  mediaElements(): HTMLMediaElement[] {
    const audio = this.element();
    this.spare ??= this.makeElement();
    return [audio, this.spare] as unknown as HTMLMediaElement[];
  }

  /** The sound loaded now, for Sound Check turned on while it plays. */
  loadedSound(): LoadedSound | null {
    const song = this.current();
    if (!this.audio || !song || this.loadedId !== song.id) return null;
    return { media: this.audio as unknown as HTMLMediaElement, song, url: this.audio.src };
  }

  /** Sets what each song's sound waits for before it starts; `null` for nothing. */
  setBeforeSound(gate: ((sound: LoadedSound) => Promise<void>) | null): void {
    this.beforeSound = gate;
  }

  /** Songs run into each other over `seconds`, as the Playback pane says; 0 for not at all. */
  setCrossfade(seconds: number): void {
    this.crossfadeSeconds = seconds;
    if (seconds === 0) this.endCrossfade();
  }

  private element(): AudioLike {
    if (this.audio) return this.audio;
    this.audio = this.makeElement();
    this.audioVolume();
    return this.audio;
  }

  private makeElement(): AudioLike {
    const audio = this.options.createAudio();
    /** The element holds the song a crossfade is leaving, or nothing: its events say nothing. */
    const shown = () => this.audio === audio;
    audio.addEventListener("timeupdate", () => {
      if (!shown() || this.loadedId === null || this.pendingSeek !== null) return;
      this.set({ position: audio.currentTime });
      const stopAt = this.lookup(this.loadedId)?.stop;
      if (stopAt && audio.currentTime >= stopAt) {
        this.ended();
        return;
      }
      if (this.crossfadeInto(audio, stopAt)) return;
      // Listening is kept every few seconds, so a reload or a crash loses little of it.
      if (!(Math.abs(audio.currentTime - this.savedPosition) < POSITION_SAVE_STEP)) {
        this.savedPosition = audio.currentTime;
        this.save();
      }
    });
    audio.addEventListener("durationchange", () => {
      if (shown() && Number.isFinite(audio.duration) && audio.duration > 0) {
        this.set({ duration: audio.duration });
        this.mediaPosition();
      }
    });
    audio.addEventListener("loadedmetadata", () => {
      if (!shown() || this.pendingSeek === null) return;
      // The media's own length is now known: a place past it is its end, and a saved place at
      // its end is a song that had finished, which starts again.
      const length = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      let at = length > 0 ? Math.min(this.pendingSeek, length) : this.pendingSeek;
      if (this.resumingSeek && length > 0 && finished(at, length)) at = 0;
      this.pendingSeek = null;
      this.resumingSeek = false;
      audio.currentTime = at;
      this.set({ position: at });
      this.mediaPosition();
    });
    audio.addEventListener("playing", () => {
      if (!shown()) return;
      this.clearStall();
      this.comingHeard();
      this.set({ loading: false });
    });
    audio.addEventListener("waiting", () => {
      if (!shown()) return;
      this.set({ loading: true });
      // Buffering while it plays: an Archive song that stops arriving is not left loading.
      if (this.state.playing) this.watchStall();
    });
    audio.addEventListener("ended", () => {
      if (shown()) this.ended();
    });
    audio.addEventListener("error", () => {
      if (!shown() || this.loadedId === null) return;
      this.failedLoad(audio);
    });
    this.mediaHandlers();
    return audio;
  }

  private audioVolume() {
    if (!this.audio) return;
    const adjust = 1 + (this.current()?.volumeAdjust ?? 0) / 100;
    this.audio.volume =
      Math.min(1, Math.max(0, (this.state.volume / 100) * adjust)) * this.comingLevel;
  }

  /**
   * Called as a song plays on: starts the crossfade into the next song when this one is that close
   * to its end, and says whether it did. Under Repeat One, with nothing to go on to, or for a song
   * not much longer than the crossfade, the song just ends.
   */
  private crossfadeInto(audio: AudioLike, stopAt: number | null | undefined): boolean {
    const seconds = this.crossfadeSeconds;
    const length = stopAt || audio.duration;
    if (seconds === 0 || !this.state.playing || this.state.repeat === "one") return false;
    if (!Number.isFinite(length) || length < seconds + 1) return false;
    const left = length - audio.currentTime;
    if (left > seconds + CROSSFADE_READ_AHEAD || left <= 0) return false;
    const at = this.onward();
    const nextId = at === null ? undefined : this.state.queue[at];
    const next = nextId === undefined ? undefined : this.lookup(nextId);
    if (!next || next.id === this.loadedId) return false;
    if (left > seconds) {
      if (this.readAhead !== next.id) {
        this.readAhead = next.id;
        void this.sourceOf(next, audio, this.loadToken).catch(() => undefined);
      }
      return false;
    }
    const level = audio.volume;
    this.endCrossfade();
    const coming = this.spare ?? this.makeElement();
    this.spare = audio;
    this.audio = coming;
    this.comingLevel = 0;
    this.comingFrom = null;
    this.ended();
    this.leaving = { audio, level, from: Date.now(), length: left * 1000 };
    this.fadeTimer = setInterval(() => this.crossfadeTick(), CROSSFADE_TICK_MS);
    return true;
  }

  /** The song a crossfade brings in has begun to sound. */
  private comingHeard() {
    if (this.comingLevel < 1) this.comingFrom ??= Date.now();
  }

  private crossfadeTick() {
    const now = Date.now();
    const leaving = this.leaving;
    if (leaving) {
      const done = (now - leaving.from) / leaving.length;
      if (done >= 1) {
        this.letGoOf(leaving.audio);
        this.leaving = null;
      } else {
        leaving.audio.volume = leaving.level * crossfadeLevels(done).leaving;
      }
    }
    if (this.comingFrom !== null) {
      const done = (now - this.comingFrom) / (this.crossfadeSeconds * 1000);
      this.comingLevel = done >= 1 ? 1 : crossfadeLevels(done).coming;
      this.audioVolume();
    }
    if (!this.leaving && this.comingLevel >= 1) this.stopFadeTimer();
  }

  private letGoOf(audio: AudioLike) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  private stopFadeTimer() {
    if (this.fadeTimer !== null) clearInterval(this.fadeTimer);
    this.fadeTimer = null;
  }

  /** Ends a crossfade at once, as a command does: the song leaving stops, and the other is whole. */
  private endCrossfade() {
    this.stopFadeTimer();
    if (this.leaving) this.letGoOf(this.leaving.audio);
    this.leaving = null;
    this.comingFrom = null;
    if (this.comingLevel !== 1) {
      this.comingLevel = 1;
      this.audioVolume();
    }
  }

  private ended() {
    const id = this.loadedId;
    if (id) {
      // Played to its end: a song that remembers its position starts from its start next time.
      const { [id]: _place, ...places } = this.state.bookmarks ?? {};
      // The song just played moves to the end, so the counts kept when there are too many
      // prefer it among equals.
      const { [id]: count = 0, ...others } = this.state.plays;
      this.set({ plays: { ...others, [id]: count + 1 }, bookmarks: places });
      this.endedSong = true;
    }
    this.advance(true);
  }

  /** Notes where the song loaded is, when it remembers its position. */
  private keepPlace() {
    const song = this.loadedId === null ? undefined : this.lookup(this.loadedId);
    if (!song?.rememberPosition || !this.audio) return;
    const at = this.audio.currentTime;
    if (!(at > 0) || finished(at, this.state.duration || song.duration)) return;
    const { [song.id]: _place, ...places } = this.state.bookmarks ?? {};
    this.set({ bookmarks: { ...places, [song.id]: Math.round(at * 10) / 10 } });
  }

  private unload() {
    this.clearStall();
    this.loadToken += 1;
    this.loadedId = null;
    this.loadingId = null;
    this.pendingSeek = null;
    this.resumingSeek = false;
    if (this.audio) {
      this.audio.removeAttribute("src");
      this.audio.load();
    }
  }

  /** The address the song's sound is played from; `token` is the load it is for, and a load
   * that is no longer current keeps nothing of what it read. */
  private async sourceOf(song: LibrarySong, audio: AudioLike, token: number): Promise<string> {
    const source = song.source;
    if (source.kind === "archive") {
      const file = archiveFile(source, (type) => audio.canPlayType(type));
      if (!file) throw new Error("This browser plays none of this song’s formats.");
      return archiveDownloadUrl(source.item, file);
    }
    if (source.kind === "stream") return source.url;
    const cached = this.files.get(source.file);
    if (cached) {
      // Most recently used last.
      this.files.delete(source.file);
      this.files.set(source.file, cached);
      return cached;
    }
    const blob = await this.options.readFile(source.file);
    // Superseded, or every window closed, while the file was read: nothing is kept of it.
    if (token !== this.loadToken) throw new Error("superseded");
    // Read ahead for a crossfade meanwhile: that read stands.
    const read = this.files.get(source.file);
    if (read) return read;
    const typed = blob.type ? blob : new Blob([blob], { type: source.type });
    const url = this.options.createObjectURL(typed);
    this.files.set(source.file, url);
    while (this.files.size > CACHED_FILES) {
      const [oldest, old] = this.files.entries().next().value as [string, string];
      this.files.delete(oldest);
      this.options.revokeObjectURL(old);
    }
    return url;
  }

  /** Load the song at the queue's index and play it from `at` seconds; `resume` when `at` is
   * the place saved with the restored playback. */
  private async start(asked: number, resume = false): Promise<void> {
    this.resumeAt = null;
    this.resumingSeek = false;
    // Called from within a crossfade's start, the fade has not been set going yet; a command made
    // during one ends it.
    if (this.leaving) this.endCrossfade();
    if (this.loadedId !== null && this.loadedId !== this.current()?.id && !this.endedSong) {
      this.keepPlace();
    }
    this.endedSong = false;
    const song = this.current();
    const place = song?.rememberPosition ? this.state.bookmarks?.[song.id] : undefined;
    const at = asked === 0 && (place || song?.start) ? ((place || song?.start) ?? 0) : asked;
    if (!song) {
      // An id that can no longer be found: the next one plays instead.
      if (this.state.index + 1 < this.state.queue.length) {
        this.set({ index: this.state.index + 1 });
        return this.start(0);
      }
      this.stop();
      this.save();
      return;
    }
    const audio = this.element();
    const isNew = this.loadedId !== song.id;
    // The song before stops at once: nothing of it sounds while this one is fetched, or after
    // it fails.
    if (isNew) {
      audio.pause();
      this.unload();
    }
    const token = ++this.loadToken;
    this.set({
      playing: true,
      // The sound already loaded plays on at once; its `waiting` event says when it buffers.
      loading: isNew,
      error: null,
      position: at,
      // The same sound again keeps the length the browser found in it; a new one starts from the
      // library's until the browser knows better.
      duration: isNew ? song.duration : this.state.duration || song.duration,
      recent: isNew
        ? [song.id, ...this.state.recent.filter((id) => id !== song.id)].slice(
            0,
            MUSIC_LIMITS.recent,
          )
        : this.state.recent,
    });
    this.audioVolume();
    this.mediaHandlers();
    this.mediaMetadata(song);
    this.save();
    if (isNew) {
      // A seek made while the sound is fetched replaces this one, and is applied once the
      // browser knows the song's length.
      this.pendingSeek = at > 0 ? at : null;
      this.resumingSeek = resume && at > 0;
      this.loadingId = song.id;
      this.readAhead = null;
      let url: string;
      try {
        url = await this.sourceOf(song, audio, token);
      } catch (error) {
        if (token !== this.loadToken) return;
        this.loadingId = null;
        this.set({
          playing: false,
          loading: false,
          error: this.readFailure(song, error),
        });
        this.mediaState();
        return;
      }
      if (token !== this.loadToken) return;
      this.loadedId = song.id;
      this.loadingId = null;
      audio.src = url;
      // An Internet Archive song that never starts arriving is not left loading.
      this.watchStall();
      if (this.beforeSound) {
        const sound = { media: audio as unknown as HTMLMediaElement, song, url };
        await Promise.race([
          this.beforeSound(sound),
          new Promise((resolve) => setTimeout(resolve, LEVEL_WAIT_MS)),
        ]);
        if (token !== this.loadToken) return;
      }
      // A window's banner that fails must not keep the song from playing.
      for (const listener of this.songStartListeners) {
        try {
          listener(song);
        } catch (error) {
          console.error(error);
        }
      }
    } else if (this.pendingSeek !== null) {
      // Its length is not known yet: the position asked for now replaces the one waiting, and
      // is applied once it is known.
      this.pendingSeek = at;
    } else {
      audio.currentTime = at;
    }
    // Paused (or every window closed) while the sound was fetched: it stays loaded, silent.
    if (!this.state.playing) {
      this.set({ loading: false });
      return;
    }
    this.playAudio();
  }

  private playAudio() {
    const audio = this.audio;
    if (!audio) return;
    const token = this.loadToken;
    audio.play().then(
      () => {
        if (token === this.loadToken) {
          // The play promise settles as the media starts playing (with its `playing` event):
          // nothing is loading, and nothing is stalled.
          this.clearStall();
          this.comingHeard();
          if (this.state.loading) this.set({ loading: false });
        }
        this.mediaState();
      },
      (error: unknown) => {
        if (token !== this.loadToken) return;
        // Cut short by a newer load or pause: no failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          this.set({ playing: false, loading: false, error: PLAYBACK_ERRORS.notAllowed });
          this.mediaState();
          return;
        }
        // The media refused its source: the same failure as its `error` event, told once.
        if (this.loadedId !== null) this.failedLoad(audio);
      },
    );
  }

  /**
   * Stop the song loaded with `message`: nothing sounds or loads any more, the place is kept, and
   * Play loads the song again from there (its sound is let go, so a new load is made).
   */
  private fail(message: string) {
    this.clearStall();
    const audio = this.audio;
    const heard =
      this.loadedId !== null && this.pendingSeek === null && audio !== null
        ? audio.currentTime
        : Number.NaN;
    const at = Number.isFinite(heard) && heard > 0 ? heard : this.state.position;
    audio?.pause();
    this.comingHeard();
    this.unload();
    this.set({ playing: false, loading: false, error: message, position: at });
    this.mediaState();
    this.save();
  }

  /** The song loaded failed in the media element: say why, as far as can be told. */
  private failedLoad(audio: AudioLike) {
    const song = this.current();
    const code = audio.error?.code ?? 0;
    const url = audio.src;
    if (song?.source.kind === "stream") {
      this.fail(PLAYBACK_ERRORS.stream);
      return;
    }
    if (song?.source.kind !== "archive") {
      // An uploaded song plays from memory: a failure is its file's.
      this.fail(code === MEDIA_ERR_NETWORK ? PLAYBACK_ERRORS.unread : PLAYBACK_ERRORS.damaged);
      return;
    }
    if (code === MEDIA_ERR_DECODE) {
      this.fail(PLAYBACK_ERRORS.damaged);
      return;
    }
    // A network failure, or a source the browser refused, which is how some browsers report an
    // address that did not answer: asking the address again tells which it was. An answer that
    // is not playable sound is the Archive's to explain (it may be an error page), not a file
    // this page can call damaged.
    this.fail(PLAYBACK_ERRORS.checking);
    const token = this.loadToken;
    void this.options.reachable(url).then(
      (answered) => {
        if (token !== this.loadToken || this.state.error !== PLAYBACK_ERRORS.checking) return;
        this.set({ error: answered ? PLAYBACK_ERRORS.refused : PLAYBACK_ERRORS.unreachable });
      },
      () => {
        if (token !== this.loadToken || this.state.error !== PLAYBACK_ERRORS.checking) return;
        this.set({ error: PLAYBACK_ERRORS.unreachable });
      },
    );
  }

  /** Why the sound of `song` could not be read, before the media element had it. */
  private readFailure(song: LibrarySong, error: unknown): string {
    if (song.source.kind === "file") {
      const status = (error as { status?: unknown } | null)?.status;
      return status === 404 ? PLAYBACK_ERRORS.missing : PLAYBACK_ERRORS.unread;
    }
    return error instanceof Error ? error.message : String(error);
  }

  /** Give the Internet Archive song loading `stallMs` to start playing, else stop it. */
  private watchStall() {
    this.clearStall();
    const kind = this.current()?.source.kind;
    if (kind !== "archive" && kind !== "stream") return;
    const token = this.loadToken;
    this.stallTimer = setTimeout(() => {
      this.stallTimer = null;
      if (token !== this.loadToken || !this.state.loading || !this.state.playing) return;
      this.fail(PLAYBACK_ERRORS.stalled);
    }, this.options.stallMs);
  }

  private clearStall() {
    if (this.stallTimer === null) return;
    clearTimeout(this.stallTimer);
    this.stallTimer = null;
  }

  private playback(): MusicPlaybackState {
    const {
      queue,
      unshuffled,
      index,
      position,
      shuffle,
      repeat,
      volume,
      recent,
      plays,
      shuffleBy,
      bookmarks,
    } = this.state;
    // Only the songs outside the library that the queue or the history still names.
    const named = new Set([...queue, ...unshuffled, ...recent]);
    const guests = this.state.guests.filter(
      (song) => named.has(song.id) && !this.songs.has(song.id),
    );
    this.savedPosition = position;
    // While shuffled, each entry's own place in the order chosen goes with it.
    const order = shuffle && this.order.length === queue.length ? [...this.order] : [];
    // Another account's songs are heard here and kept nowhere, not even as names in this
    // person's Up Next, history or counts.
    const own = (id: string) => ownerOfBorrowed(id) === null;
    if (![...queue, ...unshuffled, ...recent].every(own)) {
      const playingOwn = own(queue[index] ?? "");
      return {
        queue: queue.filter(own),
        unshuffled: unshuffled.filter(own),
        index: queue.slice(0, index).filter(own).length,
        position: playingOwn ? position : 0,
        shuffle,
        repeat,
        volume,
        recent: recent.filter(own),
        plays: Object.fromEntries(Object.entries(plays).filter(([id]) => own(id))),
        guests,
        order: [],
        ...(this.state.epoch ? { epoch: this.state.epoch } : {}),
        ...(shuffleBy && shuffleBy !== "songs" ? { shuffleBy } : {}),
        ...(bookmarks && Object.keys(bookmarks).length > 0 ? { bookmarks } : {}),
      };
    }
    return {
      queue,
      unshuffled,
      index,
      position,
      shuffle,
      repeat,
      volume,
      recent,
      plays,
      guests,
      order,
      ...(this.state.epoch ? { epoch: this.state.epoch } : {}),
      ...(shuffleBy && shuffleBy !== "songs" ? { shuffleBy } : {}),
      ...(bookmarks && Object.keys(bookmarks).length > 0 ? { bookmarks } : {}),
    };
  }

  private save() {
    if (!this.store || !this.canSave) return;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.store?.save(this.playback());
    }, this.options.saveDelayMs);
  }

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error(error);
      }
    }
  }

  // ---- Media Session: the keyboard's and the system's media keys -------------------------

  private session(): MediaSession | undefined {
    return typeof navigator !== "undefined" && "mediaSession" in navigator
      ? navigator.mediaSession
      : undefined;
  }

  /** Music closed: the system's media controls and keys no longer name or reach it. */
  private clearMediaSession() {
    const session = this.session();
    if (!session) return;
    for (const action of [
      "play",
      "pause",
      "stop",
      "previoustrack",
      "nexttrack",
      "seekbackward",
      "seekforward",
      "seekto",
    ] as MediaSessionAction[]) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // An action this browser does not know.
      }
    }
    session.metadata = null;
    session.playbackState = "none";
  }

  private mediaHandlers() {
    const session = this.session();
    if (!session) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => this.play()],
      ["pause", () => this.pause()],
      ["stop", () => this.pause()],
      ["previoustrack", () => this.previous()],
      ["nexttrack", () => this.next()],
      ["seekbackward", (d) => this.seek(this.state.position - (d.seekOffset ?? MEDIA_KEY_SEEK))],
      ["seekforward", (d) => this.seek(this.state.position + (d.seekOffset ?? MEDIA_KEY_SEEK))],
      ["seekto", (d) => d.seekTime !== undefined && this.seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // An action this browser does not know.
      }
    }
  }

  private mediaMetadata(song: LibrarySong) {
    const session = this.session();
    if (!session || typeof MediaMetadata === "undefined") return;
    const art = artworkUrl(song);
    session.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist || UNKNOWN_ARTIST,
      album: song.album || UNKNOWN_ALBUM,
      artwork: art ? [{ src: new URL(art, location.href).href }] : [],
    });
  }

  private mediaState() {
    const session = this.session();
    if (session) session.playbackState = this.state.playing ? "playing" : "paused";
    this.mediaPosition();
  }

  private mediaPosition() {
    const session = this.session();
    const duration = this.state.duration;
    if (!session?.setPositionState || !(duration > 0)) return;
    try {
      session.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(this.state.position, duration),
      });
    } catch {
      // A position the browser refuses (it is past the end while a song changes).
    }
  }
}

let shared: MusicPlayer | null = null;

/** The page's one player. */
export function musicPlayer(): MusicPlayer {
  shared ??= new MusicPlayer();
  return shared;
}
