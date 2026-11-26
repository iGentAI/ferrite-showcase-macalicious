"use client";

import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";
import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EditorialCard } from "macalicious/editorial-card";
import { EmptyState } from "macalicious/empty-state";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { ShelfPager } from "macalicious/shelf-pager";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import {
  type CSSProperties,
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useDesktopDrop } from "../desktop/desktop-drag";
import {
  childrenOf,
  type DriveEntry,
  entryOf,
  inTrash,
  loadDrive,
  readFile,
  useDrive,
} from "../desktop/desktop-files";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import { LinkShareItems } from "../desktop/desktop-share-link";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import { onOpenFileRequest, showInFinder, takeOpenFileRequests } from "../finder/finder-open";
import { isMovie } from "../quicktime-player/quicktime-player-recents";
import { TvFrame, type TvFrameHostProps } from "./tv";
import {
  addAllToPlaylist,
  keepAllForLater,
  pickedAfter,
  queueAll,
  removePicked,
  removeTitle,
  type TvPicked,
} from "./tv-card-selection";
import type { TvSection, TvSettings } from "./tv-data";
import { defaultSettings, LIBRARY_CARD_WIDTH, SECTIONS } from "./tv-data";
import { readHomeVideo, subtitleFilesFor } from "./tv-home-player";
import { TvInfoSheet } from "./tv-info";
import {
  homeVideosMatching,
  isPlaylistFile,
  playlistFileName,
  playlistNameOfFile,
  readPlaylist,
  saveInDownloads,
  writeLibrary,
  writePlaylist,
} from "./tv-library-files";
import { PlaylistNameSheet } from "./tv-playlists";
import { PREFERENCES_WIDTH, NO_HELP as TV_NO_HELP, TvPreferences } from "./tv-preferences";
import {
  nextToPlay,
  TV_PREFERENCES_URL,
  TV_UNAVAILABLE_SETTINGS,
  tvSettingsFromServer,
  tvSettingsToServer,
  withChecked,
} from "./tv-settings";
import {
  addedByPerson,
  addPlaylist,
  addToPlaylist,
  admitHomeVideos,
  clearHistory,
  clockTime,
  continueWatching,
  deletePlaylist,
  droppedVideoId,
  emptyLibrary,
  FOR_EVERYONE,
  findVideo,
  finished,
  forgetHomeVideos,
  forgetPlace,
  genreChoices,
  genreNames,
  know,
  nextEpisodeId,
  nextVideoId,
  noNewHomeVideo,
  noNewPlaylist,
  noRoomForGenre,
  noRoomInPlaylist,
  OPEN_KIDS,
  OPEN_MOVIES,
  OPEN_SHOWS,
  opened,
  placed,
  placeHomeVideo,
  previousVideoId,
  queue,
  queueBefore,
  removeFromHistory,
  removeFromPlaylist,
  removeHomeVideo,
  renamePlaylist,
  searchLibrary,
  type TvLibraryState,
  type TvVideo,
  thumbnailUrl,
  toggleWatchLater,
  tvLibraryFromServer,
  tvLibraryReadable,
  tvLibraryToServer,
  unqueue,
  watchUrl,
  withGenre,
  youTubeVideoId,
} from "./tv-youtube-data";
import {
  SKIP_SECONDS,
  type TvPlayerControls,
  TvYouTubePlayer,
  VOLUME_STEP,
} from "./tv-youtube-player";
import { lookUpVideo, searchYouTube, TV_LIBRARY_URL, type TvSearch } from "./tv-youtube-server";

/** A box-less wrapper: a host that sizes its children leaves the Preferences their own size. */
const NO_BOX: CSSProperties = { display: "contents" };

/** Whether a drag is over the search field, which takes text itself. */
const fieldIsTarget = (event: DragEvent<HTMLElement>) =>
  event.target instanceof Element && event.target.closest("input") !== null;

/** An id no other playlist of the library has: the module takes `pl-` and letters and digits. */
const newPlaylistId = () =>
  `pl-${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 6).toString(36)}`;

/* The chevrons of a shelf, level with its cards, drawn while the pointer or focus is in it. */
const PAGER = { "--mac-shelf-pager-offset": "8px" } as CSSProperties;
const PAGER_AT_REST = {
  ...PAGER,
  "--mac-shelf-pager-chevron": "transparent",
  "--mac-shelf-pager-chevron-disabled": "transparent",
} as CSSProperties;

/** What the body shows: a section, one video's page, the player, or the player on a home video. */
type Page =
  | { type: "section" }
  | { type: "video"; id: string }
  | { type: "player"; id: string; start: number }
  | { type: "home"; id: string; start: number };

const SECTION: Page = { type: "section" };

/** A home video in the Library, with what the person's drive says of its file. */
interface ShownHomeVideo {
  entry: DriveEntry;
  title: string;
  place: number;
}

/** A file on its way into Home Videos: Open With plays it, and a drop or Import only adds it. */
interface ArrivingFile {
  id: string;
  name: string;
  play: boolean;
}

/** A file's name without its extension, as a video's title. */
const titleOfFile = (name: string) => name.replace(/\.[^.]+$/, "") || name;

/** The section shown last, which the window opens on: the desktop keeps it for the person. */
const TV_SECTION = "tv.section";
/** How many of the videos the person added the Library's first shelf shows. */
const RECENTLY_ADDED = 8;
const readSection = (stored: unknown): TvSection | undefined =>
  SECTIONS.find((item) => item.id === stored)?.id;

/** One row of the Controls menu, which its key also runs. */
interface Command {
  title: string;
  key?: string;
  enabled: boolean;
  run: () => void;
  /** Why it is dimmed, where the state alone does not say. */
  reason?: string;
  /** A key a text field or a slider keeps for itself while it has the keyboard. */
  text?: boolean;
}

/** A part of the window with a contextual menu of its own, laid out as if it were not there. */
function MenuArea({
  label,
  items,
  children,
}: {
  label: string;
  items: ReactNode;
  children: ReactNode;
}) {
  return (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-tv-menu-area">{children}</ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={label}>{items}</ContextualMenuPopup>
    </ContextualMenu>
  );
}

/** A shelf of cards, a page of `size` at a time, turned by the chevrons; a hero shows one. */
function Shelf({
  title,
  videos,
  size,
  onOpen,
  menu,
  items,
  action,
  hero = false,
  cardProps,
  dropProps,
}: {
  title: string;
  videos: readonly TvVideo[];
  size: number;
  onOpen: (video: TvVideo) => void;
  /** The menu of one of its cards. */
  menu: (video: TvVideo) => ReactNode;
  /** The menu of the shelf itself. */
  items: ReactNode;
  action?: ReactNode;
  hero?: boolean;
  /** What a card does when dragged, and when something is dragged onto it. */
  cardProps?: (video: TvVideo) => HTMLAttributes<HTMLElement>;
  /** What the shelf does when something is dragged onto it. */
  dropProps?: HTMLAttributes<HTMLDivElement>;
}) {
  const [page, setPage] = useState(0);
  // Two reasons to draw the chevrons, kept apart, as on the catalogue's shelves.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;
  const pages = Math.max(1, Math.ceil(videos.length / size));
  const shown = Math.min(page, pages - 1);
  const cards = videos.slice(shown * size, shown * size + size);
  return (
    <MenuArea label={title} items={items}>
      <ShelfPager
        previousLabel={`Previous in ${title}`}
        nextLabel={`More in ${title}`}
        previousDisabled={shown <= 0}
        nextDisabled={shown >= pages - 1}
        onPrevious={() => setPage(Math.max(0, shown - 1))}
        onNext={() => setPage(Math.min(pages - 1, shown + 1))}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        data-active={active ? "" : undefined}
        style={active ? PAGER : PAGER_AT_REST}
        {...dropProps}
      >
        <CardGrid title={title} action={action} separator={hero} columns={hero ? 1 : size}>
          {cards.map((video) =>
            hero ? (
              <MenuArea key={video.id} label={video.title} items={menu(video)}>
                <EditorialCard
                  variant="hero"
                  raised
                  render={<button type="button" />}
                  aria-label={video.title}
                  artwork={<Thumbnail id={video.id} size="hero" />}
                  onClick={() => onOpen(video)}
                />
              </MenuArea>
            ) : (
              <VideoCard
                key={video.id}
                video={video}
                onOpen={onOpen}
                menu={menu}
                cardProps={cardProps}
              />
            ),
          )}
        </CardGrid>
      </ShelfPager>
    </MenuArea>
  );
}

