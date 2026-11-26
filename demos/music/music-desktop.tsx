"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { cn } from "macalicious/lib/cn";
import { windowDragRegion } from "macalicious/lib/window-drag-region";
import {
  MediaAppChrome,
  MediaAppChromeBar,
  MediaAppChromeButton,
  MediaAppChromeControls,
  MediaAppChromeDisplay,
  MediaAppChromePane,
  MediaAppChromeSidebar,
  MediaAppChromeTransport,
  MediaAppChromeVolume,
} from "macalicious/media-app-chrome";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { NotificationBanner } from "macalicious/notification-banner";
import { NowPlayingLcd } from "macalicious/now-playing-lcd";
import { ProgressBar } from "macalicious/progress-bar";
import { PushButton } from "macalicious/push-button";
import { ScopeBar, ScopeBarButton, ScopeBarGroup, ScopeBarLabel } from "macalicious/scope-bar";
import { ScrollView } from "macalicious/scroll-view";
import { SearchField } from "macalicious/search-field";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { StatusBar } from "macalicious/status-bar";
import { TextField } from "macalicious/text-field";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  beginDesktopDrag,
  type DesktopDragItem,
  type DesktopDropTarget,
  fileItemsOfDrag,
  registerDropTarget,
} from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import {
  currentDrive,
  ensureDrive,
  readFile,
  runOps,
  SPECIAL_FOLDER_IDS,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { requestHelp } from "../desktop/desktop-help";
import { useKeptValue } from "../desktop/desktop-kept-value";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { readBoolean, readIds, useDesktopSetting } from "../desktop/desktop-personal";
import {
  CHANGED_ELSEWHERE,
  onSaveFailure,
  servedByDesktopApp,
  serverDocument,
  sessionFetch,
  useServerState,
} from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { type DocumentMerge, mergeDocuments } from "../desktop/document-merge";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  requestOpenFile,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { DEFAULT_PAGE_SETUP, type PageSetup } from "../textedit/textedit-drive";
import { readPageSetup, TextEditPageSetup } from "../textedit/textedit-sheets";
import { Music, type MusicProps } from "./music";
import { ArchiveBrowser } from "./music-archive";
import { AlbumCover, SectionIcon } from "./music-artwork";
import {
  audioGraphOf,
  EQ_OFF,
  equalizerForSong,
  type MusicAudioGraph,
  madeAudioGraph,
  readEqualizer,
} from "./music-audio";
import {
  type AlbumsChosen,
  albumsAfter,
  BROWSE_ALL,
  browseSongs,
  ColumnBrowser,
  NO_ALBUMS,
} from "./music-browser";
import {
  type LossyFormat,
  lossyVersion,
  streamAddress,
  streamTitle,
  wavOfSong,
} from "./music-convert";
import {
  albumMatches,
  defaultSettings as initialSettings,
  LIST_ROW_HEIGHT,
  type MusicAlbum,
  type MusicSection,
  type MusicTrack,
} from "./music-data";
import {
  addFailure,
  addSongFile,
  artworkReport,
  coverOfSongFile,
  forgetSongFile,
  lyricsOfSongFile,
  readSongFile,
  sharedAlbumArtwork,
  songFileProblem,
  songOfDriveFile,
  songsWantingArtwork,
} from "./music-drive";
import { EQUALIZER_SIZE, EqualizerWindow } from "./music-equalizer";
import {
  moveToFolder,
  PlaylistIcon,
  type PlaylistMenuActions,
  PlaylistRows,
  PlaylistSidebarMenu,
  songsInFolder,
  withoutFolder,
} from "./music-folders";
import {
  GENIUS_SIZE,
  GeniusControls,
  geniusName,
  geniusSongs,
  NO_GENIUS_LISTS,
  readGeniusLists,
} from "./music-genius";
import { applyLibraryChange, type LibraryStep, withInPlaylist, withLoved } from "./music-history";
import {
  HomeSharingSheet,
  SharedLibraryPane,
  sharedPlaceOf,
  sharedRow,
  useHomeSharing,
} from "./music-home-sharing";
import {
  duplicateSongs,
  fileNameOf,
  isPlaylistFile,
  matchEntries,
  playlistNameOf,
  playlistsHolding,
  printPage,
  readM3u,
  songListPage,
  writeLibraryXml,
  writeM3u,
} from "./music-library-files";
import {
  AlbumMenu,
  DEFAULT_COLUMNS,
  DEFAULT_SORT,
  ListHeader,
  RatingSubmenu,
  readSort,
  type SongAction,
  SongTable,
  sharedRating,
  songLink,
} from "./music-library-views";
import { useMusicMenus } from "./music-menus";
import { MINI_PLAYER_SIZE, MiniPlayer } from "./music-mini-player";
import { MusicOrganize, type OrganizeChoice, organizeLibrary } from "./music-organize";
import { MusicOutputButton, outputIdOf, readOutput, sendSoundTo } from "./music-output";
import {
  type LoadedSound,
  type MusicPlayer,
  musicPlayer,
  type PlaybackStore,
} from "./music-player";
import { MusicPreferences, PREFERENCES_WIDTH } from "./music-preferences";
import { RadioBrowser } from "./music-radio";
import {
  albumKey,
  albumsOf,
  artworkUrl,
  EMPTY_LIBRARY,
  fitsKeepalive,
  forgetHistory,
  keepLeftPlayback,
  type LibraryPlaylist,
  type LibrarySong,
  leftPlaybackToSend,
  libraryFromServer,
  libraryReadable,
  librarySize,
  libraryToServer,
  lyricsFromServer,
  MUSIC_LIBRARY_URL,
  MUSIC_LIMITS,
  MUSIC_LYRICS_URL,
  MUSIC_PLAYBACK_URL,
  type MusicLibraryState,
  type MusicLyrics,
  type MusicPlaybackState,
  newEpoch,
  playbackFromServer,
  playbackReadable,
  playbackToServer,
  type SmartPlaylist,
  takeLeftPlayback,
  tracksById,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
  uploadArtwork,
} from "./music-server";
import {
  MUSIC_PREFERENCES_URL,
  settingsFromServer,
  settingsToServer,
  UNAVAILABLE_SETTINGS,
} from "./music-settings";
import { writeSharingOn } from "./music-sharing";
import { type MusicShortcut, MusicShortcuts } from "./music-shortcuts";
import { smartSongs } from "./music-smart";
import { MusicSmartEditor, NEW_SMART } from "./music-smart-editor";
import { MusicSongInfo, type SongInfoChange } from "./music-song-info";
import { isSongFile } from "./music-tags";
import { MusicVideos } from "./music-videos";
import { MusicViewOptions } from "./music-view-options";
import { AlbumDetail, AlbumGrid, SidePanel } from "./music-views";
import { MusicVisualizer, readVisualizerDrawing, type VisualizerDrawing } from "./music-visualizer";
import "./music.tokens.css";
import "./music.css";
import "./music-desktop.css";

const FILL: CSSProperties = { height: "100%" };
const SOURCE_LIST = {
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-section-gap": "10px",
  "--mac-sidebar-label-gap": "5px",
  "--mac-sidebar-header-inset": "4px",
} as CSSProperties;

/** How many changes of the library Undo can take back. */
const UNDO_STEPS = 20;

/** The setting that keeps whether the sidebar is shown, with the person's desktop values. */
const MUSIC_SIDEBAR = "music.sidebarShown";
const MUSIC_EQUALIZER = "music.equalizer";
const MUSIC_OUTPUT = "music.output";
const MUSIC_COLUMNS = "music.columns";
const MUSIC_SORT = "music.sort";
const MUSIC_STATUS_BAR = "music.statusBar";

/** The sidebar hidden: the column keeps only the window controls, as the row of the search field. */
const SIDEBAR_HIDDEN = { "--mac-media-app-chrome-sidebar-width": "78px" } as CSSProperties;

/** The songs Copy or Cut last took, for a paste into a playlist in any Music window. */
let songClipboard: readonly string[] = [];
const clipboardListeners = new Set<() => void>();
const subscribeSongClipboard = (listener: () => void) => {
  clipboardListeners.add(listener);
  return () => {
    clipboardListeners.delete(listener);
  };
};
const readSongClipboard = () => songClipboard;
function setSongClipboard(ids: readonly string[]) {
  songClipboard = [...ids];
  for (const listener of clipboardListeners) listener();
}

/** The songs of the drag under way, when it began in Music. */
let draggedSongs: readonly string[] = [];

/** The drive files being added right now, across the page's Music windows. */
const addingDriveFiles = new Set<string>();

/** The sidebar row Loved Songs, as a place songs can be dragged to. */
const LOVED_ROW = "loved";

/** `songs` with `moved` taken out and put back before `before`, or at the end. */
export function movedBefore(
  songs: readonly string[],
  moved: readonly string[],
  before: string | null,
): string[] {
  if (before !== null && moved.includes(before)) return [...songs];
  const rest = songs.filter((id) => !moved.includes(id));
  const inOrder = songs.filter((id) => moved.includes(id));
  const at = before === null ? rest.length : rest.indexOf(before);
  return [...rest.slice(0, at), ...inOrder, ...rest.slice(at)];
}

/** How long Music's "song changes" notification stays, in ms. */
const BANNER_MS = 5_000;

/**
 * The stacking order of the MiniPlayer kept on top of all other windows (Preferences, Advanced):
 * above every window the desktop's window manager stacks, which counts up from 1 as windows come
 * forward, within the windows' own layer, so menus and the menu bar still cover it.
 */
const ON_TOP_Z_INDEX = 100_000;

/** The file types the Add to Library panel offers. */
const ACCEPT = "audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg,.oga,.opus";

/** Why the rows of Apple's services are dimmed in the sidebar. */
const NO_APPLE_MUSIC = "Apple Music is not part of this desktop; the Internet Archive is.";
const NO_ITUNES_STORE = "The iTunes Store is not part of this desktop.";

/** The places of the window on the Ferrite desktop. */
type Place =
  | "archive"
  | "radio"
  | "recently-added"
  | "artists"
  | "albums"
  | "songs"
  | "genres"
  | "composers"
  | "videos"
  | "downloaded"
  | "loved"
  | "recent"
  | "top"
  | `playlist:${string}`
  | `folder:${string}`;

const LIBRARY_ROWS: { id: Place; name: string; icon: MusicSection }[] = [
  { id: "recently-added", name: "Recently Added", icon: "recently-added" },
  { id: "artists", name: "Artists", icon: "artists" },
  { id: "albums", name: "Albums", icon: "albums" },
  { id: "songs", name: "Songs", icon: "songs" },
  { id: "genres", name: "Genres", icon: "albums" },
  { id: "composers", name: "Composers", icon: "albums" },
  { id: "videos", name: "Music Videos", icon: "songs" },
  { id: "downloaded", name: "Downloaded", icon: "songs" },
];

const MUSIC_PLACE = "music.place";

/** The place left open, kept by name. A list since gone turns to Songs once the library is read. */
const readPlace = (stored: unknown): Place | undefined =>
  typeof stored === "string" &&
  (/^(playlist|folder):./.test(stored) ||
    ["archive", "radio", "loved", "recent", "top"].includes(stored) ||
    LIBRARY_ROWS.some((row) => row.id === stored))
    ? (stored as Place)
    : undefined;

/** Shuffle and Repeat glyphs: original drawings in the transport's glyph colour. */
function ShuffleGlyph() {
  return (
    <svg
      viewBox="0 0 16 13"
      width="16"
      height="13"
      aria-hidden="true"
      className="mac-media-app-chrome-glyph"
    >
      <path
        d="M1 3.5h3c3.5 0 4.5 6 8 6h2M1 9.5h3c1.3 0 2.2-.8 3-1.9M9 5.4c.8-1.1 1.7-1.9 3-1.9h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M13 1.5 15.5 3.5 13 5.5zM13 7.5l2.5 2-2.5 2z" fill="currentColor" />
    </svg>
  );
}

function RepeatGlyph({ one }: { one: boolean }) {
  return (
    <svg
      viewBox="0 0 16 13"
      width="16"
      height="13"
      aria-hidden="true"
      className="mac-media-app-chrome-glyph"
    >
      <path
        d="M2 7V5.5A2 2 0 0 1 4 3.5h9M14 6v1.5a2 2 0 0 1-2 2H3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M12 1.5 14.5 3.5 12 5.5zM4 7.5 1.5 9.5 4 11.5z" fill="currentColor" />
      {one ? (
        <text x="8" y="8.6" fontSize="5.5" textAnchor="middle" fill="currentColor">
          1
        </text>
      ) : null}
    </svg>
  );
}

function MiniGlyph() {
  return (
    <svg
      viewBox="0 0 18 13"
      width="18"
      height="13"
      aria-hidden="true"
      className="mac-media-app-chrome-glyph"
    >
      <rect x="1" y="1.5" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" />
      <rect x="8.5" y="6.5" width="7" height="4" rx="0.8" fill="currentColor" />
    </svg>
  );
}

/** The page's one channel to the playback document, readable or not. */
let playbackStore: PlaybackStore | null = null;
function sharedPlaybackStore(player: MusicPlayer): PlaybackStore {
  if (playbackStore) return playbackStore;
  // Playback is the state of the player this page plays, whose queue, song and place go
  // together: the page's copy wins whole, unless the playback was forgotten elsewhere since the
  // page read it. Forgotten is stored as nothing, or stored under another epoch than the one this
  // page read (forgotten, then saved first by another page). The page then takes the forget up:
  // only its loaded song stays (`forgetHistory`), that is sent, and the player is told, so nothing
  // forgotten comes back from a page that had not seen it go and the page goes on saving.
  const merge: DocumentMerge = (base, mine, theirs) => {
    const own = (mine as { playback?: MusicPlaybackState | null }).playback;
    const stored = (theirs as { playback?: MusicPlaybackState | null }).playback;
    if (!own) return theirs;
    if (stored == null) {
      // Empty, and empty when this page's change was made too: never saved, so the page's copy
      // is the first. Empty now but held before: forgotten elsewhere.
      if ((base as { playback?: unknown } | null)?.playback == null) return mine;
      const epoch = newEpoch();
      queueMicrotask(() => player.forgotten(epoch));
      return { playback: forgetHistory(own, epoch) };
    }
    if (stored.epoch && stored.epoch !== own.epoch) {
      const epoch = stored.epoch;
      if (player.knowsEpoch(own.epoch)) {
        queueMicrotask(() => player.forgotten(epoch));
        return { playback: forgetHistory(own, epoch) };
      }
      // This page found the playback empty and named it itself; the name stored first is the
      // one, and the page's copy wins as it would.
      queueMicrotask(() => player.adoptEpoch(epoch));
      return { playback: { ...own, epoch } };
    }
    return mine;
  };
  const channel = serverDocument(MUSIC_PLAYBACK_URL, { merge });
  // Saved only after a load that could read it: an unreadable document is never saved over.
  let readable = false;
  // A playback this page found empty is named by this page, and that name counts as read only
  // once the server is seen to hold it: once a save of such a name has landed (the page's
  // revision moved on), the page reads the playback back once. The read becomes what the next
  // change is a change of, so whatever it finds is settled here, never left to a conflict that
  // would no longer come: the page's own name marks it read; an empty playback, or another name
  // the page has not taken up, is a forget made elsewhere since, which the player takes up. A
  // save that did not land, or a read that failed, leaves the name to be confirmed by the next
  // save.
  let confirming: string | null = null;
  const confirm = (epoch: string) => {
    if (confirming === epoch) return;
    confirming = epoch;
    const before = channel.revision();
    const retry = () => {
      if (confirming === epoch) confirming = null;
    };
    void channel.idle().then(async () => {
      if (channel.revision() === before) return retry();
      const reply = await channel.load();
      if (reply === undefined || !playbackReadable(reply)) return retry();
      const stored = (reply as { playback?: MusicPlaybackState | null }).playback;
      if (stored?.epoch === epoch) player.adoptEpoch(epoch);
      else if (stored == null) player.forgotten(newEpoch());
      else if (stored.epoch && !player.knowsEpoch(stored.epoch)) player.forgotten(stored.epoch);
    });
  };
  // The body the server is known to hold: set once the channel is idle after a save of it with no
  // failure heard for the playback since. A save as the page goes is skipped only for that body;
  // one still queued or on its way may be cancelled as the page unloads, so it is sent again.
  let confirmed: string | null = null;
  let handed: string | null = null;
  let failedSince = false;
  onSaveFailure((failure) => {
    if (failure.url === MUSIC_PLAYBACK_URL) failedSince = true;
  });
  // A page that comes back from the browser's back-forward cache reads the playback again: a save
  // it made as it went moved the revision on without its channel.
  if (typeof window !== "undefined") {
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && readable) void channel.load();
    });
  }
  playbackStore = {
    load: async () => {
      const reply = await channel.load();
      if (reply === undefined || !playbackReadable(reply)) return undefined;
      readable = true;
      const unsent = leftPlaybackToSend(takeLeftPlayback(), reply, channel.revision(), Date.now());
      if (!unsent) return playbackFromServer(reply);
      channel.save(unsent);
      return playbackFromServer({ ...(reply as object), ...unsent });
    },
    save: (playback) => {
      if (!readable) return;
      const body = playbackToServer(playback);
      const text = JSON.stringify(body);
      handed = text;
      failedSince = false;
      // Until this body is stored, the server may hold it or the one before or the one on its way:
      // nothing is known, so a save as the page goes is always sent.
      confirmed = null;
      channel.save(body);
      void channel.idle().then(() => {
        if (handed === text && !failedSince) confirmed = text;
      });
      if (playback.epoch && !player.knowsEpoch(playback.epoch)) confirm(playback.epoch);
    },
    // As the page goes, a `keepalive` request, which the browser lets outlive the page, on the
    // revision the channel last had; nothing when the server is known to hold this very playback.
    // Best effort: a refusal (a save of this page's that landed meanwhile, or a change elsewhere)
    // is left as it is, and a page kept by the back-forward cache sends it again as it next goes.
    // Browsers refuse a `keepalive` body over 64 KiB, so a larger one goes as a plain request.
    saveOnLeave: (playback) => {
      if (!readable) return;
      const body = playbackToServer(playback);
      const text = JSON.stringify(body);
      if (text === confirmed) return;
      confirmed = text;
      keepLeftPlayback({ text, rev: channel.revision(), at: Date.now() });
      const notKept = () => {
        if (confirmed === text) confirmed = null;
      };
      const sent = JSON.stringify({ ...body, rev: channel.revision() });
      void sessionFetch(MUSIC_PLAYBACK_URL, {
        method: "PUT",
        keepalive: fitsKeepalive(sent),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: sent,
      })
        .then((reply) => {
          if (!reply.ok) notKept();
        })
        .catch(notKept);
    },
  };
  return playbackStore;
}

