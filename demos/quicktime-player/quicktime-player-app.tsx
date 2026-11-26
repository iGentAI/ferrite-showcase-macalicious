"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { HudWindow, HudWindowText } from "macalicious/hud-window";
import { IconView } from "macalicious/icon-view";
import { InspectorPanel } from "macalicious/inspector-panel";
import { Label } from "macalicious/label";
import { ListView, ListViewRowTitle } from "macalicious/list-view";
import { useManagedWindow } from "macalicious/managed-window";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { OpenPanelBrowser, type OpenPanelView } from "macalicious/open-panel";
import { ProgressBar } from "macalicious/progress-bar";
import { PushButton } from "macalicious/push-button";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TextField } from "macalicious/text-field";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type KeyboardEvent,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import {
  beginDesktopDrag,
  type DesktopDragItem,
  filesOfDrag,
  useDesktopDrop,
} from "../desktop/desktop-drag";
import { EditRows } from "../desktop/desktop-edit-rows";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { type KeptVersion, previousSaveOf, versionDate } from "../desktop/desktop-files";
import { changeDesktopValue, desktopValues, useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import { FileShareItems } from "../desktop/desktop-share-link";
import { DesktopVersionsSheet } from "../desktop/desktop-versions-sheet";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { formatSize } from "../finder/finder-data";
import { onOpenFileRequest, takeOpenFileRequests } from "../finder/finder-open";
import { type MovieCommand, type MovieScaling, QuickTimePlayer } from "./quicktime-player";
import { MovieProxyIcon } from "./quicktime-player-artwork";
import { QuickTimeChooser, type QuickTimeChooserRow } from "./quicktime-player-chooser";
import {
  clipClipboard,
  clipsChosen,
  clipsOf,
  cutsAfter,
  insertedAfter,
  MAX_CUTS,
  movedTo,
  movieLengthOf,
  QuickTimeClipStrip,
  storedCuts,
  withCut,
} from "./quicktime-player-clips";
import {
  defaultDrive,
  type QuickTimeDrive,
  type QuickTimeMovieFile,
} from "./quicktime-player-drive";
import { dataRateText, formatOf, modifiedText } from "./quicktime-player-facts";
import type { MovieEdit, MoviePiece } from "./quicktime-player-picture";
import {
  isMovie,
  mergeRecents,
  opensInQuickTime,
  placedIn,
  QUICKTIME_OPEN_KEY,
  QUICKTIME_RECENTS_URL,
  QUICKTIME_VOLUME_KEY,
  type QuickTimeOpenMovie,
  type QuickTimeRecent,
  readOpenMovies,
  readVolume,
  recentsFromServer,
  recentsReadable,
  recentsToServer,
  remember,
  withOpenMovie,
} from "./quicktime-player-recents";
import { QuickTimeRecording } from "./quicktime-player-recording";
import {
  derivedName,
  nameFitsType,
  nameInType,
  plainType,
  RECORDING_SIZES,
  type RecordingKind,
  recordingType,
  timeText,
} from "./quicktime-player-recording-files";
import { replayMovie } from "./quicktime-player-replay";
import { fitScale, movieFrameSize, steppedScale } from "./quicktime-player-size";
import { useMovieLanguages } from "./quicktime-player-tracks";
import { LEAST_LENGTH, QuickTimeTrimBar } from "./quicktime-player-trim";
import { unsavedTakes } from "./quicktime-player-unsaved-takes";
import { MovieColumns, MovieGallery, type OpenRow } from "./quicktime-player-views";

export type { QuickTimeDrive, QuickTimeMovieFile } from "./quicktime-player-drive";

/** The frame of the Open panel, and of a movie window, in points. */
export const PANEL_SIZE = { width: 760, height: 460 } as const;
export const MOVIE_SIZE = { width: 1470, height: 827 } as const;

/**
 * View > Float on Top, while rendered: the manager's floating layer, over every ordinary window and
 * under Mission Control, the menu bar and the Dock. The window keeps its look, because that comes from
 * the managed window's own `panel` prop, not this record.
 */
export function FloatsOnTop() {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  useLayoutEffect(() => {
    store.patch(id, { panel: true });
    return () => store.patch(id, { panel: false });
  }, [store, id]);
  return null;
}
/** The time base of the movie window's time codes. */
const FRAME_RATE = 30;
/** Increase Size's step. */
const SIZE_STEP = 1.25;
/** What a window leaves of the page: the menu bar, the Dock and a margin. */
const ROOM_MARGIN = { width: 40, height: 140 };
const LEAST_ROOM = { width: 480, height: 270 };

export interface QuickTimePlayerAppProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * Where movies are kept. Without one, "From This Computer…" plays the chosen file in the page
   * only, and the sidebar is not shown.
   * @default the person's drive where the desktop app serves the page, otherwise none
   */
  drive?: QuickTimeDrive | null;
  /**
   * Whether the desktop's Ferrite application keeps the person's recent movies.
   * @default whether the desktop app serves the page (`servedByDesktopApp()`)
   */
  served?: boolean;
  /** Given by the desktop: the window asks for the Open panel's frame, then a movie's. */
  onFrameSizeChange?: (size: { width: number; height: number }) => void;
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** Given by the desktop to an app with shared settings; this one has none. */
  // biome-ignore lint/suspicious/noExplicitAny: the desktop's settings type is each app's own.
  settings?: any;
  /** Given by the desktop to a window opened for one more movie of several: the file it opens. */
  opening?: unknown;
}

/** The movie open in the window. */
interface OpenMovie {
  url: string;
  name: string;
  /** The drive file it was read from, when it was. */
  file?: string;
  /** That file's version when it held these bytes, which a save in place is made from. */
  version?: number | undefined;
  /** Where it opens, in seconds. */
  start: number;
  /** Its bytes, which an edit replays; none for a movie played from an address on the web. */
  blob?: Blob;
  /** Whether it holds edits not yet saved. */
  edited?: boolean;
}

/** A pane of the versions sheet: one version of the movie, to play there. */
function VersionMovie({ blob, label }: { blob: Blob; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);
  return url ? (
    // biome-ignore lint/a11y/useMediaCaption: the person's own movie, which has no captions file.
    <video className="mac-quicktime-player-version-page" src={url} controls aria-label={label} />
  ) : null;
}

/** How many edits Undo can go back. */
const UNDO_DEPTH = 5;
/** One state of the movie that Undo or Redo can go back to. */
interface MovieStep {
  blob: Blob;
  /** Whether it held changes not yet saved. */
  edited: boolean;
  /** Where it was split into clips, in seconds. */
  cuts: readonly number[];
}
/** Why Fill Screen and Panoramic are dimmed in a window, which takes the movie's own shape. */
const SCALED_IN_FULL_SCREEN = "This works in full screen, where the screen has its own shape.";
const NO_PICTURE = "Sound has no picture to scale.";
/** Why the rows of a movie's text and sound tracks are dimmed. */
const NO_TRACKS = "This movie has no subtitles or other languages that this page can read.";
/** Why File > Revert To > Browse All Versions is dimmed, and what the row says when it is not. */
const NO_FILE_VERSIONS = "This movie has no file on the drive, so it has no versions.";
const SAVE_FIRST_VERSIONS = "Save this movie’s changes, or revert them, to see its versions.";
const KEPT_VERSIONS = "The versions the drive keeps of this movie.";
/** Why File > Revert To > Previous Save is dimmed. */
const NO_PREVIOUS_SAVE = "No earlier save of this movie is kept.";
/** Says why a movie's Save left its file alone. */
const otherFormat = (name: string, saved: string) =>
  `“${name}” stays as it was: edits are recorded in another format than its file, so they are saved as “${saved}”.`;
/** Why the rows that act on a clip are dimmed. */
const NO_CLIP_CHOSEN = "Choose a clip in the strip first: View > Show Clips.";
const ONLY_CLIP = "A movie keeps at least one clip.";
const NO_CLIPS_YET = "There are no clips to select until the movie has opened for editing.";
/** Export As's sizes, by the height of the picture they leave. */
const EXPORT_SIZES = [
  { label: "4K", height: 2160 },
  { label: "1080p", height: 1080 },
  { label: "720p", height: 720 },
  { label: "480p", height: 480 },
] as const;

/** What every movie window plays when View > Play All Movies is chosen in any of them. */
const movieWindows = new Set<() => void>();

/** A sidebar's place: `recents`, or a folder of the drive. */
const RECENTS_PLACE = "recents";
const MOVIES_PLACE = { id: "movies", name: "Movies" };

function FolderGlyph() {
  return (
    <svg
      className="mac-quicktime-player-open-folder"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 3h5l1.5 1.5H15V13H1z" />
    </svg>
  );
}

const iconOfRow = (row: OpenRow) => (row.folder ? <FolderGlyph /> : <MovieProxyIcon />);

/** The rows of the Export Progress panel: one export after another, each named by what it makes. */
interface ExportJob {
  id: number;
  name: string;
  state: "running" | "done" | "stopped" | "failed";
}
const EXPORT_STATES: Readonly<Record<Exclude<ExportJob["state"], "running">, string>> = {
  done: "Finished",
  stopped: "Stopped",
  failed: "Failed",
};

/**
 * QuickTime Player as the desktop runs it: an Open panel that lists the person's Recents and
 * the folders of their drive and uploads a movie from the computer into Movies, and the movie
 * window, which plays the chosen file for real (`QuickTimePlayer` with `src`). Several movies chosen
 * open in a window each. Command-O (or
 * Control-O) in the movie window goes back to the Open panel. The menu bar's File menu has Open
 * File…, which does the same, and Open Recent, whose movies open from the drive where they were
 * left. The Edit menu's commands replay the movie into a new one (`replayMovie`), held in the page as
 * a document with changes until Save puts it in Movies.
 */
