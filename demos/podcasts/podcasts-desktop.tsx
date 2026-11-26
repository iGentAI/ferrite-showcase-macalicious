"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MediaAppChromeButton } from "macalicious/media-app-chrome";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import { SidebarBadge } from "macalicious/sidebar-badge";
import { StorePillButton } from "macalicious/store-pill-button";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { WindowBanner, WindowBannerAction } from "macalicious/window-banner";
import {
  type HTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useDesktopDrop } from "../desktop/desktop-drag";
import { readFile } from "../desktop/desktop-files";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import {
  changeDesktopValue,
  readBoolean,
  useDesktopSetting,
  useDesktopValue,
} from "../desktop/desktop-personal";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import { copyText, LinkShareItems } from "../desktop/desktop-share-link";
import { onOpenFileRequest, takeOpenFileRequests } from "../finder/finder-open";
import { Podcasts, type PodcastsProps, UNKNOWN_SHOW } from "./podcasts";
import { AddShowSheet, feedAddress, showIdOfFeed } from "./podcasts-add-show";
import { ShowArtwork } from "./podcasts-artwork";
import {
  type PodcastsColor,
  type PodcastsEpisode,
  type PodcastsSection,
  type PodcastsShow,
  SECTIONS,
  sectionName,
} from "./podcasts-data";
import { droppedFeed, movedInQueue } from "./podcasts-drop";
import { PodcastsFrame } from "./podcasts-frame";
import { feedsOfOpml, opmlOf, saveOpml, showsWith } from "./podcasts-opml";
import {
  type CachedFeed,
  type ChartedShow,
  EMPTY_LIBRARY,
  episodeKey,
  type FeedEpisode,
  type FollowedShow,
  isBlank,
  limitText,
  lookupShows,
  maxAgeOf,
  PODCASTS_LIBRARY_URL,
  PODCASTS_LIMITS,
  type PodcastsLibraryState,
  podcastsLibrary,
  podcastsLibraryFromServer,
  podcastsLibraryToServer,
  type QueuedEpisode,
  REFRESH_SECONDS,
  readFeed,
  type ShowListing,
  SPEEDS,
  searchShows,
  showOfOpenItem,
  topShows,
  UNTITLED_EPISODE,
  UNTITLED_SHOW,
  watchNewEpisodes,
} from "./podcasts-server";
import {
  PODCASTS_STATIONS,
  type PodcastsStation,
  readStations,
  STATION_EPISODES,
  StationSheet,
  savedStation,
} from "./podcasts-stations";
import {
  EpisodeList,
  EpisodePage,
  EpisodeShelf,
  type PodcastsLibrary,
  PodcastsNote,
  PodcastsPage,
  SectionAction,
  ShowChart,
  ShowGrid,
  ShowPage,
  SidePanel,
} from "./podcasts-views";

/** What Preferences and the Downloaded place say about downloads, which are never offered. */
export const DOWNLOADS_NOTE =
  "Episodes are never downloaded on this desktop: each one plays straight from its publisher, and the server keeps no one's audio.";

/**
 * Podcasts on the desktop. Served by the `macalicious-desktop` Ferrite application it is a real
 * podcast player for the person signed in (`ServedPodcasts`); everywhere else it is the demo,
 * with its invented shows and simulated transport.
 */
export function DesktopPodcasts(props: PodcastsProps) {
  return servedByDesktopApp() ? <ServedPodcasts {...props} /> : <Podcasts {...props} />;
}

/** An episode the window can play: one of a feed's, or one kept in Up Next or the player. */
export interface PodcastsServedEpisode extends PodcastsEpisode {
  audio: string;
  kind: string | null;
  feed: string | null;
  showTitle: string;
  artwork: string | null;
}

const isPlayable = (episode: PodcastsEpisode): episode is PodcastsServedEpisode =>
  typeof (episode as PodcastsServedEpisode).audio === "string" &&
  typeof (episode as PodcastsServedEpisode).showTitle === "string";

const PALETTE: readonly (readonly [PodcastsColor, PodcastsColor])[] = [
  ["indigo", "purple"],
  ["green", "teal"],
  ["pink", "orange"],
  ["orange", "yellow"],
  ["teal", "blue"],
  ["red", "pink"],
  ["purple", "pink"],
  ["blue", "indigo"],
];

/** The two colours behind a real show's cover while it loads, the same for every reading. */
function colorsOf(id: string): readonly [PodcastsColor, PodcastsColor] {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length] as readonly [PodcastsColor, PodcastsColor];
}

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const SHORT_DATE_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const DAY_MS = 86_400_000;

/** A publication time as the display's second line gives it: `September 29, 2019`. */
export function longDate(ms: number): string {
  return ms > 0 ? LONG_DATE.format(ms) : "";
}

/** A publication time as a card's caption gives it: a weekday this week, else a short date. */
export function shortDay(ms: number, now: number): string {
  if (!(ms > 0)) return "";
  const age = now - ms;
  if (age >= 0 && age < 6 * DAY_MS) return WEEKDAY.format(ms);
  return new Date(ms).getFullYear() === new Date(now).getFullYear()
    ? SHORT_DATE.format(ms)
    : SHORT_DATE_YEAR.format(ms);
}

/** A show's page in Apple's directory, which is where its id comes from. */
export const showLink = (id: string) => `https://podcasts.apple.com/podcast/id${id}`;

/** A show's link to share: Apple's page, or its feed for a show added by address, which has none. */
const shareableLink = (id: string, feed: string | null | undefined) =>
  id.startsWith("feed-") && feed ? feed : showLink(id);

/** Why a show has no settings of its own. */
const NO_SHOW_SETTINGS = "Preferences applies to every show here: no show has settings of its own.";

/** A speed as the bar's button shows it: `1×`, `1.25×`. */
export const speedLabel = (speed: number) => `${speed}\u00d7`;

/** What the window knows of a show: from the library, a search, the chart or its feed. */
interface ShowRef {
  id: string;
  title: string;
  author: string;
  artwork?: string | null;
  genre?: string | null;
  feed?: string | null;
}

function showOfRef(ref: ShowRef, subscribed: boolean, feed?: CachedFeed): PodcastsShow {
  return {
    id: ref.id,
    title: ref.title || feed?.title || UNTITLED_SHOW,
    author: ref.author || feed?.author || "",
    category: ref.genre ?? "",
    description: feed?.description ?? "",
    colors: colorsOf(ref.id),
    subscribed,
    artwork: ref.artwork ?? feed?.image ?? undefined,
  };
}

/** The episodes of a feed with audio, as the window lists them. */
export function episodesOfFeed(
  show: ShowRef,
  feed: CachedFeed,
  played: ReadonlySet<string>,
  seen: number | null,
  now: number,
): PodcastsServedEpisode[] {
  return feed.episodes.flatMap((item: FeedEpisode) => {
    if (!item.audio) return [];
    const id = episodeKey(show.id, item.id);
    const published = item.published ?? 0;
    const isPlayed = played.has(id);
    return [
      {
        id,
        show: show.id,
        // A feed may give an episode audio and no title; the library keeps none without one.
        title: isBlank(item.title) ? UNTITLED_EPISODE : item.title,
        description: item.summary ?? "",
        date: longDate(published),
        day: shortDay(published, now),
        published,
        duration: item.duration ?? 0,
        isNew: seen !== null && published > seen && !isPlayed,
        unplayed: !isPlayed,
        audio: item.audio.url,
        kind: item.audio.kind || null,
        feed: feed.url,
        showTitle: show.title || feed.title,
        artwork: show.artwork ?? feed.image ?? null,
      },
    ];
  });
}

/** The record Up Next and the player keep of an episode, its text within the module's limits. */
export function queuedOf(episode: PodcastsServedEpisode): QueuedEpisode {
  return {
    id: episode.id,
    show: episode.show,
    title: limitText(episode.title),
    showTitle: limitText(episode.showTitle),
    artwork: episode.artwork,
    audio: episode.audio,
    kind: episode.kind,
    duration: Math.min(PODCASTS_LIMITS.position, Math.max(0, Math.round(episode.duration))),
    published: Math.max(0, Math.round(episode.published)),
    feed: episode.feed,
  };
}

function fromQueued(item: QueuedEpisode, description: string, now: number): PodcastsServedEpisode {
  return {
    id: item.id,
    show: item.show,
    title: item.title,
    description,
    date: longDate(item.published),
    day: shortDay(item.published, now),
    published: item.published,
    duration: item.duration,
    unplayed: true,
    audio: item.audio,
    kind: item.kind,
    feed: item.feed,
    showTitle: item.showTitle,
    artwork: item.artwork,
  };
}