/** Where a window that belongs to Music opens: over or beside its frame, in its container. */
function placeBeside(
  frame: HTMLElement,
  container: HTMLElement | null | undefined,
  width: number,
  where: "over" | "top-right",
) {
  const page = frame.ownerDocument;
  const view = page.defaultView;
  const host =
    container ??
    (frame.offsetParent instanceof HTMLElement ? frame.offsetParent : null) ??
    page.body;
  let block: HTMLElement | null = host;
  while (block && view?.getComputedStyle(block).position === "static") block = block.parentElement;
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
  return where === "over"
    ? {
        container: host,
        left: left + Math.max(0, (box.width - width) / 2),
        top: top + Math.min(64, box.height / 8),
      }
    : { container: host, left: Math.max(0, left + box.width - width - 20), top: top + 20 };
}

/**
 * The layer the MiniPlayer opens in. Not kept on top, it shares Music's own window (the window
 * manager's shell, which carries `data-window-id` and the window's place in the stack), so a
 * window brought forward covers it as it covers Music. Kept on top of all other windows
 * (Preferences, Advanced), it opens in the layer that holds every window's shell, above them all.
 */
function miniPlayerHost(
  frame: HTMLElement,
  container: HTMLElement | null | undefined,
  onTop: boolean,
): HTMLElement | null | undefined {
  if (!onTop) return container;
  return frame.closest<HTMLElement>("[data-window-id]")?.parentElement ?? container;
}

/**
 * How a change to the library meets a newer copy saved elsewhere: merged onto it
 * (`mergeDocuments`), unless the library was forgotten there. A change is then not applied to
 * nothing, which would make a library of the change's own fields alone, without its songs, that
 * the server refuses: the forgotten library stays forgotten, every window shows it, and the
 * person is told that the change was not kept.
 */
const mergeLibrary: DocumentMerge = (base, mine, theirs) => {
  const forgotten = (doc: object | null) =>
    doc === null || (doc as { library?: unknown }).library == null;
  return !forgotten(base) && forgotten(theirs) ? theirs : mergeDocuments(base, mine, theirs);
};

/** One upload of the Add to Library panel. */
interface Adding {
  name: string;
  number: number;
  total: number;
  fraction: number;
}

/**
 * Music on the Ferrite desktop, or the demo window everywhere else. Served by the
 * `macalicious-desktop` application it is a real player: songs added from the computer are
 * kept in the person's drive with their tags read, openly licensed music is browsed and played
 * from the Internet Archive, and the library, playlists, Loved, Up Next and history are kept on
 * the server for the person signed in.
 */
export function DesktopMusic(props: MusicProps) {
  return servedByDesktopApp() ? <FerriteMusic {...props} /> : <Music {...props} />;
}