/** A video's YouTube thumbnail, filling a card's artwork box. */
function Thumbnail({ id, size }: { id: string; size?: "card" | "hero" }) {
  return (
    <img
      className="mac-tv-artwork"
      src={thumbnailUrl(id, size)}
      alt=""
      aria-hidden="true"
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
}

/** A card for a home video: the file's name, the place reached, and the video's menu. */
function HomeVideoCard({
  video,
  onPlay,
  items,
  cardProps,
}: {
  video: ShownHomeVideo;
  onPlay: () => void;
  items: ReactNode;
  cardProps?: HTMLAttributes<HTMLElement>;
}) {
  return (
    <MenuArea label={video.title} items={items}>
      <CardGridCard
        render={<button type="button" />}
        artwork={
          <div className="mac-tv-home-artwork">
            <svg width="32" height="32" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
            </svg>
          </div>
        }
        title={video.title}
        subtitle={video.place ? `Stopped at ${clockTime(video.place)}` : "Home Video"}
        onClick={onPlay}
        {...cardProps}
      />
    </MenuArea>
  );
}

/** A card with the video's thumbnail, title and channel, and the video's menu. */
function VideoCard({
  video,
  onOpen,
  menu,
  cardProps,
}: {
  video: TvVideo;
  onOpen: (video: TvVideo) => void;
  menu: (video: TvVideo) => ReactNode;
  cardProps?: (video: TvVideo) => HTMLAttributes<HTMLElement>;
}) {
  return (
    <MenuArea label={video.title} items={menu(video)}>
      <CardGridCard
        render={<button type="button" />}
        artwork={<Thumbnail id={video.id} />}
        title={video.title}
        subtitle={video.channel || "YouTube"}
        onClick={() => onOpen(video)}
        {...cardProps?.(video)}
      />
    </MenuArea>
  );
}

export interface TvYouTubeProps extends TvFrameHostProps {
  /**
   * The library at first, when the window keeps it in the page alone.
   * @default an empty library
   */
  defaultLibrary?: TvLibraryState;
  /**
   * Whether the library is kept by the desktop's Ferrite application and YouTube links and
   * searches are looked up through it.
   * @default whether the desktop app serves the page (`servedByDesktopApp()`)
   */
  served?: boolean;
  /**
   * The Preferences' settings, given by a page that keeps them itself. Served by the desktop's
   * Ferrite application, TV keeps them for the person on the server instead, and starts from
   * these. List Size sets how wide the Library's cards are, as in the catalogue window; the other
   * settings have no counterpart in a window of YouTube videos and are shown dimmed with why.
   * @default the reference screenshots' settings (`defaultSettings`)
   */
  settings?: Partial<TvSettings>;
  /**
   * Whether TV's Preferences window is open, for a page that opens it (TV > Preferences…); TV
   * renders it itself, over the middle of its window, in `preferencesContainer`.
   */
  preferencesOpen?: boolean;
  /** Whether the Preferences window is open at first, when `preferencesOpen` is not given. */
  defaultPreferencesOpen?: boolean;
  /** Called when TV opens its Preferences (Command-comma) or they close. */
  onPreferencesOpenChange?: (open: boolean) => void;
  /** Where the Preferences window is rendered: the window's own container when not given. */
  preferencesContainer?: HTMLElement | null;
}

/**
 * TV as the Ferrite desktop runs it: YouTube videos in the TV window. Paste a YouTube link into
 * the search field and press Return to play it; search YouTube when the desktop has a YouTube
 * key; open the Blender Foundation's open films from Movies and Kids. History, Up Next, Watch
 * Later, the place in every started video and the Preferences' List Size are the person's own,
 * kept by the desktop app. The desktop's Controls menu plays, pauses and skips in the player and
 * adds the video shown to Up Next or Watch Later.
 *
 * Videos are played by YouTube's embedded player (`tv-youtube-player.tsx`): nothing is
 * downloaded or kept but ids, titles and times.
 */
export function TvYouTube({
  defaultLibrary = emptyLibrary,
  served = servedByDesktopApp(),
  settings,
  preferencesOpen,
  defaultPreferencesOpen = false,
  onPreferencesOpenChange,
  preferencesContainer,
  onOpenPreferences,
  ref,
  ...frameProps
}: TvYouTubeProps) {
  const initialSettings: TvSettings = { ...defaultSettings, ...settings };
  // Served, the settings are the person's, read from the server.
  const [kept, setKept] = useState<TvSettings>(initialSettings);
  const [keptLoaded, setKeptLoaded] = useState(false);
  const settingsLoading = useServerState({
    url: TV_PREFERENCES_URL,
    enabled: served,
    value: kept,
    onLoad: (stored) => {
      const next = tvSettingsFromServer(stored, initialSettings);
      if (!next) return false;
      setKept(next);
      setKeptLoaded(true);
    },
    toBody: tvSettingsToServer,
  });
  const settingsUnreadable = served && !settingsLoading && !keptLoaded;
  // Elsewhere the page's settings, unless this window's own Preferences changed them since.
  const [edited, setEdited] = useState<TvSettings | null>(null);
  const shownSettings: TvSettings = served ? kept : (edited ?? initialSettings);
  const listSize = shownSettings.listSize;
  const libraryCardWidth = LIBRARY_CARD_WIDTH[listSize] ?? LIBRARY_CARD_WIDTH.medium;
  // The last section, kept for the person, is where a window opens: on the desktop, and until this
  // window has chosen one of its own.
  const [keptSection, keepSection] = useDesktopSetting<TvSection>(
    TV_SECTION,
    readSection,
    "watch-now",
  );
  const [chosenSection, setChosenSection] = useState<TvSection | null>(null);
  const section = chosenSection ?? (served ? keptSection : "watch-now");
  const setSection = (next: TvSection) => {
    setChosenSection(next);
    if (served) keepSection(next);
  };
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<Page>(SECTION);
  const [library, setLibrary] = useState<TvLibraryState>(defaultLibrary);
  // What looking up a pasted link found, by video id: the video, or why not.
  const [lookups, setLookups] = useState<Record<string, TvVideo | string>>({});
  const [found, setFound] = useState<{ query: string; result: TvSearch } | null>(null);
  // What the player's controls can do, for the Controls menu; `null` while no player is shown.
  const [controls, setControls] = useState<TvPlayerControls | null>(null);
  // Why the last thing dropped on the window was not taken.
  const [dropNote, setDropNote] = useState<string>();
  // The sheet that names a playlist: a new one, holding these videos, or one already made.
  const [naming, setNaming] = useState<
    | { kind: "new"; videos: readonly TvVideo[] }
    | { kind: "rename"; id: string; name: string }
    | null
  >(null);
  // The video Get Info is open on; a home video has no `video`, as the library knows only its file.
  const [info, setInfo] = useState<{ id: string; title: string; video?: TvVideo } | null>(null);
  // The genre the Library shows; `null` for all of it.
  const [chosenGenre, setChosenGenre] = useState<string | null>(null);
  // Whether File > Import… has its panel open.
  const [importing, setImporting] = useState(false);
  // Whether File > Library > Import Playlist… has its panel open.
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  // The cards chosen by Command-click and Shift-click, in one list; a section or page changing
  // leaves them.
  const [chosen, setPicked] = useState<TvPicked | null>(null);
  // Files Finder sent here or dropped on the window, waiting for the library to load: Open With
  // plays what it sent, and a drop only adds.
  const [arriving, setArriving] = useState<readonly ArrivingFile[]>([]);
  const drive = useDrive(served);
  const shownHomeVideos: ShownHomeVideo[] = library.homeVideos.flatMap(({ id, place }) => {
    const entry = drive ? entryOf(drive, id) : undefined;
    return drive && entry && !inTrash(drive, id)
      ? [{ entry, title: titleOfFile(entry.name), place }]
      : [];
  });
  /** The cards of a list that can be chosen from, as shown now. */
  const listIds = (list: string): readonly string[] => {
    if (list === "later") return library.watchLater;
    if (list === "history") return library.history.map(({ id }) => id);
    if (list === "upNext") return library.upNext;
    if (list === "home") {
      // Those the search shows, while it shows only some: a choice never takes a video out of sight.
      return homeVideosMatching(shownHomeVideos, query.trim()).map(({ entry }) => entry.id);
    }
    return library.playlists.find(({ id }) => `playlist:${id}` === list)?.videos ?? [];
  };
  // What is chosen, in the order its list shows now: a card that left the list is no longer chosen.
  const picked: TvPicked | null = chosen && {
    ...chosen,
    ids: listIds(chosen.list).filter((id) => chosen.ids.includes(id)),
  };
  useEffect(() => {
    if (!served) return;
    const asked = takeOpenFileRequests("tv");
    if (asked.length > 0) setArriving(asked.map(({ id, name }) => ({ id, name, play: true })));
    return onOpenFileRequest("tv", ({ id, name }) =>
      setArriving((queue) => [...queue, { id, name, play: true }]),
    );
  }, [served]);

  // The window's frame: the menu bar's Controls follows the window last used, and Preferences
  // open over its middle.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const frameRef = useCallback(
    (element: HTMLDivElement | null) => {
      setFrame(element);
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );
  const [ownOpen, setOwnOpen] = useState(defaultPreferencesOpen);
  const prefsOpen = preferencesOpen ?? ownOpen;
  const setPrefsOpen = (next: boolean) => {
    setOwnOpen(next);
    onPreferencesOpenChange?.(next);
  };
  const [anchor, setAnchor] = useState<{
    container: HTMLElement;
    left: number;
    top: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!prefsOpen || !frame) {
      setAnchor(null);
      return;
    }
    const page = frame.ownerDocument;
    const view = page.defaultView;
    const container =
      preferencesContainer ??
      (frame.offsetParent instanceof HTMLElement ? frame.offsetParent : null) ??
      page.body;
    // Placed against the container's containing block: the nearest positioned element around it.
    let block: HTMLElement | null = container;
    while (block && view?.getComputedStyle(block).position === "static") {
      block = block.parentElement;
    }
    const box = frame.getBoundingClientRect();
    const origin = block?.getBoundingClientRect();
    const left =
      block && origin
        ? box.left - origin.left - block.clientLeft + block.scrollLeft
        : box.left + (view?.scrollX ?? 0);
    const top =
      block && origin
        ? box.top - origin.top - block.clientTop + block.scrollTop
        : box.top + (view?.scrollY ?? 0);
    setAnchor({
      container,
      left: left + Math.max(0, (box.width - PREFERENCES_WIDTH) / 2),
      top: top + Math.min(96, box.height / 6),
    });
  }, [prefsOpen, frame, preferencesContainer]);

  const loading = useServerState({
    url: TV_LIBRARY_URL,
    enabled: served,
    value: library,
    onLoad: (stored) => {
      if (!tvLibraryReadable(stored)) return false;
      setLibrary(tvLibraryFromServer(stored) ?? emptyLibrary);
    },
    toBody: tvLibraryToServer,
  });

  const linked = youTubeVideoId(query);
  const words = linked ? "" : query.trim();

  // A pasted link: its title and channel from YouTube's oEmbed answer, through the desktop app.
  // The answer is kept by video id and merged into the library whenever it comes back, also after
  // the person has moved on: a video queued or kept before it arrived then gets its real title in
  // place of the placeholder (`know` lets a title replace a placeholder, never the reverse).
  useEffect(() => {
    if (!linked || !served || lookups[linked] !== undefined) return;
    void lookUpVideo(linked).then((answer) => {
      setLookups((now) => ({ ...now, [linked]: answer.ok ? answer.video : answer.reason }));
      if (answer.ok) {
        const found = answer.video;
        setLibrary((now) =>
          now.videos.some((video) => video.id === found.id) ? know(now, found) : now,
        );
      }
    });
  }, [linked, served, lookups]);

  // Words: YouTube's search, through the desktop app, once typing has paused.
  useEffect(() => {
    if (!words || !served || words.length > 100) return;
    let live = true;
    const timer = setTimeout(() => {
      void searchYouTube(words).then((result) => {
        if (live) setFound({ query: words, result });
      });
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [words, served]);

  /** The video `id`: the library's, unless it holds only the placeholder and YouTube's answer has
   * the real title; a built-in film; or the placeholder until YouTube has answered. */
  const videoOf = (id: string): TvVideo => {
    const pasted = lookups[id];
    const answered = typeof pasted === "object" ? pasted : undefined;
    const known = findVideo(library, id);
    if (known && !(answered && known.title === "YouTube video")) return known;
    return answered ?? known ?? { id, title: "YouTube video", channel: "" };
  };

  const open = (video: TvVideo) => {
    setLibrary((now) => know(now, video));
    setPage({ type: "video", id: video.id });
  };
  // A video asked for from Spotlight, once the library that names it has been read.
  const [askedVideo, setAskedVideo] = useState<string | null>(null);
  useOpenItemRequests("tv", ({ id }) => setAskedVideo(id));
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request or a read opens it.
  useEffect(() => {
    if (askedVideo === null || loading) return;
    setAskedVideo(null);
    const known = findVideo(library, askedVideo);
    if (known) open(known);
  }, [askedVideo, loading]);
  const play = (video: TvVideo, start = library.positions[video.id] ?? 0) => {
    setLibrary((now) => opened(now, video, Date.now()));
    setPage({ type: "player", id: video.id, start });
  };
  const showLibrary = () => {
    setSection("library");
    setPage(SECTION);
    setQuery("");
  };
  /** A file written to Downloads, with what became of it said over the page. */
  const saveFile = (save: () => Promise<string>) => {
    save().then(
      (name) => setDropNote(`Saved as “${name}” in Downloads.`),
      (error: unknown) =>
        setDropNote(
          `That could not be saved: ${error instanceof Error ? error.message : String(error)}`,
        ),
    );
  };
  const importPlaylistFile = (id: string, name: string) => {
    readFile(id)
      .then((blob) => blob.text())
      .then((text) => {
        const { videos, others } = readPlaylist(text);
        if (videos.length === 0) {
          setDropNote(`“${name}” links no YouTube video, so nothing was added.`);
          return;
        }
        setLibrary((now) => addPlaylist(now, newPlaylistId(), playlistNameOfFile(name), videos));
        showLibrary();
        setDropNote(
          others > 0
            ? `${others} of the entries in “${name}” are not YouTube videos and were left out.`
            : undefined,
        );
      })
      .catch((error: unknown) =>
        setDropNote(
          `“${name}” could not be read: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  };
  const importHomeVideos = (files: readonly ArrivingFile[]) => {
    const ids = files.map((file) => file.id);
    const { library: after, refused } = admitHomeVideos(library, ids);
    setLibrary((now) => admitHomeVideos(now, ids).library);
    showLibrary();
    if (refused.length > 0) {
      // The Library says which it has no room for, and nothing starts as though it had been added.
      const names = files
        .filter((file) => refused.includes(file.id))
        .map((file) => `“${file.name}”`);
      setDropNote(`${names.join(", ")} not added: ${noNewHomeVideo(after)}`);
      return;
    }
    setDropNote(undefined);
    const last = files.at(-1);
    if (last?.play) {
      const place = library.homeVideos.find((video) => video.id === last.id)?.place ?? 0;
      setPage({ type: "home", id: last.id, start: place });
    }
  };
  useEffect(() => {
    if (loading || arriving.length === 0) return;
    setArriving([]);
    importHomeVideos(arriving);
  });
  // A file deleted for good gives its place in the Library back. The page's copy of the drive can be
  // older than the library another browser saved, so only a new read of the drive says it is gone.
  const missingHomeVideos =
    drive && !loading
      ? library.homeVideos
          .map(({ id }) => id)
          .filter((id) => !entryOf(drive, id))
          .join(" ")
      : "";
  useEffect(() => {
    if (!missingHomeVideos) return;
    let live = true;
    void loadDrive().then(
      (fresh) => {
        if (!live) return;
        const gone = missingHomeVideos.split(" ").filter((id) => !entryOf(fresh, id));
        setLibrary((now) => forgetHomeVideos(now, gone));
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [missingHomeVideos]);
  /** What makes a card choosable in its list: a plain click still opens it. */
  const pickable = (list: string, id: string) => {
    const isPicked = picked?.list === list && picked.ids.includes(id);
    return {
      "aria-pressed": isPicked ? true : undefined,
      "data-tv-picked": isPicked ? "" : undefined,
      onClickCapture: (event: MouseEvent<HTMLElement>) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        setPicked((now) => pickedAfter(now, list, listIds(list), id, event.shiftKey));
      },
    };
  };
  /** The chosen cards, when the card of `list` is one of several: its menu acts on them all. */
  const severalWith = (id: string, list: string | undefined) =>
    picked?.list === list && picked && picked.ids.length > 1 && picked.ids.includes(id)
      ? picked
      : null;
  const removeChosen = () => {
    if (!picked) return;
    setLibrary((now) => removePicked(now, picked));
    setPicked(null);
  };
  const chosenName = (of: TvPicked) =>
    library.playlists.find((playlist) => `playlist:${playlist.id}` === of.list)?.name;
  const severalMenu = (several: TvPicked) => {
    const videos = several.ids.map(videoOf);
    return (
      <>
        <MenuItem onClick={() => setLibrary((now) => queueAll(now, videos, "next"))}>
          Play Next
        </MenuItem>
        <MenuItem onClick={() => setLibrary((now) => queueAll(now, videos, "last"))}>
          Add to Up Next
        </MenuItem>
        <MenuItem onClick={() => setLibrary((now) => keepAllForLater(now, videos))}>
          Add to Watch Later
        </MenuItem>
        <Submenu>
          <SubmenuTrigger>Add to Playlist</SubmenuTrigger>
          <SubmenuPopup>
            {library.playlists.map((each) => (
              <MenuItem
                key={each.id}
                onClick={() => {
                  setDropNote(addAllToPlaylist(library, each.id, videos).refusal);
                  setLibrary((now) => addAllToPlaylist(now, each.id, videos).library);
                }}
              >
                {each.name}
              </MenuItem>
            ))}
            {library.playlists.length > 0 ? <MenuSeparator /> : null}
            <MenuItem
              disabled={noNewPlaylist(library) !== undefined}
              title={noNewPlaylist(library)}
              onClick={() => setNaming({ kind: "new", videos })}
            >
              New Playlist…
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem onClick={removeChosen}>{removeTitle(several, chosenName(several))}</MenuItem>
      </>
    );
  };
  const homeVideoMenu = ({ entry, title, place }: ShownHomeVideo) => {
    const several = severalWith(entry.id, "home");
    return several ? (
      <MenuItem onClick={removeChosen}>{removeTitle(several)}</MenuItem>
    ) : (
      <>
        <MenuItem onClick={() => setPage({ type: "home", id: entry.id, start: place })}>
          {place ? `Resume from ${clockTime(place)}` : "Play"}
        </MenuItem>
        {place ? (
          <MenuItem onClick={() => setPage({ type: "home", id: entry.id, start: 0 })}>
            Play from Beginning
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem onClick={() => showInFinder({ id: entry.id })}>Show in Finder</MenuItem>
        <MenuItem onClick={() => setInfo({ id: entry.id, title })}>Get Info</MenuItem>
        <MenuSeparator />
        <MenuItem
          title={`“${title}” stays in your drive.`}
          onClick={() => setLibrary((now) => removeHomeVideo(now, entry.id))}
        >
          Remove from Library
        </MenuItem>
      </>
    );
  };
  /** A title of the Library, with its checkbox under it when Preferences show them. */
  const withCheckbox = (id: string, title: string, card: ReactNode) =>
    shownSettings.checkboxes ? (
      <div key={id} className="mac-tv-library-item">
        {card}
        <Checkbox
          checked={!shownSettings.unchecked?.includes(id)}
          onCheckedChange={(checked) => {
            if (served) setKept((now) => withChecked(now, id, checked));
            else setEdited(withChecked(shownSettings, id, checked));
          }}
        >
          {title}
        </Checkbox>
      </div>
    ) : (
      card
    );
  const homeVideoGrid = (videos: readonly ShownHomeVideo[]) => (
    <CardGrid title="Home Videos" minCardWidth={libraryCardWidth}>
      {videos.map((video) =>
        withCheckbox(
          video.entry.id,
          video.title,
          <HomeVideoCard
            key={video.entry.id}
            video={video}
            onPlay={() => setPage({ type: "home", id: video.entry.id, start: video.place })}
            items={homeVideoMenu(video)}
            cardProps={pickable("home", video.entry.id)}
          />,
        ),
      )}
    </CardGrid>
  );

  const videoMenu = (video: TvVideo, playlist?: string, list?: string) => {
    const several = severalWith(video.id, list);
    if (several) return severalMenu(several);
    const place = library.positions[video.id];
    const inHistory = library.history.some((entry) => entry.id === video.id);
    return (
      <>
        <MenuItem onClick={() => play(video)}>
          {place ? `Resume from ${clockTime(place)}` : "Play"}
        </MenuItem>
        {place ? <MenuItem onClick={() => play(video, 0)}>Play from Beginning</MenuItem> : null}
        <MenuItem onClick={() => open(video)}>Go to Video</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => setLibrary((now) => queue(now, video, "next"))}>
          Play Next
        </MenuItem>
        <MenuItem
          onClick={() =>
            setLibrary((now) =>
              now.upNext.includes(video.id) ? unqueue(now, video.id) : queue(now, video),
            )
          }
        >
          {library.upNext.includes(video.id) ? "Remove from Up Next" : "Add to Up Next"}
        </MenuItem>
        <MenuItem onClick={() => setLibrary((now) => toggleWatchLater(now, video))}>
          {library.watchLater.includes(video.id) ? "Remove from Watch Later" : "Add to Watch Later"}
        </MenuItem>
        <Submenu>
          <SubmenuTrigger>Add to Playlist</SubmenuTrigger>
          <SubmenuPopup>
            {library.playlists.map((each) => {
              const held = each.videos.includes(video.id);
              const full = noRoomInPlaylist(library, each.id, video.id);
              return (
                <MenuItem
                  key={each.id}
                  disabled={held || full !== undefined}
                  title={held ? "This video is in the playlist." : full}
                  onClick={() => setLibrary((now) => addToPlaylist(now, each.id, video))}
                >
                  {each.name}
                </MenuItem>
              );
            })}
            {library.playlists.length > 0 ? <MenuSeparator /> : null}
            <MenuItem
              disabled={noNewPlaylist(library) !== undefined}
              title={noNewPlaylist(library)}
              onClick={() => setNaming({ kind: "new", videos: [video] })}
            >
              New Playlist…
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        {playlist ? (
          <MenuItem
            onClick={() => setLibrary((now) => removeFromPlaylist(now, playlist, video.id))}
          >
            Remove from Playlist
          </MenuItem>
        ) : null}
        {inHistory || place ? <MenuSeparator /> : null}
        {place ? (
          <MenuItem onClick={() => setLibrary((now) => forgetPlace(now, video.id))}>
            Remove from Continue Watching
          </MenuItem>
        ) : null}
        {inHistory ? (
          <MenuItem onClick={() => setLibrary((now) => removeFromHistory(now, video.id))}>
            Remove from History
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Share</SubmenuTrigger>
          <SubmenuPopup>
            <LinkShareItems plain url={watchUrl(video.id)} title={video.title} from="tv" />
          </SubmenuPopup>
        </Submenu>
        <MenuItem onClick={() => setInfo({ id: video.id, title: video.title, video })}>
          Get Info
        </MenuItem>
      </>
    );
  };
  /** A shelf's menu: play its first video, queue them all, and what empties it, when it can be. */
  const shelfMenu = (videos: readonly TvVideo[], clear?: { title: string; run: () => void }) => {
    const first = videos[0];
    return (
      <>
        <MenuItem
          disabled={!first}
          onClick={() => {
            if (first) play(first);
          }}
        >
          Play
        </MenuItem>
        <MenuItem
          onClick={() =>
            setLibrary((now) => videos.reduce((held, video) => queue(held, video), now))
          }
        >
          Add All to Up Next
        </MenuItem>
        {clear ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={clear.run}>{clear.title}</MenuItem>
          </>
        ) : null}
      </>
    );
  };

  let content: ReactNode = null;
  let stage: ReactNode;
  let librarySidebar: ReactNode;
  // A card drags out as its YouTube link, which a text field or another app takes as it is.
  const dragging = useRef<TvVideo | null>(null);
  const dragCard = (video: TvVideo): HTMLAttributes<HTMLElement> => ({
    draggable: true,
    onDragStart: (event) => {
      dragging.current = video;
      const link = watchUrl(video.id);
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("text/uri-list", link);
      event.dataTransfer.setData("text/plain", link);
    },
    onDragEnd: () => {
      dragging.current = null;
    },
  });
  /** The video being dropped: the card dragged here, or the one a link from elsewhere names. */
  const droppedVideo = (data: DataTransfer): TvVideo | undefined => {
    const id = droppedVideoId(data.getData("text/uri-list"), data.getData("text/plain"));
    if (!id) return undefined;
    return dragging.current?.id === id ? dragging.current : videoOf(id);
  };
  const takesDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = dragging.current ? "move" : "copy";
  };
  /** What dropping a video on a list does; a drop that names none falls to the window. */
  const dropInto = (
    place: (now: TvLibraryState, video: TvVideo) => TvLibraryState,
    refusal?: (video: TvVideo) => string | undefined,
  ): HTMLAttributes<HTMLElement> => ({
    onDragOver: takesDrop,
    onDrop: (event) => {
      const video = droppedVideo(event.dataTransfer);
      if (!video) return;
      event.preventDefault();
      event.stopPropagation();
      const refused = refusal?.(video);
      setDropNote(refused);
      if (!refused) setLibrary((now) => place(now, video));
    },
  });
  const upNextCard = (video: TvVideo): HTMLAttributes<HTMLElement> => ({
    ...dragCard(video),
    ...dropInto((now, dropped) => queueBefore(now, dropped, video.id)),
    ...pickable("upNext", video.id),
  });
  const shownCard = dragCard;
  const empty = (text: string) => (
    <EmptyState role="status" className="mac-tv-empty">
      {text}
    </EmptyState>
  );
  const grid = (title: string, videos: readonly TvVideo[], action?: ReactNode) => (
    <CardGrid title={title} action={action} columns={4}>
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onOpen={open}
          menu={videoMenu}
          cardProps={shownCard}
        />
      ))}
    </CardGrid>
  );
  // The Library's grids: as many columns as fit cards of the List Size the Preferences chose.
  const libraryGrid = (
    title: string,
    videos: readonly TvVideo[],
    action?: ReactNode,
    drop?: HTMLAttributes<HTMLElement>,
    list?: string,
  ) => (
    <CardGrid title={title} action={action} minCardWidth={libraryCardWidth} {...drop}>
      {videos.map((video) =>
        withCheckbox(
          video.id,
          video.title,
          <VideoCard
            key={video.id}
            video={video}
            onOpen={open}
            menu={(each) => videoMenu(each, undefined, list)}
            cardProps={(each) => ({
              ...shownCard(each),
              ...(list ? pickable(list, each.id) : null),
            })}
          />,
        ),
      )}
    </CardGrid>
  );

  if (page.type === "home") {
    const shown = shownHomeVideos.find(({ entry }) => entry.id === page.id);
    stage = (
      <TvYouTubePlayer
        key={`home-${page.id}`}
        video={{ id: page.id, title: shown?.title ?? "Home Video", channel: "" }}
        start={page.start}
        readHome={readHomeVideo}
        homeSubtitles={
          drive && shown?.entry.parent
            ? subtitleFilesFor(childrenOf(drive, shown.entry.parent), shown.entry.name)
            : undefined
        }
        onControls={setControls}
        screenSaverWhilePaused={served && shownSettings.screenSaver}
        onProgress={(seconds, duration, playing) =>
          setLibrary((now) => placeHomeVideo(now, page.id, seconds, duration, playing))
        }
        onDetails={() => {}}
        onEnded={() => {
          setLibrary((now) => placeHomeVideo(now, page.id, 0, 0, false));
          setPage(SECTION);
        }}
        onDone={() => setPage(SECTION)}
      />
    );
  } else if (page.type === "player") {
    const video = videoOf(page.id);
    stage = (
      <TvYouTubePlayer
        key={video.id}
        video={video}
        start={page.start}
        inWatchLater={library.watchLater.includes(video.id)}
        onControls={setControls}
        screenSaverWhilePaused={served && shownSettings.screenSaver}
        onToggleWatchLater={() => setLibrary((now) => toggleWatchLater(now, video))}
        onProgress={(seconds, duration, playing) =>
          setLibrary((now) => placed(now, video.id, seconds, duration, playing))
        }
        onDetails={(title, channel) =>
          setLibrary((now) => know(now, { id: video.id, title, channel: channel || video.channel }))
        }
        onEnded={() => {
          const next =
            nextToPlay(library.upNext, video.id, shownSettings.unchecked) ??
            nextEpisodeId(video.id, shownSettings.unchecked);
          setLibrary((now) => finished(now, video.id));
          if (next) {
            const after = videoOf(next);
            setLibrary((now) => opened(unqueue(now, next), after, Date.now()));
            setPage({ type: "player", id: next, start: library.positions[next] ?? 0 });
          } else setPage({ type: "video", id: video.id });
        }}
        onDone={() => setPage({ type: "video", id: video.id })}
      />
    );
  } else if (page.type === "video") {
    const video = videoOf(page.id);
    const place = library.positions[video.id];
    const queued = library.upNext.includes(video.id);
    const later = library.watchLater.includes(video.id);
    const nextEpisode = nextEpisodeId(video.id);
    content = (
      <>
        <CardGrid
          title={video.title}
          action={
            <CardGridAction render={<button type="button" />} onClick={() => setPage(SECTION)}>
              Back
            </CardGridAction>
          }
          columns={2}
        >
          <CardGridCard artwork={<Thumbnail id={video.id} size="hero" />} />
        </CardGrid>
        <div className="mac-tv-about">
          <p className="mac-tv-summary">
            {video.channel ? `${video.channel} · YouTube` : "YouTube"}
          </p>
          <div className="mac-tv-actions">
            <PushButton onClick={() => play(video)}>
              {place ? `Resume from ${clockTime(place)}` : "Play"}
            </PushButton>
            {place ? (
              <PushButton onClick={() => play(video, 0)}>Play from Beginning</PushButton>
            ) : null}
            {nextEpisode ? (
              <PushButton onClick={() => setPage({ type: "video", id: nextEpisode })}>
                Next Episode
              </PushButton>
            ) : null}
            <PushButton
              onClick={() =>
                setLibrary((now) => (queued ? unqueue(now, video.id) : queue(now, video)))
              }
            >
              {queued ? "Remove from Up Next" : "Add to Up Next"}
            </PushButton>
            <PushButton onClick={() => setLibrary((now) => toggleWatchLater(now, video))}>
              {later ? "Remove from Watch Later" : "Add to Watch Later"}
            </PushButton>
            <Menu>
              <MenuTrigger render={<PushButton>Share</PushButton>} />
              <MenuPopup>
                <LinkShareItems plain url={watchUrl(video.id)} title={video.title} from="tv" />
              </MenuPopup>
            </Menu>
          </div>
        </div>
      </>
    );
  } else if (linked) {
    const lookup = lookups[linked];
    const video = videoOf(linked);
    content = (
      <>
        {grid("YouTube Link", [video])}
        <div className="mac-tv-about">
          {typeof lookup === "string" ? <Label color="secondary">{lookup}</Label> : null}
          <div className="mac-tv-actions">
            <PushButton onClick={() => play(video)}>Play</PushButton>
            <PushButton onClick={() => setLibrary((now) => queue(now, video))}>
              Add to Up Next
            </PushButton>
            <PushButton onClick={() => setLibrary((now) => toggleWatchLater(now, video))}>
              {library.watchLater.includes(video.id)
                ? "Remove from Watch Later"
                : "Add to Watch Later"}
            </PushButton>
          </div>
        </div>
      </>
    );
  } else if (words) {
    const mine = searchLibrary(library, words);
    const mineAtHome = homeVideosMatching(shownHomeVideos, words);
    const result = found?.query === words ? found.result : null;
    let youtube: ReactNode;
    if (!served) {
      youtube = empty(
        "Searching YouTube needs the desktop's server. Paste a YouTube link to play it.",
      );
    } else if (!result) {
      youtube = empty("Searching YouTube…");
    } else if (!result.ok) {
      youtube = empty(`YouTube could not be searched: ${result.reason}`);
    } else if (!result.available) {
      youtube = empty(
        "Searching YouTube needs a YouTube Data API key, which this desktop has not been given. Paste a YouTube link to play it.",
      );
    } else {
      youtube =
        result.results.length === 0
          ? empty("No Results on YouTube")
          : grid("YouTube", result.results);
    }
    content = (
      <>
        {mineAtHome.length > 0 ? homeVideoGrid(mineAtHome) : null}
        {mine.length > 0 ? grid("In Your Library", mine) : null}
        {youtube}
      </>
    );
  } else if (section === "watch-now") {
    const upNext = library.upNext.map(videoOf);
    const started = continueWatching(library);
    content = (
      <>
        <p className="mac-tv-hint">
          Paste a YouTube link into the search field and press Return to play it, or drop one on
          this window.
        </p>
        {settingsUnreadable ? (
          <p className="mac-tv-hint" role="alert">
            Your TV preferences could not be read, so a change made to them now is not kept.
          </p>
        ) : null}
        {upNext.length > 0 ? (
          <Shelf
            title="Up Next"
            videos={upNext}
            size={4}
            onOpen={open}
            menu={(each) => videoMenu(each, undefined, "upNext")}
            cardProps={upNextCard}
            dropProps={dropInto((now, dropped) => queueBefore(now, dropped, null))}
            items={shelfMenu(upNext, {
              title: "Clear Up Next",
              run: () => setLibrary((now) => ({ ...now, upNext: [] })),
            })}
          />
        ) : null}
        {started.length > 0 ? (
          <Shelf
            title="Continue Watching"
            videos={started}
            size={4}
            onOpen={open}
            menu={videoMenu}
            cardProps={dragCard}
            items={shelfMenu(started, {
              title: "Clear Continue Watching",
              run: () => setLibrary((now) => ({ ...now, positions: {} })),
            })}
          />
        ) : null}
        <Shelf
          title="Open Movies"
          videos={OPEN_MOVIES}
          size={1}
          onOpen={open}
          menu={videoMenu}
          items={shelfMenu(OPEN_MOVIES)}
          hero
        />
        <Shelf
          title="For Everyone"
          videos={FOR_EVERYONE}
          size={4}
          onOpen={open}
          menu={videoMenu}
          cardProps={dragCard}
          items={shelfMenu(FOR_EVERYONE)}
        />
      </>
    );
  } else if (section === "movies") {
    content = grid("Open Movies", OPEN_MOVIES);
  } else if (section === "kids") {
    content = grid("Kids", OPEN_KIDS);
  } else if (section === "tv-shows") {
    const added = addedByPerson(library);
    content = (
      <>
        {OPEN_SHOWS.map((show) => (
          <Shelf
            key={show.title}
            title={show.title}
            videos={show.episodes}
            size={4}
            onOpen={open}
            menu={videoMenu}
            cardProps={dragCard}
            items={shelfMenu(show.episodes)}
          />
        ))}
        {added.length > 0 ? grid("Added by You", added) : null}
      </>
    );
  } else {
    const later = library.watchLater.map(videoOf);
    const history = library.history.map((entry) => videoOf(entry.id));
    const recent = addedByPerson(library);
    const isShownHome = (id: string) => shownHomeVideos.some(({ entry }) => entry.id === id);
    const genres = genreNames(library, (id) => Boolean(findVideo(library, id)) || isShownHome(id));
    const genre = chosenGenre !== null && genres.includes(chosenGenre) ? chosenGenre : null;
    if (genres.length > 0) {
      librarySidebar = (
        <Sidebar
          aria-label="Library"
          material="opaque"
          className="mac-tv-sidebar"
          value={genre === null ? "all" : `genre:${genre}`}
          onValueChange={(value) =>
            setChosenGenre(value === "all" ? null : value.slice("genre:".length))
          }
        >
          <SidebarSection title="Library">
            <SidebarItem value="all" label="All Videos" />
          </SidebarSection>
          <SidebarSection title="Genres">
            {genres.map((name) => (
              <SidebarItem key={name} value={`genre:${name}`} label={name} />
            ))}
          </SidebarSection>
        </Sidebar>
      );
    }
    const inGenre = Object.keys(library.genres).filter((id) => library.genres[id] === genre);
    const genreVideos = inGenre.flatMap((id) => findVideo(library, id) ?? []);
    const genreHome = shownHomeVideos.filter(({ entry }) => inGenre.includes(entry.id));
    content =
      genre !== null ? (
        <>
          {genreVideos.length > 0 ? libraryGrid(genre, genreVideos) : null}
          {genreHome.length > 0 ? homeVideoGrid(genreHome) : null}
        </>
      ) : later.length === 0 &&
        history.length === 0 &&
        recent.length === 0 &&
        library.playlists.length === 0 &&
        shownHomeVideos.length === 0 ? (
        empty(genres.length > 0 ? "Choose a genre" : "Your library is empty")
      ) : (
        <>
          {recent.length > 0
            ? libraryGrid("Recently Added", recent.slice(0, RECENTLY_ADDED))
            : null}
          {shownHomeVideos.length > 0 ? homeVideoGrid(shownHomeVideos) : null}
          {library.playlists.map((playlist) => {
            const videos = playlist.videos.map(videoOf);
            return (
              <MenuArea
                key={playlist.id}
                label={playlist.name}
                items={
                  <>
                    {shelfMenu(videos)}
                    <MenuSeparator />
                    <MenuItem
                      onClick={() =>
                        setNaming({ kind: "rename", id: playlist.id, name: playlist.name })
                      }
                    >
                      Rename Playlist…
                    </MenuItem>
                    <MenuItem onClick={() => setLibrary((now) => deletePlaylist(now, playlist.id))}>
                      Delete Playlist
                    </MenuItem>
                  </>
                }
              >
                <div
                  data-playlist={playlist.id}
                  {...dropInto(
                    (now, dropped) => addToPlaylist(now, playlist.id, dropped),
                    (dropped) => noRoomInPlaylist(library, playlist.id, dropped.id),
                  )}
                >
                  <CardGrid title={playlist.name} minCardWidth={libraryCardWidth}>
                    {videos.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        onOpen={open}
                        menu={(each) => videoMenu(each, playlist.id, `playlist:${playlist.id}`)}
                        cardProps={(each) => ({
                          ...dragCard(each),
                          ...dropInto(
                            (now, dropped) => addToPlaylist(now, playlist.id, dropped, each.id),
                            (dropped) => noRoomInPlaylist(library, playlist.id, dropped.id),
                          ),
                          ...pickable(`playlist:${playlist.id}`, each.id),
                        })}
                      />
                    ))}
                  </CardGrid>
                  {videos.length === 0 ? (
                    <p className="mac-tv-hint">
                      Drag a video here, or choose Add to Playlist in its menu.
                    </p>
                  ) : null}
                </div>
              </MenuArea>
            );
          })}
          {later.length > 0 ? (
            <MenuArea
              label="Watch Later"
              items={shelfMenu(later, {
                title: "Clear Watch Later",
                run: () => setLibrary((now) => ({ ...now, watchLater: [] })),
              })}
            >
              {libraryGrid(
                "Watch Later",
                later,
                undefined,
                dropInto((now, dropped) =>
                  now.watchLater.includes(dropped.id) ? now : toggleWatchLater(now, dropped),
                ),
                "later",
              )}
            </MenuArea>
          ) : null}
          {history.length > 0 ? (
            <MenuArea
              label="History"
              items={shelfMenu(history, {
                title: "Clear History",
                run: () => setLibrary((now) => clearHistory(now)),
              })}
            >
              {libraryGrid(
                "History",
                history,
                <CardGridAction
                  render={<button type="button" />}
                  onClick={() => setLibrary((now) => clearHistory(now))}
                >
                  Clear History
                </CardGridAction>,
                undefined,
                "history",
              )}
            </MenuArea>
          ) : null}
        </>
      );
  }

  // The Controls menu of the desktop's menu bar, while this window is the one last used. In the
  // player, Play or Pause and the skips act on YouTube's player, and are dimmed while it is not
  // ready or has refused the video; on a video's page or a pasted link, Play opens the player.
  // Up Next and Watch Later act on the video shown.
  const shownId =
    page.type === "player" || page.type === "video"
      ? page.id
      : page.type === "section"
        ? linked
        : null;
  const shownVideo = shownId ? videoOf(shownId) : null;
  const inPlayer = page.type === "player" || page.type === "home";
  const playerReady = inPlayer && controls?.usable === true;
  const queuedShown = shownVideo ? library.upNext.includes(shownVideo.id) : false;
  const laterShown = shownVideo ? library.watchLater.includes(shownVideo.id) : false;
  const playingId = page.type === "player" ? page.id : null;
  const nextId = playingId ? nextVideoId(library, playingId) : undefined;
  const previousId = playingId ? previousVideoId(library, playingId) : undefined;
  const currentId = library.history[0]?.id;
  const switchTo = (id: string, from: string, forward: boolean) => {
    const queued = forward && library.upNext.includes(id);
    const video = videoOf(id);
    setLibrary((now) => {
      const left = forward ? unqueue(now, from) : now;
      return queued ? opened(unqueue(left, id), video, Date.now()) : left;
    });
    setPage({ type: "player", id, start: library.positions[id] ?? 0 });
  };
  const commands: Record<string, Command> = {
    find: {
      title: "Find",
      key: "command+f",
      enabled: true,
      run: () => {
        // A menu holds the keyboard until it closes: the field takes it after, within a few frames.
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
    selectAll: {
      title: "Select All",
      key: "command+a",
      text: true,
      enabled: (picked?.ids.length ?? 0) > 0,
      reason: "Command-click a video first: this chooses every video in its list.",
      run: () => {
        setPicked((now) => (now ? { ...now, ids: listIds(now.list) } : now));
        // A menu holds the keyboard until it closes: Escape and Delete then act on the window.
        let frames = 0;
        const take = () => {
          if (!document.querySelector('[role="menu"][data-open]'))
            frame?.focus({ preventScroll: true });
          if (document.activeElement !== frame && ++frames < 30) requestAnimationFrame(take);
        };
        take();
      },
    },
    newPlaylist: {
      title: "New Playlist…",
      key: "command+n",
      enabled: !loading && noNewPlaylist(library) === undefined,
      reason: noNewPlaylist(library),
      run: () => setNaming({ kind: "new", videos: [] }),
    },
    importVideo: {
      title: "Import…",
      key: "command+o",
      enabled: served && !loading && noNewHomeVideo(library) === undefined,
      reason: served
        ? noNewHomeVideo(library)
        : "Home videos come from your drive, which this page does not have.",
      run: () => setImporting(true),
    },
    getInfo: {
      title: "Get Info",
      key: "command+i",
      enabled: !loading && Boolean(shownVideo),
      reason: "Open a video first, or choose Get Info in a card's menu.",
      run: () => {
        if (shownVideo) {
          setInfo({ id: shownVideo.id, title: shownVideo.title, video: shownVideo });
        }
      },
    },
    showInFinder: {
      title: "Show in Finder",
      key: "shift+command+r",
      enabled: page.type === "home",
      reason: "Only a home video playing has a file to show.",
      run: () => {
        if (page.type === "home") showInFinder({ id: page.id });
      },
    },
    exportLibrary: {
      title: "Export Library…",
      enabled: served && !loading,
      reason: "Files go to your drive, which this page does not have.",
      run: () =>
        saveFile(() =>
          saveInDownloads(
            writeLibrary({
              homeVideos: shownHomeVideos.map(({ entry }) => entry.name),
              watchLater: library.watchLater.map(videoOf),
              upNext: library.upNext.map(videoOf),
              history: library.history.map(({ id }) => videoOf(id)),
              playlists: library.playlists.map(({ name, videos }) => ({
                name,
                videos: videos.map(videoOf),
              })),
            }),
            "TV Library.xml",
            "application/xml",
          ),
        ),
    },
    importPlaylist: {
      title: "Import Playlist…",
      enabled: served && !loading && noNewPlaylist(library) === undefined,
      reason: served
        ? noNewPlaylist(library)
        : "Playlist files come from your drive, which this page does not have.",
      run: () => setImportingPlaylist(true),
    },
    ...Object.fromEntries(
      SECTIONS.map((item, index) => [
        `section-${item.id}`,
        {
          title: item.name,
          key: `command+${index + 1}`,
          enabled: !loading,
          run: () => {
            setSection(item.id);
            setPage(SECTION);
            setQuery("");
          },
        },
      ]),
    ),
    play: {
      title: inPlayer && controls?.playing ? "Pause" : "Play",
      key: "space",
      text: true,
      enabled: !loading && (inPlayer ? playerReady : Boolean(shownVideo)),
      run: () => {
        if (inPlayer) controls?.toggle();
        else if (shownVideo) play(shownVideo);
      },
    },
    stop: {
      title: "Stop",
      key: "command+.",
      enabled: !loading && inPlayer,
      run: () => {
        if (page.type === "home") setPage(SECTION);
        else if (playingId) setPage({ type: "video", id: playingId });
      },
    },
    next: {
      title: "Next",
      key: "command+right",
      text: true,
      enabled: !loading && Boolean(nextId),
      run: () => {
        if (playingId && nextId) switchTo(nextId, playingId, true);
      },
    },
    previous: {
      title: "Previous",
      key: "command+left",
      text: true,
      enabled: !loading && Boolean(previousId),
      run: () => {
        if (playingId && previousId) switchTo(previousId, playingId, false);
      },
    },
    goToCurrent: {
      title: "Go to Current Video",
      key: "command+l",
      enabled: !loading && !inPlayer && Boolean(currentId),
      reason: inPlayer ? "The current video is already showing." : undefined,
      run: () => {
        if (currentId) setPage({ type: "video", id: currentId });
      },
    },
    skipBack: {
      title: `Skip Back ${SKIP_SECONDS} Seconds`,
      enabled: !loading && playerReady,
      run: () => controls?.skip(-SKIP_SECONDS),
    },
    skipForward: {
      title: `Skip Forward ${SKIP_SECONDS} Seconds`,
      enabled: !loading && playerReady,
      run: () => controls?.skip(SKIP_SECONDS),
    },
    volumeUp: {
      title: "Increase Volume",
      key: "command+up",
      text: true,
      enabled: !loading && playerReady && (controls?.volume ?? 100) < 100,
      run: () => controls?.changeVolume(VOLUME_STEP),
    },
    volumeDown: {
      title: "Decrease Volume",
      key: "command+down",
      text: true,
      enabled: !loading && playerReady && (controls?.volume ?? 0) > 0,
      run: () => controls?.changeVolume(-VOLUME_STEP),
    },
    mute: {
      title: controls?.muted ? "Unmute" : "Mute",
      key: "option+command+down",
      enabled: !loading && playerReady,
      run: () => controls?.toggleMute(),
    },
  };
  const row = (command: Command | undefined) =>
    command ? (
      <MenuItem
        key={command.title}
        // The menu's key column has no room for the word Space, which it would cut to "Sp".
        keyEquivalent={command.key === "space" ? undefined : command.key}
        disabled={!command.enabled}
        title={command.enabled ? undefined : command.reason}
        onClick={command.run}
      >
        {command.title}
      </MenuItem>
    ) : null;
  const onWindowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    frameProps.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (picked && !(event.target as Element).closest("input, textarea, [contenteditable]")) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPicked(null);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        removeChosen();
        return;
      }
    }
    const command = Object.values(commands).find(
      (each) => each.key && matchesMenuKeyEquivalent(event.nativeEvent, each.key),
    );
    if (!command?.enabled) return;
    const target = event.target as Element;
    if (command.text) {
      if (target.closest("input, textarea, [contenteditable], [role='slider']")) return;
      if (event.key === " " && target.closest("button, a")) return;
    }
    event.preventDefault();
    command.run();
  };
  const controlsMenu = (
    <>
      {row(commands.play)}
      {row(commands.stop)}
      {row(commands.next)}
      {row(commands.previous)}
      {row(commands.goToCurrent)}
      <MenuSeparator />
      {row(commands.skipBack)}
      {row(commands.skipForward)}
      <MenuSeparator />
      {row(commands.volumeUp)}
      {row(commands.volumeDown)}
      {row(commands.mute)}
      <MenuSeparator />
      {controls && controls.subtitles.length > 0 ? (
        <Submenu>
          <SubmenuTrigger>Subtitles</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={controls.subtitle}
              onValueChange={(value) => controls.chooseSubtitle(String(value))}
            >
              <MenuRadioItem value="">Off</MenuRadioItem>
              {controls.subtitles.map(({ id, label }) => (
                <MenuRadioItem key={id} value={id}>
                  {label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
      ) : (
        <MenuItem
          disabled
          title={
            inPlayer
              ? "This video offers no subtitles here. A home video's are a .vtt or .srt file of its name beside it."
              : "Play a video first."
          }
        >
          Subtitles
        </MenuItem>
      )}
      <MenuItem
        disabled
        title="A browser plays a file's first audio track, and YouTube its own: there is no other to choose."
      >
        Audio
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={loading || !shownVideo}
        onClick={() => {
          if (!shownVideo) return;
          setLibrary((now) =>
            now.upNext.includes(shownVideo.id)
              ? unqueue(now, shownVideo.id)
              : queue(now, shownVideo),
          );
        }}
      >
        {queuedShown ? "Remove from Up Next" : "Add to Up Next"}
      </MenuItem>
      <MenuItem
        disabled={loading || !shownVideo}
        onClick={() => {
          if (shownVideo) setLibrary((now) => toggleWatchLater(now, shownVideo));
        }}
      >
        {laterShown ? "Remove from Watch Later" : "Add to Watch Later"}
      </MenuItem>
    </>
  );
  useDesktopAppMenu("tv", "Controls", controlsMenu, frame);
  useDesktopAppMenu(
    "tv",
    "Dock",
    [commands.play, commands.next, commands.previous].map((command) =>
      command ? (
        <MenuItem key={command.title} disabled={!command.enabled} onClick={command.run}>
          {command.title}
        </MenuItem>
      ) : null,
    ),
    frame,
  );
  useDesktopAppMenu(
    "tv",
    "File",
    <>
      {row(commands.newPlaylist)}
      {row(commands.importVideo)}
      <Submenu>
        <SubmenuTrigger>Library</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled
            title="Home videos stay where they are in your drive: TV keeps no files of its own to organize."
          >
            Organize Library…
          </MenuItem>
          {row(commands.exportLibrary)}
          {row(commands.importPlaylist)}
          {library.playlists.length > 0 && served ? (
            <Submenu>
              <SubmenuTrigger>Export Playlist</SubmenuTrigger>
              <SubmenuPopup>
                {library.playlists.map((playlist) => (
                  <MenuItem
                    key={playlist.id}
                    onClick={() =>
                      saveFile(() =>
                        saveInDownloads(
                          writePlaylist(playlist.videos.map(videoOf)),
                          playlistFileName(playlist.name),
                          "audio/x-mpegurl",
                        ),
                      )
                    }
                  >
                    {playlist.name}
                  </MenuItem>
                ))}
              </SubmenuPopup>
            </Submenu>
          ) : (
            <MenuItem disabled title="No playlist has been made yet.">
              Export Playlist
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem disabled title="A video is listed once here: its link is what names it.">
            Show Duplicate Items
          </MenuItem>
          <MenuItem
            disabled
            title="There is no cloud library here: this desktop's server keeps yours."
          >
            Update Cloud Library
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      {row(commands.showInFinder)}
    </>,
    frame,
  );
  useDesktopAppMenu(
    "tv",
    "View",
    <>
      {SECTIONS.map((item) => row(commands[`section-${item.id}`]))}
      <MenuSeparator />
      <MenuItem disabled title="List Size is in Preferences, and it is the one option here.">
        Show View Options
      </MenuItem>
    </>,
    frame,
  );
  useDesktopAppMenu(
    "tv",
    "Edit",
    <>
      <MenuItem disabled title="TV has nothing here to undo." keyEquivalent="command+z">
        Undo
      </MenuItem>
      <MenuItem disabled title="TV has nothing here to redo." keyEquivalent="shift+command+z">
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
      {row(commands.selectAll)}
      <MenuSeparator />
      {row(commands.getInfo)}
      <MenuSeparator />
      {row(commands.find)}
    </>,
    frame,
  );
  useDesktopAppMenu(
    "tv",
    "Account",
    <MenuItem
      disabled
      title="This desktop's account is the one you signed in with: there is no Apple ID here."
    >
      Sign In…
    </MenuItem>,
    frame,
  );

  const busy = loading || settingsLoading;
  const dropRef = useDesktopDrop<HTMLDivElement>({
    enabled: served,
    accepts: (item) => item.kind === "file" && isMovie(item),
    onDrop: (items) =>
      setArriving((queue) => [
        ...queue,
        ...items.map(({ id, name }) => ({ id, name, play: false })),
      ]),
  });
  useEffect(() => dropRef(frame), [frame, dropRef]);
  // A page gone with the focus in it leaves the keyboard nowhere: the window takes it back.
  const shownPage = useRef(page);
  // biome-ignore lint/correctness/useExhaustiveDependencies: what is chosen goes when these change.
  useEffect(() => setPicked(null), [page, section, query]);
  const keyWindow = frameProps.state === "key";
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    if (keyWindow && document.activeElement === document.body) {
      frame?.focus({ preventScroll: true });
    }
  }, [page, keyWindow, frame]);
  return (
    <>
      <TvFrame
        section={section}
        onSelectSection={(next) => {
          setSection(next);
          setPage(SECTION);
          setQuery("");
          setDropNote(undefined);
        }}
        query={query}
        onQueryChange={(text) => {
          setQuery(text);
          setPage(SECTION);
          setDropNote(undefined);
        }}
        onSearchKeyDown={(event) => {
          if (event.key !== "Enter" || !linked) return;
          event.preventDefault();
          play(videoOf(linked));
        }}
        onOpenPreferences={() => {
          onOpenPreferences?.();
          setPrefsOpen(true);
        }}
        stage={stage}
        sidebar={librarySidebar}
        aria-busy={busy || undefined}
        inert={busy || prefsOpen || undefined}
        {...frameProps}
        onDragOver={(event) => {
          if (fieldIsTarget(event) || dragging.current) return;
          takesDrop(event);
        }}
        onDrop={(event) => {
          if (fieldIsTarget(event) || dragging.current) return;
          event.preventDefault();
          const video = droppedVideo(event.dataTransfer);
          if (!video) {
            setSection("watch-now");
            setQuery("");
            setPage(SECTION);
            setDropNote("TV takes a YouTube link. What you dropped is not one.");
            return;
          }
          setDropNote(undefined);
          setPage(SECTION);
          setQuery(watchUrl(video.id));
        }}
        tabIndex={-1}
        onKeyDown={onWindowKeyDown}
        ref={frameRef}
        state={prefsOpen && frameProps.state === "key" ? "main" : frameProps.state}
      >
        {dropNote ? (
          <p className="mac-tv-hint" role="alert">
            {dropNote}
          </p>
        ) : null}
        {content}
      </TvFrame>
      {importing
        ? createPortal(
            <div className="mac-tv-panel-layer">
              <DriveOpenPanel
                accept={isMovie}
                defaultFolder="movies"
                onOpen={(entry) => {
                  setImporting(false);
                  setArriving((queue) => [
                    ...queue,
                    { id: entry.id, name: entry.name, play: false },
                  ]);
                }}
                onCancel={() => setImporting(false)}
              />
            </div>,
            document.body,
          )
        : null}
      {importingPlaylist
        ? createPortal(
            <div className="mac-tv-panel-layer">
              <DriveOpenPanel
                accept={(entry) => isPlaylistFile(entry.name)}
                defaultFolder="downloads"
                onOpen={(entry) => {
                  setImportingPlaylist(false);
                  importPlaylistFile(entry.id, entry.name);
                }}
                onCancel={() => setImportingPlaylist(false)}
              />
            </div>,
            document.body,
          )
        : null}
      {info ? (
        <TvInfoSheet
          key={info.id}
          anchor={frame?.querySelector(".mac-title-bar") ?? null}
          title={info.title}
          kind={info.video ? info.video.channel || "YouTube" : "Home Video"}
          genre={library.genres[info.id] ?? ""}
          choices={genreChoices(library)}
          refusal={(text) =>
            noRoomForGenre(info.video ? know(library, info.video) : library, info.id, text)
          }
          onCancel={() => setInfo(null)}
          onSave={(text) => {
            setLibrary((now) => withGenre(info.video ? know(now, info.video) : now, info.id, text));
            setInfo(null);
          }}
        />
      ) : null}
      {naming ? (
        <PlaylistNameSheet
          anchor={frame?.querySelector(".mac-title-bar") ?? null}
          title={naming.kind === "new" ? "New Playlist" : "Rename Playlist"}
          action={naming.kind === "new" ? "Create" : "Rename"}
          initialName={naming.kind === "new" ? "Untitled Playlist" : naming.name}
          onCancel={() => setNaming(null)}
          onName={(name) => {
            setLibrary((now) =>
              naming.kind === "new"
                ? addPlaylist(now, newPlaylistId(), name, naming.videos)
                : renamePlaylist(now, naming.id, name),
            );
            setNaming(null);
            if (naming.kind === "new") {
              setSection("library");
              setPage(SECTION);
              setQuery("");
            }
          }}
        />
      ) : null}
      {prefsOpen && anchor
        ? createPortal(
            <div style={NO_BOX}>
              <TvPreferences
                state={frameProps.state}
                settings={shownSettings}
                unavailable={served ? TV_UNAVAILABLE_SETTINGS : undefined}
                helpUnavailable={served ? TV_NO_HELP : undefined}
                onSettingsChange={(next) => (served ? setKept(next) : setEdited(next))}
                onClose={() => setPrefsOpen(false)}
                style={{
                  position: "absolute",
                  left: anchor.left,
                  top: anchor.top,
                  zIndex: frameProps.style?.zIndex,
                }}
              />
            </div>,
            anchor.container,
          )
        : null}
    </>
  );
}