const newestOf = (feed: CachedFeed | undefined): number | null => {
  const times = (feed?.episodes ?? []).map((item) => item.published ?? 0).filter((t) => t > 0);
  return times.length ? Math.max(...times) : null;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Play `audio` at `speed` once it has loaded an episode. WebKit's media backend drops a seek made
 * as an episode loads when the rate is not 1 beforehand, so an episode loads at 1 and takes the
 * person's speed with its metadata.
 */
function applySpeed(audio: HTMLAudioElement, speed: number) {
  if (audio.readyState === 0) return;
  audio.defaultPlaybackRate = speed;
  audio.playbackRate = speed;
}

function withPosition(
  library: PodcastsLibraryState,
  id: string,
  seconds: number,
): PodcastsLibraryState {
  if (library.positions[id] === seconds) return library;
  return { ...library, positions: { ...library.positions, [id]: Math.max(0, seconds) } };
}

interface FeedState {
  status: "loading" | "refreshing" | "ready" | "failed";
  feed?: CachedFeed;
  error?: string | null;
}

interface ChartState {
  status: "idle" | "loading" | "ready" | "failed";
  shows: readonly ChartedShow[];
  /** The chart's shows looked up, with their feeds, by id. */
  listings: Readonly<Record<string, ShowListing>>;
  error?: string;
  lookedUp: boolean;
}

interface SearchState {
  term: string;
  status: "idle" | "loading" | "ready" | "failed";
  results: readonly ShowListing[];
  error?: string;
}

/** A show whose page is open, with what the place it was opened from knew of it. */
interface OpenedShow {
  id: string;
  listing?: ShowListing;
}

/** What a contextual menu's Copy Link and Share act on. */
const linkRows = (url: string, title: string, what: string, copy: (url: string) => void) => (
  <>
    <MenuItem onClick={() => copy(url)}>Copy Link</MenuItem>
    <Submenu>
      <SubmenuTrigger>{`Share ${what}`}</SubmenuTrigger>
      <SubmenuPopup>
        <LinkShareItems plain url={url} title={title} from="podcasts" />
      </SubmenuPopup>
    </Submenu>
  </>
);

/** How the Episodes list runs. */
type EpisodeOrder = "newest" | "oldest";
/** The person's last place and order, in the desktop's settings. */
const PODCASTS_VIEW = "podcasts.view";
/** Whether the sidebar is shown, in the desktop's settings. */
const PODCASTS_SIDEBAR = "podcasts.sidebarShown";
/** What the window takes from Finder: a subscription list. */
const isOpml = (name: string) => /\.(opml|xml)$/i.test(name);

/** What takes the space bar for itself while it has the keyboard. */
const SPACE_KEEPERS =
  "input, textarea, select, button, a[href], [contenteditable], [role='button'], [role='slider'], [role='menu'], [role='menuitem'], [role='option'], [role='checkbox'], [role='combobox'], [role='dialog'], [role='tab']";
const NO_STATIONS: readonly PodcastsStation[] = [];
/** Why Sync subscriptions is not a choice here. */
export const SYNC_NOTE =
  "Your shows are kept on this desktop's server, so every browser signed in to your account has them.";
const NO_SHOWS_FOR_STATION = "Subscribe to a show first: a station plays the shows you follow.";
/** What the window says of a drop it cannot use. */
const DROP_REFUSED = "Podcasts takes the address of a show's feed, or an OPML file.";
interface PodcastsKept {
  section?: PodcastsSection;
  episodes?: EpisodeOrder;
}
const NO_VIEW: PodcastsKept = {};

/** A kept view, with whatever of it reads. */
export function readPodcastsView(stored: unknown): PodcastsKept | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { section, episodes } = stored as Record<string, unknown>;
  return {
    section: SECTIONS.some((group) => group.items.some((item) => item.id === section))
      ? (section as PodcastsSection)
      : undefined,
    episodes: episodes === "newest" || episodes === "oldest" ? episodes : undefined,
  };
}

/** How long an episode that reported an error while playing has to show its time moving on. */
export const ERROR_GRACE_MS = 2_000;

/** What Increase and Decrease Volume move the volume by, on its scale of 0 to 100. */
const VOLUME_STEP = 10;

const NOTHING_LOADED = "No episode is loaded.";

/** While an episode plays, its place is kept each time it has moved this many seconds. */
export const POSITION_STEP = 10;

/** How many feeds are asked for at once. */
const FEEDS_AT_ONCE = 4;
/** How long typing must pause before a search is sent, in ms. */
const SEARCH_PAUSE_MS = 350;
/** The most episodes the Episodes place lists. */
const MAX_LISTED = 200;

/**
 * The Ferrite desktop's Podcasts, for the person signed in: shows found with Apple's directory
 * and followed when their feed is on a host the server can reach, their episodes read from the
 * feeds, played by the browser straight from the publisher, with the position saved every ten
 * seconds of listening and at every pause and skip. Up Next, the episode loaded, the speed, the
 * settings and the newest episode looked at of each show are kept with the library. Feeds are
 * refreshed when the window opens and at the Refresh interval while it stays open; episodes
 * published since the person last looked are marked, counted in the sidebar and announced.
 */