function FerriteMusic({
  defaultVolume: _defaultVolume,
  albums: _albums,
  defaultSection: _defaultSection,
  onSectionChange,
  material = "translucent",
  defaultSettings = initialSettings,
  preferencesOpen,
  defaultPreferencesOpen = false,
  onPreferencesOpenChange,
  preferencesContainer,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state = "key",
  width = 1220,
  height = 720,
  className,
  ref,
  onKeyDown,
  ...props
}: MusicProps) {
  const player: MusicPlayer = musicPlayer();
  const playing = useSyncExternalStore(player.subscribe, player.getState, player.getState);
  const [library, setLibrary] = useState<MusicLibraryState>(EMPTY_LIBRARY);
  // Whether the person's library has been read: until then this window's empty library is not
  // the player's, so a second window opening does not stop a song another one plays.
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  // The same, for callbacks made once: nothing changes the library before it has been read,
  // or the read would replace the change.
  const loadedRef = useRef(false);
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const [problem, setProblem] = useState<string | null>(null);
  // Undo and Redo: the library before each change the person made in this window.
  const [undoStack, setUndoStack] = useState<readonly LibraryStep[]>([]);
  const [redoStack, setRedoStack] = useState<readonly LibraryStep[]>([]);
  const loading = useServerState({
    url: MUSIC_LIBRARY_URL,
    enabled: true,
    value: library,
    onLoad: (stored) => {
      if (!libraryReadable(stored)) return false;
      const next = libraryFromServer(stored) ?? EMPTY_LIBRARY;
      libraryRef.current = next;
      loadedRef.current = true;
      setLibrary(next);
      setLibraryLoaded(true);
    },
    toBody: libraryToServer,
    merge: mergeLibrary,
  });
  // Commands given before the library and the playback are read are not carried out, so the
  // window waits for both; a library that cannot be read keeps it waiting, and says so.
  const unreadable = !loading && !libraryLoaded;
  useEffect(() => {
    if (unreadable)
      setProblem("Your library could not be read. Open Music again to try once more.");
  }, [unreadable]);

  // The Preferences settings this desktop carries out are the person's, kept on the server; the
  // window waits for them too, so that a change made before they are read is not replaced.
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const settingsLoading = useServerState({
    url: MUSIC_PREFERENCES_URL,
    enabled: true,
    value: settings,
    onLoad: (stored) => {
      const next = settingsFromServer(stored, defaultSettings);
      if (!next) return false;
      setSettings(next);
      setSettingsLoaded(true);
    },
    toBody: settingsToServer,
  });
  const settingsUnreadable = !settingsLoading && !settingsLoaded;
  useEffect(() => {
    if (settingsUnreadable)
      setProblem(
        "Your Music preferences could not be read; changes made to them now are not kept.",
      );
  }, [settingsUnreadable]);
  const busy = !libraryLoaded || !playing.restored || settingsLoading;

  // The lyrics typed in Song Info. They do not hold the window up: a song's lyrics show once read.
  const [lyrics, setLyrics] = useState<MusicLyrics>({});
  useServerState({
    url: MUSIC_LYRICS_URL,
    enabled: true,
    value: lyrics,
    onLoad: (stored) => {
      const next = lyricsFromServer(stored);
      if (!next) return false;
      setLyrics(next);
    },
    toBody: (value) => ({ lyrics: value }),
  });
  const [fileLyrics, setFileLyrics] = useState<Readonly<Record<string, string>>>({});

  /** Replace the library, unless the result would not fit what the server keeps. */
  const commit = useCallback((change: (now: MusicLibraryState) => MusicLibraryState) => {
    if (!loadedRef.current) {
      setProblem("Your library is still loading; try again in a moment.");
      return false;
    }
    const next = change(libraryRef.current);
    if (next.songs.length > MUSIC_LIMITS.songs) {
      setProblem(`Music keeps at most ${MUSIC_LIMITS.songs} songs.`);
      return false;
    }
    if (librarySize(next) > MUSIC_LIMITS.libraryBytes) {
      setProblem("The library is too large to save; delete some songs first.");
      return false;
    }
    libraryRef.current = next;
    setLibrary(next);
    return true;
  }, []);
  /** `commit`, for a change Undo can take back. */
  const commitUndoable = useCallback(
    (change: (now: MusicLibraryState) => MusicLibraryState) => {
      const before = libraryRef.current;
      if (!commit(change)) return false;
      if (libraryRef.current !== before) {
        const after = libraryRef.current;
        setUndoStack((stack) => [...stack, { before, after }].slice(-UNDO_STEPS));
        setRedoStack([]);
      }
      return true;
    },
    [commit],
  );

  // Files on their way to the Trash go once the library is saved without their songs: the render
  // that removed them has given the save (`useServerState`'s effect runs before this one). A save
  // that fails leaves them in Music, where the library that is still stored finds them.
  const [trashing, setTrashing] = useState<readonly string[] | null>(null);
  useEffect(() => {
    if (!trashing) return;
    setTrashing(null);
    let failed = false;
    const stop = onSaveFailure((failure) => {
      if (failure.url === MUSIC_LIBRARY_URL) failed = true;
    });
    void (async () => {
      const channel = serverDocument(MUSIC_LIBRARY_URL);
      await channel.idle();
      stop();
      if (failed) {
        setProblem("Your library could not be saved, so the files stay in Music on your drive.");
        return;
      }
      // What is stored now decides: a file another window's song names since stays out of the Trash.
      const reply = await channel.load();
      const stored =
        reply !== undefined && libraryReadable(reply) ? libraryFromServer(reply) : undefined;
      if (!stored) {
        setProblem("Your library could not be read, so the files stay in Music on your drive.");
        return;
      }
      const named = new Set(
        stored.songs.flatMap((song) => (song.source.kind === "file" ? [song.source.file] : [])),
      );
      const free = trashing.filter((id) => !named.has(id));
      if (free.length === 0) return;
      try {
        await runOps(free.map((id) => ({ op: "trash" as const, id })));
      } catch {
        setProblem("The songs left your library, but their files could not be moved to the Trash.");
        return;
      }
      // Another window may have named a file again while it was going: it comes back out.
      const later = await channel.load();
      if (later === undefined || !libraryReadable(later)) return;
      const namedAgain = new Set(
        (libraryFromServer(later)?.songs ?? []).flatMap((song) =>
          song.source.kind === "file" ? [song.source.file] : [],
        ),
      );
      const wanted = free.filter((id) => namedAgain.has(id));
      if (wanted.length === 0) return;
      await runOps(wanted.map((id) => ({ op: "restore" as const, id }))).catch(() =>
        setProblem(
          "A song another window added names a file that went to the Trash. Put it back from the Trash.",
        ),
      );
    })();
  }, [trashing]);

  // Internet Archive songs played without being added are the player's own guests, kept with
  // the playback; the library is what the player looks songs up in first.
  useEffect(() => {
    if (libraryLoaded) player.setLibrary(library.songs);
  }, [player, library.songs, libraryLoaded]);
  const homeSharing = useHomeSharing(player, setProblem);
  const known = useMemo(() => {
    const ids = new Set(library.songs.map((song) => song.id));
    return [
      ...library.songs,
      ...playing.guests.filter((song) => !ids.has(song.id)),
      ...homeSharing.songs,
    ];
  }, [library.songs, playing.guests, homeSharing.songs]);

  const readSharedOrOwn = homeSharing.readFile;
  useEffect(() => {
    player.setReadFile((file) => readSharedOrOwn(file, readSongFile));
  }, [player, readSharedOrOwn]);
  useEffect(() => {
    const detach = player.attach();
    void player.connect(sharedPlaybackStore(player));
    return detach;
  }, [player]);

  // A change that met the library or the playback forgotten in another window or browser is
  // told, not hidden: the window then shows what is stored, and goes on saving from there.
  useEffect(
    () =>
      onSaveFailure((failure) => {
        if (failure.url === MUSIC_LIBRARY_URL && failure.reason === CHANGED_ELSEWHERE)
          setProblem(
            "Your library was forgotten in another window or browser, so your last change to it was not kept.",
          );
      }),
    [],
  );
  useEffect(
    () =>
      player.onForgotten(() =>
        setProblem(
          "Your playback was forgotten in another window or browser. Music keeps the song that is loaded and starts Up Next and Recently Played afresh.",
        ),
      ),
    [player],
  );
  // A song that cannot play says why in full, where the window tells its problems (the display
  // has room for little of it); the banner goes once the song plays again.
  const shownError = useRef<string | null>(null);
  useEffect(() => {
    const before = shownError.current;
    shownError.current = playing.error;
    if (playing.error) setProblem(playing.error);
    else if (before) setProblem((now) => (now === before ? null : now));
  }, [playing.error]);

  const [place, setPlace] = useDesktopSetting<Place>(MUSIC_PLACE, readPlace, "albums");
  useEffect(() => {
    if (!libraryLoaded) return;
    const gone = place.startsWith("playlist:")
      ? !library.playlists.some((list) => `playlist:${list.id}` === place)
      : place.startsWith("folder:") &&
        !(library.folders ?? []).some((folder) => `folder:${folder.id}` === place);
    if (gone) setPlace("songs");
  }, [libraryLoaded, library.playlists, library.folders, place, setPlace]);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [albumsChosen, setAlbumsChosen] = useState<AlbumsChosen>(NO_ALBUMS);
  const [columnBrowser, setColumnBrowser] = useDesktopSetting(
    "music.columnBrowser",
    readBoolean,
    false,
  );
  const [onlyDownloaded, setOnlyDownloaded] = useDesktopSetting(
    "music.onlyDownloaded",
    readBoolean,
    false,
  );
  const [organizing, setOrganizing] = useState(false);
  const [browserChoice, setBrowserChoice] = useState(BROWSE_ALL);
  const [pickingPlaylist, setPickingPlaylist] = useState(false);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [reveal, setReveal] = useState<{ id: string } | null>(null);
  const [asking, setAsking] = useState<readonly string[] | null>(null);
  const [askingFolder, setAskingFolder] = useState<string | null>(null);
  const [smartEditing, setSmartEditing] = useState<{
    playlist: string | null;
    folder: string | null;
    smart: SmartPlaylist;
  } | null>(null);
  const [renamingPlace, setRenamingPlace] = useState<Place | null>(null);
  const [infoFor, setInfoFor] = useState<readonly string[] | null>(null);
  const [frameElement, setFrameElement] = useState<HTMLDivElement | null>(null);
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(null);
  const search = useRef<HTMLDivElement | null>(null);
  const [sidebarShown, setSidebarShown] = useDesktopSetting(MUSIC_SIDEBAR, readBoolean, true);
  const [query, setQuery] = useState("");
  const [archiveSearch, setArchiveSearch] = useState({ query: "", asked: 0 });
  /** Show the Internet Archive search for `words`: every submission searches again, the same
   * words too. */
  const searchArchive = (words: string) =>
    setArchiveSearch((now) => ({ query: words, asked: now.asked + 1 }));
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"lyrics" | "up-next" | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const frameRef = useCallback(
    (element: HTMLDivElement | null) => {
      frame.current = element;
      setFrameElement(element);
      if (typeof ref === "function") return ref(element);
      if (ref) ref.current = element;
    },
    [ref],
  );
  const rowHeight = LIST_ROW_HEIGHT[settings.listSize];

  const albums = useMemo(
    () =>
      albumsOf(
        onlyDownloaded
          ? { ...library, songs: library.songs.filter((song) => song.source.kind === "file") }
          : library,
        Date.now(),
      ),
    [library, onlyDownloaded],
  );
  const tracks = useMemo(
    () => tracksById(albumsOf({ ...library, songs: known }, Date.now())),
    [library, known],
  );
  const byId = useMemo(() => new Map(known.map((song) => [song.id, song])), [known]);
  const loved = useMemo(() => new Set(library.loved), [library.loved]);
  const libraryIds = useMemo(() => new Set(library.songs.map((song) => song.id)), [library.songs]);
  const current = player.current();
  const currentTrack = current ? tracks.get(current.id) : undefined;
  // Up Next as shown, each row with its own place in the queue: a song deleted meanwhile is
  // not shown, and a row chosen plays the very song it shows.
  const upNext = useMemo(
    () =>
      playing.queue.flatMap((id, index) => {
        const track = index > playing.index ? tracks.get(id) : undefined;
        return track ? [{ track, index }] : [];
      }),
    [playing.queue, playing.index, tracks],
  );
  const upcoming = useMemo(() => upNext.map((entry) => entry.track), [upNext]);
  const history = useMemo(
    () => playing.recent.flatMap((id) => tracks.get(id) ?? []),
    [playing.recent, tracks],
  );
  // Lyrics typed in Song Info come first; else what the song's file says, read when asked for.
  const lyricsOf = useCallback(
    (song: LibrarySong | undefined) => (song ? (lyrics[song.id] ?? fileLyrics[song.id] ?? "") : ""),
    [lyrics, fileLyrics],
  );
  const askLyrics = useCallback(
    (song: LibrarySong | undefined) => {
      if (song?.source.kind !== "file" || player.isBorrowed(song.id)) return;
      const { id } = song;
      void lyricsOfSongFile(song.source.file).then(
        (text) => setFileLyrics((now) => (now[id] === text ? now : { ...now, [id]: text })),
        () => {},
      );
    },
    [player],
  );
  const infoSong = infoFor?.length === 1 ? byId.get(infoFor[0] ?? "") : undefined;
  useEffect(() => {
    if (panel === "lyrics") askLyrics(current);
    askLyrics(infoSong);
  }, [panel, current, infoSong, askLyrics]);

  // ---- Preferences, the MiniPlayer and the song-change notification -----------------------

  const copiedSongs = useSyncExternalStore(
    subscribeSongClipboard,
    readSongClipboard,
    readSongClipboard,
  );
  const [ownOpen, setOwnOpen] = useState(defaultPreferencesOpen);
  const open = preferencesOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (preferencesOpen === undefined) setOwnOpen(next);
    onPreferencesOpenChange?.(next);
  };
  const [prefsAt, setPrefsAt] = useState<ReturnType<typeof placeBeside> | null>(null);
  useEffect(() => {
    if (!open || !frame.current) {
      setPrefsAt(null);
      return;
    }
    setPrefsAt(placeBeside(frame.current, preferencesContainer, PREFERENCES_WIDTH, "over"));
  }, [open, preferencesContainer]);

  const [mini, setMini] = useState<ReturnType<typeof placeBeside> | null>(null);
  const onTop = settings.miniPlayerOnTop;
  const placeMini = (element: HTMLElement) =>
    placeBeside(
      element,
      miniPlayerHost(element, preferencesContainer, onTop),
      MINI_PLAYER_SIZE.width,
      "top-right",
    );
  const toggleMini = () =>
    setMini((now) => (now || !frame.current ? null : placeMini(frame.current)));
  const [equalizer, setEqualizer] = useDesktopSetting(MUSIC_EQUALIZER, readEqualizer, EQ_OFF);
  const [equalizerAt, setEqualizerAt] = useState<ReturnType<typeof placeBeside> | null>(null);
  const toggleEqualizer = () =>
    setEqualizerAt((now) =>
      now || !frame.current
        ? null
        : placeBeside(
            frame.current,
            miniPlayerHost(frame.current, preferencesContainer, false),
            EQUALIZER_SIZE.width,
            "top-right",
          ),
    );
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [columns, setColumns] = useDesktopSetting(MUSIC_COLUMNS, readIds, DEFAULT_COLUMNS);
  const [songSort, setSongSort] = useDesktopSetting(MUSIC_SORT, readSort, DEFAULT_SORT);
  const [statusBarShown, setStatusBarShown] = useDesktopSetting(
    MUSIC_STATUS_BAR,
    readBoolean,
    false,
  );
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [askingHomeSharing, setAskingHomeSharing] = useState(false);
  const [settingUpPage, setSettingUpPage] = useState(false);
  const [pageSetup, setPageSetup] = useDesktopSetting<PageSetup>(
    "music.pageSetup",
    readPageSetup,
    DEFAULT_PAGE_SETUP,
  );
  const [streamTyped, setStreamTyped] = useState("");
  const [streamToPlay, setStreamToPlay] = useState<string | null>(null);
  // After the library effect above, so the player has the new song when it is asked to play it.
  useEffect(() => {
    if (!streamToPlay || !library.songs.some((song) => song.id === streamToPlay)) return;
    setStreamToPlay(null);
    player.playQueue([streamToPlay], 0);
  }, [streamToPlay, library.songs, player]);
  const [shortcuts, setShortcuts] = useState<readonly MusicShortcut[] | null>(null);
  const [visualizerDrawing, setVisualizerDrawing] = useDesktopSetting<VisualizerDrawing>(
    "music.visualizerDrawing",
    readVisualizerDrawing,
    "music",
  );
  const [output, setOutput] = useDesktopSetting(MUSIC_OUTPUT, readOutput, "");
  const outputMoved = useRef(false);
  const goneOutput = useRef<string | null>(null);
  const heard = equalizerForSong(equalizer, current?.eqPreset);
  const outputGone = () => {
    if (goneOutput.current === output) return;
    goneOutput.current = output;
    setProblem("That sound output is not available now: Music plays through the one it had.");
  };
  const tuneGraph = (graph: MusicAudioGraph) => {
    for (const media of player.mediaElements()) graph.join(media);
    graph.apply(heard);
    graph.enhance(settings.soundEnhancer, settings.soundEnhancerLevel);
    outputIdOf(output)
      .then((id) => graph.setSink(id))
      .catch(outputGone);
  };
  const tune = useRef(tuneGraph);
  tune.current = tuneGraph;
  const outputGoneRef = useRef(outputGone);
  outputGoneRef.current = outputGone;
  const toggleVisualizer = () => {
    if (analyser) {
      setAnalyser(null);
      return;
    }
    const graph = audioGraphOf(player);
    tuneGraph(graph);
    setAnalyser(graph.analyser);
  };
  // An element joined to Web Audio stays joined, and its sound waits on a running context: with
  // the Equalizer, Sound Enhancer and Sound Check never on, the song plays as ever; turned on
  // while paused, they join at Play.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tune` reads what is listed
  useEffect(() => {
    const made = madeAudioGraph(player);
    if (made) {
      tune.current(made);
      return undefined;
    }
    if (!heard.on && !settings.soundEnhancer && !settings.soundCheck) return undefined;
    const join = () => tune.current(audioGraphOf(player));
    const elements = player.mediaElements();
    if (elements.some((media) => !media.paused)) {
      join();
      return undefined;
    }
    for (const media of elements) media.addEventListener("play", join);
    return () => {
      for (const media of elements) media.removeEventListener("play", join);
    };
  }, [
    equalizer,
    player,
    current?.eqPreset,
    output,
    settings.soundEnhancer,
    settings.soundEnhancerLevel,
    settings.soundCheck,
  ]);
  // The output chosen in the volume slider's menu, kept with the person's settings. Sound in the
  // graph goes where the graph sends it (`tuneGraph`); otherwise the elements take it themselves.
  useEffect(() => {
    if (madeAudioGraph(player) || (output === "" && !outputMoved.current)) return;
    outputMoved.current = true;
    outputIdOf(output)
      .then((id) => sendSoundTo(player.mediaElements(), id))
      .catch(() => outputGoneRef.current());
  }, [output, player]);
  useEffect(() => {
    player.setCrossfade(settings.crossfade ? settings.crossfadeSeconds : 0);
  }, [player, settings.crossfade, settings.crossfadeSeconds]);
  // Sound Check measures each song before its sound starts, and the song loaded when turned on.
  useEffect(() => {
    if (!settings.soundCheck) {
      player.setBeforeSound(null);
      madeAudioGraph(player)?.clearLevels();
      return;
    }
    const level = async ({ media, song, url }: LoadedSound) => {
      const graph = audioGraphOf(player);
      tune.current(graph);
      const factor = await graph.soundCheck.of(song.id, url);
      // Another song on the element by now keeps the level measured for it.
      if (player.loadedSound()?.song.id === song.id) graph.setLevel(media, factor);
    };
    player.setBeforeSound(level);
    const loaded = player.loadedSound();
    if (loaded) void level(loaded);
  }, [player, settings.soundCheck]);
  // Keep on top turned on or off moves an open MiniPlayer into the layer it now belongs in.
  useEffect(() => {
    setMini((now) =>
      now && frame.current
        ? placeBeside(
            frame.current,
            miniPlayerHost(frame.current, preferencesContainer, onTop),
            MINI_PLAYER_SIZE.width,
            "top-right",
          )
        : now,
    );
  }, [onTop, preferencesContainer]);

  const [banner, setBanner] = useState<{
    song: LibrarySong;
    at: ReturnType<typeof placeBeside>;
  } | null>(null);
  const windowState = useRef(state);
  windowState.current = state;
  const notify = useRef(settings.notifications);
  notify.current = settings.notifications;
  useEffect(
    () =>
      player.onSongStart((song) => {
        // As in Music: a notification when the song changes while Music is in the background.
        if (!notify.current || windowState.current === "key" || !frame.current) return;
        setBanner({ song, at: placeBeside(frame.current, preferencesContainer, 344, "top-right") });
      }),
    [player, preferencesContainer],
  );
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  // ---- Changes to the library ---------------------------------------------------------

  // Songs being added belong to this window: closing it stops them (the panel says so). A song
  // whose upload finished as the window closed is taken out of the drive again, so no song is
  // left there that the library does not list.
  const uploads = useRef(new Set<AbortController>());
  useEffect(() => {
    const running = uploads.current;
    return () => {
      for (const controller of running) controller.abort();
    };
  }, []);

  const addFiles = useCallback(
    async (files: readonly File[], length?: number): Promise<string[]> => {
      const addedIds: string[] = [];
      if (!loadedRef.current) {
        setProblem("Your library is still loading; add the songs again in a moment.");
        return addedIds;
      }
      setProblem(null);
      const list = files.filter((file) => {
        const reason = songFileProblem(file);
        if (reason) setProblem(reason);
        return !reason;
      });
      const controller = new AbortController();
      const { signal } = controller;
      uploads.current.add(controller);
      for (const [n, file] of list.entries()) {
        if (signal.aborted) break;
        setAdding({ name: file.name, number: n + 1, total: list.length, fraction: 0 });
        try {
          const added = await addSongFile(
            file,
            `up-${crypto.randomUUID()}`,
            (sent, total) =>
              setAdding({
                name: file.name,
                number: n + 1,
                total: list.length,
                fraction: total > 0 ? sent / total : 0,
              }),
            signal,
            length,
          );
          if (signal.aborted) {
            if (added.song.source.kind === "file") forgetSongFile(added.song.source.file);
            break;
          }
          const artwork = added.cover ? await uploadArtwork(added.cover).catch(() => null) : null;
          if (signal.aborted) {
            if (added.song.source.kind === "file") forgetSongFile(added.song.source.file);
            break;
          }
          // A library that cannot take the song (full, or too large to save) says why, the
          // file goes from the drive again, and the rest of the batch is not uploaded.
          if (!commit((now) => ({ ...now, songs: [...now.songs, { ...added.song, artwork }] }))) {
            if (added.song.source.kind === "file") forgetSongFile(added.song.source.file);
            break;
          }
          addedIds.push(added.song.id);
        } catch (error) {
          if (signal.aborted) break;
          setProblem(addFailure(file, error));
        }
      }
      uploads.current.delete(controller);
      if (!signal.aborted) setAdding(null);
      return addedIds;
    },
    [commit],
  );

  const addSongs = useCallback(
    (songs: readonly LibrarySong[]) => {
      commit((now) => {
        const have = new Set(now.songs.map((song) => song.id));
        const fresh = songs
          .filter((song) => !have.has(song.id))
          .map((song) => ({ ...song, added: Date.now() }));
        return fresh.length === 0 ? now : { ...now, songs: [...now.songs, ...fresh] };
      });
    },
    [commit],
  );

  const playIds = useCallback(
    (ids: readonly string[], index: number) => player.playQueue(ids, index),
    [player],
  );

  const playVisiting = useCallback(
    (songs: LibrarySong[], index: number) => {
      // The player is told at once, so it can queue songs not in the library; the chosen song
      // comes first, so it is never the one a full item leaves out.
      const chosen = songs[index];
      player.addGuests(chosen ? [chosen, ...songs.filter((_, at) => at !== index)] : songs);
      player.playQueue(
        songs.map((song) => song.id),
        index,
      );
    },
    [player],
  );

  /** The library with `id` in it: a song played from the Internet Archive is added first. */
  const withSong = (now: MusicLibraryState, id: string): MusicLibraryState => {
    if (now.songs.some((song) => song.id === id) || player.isBorrowed(id)) return now;
    const guest = player.lookup(id);
    return guest ? { ...now, songs: [...now.songs, { ...guest, added: Date.now() }] } : now;
  };

  const newPlaylistName = (names: readonly string[]) => {
    const base = "Untitled Playlist";
    if (!names.includes(base)) return base;
    for (let n = 2; ; n += 1) if (!names.includes(`${base} ${n}`)) return `${base} ${n}`;
  };

  /** The library with every one of `ids` in it. */
  const withSongs = (now: MusicLibraryState, ids: readonly string[]) =>
    ids.reduce((library, id) => withSong(library, id), now);

  const newPlaylist = (
    ids: readonly string[],
    folder: string | null = null,
    name: string | null = null,
  ) => {
    if (libraryRef.current.playlists.length >= MUSIC_LIMITS.playlists) {
      setProblem(`Music keeps at most ${MUSIC_LIMITS.playlists} playlists.`);
      return;
    }
    const playlist = {
      id: `pl-${crypto.randomUUID()}`,
      name: name ?? newPlaylistName(libraryRef.current.playlists.map((p) => p.name)),
      songs: [...ids],
      ...(folder ? { folder } : {}),
    };
    if (
      commitUndoable((now) => ({
        ...withSongs(now, ids),
        playlists: [...now.playlists, playlist],
      }))
    ) {
      setPlace(`playlist:${playlist.id}`);
      setSelection([]);
      setQuery("");
      return playlist.id;
    }
    return null;
  };
  const [geniusLists, setGeniusLists] = useKeptValue(
    "music.genius",
    readGeniusLists,
    NO_GENIUS_LISTS,
  );
  const geniusFacts = () => ({ plays: playing.plays, loved: new Set(library.loved) });
  /** Makes a Genius playlist from `seed`, or goes to the one already made from it. */
  const makeGenius = (seed: LibrarySong) => {
    const made = library.playlists.find((list) => geniusLists[list.id]?.seed === seed.id);
    const ids = geniusSongs(seed, library.songs, geniusFacts());
    if (ids.length === 0) {
      setProblem(
        `Genius could not make a playlist from “${seed.title}”: no other song in your library shares its artist or genre.`,
      );
    } else if (made) {
      setPlace(`playlist:${made.id}`);
    } else {
      const id = newPlaylist(ids, null, geniusName(seed).slice(0, MUSIC_LIMITS.text));
      if (id) {
        const kept = Object.entries(geniusLists).filter(([list]) =>
          library.playlists.some((other) => other.id === list),
        );
        setGeniusLists({
          ...Object.fromEntries(kept),
          [id]: { seed: seed.id, size: GENIUS_SIZE },
        });
      }
    }
  };
  /** Makes a Genius playlist anew from its song, at `size`; new songs of the library join it. */
  const refreshGenius = (id: string, seed: LibrarySong, size: number) => {
    setGeniusLists({ ...geniusLists, [id]: { seed: seed.id, size } });
    const songs = geniusSongs(seed, library.songs, geniusFacts(), size);
    if (songs.length > 0) {
      commitUndoable((now) => ({
        ...now,
        playlists: now.playlists.map((list) => (list.id === id ? { ...list, songs } : list)),
      }));
    }
  };
  /** A sheet opened from the menu bar gives the focus back outside the window, whose keys need it. */
  const backToWindow = () =>
    setTimeout(() => {
      if (!frameElement?.contains(document.activeElement)) frameElement?.focus();
    }, 0);
  const manualPlaylists = library.playlists.filter((list) => !list.smart);
  const listSongs = (list: LibraryPlaylist): readonly string[] =>
    list.smart
      ? smartSongs(list.smart, library.songs, {
          plays: playing.plays,
          loved: new Set(library.loved),
          now: Date.now(),
        }).map((song) => song.id)
      : list.songs;
  const saveSmart = (smart: SmartPlaylist) => {
    const editing = smartEditing;
    setSmartEditing(null);
    if (!editing) return;
    if (editing.playlist) {
      commitUndoable((now) => ({
        ...now,
        playlists: now.playlists.map((list) =>
          list.id === editing.playlist ? { ...list, smart } : list,
        ),
      }));
      return;
    }
    if (libraryRef.current.playlists.length >= MUSIC_LIMITS.playlists) {
      setProblem(`Music keeps at most ${MUSIC_LIMITS.playlists} playlists.`);
      return;
    }
    const names = libraryRef.current.playlists.map((list) => list.name);
    let name = "Untitled Smart Playlist";
    for (let n = 2; names.includes(name); n += 1) name = `Untitled Smart Playlist ${n}`;
    const made = {
      id: `pl-${crypto.randomUUID()}`,
      name,
      songs: [],
      smart,
      ...(editing.folder ? { folder: editing.folder } : {}),
    };
    if (commitUndoable((now) => ({ ...now, playlists: [...now.playlists, made] }))) {
      setPlace(`playlist:${made.id}`);
      setSelection([]);
      setQuery("");
    }
  };
  const newFolder = (parent: string | null) => {
    const folders = libraryRef.current.folders ?? [];
    if (folders.length >= MUSIC_LIMITS.playlists) {
      setProblem(`Music keeps at most ${MUSIC_LIMITS.playlists} playlist folders.`);
      return;
    }
    const names = folders.map((folder) => folder.name);
    let name = "Untitled Folder";
    for (let n = 2; names.includes(name); n += 1) name = `Untitled Folder ${n}`;
    const folder = { id: `pf-${crypto.randomUUID()}`, name, ...(parent ? { parent } : {}) };
    if (commitUndoable((now) => ({ ...now, folders: [...(now.folders ?? []), folder] }))) {
      setPlace(`folder:${folder.id}`);
      setRenamingPlace(`folder:${folder.id}`);
      setSelection([]);
      setQuery("");
    }
  };
  const deleteFolder = (id: string) => {
    if (commitUndoable((now) => withoutFolder(now, id))) {
      const still = libraryRef.current;
      const here = place.startsWith("playlist:")
        ? still.playlists.some((list) => `playlist:${list.id}` === place)
        : place.startsWith("folder:")
          ? (still.folders ?? []).some((folder) => `folder:${folder.id}` === place)
          : true;
      if (!here) setPlace("songs");
    }
  };
  const playlistMenu: PlaylistMenuActions = {
    songsOf: (row) =>
      row.startsWith("folder:")
        ? songsInFolder(library, row.slice("folder:".length), listSongs)
        : (() => {
            const list = library.playlists.find((other) => `playlist:${other.id}` === row);
            return list ? listSongs(list) : [];
          })(),
    play: (ids) => playIds(ids, 0),
    playNext: (ids) => onAction({ type: "play-next", ids }),
    playLater: (ids) => onAction({ type: "play-later", ids }),
    newPlaylist: (folder) => newPlaylist([], folder),
    newSmart: (folder) => setSmartEditing({ playlist: null, folder, smart: NEW_SMART }),
    editSmart: (id) => {
      const smart = library.playlists.find((list) => list.id === id)?.smart;
      if (smart) setSmartEditing({ playlist: id, folder: null, smart });
    },
    newFolder,
    setPrivate: (id, hidden) =>
      commitUndoable((now) => ({
        ...now,
        playlists: now.playlists.map((list) =>
          list.id === id ? { ...list, private: hidden } : list,
        ),
      })),
    exportPlaylist: (id) => {
      const list = library.playlists.find((other) => other.id === id);
      if (list) {
        void saveToDownloads(
          fileNameOf(list.name, "m3u"),
          "audio/x-mpegurl",
          writeM3u(songsOfIds(listSongs(list), true)),
        );
      }
    },
    duplicate: (id) => {
      const list = libraryRef.current.playlists.find((other) => other.id === id);
      if (!list) return;
      if (libraryRef.current.playlists.length >= MUSIC_LIMITS.playlists) {
        setProblem(`Music keeps at most ${MUSIC_LIMITS.playlists} playlists.`);
        return;
      }
      commitUndoable((now) => ({
        ...now,
        playlists: [
          ...now.playlists,
          { ...list, id: `pl-${crypto.randomUUID()}`, name: `${list.name} copy` },
        ],
      }));
    },
    rename: (row) => {
      setPlace(row as Place);
      setRenamingPlace(row as Place);
      setSelection([]);
      setQuery("");
    },
    move: (row, folder) => commitUndoable((now) => moveToFolder(now, row, folder)),
    remove: (row) => {
      if (row.startsWith("folder:")) setAskingFolder(row.slice("folder:".length));
      else {
        commitUndoable((now) => ({
          ...now,
          playlists: now.playlists.filter((list) => `playlist:${list.id}` !== row),
        }));
        if (place === row) setPlace("songs");
      }
    },
  };
  const addToPlaylist = (ids: readonly string[], target: string) =>
    commitUndoable((now) => withInPlaylist(withSongs(now, ids), ids, target));
  const removeFromPlaylist = (ids: readonly string[], target: string) =>
    commitUndoable((now) => ({
      ...now,
      playlists: now.playlists.map((p) =>
        p.id === target ? { ...p, songs: p.songs.filter((x) => !ids.includes(x)) } : p,
      ),
    }));
  /** Love what is not all loved yet; unlove what is. */
  const love = (ids: readonly string[]) =>
    commitUndoable((now) => {
      const next = withSongs(now, ids);
      return ids.every((id) => next.loved.includes(id))
        ? { ...next, loved: next.loved.filter((x) => !ids.includes(x)) }
        : withLoved(next, ids);
    });
  /**
   * Take songs out of the library. Neither way can Undo bring them back: the server forgets a
   * song's cover once the saved library no longer names it. `trash` moves the songs' files to the
   * Trash of the drive, from where Finder can put them back, once the library is saved without
   * them; otherwise they stay in the Music folder.
   */
  const deleteSongs = (ids: readonly string[], trash: boolean) => {
    const files = libraryRef.current.songs.flatMap((song) =>
      ids.includes(song.id) && song.source.kind === "file" ? [song.source.file] : [],
    );
    const removed = commit((now) => ({
      ...now,
      songs: now.songs.filter((s) => !ids.includes(s.id)),
      playlists: now.playlists.map((p) => ({
        ...p,
        songs: p.songs.filter((x) => !ids.includes(x)),
      })),
      loved: now.loved.filter((x) => !ids.includes(x)),
    }));
    setSelection((now) => now.filter((id) => !ids.includes(id)));
    if (!removed) return;
    setLyrics((now) =>
      ids.some((id) => id in now)
        ? Object.fromEntries(Object.entries(now).filter(([id]) => !ids.includes(id)))
        : now,
    );
    setUndoStack([]);
    setRedoStack([]);
    if (trash && files.length > 0) setTrashing(files);
  };
  /** Each song of the drive with no picture takes the one in its own file, read in this page. */
  const getAlbumArtwork = async () => {
    const wanting = songsWantingArtwork(libraryRef.current.songs);
    let found = 0;
    let failed = 0;
    setProblem(null);
    for (const song of wanting) {
      if (song.source.kind !== "file") continue;
      try {
        const cover = await coverOfSongFile(song.source.file);
        if (!cover) continue;
        const artwork = await uploadArtwork(cover);
        commit((now) => ({
          ...now,
          songs: now.songs.map((each) =>
            each.id === song.id && !each.artwork ? { ...each, artwork } : each,
          ),
        }));
        found += 1;
      } catch {
        failed += 1;
      }
    }
    const shared = sharedAlbumArtwork(libraryRef.current.songs);
    if (shared.size > 0) {
      commit((now) => ({
        ...now,
        songs: now.songs.map((each) => {
          const artwork = shared.get(each.id);
          return artwork && !each.artwork ? { ...each, artwork } : each;
        }),
      }));
    }
    setProblem(artworkReport(found, wanting.length, failed, shared.size));
  };
  const showInFinder = (id: string) => {
    const song = byId.get(id);
    if (song?.source.kind !== "file") return;
    requestOpenFile({ app: "finder", id: song.source.file, name: song.source.name });
    requestDesktopEffects([{ open: "finder" }]);
  };
  /** Copy: the songs for a paste into a playlist, and as text for every other app. */
  const copySongs = (ids: readonly string[]) => {
    setSongClipboard(ids);
    const lines = ids.flatMap((id) => {
      const song = byId.get(id);
      return song ? [`${song.title}\t${song.artist || UNKNOWN_ARTIST}\t${song.album}`] : [];
    });
    void copyText(lines.join("\n"));
  };

  /** Song Info's OK: only what was changed, on only the songs it was opened on. */
  const saveSongInfo = async (ids: readonly string[], change: SongInfoChange) => {
    setInfoFor(null);
    const { cover, lyrics: typedLyrics, ...fields } = change;
    if (typedLyrics !== undefined) {
      const [id] = ids;
      if (id) setLyrics((now) => ({ ...now, [id]: typedLyrics }));
    }
    let artwork: string | null | undefined;
    if (cover) {
      try {
        artwork = await uploadArtwork(cover);
      } catch {
        setProblem("The artwork could not be saved; the other changes were kept.");
      }
    } else if (cover === null) artwork = null;
    const edits = artwork === undefined ? fields : { ...fields, artwork };
    if (Object.keys(edits).length === 0) return;
    commitUndoable((now) => ({
      ...now,
      songs: now.songs.map((song) => (ids.includes(song.id) ? { ...song, ...edits } : song)),
    }));
  };

  const onAction = (action: SongAction) => {
    const { ids } = action;
    switch (action.type) {
      case "play-next":
        // Each goes right after the song loaded: the last first, so they play in the order chosen.
        for (const id of [...ids].reverse()) player.playNext(id);
        break;
      case "play-later":
        for (const id of ids) player.playLater(id);
        break;
      case "love":
        love(ids);
        break;
      case "add-to-playlist":
        if (action.playlist === null) newPlaylist(ids);
        else addToPlaylist(ids, action.playlist);
        break;
      case "remove-from-playlist":
        removeFromPlaylist(ids, action.playlist);
        break;
      case "delete":
        setAsking(ids);
        break;
      case "copy":
        copySongs(ids);
        break;
      case "show-in-finder":
        if (ids[0]) showInFinder(ids[0]);
        break;
      case "info":
        setInfoFor(ids);
        break;
      case "rate":
        rate(ids, action.stars);
        break;
      case "check":
        commitUndoable((now) => {
          const next = withSongs(now, ids);
          return {
            ...next,
            songs: next.songs.map((song) =>
              ids.includes(song.id) ? { ...song, unchecked: !action.checked } : song,
            ),
          };
        });
        break;
      case "dislike":
        dislike(ids);
        break;
      case "show-in-album":
        if (ids[0]) showInAlbum(ids[0]);
        break;
    }
  };

  const rate = (ids: readonly string[], stars: number | null) =>
    commitUndoable((now) => {
      const next = withSongs(now, ids);
      return {
        ...next,
        songs: next.songs.map((song) =>
          ids.includes(song.id) ? { ...song, rating: stars } : song,
        ),
      };
    });
  /** Dislike what is not all disliked yet, which also unloves it; take it back from what is. */
  const dislike = (ids: readonly string[]) =>
    commitUndoable((now) => {
      const next = withSongs(now, ids);
      const disliked = !next.songs
        .filter((song) => ids.includes(song.id))
        .every((song) => song.disliked);
      return {
        ...next,
        loved: disliked ? next.loved.filter((id) => !ids.includes(id)) : next.loved,
        songs: next.songs.map((song) => (ids.includes(song.id) ? { ...song, disliked } : song)),
      };
    });
  const showInAlbum = (id: string) => {
    const song = byId.get(id);
    if (!song) return;
    setQuery("");
    setPlace("albums");
    setAlbumId(albumKey(song));
    setSelection([id]);
  };

  // ---- The window ---------------------------------------------------------------------

  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );
  const choose = (next: Place) => {
    setDuplicatesOnly(false);
    setAlbumsChosen(NO_ALBUMS);
    setPlace(next);
    setQuery("");
    setAlbumId(null);
    setSelection([]);
    if (next === "albums" || next === "artists" || next === "songs" || next === "recently-added") {
      onSectionChange?.(next);
    }
  };
  const pick = () => {
    if (loadedRef.current) fileInput.current?.click();
  };
  /** File > Open Stream: the address goes in the library as a song of no fixed length, and plays. */
  const openStream = () => {
    const url = streamAddress(streamTyped);
    if (!url) return;
    setStreamOpen(false);
    backToWindow();
    const listedAlready = library.songs.find(
      (song) => song.source.kind === "stream" && song.source.url === url,
    );
    if (listedAlready) {
      player.playQueue([listedAlready.id], 0);
      return;
    }
    const id = `stream-${crypto.randomUUID()}`;
    const song: LibrarySong = {
      id,
      title: streamTitle(url),
      artist: "",
      album: "",
      genre: "",
      year: null,
      track: null,
      duration: 0,
      added: Date.now(),
      artwork: null,
      source: { kind: "stream", url },
    };
    if (commit((now) => ({ ...now, songs: [...now.songs, song] }))) setStreamToPlay(id);
  };
  /** File > Convert: each song's file decoded and written beside it in a format, its details kept. */
  const convertSongs = async (ids: readonly string[], format?: LossyFormat) => {
    for (const id of ids) {
      const song = byId.get(id);
      if (song?.source.kind !== "file") continue;
      const name = song.source.name;
      try {
        const blob = await readSongFile(song.source.file);
        const file = format ? await lossyVersion(blob, name, format) : await wavOfSong(blob, name);
        const [made] = await addFiles([file], song.duration > 0 ? song.duration : undefined);
        if (made) {
          const { id: _id, source: _source, added: _added, duration: _length, ...details } = song;
          commit((now) => ({
            ...now,
            songs: now.songs.map((each) => (each.id === made ? { ...each, ...details } : each)),
          }));
        }
      } catch (error) {
        setProblem(
          `“${name}” could not be converted: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  };
  const songsOfIds = (ids: readonly string[], guests = false) =>
    ids.flatMap((id) => {
      const song = byId.get(id);
      if (!song || !(guests || libraryIds.has(id))) return [];
      return !guests && onlyDownloaded && song.source.kind !== "file" ? [] : [song];
    });
  const page = (content: ReactNode) => (
    <ScrollView className="mac-music-main">
      <div className="mac-music-page">{content}</div>
    </ScrollView>
  );
  let tableSorted = false;
  const table = (
    songs: readonly LibrarySong[],
    label: string,
    extra: { playlist?: string; sorted?: boolean; header?: ReactNode } = {},
  ) => {
    tableSorted = extra.sorted ?? true;
    return (
      <div className="mac-music-main mac-music-desktop-list">
        {extra.header}
        <SongTable
          // A table of its own per view, so each view starts in its own order.
          key={place}
          songs={songs}
          label={label}
          loved={loved}
          plays={playing.plays}
          playlists={manualPlaylists}
          currentId={current?.id ?? null}
          playlist={extra.playlist}
          sorted={extra.sorted ?? true}
          columns={columns}
          checkboxes={settings.songCheckboxes}
          ratings={settings.starRatings}
          savedSort={songSort}
          onSavedSort={setSongSort}
          rowHeight={rowHeight}
          selection={selection}
          onSelectionChange={setSelection}
          reveal={reveal}
          onSongPress={(down, ids, reselect) => pressSongs(down, ids, reselect)}
          onPlay={playIds}
          onAction={onAction}
        />
      </div>
    );
  };
  const header = (
    title: string,
    songs: readonly LibrarySong[],
    more: Partial<Parameters<typeof ListHeader>[0]> = {},
  ) => (
    <ListHeader
      // A header of its own per view: a rename begun in one playlist ends with it, and never
      // renames the playlist shown next. A Rename chosen in the sidebar starts one afresh.
      key={`header-${place}-${renamingPlace === place}`}
      title={title}
      songs={songs}
      renaming={renamingPlace === place}
      onRenameEnd={() => setRenamingPlace(null)}
      onPlay={() => {
        player.setShuffle(false);
        playIds(
          songs.map((song) => song.id),
          0,
        );
      }}
      onShuffle={() => {
        player.setShuffle(true);
        playIds(
          songs.map((song) => song.id),
          Math.floor(Math.random() * songs.length),
        );
      }}
      {...more}
    />
  );
  const selected = albums.find((album) => album.id === albumId) ?? null;
  const playTracks = (queue: readonly MusicTrack[], index: number) =>
    playIds(
      queue.map((track) => track.song.id),
      index,
    );
  const grid = (
    list: readonly MusicAlbum[],
    label: string,
    title?: string,
    separator = false,
    artist?: string,
  ) => (
    <AlbumGrid
      key={title ?? label}
      albums={list}
      label={label}
      title={title}
      separator={separator}
      artist={artist}
      onArtistPress={(down, name) =>
        pressSongs(
          down,
          albums
            .filter((one) => one.artist === name)
            .flatMap((one) => one.songs.map((song) => song.id)),
          () => {},
        )
      }
      selectedId={albumId}
      chosen={albumsChosen.ids}
      onCardPress={(down, album) =>
        pressSongs(
          down,
          (albumsChosen.ids.includes(album.id)
            ? albums.filter((one) => albumsChosen.ids.includes(one.id))
            : [album]
          ).flatMap((one) => one.songs.map((song) => song.id)),
          () => {},
        )
      }
      onSelect={(id, how) => {
        setSelection([]);
        if (how.add || how.range) {
          setAlbumId(null);
          setAlbumsChosen((now) =>
            albumsAfter(
              now,
              list.map((album) => album.id),
              id,
              how.range,
            ),
          );
          return;
        }
        setAlbumsChosen(albumId === id ? NO_ALBUMS : { ids: [id], anchor: id });
        setAlbumId((now) => (now === id ? null : id));
      }}
      onPlay={(album) =>
        playIds(
          album.songs.map((song) => song.id),
          0,
        )
      }
    />
  );
  const albumMenu = (children: ReactNode) => (
    <AlbumMenu
      albums={albums}
      chosen={albumsChosen.ids}
      loved={loved}
      playlists={manualPlaylists}
      onPlay={(ids) => playIds(ids, 0)}
      onAction={onAction}
    >
      {children}
    </AlbumMenu>
  );
  const detail = (list: readonly MusicAlbum[]) =>
    selected && list.includes(selected) ? (
      <AlbumDetail
        album={selected}
        rowHeight={rowHeight}
        selection={selection}
        onSelectionChange={setSelection}
        onPlay={playTracks}
      />
    ) : null;
  const empty = (
    <EmptyState className="mac-music-main">
      <div className="mac-music-desktop-empty">
        <div>Your library is empty.</div>
        <div className="mac-music-desktop-facts">
          Add songs from your computer, or find openly licensed music on the Internet Archive.
        </div>
        <div className="mac-music-desktop-buttons">
          <PushButton onClick={pick}>Add Songs…</PushButton>
          <PushButton onClick={() => choose("archive")}>Browse the Internet Archive</PushButton>
        </div>
      </div>
    </EmptyState>
  );

  const folderId = place.startsWith("folder:") ? place.slice("folder:".length) : null;
  const folderShown = folderId
    ? (library.folders ?? []).find((folder) => folder.id === folderId)
    : undefined;
  const playlistId = place.startsWith("playlist:") ? place.slice("playlist:".length) : null;
  const playlist = playlistId ? library.playlists.find((p) => p.id === playlistId) : undefined;
  const searching = query.trim() !== "" && place !== "archive";
  // The songs of the list shown: what Select All selects.
  let listed: readonly { id: string }[] = [];
  let detailShown = false;
  let content: ReactNode;
  if (searching) {
    const q = query.trim().toLowerCase();
    const found = songsOfIds(library.songs.map((song) => song.id)).filter((song) =>
      [song.title, song.artist, song.album].some((text) => text.toLowerCase().includes(q)),
    );
    const foundAlbums = albums.filter((album) => albumMatches(album, query));
    content = (
      <div className="mac-music-main mac-music-desktop-list">
        <div className="mac-music-desktop-header">
          <h2 className="mac-music-desktop-title">Results for “{query.trim()}”</h2>
          <div className="mac-music-desktop-facts">
            {found.length} {found.length === 1 ? "song" : "songs"}, {foundAlbums.length}{" "}
            {foundAlbums.length === 1 ? "album" : "albums"} in your library
          </div>
          <div className="mac-music-desktop-buttons">
            <ScopeBar>
              <ScopeBarLabel>Search:</ScopeBarLabel>
              <ScopeBarGroup
                aria-label="Search"
                value="library"
                onValueChange={(scope) => {
                  if (scope !== "archive") return;
                  searchArchive(query.trim());
                  setPlace("archive");
                  setQuery("");
                }}
              >
                <ScopeBarButton value="library">Library</ScopeBarButton>
                <ScopeBarButton value="archive">Internet Archive</ScopeBarButton>
              </ScopeBarGroup>
            </ScopeBar>
          </div>
        </div>
        {found.length === 0 ? (
          <EmptyState role="status">No Results</EmptyState>
        ) : (
          <SongTable
            songs={found}
            label="Songs found"
            loved={loved}
            plays={playing.plays}
            playlists={manualPlaylists}
            currentId={current?.id ?? null}
            checkboxes={settings.songCheckboxes}
            ratings={settings.starRatings}
            rowHeight={rowHeight}
            selection={selection}
            onSelectionChange={setSelection}
            onPlay={playIds}
            onAction={onAction}
          />
        )}
      </div>
    );
    listed = found;
  } else if (place === "archive") {
    content = (
      <ScrollView className="mac-music-main">
        <ArchiveBrowser
          key={archiveSearch.asked}
          initialQuery={archiveSearch.query}
          libraryIds={libraryIds}
          rowHeight={rowHeight}
          onPlay={playVisiting}
          onAdd={addSongs}
        />
      </ScrollView>
    );
  } else if (place === "radio") {
    content = (
      <ScrollView className="mac-music-main">
        <RadioBrowser
          libraryIds={libraryIds}
          rowHeight={rowHeight}
          onPlay={(station) => playVisiting([station], 0)}
          onAdd={(station) => addSongs([station])}
        />
      </ScrollView>
    );
  } else if (place === "videos") {
    content = <MusicVideos onStart={() => player.pause()} />;
  } else if (place === "loved") {
    const songs = songsOfIds(library.loved);
    listed = songs;
    content = table(songs, "Loved Songs", { sorted: false, header: header("Loved Songs", songs) });
  } else if (place === "recent") {
    const songs = songsOfIds(playing.recent, true);
    listed = songs;
    content = table(songs, "Recently Played", {
      sorted: false,
      header: header("Recently Played", songs, {
        children: (
          <PushButton disabled={songs.length === 0} onClick={() => player.clearHistory()}>
            Clear
          </PushButton>
        ),
      }),
    });
  } else if (place === "top") {
    const songs = songsOfIds(library.songs.map((song) => song.id))
      .filter((song) => (playing.plays[song.id] ?? 0) > 0)
      .sort((a, b) => (playing.plays[b.id] ?? 0) - (playing.plays[a.id] ?? 0))
      .slice(0, 25);
    listed = songs;
    content = table(songs, "Top 25 Most Played", {
      sorted: false,
      header: header("Top 25 Most Played", songs),
    });
  } else if (playlistId) {
    if (!playlist)
      content = <EmptyState className="mac-music-main">This playlist was deleted.</EmptyState>;
    else {
      const songs = songsOfIds(listSongs(playlist));
      const genius = geniusLists[playlist.id];
      const geniusSeed = library.songs.find((song) => song.id === genius?.seed);
      listed = songs;
      content = table(songs, playlist.name, {
        ...(playlist.smart ? {} : { sorted: false, playlist: playlist.id }),
        header: header(playlist.name, songs, {
          onRename: (name) =>
            commitUndoable((now) => ({
              ...now,
              playlists: now.playlists.map((p) => (p.id === playlist.id ? { ...p, name } : p)),
            })),
          children: (
            <>
              {playlist.smart ? (
                <PushButton onClick={() => playlistMenu.editSmart(playlist.id)}>
                  Edit Rules…
                </PushButton>
              ) : null}
              {genius ? (
                <GeniusControls
                  seedTitle={geniusSeed?.title ?? null}
                  size={genius.size}
                  onSize={(size) => {
                    if (geniusSeed) refreshGenius(playlist.id, geniusSeed, size);
                  }}
                  onRefresh={() => {
                    if (geniusSeed) refreshGenius(playlist.id, geniusSeed, genius.size);
                  }}
                />
              ) : null}
              <PushButton
                onClick={() => {
                  if (
                    commitUndoable((now) => ({
                      ...now,
                      playlists: now.playlists.filter((p) => p.id !== playlist.id),
                    }))
                  ) {
                    setPlace("songs");
                  }
                }}
              >
                Delete Playlist
              </PushButton>
            </>
          ),
        }),
      });
    }
  } else if (folderId) {
    if (!folderShown)
      content = <EmptyState className="mac-music-main">This folder was deleted.</EmptyState>;
    else {
      const songs = songsOfIds(songsInFolder(library, folderShown.id, listSongs));
      listed = songs;
      content = table(songs, folderShown.name, {
        header: header(folderShown.name, songs, {
          onRename: (name) =>
            commitUndoable((now) => ({
              ...now,
              folders: (now.folders ?? []).map((folder) =>
                folder.id === folderShown.id ? { ...folder, name } : folder,
              ),
            })),
          children: (
            <PushButton onClick={() => setAskingFolder(folderShown.id)}>Delete Folder</PushButton>
          ),
        }),
      });
    }
  } else if (library.songs.length === 0) {
    content = empty;
  } else if (place === "downloaded") {
    const songs = library.songs.filter((song) => song.source.kind === "file");
    listed = songs;
    content = table(songs, "Downloaded", { header: header("Downloaded", songs) });
  } else if (place === "songs") {
    const browsed = columnBrowser && !duplicatesOnly;
    const shownSongs = songsOfIds(library.songs.map((song) => song.id));
    const songs = duplicatesOnly
      ? duplicateSongs(library.songs)
      : browsed
        ? browseSongs(shownSongs, browserChoice).songs
        : shownSongs;
    listed = songs;
    content = duplicatesOnly
      ? table(songs, "Duplicate Items", {
          header: header("Duplicate Items", songs, {
            children: (
              <PushButton onClick={() => setDuplicatesOnly(false)}>Show All Items</PushButton>
            ),
          }),
        })
      : table(songs, "Songs", {
          header: browsed ? (
            <ColumnBrowser songs={shownSongs} choice={browserChoice} onChoice={setBrowserChoice} />
          ) : undefined,
        });
  } else if (place === "genres") {
    const genres = [...new Set(albums.map((album) => album.genre))].sort();
    if (selected) {
      listed = selected.songs;
      detailShown = true;
    }
    content = page(
      <>
        {albumMenu(
          genres.map((genre, index) =>
            grid(
              albums.filter((album) => album.genre === genre),
              genre || "Unknown Genre",
              genre || "Unknown Genre",
              index > 0,
            ),
          ),
        )}
        {detail(albums)}
      </>,
    );
  } else if (place === "composers") {
    const composerOf = (song: LibrarySong) => song.composer ?? "";
    // Composers go by their Sort Composer, when a song of theirs has one.
    const orderOf = (composer: string) =>
      library.songs.find((song) => composerOf(song) === composer && song.sortComposer)
        ?.sortComposer ?? composer;
    const composers = [
      ...new Set(songsOfIds(library.songs.map((song) => song.id)).map(composerOf)),
    ].sort((a, b) => orderOf(a).localeCompare(orderOf(b)));
    if (selected) {
      listed = selected.songs;
      detailShown = true;
    }
    content = page(
      <>
        {albumMenu(
          composers.map((composer, index) =>
            grid(
              albums.filter((album) =>
                library.songs.some(
                  (song) => composerOf(song) === composer && albumKey(song) === album.id,
                ),
              ),
              composer || "Unknown Composer",
              composer || "Unknown Composer",
              index > 0,
            ),
          ),
        )}
        {detail(albums)}
      </>,
    );
  } else if (place === "artists") {
    const artists = [...new Set(albums.map((album) => album.artist))].sort();
    if (selected) {
      listed = selected.songs;
      detailShown = true;
    }
    content = page(
      <>
        {albumMenu(
          artists.map((artist, index) =>
            grid(
              albums.filter((album) => album.artist === artist),
              artist,
              artist,
              index > 0,
              artist,
            ),
          ),
        )}
        {detail(albums)}
      </>,
    );
  } else {
    const list = place === "albums" ? albums : [...albums].sort((a, b) => a.added - b.added);
    if (selected) {
      listed = selected.songs;
      detailShown = true;
    }
    content = page(
      <>
        {albumMenu(grid(list, place === "albums" ? "Albums" : "Recently Added"))}
        {detail(list)}
      </>,
    );
  }

  // The library's own places say how to add to it: Add Songs… heads them (File > Add to
  // Library in Music; the desktop's menu bar is the shell's).
  if (
    !searching &&
    library.songs.length > 0 &&
    (place === "albums" ||
      place === "artists" ||
      place === "genres" ||
      place === "composers" ||
      place === "songs" ||
      place === "recently-added")
  ) {
    content = (
      <div className="mac-music-main mac-music-desktop-list">
        <div className="mac-music-desktop-actions">
          <PushButton size="small" onClick={pick}>
            Add Songs…
          </PushButton>
        </div>
        {content}
      </div>
    );
  }

  // The Song menu's songs: the selection, else the album whose songs show, else the song loaded.
  const chosenSongs = selection.filter((id) => listed.some((song) => song.id === id));
  const shownAlbumSongs =
    detailShown && selected
      ? selected.songs.map((song) => song.id)
      : albumsChosen.ids.length > 0 &&
          !searching &&
          (place === "albums" ||
            place === "artists" ||
            place === "genres" ||
            place === "composers" ||
            place === "recently-added")
        ? albums
            .filter((album) => albumsChosen.ids.includes(album.id))
            .flatMap((album) => album.songs.map((song) => song.id))
        : [];
  const deletable = homeSharing.place ? [] : chosenSongs.length > 0 ? chosenSongs : shownAlbumSongs;
  const menuTargets =
    deletable.length > 0
      ? deletable
      : current && !player.isBorrowed(current.id)
        ? [current.id]
        : [];
  const inPlaylistId = !searching && playlist && !playlist.smart ? playlist.id : null;
  const listShownName =
    listed.length === 0
      ? null
      : searching
        ? `Results for “${query.trim()}”`
        : (playlist?.name ??
          folderShown?.name ??
          selected?.title ??
          {
            loved: "Loved Songs",
            recent: "Recently Played",
            top: "Top 25 Most Played",
            downloaded: "Downloaded",
          }[place as string] ??
          "Songs");
  const listedSongs = () =>
    songsOfIds(
      listed.map((song) => song.id),
      true,
    );

  /** Organize Library: each file moved is named in the library at once. */
  const organizeFiles = async (choice: OrganizeChoice) => {
    try {
      const done = await organizeLibrary(libraryRef.current.songs, choice, (id, file, name) => {
        commit((now) => ({
          ...now,
          songs: now.songs.map((song) =>
            song.id === id && song.source.kind === "file"
              ? { ...song, source: { ...song.source, file, name } }
              : song,
          ),
        }));
      });
      setProblem(
        done === 0
          ? "Your song files are already organized."
          : `Organized ${done} song ${done === 1 ? "file" : "files"} in Music on your drive.`,
      );
    } catch (error) {
      setProblem(
        `The library could not be organized: ${error instanceof Error ? error.message : error}`,
      );
    }
  };

  /** Keeps `text` in the person's Downloads folder, under a free name, and says where. */
  const saveToDownloads = async (name: string, type: string, text: string) => {
    try {
      const drive = await ensureDrive();
      const folder = specialFolder(drive, "Downloads")?.id ?? SPECIAL_FOLDER_IDS.Downloads;
      const entry = await uploadFile(new Blob([text], { type }), folder, {
        name,
        existing: "rename",
      });
      setProblem(`Saved as “${entry.name}” in Downloads.`);
    } catch (error) {
      setProblem(`The file could not be saved: ${error instanceof Error ? error.message : error}`);
    }
  };

  /** A playlist of the library's songs a playlist file names, which says what it could not find. */
  const importPlaylistFile = async (entry: { id: string; name: string }) => {
    try {
      const entries = readM3u(await (await readFile(entry.id)).text());
      const { ids, missing } = matchEntries(entries, libraryRef.current.songs);
      if (ids.length === 0) {
        setProblem(`None of the ${entries.length} songs in “${entry.name}” are in your library.`);
        return;
      }
      newPlaylist(ids, null, playlistNameOf(entry.name).slice(0, MUSIC_LIMITS.text));
      if (missing > 0) {
        setProblem(
          `${missing} of the ${entries.length} songs in “${entry.name}” are not in your library, and were left out.`,
        );
      }
    } catch (error) {
      setProblem(
        `“${entry.name}” could not be read: ${error instanceof Error ? error.message : error}`,
      );
    }
  };
  const showInSongs = useCallback(
    (id: string) => {
      setDuplicatesOnly(false);
      setBrowserChoice(BROWSE_ALL);
      setQuery("");
      setAlbumId(null);
      setPlace("songs");
      setSelection([id]);
      setReveal({ id });
    },
    [setPlace],
  );
  const goToCurrent = () => {
    if (!current) return;
    if (libraryIds.has(current.id)) {
      showInSongs(current.id);
    } else {
      setQuery("");
      setAlbumId(null);
      setPanel("up-next");
    }
  };
  // A song Spotlight found: a window opened by the request has not read the library yet, so it
  // waits for that. A song deleted since Spotlight indexed it leaves the window as it is.
  const [askedSong, setAskedSong] = useState<string | null>(null);
  useOpenItemRequests("music", ({ id }) => setAskedSong(id));
  useEffect(() => {
    if (askedSong === null || busy) return;
    setAskedSong(null);
    if (libraryIds.has(askedSong)) showInSongs(askedSong);
  }, [askedSong, busy, libraryIds, showInSongs]);
  const menuTarget = menuTargets.length === 1 ? byId.get(menuTargets[0] ?? "") : undefined;
  const geniusFrom = library.songs.find((song) => song.id === menuTargets[0]);
  const menuKey = useMusicMenus({
    within: frameElement,
    player,
    playing,
    ready: !busy,
    targets: menuTargets,
    deletable,
    selected: chosenSongs.length,
    shown: listed.length,
    inPlaylist: inPlaylistId !== null,
    canPaste: copiedSongs.length > 0,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    loved: menuTargets.length > 0 && menuTargets.every((id) => loved.has(id)),
    playlists: manualPlaylists,
    panel,
    miniOpen: mini !== null,
    sidebarShown,
    statusBarShown,
    setStatusBarShown,
    sort: tableSorted ? songSort : null,
    setSort: setSongSort,
    openViewOptions: () => setViewOptionsOpen(true),
    canShowInFinder:
      menuTargets.length === 1 && byId.get(menuTargets[0] ?? "")?.source.kind === "file",
    hasCurrent: current !== undefined,
    nowPlaying: current ? { title: current.title, artist: current.artist } : null,
    selectionElsewhere: chosenSongs.length > 0 && !chosenSongs.includes(current?.id ?? ""),
    importSongs: pick,
    homeSharing: homeSharing.member
      ? {
          on: homeSharing.on,
          run: () => {
            if (!homeSharing.on) {
              setAskingHomeSharing(true);
              return;
            }
            void writeSharingOn(false).then(homeSharing.setOn, (error: Error) =>
              setProblem(error.message),
            );
          },
        }
      : null,
    openStream: () => {
      setStreamTyped("");
      setStreamOpen(true);
    },
    convert: (ids, format) => void convertSongs(ids, format),
    canConvert:
      menuTargets.length > 0 && menuTargets.every((id) => byId.get(id)?.source.kind === "file"),
    startPlaying: () => {
      const list = listed.length > 0 ? listed : library.songs;
      playIds(
        list.map((song) => song.id),
        Math.max(
          0,
          list.findIndex((song) => chosenSongs.includes(song.id)),
        ),
      );
    },
    newPlaylist,
    newFolder: () => newFolder(null),
    newSmart: () => setSmartEditing({ playlist: null, folder: null, smart: NEW_SMART }),
    genius: geniusFrom ? () => makeGenius(geniusFrom) : null,
    editSmart: playlist?.smart ? () => playlistMenu.editSmart(playlist.id) : null,
    love,
    rating: sharedRating(songsOfIds(menuTargets, true)),
    disliked:
      menuTargets.length > 0 && songsOfIds(menuTargets, true).every((song) => song.disliked),
    canShowInAlbum: menuTargets.length === 1 && libraryIds.has(menuTargets[0] ?? ""),
    shareUrl: menuTarget ? songLink(menuTarget) : "",
    shareTitle: menuTarget?.title ?? "",
    rate,
    dislike,
    showInAlbum,
    addToPlaylist,
    remove: (ids) => {
      if (inPlaylistId) removeFromPlaylist(ids, inPlaylistId);
      else setAsking(ids);
    },
    deleteFromLibrary: setAsking,
    songInfo: setInfoFor,
    playNext: (ids) => onAction({ type: "play-next", ids }),
    playLater: (ids) => onAction({ type: "play-later", ids }),
    showInFinder,
    undo: () => {
      const step = undoStack.at(-1);
      if (!step || !commit((now) => applyLibraryChange(now, step.after, step.before))) return;
      setUndoStack((stack) => stack.slice(0, -1));
      setRedoStack((stack) => [...stack, step]);
    },
    redo: () => {
      const step = redoStack.at(-1);
      if (!step || !commit((now) => applyLibraryChange(now, step.before, step.after))) return;
      setRedoStack((stack) => stack.slice(0, -1));
      setUndoStack((stack) => [...stack, step]);
    },
    cut: () => {
      if (!inPlaylistId) return;
      copySongs(chosenSongs);
      removeFromPlaylist(chosenSongs, inPlaylistId);
      setSelection([]);
    },
    copy: () => copySongs(chosenSongs),
    paste: () => {
      if (inPlaylistId) addToPlaylist(copiedSongs, inPlaylistId);
    },
    selectAll: () => setSelection(listed.map((song) => song.id)),
    deselectAll: () => setSelection([]),
    focusSearch: () => {
      // The field is in the sidebar, which may be hidden, and a menu keeps the keyboard until it
      // closes: it takes the focus once it is there and no menu is open, within a few frames.
      if (!sidebarShown) setSidebarShown(true);
      let frames = 0;
      const take = () => {
        const input = search.current?.querySelector("input");
        if (input && !document.querySelector('[role="menu"][data-open]')) input.focus();
        if (document.activeElement !== input && ++frames < 30) requestAnimationFrame(take);
      };
      take();
    },
    setPanel,
    setSidebarShown: (shown) => {
      setSidebarShown(shown);
      if (shown) return;
      // A field of the sidebar may have had the keyboard: it stays with the window, once a menu
      // that holds it has closed.
      let frames = 0;
      const keep = () => {
        if (document.querySelector('[role="menu"][data-open]')) {
          if (++frames < 30) requestAnimationFrame(keep);
          return;
        }
        if (document.activeElement === document.body) frame.current?.focus({ preventScroll: true });
      };
      requestAnimationFrame(keep);
    },
    goToCurrent,
    toggleMini,
    equalizerOpen: equalizerAt !== null,
    toggleEqualizer,
    visualizerShown: analyser !== null,
    toggleVisualizer,
    visualizerDrawing,
    setVisualizerDrawing,
    openShortcuts: setShortcuts,
    columnBrowserShown: columnBrowser,
    columnBrowserAvailable: place === "songs" && !searching && !duplicatesOnly,
    toggleColumnBrowser: () => {
      setColumnBrowser(!columnBrowser);
      setBrowserChoice(BROWSE_ALL);
    },
    listName: listShownName,
    exportPlaylist: () =>
      void saveToDownloads(
        fileNameOf(listShownName ?? "Playlist", "m3u"),
        "audio/x-mpegurl",
        writeM3u(listedSongs()),
      ),
    getArtwork: songsWantingArtwork(library.songs).length > 0 ? () => void getAlbumArtwork() : null,
    exportLibrary: () =>
      void saveToDownloads(
        "Library.xml",
        "text/xml",
        writeLibraryXml(
          library.songs,
          library.playlists.map((list) => ({
            name: list.name,
            songs: listSongs(list),
            smart: Boolean(list.smart),
          })),
        ),
      ),
    importPlaylist: () => setPickingPlaylist(true),
    print: () => printPage(songListPage(listShownName ?? "Songs", listedSongs(), pageSetup)),
    pageSetup: () => setSettingUpPage(true),
    onlyDownloaded,
    setOnlyDownloaded: (only) => {
      setOnlyDownloaded(only);
      setAlbumId(null);
      setSelection([]);
    },
    organize: () => setOrganizing(true),
    ratings: settings.starRatings,
    bringForward: () => requestDesktopEffects([{ open: "music" }]),
    duplicatesShown: duplicatesOnly && place === "songs",
    toggleDuplicates: () => {
      const showing = duplicatesOnly && place === "songs";
      setDuplicatesOnly(!showing);
      if (!showing) {
        setPlace("songs");
        setQuery("");
        setAlbumId(null);
        setSelection([]);
      }
    },
    holding:
      menuTargets.length === 1 ? playlistsHolding(library.playlists, menuTargets[0] ?? "") : [],
    showInPlaylist: (id, list) => {
      setDuplicatesOnly(false);
      setQuery("");
      setAlbumId(null);
      setPlace(`playlist:${list}`);
      setSelection([id]);
      setReveal({ id });
    },
  });

  // ---- Dragging songs -------------------------------------------------------------------

  /** A press on selected rows that may become a drag: out to Finder, or within this window. */
  const pressSongs = (
    down: globalThis.PointerEvent,
    ids: readonly string[],
    reselect: () => void,
  ) => {
    beginDesktopDrag(down, {
      from: "music",
      items: () =>
        ids.flatMap((id) => {
          const song = byId.get(id);
          if (!song) return [];
          const { source } = song;
          // A song of the Internet Archive is no drive file: other apps pass it by.
          return source.kind === "file"
            ? [{ id: source.file, name: source.name, kind: "file" as const, type: source.type }]
            : [{ id: `archive-song:${id}`, name: song.title, kind: "file" as const }];
        }),
      onStart: () => {
        draggedSongs = ids;
        reselect();
      },
    });
  };

  /**
   * Add the sound files of a drag to the library; answers the songs added or already held, one per
   * drive file. A request for a file still being added says so and does nothing else.
   */
  const takeDrivenSongs = async (items: readonly DesktopDragItem[]): Promise<string[]> => {
    const ids = await Promise.all(
      fileItemsOfDrag(items)
        .filter(isSongFile)
        .map((item) => {
          const held = libraryRef.current.songs.find(
            ({ source }) => source.kind === "file" && source.file === item.id,
          );
          if (held) return Promise.resolve<string | null>(held.id);
          if (addingDriveFiles.has(item.id)) {
            setProblem(`“${item.name}” is still importing. Open it again in a moment.`);
            return Promise.resolve<string | null>(null);
          }
          addingDriveFiles.add(item.id);
          return (async () => {
            try {
              const added = await songOfDriveFile(
                { id: item.id, name: item.name, size: item.size ?? 0, type: item.type },
                `up-${crypto.randomUUID()}`,
              );
              const artwork = added.cover
                ? await uploadArtwork(added.cover).catch(() => null)
                : null;
              // Another window may have added the file since; its song stays the one.
              const already = libraryRef.current.songs.find(
                ({ source }) => source.kind === "file" && source.file === item.id,
              );
              if (already) return already.id;
              return commit((now) => ({
                ...now,
                songs: [...now.songs, { ...added.song, artwork }],
              }))
                ? added.song.id
                : null;
            } catch (error) {
              setProblem(
                `“${item.name}” could not be added: ${error instanceof Error ? error.message : String(error)}`,
              );
              return null;
            } finally {
              addingDriveFiles.delete(item.id);
            }
          })();
        }),
    );
    return ids.filter((id): id is string => id !== null);
  };

  /** Songs dragged in this window to a row: a playlist's, Loved's, or the window itself. */
  const landInPlaylist = (songs: () => Promise<readonly string[]>, playlist: string | null) => {
    void songs().then((ids) => {
      if (ids.length === 0) return;
      if (playlist === LOVED_ROW) {
        commitUndoable((now) => withLoved(withSongs(now, ids), ids));
      } else if (playlist) addToPlaylist(ids, playlist);
    });
  };

  const dropOf = useRef<DesktopDropTarget["landing"]>(() => undefined);
  dropOf.current = (hit, drag) => {
    if (busy || !frameElement) return undefined;
    const own = drag.from === "music";
    const row = hit.closest<HTMLElement>("[data-music-drop]");
    const target = row?.dataset.musicDrop ?? null;
    const panel = hit.closest<HTMLElement>('[data-music-panel="up-next"]');
    const songs = own ? async () => draggedSongs : async () => takeDrivenSongs(drag.items);
    const songFiles = own
      ? []
      : fileItemsOfDrag(drag.items).filter((item) => !item.bytes && isSongFile(item));
    const refusal =
      !own && songFiles.length === 0
        ? drag.items.length === 1
          ? `“${drag.items[0]?.name}” is not a song file Music can add.`
          : "These items are not song files Music can add."
        : undefined;
    const sayRefusal = setProblem;
    if (panel) {
      return {
        element: panel,
        copies: true,
        refusal,
        sayRefusal,
        drop: () => {
          void songs().then((ids) => {
            for (const id of ids) player.playLater(id);
          });
        },
      };
    }
    if (row && target) {
      return {
        element: row,
        copies: true,
        refusal,
        sayRefusal,
        drop: () => landInPlaylist(songs, target),
      };
    }
    // Within a playlist shown in its own order, a drag between its rows moves the songs. Sorted by
    // a column, the rows have no order of their own to move in.
    const shown = !searching && playlist ? playlist.id : null;
    if (own && shown && hit.closest('[data-song-order="own"]')) {
      const moved = draggedSongs;
      if (!moved.every((id) => playlist?.songs.includes(id))) return undefined;
      const before = hit.closest<HTMLElement>("[data-song]")?.dataset.song ?? null;
      return {
        element:
          hit.closest<HTMLElement>("[data-song]") ?? (hit.closest('[role="grid"]') as Element),
        drop: () =>
          commitUndoable((now) => ({
            ...now,
            playlists: now.playlists.map((list) =>
              list.id === shown ? { ...list, songs: movedBefore(list.songs, moved, before) } : list,
            ),
          })),
      };
    }
    if (own) return undefined;
    return {
      element: frameElement,
      copies: true,
      refusal,
      sayRefusal,
      drop: () => void songs(),
    };
  };
  useEffect(() => {
    if (!frameElement) return undefined;
    return registerDropTarget({
      element: frameElement,
      landing: (hit, drag) => dropOf.current(hit, drag),
    });
  }, [frameElement]);

  // A sound file opened from Finder, or dropped on Music's Dock tile: it plays, added first when the
  // library does not hold it. Those opened before the window was ready wait until it is.
  const openRequested = useRef<(request: OpenFileRequest) => void>(() => {});
  openRequested.current = (request) => {
    const entry = currentDrive()?.entries.find((each) => each.id === request.id);
    void takeDrivenSongs([
      {
        id: request.id,
        name: request.name,
        kind: "file",
        type: entry?.type,
        size: entry?.size,
      },
    ]).then((ids) => {
      if (ids.length === 0) return;
      // The player is told of a song just added before the render that would tell it.
      player.setLibrary(libraryRef.current.songs);
      playIds(ids, 0);
    });
  };
  useEffect(() => {
    if (busy) return undefined;
    for (const request of takeOpenFileRequests("music")) openRequested.current(request);
    return onOpenFileRequest("music", (request) => openRequested.current(request));
  }, [busy]);

  const lcd = current ? (
    <NowPlayingLcd
      data-window-no-drag=""
      title={current.title}
      subtitle={
        playing.error ??
        (playing.loading && !playing.playing
          ? "Loading…"
          : `${current.artist || UNKNOWN_ARTIST} — ${current.album || UNKNOWN_ALBUM}`)
      }
      artwork={
        <AlbumCover
          id={albumKey(current)}
          cover={currentTrack?.album.cover ?? { ground: "#5a5f66", ink: "#8a9099", motif: "rings" }}
          src={artworkUrl(current)}
        />
      }
      elapsed={playing.position}
      duration={playing.duration}
      onSeek={(seconds) => player.seek(seconds)}
    />
  ) : (
    <NowPlayingLcd />
  );

  const lcdDisplay =
    current && !player.isBorrowed(current.id) ? (
      <ContextualMenu>
        <ContextualMenuTrigger className="mac-music-sidebar-menu">{lcd}</ContextualMenuTrigger>
        <ContextualMenuPopup aria-label="Now Playing">
          <MenuItem onClick={goToCurrent}>Go to Current Song</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => onAction({ type: "info", ids: [current.id] })}>
            Song Info
          </MenuItem>
          <MenuItem onClick={() => onAction({ type: "love", ids: [current.id] })}>
            {loved.has(current.id) ? "Unlove" : "Love"}
          </MenuItem>
          {settings.starRatings ? (
            <RatingSubmenu
              value={current.rating ?? null}
              onChange={(stars) => onAction({ type: "rate", ids: [current.id], stars })}
            />
          ) : null}
          <MenuSeparator />
          <MenuItem
            disabled={!libraryIds.has(current.id)}
            onClick={() => onAction({ type: "show-in-album", ids: [current.id] })}
          >
            Show in Album
          </MenuItem>
          <MenuItem
            disabled={current.source.kind !== "file"}
            onClick={() => onAction({ type: "show-in-finder", ids: [current.id] })}
          >
            Show in Finder
          </MenuItem>
        </ContextualMenuPopup>
      </ContextualMenu>
    ) : (
      lcd
    );

  const askingHasFiles = (asking ?? []).some((id) => byId.get(id)?.source.kind === "file");
  const statusMinutes = Math.round(
    listed.reduce((sum, { id }) => sum + (byId.get(id)?.duration ?? 0), 0) / 60,
  );
  const statusLine = `${listed.length} ${listed.length === 1 ? "song" : "songs"}, ${statusMinutes} ${statusMinutes === 1 ? "minute" : "minutes"}`;

  return (
    <>
      <Window
        aria-label="Music"
        tabIndex={-1}
        aria-busy={busy || undefined}
        state={open && state === "key" ? "main" : state}
        width={width}
        height={height}
        className={cn("mac-music", className)}
        ref={frameRef}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || busy) return;
          const command = event.metaKey || event.ctrlKey;
          const typing = (event.target as Element).closest("input, textarea, [contenteditable]");
          // Space on a button presses the button; everywhere else it is Controls > Play.
          if (event.key === " " && (event.target as Element).closest("button")) return;
          if (menuKey(event.nativeEvent, typing !== null)) {
            event.preventDefault();
          } else if (command && event.key === "," && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDrop={(event) => {
          if (event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          if (busy) {
            setProblem("Your library is still loading; add the songs again in a moment.");
            return;
          }
          void addFiles([...event.dataTransfer.files]);
        }}
        {...props}
      >
        <MediaAppChrome inert={open} style={sidebarShown ? undefined : SIDEBAR_HIDDEN}>
          <MediaAppChromeSidebar
            material={material}
            controls={
              <WindowControls
                onClose={onClose}
                onMinimize={onMinimize}
                onZoom={onZoom}
                zoomRole={zoomRole}
                minimizeDisabled={minimizeDisabled}
                zoomDisabled={zoomDisabled}
                {...controlsProps}
              />
            }
            search={
              sidebarShown ? (
                <div ref={search}>
                  <SearchField
                    variant="sidebar"
                    inert={busy}
                    aria-label={
                      place === "archive" ? "Search the Internet Archive" : "Search your library"
                    }
                    placeholder={place === "archive" ? "Internet Archive" : undefined}
                    value={query}
                    onValueChange={(next) => setQuery(next)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && place === "archive" && query.trim()) {
                        searchArchive(query.trim());
                        setQuery("");
                      }
                    }}
                    style={{ width: "100%" }}
                  />
                </div>
              ) : undefined
            }
            {...dragRegion}
          >
            {sidebarShown ? (
              <PlaylistSidebarMenu library={library} actions={playlistMenu}>
                <Sidebar
                  aria-label="Music"
                  inert={busy}
                  material={material}
                  style={SOURCE_LIST}
                  value={homeSharing.place ? sharedRow(homeSharing.place) : place}
                  onValueChange={(next) => {
                    const shared = sharedPlaceOf(String(next));
                    if (shared) {
                      setQuery("");
                      setSelection([]);
                      void homeSharing.open(shared);
                      return;
                    }
                    homeSharing.close();
                    choose(next as Place);
                  }}
                >
                  <SidebarSection title="Internet Archive" className="mac-music-source-list-start">
                    <SidebarItem
                      value="archive"
                      label="Browse"
                      icon={<SectionIcon section="browse" />}
                    />
                  </SidebarSection>
                  <SidebarSection title="Internet Radio">
                    <SidebarItem
                      value="radio"
                      label="Radio"
                      icon={<SectionIcon section="radio" />}
                    />
                  </SidebarSection>
                  <SidebarSection title="Apple Music">
                    <SidebarItem
                      value="for-you"
                      label="For You"
                      disabled
                      title={NO_APPLE_MUSIC}
                      icon={<SectionIcon section="for-you" />}
                    />
                    <SidebarItem
                      value="itunes-store"
                      label="iTunes Store"
                      disabled
                      title={NO_ITUNES_STORE}
                      icon={<SectionIcon section="itunes-store" />}
                    />
                  </SidebarSection>
                  <SidebarSection title="Library">
                    {LIBRARY_ROWS.map((row) => (
                      <SidebarItem
                        key={row.id}
                        value={row.id}
                        label={row.name}
                        icon={<SectionIcon section={row.icon} />}
                      />
                    ))}
                  </SidebarSection>
                  <SidebarSection title="Playlists">
                    <SidebarItem
                      value="loved"
                      label="Loved Songs"
                      icon={<SectionIcon section="for-you" />}
                      data-music-drop={LOVED_ROW}
                    />
                    <SidebarItem
                      value="recent"
                      label="Recently Played"
                      icon={<PlaylistIcon smart />}
                    />
                    <SidebarItem
                      value="top"
                      label="Top 25 Most Played"
                      icon={<PlaylistIcon smart />}
                    />
                    <PlaylistRows
                      library={library}
                      onMove={(row, folder) =>
                        commitUndoable((now) => moveToFolder(now, row, folder))
                      }
                    />
                  </SidebarSection>
                  {homeSharing.people.length > 0 ? (
                    <SidebarSection title="Home Sharing">
                      {homeSharing.people.flatMap((person) => [
                        <SidebarItem
                          key={person.name}
                          value={sharedRow({ owner: person.name, playlist: null })}
                          label={person.full_name}
                          icon={<SectionIcon section="songs" />}
                        />,
                        ...(homeSharing.library?.owner.name === person.name
                          ? homeSharing.library.playlists.map((list) => (
                              <SidebarItem
                                key={`${person.name}:${list.id}`}
                                value={sharedRow({ owner: person.name, playlist: list.id })}
                                label={list.name}
                                icon={<PlaylistIcon />}
                              />
                            ))
                          : []),
                      ])}
                    </SidebarSection>
                  ) : null}
                </Sidebar>
              </PlaylistSidebarMenu>
            ) : null}
          </MediaAppChromeSidebar>
          <MediaAppChromeBar
            ref={setToolbarElement}
            aria-label="Playback controls"
            inert={busy}
            {...dragRegion}
          >
            <MediaAppChromeTransport>
              <MediaAppChromeButton
                aria-label="Shuffle"
                aria-pressed={playing.shuffle}
                data-on={playing.shuffle ? "" : undefined}
                className="mac-music-desktop-mode"
                onClick={() => player.setShuffle(!playing.shuffle)}
              >
                <ShuffleGlyph />
              </MediaAppChromeButton>
              <MediaAppChromeButton
                glyph="previous"
                aria-label="Previous"
                disabled={playing.queue.length === 0}
                onClick={() => player.previous()}
              />
              <MediaAppChromeButton
                glyph={playing.playing ? "pause" : "play"}
                aria-label={playing.playing ? "Pause" : "Play"}
                disabled={!current && library.songs.length === 0}
                onClick={() => {
                  if (current) player.toggle();
                  else
                    playIds(
                      library.songs.map((song) => song.id),
                      0,
                    );
                }}
              />
              <MediaAppChromeButton
                glyph="next"
                aria-label="Next"
                disabled={playing.queue.length === 0}
                onClick={() => player.next()}
              />
              <MediaAppChromeButton
                aria-label={`Repeat: ${playing.repeat === "off" ? "Off" : playing.repeat === "all" ? "All" : "One"}`}
                aria-pressed={playing.repeat !== "off"}
                data-on={playing.repeat !== "off" ? "" : undefined}
                className="mac-music-desktop-mode"
                onClick={() => player.cycleRepeat()}
              >
                <RepeatGlyph one={playing.repeat === "one"} />
              </MediaAppChromeButton>
            </MediaAppChromeTransport>
            <MediaAppChromeDisplay>{lcdDisplay}</MediaAppChromeDisplay>
            <MediaAppChromeControls>
              <MediaAppChromeVolume
                data-window-no-drag=""
                value={playing.volume}
                onValueChange={(next) => player.setVolume(next)}
              >
                <MusicOutputButton output={output} onChoose={setOutput} />
              </MediaAppChromeVolume>
              <MediaAppChromeButton
                glyph="lyrics"
                aria-label="Lyrics"
                aria-pressed={panel === "lyrics"}
                onClick={() => setPanel(panel === "lyrics" ? null : "lyrics")}
              />
              <MediaAppChromeButton
                glyph="up-next"
                aria-label="Up Next"
                aria-pressed={panel === "up-next"}
                onClick={() => setPanel(panel === "up-next" ? null : "up-next")}
              />
              <MediaAppChromeButton
                aria-label="MiniPlayer"
                aria-pressed={mini !== null}
                onClick={toggleMini}
              >
                <MiniGlyph />
              </MediaAppChromeButton>
            </MediaAppChromeControls>
          </MediaAppChromeBar>
          <MediaAppChromePane>
            <div className="mac-music-desktop-pane" style={FILL}>
              {adding || problem ? (
                <div className="mac-music-desktop-status" role="status">
                  {adding ? (
                    <>
                      <span>
                        Adding “{adding.name}”
                        {adding.total > 1 ? ` (${adding.number} of ${adding.total})` : ""}… Closing
                        Music stops adding the songs not yet added.
                      </span>
                      <ProgressBar
                        aria-label={`Uploading ${adding.name}`}
                        value={Math.round(adding.fraction * 100)}
                        size="small"
                        className="mac-music-desktop-progress"
                      />
                    </>
                  ) : (
                    <>
                      <span role="alert">{problem}</span>
                      <PushButton size="small" onClick={() => setProblem(null)}>
                        OK
                      </PushButton>
                    </>
                  )}
                </div>
              ) : null}
              <div className="mac-music-layout" inert={busy}>
                {analyser ? (
                  <MusicVisualizer
                    analyser={analyser}
                    title={current?.title ?? "Not Playing"}
                    drawing={visualizerDrawing}
                  />
                ) : homeSharing.place ? (
                  <SharedLibraryPane
                    library={homeSharing.library}
                    playlist={homeSharing.place.playlist}
                    currentId={current?.id}
                    onPlay={playIds}
                  />
                ) : (
                  content
                )}
                {panel ? (
                  <SidePanel
                    kind={panel}
                    current={currentTrack ?? null}
                    upcoming={upcoming}
                    entries={upNext.map((entry) => entry.index)}
                    lyrics={lyricsOf(current)}
                    history={history}
                    onPlayHistory={(index) => {
                      const track = history[index];
                      if (track) playIds([track.song.id], 0);
                    }}
                    onClearHistory={() => player.clearHistory()}
                    onRemove={(index) => {
                      const entry = upNext[index];
                      if (entry) player.removeFromQueue(entry.index);
                    }}
                    onMove={(from, to) => {
                      const start = upNext[from];
                      const before = upNext[to];
                      if (start) {
                        player.moveInQueue(start.index, before?.index ?? playing.queue.length);
                      }
                    }}
                    onJump={(index) => {
                      const entry = upNext[index];
                      if (entry) player.jump(entry.index);
                    }}
                  />
                ) : null}
              </div>
              {statusBarShown ? <StatusBar>{statusLine}</StatusBar> : null}
            </div>
          </MediaAppChromePane>
        </MediaAppChrome>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          aria-label="Add to Library"
          onChange={(event) => {
            const files = [...(event.currentTarget.files ?? [])];
            event.currentTarget.value = "";
            if (files.length > 0) void addFiles(files);
          }}
        />
        <div role="status" className="mac-music-announcement">
          {settings.notifications && current && playing.playing
            ? `Now playing: ${current.title} by ${current.artist || UNKNOWN_ARTIST}`
            : ""}
        </div>
      </Window>
      {infoFor ? (
        <MusicSongInfo
          songs={infoFor.flatMap((id) => {
            const song = byId.get(id);
            return song ? [song] : [];
          })}
          lyrics={infoSong ? lyricsOf(infoSong) : undefined}
          anchor={toolbarElement}
          onCancel={() => {
            setInfoFor(null);
            backToWindow();
          }}
          onSave={(change) => {
            void saveSongInfo(infoFor, change);
            backToWindow();
          }}
        />
      ) : null}
      {organizing ? (
        <MusicOrganize
          anchor={toolbarElement}
          onCancel={() => {
            setOrganizing(false);
            backToWindow();
          }}
          onOrganize={(choice) => {
            setOrganizing(false);
            backToWindow();
            void organizeFiles(choice);
          }}
        />
      ) : null}
      {shortcuts ? (
        <MusicShortcuts
          anchor={toolbarElement}
          shortcuts={shortcuts}
          onClose={() => {
            setShortcuts(null);
            backToWindow();
          }}
        />
      ) : null}
      <HomeSharingSheet
        open={askingHomeSharing}
        anchor={toolbarElement}
        onCancel={() => {
          setAskingHomeSharing(false);
          backToWindow();
        }}
        onTurnOn={() => {
          setAskingHomeSharing(false);
          backToWindow();
          void writeSharingOn(true).then(homeSharing.setOn, (error: Error) =>
            setProblem(error.message),
          );
        }}
      />
      <Sheet open={settingUpPage} onOpenChange={setSettingUpPage}>
        <SheetPopup anchor={toolbarElement ?? undefined} width={420} aria-label="Page Setup">
          {settingUpPage ? (
            <TextEditPageSetup
              value={pageSetup}
              onChoose={(chosen) => {
                setSettingUpPage(false);
                setPageSetup(chosen);
              }}
              onCancel={() => setSettingUpPage(false)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet
        open={streamOpen}
        onOpenChange={(next) => {
          if (!next) {
            setStreamOpen(false);
            backToWindow();
          }
        }}
      >
        <SheetPopup anchor={toolbarElement ?? undefined} width={420} aria-label="Open Stream">
          <form
            className="mac-music-open-stream"
            onSubmit={(event) => {
              event.preventDefault();
              openStream();
            }}
          >
            <div className="mac-music-open-stream-field">
              URL:
              <TextField
                aria-label="URL"
                autoFocus
                value={streamTyped}
                onChange={(event) => setStreamTyped(event.currentTarget.value)}
              />
            </div>
            <div className="mac-music-open-stream-buttons">
              <PushButton type="button" onClick={() => setStreamOpen(false)}>
                Cancel
              </PushButton>
              <DefaultButton type="submit" disabled={streamAddress(streamTyped) === null}>
                OK
              </DefaultButton>
            </div>
          </form>
        </SheetPopup>
      </Sheet>
      {viewOptionsOpen ? (
        <MusicViewOptions
          anchor={toolbarElement}
          columns={columns}
          sort={songSort}
          onColumns={setColumns}
          onSort={setSongSort}
          onClose={() => {
            setViewOptionsOpen(false);
            backToWindow();
          }}
        />
      ) : null}
      {smartEditing ? (
        <MusicSmartEditor
          initial={smartEditing.smart}
          anchor={toolbarElement}
          onCancel={() => {
            setSmartEditing(null);
            backToWindow();
          }}
          onSave={(smart) => {
            saveSmart(smart);
            backToWindow();
          }}
        />
      ) : null}
      <Alert
        open={askingFolder !== null}
        onOpenChange={(next) => {
          if (!next) setAskingFolder(null);
        }}
      >
        <AlertPopup alertStyle="warning" icon={<SectionIcon section="songs" />}>
          <AlertMessage>Do you want to delete this folder and everything in it?</AlertMessage>
          <AlertInformativeText>
            The playlists in it go too. Their songs stay in your library.
          </AlertInformativeText>
          <AlertButtons leading={<AlertClose render={<PushButton />}>Cancel</AlertClose>}>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (askingFolder) deleteFolder(askingFolder);
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={asking !== null}
        onOpenChange={(next) => {
          if (!next) setAsking(null);
        }}
      >
        <AlertPopup alertStyle="warning" icon={<SectionIcon section="songs" />}>
          <AlertMessage>
            {asking?.length === 1
              ? `Do you want to delete “${byId.get(asking[0] ?? "")?.title ?? "this song"}” from your library?`
              : `Do you want to delete these ${asking?.length ?? 0} songs from your library?`}
          </AlertMessage>
          <AlertInformativeText>
            {askingHasFiles
              ? "You can move their files to the Trash, or keep them on your drive."
              : "They stay at the Internet Archive, and you can add them again."}
          </AlertInformativeText>
          <AlertButtons leading={<AlertClose render={<PushButton />}>Cancel</AlertClose>}>
            {askingHasFiles ? (
              <>
                <AlertClose
                  render={<PushButton />}
                  onClick={() => asking && deleteSongs(asking, false)}
                >
                  Keep File
                </AlertClose>
                <AlertClose
                  render={<DefaultButton data-autofocus="" />}
                  onClick={() => asking && deleteSongs(asking, true)}
                >
                  Move to Trash
                </AlertClose>
              </>
            ) : (
              <AlertClose
                render={<DefaultButton data-autofocus="" />}
                onClick={() => asking && deleteSongs(asking, false)}
              >
                Delete
              </AlertClose>
            )}
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {pickingPlaylist
        ? createPortal(
            <div className="mac-music-panel-layer">
              <DriveOpenPanel
                accept={(entry) => isPlaylistFile(entry.name)}
                onOpen={(entry) => {
                  setPickingPlaylist(false);
                  void importPlaylistFile(entry);
                }}
                onCancel={() => setPickingPlaylist(false)}
              />
            </div>,
            document.body,
          )
        : null}
      {/* This portal is outside the busy window; open its draft only after settings load. */}
      {open && prefsAt && !settingsLoading
        ? createPortal(
            <MusicPreferences
              state={state}
              settings={settings}
              unavailable={UNAVAILABLE_SETTINGS}
              onHelp={() => requestHelp("Music")}
              onApply={(next) => {
                setSettings(next);
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
              onPointerDown={props.onPointerDown}
              onPointerDownCapture={props.onPointerDownCapture}
              style={{
                position: "absolute",
                left: prefsAt.left,
                top: prefsAt.top,
                zIndex: props.style?.zIndex,
              }}
            />,
            prefsAt.container,
          )
        : null}
      {mini
        ? createPortal(
            <MiniPlayer
              onKeyDown={(event) => {
                if (event.key === " " && (event.target as Element).closest("button")) return;
                if (menuKey(event.nativeEvent, false)) event.preventDefault();
              }}
              origin={{ left: mini.left, top: mini.top }}
              state={state}
              hasSong={Boolean(current)}
              title={current?.title}
              subtitle={
                current
                  ? `${current.artist || UNKNOWN_ARTIST} — ${current.album || UNKNOWN_ALBUM}`
                  : undefined
              }
              artwork={
                current ? (
                  <AlbumCover
                    id={albumKey(current)}
                    cover={
                      currentTrack?.album.cover ?? {
                        ground: "#5a5f66",
                        ink: "#8a9099",
                        motif: "rings",
                      }
                    }
                    src={artworkUrl(current)}
                  />
                ) : undefined
              }
              playing={playing.playing}
              elapsed={playing.position}
              duration={playing.duration}
              onToggle={() => player.toggle()}
              onPrevious={() => player.previous()}
              onNext={() => player.next()}
              onSeek={(seconds) => player.seek(seconds)}
              onClose={() => setMini(null)}
              onPointerDown={props.onPointerDown}
              style={{
                zIndex: onTop
                  ? ON_TOP_Z_INDEX
                  : typeof props.style?.zIndex === "number"
                    ? props.style.zIndex + 1
                    : undefined,
              }}
            />,
            mini.container,
          )
        : null}
      {equalizerAt
        ? createPortal(
            <EqualizerWindow
              origin={{ left: equalizerAt.left, top: equalizerAt.top }}
              state={state}
              value={equalizer}
              onChange={setEqualizer}
              onClose={() => setEqualizerAt(null)}
              onPointerDown={props.onPointerDown}
              style={{
                zIndex:
                  typeof props.style?.zIndex === "number" ? props.style.zIndex + 1 : undefined,
              }}
            />,
            equalizerAt.container,
          )
        : null}
      {banner
        ? createPortal(
            <div
              className="mac-music-desktop-banner"
              style={{ left: banner.at.left, top: banner.at.top }}
            >
              <NotificationBanner
                app="Music"
                time="now"
                title={banner.song.title}
                icon={<SectionIcon section="songs" />}
                onOpen={() => setBanner(null)}
                onClear={() => setBanner(null)}
              >
                {`${banner.song.artist || UNKNOWN_ARTIST} — ${banner.song.album || UNKNOWN_ALBUM}`}
              </NotificationBanner>
            </div>,
            banner.at.container,
          )
        : null}
    </>
  );
}
