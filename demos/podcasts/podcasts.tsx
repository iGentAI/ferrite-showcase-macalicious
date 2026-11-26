"use client";

import { EmptyState } from "macalicious/empty-state";
import type { WindowProps } from "macalicious/window";
import type { WindowControlsProps } from "macalicious/window-controls";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { ShowArtwork } from "./podcasts-artwork";
import {
  DEFAULT_SETTINGS,
  defaultEpisodes,
  defaultShows,
  episodeMatches,
  FEATURED_SHOWS,
  type PodcastsEpisode,
  type PodcastsSection,
  type PodcastsSettings,
  type PodcastsShow,
  sectionName,
  showMatches,
  TOP_SHOWS,
} from "./podcasts-data";
import { PodcastsFrame } from "./podcasts-frame";
import {
  EpisodeList,
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

/** Stands for the show of an episode whose show the catalogue does not hold. */
export const UNKNOWN_SHOW: PodcastsShow = {
  id: "",
  title: "Unknown Show",
  author: "",
  category: "",
  description: "",
  colors: ["indigo", "purple"],
  subscribed: false,
};

/** The player: a queue, the place in it, and what has been heard of every episode. */
interface Player {
  queue: readonly PodcastsEpisode[];
  index: number;
  playing: boolean;
  /** Seconds heard of each episode that has been started and not finished. */
  positions: Readonly<Record<string, number>>;
  /** The episodes played to their end. */
  played: ReadonlySet<string>;
}

type PlayerAction =
  | { type: "play"; queue: readonly PodcastsEpisode[]; index: number }
  | {
      type: "retain";
      find: (held: PodcastsEpisode) => PodcastsEpisode | undefined;
      continuous: boolean;
    }
  | { type: "toggle" }
  | { type: "seek"; to: number; continuous: boolean }
  | { type: "tick"; continuous: boolean };

/** Loads the episode at `index`: from where it was left, or from its start. */
function load(
  player: Player,
  queue: readonly PodcastsEpisode[],
  index: number,
  playing: boolean,
): Player {
  const episode = queue[index];
  if (!episode) return player;
  const played = new Set(player.played);
  played.delete(episode.id);
  return {
    queue,
    index,
    playing,
    positions: { ...player.positions, [episode.id]: player.positions[episode.id] ?? 0 },
    played,
  };
}

/** The loaded episode has been heard to its end: the next one starts, or the player empties. */
function finish(player: Player, episode: PodcastsEpisode, continuous: boolean): Player {
  const { [episode.id]: _heard, ...positions } = player.positions;
  const ended: Player = { ...player, positions, played: new Set(player.played).add(episode.id) };
  return continuous && player.index + 1 < player.queue.length
    ? load(ended, player.queue, player.index + 1, player.playing)
    : { ...ended, queue: [], index: 0, playing: false };
}

function reduce(player: Player, action: PlayerAction): Player {
  if (action.type === "play") return load(player, action.queue, action.index, true);
  const current = player.queue[player.index];
  if (!current) return player;
  if (action.type === "retain") {
    // The catalogue changed: every queued episode becomes the catalogue's record of it now.
    // Those the catalogue no longer holds leave the queue, and the player empties when the
    // loaded episode is one of them.
    const kept = player.queue.map((held) => action.find(held));
    if (kept.every((episode, at) => episode === player.queue[at])) return player;
    const loaded = kept[player.index];
    if (!loaded) return { ...player, queue: [], index: 0, playing: false };
    const before = kept.slice(0, player.index);
    const next: Player = {
      ...player,
      queue: kept.flatMap((episode) => (episode ? [episode] : [])),
      index: before.filter((episode) => episode !== undefined).length,
    };
    // A record that is now shorter than what has been heard of it has been heard to its end.
    return (next.positions[loaded.id] ?? 0) >= loaded.duration
      ? finish(next, loaded, action.continuous)
      : next;
  }
  const at = (seconds: number, continuous: boolean): Player =>
    seconds >= current.duration
      ? finish(player, current, continuous)
      : { ...player, positions: { ...player.positions, [current.id]: Math.max(0, seconds) } };
  switch (action.type) {
    case "toggle":
      return { ...player, playing: !player.playing };
    case "seek":
      return at(action.to, action.continuous);
    case "tick":
      return player.playing
        ? at((player.positions[current.id] ?? 0) + 1, action.continuous)
        : player;
  }
}

export interface PodcastsProps extends Omit<WindowProps, "children"> {
  /**
   * The catalogue's shows. Every show of the default catalogue is invented for the demo.
   * @default the eight shows of `defaultShows`
   */
  shows?: readonly PodcastsShow[];
  /**
   * The episodes of those shows.
   * @default the sixteen episodes of `defaultEpisodes`
   */
  episodes?: readonly PodcastsEpisode[];
  /**
   * The sidebar row selected at first.
   * @default "listen-now"
   */
  defaultSection?: PodcastsSection;
  /** Called with the sidebar row the user selects. */
  onSectionChange?: (section: PodcastsSection) => void;
  /**
   * The `id` of an episode that is loaded at first, paused at its start, as the Dark Aqua
   * screenshot shows the player. Without it nothing is loaded.
   */
  defaultEpisode?: string;
  /**
   * The volume at first, from 0 to 100. Nothing is played: the transport is simulated.
   * @default 100
   */
  defaultVolume?: number;
  /**
   * The sidebar's surface: the vibrant material, for a window over a desktop, or the same
   * surface as captured over a neutral window.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /**
   * The settings the Preferences window starts with.
   * @default the settings of the reference screenshots
   */
  defaultSettings?: PodcastsSettings;
  /** Whether the Preferences window is open, when the owner controls it. */
  preferencesOpen?: boolean;
  /**
   * Whether the Preferences window is open at first.
   * @default false
   */
  defaultPreferencesOpen?: boolean;
  /**
   * Called when the Preferences window is asked to open (Command-comma or Control-comma in
   * the window) or to close (its close button). A menu bar opens it with `preferencesOpen`.
   */
  onPreferencesOpenChange?: (open: boolean) => void;
  /**
   * The element the Preferences window is rendered into, over the Podcasts window.
   * @default the Podcasts window's offset parent, or the document's body
   */
  preferencesContainer?: HTMLElement | null;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /**
   * Called when the primary pointer button goes down on the playback bar or on the sidebar's
   * header, not on a control in them. Podcasts has no title bar: these are its drag region,
   * and a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /** Called when the drag region is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Podcasts, as in macOS 10.15 Catalina: a full-height sidebar with the window controls and a
 * search field, a playback bar with skip and play buttons, the now-playing display and the
 * volume, and a content pane of shelves, grids and lists of shows and episodes.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its drag region through the callbacks. Playback is
 * simulated: a clock advances the position, and no sound is produced.
 */
export function Podcasts({
  shows = defaultShows,
  episodes = defaultEpisodes,
  defaultSection = "listen-now",
  onSectionChange,
  defaultEpisode,
  defaultVolume = 100,
  material = "translucent",
  defaultSettings = DEFAULT_SETTINGS,
  defaultPreferencesOpen = false,
  ...props
}: PodcastsProps) {
  const [section, setSection] = useState<PodcastsSection>(defaultSection);
  const [query, setQuery] = useState("");
  const [showId, setShowId] = useState<string | null>(null);
  const [volume, setVolume] = useState(defaultVolume);
  const [panel, setPanel] = useState<"notes" | "queue" | null>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [subscribed, setSubscribed] = useState<ReadonlySet<string>>(
    () => new Set(shows.filter((show) => show.subscribed).map((show) => show.id)),
  );
  const [player, dispatch] = useReducer(reduce, null, (): Player => {
    const idle: Player = {
      queue: [],
      index: 0,
      playing: false,
      positions: {},
      played: new Set(episodes.filter((episode) => !episode.unplayed).map((episode) => episode.id)),
    };
    // An episode is loaded only when the catalogue holds its show.
    const first = episodes.find(
      (episode) => episode.id === defaultEpisode && shows.some((show) => show.id === episode.show),
    );
    return first ? load(idle, [first], 0, false) : idle;
  });
  // When the catalogue changes, the player takes the episodes it holds from the new one, and
  // drops those that have gone or whose show has gone.
  const [catalogue, setCatalogue] = useState({ shows, episodes });
  if (catalogue.shows !== shows || catalogue.episodes !== episodes) {
    setCatalogue({ shows, episodes });
    dispatch({
      type: "retain",
      continuous: settings.continuous,
      find: (held) =>
        episodes.find(
          (episode) => episode.id === held.id && shows.some((show) => show.id === episode.show),
        ),
    });
  }

  // The simulated transport: one second of the episode per second while it plays.
  const { continuous } = settings;
  useEffect(() => {
    if (!player.playing) return;
    const timer = setInterval(() => dispatch({ type: "tick", continuous }), 1000);
    return () => clearInterval(timer);
  }, [player.playing, continuous]);

  const current = player.queue[player.index] ?? null;
  const elapsed = current ? (player.positions[current.id] ?? 0) : 0;
  const showsById = useMemo(() => new Map(shows.map((show) => [show.id, show])), [shows]);
  const newestFirst = useMemo(
    () =>
      episodes
        .filter((episode) => showsById.has(episode.show))
        .sort((a, b) => b.published - a.published),
    [episodes, showsById],
  );
  const library: PodcastsLibrary = {
    showOf: (episode) => showsById.get(episode.show) ?? UNKNOWN_SHOW,
    positionOf: (episode) => player.positions[episode.id],
    isPlayed: (episode) => player.played.has(episode.id),
    current,
    playing: player.playing,
    onPlay: (queue, index) => dispatch({ type: "play", queue, index }),
    onToggle: () => dispatch({ type: "toggle" }),
  };
  const followed = newestFirst.filter((episode) => subscribed.has(episode.show));
  const unplayed = followed.filter((episode) => !player.played.has(episode.id));
  // Up Next: what is new and what has been started, of the shows the library follows.
  const upNext = unplayed.filter(
    (episode) => episode.isNew || player.positions[episode.id] !== undefined,
  );
  const shown = shows.find((show) => show.id === showId) ?? null;

  // Play with nothing loaded starts Up Next, or the newest episode of the library.
  const startable = upNext.length ? upNext : followed.length ? followed : newestFirst;
  const togglePlayback = () => {
    if (current) dispatch({ type: "toggle" });
    else dispatch({ type: "play", queue: startable, index: 0 });
  };
  const subscribe = (show: PodcastsShow) =>
    setSubscribed((now) => {
      const next = new Set(now);
      if (!next.delete(show.id)) next.add(show.id);
      return next;
    });
  const choose = (next: PodcastsSection) => {
    setSection(next);
    setQuery("");
    setShowId(null);
    onSectionChange?.(next);
  };

  const pick = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const show = showsById.get(id);
      return show ? [show] : [];
    });
  const openShow = (show: PodcastsShow) => setShowId(show.id);
  const searching = query.trim() !== "";
  const here = sectionName(section);

  let content: ReactNode;
  if (shown) {
    content = (
      <PodcastsPage title={null}>
        <ShowPage
          show={shown}
          episodes={newestFirst.filter((episode) => episode.show === shown.id)}
          library={library}
          subscribed={subscribed.has(shown.id)}
          onSubscribe={() => subscribe(shown)}
          origin={searching ? "Search" : here}
          onBack={() => setShowId(null)}
        />
      </PodcastsPage>
    );
  } else if (searching) {
    const foundShows = shows.filter((show) => showMatches(show, query));
    const foundEpisodes = newestFirst.filter((episode) => episodeMatches(episode, query));
    content =
      foundShows.length + foundEpisodes.length === 0 ? (
        <EmptyState role="status" className="mac-podcasts-main">
          No Results
        </EmptyState>
      ) : (
        <PodcastsPage title="Search">
          {foundShows.length > 0 ? (
            <ShowGrid title="Shows" shows={foundShows} onOpen={openShow} />
          ) : null}
          {foundEpisodes.length > 0 ? (
            <EpisodeList title="Episodes" episodes={foundEpisodes} library={library} />
          ) : null}
        </PodcastsPage>
      );
  } else if (section === "listen-now") {
    content = (
      <PodcastsPage title={here}>
        {upNext.length > 0 ? (
          <EpisodeShelf
            title="Up Next"
            episodes={upNext}
            library={library}
            action={<SectionAction onClick={() => choose("episodes")}>See All</SectionAction>}
          />
        ) : (
          <PodcastsNote>
            You are all caught up. New episodes of the shows you follow appear here.
          </PodcastsNote>
        )}
      </PodcastsPage>
    );
  } else if (section === "browse") {
    content = (
      <PodcastsPage title={here}>
        <ShowGrid title="Featured" shows={pick(FEATURED_SHOWS)} onOpen={openShow} shelf />
        <ShowGrid title="All Shows" shows={shows} onOpen={openShow} />
      </PodcastsPage>
    );
  } else if (section === "top-charts") {
    const top = pick(TOP_SHOWS);
    content = (
      <PodcastsPage title={here}>
        <ShowChart title="Top Shows" shows={top} subscribed={subscribed} onSubscribe={subscribe} />
        <EpisodeList
          title="Top Episodes"
          episodes={top.flatMap((show) => {
            const newest = newestFirst.find((episode) => episode.show === show.id);
            return newest ? [newest] : [];
          })}
          library={library}
        />
      </PodcastsPage>
    );
  } else if (section === "recently-updated" || section === "shows") {
    const mine = shows.filter((show) => subscribed.has(show.id));
    // A show without an episode has not been updated: it comes after every show with one.
    const order = (show: PodcastsShow) => {
      const newest = newestFirst.findIndex((episode) => episode.show === show.id);
      return newest < 0 ? newestFirst.length : newest;
    };
    const list =
      section === "shows"
        ? [...mine].sort((a, b) => a.title.localeCompare(b.title))
        : [...mine].sort((a, b) => order(a) - order(b));
    content = (
      <PodcastsPage title={here}>
        {list.length > 0 ? (
          <ShowGrid
            title={`${list.length} ${list.length === 1 ? "Show" : "Shows"}`}
            shows={list}
            onOpen={openShow}
          />
        ) : (
          <PodcastsNote>Shows you subscribe to appear here.</PodcastsNote>
        )}
      </PodcastsPage>
    );
  } else {
    // Downloaded: what the General preference keeps on this Mac, of the followed shows.
    const list =
      section === "episodes"
        ? followed
        : settings.download === "Never"
          ? []
          : settings.download === "Only New"
            ? unplayed.filter((episode) => episode.isNew)
            : unplayed;
    content = (
      <PodcastsPage title={here}>
        {list.length > 0 ? (
          <EpisodeList
            title={`${list.length} ${list.length === 1 ? "Episode" : "Episodes"}`}
            episodes={list}
            library={library}
          />
        ) : (
          <PodcastsNote>
            {section === "episodes"
              ? "Episodes of the shows you subscribe to appear here."
              : "No downloaded episodes. Preferences decide which episodes are downloaded."}
          </PodcastsNote>
        )}
      </PodcastsPage>
    );
  }

  const show = current ? library.showOf(current) : null;
  return (
    <PodcastsFrame
      {...props}
      material={material}
      settings={settings}
      onSettingsChange={setSettings}
      defaultPreferencesOpen={defaultPreferencesOpen}
      loading={false}
      section={section}
      onSectionChoose={choose}
      query={query}
      onQueryChange={(next) => {
        setQuery(next);
        setShowId(null);
      }}
      transport={{
        loaded:
          current && show
            ? {
                title: current.title,
                subtitle: `${show.title} — ${current.date}`,
                artwork: <ShowArtwork id={show.id} colors={show.colors} />,
                elapsed,
                duration: current.duration,
                onSeek: (to) => dispatch({ type: "seek", to, continuous }),
              }
            : null,
        playing: player.playing,
        canStart: startable.length > 0,
        onToggle: togglePlayback,
        onSkip: (by) => dispatch({ type: "seek", to: elapsed + by, continuous }),
      }}
      volume={volume}
      onVolumeSet={setVolume}
      panel={panel}
      onPanelChange={setPanel}
      panelContent={
        panel ? (
          <SidePanel
            kind={panel}
            library={library}
            upcoming={player.queue.slice(player.index + 1)}
          />
        ) : null
      }
      view={content}
    />
  );
}