export function QuickTimePlayerApp({
  drive: givenDrive,
  served = servedByDesktopApp(),
  onFrameSizeChange,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  settings: _settings,
  opening,
  onKeyDown,
  ref,
  ...windowProps
}: QuickTimePlayerAppProps) {
  const [ownDrive] = useState(defaultDrive);
  const drive = givenDrive === undefined ? ownDrive : givenDrive;
  const [movie, setMovie] = useState<OpenMovie | null>(null);
  const [place, setPlace] = useState<string>(MOVIES_PLACE.id);
  // The places visited before the one shown, and those Back left: the panel's Back and Forward.
  const [back, setBack] = useState<string[]>([]);
  const [forward, setForward] = useState<string[]>([]);
  // The sidebar's folders of the drive, and the names of the folders gone into from a list.
  const [places, setPlaces] = useState<readonly { id: string; name: string }[]>([MOVIES_PLACE]);
  const [visited, setVisited] = useState<readonly { id: string; name: string }[]>([]);
  const [openView, setOpenView] = useState<OpenPanelView>("list");
  // The movie selected in Column view, which may be in a folder further along than the list.
  const [columnChoice, setColumnChoice] = useState<OpenRow | null>(null);
  // The Open panel's search: the list shows only the movies whose names hold it.
  const [search, setSearch] = useState("");
  const [movies, setMovies] = useState<QuickTimeMovieFile[] | string | null>(null);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [busy, setBusy] = useState<{ label: string; fraction: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recents, setRecents] = useState<readonly QuickTimeRecent[]>([]);
  // The recording window shown, and whether it is recording now.
  const [recording, setRecording] = useState<RecordingKind | null>(null);
  const [taking, setTaking] = useState(false);
  const refused = useSyncExternalStore(
    unsavedTakes.subscribe,
    unsavedTakes.list,
    unsavedTakes.list,
  );
  const chooser = useRef<HTMLInputElement>(null);
  // Whether the window is still there: a read or an upload that ends after it closed makes no
  // movie address (which would hold the whole movie) and changes nothing.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loading = useServerState({
    url: QUICKTIME_RECENTS_URL,
    enabled: served && drive !== null,
    value: recents,
    onLoad: (stored) => {
      if (!recentsReadable(stored)) return false;
      setRecents(recentsFromServer(stored) ?? []);
    },
    toBody: recentsToServer,
    merge: mergeRecents,
  });

  // The window's frame: the panel's, or a movie's.
  const showing = movie !== null;
  // The shown movie's size in pixels once it has loaded, what the View menu scales it by, and
  // whether it repeats or fills the window.
  const [movieSize, setMovieSize] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [loop, setLoop] = useState(false);
  // Full screen: how the picture lies on the screen, and whether the window fills the page by
  // itself (a double click or its key). The desktop's full screen is `zoomRole`'s to say.
  const [scaling, setScaling] = useState<MovieScaling>("fit");
  const [pageFull, setPageFull] = useState(false);
  const fullScreen = zoomRole === "exit-full-screen" || pageFull;
  const [command, setCommand] = useState<MovieCommand>();
  const askMovie = (asked: Omit<MovieCommand, "id">) =>
    setCommand((now) => ({ ...asked, id: (now?.id ?? 0) + 1 }));
  // The strip's: whether it shows, where the movie is split, and the playhead.
  const [clipsOpen, setClipsOpen] = useState(false);
  const [cuts, setCuts] = useState<readonly number[]>([]);
  const [movieAt, setMovieAt] = useState(0);
  const [chosenClip, setChosenClip] = useState<readonly number[] | "all">([]);
  const copiedClip = useSyncExternalStore(
    clipClipboard.subscribe,
    clipClipboard.read,
    clipClipboard.read,
  );
  const [moviePlaying, setMoviePlaying] = useState(false);
  const [floatOnTop, setFloatOnTop] = useState(false);
  const inDesktopWindow = use(DesktopWindowHostContext) !== null;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [movieLength, setMovieLength] = useState<number | null>(null);
  const [frameRate, setFrameRate] = useState<number | null>(null);
  const [exportJobs, setExportJobs] = useState<readonly ExportJob[]>([]);
  const [exportsOpen, setExportsOpen] = useState(false);
  const [volume, setVolume] = useDesktopSetting(QUICKTIME_VOLUME_KEY, readVolume, 1);
  // The page's size changing, which the window's frame answers.
  const [pageChanges, setPageChanges] = useState(0);
  useEffect(() => {
    const changed = () => setPageChanges((now) => now + 1);
    window.addEventListener("resize", changed);
    return () => window.removeEventListener("resize", changed);
  }, []);
  const frameElement = useRef<HTMLDivElement | null>(null);
  const room = () => {
    const page = frameElement.current?.ownerDocument.defaultView ?? window;
    return {
      width: Math.min(
        page.innerWidth,
        Math.max(LEAST_ROOM.width, page.innerWidth - ROOM_MARGIN.width),
      ),
      height: Math.min(
        page.innerHeight,
        Math.max(LEAST_ROOM.height, page.innerHeight - ROOM_MARGIN.height),
      ),
    };
  };
  const roomNow = useRef(room);
  roomNow.current = room;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the page's size is read through `roomNow`, and a change of it asks again
  useEffect(() => {
    if (recording) {
      onFrameSizeChange?.(RECORDING_SIZES[recording]);
      return;
    }
    if (!showing) {
      onFrameSizeChange?.(PANEL_SIZE);
      return;
    }
    onFrameSizeChange?.(
      movieSize ? movieFrameSize(movieSize, scale, roomNow.current()) : MOVIE_SIZE,
    );
  }, [recording, showing, movieSize, scale, pageChanges, onFrameSizeChange]);

  // A movie's address lives as long as the movie shows it: saving an edit keeps the address.
  const [movieVideo, setMovieVideo] = useState<HTMLVideoElement | null>(null);
  const languages = useMovieLanguages(movie?.blob, movieVideo);
  const movieUrl = movie?.url;
  useEffect(() => {
    if (!movieUrl) return;
    return () => URL.revokeObjectURL(movieUrl);
  }, [movieUrl]);

  // Every listing of Movies is numbered: only the newest is shown, and an upload that finishes
  // while one is under way is kept in what that listing shows (it may have been taken before).
  const listing = useRef(0);
  const uploaded = useRef<QuickTimeMovieFile[]>([]);
  // Recents list the files they name, and show Movies' listing only when asked for it again.
  const listedFolder = place === RECENTS_PLACE ? MOVIES_PLACE.id : place;
  const nameOfPlace = (id: string) =>
    id === RECENTS_PLACE
      ? "Recents"
      : ([...places, ...visited].find((each) => each.id === id)?.name ?? MOVIES_PLACE.name);
  const listedName = useRef(nameOfPlace);
  listedName.current = nameOfPlace;
  const refresh = useCallback(() => {
    if (!drive) return;
    const asked = ++listing.current;
    uploaded.current = [];
    setMovies(null);
    (drive.contents ? drive.contents(listedFolder) : drive.movies()).then(
      (list) => {
        if (!mounted.current || asked !== listing.current) return;
        const mine = uploaded.current;
        setMovies([
          ...list
            .filter((each) => each.folder || opensInQuickTime(each))
            .filter((movie) => !mine.some((up) => up.id === movie.id)),
          ...mine,
        ]);
      },
      (error: unknown) => {
        if (!mounted.current || asked !== listing.current) return;
        // Uploads that finished meanwhile are in Movies all the same: keep them listed.
        const mine = uploaded.current;
        if (mine.length > 0) {
          setMovies([...mine]);
          return;
        }
        setMovies(
          `${listedName.current(listedFolder)} could not be read: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
  }, [drive, listedFolder]);
  useEffect(() => {
    if (!showing) refresh();
  }, [showing, refresh]);
  useEffect(() => {
    let live = true;
    drive?.places?.().then(
      (list) => {
        if (live) setPlaces(list);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [drive]);

  const progress = (label: string) => (fraction: number) =>
    setBusy({ label, fraction: Math.min(1, Math.max(0, fraction)) });

  // The window's frame (the Open panel's or the movie window's), for the desktop's menu bar: its
  // File menu acts on the window last used.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const frameRef = useCallback(
    (element: HTMLDivElement | null) => {
      setFrame(element);
      frameElement.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );

  // Files sent here by Finder or dropped on the window, waiting for Recents and any reading to end.
  // On the desktop the first opens here and the others in a window each; a page with no desktop has
  // the one window, and the last one asked for is the one left showing. A window opened for one more
  // movie takes only that one: Finder's requests are the first window's.
  const openingNow = readOpenMovies({ asked: opening }).asked;
  const [waiting, setWaiting] = useState<QuickTimeOpenMovie[]>(() =>
    openingNow ? [openingNow] : [],
  );
  const opensRequests = served && !openingNow;
  useEffect(() => {
    if (!opensRequests) return;
    const asked = takeOpenFileRequests("quicktime-player");
    if (asked.length > 0) setWaiting(asked);
    return onOpenFileRequest("quicktime-player", (request) =>
      setWaiting((queue) => [...queue, request]),
    );
  }, [opensRequests]);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    enabled: served,
    accepts: (item) => item.kind === "file" && opensInQuickTime(item),
    onDrop: (items) => setWaiting((queue) => [...queue, ...items]),
  });
  useEffect(() => dropRef(frame), [frame, dropRef]);

  // The file each window shows is kept with the person's settings, by the window's id, so that the
  // window the desktop gives back after a reload opens it again. A window that goes takes it away;
  // a reload runs no such goodbye.
  const [windowKey, setWindowKey] = useState<string | null>(null);
  useEffect(() => {
    const key = frame?.closest("[data-window-id]")?.getAttribute("data-window-id");
    if (key) setWindowKey(key);
  }, [frame]);
  const restoresMovie = served && !openingNow;
  useEffect(() => {
    if (!windowKey || !restoresMovie) return;
    const stored = desktopValues()[QUICKTIME_OPEN_KEY];
    const kept = readOpenMovies(stored)[windowKey];
    if (!kept) return;
    changeDesktopValue(QUICKTIME_OPEN_KEY, withOpenMovie(stored, windowKey, null));
    setWaiting((queue) => (queue.length > 0 ? queue : [kept]));
  }, [windowKey, restoresMovie]);
  const shownFile = movie?.file;
  const shownName = movie?.name;
  useEffect(() => {
    if (!windowKey || !served || !shownFile || !shownName) return;
    const keep = (shown: QuickTimeOpenMovie | null) =>
      changeDesktopValue(
        QUICKTIME_OPEN_KEY,
        withOpenMovie(desktopValues()[QUICKTIME_OPEN_KEY], windowKey, shown),
      );
    keep({ id: shownFile, name: shownName });
    return () => keep(null);
  }, [windowKey, served, shownFile, shownName]);

  /** One more window for each of these movies, where the desktop can give one. */
  const openInOwnWindows = (files: readonly QuickTimeOpenMovie[]) =>
    requestDesktopEffects(
      files.map(({ id, name }) => ({
        newWindow: "quicktime-player",
        opening: { id, name },
      })),
    );

  const askPlayMovie = useRef<() => void>(() => undefined);
  askPlayMovie.current = () => askMovie({ play: true });
  useEffect(() => {
    if (!showing) return;
    const play = () => askPlayMovie.current();
    movieWindows.add(play);
    return () => {
      movieWindows.delete(play);
    };
  }, [showing]);

  /** Puts a document in the window, which starts with no history of its own. */
  const showDocument = (document: OpenMovie, kept: readonly number[] = []) => {
    lastSaved.current = document.file && document.blob ? { blob: document.blob, cuts: kept } : null;
    setRecording(null);
    setMovie(document);
    setUndoing([]);
    setRedoing([]);
    setTrim(null);
    setClipsOpen(false);
    setCuts(kept);
    setMovieAt(0);
    setChosenClip([]);
    setMoviePlaying(false);
    // Until this movie reports its own, nothing may act on the last one's length and size.
    setMovieLength(null);
    setMovieSize(null);
    setFrameRate(null);
  };

  const openFile = async (file: { id: string; name: string }) => {
    // Until Recents have loaded, an opening would be lost when they arrive, and a movie would
    // open at its start instead of where it was left.
    if (!drive || loading) return;
    setMessage(null);
    try {
      progress(`Opening “${file.name}”…`)(0);
      const { blob, version }: { blob: Blob; version?: number } = drive.readKept
        ? await drive.readKept(file.id, progress(`Opening “${file.name}”…`))
        : { blob: await drive.read(file.id, progress(`Opening “${file.name}”…`)) };
      let kept: readonly number[] = [];
      let unread: unknown = null;
      try {
        kept = (await drive.clipsOf?.(file.id)) ?? [];
      } catch (error) {
        unread = error;
      }
      if (!mounted.current) return;
      const start = recents.find((recent) => recent.file === file.id)?.position ?? 0;
      setRecents((now) => remember(now, file.id, file.name, Date.now()));
      showDocument(
        {
          url: URL.createObjectURL(blob),
          name: file.name,
          file: file.id,
          version,
          start,
          blob,
        },
        kept,
      );
      if (unread) {
        setMessage(
          `Where “${file.name}” is split into clips could not be read: ${unread instanceof Error ? unread.message : String(unread)}`,
        );
      }
    } catch (error) {
      if (!mounted.current) return;
      setMessage(
        `“${file.name}” could not be opened: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const openChosenFile = async (file: File) => {
    if (loading) return;
    setMessage(null);
    if (!isMovie(file)) {
      setMessage(`“${file.name}” is not a movie.`);
      return;
    }
    if (!drive) {
      showDocument({ url: URL.createObjectURL(file), name: file.name, start: 0, blob: file });
      return;
    }
    try {
      progress(`Uploading “${file.name}” to Movies…`)(0);
      const entry = await drive.upload(file, progress(`Uploading “${file.name}” to Movies…`));
      if (!mounted.current) return;
      // The movie is in Movies now, whether or not it then opens: list it at once, so a read that
      // fails leaves it there to open again, and keep it in a listing still under way.
      uploaded.current = [...uploaded.current.filter((movie) => movie.id !== entry.id), entry];
      setMovies((now) => [
        ...(Array.isArray(now) ? now.filter((movie) => movie.id !== entry.id) : []),
        entry,
      ]);
      await openFile(entry);
    } catch (error) {
      if (!mounted.current) return;
      setBusy(null);
      setMessage(
        `“${file.name}” could not be uploaded: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // A finished take goes to Movies and opens. With no drive it plays in the page only. The upload
  // does not depend on the window: a take whose window closed is still saved, and one the drive
  // refuses stays offered until it is saved (`unsavedTakes`).
  const saveRecording = async (file: File) => {
    if (!drive) {
      showDocument({ url: URL.createObjectURL(file), name: file.name, start: 0, blob: file });
      return;
    }
    const label = `Saving “${file.name}” to Movies…`;
    progress(label)(0);
    let entry: QuickTimeMovieFile;
    try {
      entry = await drive.upload(file, progress(label));
    } catch (error) {
      unsavedTakes.add(file, error instanceof Error ? error.message : String(error));
      setBusy(null);
      setRecording(null);
      return;
    }
    unsavedTakes.remove(file);
    if (!mounted.current) return;
    uploaded.current = [...uploaded.current.filter((movie) => movie.id !== entry.id), entry];
    setMovies((now) => [
      ...(Array.isArray(now) ? now.filter((movie) => movie.id !== entry.id) : []),
      entry,
    ]);
    await openFile(entry);
    setRecording(null);
  };

  // Leaving the document shown, from a menu or a key: not while it is being worked on, nor with changes
  // the leaving would lose.
  const canLeave = !loading && busy === null && !taking && !movie?.edited;
  const goToOpenPanel = () => {
    if (!canLeave) return;
    setMessage(null);
    setMovie(null);
    setRecording(null);
  };
  const askLocation = () => {
    if (canLeave) setLocating("");
  };
  // Edits replay the movie (`replayMovie`) into a new one held in the page, as a document with changes:
  // Undo and Redo go between them, and Save writes the result into the movie's file, keeping what
  // it replaces as a version.
  const [undoing, setUndoing] = useState<readonly MovieStep[]>([]);
  const [redoing, setRedoing] = useState<readonly MovieStep[]>([]);
  const lastSaved = useRef<{ blob: Blob; cuts: readonly number[] } | null>(null);
  const [trim, setTrim] = useState<{ start: number; end: number } | null>(null);
  const [closing, setClosing] = useState<Parameters<NonNullable<typeof onClose>>[0] | null>(null);
  const [locating, setLocating] = useState<string | null>(null);
  // Add Clip to End… and Move To…: what their dialogs list, while they show.
  const [addingClip, setAddingClip] = useState<(() => Promise<QuickTimeChooserRow[]>) | null>(null);
  // Which gap of the clips the dialog adds to: the end, or after the selection.
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [movingTo, setMovingTo] = useState<(() => Promise<QuickTimeChooserRow[]>) | null>(null);
  const clipFile = useRef<HTMLInputElement>(null);
  // Rename…: the name being typed, without its extension.
  const [renaming, setRenaming] = useState<string | null>(null);
  // Save As…: the name being typed, without its extension.
  const [savingAs, setSavingAs] = useState<string | null>(null);
  // File > Revert To > Browse All Versions…, and what Previous Save goes back to.
  const [browsing, setBrowsing] = useState(false);
  const [previousSave, setPreviousSave] = useState<KeptVersion | undefined>();
  const shownVersion = movie?.version;
  useEffect(() => {
    setPreviousSave(undefined);
    const versions = drive?.versions;
    if (!versions || !shownFile) return;
    let live = true;
    versions.list(shownFile).then(
      (kept) => {
        if (live) setPreviousSave(previousSaveOf(kept, shownVersion));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [drive, shownFile, shownVersion]);
  const extensionOfMovie = (name: string) => /\.[^.]+$/.exec(name)?.[0] ?? "";
  const renameMovie = async () => {
    const stem = (renaming ?? "").trim();
    setRenaming(null);
    const file = movie?.file;
    if (!stem || !file || !movie || !drive?.rename || busy !== null) return;
    const name = `${stem}${extensionOfMovie(movie.name)}`;
    if (name === movie.name) return;
    progress(`Renaming “${movie.name}”…`)(0);
    try {
      const entry = await drive.rename(file, name);
      if (!mounted.current) return;
      setMovie((now) => (now?.file === file ? { ...now, name: entry.name } : now));
      setMovies((now) =>
        Array.isArray(now) ? now.map((each) => (each.id === file ? entry : each)) : now,
      );
      setRecents((now) =>
        now.map((each) => (each.file === file ? { ...each, name: entry.name } : each)),
      );
    } catch (error) {
      setMessage(
        `“${movie.name}” could not be renamed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };
  const working = useRef<AbortController | null>(null);
  useEffect(() => () => working.current?.abort(), []);

  const showBlob = (blob: Blob, edited: boolean) => {
    if (!movie) return;
    setMoviePlaying(false);
    setChosenClip([]);
    setMovieLength(null);
    setFrameRate(null);
    const url = URL.createObjectURL(blob);
    setMovie((now) => (now ? { ...now, url, blob, edited, start: 0 } : now));
  };

  /** Replays the movie, or the `pieces` it becomes: each piece stays a clip of its own. */
  const applyEdit = async (label: string, change: MovieEdit, pieces?: readonly MoviePiece[]) => {
    const from = movie?.blob;
    if (!from || busy !== null) return;
    if (pieces && pieces.length > MAX_CUTS + 1) {
      setMessage(`A movie keeps at most ${MAX_CUTS + 1} clips.`);
      return;
    }
    setTrim(null);
    setMessage(null);
    const stop = new AbortController();
    working.current = stop;
    progress(label)(0);
    try {
      const joins: number[] = [];
      const blob = await replayMovie(
        pieces ?? from,
        change,
        progress(label),
        stop.signal,
        (seconds) => joins.push(seconds),
      );
      if (!mounted.current) return;
      setUndoing((now) => [
        ...now.slice(-(UNDO_DEPTH - 1)),
        { blob: from, edited: movie?.edited === true, cuts },
      ]);
      setRedoing([]);
      setCuts(pieces ? joins : cutsAfter(cuts, change));
      showBlob(blob, true);
    } catch (error) {
      if (mounted.current && !stop.signal.aborted) {
        setMessage(`The edit failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      working.current = null;
      if (mounted.current) setBusy(null);
    }
  };
  /** A split changes no picture: going back over one leaves the movie playing where it is. */
  const showStep = (step: MovieStep) => {
    setChosenClip([]);
    setCuts(step.cuts);
    if (step.blob !== movie?.blob) showBlob(step.blob, step.edited);
    else setMovie((now) => (now ? { ...now, edited: step.edited } : now));
  };
  const undoEdit = () => {
    const previous = undoing[undoing.length - 1];
    const now = movie?.blob;
    if (!previous || !now || busy !== null) return;
    setRedoing((later) => [...later, { blob: now, edited: movie?.edited === true, cuts }]);
    setUndoing(undoing.slice(0, -1));
    showStep(previous);
  };
  const redoEdit = () => {
    const next = redoing[redoing.length - 1];
    const now = movie?.blob;
    if (!next || !now || busy !== null) return;
    setUndoing((earlier) => [...earlier, { blob: now, edited: movie?.edited === true, cuts }]);
    setRedoing(redoing.slice(0, -1));
    showStep(next);
  };
  /** The blob as a new file of Movies, listed there; answers it. */
  const keepInMovies = async (blob: Blob, name: string) => {
    if (!drive) throw new Error("there is no drive to keep it on");
    const label = `Saving “${name}” to Movies…`;
    progress(label)(0);
    try {
      const entry = await drive.upload(
        new File([blob], name, { type: blob.type }),
        progress(label),
      );
      uploaded.current = [...uploaded.current.filter((each) => each.id !== entry.id), entry];
      setMovies((now) => [
        ...(Array.isArray(now) ? now.filter((each) => each.id !== entry.id) : []),
        entry,
      ]);
      return entry;
    } finally {
      setBusy(null);
    }
  };
  /**
   * Stores where the file just written is split. Over a file that may hold splits of its own
   * (`replacing`), even none is stored. A failure is said, and the file stays without them.
   */
  const keepCuts = async (entry: QuickTimeMovieFile, replacing = false) => {
    const stored = storedCuts(cuts);
    if (stored.length === 0 && !replacing) return true;
    try {
      if (!drive?.keepClips) throw new Error("this place does not keep clips");
      progress(`Saving “${entry.name}” to Movies…`)(1);
      await drive.keepClips(entry.id, stored);
      return true;
    } catch (error) {
      setMessage(
        `“${entry.name}” is in Movies, but where it is split could not be kept: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    } finally {
      if (mounted.current) setBusy(null);
    }
  };
  /** File > Save As…, and Save where the file cannot take the bytes: a new file, which the window takes. */
  const saveAsCopy = async (name: string) => {
    const blob = movie?.blob;
    if (!movie?.edited || !blob || !drive || busy !== null) return null;
    setMessage(null);
    try {
      const entry = await keepInMovies(blob, name);
      // Not clean until its clips are stored too: the movie stays edited, to be saved again.
      if (!(await keepCuts(entry))) return null;
      lastSaved.current = { blob, cuts };
      setMovie((now) =>
        now
          ? { ...now, name: entry.name, file: entry.id, version: entry.version, edited: false }
          : now,
      );
      setUndoing([]);
      setRedoing([]);
      return entry;
    } catch (error) {
      setMessage(
        `The movie could not be saved: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  };
  /**
   * File > Save: into the movie's file, whose earlier bytes the drive keeps as a version. A file
   * whose name says another format than edits are recorded in stays as it is, and the edits go in a
   * new file, as they do where the store cannot save in place. A file saved over elsewhere since it
   * was read refuses, and the window stays edited, saying so.
   */
  const saveMovie = async () => {
    const blob = movie?.blob;
    if (!movie?.edited || !blob || !drive || busy !== null) return false;
    const { name, file, version } = movie;
    if (!drive.saveOver || !file || version === undefined) {
      return (await saveAsCopy(derivedName(name, "edited", blob.type))) !== null;
    }
    if (!nameFitsType(name, blob.type)) {
      const copy = await saveAsCopy(derivedName(name, "edited", blob.type));
      if (copy) setMessage(otherFormat(name, copy.name));
      return copy !== null;
    }
    setMessage(null);
    const label = `Saving “${name}”…`;
    try {
      progress(label)(0);
      const entry = await drive.saveOver(file, blob, version, progress(label)).finally(() => {
        setBusy(null);
      });
      setMovie((now) => (now?.file === file ? { ...now, version: entry.version } : now));
      setMovies((now) =>
        Array.isArray(now) ? now.map((each) => (each.id === file ? entry : each)) : now,
      );
      if (entry.version !== undefined) {
        // Only marks the version, so a quick next save does not thin it away: the save is done.
        void drive.versions?.keep(file, entry.version).catch(() => undefined);
      }
      // Not clean until its clips are stored too: the movie stays edited, to be saved again.
      if (!(await keepCuts(entry, true))) return false;
      lastSaved.current = { blob, cuts };
      setMovie((now) => (now?.file === file ? { ...now, name: entry.name, edited: false } : now));
      setUndoing([]);
      setRedoing([]);
      return true;
    } catch (error) {
      setMessage(
        `The movie could not be saved: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  };
  const saveAsNamed = async () => {
    const stem = (savingAs ?? "").trim();
    setSavingAs(null);
    const type = movie?.blob?.type;
    if (stem && type !== undefined) await saveAsCopy(nameInType(stem, type));
  };
  /**
   * File > Revert To > Previous Save, and Restore in Browse All Versions: the drive makes the
   * version the file's bytes and keeps what they replace, and the window reads them. A version is
   * bytes only: where its clips were split is not kept with it, so the movie comes back as one clip.
   */
  const restoreKept = async (kept: number) => {
    setBrowsing(false);
    const file = movie?.file;
    const versions = drive?.versions;
    if (!movie || !file || !versions || !drive?.readKept || busy !== null) return;
    const { name } = movie;
    const label = `Restoring “${name}”…`;
    setMessage(null);
    try {
      progress(label)(0);
      await versions.restore(file, kept, movie.version);
      const { blob, version } = await drive.readKept(file, progress(label));
      await drive.keepClips?.(file, []);
      if (!mounted.current) return;
      showDocument({ url: URL.createObjectURL(blob), name, file, version, start: 0, blob });
    } catch (error) {
      if (!mounted.current) return;
      setMessage(
        `The version of “${name}” could not be restored: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };
  const exportMovie = async (suffix: string, change: MovieEdit) => {
    const from = movie?.blob;
    const name = movie?.name;
    if (!from || !name || !drive || busy !== null) return;
    setMessage(null);
    const stop = new AbortController();
    working.current = stop;
    const label = `Exporting ${suffix}…`;
    const job = (exportJobs.at(-1)?.id ?? 0) + 1;
    const finish = (state: ExportJob["state"]) =>
      setExportJobs((jobs) => jobs.map((each) => (each.id === job ? { ...each, state } : each)));
    setExportJobs((jobs) => [...jobs, { id: job, name: `${name}, ${suffix}`, state: "running" }]);
    progress(label)(0);
    try {
      const blob = await replayMovie(from, change, progress(label), stop.signal);
      const entry = await keepInMovies(blob, derivedName(name, suffix, blob.type));
      finish("done");
      if (mounted.current) setMessage(`“${entry.name}” is in Movies.`);
    } catch (error) {
      finish(stop.signal.aborted ? "stopped" : "failed");
      if (mounted.current) setBusy(null);
      if (mounted.current && !stop.signal.aborted) {
        setMessage(`The export failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      working.current = null;
    }
  };
  const duplicateMovie = async () => {
    const blob = movie?.blob;
    if (!blob || !movie || !drive || busy !== null) return;
    try {
      const entry = await keepInMovies(blob, derivedName(movie.name, "copy", blob.type));
      if (await keepCuts(entry)) setMessage(`“${entry.name}” is in Movies.`);
    } catch (error) {
      setMessage(
        `The movie could not be copied: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  /** File > Revert To > Last Saved: one more step, so Undo brings the edits back. */
  const revertToSaved = () => {
    const saved = lastSaved.current;
    const now = movie?.blob;
    if (!saved || !now || !movie?.edited || busy !== null) return;
    setTrim(null);
    setUndoing((before) => [...before.slice(-(UNDO_DEPTH - 1)), { blob: now, edited: true, cuts }]);
    setRedoing([]);
    showStep({ blob: saved.blob, edited: false, cuts: saved.cuts });
  };
  const startTrim = () => {
    if (!movie?.blob || !movieLength || busy !== null) return;
    setClipsOpen(false);
    setTrim({ start: 0, end: movieLength });
  };
  const toggleClips = () => {
    if (!movie?.blob || !movieLength || busy !== null) return;
    setTrim(null);
    setChosenClip([]);
    setClipsOpen((now) => !now);
  };
  const moviePieces = (): MoviePiece[] => {
    const blob = movie?.blob;
    if (!blob || !movieLength) return [];
    return clipsOf(movieLength, cuts).map((clip) => ({ blob, ...clip }));
  };
  const clipCount = movieLength ? clipsOf(movieLength, cuts).length : 0;
  const chosenAll = chosenClip === "all" && clipCount > 0;
  const chosen = chosenClip === "all" ? [] : chosenClip.filter((index) => index < clipCount);
  const nothingChosen = chosen.length === 0;
  const leavesNoClip = chosen.length >= clipCount;
  const deleteClip = (label = "Deleting the clip…") => {
    if (nothingChosen || leavesNoClip) return;
    void applyEdit(
      label,
      {},
      moviePieces().filter((_, index) => !chosen.includes(index)),
    );
  };
  const copyClip = () => {
    const blob = movie?.blob;
    const pieces =
      chosenAll && blob && movieLength
        ? [{ blob, start: 0, end: movieLength }]
        : moviePieces().filter((_, index) => chosen.includes(index));
    if (pieces.length > 0) clipClipboard.write(pieces);
  };
  /** Edit > Select All: every clip in the strip, which it opens; Copy then takes the whole movie. */
  const selectAllClips = () => {
    if (!movie?.blob || !movieLength || busy !== null || taking) return;
    setTrim(null);
    setClipsOpen(true);
    setChosenClip("all");
  };
  const cutClip = () => {
    if (nothingChosen || leavesNoClip) return;
    copyClip();
    deleteClip(chosen.length > 1 ? "Cutting the clips…" : "Cutting the clip…");
  };
  /** Edit > Paste: after the last clip chosen, or else after the one under the playhead. */
  const pasteClip = () => {
    if (!copiedClip) return;
    const pieces = moviePieces();
    if (pieces.length === 0) return;
    const under = pieces.findIndex((piece) => movieAt < piece.end);
    const after = chosenAll
      ? pieces.length - 1
      : (chosen.at(-1) ?? (under < 0 ? pieces.length - 1 : under));
    setClipsOpen(true);
    void applyEdit("Pasting the clip…", {}, insertedAfter(pieces, after, ...copiedClip));
  };
  const moveClip = (from: number, gap: number) =>
    void applyEdit("Moving the clip…", {}, movedTo(moviePieces(), from, gap));
  /** Asks for a movie to add at the gap `at`, or at the end. */
  const askClipToAdd = (at: number | null = null) => {
    if (!movie?.blob || !movieLength || busy !== null) return;
    setAddingAt(at);
    setAddingClip(() => async () => {
      const list = drive ? await drive.movies() : [];
      return list.filter(opensInQuickTime).filter((each) => each.id !== movie.file);
    });
  };
  /** Movies read from the drive or chosen from the computer, as clips of this one at the gap `at`. */
  const addClips = async (
    name: string,
    read: () => Promise<readonly Blob[]>,
    at: number | null,
  ) => {
    setAddingClip(null);
    const pieces = moviePieces();
    if (pieces.length === 0 || busy !== null) return;
    const label = `Adding “${name}”…`;
    const stop = new AbortController();
    working.current = stop;
    progress(label)(0);
    const added: MoviePiece[] = [];
    try {
      for (const blob of await read()) {
        added.push({ blob, start: 0, end: await movieLengthOf(blob) });
      }
    } catch (error) {
      if (mounted.current) setBusy(null);
      if (mounted.current && !stop.signal.aborted) {
        setMessage(
          `“${name}” could not be added: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return;
    }
    if (!mounted.current) return;
    setBusy(null);
    if (stop.signal.aborted) return;
    setClipsOpen(true);
    const gap = at ?? pieces.length;
    await applyEdit(label, {}, insertedAfter(pieces, gap - 1, ...added));
  };
  const addClip = (name: string, read: () => Promise<Blob>) =>
    addClips(name, async () => [await read()], addingAt);
  const dropMovies = (items: readonly DesktopDragItem[], gap: number) =>
    addClips(items[0]?.name ?? "the movie", () => filesOfDrag(items), gap);
  /** A clip as a file for a drag out of the strip: made by a replay when something takes the drop. */
  const clipFileOf = (index: number) => {
    const piece = moviePieces()[index];
    if (!piece || !movie || busy !== null || typeof MediaRecorder === "undefined") return null;
    const type = plainType(
      recordingType(sized ? "movie" : "audio", (each) => MediaRecorder.isTypeSupported(each)) ?? "",
    );
    const name = derivedName(movie.name, `clip ${index + 1}`, type);
    return {
      id: `quicktime-clip-${index}`,
      name,
      kind: "file" as const,
      type,
      bytes: async () => {
        const label = `Exporting “${name}”…`;
        const stop = new AbortController();
        working.current = stop;
        progress(label)(0);
        try {
          return await replayMovie([piece], {}, progress(label), stop.signal);
        } finally {
          working.current = null;
          if (mounted.current) setBusy(null);
        }
      },
    };
  };
  const moveMovie = async (folder: QuickTimeChooserRow) => {
    setMovingTo(null);
    const file = movie?.file;
    if (!file || !movie || !drive?.move || busy !== null) return;
    progress(`Moving “${movie.name}”…`)(0);
    try {
      await drive.move(file, folder.id);
      if (mounted.current) setMessage(`“${movie.name}” is in ${folder.name}.`);
    } catch (error) {
      setMessage(
        `“${movie.name}” could not be moved: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };
  const cutHere = movieLength ? withCut(cuts, movieAt, movieLength) : null;
  /** Edit > Split Clip, at the playhead: the strip shows the two clips it leaves. */
  const splitClip = () => {
    const blob = movie?.blob;
    if (!blob || !cutHere || busy !== null) return;
    setChosenClip([]);
    setTrim(null);
    setClipsOpen(true);
    setUndoing((now) => [
      ...now.slice(-(UNDO_DEPTH - 1)),
      { blob, edited: movie?.edited === true, cuts },
    ]);
    setRedoing([]);
    setCuts(cutHere);
    setMovie((now) => (now ? { ...now, edited: true } : now));
  };
  /** A close asks first about edits that would be lost. */
  const closeWindow: typeof onClose = (event) => {
    if (movie?.edited) setClosing(event);
    else onClose?.(event);
  };
  const openLocation = () => {
    if (!canLeave) return;
    const address = (locating ?? "").trim();
    let parsed: URL;
    try {
      parsed = new URL(address, window.location.href);
    } catch {
      setMessage(`“${address}” is not an address.`);
      setLocating(null);
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setMessage(`QuickTime Player opens http and https addresses, not “${parsed.protocol}”.`);
      setLocating(null);
      return;
    }
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    setLocating(null);
    setMessage(null);
    showDocument({ url: parsed.href, name: decodeURIComponent(last ?? parsed.hostname), start: 0 });
  };

  const startRecording = (kind: RecordingKind) => {
    if (loading || busy !== null || taking || movie?.edited) return;
    setMessage(null);
    setMovie(null);
    setRecording(kind);
  };
  // Option-Command-N, Control-Option-Command-N and Control-Command-N. Option changes the letter a
  // key types on a Mac: the key itself is what counts.
  const recordingKey = (event: KeyboardEvent) => {
    if (event.code !== "KeyN" || event.shiftKey) return false;
    const kind: RecordingKind | null =
      event.metaKey && event.ctrlKey
        ? event.altKey
          ? "audio"
          : "screen"
        : (event.metaKey || event.ctrlKey) && event.altKey
          ? "movie"
          : null;
    if (!kind) return false;
    event.preventDefault();
    startRecording(kind);
    return true;
  };

  const openingFile = useRef(openFile);
  openingFile.current = openFile;
  const next = waiting[0];
  const takeWaiting = useRef(() => {});
  takeWaiting.current = () => {
    if (!next) return;
    if (inDesktopWindow) {
      setWaiting([]);
      openInOwnWindows(waiting.slice(1));
    } else setWaiting((queue) => queue.slice(1));
    setRecording(null);
    void openingFile.current(next);
  };
  useEffect(() => {
    if (!next || loading || busy !== null || taking || movie?.edited) return;
    takeWaiting.current();
  }, [next, loading, busy, taking, movie?.edited]);

  // The menu bar's File menu: Open File… shows the Open panel, and Open Recent opens a recent
  // movie from the drive where it was left; both wait for Recents to load and for a reading to end.
  const sized = movieSize !== null && movieSize.width > 0;
  // Sharing hands over a file of the drive: a movie with changes has none until it is saved.
  const movieShareRows = (
    <FileShareItems
      items={
        movie?.file && !movie.edited
          ? [{ id: movie.file, name: movie.name, kind: "file", type: movie.blob?.type }]
          : []
      }
      from="quicktime-player"
    />
  );
  const duplicateRow = (
    <MenuItem
      keyEquivalent="shift+command+s"
      disabled={!movie?.blob || !drive || busy !== null}
      onClick={() => void duplicateMovie()}
    >
      Duplicate
    </MenuItem>
  );
  const renameRow = (
    <MenuItem
      disabled={!movie?.file || movie.edited || !drive?.rename || busy !== null}
      onClick={() => setRenaming((movie?.name ?? "").replace(/\.[^.]+$/, ""))}
    >
      Rename…
    </MenuItem>
  );
  const moveRow = (
    <MenuItem
      disabled={!movie?.file || movie.edited || !drive?.move || busy !== null}
      onClick={() => {
        const folders = drive?.folders;
        if (folders) setMovingTo(() => () => folders());
      }}
    >
      Move To…
    </MenuItem>
  );
  const versionsReason = !movie?.file
    ? NO_FILE_VERSIONS
    : movie.edited
      ? SAVE_FIRST_VERSIONS
      : undefined;
  const canBrowse = !versionsReason && drive?.versions !== undefined && busy === null;
  const versionsRow = (
    <MenuItem
      disabled={!canBrowse}
      title={versionsReason ?? KEPT_VERSIONS}
      data-reason={versionsReason}
      onClick={() => setBrowsing(true)}
    >
      Browse All Versions…
    </MenuItem>
  );
  const previousSaveReason = versionsReason ?? (previousSave ? undefined : NO_PREVIOUS_SAVE);
  const fileMenu = (
    <>
      <MenuItem
        disabled={loading || busy !== null || taking || movie?.edited}
        keyEquivalent="option+command+n"
        onClick={() => startRecording("movie")}
      >
        New Movie Recording
      </MenuItem>
      <MenuItem
        disabled={loading || busy !== null || taking || movie?.edited}
        keyEquivalent="control+option+command+n"
        onClick={() => startRecording("audio")}
      >
        New Audio Recording
      </MenuItem>
      <MenuItem
        disabled={loading || busy !== null || taking || movie?.edited}
        keyEquivalent="control+command+n"
        onClick={() => startRecording("screen")}
      >
        New Screen Recording
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!canLeave} keyEquivalent="command+o" onClick={goToOpenPanel}>
        Open File…
      </MenuItem>
      <MenuItem disabled={!canLeave} keyEquivalent="command+l" onClick={askLocation}>
        Open Location…
      </MenuItem>
      <Submenu
        disabled={
          loading || busy !== null || taking || !drive || recents.length === 0 || movie?.edited
        }
      >
        <SubmenuTrigger>Open Recent</SubmenuTrigger>
        <SubmenuPopup aria-label="Open Recent">
          {recents.map((recent) => (
            <MenuItem
              key={recent.file}
              onClick={() => void openFile({ id: recent.file, name: recent.name })}
            >
              {recent.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={() => setRecents([])}>Clear Menu</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      {duplicateRow}
      {renameRow}
      {moveRow}
      <Submenu disabled={!movie?.blob}>
        <SubmenuTrigger>Revert To</SubmenuTrigger>
        <SubmenuPopup aria-label="Revert To">
          <MenuItem
            disabled={!movie?.file || !movie.edited || busy !== null}
            onClick={revertToSaved}
          >
            Last Saved
          </MenuItem>
          <MenuItem
            disabled={previousSaveReason !== undefined || busy !== null}
            title={
              previousSaveReason ??
              (previousSave ? versionDate(previousSave.modifiedMs) : undefined)
            }
            data-reason={previousSaveReason}
            onClick={() => previousSave && void restoreKept(previousSave.version)}
          >
            Previous Save
          </MenuItem>
          {versionsRow}
        </SubmenuPopup>
      </Submenu>
      <Submenu disabled={!movie?.blob || !drive || busy !== null}>
        <SubmenuTrigger>Export As</SubmenuTrigger>
        <SubmenuPopup aria-label="Export As">
          {EXPORT_SIZES.map((size) => (
            <MenuItem
              key={size.label}
              disabled={!sized || movieSize.height < size.height}
              onClick={() => void exportMovie(size.label, { height: size.height })}
            >
              {size.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={() => void exportMovie("audio only", { noVideo: true })}>
            Audio Only
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <Submenu disabled={!movie?.file || movie.edited || busy !== null}>
        <SubmenuTrigger>Share</SubmenuTrigger>
        <SubmenuPopup aria-label="Share">{movieShareRows}</SubmenuPopup>
      </Submenu>
      <MenuItem
        keyEquivalent="command+s"
        disabled={!movie?.edited || !drive || busy !== null}
        onClick={() => void saveMovie()}
      >
        Save
      </MenuItem>
      <MenuItem
        disabled={!movie?.edited || !drive || busy !== null}
        onClick={() => {
          const type = movie?.blob?.type ?? "";
          setSavingAs(derivedName(movie?.name ?? "", "edited", type).replace(/\.[^.]+$/, ""));
        }}
      >
        Save As…
      </MenuItem>
    </>
  );
  useDesktopAppMenu("quicktime-player", "File", fileMenu, frame);

  const editable = Boolean(movie?.blob) && busy === null && !taking;
  const pictured = editable && sized;
  const clipReason = chosenAll
    ? ONLY_CLIP
    : nothingChosen
      ? NO_CLIP_CHOSEN
      : leavesNoClip
        ? ONLY_CLIP
        : undefined;
  const deleteRow = (
    <MenuItem
      keyEquivalent="delete"
      disabled={!editable || nothingChosen || leavesNoClip}
      title={clipReason}
      data-reason={clipReason}
      onClick={() => deleteClip()}
    >
      Delete
    </MenuItem>
  );
  const nothingToCopy = nothingChosen && !chosenAll;
  const canSelectClips = editable && clipCount > 0;
  const editMenu = (
    <>
      {showing ? (
        <>
          <MenuItem
            keyEquivalent="command+z"
            disabled={!editable || undoing.length === 0}
            onClick={undoEdit}
          >
            Undo
          </MenuItem>
          <MenuItem
            keyEquivalent="shift+command+z"
            disabled={!editable || redoing.length === 0}
            onClick={redoEdit}
          >
            Redo
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            keyEquivalent="command+x"
            disabled={!editable || nothingChosen || leavesNoClip}
            title={clipReason}
            data-reason={clipReason}
            onClick={cutClip}
          >
            Cut
          </MenuItem>
          <MenuItem
            keyEquivalent="command+c"
            disabled={!editable || nothingToCopy}
            title={nothingToCopy ? NO_CLIP_CHOSEN : undefined}
            data-reason={nothingToCopy ? NO_CLIP_CHOSEN : undefined}
            onClick={copyClip}
          >
            Copy
          </MenuItem>
          <MenuItem
            keyEquivalent="command+v"
            disabled={!editable || !copiedClip || clipCount === 0}
            onClick={pasteClip}
          >
            Paste
          </MenuItem>
          {deleteRow}
          <MenuItem
            keyEquivalent="command+a"
            disabled={!canSelectClips}
            title={canSelectClips ? undefined : NO_CLIPS_YET}
            data-reason={canSelectClips ? undefined : NO_CLIPS_YET}
            onClick={selectAllClips}
          >
            Select All
          </MenuItem>
        </>
      ) : (
        <>
          <EditRows
            nothing={
              recording
                ? "A recording has no text to edit."
                : "Click in the Open panel's search field first."
            }
            say={setMessage}
          />
          {deleteRow}
        </>
      )}
      <MenuSeparator />
      <MenuItem keyEquivalent="command+t" disabled={!editable} onClick={startTrim}>
        Trim…
      </MenuItem>
      <MenuItem
        keyEquivalent="command+y"
        disabled={!editable || cutHere === null}
        onClick={splitClip}
      >
        Split Clip
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!editable || clipCount === 0} onClick={() => askClipToAdd()}>
        Add Clip to End…
      </MenuItem>
      <MenuItem
        disabled={!editable || nothingChosen}
        title={nothingChosen ? NO_CLIP_CHOSEN : undefined}
        data-reason={nothingChosen ? NO_CLIP_CHOSEN : undefined}
        onClick={() => askClipToAdd((chosen.at(-1) ?? 0) + 1)}
      >
        Insert Clip After Selection…
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="shift+command+l"
        disabled={!pictured}
        onClick={() => void applyEdit("Rotating…", { turns: 3 })}
      >
        Rotate Left
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+r"
        disabled={!pictured}
        onClick={() => void applyEdit("Rotating…", { turns: 1 })}
      >
        Rotate Right
      </MenuItem>
      <MenuItem
        keyEquivalent="option+command+h"
        disabled={!pictured}
        onClick={() => void applyEdit("Flipping…", { flipX: true })}
      >
        Flip Horizontal
      </MenuItem>
      <MenuItem
        keyEquivalent="option+command+v"
        disabled={!pictured}
        onClick={() => void applyEdit("Flipping…", { flipY: true })}
      >
        Flip Vertical
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!pictured}
        onClick={() => void applyEdit("Removing the sound…", { noAudio: true })}
      >
        Remove Audio
      </MenuItem>
      <MenuItem
        disabled={!pictured}
        onClick={() => void applyEdit("Removing the picture…", { noVideo: true })}
      >
        Remove Video
      </MenuItem>
    </>
  );
  useDesktopAppMenu("quicktime-player", "Edit", editMenu, frame);

  // The View menu's commands. Sound has no picture to size, and they stay dimmed for it.
  const actualSize = () => setScale(1);
  const fitToScreen = () => {
    if (!sized) return;
    if (fullScreen) setScaling("fit");
    else setScale(fitScale(movieSize, room()));
  };
  const scalable = sized && fullScreen;
  const scaleReason = scalable ? undefined : sized ? SCALED_IN_FULL_SCREEN : NO_PICTURE;
  const scaleTo = (next: MovieScaling) => {
    if (scalable) setScaling(next);
  };
  const resized = (by: number) => {
    if (!sized) return;
    setScale((now) => steppedScale(movieSize, now, by, room()));
  };
  const viewMenu = (
    <>
      <MenuItem keyEquivalent="command+1" disabled={!sized} onClick={actualSize}>
        Actual Size
      </MenuItem>
      <MenuItem keyEquivalent="command+3" disabled={!sized} onClick={fitToScreen}>
        Fit to Screen
      </MenuItem>
      <MenuItem
        keyEquivalent="command+4"
        disabled={!scalable}
        title={scaleReason}
        data-reason={scaleReason}
        onClick={() => scaleTo("fill")}
      >
        Fill Screen
      </MenuItem>
      <MenuItem
        keyEquivalent="command+5"
        disabled={!scalable}
        title={scaleReason}
        data-reason={scaleReason}
        onClick={() => scaleTo("panoramic")}
      >
        Panoramic
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command++" disabled={!sized} onClick={() => resized(SIZE_STEP)}>
        Increase Size
      </MenuItem>
      <MenuItem keyEquivalent="command+-" disabled={!sized} onClick={() => resized(1 / SIZE_STEP)}>
        Decrease Size
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+e"
        disabled={!editable || !movieLength}
        onClick={toggleClips}
      >
        {clipsOpen ? "Hide Clips" : "Show Clips"}
      </MenuItem>
      <MenuSeparator />
      <MenuCheckboxItem
        keyEquivalent="option+command+l"
        disabled={!showing}
        checked={loop}
        onCheckedChange={setLoop}
      >
        Loop
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuCheckboxItem disabled={!showing} checked={floatOnTop} onCheckedChange={setFloatOnTop}>
        Float on Top
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem
        disabled={languages.textTracks.length === 0}
        title={languages.textTracks.length === 0 ? NO_TRACKS : undefined}
        data-reason={languages.textTracks.length === 0 ? NO_TRACKS : undefined}
        onClick={() =>
          languages.show(languages.showing === null ? (languages.textTracks[0]?.id ?? null) : null)
        }
      >
        {languages.showing === null ? "Show Subtitles" : "Hide Subtitles"}
      </MenuItem>
      <Submenu disabled={languages.textTracks.length === 0 && languages.audioTracks.length < 2}>
        <SubmenuTrigger
          title={
            languages.textTracks.length === 0 && languages.audioTracks.length < 2
              ? NO_TRACKS
              : undefined
          }
          data-reason={
            languages.textTracks.length === 0 && languages.audioTracks.length < 2
              ? NO_TRACKS
              : undefined
          }
        >
          Languages
        </SubmenuTrigger>
        <SubmenuPopup>
          {languages.audioTracks.length > 1 ? (
            <>
              <MenuItem disabled>Audio</MenuItem>
              <MenuRadioGroup
                value={languages.audioTracks.find((each) => each.enabled)?.id ?? ""}
                onValueChange={(value) => languages.chooseAudio(String(value))}
              >
                {languages.audioTracks.map((each) => (
                  <MenuRadioItem key={each.id} value={each.id}>
                    {each.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
              {languages.textTracks.length > 0 ? <MenuSeparator /> : null}
            </>
          ) : null}
          {languages.textTracks.length > 0 ? (
            <>
              <MenuItem disabled>Subtitles</MenuItem>
              <MenuRadioGroup
                value={languages.showing === null ? "off" : String(languages.showing)}
                onValueChange={(value) => languages.show(value === "off" ? null : Number(value))}
              >
                <MenuRadioItem value="off">Off</MenuRadioItem>
                {languages.textTracks.map((each) => (
                  <MenuRadioItem key={each.id} value={String(each.id)}>
                    {each.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </>
          ) : null}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem
        disabled={!showing}
        onClick={() => {
          for (const play of movieWindows) play();
        }}
      >
        Play All Movies
      </MenuItem>
    </>
  );
  useDesktopAppMenu("quicktime-player", "View", viewMenu, frame);

  const windowMenu = (
    <>
      <MenuItem
        keyEquivalent="command+i"
        disabled={!showing}
        onClick={() => setInspectorOpen((now) => !now)}
      >
        {inspectorOpen ? "Hide Movie Inspector" : "Show Movie Inspector"}
      </MenuItem>
      <MenuItem disabled={!showing} onClick={() => setExportsOpen((now) => !now)}>
        {exportsOpen ? "Hide Export Progress" : "Show Export Progress"}
      </MenuItem>
    </>
  );
  useDesktopAppMenu("quicktime-player", "Window", windowMenu, frame);

  // A secondary click on the picture: the commands that act on what is being watched.
  const pictureMenu = (
    <>
      <MenuItem onClick={() => askMovie(moviePlaying ? { pause: true } : { play: true })}>
        {moviePlaying ? "Pause" : "Play"}
      </MenuItem>
      <MenuSeparator />
      <MenuCheckboxItem checked={loop} onCheckedChange={setLoop}>
        Loop
      </MenuCheckboxItem>
      <MenuCheckboxItem checked={floatOnTop} onCheckedChange={setFloatOnTop}>
        Float on Top
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem disabled={!sized} onClick={actualSize}>
        Actual Size
      </MenuItem>
      <MenuItem disabled={!sized} onClick={fitToScreen}>
        Fit to Screen
      </MenuItem>
      <MenuItem disabled={!sized} onClick={() => resized(SIZE_STEP)}>
        Increase Size
      </MenuItem>
      <MenuItem disabled={!sized} onClick={() => resized(1 / SIZE_STEP)}>
        Decrease Size
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!editable || !movieLength} onClick={toggleClips}>
        {clipsOpen ? "Hide Clips" : "Show Clips"}
      </MenuItem>
      <MenuItem onClick={() => setInspectorOpen((now) => !now)}>
        {inspectorOpen ? "Hide Movie Inspector" : "Show Movie Inspector"}
      </MenuItem>
    </>
  );

  const asks = (
    <>
      <Alert open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <AlertPopup>
          <AlertMessage>Do you want to save the changes made to “{movie?.name}”?</AlertMessage>
          <AlertInformativeText>
            Your changes will be lost if you don’t save them.
          </AlertInformativeText>
          <AlertButtons>
            <PushButton
              onClick={(event) => {
                setClosing(null);
                onClose?.(event);
              }}
            >
              Don’t Save
            </PushButton>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <DefaultButton
              disabled={!drive}
              onClick={(event) => {
                setClosing(null);
                void saveMovie().then((saved) => {
                  if (saved) onClose?.(event);
                });
              }}
            >
              Save
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <AlertPopup>
          <AlertMessage>Rename</AlertMessage>
          <div className="mac-quicktime-player-location">
            <TextField
              aria-label="Name of the movie"
              autoFocus
              value={renaming ?? ""}
              onChange={(event) => setRenaming(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void renameMovie();
              }}
            />
          </div>
          <AlertButtons>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <DefaultButton disabled={!(renaming ?? "").trim()} onClick={() => void renameMovie()}>
              Rename
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={savingAs !== null} onOpenChange={(open) => !open && setSavingAs(null)}>
        <AlertPopup>
          <AlertMessage>Save As</AlertMessage>
          <div className="mac-quicktime-player-location">
            <TextField
              aria-label="Name of the new movie"
              autoFocus
              value={savingAs ?? ""}
              onChange={(event) => setSavingAs(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveAsNamed();
              }}
            />
          </div>
          <AlertButtons>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <DefaultButton disabled={!(savingAs ?? "").trim()} onClick={() => void saveAsNamed()}>
              Save
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {browsing && movie?.file && movie.blob ? (
        <DesktopVersionsSheet<Blob>
          file={{ id: movie.file, name: movie.name }}
          current={movie.blob}
          anchor={frame}
          classPrefix="mac-quicktime-player"
          readPage={(bytes, kept) => new Blob([bytes.slice()], { type: kept.type })}
          renderPage={(blob, label) => <VersionMovie blob={blob} label={label} />}
          onRestore={(kept) => void restoreKept(kept.version)}
          onDone={() => setBrowsing(false)}
        />
      ) : null}
      <Alert open={locating !== null} onOpenChange={(open) => !open && setLocating(null)}>
        <AlertPopup>
          <AlertMessage>Open Location</AlertMessage>
          <div className="mac-quicktime-player-location">
            <TextField
              aria-label="Address of the movie"
              autoFocus
              value={locating ?? ""}
              onChange={(event) => setLocating(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") openLocation();
              }}
            />
          </div>
          <AlertButtons>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <DefaultButton disabled={!(locating ?? "").trim()} onClick={openLocation}>
              Open
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <QuickTimeChooser
        message={addingAt === null ? "Add Clip to End" : "Insert Clip After Selection"}
        action={addingAt === null ? "Add" : "Insert"}
        list={addingClip}
        onCancel={() => setAddingClip(null)}
        onChoose={(row) => {
          if (drive) void addClip(row.name, () => drive.read(row.id, () => {}));
        }}
        extra={
          <>
            <PushButton onClick={() => clipFile.current?.click()}>From This Computer…</PushButton>
            <input
              ref={clipFile}
              type="file"
              accept="video/*"
              hidden
              aria-label="Clip from this computer"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void addClip(file.name, async () => file);
              }}
            />
          </>
        }
      />
      <QuickTimeChooser
        message="Move To"
        action="Move"
        list={movingTo}
        onCancel={() => setMovingTo(null)}
        onChoose={(row) => void moveMovie(row)}
      />
    </>
  );

  if (recording) {
    return (
      <>
        <QuickTimeRecording
          key={recording}
          kind={recording}
          busy={busy}
          onFinished={saveRecording}
          onTakingChange={setTaking}
          onClose={onClose}
          onMinimize={onMinimize}
          onZoom={onZoom}
          zoomRole={zoomRole}
          minimizeDisabled={minimizeDisabled}
          zoomDisabled={zoomDisabled}
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
          {...windowProps}
          ref={frameRef}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || recordingKey(event)) return;
            if (taking || !(event.metaKey || event.ctrlKey) || event.altKey) return;
            const key = event.key.toLowerCase();
            if (key === "o") {
              event.preventDefault();
              goToOpenPanel();
            } else if (key === "l") {
              event.preventDefault();
              askLocation();
            }
          }}
        />
        {asks}
      </>
    );
  }

  if (movie) {
    return (
      <>
        {floatOnTop && inDesktopWindow ? <FloatsOnTop /> : null}
        <QuickTimePlayer
          key={movie.url}
          src={movie.url}
          title={movie.edited ? `${movie.name} — Edited` : movie.name}
          duration={0}
          frameRate={FRAME_RATE}
          onMovieElement={setMovieVideo}
          defaultPosition={movie.start * FRAME_RATE}
          defaultVolume={volume}
          onVolumeLevelChange={setVolume}
          onFrameRate={setFrameRate}
          titleMenu={
            movie.blob ? (
              <>
                {renameRow}
                {moveRow}
                {duplicateRow}
                <MenuSeparator />
                {versionsRow}
              </>
            ) : undefined
          }
          onProxyPointerDown={
            movie.file && !movie.edited
              ? (event) => {
                  const { file, name, blob } = movie;
                  if (!file) return;
                  beginDesktopDrag(event.nativeEvent, {
                    from: "quicktime-player",
                    items: () => [{ id: file, name, kind: "file", type: blob?.type }],
                    icon: event.currentTarget,
                  });
                }
              : undefined
          }
          loop={loop}
          scaling={fullScreen && sized ? scaling : "fit"}
          command={command}
          pictureMenu={pictureMenu}
          data-float-on-top={floatOnTop ? "" : undefined}
          onPlayingChange={setMoviePlaying}
          onFullScreenChange={setPageFull}
          shareItems={movieShareRows}
          panel={
            <>
              {busy || message ? (
                <HudWindow
                  aria-label="Movie status"
                  className="mac-quicktime-player-work"
                  role="status"
                >
                  {busy ? (
                    <>
                      <HudWindowText>{busy.label}</HudWindowText>
                      <ProgressBar value={busy.fraction} max={1} aria-label={busy.label} />
                    </>
                  ) : (
                    <HudWindowText>{message}</HudWindowText>
                  )}
                </HudWindow>
              ) : null}
              {trim && movieLength ? (
                <QuickTimeTrimBar
                  length={movieLength}
                  start={trim.start}
                  end={trim.end}
                  onChange={(start, end) => setTrim({ start, end })}
                  onCancel={() => setTrim(null)}
                  onTrim={() => void applyEdit("Trimming…", trim)}
                />
              ) : null}
              {clipsOpen && movie.blob && movieLength ? (
                <QuickTimeClipStrip
                  blob={movie.blob}
                  length={movieLength}
                  cuts={cuts}
                  at={movieAt}
                  chosen={chosenAll ? "all" : chosen}
                  onChoose={(index, seconds, keys) => {
                    setChosenClip((now) => clipsChosen(now === "all" ? [] : now, index, keys));
                    askMovie({ seconds });
                  }}
                  onMove={moveClip}
                  clipFile={clipFileOf}
                  onDropMovies={(items, gap) => void dropMovies(items, gap)}
                  onDone={() => {
                    setChosenClip([]);
                    setClipsOpen(false);
                  }}
                />
              ) : null}
              {inspectorOpen ? (
                <InspectorPanel
                  title="Movie Inspector"
                  className="mac-quicktime-player-inspector"
                  aria-label="Movie Inspector"
                  width={280}
                  onClose={() => setInspectorOpen(false)}
                >
                  <dl className="mac-quicktime-player-inspector-rows">
                    <dt>Source</dt>
                    <dd>{movie.name}</dd>
                    <dt>Format</dt>
                    <dd>{formatOf(movie.blob?.type, movie.name)}</dd>
                    <dt>FPS</dt>
                    <dd>
                      {sized ? (frameRate ?? "Measured while it plays") : "Sound, no picture"}
                    </dd>
                    <dt>Data Size</dt>
                    <dd>{movie.blob ? formatSize(movie.blob.size) : "Unknown"}</dd>
                    <dt>Data Rate</dt>
                    <dd>
                      {movie.blob && movieLength
                        ? dataRateText(movie.blob.size, movieLength)
                        : "Unknown"}
                    </dd>
                    <dt>Length</dt>
                    <dd>{movieLength === null ? "Unknown" : timeText(movieLength)}</dd>
                    <dt>Size</dt>
                    <dd>
                      {sized ? `${movieSize.width} × ${movieSize.height}` : "Sound, no picture"}
                    </dd>
                    <dt>Current Size</dt>
                    <dd>
                      {sized
                        ? `${Math.round(movieSize.width * scale)} × ${Math.round(movieSize.height * scale)}`
                        : "Sound, no picture"}
                    </dd>
                  </dl>
                </InspectorPanel>
              ) : null}
              {exportsOpen ? (
                <InspectorPanel
                  title="Export Progress"
                  className="mac-quicktime-player-exports"
                  aria-label="Export Progress"
                  width={280}
                  onClose={() => setExportsOpen(false)}
                >
                  <div className="mac-quicktime-player-exports-rows">
                    {exportJobs.length === 0 ? <Label color="secondary">No exports.</Label> : null}
                    {exportJobs.map((job) => (
                      <div key={job.id} className="mac-quicktime-player-exports-row">
                        <Label>{job.name}</Label>
                        {job.state === "running" ? (
                          <>
                            <ProgressBar
                              value={busy?.fraction ?? 0}
                              max={1}
                              aria-label={job.name}
                            />
                            <PushButton size="small" onClick={() => working.current?.abort()}>
                              Stop
                            </PushButton>
                          </>
                        ) : (
                          <Label color="secondary">{EXPORT_STATES[job.state]}</Label>
                        )}
                      </div>
                    ))}
                  </div>
                </InspectorPanel>
              ) : null}
            </>
          }
          onMovieSize={(size) => {
            setScale(1);
            setMovieSize(size);
          }}
          onTimeChange={(seconds, duration, playing) => {
            setMovieLength(Number.isFinite(duration) && duration > 0 ? duration : null);
            setMovieAt(seconds);
            const file = movie.file;
            if (file && !movie.edited) {
              setRecents((now) => placedIn(now, file, seconds, duration, playing));
            }
          }}
          onClose={closeWindow}
          onMinimize={onMinimize}
          onZoom={onZoom}
          zoomRole={zoomRole}
          minimizeDisabled={minimizeDisabled}
          zoomDisabled={zoomDisabled}
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
          {...windowProps}
          ref={frameRef}
          onKeyDown={(event) => {
            // The host hears the key first and may claim it.
            onKeyDown?.(event);
            if (event.defaultPrevented || recordingKey(event)) return;
            // While trimming, I and O set the handles at the playhead.
            if (
              trim &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey &&
              event.currentTarget.contains(event.target as Node)
            ) {
              const key = event.key.toLowerCase();
              if (key === "i") {
                event.preventDefault();
                setTrim({ ...trim, start: Math.min(movieAt, trim.end - LEAST_LENGTH) });
                return;
              }
              if (key === "o") {
                event.preventDefault();
                setTrim({ ...trim, end: Math.max(movieAt, trim.start + LEAST_LENGTH) });
                return;
              }
            }
            if (event.metaKey || event.ctrlKey) {
              const key = event.key.toLowerCase();
              // A plus sign takes Shift on many keyboards; no other of these commands has it.
              const command = event.shiftKey
                ? (
                    {
                      "+": () => resized(SIZE_STEP),
                      z: redoEdit,
                      l: () => pictured && void applyEdit("Rotating…", { turns: 3 }),
                      r: () => pictured && void applyEdit("Rotating…", { turns: 1 }),
                      s: () => void duplicateMovie(),
                    } as Record<string, () => void>
                  )[key]
                : event.altKey
                  ? // Option changes the letter a key types on a Mac: the key itself is what counts.
                    (
                      {
                        KeyL: () => setLoop((now) => !now),
                        KeyH: () => pictured && void applyEdit("Flipping…", { flipX: true }),
                        KeyV: () => pictured && void applyEdit("Flipping…", { flipY: true }),
                      } as Record<string, () => void>
                    )[event.code]
                  : (
                      {
                        "1": actualSize,
                        "3": fitToScreen,
                        "4": () => scaleTo("fill"),
                        "5": () => scaleTo("panoramic"),
                        e: toggleClips,
                        y: splitClip,
                        x: cutClip,
                        c: copyClip,
                        v: pasteClip,
                        a: selectAllClips,
                        i: () => setInspectorOpen((now) => !now),
                        "+": () => resized(SIZE_STEP),
                        "=": () => resized(SIZE_STEP),
                        "-": () => resized(1 / SIZE_STEP),
                        z: undoEdit,
                        t: startTrim,
                        s: () => void saveMovie(),
                        l: askLocation,
                      } as Record<string, () => void>
                    )[key];
              if (command) {
                event.preventDefault();
                command();
                return;
              }
            }
            if (
              (event.metaKey || event.ctrlKey) &&
              !event.altKey &&
              event.key.toLowerCase() === "o"
            ) {
              event.preventDefault();
              goToOpenPanel();
            }
            // A key pressed in a menu or a dialog reaches the window through React though it is elsewhere.
            if (
              (event.key === "Delete" || event.key === "Backspace") &&
              !nothingChosen &&
              event.currentTarget.contains(event.target as Node)
            ) {
              event.preventDefault();
              deleteClip();
            }
          }}
        />
        {asks}
      </>
    );
  }

  const allRows: OpenRow[] =
    place === RECENTS_PLACE
      ? recents.map((recent) => ({ id: recent.file, name: recent.name, modified: recent.at }))
      : Array.isArray(movies)
        ? movies
        : [];
  const wanted = search.trim().toLowerCase();
  const rows = wanted ? allRows.filter((row) => row.name.toLowerCase().includes(wanted)) : allRows;
  const choices =
    openView === "column"
      ? columnChoice
        ? [columnChoice]
        : []
      : rows.filter((row) => selected.includes(row.id));
  const placeName = nameOfPlace(place);
  const status =
    message ??
    (place !== RECENTS_PLACE && typeof movies === "string"
      ? movies
      : drive && rows.length === 0 && allRows.length > 0
        ? `No movie matches “${search.trim()}”.`
        : drive && rows.length === 0
          ? place === RECENTS_PLACE
            ? "No recent movies."
            : movies === null
              ? `Reading ${placeName}…`
              : place === MOVIES_PLACE.id
                ? "Movies is empty. Choose “From This Computer…” to upload a movie."
                : `${placeName} has no movies.`
          : null);

  const go = (next: string) => {
    setPlace(next);
    setSelected([]);
    setColumnChoice(null);
  };
  // Choosing a place (the sidebar, the Location pop-up or a folder in the list) adds the one left to
  // Back's history and clears Forward's, as a Finder window's history does.
  const choose = (next: string) => {
    if (next !== place) {
      setBack((visits) => [...visits, place]);
      setForward([]);
    }
    go(next);
  };
  const goInto = (folder: OpenRow) => {
    setVisited((now) => [
      ...now.filter((each) => each.id !== folder.id),
      { id: folder.id, name: folder.name },
    ]);
    choose(folder.id);
  };
  /** Open and a double click: a folder goes in, and movies open, the first here and each other in a window of its own. */
  const openChoices = (asked: readonly OpenRow[]) => {
    const files = asked.filter((row) => !row.folder);
    const [first, ...others] = files;
    if (first) {
      openInOwnWindows(others);
      void openFile(first);
      return;
    }
    if (asked[0]) goInto(asked[0]);
  };
  const rowAction = (index: number) => {
    const row = rows[index];
    if (!row || busy !== null || loading) return;
    openChoices(row.folder || !selected.includes(row.id) ? [row] : choices);
  };
  const listedContents = drive?.contents
    ? async (folder: string) =>
        ((await drive.contents?.(folder)) ?? []).filter(
          (each) => each.folder || opensInQuickTime(each),
        )
    : undefined;
  const locations = [
    ...places.map(({ id, name }) => ({ value: id, label: name })),
    { value: RECENTS_PLACE, label: "Recents", separatorBefore: true },
    ...(place === RECENTS_PLACE || places.some((each) => each.id === place)
      ? []
      : [{ value: place, label: placeName, separatorBefore: true }]),
  ];
  const goBack = () => {
    const previous = back[back.length - 1];
    if (!previous) return;
    setBack(back.slice(0, -1));
    setForward([place, ...forward]);
    go(previous);
  };
  const goForward = () => {
    const next = forward[0];
    if (!next) return;
    setForward(forward.slice(1));
    setBack([...back, place]);
    go(next);
  };
  return (
    <>
      <Window
        aria-label="Open"
        aria-busy={loading || busy !== null || undefined}
        // Until Recents have loaded nothing in the window can be used.
        inert={loading || undefined}
        className="mac-quicktime-player-open"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) recordingKey(event);
        }}
        {...windowProps}
        ref={frameRef}
      >
        <TitleBar
          title="Open"
          controls={
            <WindowControls
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        />
        <OpenPanelBrowser
          className="mac-quicktime-player-open-browser"
          locations={locations}
          location={place}
          onLocationChange={choose}
          canGoBack={back.length > 0}
          canGoForward={forward.length > 0}
          onBack={goBack}
          onForward={goForward}
          search={search}
          onSearchChange={setSearch}
          view={openView}
          onViewChange={setOpenView}
          header={
            openView === "list" ? (
              <div className="mac-quicktime-player-open-row" data-header="">
                <span>Name</span>
                <span>Date Modified</span>
                <span>Size</span>
              </div>
            ) : undefined
          }
          sidebar={
            drive ? (
              <Sidebar
                aria-label="Places"
                material="opaque"
                value={place}
                onValueChange={choose}
                style={{ height: "100%" }}
              >
                <SidebarSection title="Favorites">
                  <SidebarItem value={RECENTS_PLACE} label="Recents" />
                  {places.map(({ id, name }) => (
                    <SidebarItem key={id} value={id} label={name} />
                  ))}
                </SidebarSection>
              </Sidebar>
            ) : undefined
          }
        >
          {openView === "column" ? (
            <MovieColumns
              key={`${place}:${wanted}`}
              label={placeName}
              rows={rows}
              contents={listedContents}
              preview={drive?.preview}
              iconOf={iconOfRow}
              onChoose={setColumnChoice}
              onOpen={(row) => {
                if (busy === null && !loading) openChoices([row]);
              }}
            />
          ) : openView === "gallery" ? (
            <MovieGallery
              label={placeName}
              rows={rows}
              preview={drive?.preview}
              iconOf={iconOfRow}
              value={selected}
              onValueChange={setSelected}
              onItemAction={rowAction}
            />
          ) : openView === "icon" ? (
            <IconView
              aria-label={placeName}
              count={rows.length}
              getItemId={(index) => rows[index]?.id ?? index}
              getItemLabel={(index) => rows[index]?.name ?? ""}
              renderIcon={(index) => iconOfRow(rows[index] ?? { id: "", name: "" })}
              selectionMode={inDesktopWindow ? "multiple" : "single"}
              value={selected}
              onValueChange={setSelected}
              onItemAction={rowAction}
              className="mac-quicktime-player-open-icons"
            />
          ) : (
            <ListView
              aria-label={placeName}
              count={rows.length}
              rowHeight={24}
              getRowId={(index) => rows[index]?.id ?? index}
              getRowLabel={(index) => rows[index]?.name ?? ""}
              renderRow={(index) => {
                const row = rows[index];
                return (
                  <div className="mac-quicktime-player-open-row">
                    <span className="mac-quicktime-player-open-name">
                      {row?.folder ? <FolderGlyph /> : null}
                      <ListViewRowTitle>{row?.name}</ListViewRowTitle>
                    </span>
                    <span aria-hidden="true">{modifiedText(row?.modified)}</span>
                    <span aria-hidden="true">
                      {formatSize(row?.folder ? undefined : row?.size)}
                    </span>
                  </div>
                );
              }}
              selectionMode={inDesktopWindow ? "multiple" : "single"}
              value={selected}
              onValueChange={setSelected}
              onRowAction={rowAction}
            />
          )}
        </OpenPanelBrowser>
        {busy || status ? (
          <div className="mac-quicktime-player-open-status" role="status">
            {busy ? (
              <>
                <Label>{busy.label}</Label>
                <ProgressBar value={busy.fraction} max={1} aria-label={busy.label} />
              </>
            ) : (
              <Label color="secondary">{status}</Label>
            )}
          </div>
        ) : null}
        {refused.map((take) => (
          <div
            key={`${take.file.name}:${take.file.lastModified}`}
            className="mac-quicktime-player-open-unsaved"
            role="alert"
          >
            <Label>
              “{take.file.name}” could not be saved: {take.reason}
            </Label>
            <PushButton
              size="small"
              disabled={busy !== null || loading}
              onClick={() => void saveRecording(take.file)}
            >
              Try Again
            </PushButton>
          </div>
        ))}
        <div className="mac-quicktime-player-open-bar">
          <PushButton disabled={busy !== null || loading} onClick={() => chooser.current?.click()}>
            From This Computer…
          </PushButton>
          <input
            ref={chooser}
            type="file"
            accept="video/*"
            hidden
            aria-label="Movie from this computer"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void openChosenFile(file);
            }}
          />
          <span className="mac-quicktime-player-open-gap" />
          <PushButton keyEquivalent="escape" onClick={(event) => onClose?.(event)}>
            Cancel
          </PushButton>
          <DefaultButton
            disabled={choices.length === 0 || busy !== null || loading}
            onClick={() => openChoices(choices)}
          >
            Open
          </DefaultButton>
        </div>
      </Window>
      {asks}
    </>
  );
}