function ServedPodcasts({
  shows: _shows,
  episodes: _episodes,
  defaultEpisode: _defaultEpisode,
  defaultSettings: _defaultSettings,
  defaultSection = "listen-now",
  onSectionChange,
  defaultVolume = 100,
  material = "translucent",
  defaultPreferencesOpen = false,
  onKeyDown,
  ref,
  ...props
}: PodcastsProps) {
  const keptView = useDesktopValue(PODCASTS_VIEW, readPodcastsView, NO_VIEW);
  const [sidebarShown, setSidebarShown] = useDesktopSetting(PODCASTS_SIDEBAR, readBoolean, true);
  // What this window has chosen; until then, what the person last chose.
  const [ownSection, setSection] = useState<PodcastsSection | null>(null);
  const section = ownSection ?? keptView.section ?? defaultSection;
  const episodeOrder = keptView.episodes ?? "newest";
  // Counts the times a place is chosen in the sidebar, the one shown included.
  const [chosen, setChosen] = useState(0);
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<OpenedShow | null>(null);
  const [openedEpisode, setOpenedEpisode] = useState<PodcastsServedEpisode | null>(null);
  const [volume, setVolume] = useState(defaultVolume);
  const [panel, setPanel] = useState<"notes" | "queue" | null>(null);
  const [library, setLibrary] = useState<PodcastsLibraryState>(EMPTY_LIBRARY);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<Readonly<Record<string, FeedState>>>({});
  const [chart, setChart] = useState<ChartState>({
    status: "idle",
    shows: [],
    listings: {},
    lookedUp: false,
  });
  const [search, setSearch] = useState<SearchState>({ term: "", status: "idle", results: [] });
  const [today] = useState(() => Date.now());
  // The place heard in the episode loaded, to the second, for the display. The library's place
  // (`positions`), which is saved, moves every `POSITION_STEP` seconds and at every pause and skip.
  const [heard, setHeard] = useState<{ id: string; seconds: number } | null>(null);
  // The window's frame, for the desktop's menu bar: Controls acts on the window last used.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [addingShow, setAddingShow] = useState(false);
  const [stations, setStations] = useDesktopSetting(PODCASTS_STATIONS, readStations, NO_STATIONS);
  const [stationShown, setStationShown] = useState<string | null>(null);
  const [stationSheet, setStationSheet] = useState<{ editing?: PodcastsStation } | null>(null);
  const opmlPicker = useRef<HTMLInputElement>(null);
  const importingOpml = useRef(false);
  const [importing, setImporting] = useState(false);
  const frameRef = useCallback(
    (element: HTMLDivElement | null) => {
      setFrame(element);
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // The episode whose audio the element holds, the place to put it at once it has a length,
  // and the last whole second recorded of it.
  const loadedId = useRef<string | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const lastWhole = useRef(-1);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    const audio = audioRef.current;
    return () => {
      live.current = false;
      // A closed window plays nothing: an element taken out of the page can play on unseen.
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, []);
  // The newest state, for handlers that run outside rendering.
  const latest = useRef({ library, volume, feeds });
  latest.current = { library, volume, feeds };

  // The person's library on the server. Until the first load settles the window is inert, so
  // no change is made that the load would replace. The place in each started episode is kept with
  // it; a load, or another window's change, keeps this window's own place in the episode it has
  // loaded, which is the newer one.
  const keptKey = JSON.stringify(podcastsLibrary(library));
  const kept = useMemo(() => JSON.parse(keptKey) as PodcastsLibraryState, [keptKey]);
  const loading = useServerState({
    url: PODCASTS_LIBRARY_URL,
    enabled: true,
    value: kept,
    onLoad: (stored) => {
      const read = podcastsLibraryFromServer(stored);
      if (!read) {
        setNotice(
          "Your podcast library on the server could not be read, so nothing you change here is saved.",
        );
        return false;
      }
      // The library as read, or as another window changed it, with this window's place in the
      // episode it holds. An episode loaded elsewhere replaces this window's (the effect below
      // loads it); the same episode plays on undisturbed.
      setLibrary((now) => {
        const held = loadedId.current;
        const own = held === null ? undefined : now.positions[held];
        return held === null || own === undefined
          ? read
          : { ...read, positions: { ...read.positions, [held]: own } };
      });
    },
    toBody: podcastsLibraryToServer,
  });

  // ---- Feeds -------------------------------------------------------------------------------

  const feedQueue = useRef<{ url: string; maxAge: number }[]>([]);
  const feedsActive = useRef(0);
  const feedsAsked = useRef(new Set<string>());
  const pumpFeeds = () => {
    while (feedsActive.current < FEEDS_AT_ONCE) {
      const job = feedQueue.current.shift();
      if (!job) return;
      feedsActive.current += 1;
      const { url } = job;
      setFeeds((all) => ({
        ...all,
        [url]: { ...all[url], status: all[url]?.feed ? "refreshing" : "loading" },
      }));
      readFeed(url, job.maxAge)
        .then(
          (reply) => {
            if (!live.current) return;
            setFeeds((all) => ({
              ...all,
              [url]: { status: "ready", feed: reply.feed, error: reply.error },
            }));
          },
          (error: unknown) => {
            if (!live.current) return;
            setFeeds((all) => ({
              ...all,
              [url]: {
                status: all[url]?.feed ? "ready" : "failed",
                feed: all[url]?.feed,
                error: messageOf(error),
              },
            }));
          },
        )
        .finally(() => {
          feedsActive.current -= 1;
          feedsAsked.current.delete(url);
          pumpFeeds();
        });
    }
  };
  /** Ask the server for a feed, read again when its copy is older than `maxAge` seconds. */
  const requestFeed = (url: string, maxAge: number) => {
    if (feedsAsked.current.has(url)) return;
    feedsAsked.current.add(url);
    feedQueue.current.push({ url, maxAge });
    pumpFeeds();
  };
  const refreshAll = (maxAge: number) => {
    for (const show of latest.current.library.shows) requestFeed(show.feed, maxAge);
  };

  // ---- The player --------------------------------------------------------------------------

  const startPlayback = (audio: HTMLAudioElement) => {
    setNotice(null);
    const started = audio.play() as Promise<void> | undefined;
    started?.catch?.((error: unknown) => {
      if (!live.current) return;
      // A new episode replaced this one before it started.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPlaying(false);
      setNotice(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "The browser did not let the episode start by itself. Press Play to hear it."
          : `The episode could not be played: ${messageOf(error)}`,
      );
    });
  };

  /** Put `episode` in the audio element (at its kept place), and start it when `play`. */
  const loadInto = (episode: QueuedEpisode, play: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (loadedId.current !== episode.id) {
      // The episode playing stops first, so its place is noted (onPause).
      if (!audio.paused) audio.pause();
      const { library: now, volume: level } = latest.current;
      loadedId.current = episode.id;
      lastWhole.current = -1;
      const at = now.positions[episode.id] ?? 0;
      pendingSeek.current = at > 0 ? at : null;
      setHeard({ id: episode.id, seconds: at });
      setDuration(episode.duration);
      // The person's speed is applied once the episode has loaded (applySpeed).
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      audio.src = episode.audio;
      audio.volume = level / 100;
    }
    if (play) startPlayback(audio);
  };

  const unload = () => {
    const audio = audioRef.current;
    loadedId.current = null;
    pendingSeek.current = null;
    setDuration(0);
    setPlaying(false);
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  };

  /** Load `episode` and start it: it leaves Up Next and is no longer played. */
  const playEpisode = (episode: QueuedEpisode) => {
    setLibrary((now) => ({
      ...now,
      current: episode,
      queue: now.queue.filter((item) => item.id !== episode.id),
      played: now.played.filter((id) => id !== episode.id),
      positions: { ...now.positions, [episode.id]: now.positions[episode.id] ?? 0 },
    }));
    loadInto(episode, true);
  };

  const toggle = () => {
    const audio = audioRef.current;
    const { current, queue } = latest.current.library;
    if (current && audio) {
      if (loadedId.current !== current.id) loadInto(current, false);
      if (audio.paused) startPlayback(audio);
      else audio.pause();
      return;
    }
    const next = queue[0];
    if (next) playEpisode(next);
  };

  /** Move the loaded episode to `seconds`. */
  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    const id = loadedId.current;
    if (!audio || !id) return;
    // The episode's end: the longer of the element's length and the feed's (WebKit reports a
    // redirected episode's length provisionally, 0 and then as much as it has fetched).
    const own = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const given = latest.current.library.current?.duration ?? 0;
    const end = Math.max(own, given) > 0 ? Math.max(own, given) : Infinity;
    const target = Math.max(0, Math.min(end, seconds));
    // WebKit first reports a redirected episode's length as 0, and a seek then leaves the element
    // stuck at the start for good: until it has a length the place waits (`placeKept`).
    if (audio.duration > 0 && pendingSeek.current === null) audio.currentTime = target;
    else pendingSeek.current = target;
    lastWhole.current = Math.floor(target);
    setHeard({ id, seconds: Math.floor(target) });
    setLibrary((now) => (now.current?.id === id ? withPosition(now, id, Math.floor(target)) : now));
  };
  const skip = (by: number) => {
    const audio = audioRef.current;
    const id = loadedId.current;
    if (!audio || !id) return;
    const from =
      pendingSeek.current ??
      (audio.readyState === 0 ? (library.positions[id] ?? 0) : audio.currentTime);
    seekTo(from + by);
  };

  const setSpeed = (speed: number) => {
    const audio = audioRef.current;
    if (audio) applySpeed(audio, speed);
    setLibrary((now) => ({ ...now, speed }));
  };
  const cycleSpeed = () => {
    const at = SPEEDS.indexOf(library.speed as (typeof SPEEDS)[number]);
    setSpeed(SPEEDS[(at + 1) % SPEEDS.length] ?? 1);
  };
  const stop = () => {
    audioRef.current?.pause();
    seekTo(0);
  };

  const onEnded = () => {
    const id = loadedId.current;
    setPlaying(false);
    const { current, queue, settings } = latest.current.library;
    if (!current || current.id !== id) return;
    const next = settings.continuous ? queue[0] : undefined;
    setLibrary((now) => {
      const { [current.id]: _heard, ...positions } = now.positions;
      return {
        ...now,
        positions,
        played: [
          ...now.played.filter((each) => each !== current.id && each !== next?.id),
          current.id,
        ],
        current: next ?? null,
        queue: next ? now.queue.filter((item) => item.id !== next.id) : now.queue,
      };
    });
    loadedId.current = null;
    if (next) loadInto(next, true);
    else unload();
  };

  /**
   * The place waiting for the episode to load, once the element has a length that reaches it, or any
   * length when its time is `moving`, which a provisional length never lets it. Until then the speed
   * stays normal, since WebKit at another rate drops a seek made as the episode loads, and nothing is
   * saved over the place.
   */
  const placeKept = (audio: HTMLAudioElement, moving = false) => {
    const at = pendingSeek.current;
    if (at === null || !(audio.duration > 0) || (audio.duration < at && !moving)) return;
    pendingSeek.current = null;
    audio.currentTime = at;
    lastWhole.current = Math.floor(at);
    applySpeed(audio, latest.current.library.speed);
  };

  const onLoadedMetadata = (event: SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    if (pendingSeek.current === null) applySpeed(audio, latest.current.library.speed);
    else placeKept(audio);
  };

  // Each whole second heard is shown; the kept place moves each `POSITION_STEP` seconds, so the
  // library is saved every ten seconds of listening rather than every second.
  const onTimeUpdate = (event: SyntheticEvent<HTMLAudioElement>) => {
    const id = loadedId.current;
    if (!id) return;
    if (pendingSeek.current !== null) {
      if (event.currentTarget.currentTime > 0) placeKept(event.currentTarget, true);
      return;
    }
    const whole = Math.floor(event.currentTarget.currentTime);
    if (whole === lastWhole.current) return;
    lastWhole.current = whole;
    setHeard({ id, seconds: whole });
    const saved = latest.current.library.positions[id] ?? 0;
    if (Math.abs(whole - saved) < POSITION_STEP) return;
    setLibrary((now) => (now.current?.id === id ? withPosition(now, id, whole) : now));
  };

  const onPause = (event: SyntheticEvent<HTMLAudioElement>) => {
    setPlaying(false);
    const audio = event.currentTarget;
    const id = loadedId.current;
    if (!id || pendingSeek.current !== null || audio.ended) return;
    // A pause saves the place to the second.
    const whole = Math.floor(audio.currentTime);
    lastWhole.current = whole;
    setHeard({ id, seconds: whole });
    setLibrary((now) => (now.current?.id === id ? withPosition(now, id, whole) : now));
  };

  const onError = (event: SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    // An element emptied on purpose reports no error worth telling.
    const id = loadedId.current;
    if (!id || !audio.error) return;
    if (!audio.paused && audio.readyState >= 2) {
      // Firefox reports an error of its audio output (a browser without a sound device) and plays
      // on. Neither `paused` nor buffered data proves that, so the episode has failed unless its
      // time moves on within a moment.
      const from = audio.currentTime;
      window.setTimeout(() => {
        if (!live.current || loadedId.current !== id || !audio.error) return;
        if (audio.paused || audio.currentTime <= from) failed(audio);
      }, ERROR_GRACE_MS);
      return;
    }
    failed(audio);
  };

  /** Tell that the loaded episode could not be played, and stop it. */
  const failed = (audio: HTMLAudioElement) => {
    setPlaying(false);
    if (!audio.paused) audio.pause();
    setNotice(
      audio.error?.code === 4
        ? "This browser cannot play the episode's audio, or its publisher refused it."
        : "The episode's audio could not be loaded from its publisher.",
    );
  };

  // The latest handlers, for the effects below.
  const actions = useRef({
    loadInto,
    unload,
    requestFeed,
    refreshAll,
    toggle,
    skip,
    seekTo,
    stop,
    setSpeed,
    playEpisode,
  });
  actions.current = {
    loadInto,
    unload,
    requestFeed,
    refreshAll,
    toggle,
    skip,
    seekTo,
    stop,
    setSpeed,
    playEpisode,
  };

  // The Controls menu of the desktop's menu bar, while this window is the one last used: the
  // player's own commands, each on the audio element, dimmed while it has nothing to act on.
  const { skipForward, skipBack } = library.settings;
  const loadedEpisode = library.current;
  const nextInQueue = library.queue[0];
  const commands = {
    find: {
      title: "Find",
      key: "command+f",
      enabled: true,
      reason: undefined,
      run: () => {
        // The field is in the sidebar, which may be hidden. A menu holds the keyboard until it
        // closes: the field takes it after, within a few frames.
        if (!sidebarShown) setSidebarShown(true);
        let frames = 0;
        const take = () => {
          const field = frame?.querySelector<HTMLInputElement>('input[type="search"]');
          if (field && !document.querySelector('[role="menu"][data-open]')) field.focus();
          if ((!field || document.activeElement !== field) && ++frames < 30)
            requestAnimationFrame(take);
        };
        take();
      },
    },
    sidebar: {
      title: sidebarShown ? "Hide Sidebar" : "Show Sidebar",
      key: "option+command+s",
      enabled: true,
      reason: undefined,
      run: () => setSidebarShown(!sidebarShown),
    },
    stop: {
      title: "Stop",
      key: "command+.",
      enabled: !loading && Boolean(loadedEpisode),
      reason: NOTHING_LOADED,
      run: () => actions.current.stop(),
    },
    previous: {
      title: "Previous",
      key: undefined,
      enabled: !loading && Boolean(loadedEpisode),
      reason: NOTHING_LOADED,
      run: () => actions.current.seekTo(0),
    },
    forward: {
      title: `Skip Forward ${skipForward} Seconds`,
      key: "command+right",
      enabled: !loading && Boolean(loadedEpisode),
      reason: NOTHING_LOADED,
      run: () => actions.current.skip(skipForward),
    },
    back: {
      title: `Skip Back ${skipBack} Seconds`,
      key: "command+left",
      enabled: !loading && Boolean(loadedEpisode),
      reason: NOTHING_LOADED,
      run: () => actions.current.skip(-skipBack),
    },
    louder: {
      title: "Increase Volume",
      key: "command+up",
      enabled: !loading && volume < 100,
      reason: "The volume is at its highest.",
      run: () => setVolume((now) => Math.min(100, now + VOLUME_STEP)),
    },
    quieter: {
      title: "Decrease Volume",
      key: "command+down",
      enabled: !loading && volume > 0,
      reason: "The volume is at its lowest.",
      run: () => setVolume((now) => Math.max(0, now - VOLUME_STEP)),
    },
  };
  const latestCommands = useRef(commands);
  latestCommands.current = commands;
  // On the page while the window is key: a press on a control that then goes (Play becomes
  // Pause) leaves the focus outside the window.
  const isKey = (props.state ?? "key") === "key";
  useEffect(() => {
    if (!isKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Space is the player's, except where a control or a field takes it.
      if (
        event.key === " " &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        !document.activeElement?.closest(SPACE_KEEPERS)
      ) {
        event.preventDefault();
        actions.current.toggle();
        return;
      }
      if (matchesMenuKeyEquivalent(event, "command+r")) {
        event.preventDefault();
        actions.current.refreshAll(0);
        return;
      }
      const command = Object.values(latestCommands.current).find(
        ({ key }) => key && matchesMenuKeyEquivalent(event, key),
      );
      if (!command) return;
      // In a text field or on a slider the arrows are the field's.
      if (
        /left|right|up|down/.test(command.key ?? "") &&
        document.activeElement?.closest("input, textarea, [role='slider']")
      ) {
        return;
      }
      event.preventDefault();
      if (command.enabled) command.run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isKey]);
  const row = (command: (typeof commands)[keyof typeof commands]) => (
    <MenuItem
      keyEquivalent={command.key}
      disabled={!command.enabled}
      title={command.enabled ? undefined : command.reason}
      onClick={command.run}
    >
      {command.title}
    </MenuItem>
  );
  const controlsMenu = (
    <>
      <MenuItem
        disabled={loading || (!loadedEpisode && !nextInQueue)}
        onClick={() => actions.current.toggle()}
      >
        {playing ? "Pause" : "Play"}
      </MenuItem>
      {row(commands.stop)}
      <MenuSeparator />
      {row(commands.forward)}
      {row(commands.back)}
      {row(commands.previous)}
      <MenuSeparator />
      <MenuItem
        disabled={loading || !nextInQueue}
        onClick={() => {
          const next = latest.current.library.queue[0];
          if (next) actions.current.playEpisode(next);
        }}
      >
        Play Next in Up Next
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger disabled={loading}>Playback Speed</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={String(library.speed)}
            onValueChange={(value) => actions.current.setSpeed(Number(value))}
          >
            {SPEEDS.map((speed) => (
              <MenuRadioItem key={speed} value={String(speed)}>
                {speedLabel(speed)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      {row(commands.louder)}
      {row(commands.quieter)}
    </>
  );
  useDesktopAppMenu("podcasts", "Controls", controlsMenu, frame);
  useDesktopAppMenu(
    "podcasts",
    "Dock",
    <>
      <MenuItem
        disabled={loading || (!loadedEpisode && !nextInQueue)}
        onClick={() => actions.current.toggle()}
      >
        {playing ? "Pause" : "Play"}
      </MenuItem>
      <MenuItem
        disabled={loading || !nextInQueue}
        onClick={() => {
          const next = latest.current.library.queue[0];
          if (next) actions.current.playEpisode(next);
        }}
      >
        Play Next in Up Next
      </MenuItem>
    </>,
    frame,
  );
  useDesktopAppMenu(
    "podcasts",
    "File",
    <>
      <MenuItem disabled={loading} onClick={() => setAddingShow(true)}>
        Add a Show by URL…
      </MenuItem>
      <MenuItem
        disabled={loading || library.shows.length === 0}
        title={library.shows.length === 0 ? NO_SHOWS_FOR_STATION : undefined}
        onClick={() => setStationSheet({})}
      >
        New Station…
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={loading || importing} onClick={() => opmlPicker.current?.click()}>
        Import Shows from OPML…
      </MenuItem>
      <MenuItem
        disabled={loading || library.shows.length === 0}
        title={library.shows.length === 0 ? "No shows are followed yet." : undefined}
        onClick={() => {
          saveOpml(opmlOf(library.shows)).then(
            (name) => {
              if (live.current) setNotice(`Your shows were saved as “${name}” in Downloads.`);
            },
            (error: unknown) => {
              if (live.current) setNotice(`The list could not be saved: ${messageOf(error)}`);
            },
          );
        }}
      >
        Export Shows as OPML…
      </MenuItem>
    </>,
    frame,
  );
  useDesktopAppMenu(
    "podcasts",
    "Account",
    <MenuItem
      disabled
      title="This desktop's account is the one you signed in with: there is no Apple ID here."
    >
      Sign In…
    </MenuItem>,
    frame,
  );
  useDesktopAppMenu(
    "podcasts",
    "Edit",
    <>
      <MenuItem disabled title="Podcasts has nothing here to undo." keyEquivalent="command+z">
        Undo
      </MenuItem>
      <MenuItem disabled title="Podcasts has nothing here to redo." keyEquivalent="shift+command+z">
        Redo
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled title="The search field's own key works there." keyEquivalent="command+x">
        Cut
      </MenuItem>
      <MenuItem disabled title="The search field's own key works there." keyEquivalent="command+c">
        Copy
      </MenuItem>
      <MenuItem disabled title="The search field's own key works there." keyEquivalent="command+v">
        Paste
      </MenuItem>
      <MenuItem disabled title="The search field's own key works there." keyEquivalent="command+a">
        Select All
      </MenuItem>
      <MenuSeparator />
      {row(commands.find)}
    </>,
    frame,
  );
  useDesktopAppMenu(
    "podcasts",
    "View",
    <>
      <MenuItem
        disabled={loading || !loadedEpisode}
        title={loadedEpisode ? undefined : NOTHING_LOADED}
        onClick={() => {
          if (!loadedEpisode) return;
          setQuery("");
          goToShow(loadedEpisode);
        }}
      >
        Go to Current Episode
      </MenuItem>
      <MenuItem
        keyEquivalent="command+r"
        disabled={loading}
        onClick={() => actions.current.refreshAll(0)}
      >
        Refresh
      </MenuItem>
      {row(commands.sidebar)}
      <MenuSeparator />
      <MenuRadioGroup
        aria-label="Sort Episodes"
        value={episodeOrder}
        onValueChange={(next) =>
          changeDesktopValue(PODCASTS_VIEW, { ...keptView, episodes: next as EpisodeOrder })
        }
      >
        <MenuRadioItem value="newest" closeOnClick>
          Newest First
        </MenuRadioItem>
        <MenuRadioItem value="oldest" closeOnClick>
          Oldest First
        </MenuRadioItem>
      </MenuRadioGroup>
    </>,
    frame,
  );

  // The episode loaded after a load of the library (a reload, or another window's change),
  // paused at its saved place.
  const currentId = library.current?.id ?? null;
  useEffect(() => {
    if (loading) return;
    if (currentId === null) {
      if (loadedId.current !== null) actions.current.unload();
      return;
    }
    const current = latest.current.library.current;
    if (current && loadedId.current !== currentId) actions.current.loadInto(current, false);
  }, [loading, currentId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // The speed the library holds is the element's, however it changed: the speed button, a
  // reload, or another window's save while this episode plays on.
  const speed = library.speed;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    applySpeed(audio, speed);
  }, [speed]);

  // Every followed show's feed when the window opens, and of a show just followed: the server
  // reads it again when its copy is older than the Refresh interval.
  const refreshAge = maxAgeOf(library.settings.refresh);
  const followedFeeds = library.shows.map((show) => show.feed).join("\n");
  useEffect(() => {
    if (loading || followedFeeds === "") return;
    for (const feed of followedFeeds.split("\n")) {
      if (!latest.current.feeds[feed]) actions.current.requestFeed(feed, refreshAge);
    }
  }, [loading, followedFeeds, refreshAge]);

  // While the window stays open, again at the Refresh interval (not when Manually). The server
  // reads the feeds too, for the notifications of new episodes it delivers.
  const interval = REFRESH_SECONDS[library.settings.refresh] ?? null;
  useEffect(() => {
    if (loading || interval === null) return;
    void watchNewEpisodes();
    const timer = setInterval(() => {
      actions.current.refreshAll(interval);
      void watchNewEpisodes();
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [loading, interval]);

  // Apple's chart, when Browse or Top Charts is first shown; then its shows' feeds. A failed
  // chart or lookup is asked again whenever one of the two is chosen.
  const wantsChart = section === "browse" || section === "top-charts";
  const chartAsked = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `chosen` asks again when a place is chosen
  useEffect(() => {
    if (loading || !wantsChart || chartAsked.current) return;
    chartAsked.current = true;
    setChart((now) => ({ ...now, status: "loading" }));
    topShows().then(
      async (shows) => {
        if (!live.current) return;
        setChart((now) => ({ ...now, status: "ready", shows }));
        if (shows.length === 0) return;
        let listings: ShowListing[] = [];
        let error: string | undefined;
        try {
          listings = await lookupShows(shows.map((show) => show.id));
        } catch (failure) {
          error = messageOf(failure);
          // Looked up again the next time Browse or Top Charts is chosen.
          chartAsked.current = false;
        }
        if (!live.current) return;
        setChart((now) => ({
          ...now,
          lookedUp: true,
          error,
          listings: Object.fromEntries(listings.map((listing) => [listing.id, listing])),
        }));
      },
      (error: unknown) => {
        if (!live.current) return;
        // Asked again the next time Browse or Top Charts is chosen.
        chartAsked.current = false;
        setChart((now) => ({ ...now, status: "failed", error: messageOf(error) }));
      },
    );
  }, [loading, wantsChart, chosen]);

  // Apple's search, once typing pauses.
  const term = query.trim();
  useEffect(() => {
    if (loading || term.length < 2) return;
    let wanted = true;
    const timer = setTimeout(() => {
      setSearch({ term, status: "loading", results: [] });
      searchShows(term).then(
        (results) => {
          if (wanted && live.current) setSearch({ term, status: "ready", results });
        },
        (error: unknown) => {
          if (wanted && live.current)
            setSearch({ term, status: "failed", results: [], error: messageOf(error) });
        },
      );
    }, SEARCH_PAUSE_MS);
    return () => {
      wanted = false;
      clearTimeout(timer);
    };
  }, [loading, term]);

  // ---- What the window shows ---------------------------------------------------------------

  const played = useMemo(() => new Set(library.played), [library.played]);
  const followedById = useMemo(
    () => new Map(library.shows.map((show) => [show.id, show])),
    [library.shows],
  );
  // Every show the window has a listing of: the chart's, the search's, the one opened.
  const listings = useMemo(() => {
    const all = new Map<string, ShowListing>();
    for (const listing of Object.values(chart.listings)) all.set(listing.id, listing);
    for (const listing of search.results) all.set(listing.id, listing);
    if (opened?.listing) all.set(opened.listing.id, opened.listing);
    return all;
  }, [chart.listings, search.results, opened]);

  const followedEpisodes = useMemo(
    () =>
      library.shows
        .flatMap((show) => {
          const feed = feeds[show.feed]?.feed;
          return feed ? episodesOfFeed(show, feed, played, show.seen, today) : [];
        })
        .sort((a, b) => b.published - a.published),
    [library.shows, feeds, played, today],
  );
  const newEpisodes = followedEpisodes.filter((episode) => episode.isNew);
  const newShows = new Set(newEpisodes.map((episode) => episode.show)).size;

  /** The window's record of a show by id, from whatever it knows of it. */
  const showById = (id: string, fallback?: { title: string; artwork: string | null }) => {
    const followed = followedById.get(id);
    const listing = listings.get(id);
    const chartEntry = chart.shows.find((show) => show.id === id);
    const ref: ShowRef | undefined =
      followed ??
      listing ??
      chartEntry ??
      (fallback ? { id, title: fallback.title, author: "", artwork: fallback.artwork } : undefined);
    if (!ref) return undefined;
    const feedUrl = followed?.feed ?? listing?.feed;
    return showOfRef(ref, followed !== undefined, feedUrl ? feeds[feedUrl]?.feed : undefined);
  };

  const descriptionOf = (item: QueuedEpisode) => {
    const feed = item.feed ? feeds[item.feed]?.feed : undefined;
    const own = feed?.episodes.find((each) => episodeKey(item.show, each.id) === item.id);
    return own?.summary ?? "";
  };
  const currentEpisode = library.current
    ? fromQueued(library.current, descriptionOf(library.current), today)
    : null;
  const upNext = library.queue.map((item) => fromQueued(item, descriptionOf(item), today));
  const queuedIds = new Set(library.queue.map((item) => item.id));

  // The notes of the episode loaded come from its show's feed.
  const currentFeed = library.current?.feed ?? null;
  useEffect(() => {
    if (loading || panel !== "notes" || !currentFeed) return;
    if (!latest.current.feeds[currentFeed]) actions.current.requestFeed(currentFeed, refreshAge);
  }, [loading, panel, currentFeed, refreshAge]);

  const viewLibrary: PodcastsLibrary = {
    showOf: (episode) =>
      showById(
        episode.show,
        isPlayable(episode) ? { title: episode.showTitle, artwork: episode.artwork } : undefined,
      ) ?? UNKNOWN_SHOW,
    positionOf: (episode) =>
      heard?.id === episode.id && library.positions[episode.id] !== undefined
        ? heard.seconds
        : library.positions[episode.id],
    isPlayed: (episode) => played.has(episode.id),
    current: currentEpisode,
    playing,
    onPlay: (list, index) => {
      const episode = list[index];
      if (episode && isPlayable(episode)) playEpisode(queuedOf(episode));
    },
    onToggle: toggle,
    dragEpisode: (episode) => dragEpisode(episode),
    episodeMenu: (episode) => (isPlayable(episode) ? episodeRows(episode) : null),
    episodesMenu: (episodes) => {
      const several = episodes.filter(isPlayable);
      if (several.length === 0) return null;
      const count = several.length;
      const room = PODCASTS_LIMITS.queue - library.queue.length;
      const adding = several.filter(
        (episode) => !queuedIds.has(episode.id) && episode.id !== library.current?.id,
      );
      return (
        <>
          <MenuItem
            disabled={adding.length === 0 || adding.length > room}
            title={
              adding.length > room
                ? `Up Next holds at most ${PODCASTS_LIMITS.queue} episodes`
                : undefined
            }
            onClick={() =>
              setLibrary((now) => ({
                ...now,
                queue: [...now.queue, ...adding.map(queuedOf)],
              }))
            }
          >
            {`Add ${count} to Up Next`}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onClick={() => {
              for (const episode of several) markPlayed(episode.id);
            }}
          >
            {`Mark ${count} as Played`}
          </MenuItem>
          <MenuItem
            onClick={() => {
              const ids = several.map((episode) => episode.id);
              setLibrary((now) => ({
                ...now,
                played: now.played.filter((each) => !ids.includes(each)),
              }));
            }}
          >
            {`Mark ${count} as Unplayed`}
          </MenuItem>
        </>
      );
    },
  };

  const toggleInQueue = (episode: PodcastsServedEpisode) =>
    setLibrary((now) => ({
      ...now,
      queue: now.queue.some((item) => item.id === episode.id)
        ? now.queue.filter((item) => item.id !== episode.id)
        : [...now.queue, queuedOf(episode)].slice(0, PODCASTS_LIMITS.queue),
    }));

  /** An episode played to its end, as `onEnded` leaves one; the one loaded stays where it is. */
  const markPlayed = (id: string) =>
    setLibrary((now) => {
      const positions = { ...now.positions };
      if (now.current?.id !== id) delete positions[id];
      return {
        ...now,
        positions,
        played: [...now.played.filter((each) => each !== id), id],
        queue: now.queue.filter((item) => item.id !== id),
      };
    });

  const copyLink = (url: string) => {
    void copyText(url).then((copied) => {
      if (!copied && live.current) setNotice("The link could not be put on the clipboard.");
    });
  };

  /** Open a show's page from one of its episodes, whose feed is known even if the show is not. */
  const goToShow = (
    episode: Pick<PodcastsServedEpisode, "show" | "feed" | "showTitle" | "artwork">,
  ) =>
    setOpened({
      id: episode.show,
      listing:
        listings.get(episode.show) ??
        (episode.feed
          ? {
              id: episode.show,
              title: episode.showTitle,
              author: "",
              artwork: episode.artwork ?? undefined,
              feed: episode.feed,
              followable: true,
            }
          : undefined),
    });

  // A show or an episode asked for from Spotlight or a notification, once the library that holds it
  // has been read.
  const [askedShow, setAskedShow] = useState<string | null>(null);
  useOpenItemRequests("podcasts", ({ id }) => setAskedShow(showOfOpenItem(id)));
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request or a read opens it.
  useEffect(() => {
    if (askedShow === null || loading) return;
    setAskedShow(null);
    const followed = library.shows.find((show) => show.id === askedShow);
    if (followed) {
      setOpened({ id: followed.id, listing: listings.get(followed.id) });
      return;
    }
    const queued = [library.current, ...library.queue].find((each) => each?.id === askedShow);
    if (queued) goToShow(queued);
  }, [askedShow, loading]);

  /** The address an episode is shared by: its page in its feed, or else its audio. */
  const linkOf = (episode: PodcastsServedEpisode) => {
    const own = episode.feed
      ? feeds[episode.feed]?.feed?.episodes.find(
          (each) => episodeKey(episode.show, each.id) === episode.id,
        )
      : undefined;
    return own?.link ?? episode.audio;
  };

  const episodeRows = (episode: PodcastsServedEpisode) => {
    const loaded = library.current?.id === episode.id;
    const inQueue = queuedIds.has(episode.id);
    const full = !inQueue && library.queue.length >= PODCASTS_LIMITS.queue;
    return (
      <>
        <MenuItem onClick={() => (loaded ? toggle() : playEpisode(queuedOf(episode)))}>
          {loaded && playing ? "Pause Episode" : "Play Episode"}
        </MenuItem>
        <MenuItem
          disabled={loaded || full}
          title={
            loaded
              ? "This episode is in the player."
              : full
                ? `Up Next holds at most ${PODCASTS_LIMITS.queue} episodes`
                : undefined
          }
          onClick={() => toggleInQueue(episode)}
        >
          {inQueue ? "Remove from Up Next" : "Add to Up Next"}
        </MenuItem>
        <MenuSeparator />
        {played.has(episode.id) ? (
          <MenuItem
            onClick={() =>
              setLibrary((now) => ({
                ...now,
                played: now.played.filter((each) => each !== episode.id),
              }))
            }
          >
            Mark as Unplayed
          </MenuItem>
        ) : (
          <MenuItem onClick={() => markPlayed(episode.id)}>Mark as Played</MenuItem>
        )}
        <MenuSeparator />
        <MenuItem onClick={() => setOpenedEpisode(episode)}>Go to Episode</MenuItem>
        <MenuItem onClick={() => goToShow(episode)}>Go to Show</MenuItem>
        <MenuSeparator />
        {linkRows(linkOf(episode), episode.title, "Episode", copyLink)}
      </>
    );
  };

  const queueToggle = (episode: PodcastsEpisode) => {
    if (!isPlayable(episode) || episode.id === library.current?.id) return null;
    const inQueue = queuedIds.has(episode.id);
    const full = library.queue.length >= PODCASTS_LIMITS.queue;
    return (
      <StorePillButton
        aria-label={`${inQueue ? "Remove" : "Add"} ${episode.title} ${inQueue ? "from" : "to"} Up Next`}
        title={
          full && !inQueue ? `Up Next holds at most ${PODCASTS_LIMITS.queue} episodes` : undefined
        }
        disabled={full && !inQueue}
        onClick={() => toggleInQueue(episode)}
      >
        {inQueue ? "Queued" : "Queue"}
      </StorePillButton>
    );
  };

  const moveInQueue = (index: number, by: number) =>
    setLibrary((now) => {
      const queue = [...now.queue];
      const [item] = queue.splice(index, 1);
      if (!item) return now;
      queue.splice(Math.max(0, Math.min(queue.length, index + by)), 0, item);
      return { ...now, queue };
    });

  const removeFromQueue = (episodes: readonly PodcastsEpisode[]) => {
    const ids = new Set(episodes.map((episode) => episode.id));
    setLibrary((now) => ({ ...now, queue: now.queue.filter((item) => !ids.has(item.id)) }));
  };

  const forgetPlaces = (episodes: readonly PodcastsEpisode[]) =>
    setLibrary((now) => {
      const positions = { ...now.positions };
      for (const episode of episodes) delete positions[episode.id];
      return { ...now, positions };
    });

  // A card drags out as its episode's link, which a text field or another app takes as it is.
  const dragging = useRef<PodcastsServedEpisode | null>(null);
  const dragEpisode = (episode: PodcastsEpisode): HTMLAttributes<HTMLElement> =>
    isPlayable(episode)
      ? {
          draggable: true,
          onDragStart: (event) => {
            dragging.current = episode;
            const link = linkOf(episode);
            event.dataTransfer.effectAllowed = "copyMove";
            event.dataTransfer.setData("text/uri-list", link);
            event.dataTransfer.setData("text/plain", link);
          },
          onDragEnd: () => {
            dragging.current = null;
          },
        }
      : {};
  /** What taking a dragged episode into Up Next does, before the entry `before` or at the end. */
  const queueDrop = (before: string | null): HTMLAttributes<HTMLElement> => ({
    onDragOver: (event) => {
      if (!dragging.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = queuedIds.has(dragging.current.id) ? "move" : "copy";
    },
    onDrop: (event) => {
      const episode = dragging.current;
      if (!episode) return;
      event.preventDefault();
      event.stopPropagation();
      if (episode.id === library.current?.id) {
        setNotice("This episode is in the player.");
      } else if (!queuedIds.has(episode.id) && library.queue.length >= PODCASTS_LIMITS.queue) {
        setNotice(`Up Next holds at most ${PODCASTS_LIMITS.queue} episodes.`);
      } else {
        setLibrary((now) => ({
          ...now,
          queue: movedInQueue(now.queue, queuedOf(episode), before, PODCASTS_LIMITS.queue),
        }));
      }
    },
  });

  const queueActions = (episode: PodcastsEpisode, index: number) => (
    <PullDownButton size="small" title="Edit" aria-label={`Change ${episode.title} in Up Next`}>
      <MenuItem disabled={index === 0} onClick={() => moveInQueue(index, -1)}>
        Move Up
      </MenuItem>
      <MenuItem disabled={index === library.queue.length - 1} onClick={() => moveInQueue(index, 1)}>
        Move Down
      </MenuItem>
      <MenuItem
        onClick={() =>
          setLibrary((now) => ({
            ...now,
            queue: now.queue.filter((item) => item.id !== episode.id),
          }))
        }
      >
        Remove from Up Next
      </MenuItem>
    </PullDownButton>
  );

  /** Follow a show, or stop following it. */
  const subscribe = (show: ShowRef & { followable?: boolean }) => {
    if (followedById.has(show.id)) {
      setLibrary((now) => ({ ...now, shows: now.shows.filter((each) => each.id !== show.id) }));
      return;
    }
    if (!show.feed || show.followable === false) return;
    if (library.shows.length >= PODCASTS_LIMITS.shows) {
      setNotice(`You can follow at most ${PODCASTS_LIMITS.shows} shows here.`);
      return;
    }
    const feed = show.feed;
    // What is in the feed now is not new: only what is published from now on.
    const seen = newestOf(feeds[feed]?.feed) ?? Date.now();
    const followed: FollowedShow = {
      id: show.id,
      title: limitText(show.title || feeds[feed]?.feed?.title || UNTITLED_SHOW),
      author: limitText(show.author ?? ""),
      artwork: show.artwork ?? feeds[feed]?.feed?.image ?? null,
      genre: show.genre ? limitText(show.genre) : null,
      feed,
      seen,
    };
    setLibrary((now) =>
      now.shows.some((each) => each.id === show.id)
        ? now
        : { ...now, shows: [...now.shows, followed] },
    );
  };

  /**
   * File > Import Shows from OPML: reads each listed feed in turn and follows those it can, as far
   * as the limit allows, and says what it could not.
   */
  const importOpml = async (text: string) => {
    if (importingOpml.current) return;
    const feedsListed = feedsOfOpml(text);
    if (feedsListed.length === 0) {
      setNotice("That file lists no shows: it is not an OPML subscription list.");
      return;
    }
    const known = new Set(latest.current.library.shows.map((show) => feedAddress(show.feed)));
    const wanted = feedsListed.filter((feed) => !known.has(feed));
    importingOpml.current = true;
    setImporting(true);
    const readable: FollowedShow[] = [];
    const unread: string[] = [];
    for (const feed of wanted) {
      // Stop once what has been read fills the library as it stands now.
      if (
        showsWith(latest.current.library.shows, readable, PODCASTS_LIMITS.shows).length >=
        PODCASTS_LIMITS.shows
      )
        break;
      setNotice(`Reading ${readable.length + unread.length + 1} of ${wanted.length} feeds…`);
      try {
        const { feed: read } = await readFeed(feed, 3600);
        readable.push({
          id: showIdOfFeed(feed),
          title: limitText(read.title || UNTITLED_SHOW),
          author: limitText(read.author ?? ""),
          artwork: read.image ?? null,
          genre: null,
          feed,
          seen: newestOf(read) ?? Date.now(),
        });
      } catch {
        unread.push(feed);
      }
      if (!live.current) return;
    }
    importingOpml.current = false;
    setImporting(false);
    const before = latest.current.library.shows;
    const after = showsWith(before, readable, PODCASTS_LIMITS.shows);
    const added = after.length - before.length;
    setLibrary((now) => ({
      ...now,
      shows: showsWith(now.shows, readable, PODCASTS_LIMITS.shows),
    }));
    const followed = new Set(after.map((show) => feedAddress(show.feed)));
    const leftOut = wanted.filter((feed) => !followed.has(feed) && !unread.includes(feed)).length;
    setNotice(
      [
        `${added} ${added === 1 ? "show" : "shows"} added.`,
        unread.length > 0 ? `${unread.length} could not be read here.` : "",
        leftOut > 0 ? `${leftOut} left out: you can follow at most ${PODCASTS_LIMITS.shows}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  };

  /** A show added by its feed's address: followed unless it already is, and opened either way. */
  const addShowByFeed = (feed: string, read: CachedFeed) => {
    setAddingShow(false);
    setQuery("");
    const id =
      library.shows.find((each) => feedAddress(each.feed) === feed)?.id ?? showIdOfFeed(feed);
    if (!followedById.has(id)) {
      if (library.shows.length >= PODCASTS_LIMITS.shows) {
        setNotice(`You can follow at most ${PODCASTS_LIMITS.shows} shows here.`);
        return;
      }
      subscribe({
        id,
        title: read.title ?? "",
        author: read.author ?? "",
        artwork: read.image ?? null,
        feed,
      });
    }
    setOpened({ id, listing: undefined });
  };

  /** A show added by a feed's address dropped on the window. */
  const addDroppedFeed = (feed: string) => {
    setNotice(`Reading ${feed}…`);
    readFeed(feed, 0).then(
      (reply) => {
        if (!live.current) return;
        setNotice(null);
        addShowByFeed(feed, reply.feed);
      },
      (error: unknown) => {
        if (live.current) setNotice(`That show could not be added: ${messageOf(error)}`);
      },
    );
  };

  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.kind === "file" && isOpml(item.name),
    onDrop: ([list]) => {
      if (!list) return;
      readFile(list.id)
        .then((blob) => blob.text())
        .then(importOpml, (error: unknown) => {
          if (live.current) setNotice(`“${list.name}” could not be read: ${messageOf(error)}`);
        });
    },
    refusal: () => DROP_REFUSED,
    sayRefusal: setNotice,
  });
  useEffect(() => dropRef(frame), [frame, dropRef]);

  // A list of shows opened from Finder, while the window was closed or is open.
  const openOpml = useRef((_file: { id: string; name: string }) => {});
  openOpml.current = (file) => {
    readFile(file.id)
      .then((blob) => blob.text())
      .then(importOpml, (error: unknown) => {
        if (live.current) setNotice(`“${file.name}” could not be read: ${messageOf(error)}`);
      });
  };
  useEffect(() => {
    if (loading) return;
    for (const request of takeOpenFileRequests("podcasts")) openOpml.current(request);
    return onOpenFileRequest("podcasts", (request) => openOpml.current(request));
  }, [loading]);

  /** Mark every followed show's episodes as looked at. */
  const markSeen = (ids?: ReadonlySet<string>) =>
    setLibrary((now) => ({
      ...now,
      shows: now.shows.map((show) => {
        if (ids && !ids.has(show.id)) return show;
        const newest = newestOf(latest.current.feeds[show.feed]?.feed);
        return newest !== null && newest > show.seen ? { ...show, seen: newest } : show;
      }),
    }));

  // A followed show's page marks its episodes as looked at once they are read.
  const openedFollowed = opened ? followedById.get(opened.id) : undefined;
  const openedNewest = openedFollowed ? newestOf(feeds[openedFollowed.feed]?.feed) : null;
  const openedSeen = openedFollowed?.seen ?? null;
  const openedId = openedFollowed?.id ?? null;
  useEffect(() => {
    if (openedId === null || openedNewest === null || openedSeen === null) return;
    if (openedNewest > openedSeen) {
      setLibrary((now) => ({
        ...now,
        shows: now.shows.map((show) =>
          show.id === openedId && openedNewest > show.seen ? { ...show, seen: openedNewest } : show,
        ),
      }));
    }
  }, [openedId, openedNewest, openedSeen]);

  const openShow = (show: PodcastsShow) => {
    setOpened({ id: show.id, listing: listings.get(show.id) });
  };

  // The open show's feed, once it is known: at once for a show followed or found by a search,
  // and when the lookup answers for a chart's show opened before it did. Asked once for each
  // opening of a page and feed address (a page opened again asks again when it has no episodes).
  const openedListing = opened ? (opened.listing ?? listings.get(opened.id)) : undefined;
  const openedFeed = opened
    ? (followedById.get(opened.id)?.feed ??
      (openedListing?.followable ? openedListing.feed : undefined) ??
      null)
    : null;
  const openedFeedAsked = useRef<{ opened: OpenedShow; feed: string } | null>(null);
  useEffect(() => {
    if (loading || !opened || !openedFeed) return;
    const asked = openedFeedAsked.current;
    if (asked?.opened === opened && asked.feed === openedFeed) return;
    openedFeedAsked.current = { opened, feed: openedFeed };
    if (!latest.current.feeds[openedFeed]?.feed) {
      actions.current.requestFeed(openedFeed, refreshAge);
    }
  }, [loading, opened, openedFeed, refreshAge]);

  /** Why a chart's show without a listing cannot be followed. */
  const notLookedUp = () =>
    !chart.lookedUp
      ? "Its feed is still being looked up."
      : chart.error
        ? `Its feed could not be looked up: ${chart.error}`
        : "Apple did not give this show's feed.";

  const showRows = (show: PodcastsShow) => {
    const followed = followedById.get(show.id);
    const listing = listings.get(show.id);
    const feed = followed?.feed ?? (listing?.followable ? listing.feed : undefined);
    const blocked = followed
      ? undefined
      : listing
        ? listing.followable
          ? undefined
          : (listing.reason ?? "This show cannot be followed here.")
        : notLookedUp();
    return (
      <>
        <MenuItem onClick={() => openShow(show)}>Go to Show</MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={blocked !== undefined}
          title={blocked}
          onClick={() =>
            subscribe({
              id: show.id,
              title: show.title,
              author: show.author,
              artwork: show.artwork,
              genre: show.category,
              feed,
              followable: true,
            })
          }
        >
          {followed ? "Unsubscribe" : "Subscribe"}
        </MenuItem>
        <MenuItem
          disabled={!feed}
          title={feed ? undefined : (blocked ?? "This show's feed is not known.")}
          onClick={() => {
            if (feed) requestFeed(feed, 0);
          }}
        >
          Refresh Show
        </MenuItem>
        <MenuItem disabled title={NO_SHOW_SETTINGS}>
          Settings…
        </MenuItem>
        <MenuSeparator />
        {linkRows(
          shareableLink(show.id, followedById.get(show.id)?.feed ?? listings.get(show.id)?.feed),
          show.title,
          "Show",
          copyLink,
        )}
      </>
    );
  };

  const choose = (next: PodcastsSection) => {
    setStationShown(null);
    setSection(next);
    changeDesktopValue(PODCASTS_VIEW, { ...keptView, section: next });
    setQuery("");
    setOpened(null);
    setChosen((count) => count + 1);
    onSectionChange?.(next);
  };

  const here = sectionName(section);
  const shownStation = stations.find((station) => station.id === stationShown);
  const episodesOfStation = (station: PodcastsStation) =>
    followedEpisodes.filter((episode) => station.shows.includes(episode.show));
  const playStation = (station: PodcastsStation) => {
    const [first, ...rest] = episodesOfStation(station).slice(0, STATION_EPISODES).map(queuedOf);
    if (!first) return;
    actions.current.playEpisode(first);
    setLibrary((now) => {
      const held = new Set(now.queue.map((item) => item.id));
      return {
        ...now,
        queue: [...now.queue, ...rest.filter((item) => !held.has(item.id))].slice(
          0,
          PODCASTS_LIMITS.queue,
        ),
      };
    });
  };
  const stationRows = (id: string) => {
    const station = stations.find((each) => each.id === id);
    if (!station) return null;
    const empty = episodesOfStation(station).length === 0;
    return (
      <>
        <MenuItem
          disabled={empty}
          title={empty ? "This station's shows have no episodes yet." : undefined}
          onClick={() => playStation(station)}
        >
          Play Station
        </MenuItem>
        <MenuItem onClick={() => setStationSheet({ editing: station })}>Edit Station…</MenuItem>
        <MenuSeparator />
        <MenuItem
          onClick={() => {
            setStations(stations.filter((each) => each.id !== id));
            if (stationShown === id) setStationShown(null);
          }}
        >
          Delete Station
        </MenuItem>
      </>
    );
  };
  const searching = term !== "";
  const feedNote = (state: FeedState | undefined) => {
    if (!state || state.status === "loading") return "Reading the show's episodes…";
    if (state.status === "failed") return `The episodes could not be read: ${state.error ?? ""}`;
    if (state.error) return `Showing the episodes read earlier: ${state.error}`;
    if (state.feed?.cut) return "Only the newest episodes are listed.";
    return undefined;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: another place or show leaves the episode's page
  useEffect(() => setOpenedEpisode(null), [opened, chosen, stationShown]);

  let content: ReactNode;
  if (openedEpisode && term === "") {
    content = (
      <PodcastsPage title={null}>
        <EpisodePage
          episode={openedEpisode}
          library={viewLibrary}
          noDownload={DOWNLOADS_NOTE}
          origin={opened ? "Show" : here}
          onBack={() => setOpenedEpisode(null)}
          onGoToShow={() => goToShow(openedEpisode)}
          extra={queueToggle(openedEpisode)}
        />
      </PodcastsPage>
    );
  } else if (opened) {
    const followed = followedById.get(opened.id);
    const listing = openedListing;
    const ref: ShowRef = followed ??
      listing ??
      chart.shows.find((show) => show.id === opened.id) ?? {
        id: opened.id,
        title: UNTITLED_SHOW,
        author: "",
      };
    const feedUrl = openedFeed ?? undefined;
    const state = feedUrl ? feeds[feedUrl] : undefined;
    const show = showOfRef(ref, followed !== undefined, state?.feed);
    const unavailable = followed
      ? undefined
      : listing
        ? listing.followable
          ? undefined
          : (listing.reason ?? "This show cannot be followed here.")
        : notLookedUp();
    const list = state?.feed
      ? episodesOfFeed(ref, state.feed, played, followed?.seen ?? null, today)
      : [];
    content = (
      <PodcastsPage title={null}>
        <ShowPage
          show={show}
          episodes={list}
          library={viewLibrary}
          subscribed={followed !== undefined}
          onSubscribe={() => subscribe({ ...ref, feed: feedUrl, followable: !unavailable })}
          origin={searching ? "Search" : here}
          onBack={() => setOpened(null)}
          unavailable={unavailable}
          note={feedUrl ? feedNote(state) : undefined}
          extra={queueToggle}
          showMenu={showRows}
        />
      </PodcastsPage>
    );
  } else if (searching) {
    const lower = term.toLowerCase();
    const found = followedEpisodes
      .filter((episode) => `${episode.title}\n${episode.description}`.toLowerCase().includes(lower))
      .slice(0, 50);
    const results =
      search.term === term && search.status === "ready"
        ? search.results.map((listing) => showOfRef(listing, followedById.has(listing.id)))
        : [];
    const status =
      term.length < 2
        ? "Type at least two letters to search Apple's directory."
        : search.term !== term || search.status === "loading"
          ? "Searching…"
          : search.status === "failed"
            ? `The search failed: ${search.error ?? ""}`
            : results.length === 0
              ? "No shows found."
              : undefined;
    content = (
      <PodcastsPage title="Search">
        {status ? (
          <p className="mac-podcasts-note" role="status">
            {status}
          </p>
        ) : null}
        {results.length > 0 ? (
          <ShowGrid title="Shows" shows={results} onOpen={openShow} showMenu={showRows} />
        ) : null}
        {found.length > 0 ? (
          <EpisodeList
            title="Episodes"
            episodes={found}
            library={viewLibrary}
            extra={queueToggle}
          />
        ) : null}
      </PodcastsPage>
    );
  } else if (shownStation) {
    const list = episodesOfStation(shownStation).slice(0, MAX_LISTED);
    content = (
      <PodcastsPage title={shownStation.name}>
        {list.length > 0 ? (
          <EpisodeList
            title={`${list.length} ${list.length === 1 ? "Episode" : "Episodes"}`}
            episodes={list}
            library={viewLibrary}
            extra={queueToggle}
            action={
              <SectionAction onClick={() => playStation(shownStation)}>Play Station</SectionAction>
            }
          />
        ) : (
          <PodcastsNote>This station's shows have no episodes yet.</PodcastsNote>
        )}
      </PodcastsPage>
    );
  } else if (section === "listen-now") {
    const started = followedEpisodes.filter(
      (episode) =>
        library.positions[episode.id] !== undefined &&
        episode.id !== library.current?.id &&
        !queuedIds.has(episode.id),
    );
    content = (
      <PodcastsPage title={here}>
        {upNext.length > 0 ? (
          <EpisodeShelf
            title="Up Next"
            episodes={upNext}
            library={viewLibrary}
            dropProps={queueDrop(null)}
          />
        ) : (
          <PodcastsNote>
            {library.shows.length === 0
              ? "Search for a show, or find one in Browse or Top Charts, and subscribe to it: its new episodes are listed here."
              : "Up Next is empty. Queue an episode from a show's page or from Episodes, and it plays here in turn."}
          </PodcastsNote>
        )}
        {newEpisodes.length > 0 ? (
          <EpisodeList
            title="New Episodes"
            episodes={newEpisodes}
            library={viewLibrary}
            extra={queueToggle}
            action={<SectionAction onClick={() => markSeen()}>Mark as Seen</SectionAction>}
          />
        ) : null}
        {started.length > 0 ? (
          <EpisodeList
            title="Continue Listening"
            episodes={started}
            library={viewLibrary}
            extra={queueToggle}
            onRemove={forgetPlaces}
          />
        ) : null}
      </PodcastsPage>
    );
  } else if (section === "browse" || section === "top-charts") {
    const shows = chart.shows.map((entry) => showOfRef(entry, followedById.has(entry.id)));
    const status =
      chart.status === "failed"
        ? `Apple's chart could not be read: ${chart.error ?? ""}`
        : chart.status !== "ready"
          ? "Reading Apple's chart…"
          : shows.length === 0
            ? "Apple's chart lists no shows right now."
            : undefined;
    const unavailable = (show: PodcastsShow) => {
      const listing = chart.listings[show.id];
      if (listing) return listing.followable ? undefined : (listing.reason ?? "");
      return notLookedUp();
    };
    content = (
      <PodcastsPage title={here}>
        {status ? (
          <p className="mac-podcasts-note" role="status">
            {status}
          </p>
        ) : null}
        {section === "browse" && shows.length > 0 ? (
          <>
            <ShowGrid
              title="Featured"
              shows={shows.slice(0, 6)}
              onOpen={openShow}
              shelf
              showMenu={showRows}
            />
            <ShowGrid title="Popular Shows" shows={shows} onOpen={openShow} showMenu={showRows} />
          </>
        ) : null}
        {section === "top-charts" && shows.length > 0 ? (
          <ShowChart
            title="Top Shows"
            shows={shows}
            subscribed={new Set(followedById.keys())}
            unavailable={unavailable}
            onOpen={openShow}
            showMenu={showRows}
            onSubscribe={(show) => {
              const listing = chart.listings[show.id];
              subscribe({
                id: show.id,
                title: show.title,
                author: show.author,
                artwork: show.artwork,
                genre: show.category,
                feed: listing?.feed,
                followable: listing?.followable,
              });
            }}
          />
        ) : null}
      </PodcastsPage>
    );
  } else if (section === "recently-updated" || section === "shows") {
    const newest = new Map<string, number>();
    for (const episode of followedEpisodes) {
      if (!newest.has(episode.show)) newest.set(episode.show, episode.published);
    }
    const list = library.shows
      .map((show) => showOfRef(show, true, feeds[show.feed]?.feed))
      .sort((a, b) =>
        section === "shows"
          ? a.title.localeCompare(b.title)
          : (newest.get(b.id) ?? -1) - (newest.get(a.id) ?? -1),
      );
    const reading = library.shows.filter((show) => {
      const state = feeds[show.feed];
      return !state || state.status === "loading" || state.status === "refreshing";
    }).length;
    content = (
      <PodcastsPage title={here}>
        {list.length > 0 ? (
          <ShowGrid
            title={`${list.length} ${list.length === 1 ? "Show" : "Shows"}`}
            shows={list}
            onOpen={openShow}
            showMenu={showRows}
            action={
              <SectionAction onClick={() => refreshAll(0)}>
                {reading > 0 ? "Refreshing…" : "Refresh"}
              </SectionAction>
            }
          />
        ) : (
          <PodcastsNote>Shows you subscribe to appear here.</PodcastsNote>
        )}
      </PodcastsPage>
    );
  } else if (section === "episodes") {
    const list = (
      episodeOrder === "oldest" ? [...followedEpisodes].reverse() : followedEpisodes
    ).slice(0, MAX_LISTED);
    content = (
      <PodcastsPage title={here}>
        {list.length > 0 ? (
          <EpisodeList
            title={`${list.length} ${list.length === 1 ? "Episode" : "Episodes"}`}
            episodes={list}
            library={viewLibrary}
            extra={queueToggle}
          />
        ) : (
          <PodcastsNote>Episodes of the shows you subscribe to appear here.</PodcastsNote>
        )}
      </PodcastsPage>
    );
  } else {
    content = (
      <PodcastsPage title={here}>
        <PodcastsNote>{DOWNLOADS_NOTE}</PodcastsNote>
      </PodcastsPage>
    );
  }

  const banners: ReactNode[] = [];
  if (notice) {
    banners.push(
      <WindowBanner
        key="notice"
        role="alert"
        trailing={<WindowBannerAction onClick={() => setNotice(null)}>Dismiss</WindowBannerAction>}
      >
        {notice}
      </WindowBanner>,
    );
  }
  if (newEpisodes.length > 0) {
    banners.push(
      <WindowBanner
        key="new"
        aria-live="polite"
        trailing={
          <>
            {section !== "listen-now" || opened || searching ? (
              <WindowBannerAction onClick={() => choose("listen-now")}>Show</WindowBannerAction>
            ) : null}
            <WindowBannerAction onClick={() => markSeen()}>Mark as Seen</WindowBannerAction>
          </>
        }
      >
        {newEpisodes.length === 1
          ? "1 new episode since you last looked"
          : `${newEpisodes.length} new episodes${newShows > 1 ? ` from ${newShows} shows` : ""} since you last looked`}
      </WindowBanner>,
    );
  }

  const shownShow = currentEpisode ? viewLibrary.showOf(currentEpisode) : null;
  const length = duration > 0 ? duration : (library.current?.duration ?? 0);

  return (
    <PodcastsFrame
      {...props}
      ref={frameRef}
      material={material}
      settings={library.settings}
      onSettingsChange={(settings) => setLibrary((now) => ({ ...now, settings }))}
      defaultPreferencesOpen={defaultPreferencesOpen}
      preferencesProps={{ downloadNote: DOWNLOADS_NOTE, syncNote: SYNC_NOTE, fixedSize: true }}
      loading={loading}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        if (dragging.current || (event.target as Element).closest("input")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        if (dragging.current || (event.target as Element).closest("input")) return;
        event.preventDefault();
        const list = [...event.dataTransfer.files].find((file) => isOpml(file.name));
        if (list) {
          list
            .text()
            .then(importOpml)
            .catch((error: unknown) => {
              if (live.current) setNotice(`“${list.name}” could not be read: ${messageOf(error)}`);
            });
          return;
        }
        const feed = droppedFeed(
          event.dataTransfer.getData("text/uri-list"),
          event.dataTransfer.getData("text/plain"),
        );
        if (feed) addDroppedFeed(feed);
        else setNotice(DROP_REFUSED);
      }}
      sidebarShown={sidebarShown}
      sidebarMenu={
        <>
          <MenuItem
            disabled={library.shows.length === 0}
            title={library.shows.length === 0 ? "No shows are followed yet." : undefined}
            onClick={() => refreshAll(0)}
          >
            Refresh All Shows
          </MenuItem>
          <MenuItem
            disabled={newEpisodes.length === 0}
            title={newEpisodes.length === 0 ? "No episode is new." : undefined}
            onClick={() => markSeen()}
          >
            Mark All as Seen
          </MenuItem>
          <MenuSeparator />
          {row(commands.sidebar)}
        </>
      }
      upNextDrop={queueDrop(null)}
      section={section}
      onSectionChoose={choose}
      stations={stations}
      stationMenu={stationRows}
      station={shownStation?.id ?? null}
      onStationChoose={(id) => {
        setStationShown(id);
        setQuery("");
        setOpened(null);
      }}
      sectionAccessory={(row) =>
        row === "listen-now" && newEpisodes.length > 0 ? (
          <SidebarBadge>{newEpisodes.length}</SidebarBadge>
        ) : undefined
      }
      query={query}
      onQueryChange={(next) => {
        setQuery(next);
        setOpened(null);
      }}
      transport={{
        loaded:
          currentEpisode && shownShow
            ? {
                title: currentEpisode.title,
                subtitle: currentEpisode.date
                  ? `${shownShow.title} \u2014 ${currentEpisode.date}`
                  : shownShow.title,
                artwork: (
                  <ShowArtwork
                    id={shownShow.id}
                    colors={shownShow.colors}
                    src={currentEpisode.artwork ?? shownShow.artwork ?? undefined}
                  />
                ),
                elapsed:
                  heard?.id === currentEpisode.id
                    ? heard.seconds
                    : (library.positions[currentEpisode.id] ?? 0),
                duration: length,
                onSeek: seekTo,
              }
            : null,
        playing,
        canStart: library.queue.length > 0,
        onToggle: toggle,
        onSkip: skip,
      }}
      volume={volume}
      onVolumeSet={setVolume}
      controls={
        <MediaAppChromeButton
          className="mac-podcasts-speed"
          aria-label={`Playback speed ${speedLabel(library.speed)}`}
          title="Playback speed: click for the next speed"
          onClick={cycleSpeed}
        >
          {speedLabel(library.speed)}
        </MediaAppChromeButton>
      }
      panel={panel}
      onPanelChange={setPanel}
      panelContent={
        panel ? (
          <SidePanel
            kind={panel}
            library={viewLibrary}
            upcoming={upNext}
            queueExtra={queueActions}
            queueRemove={removeFromQueue}
            queueRowDrop={(episode) => queueDrop(episode.id)}
            queueDrop={queueDrop(null)}
            queueFooter={
              <p className="mac-podcasts-panel-source">
                {library.settings.continuous
                  ? "Up Next plays in turn when an episode ends (Continuous Playback)."
                  : "Continuous Playback is off: the player stops when an episode ends."}
              </p>
            }
          />
        ) : null
      }
      banner={banners.length > 0 ? <div className="mac-podcasts-banners">{banners}</div> : null}
      view={
        <>
          {content}
          <input
            ref={opmlPicker}
            type="file"
            hidden
            aria-label="Import Shows from OPML"
            accept=".opml,.xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void file.text().then(importOpml);
            }}
          />
          {stationSheet ? (
            <StationSheet
              anchor={frame}
              station={stationSheet.editing}
              shows={library.shows}
              onCancel={() => setStationSheet(null)}
              onSave={(name, shows) => {
                const station = {
                  id: stationSheet.editing?.id ?? `station-${crypto.randomUUID()}`,
                  name,
                  shows,
                };
                setStations(savedStation(stations, station));
                setStationSheet(null);
                setStationShown(station.id);
                setQuery("");
                setOpened(null);
              }}
            />
          ) : null}
          {addingShow ? (
            <AddShowSheet
              anchor={frame?.querySelector(".mac-media-app-chrome-bar") ?? frame}
              onAdd={addShowByFeed}
              onCancel={() => setAddingShow(false)}
            />
          ) : null}
        </>
      }
      media={
        // Nothing of an episode is fetched before Play, and it loads at the normal speed: WebKit
        // loads a paused redirected episode's metadata with no length, and with a rate other
        // than 1 it drops a seek made as the episode loads.
        // biome-ignore lint/a11y/useMediaCaption: podcasts publish no captions; nothing is shown
        <audio
          ref={audioRef}
          preload="none"
          className="mac-podcasts-audio"
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={(event) => {
            const { currentTarget: element } = event;
            const { duration: seconds } = element;
            if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds);
            placeKept(element);
          }}
          onTimeUpdate={onTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPlaying={() => setPlaying(true)}
          onPause={onPause}
          onEnded={onEnded}
          onError={onError}
        />
      }
    />
  );
}
